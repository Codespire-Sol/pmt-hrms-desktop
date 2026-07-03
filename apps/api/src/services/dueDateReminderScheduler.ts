/**
 * Due Date Reminder Scheduler
 * Background job that sends reminders for issues with upcoming due dates
 *
 * This can be run as:
 * 1. A setInterval in the main server process
 * 2. A separate worker process
 * 3. Triggered by a cloud scheduler (e.g., Cloud Scheduler, cron)
 */

import { dueDateReminderService } from './dueDateReminder.service';
import { withDistributedLock } from '../utils/distributedLock';
import { logger } from '../utils/logger';

class DueDateReminderScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly checkIntervalMs: number;

  constructor(checkIntervalHours = 1) {
    // Default to checking every hour
    this.checkIntervalMs = checkIntervalHours * 60 * 60 * 1000;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.intervalId) {
      logger.info('Due date reminder scheduler is already running');
      return;
    }

    logger.info(
      `Starting due date reminder scheduler (checking every ${this.checkIntervalMs / 3600000} hours)`
    );

    // Run immediately on start
    this.processReminders();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.processReminders();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Due date reminder scheduler stopped');
    }
  }

  /**
   * Process all due date reminders (with distributed lock)
   */
  async processReminders(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Due date reminder scheduler is already processing locally, skipping this run');
      return;
    }

    this.isProcessing = true;

    try {
      // Acquire distributed lock (TTL = 50 minutes, shorter than 1-hour interval)
      const lockResult = await withDistributedLock('scheduler:due-date-reminders', 3000, async () => {
        logger.info('Processing due date reminders...');
        const result = await dueDateReminderService.processReminders();
        logger.info(
          `Due date reminders processed: ${result.sent} sent, ${result.skipped} skipped, ${result.errors} errors`
        );
        return result;
      });

      if (lockResult === null) {
        logger.debug('Due date reminder scheduler skipped - another instance holds the lock');
      }
    } catch (error) {
      logger.error('Error processing due date reminders:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manual trigger for cloud function or API endpoint
   */
  async triggerProcessing(): Promise<{ sent: number; skipped: number; errors: number }> {
    return dueDateReminderService.processReminders();
  }
}

// Export singleton instance (runs every hour by default)
export const dueDateReminderScheduler = new DueDateReminderScheduler(1);

// Export class for custom configurations
export { DueDateReminderScheduler };
