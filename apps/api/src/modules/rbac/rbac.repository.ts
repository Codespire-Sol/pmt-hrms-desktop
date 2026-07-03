import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import { Role, Permission, AuditLog, AuditLogWithUser, CreateAuditLogInput, AuditLogFilters, CreateRoleInput, UpdateRoleInput } from './rbac.types';
import { HRMS_PERMISSION_NAME_SET, HRMS_RESOURCE_NAMES, HRMS_SYSTEM_ROLES } from './hrms-rbac.seed';

type PermissionScope = 'all' | 'hrms' | 'pmt';
type RoleScope = 'hrms' | 'pmt';
type UserRoleListScope = 'all' | 'hrms' | 'pmt';

// ── Helper mappers: Prisma camelCase → snake_case interfaces ──

function mapRole(r: any): Role {
  return {
    id: r.id,
    name: r.name,
    display_name: r.displayName,
    description: r.description,
    is_system: r.isSystem,
    level: r.level,
    app: (r.app as 'hrms' | 'pmt' | null) ?? null,
    created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    updated_at: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
  };
}

function mapPermission(p: any): Permission {
  const categoryMap: Record<string, string> = {
    admin: 'System Administration',
    users: 'System Administration',
    roles: 'System Administration',
    permissions: 'System Administration',
    auth: 'Authentication & Authorization',
    employees: 'Employee Directory Management',
    onboarding: 'Onboarding Management',
    offboarding: 'Offboarding Management',
    attendance: 'Attendance Management',
    leave: 'Leave Management',
    holidays: 'Holiday Management',
    payroll: 'Payroll Management',
    org: 'Organization Hierarchy',
    profiles: 'Employee Profile Management',
    approvals: 'Approval & Workflow System',
    projects: 'Project Management',
    issues: 'Issue Management',
    members: 'Team Management',
    ai: 'AI Features',
    integrations: 'Integrations',
  };

  const resource = p.resource || '';
  const category =
    categoryMap[resource] ||
    resource
      .split(/[_\-.]/g)
      .filter(Boolean)
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  // Resolve app: trust explicit 'hrms'/'global' values from the DB.
  // For 'pmt' (the column default) re-classify by resource name or permission
  // name set so that HRMS permissions seeded before/after the tagging migration
  // are never exposed in the PMT context.
  const appValue: 'hrms' | 'pmt' | 'global' =
    p.app === 'hrms' || p.app === 'global'
      ? p.app
      : HRMS_RESOURCE_NAMES.has(resource) || HRMS_PERMISSION_NAME_SET.has(p.name)
        ? 'hrms'
        : 'pmt';

  return {
    id: p.id,
    name: p.name,
    display_name: p.displayName,
    description: p.description,
    category,
    resource: p.resource,
    action: p.action,
    app: appValue,
    created_at: p.createdAt instanceof Date ? p.createdAt.toISOString() : (p.createdAt ?? ''),
  };
}

/**
 * Filter permissions by application context using the `app` DB column.
 * - 'hrms' → returns hrms + global permissions
 * - 'pmt'  → returns pmt + global permissions
 * - 'all'  → returns everything
 */
function filterPermissionsByScope(permissions: Permission[], scope: PermissionScope): Permission[] {
  if (scope === 'all') return permissions;
  if (scope === 'hrms') return permissions.filter((p) => p.app === 'hrms' || p.app === 'global');
  // scope === 'pmt'
  return permissions.filter((p) => p.app === 'pmt' || p.app === 'global');
}

function mapAuditLog(al: any): AuditLog {
  return {
    id: al.id,
    user_id: al.userId,
    action: al.action,
    entity_type: al.entityType,
    entity_id: al.entityId,
    old_values: al.oldValues as Record<string, any> | null,
    new_values: al.newValues as Record<string, any> | null,
    ip_address: al.ipAddress,
    user_agent: al.userAgent,
    metadata: (al.metadata as Record<string, any>) ?? {},
    created_at: al.createdAt instanceof Date ? al.createdAt.toISOString() : al.createdAt,
  };
}

function mapAuditLogWithUser(al: any): AuditLogWithUser {
  const base = mapAuditLog(al);
  const result: AuditLogWithUser = { ...base };
  if (al.user) {
    result.user = {
      id: al.user.id,
      displayName: `${al.user.firstName} ${al.user.lastName}`,
      email: al.user.email,
    };
  }
  return result;
}

export class RbacRepository {
  private getScopedRoleSettingKey(userId: string, scope: RoleScope): string {
    return `user_role:${scope}:${userId}`;
  }

  // Role methods
  async getAllRoles(): Promise<Role[]> {
    const roles = await prisma.role.findMany({ orderBy: { level: 'desc' } });
    return roles.map(mapRole);
  }

  async getRoleById(id: string): Promise<Role | null> {
    const role = await prisma.role.findUnique({ where: { id } });
    return role ? mapRole(role) : null;
  }

  async getRoleByName(name: string): Promise<Role | null> {
    const role = await prisma.role.findUnique({ where: { name } });
    return role ? mapRole(role) : null;
  }

  async getUserRole(userId: string): Promise<Role | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user?.role) return null;
    return mapRole(user.role);
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { roleId },
    });
  }

  async removeRoleFromUser(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { roleId: null },
    });
  }

  async setScopedRoleForUser(
    userId: string,
    scope: RoleScope,
    roleId: string,
    updatedBy?: string
  ): Promise<void> {
    const settingKey = this.getScopedRoleSettingKey(userId, scope);
    const settingValue = JSON.stringify({ roleId });
    const description = `Scoped role assignment for ${scope.toUpperCase()} user ${userId}`;

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO system_settings (id, setting_key, setting_value, description, updated_by, created_at, updated_at)
      VALUES (uuid_generate_v4(), $1, $2::jsonb, $3, $4, NOW(), NOW())
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      `,
      settingKey,
      settingValue,
      description,
      updatedBy || null
    );
  }

  async clearScopedRoleForUser(userId: string, scope: RoleScope): Promise<void> {
    const settingKey = this.getScopedRoleSettingKey(userId, scope);
    await prisma.$executeRawUnsafe(
      `DELETE FROM system_settings WHERE setting_key = $1`,
      settingKey
    );
  }

  async getScopedRoleForUser(userId: string, scope: RoleScope): Promise<Role | null> {
    const settingKey = this.getScopedRoleSettingKey(userId, scope);
    const rows = await prisma.$queryRawUnsafe<Array<{ setting_value: any }>>(
      `SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      settingKey
    );
    const setting = rows[0];

    if (!setting) {
      return null;
    }

    const settingValue =
      typeof setting.setting_value === 'string'
        ? JSON.parse(setting.setting_value)
        : (setting.setting_value as Record<string, unknown> | null);
    const roleId = typeof settingValue?.roleId === 'string' ? settingValue.roleId : null;

    if (!roleId) {
      return null;
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    return role ? mapRole(role) : null;
  }

  // Custom Role CRUD
  async createRole(input: CreateRoleInput): Promise<Role> {
    const role = await prisma.role.create({
      data: {
        name: input.name,
        displayName: input.displayName,
        description: input.description,
        level: input.level || 10,
        isSystem: false,
        app: input.app ?? null,
      },
    });
    return mapRole(role);
  }

  async updateRole(roleId: string, input: UpdateRoleInput): Promise<Role> {
    const updateData: Prisma.RoleUpdateInput = { updatedAt: new Date() };
    if (input.displayName !== undefined) updateData.displayName = input.displayName;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.level !== undefined) updateData.level = input.level;

    const role = await prisma.role.update({
      where: { id: roleId, isSystem: false },
      data: updateData,
    });
    return mapRole(role);
  }

  async deleteRole(roleId: string): Promise<boolean> {
    // Check if any users are assigned to this role
    const usersWithRole = await prisma.user.count({ where: { roleId } });
    if (usersWithRole > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }

    try {
      await prisma.role.delete({
        where: { id: roleId, isSystem: false },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getUserCountByRole(roleId: string): Promise<number> {
    const directCount = await prisma.user.count({ where: { roleId } });
    if (directCount > 0) return directCount;

    // Also check PMT-scoped assignments stored in system_settings
    const pmtRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT COUNT(*) as count
       FROM system_settings
       WHERE setting_key LIKE 'user_role:pmt:%'
         AND (setting_value->>'roleId') = $1`,
      roleId
    );
    return directCount + parseInt(pmtRows[0]?.count ?? '0', 10);
  }

  // Permission management for roles
  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Delete existing permissions
      await tx.rolePermission.deleteMany({ where: { roleId } });

      // Insert new permissions
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }
    });
  }

  async addPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    try {
      await prisma.rolePermission.create({
        data: { roleId, permissionId },
      });
    } catch (e: any) {
      // Ignore unique constraint violation (P2002)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return;
      }
      throw e;
    }
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    const result = await prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });
    return result.count > 0;
  }

  async getPermissionById(permissionId: string): Promise<Permission | null> {
    const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
    return permission ? mapPermission(permission) : null;
  }

  // Permission methods
  async getAllPermissions(scope: PermissionScope = 'all'): Promise<Permission[]> {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
    const mapped = permissions.map(mapPermission);
    return filterPermissionsByScope(mapped, scope);
  }

  async getPermissionByName(name: string): Promise<Permission | null> {
    const permission = await prisma.permission.findUnique({ where: { name } });
    return permission ? mapPermission(permission) : null;
  }

  async getRolePermissions(roleId: string, scope: PermissionScope = 'all'): Promise<Permission[]> {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
      orderBy: [
        { permission: { resource: 'asc' } },
        { permission: { action: 'asc' } },
      ],
    });
    const mapped = rolePermissions.map((rp) => mapPermission(rp.permission));
    return filterPermissionsByScope(mapped, scope);
  }

  async roleHasPermission(roleId: string, permissionName: string): Promise<boolean> {
    const result = await prisma.rolePermission.findFirst({
      where: {
        roleId,
        permission: { name: permissionName },
      },
    });
    return !!result;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
    if (!user?.role) return [];
    return user.role.rolePermissions.map((rp) => rp.permission.name);
  }

  async getUserDirectPermissions(userId: string) {
    return prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });
  }

  async setUserDirectPermissions(userId: string, permissionIds: string[], grantedBy: string) {
    await prisma.userPermission.deleteMany({ where: { userId } });
    if (permissionIds.length === 0) return;
    await prisma.userPermission.createMany({
      data: permissionIds.map((permissionId) => ({ userId, permissionId, grantedBy })),
      skipDuplicates: true,
    });
  }

  // Users with roles
  async getUsersWithRoles(filters: {
    search?: string;
    roleId?: string;
    page?: number;
    limit?: number;
    scope?: UserRoleListScope;
  }): Promise<{
    users: any[];
    total: number;
  }> {
    const { search, roleId, page = 1, limit = 50, scope = 'pmt' } = filters;
    const offset = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // For PMT scope with roleId filter: also include users whose PMT-scoped role (in system_settings) matches
    let pmtScopedUserIds: string[] | null = null;
    if (roleId && (scope === 'pmt' || scope === 'all')) {
      const settingRows = await prisma.$queryRawUnsafe<Array<{ setting_key: string; setting_value: any }>>(
        `SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'user_role:pmt:%'`,
      );
      pmtScopedUserIds = settingRows
        .filter((row) => {
          const val = typeof row.setting_value === 'string' ? JSON.parse(row.setting_value) : row.setting_value;
          return val?.roleId === roleId;
        })
        .map((row) => row.setting_key.replace('user_role:pmt:', ''));
    }

    if (roleId) {
      if (pmtScopedUserIds && pmtScopedUserIds.length > 0) {
        // Match users with this global role OR this PMT-scoped role
        where.OR = [
          ...(where.OR || []),
          { roleId },
          { id: { in: pmtScopedUserIds } },
        ];
      } else if (pmtScopedUserIds !== null) {
        // PMT scope filter: only match global role (no PMT-scoped matches found)
        where.roleId = roleId;
      } else {
        where.roleId = roleId;
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { role: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    const globalRoleMap = new Map(
      users
        .filter((u) => u.role)
        .map((u) => [
          u.id,
          {
            id: u.role!.id,
            name: u.role!.name,
            displayName: u.role!.displayName,
            level: u.role!.level,
          },
        ])
    );

    const scopedRoleByUserId = new Map<string, { id: string; name: string; displayName: string; level: number }>();
    if (scope === 'pmt' || scope === 'all') {
      const userIds = users.map((u) => u.id);
      if (userIds.length > 0) {
        const settingKeys = userIds.map((userId) => this.getScopedRoleSettingKey(userId, 'pmt'));

        const scopedRows = await prisma.$queryRawUnsafe<Array<{ setting_key: string; setting_value: any }>>(
          `
          SELECT setting_key, setting_value
          FROM system_settings
          WHERE setting_key IN (${settingKeys.map((_, idx) => `$${idx + 1}`).join(', ')})
          `,
          ...settingKeys
        );

        const scopedRoleIds = scopedRows
          .map((row) => {
            const value =
              typeof row.setting_value === 'string'
                ? JSON.parse(row.setting_value)
                : (row.setting_value as Record<string, unknown> | null);
            return typeof value?.roleId === 'string' ? value.roleId : null;
          })
          .filter((roleId): roleId is string => Boolean(roleId));

        const scopedRoles = scopedRoleIds.length
          ? await prisma.role.findMany({
              where: { id: { in: scopedRoleIds } },
              select: {
                id: true,
                name: true,
                displayName: true,
                level: true,
              },
            })
          : [];
        const scopedRoleMap = new Map(scopedRoles.map((role) => [role.id, role]));

        for (const row of scopedRows) {
          const value =
            typeof row.setting_value === 'string'
              ? JSON.parse(row.setting_value)
              : (row.setting_value as Record<string, unknown> | null);
          const scopedRoleId = typeof value?.roleId === 'string' ? value.roleId : null;
          if (!scopedRoleId) continue;

          const scopedRole = scopedRoleMap.get(scopedRoleId);
          if (!scopedRole) continue;

          const userId = row.setting_key.replace('user_role:pmt:', '');
          scopedRoleByUserId.set(userId, {
            id: scopedRole.id,
            name: scopedRole.name,
            displayName: scopedRole.displayName,
            level: scopedRole.level,
          });
        }
      }
    }

    const hrmsOnlyRoleNames = new Set(
      HRMS_SYSTEM_ROLES
        .map((r) => r.name)
        .filter((name) => name !== 'admin')
    );

    const mappedUsers = users.map((u) => {
      const globalRole = globalRoleMap.get(u.id) || null;
      const scopedRole = scopedRoleByUserId.get(u.id) || null;

      const role =
        scope === 'hrms'
          ? globalRole
          : scope === 'pmt'
          ? (scopedRole ||
              (globalRole && !hrmsOnlyRoleNames.has(globalRole.name) ? globalRole : null))
          : globalRole;

      return {
      id: u.id,
      email: u.email,
      display_name: `${u.firstName} ${u.lastName}`,
      avatar_url: u.avatarUrl,
      is_active: u.isActive,
      is_verified: u.isVerified,
      created_at: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
      role,
      pmt_role: scopedRole,
      hrms_role: globalRole,
    };
    });

    return {
      users: mappedUsers,
      total,
    };
  }
}

export class AuditLogRepository {
  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const log = await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValues: input.oldValues ? (input.oldValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValues: input.newValues ? (input.newValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return mapAuditLog(log);
  }

  async findAll(filters: AuditLogFilters): Promise<{ logs: AuditLogWithUser[]; total: number }> {
    const { userId, action, entityType, entityId, startDate, endDate, page = 1, limit = 50, app } = filters;
    const offset = (page - 1) * limit;

    // Actions logged by the HRMS panel that are not relevant to the PMT audit log
    const HRMS_ONLY_ACTIONS = ['role_assigned', 'role_removed'];

    const where: Prisma.AuditLogWhereInput = {};
    if (userId) where.userId = userId;

    // Exclude HRMS-specific audit actions (prefixed with 'hr.') from the general audit log view.
    // HRMS operations (employee changes, payroll, leave, onboarding) are internal workflow events
    // and should not appear in the system/access-control audit log.
    // When app=pmt, also exclude HRMS-only global role actions.
    if (action) {
      if (action.startsWith('hr.')) {
        return { logs: [], total: 0 };
      }
      if (app === 'pmt' && HRMS_ONLY_ACTIONS.includes(action)) {
        return { logs: [], total: 0 };
      }
      where.action = action;
    } else {
      const actionFilters: Prisma.AuditLogWhereInput[] = [
        { action: { not: { startsWith: 'hr.' } } },
      ];
      if (app === 'pmt') {
        actionFilters.push({ action: { notIn: HRMS_ONLY_ACTIONS } });
      }
      where.AND = actionFilters;
    }

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        // When endDate is a date-only string like '2026-04-14', new Date() gives
        // midnight UTC (start of day). Set to end-of-day so the filter includes
        // all logs created during that day.
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs: logs.map(mapAuditLogWithUser),
      total,
    };
  }

  async getDistinctActions(app?: 'pmt'): Promise<string[]> {
    const HRMS_ONLY_ACTIONS = ['role_assigned', 'role_removed'];
    const actionFilters: Prisma.AuditLogWhereInput[] = [
      { action: { not: { startsWith: 'hr.' } } },
    ];
    if (app === 'pmt') {
      actionFilters.push({ action: { notIn: HRMS_ONLY_ACTIONS } });
    }
    const results = await prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      where: { AND: actionFilters },
      orderBy: { action: 'asc' },
    });
    return results.map((a) => a.action);
  }

  async getDistinctEntityTypes(app?: 'pmt'): Promise<string[]> {
    const HRMS_ONLY_ACTIONS = ['role_assigned', 'role_removed'];
    const actionFilters: Prisma.AuditLogWhereInput[] = [
      { action: { not: { startsWith: 'hr.' } } },
    ];
    if (app === 'pmt') {
      actionFilters.push({ action: { notIn: HRMS_ONLY_ACTIONS } });
    }
    const results = await prisma.auditLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      where: { AND: actionFilters },
      orderBy: { entityType: 'asc' },
    });
    return results.map((t) => t.entityType);
  }
}
