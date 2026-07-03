export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string;
  ownerId: string;
  leadId?: string;
  owner?: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  lead?: {
    id: string;
    email?: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  categoryId?: string;
  category?: string;
  projectType?: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
  } | null;
  type?: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
  } | null;
  status: 'active' | 'archived' | 'on_hold' | 'completed';
  visibility: 'private' | 'internal' | 'public';
  startDate?: Date;
  targetEndDate?: Date;
  actualEndDate?: Date;
  defaultAssigneeId?: string;
  settings: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
  deletedAt?: Date;
  overviewSummary?: ProjectOverviewSummary;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'admin' | 'lead' | 'member' | 'viewer';
  joinedAt: Date;
  invitedBy?: string;
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
  leadId?: string;
  categoryId?: string;
  category?: string;
  visibility?: 'private' | 'internal' | 'public';
  startDate?: Date;
  targetEndDate?: Date;
  defaultAssigneeId?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  leadId?: string;
  categoryId?: string;
  category?: string;
  status?: 'active' | 'archived' | 'on_hold' | 'completed';
  visibility?: 'private' | 'internal' | 'public';
  startDate?: Date;
  targetEndDate?: Date;
  actualEndDate?: Date;
  defaultAssigneeId?: string;
  settings?: Record<string, any>;
  overviewComments?: Array<{
    id?: string;
    content: string;
  }>;
  overviewLinks?: Array<{
    id?: string;
    title: string;
    url: string;
    description?: string | null;
  }>;
  archivedAt?: Date;
}

export interface ProjectFilters {
  status?: string;
  visibility?: string;
  ownerId?: string;
  memberId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProjectStatistics {
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  completedIssues: number;
}

export interface ProjectOverviewComment {
  id: string;
  content: string;
  authorId: string;
  authorName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectOverviewLink {
  id: string;
  title: string;
  url: string;
  description?: string | null;
}

export interface ProjectOverviewSummary {
  comments: ProjectOverviewComment[];
  links: ProjectOverviewLink[];
}

export interface AddMemberInput {
  userId: string;
  role: 'admin' | 'lead' | 'member' | 'viewer';
}

export interface UpdateMemberRoleInput {
  role: 'admin' | 'lead' | 'member' | 'viewer';
}

// Project Templates
export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  icon: string;
  category?: string;
  isSystem: boolean;
  createdBy?: string;
  defaultSettings: Record<string, any>;
  issueTypes: TemplateIssueType[];
  statuses: TemplateStatus[];
  workflows: TemplateWorkflow[];
  labels: TemplateLabel[];
  priorities: TemplatePriority[];
  customFields: TemplateCustomField[];
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateIssueType {
  name: string;
  icon: string;
  color: string;
  description?: string;
}

export interface TemplateStatus {
  name: string;
  category: string;
  color: string;
  description?: string;
}

export interface TemplateWorkflow {
  fromStatus: string;
  toStatus: string;
  name?: string;
}

export interface TemplateLabel {
  name: string;
  color: string;
  description?: string;
}

export interface TemplatePriority {
  name: string;
  color: string;
  icon?: string;
  level: number;
}

export interface TemplateCustomField {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'user';
  required: boolean;
  options?: string[];
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  defaultSettings?: Record<string, any>;
  issueTypes?: TemplateIssueType[];
  statuses?: TemplateStatus[];
  workflows?: TemplateWorkflow[];
  labels?: TemplateLabel[];
  priorities?: TemplatePriority[];
  customFields?: TemplateCustomField[];
}

export interface CreateProjectFromTemplateInput {
  templateId: string;
  name: string;
  key: string;
  description?: string;
  visibility?: 'private' | 'internal' | 'public';
}
