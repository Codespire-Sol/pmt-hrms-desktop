export interface SecurityLevel {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  level: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityLevelRole {
  id: string;
  securityLevelId: string;
  roleId: string;
  createdAt: Date;
}

export interface SecurityLevelWithRoles extends SecurityLevel {
  roles: {
    id: string;
    name: string;
    displayName: string;
  }[];
}

export interface CreateSecurityLevelInput {
  name: string;
  description?: string;
  level?: number;
  isDefault?: boolean;
  roleIds?: string[];
}

export interface UpdateSecurityLevelInput {
  name?: string;
  description?: string | null;
  level?: number;
  isDefault?: boolean;
  roleIds?: string[];
}

export interface SecurityLevelRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  level: number;
  is_default: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface SecurityLevelRoleRow {
  id: string;
  security_level_id: string;
  role_id: string;
  role_name?: string;
  role_display_name?: string;
  created_at: Date;
}
