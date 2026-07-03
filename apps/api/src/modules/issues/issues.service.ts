import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
import { IssuesRepository } from './issues.repository';
import { IssueHistoryRepository } from './issueHistory.repository';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { ProjectsService } from '../projects/projects.service';
import { BoardsService } from '../boards/boards.service';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { webhooksService } from '../webhooks/webhooks.service';
import { usersService } from '../users/users.service';
import { commentsService } from '../comments/comments.service';
import { prisma } from '../../database/prisma';
import { CreateIssueInput, CreateSubtaskInput, UpdateIssueInput, IssueFilters, AddIssueLinkInput } from './issues.types';
import { isSystemAdmin } from '../../utils/system-admin';
import { notificationsService } from '../notifications/notifications.service';
import { pushIssueEvent } from '../../websocket';
import { featureFlagsService } from '../../services/featureFlags.service';
import { pdfService } from '../../services/pdf.service';
import { Prisma } from '@prisma/client';
import { workflowSchemesService } from '../workflow-schemes/workflow-schemes.service';
import { workflowsService } from '../workflows/workflows.service';
import { workflowsRepository } from '../workflows/workflows.repository';
import { transitionConditionsService } from '../workflows/transition-conditions.service';
import { automationEngine } from '../automation/automation.engine';
import type { TriggerEventData } from '../automation/automation.types';
import { sprintsService } from '../sprints/sprints.service';
import { calendarService } from '../calendar/calendar.service';
import { attachmentsService } from '../attachments/attachments.service';
import { TimeTrackingRepository } from '../time-tracking/time-tracking.repository';

// Helper function to convert date strings (YYYY-MM-DD) to datetime strings (ISO-8601) for Prisma
function convertToDateTime(dateStr: string | null | undefined): string | null | undefined {
  if (dateStr === null || dateStr === undefined) return dateStr;
  // If it's already a datetime string, return as is
  if (dateStr.includes('T') || dateStr.includes(' ')) {
    return new Date(dateStr).toISOString();
  }
  // If it's a date string (YYYY-MM-DD), convert to datetime with time 00:00:00
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateRegex.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00Z').toISOString();
  }
  // Try to parse and convert
  return new Date(dateStr).toISOString();
}

export class IssuesService {
  private issuesRepository: IssuesRepository;
  private issueHistoryRepository: IssueHistoryRepository;
  private projectMembersRepository: ProjectMembersRepository;
  private projectsService: ProjectsService;
  private boardsService: BoardsService;
  private timeTrackingRepository: TimeTrackingRepository;

  constructor() {
    this.issuesRepository = new IssuesRepository();
    this.issueHistoryRepository = new IssueHistoryRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
    this.projectsService = new ProjectsService();
    this.boardsService = new BoardsService();
    this.timeTrackingRepository = new TimeTrackingRepository();
  }

  private async getProjectMemberUserIds(projectId: string): Promise<string[]> {
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  private async shouldRunBulkAsync(projectId: string, count: number): Promise<boolean> {
    if (count < 25) {
      return false;
    }
    return featureFlagsService.isEnabled('features.bulkAsync', projectId);
  }

  private async createBulkOperation(
    projectId: string,
    requestedBy: string,
    operationType: 'update' | 'delete' | 'move' | 'transition',
    issueIds: string[],
    payload: Record<string, unknown>
  ) {
    return prisma.$transaction(async (tx) => {
      const operation = await tx.bulkOperation.create({
        data: {
          projectId,
          requestedBy,
          operationType,
          status: 'pending',
          totalCount: issueIds.length,
          payload: payload as Prisma.InputJsonValue,
        },
      });

      await tx.bulkOperationItem.createMany({
        data: issueIds.map((issueId) => ({
          operationId: operation.id,
          issueId,
        })),
      });

      return operation;
    });
  }

  private queueBulkExecution(operationId: string): void {
    setImmediate(async () => {
      try {
        await this.executeBulkOperation(operationId);
      } catch (error) {
        logger.error('Failed to execute bulk operation', { operationId, error });
      }
    });
  }

  private async executeBulkOperation(operationId: string): Promise<void> {
    const operation = await prisma.bulkOperation.findUnique({
      where: { id: operationId },
      include: { items: true },
    });

    if (!operation) {
      return;
    }

    const payload = (operation.payload || {}) as Record<string, any>;
    const issueIds: string[] = Array.isArray(payload.issueIds) ? payload.issueIds : [];

    await prisma.bulkOperation.update({
      where: { id: operationId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      if (operation.operationType === 'update') {
        await this.issuesRepository.bulkUpdate(issueIds, payload.update || {});
      } else if (operation.operationType === 'delete') {
        await this.issuesRepository.bulkSoftDelete(issueIds);
      } else if (operation.operationType === 'move') {
        await this.issuesRepository.bulkMove(issueIds, payload.targetProjectId, payload.statusId);
      } else if (operation.operationType === 'transition') {
        await this.issuesRepository.bulkTransition(
          issueIds,
          payload.toStatusId,
          payload.resolution ?? null
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.bulkOperationItem.updateMany({
          where: { operationId },
          data: { status: 'completed' },
        });

        await tx.bulkOperation.update({
          where: { id: operationId },
          data: {
            status: 'completed',
            processedCount: issueIds.length,
            successCount: issueIds.length,
            failedCount: 0,
            completedAt: new Date(),
          },
        });
      });
    } catch (error: any) {
      await prisma.$transaction(async (tx) => {
        await tx.bulkOperationItem.updateMany({
          where: { operationId },
          data: {
            status: 'failed',
            errorMessage: error?.message || 'Bulk operation failed',
          },
        });

        await tx.bulkOperation.update({
          where: { id: operationId },
          data: {
            status: 'failed',
            processedCount: issueIds.length,
            successCount: 0,
            failedCount: issueIds.length,
            errorMessage: error?.message || 'Bulk operation failed',
            completedAt: new Date(),
          },
        });
      });
    }
  }

  async getBulkOperation(operationId: string, userId: string) {
    const operation = await prisma.bulkOperation.findUnique({
      where: { id: operationId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
      },
    });

    if (!operation) {
      throw ApiError.notFound('Bulk operation not found');
    }

    await this.checkProjectAccess(operation.projectId, userId);
    return operation;
  }

  private async resolveInitialStatusForIssue(projectId: string, issueTypeId: string) {
    const mappedWorkflow = await workflowSchemesService.getEffectiveWorkflow(projectId, issueTypeId);
    if (mappedWorkflow?.workflowId) {
      const mappedStatus = await this.issuesRepository.getDefaultStatusByWorkflow(mappedWorkflow.workflowId);
      if (mappedStatus) {
        return mappedStatus;
      }
    }

    return this.issuesRepository.getDefaultStatus(projectId);
  }

  async createIssue(projectId: string, input: CreateIssueInput, userId: string) {
    await this.checkProjectAccess(projectId, userId);

    let defaultStatus = await this.resolveInitialStatusForIssue(projectId, input.typeId);
    
    // Check if default status exists
    if (!defaultStatus) {
      // Attempt to auto-heal missing workflow/statuses for legacy projects
      await this.projectsService.ensureProjectWorkflow(projectId);
      defaultStatus = await this.resolveInitialStatusForIssue(projectId, input.typeId);
    }

    if (!defaultStatus) {
      throw ApiError.notFound('Default status not found for this project. Please configure a default status in project settings.');
    }

    const descriptionHtml = input.description ? await marked.parse(input.description) : null;

    const issue = await this.issuesRepository.create({
      id: uuidv4(),
      projectId,
      typeId: input.typeId,
      statusId: input.statusId || defaultStatus.id,
      priorityId: input.priorityId,
      title: input.title,
      description: input.description,
      descriptionHtml,
      reporterId: userId,
      assigneeId: input.assigneeId,
      parentId: input.parentId,
      storyPoints: input.storyPoints,
      originalEstimateHours: input.originalEstimateHours,
      remainingEstimateHours: input.originalEstimateHours,
      dueDate: convertToDateTime(input.dueDate),
      startDate: convertToDateTime(input.startDate),
      sprintId: input.sprintId,
      epicId: input.epicId,
    });

    if (input.labels && input.labels.length > 0) {
      await this.issuesRepository.addLabels(issue.id, input.labels, userId);
    }

    await this.issueHistoryRepository.create({
      issueId: issue.id,
      userId,
      fieldName: 'issue',
      newValue: 'created',
      changeType: 'create',
    });

    await this.issuesRepository.addWatcher(issue.id, userId);

    const createdIssue = await this.getIssueById(issue.id, userId);

    try {
      const [actor, recipientIds] = await Promise.all([
        usersService.getUserById(userId),
        this.getProjectMemberUserIds(projectId),
      ]);
      const actorName = actor?.displayName || 'Someone';

      await notificationsService.notify(
        {
          type: 'issue_created',
          recipientIds,
          actorId: userId,
          issueId: createdIssue.id,
          projectId,
          metadata: {
            issueKey: createdIssue.issueKey,
            issueTitle: createdIssue.title,
            projectName: createdIssue.project?.name,
            projectId,
            issueId: createdIssue.id,
          },
        },
        actorName
      );

      if (input.assigneeId) {
        await notificationsService.notify(
          {
            type: 'issue_assigned',
            recipientIds: [input.assigneeId],
            actorId: userId,
            issueId: createdIssue.id,
            projectId,
            metadata: {
              issueKey: createdIssue.issueKey,
              issueTitle: createdIssue.title,
              projectName: createdIssue.project?.name,
              projectId,
              issueId: createdIssue.id,
            },
          },
          actorName
        );
      }
    } catch (error) {
      logger.warn('Failed to create issue notifications', { error });
    }

    try {
      const actor = await usersService.getUserById(userId);
      const actorInfo = actor
        ? { id: actor.id, displayName: actor.displayName, email: actor.email }
        : undefined;

      await webhooksService.triggerWebhook(projectId, 'issue.created', createdIssue, actorInfo);

      if (input.assigneeId) {
        await webhooksService.triggerWebhook(
          projectId,
          'issue.assigned',
          createdIssue,
          actorInfo
        );
      }
    } catch (error) {
      logger.warn('Failed to trigger issue.created webhook', { error });
    }

    // Calendar sync: sync due date to assignee's calendar (fire-and-forget)
    if (input.dueDate && input.assigneeId) {
      calendarService.syncIssueDueDate(
        createdIssue.id,
        createdIssue.issueKey || '',
        createdIssue.title,
        createdIssue.description || '',
        input.dueDate,
        input.assigneeId
      ).catch(err => logger.warn('Calendar sync failed for new issue', { error: err }));
    }

    // Fire automation events (fire-and-forget)
    try {
      const issueEventData: TriggerEventData['issue'] = {
        id: createdIssue.id,
        key: createdIssue.issueKey || '',
        typeId: createdIssue.typeId || input.typeId,
        statusId: createdIssue.statusId || input.statusId || '',
        priorityId: createdIssue.priorityId || input.priorityId,
        assigneeId: createdIssue.assigneeId || input.assigneeId,
        reporterId: userId,
        title: createdIssue.title,
      };

      automationEngine.processEvent({
        type: 'issue_created',
        projectId,
        userId,
        issue: issueEventData,
      }).catch(err => logger.warn('Automation issue_created event failed', { error: err }));

      if (input.assigneeId) {
        automationEngine.processEvent({
          type: 'issue_assigned',
          projectId,
          userId,
          issue: issueEventData,
          changes: [{ field: 'assignee', oldValue: null, newValue: input.assigneeId }],
        }).catch(err => logger.warn('Automation issue_assigned event failed', { error: err }));
      }
    } catch (error) {
      logger.warn('Failed to fire automation events for issue creation', { error });
    }

    // Audit log (fire-and-forget)
    prisma.auditLog.create({
      data: {
        userId,
        action: 'issue.created',
        entityType: 'issue',
        entityId: createdIssue.id,
        newValues: { title: createdIssue.title, projectId } as any,
        metadata: { projectId } as any,
      },
    }).catch(() => {/* non-fatal */});

    // Broadcast real-time update to all clients viewing this project board
    pushIssueEvent('issue:created', projectId, {
      issueId: createdIssue.id,
      issue: createdIssue,
      userId,
    });

    return createdIssue;
  }

  async createSubtask(parentIssueId: string, input: CreateSubtaskInput, userId: string) {
    const parentIssue = await this.issuesRepository.findById(parentIssueId);
    if (!parentIssue) {
      throw ApiError.notFound('Parent issue not found');
    }

    await this.checkProjectAccess(parentIssue.projectId, userId);

    // Allow 3-level nesting: Epic → Task → Sub-task
    // Block deeper nesting (sub-task of a sub-task)
    if (parentIssue.parentId) {
      const grandparent = await this.issuesRepository.findById(parentIssue.parentId);
      const grandparentType = grandparent ? await prisma.issueType.findUnique({
        where: { id: grandparent.typeId },
        select: { name: true },
      }) : null;
      // Only allow if grandparent is an epic (3-level: epic → task → subtask)
      if (!grandparentType || grandparentType.name.toLowerCase() !== 'epic') {
        throw ApiError.badRequest('Nested subtasks beyond 3 levels are not allowed');
      }
    }

    const parentType = await prisma.issueType.findUnique({
      where: { id: parentIssue.typeId },
      select: { isSubtask: true, name: true },
    });
    if (parentType?.isSubtask) {
      throw ApiError.badRequest('Cannot create subtask under another subtask');
    }

    // Pick child type based on parent type:
    //   Epic parent  → Task
    //   Anything else → Sub Task (isSubtask: true)
    let childType: { id: string } | null = null;

    if (parentType?.name.toLowerCase() === 'epic') {
      // Find the "Task" issue type for this project (case-insensitive)
      childType = await prisma.issueType.findFirst({
        where: {
          projectId: parentIssue.projectId,
          name: { equals: 'Task', mode: 'insensitive' },
        },
        select: { id: true },
      });
      // Fall back to first non-subtask, non-epic type if "Task" doesn't exist
      if (!childType) {
        childType = await prisma.issueType.findFirst({
          where: {
            projectId: parentIssue.projectId,
            isSubtask: false,
            NOT: { name: { equals: 'epic', mode: 'insensitive' } },
          },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
      }
    } else {
      // For Task / Improvement / any other type → default sub-task type
      childType = await this.issuesRepository.findDefaultSubtaskType(parentIssue.projectId);
    }

    if (!childType) {
      throw ApiError.badRequest('No suitable child issue type configured for this project');
    }

    return this.createIssue(
      parentIssue.projectId,
      {
        ...input,
        typeId: childType.id,
        parentId: parentIssueId,
      },
      userId
    );
  }

  async getIssues(projectId: string, filters: IssueFilters, userId: string) {
    // Project membership check — if the user belongs to the project, they can see all its issues
    await this.checkProjectAccess(projectId, userId);

    const issues = await this.issuesRepository.findByProject(projectId, filters);
    const total = await this.issuesRepository.countByProject(projectId, filters);

    return {
      issues,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 50,
        total,
        totalPages: Math.ceil(total / (filters.limit || 50)),
      },
    };
  }

  async getIssueById(issueId: string, userId: string, options?: { include?: string[] }) {
    const issue = await this.issuesRepository.findById(issueId);

    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);

    const include = options?.include || [];

    // Base queries — always loaded
    const basePromises = [
      this.issuesRepository.findChildrenWithDetails(issueId),
      this.issuesRepository.findLinksWithDetails(issueId),
      this.issuesRepository.getWatchersDetailed(issueId),
      this.issueHistoryRepository.findByIssue(issueId, { limit: 10 }),
      this.issuesRepository.getWatcherCount(issueId),
      this.issuesRepository.isWatching(issueId, userId),
    ] as const;

    // Optional queries — only loaded when requested via ?include=
    const optionalPromises: Promise<any>[] = [];
    const optionalKeys: string[] = [];

    if (include.includes('subtaskProgress')) {
      optionalPromises.push(this.issuesRepository.getSubtaskProgress(issueId));
      optionalKeys.push('subtaskProgress');
    }
    if (include.includes('attachments')) {
      optionalPromises.push(attachmentsService.getByIssue(issueId));
      optionalKeys.push('attachments');
    }
    if (include.includes('timeLogs')) {
      optionalPromises.push(this.timeTrackingRepository.findTimeLogsByIssue(issueId));
      optionalKeys.push('timeLogs');
    }

    const [baseResults, optionalResults] = await Promise.all([
      Promise.all(basePromises),
      Promise.all(optionalPromises),
    ]);

    const [children, links, watchersList, history, watcherCount, isWatching] = baseResults;

    // Build optional data object
    const optionalData: Record<string, any> = {};
    optionalKeys.forEach((key, i) => {
      optionalData[key] = optionalResults[i];
    });

    return {
      ...issue,
      children,
      links,
      watchers: {
        watchers: watchersList,
        watcherCount,
        isWatching,
      },
      history,
      ...optionalData,
    };
  }

  async updateIssue(issueId: string, input: UpdateIssueInput, userId: string, bypassWipLimit = false) {
    const existingIssue = await this.issuesRepository.findById(issueId);

    if (!existingIssue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(existingIssue.projectId, userId);

    // ── Workflow transition enforcement ────────────────────────────────────
    if (input.statusId && input.statusId !== existingIssue.status_id) {
      const sysAdmin = await isSystemAdmin(userId);

      if (!sysAdmin) {
        const workflow = await workflowSchemesService.getEffectiveWorkflow(
          existingIssue.projectId,
          existingIssue.type_id
        );

        if (workflow) {
          // 1. Check if this transition is defined in the workflow
          const allowed = await workflowsService.isTransitionAllowed(
            existingIssue.status_id,
            input.statusId
          );
          if (!allowed) {
            throw ApiError.forbidden(
              'This status transition is not allowed by the project workflow'
            );
          }

          // 2. Evaluate transition conditions (including role restrictions)
          const transition = await workflowsRepository.findTransitionByFromTo(
            existingIssue.status_id,
            input.statusId
          );

          if (transition) {
            const [projectMember, userRecord] = await Promise.all([
              prisma.projectMember.findFirst({
                where: { projectId: existingIssue.projectId, userId },
                select: { role: true },
              }),
              prisma.user.findUnique({
                where: { id: userId },
                select: { role: { select: { name: true } } },
              }),
            ]);

            const evaluation = await transitionConditionsService.evaluateTransition(
              transition.id,
              { ...existingIssue, id: issueId },
              { id: userId, roles: [userRecord?.role?.name ?? ''], permissions: [] },
              { projectRole: projectMember?.role ?? 'member' }
            );

            if (!evaluation.canTransition) {
              throw new ApiError(
                403,
                evaluation.errors[0] || 'Transition conditions not met',
                true,
                'WORKFLOW_RESTRICTION',
                { errors: evaluation.errors, warnings: evaluation.warnings }
              );
            }
          }
        }
      }
    }
    // ── End workflow enforcement ───────────────────────────────────────────

    // Check WIP limit if status is changing
    if (input.statusId && input.statusId !== existingIssue.status_id && !bypassWipLimit) {
      await this.boardsService.validateWipLimit(existingIssue.projectId, input.statusId);
    }

    // If descriptionHtml is explicitly provided (from rich text editor), use it directly.
    // Otherwise, auto-generate from plain description text (legacy markdown path).
    if (input.descriptionHtml === undefined && input.description !== undefined) {
      input.descriptionHtml = input.description ? await marked.parse(input.description) : undefined;
    }

    // Auto-set dates based on status category transitions
    const isStatusTransition = input.statusId && input.statusId !== existingIssue.status_id;
    if (isStatusTransition) {
      const newStatus = await prisma.status.findUnique({
        where: { id: input.statusId },
        select: { category: true },
      });

      if (newStatus?.category === 'in_progress' && !existingIssue.start_date && input.startDate === undefined) {
        input.startDate = new Date().toISOString().split('T')[0];
      }

      if (newStatus?.category === 'done' && input.resolutionDate === undefined) {
        input.resolutionDate = new Date();
      }
    }

    // Create a copy of input with converted dates
    const updateInput = {
      ...input,
      dueDate: input.dueDate !== undefined ? convertToDateTime(input.dueDate) : undefined,
      startDate: input.startDate !== undefined ? convertToDateTime(input.startDate) : undefined,
    };

    const updatedIssue = await this.issuesRepository.update(issueId, updateInput);
    const fullIssue = await this.getIssueById(updatedIssue.id, userId);
    const isStatusChanged = Boolean(input.statusId && input.statusId !== existingIssue.status_id);

    // Update sprint metrics when status changes on a sprint issue (fire-and-forget)
    if (isStatusChanged && existingIssue.sprintId) {
      sprintsService
        .recordDailyMetrics(existingIssue.sprintId)
        .catch((err) => logger.warn('Failed to update sprint metrics on status change:', err));
    }

    // Execute workflow post-functions (fire-and-forget, errors are logged not thrown)
    if (isStatusChanged) {
      try {
        const transition = await workflowsRepository.findTransitionByFromTo(
          existingIssue.status_id,
          input.statusId!
        );
        if (transition) {
          transitionConditionsService
            .executePostFunctions(transition.id, { ...existingIssue, id: issueId }, userId)
            .catch((err) => logger.warn('Post-function execution error:', err));
        }
      } catch (err) {
        logger.warn('Failed to look up transition for post-functions:', err);
      }
    }
    const isAssigneeChanged =
      input.assigneeId !== undefined && input.assigneeId !== existingIssue.assignee_id;

    // Create activity logs for changes
    try {
      // Log status change
      if (isStatusChanged) {
        const [oldStatus, newStatus] = await Promise.all([
          existingIssue.status_id ? prisma.status.findUnique({ where: { id: existingIssue.status_id }, select: { displayName: true } }) : null,
          prisma.status.findUnique({ where: { id: input.statusId }, select: { displayName: true } }),
        ]);

        await commentsService.logActivity({
          issueId,
          userId,
          action: 'status_changed',
          fieldName: 'status',
          oldValue: oldStatus?.displayName || null,
          newValue: newStatus?.displayName || null,
        });
      }

      // Log assignee change
      if (isAssigneeChanged) {
        const [oldAssignee, newAssignee] = await Promise.all([
          existingIssue.assignee_id ? usersService.getUserById(existingIssue.assignee_id) : null,
          input.assigneeId ? usersService.getUserById(input.assigneeId) : null,
        ]);

        await commentsService.logActivity({
          issueId,
          userId,
          action: 'assignee_changed',
          fieldName: 'assignee',
          oldValue: oldAssignee?.displayName || null,
          newValue: newAssignee?.displayName || null,
        });
      }
    } catch (error) {
      logger.warn('Failed to create activity logs', { error });
    }

    try {
      const [actor, recipientIds] = await Promise.all([
        usersService.getUserById(userId),
        this.getProjectMemberUserIds(existingIssue.projectId),
      ]);
      const actorName = actor?.displayName || 'Someone';
      const commonMetadata = {
        issueKey: fullIssue.issueKey,
        issueTitle: fullIssue.title,
        projectName: fullIssue.project?.name,
        projectId: existingIssue.projectId,
        issueId: fullIssue.id,
      };

      if (isStatusChanged) {
        await notificationsService.notify(
          {
            type: 'issue_status_changed',
            recipientIds,
            actorId: userId,
            issueId: fullIssue.id,
            projectId: existingIssue.projectId,
            metadata: {
              ...commonMetadata,
              newValue: fullIssue.status?.displayName || fullIssue.status?.name,
            },
          },
          actorName
        );
      }

      if (isAssigneeChanged && input.assigneeId) {
        await notificationsService.notify(
          {
            type: 'issue_assigned',
            recipientIds: [input.assigneeId],
            actorId: userId,
            issueId: fullIssue.id,
            projectId: existingIssue.projectId,
            metadata: commonMetadata,
          },
          actorName
        );
      }

      if (!isStatusChanged && !isAssigneeChanged) {
        await notificationsService.notify(
          {
            type: 'issue_updated',
            recipientIds,
            actorId: userId,
            issueId: fullIssue.id,
            projectId: existingIssue.projectId,
            metadata: commonMetadata,
          },
          actorName
        );
      }
    } catch (error) {
      logger.warn('Failed to create issue update notifications', { error });
    }

    try {
      const actor = await usersService.getUserById(userId);
      const actorInfo = actor
        ? { id: actor.id, displayName: actor.displayName, email: actor.email }
        : undefined;

      await webhooksService.triggerWebhook(existingIssue.projectId, 'issue.updated', fullIssue, actorInfo);

      if (isAssigneeChanged) {
        await webhooksService.triggerWebhook(existingIssue.projectId, 'issue.assigned', fullIssue, actorInfo);
      }

      if (isStatusChanged) {
        await webhooksService.triggerWebhook(existingIssue.projectId, 'board.issue_moved', fullIssue, actorInfo);
      }
    } catch (error) {
      logger.warn('Failed to trigger issue update webhooks', { error });
    }

    // Calendar sync: sync due date changes to assignee's calendar (fire-and-forget)
    const isDueDateChanged = input.dueDate !== undefined;
    const assigneeId = fullIssue.assigneeId || existingIssue.assignee_id;
    if (isDueDateChanged && assigneeId) {
      if (input.dueDate === null) {
        // Due date removed — delete calendar event
        calendarService.removeIssueDueDate(fullIssue.id, assigneeId)
          .catch(err => logger.warn('Calendar sync failed: remove due date', { error: err }));
      } else {
        // Due date set or changed — sync to calendar
        calendarService.syncIssueDueDate(
          fullIssue.id,
          fullIssue.issueKey || '',
          fullIssue.title,
          fullIssue.description || '',
          input.dueDate!,
          assigneeId
        ).catch(err => logger.warn('Calendar sync failed: update due date', { error: err }));
      }
    }

    // If assignee changed and issue has a due date, sync to new assignee's calendar
    if (isAssigneeChanged && input.assigneeId && fullIssue.dueDate) {
      // Remove from old assignee's calendar
      if (existingIssue.assignee_id) {
        calendarService.removeIssueDueDate(fullIssue.id, existingIssue.assignee_id)
          .catch(err => logger.warn('Calendar sync failed: remove from old assignee', { error: err }));
      }
      // Sync to new assignee's calendar
      const dueStr = new Date(fullIssue.dueDate).toISOString().split('T')[0];
      calendarService.syncIssueDueDate(
        fullIssue.id,
        fullIssue.issueKey || '',
        fullIssue.title,
        fullIssue.description || '',
        dueStr,
        input.assigneeId
      ).catch(err => logger.warn('Calendar sync failed: sync to new assignee', { error: err }));
    }

    // Fire automation events (fire-and-forget)
    try {
      const issueEventData: TriggerEventData['issue'] = {
        id: fullIssue.id,
        key: fullIssue.issueKey || '',
        typeId: fullIssue.typeId || existingIssue.type_id,
        statusId: fullIssue.statusId || existingIssue.status_id,
        priorityId: fullIssue.priorityId || existingIssue.priority_id,
        assigneeId: fullIssue.assigneeId || existingIssue.assignee_id,
        reporterId: fullIssue.reporterId || existingIssue.reporter_id,
        title: fullIssue.title,
      };

      // Build changes array for field-level triggers
      const changes: TriggerEventData['changes'] = [];
      if (isStatusChanged) {
        changes.push({ field: 'status', oldValue: existingIssue.status_id, newValue: input.statusId });
      }
      if (isAssigneeChanged) {
        changes.push({ field: 'assignee', oldValue: existingIssue.assignee_id, newValue: input.assigneeId });
      }
      if (input.priorityId !== undefined && input.priorityId !== existingIssue.priority_id) {
        changes.push({ field: 'priority', oldValue: existingIssue.priority_id, newValue: input.priorityId });
      }
      if (input.title !== undefined && input.title !== existingIssue.title) {
        changes.push({ field: 'summary', oldValue: existingIssue.title, newValue: input.title });
      }

      if (isStatusChanged) {
        automationEngine.processEvent({
          type: 'issue_transitioned',
          projectId: existingIssue.projectId,
          userId,
          issue: issueEventData,
          changes,
        }).catch(err => logger.warn('Automation issue_transitioned event failed', { error: err }));
      }

      if (isAssigneeChanged) {
        automationEngine.processEvent({
          type: 'issue_assigned',
          projectId: existingIssue.projectId,
          userId,
          issue: issueEventData,
          changes,
        }).catch(err => logger.warn('Automation issue_assigned event failed', { error: err }));
      }

      // Always fire issue_updated for any change
      automationEngine.processEvent({
        type: 'issue_updated',
        projectId: existingIssue.projectId,
        userId,
        issue: issueEventData,
        changes,
      }).catch(err => logger.warn('Automation issue_updated event failed', { error: err }));
    } catch (error) {
      logger.warn('Failed to fire automation events for issue update', { error });
    }

    // Audit log (fire-and-forget)
    prisma.auditLog.create({
      data: {
        userId,
        action: 'issue.updated',
        entityType: 'issue',
        entityId: fullIssue.id,
        newValues: { title: fullIssue.title, projectId: existingIssue.projectId } as any,
        metadata: { projectId: existingIssue.projectId } as any,
      },
    }).catch(() => {/* non-fatal */});

    // Broadcast real-time update to all clients viewing this project board
    const wsEvent = isStatusChanged ? 'issue:moved' : 'issue:updated';
    pushIssueEvent(wsEvent as any, existingIssue.projectId, {
      issueId: fullIssue.id,
      issue: fullIssue,
      updatedBy: { id: userId },
      userId,
    });

    return fullIssue;
  }

  async deleteIssue(issueId: string, userId: string) {
    const issue = await this.issuesRepository.findById(issueId);

    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId, ['admin', 'lead']);

    await this.issuesRepository.softDelete(issueId);

    // Audit log (fire-and-forget)
    prisma.auditLog.create({
      data: {
        userId,
        action: 'issue.deleted',
        entityType: 'issue',
        entityId: issueId,
        oldValues: { title: issue.title, projectId: issue.projectId } as any,
        metadata: { projectId: issue.projectId } as any,
      },
    }).catch(() => {/* non-fatal */});

    // Broadcast real-time delete event to all clients viewing this project board
    pushIssueEvent('issue:deleted', issue.projectId, {
      issueId,
      userId,
    });

    return { message: 'Issue deleted successfully' };
  }

  async addLink(issueId: string, input: AddIssueLinkInput, userId: string) {
    const [sourceIssue, targetIssue] = await Promise.all([
      this.issuesRepository.findById(issueId),
      this.issuesRepository.findById(input.targetIssueId),
    ]);

    if (!sourceIssue || !targetIssue) {
      throw ApiError.notFound('Issue not found');
    }

    if (issueId === input.targetIssueId) {
      throw ApiError.badRequest('Cannot link issue to itself');
    }

    await this.checkProjectAccess(sourceIssue.projectId, userId);

    // Look up link type ID if using the new system
    let linkTypeId: string | undefined;
    const linkTypeRecord = await this.issuesRepository.getLinkTypeByName(input.linkType);
    if (linkTypeRecord) {
      linkTypeId = linkTypeRecord.id;
    } else {
      throw ApiError.badRequest(`Invalid link type: ${input.linkType}`);
    }

    const link = await this.issuesRepository.addLink({
      sourceIssueId: issueId,
      targetIssueId: input.targetIssueId,
      linkType: input.linkType,
      linkTypeId,
      createdBy: userId,
    });

    return link;
  }

  async getLinks(issueId: string, userId: string) {
    const issue = await this.issuesRepository.findById(issueId);

    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);

    return this.issuesRepository.findLinksWithDetails(issueId);
  }

  async deleteLink(issueId: string, linkId: string, userId: string) {
    const issue = await this.issuesRepository.findById(issueId);

    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);

    const link = await this.issuesRepository.findLinkById(linkId);

    if (!link) {
      throw ApiError.notFound('Link not found');
    }

    // Verify the link belongs to this issue
    if (link.source_issue_id !== issueId && link.target_issue_id !== issueId) {
      throw ApiError.badRequest('Link does not belong to this issue');
    }

    await this.issuesRepository.deleteLink(linkId);

    return { message: 'Link deleted successfully' };
  }

  async getLinkTypes() {
    const linkTypes = await this.issuesRepository.getLinkTypes();

    return linkTypes.map((lt: any) => ({
      id: lt.id,
      name: lt.name,
      outward: lt.outward,
      inward: lt.inward,
      description: lt.description,
    }));
  }

  async createLinkType(input: { name: string; outward: string; inward: string; description?: string | null }) {
    const conflict = await this.issuesRepository.findLinkTypeConflict(
      [input.name, input.outward, input.inward]
    );

    if (conflict) {
      throw ApiError.badRequest('Link type already exists');
    }

    return this.issuesRepository.createLinkType({
      name: input.name,
      outward: input.outward,
      inward: input.inward,
      description: input.description ?? null,
    });
  }

  async updateLinkType(id: string, input: { name?: string; outward?: string; inward?: string; description?: string | null }) {
    const existing = await this.issuesRepository.getLinkTypeById(id);
    if (!existing) {
      throw ApiError.notFound('Link type not found');
    }

    const conflict = await this.issuesRepository.findLinkTypeConflict(
      [input.name || existing.name, input.outward || existing.outward, input.inward || existing.inward],
      id
    );

    if (conflict) {
      throw ApiError.badRequest('Link type already exists');
    }

    return this.issuesRepository.updateLinkType(id, input);
  }

  async deleteLinkType(id: string) {
    const existing = await this.issuesRepository.getLinkTypeById(id);
    if (!existing) {
      throw ApiError.notFound('Link type not found');
    }

    const usageCount = await this.issuesRepository.countLinksByType(id);
    if (usageCount > 0) {
      throw ApiError.badRequest('Cannot delete link type that is in use');
    }

    await this.issuesRepository.deleteLinkType(id);
    return { message: 'Link type deleted successfully' };
  }

  async getSubtasks(issueId: string, userId: string) {
    const issue = await this.issuesRepository.findById(issueId);

    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);

    const subtasks = await this.issuesRepository.findChildrenWithDetails(issueId);

    return subtasks.map((subtask: any) => ({
      id: subtask.id,
      issueKey: subtask.issue_key,
      title: subtask.title,
      storyPoints: subtask.story_points,
      timeSpentHours: subtask.time_spent_hours,
      originalEstimateHours: subtask.original_estimate_hours,
      remainingEstimateHours: subtask.remaining_estimate_hours,
      type: subtask.type,
      status: subtask.status,
      priority: subtask.priority,
      assignee: subtask.assignee,
    }));
  }

  async getSubtaskProgress(issueId: string, userId: string) {
    const issue = await this.issuesRepository.findById(issueId);

    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);

    return this.issuesRepository.getSubtaskProgress(issueId);
  }

  private async checkProjectAccess(projectId: string, userId: string, requiredRoles?: string[]) {
    if (!projectId) {
      throw ApiError.badRequest('Project ID is required');
    }

    if (await isSystemAdmin(userId)) {
      return;
    }

    const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);

    if (!membership) {
      throw ApiError.forbidden('Access denied');
    }

    if (requiredRoles && !requiredRoles.includes(membership.role)) {
      throw ApiError.forbidden('Insufficient permissions');
    }
  }

  /**
   * Bulk update multiple issues
   */
  async bulkUpdate(
    issueIds: string[],
    update: {
      statusId?: string;
      priorityId?: string;
      assigneeId?: string | null;
      sprintId?: string | null;
      labels?: string[];
    },
    userId: string
  ) {
    const issues = await Promise.all(issueIds.map((id) => this.issuesRepository.findById(id)));

    const notFound = issues.filter((i) => !i);
    if (notFound.length > 0) {
      throw ApiError.badRequest(`Some issues were not found`);
    }

    // Check access to all projects
    const projectIds = [...new Set(issues.map((i) => i!.projectId))];
    await Promise.all(projectIds.map((pid) => this.checkProjectAccess(pid, userId)));

    const primaryProjectId = projectIds[0];
    const runAsync = primaryProjectId
      ? await this.shouldRunBulkAsync(primaryProjectId, issueIds.length)
      : false;

    if (runAsync) {
      const operation = await this.createBulkOperation(primaryProjectId, userId, 'update', issueIds, {
        issueIds,
        update,
      });
      this.queueBulkExecution(operation.id);
      return {
        async: true,
        operationId: operation.id,
        status: operation.status,
        totalCount: operation.totalCount,
      };
    }

    // Perform bulk update
    const updatedCount = await this.issuesRepository.bulkUpdate(issueIds, update);

    // Record history for each issue
    const historyPromises = issueIds.map((issueId) =>
      this.issueHistoryRepository.create({
        issueId,
        userId,
        fieldName: 'bulk_update',
        newValue: JSON.stringify(update),
        changeType: 'update',
      })
    );
    await Promise.all(historyPromises);

    return {
      async: false,
      updatedCount,
      issueIds,
    };
  }

  /**
   * Bulk delete multiple issues
   */
  async bulkDelete(issueIds: string[], userId: string) {
    const issues = await Promise.all(issueIds.map((id) => this.issuesRepository.findById(id)));

    const notFound = issues.filter((i) => !i);
    if (notFound.length > 0) {
      throw ApiError.badRequest(`Some issues were not found`);
    }

    // Check admin/lead access to all projects
    const projectIds = [...new Set(issues.map((i) => i!.projectId))];
    await Promise.all(projectIds.map((pid) => this.checkProjectAccess(pid, userId, ['admin', 'lead'])));

    const primaryProjectId = projectIds[0];
    const runAsync = primaryProjectId
      ? await this.shouldRunBulkAsync(primaryProjectId, issueIds.length)
      : false;

    if (runAsync) {
      const operation = await this.createBulkOperation(primaryProjectId, userId, 'delete', issueIds, {
        issueIds,
      });
      this.queueBulkExecution(operation.id);
      return {
        async: true,
        operationId: operation.id,
        status: operation.status,
        totalCount: operation.totalCount,
      };
    }

    // Perform bulk soft delete
    const deletedCount = await this.issuesRepository.bulkSoftDelete(issueIds);

    return {
      async: false,
      deletedCount,
      issueIds,
    };
  }

  /**
   * Bulk move issues to a different project
   */
  async bulkMove(issueIds: string[], targetProjectId: string, userId: string) {
    const issues = await Promise.all(issueIds.map((id) => this.issuesRepository.findById(id)));

    const notFound = issues.filter((i) => !i);
    if (notFound.length > 0) {
      throw ApiError.badRequest(`Some issues were not found`);
    }

    // Check access to source projects
    const sourceProjectIds = [...new Set(issues.map((i) => i!.projectId))];
    await Promise.all(sourceProjectIds.map((pid) => this.checkProjectAccess(pid, userId, ['admin', 'lead'])));

    // Check access to target project
    await this.checkProjectAccess(targetProjectId, userId);

    // Get target project's default status
    const defaultStatus = await this.issuesRepository.getDefaultStatus(targetProjectId);
    
    // Check if default status exists
    if (!defaultStatus) {
      throw ApiError.notFound('Default status not found for target project. Please configure a default status in project settings.');
    }

    const runAsync = await this.shouldRunBulkAsync(targetProjectId, issueIds.length);

    if (runAsync) {
      const operation = await this.createBulkOperation(targetProjectId, userId, 'move', issueIds, {
        issueIds,
        targetProjectId,
        statusId: defaultStatus.id,
      });
      this.queueBulkExecution(operation.id);
      return {
        async: true,
        operationId: operation.id,
        status: operation.status,
        totalCount: operation.totalCount,
      };
    }

    const movedCount = await this.issuesRepository.bulkMove(issueIds, targetProjectId, defaultStatus.id);

    // Record history
    const historyPromises = issueIds.map((issueId) =>
      this.issueHistoryRepository.create({
        issueId,
        userId,
        fieldName: 'project',
        newValue: targetProjectId,
        changeType: 'update',
      })
    );
    await Promise.all(historyPromises);

    return {
      async: false,
      movedCount,
      issueIds,
      targetProjectId,
    };
  }

  async bulkTransition(
    issueIds: string[],
    toStatusId: string,
    userId: string,
    options?: { resolution?: string | null }
  ) {
    const issues = await Promise.all(issueIds.map((id) => this.issuesRepository.findById(id)));
    const notFound = issues.filter((i) => !i);
    if (notFound.length > 0) {
      throw ApiError.badRequest(`Some issues were not found`);
    }

    const projectIds = [...new Set(issues.map((i) => i!.projectId))];
    await Promise.all(projectIds.map((pid) => this.checkProjectAccess(pid, userId)));
    const primaryProjectId = projectIds[0];

    const runAsync = primaryProjectId
      ? await this.shouldRunBulkAsync(primaryProjectId, issueIds.length)
      : false;

    if (runAsync) {
      const operation = await this.createBulkOperation(primaryProjectId, userId, 'transition', issueIds, {
        issueIds,
        toStatusId,
        resolution: options?.resolution ?? null,
      });
      this.queueBulkExecution(operation.id);
      return {
        async: true,
        operationId: operation.id,
        status: operation.status,
        totalCount: operation.totalCount,
      };
    }

    const transitionedCount = await this.issuesRepository.bulkTransition(
      issueIds,
      toStatusId,
      options?.resolution ?? null
    );

    const historyPromises = issueIds.map((issueId) =>
      this.issueHistoryRepository.create({
        issueId,
        userId,
        fieldName: 'status',
        newValue: toStatusId,
        changeType: 'update',
      })
    );
    await Promise.all(historyPromises);

    return {
      async: false,
      transitionedCount,
      issueIds,
      toStatusId,
    };
  }

  /**
   * Clone an issue
   */
  async cloneIssue(
    issueId: string,
    userId: string,
    options?: { includeChildren?: boolean; includeLinks?: boolean; includeAttachments?: boolean }
  ) {
    const sourceIssue = await this.issuesRepository.findById(issueId);

    if (!sourceIssue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(sourceIssue.projectId, userId);

    // Create the cloned issue
    const clonedIssue = await this.issuesRepository.create({
      id: uuidv4(),
      projectId: sourceIssue.projectId,
      typeId: sourceIssue.type_id,
      statusId: sourceIssue.status_id,
      priorityId: sourceIssue.priority_id,
      title: `[Clone] ${sourceIssue.title}`,
      description: sourceIssue.description,
      descriptionHtml: sourceIssue.description_html,
      reporterId: userId,
      assigneeId: sourceIssue.assignee_id,
      parentId: sourceIssue.parent_id,
      storyPoints: sourceIssue.story_points,
      originalEstimateHours: sourceIssue.original_estimate_hours,
      remainingEstimateHours: sourceIssue.original_estimate_hours,
      dueDate: sourceIssue.due_date,
      startDate: sourceIssue.start_date,
    });

    // Add clone link
    await this.issuesRepository.addLink({
      sourceIssueId: clonedIssue.id,
      targetIssueId: issueId,
      linkType: 'is_cloned_by',
      createdBy: userId,
    });

    // Copy labels
    const sourceLabels = await this.issuesRepository.getIssueLabels(issueId);
    if (sourceLabels.length > 0) {
      await this.issuesRepository.addLabels(
        clonedIssue.id,
        sourceLabels.map((l: any) => l.labelId || l.label_id),
        userId
      );
    }

    if (options?.includeLinks) {
      const links = await this.issuesRepository.findLinks(issueId);
      const sourceToTargetLinks = links.filter(
        (link: any) => link.sourceIssueId === issueId || link.source_issue_id === issueId
      );
      for (const link of sourceToTargetLinks) {
        const targetIssueId = link.targetIssueId || link.target_issue_id;
        const linkTypeId = link.linkTypeId || link.link_type_id;
        if (!targetIssueId || !linkTypeId) continue;
        try {
          await prisma.issueLink.create({
            data: {
              sourceIssueId: clonedIssue.id,
              targetIssueId,
              linkTypeId,
              createdBy: userId,
            },
          });
        } catch {
          // Skip duplicate/incompatible links during clone.
        }
      }
    }

    if (options?.includeChildren) {
      const children = await this.issuesRepository.findChildrenWithDetails(issueId);
      for (const child of children) {
        await this.issuesRepository.create({
          id: uuidv4(),
          projectId: sourceIssue.projectId,
          typeId: child.type?.id || sourceIssue.type_id,
          statusId: child.status?.id || sourceIssue.status_id,
          priorityId: child.priority?.id || sourceIssue.priority_id,
          title: `[Clone] ${child.title}`,
          description: null,
          reporterId: userId,
          assigneeId: child.assignee?.id || null,
          parentId: clonedIssue.id,
          storyPoints: child.storyPoints ?? null,
          originalEstimateHours: child.originalEstimateHours ?? null,
          remainingEstimateHours: child.remainingEstimateHours ?? null,
        });
      }
    }

    if (options?.includeAttachments) {
      const attachments = await prisma.attachment.findMany({
        where: { issueId },
      });
      for (const attachment of attachments) {
        await prisma.attachment.create({
          data: {
            id: uuidv4(),
            issueId: clonedIssue.id,
            uploadedBy: userId,
            filename: attachment.filename,
            originalFilename: attachment.originalFilename,
            mimeType: attachment.mimeType,
            fileSize: attachment.fileSize,
            storagePath: attachment.storagePath,
            thumbnailPath: attachment.thumbnailPath,
            metadata: attachment.metadata || {},
          } as any,
        });
      }
    }

    // Record history
    await this.issueHistoryRepository.create({
      issueId: clonedIssue.id,
      userId,
      fieldName: 'issue',
      newValue: `cloned from ${issueId}`,
      changeType: 'create',
    });

    return this.getIssueById(clonedIssue.id, userId);
  }

  async exportIssues(
    projectId: string,
    userId: string,
    format: 'csv' | 'xlsx' | 'pdf',
    filters: IssueFilters
  ) {
    await this.checkProjectAccess(projectId, userId);

    const issues = await this.issuesRepository.findByProject(projectId, {
      ...filters,
      page: 1,
      limit: 1000,
    });

    const rows = issues.map((issue: any) => ({
      issueKey: issue.issueKey || '',
      title: issue.title || '',
      status: issue.status?.displayName || issue.status?.name || '',
      priority: issue.priority?.displayName || issue.priority?.name || '',
      assignee: issue.assignee?.displayName || '',
      dueDate: issue.dueDate ? new Date(issue.dueDate).toISOString().slice(0, 10) : '',
      storyPoints: issue.storyPoints ?? '',
      updatedAt: issue.updatedAt ? new Date(issue.updatedAt).toISOString() : '',
    }));

    if (format === 'pdf') {
      const buffer = await pdfService.generatePdf(
        {
          title: 'Issue Export',
          subtitle: `Project: ${projectId}`,
        },
        [
          {
            title: 'Issues',
            content: {
              type: 'table',
              columns: [
                { header: 'Issue', key: 'issueKey', width: 70 },
                { header: 'Title', key: 'title', width: 180 },
                { header: 'Status', key: 'status', width: 80 },
                { header: 'Priority', key: 'priority', width: 70 },
                { header: 'Assignee', key: 'assignee', width: 100 },
              ],
              data: rows,
            },
          },
        ]
      );
      return {
        contentType: 'application/pdf',
        fileName: `issues-${projectId}.pdf`,
        payload: buffer,
      };
    }

    const header = 'Issue Key,Title,Status,Priority,Assignee,Due Date,Story Points,Updated At';
    const csvBody = rows
      .map((row) =>
        [
          row.issueKey,
          row.title,
          row.status,
          row.priority,
          row.assignee,
          row.dueDate,
          row.storyPoints,
          row.updatedAt,
        ]
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const csv = `${header}\n${csvBody}`;

    if (format === 'xlsx') {
      // Lightweight fallback payload for XLSX downloads without introducing a heavy dependency.
      return {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: `issues-${projectId}.xlsx`,
        payload: csv,
      };
    }

    return {
      contentType: 'text/csv',
      fileName: `issues-${projectId}.csv`,
      payload: csv,
    };
  }

  // Voting methods
  async addVote(issueId: string, userId: string) {
    const issue = await this.issuesRepository.findById(issueId);
    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);
    await this.issuesRepository.addVote(issueId, userId);

    const voteCount = await this.issuesRepository.getVoteCount(issueId);
    const hasVoted = true;

    return { voteCount, hasVoted };
  }

  async removeVote(issueId: string, userId: string) {
    const issue = await this.issuesRepository.findById(issueId);
    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);
    await this.issuesRepository.removeVote(issueId, userId);

    const voteCount = await this.issuesRepository.getVoteCount(issueId);
    const hasVoted = false;

    return { voteCount, hasVoted };
  }

  async getVoters(issueId: string, userId: string) {
    const issue = await this.issuesRepository.findById(issueId);
    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);

    const voters = await this.issuesRepository.getVoters(issueId);
    const voteCount = await this.issuesRepository.getVoteCount(issueId);
    const hasVoted = await this.issuesRepository.hasUserVoted(issueId, userId);

    return { voters, voteCount, hasVoted };
  }

  async getVotedIssues(userId: string, page: number = 1, limit: number = 50) {
    const { issues, total } = await this.issuesRepository.getVotedByUser(userId, page, limit);

    return {
      issues,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Watcher methods
  async addWatcher(issueId: string, userId: string, targetUserId?: string) {
    const issue = await this.issuesRepository.findById(issueId);
    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);

    // If targetUserId is provided, check if the user has permission to add others as watchers
    const watcherId = targetUserId || userId;
    if (targetUserId && targetUserId !== userId) {
      await this.checkProjectAccess(issue.projectId, userId, ['admin', 'lead']);
    }

    await this.issuesRepository.addWatcher(issueId, watcherId);

    const watcherCount = await this.issuesRepository.getWatcherCount(issueId);
    const isWatching = await this.issuesRepository.isWatching(issueId, userId);

    return { watcherCount, isWatching };
  }

  async removeWatcher(issueId: string, userId: string, targetUserId?: string) {
    const issue = await this.issuesRepository.findById(issueId);
    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);

    // If targetUserId is provided, check if the user has permission to remove others as watchers
    const watcherId = targetUserId || userId;
    if (targetUserId && targetUserId !== userId) {
      await this.checkProjectAccess(issue.projectId, userId, ['admin', 'lead']);
    }

    await this.issuesRepository.removeWatcher(issueId, watcherId);

    const watcherCount = await this.issuesRepository.getWatcherCount(issueId);
    const isWatching = await this.issuesRepository.isWatching(issueId, userId);

    return { watcherCount, isWatching };
  }

  async getWatchers(issueId: string, userId: string) {
    const issue = await this.issuesRepository.findById(issueId);
    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    await this.checkProjectAccess(issue.projectId, userId);

    const watchers = await this.issuesRepository.getWatchersDetailed(issueId);
    const watcherCount = await this.issuesRepository.getWatcherCount(issueId);
    const isWatching = await this.issuesRepository.isWatching(issueId, userId);

    return { watchers, watcherCount, isWatching };
  }

  async getWatchedIssues(userId: string, page: number = 1, limit: number = 50) {
    const { issues, total } = await this.issuesRepository.getWatchedByUser(userId, page, limit);

    return {
      issues,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── Workflow Transitions ───────────────────────────────────────────────

  /**
   * Return all transitions available from the issue's current status,
   * along with whether the requesting user can perform each one.
   */
  async getAvailableTransitions(issueId: string, userId: string) {
    const issue = await this.issuesRepository.findById(issueId);
    if (!issue) throw ApiError.notFound('Issue not found');

    await this.checkProjectAccess(issue.projectId, userId);

    if (!issue.status_id) return [];

    const workflow = await workflowSchemesService.getEffectiveWorkflow(
      issue.projectId,
      issue.type_id
    );
    if (!workflow) return [];

    // Target statuses reachable from the current status
    const targetStatuses = await workflowsService.getAvailableTransitions(issue.status_id);

    const sysAdmin = await isSystemAdmin(userId);

    const [projectMember, userRecord] = await Promise.all([
      prisma.projectMember.findFirst({
        where: { projectId: issue.projectId, userId },
        select: { role: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: { select: { name: true } } },
      }),
    ]);

    const results = await Promise.all(
      targetStatuses.map(async (toStatus) => {
        const transition = await workflowsRepository.findTransitionByFromTo(
          issue.status_id!,
          toStatus.id
        );
        if (!transition) return null;

        if (sysAdmin) {
          return {
            transitionId: transition.id,
            name: transition.name ?? `→ ${toStatus.displayName}`,
            toStatus: {
              id: toStatus.id,
              name: toStatus.name,
              displayName: toStatus.displayName,
              color: toStatus.color,
              category: toStatus.category,
            },
            canPerform: true,
            errors: [],
            warnings: [],
          };
        }

        const evaluation = await transitionConditionsService.evaluateTransition(
          transition.id,
          { ...issue, id: issueId },
          { id: userId, roles: [userRecord?.role?.name ?? ''], permissions: [] },
          { projectRole: projectMember?.role ?? undefined }
        );

        return {
          transitionId: transition.id,
          name: transition.name ?? `→ ${toStatus.displayName}`,
          toStatus: {
            id: toStatus.id,
            name: toStatus.name,
            displayName: toStatus.displayName,
            color: toStatus.color,
            category: toStatus.category,
          },
          canPerform: evaluation.canTransition,
          errors: evaluation.errors,
          warnings: evaluation.warnings,
        };
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  }

  /**
   * Perform a specific workflow transition on an issue.
   */
  async performTransition(
    issueId: string,
    transitionId: string,
    userId: string,
    comment?: string
  ) {
    const transition = await prisma.statusTransition.findUnique({
      where: { id: transitionId },
      select: { toStatusId: true, name: true },
    });

    if (!transition) throw ApiError.notFound('Transition not found');

    // Delegate to updateIssue — all enforcement is wired there
    const updatedIssue = await this.updateIssue(issueId, { statusId: transition.toStatusId }, userId);

    if (comment) {
      await commentsService.createComment({
        issueId,
        authorId: userId,
        content: comment,
      });
    }

    return updatedIssue;
  }
}
