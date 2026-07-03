import { ReactNode } from 'react';
import { useGetCurrentUserPermissionsQuery } from '../rbacApi';
import { PROJECT_ROLE_PERMISSIONS } from '../types';

interface PermissionGuardProps {
  /** Required permission(s) to render children */
  permission: string | string[];
  /** How to check multiple permissions: 'all' requires all, 'any' requires at least one */
  mode?: 'all' | 'any';
  /** Optional project role to check against (for project-specific permissions) */
  projectRole?: 'admin' | 'lead' | 'member' | 'viewer';
  /** Content to render if permission check passes */
  children: ReactNode;
  /** Optional fallback content when permission check fails */
  fallback?: ReactNode;
  /** If true, shows loading state while checking permissions */
  showLoading?: boolean;
}

/**
 * PermissionGuard component
 *
 * Conditionally renders children based on user permissions.
 *
 * @example
 * // Single permission check
 * <PermissionGuard permission="projects.delete">
 *   <DeleteProjectButton />
 * </PermissionGuard>
 *
 * @example
 * // Multiple permissions (all required)
 * <PermissionGuard permission={['sprints.create', 'sprints.manage']} mode="all">
 *   <SprintManagement />
 * </PermissionGuard>
 *
 * @example
 * // Multiple permissions (any required)
 * <PermissionGuard permission={['issues.update', 'issues.update_own']} mode="any">
 *   <EditIssueButton />
 * </PermissionGuard>
 *
 * @example
 * // Project role based check
 * <PermissionGuard permission="issues.assign" projectRole={userProjectRole}>
 *   <AssigneeSelect />
 * </PermissionGuard>
 */
export function PermissionGuard({
  permission,
  mode = 'all',
  projectRole,
  children,
  fallback = null,
  showLoading = false,
}: PermissionGuardProps) {
  const { data, isLoading } = useGetCurrentUserPermissionsQuery();

  if (isLoading && showLoading) {
    return <div className="animate-pulse bg-muted h-8 w-24 rounded" />;
  }

  const userPermissions = data?.data.permissions || [];
  const requiredPermissions = Array.isArray(permission) ? permission : [permission];
  const systemRoleName = data?.data.role?.name;

  // Admins must not log time to avoid corrupting financial records.
  // Only block when time.log is the sole purpose of the check (not bundled with view permissions).
  const VIEW_TIME_PERMISSIONS = new Set(['time.view_all', 'time.edit_all', 'time.delete_all']);
  const onlyRequestingTimeLog =
    requiredPermissions.includes('time.log') &&
    !requiredPermissions.some((p) => VIEW_TIME_PERMISSIONS.has(p));
  if (onlyRequestingTimeLog && systemRoleName === 'admin') {
    return <>{fallback}</>;
  }

  // Check project role permissions if provided
  if (projectRole) {
    const rolePermissions = PROJECT_ROLE_PERMISSIONS[projectRole] || [];
    const hasPermission =
      mode === 'all'
        ? requiredPermissions.every((p) => rolePermissions.includes(p))
        : requiredPermissions.some((p) => rolePermissions.includes(p));

    if (hasPermission) {
      return <>{children}</>;
    }
  }

  // Check user's global permissions
  const hasPermission =
    mode === 'all'
      ? requiredPermissions.every((p) => userPermissions.includes(p))
      : requiredPermissions.some((p) => userPermissions.includes(p));

  if (hasPermission) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Hook to check if user has specific permission(s)
 */
export function usePermission(
  permission: string | string[],
  mode: 'all' | 'any' = 'all',
  projectRole?: 'admin' | 'lead' | 'member' | 'viewer'
): { hasPermission: boolean; isLoading: boolean } {
  const { data, isLoading } = useGetCurrentUserPermissionsQuery();

  const userPermissions = data?.data.permissions || [];
  const requiredPermissions = Array.isArray(permission) ? permission : [permission];
  const systemRoleName = data?.data.role?.name;

  // Admins must not log time to avoid corrupting financial records.
  // Only block when time.log is the sole purpose of the check (not bundled with view permissions).
  const VIEW_TIME_PERMISSIONS = new Set(['time.view_all', 'time.edit_all', 'time.delete_all']);
  const onlyRequestingTimeLog =
    requiredPermissions.includes('time.log') &&
    !requiredPermissions.some((p) => VIEW_TIME_PERMISSIONS.has(p));
  if (onlyRequestingTimeLog && systemRoleName === 'admin') {
    return { hasPermission: false, isLoading };
  }

  // Check project role permissions if provided
  if (projectRole) {
    const rolePermissions = PROJECT_ROLE_PERMISSIONS[projectRole] || [];
    const hasRolePermission =
      mode === 'all'
        ? requiredPermissions.every((p) => rolePermissions.includes(p))
        : requiredPermissions.some((p) => rolePermissions.includes(p));

    if (hasRolePermission) {
      return { hasPermission: true, isLoading };
    }
  }

  // Check user's global permissions
  const hasPermission =
    mode === 'all'
      ? requiredPermissions.every((p) => userPermissions.includes(p))
      : requiredPermissions.some((p) => userPermissions.includes(p));

  return { hasPermission, isLoading };
}

/**
 * Higher-order component for permission-based rendering
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  permission: string | string[],
  mode: 'all' | 'any' = 'all',
  FallbackComponent?: React.ComponentType
) {
  return function WithPermissionComponent(props: P) {
    return (
      <PermissionGuard
        permission={permission}
        mode={mode}
        fallback={FallbackComponent ? <FallbackComponent /> : null}
      >
        <WrappedComponent {...props} />
      </PermissionGuard>
    );
  };
}
