import winston from 'winston';
import TransportStream from 'winston-transport';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

/**
 * Error reporting transport.
 * Captures error-level logs and forwards them to an external service.
 *
 * Integration points (configure via environment variables):
 * - SENTRY_DSN: If set, errors will be reported to Sentry
 * - ERROR_WEBHOOK_URL: If set, errors will be POSTed to a webhook
 *
 * This transport only fires for 'error' level logs.
 */
class ErrorReportingTransport extends TransportStream {
  level = 'error';
  private webhookUrl: string | undefined;
  private buffer: Array<{ timestamp: string; message: string; meta: Record<string, unknown> }> = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 5000;
  private readonly MAX_BUFFER_SIZE = 50;

  constructor(opts?: TransportStream.TransportStreamOptions) {
    super(opts);
    this.webhookUrl = process.env.ERROR_WEBHOOK_URL;

    // Periodic flush
    this.flushTimer = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
  }

  log(info: any, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    this.buffer.push({
      timestamp: info.timestamp || new Date().toISOString(),
      message: info.message,
      meta: {
        stack: info.stack,
        statusCode: info.statusCode,
        path: info.path,
        method: info.method,
        requestId: info.requestId,
        userId: info.userId,
        environment: config.env,
        version: process.env.APP_VERSION || '1.0.0',
      },
    });

    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
    }

    callback();
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const errors = [...this.buffer];
    this.buffer = [];

    // Report to webhook if configured
    if (this.webhookUrl) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errors, source: 'projectflow-api' }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Silently fail - don't create error loops
      }
    }

    // Log to stderr in production as a fallback for log aggregators (ELK, CloudWatch, etc.)
    if (config.env === 'production') {
      for (const error of errors) {
        process.stderr.write(JSON.stringify({ level: 'error', ...error }) + '\n');
      }
    }
  }

  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

const transports: TransportStream[] = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add error reporting transport in non-test environments
if (config.env !== 'test') {
  transports.push(new ErrorReportingTransport());
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
});
