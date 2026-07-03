export interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  level: number;
  /** Which app created this custom role: 'hrms' | 'pmt' | null for system/global */
  app: 'hrms' | 'pmt' | null;
  created_at: string;
  updated_at: string;
}

export type AppContext = 'hrms' | 'pmt' | 'global' | 'all';

export interface Permission {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  category?: string;
  resource: string;
  action: string;
  /** Application context: 'hrms' | 'pmt' | 'global' */
  app: 'hrms' | 'pmt' | 'global';
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AuditLogWithUser extends AuditLog {
  user?: {
    id: string;
    displayName: string;
    email: string;
  };
}

export interface CreateAuditLogInput {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  app?: 'pmt';
}

export interface AssignRoleInput {
  userId: string;
  roleId: string;
}

export interface CreateRoleInput {
  name: string;
  displayName: string;
  description?: string;
  level?: number;
  /** Which app is creating this custom role: 'hrms' | 'pmt' */
  app?: 'hrms' | 'pmt';
}

export interface UpdateRoleInput {
  displayName?: string;
  description?: string;
  level?: number;
}

export interface SetRolePermissionsInput {
  permissionIds: string[];
}

export interface UserWithRole {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role | null;
}

// Project role permissions mapping
export const PROJECT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'projects.read',
    'projects.update',
    'projects.delete',
    'projects.manage_members',
    'sprints.read',
    'sprints.create',
    'sprints.manage',
    'issues.read',
    'issues.create',
    'issues.update',
    'issues.delete',
    'issues.assign',
    'time.view_all',
    'time.edit_all',
    'time.delete_all',
    'reports.view',
    'reports.export',
  ],
  lead: [
    'projects.read',
    'projects.update',
    'projects.manage_members',
    'sprints.read',
    'sprints.create',
    'sprints.manage',
    'issues.read',
    'issues.create',
    'issues.update',
    'issues.delete',
    'issues.assign',
    'issues.view_all',
    'time.log',
    'time.view_all',
    'members.invite',
    'reports.view',
    'reports.export',
    'workflows.view',
    'workflows.create',
    'workflows.manage',
  ],
  member: [
    'projects.read',
    'sprints.read',
    'issues.read',
    'issues.create',
    'issues.update_own',
    'time.log',
    'reports.view',
  ],
  viewer: [
    'projects.read',
    'sprints.read',
    'issues.read',
    'reports.view',
  ],
};
