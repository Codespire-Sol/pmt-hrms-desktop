import { Request, Response } from 'express';
import { z } from 'zod';
import { WebhooksService } from './webhooks.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

const createWebhookSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string()).optional(),
  secret: z.string().max(500).optional(),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  maxRetries: z.number().int().min(0).max(10).optional(),
  retryDelaySeconds: z.number().int().min(10).max(3600).optional(),
  exponentialBackoff: z.boolean().optional(),
  payloadFormat: z.enum(['json', 'form']).optional(),
  customPayload: z.string().max(10000).optional(),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  url: z.string().url().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string()).optional(),
  secret: z.string().max(500).optional(),
  isEnabled: z.boolean().optional(),
  events: z.array(z.string()).min(1).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  retryDelaySeconds: z.number().int().min(10).max(3600).optional(),
  exponentialBackoff: z.boolean().optional(),
  payloadFormat: z.enum(['json', 'form']).optional(),
  customPayload: z.string().max(10000).optional(),
});

export class WebhooksController {
  private service: WebhooksService;

  constructor() {
    this.service = new WebhooksService();
  }

  // === Webhook CRUD ===

  createWebhook = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createWebhookSchema.parse(req.body);
      const webhook = await this.service.createWebhook(
        req.params.projectId,
        req.user!.id,
        input as any
      );

      res.status(201).json({
        success: true,
        message: 'Webhook created successfully',
        data: webhook,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getWebhook = asyncHandler(async (req: Request, res: Response) => {
    const webhook = await this.service.getWebhook(req.params.webhookId);

    res.json({
      success: true,
      data: webhook,
    });
  });

  getWebhooks = asyncHandler(async (req: Request, res: Response) => {
    const options = {
      isEnabled: req.query.isEnabled === 'true' ? true : req.query.isEnabled === 'false' ? false : undefined,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    const result = await this.service.getWebhooks(req.params.projectId, options);

    res.json({
      success: true,
      data: result,
    });
  });

  updateWebhook = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateWebhookSchema.parse(req.body);
      const webhook = await this.service.updateWebhook(req.params.webhookId, input as any);

      res.json({
        success: true,
        message: 'Webhook updated successfully',
        data: webhook,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteWebhook = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteWebhook(req.params.webhookId);

    res.json({
      success: true,
      ...result,
    });
  });

  toggleWebhook = asyncHandler(async (req: Request, res: Response) => {
    const { isEnabled } = req.body;

    if (typeof isEnabled !== 'boolean') {
      throw ApiError.badRequest('isEnabled must be a boolean');
    }

    const webhook = await this.service.toggleWebhook(req.params.webhookId, isEnabled);

    res.json({
      success: true,
      message: isEnabled ? 'Webhook enabled' : 'Webhook disabled',
      data: webhook,
    });
  });

  // === Test Webhook ===

  testWebhook = asyncHandler(async (req: Request, res: Response) => {
    const webhook = await this.service.getWebhook(req.params.webhookId);

    // Trigger a test event
    await this.service.triggerWebhook(
      webhook.projectId,
      'issue.created',
      {
        test: true,
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString(),
      },
      {
        id: req.user!.id,
        displayName: (req.user as any).displayName || 'Test User',
        email: req.user!.email || 'test@example.com',
      }
    );

    res.json({
      success: true,
      message: 'Test webhook triggered',
    });
  });

  // === Delivery History ===

  getDeliveries = asyncHandler(async (req: Request, res: Response) => {
    const options = {
      status: req.query.status as any,
      eventType: req.query.eventType as any,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    const result = await this.service.getDeliveries(req.params.webhookId, options);

    res.json({
      success: true,
      data: result,
    });
  });

  retryDelivery = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.retryDelivery(req.params.deliveryId);

    res.json({
      success: true,
      ...result,
    });
  });

  // === Reference Data ===

  getAvailableEvents = asyncHandler(async (_req: Request, res: Response) => {
    const events = this.service.getAvailableEvents();

    res.json({
      success: true,
      data: events,
    });
  });
}
