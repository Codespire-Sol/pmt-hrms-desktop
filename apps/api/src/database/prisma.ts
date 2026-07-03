import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '../utils/logger';
import { config } from '../config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required but was not set');
}
const connectionString = process.env.DATABASE_URL;

// Hard upper bound on pool size. Protects production even if a stale
// ConfigMap / env var sets DATABASE_POOL_SIZE too high. Never exceed this
// regardless of configured value.
const HARD_POOL_CAP = 20;

// How often the background reaper kills idle Postgres connections.
const REAPER_INTERVAL_MS = 60 * 1000;

// Only connections idle for longer than this are reaped. Kept above the driver's
// own idleTimeout so healthy pooled sockets are never touched — only true leaks.
const REAPER_IDLE_THRESHOLD = '5 minutes';

// If the first pass terminated any sockets, run one follow-up pass after a short
// delay to catch a second wave in the same minute (e.g., a bulk-leak scenario).
const REAPER_CATCHUP_DELAY_MS = 1000;

// Clamp the pool size to a safe maximum. Logs a warning if clamping occurred.
const requestedPoolSize = config.database.poolSize;
const effectivePoolSize = Math.min(requestedPoolSize, HARD_POOL_CAP);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaAdapter?: PrismaPg;
  prismaReaperStarted?: boolean;
};

// Force the Postgres session timezone to Asia/Kolkata for every connection in
// the pool. Postgres accepts startup options via the `options` connection
// parameter ("-c key=value"); pg.Pool / PrismaPg forward these verbatim.
// This is equivalent to adding `?options=-c%20timezone%3DAsia%2FKolkata` to
// DATABASE_URL, but configured here so it works on environments where the
// connection string itself can't be changed.
//
// Why this matters: most attendance writes (INSERT/UPDATE on
// `timestamp without time zone` columns, NOW(), CURRENT_DATE comparisons) rely
// on the session TZ to convert TZ-aware inputs to wall-clock. With session at
// UTC (Postgres default), IST inputs lose their +5:30 offset on storage.
const adapter =
  globalForPrisma.prismaAdapter ??
  new PrismaPg({
    connectionString,
    max: effectivePoolSize,
    idleTimeout: config.database.poolIdleTimeout / 1000, // PrismaPg expects seconds
    connect_timeout: config.database.connectionTimeout / 1000,
    options: '-c timezone=Asia/Kolkata',
  });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

// Cache in ALL environments so module re-evaluation (dev reload, workers,
// scripts sharing the process) reuses a single pg Pool + PrismaClient.
globalForPrisma.prismaAdapter = adapter;
globalForPrisma.prisma = prisma;

// Startup log — grep '[prisma] pool:' in Grafana to confirm the fix is live.
logger.info(
  `[prisma] pool: requested=${requestedPoolSize} effective=${effectivePoolSize} hard_cap=${HARD_POOL_CAP} ` +
    `idle_timeout=${config.database.poolIdleTimeout}ms connect_timeout=${config.database.connectionTimeout}ms`
);
if (requestedPoolSize > HARD_POOL_CAP) {
  logger.warn(
    `[prisma] DATABASE_POOL_SIZE=${requestedPoolSize} exceeds HARD_POOL_CAP=${HARD_POOL_CAP}. ` +
      `Clamped to ${HARD_POOL_CAP}. Update your ConfigMap to silence this warning.`
  );
}

// Verify against Postgres's actual max_connections and warn if budget is tight.
void (async () => {
  try {
    const [{ max_connections }] = await prisma.$queryRaw<{ max_connections: number }[]>`
      SELECT setting::int AS max_connections FROM pg_settings WHERE name = 'max_connections'
    `;
    const budget = max_connections - 10; // reserve 10 for admin/migrations
    const safeReplicas = Math.max(1, Math.floor(budget / effectivePoolSize));
    logger.info(
      `[prisma] postgres max_connections=${max_connections} safe_replica_budget=${safeReplicas} ` +
        `(pool ${effectivePoolSize} × up to ${safeReplicas} processes ≤ budget ${budget})`
    );
    if (effectivePoolSize > budget) {
      logger.warn(
        `[prisma] effective pool (${effectivePoolSize}) exceeds Postgres budget (${budget}). ` +
          `Raise max_connections or lower pool size.`
      );
    }
  } catch {
    // Non-fatal: skip if pg_settings isn't reachable yet at startup.
  }
})();

// ─── Idle-connection reaper ──────────────────────────────────────────────────
// Periodically terminates Postgres backends that have been idle > threshold.
// Self-heals leaked or orphaned sockets without needing a pod restart.
function startIdleReaper(): void {
  if (globalForPrisma.prismaReaperStarted) return;
  globalForPrisma.prismaReaperStarted = true;

  const runPass = async (): Promise<{ terminated: number; idleInTxn: number }> => {
    const rows = await prisma.$queryRawUnsafe<Array<{ terminated: number; idleInTxn: number }>>(
      // Only target connections owned by the current DB user. Postgres's
      // pg_terminate_backend() requires superuser or pg_signal_backend role to
      // kill sessions owned by *other* roles; restricting to current_user lets
      // an ordinary app user prune its own idle pool without elevated privs.
      `SELECT
         (SELECT count(*)::int
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND usename = current_user
              AND state = 'idle'
              AND pid <> pg_backend_pid()
              AND state_change < NOW() - INTERVAL '${REAPER_IDLE_THRESHOLD}'
              AND pg_terminate_backend(pid)) AS terminated,
         (SELECT count(*)::int
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND usename = current_user
              AND state = 'idle in transaction') AS "idleInTxn"`
    );
    return { terminated: rows[0]?.terminated ?? 0, idleInTxn: rows[0]?.idleInTxn ?? 0 };
  };

  const tick = async () => {
    try {
      // First pass.
      const first = await runPass();
      let totalTerminated = first.terminated;
      let lastIdleInTxn = first.idleInTxn;

      // Catch-up pass: only if we killed something, wait briefly and try again.
      // This handles bulk-leak scenarios within the same minute without risking
      // churn on healthy pooled sockets (threshold is still 5 min).
      if (first.terminated > 0) {
        await new Promise(r => setTimeout(r, REAPER_CATCHUP_DELAY_MS));
        const second = await runPass();
        totalTerminated += second.terminated;
        lastIdleInTxn = second.idleInTxn;
        if (second.terminated > 0) {
          logger.info(`[prisma] reaper: catch-up pass terminated ${second.terminated} more idle connection(s)`);
        }
      }

      if (totalTerminated > 0) {
        logger.info(`[prisma] reaper: terminated ${totalTerminated} idle connection(s) total (> ${REAPER_IDLE_THRESHOLD})`);
      }
      if (lastIdleInTxn > 0) {
        logger.warn(
          `[prisma] reaper: ${lastIdleInTxn} connection(s) 'idle in transaction' — possible code-level transaction leak (not reaped)`
        );
      }
    } catch (err: any) {
      logger.warn(`[prisma] reaper: tick failed: ${err?.message ?? err}`);
    }
  };

  const interval = setInterval(() => { void tick(); }, REAPER_INTERVAL_MS);
  interval.unref?.(); // don't block process exit
  logger.info(
    `[prisma] idle reaper enabled (every ${REAPER_INTERVAL_MS / 1000}s, threshold ${REAPER_IDLE_THRESHOLD}, catch-up pass after ${REAPER_CATCHUP_DELAY_MS}ms)`
  );
}

startIdleReaper();

// ─── Retry helper for connection-cap errors (53300 / 08006 / P1001) ──────────
// Wrap hot-path queries with this to survive transient pool saturation.
// Usage:
//   const result = await withConnectionRetry(() => prisma.user.findMany(...));
const TRANSIENT_DB_CODES = new Set(['53300', '08006', '08003', '08004', 'P1001', 'P1017']);

function isTransientConnectionError(err: any): boolean {
  if (!err) return false;
  const code: string | undefined = err.code ?? err.meta?.code;
  if (code && TRANSIENT_DB_CODES.has(String(code))) return true;
  const msg = String(err.message ?? '').toLowerCase();
  return (
    msg.includes('too many clients') ||
    msg.includes('remaining connection slots') ||
    msg.includes('connection terminated') ||
    msg.includes("can't reach database")
  );
}

export async function withConnectionRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientConnectionError(err) || i === attempts - 1) throw err;
      logger.warn(`[prisma] transient DB error — killing idle connections and retrying (attempt ${i + 2}/${attempts})`);
      try {
        await killIdleConnections();
      } catch {
        /* best-effort */
      }
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw lastErr;
}

// ─── Existing helpers (unchanged behavior) ───────────────────────────────────

// Test Prisma connection
export async function testPrismaConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1+1 AS result`;
    logger.info('Prisma database connection established successfully');

    // Verify session timezone is pinned to Asia/Kolkata (set via
    // DATABASE_URL ?options=-c%20timezone%3DAsia%2FKolkata). Raw SQL
    // NOW()/CURRENT_TIMESTAMP/CURRENT_DATE depend on this. If the pin is
    // missing, the warning below points at the env var.
    const tzRow = await prisma.$queryRawUnsafe<Array<{ tz: string }>>(
      `SELECT current_setting('TIMEZONE') AS tz`
    );
    const tz = tzRow[0]?.tz;
    if (tz !== 'Asia/Kolkata') {
      logger.warn(
        `[prisma] session timezone is '${tz}', expected 'Asia/Kolkata'. ` +
          `Add ?options=-c%20timezone%3DAsia%2FKolkata to DATABASE_URL.`
      );
    } else {
      logger.info(`[prisma] session timezone: ${tz}`);
    }
  } catch (error) {
    logger.error('Prisma database connection failed:', error);
    throw error;
  }
}

// Kill idle database connections (useful to recover from TooManyConnections)
export async function killIdleConnections(): Promise<number> {
  try {
    // Scoped to current_user so non-superuser app roles can still prune their
    // own pool. See reaper comment above for the permission rationale.
    const result = await prisma.$queryRaw<{ terminated: number }[]>`
      SELECT count(*)::int AS terminated
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND usename = current_user
        AND state = 'idle'
        AND pid <> pg_backend_pid()
        AND state_change < NOW() - INTERVAL '5 minutes'
        AND pg_terminate_backend(pid)
    `;
    const count = result[0]?.terminated ?? 0;
    if (count > 0) {
      logger.info(`Terminated ${count} idle database connections (idle > 5 min)`);
    }
    return count;
  } catch (error) {
    logger.warn('Could not kill idle connections (may lack permissions):', error);
    return 0;
  }
}

// Get current connection stats
export async function getConnectionStats(): Promise<{
  total: number;
  idle: number;
  active: number;
  idleInTransaction: number;
  maxConnections: number;
}> {
  const [stats] = await prisma.$queryRaw<any[]>`
    SELECT
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS total,
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle') AS idle,
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND state = 'active') AS active,
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database() AND state = 'idle in transaction') AS "idleInTransaction",
      (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS "maxConnections"
  `;
  return stats;
}

// Graceful shutdown
export async function closePrismaConnection(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Prisma database connection closed');
}
