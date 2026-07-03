export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  level: number;
  /** Which app created this custom role: 'hrms' | 'pmt' | null for system/global */
  app: 'hrms' | 'pmt' | null;
}

export interface Permission {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  resource: string;
  action: string;
  /** Which app this permission belongs to: 'pmt', 'hrms', or 'global' */
  app: 'pmt' | 'hrms' | 'global';
}

export interface UserWithRole {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  isVerified?: boolean;
  createdAt: string;
  role: Role | null;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  ipAddress: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  user?: {
    id: string;
    displayName: string;
    email: string;
  };
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  app?: string;
}

// Project role permissions mapping (must match backend)
export const PROJECT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'projects.update',
    'projects.delete',
    'projects.manage_members',
    'sprints.create',
    'sprints.manage',
    'issues.create',
    'issues.update',
    'issues.delete',
    'issues.assign',
    'time.view_all',
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
    'issues.create',
    'issues.update_own',
    'time.log',
    'reports.view',
  ],
  viewer: [
    'issues.read',
    'reports.view',
  ],
};
