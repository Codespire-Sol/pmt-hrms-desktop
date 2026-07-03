import { RbacRepository, AuditLogRepository } from './rbac.repository';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { ApiError } from '../../utils/ApiError';
import { PROJECT_ROLE_PERMISSIONS, AuditLogFilters, CreateAuditLogInput, CreateRoleInput, UpdateRoleInput } from './rbac.types';
import { prisma } from '../../database/prisma';
import { HRMS_SYSTEM_ROLES, ALL_SYSTEM_ROLES, GLOBAL_JOB_ROLES } from './hrms-rbac.seed';

/** Names of roles that are HRMS-context only (not valid as global/PMT roles) */
const HRMS_ONLY_ROLE_NAMES = new Set(
  HRMS_SYSTEM_ROLES.map((r) => r.name).filter((n) => n !== 'admin')
);

/** All system role names (HRMS + global job titles) */
const _ALL_SYSTEM_ROLE_NAMES = new Set(ALL_SYSTEM_ROLES.map((r) => r.name));

export class RbacService {
  private rbacRepository: RbacRepository;
  private auditLogRepository: AuditLogRepository;
  private projectMembersRepository: ProjectMembersRepository;

  // Simple in-memory cache (in production, use Redis)
  private permissionCache: Map<string, { value: boolean; expires: number }> = new Map();
  private CACHE_TTL = 30 * 1000; // 30 seconds — keep short to avoid stale role data

  constructor() {
    this.rbacRepository = new RbacRepository();
    this.auditLogRepository = new AuditLogRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  // Permission checking
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const cacheKey = `${userId}:${permission}`;
    const cached = this.permissionCache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    // Get user's system role
    const userRole = await this.rbacRepository.getUserRole(userId);
    if (!userRole) {
      this.cachePermission(cacheKey, false);
      return false;
    }

    // Check if role has permission
    const hasPermission = await this.rbacRepository.roleHasPermission(userRole.id, permission);
    this.cachePermission(cacheKey, hasPermission);
    return hasPermission;
  }

  async hasProjectPermission(
    userId: string,
    projectId: string,
    permission: string
  ): Promise<boolean> {
    const cacheKey = `${userId}:${projectId}:${permission}`;
    const cached = this.permissionCache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    // Get user's project membership
    const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);

    if (!membership) {
      this.cachePermission(cacheKey, false);
      return false;
    }

    // Map project role to permissions
    const rolePermissions = PROJECT_ROLE_PERMISSIONS[membership.role] || [];
    const hasPermission = rolePermissions.includes(permission);

    this.cachePermission(cacheKey, hasPermission);
    return hasPermission;
  }

  async isOwner(userId: string, ownerField: string, entityTable: string, entityId: string): Promise<boolean> {
    const result: any[] = await prisma.$queryRawUnsafe(
      `SELECT "${ownerField}" FROM "${entityTable}" WHERE id = $1 LIMIT 1`,
      entityId
    );
    return result.length > 0 && result[0][ownerField] === userId;
  }

  private cachePermission(key: string, value: boolean): void {
    this.permissionCache.set(key, {
      value,
      expires: Date.now() + this.CACHE_TTL,
    });
  }

  clearUserCache(userId: string): void {
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.permissionCache.delete(key);
      }
    }
  }

  // Clear all permission cache entries (administrative)
  clearAllCache(): void {
    this.permissionCache.clear();
  }

  // Role management
  async getAllRoles() {
    return this.rbacRepository.getAllRoles();
  }

  async getRolesForHrmsManagement(currentUserId: string) {
    const actorRole = await this.rbacRepository.getUserRole(currentUserId);
    if (!actorRole) {
      throw ApiError.unauthorized('User role not found');
    }

    // Core HRMS org roles only — no global job-title roles
    const manageableRoleNames: string[] =
      actorRole.name === 'admin'
        ? ['hr', 'manager', 'employee']
        : actorRole.name === 'hr'
          ? ['manager', 'employee']
          : [];

    if (manageableRoleNames.length === 0) return [];

    const allRoles = await this.rbacRepository.getAllRoles();

    // System roles (hr, manager, employee) + HRMS-created custom roles
    const systemMatches = allRoles.filter((role) => manageableRoleNames.includes(role.name));
    const hrmsCustomRoles = allRoles.filter((role) => !role.is_system && role.app === 'hrms');

    return [...systemMatches, ...hrmsCustomRoles];
  }

  async getRolesForHrmsPlatform(currentUserId: string, includeCustom: boolean = false) {
    const actorRole = await this.rbacRepository.getUserRole(currentUserId);
    if (!actorRole) {
      throw ApiError.unauthorized('User role not found');
    }

    const allRoles = await this.rbacRepository.getAllRoles();

    // Default HRMS roles = all system roles (they are all global now)
    const defaultRoles = allRoles.filter((role) => role.is_system);

    if (!includeCustom) {
      return defaultRoles;
    }

    // Non-admin users see only system roles
    if (actorRole.name !== 'admin') {
      return defaultRoles;
    }

    // Custom roles: include only HRMS-created (app === 'hrms') or legacy untagged (app === null)
    const customRoles = allRoles.filter((role) => !role.is_system && role.app !== 'pmt');
    return [...defaultRoles, ...customRoles];
  }

  private resolveRoleScope(
    targetRoleName: string,
    explicitScope?: 'hrms' | 'pmt'
  ): 'hrms' | 'pmt' {
    if (explicitScope) return explicitScope;
    // If it's an HRMS-only role name, default to hrms scope; otherwise pmt
    return HRMS_ONLY_ROLE_NAMES.has(targetRoleName) ? 'hrms' : 'pmt';
  }

  async getRolesForPmtPlatform(includeCustom: boolean = true) {
    const allRoles = await this.rbacRepository.getAllRoles();

    // PMT system roles = all global roles EXCEPT HRMS-only ones
    const pmtSystemRoles = allRoles.filter(
      (role) => role.is_system && !HRMS_ONLY_ROLE_NAMES.has(role.name)
    );

    if (!includeCustom) return pmtSystemRoles;

    // Custom roles: include only PMT-created (app === 'pmt') or legacy untagged (app === null)
    // Exclude roles explicitly tagged as HRMS-only
    const customRoles = allRoles.filter(
      (role) => !role.is_system && role.app !== 'hrms'
    );

    return [...pmtSystemRoles, ...customRoles];
  }

  async getRoleById(roleId: string) {
    const role = await this.rbacRepository.getRoleById(roleId);
    if (!role) {
      throw ApiError.notFound('Role not found');
    }
    return role;
  }

  async getUserRole(userId: string) {
    return this.rbacRepository.getUserRole(userId);
  }

  async assignRole(
    userId: string,
    roleId: string,
    assignedBy: string,
    metadata?: any,
    scope?: 'hrms' | 'pmt'
  ) {
    // Get old role for audit
    const oldRole = await this.rbacRepository.getUserRole(userId);

    // Verify role exists
    const newRole = await this.rbacRepository.getRoleById(roleId);
    if (!newRole) {
      throw ApiError.notFound('Role not found');
    }

    const resolvedScope = this.resolveRoleScope(newRole.name, scope);

    if (resolvedScope === 'hrms') {
      // Assign global HRMS role
      await this.rbacRepository.assignRoleToUser(userId, roleId);
    } else {
      // Assign PMT-scoped role without touching global HRMS role
      if (HRMS_ONLY_ROLE_NAMES.has(newRole.name)) {
        throw ApiError.badRequest('HRMS role cannot be assigned in PMT scope');
      }
      await this.rbacRepository.setScopedRoleForUser(userId, 'pmt', roleId, assignedBy);
    }

    // Clear permission cache
    this.clearUserCache(userId);

    // Create audit log
    await this.auditLogRepository.create({
      userId: assignedBy,
      action: resolvedScope === 'pmt' ? 'pmt_role_assigned' : 'role_assigned',
      entityType: 'user',
      entityId: userId,
      oldValues: oldRole ? { roleId: oldRole.id, roleName: oldRole.name } : null,
      newValues: { roleId: newRole.id, roleName: newRole.name, scope: resolvedScope },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      metadata: { ...(metadata || {}), scope: resolvedScope },
    });

    return {
      success: true,
      message:
        resolvedScope === 'pmt'
          ? `PMT role ${newRole.display_name} assigned successfully`
          : `Role ${newRole.display_name} assigned successfully`,
    };
  }

  async removeRole(userId: string, removedBy: string, scope: 'hrms' | 'pmt' = 'hrms') {
    const oldRole = await this.rbacRepository.getUserRole(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, deletedAt: true },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (scope === 'pmt') {
      await this.rbacRepository.clearScopedRoleForUser(userId, 'pmt');
      this.clearUserCache(userId);
      await this.auditLogRepository.create({
        userId: removedBy,
        action: 'pmt_role_removed',
        entityType: 'user',
        entityId: userId,
        metadata: { scope: 'pmt' },
      });

      return { success: true, message: 'PMT role removed successfully' };
    }

    // Prevent orphaning active users. Frontend should use assign-role flow for role changes.
    if (user.isActive && !user.deletedAt) {
      throw ApiError.badRequest(
        'Cannot remove role from an active user. Assign a replacement role instead.',
        'ROLE_REMOVAL_NOT_ALLOWED'
      );
    }

    // System roles should never be directly removed from a user.
    if (oldRole?.is_system) {
      throw ApiError.forbidden(
        'Cannot remove a system role directly. Assign another role or deactivate user first.',
        'SYSTEM_ROLE_REMOVAL_FORBIDDEN'
      );
    }

    await this.rbacRepository.removeRoleFromUser(userId);
    this.clearUserCache(userId);

    await this.auditLogRepository.create({
      userId: removedBy,
      action: 'role_removed',
      entityType: 'user',
      entityId: userId,
      oldValues: oldRole ? { roleId: oldRole.id, roleName: oldRole.name } : null,
    });

    return { success: true, message: 'Role removed successfully' };
  }

  // Custom Role Management
  async createRole(input: CreateRoleInput, createdBy: string) {
    // Check if role name already exists
    const existingRole = await this.rbacRepository.getRoleByName(input.name);
    if (existingRole) {
      throw ApiError.conflict('Role with this name already exists', 'ROLE_NAME_EXISTS');
    }

    // Ensure custom roles are always tagged with the creating app
    if (!input.app) {
      throw ApiError.badRequest('The app context (hrms or pmt) must be specified when creating a custom role');
    }

    const role = await this.rbacRepository.createRole(input);

    // Create audit log
    await this.auditLogRepository.create({
      userId: createdBy,
      action: 'role_created',
      entityType: 'role',
      entityId: role.id,
      newValues: { name: role.name, displayName: role.display_name },
    });

    return role;
  }

  async updateRole(roleId: string, input: UpdateRoleInput, updatedBy: string) {
    const existingRole = await this.rbacRepository.getRoleById(roleId);
    if (!existingRole) {
      throw ApiError.notFound('Role not found');
    }

    if (existingRole.is_system) {
      throw ApiError.forbidden('Cannot modify system roles');
    }

    const role = await this.rbacRepository.updateRole(roleId, input);
    if (!role) {
      throw ApiError.badRequest('Failed to update role');
    }

    // Create audit log
    await this.auditLogRepository.create({
      userId: updatedBy,
      action: 'role_updated',
      entityType: 'role',
      entityId: roleId,
      oldValues: { displayName: existingRole.display_name, description: existingRole.description },
      newValues: { displayName: role.display_name, description: role.description },
    });

    return role;
  }

  async deleteRole(roleId: string, deletedBy: string) {
    const existingRole = await this.rbacRepository.getRoleById(roleId);
    if (!existingRole) {
      throw ApiError.notFound('Role not found');
    }

    if (existingRole.is_system) {
      throw ApiError.forbidden('Cannot delete system roles');
    }

    const userCount = await this.rbacRepository.getUserCountByRole(roleId);
    if (userCount > 0) {
      throw ApiError.badRequest(`Cannot delete role. ${userCount} user(s) are assigned to this role.`);
    }

    const deleted = await this.rbacRepository.deleteRole(roleId);
    if (!deleted) {
      throw ApiError.badRequest('Failed to delete role');
    }

    // Create audit log
    await this.auditLogRepository.create({
      userId: deletedBy,
      action: 'role_deleted',
      entityType: 'role',
      entityId: roleId,
      oldValues: { name: existingRole.name, displayName: existingRole.display_name },
    });

    return { success: true, message: 'Role deleted successfully' };
  }

  async setRolePermissions(roleId: string, permissionIds: string[], updatedBy: string) {
    const role = await this.rbacRepository.getRoleById(roleId);
    if (!role) {
      throw ApiError.notFound('Role not found');
    }
    await this.assertCanModifyHrmsRolePermissions(updatedBy, role);

    // Validate all permission IDs exist
    for (const permissionId of permissionIds) {
      const permission = await this.rbacRepository.getPermissionById(permissionId);
      if (!permission) {
        throw ApiError.badRequest(`Permission not found: ${permissionId}`);
      }
    }

    // Get old permissions for audit
    const oldPermissions = await this.rbacRepository.getRolePermissions(roleId);
    const oldPermissionIds = oldPermissions.map((p) => p.id);

    await this.rbacRepository.setRolePermissions(roleId, permissionIds);

    // Clear permission cache for all users since role permissions changed
    this.clearAllCache();

    // Create audit log
    await this.auditLogRepository.create({
      userId: updatedBy,
      action: 'role_permissions_updated',
      entityType: 'role',
      entityId: roleId,
      oldValues: { permissionIds: oldPermissionIds },
      newValues: { permissionIds },
    });

    return { success: true, message: 'Permissions updated successfully' };
  }

  async addPermissionToRole(roleId: string, permissionId: string, addedBy: string) {
    const role = await this.rbacRepository.getRoleById(roleId);
    if (!role) {
      throw ApiError.notFound('Role not found');
    }
    await this.assertCanModifyHrmsRolePermissions(addedBy, role);

    const permission = await this.rbacRepository.getPermissionById(permissionId);
    if (!permission) {
      throw ApiError.notFound('Permission not found');
    }

    await this.rbacRepository.addPermissionToRole(roleId, permissionId);

    await this.auditLogRepository.create({
      userId: addedBy,
      action: 'permission_added_to_role',
      entityType: 'role',
      entityId: roleId,
      newValues: { permissionId, permissionName: permission.name },
    });

    return { success: true, message: 'Permission added successfully' };
  }

  async removePermissionFromRole(roleId: string, permissionId: string, removedBy: string) {
    const role = await this.rbacRepository.getRoleById(roleId);
    if (!role) {
      throw ApiError.notFound('Role not found');
    }
    await this.assertCanModifyHrmsRolePermissions(removedBy, role);

    const permission = await this.rbacRepository.getPermissionById(permissionId);
    const removed = await this.rbacRepository.removePermissionFromRole(roleId, permissionId);

    if (removed) {
      await this.auditLogRepository.create({
        userId: removedBy,
        action: 'permission_removed_from_role',
        entityType: 'role',
        entityId: roleId,
        oldValues: { permissionId, permissionName: permission?.name },
      });
    }

    return { success: true, message: 'Permission removed successfully' };
  }

  private async assertCanModifyHrmsRolePermissions(actorUserId: string, targetRole: { name: string }) {
    // Rules:
    // - hr role permissions       => admin only
    // - manager / employee        => admin / hr
    // - custom (non-system) roles => admin only
    const actorRole = await this.rbacRepository.getUserRole(actorUserId);
    if (!actorRole) {
      throw ApiError.unauthorized('User role not found');
    }

    const isAdminActor = actorRole.name === 'admin';
    const isHrActor = actorRole.name === 'hr';
    const target = targetRole.name;

    if (target === 'hr' && !isAdminActor) {
      throw ApiError.forbidden('Only admin can modify HR role permissions', 'HR_ROLE_PERMISSION_ADMIN_ONLY');
    }

    const hrManagedRoles = ['manager', 'employee', ...GLOBAL_JOB_ROLES.map((r) => r.name)];
    if (hrManagedRoles.includes(target) && !(isAdminActor || isHrActor)) {
      throw ApiError.forbidden(
        'Only admin or HR can modify permissions for this role',
        'ROLE_PERMISSION_RESTRICTED'
      );
    }

    if (!hrManagedRoles.includes(target) && target !== 'hr' && !isAdminActor) {
      throw ApiError.forbidden(
        'Only admin can modify permissions for this role',
        'ROLE_PERMISSION_ADMIN_ONLY'
      );
    }
  }

  // Permission queries
  async getAllPermissions(scope: 'all' | 'hrms' | 'pmt' = 'all') {
    return this.rbacRepository.getAllPermissions(scope);
  }

  async getRolePermissions(roleId: string, scope: 'all' | 'hrms' | 'pmt' = 'all') {
    return this.rbacRepository.getRolePermissions(roleId, scope);
  }

  async getUserPermissions(userId: string) {
    return this.rbacRepository.getUserPermissions(userId);
  }

  async getUserDirectPermissions(userId: string) {
    return this.rbacRepository.getUserDirectPermissions(userId);
  }

  async setUserDirectPermissions(userId: string, permissionIds: string[], grantedBy: string) {
    await this.rbacRepository.setUserDirectPermissions(userId, permissionIds, grantedBy);
    this.clearUserCache(userId);
  }

  async getCurrentUserPermissions(userId: string, projectId?: string): Promise<{
    permissions: string[];
    projectPermissions: string[];
    projectRole: string | null;
  }> {
    const [rolePermNames, directPerms] = await Promise.all([
      this.rbacRepository.getUserPermissions(userId),
      this.rbacRepository.getUserDirectPermissions(userId),
    ]);
    const directPermNames = directPerms.map((up) => up.permission.name);
    const systemPermissions = new Set([...rolePermNames, ...directPermNames]);
    const pmtScopedRole = await this.rbacRepository.getScopedRoleForUser(userId, 'pmt');

    if (pmtScopedRole) {
      // Role/user management permissions must come from the global role only (real admin).
      // A user assigned the Administrator role via PMT scope should not be able to
      // manage roles or modify permissions – only the global admin can do that.
      const PMT_SCOPE_EXCLUDED_PERMISSIONS = new Set([
        'users.manage_roles',
        'roles.create',
        'roles.update',
        'roles.delete',
      ]);
      const pmtRolePermissions = await this.rbacRepository.getRolePermissions(pmtScopedRole.id, 'pmt');
      pmtRolePermissions
        .filter((p) => !PMT_SCOPE_EXCLUDED_PERMISSIONS.has(p.name))
        .forEach((permission) => systemPermissions.add(permission.name));
    }

    const projectPermissions = new Set<string>();
    let projectRole: string | null = null;

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
        },
        select: {
          ownerId: true,
          leadId: true,
        },
      });

      if (project) {
        const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);

        if (membership?.role) {
          projectRole = membership.role;
        } else if (project.ownerId === userId) {
          projectRole = 'admin';
        } else if (project.leadId === userId) {
          projectRole = 'lead';
        }

        if (projectRole) {
          const rolePermissions = PROJECT_ROLE_PERMISSIONS[projectRole] || [];
          rolePermissions.forEach((permission) => projectPermissions.add(permission));
        }
      }
    } else {
      const [memberships, projectOwnerships] = await Promise.all([
        prisma.projectMember.findMany({
          where: {
            userId,
            project: {
              deletedAt: null,
            },
          },
          select: {
            role: true,
          },
        }),
        prisma.project.findMany({
          where: {
            deletedAt: null,
            OR: [
              { ownerId: userId },
              { leadId: userId },
            ],
          },
          select: {
            ownerId: true,
            leadId: true,
          },
        }),
      ]);

      memberships.forEach((membership) => {
        const rolePermissions = PROJECT_ROLE_PERMISSIONS[membership.role] || [];
        rolePermissions.forEach((permission) => projectPermissions.add(permission));
      });

      projectOwnerships.forEach((project) => {
        if (project.ownerId === userId) {
          const ownerPermissions = PROJECT_ROLE_PERMISSIONS.admin || [];
          ownerPermissions.forEach((permission) => projectPermissions.add(permission));
        } else if (project.leadId === userId) {
          const leadPermissions = PROJECT_ROLE_PERMISSIONS.lead || [];
          leadPermissions.forEach((permission) => projectPermissions.add(permission));
        }
      });
    }

    const permissions = Array.from(new Set([...Array.from(systemPermissions), ...projectPermissions]));

    return {
      permissions,
      projectPermissions: Array.from(projectPermissions),
      projectRole,
    };
  }

  // User management for admin
  async getUsersWithRoles(filters: {
    search?: string;
    roleId?: string;
    page?: number;
    limit?: number;
    scope?: 'all' | 'hrms' | 'pmt';
  }) {
    return this.rbacRepository.getUsersWithRoles(filters);
  }

  // Audit logs
  async getAuditLogs(filters: AuditLogFilters) {
    return this.auditLogRepository.findAll(filters);
  }

  async createAuditLog(input: CreateAuditLogInput) {
    return this.auditLogRepository.create(input);
  }

  async getAuditLogFilters(app?: 'pmt') {
    const [actions, entityTypes] = await Promise.all([
      this.auditLogRepository.getDistinctActions(app),
      this.auditLogRepository.getDistinctEntityTypes(app),
    ]);
    return { actions, entityTypes };
  }
}
