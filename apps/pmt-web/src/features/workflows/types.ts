export interface Workflow {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Status {
  id: string;
  workflowId: string;
  name: string;
  displayName: string;
  description?: string;
  color: string;
  category: string;
  position: number;
  wipLimit?: number;
  isInitial: boolean;
  isFinal: boolean;
  createdAt: string;
}

export interface StatusTransition {
  id: string;
  workflowId: string;
  fromStatusId: string;
  toStatusId: string;
  name?: string;
}

export interface WorkflowWithStatuses extends Workflow {
  statuses: Status[];
  transitions: StatusTransition[];
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  projectId?: string;
  copyFromId?: string;
}

export interface CreateStatusInput {
  name: string;
  displayName: string;
  description?: string;
  color?: string;
  category: string;
  wipLimit?: number;
  isInitial?: boolean;
  isFinal?: boolean;
}

export interface UpdateStatusInput {
  name?: string;
  displayName?: string;
  description?: string;
  color?: string;
  category?: string;
  wipLimit?: number | null;
  isInitial?: boolean;
  isFinal?: boolean;
}

export interface AddTransitionInput {
  fromStatusId: string;
  toStatusId: string;
  name?: string;
}

export const CATEGORY_LABELS: Record<Status['category'], string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export const CATEGORY_COLORS: Record<Status['category'], string> = {
  todo: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
};

export const DEFAULT_STATUS_COLORS = [
  '#9CA3AF', // Gray
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

// Workflow templates
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  statusCount: number;
  transitionCount: number;
  categories: string[];
}

// Transition restrictions
export interface TransitionRestriction {
  id: string;
  transitionId: string;
  restrictionType: 'role' | 'permission' | 'project_role';
  value: string;
  createdAt: string;
}

export interface CreateTransitionRestrictionInput {
  restrictionType: 'role' | 'permission' | 'project_role';
  value: string;
}

// Workflow schemes
export interface WorkflowScheme {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSchemeMapping {
  id: string;
  schemeId: string;
  issueTypeId?: string;
  workflowId: string;
  isDefault: boolean;
  workflow?: Workflow;
}

export interface WorkflowSchemeWithMappings extends WorkflowScheme {
  mappings: WorkflowSchemeMapping[];
}

export interface CreateWorkflowSchemeInput {
  name: string;
  description?: string;
}
