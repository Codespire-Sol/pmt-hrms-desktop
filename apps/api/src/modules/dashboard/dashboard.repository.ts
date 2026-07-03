import { prisma } from '../../database/prisma';
import { randomBytes } from 'crypto';
import {
  DashboardStats,
  AssignedIssue,
  RecentActivity,
  ProjectSummary,
  SprintProgress,
  DueSoonIssue,
  DashboardPreferences,
  DashboardType,
  UpdateDashboardPreferencesInput,
  DEFAULT_USER_DASHBOARD_LAYOUT,
  DEFAULT_PROJECT_DASHBOARD_LAYOUT,
  DashboardShare,
  DashboardShareWithDetails,
  CreateDashboardShareInput,
  UpdateDashboardShareInput,
  SharedDashboardInfo,
  AdminStats,
  ProjectOverviewItem,
  ManagerStats,
  TeamMemberWorkload,
  SprintHealthItem,
  RiskIssue,
  MyStats,
  MyIssueItem,
  MySprintContext,
  MyPerformancePoint,
  GanttItem,
  VelocityPoint,
  BurndownPoint,
  BurndownChartData,
  CumulativeFlowPoint,
} from './dashboard.types';

export const dashboardRepository = {
  async getAccessibleProjectIds(userId: string, includeAllProjects: boolean = false): Promise<string[]> {
    if (includeAllProjects) {
      const projects = await prisma.project.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return projects.map((p) => p.id);
    }

    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { leadId: userId },
          { members: { some: { userId } } },
        ],
      },
      select: { id: true },
    });
    return projects.map((project) => project.id);
  },

  // Get user dashboard stats
  async getUserStats(userId: string, includeAllProjects: boolean = false): Promise<DashboardStats> {
    const projectIds = await this.getAccessibleProjectIds(userId, includeAllProjects);

    if (projectIds.length === 0) {
      return {
        totalProjects: 0,
        totalIssues: 0,
        openIssues: 0,
        completedIssues: 0,
        overdueIssues: 0,
        totalTimeLogged: 0,
      };
    }

    const [issueStats] = await prisma.$queryRaw<[{ total: bigint; open: bigint; completed: bigint; overdue: bigint }]>`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE s.category != 'done') as open,
        COUNT(*) FILTER (WHERE s.category = 'done') as completed,
        COUNT(*) FILTER (WHERE i.due_date < NOW() AND s.category != 'done') as overdue
      FROM issues i
      JOIN projects p ON i.project_id = p.id
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
        AND p.deleted_at IS NULL
    `;

    const [timeStats] = await prisma.$queryRaw<[{ total: string }]>`
      SELECT COALESCE(SUM(hours * 60), 0) as total
      FROM time_logs
      WHERE user_id = ${userId}::uuid
    `;

    return {
      totalProjects: projectIds.length,
      totalIssues: Number(issueStats.total),
      openIssues: Number(issueStats.open),
      completedIssues: Number(issueStats.completed),
      overdueIssues: Number(issueStats.overdue),
      totalTimeLogged: Math.round(parseFloat(timeStats.total) || 0),
    };
  },

  // Get issues assigned to user
  async getAssignedIssues(userId: string, limit: number = 10): Promise<AssignedIssue[]> {
    const issues = await prisma.$queryRaw<any[]>`
      SELECT
        i.id,
        i.title,
        s.name as status,
        pr.name as priority,
        i.due_date,
        i.issue_number,
        i.created_at,
        i.updated_at,
        p.id as project_id,
        p.name as project_name,
        p.key as project_key,
        s.color as status_color,
        pr.color as priority_color
      FROM issues i
      JOIN projects p ON i.project_id = p.id
      LEFT JOIN statuses s ON i.status_id = s.id
      LEFT JOIN issue_priorities pr ON i.priority_id = pr.id
      WHERE i.assignee_id = ${userId}::uuid
        AND i.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND s.category != 'done'
      ORDER BY i.updated_at DESC
      LIMIT ${limit}
    `;

    return issues.map((issue: any) => ({
      id: issue.id,
      issueKey: `${issue.project_key}-${issue.issue_number}`,
      title: issue.title,
      status: issue.status,
      statusColor: issue.status_color || '#6b7280',
      priority: issue.priority,
      priorityColor: issue.priority_color || '#6b7280',
      dueDate: issue.due_date,
      projectId: issue.project_id,
      projectName: issue.project_name,
      projectKey: issue.project_key,
      isOverdue: issue.due_date && new Date(issue.due_date) < new Date(),
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    }));
  },

  // Get recent activity for user's projects
  async getRecentActivity(
    userId: string,
    limit: number = 20,
    includeAllProjects: boolean = false,
    ownActivityOnly: boolean = false
  ): Promise<RecentActivity[]> {
    const projectIds = await this.getAccessibleProjectIds(userId, includeAllProjects);

    if (projectIds.length === 0) {
      return [];
    }

    const activities = await prisma.$queryRaw<any[]>`
      SELECT
        a.id,
        a.action,
        a.issue_id,
        a.field_name,
        a.old_value,
        a.new_value,
        a.metadata,
        a.created_at,
        u.id as actor_id,
        CONCAT(u.first_name, ' ', u.last_name) as actor_name,
        u.avatar_url as actor_avatar_url,
        i.title as issue_title,
        i.issue_number,
        p.id as project_id,
        p.name as project_name,
        p.key as project_key
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN issues i ON a.issue_id = i.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (${ownActivityOnly}::boolean = false OR a.user_id = ${userId}::uuid)
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `;

    return activities.map((activity: any) => {
      const metadata =
        typeof activity.metadata === 'string'
          ? JSON.parse(activity.metadata)
          : activity.metadata || {};

      return {
        id: activity.id,
        action: activity.action,
        entityType: 'issue',
        entityId: activity.issue_id,
        entityTitle: activity.issue_title || metadata.title || 'Unknown',
        issueKey: activity.issue_number
          ? `${activity.project_key}-${activity.issue_number}`
          : null,
        projectId: activity.project_id,
        projectName: activity.project_name,
        actorId: activity.actor_id,
        actorName: activity.actor_name,
        actorAvatarUrl: activity.actor_avatar_url,
        metadata,
        createdAt: activity.created_at,
      };
    });
  },

  // Get project summaries for user
  async getProjectSummaries(
    userId: string,
    limit: number = 5,
    includeAllProjects: boolean = false
  ): Promise<ProjectSummary[]> {
    const projects = includeAllProjects
      ? await prisma.$queryRaw<any[]>`
          SELECT
            p.id,
            p.name,
            p.key,
            p.description,
            COUNT(i.id) as total_issues,
            COUNT(i.id) FILTER (WHERE s.category != 'done') as open_issues,
            COUNT(i.id) FILTER (WHERE s.category = 'done') as completed_issues
          FROM projects p
          LEFT JOIN issues i ON p.id = i.project_id AND i.deleted_at IS NULL
          LEFT JOIN statuses s ON i.status_id = s.id
          WHERE p.deleted_at IS NULL
          GROUP BY p.id
          ORDER BY p.updated_at DESC
          LIMIT ${limit}
        `
      : await (async () => {
          const accessibleProjectIds = await this.getAccessibleProjectIds(userId, false);
          if (accessibleProjectIds.length === 0) {
            return [];
          }

          return prisma.$queryRaw<any[]>`
            SELECT
              p.id,
              p.name,
              p.key,
              p.description,
              COUNT(i.id) as total_issues,
              COUNT(i.id) FILTER (WHERE s.category != 'done') as open_issues,
              COUNT(i.id) FILTER (WHERE s.category = 'done') as completed_issues
            FROM projects p
            LEFT JOIN issues i ON p.id = i.project_id AND i.deleted_at IS NULL
            LEFT JOIN statuses s ON i.status_id = s.id
            WHERE p.id = ANY(${accessibleProjectIds}::uuid[])
              AND p.deleted_at IS NULL
            GROUP BY p.id
            ORDER BY p.updated_at DESC
            LIMIT ${limit}
          `;
        })();

    // Get active sprints for these projects
    const projectIds = projects.map((p: any) => p.id);
    const activeSprints = projectIds.length > 0
      ? await prisma.$queryRaw<any[]>`
          SELECT id, name, project_id, end_date
          FROM sprints
          WHERE project_id = ANY(${projectIds}::uuid[])
            AND status = 'active'
        `
      : [];

    const sprintMap = new Map(activeSprints.map((s: any) => [s.project_id, s]));

    return projects.map((project: any) => {
      const total = parseInt(project.total_issues, 10);
      const completed = parseInt(project.completed_issues, 10);
      const sprint = sprintMap.get(project.id);

      return {
        id: project.id,
        name: project.name,
        key: project.key,
        description: project.description,
        openIssues: parseInt(project.open_issues, 10),
        totalIssues: total,
        completedPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        activeSprint: sprint
          ? {
              id: sprint.id,
              name: sprint.name,
              endDate: sprint.end_date,
              daysRemaining: Math.max(
                0,
                Math.ceil(
                  (new Date(sprint.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
              ),
            }
          : null,
        recentActivity: null,
      };
    });
  },

  // Get active sprints progress
  async getActiveSprintsProgress(
    userId: string,
    includeAllProjects: boolean = false
  ): Promise<SprintProgress[]> {
    const projectIds = await this.getAccessibleProjectIds(userId, includeAllProjects);

    if (projectIds.length === 0) {
      return [];
    }

    const sprints = await prisma.$queryRaw<any[]>`
      SELECT
        s.id,
        s.name,
        s.start_date,
        s.end_date,
        p.id as project_id,
        p.name as project_name,
        p.key as project_key
      FROM sprints s
      JOIN projects p ON s.project_id = p.id
      WHERE s.project_id = ANY(${projectIds}::uuid[])
        AND s.status = 'active'
        AND p.deleted_at IS NULL
    `;

    const sprintIds = sprints.map((s: any) => s.id);

    if (sprintIds.length === 0) {
      return [];
    }

    // Get issue counts for each sprint
    const issueCounts = await prisma.$queryRaw<any[]>`
      SELECT
        i.sprint_id,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE s.category = 'done') as completed,
        COUNT(*) FILTER (WHERE s.category IN ('in_progress', 'in_review')) as in_progress,
        COUNT(*) FILTER (WHERE s.category = 'todo') as todo
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.sprint_id = ANY(${sprintIds}::uuid[])
        AND i.sprint_id IS NOT NULL
        AND i.deleted_at IS NULL
      GROUP BY i.sprint_id
    `;

    const countMap = new Map(issueCounts.map((c: any) => [c.sprint_id, c]));

    return sprints.map((sprint: any) => {
      const counts = countMap.get(sprint.id) || {
        total: 0,
        completed: 0,
        in_progress: 0,
        todo: 0,
      };
      const total = parseInt(counts.total, 10);
      const completed = parseInt(counts.completed, 10);

      return {
        id: sprint.id,
        name: sprint.name,
        projectId: sprint.project_id,
        projectName: sprint.project_name,
        projectKey: sprint.project_key,
        startDate: sprint.start_date,
        endDate: sprint.end_date,
        daysRemaining: Math.max(
          0,
          Math.ceil((new Date(sprint.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        ),
        totalIssues: total,
        completedIssues: completed,
        inProgressIssues: parseInt(counts.in_progress, 10),
        todoIssues: parseInt(counts.todo, 10),
        completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  },

  // Get issues due soon
  async getDueSoonIssues(
    userId: string,
    days: number = 7,
    includeAllProjects: boolean = false
  ): Promise<DueSoonIssue[]> {
    const projectIds = await this.getAccessibleProjectIds(userId, includeAllProjects);

    if (projectIds.length === 0) {
      return [];
    }

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const issues = await prisma.$queryRaw<any[]>`
      SELECT
        i.id,
        i.title,
        i.due_date,
        s.name as status,
        i.issue_number,
        p.id as project_id,
        p.name as project_name,
        p.key as project_key,
        s.color as status_color
      FROM issues i
      JOIN projects p ON i.project_id = p.id
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND i.due_date IS NOT NULL
        AND i.due_date <= ${futureDate}
        AND i.due_date >= NOW()
        AND s.category != 'done'
      ORDER BY i.due_date ASC
      LIMIT 10
    `;

    return issues.map((issue: any) => {
      const dueDate = new Date(issue.due_date);
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: issue.id,
        issueKey: `${issue.project_key}-${issue.issue_number}`,
        title: issue.title,
        dueDate: issue.due_date,
        daysUntilDue,
        status: issue.status,
        statusColor: issue.status_color || '#6b7280',
        projectId: issue.project_id,
        projectName: issue.project_name,
      };
    });
  },

  // Get project dashboard stats
  async getProjectStats(projectId: string): Promise<any> {
    const [stats] = await prisma.$queryRaw<[any]>`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE s.category != 'done') as open,
        COUNT(*) FILTER (WHERE s.category IN ('in_progress', 'in_review')) as in_progress,
        COUNT(*) FILTER (WHERE s.category = 'done') as completed,
        COUNT(*) FILTER (WHERE i.due_date < NOW() AND s.category != 'done') as overdue
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
    `;

    const [timeStats] = await prisma.$queryRaw<[any]>`
      SELECT COALESCE(SUM(t.hours * 60), 0) as total
      FROM time_logs t
      JOIN issues i ON t.issue_id = i.id
      WHERE i.project_id = ${projectId}::uuid
    `;

    // Calculate average resolution time (for completed issues)
    const [avgResolution] = await prisma.$queryRaw<[any]>`
      SELECT AVG(EXTRACT(EPOCH FROM (i.updated_at - i.created_at)) / 3600) as avg_hours
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
        AND s.category = 'done'
    `;

    return {
      totalIssues: parseInt(stats.total, 10),
      openIssues: parseInt(stats.open, 10),
      inProgressIssues: parseInt(stats.in_progress, 10),
      completedIssues: parseInt(stats.completed, 10),
      overdueIssues: parseInt(stats.overdue, 10),
      totalTimeLogged: parseInt(timeStats?.total || '0', 10),
      avgResolutionTime: avgResolution?.avg_hours
        ? Math.round(parseFloat(avgResolution.avg_hours))
        : null,
    };
  },

  // Get issues by status for project
  async getIssuesByStatus(projectId: string): Promise<any[]> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT s.name as status, s.color as status_color, COUNT(*) as count
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ${projectId}::uuid
      GROUP BY s.name, s.color
      ORDER BY count DESC
    `;

    return result.map((r: any) => ({
      status: r.status,
      statusColor: r.status_color || '#6b7280',
      count: parseInt(r.count, 10),
    }));
  },

  // Get issues by priority for project
  async getIssuesByPriority(projectId: string): Promise<any[]> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT p.name as priority, p.color as priority_color, COUNT(*) as count
      FROM issues i
      LEFT JOIN issue_priorities p ON i.priority_id = p.id
      WHERE i.project_id = ${projectId}::uuid
      GROUP BY p.name, p.color
      ORDER BY count DESC
    `;

    return result.map((r: any) => ({
      priority: r.priority,
      priorityColor: r.priority_color || '#6b7280',
      count: parseInt(r.count, 10),
    }));
  },

  // Get issues by type for project
  async getIssuesByType(projectId: string): Promise<any[]> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT it.name as type, it.icon as type_icon, COUNT(*) as count
      FROM issues i
      LEFT JOIN issue_types it ON i.type_id = it.id
      WHERE i.project_id = ${projectId}::uuid
      GROUP BY it.name, it.icon
      ORDER BY count DESC
    `;

    return result.map((r: any) => ({
      type: r.type,
      typeIcon: r.type_icon || 'circle',
      count: parseInt(r.count, 10),
    }));
  },

  // Get team member stats for project
  async getTeamMemberStats(projectId: string): Promise<any[]> {
    const members = await prisma.$queryRaw<any[]>`
      SELECT
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as display_name,
        u.avatar_url,
        COUNT(i.id) FILTER (WHERE st.category != 'done') as assigned_count,
        COUNT(i.id) FILTER (WHERE st.category = 'done') as completed_count
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      LEFT JOIN issues i ON i.assignee_id = u.id AND i.project_id = pm.project_id
      LEFT JOIN statuses st ON i.status_id = st.id
      WHERE pm.project_id = ${projectId}::uuid
      GROUP BY u.id, u.first_name, u.last_name, u.avatar_url
      ORDER BY assigned_count DESC
    `;

    return members.map((m: any) => ({
      id: m.id,
      displayName: m.display_name,
      avatarUrl: m.avatar_url,
      assignedCount: parseInt(m.assigned_count, 10),
      completedCount: parseInt(m.completed_count, 10),
    }));
  },

  async getProjectDueSoonTrend(projectId: string, days: number = 14): Promise<any[]> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(i.due_date::date, 'YYYY-MM-DD') as due_day,
        COUNT(*)::int as count
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
        AND i.due_date IS NOT NULL
        AND i.due_date::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + ${days}::int)
        AND (s.name IS NULL OR s.category != 'done')
      GROUP BY due_day
      ORDER BY due_day ASC
    `;

    return result.map((row: any) => ({
      day: row.due_day,
      count: Number(row.count || 0),
    }));
  },

  async getProjectThroughput(projectId: string, days: number = 30): Promise<any[]> {
    const createdSeries = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('week', i.created_at), 'YYYY-MM-DD') as bucket,
        COUNT(*)::int as created
      FROM issues i
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
        AND i.created_at >= (NOW() - (${days}::text || ' days')::interval)
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const resolvedSeries = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('week', i.updated_at), 'YYYY-MM-DD') as bucket,
        COUNT(*)::int as resolved
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
        AND i.updated_at >= (NOW() - (${days}::text || ' days')::interval)
        AND s.category = 'done'
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const merged = new Map<string, { bucket: string; created: number; resolved: number }>();
    for (const row of createdSeries) {
      merged.set(row.bucket, {
        bucket: row.bucket,
        created: Number(row.created || 0),
        resolved: 0,
      });
    }
    for (const row of resolvedSeries) {
      const existing = merged.get(row.bucket) || {
        bucket: row.bucket,
        created: 0,
        resolved: 0,
      };
      existing.resolved = Number(row.resolved || 0);
      merged.set(row.bucket, existing);
    }

    return Array.from(merged.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
  },

  async getProjectWorkloadBuckets(projectId: string): Promise<any> {
    const workloads = await prisma.$queryRaw<any[]>`
      SELECT
        u.id as user_id,
        COUNT(i.id)::int as open_count
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      LEFT JOIN issues i ON i.assignee_id = u.id
        AND i.project_id = pm.project_id
        AND i.deleted_at IS NULL
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE pm.project_id = ${projectId}::uuid
        AND (s.name IS NULL OR s.category != 'done')
      GROUP BY u.id
    `;

    const buckets = {
      low: 0,
      medium: 0,
      high: 0,
      unassignedOpenIssues: 0,
    };

    for (const row of workloads) {
      const count = Number(row.open_count || 0);
      if (count <= 3) buckets.low += 1;
      else if (count <= 7) buckets.medium += 1;
      else buckets.high += 1;
    }

    const [unassigned] = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
        AND i.assignee_id IS NULL
        AND (s.name IS NULL OR s.category != 'done')
    `;

    buckets.unassignedOpenIssues = Number(unassigned?.count || 0);
    return buckets;
  },

  // Get project activity
  async getProjectActivity(projectId: string, limit: number = 20): Promise<RecentActivity[]> {
    const activities = await prisma.$queryRaw<any[]>`
      SELECT
        a.id,
        a.action,
        a.issue_id,
        a.field_name,
        a.old_value,
        a.new_value,
        a.metadata,
        a.created_at,
        u.id as actor_id,
        CONCAT(u.first_name, ' ', u.last_name) as actor_name,
        u.avatar_url as actor_avatar_url,
        i.title as issue_title,
        i.issue_number,
        p.id as project_id,
        p.name as project_name,
        p.key as project_key
      FROM activity_logs a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN issues i ON a.issue_id = i.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.project_id = ${projectId}::uuid
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `;

    return activities.map((activity: any) => {
      const metadata =
        typeof activity.metadata === 'string'
          ? JSON.parse(activity.metadata)
          : activity.metadata || {};

      return {
        id: activity.id,
        action: activity.action,
        entityType: 'issue',
        entityId: activity.issue_id,
        entityTitle: activity.issue_title || metadata.title || 'Unknown',
        issueKey: activity.issue_number
          ? `${activity.project_key}-${activity.issue_number}`
          : null,
        projectId: activity.project_id,
        projectName: activity.project_name,
        actorId: activity.actor_id,
        actorName: activity.actor_name,
        actorAvatarUrl: activity.actor_avatar_url,
        metadata,
        createdAt: activity.created_at,
      };
    });
  },

  // ========== Dashboard Preferences ==========

  async getDashboardPreferences(
    userId: string,
    dashboardType: DashboardType,
    projectId?: string
  ): Promise<DashboardPreferences | null> {
    const pref = await prisma.dashboardPreference.findFirst({
      where: {
        userId,
        type: dashboardType as any,
        projectId: projectId || null,
      },
    });

    return pref ? this.mapDashboardPreferences(pref) : null;
  },

  async getOrCreateDashboardPreferences(
    userId: string,
    dashboardType: DashboardType,
    projectId?: string
  ): Promise<DashboardPreferences> {
    const existing = await this.getDashboardPreferences(userId, dashboardType, projectId);

    if (existing) {
      return existing;
    }

    // Create default preferences
    const defaultLayout =
      dashboardType === 'project' ? DEFAULT_PROJECT_DASHBOARD_LAYOUT : DEFAULT_USER_DASHBOARD_LAYOUT;

    const created = await prisma.dashboardPreference.create({
      data: {
        userId,
        type: dashboardType as any,
        projectId: projectId || null,
        layout: defaultLayout as any,
        widgets: [] as any,
        settings: {
          widgetSettings: {},
          theme: 'default',
        } as any,
      } as any,
    });

    return this.mapDashboardPreferences(created);
  },

  async updateDashboardPreferences(
    userId: string,
    dashboardType: DashboardType,
    input: UpdateDashboardPreferencesInput,
    projectId?: string
  ): Promise<DashboardPreferences> {
    // Ensure preferences exist
    await this.getOrCreateDashboardPreferences(userId, dashboardType, projectId);

    const current = await prisma.dashboardPreference.findFirst({
      where: {
        userId,
        type: dashboardType as any,
        projectId: projectId || null,
      },
    });

    const currentSettings =
      typeof current?.settings === 'string'
        ? JSON.parse(current.settings)
        : (current?.settings as Record<string, any> | null) || {};

    const nextSettings = { ...currentSettings };
    if (input.widgetSettings !== undefined) {
      nextSettings.widgetSettings = input.widgetSettings;
    }
    if (input.theme !== undefined) {
      nextSettings.theme = input.theme;
    }

    const data: any = { updatedAt: new Date() };
    if (input.layout !== undefined) data.layout = input.layout as any;
    if (input.hiddenWidgets !== undefined) data.widgets = input.hiddenWidgets as any;
    if (input.widgetSettings !== undefined || input.theme !== undefined) {
      data.settings = nextSettings as any;
    }

    await prisma.dashboardPreference.updateMany({
      where: {
        userId,
        type: dashboardType as any,
        projectId: projectId || null,
      },
      data,
    });

    const updated = await prisma.dashboardPreference.findFirst({
      where: {
        userId,
        type: dashboardType as any,
        projectId: projectId || null,
      },
    });

    if (!updated) {
      throw new Error('Failed to update dashboard preferences');
    }

    return this.mapDashboardPreferences(updated);
  },

  async resetDashboardPreferences(
    userId: string,
    dashboardType: DashboardType,
    projectId?: string
  ): Promise<DashboardPreferences> {
    const defaultLayout =
      dashboardType === 'project' ? DEFAULT_PROJECT_DASHBOARD_LAYOUT : DEFAULT_USER_DASHBOARD_LAYOUT;

    const result = await prisma.dashboardPreference.updateMany({
      where: {
        userId,
        type: dashboardType as any,
        projectId: projectId || null,
      },
      data: {
        layout: defaultLayout as any,
        widgets: [] as any,
        settings: {
          widgetSettings: {},
          theme: 'default',
        } as any,
        updatedAt: new Date(),
      } as any,
    });

    if (result.count === 0) {
      // Create if doesn't exist
      return this.getOrCreateDashboardPreferences(userId, dashboardType, projectId);
    }

    const updated = await prisma.dashboardPreference.findFirst({
      where: {
        userId,
        type: dashboardType as any,
        projectId: projectId || null,
      },
    });

    if (!updated) {
      throw new Error('Failed to reset dashboard preferences');
    }

    return this.mapDashboardPreferences(updated);
  },

  mapDashboardPreferences(row: any): DashboardPreferences {
    const layoutRaw = row.layout;
    const widgetsRaw = row.widgets ?? row.hiddenWidgets ?? row.hidden_widgets;
    const settingsRaw = row.settings ?? row.widgetSettings ?? row.widget_settings;

    const layout = typeof layoutRaw === 'string' ? JSON.parse(layoutRaw) : layoutRaw || [];
    const hiddenWidgets =
      typeof widgetsRaw === 'string' ? JSON.parse(widgetsRaw) : widgetsRaw || [];
    const settings = typeof settingsRaw === 'string' ? JSON.parse(settingsRaw) : settingsRaw || {};

    return {
      id: row.id,
      userId: row.userId ?? row.user_id,
      dashboardType: row.dashboardType ?? row.dashboard_type ?? row.type,
      projectId: row.projectId ?? row.project_id,
      layout,
      hiddenWidgets,
      widgetSettings: settings.widgetSettings || {},
      theme: settings.theme || row.theme || 'default',
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  },

  // ========== Dashboard Sharing ==========

  async createShare(
    ownerId: string,
    input: CreateDashboardShareInput
  ): Promise<DashboardShare> {
    const publicLinkToken = input.isPublic ? randomBytes(32).toString('hex') : null;

    const share = await prisma.dashboardShare.create({
      data: {
        dashboardId: input.dashboardPreferencesId,
        createdBy: ownerId,
        shareType: input.isPublic ? 'public' : 'user',
        userId: input.sharedWithUserId || null,
        permission: (input.permission || 'view') as any,
        publicToken: publicLinkToken,
        expiresAt: input.expiresAt || null,
      } as any,
    });

    return this.mapDashboardShare(share);
  },

  async getShareById(shareId: string): Promise<DashboardShare | null> {
    const share = await prisma.dashboardShare.findUnique({ where: { id: shareId } });
    return share ? this.mapDashboardShare(share) : null;
  },

  async getShareByToken(token: string): Promise<DashboardShareWithDetails | null> {
    const shares = await prisma.$queryRaw<any[]>`
      SELECT
        ds.*,
        dp.id as dashboard_id,
        dp.dashboard_type,
        dp.project_id as dashboard_project_id,
        CONCAT(u.first_name, ' ', u.last_name) as owner_display_name,
        u.avatar_url as owner_avatar_url
      FROM dashboard_shares ds
      JOIN dashboard_preferences dp ON ds.dashboard_preferences_id = dp.id
      JOIN users u ON ds.owner_id = u.id
      WHERE ds.public_link_token = ${token}
        AND ds.is_public = true
        AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
      LIMIT 1
    `;

    if (shares.length === 0) return null;
    const share = shares[0];

    return {
      ...this.mapDashboardShare(share),
      owner: {
        id: share.owner_id,
        displayName: share.owner_display_name,
        avatarUrl: share.owner_avatar_url,
      },
      dashboard: {
        id: share.dashboard_id,
        dashboardType: share.dashboard_type,
        projectId: share.dashboard_project_id,
      },
    };
  },

  async getSharesByDashboard(dashboardPreferencesId: string): Promise<DashboardShareWithDetails[]> {
    const shares = await prisma.$queryRaw<any[]>`
      SELECT
        ds.*,
        dp.id as dashboard_id,
        dp.dashboard_type,
        dp.project_id as dashboard_project_id,
        CONCAT(owner.first_name, ' ', owner.last_name) as owner_display_name,
        owner.avatar_url as owner_avatar_url,
        CONCAT(shared.first_name, ' ', shared.last_name) as shared_display_name,
        shared.email as shared_email,
        shared.avatar_url as shared_avatar_url
      FROM dashboard_shares ds
      JOIN dashboard_preferences dp ON ds.dashboard_preferences_id = dp.id
      JOIN users owner ON ds.owner_id = owner.id
      LEFT JOIN users shared ON ds.shared_with_user_id = shared.id
      WHERE ds.dashboard_preferences_id = ${dashboardPreferencesId}::uuid
      ORDER BY ds.created_at DESC
    `;

    return shares.map((share: any) => ({
      ...this.mapDashboardShare(share),
      owner: {
        id: share.owner_id,
        displayName: share.owner_display_name,
        avatarUrl: share.owner_avatar_url,
      },
      sharedWithUser: share.shared_with_user_id
        ? {
            id: share.shared_with_user_id,
            displayName: share.shared_display_name,
            email: share.shared_email,
            avatarUrl: share.shared_avatar_url,
          }
        : undefined,
      dashboard: {
        id: share.dashboard_id,
        dashboardType: share.dashboard_type,
        projectId: share.dashboard_project_id,
      },
    }));
  },

  async getSharedWithMe(userId: string): Promise<SharedDashboardInfo[]> {
    const shares = await prisma.$queryRaw<any[]>`
      SELECT
        ds.*,
        dp.*,
        CONCAT(u.first_name, ' ', u.last_name) as owner_display_name,
        u.avatar_url as owner_avatar_url
      FROM dashboard_shares ds
      JOIN dashboard_preferences dp ON ds.dashboard_preferences_id = dp.id
      JOIN users u ON ds.owner_id = u.id
      WHERE ds.shared_with_user_id = ${userId}::uuid
        AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
      ORDER BY ds.created_at DESC
    `;

    return shares.map((row: any) => ({
      share: this.mapDashboardShare(row),
      dashboard: this.mapDashboardPreferences(row),
      owner: {
        id: row.owner_id,
        displayName: row.owner_display_name,
        avatarUrl: row.owner_avatar_url,
      },
    }));
  },

  async updateShare(shareId: string, input: UpdateDashboardShareInput): Promise<DashboardShare> {
    const updateData: any = { updatedAt: new Date() };
    if (input.permission !== undefined) updateData.permission = input.permission;
    if (input.expiresAt !== undefined) updateData.expiresAt = input.expiresAt;

    const updated = await prisma.dashboardShare.update({
      where: { id: shareId },
      data: updateData,
    });

    return this.mapDashboardShare(updated);
  },

  async deleteShare(shareId: string): Promise<void> {
    await prisma.dashboardShare.delete({ where: { id: shareId } });
  },

  async deleteSharesByDashboard(dashboardPreferencesId: string): Promise<void> {
    await prisma.dashboardShare.deleteMany({
      where: { dashboardId: dashboardPreferencesId },
    });
  },

  async regeneratePublicLink(shareId: string): Promise<DashboardShare> {
    const newToken = randomBytes(32).toString('hex');

    const updated = await prisma.dashboardShare.update({
      where: { id: shareId },
      data: {
        publicToken: newToken,
        updatedAt: new Date(),
      },
    });

    return this.mapDashboardShare(updated);
  },

  // ============================================================
  // ADMIN DASHBOARD METHODS
  // ============================================================

  async getAdminStats(): Promise<AdminStats> {
    const [userStats] = await prisma.$queryRaw<[any]>`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE u.is_active = true) as active_users
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.deleted_at IS NULL
        AND r.name NOT IN ('hr', 'employee')
    `;

    const [projectStats] = await prisma.$queryRaw<[any]>`
      SELECT
        COUNT(*) as total_projects,
        COUNT(*) FILTER (WHERE status = 'active') as active_projects
      FROM projects
      WHERE deleted_at IS NULL
    `;

    const [issueStats] = await prisma.$queryRaw<[any]>`
      SELECT
        COUNT(*) as total_issues,
        COUNT(*) FILTER (WHERE s.category != 'done') as open_issues,
        COUNT(*) FILTER (WHERE s.category = 'done') as completed_issues,
        COUNT(*) FILTER (WHERE i.due_date < NOW() AND s.category != 'done') as overdue_issues,
        COUNT(*) FILTER (WHERE i.created_at > NOW() - INTERVAL '7 days') as created_this_week,
        COUNT(*) FILTER (WHERE s.category = 'done' AND i.updated_at > NOW() - INTERVAL '7 days') as completed_this_week
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.deleted_at IS NULL
    `;

    const [timeStats] = await prisma.$queryRaw<[any]>`
      SELECT COALESCE(SUM(hours * 60), 0) as total_minutes
      FROM time_logs
    `;

    const [sprintStats] = await prisma.$queryRaw<[any]>`
      SELECT COUNT(*) as active_sprints
      FROM sprints
      WHERE status = 'active'
    `;

    return {
      totalUsers: Number(userStats.total_users),
      activeUsers: Number(userStats.active_users),
      totalProjects: Number(projectStats.total_projects),
      activeProjects: Number(projectStats.active_projects),
      totalIssues: Number(issueStats.total_issues),
      openIssues: Number(issueStats.open_issues),
      completedIssues: Number(issueStats.completed_issues),
      overdueIssues: Number(issueStats.overdue_issues),
      activeSprintsCount: Number(sprintStats.active_sprints),
      totalTimeLoggedMinutes: Math.round(parseFloat(timeStats.total_minutes) || 0),
      issuesCreatedThisWeek: Number(issueStats.created_this_week),
      issuesCompletedThisWeek: Number(issueStats.completed_this_week),
    };
  },

  async getOrgProjectsOverview(limit: number = 20): Promise<ProjectOverviewItem[]> {
    const projects = await prisma.$queryRaw<any[]>`
      SELECT
        p.id,
        p.name,
        p.key,
        p.status,
        p.lead_id,
        p.updated_at as last_activity,
        CONCAT(u.first_name, ' ', u.last_name) as lead_name,
        (SELECT COUNT(DISTINCT pm2.user_id) FROM project_members pm2 WHERE pm2.project_id = p.id)::int as member_count,
        COUNT(i.id)::int as total_issues,
        COUNT(i.id) FILTER (WHERE s.category != 'done')::int as open_issues,
        COUNT(i.id) FILTER (WHERE i.due_date < NOW() AND s.category != 'done')::int as overdue_issues,
        COUNT(i.id) FILTER (WHERE s.category = 'done')::int as completed_issues
      FROM projects p
      LEFT JOIN users u ON p.lead_id = u.id
      LEFT JOIN issues i ON i.project_id = p.id AND i.deleted_at IS NULL
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.key, p.status, p.lead_id, u.first_name, u.last_name, p.updated_at
      ORDER BY p.updated_at DESC
      LIMIT ${limit}
    `;

    const projectIds = projects.map((p: any) => p.id);
    const activeSprints =
      projectIds.length > 0
        ? await prisma.$queryRaw<any[]>`
            SELECT id, name, project_id, end_date
            FROM sprints
            WHERE project_id = ANY(${projectIds}::uuid[])
              AND status = 'active'
          `
        : [];

    const sprintMap = new Map(activeSprints.map((s: any) => [s.project_id, s]));

    return projects.map((p: any) => {
      const total = Number(p.total_issues);
      const completed = Number(p.completed_issues);
      const overdue = Number(p.overdue_issues);
      const open = Number(p.open_issues);
      const sprint = sprintMap.get(p.id);
      const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const daysRemaining = sprint
        ? Math.max(
            0,
            Math.ceil((new Date(sprint.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          )
        : null;

      let healthStatus: 'healthy' | 'at_risk' | 'critical' = 'healthy';
      if (open > 0 && overdue / Math.max(open, 1) > 0.3) healthStatus = 'critical';
      else if (
        overdue > 0 ||
        (sprint && daysRemaining !== null && daysRemaining < 3 && completionPct < 70)
      )
        healthStatus = 'at_risk';

      return {
        id: p.id,
        name: p.name,
        key: p.key,
        status: p.status,
        totalIssues: total,
        openIssues: open,
        overdueIssues: overdue,
        completionPercentage: completionPct,
        activeSprint: sprint ? sprint.name : null,
        sprintDaysRemaining: daysRemaining,
        leadId: p.lead_id,
        leadName: p.lead_name,
        memberCount: Number(p.member_count),
        healthStatus,
        lastActivity: p.last_activity,
      };
    });
  },

  async getOrgThroughput(days: number = 30): Promise<{ bucket: string; created: number; resolved: number }[]> {
    const created = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('week', i.created_at), 'YYYY-MM-DD') as bucket,
        COUNT(*)::int as created
      FROM issues i
      WHERE i.deleted_at IS NULL
        AND i.created_at >= NOW() - (${days}::text || ' days')::interval
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const resolved = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('week', i.updated_at), 'YYYY-MM-DD') as bucket,
        COUNT(*)::int as resolved
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.deleted_at IS NULL
        AND s.category = 'done'
        AND i.updated_at >= NOW() - (${days}::text || ' days')::interval
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const merged = new Map<string, { bucket: string; created: number; resolved: number }>();
    for (const row of created) {
      merged.set(row.bucket, { bucket: row.bucket, created: Number(row.created), resolved: 0 });
    }
    for (const row of resolved) {
      const existing = merged.get(row.bucket) || { bucket: row.bucket, created: 0, resolved: 0 };
      existing.resolved = Number(row.resolved);
      merged.set(row.bucket, existing);
    }
    return Array.from(merged.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
  },

  async getIssuesByProjectChart(limit: number = 10): Promise<any[]> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        p.id as project_id,
        p.name as project_name,
        p.key as project_key,
        COUNT(i.id) FILTER (WHERE s.category IN ('todo'))::int as open,
        COUNT(i.id) FILTER (WHERE s.category IN ('in_progress', 'in_review'))::int as in_progress,
        COUNT(i.id) FILTER (WHERE s.category = 'done')::int as done,
        COUNT(i.id) FILTER (WHERE i.due_date < NOW() AND s.category != 'done')::int as overdue
      FROM projects p
      LEFT JOIN issues i ON i.project_id = p.id AND i.deleted_at IS NULL
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.key
      ORDER BY (COUNT(i.id)) DESC
      LIMIT ${limit}
    `;
    return result.map((r: any) => ({
      projectId: r.project_id,
      projectName: r.project_name,
      projectKey: r.project_key,
      open: Number(r.open),
      inProgress: Number(r.in_progress),
      done: Number(r.done),
      overdue: Number(r.overdue),
    }));
  },

  async getUserActivityStats(limit: number = 10): Promise<any[]> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        u.id as user_id,
        CONCAT(u.first_name, ' ', u.last_name) as display_name,
        u.avatar_url,
        COUNT(i_created.id)::int as issues_created,
        COUNT(i_completed.id)::int as issues_completed,
        COALESCE(SUM(tl.hours * 60), 0)::int as time_logged_minutes
      FROM users u
      LEFT JOIN employees emp ON emp.user_id = u.id AND emp.deleted_at IS NULL
      LEFT JOIN issues i_created ON i_created.reporter_id = u.id
        AND i_created.deleted_at IS NULL
        AND i_created.created_at > NOW() - INTERVAL '30 days'
      LEFT JOIN issues i_completed ON i_completed.assignee_id = u.id
        AND i_completed.deleted_at IS NULL
        AND i_completed.updated_at > NOW() - INTERVAL '30 days'
        AND EXISTS (SELECT 1 FROM statuses s WHERE s.id = i_completed.status_id AND s.category = 'done')
      LEFT JOIN time_logs tl ON tl.user_id = u.id
        AND tl.created_at > NOW() - INTERVAL '30 days'
      WHERE u.deleted_at IS NULL
        AND u.is_active = true
        AND (emp.status IS NULL OR emp.status::text NOT IN ('exited', 'deleted'))
      GROUP BY u.id, u.first_name, u.last_name, u.avatar_url
      HAVING COUNT(i_created.id) + COUNT(i_completed.id) + COALESCE(SUM(tl.hours), 0) > 0
      ORDER BY (COUNT(i_created.id) + COUNT(i_completed.id)) DESC
      LIMIT ${limit}
    `;
    return result.map((r: any) => ({
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      issuesCreated: Number(r.issues_created),
      issuesCompleted: Number(r.issues_completed),
      timeLoggedMinutes: Number(r.time_logged_minutes),
    }));
  },

  async getOverdueByProject(): Promise<{ projectId: string; projectName: string; overdueCount: number }[]> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        p.id as project_id,
        p.name as project_name,
        COUNT(i.id)::int as overdue_count
      FROM projects p
      JOIN issues i ON i.project_id = p.id AND i.deleted_at IS NULL
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE p.deleted_at IS NULL
        AND i.due_date < NOW()
        AND s.category != 'done'
      GROUP BY p.id, p.name
      HAVING COUNT(i.id) > 0
      ORDER BY overdue_count DESC
    `;
    return result.map((r: any) => ({
      projectId: r.project_id,
      projectName: r.project_name,
      overdueCount: Number(r.overdue_count),
    }));
  },

  // ============================================================
  // MANAGER DASHBOARD METHODS
  // ============================================================

  async getManagerProjectIds(userId: string): Promise<string[]> {
    const projects = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT p.id
      FROM projects p
      WHERE p.deleted_at IS NULL
        AND (
          p.lead_id = ${userId}::uuid
          OR p.owner_id = ${userId}::uuid
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = p.id
              AND pm.user_id = ${userId}::uuid
              AND pm.role IN ('admin', 'lead')
          )
        )
    `;
    return projects.map((p: any) => p.id);
  },

  async getManagerStats(projectIds: string[]): Promise<ManagerStats> {
    if (projectIds.length === 0) {
      return {
        managedProjects: 0,
        totalTeamMembers: 0,
        totalIssuesInManaged: 0,
        openIssues: 0,
        overdueIssues: 0,
        activeSprintsCount: 0,
        completionRateThisWeek: 0,
        blockedIssues: 0,
      };
    }

    const [issueStats] = await prisma.$queryRaw<[any]>`
      SELECT
        COUNT(*) as total_issues,
        COUNT(*) FILTER (WHERE s.category != 'done') as open_issues,
        COUNT(*) FILTER (WHERE i.due_date < NOW() AND s.category != 'done') as overdue_issues
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
    `;

    const [memberStats] = await prisma.$queryRaw<[any]>`
      SELECT COUNT(DISTINCT user_id)::int as total_members
      FROM project_members
      WHERE project_id = ANY(${projectIds}::uuid[])
    `;

    const [sprintStats] = await prisma.$queryRaw<[any]>`
      SELECT COUNT(*)::int as active_sprints
      FROM sprints
      WHERE project_id = ANY(${projectIds}::uuid[])
        AND status = 'active'
    `;

    const [weekStats] = await prisma.$queryRaw<[any]>`
      SELECT
        COUNT(*) FILTER (WHERE i.created_at > NOW() - INTERVAL '7 days') as created_this_week,
        COUNT(*) FILTER (WHERE s.category = 'done' AND i.updated_at > NOW() - INTERVAL '7 days') as completed_this_week
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
    `;

    const [blockedStats] = await prisma.$queryRaw<[any]>`
      SELECT COUNT(DISTINCT il.source_issue_id)::int as blocked_count
      FROM issue_links il
      JOIN link_types lt ON il.link_type_id = lt.id
      JOIN issues i ON il.source_issue_id = i.id
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE lt.name = 'is_blocked_by'
        AND i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
        AND s.category != 'done'
    `;

    const created = Number(weekStats.created_this_week);
    const completedThisWeek = Number(weekStats.completed_this_week);
    const completionRate = created > 0 ? Math.round((completedThisWeek / created) * 100) : 0;

    return {
      managedProjects: projectIds.length,
      totalTeamMembers: Number(memberStats.total_members),
      totalIssuesInManaged: Number(issueStats.total_issues),
      openIssues: Number(issueStats.open_issues),
      overdueIssues: Number(issueStats.overdue_issues),
      activeSprintsCount: Number(sprintStats.active_sprints),
      completionRateThisWeek: completionRate,
      blockedIssues: Number(blockedStats.blocked_count),
    };
  },

  async getTeamWorkloadForProjects(projectIds: string[]): Promise<TeamMemberWorkload[]> {
    if (projectIds.length === 0) return [];

    const members = await prisma.$queryRaw<any[]>`
      SELECT
        u.id as user_id,
        CONCAT(u.first_name, ' ', u.last_name) as display_name,
        u.avatar_url,
        COUNT(DISTINCT i.id) FILTER (WHERE s.category != 'done')::int as assigned_count,
        COUNT(DISTINCT i.id) FILTER (WHERE s.category IN ('in_progress', 'in_review'))::int as in_progress_count,
        COUNT(DISTINCT i.id) FILTER (WHERE s.category = 'done')::int as completed_count,
        COUNT(DISTINCT i.id) FILTER (WHERE i.due_date < NOW() AND s.category != 'done')::int as overdue_count,
        COALESCE(SUM(tl.hours) * 60, 0)::int as logged_minutes_this_week
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      LEFT JOIN issues i ON i.assignee_id = u.id
        AND i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
      LEFT JOIN statuses s ON i.status_id = s.id
      LEFT JOIN time_logs tl ON tl.user_id = u.id
        AND tl.created_at > NOW() - INTERVAL '7 days'
      WHERE pm.project_id = ANY(${projectIds}::uuid[])
      GROUP BY u.id, u.first_name, u.last_name, u.avatar_url
      ORDER BY assigned_count DESC
    `;

    return members.map((m: any) => {
      const assigned = Number(m.assigned_count);
      let capacityStatus: 'available' | 'normal' | 'overloaded' = 'normal';
      if (assigned <= 2) capacityStatus = 'available';
      else if (assigned >= 8) capacityStatus = 'overloaded';

      return {
        userId: m.user_id,
        displayName: m.display_name,
        avatarUrl: m.avatar_url,
        assignedCount: assigned,
        inProgressCount: Number(m.in_progress_count),
        completedCount: Number(m.completed_count),
        overdueCount: Number(m.overdue_count),
        loggedMinutesThisWeek: Number(m.logged_minutes_this_week),
        capacityStatus,
      };
    });
  },

  async getSprintHealthForProjects(projectIds: string[]): Promise<SprintHealthItem[]> {
    if (projectIds.length === 0) return [];

    const sprints = await prisma.$queryRaw<any[]>`
      SELECT
        s.id as sprint_id,
        s.name as sprint_name,
        s.start_date,
        s.end_date,
        p.id as project_id,
        p.name as project_name,
        COUNT(i.id)::int as total_issues,
        COUNT(i.id) FILTER (WHERE st.category = 'done')::int as completed_issues,
        COUNT(i.id) FILTER (WHERE st.category IN ('in_progress', 'in_review'))::int as in_progress_issues
      FROM sprints s
      JOIN projects p ON s.project_id = p.id
      LEFT JOIN issues i ON i.sprint_id = s.id AND i.deleted_at IS NULL
      LEFT JOIN statuses st ON i.status_id = st.id
      WHERE s.project_id = ANY(${projectIds}::uuid[])
        AND s.status = 'active'
        AND p.deleted_at IS NULL
      GROUP BY s.id, s.name, s.start_date, s.end_date, p.id, p.name
    `;

    const sprintIds = sprints.map((s: any) => s.sprint_id);
    const blockedCounts =
      sprintIds.length > 0
        ? await prisma.$queryRaw<any[]>`
            SELECT
              i.sprint_id,
              COUNT(DISTINCT il.source_issue_id)::int as blocked_count
            FROM issue_links il
            JOIN link_types lt ON il.link_type_id = lt.id
            JOIN issues i ON il.source_issue_id = i.id
            LEFT JOIN statuses s ON i.status_id = s.id
            WHERE lt.name = 'is_blocked_by'
              AND i.sprint_id = ANY(${sprintIds}::uuid[])
              AND i.deleted_at IS NULL
              AND s.category != 'done'
            GROUP BY i.sprint_id
          `
        : [];

    const blockedMap = new Map(blockedCounts.map((b: any) => [b.sprint_id, Number(b.blocked_count)]));

    return sprints.map((s: any) => {
      const total = Number(s.total_issues);
      const completed = Number(s.completed_issues);
      const inProgress = Number(s.in_progress_issues);
      const blocked = blockedMap.get(s.sprint_id) || 0;
      const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const daysRemaining = s.end_date
        ? Math.max(
            0,
            Math.ceil((new Date(s.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          )
        : 0;

      let healthStatus: 'on_track' | 'at_risk' | 'off_track' = 'on_track';
      if (blocked > 0 || (daysRemaining < 2 && completionPct < 80)) healthStatus = 'off_track';
      else if (daysRemaining < 4 && completionPct < 60) healthStatus = 'at_risk';

      return {
        sprintId: s.sprint_id,
        sprintName: s.sprint_name,
        projectId: s.project_id,
        projectName: s.project_name,
        startDate: s.start_date,
        endDate: s.end_date,
        daysRemaining,
        totalIssues: total,
        completedIssues: completed,
        inProgressIssues: inProgress,
        blockedIssues: blocked,
        completionPercentage: completionPct,
        healthStatus,
      };
    });
  },

  async getRiskIssuesForProjects(projectIds: string[], limit: number = 20): Promise<RiskIssue[]> {
    if (projectIds.length === 0) return [];

    const riskIssues = await prisma.$queryRaw<any[]>`
      SELECT
        i.id,
        i.title,
        i.issue_number,
        i.due_date,
        i.assignee_id,
        i.updated_at,
        s.name as status,
        s.color as status_color,
        pr.name as priority,
        pr.color as priority_color,
        CONCAT(u.first_name, ' ', u.last_name) as assignee_name,
        u.avatar_url as assignee_avatar,
        p.id as project_id,
        p.name as project_name,
        p.key as project_key,
        CASE
          WHEN i.due_date < NOW() THEN 'overdue'
          WHEN i.assignee_id IS NULL THEN 'no_assignee'
          WHEN pr.name IN ('critical', 'urgent', 'blocker') AND i.updated_at < NOW() - INTERVAL '3 days' THEN 'high_priority_stale'
          ELSE 'blocked'
        END as risk_type,
        CASE WHEN i.due_date < NOW() THEN EXTRACT(DAY FROM NOW() - i.due_date)::int ELSE NULL END as days_overdue,
        (
          SELECT COUNT(*)::int FROM issue_links il
          JOIN link_types lt ON il.link_type_id = lt.id
          WHERE il.source_issue_id = i.id AND lt.name = 'is_blocked_by'
        ) as blocked_by_count
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      LEFT JOIN issue_priorities pr ON i.priority_id = pr.id
      LEFT JOIN users u ON i.assignee_id = u.id
      JOIN projects p ON i.project_id = p.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND s.category != 'done'
        AND (
          i.due_date < NOW()
          OR i.assignee_id IS NULL
          OR (pr.name IN ('critical', 'urgent', 'blocker') AND i.updated_at < NOW() - INTERVAL '3 days')
          OR EXISTS (
            SELECT 1 FROM issue_links il2
            JOIN link_types lt2 ON il2.link_type_id = lt2.id
            WHERE il2.source_issue_id = i.id AND lt2.name = 'is_blocked_by'
          )
        )
      ORDER BY
        CASE WHEN i.due_date < NOW() THEN 0 ELSE 1 END,
        i.due_date ASC NULLS LAST
      LIMIT ${limit}
    `;

    return riskIssues.map((r: any) => ({
      id: r.id,
      issueKey: `${r.project_key}-${r.issue_number}`,
      title: r.title,
      riskType: r.risk_type as RiskIssue['riskType'],
      status: r.status,
      statusColor: r.status_color || '#6b7280',
      priority: r.priority || 'medium',
      priorityColor: r.priority_color || '#6b7280',
      dueDate: r.due_date,
      daysOverdue: r.days_overdue !== null ? Number(r.days_overdue) : null,
      assignee: r.assignee_id
        ? { id: r.assignee_id, name: r.assignee_name, avatarUrl: r.assignee_avatar }
        : null,
      projectId: r.project_id,
      projectName: r.project_name,
      blockedByCount: Number(r.blocked_by_count),
    }));
  },

  async getManagerThroughput(projectIds: string[], days: number = 30): Promise<any[]> {
    if (projectIds.length === 0) return [];

    const created = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('week', i.created_at), 'YYYY-MM-DD') as bucket,
        COUNT(*)::int as created
      FROM issues i
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
        AND i.created_at >= NOW() - (${days}::text || ' days')::interval
      GROUP BY bucket ORDER BY bucket ASC
    `;

    const resolved = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('week', i.updated_at), 'YYYY-MM-DD') as bucket,
        COUNT(*)::int as resolved
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
        AND s.category = 'done'
        AND i.updated_at >= NOW() - (${days}::text || ' days')::interval
      GROUP BY bucket ORDER BY bucket ASC
    `;

    const merged = new Map<string, { bucket: string; created: number; resolved: number }>();
    for (const row of created) {
      merged.set(row.bucket, { bucket: row.bucket, created: Number(row.created), resolved: 0 });
    }
    for (const row of resolved) {
      const existing = merged.get(row.bucket) || { bucket: row.bucket, created: 0, resolved: 0 };
      existing.resolved = Number(row.resolved);
      merged.set(row.bucket, existing);
    }
    return Array.from(merged.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
  },

  // ============================================================
  // EMPLOYEE DASHBOARD METHODS
  // ============================================================

  async getMyStats(userId: string): Promise<MyStats> {
    const [assigned] = await prisma.$queryRaw<[any]>`
      SELECT
        COUNT(*) as total_assigned,
        COUNT(*) FILTER (WHERE s.category IN ('in_progress', 'in_review')) as in_progress,
        COUNT(*) FILTER (WHERE s.category = 'done' AND i.updated_at::date = CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE s.category = 'done' AND i.updated_at > NOW() - INTERVAL '7 days') as completed_this_week,
        COUNT(*) FILTER (WHERE i.due_date < NOW() AND s.category != 'done') as overdue_count,
        COUNT(*) FILTER (WHERE i.due_date::date = CURRENT_DATE AND s.category != 'done') as due_today,
        COUNT(*) FILTER (WHERE i.due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND s.category != 'done') as due_this_week
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.assignee_id = ${userId}::uuid
        AND i.deleted_at IS NULL
    `;

    const [timeToday] = await prisma.$queryRaw<[any]>`
      SELECT COALESCE(SUM(hours * 60), 0)::int as minutes_today
      FROM time_logs
      WHERE user_id = ${userId}::uuid
        AND created_at::date = CURRENT_DATE
    `;

    const [timeWeek] = await prisma.$queryRaw<[any]>`
      SELECT COALESCE(SUM(hours * 60), 0)::int as minutes_this_week
      FROM time_logs
      WHERE user_id = ${userId}::uuid
        AND created_at > NOW() - INTERVAL '7 days'
    `;

    return {
      totalAssigned: Number(assigned.total_assigned),
      inProgress: Number(assigned.in_progress),
      completedToday: Number(assigned.completed_today),
      completedThisWeek: Number(assigned.completed_this_week),
      overdueCount: Number(assigned.overdue_count),
      dueTodayCount: Number(assigned.due_today),
      dueThisWeekCount: Number(assigned.due_this_week),
      timeLoggedTodayMinutes: Number(timeToday.minutes_today),
      timeLoggedThisWeekMinutes: Number(timeWeek.minutes_this_week),
    };
  },

  async getMyIssues(userId: string, limit: number = 20): Promise<MyIssueItem[]> {
    const issues = await prisma.$queryRaw<any[]>`
      SELECT
        i.id,
        i.title,
        i.issue_number,
        i.due_date,
        i.story_points,
        i.original_estimate_hours,
        i.updated_at,
        s.name as status,
        s.color as status_color,
        s.category as status_category,
        pr.name as priority,
        pr.color as priority_color,
        p.id as project_id,
        p.name as project_name,
        p.key as project_key,
        sp.name as sprint_name,
        e.name as epic_name,
        COALESCE(tl.logged_hours, 0) as logged_hours
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      LEFT JOIN issue_priorities pr ON i.priority_id = pr.id
      JOIN projects p ON i.project_id = p.id
      LEFT JOIN sprints sp ON i.sprint_id = sp.id
      LEFT JOIN epics e ON i.epic_id = e.id
      LEFT JOIN (
        SELECT issue_id, SUM(hours) as logged_hours
        FROM time_logs GROUP BY issue_id
      ) tl ON tl.issue_id = i.id
      WHERE i.assignee_id = ${userId}::uuid
        AND i.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND s.category != 'done'
      ORDER BY
        CASE WHEN i.due_date < NOW() THEN 0 ELSE 1 END,
        i.due_date ASC NULLS LAST,
        i.updated_at DESC
      LIMIT ${limit}
    `;

    return issues.map((i: any) => {
      const dueDate = i.due_date ? new Date(i.due_date) : null;
      const now = new Date();
      const daysUntilDue = dueDate
        ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: i.id,
        issueKey: `${i.project_key}-${i.issue_number}`,
        title: i.title,
        status: i.status,
        statusColor: i.status_color || '#6b7280',
        statusCategory: i.status_category || 'todo',
        priority: i.priority || 'medium',
        priorityColor: i.priority_color || '#6b7280',
        dueDate: i.due_date,
        daysUntilDue,
        isOverdue: dueDate ? dueDate < now : false,
        projectId: i.project_id,
        projectName: i.project_name,
        sprintName: i.sprint_name,
        epicName: i.epic_name,
        storyPoints: i.story_points !== null ? Number(i.story_points) : null,
        estimatedHours: i.original_estimate_hours !== null
          ? parseFloat(i.original_estimate_hours)
          : null,
        loggedHours: parseFloat(i.logged_hours) || 0,
        updatedAt: i.updated_at,
      };
    });
  },

  async getMySprintContext(userId: string): Promise<MySprintContext[]> {
    const sprints = await prisma.$queryRaw<any[]>`
      SELECT
        s.id as sprint_id,
        s.name as sprint_name,
        s.start_date,
        s.end_date,
        p.id as project_id,
        p.name as project_name,
        COUNT(i.id)::int as total_sprint_issues,
        COUNT(i.id) FILTER (WHERE st.category = 'done')::int as completed_sprint_issues,
        COUNT(i.id) FILTER (WHERE i.assignee_id = ${userId}::uuid)::int as my_issues,
        COUNT(i.id) FILTER (WHERE i.assignee_id = ${userId}::uuid AND st.category = 'done')::int as my_completed
      FROM sprints s
      JOIN projects p ON s.project_id = p.id
      LEFT JOIN issues i ON i.sprint_id = s.id AND i.deleted_at IS NULL
      LEFT JOIN statuses st ON i.status_id = st.id
      WHERE s.status = 'active'
        AND p.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM issues mi
          WHERE mi.sprint_id = s.id
            AND mi.assignee_id = ${userId}::uuid
            AND mi.deleted_at IS NULL
        )
      GROUP BY s.id, s.name, s.start_date, s.end_date, p.id, p.name
    `;

    return sprints.map((s: any) => {
      const total = Number(s.total_sprint_issues);
      const completed = Number(s.completed_sprint_issues);
      const daysRemaining = s.end_date
        ? Math.max(
            0,
            Math.ceil((new Date(s.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          )
        : 0;

      return {
        sprintId: s.sprint_id,
        sprintName: s.sprint_name,
        projectId: s.project_id,
        projectName: s.project_name,
        startDate: s.start_date,
        endDate: s.end_date,
        daysRemaining,
        completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        myIssuesInSprint: Number(s.my_issues),
        myCompletedInSprint: Number(s.my_completed),
      };
    });
  },

  async getMyPerformance(userId: string, weeks: number = 8): Promise<MyPerformancePoint[]> {
    const completed = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('week', i.updated_at), 'YYYY-MM-DD') as week,
        COUNT(*)::int as completed
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.assignee_id = ${userId}::uuid
        AND i.deleted_at IS NULL
        AND s.category = 'done'
        AND i.updated_at >= NOW() - (${weeks * 7}::text || ' days')::interval
      GROUP BY week ORDER BY week ASC
    `;

    const timeLogged = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as week,
        COALESCE(SUM(hours * 60), 0)::int as minutes
      FROM time_logs
      WHERE user_id = ${userId}::uuid
        AND created_at >= NOW() - (${weeks * 7}::text || ' days')::interval
      GROUP BY week ORDER BY week ASC
    `;

    const merged = new Map<string, { week: string; completed: number; timeLoggedMinutes: number }>();
    for (const row of completed) {
      merged.set(row.week, { week: row.week, completed: Number(row.completed), timeLoggedMinutes: 0 });
    }
    for (const row of timeLogged) {
      const existing = merged.get(row.week) || { week: row.week, completed: 0, timeLoggedMinutes: 0 };
      existing.timeLoggedMinutes = Number(row.minutes);
      merged.set(row.week, existing);
    }
    return Array.from(merged.values()).sort((a, b) => a.week.localeCompare(b.week));
  },

  // ============================================================
  // CHART DATA METHODS
  // ============================================================

  async getGanttChartItems(
    projectIds: string[],
    filters: { assigneeId?: string; sprintId?: string; epicId?: string } = {}
  ): Promise<GanttItem[]> {
    if (projectIds.length === 0) return [];

    const _assigneeFilter = filters.assigneeId
      ? `AND i.assignee_id = '${filters.assigneeId}'::uuid`
      : '';
    const _sprintFilter = filters.sprintId
      ? `AND i.sprint_id = '${filters.sprintId}'::uuid`
      : '';
    const _epicFilter = filters.epicId ? `AND i.epic_id = '${filters.epicId}'::uuid` : '';

    const items = await prisma.$queryRaw<any[]>`
      SELECT
        i.id,
        i.title,
        i.issue_number,
        i.start_date,
        i.due_date,
        i.story_points,
        i.original_estimate_hours,
        i.parent_id,
        i.epic_id,
        i.assignee_id,
        i.sprint_id,
        s.name as status,
        s.color as status_color,
        s.category as status_category,
        pr.name as priority,
        pr.color as priority_color,
        CONCAT(u.first_name, ' ', u.last_name) as assignee_name,
        u.avatar_url as assignee_avatar,
        p.id as project_id,
        p.name as project_name,
        p.key as project_key,
        sp.name as sprint_name,
        sp.start_date as sprint_start,
        sp.end_date as sprint_end,
        e.name as epic_name,
        it.name as type_name,
        it.icon as type_icon,
        COALESCE(tl.logged_hours, 0) as logged_hours
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      LEFT JOIN issue_priorities pr ON i.priority_id = pr.id
      LEFT JOIN users u ON i.assignee_id = u.id
      JOIN projects p ON i.project_id = p.id
      LEFT JOIN sprints sp ON i.sprint_id = sp.id
      LEFT JOIN epics e ON i.epic_id = e.id
      LEFT JOIN issue_types it ON i.type_id = it.id
      LEFT JOIN (
        SELECT issue_id, SUM(hours) as logged_hours
        FROM time_logs GROUP BY issue_id
      ) tl ON tl.issue_id = i.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND i.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (i.due_date IS NOT NULL OR i.start_date IS NOT NULL OR i.sprint_id IS NOT NULL)
      ORDER BY i.start_date ASC NULLS LAST, i.due_date ASC NULLS LAST
      LIMIT 300
    `;

    const issueIds = items.map((i: any) => i.id);
    const dependencies =
      issueIds.length > 0
        ? await prisma.$queryRaw<any[]>`
            SELECT
              il.source_issue_id,
              il.target_issue_id,
              lt.name as link_type,
              CONCAT(tp.key, '-', ti.issue_number) as target_key
            FROM issue_links il
            JOIN link_types lt ON il.link_type_id = lt.id
            JOIN issues ti ON il.target_issue_id = ti.id
            JOIN projects tp ON ti.project_id = tp.id
            WHERE il.source_issue_id = ANY(${issueIds}::uuid[])
              AND lt.name IN ('blocks', 'is_blocked_by')
          `
        : [];

    const depMap = new Map<string, { id: string; issueKey: string; linkType: string }[]>();
    for (const dep of dependencies) {
      const existing = depMap.get(dep.source_issue_id) || [];
      existing.push({
        id: dep.target_issue_id,
        issueKey: dep.target_key,
        linkType: dep.link_type,
      });
      depMap.set(dep.source_issue_id, existing);
    }

    const now = new Date();
    return items.map((i: any) => {
      const startDate = i.start_date || i.sprint_start || i.due_date;
      const endDate = i.due_date || i.sprint_end;
      const estimated = i.original_estimate_hours ? parseFloat(i.original_estimate_hours) : null;
      const logged = parseFloat(i.logged_hours) || 0;
      const progress =
        estimated && estimated > 0 ? Math.min(100, Math.round((logged / estimated) * 100)) : 0;

      return {
        id: i.id,
        issueKey: `${i.project_key}-${i.issue_number}`,
        title: i.title,
        startDate,
        endDate,
        status: i.status,
        statusColor: i.status_color || '#6b7280',
        statusCategory: i.status_category || 'todo',
        priority: i.priority || 'medium',
        priorityColor: i.priority_color || '#6b7280',
        assignee: i.assignee_id
          ? { id: i.assignee_id, name: i.assignee_name, avatarUrl: i.assignee_avatar }
          : null,
        projectId: i.project_id,
        projectName: i.project_name,
        projectKey: i.project_key,
        sprintId: i.sprint_id,
        sprintName: i.sprint_name,
        epicId: i.epic_id,
        epicName: i.epic_name,
        issueTypeName: i.type_name || 'Task',
        issueTypeIcon: i.type_icon || 'circle',
        storyPoints: i.story_points !== null ? Number(i.story_points) : null,
        estimatedHours: estimated,
        loggedHours: logged,
        dependencies: depMap.get(i.id) || [],
        progress,
        isOverdue: endDate ? new Date(endDate) < now : false,
        parentId: i.parent_id,
      };
    });
  },

  async getSprintsForGantt(projectIds: string[]): Promise<any[]> {
    if (projectIds.length === 0) return [];
    return prisma.$queryRaw<any[]>`
      SELECT id, name, start_date, end_date, status
      FROM sprints
      WHERE project_id = ANY(${projectIds}::uuid[])
        AND status IN ('active', 'planned')
      ORDER BY start_date ASC
    `;
  },

  async getVelocityChartData(projectId: string, limit: number = 10): Promise<VelocityPoint[]> {
    const sprints = await prisma.$queryRaw<any[]>`
      SELECT
        s.id as sprint_id,
        s.name as sprint_name,
        s.start_date,
        s.end_date,
        COUNT(i.id)::int as committed_issues,
        COUNT(i.id) FILTER (WHERE st.category = 'done')::int as completed_issues,
        COALESCE(SUM(i.story_points), 0)::int as committed_points,
        COALESCE(SUM(i.story_points) FILTER (WHERE st.category = 'done'), 0)::int as completed_points
      FROM sprints s
      LEFT JOIN issues i ON i.sprint_id = s.id AND i.deleted_at IS NULL
      LEFT JOIN statuses st ON i.status_id = st.id
      WHERE s.project_id = ${projectId}::uuid
        AND s.status IN ('active', 'completed')
      GROUP BY s.id, s.name, s.start_date, s.end_date
      ORDER BY s.start_date DESC
      LIMIT ${limit}
    `;

    return sprints.reverse().map((s: any) => {
      const committed = Number(s.committed_issues);
      const completed = Number(s.completed_issues);
      const committedPts = Number(s.committed_points) || null;
      const completedPts = Number(s.completed_points) || null;

      return {
        sprintId: s.sprint_id,
        sprintName: s.sprint_name,
        startDate: s.start_date,
        endDate: s.end_date,
        committedIssues: committed,
        completedIssues: completed,
        committedPoints: committedPts,
        completedPoints: completedPts,
        completionRate: committed > 0 ? Math.round((completed / committed) * 100) : 0,
      };
    });
  },

  async getBurndownChartData(sprintId: string): Promise<BurndownChartData | null> {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint || !sprint.startDate || !sprint.endDate) return null;

    // Get daily metrics from sprint_metrics table
    const metrics = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(date, 'YYYY-MM-DD') as date,
        total_issues,
        completed_issues,
        total_story_points,
        completed_story_points
      FROM sprint_metrics
      WHERE sprint_id = ${sprintId}::uuid
      ORDER BY date ASC
    `;

    // Also get current sprint totals as fallback
    const [totals] = await prisma.$queryRaw<[any]>`
      SELECT
        COUNT(*)::int as total_issues,
        COUNT(*) FILTER (WHERE st.category = 'done')::int as completed_issues,
        COALESCE(SUM(i.story_points), 0)::int as total_points,
        COALESCE(SUM(i.story_points) FILTER (WHERE st.category = 'done'), 0)::int as completed_points
      FROM issues i
      LEFT JOIN statuses st ON i.status_id = st.id
      WHERE i.sprint_id = ${sprintId}::uuid AND i.deleted_at IS NULL
    `;

    const totalIssues = Number(totals.total_issues);
    const completedIssues = Number(totals.completed_issues);
    const totalPoints = Number(totals.total_points) || null;
    const completedPoints = Number(totals.completed_points) || null;

    // Build burndown points from metrics or generate ideal line
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const totalDays = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const metricsMap = new Map(metrics.map((m: any) => [m.date, m]));
    const points: BurndownPoint[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Use story points for ideal line (fall back to issue count if no points)
    const effectiveTotalPoints = totalPoints ?? totalIssues;
    const pointsPerDay = effectiveTotalPoints / totalDays;

    let lastKnownRemainingIssues = totalIssues;
    let lastKnownRemainingPoints = effectiveTotalPoints;

    for (let d = 0; d <= totalDays; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      const metric = metricsMap.get(dateStr);
      const isFuture = dateStr > todayStr;
      const idealRemaining = Math.round(Math.max(0, effectiveTotalPoints - (pointsPerDay * d)) * 10) / 10;

      let remainingIssues: number | null = null;
      let remainingPoints: number | null = null;

      if (metric) {
        remainingIssues = Number(metric.total_issues) - Number(metric.completed_issues);
        remainingPoints = totalPoints
          ? Number(metric.total_story_points) - Number(metric.completed_story_points)
          : remainingIssues;
        lastKnownRemainingIssues = remainingIssues;
        lastKnownRemainingPoints = remainingPoints;
      } else if (dateStr === todayStr) {
        remainingIssues = totalIssues - completedIssues;
        remainingPoints = totalPoints != null ? totalPoints - (completedPoints ?? 0) : remainingIssues;
        lastKnownRemainingIssues = remainingIssues;
        lastKnownRemainingPoints = remainingPoints;
      } else if (!isFuture) {
        remainingIssues = lastKnownRemainingIssues; // carry forward
        remainingPoints = lastKnownRemainingPoints;
      }
      // Future: stays null

      points.push({
        date: dateStr,
        remainingIssues: remainingIssues ?? 0,
        remainingPoints: remainingIssues !== null ? remainingPoints : null,
        idealRemaining,
      });
    }

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      startDate: sprint.startDate.toISOString(),
      endDate: sprint.endDate.toISOString(),
      totalIssues,
      completedIssues,
      totalPoints,
      completedPoints,
      points,
    };
  },

  async getCumulativeFlowData(projectId: string, days: number = 30): Promise<CumulativeFlowPoint[]> {
    // Get issue status transitions from activity logs to reconstruct historical state
    const transitions = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(a.created_at::date, 'YYYY-MM-DD') as date,
        s_new.category as new_category,
        s_old.category as old_category,
        COUNT(*)::int as count
      FROM activity_logs a
      JOIN issues i ON a.issue_id = i.id
      LEFT JOIN statuses s_new ON a.new_value = s_new.id::text
      LEFT JOIN statuses s_old ON a.old_value = s_old.id::text
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
        AND a.field_name = 'status_id'
        AND a.created_at >= NOW() - (${days}::text || ' days')::interval
      GROUP BY date, new_category, old_category
      ORDER BY date ASC
    `;

    // Get issues created within the range (new issues add to a category)
    const issueCreations = await prisma.$queryRaw<any[]>`
      SELECT
        to_char(i.created_at::date, 'YYYY-MM-DD') as date,
        COALESCE(s.category, 'todo') as category,
        COUNT(*)::int as count
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
        AND i.created_at >= NOW() - (${days}::text || ' days')::interval
      GROUP BY date, category
      ORDER BY date ASC
    `;

    // Get the current snapshot as the known "today" state
    const [current] = await prisma.$queryRaw<[any]>`
      SELECT
        COUNT(*) FILTER (WHERE s.category = 'todo')::int as todo,
        COUNT(*) FILTER (WHERE s.category = 'in_progress')::int as in_progress,
        COUNT(*) FILTER (WHERE s.category = 'in_review')::int as in_review,
        COUNT(*) FILTER (WHERE s.category = 'done')::int as done
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
    `;

    // Build date list from (today - days) to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateList: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dateList.push(d.toISOString().split('T')[0]);
    }

    type Cats = 'todo' | 'in_progress' | 'in_review' | 'done';
    const validCats: Cats[] = ['todo', 'in_progress', 'in_review', 'done'];
    const normCat = (c: string | null): Cats => {
      if (!c) return 'todo';
      if (validCats.includes(c as Cats)) return c as Cats;
      return 'todo';
    };

    // Build per-day deltas: transitions move counts between categories,
    // creations add to a category. We walk backwards from today.
    // deltaMap[date][category] = net change on that date
    // A transition from old→new means: new_category += count, old_category -= count
    // A creation means: category += count
    const deltaMap: Record<string, Record<Cats, number>> = {};
    const ensureDate = (date: string) => {
      if (!deltaMap[date]) deltaMap[date] = { todo: 0, in_progress: 0, in_review: 0, done: 0 };
    };

    for (const t of transitions) {
      const date = t.date as string;
      const newCat = normCat(t.new_category);
      const oldCat = normCat(t.old_category);
      const count = Number(t.count);
      ensureDate(date);
      // Transition: moved INTO new_category, moved OUT OF old_category
      deltaMap[date][newCat] += count;
      if (t.old_category) {
        deltaMap[date][oldCat] -= count;
      }
    }

    for (const c of issueCreations) {
      const date = c.date as string;
      const cat = normCat(c.category);
      const count = Number(c.count);
      ensureDate(date);
      deltaMap[date][cat] += count;
    }

    // Start from today's known snapshot and walk backwards to reconstruct each day.
    // snapshot[day] = snapshot[day+1] - delta[day+1]
    // (Reversing the deltas: to get yesterday, undo today's changes)
    const snapshots: Record<string, Record<Cats, number>> = {};
    const todayStr = dateList[dateList.length - 1];
    snapshots[todayStr] = {
      todo: Number(current.todo),
      in_progress: Number(current.in_progress),
      in_review: Number(current.in_review),
      done: Number(current.done),
    };

    for (let i = dateList.length - 2; i >= 0; i--) {
      const nextDay = dateList[i + 1];
      const thisDay = dateList[i];
      const nextSnap = snapshots[nextDay];
      const delta = deltaMap[nextDay]; // changes that happened on nextDay

      snapshots[thisDay] = {
        todo: Math.max(0, nextSnap.todo - (delta?.todo ?? 0)),
        in_progress: Math.max(0, nextSnap.in_progress - (delta?.in_progress ?? 0)),
        in_review: Math.max(0, nextSnap.in_review - (delta?.in_review ?? 0)),
        done: Math.max(0, nextSnap.done - (delta?.done ?? 0)),
      };
    }

    // Build final result array
    const result: CumulativeFlowPoint[] = dateList.map((date) => {
      const snap = snapshots[date] || { todo: 0, in_progress: 0, in_review: 0, done: 0 };
      return {
        date,
        todo: snap.todo,
        inProgress: snap.in_progress,
        inReview: snap.in_review,
        done: snap.done,
      };
    });

    return result;
  },

  mapDashboardShare(row: any): DashboardShare {
    return {
      id: row.id,
      dashboardPreferencesId: row.dashboardPreferencesId ?? row.dashboard_preferences_id,
      ownerId: row.ownerId ?? row.owner_id,
      sharedWithUserId: row.sharedWithUserId ?? row.shared_with_user_id,
      isPublic: row.isPublic ?? row.is_public,
      publicLinkToken: row.publicLinkToken ?? row.public_link_token,
      permission: row.permission,
      expiresAt: row.expiresAt ?? row.expires_at,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  },
};
