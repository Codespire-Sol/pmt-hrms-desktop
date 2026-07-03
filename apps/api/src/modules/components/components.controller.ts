import { Request, Response } from 'express';
import { z } from 'zod';
import { ComponentsService } from './components.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { CreateComponentInput, UpdateComponentInput } from './components.types';

const createComponentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  leadId: z.string().uuid().optional(),
  defaultAssigneeId: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const updateComponentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  defaultAssigneeId: z.string().uuid().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isActive: z.boolean().optional(),
});

export class ComponentsController {
  private componentsService: ComponentsService;

  constructor() {
    this.componentsService = new ComponentsService();
  }

  createComponent = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createComponentSchema.parse(req.body) as CreateComponentInput;
      const component = await this.componentsService.createComponent(
        req.params.projectId,
        input,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        message: 'Component created successfully',
        data: component,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getComponent = asyncHandler(async (req: Request, res: Response) => {
    const component = await this.componentsService.getComponent(
      req.params.componentId,
      req.user!.id
    );

    res.json({
      success: true,
      data: component,
    });
  });

  getProjectComponents = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      leadId: req.query.leadId as string,
      search: req.query.search as string,
    };

    const components = await this.componentsService.getProjectComponents(
      req.params.projectId,
      filters,
      req.user!.id
    );

    res.json({
      success: true,
      data: components,
    });
  });

  updateComponent = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateComponentSchema.parse(req.body) as UpdateComponentInput;
      const component = await this.componentsService.updateComponent(
        req.params.componentId,
        input,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Component updated successfully',
        data: component,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteComponent = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.componentsService.deleteComponent(
      req.params.componentId,
      req.user!.id
    );

    res.json({
      success: true,
      ...result,
    });
  });

  getComponentIssues = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await this.componentsService.getComponentIssues(
      req.params.componentId,
      req.user!.id,
      page,
      limit
    );

    res.json({
      success: true,
      data: result,
    });
  });

  addIssueToComponent = asyncHandler(async (req: Request, res: Response) => {
    const { issueId } = req.body;
    if (!issueId) {
      throw ApiError.badRequest('issueId is required');
    }

    const result = await this.componentsService.addIssueToComponent(
      issueId,
      req.params.componentId,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      ...result,
    });
  });

  removeIssueFromComponent = asyncHandler(async (req: Request, res: Response) => {
    const { issueId } = req.body;
    if (!issueId) {
      throw ApiError.badRequest('issueId is required');
    }

    const result = await this.componentsService.removeIssueFromComponent(
      issueId,
      req.params.componentId,
      req.user!.id
    );

    res.json({
      success: true,
      ...result,
    });
  });
}
