import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { TimeTrackingRepository } from './time-tracking.repository';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { commentsService } from '../comments/comments.service';
import { financialService } from '../financial/financial.service';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/ApiError';
import { isSystemAdmin } from '../../utils/system-admin';
import {
  CreateTimeLogInput,
  UpdateTimeLogInput,
  StartTimerInput,
  StopTimerInput,
  TimesheetResponse,
  TimesheetDay,
  ProjectTimeReport,
  UserTimeReport,
  IssueTimeSummary,
  TimesheetLogInput,
  TimesheetUpdateLogInput,
  TimesheetHistoryFilters,
  TimesheetSummaryFilters,
  TimesheetHistoryLog,
} from './time-tracking.types';

export class TimeTrackingService {
  private timeTrackingRepository: TimeTrackingRepository;
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.timeTrackingRepository = new TimeTrackingRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  private toTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private calculateExpectedHours(startDate: string, endDate: string): number {
    let expectedHours = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const weekDay = day.getDay();
      if (weekDay !== 0 && weekDay !== 6) {
        expectedHours += 8;
      }
    }

    return expectedHours;
  }

  private calculateVariance(totalWorkedHours: number, baselineHours: number) {
    const overtime = Math.max(totalWorkedHours - baselineHours, 0);
    const underTime = Math.max(baselineHours - totalWorkedHours, 0);
    return {
      overtime: this.toTwoDecimals(overtime),
      underTime: this.toTwoDecimals(underTime),
    };
  }

  private async createManagerOverrideAudit(input: {
    actorId: string;
    action: 'timesheet.log.updated_by_manager' | 'timesheet.log.deleted_by_manager';
    logId: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  }): Promise<void> {
    const toJson = (value?: Record<string, unknown>) =>
      (value || null) as unknown as Prisma.InputJsonValue;

    try {
      await prisma.auditLog.create({
        data: {
          userId: input.actorId,
          action: input.action,
          entityType: 'time_log',
          entityId: input.logId,
          oldValues: toJson(input.oldValues),
          newValues: toJson(input.newValues),
          metadata: {
            override: true,
          },
        },
      });
    } catch (error) {
      logger.warn('Failed to create manager override audit log for timesheet', { error });
    }
  }

  // Time Log CRUD
  async logTime(issueId: string, input: CreateTimeLogInput, userId: string) {
    if (!issueId) {
      throw ApiError.badRequest('Issue id is required');
    }
    // Validate hours
    if (input.hours < 0.25 || input.hours > 24) {
      throw ApiError.badRequest('Hours must be between 0.25 and 24');
    }

    // Validate work date is not in the future
    const workDate = new Date(input.workDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (workDate > today) {
      throw ApiError.badRequest('Work date cannot be in the future');
    }

    // Check project access
    const projectId = await this.timeTrackingRepository.getIssueProjectId(issueId);
    if (!projectId) {
      throw ApiError.notFound('Issue not found');
    }
    await this.checkProjectAccess(projectId, userId);

    // Admins manage the project but do not log time themselves
    if (!await isSystemAdmin(userId)) {
      const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);
      if (membership?.role === 'admin') {
        throw ApiError.forbidden('Project administrators cannot log time on issues');
      }
    }

    const timeLog = await this.timeTrackingRepository.createTimeLog({
      id: uuidv4(),
      issueId,
      userId,
      hours: input.hours,
      description: input.description,
      workDate: input.workDate,
      isBillable: input.isBillable,
    });

    // Update issue time fields (time_spent_hours, remaining_estimate_hours)
    await this.timeTrackingRepository.updateIssueTimeFields(issueId);

    // Create activity log for time logging
    try {
      await commentsService.logActivity({
        issueId,
        userId,
        action: 'time_logged',
        fieldName: 'time',
        newValue: `${input.hours} hours`,
        metadata: {
          timeLogId: timeLog.id,
          workDate: input.workDate,
          description: input.description,
          isBillable: input.isBillable,
        },
      });
    } catch (error) {
      logger.warn('Failed to create activity log for time logging', { error });
    }

    // Fire-and-forget budget alert check (non-blocking)
    financialService.checkAndTriggerAlerts(projectId).catch((err) =>
      logger.warn('Budget alert check failed after logTime', { err }),
    );

    return this.timeTrackingRepository.findTimeLogById(timeLog.id);
  }

  async getTimeLogsByIssue(issueId: string, userId: string) {
    if (!issueId) {
      throw ApiError.badRequest('Issue id is required');
    }
    const projectId = await this.timeTrackingRepository.getIssueProjectId(issueId);
    if (!projectId) {
      throw ApiError.notFound('Issue not found');
    }
    await this.checkProjectAccess(projectId, userId);

    return this.timeTrackingRepository.findTimeLogsByIssue(issueId);
  }

  async getTimeLogById(timeLogId: string, userId: string) {
    const timeLog = await this.timeTrackingRepository.findTimeLogById(timeLogId);
    if (!timeLog) {
      throw ApiError.notFound('Time log not found');
    }

    const projectId = await this.timeTrackingRepository.getIssueProjectId(timeLog.issue_id);
    if (projectId) {
      await this.checkProjectAccess(projectId, userId);
    }

    return timeLog;
  }

  async getIssueTimeSummary(issueId: string, userId: string): Promise<IssueTimeSummary> {
    if (!issueId) {
      throw ApiError.badRequest('Issue id is required');
    }
    const projectId = await this.timeTrackingRepository.getIssueProjectId(issueId);
    if (!projectId) {
      throw ApiError.notFound('Issue not found');
    }
    await this.checkProjectAccess(projectId, userId);

    const summary = await this.timeTrackingRepository.getIssueTimeSummary(issueId);

    // Calculate percentage complete
    const percentageComplete = summary.originalEstimateHours > 0
      ? Math.min(100, (summary.timeSpentHours / summary.originalEstimateHours) * 100)
      : 0;

    return {
      ...summary,
      percentageComplete: Math.round(percentageComplete * 10) / 10, // Round to 1 decimal
    };
  }

  async updateTimeLog(timeLogId: string, input: UpdateTimeLogInput, userId: string) {
    const timeLog = await this.timeTrackingRepository.findTimeLogById(timeLogId);
    if (!timeLog) {
      throw ApiError.notFound('Time log not found');
    }

    const issueProjectId = await this.timeTrackingRepository.getIssueProjectId(timeLog.issue_id);
    const isOwner = timeLog.user_id === userId;

    // Owner can always edit. Leads/admins in same project can edit others.
    if (timeLog.user_id !== userId) {
      if (!issueProjectId) {
        throw ApiError.notFound('Issue not found');
      }
      await this.checkProjectAccess(issueProjectId, userId, ['admin', 'lead']);
    }

    // Validate hours if provided
    if (input.hours !== undefined && (input.hours < 0.25 || input.hours > 24)) {
      throw ApiError.badRequest('Hours must be between 0.25 and 24');
    }

    // Validate work date if provided
    if (input.workDate) {
      const workDate = new Date(input.workDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (workDate > today) {
        throw ApiError.badRequest('Work date cannot be in the future');
      }
    }

    await this.timeTrackingRepository.updateTimeLog(timeLogId, {
      hours: input.hours,
      description: input.description,
      workDate: input.workDate,
      isBillable: input.isBillable,
    });

    // Update issue time fields if hours changed
    if (input.hours !== undefined) {
      await this.timeTrackingRepository.updateIssueTimeFields(timeLog.issue_id);
    }

    const updated = await this.timeTrackingRepository.findTimeLogById(timeLogId);

    if (!isOwner) {
      await this.createManagerOverrideAudit({
        actorId: userId,
        action: 'timesheet.log.updated_by_manager',
        logId: timeLogId,
        oldValues: {
          hours: timeLog.hours,
          description: timeLog.description,
          workDate: timeLog.work_date,
          isBillable: timeLog.is_billable,
        },
        newValues: {
          hours: input.hours,
          description: input.description,
          workDate: input.workDate,
          isBillable: input.isBillable,
        },
      });
    }

    return updated;
  }

  async deleteTimeLog(timeLogId: string, userId: string) {
    const timeLog = await this.timeTrackingRepository.findTimeLogById(timeLogId);
    if (!timeLog) {
      throw ApiError.notFound('Time log not found');
    }

    const isOwner = timeLog.user_id === userId;

    // Owner can always delete. Leads/admins in same project can delete others.
    if (timeLog.user_id !== userId) {
      const projectId = await this.timeTrackingRepository.getIssueProjectId(timeLog.issue_id);
      if (projectId) {
        await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);
      }
    }

    const issueId = timeLog.issue_id;
    await this.timeTrackingRepository.deleteTimeLog(timeLogId);

    // Update issue time fields after deletion
    await this.timeTrackingRepository.updateIssueTimeFields(issueId);

    if (!isOwner) {
      await this.createManagerOverrideAudit({
        actorId: userId,
        action: 'timesheet.log.deleted_by_manager',
        logId: timeLogId,
        oldValues: {
          hours: timeLog.hours,
          description: timeLog.description,
          workDate: timeLog.work_date,
          isBillable: timeLog.is_billable,
          issueId: timeLog.issue_id,
          userId: timeLog.user_id,
        },
      });
    }

    return { message: 'Time log deleted successfully' };
  }

  // Timer functionality
  async getActiveTimer(userId: string) {
    const timer = await this.timeTrackingRepository.getActiveTimer(userId);
    if (!timer) {
      return null;
    }

    // Calculate elapsed time (accounting for accumulated time from pauses)
    let elapsedSeconds = timer.accumulated_seconds || 0;

    if (!timer.is_paused) {
      // Timer is running, add time since last start/resume
      const startTime = new Date(timer.started_at).getTime();
      elapsedSeconds += Math.floor((Date.now() - startTime) / 1000);
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    return {
      ...timer,
      elapsedSeconds,
      elapsedMinutes,
    };
  }

  async startTimer(input: StartTimerInput, userId: string) {
    // Check project access
    const projectId = await this.timeTrackingRepository.getIssueProjectId(input.issueId);
    if (!projectId) {
      throw ApiError.notFound('Issue not found');
    }
    await this.checkProjectAccess(projectId, userId);

    // Stop any existing timer first
    const existingTimer = await this.timeTrackingRepository.getActiveTimer(userId);
    if (existingTimer) {
      await this.stopTimer({}, userId);
    }

    await this.timeTrackingRepository.startTimer({
      id: uuidv4(),
      userId,
      issueId: input.issueId,
      description: input.description,
    });

    return this.timeTrackingRepository.getActiveTimer(userId);
  }

  async stopTimer(input: StopTimerInput, userId: string) {
    const timer = await this.timeTrackingRepository.getActiveTimer(userId);
    if (!timer) {
      throw ApiError.notFound('No active timer found');
    }

    // Calculate total elapsed seconds including accumulated time from pauses
    let totalSeconds = timer.accumulated_seconds || 0;

    if (!timer.is_paused) {
      // Add time since last start/resume
      const startTime = new Date(timer.started_at).getTime();
      totalSeconds += Math.floor((Date.now() - startTime) / 1000);
    }

    // Calculate hours (minimum 0.25, rounded to nearest quarter hour)
    const durationMinutes = totalSeconds / 60;
    const hours = Math.max(0.25, Math.round(durationMinutes / 15) * 0.25);

    // Create time log
    const timeLog = await this.timeTrackingRepository.createTimeLog({
      id: uuidv4(),
      issueId: timer.issue_id,
      userId,
      hours,
      description: input.description || timer.description || undefined,
      workDate: new Date().toISOString().split('T')[0],
      startedAt: timer.started_at,
      endedAt: new Date().toISOString(),
    });

    // Update issue time fields (time_spent_hours, remaining_estimate_hours)
    await this.timeTrackingRepository.updateIssueTimeFields(timer.issue_id);

    // Remove active timer
    await this.timeTrackingRepository.stopTimer(userId);

    return {
      timeLog: await this.timeTrackingRepository.findTimeLogById(timeLog.id),
    };
  }

  async pauseTimer(userId: string) {
    const timer = await this.timeTrackingRepository.getActiveTimer(userId);
    if (!timer) {
      throw ApiError.notFound('No active timer found');
    }

    if (timer.is_paused) {
      throw ApiError.badRequest('Timer is already paused');
    }

    await this.timeTrackingRepository.pauseTimer(userId);
    return this.getActiveTimer(userId);
  }

  async resumeTimer(userId: string) {
    const timer = await this.timeTrackingRepository.getActiveTimer(userId);
    if (!timer) {
      throw ApiError.notFound('No active timer found');
    }

    if (!timer.is_paused) {
      throw ApiError.badRequest('Timer is not paused');
    }

    await this.timeTrackingRepository.resumeTimer(userId);
    return this.getActiveTimer(userId);
  }

  // Timesheet
  async getTimesheet(
    startDate: string,
    endDate: string,
    requestedUserId: string | undefined,
    currentUserId: string
  ): Promise<TimesheetResponse> {
    const userId = requestedUserId || currentUserId;

    // Users can view their own timesheet, or admins/leads can view others
    if (userId !== currentUserId) {
      // For now, allow viewing others' timesheets if they share a project
      // In a real app, you'd check if the user has permission to view others' time
    }

    const timeLogs = await this.timeTrackingRepository.getTimesheetData(userId, startDate, endDate);

    // Group logs by date
    const dayMap = new Map<string, TimesheetDay>();
    let totalHours = 0;

    for (const log of timeLogs) {
      const dateKey = log.work_date;
      totalHours += parseFloat(log.hours as any);

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: dateKey,
          totalHours: 0,
          logs: [],
        });
      }

      const day = dayMap.get(dateKey)!;
      day.totalHours += parseFloat(log.hours as any);
      day.logs.push(log);
    }

    // Fill in missing days
    const days: TimesheetDay[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (dayMap.has(dateStr)) {
        days.push(dayMap.get(dateStr)!);
      } else {
        days.push({ date: dateStr, totalHours: 0, logs: [] });
      }
    }

    // Calculate expected hours (8 hours per weekday)
    let expectedHours = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        expectedHours += 8;
      }
    }

    return {
      startDate,
      endDate,
      user: {
        id: userId,
        displayName: timeLogs[0]?.user?.displayName || 'Unknown',
      },
      days,
      totalHours,
      expectedHours,
    };
  }

  async logTimesheet(input: TimesheetLogInput, userId: string) {
    const created = await this.logTime(
      input.issueId,
      {
        hours: input.hoursWorked,
        description: input.notes,
        workDate: input.workDate,
        isBillable: input.isBillable,
      },
      userId
    );

    if (!created) {
      throw ApiError.internal('Failed to create time log');
    }

    const issue = await this.timeTrackingRepository.findIssueForTimesheet(input.issueId);
    if (!issue) {
      throw ApiError.notFound('Issue not found');
    }

    return {
      log: {
        id: created.id,
        issueId: created.issue_id,
        userId: created.user_id,
        workDate: created.work_date.split('T')[0],
        hoursWorked: this.toTwoDecimals(Number(created.hours)),
        notes: created.description,
        isBillable: created.is_billable,
        createdAt: created.created_at,
      },
      issue: {
        id: issue.id,
        issueKey: issue.issueKey,
        title: issue.title,
        originalEstimateHours: issue.originalEstimateHours,
        remainingEstimateHours: issue.remainingEstimateHours,
      },
    };
  }

  async updateTimesheetLog(timeLogId: string, input: TimesheetUpdateLogInput, userId: string) {
    const updated = await this.updateTimeLog(
      timeLogId,
      {
        hours: input.hoursWorked,
        description: input.notes,
        workDate: input.workDate,
        isBillable: input.isBillable,
      },
      userId
    );

    if (!updated) {
      throw ApiError.notFound('Time log not found');
    }

    return {
      id: updated.id,
      issueId: updated.issue_id,
      userId: updated.user_id,
      workDate: updated.work_date.split('T')[0],
      hoursWorked: this.toTwoDecimals(Number(updated.hours)),
      notes: updated.description,
      isBillable: updated.is_billable,
      updatedAt: updated.updated_at,
    };
  }

  private async resolveTimesheetTargetUser(
    filters: Pick<TimesheetHistoryFilters, 'userId' | 'projectId' | 'issueId' | 'viewAll'>,
    currentUserId: string
  ): Promise<string | undefined> {
    if (filters.userId === currentUserId) {
      return currentUserId;
    }

    let scopeProjectId = filters.projectId;
    if (!scopeProjectId && filters.issueId) {
      scopeProjectId = (await this.timeTrackingRepository.getIssueProjectId(filters.issueId)) || undefined;
    }

    const systemAdmin = await isSystemAdmin(currentUserId);

    // When viewAll is requested, system admins can see all users across all projects
    if (filters.viewAll && !filters.userId) {
      if (systemAdmin) {
        return undefined; // No userId filter = all users
      }
      // Non-system-admins with viewAll need project scope
      if (scopeProjectId) {
        const membership = await this.projectMembersRepository.findByProjectAndUser(scopeProjectId, currentUserId);
        if (membership && (membership.role === 'admin' || membership.role === 'lead')) {
          return undefined;
        }
      }
      // Fall through to current user if not authorized for viewAll
      return currentUserId;
    }

    if (filters.userId) {
      if (systemAdmin) {
        return filters.userId;
      }

      if (!scopeProjectId) {
        throw ApiError.forbidden('Project scope is required to view another user timesheet');
      }

      await this.checkProjectAccess(scopeProjectId, currentUserId, ['admin', 'lead']);
      return filters.userId;
    }

    if (!scopeProjectId) {
      return currentUserId;
    }

    if (systemAdmin) {
      return undefined;
    }

    const membership = await this.projectMembersRepository.findByProjectAndUser(scopeProjectId, currentUserId);
    if (!membership) {
      throw ApiError.forbidden('Access denied');
    }

    if (membership.role === 'admin' || membership.role === 'lead') {
      return undefined;
    }

    return currentUserId;
  }

  private async buildTimesheetDataset(
    filters: TimesheetHistoryFilters,
    currentUserId: string
    ): Promise<{
    timezone: string;
    effectiveUserId?: string;
    logs: TimesheetHistoryLog[];
    totals: {
      totalWorkedHours: number;
      totalEstimatedHours: number;
      remainingEstimatedHours: number;
      expectedHours: number;
      overtimeVsExpected: number;
      underTimeVsExpected: number;
      overtimeVsEstimated: number;
      underTimeVsEstimated: number;
    };
    dayBuckets: {
      date: string;
      hoursWorked: number;
      logCount: number;
      logs: TimesheetHistoryLog[];
    }[];
  }> {
    const effectiveUserId = await this.resolveTimesheetTargetUser(filters, currentUserId);

    const logs = await this.timeTrackingRepository.findTimesheetLogs({
      startDate: filters.startDate,
      endDate: filters.endDate,
      issueId: filters.issueId,
      projectId: filters.projectId,
      userId: effectiveUserId,
      isBillable: filters.isBillable,
    });

    const issueIds = [...new Set(logs.map((log) => log.issueId))];
    const estimates = await this.timeTrackingRepository.getIssueEstimateMetrics(issueIds);

    const totalWorkedHours = this.toTwoDecimals(
      logs.reduce((sum, log) => sum + Number(log.hoursWorked), 0)
    );
    const totalEstimatedHours = this.toTwoDecimals(estimates.totalEstimatedHours);
    const remainingEstimatedHours = this.toTwoDecimals(estimates.remainingEstimatedHours);
    const expectedHours = this.toTwoDecimals(this.calculateExpectedHours(filters.startDate, filters.endDate));

    const vsExpected = this.calculateVariance(totalWorkedHours, expectedHours);
    const vsEstimated = this.calculateVariance(totalWorkedHours, totalEstimatedHours);

    const dayMap = new Map<string, { date: string; hoursWorked: number; logCount: number; logs: TimesheetHistoryLog[] }>();
    for (const log of logs) {
      if (!dayMap.has(log.workDate)) {
        dayMap.set(log.workDate, {
          date: log.workDate,
          hoursWorked: 0,
          logCount: 0,
          logs: [],
        });
      }
      const day = dayMap.get(log.workDate)!;
      day.hoursWorked = this.toTwoDecimals(day.hoursWorked + log.hoursWorked);
      day.logCount += 1;
      day.logs.push(log);
    }

    const dayBuckets = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    let timezone = 'UTC';
    const timezoneUserId = effectiveUserId || currentUserId;
    const user = await prisma.user.findUnique({
      where: { id: timezoneUserId },
      select: { timezone: true },
    });
    if (user?.timezone) {
      timezone = user.timezone;
    }

    return {
      timezone,
      effectiveUserId,
      logs,
      totals: {
        totalWorkedHours,
        totalEstimatedHours,
        remainingEstimatedHours,
        expectedHours,
        overtimeVsExpected: vsExpected.overtime,
        underTimeVsExpected: vsExpected.underTime,
        overtimeVsEstimated: vsEstimated.overtime,
        underTimeVsEstimated: vsEstimated.underTime,
      },
      dayBuckets,
    };
  }

  async getTimesheetHistory(filters: TimesheetHistoryFilters, currentUserId: string) {
    const dataset = await this.buildTimesheetDataset(filters, currentUserId);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;
    const logs =
      filters.groupBy === 'none'
        ? dataset.logs.slice(start, end)
        : [];

    const response: any = {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        timezone: dataset.timezone,
      },
      filters: {
        issueId: filters.issueId || null,
        projectId: filters.projectId || null,
        userId: filters.userId || dataset.effectiveUserId || null,
        isBillable: filters.isBillable ?? null,
      },
      totals: dataset.totals,
      dayBuckets: dataset.dayBuckets,
      logs,
    };

    if (filters.groupBy === 'none') {
      response.pagination = {
        page,
        limit,
        total: dataset.logs.length,
        totalPages: Math.max(1, Math.ceil(dataset.logs.length / limit)),
      };
    }

    return response;
  }

  async getTimesheetSummary(filters: TimesheetSummaryFilters, currentUserId: string) {
    const dataset = await this.buildTimesheetDataset(
      {
        ...filters,
        groupBy: 'day',
      },
      currentUserId
    );

    const byIssueMap = new Map<
      string,
      {
        issueId: string;
        issueKey: string;
        issueTitle: string;
        workedHours: number;
        estimatedHours: number;
      }
    >();
    const byProjectMap = new Map<
      string,
      {
        projectId: string;
        projectKey: string;
        projectName: string;
        workedHours: number;
      }
    >();

    for (const log of dataset.logs) {
      if (!byIssueMap.has(log.issueId)) {
        byIssueMap.set(log.issueId, {
          issueId: log.issueId,
          issueKey: log.issueKey,
          issueTitle: log.issueTitle,
          workedHours: 0,
          estimatedHours: log.originalEstimateHours,
        });
      }
      const issueEntry = byIssueMap.get(log.issueId)!;
      issueEntry.workedHours = this.toTwoDecimals(issueEntry.workedHours + log.hoursWorked);

      if (!byProjectMap.has(log.projectId)) {
        byProjectMap.set(log.projectId, {
          projectId: log.projectId,
          projectKey: log.projectKey,
          projectName: log.projectName,
          workedHours: 0,
        });
      }
      const projectEntry = byProjectMap.get(log.projectId)!;
      projectEntry.workedHours = this.toTwoDecimals(projectEntry.workedHours + log.hoursWorked);
    }

    const utilizationPercentVsExpected =
      dataset.totals.expectedHours > 0
        ? this.toTwoDecimals((dataset.totals.totalWorkedHours / dataset.totals.expectedHours) * 100)
        : 0;
    const accuracyPercentVsEstimate =
      dataset.totals.totalEstimatedHours > 0
        ? this.toTwoDecimals((dataset.totals.totalWorkedHours / dataset.totals.totalEstimatedHours) * 100)
        : 0;

    const response: any = {
      kpis: {
        totalWorkedHours: dataset.totals.totalWorkedHours,
        totalEstimatedHours: dataset.totals.totalEstimatedHours,
        expectedHours: dataset.totals.expectedHours,
        utilizationPercentVsExpected,
        accuracyPercentVsEstimate,
      },
      variance: {
        vsExpected: {
          overtime: dataset.totals.overtimeVsExpected,
          underTime: dataset.totals.underTimeVsExpected,
        },
        vsEstimated: {
          overtime: dataset.totals.overtimeVsEstimated,
          underTime: dataset.totals.underTimeVsEstimated,
        },
      },
    };

    if (filters.includeBreakdowns ?? true) {
      response.breakdowns = {
        byDay: dataset.dayBuckets.map((day) => ({
          date: day.date,
          hours: day.hoursWorked,
        })),
        byIssue: Array.from(byIssueMap.values()),
        byProject: Array.from(byProjectMap.values()),
      };
    }

    return response;
  }

  // Reports
  async getProjectTimeReport(
    projectId: string,
    startDate: string,
    endDate: string,
    userId: string
  ): Promise<ProjectTimeReport> {
    await this.checkProjectAccess(projectId, userId);

    const reportData = await this.timeTrackingRepository.getProjectTimeReport(
      projectId,
      startDate,
      endDate
    );

    // Get project info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, key: true },
    });

    if (!project) {
      throw ApiError.notFound('Project not found');
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        key: project.key,
      },
      period: {
        start: startDate,
        end: endDate,
      },
      totalHours: reportData.totalHours,
      totalEstimatedHours: reportData.totalEstimatedHours,
      byUser: reportData.byUser.map((u) => ({
        user: {
          id: u.userId,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
        },
        hours: u.hours,
        percentage: reportData.totalHours > 0 ? (u.hours / reportData.totalHours) * 100 : 0,
      })),
      byIssueType: reportData.byIssueType.map((t) => ({
        type: t.typeName,
        hours: t.hours,
      })),
    };
  }

  async getUserTimeReport(
    reportUserId: string,
    startDate: string,
    endDate: string,
    _currentUserId: string
  ): Promise<UserTimeReport> {
    // Users can view their own report, or admins can view others
    // For now, allow viewing own report (_currentUserId reserved for future permission checks)

    const reportData = await this.timeTrackingRepository.getUserTimeReport(
      reportUserId,
      startDate,
      endDate
    );

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: reportUserId },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return {
      user: {
        id: user.id,
        displayName: `${user.firstName} ${user.lastName}`,
        avatarUrl: user.avatarUrl,
      },
      period: {
        start: startDate,
        end: endDate,
      },
      totalHours: reportData.totalHours,
      byProject: reportData.byProject.map((p) => ({
        project: {
          id: p.projectId,
          name: p.projectName,
          key: p.projectKey,
        },
        hours: p.hours,
      })),
      byDay: reportData.byDay,
    };
  }

  // Export
  async exportTimeLogs(
    startDate: string,
    endDate: string,
    projectId: string | undefined,
    userId: string
  ): Promise<string> {
    // If projectId is provided, check access
    if (projectId) {
      await this.checkProjectAccess(projectId, userId);
    }

    const timeLogs = await this.timeTrackingRepository.getTimeLogsForExport({
      startDate,
      endDate,
      projectId,
      userId: projectId ? undefined : userId, // If no project filter, only export user's own logs
    });

    // Generate CSV
    const headers = [
      'Date',
      'Project',
      'Issue Key',
      'Issue Title',
      'User',
      'Hours',
      'Description',
      'Billable',
    ];

    const rows = timeLogs.map((log) => [
      log.work_date,
      log.project_name,
      log.issue_key,
      `"${(log.issue_title || '').replace(/"/g, '""')}"`,
      log.user_name,
      log.hours,
      `"${(log.description || '').replace(/"/g, '""')}"`,
      log.is_billable ? 'Yes' : 'No',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    return csv;
  }

  private async checkProjectAccess(projectId: string, userId: string, requiredRoles?: string[]) {
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
}
