import { Request, Response } from 'express';
import { TimeTrackingService } from './time-tracking.service';
import {
  TimesheetHistoryFilters,
  TimesheetLogInput,
  TimesheetSummaryFilters,
  TimesheetUpdateLogInput,
} from './time-tracking.types';
import {
  logTimeSchema,
  updateTimeLogSchema,
  startTimerSchema,
  stopTimerSchema,
  timesheetQuerySchema,
  timeReportQuerySchema,
  exportQuerySchema,
  timesheetLogSchema,
  timesheetHistoryQuerySchema,
  timesheetSummaryQuerySchema,
  timesheetUpdateLogSchema,
} from './time-tracking.validator';

const timeTrackingService = new TimeTrackingService();

export class TimeTrackingController {
  private normalizeTimesheetLogBody(body: any) {
    return {
      issueId: body.issueId ?? body.issue_id,
      workDate: body.workDate ?? body.work_date ?? body.date,
      hoursWorked: body.hoursWorked ?? body.hours_worked ?? body.hours,
      notes: body.notes ?? body.description,
      isBillable: body.isBillable ?? body.is_billable,
    };
  }

  private normalizeTimesheetUpdateBody(body: any) {
    return {
      hoursWorked: body.hoursWorked ?? body.hours_worked ?? body.hours,
      notes: body.notes ?? body.description,
      workDate: body.workDate ?? body.work_date ?? body.date,
      isBillable: body.isBillable ?? body.is_billable,
    };
  }

  private normalizeTimesheetHistoryQuery(query: any) {
    return {
      startDate: query.startDate ?? query.start_date,
      endDate: query.endDate ?? query.end_date,
      issueId: query.issueId ?? query.issue_id,
      projectId: query.projectId ?? query.project_id,
      userId: query.userId ?? query.user_id,
      viewAll: query.viewAll ?? query.view_all,
      isBillable: query.isBillable ?? query.is_billable,
      groupBy: query.groupBy ?? query.group_by,
      page: query.page,
      limit: query.limit,
    };
  }

  private normalizeTimesheetSummaryQuery(query: any) {
    return {
      startDate: query.startDate ?? query.start_date,
      endDate: query.endDate ?? query.end_date,
      issueId: query.issueId ?? query.issue_id,
      projectId: query.projectId ?? query.project_id,
      userId: query.userId ?? query.user_id,
      viewAll: query.viewAll ?? query.view_all,
      includeBreakdowns: query.includeBreakdowns ?? query.include_breakdowns,
    };
  }

  // Time Log endpoints
  async logTime(req: Request, res: Response) {
    const { issueId } = req.params;
    const userId = req.user!.id;
    const input = logTimeSchema.parse(req.body);

    const timeLog = await timeTrackingService.logTime(issueId, input as any, userId);

    res.status(201).json({
      success: true,
      data: timeLog,
    });
  }

  async getTimeLogsByIssue(req: Request, res: Response) {
    const { issueId } = req.params;
    const userId = req.user!.id;

    const timeLogs = await timeTrackingService.getTimeLogsByIssue(issueId, userId);

    res.json({
      success: true,
      data: timeLogs,
    });
  }

  async getIssueTimeSummary(req: Request, res: Response) {
    const { issueId } = req.params;
    const userId = req.user!.id;

    const summary = await timeTrackingService.getIssueTimeSummary(issueId, userId);

    res.json({
      success: true,
      data: summary,
    });
  }

  async getTimeLog(req: Request, res: Response) {
    const { timeLogId } = req.params;
    const userId = req.user!.id;

    const timeLog = await timeTrackingService.getTimeLogById(timeLogId, userId);

    res.json({
      success: true,
      data: timeLog,
    });
  }

  async updateTimeLog(req: Request, res: Response) {
    const { timeLogId } = req.params;
    const userId = req.user!.id;
    const input = updateTimeLogSchema.parse(req.body);

    const timeLog = await timeTrackingService.updateTimeLog(timeLogId, input, userId);

    res.json({
      success: true,
      data: timeLog,
    });
  }

  async deleteTimeLog(req: Request, res: Response) {
    const { timeLogId } = req.params;
    const userId = req.user!.id;

    const result = await timeTrackingService.deleteTimeLog(timeLogId, userId);

    res.json({
      success: true,
      message: result.message,
    });
  }

  // Timer endpoints
  async getActiveTimer(req: Request, res: Response) {
    const userId = req.user!.id;

    const timer = await timeTrackingService.getActiveTimer(userId);

    res.json({
      success: true,
      data: timer,
    });
  }

  async startTimer(req: Request, res: Response) {
    const userId = req.user!.id;
    const input = startTimerSchema.parse(req.body);

    const timer = await timeTrackingService.startTimer(input as any, userId);

    res.json({
      success: true,
      data: timer,
    });
  }

  async stopTimer(req: Request, res: Response) {
    const userId = req.user!.id;
    const input = stopTimerSchema.parse(req.body);

    const result = await timeTrackingService.stopTimer(input, userId);

    res.json({
      success: true,
      data: result,
    });
  }

  async pauseTimer(req: Request, res: Response) {
    const userId = req.user!.id;

    const timer = await timeTrackingService.pauseTimer(userId);

    res.json({
      success: true,
      data: timer,
    });
  }

  async resumeTimer(req: Request, res: Response) {
    const userId = req.user!.id;

    const timer = await timeTrackingService.resumeTimer(userId);

    res.json({
      success: true,
      data: timer,
    });
  }

  // Timesheet endpoint
  async getTimesheet(req: Request, res: Response) {
    const userId = req.user!.id;
    const query = timesheetQuerySchema.parse(req.query);

    const timesheet = await timeTrackingService.getTimesheet(
      query.startDate,
      query.endDate,
      query.userId,
      userId
    );

    res.json({
      success: true,
      data: timesheet,
    });
  }

  async logTimesheet(req: Request, res: Response) {
    const userId = req.user!.id;
    const normalized = this.normalizeTimesheetLogBody(req.body);
    const input = timesheetLogSchema.parse(normalized) as TimesheetLogInput;

    const result = await timeTrackingService.logTimesheet(input, userId);

    res.status(201).json({
      success: true,
      message: 'Time log created successfully',
      data: result,
    });
  }

  async getTimesheetHistory(req: Request, res: Response) {
    const currentUserId = req.user!.id;
    const normalized = this.normalizeTimesheetHistoryQuery(req.query);
    const query = timesheetHistoryQuerySchema.parse(normalized) as TimesheetHistoryFilters;

    const history = await timeTrackingService.getTimesheetHistory(query, currentUserId);

    res.json({
      success: true,
      data: history,
    });
  }

  async getTimesheetSummary(req: Request, res: Response) {
    const currentUserId = req.user!.id;
    const normalized = this.normalizeTimesheetSummaryQuery(req.query);
    const query = timesheetSummaryQuerySchema.parse(normalized) as TimesheetSummaryFilters;

    const summary = await timeTrackingService.getTimesheetSummary(query, currentUserId);

    res.json({
      success: true,
      data: summary,
    });
  }

  async updateTimesheetLog(req: Request, res: Response) {
    const userId = req.user!.id;
    const { logId } = req.params;
    const normalized = this.normalizeTimesheetUpdateBody(req.body);
    const input = timesheetUpdateLogSchema.parse(normalized) as TimesheetUpdateLogInput;

    const updated = await timeTrackingService.updateTimesheetLog(logId, input, userId);

    res.json({
      success: true,
      message: 'Time log updated successfully',
      data: updated,
    });
  }

  async deleteTimesheetLog(req: Request, res: Response) {
    const userId = req.user!.id;
    const { logId } = req.params;

    const result = await timeTrackingService.deleteTimeLog(logId, userId);

    res.json({
      success: true,
      message: result.message,
    });
  }

  // Report endpoints
  async getProjectTimeReport(req: Request, res: Response) {
    const { projectId } = req.params;
    const userId = req.user!.id;
    const query = timeReportQuerySchema.parse(req.query);

    const report = await timeTrackingService.getProjectTimeReport(
      projectId,
      query.startDate,
      query.endDate,
      userId
    );

    res.json({
      success: true,
      data: report,
    });
  }

  async getUserTimeReport(req: Request, res: Response) {
    const reportUserId = req.params.userId || req.user!.id;
    const currentUserId = req.user!.id;
    const query = timeReportQuerySchema.parse(req.query);

    const report = await timeTrackingService.getUserTimeReport(
      reportUserId,
      query.startDate,
      query.endDate,
      currentUserId
    );

    res.json({
      success: true,
      data: report,
    });
  }

  // Export endpoint
  async exportTimeLogs(req: Request, res: Response) {
    const userId = req.user!.id;
    const query = exportQuerySchema.parse(req.query);

    const csv = await timeTrackingService.exportTimeLogs(
      query.startDate,
      query.endDate,
      query.projectId,
      userId
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="time-logs-${query.startDate}-to-${query.endDate}.csv"`
    );
    res.send(csv);
  }
}
