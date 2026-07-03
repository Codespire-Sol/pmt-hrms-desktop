import { prisma } from '../../database/prisma';
import {
  SprintVelocity,
  BurndownDataPoint,
  TeamMemberWorkload,
  TimeLogEntry,
  TimeByUser,
  TimeByProject,
  TimeByIssue,
  IssueDistribution,
  CFDDataPoint,
  CFDStatusInfo,
  CycleTimeDataPoint,
  CycleTimeByStatus,
} from './reports.types';

export const reportsRepository = {
  // Get sprint velocity history for a project
  async getSprintVelocityHistory(
    projectId: string,
    limit: number = 10
  ): Promise<SprintVelocity[]> {
    const sprints = await prisma.$queryRaw<any[]>`
      SELECT
        s.id,
        s.name,
        s.start_date,
        s.end_date,
        COALESCE(
          SUM(
            CASE
              WHEN st.category = 'done' THEN COALESCE(i.story_points, 0)
              ELSE 0
            END
          ),
          0
        ) AS completed_points,
        COALESCE(SUM(COALESCE(i.story_points, 0)), 0) AS committed_points,
        COUNT(CASE WHEN st.category = 'done' THEN 1 END) AS completed_issues,
        COUNT(i.id) AS total_issues
      FROM sprints s
      LEFT JOIN issues i ON s.id = i.sprint_id AND i.deleted_at IS NULL
      LEFT JOIN statuses st ON i.status_id = st.id
      WHERE s.project_id = ${projectId}::uuid
      GROUP BY s.id, s.name, s.start_date, s.end_date, s.sequence, s.created_at
      ORDER BY s.sequence DESC, s.created_at DESC
      LIMIT ${limit}
    `;

    return sprints.map((s: any) => ({
      sprintId: s.id,
      sprintName: s.name,
      startDate: s.start_date,
      endDate: s.end_date,
      committedPoints: Number(s.committed_points) || 0,
      completedPoints: Number(s.completed_points) || 0,
      completedIssues: Number(s.completed_issues) || 0,
      totalIssues: Number(s.total_issues) || 0,
      velocity: Number(s.completed_points) || 0,
    }));
  },

  // Get burndown data for a sprint
  async getSprintBurndown(sprintId: string): Promise<{
    sprint: any;
    dataPoints: BurndownDataPoint[];
  } | null> {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });

    if (!sprint) return null;

    // Get total points in sprint
    const [pointsResult] = await prisma.$queryRaw<[any]>`
      SELECT COALESCE(SUM(COALESCE(i.story_points, 0)), 0) as total_points
      FROM issues i
      WHERE i.sprint_id = ${sprintId}::uuid
    `;

    const totalPoints = parseInt(pointsResult.total_points, 10);

    // Generate date range
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const today = new Date();
    const dataPoints: BurndownDataPoint[] = [];

    // Calculate ideal burndown and actual progress
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const pointsPerDay = totalPoints / totalDays;

    // Get completed points per day
    const completedByDay = await prisma.$queryRaw<any[]>`
      SELECT
        DATE(i.updated_at) as completion_date,
        COALESCE(SUM(COALESCE(i.story_points, 0)), 0) as points
      FROM issues i
      LEFT JOIN statuses st ON i.status_id = st.id
      WHERE i.sprint_id = ${sprintId}::uuid
        AND st.name IN ('done', 'closed')
      GROUP BY DATE(i.updated_at)
      ORDER BY completion_date
    `;

    const completedMap = new Map(
      completedByDay.map((c: any) => [c.completion_date, parseInt(c.points, 10)])
    );

    let cumulativeCompleted = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate && currentDate <= today) {
      const dayIndex = Math.ceil(
        (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const dateStr = currentDate.toISOString().split('T')[0];

      // Add completed points for this day
      const dayCompleted = completedMap.get(dateStr) || 0;
      cumulativeCompleted += dayCompleted as number;

      dataPoints.push({
        date: dateStr,
        idealRemaining: Math.max(0, totalPoints - pointsPerDay * dayIndex),
        actualRemaining: totalPoints - cumulativeCompleted,
        completedPoints: cumulativeCompleted,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      sprint: {
        ...sprint,
        totalPoints,
      },
      dataPoints,
    };
  },

  // Get team workload for a project
  async getTeamWorkload(
    projectId: string,
    startDate: string,
    endDate: string
  ): Promise<TeamMemberWorkload[]> {
    const members = await prisma.$queryRaw<any[]>`
      SELECT
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as display_name,
        u.avatar_url,
        COUNT(DISTINCT i.id) as assigned_issues,
        COUNT(DISTINCT CASE WHEN st.name IN ('done', 'closed') THEN i.id END) as completed_issues,
        COUNT(DISTINCT CASE WHEN st.name IN ('in_progress', 'in_review') THEN i.id END) as in_progress_issues,
        COALESCE(SUM(DISTINCT COALESCE(i.story_points, 0)), 0) as total_points,
        COALESCE(SUM(DISTINCT CASE WHEN st.name IN ('done', 'closed') THEN COALESCE(i.story_points, 0) ELSE 0 END), 0) as completed_points,
        COALESCE(SUM(t.hours), 0) * 60 as hours_logged,
        COUNT(DISTINCT CASE WHEN i.due_date < NOW() AND st.name NOT IN ('done', 'closed', 'cancelled') THEN i.id END) as overdue_issues
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      LEFT JOIN issues i ON i.assignee_id = u.id AND i.project_id = pm.project_id
      LEFT JOIN statuses st ON i.status_id = st.id
      LEFT JOIN time_logs t ON t.user_id = u.id AND t.issue_id = i.id AND t.work_date BETWEEN ${startDate}::date AND ${endDate}::date
      WHERE pm.project_id = ${projectId}::uuid
      GROUP BY u.id
      ORDER BY assigned_issues DESC
    `;

    return members.map((m: any) => ({
      userId: m.id,
      displayName: m.display_name,
      avatarUrl: m.avatar_url,
      assignedIssues: parseInt(m.assigned_issues, 10),
      completedIssues: parseInt(m.completed_issues, 10),
      inProgressIssues: parseInt(m.in_progress_issues, 10),
      totalPoints: parseInt(m.total_points, 10),
      completedPoints: parseInt(m.completed_points, 10),
      hoursLogged: Math.round(parseInt(m.hours_logged, 10) / 60 * 10) / 10,
      overdueIssues: parseInt(m.overdue_issues, 10),
    }));
  },

  // Get time tracking report
  async getTimeTrackingReport(
    userId: string,
    startDate: string,
    endDate: string,
    projectId?: string
  ): Promise<{
    byUser: TimeByUser[];
    byProject: TimeByProject[];
    byIssue: TimeByIssue[];
    recentLogs: TimeLogEntry[];
    totalMinutes: number;
    totalLogs: number;
  }> {
    // Get user's projects
    let projectIds: string[];
    if (projectId) {
      projectIds = [projectId];
    } else {
      const members = await prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      projectIds = members.map((m) => m.projectId);
    }

    if (projectIds.length === 0) {
      return {
        byUser: [],
        byProject: [],
        byIssue: [],
        recentLogs: [],
        totalMinutes: 0,
        totalLogs: 0,
      };
    }

    // Time by user
    const byUser = await prisma.$queryRaw<any[]>`
      SELECT
        u.id as user_id,
        CONCAT(u.first_name, ' ', u.last_name) as display_name,
        u.avatar_url,
        SUM(t.hours) * 60 as total_minutes,
        COUNT(t.id) as log_count
      FROM time_logs t
      JOIN issues i ON t.issue_id = i.id
      JOIN users u ON t.user_id = u.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND t.work_date BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY u.id
      ORDER BY total_minutes DESC
    `;

    // Time by project
    const byProject = await prisma.$queryRaw<any[]>`
      SELECT
        p.id as project_id,
        p.name as project_name,
        p.key as project_key,
        SUM(t.hours) * 60 as total_minutes,
        COUNT(t.id) as log_count
      FROM time_logs t
      JOIN issues i ON t.issue_id = i.id
      JOIN projects p ON i.project_id = p.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND t.work_date BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY p.id
      ORDER BY total_minutes DESC
    `;

    // Time by issue
    const byIssue = await prisma.$queryRaw<any[]>`
      SELECT
        i.id as issue_id,
        CONCAT(p.key, '-', i.issue_number) as issue_key,
        i.title as issue_title,
        i.project_id,
        ROUND(i.original_estimate_hours * 60) as estimated_minutes,
        SUM(t.hours) * 60 as total_minutes,
        COUNT(t.id) as log_count
      FROM time_logs t
      JOIN issues i ON t.issue_id = i.id
      JOIN projects p ON i.project_id = p.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND t.work_date BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY i.id, p.key
      ORDER BY total_minutes DESC
      LIMIT 20
    `;

    // Recent logs
    const recentLogs = await prisma.$queryRaw<any[]>`
      SELECT
        t.id,
        t.user_id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        i.id as issue_id,
        CONCAT(p.key, '-', i.issue_number) as issue_key,
        i.title as issue_title,
        p.id as project_id,
        p.name as project_name,
        ROUND(t.hours * 60) as duration_minutes,
        t.description,
        t.work_date as logged_at,
        t.created_at
      FROM time_logs t
      JOIN issues i ON t.issue_id = i.id
      JOIN projects p ON i.project_id = p.id
      JOIN users u ON t.user_id = u.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND t.work_date BETWEEN ${startDate}::date AND ${endDate}::date
      ORDER BY t.work_date DESC
      LIMIT 50
    `;

    // Totals
    const [totals] = await prisma.$queryRaw<[any]>`
      SELECT
        COALESCE(SUM(t.hours), 0) * 60 as total_minutes,
        COUNT(t.id) as total_logs
      FROM time_logs t
      JOIN issues i ON t.issue_id = i.id
      WHERE i.project_id = ANY(${projectIds}::uuid[])
        AND t.work_date BETWEEN ${startDate}::date AND ${endDate}::date
    `;

    return {
      byUser: byUser.map((u: any) => ({
        userId: u.user_id,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        totalMinutes: parseInt(u.total_minutes, 10),
        logCount: parseInt(u.log_count, 10),
      })),
      byProject: byProject.map((p: any) => ({
        projectId: p.project_id,
        projectName: p.project_name,
        projectKey: p.project_key,
        totalMinutes: parseInt(p.total_minutes, 10),
        logCount: parseInt(p.log_count, 10),
      })),
      byIssue: byIssue.map((i: any) => ({
        issueId: i.issue_id,
        issueKey: i.issue_key,
        issueTitle: i.issue_title,
        projectId: i.project_id,
        totalMinutes: parseInt(i.total_minutes, 10),
        estimatedMinutes: i.estimated_minutes ? parseInt(i.estimated_minutes, 10) : null,
        logCount: parseInt(i.log_count, 10),
      })),
      recentLogs: recentLogs.map((l: any) => ({
        id: l.id,
        userId: l.user_id,
        userName: l.user_name,
        issueId: l.issue_id,
        issueKey: l.issue_key,
        issueTitle: l.issue_title,
        projectId: l.project_id,
        projectName: l.project_name,
        durationMinutes: l.duration_minutes,
        description: l.description,
        loggedAt: l.logged_at,
        createdAt: l.created_at,
      })),
      totalMinutes: parseInt(totals.total_minutes, 10),
      totalLogs: parseInt(totals.total_logs, 10),
    };
  },

  // Get issue distribution for a project
  async getIssueDistribution(projectId: string): Promise<{
    byStatus: IssueDistribution[];
    byPriority: IssueDistribution[];
    byType: IssueDistribution[];
    byAssignee: IssueDistribution[];
  }> {
    // Total count
    const totalCount = await prisma.issue.count({
      where: { projectId },
    });

    if (totalCount === 0) {
      return {
        byStatus: [],
        byPriority: [],
        byType: [],
        byAssignee: [],
      };
    }

    // By status
    const byStatus = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(s.display_name, s.name, 'Unknown') as label,
        COALESCE(s.name, 'unknown') as value,
        s.color,
        COUNT(*) as count
      FROM issues i
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.project_id = ${projectId}::uuid
      GROUP BY s.id, s.display_name, s.name, s.color
      ORDER BY count DESC
    `;

    // By priority
    const byPriority = await prisma.$queryRaw<any[]>`
      SELECT i.priority as label, i.priority as value, p.color, COUNT(*) as count
      FROM issues i
      LEFT JOIN priorities p ON i.priority = p.name
      WHERE i.project_id = ${projectId}::uuid
      GROUP BY i.priority, p.color
      ORDER BY count DESC
    `;

    // By type
    const byType = await prisma.$queryRaw<any[]>`
      SELECT i.type as label, i.type as value, t.color, COUNT(*) as count
      FROM issues i
      LEFT JOIN issue_types t ON i.type = t.name
      WHERE i.project_id = ${projectId}::uuid
      GROUP BY i.type, t.color
      ORDER BY count DESC
    `;

    // By assignee
    const byAssignee = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Unassigned') as label,
        COALESCE(u.id::text, 'unassigned') as value,
        NULL as color,
        COUNT(*) as count
      FROM issues i
      LEFT JOIN users u ON i.assignee_id = u.id
      WHERE i.project_id = ${projectId}::uuid
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY count DESC
    `;

    const mapDistribution = (rows: any[]): IssueDistribution[] =>
      rows.map((r) => ({
        label: r.label || 'Unknown',
        value: r.value || 'unknown',
        count: parseInt(r.count, 10),
        percentage: Math.round((parseInt(r.count, 10) / totalCount) * 100),
        color: r.color,
      }));

    return {
      byStatus: mapDistribution(byStatus),
      byPriority: mapDistribution(byPriority),
      byType: mapDistribution(byType),
      byAssignee: mapDistribution(byAssignee),
    };
  },

  // Get estimate vs actual comparison data
  async getEstimateActualComparison(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    issues: any[];
    byIssueType: any[];
    byUser: any[];
  }> {
    const conditions: string[] = [
      `i.project_id = $1::uuid`,
      `i.deleted_at IS NULL`,
      `i.original_estimate_hours IS NOT NULL`,
      `i.original_estimate_hours > 0`,
    ];
    const params: any[] = [projectId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`i.created_at >= $${paramIndex}::date`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`i.created_at <= $${paramIndex}::date`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Issues
    const issues = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        i.id as issue_id,
        p.key || '-' || i.issue_number as issue_key,
        i.title as issue_title,
        it.display_name as issue_type,
        s.display_name as status,
        i.original_estimate_hours as estimated_hours,
        i.time_spent_hours as actual_hours,
        i.remaining_estimate_hours as remaining_hours,
        u.id as assignee_id,
        u.first_name || ' ' || u.last_name as assignee_name,
        u.avatar_url as assignee_avatar
      FROM issues i
      LEFT JOIN issue_types it ON i.type_id = it.id
      LEFT JOIN statuses s ON i.status_id = s.id
      LEFT JOIN users u ON i.assignee_id = u.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC`,
      ...params
    );

    // Aggregate by issue type
    const byIssueType = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        it.display_name as issue_type,
        SUM(i.original_estimate_hours) as total_estimated,
        SUM(COALESCE(i.time_spent_hours, 0)) as total_actual,
        COUNT(i.id) as issue_count
      FROM issues i
      LEFT JOIN issue_types it ON i.type_id = it.id
      WHERE ${whereClause}
      GROUP BY it.id, it.display_name`,
      ...params
    );

    // Aggregate by user
    const byUser = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        u.id as user_id,
        u.first_name || ' ' || u.last_name as display_name,
        u.avatar_url,
        SUM(i.original_estimate_hours) as total_estimated,
        SUM(COALESCE(i.time_spent_hours, 0)) as total_actual,
        COUNT(i.id) as issue_count
      FROM issues i
      LEFT JOIN users u ON i.assignee_id = u.id
      WHERE ${whereClause}
        AND i.assignee_id IS NOT NULL
      GROUP BY u.id, u.first_name, u.last_name, u.avatar_url`,
      ...params
    );

    return {
      issues: issues.map((i: any) => ({
        issueId: i.issue_id,
        issueKey: i.issue_key,
        issueTitle: i.issue_title,
        issueType: i.issue_type || 'Unknown',
        status: i.status || 'Unknown',
        estimatedHours: parseFloat(i.estimated_hours) || 0,
        actualHours: parseFloat(i.actual_hours) || 0,
        remainingHours: parseFloat(i.remaining_hours) || 0,
        assignee: i.assignee_id
          ? {
              id: i.assignee_id,
              displayName: i.assignee_name,
              avatarUrl: i.assignee_avatar,
            }
          : null,
      })),
      byIssueType: byIssueType.map((t: any) => ({
        issueType: t.issue_type || 'Unknown',
        totalEstimated: parseFloat(t.total_estimated) || 0,
        totalActual: parseFloat(t.total_actual) || 0,
        issueCount: parseInt(t.issue_count, 10),
      })),
      byUser: byUser.map((u: any) => ({
        userId: u.user_id,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        totalEstimated: parseFloat(u.total_estimated) || 0,
        totalActual: parseFloat(u.total_actual) || 0,
        issueCount: parseInt(u.issue_count, 10),
      })),
    };
  },

  // Get Cumulative Flow Diagram data
  async getCumulativeFlowData(
    projectId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    statuses: CFDStatusInfo[];
    dataPoints: CFDDataPoint[];
  }> {
    // Get all statuses for the project
    const statuses = await prisma.$queryRaw<any[]>`
      SELECT id, name, display_name, color, category
      FROM statuses
      WHERE project_id = ${projectId}::uuid
        AND deleted_at IS NULL
      ORDER BY position ASC
    `;

    const statusInfos: CFDStatusInfo[] = statuses.map((s: any) => ({
      statusId: s.id,
      statusName: s.name,
      displayName: s.display_name,
      color: s.color || '#6b7280',
      category: s.category,
    }));

    // Get all issue status changes from history
    const statusChanges = await prisma.$queryRaw<any[]>`
      SELECT
        ih.issue_id,
        ih.old_value,
        ih.new_value,
        DATE(ih.created_at) as change_date
      FROM issue_history ih
      JOIN issues i ON ih.issue_id = i.id
      WHERE i.project_id = ${projectId}::uuid
        AND ih.field_name = 'status_id'
        AND ih.created_at BETWEEN ${startDate}::date AND (${endDate}::date + interval '1 day' - interval '1 second')
      ORDER BY ih.created_at ASC
    `;

    // Get initial issue counts per status at start date
    const initialCounts = await prisma.$queryRaw<any[]>`
      SELECT status_id, COUNT(id) as count
      FROM issues
      WHERE project_id = ${projectId}::uuid
        AND deleted_at IS NULL
        AND created_at < ${startDate}::date
      GROUP BY status_id
    `;

    const statusCountMap = new Map<string, number>();
    for (const s of statuses) {
      statusCountMap.set(s.id, 0);
    }
    for (const ic of initialCounts) {
      if (ic.status_id) {
        statusCountMap.set(ic.status_id as string, parseInt(ic.count as string, 10));
      }
    }

    // Generate date range
    const dataPoints: CFDDataPoint[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    const effectiveEnd = end < today ? end : today;

    // Build a map of changes by date
    const changesByDate = new Map<string, { from: string | null; to: string }[]>();
    for (const change of statusChanges) {
      const dateKey = change.change_date;
      if (!changesByDate.has(dateKey)) {
        changesByDate.set(dateKey, []);
      }
      changesByDate.get(dateKey)!.push({
        from: change.old_value,
        to: change.new_value,
      });
    }

    // Get issues created in the date range
    const issuesCreatedInRange = await prisma.$queryRaw<any[]>`
      SELECT id, status_id, DATE(created_at) as create_date
      FROM issues
      WHERE project_id = ${projectId}::uuid
        AND deleted_at IS NULL
        AND created_at BETWEEN ${startDate}::date AND (${endDate}::date + interval '1 day' - interval '1 second')
    `;

    const creationsByDate = new Map<string, string[]>();
    for (const issue of issuesCreatedInRange) {
      const dateKey = issue.create_date;
      if (!creationsByDate.has(dateKey)) {
        creationsByDate.set(dateKey, []);
      }
      creationsByDate.get(dateKey)!.push(issue.status_id);
    }

    // Clone initial counts for cumulative tracking
    const cumulativeCounts = new Map(statusCountMap);

    const currentDate = new Date(start);
    while (currentDate <= effectiveEnd) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Apply creations for this day
      const creations = creationsByDate.get(dateStr) || [];
      for (const statusId of creations) {
        if (statusId) {
          cumulativeCounts.set(statusId, (cumulativeCounts.get(statusId) || 0) + 1);
        }
      }

      // Apply status changes for this day
      const changes = changesByDate.get(dateStr) || [];
      for (const change of changes) {
        if (change.from) {
          cumulativeCounts.set(change.from, Math.max(0, (cumulativeCounts.get(change.from) || 0) - 1));
        }
        if (change.to) {
          cumulativeCounts.set(change.to, (cumulativeCounts.get(change.to) || 0) + 1);
        }
      }

      // Create data point
      const dataPoint: CFDDataPoint = { date: dateStr };
      for (const status of statuses) {
        dataPoint[status.name] = cumulativeCounts.get(status.id) || 0;
      }
      dataPoints.push(dataPoint);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { statuses: statusInfos, dataPoints };
  },

  // Get Cycle Time data for completed issues
  async getCycleTimeData(
    projectId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    issues: CycleTimeDataPoint[];
    byStatus: CycleTimeByStatus[];
  }> {
    // Get completed issues with their first "in progress" and completion times
    const issues = await prisma.$queryRaw<any[]>`
      SELECT
        i.id as issue_id,
        p.key || '-' || i.issue_number as issue_key,
        i.title as issue_title,
        it.display_name as issue_type,
        i.story_points,
        i.created_at,
        i.updated_at as completed_at,
        u.id as assignee_id,
        u.first_name || ' ' || u.last_name as assignee_name,
        u.avatar_url as assignee_avatar
      FROM issues i
      LEFT JOIN issue_types it ON i.type_id = it.id
      LEFT JOIN statuses s ON i.status_id = s.id
      LEFT JOIN users u ON i.assignee_id = u.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
        AND s.category = 'done'
        AND i.updated_at BETWEEN ${startDate}::date AND (${endDate}::date + interval '1 day' - interval '1 second')
    `;

    // For each issue, find when it first moved to "in progress"
    const issueIds = issues.map((i: any) => i.issue_id);

    const startedAtMap = new Map<string, string>();
    if (issueIds.length > 0) {
      const inProgressHistory = await prisma.$queryRaw<any[]>`
        SELECT ih.issue_id, MIN(ih.created_at) as started_at
        FROM issue_history ih
        JOIN statuses s ON ih.new_value::uuid = s.id
        WHERE ih.issue_id = ANY(${issueIds}::uuid[])
          AND ih.field_name = 'status_id'
          AND s.category = 'in_progress'
        GROUP BY ih.issue_id
      `;

      for (const h of inProgressHistory) {
        startedAtMap.set(h.issue_id, h.started_at);
      }
    }

    const cycleTimeData: CycleTimeDataPoint[] = [];
    for (const issue of issues) {
      // Use created_at as fallback if never explicitly moved to in_progress
      const startedAt = startedAtMap.get(issue.issue_id) || issue.created_at;
      const completedAt = issue.completed_at;

      const startTime = new Date(startedAt).getTime();
      const endTime = new Date(completedAt).getTime();
      const cycleTimeHours = (endTime - startTime) / (1000 * 60 * 60);
      const cycleTimeDays = cycleTimeHours / 24;

      cycleTimeData.push({
        issueId: issue.issue_id,
        issueKey: issue.issue_key,
        issueTitle: issue.issue_title,
        issueType: issue.issue_type || 'Unknown',
        storyPoints: issue.story_points,
        cycleTimeHours: Math.round(cycleTimeHours * 10) / 10,
        cycleTimeDays: Math.round(cycleTimeDays * 10) / 10,
        startedAt,
        completedAt,
        assignee: issue.assignee_id
          ? {
              id: issue.assignee_id,
              displayName: issue.assignee_name,
              avatarUrl: issue.assignee_avatar,
            }
          : null,
      });
    }

    // Calculate time spent in each status (using issue history)
    const statusTimeData: CycleTimeByStatus[] = [];
    if (issueIds.length > 0) {
      const statuses = await prisma.$queryRaw<any[]>`
        SELECT id, name, display_name, color
        FROM statuses
        WHERE project_id = ${projectId}::uuid
          AND deleted_at IS NULL
      `;

      for (const status of statuses) {
        // Get all transitions into this status and out of this status
        const transitions = await prisma.$queryRaw<any[]>`
          SELECT ih.issue_id, ih.old_value, ih.new_value, ih.created_at
          FROM issue_history ih
          WHERE ih.issue_id = ANY(${issueIds}::uuid[])
            AND ih.field_name = 'status_id'
            AND (ih.old_value = ${status.id} OR ih.new_value = ${status.id})
          ORDER BY ih.created_at ASC
        `;

        // Calculate average time in this status
        let totalHoursInStatus = 0;
        let issueCountInStatus = 0;
        const issueEnterTimes = new Map<string, string>();

        for (const t of transitions) {
          if (t.new_value === status.id) {
            // Entered this status
            issueEnterTimes.set(t.issue_id, t.created_at);
          } else if (t.old_value === status.id) {
            // Left this status
            const enterTime = issueEnterTimes.get(t.issue_id);
            if (enterTime) {
              const hoursInStatus = (new Date(t.created_at).getTime() - new Date(enterTime).getTime()) / (1000 * 60 * 60);
              totalHoursInStatus += hoursInStatus;
              issueCountInStatus++;
              issueEnterTimes.delete(t.issue_id);
            }
          }
        }

        if (issueCountInStatus > 0) {
          const avgHours = totalHoursInStatus / issueCountInStatus;
          statusTimeData.push({
            statusName: status.name,
            displayName: status.display_name,
            color: status.color || '#6b7280',
            averageHours: Math.round(avgHours * 10) / 10,
            averageDays: Math.round((avgHours / 24) * 10) / 10,
            issueCount: issueCountInStatus,
          });
        }
      }
    }

    return { issues: cycleTimeData, byStatus: statusTimeData };
  },
};
