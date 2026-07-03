import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma';
import { ApiError } from '../utils/ApiError';
import { ProjectMemberRole } from '@prisma/client';
import { policyService } from '../services/policy.service';
import { cacheService } from '../services/cache.service';

const RBAC_CACHE_TTL = 60; // Cache role+permissions for 60 seconds

interface CachedUserPermissions {
  roleName: string | null;
  permissions: string[];
}

async function getCachedUserPermissions(userId: string): Promise<CachedUserPermissions | null> {
  const cacheKey = `rbac:user:${userId}`;
  const cached = await cacheService.get<CachedUserPermissions>(cacheKey);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true }
          }
        }
      }
    }
  });

  if (!user) return null;

  const result: CachedUserPermissions = {
    roleName: user.role?.name || null,
    permissions: user.role?.rolePermissions?.map(rp => rp.permission.name) || [],
  };

  await cacheService.set(cacheKey, result, { ttl: RBAC_CACHE_TTL });
  return result;
}

/**
 * Centralized project role -> permission mapping.
 * Single source of truth used by all RBAC checks.
 */
const PROJECT_ROLE_PERMISSIONS: Record<ProjectMemberRole, string[]> = {
  admin: ['projects.manage_members', 'issues.update', 'issues.create', 'issues.update_own'],
  lead: ['issues.update', 'issues.create', 'issues.update_own'],
  member: ['issues.update', 'issues.create', 'issues.update_own'],
  viewer: ['issues.read'],
};

type PermissionCheck =
  | string
  | {
      permission: string;
      projectIdParam?: string;
      checkOwnership?: boolean;
      ownerField?: string;
      entityTable?: string;
      entityIdParam?: string;
    };

/**
 * Middleware to require a specific permission
 *
 * @param check - Permission name or configuration object
 *
 * Usage examples:
 * - requirePermission('users.create') - Simple system permission check
 * - requirePermission({ permission: 'issues.update', projectIdParam: 'projectId' }) - Project permission check
 * - requirePermission({ permission: 'issues.update_own', checkOwnership: true, ownerField: 'reporter_id', entityTable: 'issue', entityIdParam: 'issueId' }) - Ownership check
 */
export function requirePermission(check: PermissionCheck) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const permission = typeof check === 'string' ? check : check.permission;
      const projectIdParam = typeof check === 'object' ? check.projectIdParam : undefined;
      const projectId = projectIdParam ? req.params[projectIdParam] : undefined;

      // Central policy evaluation (feature-flagged with fallback in service)
      const hasPolicyPermission = await policyService.hasPermission({
        userId: req.user.id,
        permission,
        projectId,
      });
      if (hasPolicyPermission) {
        return next();
      }

      // Fetch user with role and permissions (cached)
      const userPerms = await getCachedUserPermissions(req.user.id);

      if (!userPerms) {
        throw ApiError.unauthorized('User not found');
      }
      
      // System admin bypass — admins have access to everything
      const isSystemAdmin = userPerms.roleName === 'admin' || userPerms.permissions.includes('admin.settings');
      if (isSystemAdmin) {
        return next();
      }

      // Check system-level permission first
      const hasSystemPermission = userPerms.permissions.includes(permission);

      if (hasSystemPermission) {
        return next();
      }

      // Check project-level permission if projectId is provided
      if (projectId) {
        const projectMember = await prisma.projectMember.findFirst({
          where: {
            userId: req.user.id,
            projectId: projectId
          },
          include: {
            project: true
          }
        });

        if (projectMember) {
          const rolePermissions = PROJECT_ROLE_PERMISSIONS[projectMember.role] || [];
          const hasProjectPermission = rolePermissions.includes(permission);

          if (hasProjectPermission) {
            return next();
          }
        }
      }

      // Check ownership if enabled
      if (typeof check === 'object' && check.checkOwnership) {
        const entityIdParam = check.entityIdParam || 'id';
        const entityId = req.params[entityIdParam];
        const entityTable = check.entityTable || 'issue';
        const ownerField = check.ownerField || 'reporter_id';

        if (entityId) {
          const delegate = (prisma as any)[entityTable];
          if (!delegate || typeof delegate.findUnique !== 'function') {
            throw ApiError.badRequest('Invalid entity table');
          }

          const entity = await delegate.findUnique({
            where: { id: entityId },
            select: { [ownerField]: true }
          }) as any;

          if (entity && entity[ownerField] === req.user.id) {
            return next();
          }
        }
      }

      throw ApiError.forbidden('Insufficient permissions');
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to require any of the provided permissions (system-level)
 */
export function requireAnyPermission(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const policyResults = await Promise.all(
        permissions.map((permission) =>
          policyService.hasPermission({
            userId: req.user!.id,
            permission,
          })
        )
      );
      if (policyResults.some(Boolean)) {
        return next();
      }

      const userPerms = await getCachedUserPermissions(req.user.id);

      if (!userPerms) {
        throw ApiError.unauthorized('User not found');
      }

      const hasAnyPermission = permissions.some(permission =>
        userPerms.permissions.includes(permission)
      );

      if (hasAnyPermission) {
        return next();
      }

      throw ApiError.forbidden('Insufficient permissions');
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require admin role (shortcut)
 */
export const requireAdmin = requirePermission('admin.settings');

/**
 * Check if user is admin (system admin) - allows access to all routes
 */
export function requireSystemAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const userPerms = await getCachedUserPermissions(req.user.id);

      if (!userPerms) {
        throw ApiError.unauthorized('User not found');
      }

      const isAdminRole = userPerms.roleName === 'admin';
      const hasAdminPermission = userPerms.permissions.includes('admin.settings');

      if (hasAdminPermission || isAdminRole) {
        return next();
      }

      throw ApiError.forbidden('Admin access required');
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require admin OR project admin for project-specific routes
 */
export function requireAdminOrProjectAdmin(projectIdParam = 'projectId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      // First check if user is system admin (cached)
      const userPerms = await getCachedUserPermissions(req.user.id);

      if (!userPerms) {
        throw ApiError.unauthorized('User not found');
      }

      const isAdminRole = userPerms.roleName === 'admin';
      const hasAdminPermission = userPerms.permissions.includes('admin.settings');

      if (hasAdminPermission || isAdminRole) {
        return next();
      }

      // Then check if user is project admin
      const projectId = req.params[projectIdParam];
      if (projectId) {
        const projectMember = await prisma.projectMember.findFirst({
          where: {
            userId: req.user.id,
            projectId: projectId
          }
        });

        if (projectMember && (projectMember.role === 'admin' || projectMember.role === 'lead')) {
          return next();
        }
      }

      throw ApiError.forbidden('Admin or project admin access required');
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Require project admin permission (shortcut)
 */
export function requireProjectAdmin(paramName = 'projectId') {
  return requirePermission({
    permission: 'projects.manage_members',
    projectIdParam: paramName,
  });
}

/**
 * Require project member (any role)
 */
export function requireProjectMember(paramName = 'projectId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const projectId = req.params[paramName];
      if (!projectId) {
        throw ApiError.badRequest('Project ID required');
      }

      // Check if user is a member of the project
      const projectMember = await prisma.projectMember.findFirst({
        where: {
          userId: req.user.id,
          projectId: projectId
        }
      });

      // Also check system-level access (admin users) - cached
      const userPerms = await getCachedUserPermissions(req.user.id);

      const isAdminRole = userPerms?.roleName === 'admin';
      const hasSystemAccess = userPerms?.permissions.includes('projects.read_all') || false;

      if (projectMember || isAdminRole || hasSystemAccess) {
        return next();
      }

      throw ApiError.forbidden('You are not a member of this project');
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user can modify an issue (either has update permission or is the owner)
 */
export function requireIssueEditPermission(projectIdParam = 'projectId', issueIdParam = 'issueId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const projectId = req.params[projectIdParam];
      const issueId = req.params[issueIdParam] || req.params.id;

      // Fetch user with role and permissions (cached)
      const userPerms = await getCachedUserPermissions(req.user.id);

      if (!userPerms) {
        throw ApiError.unauthorized('User not found');
      }

      // Check if user has full update permission
      let hasUpdatePermission = await policyService.hasPermission({
        userId: req.user.id,
        permission: 'issues.update',
        projectId,
      });

      if (!hasUpdatePermission) {
        hasUpdatePermission = userPerms.permissions.includes('issues.update');
      }

      if (!hasUpdatePermission && projectId) {
        // Check project-level permissions
        const projectMember = await prisma.projectMember.findFirst({
          where: {
            userId: req.user.id,
            projectId: projectId
          }
        });

        if (projectMember) {
          const rolePermissions = PROJECT_ROLE_PERMISSIONS[projectMember.role] || [];
          hasUpdatePermission = rolePermissions.includes('issues.update');
        }
      }

      if (hasUpdatePermission) {
        return next();
      }

      // Check if user is the issue reporter (update_own permission)
      if (issueId) {
        const issue = await prisma.issue.findUnique({
          where: { id: issueId },
          select: { reporterId: true }
        });

        if (issue && issue.reporterId === req.user.id) {
          // Also verify they have update_own permission
          let hasOwnPermission = userPerms.permissions.includes('issues.update_own');

          if (!hasOwnPermission) {
            hasOwnPermission = await policyService.hasPermission({
              userId: req.user.id,
              permission: 'issues.update_own',
              projectId,
            });
          }

          if (!hasOwnPermission && projectId) {
            const projectMember = await prisma.projectMember.findFirst({
              where: {
                userId: req.user.id,
                projectId: projectId
              }
            });

            if (projectMember) {
              const rolePermissions = PROJECT_ROLE_PERMISSIONS[projectMember.role] || [];
              hasOwnPermission = rolePermissions.includes('issues.update_own');
            }
          }

          if (hasOwnPermission) {
            return next();
          }
        }
      }

      throw ApiError.forbidden('Insufficient permissions to edit this issue');
    } catch (error) {
      next(error);
    }
  };
}
