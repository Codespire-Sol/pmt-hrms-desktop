import { Request, Response } from 'express';
import { z } from 'zod';
import { WipLimitsService } from './wip-limits.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

const updateBoardSettingsSchema = z.object({
  wipLimitsEnabled: z.boolean().optional(),
  defaultWipType: z.enum(['soft', 'hard']).optional(),
  showWipWarnings: z.boolean().optional(),
  trackWipViolations: z.boolean().optional(),
  swimlaneWipLimits: z.record(z.number()).optional(),
});

const updateColumnWipLimitSchema = z.object({
  wipLimit: z.number().int().min(1).nullable().optional(),
  wipLimitEnabled: z.boolean().optional(),
  wipLimitType: z.enum(['soft', 'hard']).optional(),
});

export class WipLimitsController {
  private service: WipLimitsService;

  constructor() {
    this.service = new WipLimitsService();
  }

  // === Board Settings ===

  getBoardSettings = asyncHandler(async (req: Request, res: Response) => {
    const settings = await this.service.getBoardSettings(req.params.boardId);

    res.json({
      success: true,
      data: settings,
    });
  });

  updateBoardSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateBoardSettingsSchema.parse(req.body);
      const settings = await this.service.updateBoardSettings(req.params.boardId, input);

      res.json({
        success: true,
        message: 'Board WIP settings updated',
        data: settings,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  // === Column WIP Limits ===

  getColumnWipLimits = asyncHandler(async (req: Request, res: Response) => {
    const limits = await this.service.getColumnWipLimits(req.params.boardId);

    res.json({
      success: true,
      data: limits,
    });
  });

  updateColumnWipLimit = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateColumnWipLimitSchema.parse(req.body);
      const limit = await this.service.updateColumnWipLimit(req.params.columnId, input);

      res.json({
        success: true,
        message: 'Column WIP limit updated',
        data: limit,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  // === WIP Status ===

  getBoardWipStatus = asyncHandler(async (req: Request, res: Response) => {
    const status = await this.service.getBoardWipStatus(req.params.boardId);

    res.json({
      success: true,
      data: status,
    });
  });

  checkCanMoveIssue = asyncHandler(async (req: Request, res: Response) => {
    const { toColumnId, fromColumnId } = req.query;

    if (!toColumnId) {
      throw ApiError.badRequest('toColumnId is required');
    }

    const result = await this.service.checkCanMoveIssue(
      req.params.boardId,
      toColumnId as string,
      fromColumnId as string | undefined
    );

    res.json({
      success: true,
      data: result,
    });
  });

  // === Violations ===

  getViolations = asyncHandler(async (req: Request, res: Response) => {
    const { columnId, startDate, endDate, page, limit } = req.query;

    const options: any = {
      columnId: columnId as string,
      page: parseInt(page as string) || 1,
      limit: Math.min(parseInt(limit as string) || 50, 100),
    };

    if (startDate) {
      options.startDate = new Date(startDate as string);
    }
    if (endDate) {
      options.endDate = new Date(endDate as string);
    }

    const pageNum = options.page;
    const limitNum = options.limit;
    options.offset = (pageNum - 1) * limitNum;
    delete options.page;

    const { violations, total } = await this.service.getViolations(req.params.boardId, options);

    res.json({
      success: true,
      data: {
        violations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  });
}
