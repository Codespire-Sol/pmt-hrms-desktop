import { v4 as uuidv4 } from 'uuid';
import { ProjectsRepository } from './projects.repository';
import { ProjectMembersRepository } from './projectMembers.repository';
import { ApiError } from '../../utils/ApiError';
import {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectFilters,
  AddMemberInput,
  UpdateMemberRoleInput,
  Project,
  ProjectOverviewComment,
  ProjectOverviewLink,
  ProjectOverviewSummary,
} from './projects.types';
import { workflowsService } from '../workflows/workflows.service';
import { prisma } from '../../database/prisma';
import type { Prisma } from '@prisma/client';
import { webhooksService } from '../webhooks/webhooks.service';
import { usersService } from '../users/users.service';
import { logger } from '../../utils/logger';
import { isSystemAdmin } from '../../utils/system-admin';
import { notificationsService } from '../notifications/notifications.service';

export class ProjectsService {
  private projectsRepository: ProjectsRepository;
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.projectsRepository = new ProjectsRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  async createProject(input: CreateProjectInput, userId: string) {
    // Validate project key format
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(input.key)) {
      throw ApiError.badRequest('Project key must start with a letter and contain only uppercase letters and numbers (2-10 characters)');
    }

    // Validate project key uniqueness
    const existingProject = await this.projectsRepository.findByKey(input.key);
    if (existingProject) {
      throw ApiError.conflict('Project key already exists');
    }

    // Validate project lead (default to requesting user if not provided)
    const leadId = input.leadId ?? userId;
    const lead = await usersService.getUserById(leadId);
    if (!lead) {
      throw ApiError.badRequest('Invalid project lead');
    }
    if (!lead.isActive) {
      throw ApiError.badRequest('Project lead must be an active user');
    }

    // Validate project type/category (optional)
    let projectTypeName: string | undefined;
    if (input.categoryId) {
      const projectType = await prisma.projectCategory.findFirst({
        where: {
          id: input.categoryId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      });
      if (!projectType) {
        throw ApiError.badRequest('Invalid project type');
      }
      projectTypeName = projectType.name;
    }

    // Create project
    const project = await this.projectsRepository.create({
      id: uuidv4(),
      ...input,
      leadId,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : undefined,
      category: projectTypeName,
      ownerId: userId,
      status: 'active',
    });

    // Add owner as admin member
    await this.projectMembersRepository.create({
      projectId: project.id,
      userId,
      role: 'admin',
      invitedBy: userId,
    });

    // Ensure selected lead has project access
    await this.ensureLeadMembership(project.id, leadId, userId);

    // Create default workflow with statuses
    await this.createDefaultWorkflow(project.id);

    // Seed default issue types
    await this.createDefaultIssueTypes(project.id);

    return this.getProjectById(project.id, userId);
  }

  /**
   * Create a default workflow with basic statuses for a new project,
   * then create a Board with BoardColumn records linking to those statuses.
   */
  private async createDefaultWorkflow(projectId: string) {
    try {
      await this.createDefaultWorkflowRecords(projectId);
      await this.createDefaultBoard(projectId);
    } catch (error) {
      // Log error but don't fail project creation
      console.error('Failed to create default workflow/board:', error);
    }
  }

  /**
   * Create a Board and BoardColumn records for the project.
   * Links each board column to the corresponding status in the project's workflow.
   */
  private async createDefaultBoard(projectId: string) {
    // Check if a board already exists
    const existingBoard = await prisma.board.findFirst({ where: { projectId } });
    if (existingBoard) return;

    // Get the project's workflow and its statuses
    const workflow = await prisma.workflow.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    if (!workflow) return;

    const statuses = await prisma.status.findMany({
      where: { workflowId: workflow.id },
      orderBy: { position: 'asc' },
    });
    if (statuses.length === 0) return;

    await prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          projectId,
          name: 'Main Board',
          type: 'kanban',
          config: {},
        },
      });

      for (const status of statuses) {
        await tx.boardColumn.create({
          data: {
            boardId: board.id,
            statusId: status.id,
            name: status.name,
            position: status.position,
            wipLimit: status.wipLimit,
          },
        });
      }
    });
  }

  /**
   * Ensure project has a workflow (create default if missing) and a board.
   */
  async ensureProjectWorkflow(projectId: string): Promise<void> {
    // Check if project already has a workflow
    const existingWorkflow = await prisma.workflow.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    if (!existingWorkflow) {
      // No workflow found, create default one
      await this.createDefaultWorkflowRecords(projectId);
      // Also create the board
      await this.createDefaultBoard(projectId);
      return;
    }

    const statuses = await prisma.status.findMany({
      where: { workflowId: existingWorkflow.id },
      orderBy: { position: 'asc' },
    });

    if (statuses.length === 0) {
      await this.createDefaultStatuses(existingWorkflow.id);
    } else {
      // Ensure there is exactly one initial status
      const initialStatuses = statuses.filter((s) => s.isInitial);
      if (initialStatuses.length === 0) {
        await prisma.status.updateMany({
          where: { workflowId: existingWorkflow.id },
          data: { isInitial: false },
        });
        await prisma.status.update({
          where: { id: statuses[0].id },
          data: { isInitial: true },
        });
      } else if (initialStatuses.length > 1) {
        const keepId = initialStatuses[0].id;
        await prisma.status.updateMany({
          where: { workflowId: existingWorkflow.id, id: { not: keepId } },
          data: { isInitial: false },
        });
      }
    }

    // Ensure board exists
    await this.createDefaultBoard(projectId);
  }

  private async createDefaultWorkflowRecords(projectId: string): Promise<void> {
    // Use the full Software Development template (13-state workflow) as the default
    await workflowsService.createFromTemplate(
      'software_development',
      'Default Workflow',
      'Default project workflow with full software development lifecycle',
      projectId
    );
  }

  private async createDefaultIssueTypes(projectId: string): Promise<void> {
    const existing = await prisma.issueType.count({ where: { projectId } });
    if (existing > 0) return;

    const defaultTypes = [
      { name: 'epic',        displayName: 'Epic',        icon: 'Layers',       color: '#6554C0', isSubtask: false, position: 0 },
      { name: 'task',        displayName: 'Task',        icon: 'CheckCircle2', color: '#0052CC', isSubtask: false, position: 1 },
      { name: 'bug',         displayName: 'Bug',         icon: 'Bug',          color: '#DE350B', isSubtask: false, position: 2 },
      { name: 'story',       displayName: 'Story',       icon: 'Tag',          color: '#36B37E', isSubtask: false, position: 3 },
      { name: 'improvement', displayName: 'Improvement', icon: 'Zap',          color: '#FF8B00', isSubtask: false, position: 4 },
      { name: 'subtask',     displayName: 'Subtask',     icon: 'CheckCircle2', color: '#6554C0', isSubtask: true,  position: 5 },
    ];

    for (const type of defaultTypes) {
      await prisma.issueType.create({
        data: { id: uuidv4(), projectId, ...type },
      });
    }
  }

  private async createDefaultStatuses(
    workflowId: string,
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<void> {
    // Fallback: used when a workflow exists but has 0 statuses
    // Creates a minimal 4-status workflow matching the default layout
    const defaultStatuses = [
      {
        name: 'todo',
        displayName: 'To Do',
        description: 'Work to be done',
        color: '#0052CC',
        category: 'todo' as const,
        position: 0,
        isInitial: true,
        isFinal: false,
      },
      {
        name: 'in_progress',
        displayName: 'In Progress',
        description: 'Work currently being done',
        color: '#FFAB00',
        category: 'in_progress' as const,
        position: 1,
        isInitial: false,
        isFinal: false,
      },
      {
        name: 'in_review',
        displayName: 'In Review',
        description: 'Work under review',
        color: '#6554C0',
        category: 'in_review' as const,
        position: 2,
        isInitial: false,
        isFinal: false,
      },
      {
        name: 'done',
        displayName: 'Done',
        description: 'Completed work',
        color: '#36B37E',
        category: 'done' as const,
        position: 3,
        isInitial: false,
        isFinal: true,
      },
    ];

    const createdStatuses = [];
    for (const statusData of defaultStatuses) {
      const status = await tx.status.create({
        data: {
          id: uuidv4(),
          workflowId,
          ...statusData,
        },
      });
      createdStatuses.push(status);
    }

    const transitions = [
      { from: 0, to: 1, name: 'Start Work' },          // To Do -> In Progress
      { from: 1, to: 2, name: 'Submit for Review' },   // In Progress -> In Review
      { from: 2, to: 3, name: 'Approve' },             // In Review -> Done
      { from: 2, to: 1, name: 'Request Changes' },     // In Review -> In Progress (back)
      { from: 1, to: 0, name: 'Reopen' },              // In Progress -> To Do (back)
      { from: 3, to: 0, name: 'Reopen' },              // Done -> To Do (back)
    ];

    for (const t of transitions) {
      await tx.statusTransition.create({
        data: {
          id: uuidv4(),
          workflowId,
          fromStatusId: createdStatuses[t.from].id,
          toStatusId: createdStatuses[t.to].id,
          name: t.name,
        },
      });
    }
  }

  /**
   * Fix existing projects that don't have workflows
   * This should be called once to migrate existing projects
   */
  async migrateExistingProjects(): Promise<{ fixed: number; errors: string[] }> {
    // Get all projects using Prisma directly
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        key: true,
      },
    });
    
    const errors: string[] = [];
    let fixed = 0;

    for (const project of projects) {
      try {
        await this.ensureProjectWorkflow(project.id);
        fixed++;
        console.log(`Fixed workflow for project: ${project.name} (${project.key})`);
      } catch (error) {
        const errorMsg = `Failed to fix workflow for project ${project.name}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return { fixed, errors };
  }

  async getProjects(userId: string, filters: ProjectFilters) {
    // Check if user is system admin
    const isAdmin = await isSystemAdmin(userId);

    const [projects, total] = await Promise.all([
      this.projectsRepository.findByUser(userId, filters, isAdmin),
      this.projectsRepository.countByUser(userId, filters, isAdmin),
    ]);

    const projectIds = projects.map((p: any) => p.id);
    const teamMembers = await this.projectsRepository.getUniqueMemberCount(projectIds);

    const totalIssues = projects.reduce((sum: number, p: any) => sum + (p.statistics?.totalIssues || 0), 0);
    const healthyProjects = projects.filter((p: any) => {
      const stats = p.statistics;
      return stats && stats.totalIssues > 0 && stats.completedIssues / stats.totalIssues >= 0.8;
    }).length;

    return {
      projects,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total,
        totalPages: Math.ceil(total / (filters.limit || 20)),
      },
      summary: {
        totalProjects: total,
        totalIssues,
        teamMembers,
        healthyProjects,
      },
    };
  }

  async getProjectById(projectId: string, userId: string) {
    const project = await this.projectsRepository.findById(projectId);

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    // Check access
    const isAdmin = await isSystemAdmin(userId);
    if (!isAdmin) {
      const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);
      const isDesignatedLead = project.leadId === userId;
      if (!membership && !isDesignatedLead && project.visibility === 'private') {
        throw ApiError.forbidden('Access denied');
      }
    }

    const statistics = await this.projectsRepository.getStatistics(projectId);
    const overviewSummary = await this.buildOverviewSummary(project);
    const settingsWithOverview = this.applyOverviewToSettings(project.settings, overviewSummary);

    return {
      ...project,
      settings: settingsWithOverview,
      statistics,
      overviewSummary,
    };
  }

  async updateProject(projectId: string, input: UpdateProjectInput, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);

    if (input.leadId) {
      const lead = await usersService.getUserById(input.leadId);
      if (!lead) {
        throw ApiError.badRequest('Invalid project lead');
      }
      if (!lead.isActive) {
        throw ApiError.badRequest('Project lead must be an active user');
      }
    }

    const {
      overviewComments,
      overviewLinks,
      ...projectInput
    } = input as UpdateProjectInput;

    const updateInput: UpdateProjectInput = {
      ...projectInput,
      ...(projectInput.startDate && { startDate: new Date(projectInput.startDate) }),
      ...(projectInput.targetEndDate && { targetEndDate: new Date(projectInput.targetEndDate) }),
      ...(projectInput.actualEndDate && { actualEndDate: new Date(projectInput.actualEndDate) }),
    };

    if (overviewComments !== undefined || overviewLinks !== undefined) {
      const existingProject = await this.projectsRepository.findById(projectId);
      if (!existingProject) {
        throw ApiError.notFound('Project not found');
      }

      const currentSettings = this.normalizeSettings(existingProject.settings);
      const currentOverview = this.extractOverviewSummary(existingProject);

      const currentUser = await usersService.getUserById(userId);
      const currentAuthorName = currentUser?.displayName || null;

      const normalizedComments = overviewComments !== undefined
        ? this.normalizeOverviewComments(
            overviewComments,
            currentOverview.comments,
            userId,
            currentAuthorName
          )
        : this.commentsToStorage(currentOverview.comments);

      const normalizedLinks = overviewLinks !== undefined
        ? this.normalizeOverviewLinks(overviewLinks)
        : currentOverview.links;

      updateInput.settings = {
        ...currentSettings,
        overview: {
          comments: normalizedComments,
          links: normalizedLinks,
        },
      };
    }

    const project = await this.projectsRepository.update(projectId, updateInput);

    if (input.leadId) {
      await this.ensureLeadMembership(project.id, input.leadId, userId);
    }

    const updatedProject = await this.getProjectById(project.id, userId);

    try {
      const actor = await usersService.getUserById(userId);
      const actorInfo = actor
        ? { id: actor.id, displayName: actor.displayName, email: actor.email }
        : undefined;
      await webhooksService.triggerWebhook(projectId, 'project.updated', updatedProject, actorInfo);
    } catch (error) {
      logger.warn('Failed to trigger project.updated webhook', { error });
    }

    return updatedProject;
  }

  async archiveProject(projectId: string, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin']);

    await this.projectsRepository.update(projectId, {
      status: 'archived',
    });

    return { message: 'Project archived successfully' };
  }

  async deleteProject(projectId: string, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin']);

    await this.projectsRepository.softDelete(projectId);

    return { message: 'Project deleted successfully' };
  }

  async hardDeleteProject(projectId: string) {
    await this.projectsRepository.hardDelete(projectId);
    return { message: 'Project permanently deleted from database' };
  }

  async purgeAllProjects() {
    await prisma.$transaction(async (tx) => {
      // Delete global issue priorities and issue types (not project-scoped)
      await tx.$executeRawUnsafe(`DELETE FROM issue_priorities`);
      // Delete all projects — CASCADE handles: project_members, issue_types (per-project),
      // labels, issues → (comments, attachments, time_logs, issue_history, issue_labels,
      // issue_links, issue_watchers, issue_votes, issue_embeddings, active_timers,
      // activity_logs, issue_custom_field_values, issue_components), sprints,
      // components, custom_fields, pages, forms
      await tx.$executeRawUnsafe(`DELETE FROM projects`);
    });
    return { message: 'All projects, issues, priorities and issue types permanently deleted' };
  }

  // Project Members
  async getProjectMembers(projectId: string, userId: string) {
    await this.checkProjectAccess(projectId, userId);

    const members = await this.projectMembersRepository.findByProject(projectId);

    return { members };
  }

  async addProjectMember(projectId: string, input: AddMemberInput, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);

    // Check if user is already a member
    const existingMember = await this.projectMembersRepository.findByProjectAndUser(projectId, input.userId);
    if (existingMember) {
      throw ApiError.conflict('User is already a member of this project');
    }

    const member = await this.projectMembersRepository.create({
      projectId,
      userId: input.userId,
      role: input.role,
      invitedBy: userId,
    });

    try {
      const [actor, project] = await Promise.all([
        usersService.getUserById(userId),
        this.projectsRepository.findById(projectId),
      ]);
      const actorName = actor?.displayName || 'Someone';

      await notificationsService.notify(
        {
          type: 'project_member_added',
          recipientIds: [input.userId],
          actorId: userId,
          projectId,
          metadata: {
            projectName: project?.name,
          },
        },
        actorName
      );
    } catch (error) {
      logger.warn('Failed to create project member notification', { error });
    }

    try {
      const actor = await usersService.getUserById(userId);
      const actorInfo = actor
        ? { id: actor.id, displayName: actor.displayName, email: actor.email }
        : undefined;
      await webhooksService.triggerWebhook(projectId, 'project.member_added', member, actorInfo);
    } catch (error) {
      logger.warn('Failed to trigger project.member_added webhook', { error });
    }

    return member;
  }

  async updateMemberRole(projectId: string, memberId: string, input: UpdateMemberRoleInput, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin']);

    const member = await this.projectMembersRepository.updateRole(memberId, input.role);

    return member;
  }

  async removeProjectMember(projectId: string, memberId: string, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin']);

    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
      select: { id: true, userId: true, role: true, projectId: true, invitedBy: true, joinedAt: true },
    });

    await this.projectMembersRepository.delete(memberId);

    try {
      const actor = await usersService.getUserById(userId);
      const actorInfo = actor
        ? { id: actor.id, displayName: actor.displayName, email: actor.email }
        : undefined;
      await webhooksService.triggerWebhook(
        projectId,
        'project.member_removed',
        member || { id: memberId },
        actorInfo
      );
    } catch (error) {
      logger.warn('Failed to trigger project.member_removed webhook', { error });
    }

    return { message: 'Member removed from project' };
  }

  private async checkProjectAccess(projectId: string, userId: string, requiredRoles?: string[]) {
    if (await isSystemAdmin(userId)) {
      return;
    }

    const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);

    if (!membership) {
      const project = await this.projectsRepository.findById(projectId);
      const isDesignatedLead = project?.leadId === userId;

      if (isDesignatedLead && (!requiredRoles || requiredRoles.includes('lead'))) {
        return;
      }

      throw ApiError.forbidden('Access denied');
    }

    if (requiredRoles && !requiredRoles.includes(membership.role)) {
      if (requiredRoles.includes('lead')) {
        const project = await this.projectsRepository.findById(projectId);
        if (project?.leadId === userId) {
          return;
        }
      }
      throw ApiError.forbidden('Insufficient permissions');
    }
  }

  private async ensureLeadMembership(projectId: string, leadId: string, invitedBy: string): Promise<void> {
    const existingLeadMembership = await this.projectMembersRepository.findByProjectAndUser(projectId, leadId);

    if (!existingLeadMembership) {
      await this.projectMembersRepository.create({
        projectId,
        userId: leadId,
        role: 'lead',
        invitedBy,
      });
      return;
    }

    if (existingLeadMembership.role === 'viewer' || existingLeadMembership.role === 'member') {
      await this.projectMembersRepository.updateRole(existingLeadMembership.id, 'lead');
    }
  }

  private async buildOverviewSummary(project: Project): Promise<ProjectOverviewSummary> {
    const summary = this.extractOverviewSummary(project);

    if (summary.comments.length === 0) {
      return summary;
    }

    const authorIds = Array.from(
      new Set(
        summary.comments
          .map((comment) => comment.authorId)
          .filter((authorId) => authorId.length > 0)
      )
    );

    if (authorIds.length === 0) {
      return summary;
    }

    const users = await prisma.user.findMany({
      where: {
        id: {
          in: authorIds,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const userMap = new Map(
      users.map((user) => {
        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        return [user.id, displayName || null] as const;
      })
    );

    return {
      ...summary,
      comments: summary.comments.map((comment) => ({
        ...comment,
        authorName: userMap.get(comment.authorId) ?? comment.authorName ?? null,
      })),
    };
  }

  private normalizeSettings(settings: unknown): Record<string, any> {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return {};
    }
    return settings as Record<string, any>;
  }

  private applyOverviewToSettings(
    settings: unknown,
    overviewSummary: ProjectOverviewSummary
  ): Record<string, any> {
    const normalizedSettings = this.normalizeSettings(settings);
    const overview = normalizedSettings.overview && typeof normalizedSettings.overview === 'object' && !Array.isArray(normalizedSettings.overview)
      ? normalizedSettings.overview
      : {};

    return {
      ...normalizedSettings,
      overview: {
        ...overview,
        comments: this.commentsToStorage(overviewSummary.comments),
        links: overviewSummary.links,
      },
    };
  }

  private extractOverviewSummary(project: Project): ProjectOverviewSummary {
    const settings = this.normalizeSettings(project.settings);
    const overview = settings.overview && typeof settings.overview === 'object' && !Array.isArray(settings.overview)
      ? settings.overview
      : {};

    const commentsRaw = Array.isArray(overview.comments) ? overview.comments : [];
    const linksRaw = Array.isArray(overview.links) ? overview.links : [];

    const comments: ProjectOverviewComment[] = commentsRaw
      .map((comment: any) => {
        const createdAt = comment?.createdAt ? new Date(comment.createdAt) : new Date();
        const updatedAt = comment?.updatedAt ? new Date(comment.updatedAt) : createdAt;
        return {
          id: String(comment?.id || uuidv4()),
          content: String(comment?.content || '').trim(),
          authorId: String(comment?.authorId || ''),
          authorName: comment?.authorName ? String(comment.authorName) : null,
          createdAt,
          updatedAt,
        };
      })
      .filter((comment) => comment.content.length > 0)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const links: ProjectOverviewLink[] = linksRaw
      .map((link: any) => ({
        id: String(link?.id || uuidv4()),
        title: String(link?.title || '').trim(),
        url: String(link?.url || '').trim(),
        description: link?.description ? String(link.description) : null,
      }))
      .filter((link) => link.title.length > 0 && link.url.length > 0);

    return {
      comments,
      links,
    };
  }

  private normalizeOverviewLinks(
    links: Array<{ id?: string; title: string; url: string; description?: string | null }>
  ): Array<{ id: string; title: string; url: string; description: string | null }> {
    return links
      .map((link) => ({
        id: link.id || uuidv4(),
        title: link.title.trim(),
        url: link.url.trim(),
        description: link.description?.trim() || null,
      }))
      .filter((link) => link.title.length > 0 && link.url.length > 0);
  }

  private normalizeOverviewComments(
    comments: Array<{ id?: string; content: string }>,
    existingComments: ProjectOverviewComment[],
    userId: string,
    currentAuthorName: string | null = null
  ): Array<{
    id: string;
    content: string;
    authorId: string;
    authorName: string | null;
    createdAt: string;
    updatedAt: string;
  }> {
    const existingById = new Map(existingComments.map((comment) => [comment.id, comment]));

    return comments
      .map((comment) => {
        const existing = comment.id ? existingById.get(comment.id) : undefined;
        const now = new Date();
        return {
          id: existing?.id || comment.id || uuidv4(),
          content: comment.content.trim(),
          authorId: existing?.authorId || userId,
          authorName: existing?.authorName || currentAuthorName || null,
          createdAt: (existing?.createdAt || now).toISOString(),
          updatedAt: now.toISOString(),
        };
      })
      .filter((comment) => comment.content.length > 0);
  }

  private commentsToStorage(
    comments: ProjectOverviewComment[]
  ): Array<{
    id: string;
    content: string;
    authorId: string;
    authorName: string | null;
    createdAt: string;
    updatedAt: string;
  }> {
    return comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      authorId: comment.authorId,
      authorName: comment.authorName || null,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    }));
  }
}
