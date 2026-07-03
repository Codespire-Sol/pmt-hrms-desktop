import { dashboardRepository } from './dashboard.repository';
import {
  UserDashboard,
  ProjectDashboard,
  DashboardPreferences,
  DashboardType,
  UpdateDashboardPreferencesInput,
  DashboardShare,
  DashboardShareWithDetails,
  CreateDashboardShareInput,
  UpdateDashboardShareInput,
  SharedDashboardInfo,
  AdminDashboard,
  ManagerDashboard,
  EmployeeDashboard,
  GanttChartData,
  GanttView,
  GanttPeriod,
  VelocityChartData,
  BurndownChartData,
  CumulativeFlowPoint,
  VelocityPoint,
} from './dashboard.types';
import { prisma } from '../../database/prisma';

/**
 * Build an ordered array of time periods for the Gantt chart header.
 * The period boundaries are snapped so they always align to clean calendar units
 * (e.g. first/last day of month, quarter, half-year or year).
 */
function buildGanttTimeScale(dataStart: Date, dataEnd: Date, view: GanttView): GanttPeriod[] {
  const toISO = (d: Date) => d.toISOString().split('T')[0];

  const periods: GanttPeriod[] = [];
  let cursor: Date;

  switch (view) {
    case 'weekly': {
      // Snap to Monday of dataStart's week (ISO week starts on Monday)
      const dayOfWeek = dataStart.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      cursor = new Date(dataStart.getFullYear(), dataStart.getMonth(), dataStart.getDate() + mondayOffset);
      while (cursor <= dataEnd) {
        const weekStart = new Date(cursor);
        const weekEnd   = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6);
        const startMonth = weekStart.toLocaleString('en-US', { month: 'short' });
        const endMonth   = weekEnd.toLocaleString('en-US', { month: 'short' });
        // Calculate ISO week number
        const _jan4 = new Date(weekStart.getFullYear(), 0, 4);
        const dayOfYear = Math.floor((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / 86400000);
        const weekNum = Math.ceil((dayOfYear + new Date(weekStart.getFullYear(), 0, 1).getDay() + 1) / 7);
        const label = startMonth === endMonth
          ? `W${weekNum} ${startMonth} ${weekStart.getDate()}-${weekEnd.getDate()}`
          : `W${weekNum} ${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}`;
        periods.push({ label, start: toISO(weekStart), end: toISO(weekEnd) });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      }
      break;
    }

    case 'monthly': {
      // Snap to first day of data start month
      cursor = new Date(dataStart.getFullYear(), dataStart.getMonth(), 1);
      while (cursor <= dataEnd) {
        const start = new Date(cursor);
        const end   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0); // last day of month
        const label = start.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        periods.push({ label, start: toISO(start), end: toISO(end) });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      break;
    }

    case 'quarterly': {
      const startQ = Math.floor(dataStart.getMonth() / 3);
      cursor = new Date(dataStart.getFullYear(), startQ * 3, 1);
      while (cursor <= dataEnd) {
        const q     = Math.floor(cursor.getMonth() / 3) + 1;
        const start = new Date(cursor);
        const end   = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 0);
        periods.push({ label: `Q${q} ${cursor.getFullYear()}`, start: toISO(start), end: toISO(end) });
        cursor.setMonth(cursor.getMonth() + 3);
      }
      break;
    }

    case 'halfYearly': {
      const startH = dataStart.getMonth() < 6 ? 0 : 6;
      cursor = new Date(dataStart.getFullYear(), startH, 1);
      while (cursor <= dataEnd) {
        const h     = cursor.getMonth() < 6 ? 1 : 2;
        const start = new Date(cursor);
        const end   = new Date(cursor.getFullYear(), cursor.getMonth() + 6, 0);
        periods.push({ label: `H${h} ${cursor.getFullYear()}`, start: toISO(start), end: toISO(end) });
        cursor.setMonth(cursor.getMonth() + 6);
      }
      break;
    }

    case 'annually': {
      cursor = new Date(dataStart.getFullYear(), 0, 1);
      while (cursor <= dataEnd) {
        const start = new Date(cursor);
        const end   = new Date(cursor.getFullYear(), 11, 31);
        periods.push({ label: String(cursor.getFullYear()), start: toISO(start), end: toISO(end) });
        cursor.setFullYear(cursor.getFullYear() + 1);
      }
      break;
    }
  }

  // Guarantee at least one period (handles edge case where start === end)
  if (periods.length === 0) {
    const fallback = buildGanttTimeScale(dataStart, new Date(dataStart.getTime() + 86400000), view);
    return fallback.length > 0 ? fallback : [{
      label: String(dataStart.getFullYear()),
      start: toISO(new Date(dataStart.getFullYear(), 0, 1)),
      end:   toISO(new Date(dataStart.getFullYear(), 11, 31)),
    }];
  }

  return periods;
}

async function canViewAllProjectsInDashboard(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { name: true } } },
  });

  return user?.role?.name === 'admin';
}

export const dashboardService = {
  // Get complete user dashboard
  async getUserDashboard(userId: string): Promise<UserDashboard> {
    const includeAllProjects = await canViewAllProjectsInDashboard(userId);
    const [
      stats,
      assignedIssues,
      recentActivity,
      projectSummaries,
      activeSprintsProgress,
      dueSoonIssues,
    ] = await Promise.all([
      dashboardRepository.getUserStats(userId, includeAllProjects),
      dashboardRepository.getAssignedIssues(userId, 10),
      dashboardRepository.getRecentActivity(userId, 15, includeAllProjects),
      dashboardRepository.getProjectSummaries(userId, 5, includeAllProjects),
      dashboardRepository.getActiveSprintsProgress(userId, includeAllProjects),
      dashboardRepository.getDueSoonIssues(userId, 7, includeAllProjects),
    ]);

    return {
      stats,
      assignedIssues,
      recentActivity,
      projectSummaries,
      activeSprintsProgress,
      dueSoonIssues,
    };
  },

  // Get project dashboard
  async getProjectDashboard(projectId: string): Promise<ProjectDashboard> {
    // First verify project exists
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, name: true, key: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const [
      stats,
      issuesByStatus,
      issuesByPriority,
      issuesByType,
      recentActivity,
      teamMembers,
      dueSoonTrend,
      throughput,
      workloadBuckets,
    ] = await Promise.all([
      dashboardRepository.getProjectStats(projectId),
      dashboardRepository.getIssuesByStatus(projectId),
      dashboardRepository.getIssuesByPriority(projectId),
      dashboardRepository.getIssuesByType(projectId),
      dashboardRepository.getProjectActivity(projectId, 15),
      dashboardRepository.getTeamMemberStats(projectId),
      dashboardRepository.getProjectDueSoonTrend(projectId),
      dashboardRepository.getProjectThroughput(projectId),
      dashboardRepository.getProjectWorkloadBuckets(projectId),
    ]);

    // Get active sprint if any
    const activeSprint = await prisma.sprint.findFirst({
      where: { projectId, status: 'active' },
    });

    let sprintProgress = null;
    if (activeSprint) {
      const sprintIssues = await prisma.issue.findMany({
        where: { sprintId: activeSprint.id },
        select: { status: { select: { name: true } } },
      });

      const total = sprintIssues.length;
      const completed = sprintIssues.filter(
        (i) => ['done', 'closed'].includes(i.status.name)
      ).length;
      const inProgressCount = sprintIssues.filter(
        (i) => ['in_progress', 'in_review'].includes(i.status.name)
      ).length;
      const todoCount = sprintIssues.filter(
        (i) => ['todo', 'backlog', 'open'].includes(i.status.name)
      ).length;

      sprintProgress = {
        id: activeSprint.id,
        name: activeSprint.name,
        projectId: project.id,
        projectName: project.name,
        projectKey: project.key,
        startDate: activeSprint.startDate,
        endDate: activeSprint.endDate,
        daysRemaining: Math.max(
          0,
          Math.ceil(
            (new Date(activeSprint.endDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        ),
        totalIssues: total,
        completedIssues: completed,
        inProgressIssues: inProgressCount,
        todoIssues: todoCount,
        completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }

    return {
      projectId: project.id,
      projectName: project.name,
      projectKey: project.key,
      stats,
      issuesByStatus,
      issuesByPriority,
      issuesByType,
      recentActivity,
      activeSprint: sprintProgress,
      teamMembers,
      dueSoonTrend,
      throughput,
      workloadBuckets,
    };
  },

  // Get only assigned issues
  async getAssignedIssues(userId: string, limit: number = 10) {
    return dashboardRepository.getAssignedIssues(userId, limit);
  },

  // Get only recent activity
  async getRecentActivity(userId: string, limit: number = 20) {
    const includeAllProjects = await canViewAllProjectsInDashboard(userId);
    return dashboardRepository.getRecentActivity(userId, limit, includeAllProjects);
  },

  // Get due soon issues
  async getDueSoonIssues(userId: string, days: number = 7) {
    const includeAllProjects = await canViewAllProjectsInDashboard(userId);
    return dashboardRepository.getDueSoonIssues(userId, days, includeAllProjects);
  },

  // ========== Dashboard Preferences ==========

  async getDashboardPreferences(
    userId: string,
    dashboardType: DashboardType,
    projectId?: string
  ): Promise<DashboardPreferences> {
    return dashboardRepository.getOrCreateDashboardPreferences(userId, dashboardType, projectId);
  },

  async updateDashboardPreferences(
    userId: string,
    dashboardType: DashboardType,
    input: UpdateDashboardPreferencesInput,
    projectId?: string
  ): Promise<DashboardPreferences> {
    return dashboardRepository.updateDashboardPreferences(userId, dashboardType, input, projectId);
  },

  async resetDashboardPreferences(
    userId: string,
    dashboardType: DashboardType,
    projectId?: string
  ): Promise<DashboardPreferences> {
    return dashboardRepository.resetDashboardPreferences(userId, dashboardType, projectId);
  },

  // Get user dashboard with preferences
  async getUserDashboardWithPreferences(userId: string): Promise<{
    dashboard: UserDashboard;
    preferences: DashboardPreferences;
  }> {
    const [dashboard, preferences] = await Promise.all([
      this.getUserDashboard(userId),
      this.getDashboardPreferences(userId, 'user'),
    ]);

    return { dashboard, preferences };
  },

  // Get project dashboard with preferences
  async getProjectDashboardWithPreferences(
    projectId: string,
    userId: string
  ): Promise<{
    dashboard: ProjectDashboard;
    preferences: DashboardPreferences;
  }> {
    const [dashboard, preferences] = await Promise.all([
      this.getProjectDashboard(projectId),
      this.getDashboardPreferences(userId, 'project', projectId),
    ]);

    return { dashboard, preferences };
  },

  // ========== Dashboard Sharing ==========

  async shareDashboard(
    ownerId: string,
    input: CreateDashboardShareInput
  ): Promise<DashboardShare> {
    // Verify the dashboard belongs to the user
    const preferences = await dashboardRepository.getDashboardPreferences(
      ownerId,
      'user',
      undefined
    );

    if (!preferences || preferences.id !== input.dashboardPreferencesId) {
      // Check if it's a project dashboard
      const projectPref = await prisma.dashboardPreference.findFirst({
        where: { id: input.dashboardPreferencesId, userId: ownerId },
      });

      if (!projectPref) {
        throw new Error('Dashboard not found or you do not have permission to share it');
      }
    }

    // Check if already shared with this user
    if (input.sharedWithUserId) {
      const existingShares = await dashboardRepository.getSharesByDashboard(
        input.dashboardPreferencesId
      );
      const alreadyShared = existingShares.find(
        (s) => s.sharedWithUserId === input.sharedWithUserId
      );
      if (alreadyShared) {
        throw new Error('Dashboard is already shared with this user');
      }
    }

    return dashboardRepository.createShare(ownerId, input);
  },

  async getSharesByDashboard(
    dashboardPreferencesId: string,
    userId: string
  ): Promise<DashboardShareWithDetails[]> {
    // Verify ownership
    const preferences = await prisma.dashboardPreference.findFirst({
      where: { id: dashboardPreferencesId, userId },
    });

    if (!preferences) {
      throw new Error('Dashboard not found or you do not have permission');
    }

    return dashboardRepository.getSharesByDashboard(dashboardPreferencesId);
  },

  async getSharedWithMe(userId: string): Promise<SharedDashboardInfo[]> {
    return dashboardRepository.getSharedWithMe(userId);
  },

  async getSharedDashboardByToken(
    token: string
  ): Promise<DashboardShareWithDetails | null> {
    return dashboardRepository.getShareByToken(token);
  },

  async updateShare(
    shareId: string,
    ownerId: string,
    input: UpdateDashboardShareInput
  ): Promise<DashboardShare> {
    const share = await dashboardRepository.getShareById(shareId);

    if (!share) {
      throw new Error('Share not found');
    }

    if (share.ownerId !== ownerId) {
      throw new Error('You do not have permission to modify this share');
    }

    return dashboardRepository.updateShare(shareId, input);
  },

  async deleteShare(shareId: string, ownerId: string): Promise<void> {
    const share = await dashboardRepository.getShareById(shareId);

    if (!share) {
      throw new Error('Share not found');
    }

    if (share.ownerId !== ownerId) {
      throw new Error('You do not have permission to delete this share');
    }

    await dashboardRepository.deleteShare(shareId);
  },

  async regeneratePublicLink(
    shareId: string,
    ownerId: string
  ): Promise<DashboardShare> {
    const share = await dashboardRepository.getShareById(shareId);

    if (!share) {
      throw new Error('Share not found');
    }

    if (share.ownerId !== ownerId) {
      throw new Error('You do not have permission to modify this share');
    }

    if (!share.isPublic) {
      throw new Error('This share does not have a public link');
    }

    return dashboardRepository.regeneratePublicLink(shareId);
  },

  async createPublicLink(
    dashboardPreferencesId: string,
    ownerId: string,
    expiresAt?: string
  ): Promise<DashboardShare> {
    return this.shareDashboard(ownerId, {
      dashboardPreferencesId,
      isPublic: true,
      permission: 'view',
      expiresAt,
    });
  },

  // ============================================================
  // ROLE-BASED DASHBOARD SERVICES
  // ============================================================

  async getAdminDashboard(userId: string): Promise<AdminDashboard> {
    const [
      stats,
      projectsOverview,
      orgThroughput,
      issuesByProject,
      userActivity,
      overdueByProject,
      recentSystemEvents,
    ] = await Promise.all([
      dashboardRepository.getAdminStats(),
      dashboardRepository.getOrgProjectsOverview(20),
      dashboardRepository.getOrgThroughput(30),
      dashboardRepository.getIssuesByProjectChart(10),
      dashboardRepository.getUserActivityStats(10),
      dashboardRepository.getOverdueByProject(),
      dashboardRepository.getRecentActivity(userId, 20, true),
    ]);

    return {
      role: 'admin',
      stats,
      projectsOverview,
      orgThroughput,
      issuesByProject,
      userActivity,
      overdueByProject,
      recentSystemEvents,
    };
  },

  async getManagerDashboard(userId: string): Promise<ManagerDashboard> {
    const projectIds = await dashboardRepository.getManagerProjectIds(userId);

    const [stats, teamWorkload, sprintHealth, riskIssues, throughput, recentTeamActivity] =
      await Promise.all([
        dashboardRepository.getManagerStats(projectIds),
        dashboardRepository.getTeamWorkloadForProjects(projectIds),
        dashboardRepository.getSprintHealthForProjects(projectIds),
        dashboardRepository.getRiskIssuesForProjects(projectIds, 15),
        dashboardRepository.getManagerThroughput(projectIds, 30),
        dashboardRepository.getRecentActivity(userId, 20, false),
      ]);

    // Velocity across all managed projects (use first project or aggregate)
    const velocityData: VelocityPoint[] = [];
    if (projectIds.length > 0) {
      const perProject = await Promise.all(
        projectIds.slice(0, 3).map((pid) =>
          dashboardRepository.getVelocityChartData(pid, 6)
        )
      );
      // Flatten and take most recent 8 unique sprint entries
      for (const pts of perProject) {
        velocityData.push(...pts);
      }
      velocityData.sort((a, b) => {
        const aTime = a.startDate ? new Date(a.startDate as any).getTime() : 0;
        const bTime = b.startDate ? new Date(b.startDate as any).getTime() : 0;
        return aTime - bTime;
      });
    }

    return {
      role: 'manager',
      stats,
      teamWorkload,
      sprintHealth,
      velocityData: velocityData.slice(-8),
      riskIssues,
      throughput,
      recentTeamActivity,
    };
  },

  async getEmployeeDashboard(userId: string): Promise<EmployeeDashboard> {
    const includeAllProjects = await canViewAllProjectsInDashboard(userId);

    const [stats, myIssues, sprintContext, performance, upcomingDeadlines, recentActivity] =
      await Promise.all([
        dashboardRepository.getMyStats(userId),
        dashboardRepository.getMyIssues(userId, 20),
        dashboardRepository.getMySprintContext(userId),
        dashboardRepository.getMyPerformance(userId, 8),
        dashboardRepository.getDueSoonIssues(userId, 14, false),
        dashboardRepository.getRecentActivity(userId, 15, includeAllProjects, true),
      ]);

    return {
      role: 'employee',
      stats,
      myIssues,
      sprintContext,
      performance,
      upcomingDeadlines,
      recentActivity,
    };
  },

  // ============================================================
  // CHART DATA SERVICES
  // ============================================================

  async getGanttChartData(
    userId: string,
    options: {
      projectId?: string;
      projectIds?: string[];
      assigneeId?: string;
      sprintId?: string;
      epicId?: string;
      view?: GanttView;
    } = {}
  ): Promise<GanttChartData> {
    const includeAll = await canViewAllProjectsInDashboard(userId);
    let resolvedProjectIds: string[];

    if (options.projectIds && options.projectIds.length > 0) {
      resolvedProjectIds = options.projectIds;
    } else if (options.projectId) {
      resolvedProjectIds = [options.projectId];
    } else {
      resolvedProjectIds = await dashboardRepository.getAccessibleProjectIds(userId, includeAll);
    }

    const [items, sprints] = await Promise.all([
      dashboardRepository.getGanttChartItems(resolvedProjectIds, {
        assigneeId: options.assigneeId,
        sprintId: options.sprintId,
        epicId: options.epicId,
      }),
      dashboardRepository.getSprintsForGantt(resolvedProjectIds),
    ]);

    // Compute date range from items + sprints
    const dates = [
      ...items.flatMap((i) => [i.startDate, i.endDate]),
      ...sprints.flatMap((s: any) => [s.start_date, s.end_date]),
    ]
      .filter(Boolean)
      .map((d) => new Date(d!).getTime());

    const now = new Date();
    const rawStart = dates.length > 0 ? new Date(Math.min(...dates)) : now;
    const rawEnd   = dates.length > 0 ? new Date(Math.max(...dates)) : now;

    const view = options.view ?? 'monthly';
    const timeScale = buildGanttTimeScale(rawStart, rawEnd, view);

    const projectName =
      resolvedProjectIds.length === 1 ? (items[0]?.projectName ?? null) : null;

    return {
      projectId: resolvedProjectIds.length === 1 ? resolvedProjectIds[0] : null,
      projectName,
      items,
      sprints: sprints.map((s: any) => ({
        id: s.id,
        name: s.name,
        startDate: s.start_date,
        endDate: s.end_date,
        status: s.status,
      })),
      view,
      timeScale,
      dateRange: {
        start: timeScale[0].start,
        end: timeScale[timeScale.length - 1].end,
      },
    };
  },

  async getVelocityChartData(
    userId: string,
    projectId: string,
    limit: number = 10
  ): Promise<VelocityChartData> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!project) throw new Error('Project not found');

    const points = await dashboardRepository.getVelocityChartData(projectId, limit);

    let avgCompletionRate = 0;
    if (points.length > 0) {
      avgCompletionRate = Math.round(
        points.reduce((sum, p) => sum + p.completionRate, 0) / points.length
      );
    }

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (points.length >= 3) {
      const recent = points.slice(-3).map((p) => p.completionRate);
      const older = points.slice(-6, -3).map((p) => p.completionRate);
      if (older.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        if (recentAvg > olderAvg + 5) trend = 'improving';
        else if (recentAvg < olderAvg - 5) trend = 'declining';
      }
    }

    return {
      projectId: project.id,
      projectName: project.name,
      points,
      avgCompletionRate,
      trend,
    };
  },

  async getBurndownChartData(userId: string, sprintId: string): Promise<BurndownChartData> {
    const data = await dashboardRepository.getBurndownChartData(sprintId);
    if (!data) throw new Error('Sprint not found or has no dates set');
    return data;
  },

  async getCumulativeFlowData(
    userId: string,
    projectId: string,
    days: number = 30
  ): Promise<CumulativeFlowPoint[]> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new Error('Project not found');
    return dashboardRepository.getCumulativeFlowData(projectId, days);
  },
};
