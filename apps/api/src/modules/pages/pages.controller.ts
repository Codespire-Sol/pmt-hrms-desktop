import { Request, Response } from 'express';
import { z } from 'zod';
import { PagesService } from './pages.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

const createPageSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  contentHtml: z.string().max(500000).optional(),
  parentId: z.string().uuid().optional(),
  isPublished: z.boolean().optional(),
});

const updatePageSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().optional(),
  contentHtml: z.string().max(500000).nullable().optional(),
  isPublished: z.boolean().optional(),
});

const reorderPageSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0),
});

export class PagesController {
  private pagesService: PagesService;

  constructor() {
    this.pagesService = new PagesService();
  }

  createPage = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createPageSchema.parse(req.body);
      const page = await this.pagesService.createPage(
        req.params.projectId,
        input as any,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        message: 'Page created successfully',
        data: page,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getPage = asyncHandler(async (req: Request, res: Response) => {
    const page = await this.pagesService.getPage(
      req.params.pageId,
      req.user!.id
    );

    res.json({
      success: true,
      data: page,
    });
  });

  getProjectPages = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      search: req.query.search as string,
      isPublished: req.query.isPublished === 'true' ? true : req.query.isPublished === 'false' ? false : undefined,
    };

    const pages = await this.pagesService.getProjectPages(
      req.params.projectId,
      filters,
      req.user!.id
    );

    res.json({
      success: true,
      data: pages,
    });
  });

  updatePage = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updatePageSchema.parse(req.body);
      const page = await this.pagesService.updatePage(
        req.params.pageId,
        input,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Page updated successfully',
        data: page,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deletePage = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.pagesService.deletePage(
      req.params.pageId,
      req.user!.id
    );

    res.json({
      success: true,
      ...result,
    });
  });

  reorderPage = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = reorderPageSchema.parse(req.body);
      const page = await this.pagesService.reorderPage(
        req.params.pageId,
        input as any,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Page reordered successfully',
        data: page,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });
}
