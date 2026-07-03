/**
 * Scheduled Reports Service
 * Manages scheduled report creation, scheduling, and delivery
 */

import { prisma } from '../database/prisma';
import { emailService, EmailAttachment } from './email.service';
import { emailTemplates } from './email.templates';
import { pdfService } from './pdf.service';
import { reportsService } from '../modules/reports/reports.service';
import { config } from '../config';

export type ReportType = 'sprint' | 'team_workload' | 'time_tracking' | 'distribution';
export type ReportFormat = 'pdf' | 'csv' | 'json';
export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface ScheduledReport {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  reportType: ReportType;
  format: ReportFormat;
  frequency: Frequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  timezone: string;
  recipients: string[];
  includeSelf: boolean;
  filters: Record<string, any>;
  isActive: boolean;
  lastSentAt?: Date;
  nextRunAt?: Date;
  sendCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledReportInput {
  name: string;
  reportType: ReportType;
  format?: ReportFormat;
  projectId?: string;
  frequency: Frequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay?: string;
  timezone?: string;
  recipients: string[];
  includeSelf?: boolean;
  filters?: Record<string, any>;
}

export interface UpdateScheduledReportInput {
  name?: string;
  format?: ReportFormat;
  frequency?: Frequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay?: string;
  timezone?: string;
  recipients?: string[];
  includeSelf?: boolean;
  filters?: Record<string, any>;
  isActive?: boolean;
}

export interface ReportExecutionResult {
  scheduledReportId: string;
  status: 'success' | 'failed' | 'partial';
  recipientsCount: number;
  successfulDeliveries: number;
  errorMessage?: string;
  fileSizeBytes?: number;
  generationTimeMs?: number;
}

class ScheduledReportsService {
  /**
   * Create a new scheduled report
   */
  async create(userId: string, input: CreateScheduledReportInput): Promise<ScheduledReport> {
    const nextRunAt = this.calculateNextRun(
      input.frequency,
      input.timeOfDay || '09:00',
      input.timezone || 'UTC',
      input.dayOfWeek,
      input.dayOfMonth
    );

    const report = await prisma.scheduledReport.create({
      data: {
        userId,
        projectId: input.projectId,
        name: input.name,
        reportType: input.reportType,
        format: input.format || 'pdf',
        frequency: input.frequency,
        dayOfWeek: input.dayOfWeek,
        dayOfMonth: input.dayOfMonth,
        timeOfDay: input.timeOfDay || '09:00',
        timezone: input.timezone || 'UTC',
        recipients: input.recipients,
        includeSelf: input.includeSelf !== false,
        filters: input.filters || {},
        nextRunAt,
      },
    });

    return this.mapToScheduledReport(report);
  }

  /**
   * Get all scheduled reports for a user
   */
  async getByUser(userId: string): Promise<ScheduledReport[]> {
    const reports = await prisma.scheduledReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return reports.map(this.mapToScheduledReport);
  }

  /**
   * Get a single scheduled report
   */
  async getById(id: string, userId: string): Promise<ScheduledReport | null> {
    const report = await prisma.scheduledReport.findFirst({
      where: { id, userId },
    });

    return report ? this.mapToScheduledReport(report) : null;
  }

  /**
   * Update a scheduled report
   */
  async update(id: string, userId: string, input: UpdateScheduledReportInput): Promise<ScheduledReport> {
    const existing = await this.getById(id, userId);
    if (!existing) {
      throw new Error('Scheduled report not found');
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.format !== undefined) updateData.format = input.format;
    if (input.frequency !== undefined) updateData.frequency = input.frequency;
    if (input.dayOfWeek !== undefined) updateData.dayOfWeek = input.dayOfWeek;
    if (input.dayOfMonth !== undefined) updateData.dayOfMonth = input.dayOfMonth;
    if (input.timeOfDay !== undefined) updateData.timeOfDay = input.timeOfDay;
    if (input.timezone !== undefined) updateData.timezone = input.timezone;
    if (input.recipients !== undefined) updateData.recipients = input.recipients;
    if (input.includeSelf !== undefined) updateData.includeSelf = input.includeSelf;
    if (input.filters !== undefined) updateData.filters = input.filters;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    // Recalculate next run if schedule changed
    if (input.frequency || input.timeOfDay || input.timezone || input.dayOfWeek || input.dayOfMonth) {
      updateData.nextRunAt = this.calculateNextRun(
        input.frequency || existing.frequency,
        input.timeOfDay || existing.timeOfDay,
        input.timezone || existing.timezone,
        input.dayOfWeek ?? existing.dayOfWeek,
        input.dayOfMonth ?? existing.dayOfMonth
      );
    }

    const report = await prisma.scheduledReport.update({
      where: { id },
      data: updateData,
    });

    return this.mapToScheduledReport(report);
  }

  /**
   * Delete a scheduled report
   */
  async delete(id: string, userId: string): Promise<void> {
    const report = await prisma.scheduledReport.findFirst({
      where: { id, userId },
    });

    if (!report) {
      throw new Error('Scheduled report not found');
    }

    await prisma.scheduledReport.delete({
      where: { id },
    });
  }

  /**
   * Get reports due for execution
   */
  async getDueReports(): Promise<ScheduledReport[]> {
    const reports = await prisma.scheduledReport.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: new Date() },
      },
      orderBy: { nextRunAt: 'asc' },
      take: 50,
    });

    return reports.map(this.mapToScheduledReport);
  }

  /**
   * Execute a scheduled report
   */
  async execute(report: ScheduledReport): Promise<ReportExecutionResult> {
    const startTime = Date.now();
    let reportBuffer: Buffer;
    let reportData: any;
    let mimeType: string;
    let fileExtension: string;

    try {
      // Get user information
      const user = await prisma.user.findUnique({
        where: { id: report.userId },
      });
      if (!user) {
        throw new Error('User not found');
      }

      // Generate the report data
      switch (report.reportType) {
        case 'sprint':
          if (!report.projectId) throw new Error('Project ID required for sprint report');
          reportData = await reportsService.getSprintReport(report.projectId);
          break;
        case 'team_workload':
          if (!report.projectId) throw new Error('Project ID required for team workload report');
          reportData = await reportsService.getTeamWorkloadReport(
            report.projectId,
            report.filters.startDate,
            report.filters.endDate
          );
          break;
        case 'time_tracking':
          reportData = await reportsService.getTimeTrackingReport(
            report.userId,
            report.filters.startDate,
            report.filters.endDate,
            report.projectId
          );
          break;
        case 'distribution':
          if (!report.projectId) throw new Error('Project ID required for distribution report');
          reportData = await reportsService.getIssueDistributionReport(report.projectId);
          break;
        default:
          throw new Error(`Unknown report type: ${report.reportType}`);
      }

      // Generate the report in the requested format
      switch (report.format) {
        case 'pdf':
          reportBuffer = await this.generatePdfReport(report.reportType, reportData);
          mimeType = 'application/pdf';
          fileExtension = 'pdf';
          break;
        case 'csv':
          reportBuffer = Buffer.from(this.generateCsvReport(report.reportType, reportData));
          mimeType = 'text/csv';
          fileExtension = 'csv';
          break;
        case 'json':
          reportBuffer = Buffer.from(JSON.stringify(reportData, null, 2));
          mimeType = 'application/json';
          fileExtension = 'json';
          break;
        default:
          throw new Error(`Unknown format: ${report.format}`);
      }

      const generationTimeMs = Date.now() - startTime;

      // Build recipient list
      const recipients: string[] = [...report.recipients];
      if (report.includeSelf && !recipients.includes(user.email)) {
        recipients.push(user.email);
      }

      // Get project name if applicable
      let projectName: string | undefined;
      if (report.projectId) {
        const project = await prisma.project.findUnique({
          where: { id: report.projectId },
        });
        projectName = project?.name;
      }

      // Prepare attachment
      const attachment: EmailAttachment = {
        content: reportBuffer.toString('base64'),
        filename: `${report.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.${fileExtension}`,
        type: mimeType,
      };

      // Send emails
      let successfulDeliveries = 0;
      for (const recipient of recipients) {
        const recipientUser = await prisma.user.findFirst({
          where: { email: recipient },
        });
        const recipientName = recipientUser?.firstName && recipientUser?.lastName
          ? `${recipientUser.firstName} ${recipientUser.lastName}`
          : recipient.split('@')[0];

        const html = emailTemplates.scheduledReport({
          recipientName,
          reportName: report.name,
          reportType: this.formatReportType(report.reportType),
          projectName,
          generatedAt: new Date().toLocaleString('en-US', { timeZone: report.timezone || 'UTC' }),
          frequency: report.frequency,
          dashboardUrl: `${config.frontend.url}/reports`,
        });

        const sent = await emailService.sendEmail({
          to: recipient,
          subject: `[ProjectFlow] ${report.name} - ${this.formatReportType(report.reportType)} Report`,
          html,
          attachments: [attachment],
        });

        if (sent) successfulDeliveries++;
      }

      // Record success
      const result: ReportExecutionResult = {
        scheduledReportId: report.id,
        status: successfulDeliveries === recipients.length ? 'success' : 'partial',
        recipientsCount: recipients.length,
        successfulDeliveries,
        fileSizeBytes: reportBuffer.length,
        generationTimeMs,
      };

      await this.recordExecution(result);
      await this.updateAfterExecution(report);

      return result;
    } catch (error: any) {
      const result: ReportExecutionResult = {
        scheduledReportId: report.id,
        status: 'failed',
        recipientsCount: 0,
        successfulDeliveries: 0,
        errorMessage: error.message,
        generationTimeMs: Date.now() - startTime,
      };

      await this.recordExecution(result);
      return result;
    }
  }

  /**
   * Generate PDF report based on type
   */
  private async generatePdfReport(type: ReportType, data: any): Promise<Buffer> {
    switch (type) {
      case 'sprint':
        return pdfService.generateSprintReportPdf(data);
      case 'team_workload':
        return pdfService.generateTeamWorkloadPdf(data);
      case 'time_tracking':
        return pdfService.generateTimeTrackingPdf(data);
      case 'distribution':
        return pdfService.generateIssueDistributionPdf(data);
      default:
        throw new Error(`PDF generation not supported for type: ${type}`);
    }
  }

  /**
   * Generate CSV report based on type
   */
  private generateCsvReport(type: ReportType, data: any): string {
    switch (type) {
      case 'sprint':
        return reportsService.exportVelocityToCsv(data.velocityHistory);
      case 'team_workload':
        return reportsService.exportTeamWorkloadToCsv(data.members);
      case 'time_tracking':
        return reportsService.exportTimeLogsToCsv(data.recentLogs);
      case 'distribution': {
        // Create a simple CSV for distribution
        let csv = 'Category,Name,Count\n';
        ['byStatus', 'byPriority', 'byType', 'byAssignee'].forEach((category) => {
          if (data[category]) {
            data[category].forEach((item: any) => {
              csv += `${category.replace('by', '')},${item.name},${item.count}\n`;
            });
          }
        });
        return csv;
      }
      default:
        throw new Error(`CSV generation not supported for type: ${type}`);
    }
  }

  /**
   * Record execution history
   */
  private async recordExecution(result: ReportExecutionResult): Promise<void> {
    await prisma.scheduledReportHistory.create({
      data: {
        scheduledReportId: result.scheduledReportId,
        status: result.status,
        recipientsCount: result.recipientsCount,
        successfulDeliveries: result.successfulDeliveries,
        errorMessage: result.errorMessage,
        fileSizeBytes: result.fileSizeBytes,
        generationTimeMs: result.generationTimeMs,
      },
    });
  }

  /**
   * Update report after successful execution
   */
  private async updateAfterExecution(report: ScheduledReport): Promise<void> {
    const nextRunAt = this.calculateNextRun(
      report.frequency,
      report.timeOfDay,
      report.timezone,
      report.dayOfWeek,
      report.dayOfMonth
    );

    await prisma.scheduledReport.update({
      where: { id: report.id },
      data: {
        lastSentAt: new Date(),
        nextRunAt,
        sendCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Calculate next run time based on frequency
   */
  /**
   * Resolve the current date/time parts in a given IANA timezone.
   * Uses only the built-in Intl API (no external dependencies).
   */
  private nowInTimezone(tz: string): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
    }).formatToParts(now);

    const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    return {
      year: parseInt(get('year'), 10),
      month: parseInt(get('month'), 10),
      day: parseInt(get('day'), 10),
      hour: parseInt(get('hour'), 10),
      minute: parseInt(get('minute'), 10),
      weekday: weekdayMap[get('weekday')] ?? 0,
    };
  }

  /**
   * Convert a date/time in an IANA timezone to a UTC Date by finding the offset.
   */
  private toUTCDate(year: number, month: number, day: number, hours: number, minutes: number, tz: string): Date {
    // Create a rough UTC estimate, then find the actual offset
    const rough = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(rough);
    // Parse the formatted tz time to find the offset
    const match = formatted.match(/(\d+)\/(\d+)\/(\d+),?\s*(\d+):(\d+)/);
    if (!match) return rough;
    const tzMonth = parseInt(match[1], 10);
    const tzDay = parseInt(match[2], 10);
    const tzYear = parseInt(match[3], 10);
    const tzHour = parseInt(match[4], 10);
    const tzMin = parseInt(match[5], 10);
    const tzAsUtc = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, 0, 0));
    const offsetMs = tzAsUtc.getTime() - rough.getTime();
    // Actual UTC = desired_tz_time - offset
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - offsetMs);
  }

  private calculateNextRun(
    frequency: Frequency,
    timeOfDay: string,
    timezone: string,
    dayOfWeek?: number,
    dayOfMonth?: number
  ): Date {
    const [hours, minutes] = timeOfDay.split(':').map(Number);
    const tz = timezone || 'UTC';
    const nowParts = this.nowInTimezone(tz);
    const now = new Date();

    // Start candidate from today in the user's timezone
    let candYear = nowParts.year;
    let candMonth = nowParts.month;
    let candDay = nowParts.day;

    // Check if the target time has already passed today
    let next = this.toUTCDate(candYear, candMonth, candDay, hours, minutes, tz);
    if (next <= now) {
      // Move to tomorrow
      const tomorrow = new Date(Date.UTC(candYear, candMonth - 1, candDay + 1));
      candYear = tomorrow.getUTCFullYear();
      candMonth = tomorrow.getUTCMonth() + 1;
      candDay = tomorrow.getUTCDate();
      next = this.toUTCDate(candYear, candMonth, candDay, hours, minutes, tz);
    }

    switch (frequency) {
      case 'daily':
        break;

      case 'weekly': {
        const targetDay = dayOfWeek ?? 1; // Default to Monday
        // Advance until we reach the target weekday
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const d = new Date(Date.UTC(candYear, candMonth - 1, candDay));
          if (d.getUTCDay() === targetDay) break;
          d.setUTCDate(d.getUTCDate() + 1);
          candYear = d.getUTCFullYear();
          candMonth = d.getUTCMonth() + 1;
          candDay = d.getUTCDate();
        }
        next = this.toUTCDate(candYear, candMonth, candDay, hours, minutes, tz);
        break;
      }

      case 'monthly': {
        const targetDate = Math.min(dayOfMonth ?? 1, 28);
        candDay = targetDate;
        next = this.toUTCDate(candYear, candMonth, candDay, hours, minutes, tz);
        if (next <= now) {
          const d = new Date(Date.UTC(candYear, candMonth, targetDate)); // next month
          candYear = d.getUTCFullYear();
          candMonth = d.getUTCMonth() + 1;
          candDay = targetDate;
          next = this.toUTCDate(candYear, candMonth, candDay, hours, minutes, tz);
        }
        break;
      }
    }

    return next;
  }

  /**
   * Get execution history for a report
   */
  async getHistory(reportId: string, userId: string, limit = 20): Promise<any[]> {
    // Verify user owns the report
    const report = await this.getById(reportId, userId);
    if (!report) {
      throw new Error('Scheduled report not found');
    }

    return prisma.scheduledReportHistory.findMany({
      where: { scheduledReportId: reportId },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Format report type for display
   */
  private formatReportType(type: ReportType): string {
    const typeNames: Record<ReportType, string> = {
      sprint: 'Sprint',
      team_workload: 'Team Workload',
      time_tracking: 'Time Tracking',
      distribution: 'Issue Distribution',
    };
    return typeNames[type] || type;
  }

  /**
   * Map database row to ScheduledReport
   */
  private mapToScheduledReport(row: any): ScheduledReport {
    return {
      id: row.id,
      userId: row.userId,
      projectId: row.projectId,
      name: row.name,
      reportType: row.reportType,
      format: row.format,
      frequency: row.frequency,
      dayOfWeek: row.dayOfWeek,
      dayOfMonth: row.dayOfMonth,
      timeOfDay: row.timeOfDay,
      timezone: row.timezone,
      recipients: row.recipients,
      includeSelf: row.includeSelf,
      filters: row.filters,
      isActive: row.isActive,
      lastSentAt: row.lastSentAt,
      nextRunAt: row.nextRunAt,
      sendCount: row.sendCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const scheduledReportsService = new ScheduledReportsService();
