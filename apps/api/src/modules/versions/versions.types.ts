export type VersionStatus = 'unreleased' | 'released' | 'archived';

export interface Version {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: VersionStatus;
  startDate?: Date;
  releaseDate?: Date;
  actualReleaseDate?: Date;
  releasedBy?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VersionWithStats extends Version {
  releasedByUser?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  stats: {
    totalIssues: number;
    completedIssues: number;
    inProgressIssues: number;
    todoIssues: number;
    totalStoryPoints: number;
    completedStoryPoints: number;
  };
  progress: number;
}

export interface CreateVersionInput {
  name: string;
  description?: string;
  startDate?: string;
  releaseDate?: string;
}

export interface UpdateVersionInput {
  name?: string;
  description?: string | null;
  status?: VersionStatus;
  startDate?: string | null;
  releaseDate?: string | null;
}

export interface VersionFilters {
  status?: VersionStatus;
  search?: string;
}

export interface ReleaseBurndown {
  date: string;
  remainingIssues: number;
  completedIssues: number;
  remainingStoryPoints: number;
  completedStoryPoints: number;
}
