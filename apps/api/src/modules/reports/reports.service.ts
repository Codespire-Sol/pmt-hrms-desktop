import { reportsRepository } from './reports.repository';
import { prisma } from '../../database/prisma';
import {
  SprintReport,
  SprintBurndown,
  TeamWorkloadReport,
  TimeTrackingReport,
  IssueDistributionReport,
  EstimateActualReport,
  IssueEstimateActual,
  EstimateAccuracyByType,
  EstimateAccuracyByUser,
  CumulativeFlowReport,
  CycleTimeReport,
  CycleTimeDataPoint,
} from './reports.types';

export const reportsService = {
  // Get sprint report for a project
  async getSprintReport(projectId: string): Promise<SprintReport> {
    // Get project info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, key: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Get velocity history
    const velocityHistory = await reportsRepository.getSprintVelocityHistory(projectId, 10);

    // Calculate average velocity (from completed sprints only)
    const completedSprints = velocityHistory.filter((v) => v.completedPoints > 0);
    const averageVelocity =
      completedSprints.length > 0
        ? Math.round(
            completedSprints.reduce((sum, v) => sum + v.velocity, 0) / completedSprints.length
          )
        : 0;

    // Get current sprint (active preferred, then planned, then completed)
    const activeSprint = await prisma.sprint.findFirst({
      where: { projectId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    const latestPlannedSprint = activeSprint
      ? null
      : await prisma.sprint.findFirst({
          where: { projectId, status: 'planned' },
          orderBy: [{ sequence: 'desc' }, { createdAt: 'desc' }],
        });
    const latestCompletedSprint = activeSprint || latestPlannedSprint
      ? null
      : await prisma.sprint.findFirst({
          where: { projectId, status: 'completed' },
          orderBy: [{ sequence: 'desc' }, { createdAt: 'desc' }],
        });
    const sprintForReport = activeSprint || latestPlannedSprint || latestCompletedSprint;

    let currentSprint: SprintBurndown | null = null;
    if (sprintForReport) {
      const burndownData = await reportsRepository.getSprintBurndown(sprintForReport.id);
      if (burndownData) {
        currentSprint = {
          sprintId: burndownData.sprint.id,
          sprintName: burndownData.sprint.name,
          startDate: burndownData.sprint.start_date,
          endDate: burndownData.sprint.end_date,
          totalPoints: burndownData.sprint.totalPoints,
          dataPoints: burndownData.dataPoints,
        };
      }
    }

    return {
      projectId: project.id,
      projectName: project.name,
      projectKey: project.key,
      velocityHistory: velocityHistory.reverse(), // Oldest first for charts
      averageVelocity,
      currentSprint,
    };
  },

  // Get burndown for a specific sprint
  async getSprintBurndown(sprintId: string): Promise<SprintBurndown | null> {
    const burndownData = await reportsRepository.getSprintBurndown(sprintId);

    if (!burndownData) return null;

    return {
      sprintId: burndownData.sprint.id,
      sprintName: burndownData.sprint.name,
      startDate: burndownData.sprint.start_date,
      endDate: burndownData.sprint.end_date,
      totalPoints: burndownData.sprint.totalPoints,
      dataPoints: burndownData.dataPoints,
    };
  },

  // Get team workload report
  async getTeamWorkloadReport(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TeamWorkloadReport> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Default to last 30 days if not specified
    const end = endDate || new Date().toISOString().split('T')[0];
    const start =
      startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const members = await reportsRepository.getTeamWorkload(projectId, start, end);

    // Calculate totals
    const totals = members.reduce(
      (acc, m) => ({
        totalAssigned: acc.totalAssigned + m.assignedIssues,
        totalCompleted: acc.totalCompleted + m.completedIssues,
        totalInProgress: acc.totalInProgress + m.inProgressIssues,
        totalPoints: acc.totalPoints + m.totalPoints,
        totalHoursLogged: acc.totalHoursLogged + m.hoursLogged,
      }),
      {
        totalAssigned: 0,
        totalCompleted: 0,
        totalInProgress: 0,
        totalPoints: 0,
        totalHoursLogged: 0,
      }
    );

    return {
      projectId: project.id,
      projectName: project.name,
      dateRange: {
        startDate: start,
        endDate: end,
      },
      members,
      totals,
    };
  },

  // Get time tracking report
  async getTimeTrackingReport(
    userId: string,
    startDate?: string,
    endDate?: string,
    projectId?: string
  ): Promise<TimeTrackingReport> {
    // Default to last 30 days if not specified
    const end = endDate || new Date().toISOString().split('T')[0];
    const start =
      startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const data = await reportsRepository.getTimeTrackingReport(
      userId,
      start,
      end,
      projectId
    );

    return {
      dateRange: {
        startDate: start,
        endDate: end,
      },
      totalMinutes: data.totalMinutes,
      totalLogs: data.totalLogs,
      byUser: data.byUser,
      byProject: data.byProject,
      byIssue: data.byIssue,
      recentLogs: data.recentLogs,
    };
  },

  // Get issue distribution report
  async getIssueDistributionReport(projectId: string): Promise<IssueDistributionReport> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const distribution = await reportsRepository.getIssueDistribution(projectId);

    return {
      projectId: project.id,
      projectName: project.name,
      ...distribution,
    };
  },

  // Export data to CSV
  exportToCsv<T extends Record<string, any>>(
    data: T[],
    columns: { key: keyof T; header: string }[]
  ): string {
    if (data.length === 0) return '';

    const headers = columns.map((c) => c.header).join(',');
    const rows = data.map((row) =>
      columns
        .map((col) => {
          const value = row[col.key];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        })
        .join(',')
    );

    return [headers, ...rows].join('\n');
  },

  // Export velocity report to CSV
  exportVelocityToCsv(velocityHistory: any[]): string {
    return this.exportToCsv(velocityHistory, [
      { key: 'sprintName', header: 'Sprint' },
      { key: 'startDate', header: 'Start Date' },
      { key: 'endDate', header: 'End Date' },
      { key: 'committedPoints', header: 'Committed Points' },
      { key: 'completedPoints', header: 'Completed Points' },
      { key: 'completedIssues', header: 'Completed Issues' },
      { key: 'totalIssues', header: 'Total Issues' },
      { key: 'velocity', header: 'Velocity' },
    ]);
  },

  // Export team workload to CSV
  exportTeamWorkloadToCsv(members: any[]): string {
    return this.exportToCsv(members, [
      { key: 'displayName', header: 'Team Member' },
      { key: 'assignedIssues', header: 'Assigned' },
      { key: 'completedIssues', header: 'Completed' },
      { key: 'inProgressIssues', header: 'In Progress' },
      { key: 'totalPoints', header: 'Total Points' },
      { key: 'completedPoints', header: 'Completed Points' },
      { key: 'hoursLogged', header: 'Hours Logged' },
      { key: 'overdueIssues', header: 'Overdue' },
    ]);
  },

  // Export time logs to CSV
  exportTimeLogsToCsv(logs: any[]): string {
    return this.exportToCsv(logs, [
      { key: 'loggedAt', header: 'Date' },
      { key: 'userName', header: 'User' },
      { key: 'projectName', header: 'Project' },
      { key: 'issueKey', header: 'Issue' },
      { key: 'issueTitle', header: 'Issue Title' },
      { key: 'durationMinutes', header: 'Duration (minutes)' },
      { key: 'description', header: 'Description' },
    ]);
  },

  // Get estimate vs actual comparison report
  async getEstimateActualReport(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<EstimateActualReport> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Default to all time if not specified
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || '2000-01-01';

    const rawData = await reportsRepository.getEstimateActualComparison(
      projectId,
      start,
      end
    );

    // Calculate variance for each issue
    const issues: IssueEstimateActual[] = rawData.issues.map((issue) => {
      const variance = issue.actualHours - issue.estimatedHours;
      const variancePercentage =
        issue.estimatedHours > 0
          ? Math.round((variance / issue.estimatedHours) * 100)
          : 0;

      return {
        ...issue,
        variance,
        variancePercentage,
        isOverEstimate: variance < 0, // Less actual than estimated
        isUnderEstimate: variance > 0, // More actual than estimated
      };
    });

    // Calculate summary statistics
    const totalEstimatedHours = issues.reduce((sum, i) => sum + i.estimatedHours, 0);
    const totalActualHours = issues.reduce((sum, i) => sum + i.actualHours, 0);
    const totalVariance = totalActualHours - totalEstimatedHours;
    const variancePercentage =
      totalEstimatedHours > 0
        ? Math.round((totalVariance / totalEstimatedHours) * 100)
        : 0;

    // Count issues by accuracy category (within 10% = accurate)
    const overEstimatedCount = issues.filter(
      (i) => i.variancePercentage < -10
    ).length;
    const underEstimatedCount = issues.filter(
      (i) => i.variancePercentage > 10
    ).length;
    const accurateCount = issues.filter(
      (i) => Math.abs(i.variancePercentage) <= 10
    ).length;

    // Calculate average accuracy (100 - average absolute variance %, capped at 0)
    const avgAbsVariance =
      issues.length > 0
        ? issues.reduce((sum, i) => sum + Math.abs(i.variancePercentage), 0) /
          issues.length
        : 0;
    const averageAccuracy = Math.max(0, Math.round(100 - avgAbsVariance));

    // Process by issue type
    const byIssueType: EstimateAccuracyByType[] = rawData.byIssueType.map((t) => {
      const variance = t.totalActual - t.totalEstimated;
      const variancePercentage =
        t.totalEstimated > 0
          ? Math.round((variance / t.totalEstimated) * 100)
          : 0;

      return {
        issueType: t.issueType,
        totalEstimated: t.totalEstimated,
        totalActual: t.totalActual,
        variance,
        variancePercentage,
        issueCount: t.issueCount,
      };
    });

    // Process by user
    const byUser: EstimateAccuracyByUser[] = rawData.byUser.map((u) => {
      const variance = u.totalActual - u.totalEstimated;
      const variancePercentage =
        u.totalEstimated > 0
          ? Math.round((variance / u.totalEstimated) * 100)
          : 0;
      const accuracyScore = Math.max(0, Math.round(100 - Math.abs(variancePercentage)));

      return {
        userId: u.userId,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        totalEstimated: u.totalEstimated,
        totalActual: u.totalActual,
        variance,
        variancePercentage,
        issueCount: u.issueCount,
        accuracyScore,
      };
    });

    return {
      projectId: project.id,
      projectName: project.name,
      dateRange: {
        startDate: start,
        endDate: end,
      },
      summary: {
        totalEstimatedHours,
        totalActualHours,
        totalVariance,
        variancePercentage,
        overEstimatedCount,
        underEstimatedCount,
        accurateCount,
        averageAccuracy,
      },
      byIssueType,
      byUser,
      issues,
    };
  },

  // Export estimate vs actual to CSV
  exportEstimateActualToCsv(issues: IssueEstimateActual[]): string {
    return this.exportToCsv(issues, [
      { key: 'issueKey', header: 'Issue Key' },
      { key: 'issueTitle', header: 'Title' },
      { key: 'issueType', header: 'Type' },
      { key: 'status', header: 'Status' },
      { key: 'estimatedHours', header: 'Estimated Hours' },
      { key: 'actualHours', header: 'Actual Hours' },
      { key: 'variance', header: 'Variance (hours)' },
      { key: 'variancePercentage', header: 'Variance (%)' },
    ]);
  },

  // Get Cumulative Flow Diagram report
  async getCumulativeFlowReport(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CumulativeFlowReport> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Default to last 30 days if not specified
    const end = endDate || new Date().toISOString().split('T')[0];
    const start =
      startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const data = await reportsRepository.getCumulativeFlowData(projectId, start, end);

    return {
      projectId: project.id,
      projectName: project.name,
      dateRange: {
        startDate: start,
        endDate: end,
      },
      statuses: data.statuses,
      dataPoints: data.dataPoints,
    };
  },

  // Get Cycle Time Analytics report
  async getCycleTimeReport(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CycleTimeReport> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Default to last 90 days if not specified
    const end = endDate || new Date().toISOString().split('T')[0];
    const start =
      startDate ||
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const data = await reportsRepository.getCycleTimeData(projectId, start, end);

    // Calculate summary statistics
    const cycleTimes = data.issues.map((i) => i.cycleTimeDays);
    const issueCount = cycleTimes.length;

    let summary = {
      averageCycleTimeDays: 0,
      medianCycleTimeDays: 0,
      minCycleTimeDays: 0,
      maxCycleTimeDays: 0,
      issueCount,
    };

    if (issueCount > 0) {
      const sortedCycleTimes = [...cycleTimes].sort((a, b) => a - b);
      const sum = cycleTimes.reduce((acc, ct) => acc + ct, 0);

      summary = {
        averageCycleTimeDays: Math.round((sum / issueCount) * 10) / 10,
        medianCycleTimeDays:
          issueCount % 2 === 0
            ? Math.round(
                ((sortedCycleTimes[issueCount / 2 - 1] +
                  sortedCycleTimes[issueCount / 2]) /
                  2) *
                  10
              ) / 10
            : sortedCycleTimes[Math.floor(issueCount / 2)],
        minCycleTimeDays: sortedCycleTimes[0],
        maxCycleTimeDays: sortedCycleTimes[issueCount - 1],
        issueCount,
      };
    }

    // Group by issue type
    const byTypeMap = new Map<string, { total: number; count: number }>();
    for (const issue of data.issues) {
      const existing = byTypeMap.get(issue.issueType) || { total: 0, count: 0 };
      existing.total += issue.cycleTimeDays;
      existing.count += 1;
      byTypeMap.set(issue.issueType, existing);
    }

    const byIssueType = Array.from(byTypeMap.entries()).map(([issueType, { total, count }]) => ({
      issueType,
      averageDays: Math.round((total / count) * 10) / 10,
      issueCount: count,
    }));

    // Group by story points
    const byPointsMap = new Map<number, { total: number; count: number }>();
    for (const issue of data.issues) {
      if (issue.storyPoints !== null) {
        const existing = byPointsMap.get(issue.storyPoints) || { total: 0, count: 0 };
        existing.total += issue.cycleTimeDays;
        existing.count += 1;
        byPointsMap.set(issue.storyPoints, existing);
      }
    }

    const byStoryPoints = Array.from(byPointsMap.entries())
      .map(([storyPoints, { total, count }]) => ({
        storyPoints,
        averageDays: Math.round((total / count) * 10) / 10,
        issueCount: count,
      }))
      .sort((a, b) => a.storyPoints - b.storyPoints);

    return {
      projectId: project.id,
      projectName: project.name,
      dateRange: {
        startDate: start,
        endDate: end,
      },
      summary,
      byIssueType,
      byStoryPoints,
      byStatus: data.byStatus,
      issues: data.issues,
    };
  },

  async getCreatedVsResolvedReport(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    projectId: string;
    projectName: string;
    dateRange: { startDate: string; endDate: string };
    series: Array<{ date: string; created: number; resolved: number }>;
    totals: { created: number; resolved: number; net: number };
  }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const end = endDate || new Date().toISOString().split('T')[0];
    const start =
      startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [createdRows, resolvedRows] = await Promise.all([
      prisma.$queryRaw<Array<{ day: string; count: number }>>`
        SELECT DATE(i.created_at)::text AS day, COUNT(*)::int AS count
        FROM issues i
        WHERE i.project_id = ${projectId}::uuid
          AND i.deleted_at IS NULL
          AND i.created_at BETWEEN ${start}::date AND (${end}::date + interval '1 day' - interval '1 second')
        GROUP BY DATE(i.created_at)
        ORDER BY day ASC
      `,
      prisma.$queryRaw<Array<{ day: string; count: number }>>`
        SELECT DATE(i.resolution_date)::text AS day, COUNT(*)::int AS count
        FROM issues i
        WHERE i.project_id = ${projectId}::uuid
          AND i.deleted_at IS NULL
          AND i.resolution_date IS NOT NULL
          AND i.resolution_date BETWEEN ${start}::date AND (${end}::date + interval '1 day' - interval '1 second')
        GROUP BY DATE(i.resolution_date)
        ORDER BY day ASC
      `,
    ]);

    const createdMap = new Map(createdRows.map((row) => [row.day, Number(row.count) || 0]));
    const resolvedMap = new Map(resolvedRows.map((row) => [row.day, Number(row.count) || 0]));

    const series: Array<{ date: string; created: number; resolved: number }> = [];
    const current = new Date(`${start}T00:00:00.000Z`);
    const endDateObj = new Date(`${end}T00:00:00.000Z`);
    while (current <= endDateObj) {
      const day = current.toISOString().split('T')[0];
      series.push({
        date: day,
        created: createdMap.get(day) || 0,
        resolved: resolvedMap.get(day) || 0,
      });
      current.setUTCDate(current.getUTCDate() + 1);
    }

    const totals = series.reduce(
      (acc, row) => ({
        created: acc.created + row.created,
        resolved: acc.resolved + row.resolved,
        net: acc.net + row.created - row.resolved,
      }),
      { created: 0, resolved: 0, net: 0 }
    );

    return {
      projectId: project.id,
      projectName: project.name,
      dateRange: {
        startDate: start,
        endDate: end,
      },
      series,
      totals,
    };
  },

  async getResolutionTimeSummary(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    projectId: string;
    projectName: string;
    dateRange: { startDate: string; endDate: string };
    issueCount: number;
    averageDays: number;
    medianDays: number;
    p95Days: number;
    minDays: number;
    maxDays: number;
  }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const end = endDate || new Date().toISOString().split('T')[0];
    const start =
      startDate ||
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const rows = await prisma.$queryRaw<Array<{ days: number }>>`
      SELECT EXTRACT(EPOCH FROM (i.resolution_date - i.created_at)) / 86400.0 AS days
      FROM issues i
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
        AND i.resolution_date IS NOT NULL
        AND i.resolution_date >= i.created_at
        AND i.resolution_date BETWEEN ${start}::date AND (${end}::date + interval '1 day' - interval '1 second')
    `;

    const values = rows
      .map((row) => Number(row.days))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    const count = values.length;
    if (count === 0) {
      return {
        projectId: project.id,
        projectName: project.name,
        dateRange: { startDate: start, endDate: end },
        issueCount: 0,
        averageDays: 0,
        medianDays: 0,
        p95Days: 0,
        minDays: 0,
        maxDays: 0,
      };
    }

    const sum = values.reduce((acc, value) => acc + value, 0);
    const median =
      count % 2 === 0
        ? (values[count / 2 - 1] + values[count / 2]) / 2
        : values[Math.floor(count / 2)];
    const p95Index = Math.max(0, Math.ceil(count * 0.95) - 1);

    return {
      projectId: project.id,
      projectName: project.name,
      dateRange: { startDate: start, endDate: end },
      issueCount: count,
      averageDays: Math.round((sum / count) * 10) / 10,
      medianDays: Math.round(median * 10) / 10,
      p95Days: Math.round(values[p95Index] * 10) / 10,
      minDays: Math.round(values[0] * 10) / 10,
      maxDays: Math.round(values[values.length - 1] * 10) / 10,
    };
  },

  async getControlChartData(
    projectId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    projectId: string;
    projectName: string;
    dateRange: { startDate: string; endDate: string };
    points: Array<{ issueId: string; issueKey: string; completedAt: string; cycleTimeDays: number }>;
    percentiles: { p50: number; p75: number; p95: number };
  }> {
    const report = await this.getCycleTimeReport(projectId, startDate, endDate);

    const sortedDays = report.issues
      .map((issue) => issue.cycleTimeDays)
      .sort((a, b) => a - b);

    const percentile = (p: number): number => {
      if (sortedDays.length === 0) return 0;
      const idx = Math.max(0, Math.ceil(sortedDays.length * p) - 1);
      return Math.round(sortedDays[idx] * 10) / 10;
    };

    return {
      projectId: report.projectId,
      projectName: report.projectName,
      dateRange: report.dateRange,
      points: report.issues.map((issue) => ({
        issueId: issue.issueId,
        issueKey: issue.issueKey,
        completedAt: issue.completedAt,
        cycleTimeDays: issue.cycleTimeDays,
      })),
      percentiles: {
        p50: percentile(0.5),
        p75: percentile(0.75),
        p95: percentile(0.95),
      },
    };
  },

  // Export cycle time data to CSV
  exportCycleTimeToCsv(issues: CycleTimeDataPoint[]): string {
    return this.exportToCsv(
      issues.map((i) => ({
        ...i,
        assigneeName: i.assignee?.displayName || 'Unassigned',
      })),
      [
        { key: 'issueKey', header: 'Issue Key' },
        { key: 'issueTitle', header: 'Title' },
        { key: 'issueType', header: 'Type' },
        { key: 'storyPoints', header: 'Story Points' },
        { key: 'cycleTimeDays', header: 'Cycle Time (Days)' },
        { key: 'startedAt', header: 'Started At' },
        { key: 'completedAt', header: 'Completed At' },
        { key: 'assigneeName', header: 'Assignee' },
      ]
    );
  },

  // ── Epic Report ───────────────────────────────────────────────────────────

  async getEpicReport(epicId: string) {
    const epic = await prisma.epic.findUnique({ where: { id: epicId } });
    if (!epic) throw new Error('Epic not found');

    const issues = await prisma.issue.findMany({
      where: { epicId, deletedAt: null },
      include: {
        status:   { select: { name: true, category: true } },
        priority: { select: { name: true } },
        assignee: { select: { firstName: true, lastName: true } },
        project:  { select: { key: true } },
      },
      orderBy: { issueNumber: 'asc' },
    });

    const total      = issues.length;
    const completed  = issues.filter(i => i.status?.category === 'done').length;
    const inProgress = issues.filter(i => i.status?.category === 'in_progress').length;
    const todo       = total - completed - inProgress;
    const totalSP    = issues.reduce((s, i) => s + (i.storyPoints || 0), 0);
    const completedSP = issues.filter(i => i.status?.category === 'done').reduce((s, i) => s + (i.storyPoints || 0), 0);

    // Daily burndown from epic startDate → endDate (or today), capped at 90 days
    const burndown: Array<{ date: string; completed: number; remaining: number; total: number }> = [];
    const completedIssues = issues.filter(i => i.resolutionDate);
    const startD = epic.startDate ? new Date(epic.startDate) : (
      issues.length > 0 ? new Date(Math.min(...issues.map(i => i.createdAt.getTime()))) : new Date()
    );
    const endD = epic.endDate ? new Date(epic.endDate) : new Date();
    const days = Math.min(90, Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / 86400000)));
    for (let d = 0; d <= days; d++) {
      const dayDate = new Date(startD.getTime() + d * 86400000);
      const dayStr  = dayDate.toISOString().split('T')[0];
      const doneByDay = completedIssues.filter(i => i.resolutionDate && new Date(i.resolutionDate) <= dayDate).length;
      burndown.push({ date: dayStr, completed: doneByDay, remaining: total - doneByDay, total });
    }

    return {
      epic: {
        id: epic.id, name: epic.name, color: epic.color, status: epic.status,
        startDate: epic.startDate ? epic.startDate.toISOString().split('T')[0] : null,
        endDate:   epic.endDate   ? epic.endDate.toISOString().split('T')[0]   : null,
      },
      stats: {
        totalIssues: total, completedIssues: completed, inProgressIssues: inProgress, todoIssues: todo,
        totalStoryPoints: totalSP, completedStoryPoints: completedSP,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
      burndown,
      issues: issues.map(i => ({
        id: i.id,
        issueKey: `${i.project.key}-${i.issueNumber}`,
        title: i.title,
        status: i.status?.name ?? null,
        statusCategory: i.status?.category ?? null,
        priority: i.priority?.name ?? null,
        assignee: i.assignee ? `${i.assignee.firstName} ${i.assignee.lastName}`.trim() : null,
        storyPoints: i.storyPoints,
        completedAt: i.resolutionDate ? i.resolutionDate.toISOString() : null,
      })),
    };
  },

  // ── Version Report ────────────────────────────────────────────────────────

  async getVersionReport(versionId: string) {
    const version = await prisma.version.findUnique({ where: { id: versionId } });
    if (!version) throw new Error('Version not found');

    const issues = await prisma.issue.findMany({
      where: { fixVersion: version.name, deletedAt: null },
      include: {
        type:     { select: { name: true } },
        status:   { select: { name: true, category: true } },
        priority: { select: { name: true } },
        assignee: { select: { firstName: true, lastName: true } },
        project:  { select: { key: true } },
      },
      orderBy: { issueNumber: 'asc' },
    });

    const total      = issues.length;
    const completed  = issues.filter(i => i.status?.category === 'done').length;
    const inProgress = issues.filter(i => i.status?.category === 'in_progress').length;
    const todo       = total - completed - inProgress;
    const totalSP    = issues.reduce((s, i) => s + (i.storyPoints || 0), 0);
    const completedSP = issues.filter(i => i.status?.category === 'done').reduce((s, i) => s + (i.storyPoints || 0), 0);

    // Scope timeline: last 30 days of how many issues added vs completed
    const now = new Date();
    const scopeTimeline = Array.from({ length: 30 }, (_, d) => {
      const day    = new Date(now.getTime() - (29 - d) * 86400000);
      const dayStr = day.toISOString().split('T')[0];
      return {
        date:      dayStr,
        total:     issues.filter(i => new Date(i.createdAt) <= day).length,
        completed: issues.filter(i => i.resolutionDate && new Date(i.resolutionDate) <= day).length,
      };
    });

    return {
      version: {
        id: version.id, name: version.name, status: version.status,
        releaseDate: version.releaseDate ? version.releaseDate.toISOString().split('T')[0] : null,
        startDate:   version.startDate   ? version.startDate.toISOString().split('T')[0]   : null,
      },
      stats: {
        totalIssues: total, completedIssues: completed, inProgressIssues: inProgress, todoIssues: todo,
        totalStoryPoints: totalSP, completedStoryPoints: completedSP,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
      scopeTimeline,
      issues: issues.map(i => ({
        id: i.id,
        issueKey: `${i.project.key}-${i.issueNumber}`,
        title: i.title,
        type:           i.type?.name ?? null,
        status:         i.status?.name ?? null,
        statusCategory: i.status?.category ?? null,
        priority:       i.priority?.name ?? null,
        assignee:       i.assignee ? `${i.assignee.firstName} ${i.assignee.lastName}`.trim() : null,
        storyPoints:    i.storyPoints,
        completedAt:    i.resolutionDate ? i.resolutionDate.toISOString() : null,
      })),
    };
  },
};
