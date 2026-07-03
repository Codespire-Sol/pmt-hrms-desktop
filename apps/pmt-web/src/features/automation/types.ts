// Trigger Types
export type TriggerType =
  | 'issue_created'
  | 'issue_updated'
  | 'issue_transitioned'
  | 'issue_assigned'
  | 'issue_commented'
  | 'sprint_started'
  | 'sprint_completed'
  | 'scheduled'
  | 'manual';

export interface TriggerConfig {
  issueTypes?: string[];
  statuses?: string[];
  priorities?: string[];
  fieldChanged?: string[];
  fromStatus?: string;
  toStatus?: string;
  cronExpression?: string;
  timezone?: string;
}

// Condition Types
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in'
  | 'changed'
  | 'changed_from'
  | 'changed_to';

export interface Condition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value?: any;
  logicalOperator?: 'AND' | 'OR';
  conditions?: Condition[];
}

// Action Types
export type ActionType =
  | 'set_field'
  | 'transition_issue'
  | 'assign_issue'
  | 'add_comment'
  | 'add_label'
  | 'remove_label'
  | 'add_watcher'
  | 'send_notification'
  | 'send_email'
  | 'call_webhook'
  | 'create_subtask'
  | 'link_issue'
  | 'log_work'
  | 'set_due_date';

export interface ActionConfig {
  field?: string;
  value?: any;
  statusId?: string;
  assigneeId?: string;
  assigneeType?: 'specific' | 'reporter' | 'project_lead' | 'component_lead' | 'unassigned';
  comment?: string;
  isInternal?: boolean;
  labelId?: string;
  labelName?: string;
  userId?: string;
  userType?: 'specific' | 'reporter' | 'assignee';
  recipients?: string[];
  recipientType?: 'specific' | 'watchers' | 'assignee' | 'reporter' | 'project_members';
  subject?: string;
  message?: string;
  webhookId?: string;
  webhookUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  subtaskTitle?: string;
  subtaskTypeId?: string;
  subtaskDescription?: string;
  linkType?: string;
  targetIssueId?: string;
  targetIssueJql?: string;
  timeSpent?: string;
  workDescription?: string;
  dueDateType?: 'specific' | 'relative';
  dueDate?: string;
  relativeDays?: number;
}

export interface Action {
  id: string;
  type: ActionType;
  config: ActionConfig;
}

// Execution Types
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failure' | 'skipped';

export interface ConditionResult {
  conditionId: string;
  field: string;
  operator: string;
  expectedValue: any;
  actualValue: any;
  passed: boolean;
}

export interface ActionResult {
  actionId: string;
  type: ActionType;
  success: boolean;
  error?: string;
  details?: any;
}

// Main Types
export interface AutomationRule {
  id: string;
  projectId: string;
  createdBy: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  conditions: Condition[];
  actions: Action[];
  executionOrder: number;
  stopOnError: boolean;
  executionCount: number;
  successCount: number;
  failureCount: number;
  lastExecutedAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRuleWithCreator extends AutomationRule {
  creator: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface AutomationRuleExecution {
  id: string;
  ruleId: string;
  triggeredByUserId?: string;
  triggeredByIssueId?: string;
  status: ExecutionStatus;
  triggerData: any;
  conditionResults: ConditionResult[];
  actionResults: ActionResult[];
  errorMessage?: string;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// Input Types
export interface CreateAutomationRuleInput {
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConfig?: TriggerConfig;
  conditions?: Condition[];
  actions: Action[];
  executionOrder?: number;
  stopOnError?: boolean;
}

export interface UpdateAutomationRuleInput {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  triggerType?: TriggerType;
  triggerConfig?: TriggerConfig;
  conditions?: Condition[];
  actions?: Action[];
  executionOrder?: number;
  stopOnError?: boolean;
}

// Reference Data
export interface AutomationField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'user';
}

export interface TriggerTypeInfo {
  type: TriggerType;
  description: string;
}

export interface ActionTypeInfo {
  type: ActionType;
  description: string;
}

export interface ConditionOperatorInfo {
  operator: ConditionOperator;
  label: string;
  types: string[];
}

// Trigger display helpers
export const TRIGGER_LABELS: Record<TriggerType, string> = {
  issue_created: 'Issue Created',
  issue_updated: 'Issue Updated',
  issue_transitioned: 'Issue Transitioned',
  issue_assigned: 'Issue Assigned',
  issue_commented: 'Comment Added',
  sprint_started: 'Sprint Started',
  sprint_completed: 'Sprint Completed',
  scheduled: 'Scheduled',
  manual: 'Manual Trigger',
};

export const TRIGGER_ICONS: Record<TriggerType, string> = {
  issue_created: 'Plus',
  issue_updated: 'Edit',
  issue_transitioned: 'ArrowRight',
  issue_assigned: 'User',
  issue_commented: 'MessageSquare',
  sprint_started: 'Play',
  sprint_completed: 'CheckCircle',
  scheduled: 'Clock',
  manual: 'Hand',
};

export const ACTION_LABELS: Record<ActionType, string> = {
  set_field: 'Set Field',
  transition_issue: 'Transition Issue',
  assign_issue: 'Assign Issue',
  add_comment: 'Add Comment',
  add_label: 'Add Label',
  remove_label: 'Remove Label',
  add_watcher: 'Add Watcher',
  send_notification: 'Send Notification',
  send_email: 'Send Email',
  call_webhook: 'Call Webhook',
  create_subtask: 'Create Subtask',
  link_issue: 'Link Issue',
  log_work: 'Log Work',
  set_due_date: 'Set Due Date',
};
