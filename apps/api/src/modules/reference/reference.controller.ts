import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createIssueTypeSchema, createPrioritySchema,
  updateIssueTypeSchema, updatePrioritySchema, reorderIssueTypesSchema,
} from './reference.validator';
import { ApiError } from '../../utils/ApiError';

export class ReferenceController {
  getIssueTypes = asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.query.projectId as string;

    let issueTypes;

    if (projectId) {
      issueTypes = await prisma.issueType.findMany({
        where: {
          projectId,
        },
        orderBy: { position: 'asc' },
      });
    } else {
      issueTypes = await prisma.issueType.findMany({
        orderBy: { position: 'asc' },
      });
    }

    res.json({
      success: true,
      data: issueTypes,
    });
  });

  getPriorities = asyncHandler(async (req: Request, res: Response) => {
    const priorities = await prisma.issuePriority.findMany({
      orderBy: { level: 'desc' },
    });

    res.json({
      success: true,
      data: priorities,
    });
  });

  getStatuses = asyncHandler(async (req: Request, res: Response) => {
    const workflowId = req.query.workflowId as string;

    let statuses;

    if (workflowId) {
      statuses = await prisma.status.findMany({
        where: { workflowId },
        orderBy: { position: 'asc' },
      });
    } else {
      statuses = await prisma.status.findMany({
        where: {
          workflow: { isDefault: true },
        },
        orderBy: { position: 'asc' },
      });
    }

    res.json({
      success: true,
      data: statuses,
    });
  });

  getLabels = asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.query.projectId as string;

    let labels;

    if (projectId) {
      labels = await prisma.label.findMany({
        where: {
          projectId,
        },
        orderBy: { name: 'asc' },
      });
    } else {
      labels = await prisma.label.findMany({
        orderBy: { name: 'asc' },
      });
    }

    res.json({
      success: true,
      data: labels,
    });
  });

  createIssueType = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = createIssueTypeSchema.parse(req.body);
    const projectId = req.body.projectId;
    const displayName = req.body.displayName;
    const { name, description, icon, color, isSubtask } = validatedData;

    // Get the next position for ordering
    const lastIssueType = await prisma.issueType.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
      select: { position: true }
    });

    const nextPosition = lastIssueType ? lastIssueType.position + 1 : 0;

    const issueType = await prisma.issueType.create({
      data: {
        projectId,
        name,
        displayName: displayName || name,
        description,
        icon,
        color,
        isSubtask: isSubtask || false,
        position: nextPosition
      }
    });

    res.status(201).json({
      success: true,
      data: issueType
    });
  });

  createPriority = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = createPrioritySchema.parse(req.body);
    const _projectId = req.body.projectId;
    const displayName = req.body.displayName;
    const { name, description: _description, icon, color, level, sortOrder } = validatedData;

    // Get the next level if not provided
    let nextLevel = level ?? sortOrder;
    if (nextLevel === undefined) {
      const lastPriority = await prisma.issuePriority.findFirst({
        orderBy: { level: 'desc' },
        select: { level: true }
      });
      nextLevel = lastPriority ? lastPriority.level + 1 : 0;
    }

    const priority = await prisma.issuePriority.create({
      data: {
        name,
        displayName: displayName || name,
        icon,
        color,
        level: nextLevel
      }
    });

    res.status(201).json({
      success: true,
      data: priority
    });
  });

  private static readonly DEFAULT_ISSUE_TYPE_NAMES = new Set(['task', 'bug', 'story', 'improvement', 'subtask']);

  updateIssueType = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const validatedData = updateIssueTypeSchema.parse(req.body);

    const existing = await prisma.issueType.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Issue type not found');

    if (ReferenceController.DEFAULT_ISSUE_TYPE_NAMES.has(existing.name)) {
      throw ApiError.forbidden('Default issue types cannot be modified');
    }

    const updated = await prisma.issueType.update({
      where: { id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.displayName !== undefined && { displayName: validatedData.displayName }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.icon !== undefined && { icon: validatedData.icon }),
        ...(validatedData.color !== undefined && { color: validatedData.color }),
        ...(validatedData.isSubtask !== undefined && { isSubtask: validatedData.isSubtask }),
      },
    });

    res.json({ success: true, data: updated });
  });

  deleteIssueType = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = await prisma.issueType.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Issue type not found');

    if (ReferenceController.DEFAULT_ISSUE_TYPE_NAMES.has(existing.name)) {
      throw ApiError.forbidden('Default issue types cannot be deleted');
    }

    await prisma.issueType.delete({ where: { id } });

    res.json({ success: true, message: 'Issue type deleted' });
  });

  reorderIssueTypes = asyncHandler(async (req: Request, res: Response) => {
    const { projectId: _projectId2, typeIds } = reorderIssueTypesSchema.parse(req.body);

    await Promise.all(
      typeIds.map((typeId, index) =>
        prisma.issueType.update({
          where: { id: typeId },
          data: { position: index },
        })
      )
    );

    res.json({ success: true, message: 'Issue types reordered' });
  });

  updatePriority = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const validatedData = updatePrioritySchema.parse(req.body);

    const existing = await prisma.issuePriority.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Priority not found');

    const updated = await prisma.issuePriority.update({
      where: { id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.displayName !== undefined && { displayName: validatedData.displayName }),
        ...(validatedData.icon !== undefined && { icon: validatedData.icon }),
        ...(validatedData.color !== undefined && { color: validatedData.color }),
        ...(validatedData.level !== undefined && { level: validatedData.level }),
        // Note: IssuePriority has no description field in schema
      },
    });

    res.json({ success: true, data: updated });
  });

  deletePriority = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = await prisma.issuePriority.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Priority not found');

    await prisma.issuePriority.delete({ where: { id } });

    res.json({ success: true, message: 'Priority deleted' });
  });
}
