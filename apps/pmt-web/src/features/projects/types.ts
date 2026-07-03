// Project types

export interface ProjectOwner {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface ProjectLead {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface ProjectStatistics {
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  completedIssues: number;
  memberCount: number;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string;
  ownerId: string;
  leadId?: string;
  category?: string;
  status: 'active' | 'archived' | 'on_hold';
  visibility: 'private' | 'internal' | 'public';
  startDate?: string;
  targetEndDate?: string;
  actualEndDate?: string;
  createdAt: string;
  updatedAt: string;
  statistics?: ProjectStatistics;
  owner?: ProjectOwner;
  lead?: ProjectLead;
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
  leadId?: string;
  category?: string;
  visibility?: 'private' | 'internal' | 'public';
  startDate?: string;
  targetEndDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  leadId?: string | null;
  category?: string;
  status?: 'active' | 'archived' | 'on_hold';
  visibility?: 'private' | 'internal' | 'public';
  startDate?: string | null;
  targetEndDate?: string | null;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'admin' | 'lead' | 'member' | 'viewer';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface AddProjectMemberInput {
  userId?: string;
  email?: string;
  role: 'admin' | 'lead' | 'member' | 'viewer';
}

export interface UpdateMemberRoleInput {
  role: 'admin' | 'lead' | 'member' | 'viewer';
}

export interface ProjectListFilters {
  status?: 'active' | 'archived' | 'on_hold';
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProjectListResponse {
  projects: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
