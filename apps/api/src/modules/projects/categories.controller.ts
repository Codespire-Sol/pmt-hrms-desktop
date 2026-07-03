import { Request, Response } from 'express';
import { categoriesService } from './categories.service';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { CreateCategoryInput } from './categories.repository';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  position: z.number().min(0).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  position: z.number().min(0).optional(),
});

const reorderSchema = z.object({
  categoryIds: z.array(z.string().uuid()),
});

export class CategoriesController {
  getCategories = asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const withProjectCount = req.query.withProjectCount === 'true';

    if (withProjectCount) {
      const categories = await categoriesService.getAllWithProjectCount();
      return ApiResponse.success(res, categories, 'Categories retrieved successfully');
    }

    const categories = await categoriesService.getAll(includeInactive);
    return ApiResponse.success(res, categories, 'Categories retrieved successfully');
  });

  getCategory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const category = await categoriesService.getById(id);
    return ApiResponse.success(res, category, 'Category retrieved successfully');
  });

  getCategoryBySlug = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    const category = await categoriesService.getBySlug(slug);
    return ApiResponse.success(res, category, 'Category retrieved successfully');
  });

  createCategory = asyncHandler(async (req: Request, res: Response) => {
    const input = createCategorySchema.parse(req.body) as CreateCategoryInput;
    const category = await categoriesService.create(input);
    return ApiResponse.created(res, category, 'Category created successfully');
  });

  updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const input = updateCategorySchema.parse(req.body);
    const category = await categoriesService.update(id, input);
    return ApiResponse.success(res, category, 'Category updated successfully');
  });

  deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await categoriesService.delete(id);
    return ApiResponse.success(res, null, 'Category deleted successfully');
  });

  reorderCategories = asyncHandler(async (req: Request, res: Response) => {
    const input = reorderSchema.parse(req.body);
    await categoriesService.reorder(input.categoryIds);
    return ApiResponse.success(res, null, 'Categories reordered successfully');
  });

  toggleCategoryActive = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const category = await categoriesService.toggleActive(id, isActive === true);
    return ApiResponse.success(res, category, `Category ${isActive ? 'activated' : 'deactivated'} successfully`);
  });
}

export const categoriesController = new CategoriesController();
