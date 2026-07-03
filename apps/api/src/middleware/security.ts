import { Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import hpp from 'hpp';
import { cacheService } from '../services/cache.service';

/**
 * Security Middleware
 *
 * Comprehensive security middleware for production deployment
 * including Helmet, rate limiting, and security headers.
 */

// ============================================
// HELMET SECURITY HEADERS
// ============================================

const API_URL = process.env.API_URL || 'https://api.projectflow.com';
const WS_URL = process.env.WS_URL || 'wss://ws.projectflow.com';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'fonts.googleapis.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", API_URL, WS_URL, 'https://api.anthropic.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  frameguard: { action: 'deny' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  dnsPrefetchControl: { allow: false },
  ieNoOpen: true,
  originAgentCluster: true,
});

// ============================================
// RATE LIMITING
// ============================================

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

// Default rate limiter for API endpoints
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip || 'anonymous';
  },
});

// Strict rate limiter for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again in 15 minutes',
    },
  },
});

// Rate limiter for AI endpoints (expensive operations)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'AI request limit exceeded, please try again later',
    },
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip || 'anonymous';
  },
});

// Rate limiter for file uploads
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Upload limit exceeded, please try again later',
    },
  },
});

// ============================================
// SPEED LIMITER (Progressive slowdown)
// ============================================

export const speedLimiter: any = slowDown({
  windowMs: 60 * 1000, // 1 minute
  delayAfter: 50, // Start slowing after 50 requests
  delayMs: (hits: number) => hits * 100, // Add 100ms delay per request over limit
  maxDelayMs: 2000, // Maximum 2 second delay
});

// ============================================
// PARAMETER POLLUTION PROTECTION
// ============================================

export const parameterPollutionProtection = hpp({
  whitelist: [
    'sort',
    'fields',
    'filter',
    'include',
    'tags',
    'labels',
    'status',
    'priority',
    'type',
  ],
});

// ============================================
// INPUT SANITIZATION
// ============================================

export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize query parameters
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    }
  }

  // Sanitize body (for JSON payloads)
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
}

function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript\s*:/gi, '') // Remove javascript: protocol (with optional whitespace)
    .replace(/vbscript\s*:/gi, '') // Remove vbscript: protocol
    .replace(/data\s*:\s*text\/html/gi, '') // Remove data:text/html payloads
    .replace(/on\w+\s*=/gi, '') // Remove event handlers (with optional whitespace)
    .replace(/expression\s*\(/gi, '') // Remove CSS expression()
    .replace(/url\s*\(\s*['"]?\s*javascript/gi, '') // Remove url(javascript:...)
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .trim();
}

function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================
// CORS CONFIGURATION
// ============================================

export interface CorsOptions {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

export function createCorsMiddleware(options: Partial<CorsOptions> = {}): RequestHandler {
  const {
    allowedOrigins = [
      'https://projectflow.com',
      'https://app.projectflow.com',
      process.env.FRONTEND_URL || 'http://localhost:3000',
    ],
    allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders = [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'X-CSRF-Token',
    ],
    credentials = true,
    maxAge = 86400, // 24 hours
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // Check if origin is allowed
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', maxAge.toString());

    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

// ============================================
// CSRF PROTECTION (Redis-backed)
// ============================================

const CSRF_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export async function generateCsrfToken(sessionId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await cacheService.set(`csrf:${sessionId}`, token, { ttl: CSRF_TTL_SECONDS });
  return token;
}

export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const sessionId = req.user?.id || (req as any).sessionID;
  const token = req.headers['x-csrf-token'] as string;

  if (!sessionId || !token) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'CSRF token missing',
      },
    });
    return;
  }

  cacheService.get<string>(`csrf:${sessionId}`).then((storedToken) => {
    if (!storedToken) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_VALIDATION_FAILED',
          message: 'Invalid or expired CSRF token',
        },
      });
      return;
    }

    // Timing-safe comparison to prevent timing attacks
    const tokenBuf = Buffer.from(token);
    const storedBuf = Buffer.from(storedToken);
    if (tokenBuf.length !== storedBuf.length || !crypto.timingSafeEqual(tokenBuf, storedBuf)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_VALIDATION_FAILED',
          message: 'Invalid or expired CSRF token',
        },
      });
      return;
    }

    next();
  }).catch(() => {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'CSRF validation error',
      },
    });
  });
}

// ============================================
// SECURITY AUDIT LOGGING (Redis-backed)
// ============================================

export interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip: string;
  userAgent?: string;
  path: string;
  method: string;
  details?: Record<string, any>;
  timestamp: string;
}

const SECURITY_EVENTS_KEY = 'security:events';
const MAX_SECURITY_EVENTS = 10000;
const SECURITY_EVENTS_TTL = 7 * 24 * 60 * 60; // 7 days

export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  // Log critical events to structured logger immediately
  if (event.severity === 'critical') {
    console.error('[SECURITY CRITICAL]', JSON.stringify(fullEvent));
  }

  // Push to Redis list asynchronously (fire-and-forget)
  cacheService.get<SecurityEvent[]>(SECURITY_EVENTS_KEY).then(async (events) => {
    const list = events || [];
    list.push(fullEvent);
    // Trim to max size
    const trimmed = list.length > MAX_SECURITY_EVENTS ? list.slice(-MAX_SECURITY_EVENTS) : list;
    await cacheService.set(SECURITY_EVENTS_KEY, trimmed, { ttl: SECURITY_EVENTS_TTL });
  }).catch(() => {
    // Fallback: at least log to console if Redis is unavailable
    console.error('[SECURITY EVENT - Redis unavailable]', JSON.stringify(fullEvent));
  });
}

export async function getRecentSecurityEvents(limit = 100): Promise<SecurityEvent[]> {
  const events = await cacheService.get<SecurityEvent[]>(SECURITY_EVENTS_KEY);
  return (events || []).slice(-limit);
}

// Middleware to track security events
export function securityAuditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalEnd = res.end;

  res.end = function (this: Response, ...args: any[]) {
    // Log failed auth attempts
    if (req.path.includes('/auth/login') && res.statusCode === 401) {
      logSecurityEvent({
        type: 'FAILED_LOGIN',
        severity: 'medium',
        userId: req.body?.email,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
    }

    // Log unauthorized access attempts
    if (res.statusCode === 403) {
      logSecurityEvent({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'high',
        userId: req.user?.id,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
    }

    // Log rate limit violations
    if (res.statusCode === 429) {
      logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'medium',
        userId: req.user?.id,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });
    }

    return (originalEnd as (...a: any[]) => any).apply(this, args);
  } as any;

  next();
}

// ============================================
// ACCOUNT LOCKOUT (Redis-backed)
// ============================================

const LOCKOUT_MAX_ATTEMPTS = 10;
const LOCKOUT_DURATION_SECONDS = 30 * 60; // 30 minutes
const ATTEMPT_WINDOW_SECONDS = 30 * 60; // Track attempts over 30 minutes

export function checkAccountLockout(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const identifier = req.body?.email || req.ip || 'unknown';
  const lockKey = `lockout:lock:${identifier}`;

  cacheService.get<number>(lockKey).then((lockedUntil) => {
    if (lockedUntil && lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((lockedUntil - Date.now()) / 60000);

      logSecurityEvent({
        type: 'LOCKED_ACCOUNT_ACCESS',
        severity: 'high',
        userId: identifier,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
      });

      res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
        },
      });
      return;
    }

    next();
  }).catch(() => {
    // If Redis is unavailable, allow the request through (fail-open for availability)
    next();
  });
}

export async function recordLoginAttempt(identifier: string, success: boolean): Promise<void> {
  const countKey = `lockout:count:${identifier}`;
  const lockKey = `lockout:lock:${identifier}`;

  if (success) {
    await cacheService.delete(countKey);
    await cacheService.delete(lockKey);
    return;
  }

  // Use setNX to initialize counter with TTL atomically on first attempt.
  // If key already exists, setNX returns false and we just increment.
  await cacheService.setNX(countKey, 0, ATTEMPT_WINDOW_SECONDS);
  const count = await cacheService.increment(countKey);

  // Lock account after max attempts
  if (count >= LOCKOUT_MAX_ATTEMPTS) {
    const lockedUntil = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
    await cacheService.set(lockKey, lockedUntil, { ttl: LOCKOUT_DURATION_SECONDS });

    logSecurityEvent({
      type: 'ACCOUNT_LOCKED',
      severity: 'high',
      userId: identifier,
      ip: 'N/A',
      path: '/auth/login',
      method: 'POST',
      details: { attempts: count },
    });
  }
}

// ============================================
// REQUEST SIZE LIMITS
// ============================================

export function requestSizeLimiter(maxSize: string = '10mb'): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      res.status(413).json({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: `Request body exceeds maximum size of ${maxSize}`,
        },
      });
      return;
    }

    next();
  };
}

function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB

  const value = parseInt(match[1], 10);
  const unit = match[2] || 'b';

  return value * units[unit];
}

// ============================================
// SECURITY CHECKLIST VALIDATION
// ============================================

export interface SecurityCheckResult {
  name: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export function runSecurityChecks(): SecurityCheckResult[] {
  const results: SecurityCheckResult[] = [];

  // Check environment variables
  const jwtSecretLength = process.env.JWT_SECRET?.length || 0;
  results.push({
    name: 'JWT Secret',
    passed: jwtSecretLength >= 32,
    message: jwtSecretLength >= 32
      ? 'JWT secret is properly configured'
      : 'JWT secret should be at least 32 characters',
    severity: jwtSecretLength >= 32 ? 'info' : 'error',
  });

  results.push({
    name: 'Node Environment',
    passed: process.env.NODE_ENV === 'production',
    message: process.env.NODE_ENV === 'production'
      ? 'Running in production mode'
      : 'Not running in production mode',
    severity: process.env.NODE_ENV === 'production' ? 'info' : 'warning',
  });

  results.push({
    name: 'Database SSL',
    passed: process.env.DATABASE_SSL === 'true',
    message: process.env.DATABASE_SSL === 'true'
      ? 'Database SSL is enabled'
      : 'Database SSL should be enabled in production',
    severity: process.env.DATABASE_SSL === 'true' ? 'info' : 'error',
  });

  results.push({
    name: 'Redis TLS',
    passed: process.env.REDIS_URL?.startsWith('rediss://') || false,
    message: process.env.REDIS_URL?.startsWith('rediss://')
      ? 'Redis TLS is enabled'
      : 'Redis should use TLS (rediss://) in production',
    severity: process.env.REDIS_URL?.startsWith('rediss://') ? 'info' : 'warning',
  });

  return results;
}

