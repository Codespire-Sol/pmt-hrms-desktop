import { Request, Response } from 'express';
import { z } from 'zod';
import { SecurityLevelsService } from './security-levels.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

const createSecurityLevelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  level: z.number().int().min(0).max(100).optional(),
  isDefault: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

const updateSecurityLevelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  level: z.number().int().min(0).max(100).optional(),
  isDefault: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

export class SecurityLevelsController {
  private securityLevelsService: SecurityLevelsService;

  constructor() {
    this.securityLevelsService = new SecurityLevelsService();
  }

  getProjectSecurityLevels = asyncHandler(async (req: Request, res: Response) => {
    const levels = await this.securityLevelsService.getProjectSecurityLevels(
      req.params.projectId,
      req.user!.id
    );

    res.json({
      success: true,
      data: levels,
    });
  });

  getSecurityLevel = asyncHandler(async (req: Request, res: Response) => {
    const level = await this.securityLevelsService.getSecurityLevel(
      req.params.levelId,
      req.user!.id
    );

    res.json({
      success: true,
      data: level,
    });
  });

  createSecurityLevel = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createSecurityLevelSchema.parse(req.body);

      const level = await this.securityLevelsService.createSecurityLevel(
        req.params.projectId,
        input as any,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        message: 'Security level created successfully',
        data: level,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  updateSecurityLevel = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateSecurityLevelSchema.parse(req.body);

      const level = await this.securityLevelsService.updateSecurityLevel(
        req.params.levelId,
        input,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Security level updated successfully',
        data: level,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteSecurityLevel = asyncHandler(async (req: Request, res: Response) => {
    await this.securityLevelsService.deleteSecurityLevel(
      req.params.levelId,
      req.user!.id
    );

    res.status(204).send();
  });

  reorderSecurityLevels = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { orderedIds } = reorderSchema.parse(req.body);

      await this.securityLevelsService.reorderSecurityLevels(
        req.params.projectId,
        orderedIds,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Security levels reordered successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });
}

export const securityLevelsController = new SecurityLevelsController();
