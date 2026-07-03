import { Router } from 'express';
import { RbacController } from './rbac.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac.middleware';

const router = Router();
const controller = new RbacController();

// All routes require authentication
router.use(authenticate);

// ── Current user ────────────────────────────────────────────
// GET /api/v1/rbac/me/permissions   – effective permissions for the current user
// GET /api/v1/rbac/me/role          – the current user's global role
router.get('/me/permissions', controller.getCurrentUserPermissions.bind(controller));
router.get('/me/role', controller.getCurrentUserRole.bind(controller));

// ── Roles (read-only for authenticated users) ────────────────
// GET /api/v1/rbac/roles?scope=pmt|hrms|hrms-manageable|all
// GET /api/v1/rbac/roles/global        – all global (non-HRMS-only) roles
// GET /api/v1/rbac/roles/:roleId
// GET /api/v1/rbac/roles/:roleId/permissions?app=pmt|hrms|all
router.get('/roles/global', controller.getGlobalRoles.bind(controller));
router.get('/roles', controller.getRoles.bind(controller));
router.get('/roles/:roleId', controller.getRole.bind(controller));
router.get('/roles/:roleId/permissions', controller.getRolePermissions.bind(controller));

// ── Custom Role Management (admin only) ─────────────────────
router.post('/roles', requirePermission('admin.settings'), controller.createRole.bind(controller));
router.put('/roles/:roleId', requirePermission('admin.settings'), controller.updateRole.bind(controller));
router.delete('/roles/:roleId', requirePermission('admin.settings'), controller.deleteRole.bind(controller));
router.put(
  '/roles/:roleId/permissions',
  requireAnyPermission(['admin.settings', 'users.manage_roles']),
  controller.setRolePermissions.bind(controller)
);
router.post(
  '/roles/:roleId/permissions/:permissionId',
  requireAnyPermission(['admin.settings', 'users.manage_roles']),
  controller.addPermissionToRole.bind(controller)
);
router.delete(
  '/roles/:roleId/permissions/:permissionId',
  requireAnyPermission(['admin.settings', 'users.manage_roles']),
  controller.removePermissionFromRole.bind(controller)
);

// ── Permissions (admin only) ─────────────────────────────────
// GET /api/v1/rbac/permissions?app=pmt|hrms|all
router.get('/permissions', requirePermission('admin.settings'), controller.getPermissions.bind(controller));

// User management (admin only)
router.get('/users', requireAnyPermission(['users.read', 'users.manage_roles', 'admin.settings']), controller.getUsersWithRoles.bind(controller));
router.get('/users/:userId/permissions', requirePermission('users.read'), controller.getUserPermissions.bind(controller));
router.get('/users/:userId/direct-permissions', requirePermission('users.manage_roles'), controller.getUserDirectPermissions.bind(controller));
router.put('/users/:userId/direct-permissions', requirePermission('users.manage_roles'), controller.setUserDirectPermissions.bind(controller));
router.post('/users/:userId/role', requirePermission('users.manage_roles'), controller.assignRoleToUser.bind(controller));
router.delete('/users/:userId/role', requirePermission('users.manage_roles'), controller.removeRoleFromUser.bind(controller));

// Audit logs (admin only)
router.get('/audit-logs', requirePermission('admin.audit'), controller.getAuditLogs.bind(controller));
router.get('/audit-logs/filters', requirePermission('admin.audit'), controller.getAuditLogFilters.bind(controller));

// Cache management (admin only)
router.post('/cache/clear/:userId', requirePermission('admin.settings'), controller.clearUserCache.bind(controller));
router.post('/cache/clear-all', requirePermission('admin.settings'), controller.clearAllCache.bind(controller));

export default router;
