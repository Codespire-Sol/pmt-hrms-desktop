import { prisma } from '../database/prisma';
import { notificationsService } from '../modules/notifications/notifications.service';
import { pushNotification, pushUnreadCount } from '../websocket';
import { notificationsRepository } from '../modules/notifications/notifications.repository';

interface DueSoonIssue {
  id: string;
  issueKey: string;
  title: string;
  dueDate: string;
  daysUntilDue: number;
  projectId: string;
  projectName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
}

export const dueDateReminderService = {
  // Reminder thresholds in days
  REMINDER_THRESHOLDS: [7, 3, 1, 0] as const, // 7 days, 3 days, 1 day, and on due date

  /**
   * Get all issues that are due soon and need reminders
   */
  async getIssuesDueSoon(): Promise<DueSoonIssue[]> {
    // Use UTC midnight consistently so date comparisons are timezone-neutral
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayStr = today.toISOString().split('T')[0];

    // Get issues due in the next 7 days
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const maxDateStr = sevenDaysFromNow.toISOString().split('T')[0];

    // Use raw query for the complex join with concatenation and status name filtering
    const issues = await prisma.$queryRaw<any[]>`
      SELECT
        i.id,
        p.key || '-' || i.issue_number AS "issueKey",
        i.title,
        i.due_date AS "dueDate",
        i.project_id AS "projectId",
        p.name AS "projectName",
        i.assignee_id AS "assigneeId",
        u.first_name || ' ' || u.last_name AS "assigneeName",
        u.email AS "assigneeEmail"
      FROM issues i
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN users u ON i.assignee_id = u.id
      LEFT JOIN statuses s ON i.status_id = s.id
      WHERE i.due_date IS NOT NULL
        AND i.due_date >= ${todayStr}::date
        AND i.due_date <= ${maxDateStr}::date
        AND i.deleted_at IS NULL
        AND s.name NOT IN ('done', 'closed', 'cancelled')
      ORDER BY i.due_date ASC
    `;

    return issues.map((issue: any) => {
      // Parse due date as UTC midnight to match today's UTC midnight
      const dueParts = new Date(issue.dueDate);
      const dueDate = new Date(Date.UTC(dueParts.getUTCFullYear(), dueParts.getUTCMonth(), dueParts.getUTCDate()));
      const diffTime = dueDate.getTime() - today.getTime();
      const daysUntilDue = Math.round(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...issue,
        daysUntilDue,
      };
    });
  },

  /**
   * Check if a reminder should be sent for the given days until due
   */
  shouldSendReminder(daysUntilDue: number): boolean {
    return this.REMINDER_THRESHOLDS.includes(daysUntilDue as any);
  },

  /**
   * Get the reminder key for tracking sent reminders
   */
  getReminderKey(issueId: string, daysUntilDue: number): string {
    return `due_reminder:${issueId}:${daysUntilDue}`;
  },

  /**
   * Check if a reminder has already been sent today
   */
  async hasReminderBeenSent(issueId: string, daysUntilDue: number): Promise<boolean> {
    // Use UTC midnight as the boundary for "already sent today"
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const existing = await prisma.dueDateReminder.findFirst({
      where: {
        issueId,
        reminderType: `${daysUntilDue}_day`,
        sentAt: { gte: todayUTC },
      },
    });

    return !!existing;
  },

  /**
   * Record that a reminder was sent
   */
  async recordReminderSent(issueId: string, daysUntilDue: number, userId: string): Promise<void> {
    await prisma.dueDateReminder.create({
      data: {
        issueId,
        userId,
        reminderType: `${daysUntilDue}_day`,
        sentAt: new Date(),
      },
    });
  },

  /**
   * Send due date reminder notification
   */
  async sendDueDateReminder(issue: DueSoonIssue): Promise<boolean> {
    if (!issue.assigneeId) {
      return false;
    }

    // Check if reminder already sent
    const alreadySent = await this.hasReminderBeenSent(issue.id, issue.daysUntilDue);
    if (alreadySent) {
      return false;
    }

    const dueDateFormatted = new Date(issue.dueDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    let title: string;
    let message: string;

    if (issue.daysUntilDue === 0) {
      title = `${issue.issueKey} is due today`;
      message = `"${issue.title}" is due today (${dueDateFormatted})`;
    } else if (issue.daysUntilDue === 1) {
      title = `${issue.issueKey} is due tomorrow`;
      message = `"${issue.title}" is due tomorrow (${dueDateFormatted})`;
    } else {
      title = `${issue.issueKey} is due in ${issue.daysUntilDue} days`;
      message = `"${issue.title}" is due on ${dueDateFormatted}`;
    }

    try {
      // Create notification directly (system notification without actor)
      const notification = await notificationsService.createNotification(
        issue.assigneeId,
        'due_date_approaching',
        title,
        {
          message,
          issueId: issue.id,
          projectId: issue.projectId,
          metadata: {
            issueKey: issue.issueKey,
            issueTitle: issue.title,
            dueDate: issue.dueDate,
            daysUntilDue: issue.daysUntilDue,
          },
        }
      );

      // Push notification via WebSocket
      pushNotification(issue.assigneeId, notification);

      // Update unread count
      const unreadCount = await notificationsRepository.getUnreadCount(issue.assigneeId);
      pushUnreadCount(issue.assigneeId, unreadCount);

      // Record that reminder was sent
      await this.recordReminderSent(issue.id, issue.daysUntilDue, issue.assigneeId);

      return true;
    } catch (error) {
      console.error(`Failed to send due date reminder for issue ${issue.id}:`, error);
      return false;
    }
  },

  /**
   * Process all due date reminders
   */
  async processReminders(): Promise<{ sent: number; skipped: number; errors: number }> {
    const issues = await this.getIssuesDueSoon();
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const issue of issues) {
      if (!this.shouldSendReminder(issue.daysUntilDue)) {
        skipped++;
        continue;
      }

      try {
        const wasSent = await this.sendDueDateReminder(issue);
        if (wasSent) {
          sent++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        console.error(`Error processing reminder for issue ${issue.id}:`, error);
      }
    }

    return { sent, skipped, errors };
  },

  /**
   * Get reminder settings for a project (placeholder for future customization)
   */
  async getReminderSettings(_projectId: string): Promise<{
    enabled: boolean;
    thresholds: number[];
  }> {
    // For now, return default settings
    // In the future, this could be stored per-project
    return {
      enabled: true,
      thresholds: [...this.REMINDER_THRESHOLDS],
    };
  },
};
