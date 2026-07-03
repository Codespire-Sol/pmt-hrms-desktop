// Issue types

export interface IssueType {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
}

export interface IssueStatus {
  id: string;
  name: string;
  displayName: string;
  color: string;
  category: 'todo' | 'in_progress' | 'done';
}

export interface IssuePriority {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
}

export interface IssueAssignee {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface IssueReporter {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

export interface IssueLabel {
  id: string;
  name: string;
  color: string;
}

export interface Issue {
  id: string;
  projectId: string;
  issueKey: string;
  issueNumber: number;
  title: string;
  description?: string;
  descriptionHtml?: string;
  type: IssueType;
  status: IssueStatus;
  priority?: IssuePriority;
  assignee?: IssueAssignee;
  reporter: IssueReporter;
  storyPoints?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  labels?: IssueLabel[];
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  typeId: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string;
  storyPoints?: number;
  dueDate?: string;
  labels?: string[];
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  typeId?: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  labels?: string[];
}

export type IssueLinkType =
  | 'blocks'
  | 'blocked_by'
  | 'relates_to'
  | 'duplicates'
  | 'duplicated_by'
  | 'parent_of'
  | 'child_of';

export interface IssueLinkTarget {
  id: string;
  issueKey: string;
  title: string;
  status: {
    id: string;
    name: string;
    displayName: string;
    color: string;
  };
  priority?: {
    id: string;
    name: string;
    displayName: string;
    color: string;
  };
}

export interface IssueLink {
  id: string;
  sourceIssueId: string;
  targetIssueId: string;
  linkType: IssueLinkType;
  createdAt: string;
  createdBy: {
    id: string;
    displayName: string;
  };
  targetIssue: IssueLinkTarget;
}

export interface CreateIssueLinkInput {
  targetIssueId: string;
  linkType: IssueLinkType;
}

export interface IssueListFilters {
  status?: string;
  type?: string;
  priority?: string;
  assignee?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IssueListResponse {
  issues: Issue[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IssueHistory {
  id: string;
  issueId: string;
  field: string;
  oldValue?: string;
  newValue?: string;
  changedBy: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  changedAt: string;
}

export interface IssueWatcher {
  id: string;
  userId: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  watchingSince: string;
}
