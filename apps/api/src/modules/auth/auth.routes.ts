import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from '../users/users.repository';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { verifyLocalAdminToken } from '../../middleware/localAdminToken.middleware';
import { config } from '../../config';

const router = Router();

const usersRepository = new UsersRepository();
const authService = new AuthService(usersRepository);
const authController = new AuthController(authService);

/**
 * Local email/password endpoints — registered ONLY when AUTH_MODE=jwt.
 * In Keycloak mode the frontend handles login/refresh via keycloak-js, so
 * these routes stay disabled to avoid offering a second, unused auth path.
 */
if (config.auth.mode === 'jwt') {
  router.post('/login', authController.login);
  router.post('/refresh', authController.refresh);
  // Self-service password change (any authenticated user).
  router.post('/change-password', authenticate, authController.changePassword);
  // Admin/HR resets another user's password.
  router.post('/reset-password', authenticate, requirePermission('users.manage_roles'), authController.resetPassword);
}

/**
 * Host-only admin-account lifecycle endpoints for the Electron desktop app.
 * Gated by verifyLocalAdminToken (x-local-admin-token header must equal
 * config.localAdminToken, which only the Electron main process knows).
 * Mounted regardless of AUTH_MODE so the desktop app can bootstrap the first
 * admin before any login exists.
 */
router.get('/local/status', verifyLocalAdminToken, authController.localStatus);
router.post('/local/create-admin', verifyLocalAdminToken, authController.localCreateAdmin);
router.post('/local/reset-admin', verifyLocalAdminToken, authController.localResetAdmin);

/**
 * POST /api/v1/auth/logout
 * Blacklist the current access token JTI and clear cookies.
 */
router.post('/logout', authController.logout);

/**
 * GET /api/v1/auth/me
 * Return the local user profile for the authenticated Keycloak session.
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * PUT /api/v1/auth/profile
 * Update local profile fields (name, timezone, locale, etc.)
 */
router.put('/profile', authenticate, authController.updateProfile);

/**
 * POST /api/v1/auth/logout-all
 * Revoke all active tokens for this user (Redis blacklist).
 */
router.post('/logout-all', authenticate, authController.logoutAll);

export default router;
