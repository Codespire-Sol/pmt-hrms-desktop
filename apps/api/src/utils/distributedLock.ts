import { cacheService } from '../services/cache.service';
import crypto from 'crypto';

/**
 * Redis-based distributed lock for preventing duplicate scheduler
 * execution across multiple server instances.
 *
 * Uses atomic SET NX EX for acquisition and Lua-scripted
 * compare-and-delete for release to prevent race conditions.
 */

const LOCK_PREFIX = 'dlock';

export interface LockOptions {
  /** Lock TTL in seconds. Should be longer than the expected task duration. */
  ttlSeconds: number;
}

export class DistributedLock {
  private readonly lockKey: string;
  private readonly lockValue: string;
  private readonly ttlSeconds: number;

  constructor(name: string, options: LockOptions) {
    this.lockKey = `${LOCK_PREFIX}:${name}`;
    this.lockValue = crypto.randomBytes(16).toString('hex');
    this.ttlSeconds = options.ttlSeconds;
  }

  /**
   * Try to acquire the lock atomically using SET NX EX.
   * Returns true if acquired, false if already held by another instance.
   */
  async acquire(): Promise<boolean> {
    try {
      return await cacheService.setNX(this.lockKey, this.lockValue, this.ttlSeconds);
    } catch {
      // If Redis is unavailable, allow execution (fail-open)
      // to avoid all instances being blocked
      return true;
    }
  }

  /**
   * Release the lock atomically. Only deletes if we still own it,
   * using a Lua script for compare-and-delete to prevent releasing
   * a lock that was re-acquired by another instance after expiry.
   */
  async release(): Promise<void> {
    try {
      await cacheService.deleteIfEquals(this.lockKey, this.lockValue);
    } catch {
      // Best effort release
    }
  }
}

/**
 * Execute a function with a distributed lock.
 * If the lock cannot be acquired, the function is skipped.
 *
 * @returns The function result, or null if the lock was not acquired.
 */
export async function withDistributedLock<T>(
  lockName: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const lock = new DistributedLock(lockName, { ttlSeconds });

  const acquired = await lock.acquire();
  if (!acquired) {
    return null;
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
