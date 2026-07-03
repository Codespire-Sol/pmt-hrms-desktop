import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import {
  Webhook,
  WebhookWithCreator,
  WebhookDelivery,
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookEventType,
  DeliveryStatus,
} from './webhooks.types';

export class WebhooksRepository {
  // === Webhook CRUD ===

  async create(projectId: string, createdBy: string, input: CreateWebhookInput): Promise<Webhook> {
    const webhook = await prisma.webhook.create({
      data: {
        projectId,
        createdBy,
        name: input.name,
        description: input.description,
        url: input.url,
        method: input.method || 'POST',
        headers: (input.headers || {}) as Prisma.InputJsonValue,
        secret: input.secret,
        events: input.events as Prisma.InputJsonValue,
        maxRetries: input.maxRetries ?? 3,
        retryDelaySeconds: input.retryDelaySeconds ?? 60,
        exponentialBackoff: input.exponentialBackoff ?? true,
        payloadFormat: input.payloadFormat || 'json',
        customPayload: input.customPayload,
      },
    });

    return this.mapWebhook(webhook);
  }

  async findById(id: string): Promise<Webhook | null> {
    const webhook = await prisma.webhook.findUnique({ where: { id } });
    return webhook ? this.mapWebhook(webhook) : null;
  }

  async findByIdWithCreator(id: string): Promise<WebhookWithCreator | null> {
    const webhook = await prisma.webhook.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!webhook) return null;

    return {
      ...this.mapWebhook(webhook),
      creator: {
        id: webhook.createdBy,
        displayName: `${(webhook as any).creator?.firstName || ''} ${(webhook as any).creator?.lastName || ''}`.trim(),
        email: (webhook as any).creator?.email || '',
        avatarUrl: (webhook as any).creator?.avatarUrl || null,
      },
    };
  }

  async findByProject(
    projectId: string,
    options: {
      isEnabled?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ webhooks: WebhookWithCreator[]; total: number }> {
    const where: Prisma.WebhookWhereInput = {
      projectId,
    };

    if (options.isEnabled !== undefined) {
      where.isEnabled = options.isEnabled;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { url: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [total, webhooks] = await Promise.all([
      prisma.webhook.count({ where }),
      prisma.webhook.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
    ]);

    return {
      webhooks: webhooks.map((w) => ({
        ...this.mapWebhook(w),
        creator: {
          id: w.createdBy,
          displayName: `${(w as any).creator?.firstName || ''} ${(w as any).creator?.lastName || ''}`.trim(),
          email: (w as any).creator?.email || '',
          avatarUrl: (w as any).creator?.avatarUrl || null,
        },
      })),
      total,
    };
  }

  async findByProjectAndEvent(projectId: string, eventType: WebhookEventType): Promise<Webhook[]> {
    const webhooks = await prisma.$queryRaw<any[]>`
      SELECT * FROM webhooks
      WHERE project_id = ${projectId}
        AND is_enabled = true
        AND events @> ${JSON.stringify([eventType])}::jsonb
    `;

    return webhooks.map((w: any) => this.mapWebhookFromRaw(w));
  }

  async update(id: string, input: UpdateWebhookInput): Promise<Webhook | null> {
    const updateData: Prisma.WebhookUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.url !== undefined) updateData.url = input.url;
    if (input.method !== undefined) updateData.method = input.method;
    if (input.headers !== undefined) updateData.headers = input.headers as Prisma.InputJsonValue;
    if (input.secret !== undefined) updateData.secret = input.secret;
    if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;
    if (input.events !== undefined) updateData.events = input.events as Prisma.InputJsonValue;
    if (input.maxRetries !== undefined) updateData.maxRetries = input.maxRetries;
    if (input.retryDelaySeconds !== undefined) updateData.retryDelaySeconds = input.retryDelaySeconds;
    if (input.exponentialBackoff !== undefined) updateData.exponentialBackoff = input.exponentialBackoff;
    if (input.payloadFormat !== undefined) updateData.payloadFormat = input.payloadFormat;
    if (input.customPayload !== undefined) updateData.customPayload = input.customPayload;

    const webhook = await prisma.webhook.update({
      where: { id },
      data: updateData,
    });

    return webhook ? this.mapWebhook(webhook) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.webhook.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async toggleEnabled(id: string, isEnabled: boolean): Promise<Webhook | null> {
    const webhook = await prisma.webhook.update({
      where: { id },
      data: { isEnabled },
    });

    return webhook ? this.mapWebhook(webhook) : null;
  }

  // === Delivery Logging ===

  async createDelivery(data: {
    webhookId: string;
    eventType: WebhookEventType;
    eventId?: string;
    payload: any;
    headersSent: Record<string, string>;
    requestUrl: string;
    requestMethod: string;
    maxAttempts: number;
  }): Promise<WebhookDelivery> {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: data.webhookId,
        eventType: data.eventType,
        eventId: data.eventId,
        payload: data.payload as Prisma.InputJsonValue,
        headersSent: data.headersSent as Prisma.InputJsonValue,
        requestUrl: data.requestUrl,
        requestMethod: data.requestMethod,
        maxAttempts: data.maxAttempts,
      },
    });

    return this.mapDelivery(delivery);
  }

  async updateDelivery(
    id: string,
    data: {
      status: DeliveryStatus;
      responseStatusCode?: number;
      responseBody?: string;
      responseHeaders?: Record<string, string>;
      durationMs?: number;
      errorMessage?: string;
      attemptNumber?: number;
      nextRetryAt?: Date;
      completedAt?: Date;
    }
  ): Promise<WebhookDelivery | null> {
    const updateData: Prisma.WebhookDeliveryUpdateInput = {
      status: data.status,
    };

    if (data.responseStatusCode !== undefined) updateData.responseStatusCode = data.responseStatusCode;
    if (data.responseBody !== undefined) updateData.responseBody = data.responseBody;
    if (data.responseHeaders) updateData.responseHeaders = data.responseHeaders as Prisma.InputJsonValue;
    if (data.durationMs !== undefined) updateData.durationMs = data.durationMs;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
    if (data.attemptNumber !== undefined) updateData.attemptNumber = data.attemptNumber;
    if (data.nextRetryAt !== undefined) updateData.nextRetryAt = data.nextRetryAt;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;

    const delivery = await prisma.webhookDelivery.update({
      where: { id },
      data: updateData,
    });

    return delivery ? this.mapDelivery(delivery) : null;
  }

  async findDeliveries(
    webhookId: string,
    options: {
      status?: DeliveryStatus;
      eventType?: WebhookEventType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
    const where: Prisma.WebhookDeliveryWhereInput = { webhookId };

    if (options.status) {
      where.status = options.status;
    }

    if (options.eventType) {
      where.eventType = options.eventType;
    }

    const [total, deliveries] = await Promise.all([
      prisma.webhookDelivery.count({ where }),
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
    ]);

    return {
      deliveries: deliveries.map((d: any) => this.mapDelivery(d)),
      total,
    };
  }

  async findPendingRetries(): Promise<WebhookDelivery[]> {
    const deliveries = await prisma.$queryRaw<any[]>`
      SELECT * FROM webhook_deliveries
      WHERE status = 'retrying'
        AND next_retry_at <= NOW()
        AND attempt_number < max_attempts
    `;

    return deliveries.map((d: any) => this.mapDeliveryFromRaw(d));
  }

  async updateWebhookStats(webhookId: string, success: boolean): Promise<void> {
    if (success) {
      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          totalDeliveries: { increment: 1 },
          lastDeliveryAt: new Date(),
          successfulDeliveries: { increment: 1 },
          lastSuccessAt: new Date(),
        },
      });
    } else {
      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          totalDeliveries: { increment: 1 },
          lastDeliveryAt: new Date(),
          failedDeliveries: { increment: 1 },
          lastFailureAt: new Date(),
        },
      });
    }
  }

  // === Mapping Methods ===

  private mapWebhook(row: any): Webhook {
    return {
      id: row.id,
      projectId: row.projectId,
      createdBy: row.createdBy,
      name: row.name,
      description: row.description,
      url: row.url,
      method: row.method,
      headers: row.headers as Record<string, string>,
      secret: row.secret,
      isEnabled: row.isEnabled,
      events: row.events as WebhookEventType[],
      maxRetries: row.maxRetries,
      retryDelaySeconds: row.retryDelaySeconds,
      exponentialBackoff: row.exponentialBackoff,
      payloadFormat: row.payloadFormat,
      customPayload: row.customPayload,
      totalDeliveries: row.totalDeliveries,
      successfulDeliveries: row.successfulDeliveries,
      failedDeliveries: row.failedDeliveries,
      lastDeliveryAt: row.lastDeliveryAt,
      lastSuccessAt: row.lastSuccessAt,
      lastFailureAt: row.lastFailureAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapWebhookFromRaw(row: any): Webhook {
    return {
      id: row.id,
      projectId: row.project_id,
      createdBy: row.created_by,
      name: row.name,
      description: row.description,
      url: row.url,
      method: row.method,
      headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : row.headers,
      secret: row.secret,
      isEnabled: row.is_enabled,
      events: typeof row.events === 'string' ? JSON.parse(row.events) : row.events,
      maxRetries: row.max_retries,
      retryDelaySeconds: row.retry_delay_seconds,
      exponentialBackoff: row.exponential_backoff,
      payloadFormat: row.payload_format,
      customPayload: row.custom_payload,
      totalDeliveries: row.total_deliveries,
      successfulDeliveries: row.successful_deliveries,
      failedDeliveries: row.failed_deliveries,
      lastDeliveryAt: row.last_delivery_at,
      lastSuccessAt: row.last_success_at,
      lastFailureAt: row.last_failure_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapDelivery(row: any): WebhookDelivery {
    return {
      id: row.id,
      webhookId: row.webhookId,
      eventType: row.eventType,
      eventId: row.eventId,
      payload: row.payload as Record<string, any>,
      headersSent: row.headersSent as Record<string, string>,
      requestUrl: row.requestUrl,
      requestMethod: row.requestMethod,
      status: row.status,
      responseStatusCode: row.responseStatusCode,
      responseBody: row.responseBody,
      responseHeaders: row.responseHeaders as Record<string, string> | undefined,
      durationMs: row.durationMs,
      errorMessage: row.errorMessage,
      attemptNumber: row.attemptNumber,
      maxAttempts: row.maxAttempts,
      nextRetryAt: row.nextRetryAt,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  }

  private mapDeliveryFromRaw(row: any): WebhookDelivery {
    return {
      id: row.id,
      webhookId: row.webhook_id,
      eventType: row.event_type,
      eventId: row.event_id,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      headersSent: typeof row.headers_sent === 'string' ? JSON.parse(row.headers_sent) : row.headers_sent,
      requestUrl: row.request_url,
      requestMethod: row.request_method,
      status: row.status,
      responseStatusCode: row.response_status_code,
      responseBody: row.response_body,
      responseHeaders: row.response_headers
        ? typeof row.response_headers === 'string'
          ? JSON.parse(row.response_headers)
          : row.response_headers
        : undefined,
      durationMs: row.duration_ms,
      errorMessage: row.error_message,
      attemptNumber: row.attempt_number,
      maxAttempts: row.max_attempts,
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }
}
