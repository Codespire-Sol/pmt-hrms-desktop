import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { permissionSchemesService } from './permission-schemes.service';

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
  permissionName: z.string().min(1).max(100),
  principalType: z.enum(['user', 'user_role', 'project_role', 'group']),
  principalId: z.string().min(1).max(100),
  effect: z.enum(['allow', 'deny']).optional(),
  conditions: z.record(z.unknown()).optional(),
});

const assignProjectSchema = z.object({
  permissionSchemeId: z.string().uuid(),
});

const evaluateSchema = z.object({
  userId: z.string().uuid(),
  permission: z.string().min(1).max(100),
});

export class PermissionSchemesController {
  create = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createSchemeSchema.parse(req.body);
      const result = await permissionSchemesService.createScheme(req.user!.id, input as any);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await permissionSchemesService.listSchemes(req.user!.id, req.query.projectId as string | undefined);
    res.json({ success: true, data: result });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const result = await permissionSchemesService.getScheme(req.user!.id, req.params.schemeId);
    res.json({ success: true, data: result });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateSchemeSchema.parse(req.body);
      const result = await permissionSchemesService.updateScheme(req.user!.id, req.params.schemeId, input);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const result = await permissionSchemesService.deleteScheme(req.user!.id, req.params.schemeId);
    res.json({ success: true, ...result });
  });

  createRule = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createRuleSchema.parse(req.body);
      const result = await permissionSchemesService.upsertRule(req.user!.id, req.params.schemeId, input as any);
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
      const result = await permissionSchemesService.assignProject(req.user!.id, req.params.projectId, input.permissionSchemeId);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  evaluate = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = evaluateSchema.parse(req.body);
      const result = await permissionSchemesService.evaluatePolicy(req.params.projectId, input.permission, input.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });
}

export const permissionSchemesController = new PermissionSchemesController();
