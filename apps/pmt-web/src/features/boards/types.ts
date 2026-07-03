// Board types

export interface BoardIssue {
  id: string;
  issueKey: string;
  title: string;
  storyPoints?: number;
  type: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  priority?: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
  };
  assignee?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  labels?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  dueDate?: string;
  position: number;
}

export interface BoardColumn {
  id: string;
  name: string;
  displayName: string;
  color: string;
  category: 'todo' | 'in_progress' | 'done';
  position: number;
  wipLimit?: number | null;
  issues: BoardIssue[];
}

export interface BoardFilters {
  assignees: Array<{
    id: string;
    displayName: string;
    avatarUrl?: string;
  }>;
  types: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
  }>;
  priorities: Array<{
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
  }>;
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export interface BoardData {
  project: {
    id: string;
    key: string;
    name: string;
  };
  columns: BoardColumn[];
  filters: BoardFilters;
}

export interface MoveIssueInput {
  issueId: string;
  statusId: string;
  position: number;
}

export interface UpdateWipLimitInput {
  projectId: string;
  statusId: string;
  wipLimit: number | null;
}

export interface BoardFilterState {
  assigneeIds: string[];
  typeIds: string[];
  priorityIds: string[];
  labelIds: string[];
  searchQuery: string;
}
