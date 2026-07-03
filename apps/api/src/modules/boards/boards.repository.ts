import { prisma } from '../../database/prisma';
import {
  SwimlaneGroupBy,
  BoardQueryParams,
  Swimlane,
  ListViewItem,
  TimelineItem,
} from './boards.types';

export class BoardsRepository {
  async getBoardData(projectId: string, params: BoardQueryParams = {}): Promise<any> {
    const { swimlane: _swimlane = 'none' } = params;

    // Get project info
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, key: true, name: true },
    });

    if (!project) {
      return null;
    }

    // Get board columns from the board_columns table (joined with statuses for metadata).
    // This avoids depending on workflow records being present.
    const projectBoard = await prisma.board.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    let statusesWithFallback: Array<{
      id: string;
      name: string;
      displayName: string;
      description: string | null;
      color: string;
      category: string;
      position: number;
      isInitial: boolean;
      isFinal: boolean;
      wipLimit: number | null;
    }>;

    if (projectBoard) {
      // Read columns from the board_columns table, pulling display metadata from the linked status
      const boardColumns = await prisma.boardColumn.findMany({
        where: { boardId: projectBoard.id },
        select: {
          id: true,
          name: true,
          position: true,
          wipLimit: true,
          status: {
            select: {
              id: true,
              name: true,
              displayName: true,
              description: true,
              color: true,
              category: true,
              isInitial: true,
              isFinal: true,
              wipLimit: true,
            },
          },
        },
        orderBy: { position: 'asc' },
      });

      statusesWithFallback = boardColumns.map((bc) => ({
        id: bc.status.id,
        name: bc.status.name,
        displayName: bc.status.displayName,
        description: bc.status.description,
        color: bc.status.color,
        category: bc.status.category,
        position: bc.position,
        isInitial: bc.status.isInitial,
        isFinal: bc.status.isFinal,
        wipLimit: bc.wipLimit ?? bc.status.wipLimit,
      }));
    } else {
      // No board record — fall back to workflow statuses for backward compatibility
      const projectWorkflow = await prisma.workflow.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (projectWorkflow) {
        statusesWithFallback = await prisma.status.findMany({
          where: { workflowId: projectWorkflow.id },
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            color: true,
            category: true,
            position: true,
            isInitial: true,
            isFinal: true,
            wipLimit: true,
          },
          orderBy: { position: 'asc' },
        }) as typeof statusesWithFallback;
      } else {
        statusesWithFallback = [];
      }
    }

    // Build where clause with filters
    const where: any = {
      projectId,
      deletedAt: null,
    };

    // Apply assignee filter if provided
    if (params.assigneeIds && params.assigneeIds.length > 0) {
      where.assigneeId = { in: params.assigneeIds };
    }
    if (params.sprintId) {
      where.sprintId = params.sprintId;
    } else {
      // Show issues from the active sprint AND backlog (no sprint assigned)
      where.OR = [
        { sprint: { status: 'active' } },
        { sprintId: null },
      ];
    }

    // Get all issues for the project grouped by status
    const issuesRaw = await prisma.issue.findMany({
      where,
      select: {
        id: true,
        issueNumber: true,
        title: true,
        storyPoints: true,
        position: true,
        dueDate: true,
        statusId: true,
        assigneeId: true,
        sprintId: true,
        epicId: true,
        project: { select: { key: true } },
        type: {
          select: { id: true, name: true, displayName: true, icon: true, color: true },
        },
        priority: {
          select: { id: true, name: true, displayName: true, icon: true, color: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        sprint: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { position: 'asc' },
    });

    // Transform issues to expected shape
    const issues = issuesRaw.map((i) => ({
      id: i.id,
      issueNumber: i.issueNumber,
      title: i.title,
      storyPoints: i.storyPoints,
      position: i.position,
      dueDate: i.dueDate,
      statusId: i.statusId,
      assigneeId: i.assigneeId,
      sprintId: i.sprintId,
      epicId: i.epicId,
      issueKey: `${i.project.key}-${i.issueNumber}`,
      type: i.type
        ? { id: i.type.id, name: i.type.name, displayName: i.type.displayName, icon: i.type.icon, color: i.type.color }
        : null,
      priority: i.priority
        ? { id: i.priority.id, name: i.priority.name, displayName: i.priority.displayName, icon: i.priority.icon, color: i.priority.color }
        : null,
      assignee: i.assignee
        ? { id: i.assignee.id, displayName: `${i.assignee.firstName} ${i.assignee.lastName}`, avatarUrl: i.assignee.avatarUrl }
        : null,
      sprint: i.sprint
        ? { id: i.sprint.id, name: i.sprint.name, status: i.sprint.status }
        : null,
    }));

    // Get labels for all issues
    const issueIds = issues.map((i) => i.id);
    const issueLabels = issueIds.length > 0
      ? await prisma.issueLabel.findMany({
          where: { issueId: { in: issueIds } },
          select: {
            issueId: true,
            label: { select: { id: true, name: true, color: true } },
          },
        })
      : [];

    // Map labels to issues
    const issuesWithLabels = issues.map((issue) => ({
      ...issue,
      labels: issueLabels
        .filter((il) => il.issueId === issue.id)
        .map((il) => il.label),
    }));

    // Build board columns — dynamic category columns.
    // Each column aggregates ALL issues from ALL statuses belonging to that category.
    // The 'backlog' status (pre-sprint holding area) is excluded entirely.
    // Well-known categories have predefined labels/colors; custom ones use defaults.
    const WELL_KNOWN_LABELS: Record<string, string> = {
      todo: 'To Do',
      in_progress: 'In Progress',
      dev_done: 'Dev Done',
      testing: 'Testing',
      in_review: 'In Review',
      done: 'Completed',
    };
    const WELL_KNOWN_COLORS: Record<string, string> = {
      todo: '#64748b',
      in_progress: '#3b82f6',
      dev_done: '#8b5cf6',
      testing: '#f59e0b',
      in_review: '#7c3aed',
      done: '#10b981',
    };
    // Well-known categories appear first in this order; custom ones follow alphabetically
    const WELL_KNOWN_ORDER = ['todo', 'in_progress', 'dev_done', 'testing', 'in_review', 'done'];

    const statusesByCategory = new Map<string, typeof statusesWithFallback>();
    for (const status of statusesWithFallback) {
      const EXCLUDED_FROM_BOARD = ['backlog', 'on_hold', 'hold', 'rejected'];
      if (!status.category || EXCLUDED_FROM_BOARD.includes(status.name) || status.category === 'unassigned') continue;
      if (!statusesByCategory.has(status.category)) {
        statusesByCategory.set(status.category, []);
      }
      statusesByCategory.get(status.category)!.push(status);
    }

    // Build ordered list of categories: well-known first, then custom alphabetically
    const allCategories = Array.from(statusesByCategory.keys());
    const sortedCategories = [
      ...WELL_KNOWN_ORDER.filter((c) => allCategories.includes(c)),
      ...allCategories.filter((c) => !WELL_KNOWN_ORDER.includes(c)).sort(),
    ];

    const columns = sortedCategories.map((category, idx) => {
      const catStatuses = statusesByCategory.get(category) ?? [];
      const statusIds = new Set(catStatuses.map((s) => s.id));
      const catIssues = issuesWithLabels.filter((i) => statusIds.has(i.statusId));
      const representative = catStatuses[0];
      const displayName = WELL_KNOWN_LABELS[category]
        ?? category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        id: representative?.id ?? category,
        name: category,
        displayName,
        color: WELL_KNOWN_COLORS[category] ?? representative?.color ?? '#6b7280',
        category,
        position: idx,
        wipLimit: null,
        isFinal: catStatuses.some((s) => s.isFinal),
        isInitial: catStatuses.some((s) => s.isInitial),
        statuses: catStatuses,
        issues: catIssues,
      };
    });

    // Get filter data
    const membersRaw = await prisma.projectMember.findMany({
      where: { projectId },
      select: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
    const assignees = membersRaw
      .map((m) => ({
        id: m.user.id,
        displayName: `${m.user.firstName} ${m.user.lastName}`,
        avatarUrl: m.user.avatarUrl,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const types = await prisma.issueType.findMany({
      where: { projectId },
      select: { id: true, name: true, displayName: true, icon: true, color: true },
      orderBy: { position: 'asc' },
    });

    const priorities = await prisma.issuePriority.findMany({
      select: { id: true, name: true, displayName: true, icon: true, color: true },
      orderBy: { level: 'desc' },
    });

    const labels = await prisma.label.findMany({
      where: {projectId},
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });

    // Include active sprint info in the board response
    const activeSprintRaw = await prisma.sprint.findFirst({
      where: { projectId, status: 'active' },
      select: {
        id: true,
        name: true,
        goal: true,
        status: true,
        startDate: true,
        endDate: true,
        _count: { select: { issues: true } },
      },
    });

    // Build a map of statusId → category for quick lookup
    const statusCategoryMap = new Map<string, string>();
    for (const status of statusesWithFallback) {
      statusCategoryMap.set(status.id, status.category);
    }

    const activeSprint = activeSprintRaw
      ? {
          id: activeSprintRaw.id,
          name: activeSprintRaw.name,
          goal: activeSprintRaw.goal,
          status: activeSprintRaw.status,
          startDate: activeSprintRaw.startDate,
          endDate: activeSprintRaw.endDate,
          totalIssues: activeSprintRaw._count.issues,
          completedIssues: issuesWithLabels.filter((i) => statusCategoryMap.get(i.statusId) === 'done').length,
        }
      : null;

    return {
      project,
      activeSprint,
      columns,
      filters: {
        assignees,
        types,
        priorities,
        labels,
      },
    };
  }

  async updateStatusWipLimit(statusId: string, wipLimit: number | null): Promise<any> {
    return prisma.status.update({
      where: { id: statusId },
      data: { wipLimit },
    });
  }

  async getStatusWipInfo(statusId: string, projectId: string): Promise<{ wipLimit: number | null; currentCount: number }> {
    const status = await prisma.status.findUnique({
      where: { id: statusId },
      select: { wipLimit: true },
    });

    const currentCount = await prisma.issue.count({
      where: {
        statusId,
        projectId,
        deletedAt: null,
      },
    });

    return {
      wipLimit: status?.wipLimit || null,
      currentCount,
    };
  }

  async checkWipLimitExceeded(statusId: string, projectId: string): Promise<boolean> {
    const { wipLimit, currentCount } = await this.getStatusWipInfo(statusId, projectId);
    return wipLimit !== null && currentCount >= wipLimit;
  }

  // Get board data with swimlane grouping
  async getBoardDataWithSwimlanes(
    projectId: string,
    swimlaneGroupBy: SwimlaneGroupBy,
    filters: BoardQueryParams = {}
  ): Promise<any> {
    const baseData = await this.getBoardData(projectId, filters);
    if (!baseData) return null;

    if (swimlaneGroupBy === 'none') {
      return { ...baseData, swimlaneGroupBy: 'none' };
    }

    // Get all issues flat
    const allIssues: any[] = [];
    for (const col of baseData.columns) {
      allIssues.push(...col.issues);
    }

    // Group issues by swimlane
    const swimlanes = await this.groupBySwimlane(projectId, allIssues, swimlaneGroupBy, baseData.columns);

    return {
      ...baseData,
      swimlaneGroupBy,
      swimlanes,
      columns: undefined, // Remove flat columns when using swimlanes
    };
  }

  private async groupBySwimlane(
    projectId: string,
    issues: any[],
    groupBy: SwimlaneGroupBy,
    columns: any[]
  ): Promise<Swimlane[]> {
    const swimlanes: Swimlane[] = [];

    switch (groupBy) {
      case 'assignee': {
        const membersRaw = await prisma.projectMember.findMany({
          where: { projectId },
          select: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        });
        const members = membersRaw.map((m) => ({
          id: m.user.id,
          name: `${m.user.firstName} ${m.user.lastName}`,
          avatarUrl: m.user.avatarUrl,
        }));

        // Unassigned swimlane
        const unassignedIssues = issues.filter((i) => !i.assigneeId);
        if (unassignedIssues.length > 0 || members.length === 0) {
          swimlanes.push(this.createSwimlane('unassigned', 'Unassigned', unassignedIssues, columns, { color: '#6B7280' }));
        }

        // Member swimlanes
        for (const member of members) {
          const memberIssues = issues.filter((i) => i.assigneeId === member.id);
          if (memberIssues.length > 0) {
            swimlanes.push(this.createSwimlane(member.id, member.name, memberIssues, columns, { avatarUrl: member.avatarUrl }));
          }
        }
        break;
      }

      case 'priority': {
        const priorities = await prisma.issuePriority.findMany({
          select: { id: true, name: true, displayName: true, color: true, icon: true },
          orderBy: { level: 'desc' },
        });

        // No priority swimlane
        const noPriorityIssues = issues.filter((i) => !i.priority?.id);
        if (noPriorityIssues.length > 0) {
          swimlanes.push(this.createSwimlane('none', 'No Priority', noPriorityIssues, columns, { color: '#6B7280' }));
        }

        // Priority swimlanes
        for (const priority of priorities) {
          const priorityIssues = issues.filter((i) => i.priority?.id === priority.id);
          if (priorityIssues.length > 0) {
            swimlanes.push(this.createSwimlane(priority.id, priority.displayName, priorityIssues, columns, { color: priority.color, icon: priority.icon }));
          }
        }
        break;
      }

      case 'type': {
        const typesWhere = projectId ? { OR: [{ projectId: projectId }, { projectId: null }] } : { projectId: null };
        const types = await prisma.issueType.findMany({
          where: typesWhere,
          select: { id: true, name: true, displayName: true, color: true, icon: true },
          orderBy: { position: 'asc' },
        });

        for (const type of types) {
          const typeIssues = issues.filter((i) => i.type?.id === type.id);
          if (typeIssues.length > 0) {
            swimlanes.push(this.createSwimlane(type.id, type.displayName, typeIssues, columns, { color: type.color, icon: type.icon }));
          }
        }
        break;
      }

      case 'epic': {
        // Get epics for this project
        const epicsRaw = await prisma.issue.findMany({
          where: {
            projectId,
            deletedAt: null,
            type: { name: 'Epic' },
          },
          select: {
            id: true,
            title: true,
            type: { select: { color: true } },
          },
        });
        const epics = epicsRaw.map((e) => ({
          id: e.id,
          title: e.title,
          color: e.type?.color || '#8B5CF6',
        }));

        // No epic swimlane
        const noEpicIssues = issues.filter((i) => !i.epicId);
        if (noEpicIssues.length > 0) {
          swimlanes.push(this.createSwimlane('none', 'No Epic', noEpicIssues, columns, { color: '#6B7280' }));
        }

        // Epic swimlanes
        for (const epic of epics) {
          const epicIssues = issues.filter((i) => i.epicId === epic.id);
          if (epicIssues.length > 0) {
            swimlanes.push(this.createSwimlane(epic.id, epic.title, epicIssues, columns, { color: epic.color }));
          }
        }
        break;
      }

      case 'sprint': {
        const sprints = await prisma.sprint.findMany({
          where: {
            projectId,
            status: { in: ['active', 'planned'] },
          },
          select: { id: true, name: true, status: true },
          orderBy: { startDate: 'asc' },
        });

        // Backlog (no sprint)
        const backlogIssues = issues.filter((i) => !i.sprintId);
        if (backlogIssues.length > 0) {
          swimlanes.push(this.createSwimlane('backlog', 'Backlog', backlogIssues, columns, { color: '#6B7280' }));
        }

        // Sprint swimlanes
        for (const sprint of sprints) {
          const sprintIssues = issues.filter((i) => i.sprintId === sprint.id);
          if (sprintIssues.length > 0) {
            swimlanes.push(this.createSwimlane(sprint.id, sprint.name, sprintIssues, columns, { color: sprint.status === 'active' ? '#10B981' : '#3B82F6' }));
          }
        }
        break;
      }
    }

    return swimlanes;
  }

  private createSwimlane(
    id: string,
    name: string,
    issues: any[],
    columns: any[],
    meta: { color?: string; icon?: string; avatarUrl?: string }
  ): Swimlane {
    return {
      id,
      name,
      color: meta.color,
      icon: meta.icon,
      avatarUrl: meta.avatarUrl,
      issueCount: issues.length,
      columns: columns.map((col) => ({
        ...col,
        issues: issues.filter((i) => i.statusId === col.id),
      })),
    };
  }

  // List view data
  async getListViewData(projectId: string, filters: BoardQueryParams = {}): Promise<ListViewItem[]> {
    // If search includes issue key pattern, we need raw query
    if (filters.search) {
      return this.getListViewDataWithSearch(projectId, filters);
    }

    const where: any = {
      projectId,
      deletedAt: null,
    };

    if (filters.assigneeIds?.length) {
      where.assigneeId = { in: filters.assigneeIds };
    }
    if (filters.typeIds?.length) {
      where.typeId = { in: filters.typeIds };
    }
    if (filters.priorityIds?.length) {
      where.priorityId = { in: filters.priorityIds };
    }
    if (filters.sprintId) {
      where.sprintId = filters.sprintId;
    } else {
      where.OR = [
        { sprint: { status: 'active' } },
        { sprintId: null },
      ];
    }

    const issuesRaw = await prisma.issue.findMany({
      where,
      select: {
        id: true,
        issueNumber: true,
        title: true,
        dueDate: true,
        storyPoints: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { key: true } },
        status: { select: { id: true, name: true, color: true } },
        type: { select: { id: true, name: true, icon: true, color: true } },
        priority: { select: { id: true, name: true, icon: true, color: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return issuesRaw.map((i) => ({
      id: i.id,
      issueKey: `${i.project.key}-${i.issueNumber}`,
      title: i.title,
      dueDate: i.dueDate,
      storyPoints: i.storyPoints,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      status: i.status ? { id: i.status.id, name: i.status.name, color: i.status.color } : null,
      type: i.type ? { id: i.type.id, name: i.type.name, icon: i.type.icon, color: i.type.color } : null,
      priority: i.priority ? { id: i.priority.id, name: i.priority.name, icon: i.priority.icon, color: i.priority.color } : null,
      assignee: i.assignee
        ? { id: i.assignee.id, displayName: `${i.assignee.firstName} ${i.assignee.lastName}`, avatarUrl: i.assignee.avatarUrl }
        : null,
    })) as unknown as ListViewItem[];
  }

  private async getListViewDataWithSearch(projectId: string, filters: BoardQueryParams): Promise<ListViewItem[]> {
    const conditions: string[] = ['i.project_id = $1', 'i.deleted_at IS NULL'];
    const params: any[] = [projectId];
    let paramIdx = 2;

    if (filters.assigneeIds?.length) {
      const placeholders = filters.assigneeIds.map(() => '$' + String(paramIdx++)).join(', ');
      conditions.push('i.assignee_id IN (' + placeholders + ')');
      params.push(...filters.assigneeIds);
    }
    if (filters.typeIds?.length) {
      const placeholders = filters.typeIds.map(() => '$' + String(paramIdx++)).join(', ');
      conditions.push('i.type_id IN (' + placeholders + ')');
      params.push(...filters.typeIds);
    }
    if (filters.priorityIds?.length) {
      const placeholders = filters.priorityIds.map(() => '$' + String(paramIdx++)).join(', ');
      conditions.push('i.priority_id IN (' + placeholders + ')');
      params.push(...filters.priorityIds);
    }
    if (filters.sprintId) {
      conditions.push(`i.sprint_id = $${paramIdx++}`);
      params.push(filters.sprintId);
    } else {
      conditions.push("EXISTS (SELECT 1 FROM sprints sp WHERE sp.id = i.sprint_id AND sp.status = 'active')");
    }
    if (filters.search) {
      conditions.push(`(i.title ILIKE $${paramIdx} OR p.key || '-' || i.issue_number ILIKE $${paramIdx})`);
      params.push(`%${filters.search}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT
        i.id,
        p.key || '-' || i.issue_number AS "issueKey",
        i.title,
        i.due_date AS "dueDate",
        i.story_points AS "storyPoints",
        i.created_at AS "createdAt",
        i.updated_at AS "updatedAt",
        json_build_object('id', s.id, 'name', s.name, 'color', s.color) AS status,
        json_build_object('id', t.id, 'name', t.name, 'icon', t.icon, 'color', t.color) AS type,
        json_build_object('id', pr.id, 'name', pr.name, 'icon', pr.icon, 'color', pr.color) AS priority,
        json_build_object('id', a.id, 'displayName', a.first_name || ' ' || a.last_name, 'avatarUrl', a.avatar_url) AS assignee
      FROM issues i
      JOIN projects p ON i.project_id = p.id
      LEFT JOIN statuses s ON i.status_id = s.id
      LEFT JOIN issue_types t ON i.type_id = t.id
      LEFT JOIN issue_priorities pr ON i.priority_id = pr.id
      LEFT JOIN users a ON i.assignee_id = a.id
      WHERE ${whereClause}
      ORDER BY i.updated_at DESC`,
      ...params
    );

    return rows;
  }

  // Timeline view data
  async getTimelineViewData(projectId: string, filters: BoardQueryParams = {}): Promise<TimelineItem[]> {
    const where: any = {
      projectId,
      deletedAt: null,
      OR: [
        { startDate: { not: null } },
        { dueDate: { not: null } },
      ],
    };

    if (filters.assigneeIds?.length) {
      where.assigneeId = { in: filters.assigneeIds };
    }
    if (filters.sprintId) {
      where.sprintId = filters.sprintId;
    } else {
      where.OR = [
        { sprint: { status: 'active' } },
        { sprintId: null },
      ];
    }
    if (filters.statusCategory) {
      where.status = { category: filters.statusCategory };
    }

    const issuesRaw = await prisma.issue.findMany({
      where,
      select: {
        id: true,
        issueNumber: true,
        title: true,
        startDate: true,
        dueDate: true,
        project: { select: { key: true } },
        status: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    const issues = issuesRaw.map((i) => ({
      id: i.id,
      issueKey: `${i.project.key}-${i.issueNumber}`,
      title: i.title,
      startDate: i.startDate,
      dueDate: i.dueDate,
      status: i.status ? { id: i.status.id, name: i.status.name, color: i.status.color } : null,
      assignee: i.assignee
        ? { id: i.assignee.id, displayName: `${i.assignee.firstName} ${i.assignee.lastName}`, avatarUrl: i.assignee.avatarUrl }
        : null,
    }));

    // Get dependencies with directional metadata
    const issueIds = issues.map((i) => i.id);
    const dependencies = issueIds.length > 0
      ? await prisma.issueLink.findMany({
          where: {
            OR: [
              { sourceIssueId: { in: issueIds } },
              { targetIssueId: { in: issueIds } },
            ],
          },
          select: {
            sourceIssueId: true,
            targetIssueId: true,
            linkType: { select: { name: true } },
          },
        })
      : [];

    // Calculate progress for each issue (based on subtasks) using raw query for FILTER clause
    const progresses = issueIds.length > 0
      ? await (async () => {
          const placeholders = issueIds.map((_, idx) => '$' + String(idx + 1)).join(', ');
          return prisma.$queryRawUnsafe<Array<{ id: string; total: number; completed: number }>>(
            'SELECT parent.id, COUNT(child.id) AS total, ' +
            "COUNT(child.id) FILTER (WHERE s.category = 'done') AS completed " +
            'FROM issues parent ' +
            'LEFT JOIN issues child ON parent.id = child.parent_id ' +
            'LEFT JOIN statuses s ON child.status_id = s.id ' +
            'WHERE parent.id IN (' + placeholders + ') ' +
            'AND (child.deleted_at IS NULL OR child.id IS NULL) ' +
            'GROUP BY parent.id',
            ...issueIds
          );
        })()
      : [];

    const progressMap = new Map(
      progresses.map((p) => [
        p.id,
        Number(p.total) > 0 ? Math.round((Number(p.completed) / Number(p.total)) * 100) : 0,
      ])
    );
    const depMap = new Map<string, string[]>();
    const blockedByMap = new Map<string, string[]>();
    const dependencyLinksMap = new Map<
      string,
      Array<{ sourceIssueId: string; targetIssueId: string; linkType: string; direction: 'outward' | 'inward' }>
    >();
    const outgoingBlockMap = new Map<string, Set<string>>();

    for (const dep of dependencies) {
      const linkType = dep.linkType?.name || 'relates_to';
      const source = dep.sourceIssueId;
      const target = dep.targetIssueId;

      if (!dependencyLinksMap.has(source)) dependencyLinksMap.set(source, []);
      if (!dependencyLinksMap.has(target)) dependencyLinksMap.set(target, []);

      dependencyLinksMap.get(source)!.push({
        sourceIssueId: source,
        targetIssueId: target,
        linkType,
        direction: 'outward',
      });
      dependencyLinksMap.get(target)!.push({
        sourceIssueId: source,
        targetIssueId: target,
        linkType,
        direction: 'inward',
      });

      if (linkType === 'blocks' || linkType === 'causes') {
        if (!depMap.has(source)) depMap.set(source, []);
        depMap.get(source)!.push(target);

        if (!blockedByMap.has(target)) blockedByMap.set(target, []);
        blockedByMap.get(target)!.push(source);

        if (!outgoingBlockMap.has(source)) outgoingBlockMap.set(source, new Set());
        outgoingBlockMap.get(source)!.add(target);
      } else if (linkType === 'is_blocked_by' || linkType === 'is_caused_by') {
        if (!depMap.has(target)) depMap.set(target, []);
        depMap.get(target)!.push(source);

        if (!blockedByMap.has(source)) blockedByMap.set(source, []);
        blockedByMap.get(source)!.push(target);

        if (!outgoingBlockMap.has(target)) outgoingBlockMap.set(target, new Set());
        outgoingBlockMap.get(target)!.add(source);
      }
    }

    return issues.map((issue) => ({
      ...issue,
      progress: progressMap.get(issue.id) || 0,
      dependencies: depMap.get(issue.id) || [],
      blockedBy: blockedByMap.get(issue.id) || [],
      dependencyLinks: dependencyLinksMap.get(issue.id) || [],
      hasDependencyCycle: (depMap.get(issue.id) || []).some((depId) =>
        outgoingBlockMap.get(depId)?.has(issue.id)
      ),
    })) as unknown as TimelineItem[];
  }

  // Get epics for filter
  async getEpics(projectId: string): Promise<any[]> {
    const epicsRaw = await prisma.issue.findMany({
      where: {
        projectId,
        deletedAt: null,
        type: { name: 'Epic' },
      },
      select: {
        id: true,
        title: true,
        type: { select: { color: true } },
      },
      orderBy: { title: 'asc' },
    });

    return epicsRaw.map((e) => ({
      id: e.id,
      title: e.title,
      color: e.type?.color || '#8B5CF6',
    }));
  }

  // Get sprints for filter
  async getSprints(projectId: string): Promise<any[]> {
    const rows: any[] = await prisma.$queryRaw`
      SELECT id, name, status
      FROM sprints
      WHERE project_id = ${projectId}
        AND status IN ('active', 'planned', 'completed')
      ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END,
               start_date DESC
      LIMIT 10
    `;

    return rows;
  }
}

