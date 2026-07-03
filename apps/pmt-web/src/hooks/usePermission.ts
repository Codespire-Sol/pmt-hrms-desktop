import { useCallback, useMemo } from 'react';
import { useGetCurrentUserPermissionsQuery } from '../features/rbac/rbacApi';
import { PROJECT_ROLE_PERMISSIONS } from '../features/rbac/types';

export function usePermission() {
  const { data, isLoading } = useGetCurrentUserPermissionsQuery();

  const role = data?.data?.role;
  const systemPermissions = data?.data?.permissions || [];

  // Check if user has a system-level permission
  const hasSystemPermission = useCallback(
    (permission: string): boolean => {
      return systemPermissions.includes(permission);
    },
    [systemPermissions]
  );

  // Check if user has a project-level permission
  // Note: This requires projectMemberships to be available (could be fetched separately or included in auth response)
  const hasProjectPermission = useCallback(
    (projectRole: string | undefined, permission: string): boolean => {
      if (!projectRole) return false;

      // Check system admin first
      if (role?.name === 'admin') return true;

      // Check project role permissions
      const rolePermissions = PROJECT_ROLE_PERMISSIONS[projectRole] || [];
      return rolePermissions.includes(permission);
    },
    [role]
  );

  // Convenience checks
  const isAdmin = useMemo(() => role?.name === 'admin', [role]);
  const isPM = useMemo(() => role?.name === 'pm' || role?.name === 'admin', [role]);
  const isLead = useMemo(
    () => role?.name === 'lead' || role?.name === 'pm' || role?.name === 'admin',
    [role]
  );

  // Check if user can perform a specific action
  const can = useCallback(
    (permission: string, projectRole?: string): boolean => {
      // First check system permission
      if (hasSystemPermission(permission)) {
        return true;
      }

      // Then check project permission if projectRole is provided
      if (projectRole) {
        return hasProjectPermission(projectRole, permission);
      }

      return false;
    },
    [hasSystemPermission, hasProjectPermission]
  );

  return {
    role,
    systemPermissions,
    hasSystemPermission,
    hasProjectPermission,
    can,
    isAdmin,
    isPM,
    isLead,
    isLoading,
  };
}

export default usePermission;
