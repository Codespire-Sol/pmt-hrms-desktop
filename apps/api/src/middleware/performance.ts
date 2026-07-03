import { Request, Response, NextFunction } from 'express';
import compression from 'compression';

/**
 * Performance Middleware
 *
 * Collection of middleware functions for optimizing API performance
 * including compression, response time tracking, and response optimization.
 */

// ============================================
// COMPRESSION MIDDLEWARE
// ============================================

/**
 * Compression middleware with smart filtering
 */
export const compressionMiddleware = compression({
  // Filter function to decide if response should be compressed
  filter: (req: Request, res: Response) => {
    // Don't compress if client requests no compression
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Don't compress small responses or already compressed content
    const contentType = res.getHeader('Content-Type') as string;
    if (contentType?.includes('image/') || contentType?.includes('video/')) {
      return false;
    }

    // Use default filter for everything else
    return compression.filter(req, res);
  },
  // Compression level (1-9, higher = better compression but slower)
  level: 6,
  // Only compress responses larger than 1KB
  threshold: 1024,
  // Memory level for compression
  memLevel: 8,
});

// ============================================
// RESPONSE TIME TRACKING
// ============================================

interface ResponseTimeOptions {
  warnThreshold?: number; // Log warning if response exceeds this (ms)
  header?: boolean; // Include X-Response-Time header
}

/**
 * Track and log response times
 */
export function responseTimeMiddleware(options: ResponseTimeOptions = {}) {
  const { warnThreshold = 200, header = true } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    // Capture original end function
    const originalEnd = res.end;

    // Override end to capture timing
    res.end = function (this: Response, ...args: any[]) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to ms

      // Add response time header
      if (header && !res.headersSent) {
        res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
      }

      // Log slow requests
      if (duration > warnThreshold) {
        console.warn(
          `[SLOW REQUEST] ${req.method} ${req.originalUrl} - ${duration.toFixed(2)}ms`
        );
      }

      // Call original end
      return (originalEnd as (...a: any[]) => any).apply(this, args);
    } as any;

    next();
  };
}

// ============================================
// PAGINATION HELPER
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Parse and validate pagination parameters from request
 */
export function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Middleware to add pagination params to request
 */
export function paginationMiddleware(req: Request, _res: Response, next: NextFunction) {
  (req as any).pagination = parsePagination(req);
  next();
}

// ============================================
// FIELD SELECTION
// ============================================

/**
 * Select specific fields from response data
 */
export function selectFields<T extends object>(data: T, fields?: string[]): Partial<T>;
export function selectFields<T extends object>(data: T[], fields?: string[]): Partial<T>[];
export function selectFields<T extends object>(
  data: T | T[],
  fields?: string[]
): Partial<T> | Partial<T>[] {
  if (!fields?.length) return data;

  if (Array.isArray(data)) {
    return data.map((item) => selectFields(item, fields));
  }

  return fields.reduce((acc, field) => {
    const keys = field.split('.');
    let value: any = data;

    for (const key of keys) {
      value = value?.[key];
    }

    if (value !== undefined) {
      if (keys.length === 1) {
        (acc as any)[field] = value;
      } else {
        // Handle nested fields
        let obj: any = acc;
        for (let i = 0; i < keys.length - 1; i++) {
          obj[keys[i]] = obj[keys[i]] || {};
          obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
      }
    }

    return acc;
  }, {} as Partial<T>);
}

/**
 * Middleware to apply field selection from query params
 */
export function fieldSelectionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const fields = req.query.fields as string;

  if (fields) {
    (req as any).selectedFields = fields.split(',').map((f) => f.trim());
  }

  next();
}

// ============================================
// ETAG & CONDITIONAL REQUESTS
// ============================================

import crypto from 'crypto';

/**
 * Generate ETag for response data
 */
export function generateETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return `"${crypto.createHash('md5').update(content).digest('hex')}"`;
}

/**
 * Middleware for conditional GET requests with ETags
 */
export function conditionalGetMiddleware(req: Request, res: Response, next: NextFunction) {
  // Store original json function
  const originalJson = res.json;

  res.json = function (this: Response, data: any) {
    // Generate ETag for response
    const etag = generateETag(data);
    this.setHeader('ETag', etag);

    // Check if client has valid cached version
    const clientETag = req.headers['if-none-match'];
    if (clientETag === etag) {
      return this.status(304).end();
    }

    return originalJson.call(this, data);
  };

  next();
}

// ============================================
// RATE LIMIT HEADERS
// ============================================

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Add rate limit headers to response
 */
export function setRateLimitHeaders(res: Response, info: RateLimitInfo): void {
  res.setHeader('X-RateLimit-Limit', info.limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, info.remaining));
  res.setHeader('X-RateLimit-Reset', info.reset);
}

// ============================================
// CACHE CONTROL HEADERS
// ============================================

export interface CacheControlOptions {
  public?: boolean;
  private?: boolean;
  maxAge?: number;
  sMaxAge?: number;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
  staleWhileRevalidate?: number;
}

/**
 * Set cache control headers
 */
export function setCacheControl(res: Response, options: CacheControlOptions): void {
  const directives: string[] = [];

  if (options.public) directives.push('public');
  if (options.private) directives.push('private');
  if (options.noCache) directives.push('no-cache');
  if (options.noStore) directives.push('no-store');
  if (options.mustRevalidate) directives.push('must-revalidate');
  if (options.maxAge !== undefined) directives.push(`max-age=${options.maxAge}`);
  if (options.sMaxAge !== undefined) directives.push(`s-maxage=${options.sMaxAge}`);
  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (directives.length > 0) {
    res.setHeader('Cache-Control', directives.join(', '));
  }
}

/**
 * Middleware for setting cache headers on specific routes
 */
export function cacheMiddleware(options: CacheControlOptions) {
  return (_req: Request, res: Response, next: NextFunction) => {
    setCacheControl(res, options);
    next();
  };
}

// ============================================
// REQUEST TIMEOUT
// ============================================

/**
 * Middleware to enforce request timeout
 */
export function timeoutMiddleware(ms: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: `Request timeout after ${ms}ms`,
          },
        });
      }
    }, ms);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}

// ============================================
// SECURITY HEADERS
// ============================================

/**
 * Add security headers to responses
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Disable client-side caching for sensitive data
  if (req.path.includes('/auth/') || req.path.includes('/user/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

