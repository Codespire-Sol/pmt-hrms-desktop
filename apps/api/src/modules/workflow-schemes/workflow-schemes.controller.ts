import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { workflowSchemesService } from './workflow-schemes.service';

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

const upsertMappingSchema = z.object({
  issueTypeId: z.string().uuid().nullable().optional(),
  workflowId: z.string().uuid(),
});

const assignProjectSchema = z.object({
  workflowSchemeId: z.string().uuid(),
});

export class WorkflowSchemesController {
  create = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createSchemeSchema.parse(req.body);
      const result = await workflowSchemesService.createScheme(req.user!.id, input as any);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await workflowSchemesService.listSchemes(req.user!.id, req.query.projectId as string | undefined);
    res.json({ success: true, data: result });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const result = await workflowSchemesService.getScheme(req.user!.id, req.params.schemeId);
    res.json({ success: true, data: result });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateSchemeSchema.parse(req.body);
      const result = await workflowSchemesService.updateScheme(req.user!.id, req.params.schemeId, input);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const result = await workflowSchemesService.deleteScheme(req.user!.id, req.params.schemeId);
    res.json({ success: true, ...result });
  });

  upsertMapping = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = upsertMappingSchema.parse(req.body);
      const result = await workflowSchemesService.upsertMapping(req.user!.id, req.params.schemeId, input as any);
      res.json({ success: true, data: result });
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
      const result = await workflowSchemesService.assignProject(req.user!.id, req.params.projectId, input.workflowSchemeId);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getEffectiveWorkflow = asyncHandler(async (req: Request, res: Response) => {
    const result = await workflowSchemesService.getEffectiveWorkflow(
      req.params.projectId,
      req.query.issueTypeId as string | undefined
    );
    res.json({ success: true, data: result });
  });
}

export const workflowSchemesController = new WorkflowSchemesController();
