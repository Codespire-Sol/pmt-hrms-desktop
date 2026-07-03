import { createServer } from 'http';
import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { testPrismaConnection, closePrismaConnection, killIdleConnections } from './database/prisma';
import { setupWebSocket } from './websocket';
import { reportScheduler } from './services/reportScheduler';
import { dueDateReminderScheduler } from './services/dueDateReminderScheduler';
import { attendanceAutoAbsentScheduler } from './services/attendanceAutoAbsentScheduler';
import { sprintMetricsScheduler } from './services/sprintMetricsScheduler';
import { emailSchedulerService } from './services/emailSchedulerService';
import { cacheService } from './services/cache.service';
import { ensureAdminUser } from './scripts/ensureAdmin';
import { ensureProjectCategories } from './scripts/ensureProjectCategories';
import { ensureDatabaseSchema } from './scripts/ensureDatabaseSchema';
import { featureFlagsService } from './services/featureFlags.service';
import { refreshSettingsCache } from './services/appSettings.service';
import { hrService } from './modules/hr/hr.service';

const PORT = config.port;

// Start server
async function startServer() {
  try {
    // Test database connection
    await testPrismaConnection();

    // Kill stale idle connections from previous crashed instances
    await killIdleConnections();

    // Auto-apply any missing columns / tables before anything else runs
    await ensureDatabaseSchema();

    // Load app settings (SMTP / company / attendance) into the in-memory cache
    try { await refreshSettingsCache(); } catch (e) { logger.warn('Settings cache load failed:', e); }

    // Ensure default admin exists (skip in tests)
    if (config.env !== 'test') {
      try {
        await ensureAdminUser();
      } catch (error) {
        logger.error('Failed to ensure admin user on startup:', error);
      }

      try {
        await ensureProjectCategories();
      } catch (error) {
        logger.error('Failed to ensure project categories on startup:', error);
      }

      try {
        await featureFlagsService.bootstrapDefaults();
      } catch (error) {
        logger.error('Failed to bootstrap feature flags on startup:', error);
      }

      try {
        await hrService.seedDefaultTaskTemplates();
        logger.info('✅ Onboarding task templates synced (6 tasks)');
      } catch (error) {
        logger.error('Failed to sync onboarding task templates on startup:', error);
      }

    }

    // Create HTTP server
    const httpServer = createServer(app);

    // Setup WebSocket
    await setupWebSocket(httpServer);

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${config.env}`);
      logger.info(`🌍 Frontend URL: ${config.frontend.url}`);
      logger.info(`🔗 API: http://localhost:${PORT}/api/${config.apiVersion}`);
      logger.info(`⚡ WebSocket: ws://localhost:${PORT}`);
      logger.info(`❤️  Health check: http://localhost:${PORT}/health`);

      // Start background schedulers
      if (config.env !== 'test') {
        reportScheduler.start();
        dueDateReminderScheduler.start();
        attendanceAutoAbsentScheduler.start();
        sprintMetricsScheduler.start();
        emailSchedulerService.start();
        logger.info('📅 Background schedulers started');
      }
    });

    const server = httpServer;

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // Stop schedulers
      reportScheduler.stop();
      dueDateReminderScheduler.stop();
      attendanceAutoAbsentScheduler.stop();
      sprintMetricsScheduler.stop();
      emailSchedulerService.stop();
      logger.info('Background schedulers stopped');

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await closePrismaConnection();
          logger.info('Database connections closed');

          await cacheService.close();
          logger.info('Redis connection closed');

          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection:', reason);
  throw reason;
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();
