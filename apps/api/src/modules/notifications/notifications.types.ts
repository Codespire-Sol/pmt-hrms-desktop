export type NotificationType =
  | 'project_member_added'
  | 'issue_created'
  | 'issue_updated'
  | 'issue_assigned'
  | 'issue_commented'
  | 'issue_mentioned'
  | 'sprint_started'
  | 'sprint_ending'
  | 'due_date_approaching'
  | 'issue_status_changed'
  | 'hrms_announcement'
  | 'hrms_employee_status_changed'
  | 'hrms_manager_assigned'
  | 'hrms_role_changed'
  | 'hrms_onboarding_initiated'
  | 'hrms_onboarding_completed'
  | 'hrms_offboarding_initiated'
  | 'hrms_offboarding_completed'
  | 'hrms_leave_submitted'
  | 'hrms_leave_approved'
  | 'hrms_leave_rejected'
  | 'hrms_leave_cancelled'
  | 'hrms_payroll_generated'
  | 'hrms_payroll_finalized'
  | 'hrms_regularization_submitted'
  | 'hrms_regularization_approved'
  | 'hrms_regularization_rejected'
  | 'hrms_document_uploaded'
  | 'budget_alert_warning'
  | 'budget_alert_critical'
  | 'budget_alert_exceeded';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string | null;
  actorId: string | null;
  issueId: string | null;
  commentId: string | null;
  projectId: string | null;
  metadata: Record<string, any>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationWithDetails extends Notification {
  actor: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  issue: {
    id: string;
    issueKey: string;
    title: string;
  } | null;
  project: {
    id: string;
    name: string;
    key: string;
  } | null;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: NotificationType;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  actorId?: string;
  issueId?: string;
  commentId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

export interface NotifyParams {
  type: NotificationType;
  recipientIds: string[];
  actorId: string;
  issueId?: string;
  commentId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

export interface HrmsBroadcastParams {
  actorId: string;
  title: string;
  message: string;
  recipientUserIds: string[];
  type?: NotificationType;
  metadata?: Record<string, any>;
}

export interface UpdatePreferenceInput {
  notificationType: NotificationType;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, { title: string; description: string }> = {
  project_member_added: {
    title: 'Project Invitation',
    description: 'When you are added to a project',
  },
  issue_created: {
    title: 'Issue Created',
    description: 'When a new issue is created in your projects',
  },
  issue_updated: {
    title: 'Issue Updated',
    description: 'When an issue you watch is updated',
  },
  issue_assigned: {
    title: 'Issue Assignments',
    description: 'When an issue is assigned to you',
  },
  issue_commented: {
    title: 'Comments',
    description: 'When someone comments on issues you watch',
  },
  issue_mentioned: {
    title: 'Mentions',
    description: 'When someone mentions you in a comment',
  },
  sprint_started: {
    title: 'Sprint Start',
    description: 'When a sprint you are part of starts',
  },
  sprint_ending: {
    title: 'Sprint Ending',
    description: 'When a sprint is about to end',
  },
  due_date_approaching: {
    title: 'Due Dates',
    description: 'When issue due dates are approaching',
  },
  issue_status_changed: {
    title: 'Status Changes',
    description: 'When issue status changes',
  },
  hrms_announcement: {
    title: 'HRMS Announcements',
    description: 'General HRMS-wide announcements and updates',
  },
  hrms_employee_status_changed: {
    title: 'Employee Status Updates',
    description: 'When employee status changes (onboarding/active/notice/exited)',
  },
  hrms_manager_assigned: {
    title: 'Manager Assignment',
    description: 'When reporting manager is assigned or changed',
  },
  hrms_role_changed: {
    title: 'Role Changes',
    description: 'When employee role changes',
  },
  hrms_onboarding_initiated: {
    title: 'Onboarding Initiated',
    description: 'When onboarding is initiated for an employee',
  },
  hrms_onboarding_completed: {
    title: 'Onboarding Completed',
    description: 'When onboarding is completed and access is activated',
  },
  hrms_offboarding_initiated: {
    title: 'Offboarding Initiated',
    description: 'When offboarding is initiated for an employee',
  },
  hrms_offboarding_completed: {
    title: 'Offboarding Completed',
    description: 'When offboarding is completed and access is revoked',
  },
  hrms_leave_submitted: {
    title: 'Leave Submitted',
    description: 'When a leave request is submitted',
  },
  hrms_leave_approved: {
    title: 'Leave Approved',
    description: 'When a leave request is approved',
  },
  hrms_leave_rejected: {
    title: 'Leave Rejected',
    description: 'When a leave request is rejected',
  },
  hrms_leave_cancelled: {
    title: 'Leave Cancelled',
    description: 'When a leave request is cancelled',
  },
  hrms_payroll_generated: {
    title: 'Payroll Generated',
    description: 'When payroll/payslips are generated',
  },
  hrms_payroll_finalized: {
    title: 'Payroll Finalized',
    description: 'When payroll is finalized',
  },
  hrms_regularization_submitted: {
    title: 'Regularization Submitted',
    description: 'When an attendance regularization request is submitted',
  },
  hrms_regularization_approved: {
    title: 'Regularization Approved',
    description: 'When an attendance regularization request is approved',
  },
  hrms_regularization_rejected: {
    title: 'Regularization Rejected',
    description: 'When an attendance regularization request is rejected',
  },
  hrms_document_uploaded: {
    title: 'Document Uploaded',
    description: 'When an employee uploads a document during onboarding',
  },
  budget_alert_warning: {
    title: 'Budget Warning',
    description: 'When project budget reaches the warning threshold',
  },
  budget_alert_critical: {
    title: 'Budget Critical',
    description: 'When project budget reaches the critical threshold',
  },
  budget_alert_exceeded: {
    title: 'Budget Exceeded',
    description: 'When project budget is fully exceeded',
  },
};

export const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'project_member_added',
  'issue_created',
  'issue_updated',
  'issue_assigned',
  'issue_commented',
  'issue_mentioned',
  'sprint_started',
  'sprint_ending',
  'due_date_approaching',
  'issue_status_changed',
  'hrms_announcement',
  'hrms_employee_status_changed',
  'hrms_manager_assigned',
  'hrms_role_changed',
  'hrms_onboarding_initiated',
  'hrms_onboarding_completed',
  'hrms_offboarding_initiated',
  'hrms_offboarding_completed',
  'hrms_leave_submitted',
  'hrms_leave_approved',
  'hrms_leave_rejected',
  'hrms_leave_cancelled',
  'hrms_payroll_generated',
  'hrms_payroll_finalized',
  'hrms_regularization_submitted',
  'hrms_regularization_approved',
  'hrms_regularization_rejected',
  'hrms_document_uploaded',
  'budget_alert_warning',
  'budget_alert_critical',
  'budget_alert_exceeded',
];
