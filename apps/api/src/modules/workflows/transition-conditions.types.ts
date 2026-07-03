// Condition Types
export type ConditionType =
  | 'required_fields'
  | 'field_value'
  | 'permission'
  | 'assignee'
  | 'reporter'
  | 'resolution'
  | 'custom_script'
  | 'linked_issues'
  | 'subtasks_done'
  | 'time_logged'
  | 'approval'
  | 'project_role';

export type ValidatorType =
  | 'validate_regex'
  | 'validate_date_range'
  | 'validate_numeric_range'
  | 'validate_email'
  | 'validate_url'
  | 'validate_custom';

export type PostFunctionType =
  | 'set_field'
  | 'copy_field'
  | 'clear_field'
  | 'assign_to_reporter'
  | 'assign_to_lead'
  | 'unassign'
  | 'add_comment'
  | 'add_watcher'
  | 'send_notification'
  | 'update_parent'
  | 'trigger_webhook';

export type ApproverType = 'any' | 'all' | 'specific_users' | 'role' | 'project_lead';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// Condition Configurations
export interface RequiredFieldsConfig {
  fields: string[];
}

export interface FieldValueConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty' | 'in' | 'not_in';
  value?: any;
  values?: any[];
}

export interface PermissionConfig {
  permission: string;
}

export interface AssigneeConfig {
  condition: 'is_assigned' | 'is_current_user' | 'is_specific_user' | 'has_role';
  userId?: string;
  role?: string;
}

export interface LinkedIssuesConfig {
  linkType?: string;
  condition: 'has_links' | 'all_resolved' | 'none_blocking';
}

export interface SubtasksDoneConfig {
  percentComplete?: number; // 0-100, default 100
}

export interface TimeLoggedConfig {
  minimumMinutes: number;
}

export interface ApprovalConfig {
  // Handled by separate approval table
}

export interface ProjectRoleConfig {
  /**
   * List of allowed system roles (e.g. 'fullstack_developer', 'qa_tester')
   * and/or project roles (e.g. 'admin', 'lead', 'member').
   * System admin ('admin') always bypasses this check regardless.
   */
  roles: string[];
  /** 'any' = user must have at least one role (default). 'all' = user must have every role. */
  operator?: 'any' | 'all';
}

// Validator Configurations
export interface RegexValidatorConfig {
  pattern: string;
  flags?: string;
}

export interface DateRangeValidatorConfig {
  minDate?: string;
  maxDate?: string;
  relativeToPast?: number; // Days in past
  relativeToFuture?: number; // Days in future
}

export interface NumericRangeValidatorConfig {
  min?: number;
  max?: number;
}

// Post-Function Configurations
export interface SetFieldConfig {
  field: string;
  value: any;
}

export interface CopyFieldConfig {
  sourceField: string;
  targetField: string;
}

export interface ClearFieldConfig {
  fields: string[];
}

export interface AddCommentConfig {
  comment: string;
  isInternal?: boolean;
}

export interface AddWatcherConfig {
  userType: 'specific' | 'assignee' | 'reporter';
  userId?: string;
}

export interface SendNotificationConfig {
  recipients: 'assignee' | 'reporter' | 'watchers' | 'specific';
  userIds?: string[];
  message: string;
}

export interface TriggerWebhookConfig {
  webhookId: string;
}

// Main Types
export interface TransitionCondition {
  id: string;
  transitionId: string;
  name: string;
  description?: string;
  type: ConditionType;
  config: any;
  isBlocking: boolean;
  errorMessage?: string;
  executionOrder: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransitionValidator {
  id: string;
  transitionId: string;
  name: string;
  description?: string;
  type: ValidatorType;
  field: string;
  config: any;
  errorMessage?: string;
  executionOrder: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransitionPostFunction {
  id: string;
  transitionId: string;
  name: string;
  description?: string;
  type: PostFunctionType;
  config: any;
  executionOrder: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransitionApprovalConfig {
  id: string;
  transitionId: string;
  requiredApprovals: number;
  approverType: ApproverType;
  approvers: string[];
  allowSelfApproval: boolean;
  expiryHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueTransitionApproval {
  id: string;
  issueId: string;
  transitionId: string;
  requestedBy: string;
  status: ApprovalStatus;
  approvalsReceived: number;
  approvalsRequired: number;
  expiresAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueTransitionApprovalResponse {
  id: string;
  approvalId: string;
  userId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  createdAt: Date;
}

// Input Types
export interface CreateConditionInput {
  name: string;
  description?: string;
  type: ConditionType;
  config: any;
  isBlocking?: boolean;
  errorMessage?: string;
  executionOrder?: number;
}

export interface CreateValidatorInput {
  name: string;
  description?: string;
  type: ValidatorType;
  field: string;
  config: any;
  errorMessage?: string;
  executionOrder?: number;
}

export interface CreatePostFunctionInput {
  name: string;
  description?: string;
  type: PostFunctionType;
  config: any;
  executionOrder?: number;
}

export interface CreateApprovalConfigInput {
  requiredApprovals?: number;
  approverType: ApproverType;
  approvers?: string[];
  allowSelfApproval?: boolean;
  expiryHours?: number;
}

// Evaluation Result
export interface ConditionEvaluationResult {
  conditionId: string;
  conditionName: string;
  passed: boolean;
  isBlocking: boolean;
  errorMessage?: string;
}

export interface ValidatorEvaluationResult {
  validatorId: string;
  validatorName: string;
  field: string;
  passed: boolean;
  errorMessage?: string;
}

export interface TransitionEvaluationResult {
  canTransition: boolean;
  conditionResults: ConditionEvaluationResult[];
  validatorResults: ValidatorEvaluationResult[];
  requiresApproval: boolean;
  pendingApproval?: IssueTransitionApproval;
  errors: string[];
  warnings: string[];
}

// Descriptions for UI
export const CONDITION_TYPE_DESCRIPTIONS: Record<ConditionType, string> = {
  required_fields: 'Require specific fields to be filled in',
  field_value: 'Check that a field has a specific value',
  permission: 'Require user to have a specific permission',
  assignee: 'Check assignee conditions',
  reporter: 'Check reporter conditions',
  resolution: 'Require a resolution to be set',
  custom_script: 'Run a custom validation script',
  linked_issues: 'Check linked issues status',
  subtasks_done: 'Require subtasks to be complete',
  time_logged: 'Require minimum time logged',
  approval: 'Require approval from specified users',
  project_role: 'Restrict transition to users with specific system or project roles',
};

export const VALIDATOR_TYPE_DESCRIPTIONS: Record<ValidatorType, string> = {
  validate_regex: 'Validate field matches a regular expression',
  validate_date_range: 'Validate date is within range',
  validate_numeric_range: 'Validate number is within range',
  validate_email: 'Validate field is a valid email address',
  validate_url: 'Validate field is a valid URL',
  validate_custom: 'Run custom validation logic',
};

export const POSTFUNCTION_TYPE_DESCRIPTIONS: Record<PostFunctionType, string> = {
  set_field: 'Set a field to a specific value',
  copy_field: 'Copy value from one field to another',
  clear_field: 'Clear field values',
  assign_to_reporter: 'Assign the issue to the reporter',
  assign_to_lead: 'Assign the issue to the project lead',
  unassign: 'Remove the assignee',
  add_comment: 'Add an automated comment',
  add_watcher: 'Add a watcher to the issue',
  send_notification: 'Send a notification',
  update_parent: 'Update parent issue status',
  trigger_webhook: 'Trigger a webhook',
};
