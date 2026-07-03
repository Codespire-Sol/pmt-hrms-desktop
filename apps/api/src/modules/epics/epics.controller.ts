import { Request, Response } from 'express';
import { z } from 'zod';
import { EpicsService } from './epics.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

const createEpicSchema = z.object({
  name: z.string().min(1).max(200),
  summary: z.string().max(500).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  status: z.enum(['to_do', 'in_progress', 'done']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const updateEpicSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  summary: z.string().max(500).optional().nullable(),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  status: z.enum(['to_do', 'in_progress', 'done']).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  position: z.number().int().min(0).optional(),
});

const assignIssuesSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1),
});

export class EpicsController {
  private epicsService: EpicsService;

  constructor() {
    this.epicsService = new EpicsService();
  }

  createEpic = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createEpicSchema.parse(req.body);
      const epic = await this.epicsService.createEpic(
        req.params.projectId,
        input as any,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        message: 'Epic created successfully',
        data: epic,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getEpic = asyncHandler(async (req: Request, res: Response) => {
    const epic = await this.epicsService.getEpic(
      req.params.epicId,
      req.user!.id
    );

    res.json({
      success: true,
      data: epic,
    });
  });

  getProjectEpics = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      status: req.query.status as any,
      search: req.query.search as string,
    };

    const epics = await this.epicsService.getProjectEpics(
      req.params.projectId,
      filters,
      req.user!.id
    );

    res.json({
      success: true,
      data: epics,
    });
  });

  updateEpic = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateEpicSchema.parse(req.body);
      const epic = await this.epicsService.updateEpic(
        req.params.epicId,
        input,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Epic updated successfully',
        data: epic,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteEpic = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.epicsService.deleteEpic(
      req.params.epicId,
      req.user!.id
    );

    res.json({
      success: true,
      ...result,
    });
  });

  getEpicIssues = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await this.epicsService.getEpicIssues(
      req.params.epicId,
      req.user!.id,
      page,
      limit
    );

    res.json({
      success: true,
      data: result,
    });
  });

  assignIssues = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = assignIssuesSchema.parse(req.body);
      const result = await this.epicsService.assignIssues(
        req.params.epicId,
        input.issueIds,
        req.user!.id
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  removeIssues = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = assignIssuesSchema.parse(req.body);
      const result = await this.epicsService.removeIssues(
        req.params.epicId,
        input.issueIds,
        req.user!.id
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });
}
