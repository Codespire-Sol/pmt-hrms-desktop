import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import jwt from 'jsonwebtoken';
import { cacheService } from '../../services/cache.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { prisma } from '../../database/prisma';

const TOKEN_BLACKLIST_PREFIX = 'token:bl';
const ACCESS_TOKEN_COOKIE = 'pf_access_token';
const REFRESH_TOKEN_COOKIE = 'pf_refresh_token';

/**
 * Whether to set the `Secure` flag on auth cookies. This MUST follow the actual
 * transport, NOT NODE_ENV. The desktop edition runs with NODE_ENV=production but
 * serves over plain HTTP on the office LAN, where browsers silently DROP Secure
 * cookies — which kills the httpOnly cookie auth and forces weaker localStorage
 * tokens. So: honour an explicit COOKIE_SECURE if set, otherwise derive it from
 * the frontend URL scheme (https => secure, http => not).
 */
function useSecureCookies(): boolean {
  const explicit = process.env.COOKIE_SECURE;
  if (explicit !== undefined && explicit !== '') return explicit === 'true';
  return (process.env.FRONTEND_URL || '').startsWith('https://');
}

export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/v1/auth/login   (AUTH_MODE=jwt only)
   * Email/password login. Sets httpOnly cookies and also returns tokens in the
   * body so SPA and API clients can both use it.
   */
  login = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { email, password, rememberMe } = req.body ?? {};
    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required', 'MISSING_CREDENTIALS');
    }

    const result = await this.authService.login(String(email), String(password), Boolean(rememberMe));

    const secure = useSecureCookies();
    res.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, {
      httpOnly: true, secure, sameSite: 'lax', path: '/',
    });
    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
      httpOnly: true, secure, sameSite: 'lax', path: '/',
    });

    return ApiResponse.success(res, result, 'Logged in successfully');
  });

  /**
   * POST /api/v1/auth/refresh   (AUTH_MODE=jwt only)
   * Issue a new access token from a refresh token (cookie or body).
   */
  refresh = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body?.refreshToken;
    if (!refreshToken) {
      throw ApiError.unauthorized('Refresh token is required', 'NO_REFRESH_TOKEN');
    }

    const { accessToken } = await this.authService.refresh(String(refreshToken));

    const secure = useSecureCookies();
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true, secure, sameSite: 'lax', path: '/',
    });

    return ApiResponse.success(res, { accessToken }, 'Token refreshed');
  });

  /**
   * POST /api/v1/auth/logout
   * Blacklist the current Keycloak access token JTI in Redis and clear cookies.
   * The frontend (keycloak-js) handles the actual Keycloak session logout separately.
   */
  logout = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const accessToken =
      req.cookies?.[ACCESS_TOKEN_COOKIE] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null);

    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken) as { jti?: string; exp?: number } | null;
        if (decoded?.jti && decoded?.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await cacheService.set(`${TOKEN_BLACKLIST_PREFIX}:${decoded.jti}`, 1, { ttl });
          }
        }
      } catch {
        // Best effort
      }
    }

    res.clearCookie(ACCESS_TOKEN_COOKIE, { httpOnly: true, path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { httpOnly: true, path: '/' });

    return ApiResponse.success(res, null, 'Logged out successfully');
  });

  /**
   * POST /api/v1/auth/logout-all
   * Revoke all active tokens for the authenticated user (Redis blacklist).
   */
  logoutAll = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    await this.authService.logoutAll(req.user.id);

    return ApiResponse.success(res, null, 'Logged out from all devices');
  });

  /**
   * POST /api/v1/auth/change-password  (AUTH_MODE=jwt)
   * Change the authenticated user's own password.
   */
  changePassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized('Not authenticated');
    const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      throw ApiError.badRequest('currentPassword and newPassword are required', 'MISSING_FIELDS');
    }
    if (confirmPassword !== undefined && confirmPassword !== newPassword) {
      throw ApiError.badRequest('Passwords do not match', 'PASSWORD_MISMATCH');
    }
    await this.authService.changePassword(req.user.id, String(currentPassword), String(newPassword));
    return ApiResponse.success(res, null, 'Password changed successfully');
  });

  /**
   * POST /api/v1/auth/reset-password  (AUTH_MODE=jwt; admin/HR only via route guard)
   * Reset another user's password by userId or employeeId.
   */
  resetPassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { userId, employeeId, newPassword, password, confirmPassword } = req.body ?? {};
    const pwd = newPassword ?? password;
    if (!pwd) throw ApiError.badRequest('newPassword is required', 'MISSING_FIELDS');
    if (confirmPassword !== undefined && confirmPassword !== pwd) {
      throw ApiError.badRequest('Passwords do not match', 'PASSWORD_MISMATCH');
    }

    let targetUserId: string | undefined = userId;
    if (!targetUserId && employeeId) {
      const rows = await prisma.$queryRawUnsafe<Array<{ user_id: string }>>(
        `SELECT user_id::text as user_id FROM employees WHERE id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
        String(employeeId),
      );
      targetUserId = rows[0]?.user_id;
    }
    if (!targetUserId) throw ApiError.badRequest('userId or employeeId is required', 'MISSING_TARGET');

    await this.authService.adminResetPassword(String(targetUserId), String(pwd));
    return ApiResponse.success(res, null, 'Password reset successfully');
  });

  /**
   * GET /api/v1/auth/local/status   (host-only, verifyLocalAdminToken)
   * Report whether an admin account already exists so the desktop app can
   * decide between showing the login screen and the "create admin" screen.
   */
  localStatus = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
    const hasAdmin = await this.authService.hasAdmin();
    return ApiResponse.success(res, { hasAdmin }, 'Admin status retrieved');
  });

  /**
   * POST /api/v1/auth/local/create-admin   (host-only, verifyLocalAdminToken)
   * Create the first admin user. Returns 409 if an admin already exists.
   */
  localCreateAdmin = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { email, password, firstName, lastName } = req.body ?? {};
    if (!email || !password) {
      throw ApiError.badRequest('email and password are required', 'MISSING_FIELDS');
    }
    const result = await this.authService.createFirstAdmin({
      email: String(email),
      password: String(password),
      firstName: firstName !== undefined ? String(firstName) : undefined,
      lastName: lastName !== undefined ? String(lastName) : undefined,
    });
    return ApiResponse.created(res, result, 'Admin created successfully');
  });

  /**
   * POST /api/v1/auth/local/reset-admin   (host-only, verifyLocalAdminToken)
   * Reset the admin account password and revoke its existing tokens.
   */
  localResetAdmin = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { password, email } = req.body ?? {};
    if (!password) {
      throw ApiError.badRequest('password is required', 'MISSING_FIELDS');
    }
    const result = await this.authService.resetAdminPassword(
      String(password),
      email !== undefined ? String(email) : undefined,
    );
    return ApiResponse.success(res, result, 'Admin password reset successfully');
  });

  /**
   * GET /api/v1/auth/me
   * Return the local user profile for the authenticated Keycloak session.
   */
  getCurrentUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const user = await this.authService.getCurrentUser(req.user.id);

    const userWithBranch = {
      ...user,
      branchId: req.user.branchId ?? null,
      roleName: req.user.roleName ?? null,
    };

    return ApiResponse.success(res, { user: userWithBranch }, 'User retrieved successfully');
  });

  /**
   * PUT /api/v1/auth/profile
   * Update local profile fields (name, timezone, locale, etc.)
   */
  updateProfile = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const { firstName, lastName, timezone, locale, phone } = req.body;

    const user = await this.authService.updateProfile(req.user.id, {
      firstName,
      lastName,
      timezone,
      locale,
      phone,
    });

    return ApiResponse.success(res, { user }, 'Profile updated successfully');
  });
}
