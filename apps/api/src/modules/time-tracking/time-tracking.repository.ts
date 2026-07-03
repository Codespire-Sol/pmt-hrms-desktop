import { prisma } from '../../database/prisma';
import { TimeLog as PrismaTimeLog, ActiveTimer as PrismaActiveTimer } from '@prisma/client';
import {
  TimeLog,
  ActiveTimer,
  TimeLogWithIssue,
  TimesheetHistoryLog,
} from './time-tracking.types';

function toSnakeCaseTimeLog(p: PrismaTimeLog): TimeLog {
  return {
    id: p.id,
    issue_id: p.issueId,
    user_id: p.userId,
    hours: Number(p.hours),
    description: p.description,
    work_date: p.workDate.toISOString(),
    started_at: p.startedAt?.toISOString() ?? null,
    ended_at: p.endedAt?.toISOString() ?? null,
    is_billable: p.isBillable,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

function toSnakeCaseTimer(p: PrismaActiveTimer): ActiveTimer {
  return {
    id: p.id,
    user_id: p.userId,
    issue_id: p.issueId,
    started_at: p.startedAt.toISOString(),
    description: p.description,
    is_paused: p.isPaused,
    paused_at: p.pausedAt?.toISOString() ?? null,
    accumulated_seconds: p.totalPausedSeconds,
  };
}

function formatTimeLogWithIssue(row: any): TimeLogWithIssue {
  const { issue, user, ...rest } = row;
  const timeLog = toSnakeCaseTimeLog(rest as PrismaTimeLog);
  return {
    ...timeLog,
    issue: {
      id: issue.id,
      issueKey: `${issue.project.key}-${issue.issueNumber}`,
      title: issue.title,
    },
    ...(user
      ? {
          user: {
            id: user.id,
            displayName: `${user.firstName} ${user.lastName}`,
            avatarUrl: user.avatarUrl,
          },
        }
      : {}),
  };
}

const timeLogInclude = {
  issue: {
    select: {
      id: true,
      issueNumber: true,
      title: true,
      project: { select: { key: true } },
    },
  },
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
} as const;

const timerIssueInclude = {
  issue: {
    select: {
      id: true,
      issueNumber: true,
      title: true,
      project: { select: { key: true } },
    },
  },
} as const;

export class TimeTrackingRepository {
  async findIssueForTimesheet(issueId: string): Promise<{
    id: string;
    projectId: string;
    issueKey: string;
    title: string;
    originalEstimateHours: number;
    remainingEstimateHours: number;
  } | null> {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        projectId: true,
        issueNumber: true,
        title: true,
        originalEstimateHours: true,
        remainingEstimateHours: true,
        project: {
          select: {
            key: true,
          },
        },
      },
    });

    if (!issue) {
      return null;
    }

    return {
      id: issue.id,
      projectId: issue.projectId,
      issueKey: `${issue.project.key}-${issue.issueNumber}`,
      title: issue.title,
      originalEstimateHours: Number(issue.originalEstimateHours) || 0,
      remainingEstimateHours: Number(issue.remainingEstimateHours) || 0,
    };
  }

  // Time Log CRUD
  async createTimeLog(input: {
    id: string;
    issueId: string;
    userId: string;
    hours: number;
    description?: string;
    workDate: string;
    startedAt?: string;
    endedAt?: string;
    isBillable?: boolean;
  }): Promise<TimeLog> {
    const timeLog = await prisma.timeLog.create({
      data: {
        id: input.id,
        issueId: input.issueId,
        userId: input.userId,
        hours: input.hours,
        description: input.description,
        workDate: new Date(input.workDate),
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
        endedAt: input.endedAt ? new Date(input.endedAt) : undefined,
        isBillable: input.isBillable ?? true,
      },
    });
    return toSnakeCaseTimeLog(timeLog);
  }

  async findTimeLogById(id: string): Promise<TimeLogWithIssue | null> {
    const timeLog = await prisma.timeLog.findUnique({
      where: { id },
      include: timeLogInclude,
    });

    if (!timeLog) return null;

    return formatTimeLogWithIssue(timeLog);
  }

  async findTimeLogsByIssue(issueId: string): Promise<TimeLogWithIssue[]> {
    const timeLogs = await prisma.timeLog.findMany({
      where: { issueId },
      include: timeLogInclude,
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    });

    return timeLogs.map(formatTimeLogWithIssue);
  }

  async updateTimeLog(
    id: string,
    input: {
      hours?: number;
      description?: string;
      workDate?: string;
      isBillable?: boolean;
    }
  ): Promise<TimeLog> {
    const updateData: any = {};
    if (input.hours !== undefined) updateData.hours = input.hours;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.workDate !== undefined) updateData.workDate = new Date(input.workDate);
    if (input.isBillable !== undefined) updateData.isBillable = input.isBillable;

    const timeLog = await prisma.timeLog.update({
      where: { id },
      data: updateData,
    });
    return toSnakeCaseTimeLog(timeLog);
  }

  async deleteTimeLog(id: string): Promise<void> {
    await prisma.timeLog.delete({ where: { id } });
  }

  // Active Timer methods
  async getActiveTimer(userId: string): Promise<(ActiveTimer & { issue: any }) | null> {
    const timer = await prisma.activeTimer.findUnique({
      where: { userId },
      include: timerIssueInclude,
    });

    if (!timer) return null;

    const { issue, ...rest } = timer;
    return {
      ...toSnakeCaseTimer(rest),
      issue: {
        id: issue.id,
        issueKey: `${issue.project.key}-${issue.issueNumber}`,
        title: issue.title,
      },
    };
  }

  async startTimer(input: {
    id: string;
    userId: string;
    issueId: string;
    description?: string;
  }): Promise<ActiveTimer> {
    // First, delete any existing timer for this user (shouldn't happen due to unique constraint)
    await prisma.activeTimer.deleteMany({ where: { userId: input.userId } });

    const timer = await prisma.activeTimer.create({
      data: {
        id: input.id,
        userId: input.userId,
        issueId: input.issueId,
        description: input.description,
        startedAt: new Date(),
      },
    });

    return toSnakeCaseTimer(timer);
  }

  async stopTimer(userId: string): Promise<ActiveTimer | null> {
    const timer = await prisma.activeTimer.findUnique({ where: { userId } });
    if (timer) {
      await prisma.activeTimer.delete({ where: { userId } });
    }
    return timer ? toSnakeCaseTimer(timer) : null;
  }

  async pauseTimer(userId: string): Promise<ActiveTimer | null> {
    const timer = await prisma.activeTimer.findUnique({ where: { userId } });
    if (!timer || timer.isPaused) {
      return timer ? toSnakeCaseTimer(timer) : null;
    }

    // Calculate seconds elapsed since started_at (or last resume)
    const startedAt = new Date(timer.startedAt).getTime();
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - startedAt) / 1000);

    const updatedTimer = await prisma.activeTimer.update({
      where: { userId },
      data: {
        isPaused: true,
        pausedAt: new Date(),
        totalPausedSeconds: timer.totalPausedSeconds + elapsedSeconds,
      },
    });

    return toSnakeCaseTimer(updatedTimer);
  }

  async resumeTimer(userId: string): Promise<ActiveTimer | null> {
    const timer = await prisma.activeTimer.findUnique({ where: { userId } });
    if (!timer?.isPaused) {
      return timer ? toSnakeCaseTimer(timer) : null;
    }

    // Reset started_at to now (totalPausedSeconds already tracks prior time)
    const updatedTimer = await prisma.activeTimer.update({
      where: { userId },
      data: {
        isPaused: false,
        pausedAt: null,
        startedAt: new Date(),
      },
    });

    return toSnakeCaseTimer(updatedTimer);
  }

  // Timesheet methods
  async getTimesheetData(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeLogWithIssue[]> {
    const timeLogs = await prisma.timeLog.findMany({
      where: {
        userId,
        workDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        issue: {
          select: {
            id: true,
            issueNumber: true,
            title: true,
            project: { select: { key: true } },
          },
        },
      },
      orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
    });

    return timeLogs.map((row) => {
      const { issue, ...rest } = row;
      const timeLog = toSnakeCaseTimeLog(rest as any);
      return {
        ...timeLog,
        work_date: timeLog.work_date.split('T')[0],
        issue: {
          id: issue.id,
          issueKey: `${issue.project.key}-${issue.issueNumber}`,
          title: issue.title,
        },
      } as TimeLogWithIssue;
    });
  }

  async findTimesheetLogs(filters: {
    startDate: string;
    endDate: string;
    issueId?: string;
    projectId?: string;
    userId?: string;
    isBillable?: boolean;
  }): Promise<TimesheetHistoryLog[]> {
    const logs = await prisma.timeLog.findMany({
      where: {
        workDate: {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        },
        issueId: filters.issueId,
        userId: filters.userId,
        isBillable: filters.isBillable,
        issue: filters.projectId
          ? {
              projectId: filters.projectId,
            }
          : undefined,
      },
      include: {
        issue: {
          select: {
            id: true,
            issueNumber: true,
            title: true,
            projectId: true,
            originalEstimateHours: true,
            remainingEstimateHours: true,
            project: {
              select: {
                id: true,
                key: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    });

    return logs.map((log) => ({
      id: log.id,
      issueId: log.issueId,
      issueKey: `${log.issue.project.key}-${log.issue.issueNumber}`,
      issueTitle: log.issue.title,
      projectId: log.issue.project.id,
      projectKey: log.issue.project.key,
      projectName: log.issue.project.name,
      userId: log.userId,
      userName: `${log.user.firstName} ${log.user.lastName}`.trim(),
      hoursWorked: Number(log.hours),
      workDate: log.workDate.toISOString().split('T')[0],
      notes: log.description ?? null,
      isBillable: log.isBillable,
      originalEstimateHours: Number(log.issue.originalEstimateHours) || 0,
      remainingEstimateHours: Number(log.issue.remainingEstimateHours) || 0,
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
    }));
  }

  async getIssueEstimateMetrics(issueIds: string[]): Promise<{
    totalEstimatedHours: number;
    remainingEstimatedHours: number;
    byIssue: {
      issueId: string;
      issueKey: string;
      issueTitle: string;
      projectId: string;
      projectKey: string;
      projectName: string;
      estimatedHours: number;
      remainingEstimateHours: number;
    }[];
  }> {
    if (issueIds.length === 0) {
      return {
        totalEstimatedHours: 0,
        remainingEstimatedHours: 0,
        byIssue: [],
      };
    }

    const issues = await prisma.issue.findMany({
      where: {
        id: {
          in: issueIds,
        },
      },
      select: {
        id: true,
        title: true,
        issueNumber: true,
        projectId: true,
        originalEstimateHours: true,
        remainingEstimateHours: true,
        project: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    const byIssue = issues.map((issue) => ({
      issueId: issue.id,
      issueKey: `${issue.project.key}-${issue.issueNumber}`,
      issueTitle: issue.title,
      projectId: issue.project.id,
      projectKey: issue.project.key,
      projectName: issue.project.name,
      estimatedHours: Number(issue.originalEstimateHours) || 0,
      remainingEstimateHours: Number(issue.remainingEstimateHours) || 0,
    }));

    return {
      totalEstimatedHours: byIssue.reduce((sum, issue) => sum + issue.estimatedHours, 0),
      remainingEstimatedHours: byIssue.reduce((sum, issue) => sum + issue.remainingEstimateHours, 0),
      byIssue,
    };
  }

  // Report methods
  async getProjectTimeReport(
    projectId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalHours: number;
    totalEstimatedHours: number;
    byUser: { userId: string; displayName: string; avatarUrl: string | null; hours: number }[];
    byIssueType: { typeName: string; hours: number }[];
  }> {
    // Total hours logged
    const totalResult = await prisma.$queryRaw<[{ total: number | null }]>`
      SELECT COALESCE(SUM(tl.hours), 0)::float AS total
      FROM time_logs tl
      LEFT JOIN issues i ON tl.issue_id = i.id
      WHERE i.project_id = ${projectId}::uuid
        AND tl.work_date BETWEEN ${startDate}::date AND ${endDate}::date
    `;

    // Total estimated hours
    const estimatedResult = await prisma.$queryRaw<[{ total: number | null }]>`
      SELECT COALESCE(SUM(original_estimate_hours), 0)::float AS total
      FROM issues
      WHERE project_id = ${projectId}::uuid
        AND deleted_at IS NULL
    `;

    // Hours by user
    const byUserRows = await prisma.$queryRaw<
      { userId: string; firstName: string; lastName: string; avatarUrl: string | null; hours: number }[]
    >`
      SELECT
        u.id AS "userId",
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.avatar_url AS "avatarUrl",
        COALESCE(SUM(tl.hours), 0)::float AS hours
      FROM time_logs tl
      LEFT JOIN issues i ON tl.issue_id = i.id
      LEFT JOIN users u ON tl.user_id = u.id
      WHERE i.project_id = ${projectId}::uuid
        AND tl.work_date BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY u.id, u.first_name, u.last_name, u.avatar_url
      ORDER BY hours DESC
    `;

    // Hours by issue type
    const byIssueTypeRows = await prisma.$queryRaw<
      { typeName: string; hours: number }[]
    >`
      SELECT
        it.display_name AS "typeName",
        COALESCE(SUM(tl.hours), 0)::float AS hours
      FROM time_logs tl
      LEFT JOIN issues i ON tl.issue_id = i.id
      LEFT JOIN issue_types it ON i.type_id = it.id
      WHERE i.project_id = ${projectId}::uuid
        AND tl.work_date BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY it.id, it.display_name
      ORDER BY hours DESC
    `;

    return {
      totalHours: totalResult[0]?.total || 0,
      totalEstimatedHours: estimatedResult[0]?.total || 0,
      byUser: byUserRows.map((u) => ({
        userId: u.userId,
        displayName: `${u.firstName} ${u.lastName}`,
        avatarUrl: u.avatarUrl,
        hours: u.hours || 0,
      })),
      byIssueType: byIssueTypeRows.map((t) => ({
        typeName: t.typeName,
        hours: t.hours || 0,
      })),
    };
  }

  async getUserTimeReport(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalHours: number;
    byProject: { projectId: string; projectName: string; projectKey: string; hours: number }[];
    byDay: { date: string; hours: number }[];
  }> {
    // Total hours
    const totalResult = await prisma.$queryRaw<[{ total: number | null }]>`
      SELECT COALESCE(SUM(hours), 0)::float AS total
      FROM time_logs
      WHERE user_id = ${userId}::uuid
        AND work_date BETWEEN ${startDate}::date AND ${endDate}::date
    `;

    // Hours by project
    const byProjectRows = await prisma.$queryRaw<
      { projectId: string; projectName: string; projectKey: string; hours: number }[]
    >`
      SELECT
        p.id AS "projectId",
        p.name AS "projectName",
        p.key AS "projectKey",
        COALESCE(SUM(tl.hours), 0)::float AS hours
      FROM time_logs tl
      LEFT JOIN issues i ON tl.issue_id = i.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE tl.user_id = ${userId}::uuid
        AND tl.work_date BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY p.id, p.name, p.key
      ORDER BY hours DESC
    `;

    // Hours by day
    const byDayRows = await prisma.$queryRaw<
      { date: string; hours: number }[]
    >`
      SELECT
        work_date::text AS date,
        COALESCE(SUM(hours), 0)::float AS hours
      FROM time_logs
      WHERE user_id = ${userId}::uuid
        AND work_date BETWEEN ${startDate}::date AND ${endDate}::date
      GROUP BY work_date
      ORDER BY work_date ASC
    `;

    return {
      totalHours: totalResult[0]?.total || 0,
      byProject: byProjectRows.map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        projectKey: p.projectKey,
        hours: p.hours || 0,
      })),
      byDay: byDayRows.map((d) => ({
        date: d.date,
        hours: d.hours || 0,
      })),
    };
  }

  // Export methods
  async getTimeLogsForExport(filters: {
    startDate: string;
    endDate: string;
    projectId?: string;
    userId?: string;
  }): Promise<any[]> {
    const logs = await prisma.timeLog.findMany({
      where: {
        workDate: {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        },
        userId: filters.userId,
        issue: filters.projectId
          ? {
              projectId: filters.projectId,
            }
          : undefined,
      },
      include: {
        issue: {
          select: {
            issueNumber: true,
            title: true,
            project: {
              select: {
                key: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [{ workDate: 'asc' }, { createdAt: 'asc' }],
    });

    return logs.map((log) => ({
      id: log.id,
      hours: Number(log.hours),
      description: log.description,
      work_date: log.workDate.toISOString().split('T')[0],
      is_billable: log.isBillable,
      created_at: log.createdAt.toISOString(),
      issue_key: `${log.issue.project.key}-${log.issue.issueNumber}`,
      issue_title: log.issue.title,
      project_name: log.issue.project.name,
      project_key: log.issue.project.key,
      user_name: `${log.user.firstName} ${log.user.lastName}`.trim(),
      user_email: log.user.email,
    }));
  }

  // Helper method to get issue's project_id
  async getIssueProjectId(issueId: string): Promise<string | null> {
    if (!issueId) return null;
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { projectId: true },
    });
    return issue?.projectId || null;
  }

  // Calculate and update issue time fields (time_spent_hours, remaining_estimate_hours)
  async updateIssueTimeFields(issueId: string): Promise<void> {
    // Sum all time logs for this issue
    const result = await prisma.timeLog.aggregate({
      _sum: { hours: true },
      where: { issueId },
    });

    const timeSpentHours = Number.parseFloat(String(result._sum.hours)) || 0;

    // Get the original estimate to calculate remaining
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { originalEstimateHours: true },
    });

    const originalEstimate = issue?.originalEstimateHours
      ? Number.parseFloat(String(issue.originalEstimateHours))
      : 0;

    // Calculate remaining estimate (cannot go below 0)
    const remainingEstimate = Math.max(0, originalEstimate - timeSpentHours);

    // Update the issue
    await prisma.issue.update({
      where: { id: issueId },
      data: {
        timeSpentHours,
        remainingEstimateHours: remainingEstimate,
        updatedAt: new Date(),
      },
    });
  }

  // Get issue time summary for frontend display
  async getIssueTimeSummary(issueId: string): Promise<{
    originalEstimateHours: number;
    timeSpentHours: number;
    remainingEstimateHours: number;
  }> {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        originalEstimateHours: true,
        timeSpentHours: true,
        remainingEstimateHours: true,
      },
    });

    if (!issue) {
      return {
        originalEstimateHours: 0,
        timeSpentHours: 0,
        remainingEstimateHours: 0,
      };
    }

    return {
      originalEstimateHours: Number.parseFloat(String(issue.originalEstimateHours)) || 0,
      timeSpentHours: Number.parseFloat(String(issue.timeSpentHours)) || 0,
      remainingEstimateHours: Number.parseFloat(String(issue.remainingEstimateHours)) || 0,
    };
  }

  // Sum logged hours in sprint (used by sprints module)
  async sumLoggedHoursInSprint(sprintId: string): Promise<number> {
    const result = await prisma.$queryRaw<[{ total: number | null }]>`
      SELECT COALESCE(SUM(tl.hours), 0)::float AS total
      FROM time_logs tl
      LEFT JOIN issues i ON tl.issue_id = i.id
      WHERE i.sprint_id = ${sprintId}::uuid
    `;
    return result[0]?.total || 0;
  }
}
