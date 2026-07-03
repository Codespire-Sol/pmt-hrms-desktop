/**
 * Report Scheduler
 * Background job that processes scheduled reports
 *
 * This can be run as:
 * 1. A setInterval in the main server process
 * 2. A separate worker process
 * 3. Triggered by a cloud scheduler (e.g., Cloud Scheduler)
 */

import { scheduledReportsService } from './scheduledReports.service';
import { withDistributedLock } from '../utils/distributedLock';
import { logger } from '../utils/logger';

class ReportScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly checkIntervalMs: number;

  constructor(checkIntervalMinutes = 5) {
    this.checkIntervalMs = checkIntervalMinutes * 60 * 1000;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.intervalId) {
      logger.info('Report scheduler is already running');
      return;
    }

    logger.info(`Starting report scheduler (checking every ${this.checkIntervalMs / 60000} minutes)`);

    // Run immediately on start
    this.processScheduledReports();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.processScheduledReports();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Report scheduler stopped');
    }
  }

  /**
   * Process all due scheduled reports (with distributed lock)
   */
  async processScheduledReports(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Report scheduler is already processing locally, skipping this run');
      return;
    }

    this.isProcessing = true;

    try {
      // Acquire distributed lock (TTL = 4 minutes, shorter than 5-min interval)
      const result = await withDistributedLock('scheduler:reports', 240, async () => {
        const dueReports = await scheduledReportsService.getDueReports();

        if (dueReports.length === 0) {
          return;
        }

        logger.info(`Processing ${dueReports.length} scheduled reports`);

        for (const report of dueReports) {
          try {
            logger.info(`Executing scheduled report: ${report.name} (${report.id})`);
            const executionResult = await scheduledReportsService.execute(report);
            logger.info(
              `Report ${report.name} completed: ${executionResult.status} (${executionResult.successfulDeliveries}/${executionResult.recipientsCount} delivered)`
            );
          } catch (error) {
            logger.error(`Error executing report ${report.id}:`, error);
          }
        }
      });

      if (result === null) {
        logger.debug('Report scheduler skipped - another instance holds the lock');
      }
    } catch (error) {
      logger.error('Error processing scheduled reports:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manual trigger for cloud function or API endpoint
   */
  async triggerProcessing(): Promise<{ processed: number; errors: number }> {
    const dueReports = await scheduledReportsService.getDueReports();
    let processed = 0;
    let errors = 0;

    for (const report of dueReports) {
      try {
        const result = await scheduledReportsService.execute(report);
        if (result.status !== 'failed') {
          processed++;
        } else {
          errors++;
        }
      } catch (error) {
        errors++;
        logger.error(`Error executing report ${report.id}:`, error);
      }
    }

    return { processed, errors };
  }
}

// Export singleton instance
export const reportScheduler = new ReportScheduler();

// Export class for custom configurations
export { ReportScheduler };
