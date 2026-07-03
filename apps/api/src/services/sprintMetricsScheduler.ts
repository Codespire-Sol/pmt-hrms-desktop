import { logger } from '../utils/logger';
import { prisma } from '../database/prisma';
import { sprintsService } from '../modules/sprints/sprints.service';

class SprintMetricsScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly checkIntervalMs: number;

  constructor(checkIntervalMinutes = 60) {
    this.checkIntervalMs = checkIntervalMinutes * 60 * 1000;
  }

  start(): void {
    if (this.intervalId) return;

    // Record immediately on start, then every interval
    this.recordAllActiveSprintMetrics().catch((err) =>
      logger.error('Sprint metrics initial recording failed:', err)
    );

    this.intervalId = setInterval(() => {
      this.recordAllActiveSprintMetrics().catch((err) =>
        logger.error('Sprint metrics scheduled recording failed:', err)
      );
    }, this.checkIntervalMs);

    logger.info(`Sprint metrics scheduler started (every ${this.checkIntervalMs / 60000} min)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Sprint metrics scheduler stopped');
    }
  }

  async recordAllActiveSprintMetrics(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const activeSprints = await prisma.sprint.findMany({
        where: { status: 'active' },
        select: { id: true, name: true },
      });

      if (activeSprints.length === 0) {
        return;
      }

      for (const sprint of activeSprints) {
        try {
          await sprintsService.recordDailyMetrics(sprint.id);
        } catch (err) {
          logger.error(`Failed to record metrics for sprint ${sprint.name}:`, err);
        }
      }

      logger.info(`Recorded metrics for ${activeSprints.length} active sprint(s)`);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const sprintMetricsScheduler = new SprintMetricsScheduler();
