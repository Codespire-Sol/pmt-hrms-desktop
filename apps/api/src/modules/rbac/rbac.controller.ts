import { Request, Response } from 'express';
import { RbacService } from './rbac.service';
import { z } from 'zod';

const rbacService = new RbacService();

const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
  scope: z.enum(['hrms', 'pmt']).optional(),
});

const createRoleSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z_]+$/, 'Name must be lowercase with underscores only'),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  level: z.number().min(1).max(100).optional(),
  app: z.enum(['hrms', 'pmt']),
});

const updateRoleSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  level: z.number().min(1).max(100).optional(),
});

const setPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
});

const auditLogFiltersSchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  app: z.enum(['pmt']).optional(),
});

export class RbacController {
  /** GET /me/role – returns the calling user's global role */
  async getCurrentUserRole(req: Request, res: Response) {
    const role = await rbacService.getUserRole(req.user!.id);
    res.json({ success: true, data: role });
  }

  /** GET /roles/global – all roles visible in both HRMS and PMT (excludes HRMS-only roles) */
  async getGlobalRoles(_req: Request, res: Response) {
    const roles = await rbacService.getRolesForPmtPlatform(true);
    res.json({ success: true, data: roles });
  }

  // Roles
  async getRoles(req: Request, res: Response) {
    const scope = ((req.query.scope as string | undefined)?.toLowerCase() || 'pmt') as
      | 'all'
      | 'hrms'
      | 'hrms-manageable'
      | 'pmt';
    const includeCustom =
      req.query.includeCustom !== undefined
        ? String(req.query.includeCustom).toLowerCase() === 'true'
        : scope === 'pmt' || scope === 'all';
    const roles =
      scope === 'hrms'
        ? await rbacService.getRolesForHrmsPlatform(req.user!.id, includeCustom)
        : scope === 'hrms-manageable'
        ? await rbacService.getRolesForHrmsManagement(req.user!.id)
        : scope === 'all'
        ? await rbacService.getAllRoles()
        : await rbacService.getRolesForPmtPlatform(includeCustom);
    res.json({ success: true, data: roles });
  }

  async getRole(req: Request, res: Response) {
    const { roleId } = req.params;
    const role = await rbacService.getRoleById(roleId);
    res.json({ success: true, data: role });
  }

  async getRolePermissions(req: Request, res: Response) {
    const { roleId } = req.params;
    // Support both ?scope= (legacy) and ?app= (new)
    const raw = ((req.query.app || req.query.scope) as string | undefined)?.toLowerCase();
    const scope = (raw === 'hrms' || raw === 'pmt' || raw === 'all' ? raw : 'all') as
      | 'all'
      | 'hrms'
      | 'pmt';
    const permissions = await rbacService.getRolePermissions(roleId, scope);
    res.json({ success: true, data: permissions });
  }

  // Custom Role Management
  async createRole(req: Request, res: Response) {
    const input = createRoleSchema.parse(req.body);
    const currentUserId = req.user!.id;

    const role = await rbacService.createRole(input as any, currentUserId);
    res.status(201).json({ success: true, data: role, message: 'Role created successfully' });
  }

  async updateRole(req: Request, res: Response) {
    const { roleId } = req.params;
    const input = updateRoleSchema.parse(req.body);
    const currentUserId = req.user!.id;

    const role = await rbacService.updateRole(roleId, input, currentUserId);
    res.json({ success: true, data: role, message: 'Role updated successfully' });
  }

  async deleteRole(req: Request, res: Response) {
    const { roleId } = req.params;
    const currentUserId = req.user!.id;

    const result = await rbacService.deleteRole(roleId, currentUserId);
    res.json({ success: true, message: result.message });
  }

  async setRolePermissions(req: Request, res: Response) {
    const { roleId } = req.params;
    const input = setPermissionsSchema.parse(req.body);
    const currentUserId = req.user!.id;

    const result = await rbacService.setRolePermissions(roleId, input.permissionIds, currentUserId);
    res.json({ success: true, message: result.message });
  }

  async addPermissionToRole(req: Request, res: Response) {
    const { roleId, permissionId } = req.params;
    const currentUserId = req.user!.id;

    const result = await rbacService.addPermissionToRole(roleId, permissionId, currentUserId);
    res.json({ success: true, message: result.message });
  }

  async removePermissionFromRole(req: Request, res: Response) {
    const { roleId, permissionId } = req.params;
    const currentUserId = req.user!.id;

    const result = await rbacService.removePermissionFromRole(roleId, permissionId, currentUserId);
    res.json({ success: true, message: result.message });
  }

  // Permissions
  async getPermissions(req: Request, res: Response) {
    // Support both ?scope= (legacy) and ?app= (new) query params
    const raw = ((req.query.app || req.query.scope) as string | undefined)?.toLowerCase();
    const scope = (raw === 'hrms' || raw === 'pmt' || raw === 'all' ? raw : 'pmt') as
      | 'all'
      | 'hrms'
      | 'pmt';
    const permissions = await rbacService.getAllPermissions(scope);
    res.json({ success: true, data: permissions });
  }

  // User role management
  async getUsersWithRoles(req: Request, res: Response) {
    const { search, roleId, page, limit, scope } = req.query;
    const result = await rbacService.getUsersWithRoles({
      search: search as string,
      roleId: roleId as string,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      scope: (scope as 'all' | 'hrms' | 'pmt' | undefined) || 'pmt',
    });
    res.json({
      success: true,
      data: {
        users: result.users,
        pagination: {
          page: parseInt((page as string) || '1', 10),
          limit: parseInt((limit as string) || '50', 10),
          total: result.total,
          totalPages: Math.ceil(result.total / (parseInt((limit as string) || '50', 10))),
        },
      },
    });
  }

  async assignRoleToUser(req: Request, res: Response) {
    const { userId } = req.params;
    const input = assignRoleSchema.parse(req.body);
    const currentUserId = req.user!.id;

    const result = await rbacService.assignRole(
      userId,
      input.roleId,
      currentUserId,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      input.scope
    );

    res.json({ success: true, message: result.message });
  }

  async removeRoleFromUser(req: Request, res: Response) {
    const { userId } = req.params;
    const currentUserId = req.user!.id;
    const scope = req.query.scope === 'pmt' ? 'pmt' : 'hrms';

    const result = await rbacService.removeRole(userId, currentUserId, scope);
    res.json({ success: true, message: result.message });
  }

  async getUserPermissions(req: Request, res: Response) {
    const { userId } = req.params;
    const permissions = await rbacService.getUserPermissions(userId || req.user!.id);
    res.json({ success: true, data: permissions });
  }

  async getUserDirectPermissions(req: Request, res: Response) {
    const { userId } = req.params;
    const perms = await rbacService.getUserDirectPermissions(userId);
    res.json({ success: true, data: perms.map((up: any) => up.permission) });
  }

  async setUserDirectPermissions(req: Request, res: Response) {
    const { userId } = req.params;
    const { permissionIds } = z.object({ permissionIds: z.array(z.string().uuid()) }).parse(req.body);
    await rbacService.setUserDirectPermissions(userId, permissionIds, req.user!.id);
    res.json({ success: true, message: 'User permissions updated' });
  }

  async getCurrentUserPermissions(req: Request, res: Response) {
    const userId = req.user!.id;
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const [dbRole, effectivePermissions] = await Promise.all([
      rbacService.getUserRole(userId),
      rbacService.getCurrentUserPermissions(userId, projectId),
    ]);
    // Prefer DB role (post-sync); fall back to Keycloak role on req.user if DB hasn't synced yet
    const role = dbRole ?? (req.user!.roleName
      ? { id: '', name: req.user!.roleName, displayName: req.user!.roleName, description: '', isSystem: true, level: 0 }
      : null);
    res.json({
      success: true,
      data: {
        role,
        permissions: effectivePermissions.permissions,
        projectPermissions: effectivePermissions.projectPermissions,
        projectRole: effectivePermissions.projectRole,
      },
    });
  }

  // Admin-only: clear permission cache for a specific user
  async clearUserCache(req: Request, res: Response) {
    const { userId } = req.params;
    rbacService.clearUserCache(userId);
    res.json({ success: true, message: `Cleared permission cache for user ${userId}` });
  }

  // Admin-only: clear all permission cache entries
  async clearAllCache(req: Request, res: Response) {
    rbacService.clearAllCache();
    res.json({ success: true, message: 'Cleared permission cache for all users' });
  }

  // Audit logs
  async getAuditLogs(req: Request, res: Response) {
    const filters = auditLogFiltersSchema.parse(req.query);
    const result = await rbacService.getAuditLogs(filters);
    res.json({
      success: true,
      data: {
        logs: result.logs,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / filters.limit),
        },
      },
    });
  }

  async getAuditLogFilters(req: Request, res: Response) {
    const app = req.query.app === 'pmt' ? 'pmt' as const : undefined;
    const filters = await rbacService.getAuditLogFilters(app);
    res.json({ success: true, data: filters });
  }
}
