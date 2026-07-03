import { ReactNode } from 'react';
import { usePermission } from '../../hooks/usePermission';

interface PermissionGuardProps {
  /** The permission required to render children */
  permission: string;
  /** Optional project role to check (for project-level permissions) */
  projectRole?: string;
  /** Content to render if permission check fails */
  fallback?: ReactNode;
  /** Children to render if permission check passes */
  children: ReactNode;
}

/**
 * Guards content based on user permissions.
 *
 * Usage examples:
 *
 * // System permission check
 * <PermissionGuard permission="users.create">
 *   <CreateUserButton />
 * </PermissionGuard>
 *
 * // Project permission check
 * <PermissionGuard permission="issues.delete" projectRole={membership.role}>
 *   <DeleteButton />
 * </PermissionGuard>
 *
 * // With fallback
 * <PermissionGuard permission="admin.settings" fallback={<AccessDenied />}>
 *   <AdminPanel />
 * </PermissionGuard>
 */
export function PermissionGuard({
  permission,
  projectRole,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { can, isLoading } = usePermission();

  // While loading, don't render anything (or could render a skeleton)
  if (isLoading) {
    return null;
  }

  const hasAccess = can(permission, projectRole);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Guards content for admin-only access
 */
export function AdminGuard({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isAdmin, isLoading } = usePermission();

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook version for conditional logic in components
 */
export function useCanAccess(permission: string, projectRole?: string): boolean {
  const { can, isLoading } = usePermission();

  if (isLoading) {
    return false;
  }

  return can(permission, projectRole);
}

export default PermissionGuard;
