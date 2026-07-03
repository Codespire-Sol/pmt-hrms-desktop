import { Request, Response, Router } from 'express';
import os from 'os';
import { prisma } from '../database/prisma';
import { cacheService } from './cache.service';

/**
 * Monitoring Service
 *
 * Provides health checks, readiness probes, and metrics
 * for Kubernetes and monitoring systems.
 */

// ============================================
// TYPES
// ============================================

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration?: number;
  }[];
  version: string;
  uptime: number;
  timestamp: string;
}

export interface MetricsData {
  requests: {
    total: number;
    success: number;
    failed: number;
    byEndpoint: Record<string, number>;
    byStatus: Record<number, number>;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  system: {
    memory: {
      total: number;
      used: number;
      free: number;
      heapUsed: number;
      heapTotal: number;
    };
    cpu: {
      usage: number;
      loadAvg: number[];
    };
  };
  connections: {
    database: number;
    redis: number;
    websocket: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

// ============================================
// METRICS COLLECTION
// ============================================

class MetricsCollector {
  private requestCount = 0;
  private successCount = 0;
  private failedCount = 0;
  private endpointCounts: Record<string, number> = {};
  private statusCounts: Record<number, number> = {};
  private latencies: number[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private wsConnections = 0;
  private startTime = Date.now();

  recordRequest(
    endpoint: string,
    status: number,
    duration: number
  ): void {
    this.requestCount++;

    if (status >= 200 && status < 400) {
      this.successCount++;
    } else {
      this.failedCount++;
    }

    this.endpointCounts[endpoint] = (this.endpointCounts[endpoint] || 0) + 1;
    this.statusCounts[status] = (this.statusCounts[status] || 0) + 1;

    // Keep last 10000 latencies for percentile calculation
    this.latencies.push(duration);
    if (this.latencies.length > 10000) {
      this.latencies.shift();
    }
  }

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  setWebSocketConnections(count: number): void {
    this.wsConnections = count;
  }

  getMetrics(): MetricsData {
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const len = sortedLatencies.length;

    return {
      requests: {
        total: this.requestCount,
        success: this.successCount,
        failed: this.failedCount,
        byEndpoint: { ...this.endpointCounts },
        byStatus: { ...this.statusCounts },
      },
      latency: {
        p50: len > 0 ? sortedLatencies[Math.floor(len * 0.5)] : 0,
        p95: len > 0 ? sortedLatencies[Math.floor(len * 0.95)] : 0,
        p99: len > 0 ? sortedLatencies[Math.floor(len * 0.99)] : 0,
        avg: len > 0 ? sortedLatencies.reduce((a, b) => a + b, 0) / len : 0,
      },
      system: {
        memory: {
          total: os.totalmem(),
          used: os.totalmem() - os.freemem(),
          free: os.freemem(),
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
        },
        cpu: {
          usage: process.cpuUsage().user / 1000000,
          loadAvg: os.loadavg(),
        },
      },
      connections: {
        database: 0, // Set by database service
        redis: 0, // Set by cache service
        websocket: this.wsConnections,
      },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate:
          this.cacheHits + this.cacheMisses > 0
            ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100
            : 0,
      },
    };
  }

  getUptime(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  reset(): void {
    this.requestCount = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.endpointCounts = {};
    this.statusCounts = {};
    this.latencies = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

export const metricsCollector = new MetricsCollector();

// ============================================
// HEALTH CHECK SERVICE
// ============================================

type HealthCheckFn = () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string }>;

class HealthCheckService {
  private checks: Map<string, HealthCheckFn> = new Map();
  private version: string;

  constructor() {
    this.version = process.env.APP_VERSION || '1.0.0';
  }

  registerCheck(name: string, check: HealthCheckFn): void {
    this.checks.set(name, check);
  }

  async runChecks(): Promise<HealthCheckResult> {
    const results: HealthCheckResult['checks'] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, check] of this.checks) {
      const start = Date.now();
      try {
        const result = await check();
        results.push({
          name,
          status: result.status,
          message: result.message,
          duration: Date.now() - start,
        });

        if (result.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results.push({
          name,
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - start,
        });
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      checks: results,
      version: this.version,
      uptime: metricsCollector.getUptime(),
      timestamp: new Date().toISOString(),
    };
  }

  // Kubernetes liveness probe
  async isAlive(): Promise<boolean> {
    // Basic process check
    return true;
  }

  // Kubernetes readiness probe
  async isReady(): Promise<boolean> {
    const result = await this.runChecks();
    return result.status !== 'unhealthy';
  }
}

export const healthCheckService = new HealthCheckService();

// ============================================
// DEFAULT HEALTH CHECKS
// ============================================

// Database health check - real connectivity probe
healthCheckService.registerCheck('database', async () => {
  try {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    if (result && result[0]?.ok === 1) {
      return { status: 'pass', message: 'Database connected and responsive' };
    }
    return { status: 'fail', message: 'Database query returned unexpected result' };
  } catch (error) {
    return {
      status: 'fail',
      message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
});

// Redis health check - real connectivity probe
healthCheckService.registerCheck('redis', async () => {
  if (!process.env.REDIS_URL) {
    return { status: 'warn', message: 'Redis not configured (REDIS_URL not set)' };
  }
  try {
    const isHealthy = await cacheService.isHealthy();
    if (isHealthy) {
      return { status: 'pass', message: 'Redis connected and responsive' };
    }
    return { status: 'fail', message: 'Redis PING did not return PONG' };
  } catch (error) {
    return {
      status: 'warn',
      message: `Redis check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
});

// AI service health check - real connectivity probe
healthCheckService.registerCheck('ai_service', async () => {
  const aiServiceUrl = process.env.AI_SERVICE_URL;
  if (!aiServiceUrl) {
    return { status: 'warn', message: 'AI service not configured (AI_SERVICE_URL not set)' };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${aiServiceUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      return { status: 'pass', message: 'AI service connected and responsive' };
    }
    return { status: 'warn', message: `AI service returned status ${response.status}` };
  } catch (error) {
    return {
      status: 'warn',
      message: `AI service unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
});

// Memory health check
healthCheckService.registerCheck('memory', async () => {
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  if (heapUsedPercent > 90) {
    return { status: 'fail', message: `Heap usage critical: ${heapUsedPercent.toFixed(1)}%` };
  } else if (heapUsedPercent > 75) {
    return { status: 'warn', message: `Heap usage high: ${heapUsedPercent.toFixed(1)}%` };
  }
  return { status: 'pass', message: `Heap usage normal: ${heapUsedPercent.toFixed(1)}%` };
});

// Event loop health check
healthCheckService.registerCheck('event_loop', async () => {
  return new Promise((resolve) => {
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      if (lag > 100) {
        resolve({ status: 'fail', message: `Event loop lag: ${lag}ms` });
      } else if (lag > 50) {
        resolve({ status: 'warn', message: `Event loop lag: ${lag}ms` });
      } else {
        resolve({ status: 'pass', message: `Event loop lag: ${lag}ms` });
      }
    });
  });
});

// ============================================
// PROMETHEUS METRICS FORMAT
// ============================================

function formatPrometheusMetrics(metrics: MetricsData): string {
  const lines: string[] = [];

  // Request metrics
  lines.push('# HELP http_requests_total Total HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  lines.push(`http_requests_total ${metrics.requests.total}`);

  lines.push('# HELP http_requests_success_total Successful HTTP requests');
  lines.push('# TYPE http_requests_success_total counter');
  lines.push(`http_requests_success_total ${metrics.requests.success}`);

  lines.push('# HELP http_requests_failed_total Failed HTTP requests');
  lines.push('# TYPE http_requests_failed_total counter');
  lines.push(`http_requests_failed_total ${metrics.requests.failed}`);

  // Status code metrics
  lines.push('# HELP http_requests_by_status HTTP requests by status code');
  lines.push('# TYPE http_requests_by_status counter');
  for (const [status, count] of Object.entries(metrics.requests.byStatus)) {
    lines.push(`http_requests_by_status{status="${status}"} ${count}`);
  }

  // Latency metrics
  lines.push('# HELP http_request_duration_seconds HTTP request latency');
  lines.push('# TYPE http_request_duration_seconds summary');
  lines.push(`http_request_duration_seconds{quantile="0.5"} ${metrics.latency.p50 / 1000}`);
  lines.push(`http_request_duration_seconds{quantile="0.95"} ${metrics.latency.p95 / 1000}`);
  lines.push(`http_request_duration_seconds{quantile="0.99"} ${metrics.latency.p99 / 1000}`);

  // Memory metrics
  lines.push('# HELP process_memory_bytes Process memory usage');
  lines.push('# TYPE process_memory_bytes gauge');
  lines.push(`process_memory_bytes{type="heap_used"} ${metrics.system.memory.heapUsed}`);
  lines.push(`process_memory_bytes{type="heap_total"} ${metrics.system.memory.heapTotal}`);

  // CPU metrics
  lines.push('# HELP process_cpu_seconds_total Process CPU time');
  lines.push('# TYPE process_cpu_seconds_total counter');
  lines.push(`process_cpu_seconds_total ${metrics.system.cpu.usage}`);

  // Cache metrics
  lines.push('# HELP cache_hits_total Cache hits');
  lines.push('# TYPE cache_hits_total counter');
  lines.push(`cache_hits_total ${metrics.cache.hits}`);

  lines.push('# HELP cache_misses_total Cache misses');
  lines.push('# TYPE cache_misses_total counter');
  lines.push(`cache_misses_total ${metrics.cache.misses}`);

  // WebSocket connections
  lines.push('# HELP websocket_connections Active WebSocket connections');
  lines.push('# TYPE websocket_connections gauge');
  lines.push(`websocket_connections ${metrics.connections.websocket}`);

  return lines.join('\n');
}

// ============================================
// EXPRESS ROUTER
// ============================================

export function createMonitoringRouter(): Router {
  const router = Router();

  // Kubernetes liveness probe
  router.get('/health/live', async (_req: Request, res: Response) => {
    const isAlive = await healthCheckService.isAlive();
    res.status(isAlive ? 200 : 503).json({ status: isAlive ? 'ok' : 'error' });
  });

  // Kubernetes readiness probe
  router.get('/health/ready', async (_req: Request, res: Response) => {
    const isReady = await healthCheckService.isReady();
    res.status(isReady ? 200 : 503).json({ status: isReady ? 'ok' : 'not_ready' });
  });

  // Detailed health check
  router.get('/health', async (_req: Request, res: Response) => {
    const result = await healthCheckService.runChecks();
    const status = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;
    res.status(status).json(result);
  });

  // Prometheus metrics endpoint
  router.get('/metrics', (_req: Request, res: Response) => {
    const metrics = metricsCollector.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(formatPrometheusMetrics(metrics));
  });

  // JSON metrics endpoint
  router.get('/metrics/json', (_req: Request, res: Response) => {
    res.json(metricsCollector.getMetrics());
  });

  // Version info
  router.get('/version', (_req: Request, res: Response) => {
    res.json({
      version: process.env.APP_VERSION || '1.0.0',
      commit: process.env.GIT_COMMIT || 'unknown',
      buildDate: process.env.BUILD_DATE || 'unknown',
      nodeVersion: process.version,
    });
  });

  return router;
}

// ============================================
// METRICS MIDDLEWARE
// ============================================

export function metricsMiddleware(req: Request, res: Response, next: () => void): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    metricsCollector.recordRequest(endpoint, res.statusCode, duration);
  });

  next();
}

