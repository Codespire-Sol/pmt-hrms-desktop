export interface Issue {
  id: string;
  projectId: string;
  issueNumber: number;
  issueKey?: string;
  parentId?: string;
  typeId: string;
  statusId: string;
  priorityId?: string;
  title: string;
  description?: string;
  descriptionHtml?: string;
  reporterId: string;
  assigneeId?: string;
  sprintId?: string;
  storyPoints?: number;
  originalEstimateHours?: number;
  remainingEstimateHours?: number;
  timeSpentHours?: number;
  dueDate?: Date;
  startDate?: Date;
  resolution?: string;
  resolutionDate?: Date;
  environment?: string;
  affectedVersion?: string;
  fixVersion?: string;
  components?: string[];
  position?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  typeId: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string;
  parentId?: string;
  storyPoints?: number;
  originalEstimateHours?: number;
  dueDate?: string;
  startDate?: string;
  labels?: string[];
  sprintId?: string;
  epicId?: string;
}

export interface CreateSubtaskInput extends Omit<CreateIssueInput, 'typeId' | 'parentId'> {
  environment?: string;
  affectedVersionId?: string;
  fixVersionId?: string;
  epicId?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  typeId?: string;
  statusId?: string;
  priorityId?: string;
  reporterId?: string;
  assigneeId?: string | null;
  storyPoints?: number;
  remainingEstimateHours?: number;
  dueDate?: string | null;
  startDate?: string | null;
  resolution?: string;
  resolutionDate?: Date | null;
  descriptionHtml?: string;
  position?: number;
  sprintId?: string | null;
  epicId?: string | null;
  labels?: string[];
  environment?: string;
  affectedVersionId?: string | null;
  fixVersionId?: string | null;
}

export interface IssueFilters {
  statusId?: string;
  assigneeId?: string;
  priorityId?: string;
  typeId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AddIssueLinkInput {
  targetIssueId: string;
  linkType: string;
}
