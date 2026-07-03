import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { getSettingsMasked, updateSettings } from '../../services/appSettings.service';
import { emailService } from '../../services/email.service';
import { adminController } from './admin.controller';
import {
  createHrAccountSchema,
  updateHrAccountLimitSchema,
  createBranchSchema,
  updateBranchSchema,
  branchIdParamSchema,
} from './admin.validator';

const router = Router();

// Database Connection Management (public — no auth, for emergency use from Postman)
router.get('/db/connections', adminController.getDbConnectionStats);
router.post('/db/kill-idle', adminController.killIdleDbConnections);

router.use(authenticate);

router.get(
  '/dashboard',
  requirePermission('users.read'),
  adminController.getDashboard
);

router.get(
  '/hr-accounts',
  requirePermission('users.read'),
  adminController.listHrAccounts
);

router.post(
  '/hr-accounts',
  requirePermission('employees.create_hr'),
  validate(createHrAccountSchema),
  adminController.createHrAccount
);

router.patch(
  '/hr-accounts/:userId/branch',
  requirePermission('employees.create_hr'),
  adminController.assignHrBranch
);

router.get(
  '/settings',
  requirePermission('admin.settings'),
  adminController.getAdminSettings
);

router.put(
  '/settings/hr-max-accounts',
  requirePermission('admin.settings'),
  validate(updateHrAccountLimitSchema),
  adminController.updateHrAccountLimit
);

// Branch Management
router.get('/branches', requirePermission('admin.settings'), adminController.listBranches);
router.post('/branches', requirePermission('admin.settings'), validate(createBranchSchema), adminController.createBranch);
router.patch('/branches/:id', requirePermission('admin.settings'), validate(updateBranchSchema), adminController.updateBranch);
router.delete('/branches/:id', requirePermission('admin.settings'), validate(branchIdParamSchema), adminController.deleteBranch);

// App Settings (SMTP / company / attendance) — admin Settings page
router.get('/app-settings', requirePermission('admin.settings'), asyncHandler(async (_req, res) => {
  return ApiResponse.success(res, await getSettingsMasked(), 'Settings retrieved');
}));
router.put('/app-settings', requirePermission('admin.settings'), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).user?.id ?? null;
  await updateSettings(req.body ?? {}, userId);
  return ApiResponse.success(res, await getSettingsMasked(), 'Settings saved');
}));
router.post('/app-settings/test-email', requirePermission('admin.settings'), asyncHandler(async (req, res) => {
  const to = req.body?.to;
  if (!to) throw ApiError.badRequest('Recipient "to" is required', 'MISSING_TO');
  await emailService.sendTestEmail(String(to));
  return ApiResponse.success(res, null, 'Test email sent successfully');
}));

// Audit Logs (proxied from RBAC service for HRMS frontend)
router.get('/audit-logs', requirePermission('users.read'), adminController.getAuditLogs);

// Keycloak User Directory — Keycloak is source of truth for users/roles
router.get('/keycloak/users', requirePermission('users.read'), adminController.listKeycloakUsers);
router.get('/keycloak/users/:sub/profile', requirePermission('users.read'), adminController.getKeycloakUserProfile);
router.put('/keycloak/users/:sub/profile', requirePermission('employees.create_hr'), adminController.updateKeycloakUserProfile);
router.post('/keycloak/users/:sub/send-reset-email', requirePermission('employees.create_hr'), adminController.sendPasswordResetEmail);

export default router;

