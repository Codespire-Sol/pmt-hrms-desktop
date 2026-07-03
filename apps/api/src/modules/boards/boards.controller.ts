import { Request, Response } from 'express';
import { z } from 'zod';
import { BoardsService } from './boards.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { BoardQueryParams, BoardViewType, SwimlaneGroupBy } from './boards.types';

const updateWipLimitSchema = z.object({
  wipLimit: z.number().min(0).nullable().optional(),
  category: z.string().min(1).max(50).optional(),
  displayName: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const createColumnSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  category: z.string().min(1).max(50).optional().default('todo'),
  wipLimit: z.number().int().min(0).nullable().optional(),
});

const reorderColumnsSchema = z.object({
  statusIds: z.array(z.string().uuid()).min(1),
});

const boardQuerySchema = z.object({
  view: z.enum(['kanban', 'list', 'timeline']).optional(),
  swimlane: z.enum(['none', 'assignee', 'epic', 'priority', 'type', 'sprint']).optional(),
  statusCategory: z.string().min(1).max(50).optional(),
  assigneeIds: z.string().optional(),
  typeIds: z.string().optional(),
  priorityIds: z.string().optional(),
  labelIds: z.string().optional(),
  sprintId: z.string().uuid().optional(),
  epicId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export class BoardsController {
  private boardsService: BoardsService;

  constructor() {
    this.boardsService = new BoardsService();
  }

  // GET /api/v1/boards/:projectId
  getBoardData = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;

    // Parse query parameters
    const queryParams = boardQuerySchema.parse(req.query);

    const params: BoardQueryParams = {
      view: queryParams.view as BoardViewType,
      swimlane: queryParams.swimlane as SwimlaneGroupBy,
      assigneeIds: queryParams.assigneeIds?.split(','),
      typeIds: queryParams.typeIds?.split(','),
      priorityIds: queryParams.priorityIds?.split(','),
      labelIds: queryParams.labelIds?.split(','),
      sprintId: queryParams.sprintId,
      epicId: queryParams.epicId,
      search: queryParams.search,
      statusCategory: queryParams.statusCategory as any,
    };

    const boardData = await this.boardsService.getBoardData(projectId, req.user!.id, params);

    res.json({
      success: true,
      data: boardData,
    });
  });

  // GET /api/v1/boards/:projectId/list
  getListView = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const queryParams = boardQuerySchema.parse(req.query);

    const params: BoardQueryParams = {
      assigneeIds: queryParams.assigneeIds?.split(','),
      typeIds: queryParams.typeIds?.split(','),
      priorityIds: queryParams.priorityIds?.split(','),
      sprintId: queryParams.sprintId,
      search: queryParams.search,
      statusCategory: queryParams.statusCategory as any,
    };

    const data = await this.boardsService.getListView(projectId, req.user!.id, params);

    res.json({
      success: true,
      data,
    });
  });

  // GET /api/v1/boards/:projectId/timeline
  getTimelineView = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const queryParams = boardQuerySchema.parse(req.query);

    const params: BoardQueryParams = {
      assigneeIds: queryParams.assigneeIds?.split(','),
      sprintId: queryParams.sprintId,
      statusCategory: queryParams.statusCategory as any,
    };

    const data = await this.boardsService.getTimelineView(projectId, req.user!.id, params);

    res.json({
      success: true,
      data,
    });
  });

  updateStatusWipLimit = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { projectId, statusId } = req.params;
      const input = updateWipLimitSchema.parse(req.body);

      const status = await this.boardsService.updateColumn(
        projectId,
        statusId,
        input,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Column updated',
        data: status,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  checkWipLimit = asyncHandler(async (req: Request, res: Response) => {
    const { projectId, statusId } = req.params;

    const wipInfo = await this.boardsService.checkWipLimit(projectId, statusId);

    res.json({
      success: true,
      data: wipInfo,
    });
  });

  createColumn = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const input = createColumnSchema.parse(req.body) as {
        name?: string;
        displayName: string;
        description?: string;
        color?: string;
        category?: string;
        wipLimit?: number | null;
      };

      const status = await this.boardsService.createColumn(projectId, input, req.user!.id);

      res.status(201).json({
        success: true,
        message: 'Board column created',
        data: status,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  reorderColumns = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { statusIds } = reorderColumnsSchema.parse(req.body);

      const statuses = await this.boardsService.reorderColumns(projectId, statusIds, req.user!.id);

      res.json({
        success: true,
        message: 'Board columns reordered',
        data: statuses,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteColumn = asyncHandler(async (req: Request, res: Response) => {
    const { projectId, statusId } = req.params;

    const result = await this.boardsService.deleteColumn(projectId, statusId, req.user!.id);

    res.json({
      success: true,
      message: result.message,
    });
  });
}
