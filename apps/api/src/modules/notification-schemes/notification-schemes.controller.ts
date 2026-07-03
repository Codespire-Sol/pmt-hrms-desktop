import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { notificationSchemesService } from './notification-schemes.service';

const createSchemeSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  isDefault: z.boolean().optional(),
});

const updateSchemeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  isDefault: z.boolean().optional(),
});

const createRuleSchema = z.object({
  eventType: z.enum([
    'issue_created',
    'issue_updated',
    'issue_assigned',
    'issue_status_changed',
    'issue_commented',
    'issue_deleted',
    'project_member_added',
  ]),
  recipientType: z.enum([
    'assignee',
    'reporter',
    'watchers',
    'specific_user',
    'user_role',
    'project_role',
    'group',
  ]),
  recipientId: z.string().max(100).optional(),
  isEnabled: z.boolean().optional(),
  conditions: z.record(z.unknown()).optional(),
});

const assignProjectSchema = z.object({
  notificationSchemeId: z.string().uuid(),
});

export class NotificationSchemesController {
  create = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createSchemeSchema.parse(req.body);
      const result = await notificationSchemesService.createScheme(req.user!.id, input as any);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationSchemesService.listSchemes(
      req.user!.id,
      req.query.projectId as string | undefined
    );
    res.json({ success: true, data: result });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationSchemesService.getScheme(req.user!.id, req.params.schemeId);
    res.json({ success: true, data: result });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateSchemeSchema.parse(req.body);
      const result = await notificationSchemesService.updateScheme(req.user!.id, req.params.schemeId, input);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationSchemesService.deleteScheme(req.user!.id, req.params.schemeId);
    res.json({ success: true, ...result });
  });

  createRule = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createRuleSchema.parse(req.body);
      const result = await notificationSchemesService.createRule(req.user!.id, req.params.schemeId, input as any);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  assignProject = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = assignProjectSchema.parse(req.body);
      const result = await notificationSchemesService.assignProject(req.user!.id, req.params.projectId, input.notificationSchemeId);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });
}

export const notificationSchemesController = new NotificationSchemesController();
