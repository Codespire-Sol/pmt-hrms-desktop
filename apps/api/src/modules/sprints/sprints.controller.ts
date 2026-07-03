import { Request, Response } from 'express';
import { z } from 'zod';
import { SprintsService, sprintsService } from './sprints.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import {
  projectSprintParamSchema,
  sprintIdParamSchema,
  sprintIssueParamSchema,
} from './sprints.validator';

export class SprintsController {
  constructor(private service: SprintsService = sprintsService) {}

  private parseParams<T extends z.ZodTypeAny>(schema: T, params: unknown): z.infer<T> {
    const result = schema.safeParse(params);
    if (!result.success) {
      throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', result.error.errors);
    }
    return result.data;
  }

  createSprint = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = this.parseParams(projectSprintParamSchema, req.params);
    const userId = req.user!.id;
    const sprint = await this.service.createSprint(projectId, req.body, userId);

    res.status(201).json({
      success: true,
      data: sprint,
    });
  });

  getSprints = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = this.parseParams(projectSprintParamSchema, req.params);
    const filters = {
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await this.service.getSprints(projectId, filters);

    res.json({
      success: true,
      data: result,
    });
  });

  getSprint = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const sprint = await this.service.getSprintById(sprintId);

    res.json({
      success: true,
      data: sprint,
    });
  });

  updateSprint = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const userId = req.user!.id;
    const sprint = await this.service.updateSprint(sprintId, req.body, userId);

    res.json({
      success: true,
      data: sprint,
    });
  });

  deleteSprint = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const userId = req.user!.id;
    const result = await this.service.deleteSprint(sprintId, userId);

    res.json({
      success: true,
      ...result,
    });
  });

  startSprint = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const userId = req.user!.id;
    const sprint = await this.service.startSprint(sprintId, userId);

    res.json({
      success: true,
      data: sprint,
    });
  });

  completeSprint = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const userId = req.user!.id;
    const result = await this.service.completeSprint(sprintId, req.body, userId);

    res.json({
      success: true,
      data: result,
    });
  });

  addIssuesToSprint = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const userId = req.user!.id;
    const { issueIds } = req.body;
    const result = await this.service.addIssuesToSprint(sprintId, issueIds, userId);

    res.json({
      success: true,
      data: {
        addedCount: issueIds.length,
        sprint: result,
      },
    });
  });

  removeIssueFromSprint = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId, issueId } = this.parseParams(sprintIssueParamSchema, req.params);
    const userId = req.user!.id;
    const result = await this.service.removeIssueFromSprint(sprintId, issueId, userId);

    res.json({
      success: true,
      ...result,
    });
  });

  getBacklog = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = this.parseParams(projectSprintParamSchema, req.params);
    const filters = {
      search: req.query.search as string | undefined,
      statusId: req.query.statusId as string | undefined,
      priorityId: req.query.priorityId as string | undefined,
      typeId: req.query.typeId as string | undefined,
      assigneeId: req.query.assigneeId as string | undefined,
      epicId: req.query.epicId as string | undefined,
      minStoryPoints: req.query.minStoryPoints as string | undefined,
      maxStoryPoints: req.query.maxStoryPoints as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as string | undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    const result = await this.service.getBacklog(projectId, filters);

    res.json({
      success: true,
      data: result,
    });
  });

  searchBacklog = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = this.parseParams(projectSprintParamSchema, req.params);
    const filters = {
      search: req.query.search as string | undefined,
      statusId: req.query.statusId as string | undefined,
      priorityId: req.query.priorityId as string | undefined,
      typeId: req.query.typeId as string | undefined,
      assigneeId: req.query.assigneeId as string | undefined,
      minStoryPoints: req.query.minStoryPoints as string | undefined,
      maxStoryPoints: req.query.maxStoryPoints as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as string | undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    const result = await this.service.searchBacklog(projectId, filters);

    res.json({
      success: true,
      data: result,
    });
  });

  getVelocity = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = this.parseParams(projectSprintParamSchema, req.params);
    const sprints = parseInt(req.query.sprints as string) || 5;
    const result = await this.service.getVelocityData(projectId, sprints);

    res.json({
      success: true,
      data: result,
    });
  });

  getBurndown = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const result = await this.service.getBurndownData(sprintId);

    res.json({
      success: true,
      data: result,
    });
  });

  getSprintEstimateTotals = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const result = await this.service.getSprintEstimateTotals(sprintId);

    res.json({
      success: true,
      data: result,
    });
  });

  getBurnup = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const result = await this.service.getBurnupData(sprintId);

    res.json({
      success: true,
      data: result,
    });
  });

  checkOverCommitment = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const result = await this.service.checkOverCommitment(sprintId);

    res.json({
      success: true,
      data: result,
    });
  });

  updateRetrospective = asyncHandler(async (req: Request, res: Response) => {
    const { sprintId } = this.parseParams(sprintIdParamSchema, req.params);
    const { retrospectiveNotes } = req.body;
    const sprint = await this.service.updateRetrospective(sprintId, retrospectiveNotes);

    res.json({
      success: true,
      data: sprint,
    });
  });
}

export const sprintsController = new SprintsController();
