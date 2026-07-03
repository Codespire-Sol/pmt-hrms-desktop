/**
 * Email Scheduler Service
 * Sends 4 types of scheduled emails (IST timezone):
 *   - daily_pmt        : 5:30 PM IST  → per-user PMT time-log summary
 *   - daily_attendance : 8:00 PM IST  → per-user clock-in / clock-out
 *   - weekly_report    : Monday 9:00 AM IST → full-week project report
 *   - monthly_summary  : 1st of month 9:00 AM IST → attendance summary
 */

import nodemailer from 'nodemailer';
import { prisma } from '../database/prisma';
import { emailService } from './email.service';
import { emailScheduleTemplates } from './emailSchedule.templates';
import { logger } from '../utils/logger';
import { config } from '../config';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/** Sends email and throws a descriptive error if delivery failed */
async function sendOrThrow(options: Parameters<typeof emailService.sendEmail>[0]): Promise<void> {
  const sent = await emailService.sendEmail(options);
  if (!sent) {
    throw new Error(
      `SMTP delivery failed — subject: "${options.subject}", to: ${JSON.stringify(options.to)}. ` +
      `Check SMTP credentials (host=${config.email.smtp.host}, user=${config.email.smtp.user}).`
    );
  }
}

function nowIST(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function istHHMM(d: Date): string {
  // returns "HH:MM" in IST
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}`;
}

function todayISTString(): string {
  const ist = nowIST();
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
}

function istDayOfWeek(): number { return nowIST().getUTCDay(); } // 0=Sun, 1=Mon
function istDayOfMonth(): number { return nowIST().getUTCDate(); }

export class EmailSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private sentToday: Record<string, string> = {}; // scheduleType -> last-sent date (YYYY-MM-DD)

  start(): void {
    logger.info('[EmailScheduler] Starting — checks every 60 s');
    // Verify SMTP connection on startup so we know immediately if credentials are bad
    void this.verifySmtp();
    this.intervalId = setInterval(() => void this.tick(), 60_000);
    void this.tick(); // immediate check on startup
  }

  private async verifySmtp(): Promise<void> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure,
        auth: { user: config.email.smtp.user, pass: config.email.smtp.password },
        tls: { minVersion: 'TLSv1.2' },
      });
      await transporter.verify();
      logger.info(`[EmailScheduler] ✅ SMTP connection verified — ${config.email.smtp.host}:${config.email.smtp.port} as ${config.email.smtp.user}`);
    } catch (err: any) {
      logger.error(`[EmailScheduler] ❌ SMTP connection FAILED — ${err.message}. Emails will not be delivered until this is fixed.`);
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('[EmailScheduler] Stopped');
  }

  private async tick(): Promise<void> {
    const hhmm   = istHHMM(new Date());
    const today  = todayISTString();
    const dow    = istDayOfWeek();   // 1 = Monday
    const dom    = istDayOfMonth();  // 1 = 1st of month

    await this.tryRun('daily_pmt',        '17:30', today, hhmm, () => this.sendDailyPMT(today));
    await this.tryRun('daily_attendance', '20:00', today, hhmm, () => this.sendDailyAttendance(today));
    if (dow === 1) await this.tryRun('weekly_report',   '09:00', today, hhmm, () => this.sendWeeklyReport(today));
    if (dom === 1) await this.tryRun('monthly_summary', '09:00', today, hhmm, () => this.sendMonthlySummary(today));
  }

  private async tryRun(
    type: string,
    scheduledHHMM: string,
    today: string,
    currentHHMM: string,
    fn: () => Promise<void>
  ): Promise<void> {
    if (currentHHMM !== scheduledHHMM) return;
    if (this.sentToday[type] === today) return; // already sent this session

    const config = await prisma.emailScheduleConfig.findUnique({ where: { scheduleType: type } });
    if (!config || !config.enabled) return;

    // Check DB last-sent date to survive restarts
    if (config.lastSentAt) {
      const lastDate = new Date(config.lastSentAt.getTime() + IST_OFFSET_MS);
      const lastStr  = `${lastDate.getUTCFullYear()}-${String(lastDate.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDate.getUTCDate()).padStart(2, '0')}`;
      if (lastStr === today) {
        this.sentToday[type] = today;
        return;
      }
    }

    logger.info(`[EmailScheduler] Running job: ${type}`);
    try {
      await fn();
      this.sentToday[type] = today;
      await prisma.emailScheduleConfig.update({
        where: { scheduleType: type },
        data: { lastSentAt: new Date() },
      });
      logger.info(`[EmailScheduler] Completed job: ${type}`);
    } catch (err) {
      logger.error(`[EmailScheduler] Job failed: ${type}`, err);
    }
  }

  // ─── Daily PMT (5:30 PM IST) ────────────────────────────────────────────────
  private async sendDailyPMT(today: string): Promise<void> {
    const config = await prisma.emailScheduleConfig.findUnique({ where: { scheduleType: 'daily_pmt' } });
    if (!config || config.recipients.length === 0) return;

    // Fetch all users with their time logs for today
    const users = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        timeLogs: {
          where: { workDate: new Date(today) },
          select: {
            hours: true, description: true,
            issue: { select: { title: true, project: { select: { name: true } } } },
          },
        },
      },
    });

    const html = emailScheduleTemplates.dailyPMT({ users, date: today });
    await sendOrThrow({
      to: config.recipients,
      subject: `📋 Daily PMT Time Log Summary — ${today}`,
      html,
    });
  }

  // ─── Daily Attendance (8:00 PM IST) ─────────────────────────────────────────
  private async sendDailyAttendance(today: string): Promise<void> {
    const config = await prisma.emailScheduleConfig.findUnique({ where: { scheduleType: 'daily_attendance' } });
    if (!config || config.recipients.length === 0) return;

    const attendance = await prisma.attendance.findMany({
      where: {
        date: new Date(today),
        // Exclude exited / deleted employees — they shouldn't appear in
        // the daily report even if their pre-exit attendance row exists.
        employee: {
          deletedAt: null,
          status: { notIn: ['exited', 'deleted'] },
        },
      },
      include: {
        employee: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        logs: { orderBy: { loggedAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Employees who have no attendance row for today are absent — synthesize
    // a placeholder so they show up in the email. Use the same status filter
    // as the main query (exclude exited / deleted) so onboarding and
    // notice_period employees also get absent placeholders.
    const recordedEmployeeIds = new Set(attendance.map(a => a.employeeId));
    const missingEmployees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['exited', 'deleted'] },
        id: { notIn: Array.from(recordedEmployeeIds) },
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });

    const todayDate = new Date(today);
    const absentPlaceholders = missingEmployees.map((e): typeof attendance[number] => ({
      // Mirror the shape the template consumes — `attendance` items have
      // checkInTime/checkOutTime/workHours/status/logs/employee.user.
      id: `absent-${e.id}`,
      employeeId: e.id,
      date: todayDate,
      checkInTime: null,
      checkOutTime: null,
      status: 'absent' as any,
      workHours: null,
      leaveId: null,
      manualCorrection: false,
      correctionReason: null,
      correctedBy: null,
      correctedAt: null,
      createdAt: todayDate,
      updatedAt: todayDate,
      createdBy: null,
      employee: e as any,
      logs: [],
    }));

    const fullAttendance = [...attendance, ...absentPlaceholders];

    const html = emailScheduleTemplates.dailyAttendance({ attendance: fullAttendance, date: today });
    await sendOrThrow({
      to: config.recipients,
      subject: `🕐 Daily Attendance Report — ${today}`,
      html,
    });
  }

  // ─── Weekly Report (Monday 9:00 AM IST) ─────────────────────────────────────
  private async sendWeeklyReport(today: string): Promise<void> {
    const config = await prisma.emailScheduleConfig.findUnique({ where: { scheduleType: 'weekly_report' } });
    if (!config || config.recipients.length === 0) return;

    // Last 7 days
    const endDate   = new Date(today);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);

    const rawProjects = await prisma.project.findMany({
      where: { status: 'active' },
      select: {
        id: true, name: true,
        issues: {
          select: {
            id: true, title: true,
            status: { select: { name: true } },
            timeLogs: {
              where: { workDate: { gte: startDate, lte: endDate } },
              select: { hours: true,
                user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
        members: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Map to WeeklyProject shape
    const projects = rawProjects.map(p => ({
      id: p.id,
      name: p.name,
      members: p.members,
      issues: p.issues.map(i => ({
        id: i.id,
        title: i.title,
        status: i.status?.name ?? 'unknown',
        timeLogs: i.timeLogs,
      })),
    }));

    const startStr = startDate.toISOString().split('T')[0];
    const html = emailScheduleTemplates.weeklyReport({ projects, startDate: startStr, endDate: today });
    await sendOrThrow({
      to: config.recipients,
      subject: `📊 Weekly Project Report — ${startStr} to ${today}`,
      html,
    });
  }

  // ─── Monthly Summary (1st of month 9:00 AM IST) ──────────────────────────────
  private async sendMonthlySummary(today: string): Promise<void> {
    const config = await prisma.emailScheduleConfig.findUnique({ where: { scheduleType: 'monthly_summary' } });
    if (!config || config.recipients.length === 0) return;

    const now    = new Date(today);
    const year   = now.getFullYear();
    const month  = now.getMonth(); // 0-indexed, so this is the PREVIOUS month
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);

    const monthName = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });

    const empList = await prisma.employee.findMany({
      // Exclude exited / deleted employees from the monthly summary. Active,
      // onboarding, and notice_period employees all still appear (they're
      // tracked during the period). Matches the daily report's filter.
      where: {
        deletedAt: null,
        status: { notIn: ['exited', 'deleted'] },
      },
      select: { id: true, firstName: true, lastName: true, email: true, joiningDate: true, branchId: true },
    });

    // Helper: count weekdays within [start, end] that overlap [firstDay, lastDay]
    const countLeaveWeekdaysInMonth = (fromDate: Date, toDate: Date): number => {
      const start = fromDate < firstDay ? firstDay : fromDate;
      const end = toDate > lastDay ? lastDay : toDate;
      if (start > end) return 0;
      let count = 0;
      const d = new Date(start);
      d.setHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setHours(0, 0, 0, 0);
      while (d <= endDay) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) count++;
        d.setDate(d.getDate() + 1);
      }
      return count;
    };

    // Fetch attendance + approved leaves for all employees for the month.
    // Counting from the `leaves` table is necessary because approving a leave
    // does NOT create attendance rows with status='on_leave' — so the report
    // previously showed "On Leave: 0" for everyone.
    const employees = await Promise.all(empList.map(async (e) => {
      const [attRecords, leaveRecords] = await Promise.all([
        prisma.attendance.findMany({
          where: { employeeId: e.id, date: { gte: firstDay, lte: lastDay } },
          select: { status: true },
        }),
        prisma.leave.findMany({
          where: {
            employeeId: e.id,
            status: 'approved',
            // Overlap: leave.from <= month-end AND leave.to >= month-start
            fromDate: { lte: lastDay },
            toDate: { gte: firstDay },
          },
          select: { fromDate: true, toDate: true },
        }),
      ]);

      // Days on leave in this month = weekdays inside any approved leave's
      // intersection with the month window. Caps at workingDays in the template.
      const leaveDaysInMonth = leaveRecords.reduce(
        (sum, l) => sum + countLeaveWeekdaysInMonth(new Date(l.fromDate), new Date(l.toDate)),
        0
      );

      return {
        id: e.id,
        user: { firstName: e.firstName, lastName: e.lastName ?? '', email: e.email },
        // Pass joining_date & branch so the template can compute per-employee
        // working days (avoids marking pre-joining weekdays as absent).
        joiningDate: e.joiningDate ?? null,
        branchId: e.branchId ?? null,
        attendance: attRecords.map(a => ({ status: String(a.status) })),
        leaveDays: leaveDaysInMonth,
      };
    }));

    // Fetch holidays for the month. Exclude:
    //   - 'optional' type — employees CAN take them but aren't required to,
    //     so they don't reduce expected working days for everyone.
    //   - Weekend dates — already not working days, double-discount avoided.
    // Keep branch info so the template can subtract org-wide AND
    // employee-branch-specific holidays per row.
    const holidaysInMonth = await prisma.holiday.findMany({
      where: {
        date: { gte: firstDay, lte: lastDay },
        type: { in: ['national', 'regional', 'company'] }, // exclude 'optional'
      },
      select: { date: true, branchId: true, type: true },
    });
    // Only keep weekday holidays. Store as { date: 'YYYY-MM-DD', branchId }.
    const weekdayHolidays = holidaysInMonth
      .filter(h => {
        const dow = new Date(h.date).getDay();
        return dow !== 0 && dow !== 6;
      })
      .map(h => ({
        date: new Date(h.date).toISOString().slice(0, 10),
        branchId: h.branchId ?? null,
      }));

    const html = emailScheduleTemplates.monthlySummary({
      employees, monthName, year, month: month + 1,
      holidays: weekdayHolidays,
    });
    await sendOrThrow({
      to: config.recipients,
      subject: `📅 Monthly Attendance Summary — ${monthName}`,
      html,
    });
  }
}

export const emailSchedulerService = new EmailSchedulerService();
