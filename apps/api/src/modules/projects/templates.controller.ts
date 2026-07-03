import { Request, Response } from 'express';
import { TemplatesService } from './templates.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';

export class TemplatesController {
  private templatesService: TemplatesService;

  constructor() {
    this.templatesService = new TemplatesService();
  }

  // GET /api/v1/projects/templates
  getTemplates = async (req: Request, res: Response) => {
    try {
      const { category } = req.query;
      const templates = await this.templatesService.getTemplates(category as string);

      return ApiResponse.success(res, { templates }, 'Templates retrieved successfully');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to retrieve templates');
    }
  };

  // GET /api/v1/projects/templates/system
  getSystemTemplates = async (req: Request, res: Response) => {
    try {
      const templates = await this.templatesService.getSystemTemplates();

      return ApiResponse.success(res, { templates }, 'System templates retrieved successfully');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to retrieve system templates');
    }
  };

  // GET /api/v1/projects/templates/my
  getUserTemplates = async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const templates = await this.templatesService.getUserTemplates(userId);

      return ApiResponse.success(res, { templates }, 'User templates retrieved successfully');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to retrieve user templates');
    }
  };

  // GET /api/v1/projects/templates/categories
  getCategories = async (req: Request, res: Response) => {
    try {
      const categories = await this.templatesService.getCategories();

      return ApiResponse.success(res, { categories }, 'Categories retrieved successfully');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to retrieve categories');
    }
  };

  // GET /api/v1/projects/templates/:templateId
  getTemplate = async (req: Request, res: Response) => {
    try {
      const { templateId } = req.params;
      const template = await this.templatesService.getTemplateById(templateId);

      return ApiResponse.success(res, { template }, 'Template retrieved successfully');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to retrieve template');
    }
  };

  // POST /api/v1/projects/templates
  createTemplate = async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const template = await this.templatesService.createTemplate(req.body, userId);

      return ApiResponse.created(res, { template }, 'Template created successfully');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to create template');
    }
  };

  // PATCH /api/v1/projects/templates/:templateId
  updateTemplate = async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { templateId } = req.params;
      const template = await this.templatesService.updateTemplate(templateId, req.body, userId);

      return ApiResponse.success(res, { template }, 'Template updated successfully');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to update template');
    }
  };

  // DELETE /api/v1/projects/templates/:templateId
  deleteTemplate = async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { templateId } = req.params;
      await this.templatesService.deleteTemplate(templateId, userId);

      return ApiResponse.success(res, null, 'Template deleted successfully');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to delete template');
    }
  };

  // POST /api/v1/projects/from-template
  createProjectFromTemplate = async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const project = await this.templatesService.createProjectFromTemplate(req.body, userId);

      return ApiResponse.created(res, { project }, 'Project created from template successfully');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to create project from template');
    }
  };
}
