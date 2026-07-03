import { Request, Response } from 'express';
import { z } from 'zod';
import { IssuesService } from './issues.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { CreateIssueInput, CreateSubtaskInput, UpdateIssueInput, AddIssueLinkInput } from './issues.types';

const createIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  typeId: z.string().uuid(),
  statusId: z.string().uuid().optional(),
  priorityId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  storyPoints: z.number().min(0).max(100).optional(),
  originalEstimateHours: z.number().min(0).optional(),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  labels: z.array(z.string().uuid()).optional(),
  environment: z.string().optional(),
  affectedVersionId: z.string().uuid().optional(),
  fixVersionId: z.string().uuid().optional(),
  epicId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
});

const createSubtaskSchema = createIssueSchema
  .omit({
    typeId: true,
    parentId: true,
  })
  .strict();

const updateIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  descriptionHtml: z.string().nullable().optional(),
  typeId: z.string().uuid().optional(),
  statusId: z.string().uuid().optional(),
  priorityId: z.string().uuid().optional(),
  reporterId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  storyPoints: z.number().min(0).max(100).nullable().optional(),
  remainingEstimateHours: z.number().min(0).max(10000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  environment: z.string().nullable().optional(),
  affectedVersionId: z.string().uuid().nullable().optional(),
  fixVersionId: z.string().uuid().nullable().optional(),
  epicId: z.string().uuid().nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  labels: z.array(z.string().uuid()).optional(),
  position: z.number().min(0).optional(),
});

const addLinkSchema = z.object({
  targetIssueId: z.string().uuid(),
  linkType: z.string().min(1).max(100),
});

const createLinkTypeSchema = z.object({
  name: z.string().trim().min(1).max(50),
  outward: z.string().trim().min(1).max(100),
  inward: z.string().trim().min(1).max(100),
  description: z.string().trim().max(255).optional().nullable(),
});

const updateLinkTypeSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  outward: z.string().trim().min(1).max(100).optional(),
  inward: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(255).optional().nullable(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: 'At least one field is required',
});

const bulkUpdateSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1, 'At least one issue is required').max(100, 'Max 100 issues'),
  update: z.object({
    statusId: z.string().uuid().optional(),
    priorityId: z.string().uuid().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    sprintId: z.string().uuid().nullable().optional(),
    labels: z.array(z.string().uuid()).optional(),
  }),
});

const bulkDeleteSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1, 'At least one issue is required').max(100, 'Max 100 issues'),
});

const bulkMoveSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1).max(100),
  targetProjectId: z.string().uuid(),
});

const bulkTransitionSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1).max(100),
  toStatusId: z.string().uuid(),
  resolution: z.string().max(100).nullable().optional(),
});

const cloneIssueSchema = z.object({
  includeChildren: z.boolean().optional(),
  includeLinks: z.boolean().optional(),
  includeAttachments: z.boolean().optional(),
}).optional();

export class IssuesController {
  private issuesService: IssuesService;

  constructor() {
    this.issuesService = new IssuesService();
  }

  createIssue = asyncHandler(async (req: Request, res: Response) => {
    try {
      if (!req.params.projectId) {
        console.error('Missing projectId param in createIssue', {
          params: req.params,
          path: req.path,
          originalUrl: req.originalUrl,
        });
      }
      const input = createIssueSchema.parse(req.body) as CreateIssueInput;
      const issue = await this.issuesService.createIssue(req.params.projectId, input, req.user!.id);

      res.status(201).json({
        success: true,
        message: 'Issue created successfully',
        data: issue,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  createSubtask = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createSubtaskSchema.parse(req.body) as CreateSubtaskInput;
      const issue = await this.issuesService.createSubtask(req.params.issueId, input, req.user!.id);

      res.status(201).json({
        success: true,
        message: 'Subtask created successfully',
        data: issue,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getIssues = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      statusId: req.query.statusId as string,
      assigneeId: req.query.assigneeId as string,
      priorityId: req.query.priorityId as string,
      typeId: req.query.typeId as string,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      sortBy: (req.query.sortBy as string) || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    };

    const result = await this.issuesService.getIssues(req.params.projectId, filters, req.user!.id);

    res.json({
      success: true,
      data: result,
    });
  });

  getIssue = asyncHandler(async (req: Request, res: Response) => {
    const includeParam = req.query.include as string | undefined;
    const include = includeParam ? includeParam.split(',').map(s => s.trim()) : undefined;

    const issue = await this.issuesService.getIssueById(req.params.issueId, req.user!.id, { include });

    res.json({
      success: true,
      data: issue,
    });
  });

  updateIssue = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateIssueSchema.parse(req.body) as UpdateIssueInput;
      const issue = await this.issuesService.updateIssue(req.params.issueId, input, req.user!.id);

      res.json({
        success: true,
        message: 'Issue updated successfully',
        data: issue,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteIssue = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.issuesService.deleteIssue(req.params.issueId, req.user!.id);

    res.json({
      success: true,
      ...result,
    });
  });

  addLink = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = addLinkSchema.parse(req.body) as AddIssueLinkInput;
      const link = await this.issuesService.addLink(req.params.issueId, input, req.user!.id);

      res.status(201).json({
        success: true,
        message: 'Link created successfully',
        data: link,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  // Bulk operations
  bulkUpdate = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = bulkUpdateSchema.parse(req.body);
      const result = await this.issuesService.bulkUpdate(input.issueIds, input.update, req.user!.id);

      res.json({
        success: true,
        message: result.async
          ? 'Bulk update scheduled'
          : `${result.updatedCount} issues updated successfully`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  bulkDelete = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = bulkDeleteSchema.parse(req.body);
      const result = await this.issuesService.bulkDelete(input.issueIds, req.user!.id);

      res.json({
        success: true,
        message: result.async
          ? 'Bulk delete scheduled'
          : `${result.deletedCount} issues deleted successfully`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  bulkMove = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = bulkMoveSchema.parse(req.body);
      const result = await this.issuesService.bulkMove(input.issueIds, input.targetProjectId, req.user!.id);

      res.json({
        success: true,
        message: result.async
          ? 'Bulk move scheduled'
          : `${result.movedCount} issues moved successfully`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  bulkTransition = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = bulkTransitionSchema.parse(req.body);
      const result = await this.issuesService.bulkTransition(
        input.issueIds,
        input.toStatusId,
        req.user!.id,
        { resolution: input.resolution }
      );

      res.json({
        success: true,
        message: result.async
          ? 'Bulk transition scheduled'
          : `${result.transitionedCount} issues transitioned successfully`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getBulkOperation = asyncHandler(async (req: Request, res: Response) => {
    const operation = await this.issuesService.getBulkOperation(req.params.operationId, req.user!.id);
    res.json({
      success: true,
      data: operation,
    });
  });

  cloneIssue = asyncHandler(async (req: Request, res: Response) => {
    const options = cloneIssueSchema.parse(req.body || {});
    const issue = await this.issuesService.cloneIssue(req.params.issueId, req.user!.id, options);

    res.status(201).json({
      success: true,
      message: 'Issue cloned successfully',
      data: issue,
    });
  });

  // Voting endpoints
  addVote = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.issuesService.addVote(req.params.issueId, req.user!.id);

    res.status(201).json({
      success: true,
      message: 'Vote added successfully',
      data: result,
    });
  });

  removeVote = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.issuesService.removeVote(req.params.issueId, req.user!.id);

    res.json({
      success: true,
      message: 'Vote removed successfully',
      data: result,
    });
  });

  getVoters = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.issuesService.getVoters(req.params.issueId, req.user!.id);

    res.json({
      success: true,
      data: result,
    });
  });

  getVotedIssues = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await this.issuesService.getVotedIssues(req.user!.id, page, limit);

    res.json({
      success: true,
      data: result,
    });
  });

  // Watcher endpoints
  addWatcher = asyncHandler(async (req: Request, res: Response) => {
    const targetUserId = req.body.userId;
    const result = await this.issuesService.addWatcher(req.params.issueId, req.user!.id, targetUserId);

    res.status(201).json({
      success: true,
      message: 'Watcher added successfully',
      data: result,
    });
  });

  removeWatcher = asyncHandler(async (req: Request, res: Response) => {
    const targetUserId = req.body.userId;
    const result = await this.issuesService.removeWatcher(req.params.issueId, req.user!.id, targetUserId);

    res.json({
      success: true,
      message: 'Watcher removed successfully',
      data: result,
    });
  });

  getWatchers = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.issuesService.getWatchers(req.params.issueId, req.user!.id);

    res.json({
      success: true,
      data: result,
    });
  });

  getWatchedIssues = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await this.issuesService.getWatchedIssues(req.user!.id, page, limit);

    res.json({
      success: true,
      data: result,
    });
  });

  // Link endpoints
  getLinks = asyncHandler(async (req: Request, res: Response) => {
    const links = await this.issuesService.getLinks(req.params.issueId, req.user!.id);

    res.json({
      success: true,
      data: links,
    });
  });

  deleteLink = asyncHandler(async (req: Request, res: Response) => {
    await this.issuesService.deleteLink(req.params.issueId, req.params.linkId, req.user!.id);

    res.status(204).send();
  });

  getLinkTypes = asyncHandler(async (_req: Request, res: Response) => {
    const linkTypes = await this.issuesService.getLinkTypes();

    res.json({
      success: true,
      data: linkTypes,
    });
  });

  createLinkType = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createLinkTypeSchema.parse(req.body) as {
        name: string;
        outward: string;
        inward: string;
        description?: string | null;
      };
      const linkType = await this.issuesService.createLinkType(input);

      res.status(201).json({
        success: true,
        data: linkType,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  updateLinkType = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateLinkTypeSchema.parse(req.body);
      const linkType = await this.issuesService.updateLinkType(req.params.linkTypeId, input);

      res.json({
        success: true,
        data: linkType,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteLinkType = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.issuesService.deleteLinkType(req.params.linkTypeId);
    res.json({
      success: true,
      ...result,
    });
  });

  // Sub-task endpoints
  getSubtasks = asyncHandler(async (req: Request, res: Response) => {
    const subtasks = await this.issuesService.getSubtasks(req.params.issueId, req.user!.id);

    res.json({
      success: true,
      data: subtasks,
    });
  });

  getSubtaskProgress = asyncHandler(async (req: Request, res: Response) => {
    const progress = await this.issuesService.getSubtaskProgress(req.params.issueId, req.user!.id);

    res.json({
      success: true,
      data: progress,
    });
  });

  exportIssues = asyncHandler(async (req: Request, res: Response) => {
    const format = ((req.query.format as string) || 'csv') as 'csv' | 'xlsx' | 'pdf';

    if (!['csv', 'xlsx', 'pdf'].includes(format)) {
      throw ApiError.badRequest('Unsupported export format');
    }

    const filters = {
      statusId: req.query.statusId as string,
      assigneeId: req.query.assigneeId as string,
      priorityId: req.query.priorityId as string,
      typeId: req.query.typeId as string,
      search: req.query.search as string,
    };

    const result = await this.issuesService.exportIssues(req.params.projectId, req.user!.id, format, filters);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.payload);
  });

  // ── Workflow transition endpoints ─────────────────────────────────────

  getAvailableTransitions = asyncHandler(async (req: Request, res: Response) => {
    const transitions = await this.issuesService.getAvailableTransitions(
      req.params.issueId,
      req.user!.id
    );
    res.json({ success: true, data: transitions });
  });

  performTransition = asyncHandler(async (req: Request, res: Response) => {
    const { transitionId, comment } = req.body as { transitionId: string; comment?: string };

    if (!transitionId || typeof transitionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'transitionId is required' },
      });
    }

    const updatedIssue = await this.issuesService.performTransition(
      req.params.issueId,
      transitionId,
      req.user!.id,
      comment
    );

    res.json({ success: true, message: 'Transition performed successfully', data: updatedIssue });
  });
}
