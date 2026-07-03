import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Request ID middleware.
 * Assigns a unique ID to each request for distributed tracing and log correlation.
 *
 * - Uses the incoming X-Request-ID header if present (from load balancer / API gateway)
 * - Otherwise generates a new UUID
 * - Sets the ID on both req and the response header
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
