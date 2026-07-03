export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal?: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  start_date?: string;
  end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  capacity_hours?: number;
  sequence: number;
  created_by?: string;
  completed_by?: string;
  retrospective_notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SprintMetric {
  id: string;
  sprint_id: string;
  date: string;
  total_issues: number;
  completed_issues: number;
  total_story_points: number;
  completed_story_points: number;
  total_hours: number;
  completed_hours: number;
  added_issues: number;
  removed_issues: number;
  created_at: Date;
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

export interface CompleteSprintInput {
  incompleteIssueAction: 'move_to_backlog' | 'move_to_next_sprint';
  nextSprintId?: string;
  retrospectiveNotes?: string;
}

export interface SprintProgress {
  totalIssues: number;
  completedIssues: number;
  percentComplete: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
}

export interface SprintStatistics extends SprintProgress {
  inProgressIssues: number;
  todoIssues: number;
  totalHours: number;
  loggedHours: number;
  remainingHours: number;
}

export interface BurndownPoint {
  date: string;
  idealRemaining: number;
  actualRemaining: number | null;
  completed: number;
}

export interface BurnupPoint {
  date: string;
  totalScope: number; // Total story points in sprint (may change over time)
  completedPoints: number; // Cumulative completed points
  idealProgress: number; // Where we should be ideally
}

export interface SprintBurnupData {
  sprint: {
    id: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
  };
  totalPoints: number;
  completedPoints: number;
  burnup: BurnupPoint[];
  scopeChanges: {
    date: string;
    added: number;
    removed: number;
  }[];
  projectedCompletion: string | null;
  isOnTrack: boolean;
}

export interface VelocityData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  committedPoints: number;
  completedPoints: number;
  completionRate: number;
}

export interface SprintFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export interface OverCommitmentInfo {
  sprintId: string;
  sprintName: string;
  totalStoryPoints: number;
  averageVelocity: number;
  overCommitmentPercentage: number;
  warningLevel: 'none' | 'moderate' | 'severe';
  message: string;
  recommendation?: string;
}
