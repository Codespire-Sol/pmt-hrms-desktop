import { Request, Response } from 'express';
import { z } from 'zod';
import { ProjectsService } from './projects.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { CreateProjectInput } from './projects.types';

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  key: z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/),
  description: z.string().optional(),
  leadId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  visibility: z.enum(['private', 'internal', 'public']).optional(),
  startDate: z.string().optional(),
  targetEndDate: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  leadId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  category: z.string().max(100).optional(),
  status: z.enum(['active', 'archived', 'on_hold', 'completed']).optional(),
  visibility: z.enum(['private', 'internal', 'public']).optional(),
  startDate: z.string().optional(),
  targetEndDate: z.string().optional(),
  actualEndDate: z.string().optional(),
  overviewComments: z.array(
    z.object({
      id: z.string().uuid().optional(),
      content: z.string().min(1).max(10000),
    })
  ).max(200).optional(),
  overviewLinks: z.array(
    z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(1).max(200),
      url: z.string().url().max(2000),
      description: z.string().max(2000).optional().nullable(),
    })
  ).max(200).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'lead', 'member', 'viewer']),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'lead', 'member', 'viewer']),
});

export class ProjectsController {
  private projectsService: ProjectsService;

  constructor() {
    this.projectsService = new ProjectsService();
  }

  createProject = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createProjectSchema.parse(req.body) as unknown as CreateProjectInput;
      const project = await this.projectsService.createProject(input, req.user!.id);

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: project,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getProjects = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      status: req.query.status && req.query.status !== '' ? req.query.status as string : undefined,
      search: req.query.search && req.query.search !== '' ? req.query.search as string : undefined,
      memberId: req.query.memberId && req.query.memberId !== '' ? req.query.memberId as string : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await this.projectsService.getProjects(req.user!.id, filters);

    res.json({
      success: true,
      data: result,
    });
  });

  getProject = asyncHandler(async (req: Request, res: Response) => {
    const project = await this.projectsService.getProjectById(req.params.projectId, req.user!.id);

    res.json({
      success: true,
      data: project,
    });
  });

  updateProject = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateProjectSchema.parse(req.body);
      const project = await this.projectsService.updateProject(req.params.projectId, input as any, req.user!.id);

      res.json({
        success: true,
        message: 'Project updated successfully',
        data: project,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  archiveProject = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.projectsService.archiveProject(req.params.projectId, req.user!.id);

    res.json({
      success: true,
      ...result,
    });
  });

  deleteProject = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.projectsService.deleteProject(req.params.projectId, req.user!.id);

    res.json({
      success: true,
      ...result,
    });
  });

  hardDeleteProject = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.projectsService.hardDeleteProject(req.params.projectId);

    res.json({
      success: true,
      ...result,
    });
  });

  purgeAllProjects = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.projectsService.purgeAllProjects();

    res.json({
      success: true,
      ...result,
    });
  });

  // Admin: migrate/fix workflows for existing projects
  migrateWorkflows = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.projectsService.migrateExistingProjects();

    res.json({
      success: true,
      message: 'Workflow migration completed',
      data: result,
    });
  });

  // Project Members
  getProjectMembers = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.projectsService.getProjectMembers(req.params.projectId, req.user!.id);

    res.json({
      success: true,
      data: result,
    });
  });

  addProjectMember = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = addMemberSchema.parse(req.body);
      const member = await this.projectsService.addProjectMember(req.params.projectId, input as any, req.user!.id);

      res.status(201).json({
        success: true,
        message: 'Member added to project',
        data: member,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateMemberRoleSchema.parse(req.body);
      const member = await this.projectsService.updateMemberRole(req.params.projectId, req.params.memberId, input as any, req.user!.id);

      res.json({
        success: true,
        message: 'Member role updated',
        data: member,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  removeProjectMember = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.projectsService.removeProjectMember(req.params.projectId, req.params.memberId, req.user!.id);

    res.json({
      success: true,
      ...result,
    });
  });
}
