export interface PermissionSeed {
  name: string;
  displayName: string;
  description: string;
  resource: string;
  action: string;
  /** Which application owns this permission: 'hrms' | 'pmt' | 'global' */
  app: 'hrms' | 'pmt' | 'global';
}

export interface RoleSeed {
  name: string;
  displayName: string;
  description: string;
  level: number;
  isSystem: boolean;
}

// ============================================================
// GLOBAL PERMISSIONS – apply to both HRMS and PMT contexts
// ============================================================
export const GLOBAL_PERMISSION_NAMES: string[] = [
  'admin.settings',
  'admin.audit',
  'users.read',
  'users.manage_roles',
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  'reports.view',
];

// ============================================================
// HRMS-SPECIFIC PERMISSIONS
// ============================================================
const HRMS_ONLY_PERMISSION_NAMES: string[] = [
  // Employee Directory Management
  'employees.create_hr',
  'employees.create_manager',
  'employees.create_employee',
  'employees.read_all',
  'employees.update',
  'employees.soft_delete',
  'employees.assign_manager',
  'employees.change_role',
  'employees.reset_password',

  // Onboarding Management
  'onboarding.read_all',
  'onboarding.initiate',
  'onboarding.update_tasks',
  'onboarding.complete',

  // Offboarding Management
  'offboarding.read_all',
  'offboarding.initiate',
  'offboarding.update_tasks',
  'offboarding.complete',
  'offboarding.set_exit_date',

  // Attendance Management
  'attendance.read_all',
  'attendance.correct',
  'attendance.export',
  'attendance.add_manual',

  // Leave Management
  'leave.read_all',
  'leave.approve_team',
  'leave.approve_all',
  'leave.reject',
  'leave.cancel_all',
  'leave.adjust_balance',

  // Holiday Management
  'holidays.create',
  'holidays.update',
  'holidays.delete',
  'holidays.upload',
  'holidays.export',

  // Payroll Management
  'payroll.read_all',
  'payroll.upload',
  'payroll.generate',
  'payroll.finalize',
  'payroll.export',
  'payroll.read_status',

  // Organization Hierarchy
  'org.read',
  'org.modify',
  'org.reassign_manager',
  'org.export',
];

/**
 * All HRMS permission names = global (cross-cutting) + HRMS-only.
 * Used to determine if a permission belongs to HRMS context.
 */
export const HRMS_PERMISSION_NAMES: string[] = [
  ...GLOBAL_PERMISSION_NAMES,
  ...HRMS_ONLY_PERMISSION_NAMES,
];

// ============================================================
// PMT-SPECIFIC SYSTEM PERMISSIONS
// ============================================================
export const PMT_PERMISSION_NAMES: string[] = [
  'projects.create',     // Create new projects
  'projects.view_all',   // View all projects regardless of membership
  'projects.manage_all', // Full admin control over all projects
  'issues.view_all',     // View all issues across all projects
  'issues.manage_all',   // Full issue management across all projects
  'members.invite',      // Invite users to any project
  'ai.use',              // Use AI-powered features
  'integrations.manage', // Manage Slack, GitHub and Calendar integrations
  'workflows.view',      // View workflow definitions and configurations
  'workflows.create',    // Create new workflows, statuses, and workflow schemes
  'workflows.manage',    // Update, delete, configure transitions and role conditions
];

// ============================================================
// BUILD PermissionSeed ARRAYS
// ============================================================
function toTitleCase(value: string): string {
  return value
    .split(/[._]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toPermissionSeed(name: string, app: 'hrms' | 'pmt' | 'global'): PermissionSeed {
  const [resource, ...actionParts] = name.split('.');
  const action = actionParts.join('.');
  return {
    name,
    displayName: toTitleCase(`${resource}.${action}`),
    description: `${toTitleCase(resource)} - ${toTitleCase(action)} permission`,
    resource,
    action,
    app,
  };
}

export const GLOBAL_PERMISSIONS: PermissionSeed[] = GLOBAL_PERMISSION_NAMES.map((n) =>
  toPermissionSeed(n, 'global')
);

export const HRMS_PERMISSIONS: PermissionSeed[] = [
  ...GLOBAL_PERMISSIONS,
  ...HRMS_ONLY_PERMISSION_NAMES.map((n) => toPermissionSeed(n, 'hrms')),
];

export const PMT_PERMISSIONS: PermissionSeed[] = PMT_PERMISSION_NAMES.map((n) =>
  toPermissionSeed(n, 'pmt')
);

/** Every permission across all contexts */
export const ALL_PERMISSIONS: PermissionSeed[] = [...HRMS_PERMISSIONS, ...PMT_PERMISSIONS];

/** Set for fast O(1) membership checks (kept for backward-compat imports) */
export const HRMS_PERMISSION_NAME_SET = new Set(HRMS_PERMISSION_NAMES);

/**
 * Resource names that are exclusively HRMS-specific.
 * Any permission whose resource is in this set belongs to HRMS, regardless
 * of what the `app` DB column says (it may still be the 'pmt' default if the
 * tagging migration hasn't run or the startup seed created the row afterwards).
 */
export const HRMS_RESOURCE_NAMES: ReadonlySet<string> = new Set([
  'employees',
  'onboarding',
  'offboarding',
  'attendance',
  'leave',
  'holidays',
  'payroll',
  'org',
  'approvals',
  'auth',
  'profiles',
]);

// ============================================================
// GLOBAL SYSTEM ROLES
// Shared across both HRMS and PMT applications.
// ============================================================
export const HRMS_SYSTEM_ROLES: RoleSeed[] = [
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'System administrator with organization-wide control',
    level: 100,
    isSystem: true,
  },
  {
    name: 'hr',
    displayName: 'HR',
    description: 'Human resources role for full employee lifecycle operations',
    level: 80,
    isSystem: true,
  },
  {
    name: 'manager',
    displayName: 'Manager',
    description: 'Team manager role for team supervision and approvals',
    level: 60,
    isSystem: true,
  },
  {
    name: 'employee',
    displayName: 'Employee',
    description: 'Employee self-service role with limited self access',
    level: 40,
    isSystem: true,
  },
];

/** @deprecated No longer used — job-title roles removed in Keycloak migration */
export const GLOBAL_JOB_ROLES: RoleSeed[] = [];

/** All system roles */
export const ALL_SYSTEM_ROLES: RoleSeed[] = [...HRMS_SYSTEM_ROLES];

// ============================================================
// HRMS ROLE PERMISSIONS
// ============================================================
export const HRMS_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [...HRMS_PERMISSION_NAMES],

  hr: [
    'users.read',
    'users.manage_roles',
    'roles.read',
    'employees.create_manager',
    'employees.create_employee',
    'employees.read_all',
    'employees.update',
    'employees.soft_delete',
    'employees.assign_manager',
    'employees.change_role',
    'employees.reset_password',
    'onboarding.read_all',
    'onboarding.initiate',
    'onboarding.update_tasks',
    'onboarding.complete',
    'offboarding.read_all',
    'offboarding.initiate',
    'offboarding.update_tasks',
    'offboarding.complete',
    'offboarding.set_exit_date',
    'attendance.read_all',
    'attendance.correct',
    'attendance.export',
    'attendance.add_manual',
    'leave.read_all',
    'leave.approve_team',
    'leave.approve_all',
    'leave.reject',
    'leave.cancel_all',
    'leave.adjust_balance',
    'holidays.create',
    'holidays.update',
    'holidays.delete',
    'holidays.upload',
    'holidays.export',
    'payroll.read_all',
    'payroll.upload',
    'payroll.generate',
    'payroll.finalize',
    'payroll.export',
    'payroll.read_status',
    'org.read',
    'org.modify',
    'org.reassign_manager',
    'org.export',
    'reports.view',
  ],

  manager: [
    'org.read',
    'leave.approve_team',
    'leave.reject',
    'attendance.export',
    'holidays.export',
  ],

  employee: ['org.read'],
};

// ============================================================
// PMT ROLE PERMISSIONS (system-level, NOT project-level)
// Project-level permissions are still governed by
// PROJECT_ROLE_PERMISSIONS in rbac.types.ts.
// ============================================================
// Only admin and employee are valid roles in the PMT context.
// hr and manager are HRMS-only roles managed by Keycloak; they do not receive
// PMT role permissions. The project-management-tool Keycloak client issues only
// admin or employee roles.
export const PMT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [...GLOBAL_PERMISSION_NAMES, ...PMT_PERMISSION_NAMES],
  employee: [],
};
