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
  // For issue triggers - optional filters
  issueTypes?: string[];
  statuses?: string[];
  priorities?: string[];

  // For issue_updated trigger - which fields changed
  fieldChanged?: string[];

  // For issue_transitioned - from/to status
  fromStatus?: string;
  toStatus?: string;

  // For scheduled trigger
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
  // For nested conditions
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

export interface Action {
  id: string;
  type: ActionType;
  config: ActionConfig;
}

export interface ActionConfig {
  // For set_field
  field?: string;
  value?: any;

  // For transition_issue
  statusId?: string;

  // For assign_issue
  assigneeId?: string;
  assigneeType?: 'specific' | 'reporter' | 'project_lead' | 'component_lead' | 'unassigned';

  // For add_comment
  comment?: string;
  isInternal?: boolean;

  // For add_label / remove_label
  labelId?: string;
  labelName?: string;

  // For add_watcher
  userId?: string;
  userType?: 'specific' | 'reporter' | 'assignee';

  // For send_notification / send_email
  recipients?: string[];
  recipientType?: 'specific' | 'watchers' | 'assignee' | 'reporter' | 'project_members';
  subject?: string;
  message?: string;

  // For call_webhook
  webhookId?: string;
  webhookUrl?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;

  // For create_subtask
  subtaskTitle?: string;
  subtaskTypeId?: string;
  subtaskDescription?: string;

  // For link_issue
  linkType?: string;
  targetIssueId?: string;
  targetIssueJql?: string;

  // For log_work
  timeSpent?: string;
  workDescription?: string;

  // For set_due_date
  dueDateType?: 'specific' | 'relative';
  dueDate?: string;
  relativeDays?: number;
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
  lastExecutedAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  createdAt: Date;
  updatedAt: Date;
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
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface ScheduledRuleRun {
  id: string;
  ruleId: string;
  cronExpression: string;
  nextRunAt: Date;
  lastRunAt?: Date;
  createdAt: Date;
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

// Trigger Event Data
export interface TriggerEventData {
  type: TriggerType;
  projectId: string;
  userId?: string;
  issue?: {
    id: string;
    key: string;
    typeId: string;
    statusId: string;
    priorityId?: string;
    assigneeId?: string;
    reporterId: string;
    [key: string]: any;
  };
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  comment?: {
    id: string;
    content: string;
    authorId: string;
  };
  sprint?: {
    id: string;
    name: string;
  };
  metadata?: Record<string, any>;
}

// Available fields for conditions
export const AUTOMATION_FIELDS = [
  { id: 'type', label: 'Issue Type', type: 'select' },
  { id: 'status', label: 'Status', type: 'select' },
  { id: 'priority', label: 'Priority', type: 'select' },
  { id: 'assignee', label: 'Assignee', type: 'user' },
  { id: 'reporter', label: 'Reporter', type: 'user' },
  { id: 'summary', label: 'Summary', type: 'text' },
  { id: 'description', label: 'Description', type: 'text' },
  { id: 'labels', label: 'Labels', type: 'multiselect' },
  { id: 'components', label: 'Components', type: 'multiselect' },
  { id: 'fixVersion', label: 'Fix Version', type: 'select' },
  { id: 'sprint', label: 'Sprint', type: 'select' },
  { id: 'storyPoints', label: 'Story Points', type: 'number' },
  { id: 'dueDate', label: 'Due Date', type: 'date' },
  { id: 'created', label: 'Created Date', type: 'date' },
  { id: 'updated', label: 'Updated Date', type: 'date' },
] as const;

export const TRIGGER_DESCRIPTIONS: Record<TriggerType, string> = {
  issue_created: 'When an issue is created',
  issue_updated: 'When an issue is updated',
  issue_transitioned: 'When an issue changes status',
  issue_assigned: 'When an issue is assigned',
  issue_commented: 'When a comment is added to an issue',
  sprint_started: 'When a sprint is started',
  sprint_completed: 'When a sprint is completed',
  scheduled: 'On a scheduled time',
  manual: 'Triggered manually',
};

export const ACTION_DESCRIPTIONS: Record<ActionType, string> = {
  set_field: 'Set a field value',
  transition_issue: 'Transition issue to a status',
  assign_issue: 'Assign issue to a user',
  add_comment: 'Add a comment',
  add_label: 'Add a label',
  remove_label: 'Remove a label',
  add_watcher: 'Add a watcher',
  send_notification: 'Send an in-app notification',
  send_email: 'Send an email',
  call_webhook: 'Call a webhook',
  create_subtask: 'Create a subtask',
  link_issue: 'Link to another issue',
  log_work: 'Log work time',
  set_due_date: 'Set due date',
};
