import { Request, Response } from 'express';
import { z } from 'zod';
import { SavedFiltersService } from './saved-filters.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

const createFilterSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  jql: z.string().min(1).max(5000),
  visibility: z.enum(['private', 'project', 'global']).optional(),
  isFavorite: z.boolean().optional(),
});

const updateFilterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  jql: z.string().min(1).max(5000).optional(),
  visibility: z.enum(['private', 'project', 'global']).optional(),
  isFavorite: z.boolean().optional(),
});

const executeJQLSchema = z.object({
  jql: z.string().min(1).max(5000),
});

export class SavedFiltersController {
  private service: SavedFiltersService;

  constructor() {
    this.service = new SavedFiltersService();
  }

  // Saved Filter CRUD
  createFilter = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createFilterSchema.parse(req.body);
      const filter = await this.service.createFilter(req.user!.id, input as any);

      res.status(201).json({
        success: true,
        message: 'Filter created successfully',
        data: filter,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getFilter = asyncHandler(async (req: Request, res: Response) => {
    const filter = await this.service.getFilter(req.params.filterId, req.user!.id);

    res.json({
      success: true,
      data: filter,
    });
  });

  getFilters = asyncHandler(async (req: Request, res: Response) => {
    const options = {
      projectId: req.query.projectId as string,
      search: req.query.search as string,
      visibility: req.query.visibility as any,
      ownedOnly: req.query.ownedOnly === 'true',
      subscribedOnly: req.query.subscribedOnly === 'true',
      favoritesOnly: req.query.favoritesOnly === 'true',
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    const result = await this.service.getFilters(req.user!.id, options);

    res.json({
      success: true,
      data: result,
    });
  });

  updateFilter = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateFilterSchema.parse(req.body);
      const filter = await this.service.updateFilter(req.params.filterId, req.user!.id, input);

      res.json({
        success: true,
        message: 'Filter updated successfully',
        data: filter,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteFilter = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteFilter(req.params.filterId, req.user!.id);

    res.json({
      success: true,
      ...result,
    });
  });

  // Execute filters and JQL
  executeFilter = asyncHandler(async (req: Request, res: Response) => {
    const options = {
      projectId: req.query.projectId as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    const result = await this.service.executeFilter(req.params.filterId, req.user!.id, options);

    res.json({
      success: true,
      data: result,
    });
  });

  executeJQL = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = executeJQLSchema.parse(req.body);
      const options = {
        projectId: req.query.projectId as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };

      const result = await this.service.executeJQL(input.jql, req.user!.id, options);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  validateJQL = asyncHandler(async (req: Request, res: Response) => {
    const jql = req.query.jql as string || req.body.jql as string;

    if (!jql) {
      throw ApiError.badRequest('JQL query is required');
    }

    const result = await this.service.validateJQL(jql);

    res.json({
      success: true,
      data: result,
    });
  });

  // Subscriptions
  subscribeToFilter = asyncHandler(async (req: Request, res: Response) => {
    const subscription = await this.service.subscribeToFilter(req.params.filterId, req.user!.id);

    res.status(201).json({
      success: true,
      message: 'Subscribed to filter successfully',
      data: subscription,
    });
  });

  unsubscribeFromFilter = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.unsubscribeFromFilter(req.params.filterId, req.user!.id);

    res.json({
      success: true,
      ...result,
    });
  });

  toggleSubscriptionFavorite = asyncHandler(async (req: Request, res: Response) => {
    const isFavorite = req.body.isFavorite === true;
    const subscription = await this.service.toggleSubscriptionFavorite(req.params.filterId, req.user!.id, isFavorite);

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: subscription,
    });
  });

  getFilterSubscribers = asyncHandler(async (req: Request, res: Response) => {
    const subscribers = await this.service.getFilterSubscribers(req.params.filterId, req.user!.id);

    res.json({
      success: true,
      data: subscribers,
    });
  });
}
