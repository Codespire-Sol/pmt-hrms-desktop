import bcrypt from 'bcryptjs';
import { prisma } from '../database/prisma';
import { logger } from '../utils/logger';
import { config } from '../config';
import { PROJECT_ROLE_PERMISSIONS } from '../modules/rbac/rbac.types';
import {
  HRMS_PERMISSIONS,
  HRMS_ROLE_PERMISSIONS,
  HRMS_SYSTEM_ROLES,
  PMT_PERMISSIONS,
  PMT_ROLE_PERMISSIONS,
  PermissionSeed,
  RoleSeed,
} from '../modules/rbac/hrms-rbac.seed';

function toDisplayName(name: string): string {
  return name.replace(/\./g, ' ').replace(/(^|\s)\S/g, s => s.toUpperCase());
}

function toPermissionSeed(name: string, description: string): PermissionSeed {
  const [resource, ...actionParts] = name.split('.');
  return {
    name,
    displayName: toDisplayName(name),
    description,
    resource,
    action: actionParts.join('.'),
    app: 'pmt',
  };
}

async function ensureRole(roleSeed: RoleSeed) {
  let role = await prisma.role.findFirst({ where: { name: roleSeed.name } });
  if (!role) {
    role = await prisma.role.create({
      data: {
        name: roleSeed.name,
        displayName: roleSeed.displayName,
        description: roleSeed.description,
        isSystem: roleSeed.isSystem,
        level: roleSeed.level,
      },
    });
    logger.info(`Created system role: ${roleSeed.name} (${role.id})`);
  } else {
    // Keep role definitions aligned with HRMS system role seed.
    const needsUpdate =
      role.displayName !== roleSeed.displayName ||
      role.description !== roleSeed.description ||
      role.isSystem !== roleSeed.isSystem ||
      role.level !== roleSeed.level;

    if (needsUpdate) {
      role = await prisma.role.update({
        where: { id: role.id },
        data: {
          displayName: roleSeed.displayName,
          description: roleSeed.description,
          isSystem: roleSeed.isSystem,
          level: roleSeed.level,
        },
      });
      logger.info(`Updated system role definition: ${roleSeed.name} (${role.id})`);
    }
  }
  return role;
}

async function ensurePermission(permissionSeed: PermissionSeed) {
  let permission = await prisma.permission.findFirst({
    where: { name: permissionSeed.name },
  });

  if (!permission) {
    permission = await prisma.permission.create({
      data: {
        name: permissionSeed.name,
        displayName: permissionSeed.displayName,
        description: permissionSeed.description,
        resource: permissionSeed.resource,
        action: permissionSeed.action,
        app: permissionSeed.app,
      },
    });
    logger.info(`Created permission: ${permissionSeed.name}`);
  }

  return permission;
}

async function assignPermissionsToRole(roleId: string, permissionNames: string[]) {
  for (const permissionName of permissionNames) {
    const permission = await prisma.permission.findFirst({
      where: { name: permissionName },
    });
    if (!permission) continue;

    const existing = await prisma.rolePermission.findFirst({
      where: {
        roleId,
        permissionId: permission.id,
      },
    });

    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          roleId,
          permissionId: permission.id,
        },
      });
    }
  }
}

export async function ensureAdminUser(): Promise<void> {
  // Ensure all system roles and permissions exist in the local DB.
  // User accounts are NOT seeded — Keycloak is the sole source of truth for users.
  const ensuredRoles = await Promise.all(HRMS_SYSTEM_ROLES.map(ensureRole));
  const roleByName = new Map(ensuredRoles.map(role => [role.name, role]));
  const adminRole = roleByName.get('admin');
  if (!adminRole) {
    throw new Error('Failed to initialize admin role');
  }

  const toolkitPermissionNames = new Set<string>();
  for (const rolePermissions of Object.values(PROJECT_ROLE_PERMISSIONS)) {
    for (const permissionName of rolePermissions) {
      toolkitPermissionNames.add(permissionName);
    }
  }

  const toolkitPermissionSeeds: PermissionSeed[] = [...toolkitPermissionNames].map(permissionName =>
    toPermissionSeed(permissionName, 'Project toolkit permission (auto-created by startup seed)')
  );

  const allPermissionSeeds: PermissionSeed[] = [...HRMS_PERMISSIONS, ...PMT_PERMISSIONS, ...toolkitPermissionSeeds];

  for (const permissionSeed of allPermissionSeeds) {
    await ensurePermission(permissionSeed);
  }

  for (const [roleName, permissionNames] of Object.entries(HRMS_ROLE_PERMISSIONS)) {
    const role = roleByName.get(roleName);
    if (!role) continue;
    await assignPermissionsToRole(role.id, permissionNames);
  }

  for (const [roleName, permissionNames] of Object.entries(PMT_ROLE_PERMISSIONS)) {
    const role = roleByName.get(roleName);
    if (!role) continue;
    await assignPermissionsToRole(role.id, permissionNames);
  }

  // Ensure admin role has every permission in the system.
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    const existingRp = await prisma.rolePermission.findFirst({
      where: { roleId: adminRole.id, permissionId: perm.id },
    });
    if (!existingRp) {
      await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: perm.id } });
      logger.info(`Assigned ${perm.name} to admin role (all-perms)`);
    }
  }

  // In JWT mode, Keycloak is not the source of truth. Seed a default admin
  // user ONLY when BOTH ADMIN_EMAIL and ADMIN_PASSWORD are explicitly provided
  // via env AND no admin exists yet. When they are absent (e.g. the Electron
  // desktop app stops passing them), NO admin is seeded — so the host-only
  // /auth/local/status endpoint reports hasAdmin:false and the desktop app can
  // show its "create admin" screen instead.
  const seedEnvProvided = Boolean(process.env.ADMIN_EMAIL) && Boolean(process.env.ADMIN_PASSWORD);
  const anyAdmin = await prisma.user.findFirst({
    where: { deletedAt: null, isActive: true, role: { is: { name: 'admin' } } },
    select: { id: true },
  });
  if (config.auth.mode === 'jwt' && seedEnvProvided && !anyAdmin) {
    const existing = await prisma.user.findFirst({ where: { email: config.auth.adminEmail } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(config.auth.adminPassword, 10);
      await prisma.user.create({
        data: {
          email: config.auth.adminEmail,
          passwordHash,
          firstName: 'Admin',
          lastName: 'User',
          isActive: true,
          isVerified: true,
          roleId: adminRole.id,
        },
      });
      logger.info(`✅ Seeded default admin user (jwt mode): ${config.auth.adminEmail}`);
      logger.warn('⚠️  Change the default admin password (ADMIN_PASSWORD) before production use.');
    } else if (existing.roleId !== adminRole.id) {
      await prisma.user.update({ where: { id: existing.id }, data: { roleId: adminRole.id } });
    }
  }

  logger.info(
    config.auth.mode === 'jwt'
      ? '✅ System roles and permissions seeded. Local JWT auth enabled.'
      : '✅ System roles and permissions seeded. User accounts managed by Keycloak.'
  );
}
