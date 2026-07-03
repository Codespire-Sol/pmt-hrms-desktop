import type { Redis as RedisClient } from 'ioredis';

/**
 * Cache Service
 *
 * Provides caching with tag-based invalidation, cache-aside pattern, and
 * performance monitoring.
 *
 * Backend selection (decided once, at import time):
 *   - If REDIS_URL or REDIS_HOST is set → use Redis (ioredis).
 *   - Otherwise → use a self-contained in-memory cache. This lets the API run
 *     fully with NO Redis available (e.g. embedded in an Electron app). Guarding
 *     client creation behind the env check means ioredis never tries to reach a
 *     (non-existent) localhost:6379 and never throws on boot.
 */

// Redis is considered "configured" only when the operator explicitly set a
// connection target. An unset/empty env means: run without Redis.
const REDIS_URL = (process.env.REDIS_URL || '').trim();
const REDIS_HOST = (process.env.REDIS_HOST || '').trim();
const REDIS_ENABLED = REDIS_URL.length > 0 || REDIS_HOST.length > 0;

// Track Redis connection state to avoid log spam
let redisConnected = false;
let redisErrorLogged = false;

// The concrete ioredis client — only created when Redis is enabled.
let redis: RedisClient | null = null;

if (REDIS_ENABLED) {
  // Require lazily so a missing/removed ioredis dependency doesn't break the
  // in-memory path. The dependency is present in package.json, but this keeps
  // the no-Redis boot path free of any Redis coupling.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Redis = require('ioredis');
  // Prefer a full URL; otherwise build from discrete host/port/password parts.
  const connectionTarget = REDIS_URL || {
    host: REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  redis = new Redis(connectionTarget as any, {
    maxRetriesPerRequest: 0, // Fail immediately when Redis is down — prevents request blocking/504s
    retryStrategy: (times: number) => {
      if (times > 3) {
        // Give up — disconnect cleanly to stop recurring error events
        setTimeout(() => redis?.disconnect(), 0);
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    lazyConnect: true,
  }) as RedisClient;

  // Handle connection errors — log only once to avoid spamming pod logs
  redis.on('error', (err: Error) => {
    if (!redisErrorLogged) {
      console.warn('Redis connection error:', err.message);
      redisErrorLogged = true;
    }
    redisConnected = false;
  });

  redis.on('connect', () => {
    console.log('Redis connected');
    redisConnected = true;
    redisErrorLogged = false;
  });

  redis.on('close', () => {
    redisConnected = false;
  });

  // Kick off the (lazy) connection so `redisConnected` reflects reality without
  // waiting for the first cache command.
  redis.connect().catch(() => {
    /* error already surfaced via the 'error' handler above */
  });
} else {
  console.log('[cache] REDIS_URL/REDIS_HOST not set — using in-memory cache (no Redis).');
}

/**
 * Minimal in-memory cache used when Redis is not configured. Supports the subset
 * of operations the app relies on: TTL expiry, tag sets, atomic SET NX, and
 * compare-and-delete. Single-process only (fine for an embedded/desktop app).
 */
class InMemoryStore {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  private sets = new Map<string, Map<string, number | null>>();

  private isExpired(entry: { expiresAt: number | null }): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  setex(key: string, ttlSeconds: number, value: string): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  setNX(key: string, value: string, ttlSeconds: number): boolean {
    const existing = this.store.get(key);
    if (existing && !this.isExpired(existing)) return false;
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }

  del(...keys: string[]): number {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) removed++;
      this.sets.delete(key);
    }
    return removed;
  }

  deleteIfEquals(key: string, expected: string): boolean {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return false;
    if (entry.value !== expected) return false;
    this.store.delete(key);
    return true;
  }

  exists(key: string): boolean {
    return this.get(key) !== null;
  }

  ttl(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    const remaining = Math.round((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  incrby(key: string, amount: number): number {
    const entry = this.store.get(key);
    const current = entry && !this.isExpired(entry) ? parseInt(entry.value, 10) || 0 : 0;
    const next = current + amount;
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  }

  keysByPattern(pattern: string): string[] {
    // Support the simple `prefix*` glob used by deletePattern().
    const glob = pattern.replace(/\*/g, '.*');
    const re = new RegExp(`^${glob}$`);
    const out: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (this.isExpired(entry)) {
        this.store.delete(key);
        continue;
      }
      if (re.test(key)) out.push(key);
    }
    return out;
  }

  sadd(setKey: string, member: string, ttlSeconds: number): void {
    let set = this.sets.get(setKey);
    if (!set) {
      set = new Map();
      this.sets.set(setKey, set);
    }
    set.set(member, Date.now() + ttlSeconds * 1000);
  }

  smembers(setKey: string): string[] {
    const set = this.sets.get(setKey);
    if (!set) return [];
    const now = Date.now();
    const members: string[] = [];
    for (const [member, expiresAt] of set.entries()) {
      if (expiresAt !== null && expiresAt <= now) {
        set.delete(member);
      } else {
        members.push(member);
      }
    }
    return members;
  }

  dbsize(): number {
    return this.store.size;
  }

  flushdb(): void {
    this.store.clear();
    this.sets.clear();
  }
}

// The in-memory backend is only instantiated when Redis is disabled.
const memory: InMemoryStore | null = REDIS_ENABLED ? null : new InMemoryStore();

// True whenever the cache can serve data: Redis connected, OR in-memory mode.
function cacheReady(): boolean {
  return REDIS_ENABLED ? redisConnected : true;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for invalidation
  compress?: boolean; // Compress large values
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memory: string;
}

class CacheService {
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private hits = 0;
  private misses = 0;

  /**
   * Check if the cache is available (Redis connected, or in-memory mode).
   * Avoids noisy errors when Redis is configured but down.
   */
  get isAvailable(): boolean {
    return cacheReady();
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!cacheReady()) return null;
    try {
      const cached = memory ? memory.get(this.prefixKey(key)) : await redis!.get(this.prefixKey(key));

      if (cached) {
        this.hits++;
        return JSON.parse(cached) as T;
      }

      this.misses++;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    if (!cacheReady()) return;
    try {
      const ttl = options.ttl || this.DEFAULT_TTL;
      const prefixedKey = this.prefixKey(key);
      const serialized = JSON.stringify(value);

      if (memory) {
        memory.setex(prefixedKey, ttl, serialized);
      } else {
        await redis!.setex(prefixedKey, ttl, serialized);
      }

      // Track tags for invalidation
      if (options.tags?.length) {
        await this.addToTags(prefixedKey, options.tags, ttl);
      }
    } catch {
      // Silently fail — Redis error already logged on connection level
    }
  }

  /**
   * Delete a specific key
   */
  async delete(key: string): Promise<void> {
    if (!cacheReady()) return;
    try {
      if (memory) {
        memory.del(this.prefixKey(key));
      } else {
        await redis!.del(this.prefixKey(key));
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Delete multiple keys by pattern using SCAN (non-blocking)
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!cacheReady()) return 0;
    try {
      if (memory) {
        const keys = memory.keysByPattern(this.prefixKey(pattern));
        return keys.length > 0 ? memory.del(...keys) : 0;
      }

      let deleted = 0;
      const stream = redis!.scanStream({ match: this.prefixKey(pattern), count: 100 });

      for await (const keys of stream) {
        if (keys.length > 0) {
          deleted += await redis!.del(...keys);
        }
      }

      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Invalidate all keys with a specific tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    if (!cacheReady()) return 0;
    try {
      const tagKey = `tag:${tag}`;
      const keys = memory ? memory.smembers(tagKey) : await redis!.smembers(tagKey);

      if (keys.length > 0) {
        if (memory) {
          memory.del(...keys);
          memory.del(tagKey);
        } else {
          await redis!.del(...keys);
          await redis!.del(tagKey);
        }
        return keys.length;
      }

      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Invalidate multiple tags at once
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let total = 0;

    for (const tag of tags) {
      total += await this.invalidateByTag(tag);
    }

    return total;
  }

  /**
   * Cache-aside pattern: get from cache or fetch and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetcher();

    // Cache the result
    await this.set(key, fresh, options);

    return fresh;
  }

  /**
   * Memoize a function with caching
   */
  memoize<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    keyGenerator: (...args: TArgs) => string,
    options: CacheOptions = {}
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs) => {
      const key = keyGenerator(...args);
      return this.getOrSet(key, () => fn(...args), options);
    };
  }

  /**
   * Atomically set a key only if it does not exist (SET NX EX).
   * Returns true if the key was set, false if it already existed.
   */
  async setNX(key: string, value: any, ttlSeconds: number): Promise<boolean> {
    if (!cacheReady()) return false;
    try {
      const prefixedKey = this.prefixKey(key);
      const serialized = JSON.stringify(value);
      if (memory) {
        return memory.setNX(prefixedKey, serialized, ttlSeconds);
      }
      const result = await redis!.set(prefixedKey, serialized, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return false;
    }
  }

  /**
   * Atomically delete a key only if it holds the expected value.
   * Uses a Lua script for atomic compare-and-delete.
   */
  async deleteIfEquals(key: string, expectedValue: any): Promise<boolean> {
    if (!cacheReady()) return false;
    try {
      const prefixedKey = this.prefixKey(key);
      const serialized = JSON.stringify(expectedValue);
      if (memory) {
        return memory.deleteIfEquals(prefixedKey, serialized);
      }
      const result = await redis!.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
        1,
        prefixedKey,
        serialized
      );
      return result === 1;
    } catch {
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!cacheReady()) return false;
    try {
      if (memory) {
        return memory.exists(this.prefixKey(key));
      }
      const result = await redis!.exists(this.prefixKey(key));
      return result === 1;
    } catch {
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    if (!cacheReady()) return -1;
    try {
      if (memory) {
        return memory.ttl(this.prefixKey(key));
      }
      return await redis!.ttl(this.prefixKey(key));
    } catch {
      return -1;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, amount = 1): Promise<number> {
    if (!cacheReady()) return 0;
    try {
      if (memory) {
        return memory.incrby(this.prefixKey(key), amount);
      }
      return await redis!.incrby(this.prefixKey(key), amount);
    } catch {
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (memory) {
      const total = this.hits + this.misses;
      const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        keys: memory.dbsize(),
        memory: 'in-memory',
      };
    }
    if (!redisConnected) {
      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: 0,
        keys: 0,
        memory: 'unavailable',
      };
    }
    try {
      const info = await redis!.info('memory');
      const dbsize = await redis!.dbsize();

      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memory = memoryMatch ? memoryMatch[1] : 'unknown';

      const total = this.hits + this.misses;
      const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        keys: dbsize,
        memory,
      };
    } catch {
      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: 0,
        keys: 0,
        memory: 'unknown',
      };
    }
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Flush all cache data
   */
  async flush(): Promise<void> {
    if (!cacheReady()) return;
    try {
      if (memory) {
        memory.flushdb();
      } else {
        await redis!.flushdb();
      }
      this.resetStats();
    } catch {
      // Silently fail
    }
  }

  /**
   * Close the cache connection (no-op in in-memory mode).
   */
  async close(): Promise<void> {
    if (redis) {
      await redis.quit();
    }
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    // In-memory cache is always healthy when active.
    if (memory) return true;
    if (!redis) return false;
    try {
      const result = await redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // Private helpers

  private prefixKey(key: string): string {
    return `pf:${key}`;
  }

  private async addToTags(key: string, tags: string[], ttl: number): Promise<void> {
    if (memory) {
      for (const tag of tags) {
        // Tag set expires slightly after the cached value.
        memory.sadd(`tag:${tag}`, key, ttl + 60);
      }
      return;
    }

    const pipeline = redis!.pipeline();

    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      pipeline.sadd(tagKey, key);
      pipeline.expire(tagKey, ttl + 60); // Tag expires slightly after cached value
    }

    await pipeline.exec();
  }
}

export const cacheService = new CacheService();

// Cache key builders
export const cacheKeys = {
  project: (id: string) => `project:${id}`,
  projectIssues: (projectId: string, filters?: string) =>
    `project:${projectId}:issues${filters ? `:${filters}` : ''}`,
  projectBoard: (projectId: string, sprintId?: string) =>
    `project:${projectId}:board${sprintId ? `:${sprintId}` : ''}`,
  issue: (id: string) => `issue:${id}`,
  issueComments: (issueId: string) => `issue:${issueId}:comments`,
  issueActivity: (issueId: string) => `issue:${issueId}:activity`,
  user: (id: string) => `user:${id}`,
  userProjects: (userId: string) => `user:${userId}:projects`,
  sprint: (id: string) => `sprint:${id}`,
  sprintIssues: (sprintId: string) => `sprint:${sprintId}:issues`,
  dashboard: (userId: string) => `dashboard:${userId}`,
  search: (query: string, projectId?: string) =>
    `search:${projectId || 'global'}:${Buffer.from(query).toString('base64')}`,
};

// Cache tags for invalidation
export const cacheTags = {
  project: (id: string) => `project:${id}`,
  projectIssues: (projectId: string) => `project:${projectId}:issues`,
  issue: (id: string) => `issue:${id}`,
  user: (id: string) => `user:${id}`,
  sprint: (id: string) => `sprint:${id}`,
};

export default cacheService;
