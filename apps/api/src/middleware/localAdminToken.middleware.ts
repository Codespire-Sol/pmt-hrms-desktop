import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';

/**
 * Host-only guard for the admin-account lifecycle endpoints (/auth/local/*).
 *
 * Allows the request ONLY when the `x-local-admin-token` header equals
 * `config.localAdminToken` AND that token is non-empty. The token is known
 * solely to the Electron main process, so LAN browsers (which never see it)
 * cannot reach these routes. Any other case responds 403.
 */
export function verifyLocalAdminToken(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.header('x-local-admin-token');
  const expected = config.localAdminToken;

  if (!expected || provided !== expected) {
    return next(ApiError.forbidden('Forbidden', 'LOCAL_ADMIN_TOKEN_REQUIRED'));
  }

  return next();
}
