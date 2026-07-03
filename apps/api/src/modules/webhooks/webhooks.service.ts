import crypto from 'crypto';
import { WebhooksRepository } from './webhooks.repository';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { prisma } from '../../database/prisma';
import {
  Webhook,
  WebhookWithCreator,
  WebhookDelivery,
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookEventType,
  WebhookEventPayload,
  DeliveryStatus,
  WEBHOOK_EVENT_DESCRIPTIONS,
} from './webhooks.types';
import { teamsService } from '../teams/teams.service';

// Sentinel name used by the Teams integration panel
const TEAMS_WEBHOOK_NAME = 'Microsoft Teams Channel';

export class WebhooksService {
  private repository: WebhooksRepository;

  constructor() {
    this.repository = new WebhooksRepository();
  }

  // === Webhook Management ===

  async createWebhook(
    projectId: string,
    userId: string,
    input: CreateWebhookInput
  ): Promise<WebhookWithCreator> {
    // Validate URL
    try {
      new URL(input.url);
    } catch {
      throw ApiError.badRequest('Invalid webhook URL');
    }

    // Validate events
    if (!input.events || input.events.length === 0) {
      throw ApiError.badRequest('At least one event subscription is required');
    }

    const invalidEvents = input.events.filter((e) => !WEBHOOK_EVENT_DESCRIPTIONS[e]);
    if (invalidEvents.length > 0) {
      throw ApiError.badRequest(`Invalid event types: ${invalidEvents.join(', ')}`);
    }

    const webhook = await this.repository.create(projectId, userId, input);
    return (await this.repository.findByIdWithCreator(webhook.id))!;
  }

  async getWebhook(webhookId: string): Promise<WebhookWithCreator> {
    const webhook = await this.repository.findByIdWithCreator(webhookId);
    if (!webhook) {
      throw ApiError.notFound('Webhook not found');
    }
    return webhook;
  }

  async getWebhooks(
    projectId: string,
    options: {
      isEnabled?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ webhooks: WebhookWithCreator[]; pagination: any }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    const { webhooks, total } = await this.repository.findByProject(projectId, {
      ...options,
      limit,
      offset,
    });

    return {
      webhooks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateWebhook(webhookId: string, input: UpdateWebhookInput): Promise<WebhookWithCreator> {
    const webhook = await this.repository.findById(webhookId);
    if (!webhook) {
      throw ApiError.notFound('Webhook not found');
    }

    // Validate URL if provided
    if (input.url) {
      try {
        new URL(input.url);
      } catch {
        throw ApiError.badRequest('Invalid webhook URL');
      }
    }

    // Validate events if provided
    if (input.events) {
      if (input.events.length === 0) {
        throw ApiError.badRequest('At least one event subscription is required');
      }
      const invalidEvents = input.events.filter((e) => !WEBHOOK_EVENT_DESCRIPTIONS[e]);
      if (invalidEvents.length > 0) {
        throw ApiError.badRequest(`Invalid event types: ${invalidEvents.join(', ')}`);
      }
    }

    await this.repository.update(webhookId, input);
    return (await this.repository.findByIdWithCreator(webhookId))!;
  }

  async deleteWebhook(webhookId: string): Promise<{ message: string }> {
    const webhook = await this.repository.findById(webhookId);
    if (!webhook) {
      throw ApiError.notFound('Webhook not found');
    }

    await this.repository.delete(webhookId);
    return { message: 'Webhook deleted successfully' };
  }

  async toggleWebhook(webhookId: string, isEnabled: boolean): Promise<WebhookWithCreator> {
    const webhook = await this.repository.findById(webhookId);
    if (!webhook) {
      throw ApiError.notFound('Webhook not found');
    }

    await this.repository.toggleEnabled(webhookId, isEnabled);
    return (await this.repository.findByIdWithCreator(webhookId))!;
  }

  // === Delivery Management ===

  async triggerWebhook(
    projectId: string,
    eventType: WebhookEventType,
    data: any,
    actor?: { id: string; displayName: string; email: string },
    eventId?: string
  ): Promise<void> {
    const webhooks = await this.repository.findByProjectAndEvent(projectId, eventType);

    if (webhooks.length === 0) {
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    const payload: WebhookEventPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      projectId,
      projectName: project?.name,
      actor,
      data,
    };

    // Dispatch deliveries for each webhook
    await Promise.all(
      webhooks.map((webhook) => this.dispatchDelivery(webhook, eventType, payload, eventId))
    );
  }

  private async dispatchDelivery(
    webhook: Webhook,
    eventType: WebhookEventType,
    payload: WebhookEventPayload,
    eventId?: string
  ): Promise<void> {
    // Teams webhooks are intercepted and delivered as Adaptive Cards
    if (webhook.name === TEAMS_WEBHOOK_NAME) {
      try {
        await teamsService.deliverEvent(webhook.projectId, payload);
      } catch (err: any) {
        logger.error(`Teams Adaptive Card delivery error for project ${webhook.projectId}`, { error: err?.message });
      }
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': webhook.payloadFormat === 'json' ? 'application/json' : 'application/x-www-form-urlencoded',
      'User-Agent': 'ProjectFlow-Webhook/1.0',
      'X-Webhook-Event': eventType,
      'X-Webhook-Delivery-Id': crypto.randomUUID(),
      ...webhook.headers,
    };

    // Add HMAC signature if secret is configured
    if (webhook.secret) {
      const signature = this.generateSignature(payload, webhook.secret);
      headers['X-Webhook-Signature'] = signature;
      headers['X-Webhook-Signature-256'] = `sha256=${signature}`;
    }

    // Create delivery record
    const delivery = await this.repository.createDelivery({
      webhookId: webhook.id,
      eventType,
      eventId,
      payload,
      headersSent: headers,
      requestUrl: webhook.url,
      requestMethod: webhook.method,
      maxAttempts: webhook.maxRetries + 1,
    });

    // Execute the delivery
    await this.executeDelivery(webhook, delivery, payload, headers);
  }

  private async executeDelivery(
    webhook: Webhook,
    delivery: WebhookDelivery,
    payload: any,
    headers: Record<string, string>
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Prepare body
      let body: string;
      if (webhook.customPayload) {
        body = this.interpolatePayload(webhook.customPayload, payload);
      } else if (webhook.payloadFormat === 'form') {
        body = new URLSearchParams(this.flattenObject(payload)).toString();
      } else {
        body = JSON.stringify(payload);
      }

      // Make the request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers,
        body: webhook.method !== 'GET' ? body : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const durationMs = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');
      const responseHeaders = Object.fromEntries(response.headers.entries());

      const isSuccess = response.ok;

      await this.repository.updateDelivery(delivery.id, {
        status: isSuccess ? 'success' : 'failed',
        responseStatusCode: response.status,
        responseBody: responseBody.substring(0, 10000), // Limit response body size
        responseHeaders,
        durationMs,
        completedAt: new Date(),
      });

      await this.repository.updateWebhookStats(webhook.id, isSuccess);

      if (!isSuccess) {
        logger.warn(`Webhook delivery failed: ${webhook.id}, status: ${response.status}`);
        await this.scheduleRetry(webhook, delivery);
      }
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error.name === 'AbortError' ? 'Request timed out' : error.message;

      await this.repository.updateDelivery(delivery.id, {
        status: 'failed',
        errorMessage,
        durationMs,
        completedAt: new Date(),
      });

      await this.repository.updateWebhookStats(webhook.id, false);

      logger.error(`Webhook delivery error: ${webhook.id}`, { error: errorMessage });
      await this.scheduleRetry(webhook, delivery);
    }
  }

  private async scheduleRetry(webhook: Webhook, delivery: WebhookDelivery): Promise<void> {
    if (delivery.attemptNumber >= delivery.maxAttempts) {
      logger.info(`Webhook ${webhook.id} max retries reached for delivery ${delivery.id}`);
      return;
    }

    const nextAttempt = delivery.attemptNumber + 1;
    let delaySeconds = webhook.retryDelaySeconds;

    if (webhook.exponentialBackoff) {
      delaySeconds = delaySeconds * Math.pow(2, delivery.attemptNumber - 1);
    }

    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

    await this.repository.updateDelivery(delivery.id, {
      status: 'retrying',
      attemptNumber: nextAttempt,
      nextRetryAt,
    });

    logger.info(
      `Scheduled webhook retry ${nextAttempt}/${delivery.maxAttempts} for ${webhook.id} at ${nextRetryAt.toISOString()}`
    );
  }

  async processRetries(): Promise<number> {
    const pendingRetries = await this.repository.findPendingRetries();
    let processed = 0;

    for (const delivery of pendingRetries) {
      const webhook = await this.repository.findById(delivery.webhookId);
      if (!webhook || !webhook.isEnabled) {
        await this.repository.updateDelivery(delivery.id, {
          status: 'failed',
          errorMessage: 'Webhook disabled or deleted',
          completedAt: new Date(),
        });
        continue;
      }

      await this.executeDelivery(webhook, delivery, delivery.payload, delivery.headersSent);
      processed++;
    }

    return processed;
  }

  // === Delivery History ===

  async getDeliveries(
    webhookId: string,
    options: {
      status?: DeliveryStatus;
      eventType?: WebhookEventType;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ deliveries: WebhookDelivery[]; pagination: any }> {
    const webhook = await this.repository.findById(webhookId);
    if (!webhook) {
      throw ApiError.notFound('Webhook not found');
    }

    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    const { deliveries, total } = await this.repository.findDeliveries(webhookId, {
      ...options,
      limit,
      offset,
    });

    return {
      deliveries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async retryDelivery(deliveryId: string): Promise<{ message: string }> {
    // Find delivery by iterating (would need to add direct lookup in production)
    const deliveries = await this.repository.findPendingRetries();
    const delivery = deliveries.find((d) => d.id === deliveryId);

    if (!delivery) {
      throw ApiError.notFound('Delivery not found or not eligible for retry');
    }

    const webhook = await this.repository.findById(delivery.webhookId);
    if (!webhook) {
      throw ApiError.notFound('Webhook not found');
    }

    await this.executeDelivery(webhook, delivery, delivery.payload, delivery.headersSent);
    return { message: 'Delivery retry initiated' };
  }

  // === Reference Data ===

  getAvailableEvents(): { type: WebhookEventType; description: string }[] {
    return Object.entries(WEBHOOK_EVENT_DESCRIPTIONS).map(([type, description]) => ({
      type: type as WebhookEventType,
      description,
    }));
  }

  // === Utility Methods ===

  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  private interpolatePayload(template: string, payload: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], payload);
      return value !== undefined ? String(value) : '';
    });
  }

  private flattenObject(obj: any, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}[${key}]` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            Object.assign(result, this.flattenObject(item, `${newKey}[${index}]`));
          } else {
            result[`${newKey}[${index}]`] = String(item);
          }
        });
      } else {
        result[newKey] = String(value ?? '');
      }
    }

    return result;
  }
}

// Singleton instance for triggering webhooks from other services
export const webhooksService = new WebhooksService();
