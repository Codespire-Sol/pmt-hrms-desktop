export type EpicStatus = 'to_do' | 'in_progress' | 'done';

export interface Epic {
  id: string;
  projectId: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  color: string;
  status: EpicStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  position: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EpicWithStats extends Epic {
  stats: EpicProgress;
  progress: number;
}

export interface CreateEpicInput {
  name: string;
  summary?: string;
  description?: string;
  color?: string;
  status?: EpicStatus;
  startDate?: string;
  endDate?: string;
}

export interface UpdateEpicInput {
  name?: string;
  summary?: string | null;
  description?: string | null;
  color?: string;
  status?: EpicStatus;
  startDate?: string | null;
  endDate?: string | null;
  position?: number;
}

export interface EpicFilters {
  status?: EpicStatus;
  search?: string;
}

export interface EpicProgress {
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  todoIssues: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
}
