import { Request, Response } from 'express';
import { z } from 'zod';
import { VersionsService } from './versions.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

const createVersionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  startDate: z.string().optional(),
  releaseDate: z.string().optional(),
});

const updateVersionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  startDate: z.string().optional().nullable(),
  releaseDate: z.string().optional().nullable(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export class VersionsController {
  private versionsService: VersionsService;

  constructor() {
    this.versionsService = new VersionsService();
  }

  createVersion = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createVersionSchema.parse(req.body);
      const version = await this.versionsService.createVersion(
        req.params.projectId,
        input as any,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        message: 'Version created successfully',
        data: version,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getVersion = asyncHandler(async (req: Request, res: Response) => {
    const version = await this.versionsService.getVersion(
      req.params.versionId,
      req.user!.id
    );

    res.json({
      success: true,
      data: version,
    });
  });

  getProjectVersions = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      status: req.query.status as any,
      search: req.query.search as string,
    };

    const versions = await this.versionsService.getProjectVersions(
      req.params.projectId,
      filters,
      req.user!.id
    );

    res.json({
      success: true,
      data: versions,
    });
  });

  updateVersion = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateVersionSchema.parse(req.body);
      const version = await this.versionsService.updateVersion(
        req.params.versionId,
        input,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Version updated successfully',
        data: version,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  releaseVersion = asyncHandler(async (req: Request, res: Response) => {
    const version = await this.versionsService.releaseVersion(
      req.params.versionId,
      req.user!.id
    );

    res.json({
      success: true,
      message: 'Version released successfully',
      data: version,
    });
  });

  archiveVersion = asyncHandler(async (req: Request, res: Response) => {
    const version = await this.versionsService.archiveVersion(
      req.params.versionId,
      req.user!.id
    );

    res.json({
      success: true,
      message: 'Version archived successfully',
      data: version,
    });
  });

  unarchiveVersion = asyncHandler(async (req: Request, res: Response) => {
    const version = await this.versionsService.unarchiveVersion(
      req.params.versionId,
      req.user!.id
    );

    res.json({
      success: true,
      message: 'Version unarchived successfully',
      data: version,
    });
  });

  deleteVersion = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.versionsService.deleteVersion(
      req.params.versionId,
      req.user!.id
    );

    res.json({
      success: true,
      ...result,
    });
  });

  reorderVersions = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = reorderSchema.parse(req.body);
      const result = await this.versionsService.reorderVersions(
        req.params.projectId,
        input.orderedIds,
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

  getVersionIssues = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const type = (req.query.type as 'fix' | 'affected') || 'fix';

    const result = await this.versionsService.getVersionIssues(
      req.params.versionId,
      req.user!.id,
      type,
      page,
      limit
    );

    res.json({
      success: true,
      data: result,
    });
  });
}
