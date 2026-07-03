// Sprint types

export interface SprintProgress {
  totalIssues: number;
  completedIssues: number;
  percentComplete: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
}

export interface SprintIssueType {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface SprintIssueStatus {
  id: string;
  name: string;
  displayName: string;
  color: string;
  category: 'todo' | 'in_progress' | 'done';
}

export interface SprintIssuePriority {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
}

export interface SprintIssueAssignee {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface SprintIssue {
  id: string;
  issueKey: string;
  title: string;
  storyPoints?: number;
  type: SprintIssueType;
  status: SprintIssueStatus;
  priority?: SprintIssuePriority;
  assignee?: SprintIssueAssignee;
}

export type SprintStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  capacityHours?: number;
  sequence: number;
  progress?: SprintProgress;
  daysRemaining?: number | null;
  issues?: SprintIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface BurndownPoint {
  date: string;
  idealRemaining: number;
  actualRemaining: number | null;
  completed: number;
}

export interface BurndownData {
  sprint: {
    name: string;
    startDate: string;
    endDate: string;
  };
  totalPoints: number;
  burndown: BurndownPoint[];
  projectedCompletion?: string;
  isOnTrack: boolean;
}

export interface VelocitySprintData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  committedPoints: number;
  completedPoints: number;
  completionRate: number;
}

export type VelocityTrend = 'increasing' | 'decreasing' | 'stable';

export interface VelocityData {
  sprints: VelocitySprintData[];
  averageVelocity: number;
  trend: VelocityTrend;
}

export interface BacklogIssue {
  id: string;
  issueKey: string;
  title: string;
  storyPoints?: number;
  position: number;
  type: SprintIssueType;
  priority?: SprintIssuePriority;
}

export interface CreateSprintInput {
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  capacityHours?: number;
}

export interface UpdateSprintInput {
  name?: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  capacityHours?: number;
}

export type IncompleteIssueAction = 'move_to_backlog' | 'move_to_next_sprint';

export interface CompleteSprintInput {
  incompleteIssueAction: IncompleteIssueAction;
  nextSprintId?: string;
  retrospectiveNotes?: string;
}

export interface SprintListResponse {
  sprints: Sprint[];
  activeSprint: Sprint | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BacklogResponse {
  issues: BacklogIssue[];
  totalStoryPoints: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
