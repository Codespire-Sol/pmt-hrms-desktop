// Board view types
export type BoardViewType = 'kanban' | 'list' | 'timeline';

// Swimlane grouping options
export type SwimlaneGroupBy = 'none' | 'assignee' | 'epic' | 'priority' | 'type' | 'sprint';

export interface BoardColumn {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  color: string;
  category: string;
  position: number;
  isInitial: boolean;
  isFinal: boolean;
  wipLimit: number | null;
  issues: BoardIssue[];
}

export interface BoardIssue {
  id: string;
  issueNumber: number;
  issueKey: string;
  title: string;
  storyPoints: number | null;
  position: number;
  dueDate: string | null;
  statusId: string;
  assigneeId: string | null;
  type: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
  };
  priority: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
  } | null;
  assignee: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  labels: {
    id: string;
    name: string;
    color: string;
  }[];
  epicId?: string;
  epic?: {
    id: string;
    title: string;
    color: string;
  };
  sprintId?: string;
}

export interface Swimlane {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  avatarUrl?: string;
  issueCount: number;
  columns: BoardColumn[];
}

export interface BoardData {
  project: {
    id: string;
    key: string;
    name: string;
  };
  viewType: BoardViewType;
  swimlaneGroupBy: SwimlaneGroupBy;
  columns: BoardColumn[];
  swimlanes?: Swimlane[];
  filters: BoardFilters;
}

export interface BoardFilters {
  assignees: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  }[];
  types: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
  }[];
  priorities: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
  }[];
  labels: {
    id: string;
    name: string;
    color: string;
  }[];
  epics: {
    id: string;
    title: string;
    color: string;
  }[];
  sprints: {
    id: string;
    name: string;
    status: string;
  }[];
}

export interface BoardQueryParams {
  view?: BoardViewType;
  swimlane?: SwimlaneGroupBy;
  assigneeIds?: string[];
  typeIds?: string[];
  priorityIds?: string[];
  labelIds?: string[];
  sprintId?: string;
  epicId?: string;
  search?: string;
  statusCategory?: string;
}

// List view types
export interface ListViewItem {
  id: string;
  issueKey: string;
  title: string;
  status: {
    id: string;
    name: string;
    color: string;
  };
  type: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  priority: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
  assignee: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  dueDate: string | null;
  storyPoints: number | null;
  createdAt: string;
  updatedAt: string;
}

// Timeline view types
export interface TimelineItem {
  id: string;
  issueKey: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  status: {
    id: string;
    name: string;
    color: string;
  };
  assignee: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  progress: number; // 0-100 based on subtask completion
  dependencies: string[]; // Issue IDs that this blocks
  blockedBy?: string[];
  dependencyLinks?: Array<{
    sourceIssueId: string;
    targetIssueId: string;
    linkType: string;
    direction: 'outward' | 'inward';
  }>;
  hasDependencyCycle?: boolean;
}
