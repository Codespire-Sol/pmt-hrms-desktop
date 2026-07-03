import { prisma } from '../../database/prisma';
import { Issue, UpdateIssueInput, IssueFilters } from './issues.types';
import { Prisma } from '@prisma/client';

// Helper to build the common issue list select with relations
const issueListInclude = {
  project: { select: { id: true, key: true, name: true } },
  type: { select: { id: true, name: true, icon: true, color: true, isSubtask: true } },
  status: { select: { id: true, name: true, displayName: true, color: true, category: true } },
  priority: { select: { id: true, name: true, displayName: true, icon: true, color: true } },
  assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

function mapAssignee(assignee: any) {
  if (!assignee) return null;
  return {
    id: assignee.id,
    displayName: `${assignee.firstName} ${assignee.lastName}`,
    avatarUrl: assignee.avatarUrl,
  };
}

function mapUser(user: any, extraFields?: Record<string, any>) {
  if (!user) return null;
  return {
    id: user.id,
    displayName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    avatarUrl: user.avatarUrl,
    ...extraFields,
  };
}

function mapIssueListItem(issue: any) {
  return {
    id: issue.id,
    issueKey: issue.project ? `${issue.project.key}-${issue.issueNumber}` : null,
    parentId: issue.parentId ?? null,
    title: issue.title,
    storyPoints: issue.storyPoints,
    dueDate: issue.dueDate,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    type: issue.type,
    status: issue.status,
    priority: issue.priority,
    assignee: mapAssignee(issue.assignee),
  };
}

export class IssuesRepository {
  private buildBacklogWhere(projectId: string, filters: any): Prisma.IssueWhereInput {
    const where: Prisma.IssueWhereInput = {
      projectId,
      sprintId: null,
      deletedAt: null,
    };

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.statusId) {
      where.statusId = filters.statusId;
    }
    if (filters.priorityId) {
      where.priorityId = filters.priorityId;
    }
    if (filters.typeId) {
      where.typeId = filters.typeId;
    }
    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }
    if (filters.epicId) {
      where.epicId = filters.epicId;
    }
    if (filters.minStoryPoints !== undefined || filters.maxStoryPoints !== undefined) {
      where.storyPoints = {
        gte: filters.minStoryPoints !== undefined ? Number(filters.minStoryPoints) : undefined,
        lte: filters.maxStoryPoints !== undefined ? Number(filters.maxStoryPoints) : undefined,
      };
    }

    return where;
  }

  async create(input: any): Promise<Issue> {
    const issue = await prisma.$transaction(async (tx) => {
      let issueNumber = input.issueNumber;
      if (issueNumber === undefined || issueNumber === null) {
        const maxResult = await tx.issue.aggregate({
          where: { projectId: input.projectId },
          _max: { issueNumber: true },
        });
        issueNumber = (maxResult._max.issueNumber || 0) + 1;
      }

      return tx.issue.create({
        data: {
          id: input.id,
          projectId: input.projectId,
          issueNumber,
          typeId: input.typeId,
          statusId: input.statusId,
          priorityId: input.priorityId,
          title: input.title,
          description: input.description,
          descriptionHtml: input.descriptionHtml,
          reporterId: input.reporterId,
          assigneeId: input.assigneeId,
          parentId: input.parentId,
          storyPoints: input.storyPoints,
          originalEstimateHours: input.originalEstimateHours,
          remainingEstimateHours: input.remainingEstimateHours,
          dueDate: input.dueDate,
          startDate: input.startDate,
          sprintId: input.sprintId || null,
          epicId: input.epicId || null,
        } as any,
        include: {
          project: { select: { key: true } },
        },
      });
    });

    return { ...issue, issueKey: `${(issue as any).project.key}-${issue.issueNumber}` } as any;
  }

  async findById(id: string): Promise<any | null> {
    const issue = await prisma.issue.findFirst({
      where: { id, deletedAt: null },
      include: {
        project: { select: { id: true, key: true, name: true } },
        type: { select: { id: true, name: true, displayName: true, icon: true, color: true } },
        status: { select: { id: true, name: true, displayName: true, color: true, category: true } },
        priority: { select: { id: true, name: true, displayName: true, icon: true, color: true } },
        reporter: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        issueLabels: { include: { label: { select: { id: true, name: true, color: true } } } },
      },
    });

    if (!issue) return null;

    // Resolve version names to version objects
    let fixVersionObj = null;
    let affectedVersionObj = null;
    if ((issue as any).fixVersion) {
      const ver = await prisma.version.findFirst({
        where: { name: (issue as any).fixVersion, projectId: issue.projectId },
        select: { id: true, name: true },
      });
      fixVersionObj = ver || { id: (issue as any).fixVersion, name: (issue as any).fixVersion };
    }
    if ((issue as any).affectedVersion) {
      const ver = await prisma.version.findFirst({
        where: { name: (issue as any).affectedVersion, projectId: issue.projectId },
        select: { id: true, name: true },
      });
      affectedVersionObj = ver || { id: (issue as any).affectedVersion, name: (issue as any).affectedVersion };
    }

    return {
      ...issue,
      issueKey: issue.project ? `${issue.project.key}-${issue.issueNumber}` : null,
      project: issue.project,
      type: issue.type,
      status: issue.status,
      priority: issue.priority,
      reporter: mapUser(issue.reporter),
      assignee: mapUser(issue.assignee),
      labels: (issue as any).issueLabels?.map((il: any) => il.label) ?? [],
      fixVersion: fixVersionObj,
      affectedVersion: affectedVersionObj,
    };
  }

  async findByProject(projectId: string, filters: IssueFilters): Promise<any[]> {
    const { statusId, assigneeId, priorityId, typeId, search, page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
    const offset = (page - 1) * limit;

    const where: Prisma.IssueWhereInput = {
      projectId,
      deletedAt: null,
    };

    if (statusId) where.statusId = statusId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (priorityId) where.priorityId = priorityId;
    if (typeId) where.typeId = typeId;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    // Map incoming sortBy (may be snake_case from API) to Prisma field names
    const sortMap: Record<string, string> = {
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      due_date: 'dueDate',
      title: 'title',
      priority: 'priorityId',
      status: 'statusId',
      assignee: 'assigneeId',
    };

    const sortColumn = sortMap[sortBy as string] || (sortBy as string);
    const issues = await prisma.issue.findMany({
      where,
      include: issueListInclude,
      orderBy: { [sortColumn]: sortOrder },
      take: limit,
      skip: offset,
    });

    return issues.map(mapIssueListItem);
  }

  async countByProject(projectId: string, filters: IssueFilters): Promise<number> {
    const { statusId, assigneeId, priorityId, typeId, search } = filters;

    const where: Prisma.IssueWhereInput = {
      projectId,
      deletedAt: null,
    };

    if (statusId) where.statusId = statusId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (priorityId) where.priorityId = priorityId;
    if (typeId) where.typeId = typeId;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    return prisma.issue.count({ where });
  }

  async update(id: string, input: UpdateIssueInput): Promise<Issue> {
    const updateData: Prisma.IssueUpdateInput = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.descriptionHtml !== undefined) updateData.descriptionHtml = input.descriptionHtml;
    if (input.typeId !== undefined) updateData.type = { connect: { id: input.typeId } };
    if (input.statusId !== undefined) updateData.status = { connect: { id: input.statusId } };
    if (input.priorityId !== undefined) updateData.priority = { connect: { id: input.priorityId } };
    if (input.reporterId !== undefined) {
      updateData.reporter = { connect: { id: input.reporterId } };
    }
    if (input.assigneeId !== undefined) {
      updateData.assignee = input.assigneeId ? { connect: { id: input.assigneeId } } : { disconnect: true };
    }
    if (input.storyPoints !== undefined) updateData.storyPoints = input.storyPoints;
    if (input.remainingEstimateHours !== undefined) updateData.remainingEstimateHours = input.remainingEstimateHours;
    if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
    if (input.startDate !== undefined) updateData.startDate = input.startDate;
    if (input.resolution !== undefined) updateData.resolution = input.resolution;
    if (input.resolutionDate !== undefined) updateData.resolutionDate = input.resolutionDate;
    if (input.environment !== undefined) updateData.environment = input.environment;
    if (input.sprintId !== undefined) {
      updateData.sprint = input.sprintId ? { connect: { id: input.sprintId } } : { disconnect: true };
    }
    if (input.epicId !== undefined) {
      updateData.epic = input.epicId ? { connect: { id: input.epicId } } : { disconnect: true };
    }
    // Look up version names from IDs for proper string-based linking
    if (input.affectedVersionId !== undefined) {
      if (input.affectedVersionId) {
        const ver = await prisma.version.findUnique({ where: { id: input.affectedVersionId }, select: { name: true } });
        updateData.affectedVersion = ver?.name ?? null;
      } else {
        updateData.affectedVersion = null;
      }
    }
    if (input.fixVersionId !== undefined) {
      if (input.fixVersionId) {
        const ver = await prisma.version.findUnique({ where: { id: input.fixVersionId }, select: { name: true } });
        updateData.fixVersion = ver?.name ?? null;
      } else {
        updateData.fixVersion = null;
      }
    }

    const issue = await prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({ where: { id }, data: updateData });

      if (input.labels !== undefined) {
        await tx.issueLabel.deleteMany({ where: { issueId: id } });
        if (input.labels.length > 0) {
          await tx.issueLabel.createMany({
            data: input.labels.map((labelId) => ({ issueId: id, labelId })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });

    return issue as any;
  }

  async softDelete(id: string): Promise<void> {
    await prisma.issue.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getDefaultStatus(projectId: string): Promise<any> {
    // 1) Prefer the project's own workflow initial status
    const projectStatus = await prisma.status.findFirst({
      where: {
        isInitial: true,
        workflow: {
          projectId,
        },
      },
    });
    
    if (projectStatus) {
      return projectStatus;
    }

    // 2) Fallback to the global default workflow (for legacy projects without a workflow)
    const defaultWorkflowStatus = await prisma.status.findFirst({
      where: {
        isInitial: true,
        workflow: {
          isDefault: true,
        },
      },
      orderBy: {
        position: 'asc',
      },
    });

    if (defaultWorkflowStatus) {
      return defaultWorkflowStatus;
    }

    // 3) Last resort: any initial status for the project (if workflow exists but no initial)
    const fallbackStatus = await prisma.status.findFirst({
      where: {
        isInitial: true,
        workflow: {
          projectId,
        },
      },
      orderBy: {
        position: 'asc',
      },
    });
    
    if (!fallbackStatus) {
      // 4) Final fallback: any status for the project workflow
      const anyStatus = await prisma.status.findFirst({
        where: {
          workflow: {
            projectId,
          },
        },
        orderBy: {
          position: 'asc',
        },
      });
      return anyStatus;
    }

    return fallbackStatus;
  }

  async getDefaultStatusByWorkflow(workflowId: string): Promise<any> {
    const initial = await prisma.status.findFirst({
      where: {
        workflowId,
        isInitial: true,
      },
      orderBy: {
        position: 'asc',
      },
    });

    if (initial) {
      return initial;
    }

    return prisma.status.findFirst({
      where: {
        workflowId,
      },
      orderBy: {
        position: 'asc',
      },
    });
  }

  async findDefaultSubtaskType(projectId: string): Promise<{ id: string } | null> {
    return prisma.issueType.findFirst({
      where: { projectId, isSubtask: true },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
  }

  async addLabels(issueId: string, labelIds: string[], userId: string): Promise<void> {
    const records = labelIds.map(labelId => ({
      issueId,
      labelId,
      addedBy: userId,
    }));

    for (const record of records) {
      try {
        await prisma.issueLabel.create({ data: record });
      } catch (e: any) {
        // Ignore unique constraint violation (P2002)
        if (e.code !== 'P2002') throw e;
      }
    }
  }

  async addWatcher(issueId: string, userId: string): Promise<void> {
    try {
      await prisma.issueWatcher.create({
        data: { issueId, userId },
      });
    } catch (e: any) {
      if (e.code !== 'P2002') throw e;
    }
  }

  async addLink(input: any): Promise<any> {
    if (!input.linkTypeId) {
      throw new Error('Link type is required');
    }

    const link = await prisma.issueLink.create({
      data: {
        sourceIssue: { connect: { id: input.sourceIssueId } },
        targetIssue: { connect: { id: input.targetIssueId } },
        linkType: { connect: { id: input.linkTypeId } },
        creator: { connect: { id: input.createdBy } },
      },
    });
    return link;
  }

  async getLinkTypes(): Promise<any[]> {
    return prisma.linkType.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async getLinkTypeByName(name: string): Promise<any | null> {
    return prisma.linkType.findFirst({
      where: {
        OR: [
          { name },
          { inward: name },
          { outward: name },
        ],
      },
    });
  }

  async getLinkTypeById(id: string): Promise<any | null> {
    return prisma.linkType.findUnique({ where: { id } });
  }

  async findLinkTypeConflict(values: string[], excludeId?: string): Promise<any | null> {
    const cleaned = values.map((v) => v.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      return null;
    }

    const conditions = cleaned.flatMap((value) => [
      { name: value },
      { inward: value },
      { outward: value },
    ]);

    return prisma.linkType.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        OR: conditions,
      },
    });
  }

  async createLinkType(input: { name: string; inward: string; outward: string; description?: string | null }): Promise<any> {
    return prisma.linkType.create({
      data: {
        name: input.name,
        inward: input.inward,
        outward: input.outward,
        description: input.description ?? null,
      },
    });
  }

  async updateLinkType(id: string, input: { name?: string; inward?: string; outward?: string; description?: string | null }): Promise<any> {
    return prisma.linkType.update({
      where: { id },
      data: {
        name: input.name,
        inward: input.inward,
        outward: input.outward,
        description: input.description === undefined ? undefined : input.description,
      },
    });
  }

  async deleteLinkType(id: string): Promise<void> {
    await prisma.linkType.delete({ where: { id } });
  }

  async countLinksByType(linkTypeId: string): Promise<number> {
    return prisma.issueLink.count({ where: { linkTypeId } });
  }

  async findChildren(issueId: string): Promise<any[]> {
    const children = await prisma.issue.findMany({
      where: { parentId: issueId, deletedAt: null },
      select: {
        id: true,
        issueNumber: true,
        title: true,
        statusId: true,
        project: { select: { key: true } },
      },
    });

    return children.map(child => ({
      id: child.id,
      issueKey: child.project ? `${child.project.key}-${child.issueNumber}` : null,
      title: child.title,
      statusId: child.statusId,
    }));
  }

  async findChildrenWithDetails(issueId: string): Promise<any[]> {
    const children = await prisma.issue.findMany({
      where: { parentId: issueId, deletedAt: null },
      include: {
        project: { select: { key: true } },
        type: { select: { id: true, name: true, icon: true, color: true } },
        status: { select: { id: true, name: true, displayName: true, color: true, category: true } },
        priority: { select: { id: true, name: true, icon: true, color: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return children.map(child => ({
      id: child.id,
      issueKey: child.project ? `${child.project.key}-${child.issueNumber}` : null,
      title: child.title,
      storyPoints: child.storyPoints,
      timeSpentHours: child.timeSpentHours,
      originalEstimateHours: child.originalEstimateHours,
      remainingEstimateHours: child.remainingEstimateHours,
      type: child.type,
      status: child.status,
      priority: child.priority,
      assignee: mapAssignee(child.assignee),
    }));
  }

  async getSubtaskProgress(issueId: string): Promise<{
    totalSubtasks: number;
    completedSubtasks: number;
    inProgressSubtasks: number;
    todoSubtasks: number;
    totalStoryPoints: number;
    completedStoryPoints: number;
    totalTimeSpent: number;
    totalOriginalEstimate: number;
    totalRemainingEstimate: number;
    progressPercentage: number;
  }> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(i.id)::int AS "totalSubtasks",
        SUM(CASE WHEN s.category = 'done' THEN 1 ELSE 0 END)::int AS "completedSubtasks",
        SUM(CASE WHEN s.category = 'in_progress' THEN 1 ELSE 0 END)::int AS "inProgressSubtasks",
        SUM(CASE WHEN s.category = 'todo' THEN 1 ELSE 0 END)::int AS "todoSubtasks",
        COALESCE(SUM(i.story_points), 0)::int AS "totalStoryPoints",
        COALESCE(SUM(CASE WHEN s.category = 'done' THEN i.story_points ELSE 0 END), 0)::int AS "completedStoryPoints",
        COALESCE(SUM(i.time_spent_hours), 0)::float AS "totalTimeSpent",
        COALESCE(SUM(i.original_estimate_hours), 0)::float AS "totalOriginalEstimate",
        COALESCE(SUM(i.remaining_estimate_hours), 0)::float AS "totalRemainingEstimate"
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.parent_id = ${issueId}
        AND i.deleted_at IS NULL
    `;

    const r = result[0] || {};
    const totalSubtasks = r.totalSubtasks || 0;
    const completedSubtasks = r.completedSubtasks || 0;
    const progressPercentage = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    return {
      totalSubtasks,
      completedSubtasks,
      inProgressSubtasks: r.inProgressSubtasks || 0,
      todoSubtasks: r.todoSubtasks || 0,
      totalStoryPoints: r.totalStoryPoints || 0,
      completedStoryPoints: r.completedStoryPoints || 0,
      totalTimeSpent: r.totalTimeSpent || 0,
      totalOriginalEstimate: r.totalOriginalEstimate || 0,
      totalRemainingEstimate: r.totalRemainingEstimate || 0,
      progressPercentage,
    };
  }

  async findLinks(issueId: string): Promise<any[]> {
    return prisma.issueLink.findMany({
      where: {
        OR: [
          { sourceIssueId: issueId },
          { targetIssueId: issueId },
        ],
      },
    });
  }

  async findLinksWithDetails(issueId: string): Promise<any[]> {
    const links = await prisma.$queryRaw<any[]>`
      SELECT
        il.id,
        il.source_issue_id AS "sourceIssueId",
        il.target_issue_id AS "targetIssueId",
        il.link_type_id AS "linkTypeId",
        il.created_at AS "createdAt",
        json_build_object(
          'id', lt.id,
          'name', lt.name,
          'outward', lt.outward,
          'inward', lt.inward
        ) AS "linkTypeInfo",
        json_build_object(
          'id', si.id,
          'issueKey', sp.key || '-' || si.issue_number,
          'title', si.title,
          'status', json_build_object('id', ss.id, 'name', ss.name, 'displayName', ss.display_name, 'color', ss.color, 'category', ss.category),
          'type', json_build_object('id', st.id, 'name', st.name, 'icon', st.icon, 'color', st.color),
          'priority', json_build_object('id', spr.id, 'name', spr.name, 'icon', spr.icon, 'color', spr.color)
        ) AS "sourceIssue",
        json_build_object(
          'id', ti.id,
          'issueKey', tp.key || '-' || ti.issue_number,
          'title', ti.title,
          'status', json_build_object('id', ts.id, 'name', ts.name, 'displayName', ts.display_name, 'color', ts.color, 'category', ts.category),
          'type', json_build_object('id', tt.id, 'name', tt.name, 'icon', tt.icon, 'color', tt.color),
          'priority', json_build_object('id', tpr.id, 'name', tpr.name, 'icon', tpr.icon, 'color', tpr.color)
        ) AS "targetIssue"
      FROM issue_links il
      LEFT JOIN link_types lt ON il.link_type_id = lt.id
      LEFT JOIN issues si ON il.source_issue_id = si.id
      LEFT JOIN projects sp ON si.project_id = sp.id
      LEFT JOIN statuses ss ON si.status_id = ss.id
      LEFT JOIN issue_types st ON si.type_id = st.id
      LEFT JOIN issue_priorities spr ON si.priority_id = spr.id
      LEFT JOIN issues ti ON il.target_issue_id = ti.id
      LEFT JOIN projects tp ON ti.project_id = tp.id
      LEFT JOIN statuses ts ON ti.status_id = ts.id
      LEFT JOIN issue_types tt ON ti.type_id = tt.id
      LEFT JOIN issue_priorities tpr ON ti.priority_id = tpr.id
      WHERE il.source_issue_id = ${issueId}
         OR il.target_issue_id = ${issueId}
    `;

    return links.map((link) => {
      const isOutward = link.sourceIssueId === issueId;
      return {
        id: link.id,
        direction: isOutward ? 'outward' : 'inward',
        linkType: link.linkTypeInfo,
        linkDescription: isOutward
          ? link.linkTypeInfo?.outward || link.linkTypeInfo?.name
          : link.linkTypeInfo?.inward || link.linkTypeInfo?.name,
        linkedIssue: isOutward ? link.targetIssue : link.sourceIssue,
        createdAt: link.createdAt,
      };
    });
  }

  async deleteLink(linkId: string): Promise<boolean> {
    try {
      await prisma.issueLink.delete({ where: { id: linkId } });
      return true;
    } catch {
      return false;
    }
  }

  async findLinkById(linkId: string): Promise<any | null> {
    return prisma.issueLink.findUnique({ where: { id: linkId } });
  }

  async findWatchers(issueId: string): Promise<any[]> {
    const watchers = await prisma.issueWatcher.findMany({
      where: { issueId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return watchers.map(w => ({
      id: w.user.id,
      displayName: `${w.user.firstName} ${w.user.lastName}`,
    }));
  }

  // Sprint-related methods
  async findBySprint(sprintId: string): Promise<any[]> {
    const issues = await prisma.issue.findMany({
      where: { sprintId, deletedAt: null },
      include: {
        ...issueListInclude,
        epic: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return issues.map(issue => ({
      id: issue.id,
      issueKey: issue.project ? `${issue.project.key}-${issue.issueNumber}` : null,
      title: issue.title,
      storyPoints: issue.storyPoints,
      dueDate: issue.dueDate,
      sprintId: issue.sprintId,
      epicId: (issue as any).epicId ?? null,
      epic: (issue as any).epic ?? null,
      type: issue.type,
      status: issue.status,
      priority: issue.priority,
      assignee: mapAssignee(issue.assignee),
    }));
  }

  async findBacklog(projectId: string, filters: any): Promise<any[]> {
    const { page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;
    const sortBy = filters.sortBy || 'position';
    const sortOrder: 'asc' | 'desc' = filters.sortOrder === 'desc' ? 'desc' : 'asc';

    const sortMap: Record<string, string> = {
      position: 'position',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      due_date: 'dueDate',
      story_points: 'storyPoints',
      title: 'title',
    };

    const orderColumn = sortMap[sortBy] || 'position';
    const where = this.buildBacklogWhere(projectId, filters);

    const issues = await prisma.issue.findMany({
      where,
      include: {
        project: { select: { key: true } },
        type: { select: { id: true, name: true, icon: true, color: true } },
        status: { select: { id: true, name: true, displayName: true, color: true, category: true } },
        priority: { select: { id: true, name: true, displayName: true, icon: true, color: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { [orderColumn]: sortOrder },
      take: limit,
      skip: offset,
    });

    return issues.map(issue => ({
      id: issue.id,
      issueKey: issue.project ? `${issue.project.key}-${issue.issueNumber}` : null,
      title: issue.title,
      storyPoints: issue.storyPoints,
      position: issue.position,
      epicId: (issue as any).epicId ?? null,
      parentId: (issue as any).parentId ?? null,
      type: issue.type,
      status: issue.status,
      priority: issue.priority,
      assignee: mapAssignee(issue.assignee),
    }));
  }

  async countBacklog(projectId: string, filters: any): Promise<number> {
    return prisma.issue.count({ where: this.buildBacklogWhere(projectId, filters) });
  }

  async sumBacklogStoryPoints(projectId: string, filters: any = {}): Promise<number> {
    const result = await prisma.issue.aggregate({
      _sum: { storyPoints: true },
      where: this.buildBacklogWhere(projectId, filters),
    });
    return result._sum.storyPoints || 0;
  }

  async assignToSprint(issueIds: string[], sprintId: string): Promise<void> {
    await prisma.issue.updateMany({
      where: { id: { in: issueIds } },
      data: { sprintId },
    });
  }

  async removeFromSprint(issueId: string): Promise<void> {
    await prisma.issue.update({
      where: { id: issueId },
      data: { sprintId: null },
    });
  }

  async moveToSprint(issueIds: string[], sprintId: string): Promise<void> {
    await prisma.issue.updateMany({
      where: { id: { in: issueIds } },
      data: { sprintId },
    });
  }

  async moveToBacklog(issueIds: string[]): Promise<void> {
    await prisma.issue.updateMany({
      where: { id: { in: issueIds } },
      data: { sprintId: null },
    });
  }

  async findIncompleteInSprint(sprintId: string): Promise<any[]> {
    return prisma.issue.findMany({
      where: {
        sprintId,
        deletedAt: null,
        status: {
          category: { not: 'done' },
        },
      },
      select: { id: true, sprintId: true },
    });
  }

  async countInSprint(sprintId: string): Promise<number> {
    return prisma.issue.count({
      where: {
        sprintId,
        deletedAt: null,
      },
    });
  }

  async countCompletedInSprint(sprintId: string): Promise<number> {
    return prisma.issue.count({
      where: {
        sprintId,
        deletedAt: null,
        status: { category: 'done' },
      },
    });
  }

  async countByStatusInSprint(sprintId: string): Promise<{ total: number; completed: number; inProgress: number; todo: number }> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT s.category, COUNT(i.id)::int AS count
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.sprint_id = ${sprintId}
        AND i.deleted_at IS NULL
      GROUP BY s.category
    `;

    const counts = { total: 0, completed: 0, inProgress: 0, todo: 0 };
    for (const row of result) {
      const count = row.count || 0;
      counts.total += count;
      if (row.category === 'done') counts.completed = count;
      else if (row.category === 'in_progress') counts.inProgress = count;
      else if (row.category === 'todo') counts.todo = count;
    }
    return counts;
  }

  async sumStoryPointsInSprint(sprintId: string): Promise<number> {
    const result = await prisma.issue.aggregate({
      _sum: { storyPoints: true },
      where: {
        sprintId,
        deletedAt: null,
      },
    });
    return result._sum.storyPoints || 0;
  }

  async sumCompletedStoryPointsInSprint(sprintId: string): Promise<number> {
    const result = await prisma.issue.aggregate({
      _sum: { storyPoints: true },
      where: {
        sprintId,
        deletedAt: null,
        status: { category: 'done' },
      },
    });
    return result._sum.storyPoints || 0;
  }

  async sumEstimateHoursInSprint(sprintId: string): Promise<number> {
    const result = await prisma.issue.aggregate({
      _sum: { originalEstimateHours: true },
      where: {
        sprintId,
        deletedAt: null,
      },
    });
    return Number(result._sum.originalEstimateHours) || 0;
  }

  async sumRemainingEstimateHoursInSprint(sprintId: string): Promise<number> {
    const result = await prisma.issue.aggregate({
      _sum: { remainingEstimateHours: true },
      where: {
        sprintId,
        deletedAt: null,
      },
    });
    return Number(result._sum.remainingEstimateHours) || 0;
  }

  async sumLoggedHoursInSprint(sprintId: string): Promise<number> {
    const result = await prisma.timeLog.aggregate({
      _sum: { hours: true },
      where: {
        issue: { sprintId },
      },
    });
    return Number(result._sum.hours) || 0;
  }

  // Bulk operations
  async bulkUpdate(
    issueIds: string[],
    update: {
      statusId?: string;
      priorityId?: string;
      assigneeId?: string | null;
      sprintId?: string | null;
      labels?: string[];
    }
  ): Promise<number> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (update.statusId !== undefined) updateData.statusId = update.statusId;
    if (update.priorityId !== undefined) updateData.priorityId = update.priorityId;
    if (update.assigneeId !== undefined) updateData.assigneeId = update.assigneeId;
    if (update.sprintId !== undefined) updateData.sprintId = update.sprintId;

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.issue.updateMany({
        where: { id: { in: issueIds } },
        data: updateData as any,
      });

      // Handle labels separately if provided
      if (update.labels && update.labels.length > 0) {
        // Remove existing labels
        await tx.issueLabel.deleteMany({
          where: { issueId: { in: issueIds } },
        });

        // Add new labels
        const labelRecords = issueIds.flatMap((issueId) =>
          update.labels!.map(labelId => ({
            issueId,
            labelId,
          }))
        );

        if (labelRecords.length > 0) {
          await tx.issueLabel.createMany({
            data: labelRecords,
            skipDuplicates: true,
          });
        }
      }

      return updateResult.count;
    });

    return result;
  }

  async bulkSoftDelete(issueIds: string[]): Promise<number> {
    const result = await prisma.issue.updateMany({
      where: { id: { in: issueIds } },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }

  async bulkMove(issueIds: string[], targetProjectId: string, statusId: string): Promise<number> {
    const result = await prisma.issue.updateMany({
      where: { id: { in: issueIds } },
      data: {
        projectId: targetProjectId,
        statusId,
        sprintId: null,
        updatedAt: new Date(),
      },
    });
    return result.count;
  }

  async bulkTransition(
    issueIds: string[],
    toStatusId: string,
    resolution?: string | null
  ): Promise<number> {
    const result = await prisma.issue.updateMany({
      where: { id: { in: issueIds }, deletedAt: null },
      data: {
        statusId: toStatusId,
        resolution: resolution === undefined ? undefined : resolution,
        resolutionDate: resolution ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });
    return result.count;
  }

  async getIssueLabels(issueId: string): Promise<any[]> {
    return prisma.issueLabel.findMany({
      where: { issueId },
      select: { labelId: true },
    });
  }

  // Voting methods
  async addVote(issueId: string, userId: string): Promise<void> {
    try {
      await prisma.issueVote.create({
        data: { issueId, userId },
      });
    } catch (e: any) {
      if (e.code !== 'P2002') throw e;
    }
  }

  async removeVote(issueId: string, userId: string): Promise<void> {
    await prisma.issueVote.deleteMany({
      where: { issueId, userId },
    });
  }

  async hasUserVoted(issueId: string, userId: string): Promise<boolean> {
    const vote = await prisma.issueVote.findFirst({
      where: { issueId, userId },
    });
    return !!vote;
  }

  async getVoteCount(issueId: string): Promise<number> {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { voteCount: true },
    });
    return issue?.voteCount || 0;
  }

  async getVoters(issueId: string): Promise<any[]> {
    const votes = await prisma.issueVote.findMany({
      where: { issueId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return votes.map(v => ({
      id: v.user.id,
      displayName: `${v.user.firstName} ${v.user.lastName}`,
      email: v.user.email,
      avatarUrl: v.user.avatarUrl,
      votedAt: v.createdAt,
    }));
  }

  // Enhanced watcher methods
  async removeWatcher(issueId: string, userId: string): Promise<void> {
    await prisma.issueWatcher.deleteMany({
      where: { issueId, userId },
    });
  }

  async isWatching(issueId: string, userId: string): Promise<boolean> {
    const watcher = await prisma.issueWatcher.findFirst({
      where: { issueId, userId },
    });
    return !!watcher;
  }

  async getWatcherCount(issueId: string): Promise<number> {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { watcherCount: true },
    });
    return issue?.watcherCount || 0;
  }

  async getWatchersDetailed(issueId: string): Promise<any[]> {
    const watchers = await prisma.issueWatcher.findMany({
      where: { issueId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return watchers.map(w => ({
      id: w.user.id,
      displayName: `${w.user.firstName} ${w.user.lastName}`,
      email: w.user.email,
      avatarUrl: w.user.avatarUrl,
      watchingSince: w.createdAt,
    }));
  }

  // Get issues voted by a user
  async getVotedByUser(userId: string, page: number = 1, limit: number = 50): Promise<{ issues: any[]; total: number }> {
    const offset = (page - 1) * limit;

    const votes = await prisma.issueVote.findMany({
      where: {
        userId,
        issue: { deletedAt: null },
      },
      include: {
        issue: {
          include: {
            project: { select: { key: true } },
            type: { select: { id: true, name: true, icon: true, color: true } },
            status: { select: { id: true, name: true, displayName: true, color: true } },
            priority: { select: { id: true, name: true, icon: true, color: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const issues = votes.map(v => ({
      id: v.issue.id,
      issueKey: v.issue.project ? `${v.issue.project.key}-${v.issue.issueNumber}` : null,
      title: v.issue.title,
      voteCount: v.issue.voteCount,
      watcherCount: v.issue.watcherCount,
      createdAt: v.issue.createdAt,
      type: v.issue.type,
      status: v.issue.status,
      priority: v.issue.priority,
      votedAt: v.createdAt,
    }));

    const total = await prisma.issueVote.count({
      where: {
        userId,
        issue: { deletedAt: null },
      },
    });

    return { issues, total };
  }

  // Get issues watched by a user
  async getWatchedByUser(userId: string, page: number = 1, limit: number = 50): Promise<{ issues: any[]; total: number }> {
    const offset = (page - 1) * limit;

    const watchers = await prisma.issueWatcher.findMany({
      where: {
        userId,
        issue: { deletedAt: null },
      },
      include: {
        issue: {
          include: {
            project: { select: { key: true } },
            type: { select: { id: true, name: true, icon: true, color: true } },
            status: { select: { id: true, name: true, displayName: true, color: true } },
            priority: { select: { id: true, name: true, icon: true, color: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const issues = watchers.map(w => ({
      id: w.issue.id,
      issueKey: w.issue.project ? `${w.issue.project.key}-${w.issue.issueNumber}` : null,
      title: w.issue.title,
      voteCount: w.issue.voteCount,
      watcherCount: w.issue.watcherCount,
      createdAt: w.issue.createdAt,
      type: w.issue.type,
      status: w.issue.status,
      priority: w.issue.priority,
      watchingSince: w.createdAt,
    }));

    const total = await prisma.issueWatcher.count({
      where: {
        userId,
        issue: { deletedAt: null },
      },
    });

    return { issues, total };
  }
}
