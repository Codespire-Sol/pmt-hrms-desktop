// Webhook Event Types
export type WebhookEventType =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'issue.transitioned'
  | 'issue.assigned'
  | 'issue.commented'
  | 'sprint.created'
  | 'sprint.started'
  | 'sprint.completed'
  | 'sprint.deleted'
  | 'project.updated'
  | 'project.member_added'
  | 'project.member_removed'
  | 'board.issue_moved'
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'attachment.created'
  | 'attachment.deleted';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type PayloadFormat = 'json' | 'form';
export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

// Main Webhook type
export interface Webhook {
  id: string;
  projectId: string;
  createdBy: string;
  name: string;
  description?: string;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  secret?: string;
  isEnabled: boolean;
  events: WebhookEventType[];
  maxRetries: number;
  retryDelaySeconds: number;
  exponentialBackoff: boolean;
  payloadFormat: PayloadFormat;
  customPayload?: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  lastDeliveryAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookWithCreator extends Webhook {
  creator: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
}

// Webhook Delivery Log
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  eventId?: string;
  payload: any;
  headersSent: Record<string, string>;
  requestUrl: string;
  requestMethod: string;
  status: DeliveryStatus;
  responseStatusCode?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  durationMs?: number;
  errorMessage?: string;
  attemptNumber: number;
  maxAttempts: number;
  nextRetryAt?: string;
  createdAt: string;
  completedAt?: string;
}

// Input Types
export interface CreateWebhookInput {
  name: string;
  description?: string;
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  secret?: string;
  events: WebhookEventType[];
  maxRetries?: number;
  retryDelaySeconds?: number;
  exponentialBackoff?: boolean;
  payloadFormat?: PayloadFormat;
  customPayload?: string;
}

export interface UpdateWebhookInput {
  name?: string;
  description?: string;
  url?: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  secret?: string;
  isEnabled?: boolean;
  events?: WebhookEventType[];
  maxRetries?: number;
  retryDelaySeconds?: number;
  exponentialBackoff?: boolean;
  payloadFormat?: PayloadFormat;
  customPayload?: string;
}

// Reference Data
export interface WebhookEventInfo {
  type: WebhookEventType;
  description: string;
}

// Event category grouping for UI
export const EVENT_CATEGORIES: Record<string, { label: string; events: WebhookEventType[] }> = {
  issues: {
    label: 'Issues',
    events: ['issue.created', 'issue.updated', 'issue.deleted', 'issue.transitioned', 'issue.assigned', 'issue.commented'],
  },
  sprints: {
    label: 'Sprints',
    events: ['sprint.created', 'sprint.started', 'sprint.completed', 'sprint.deleted'],
  },
  project: {
    label: 'Project',
    events: ['project.updated', 'project.member_added', 'project.member_removed'],
  },
  board: {
    label: 'Board',
    events: ['board.issue_moved'],
  },
  comments: {
    label: 'Comments',
    events: ['comment.created', 'comment.updated', 'comment.deleted'],
  },
  attachments: {
    label: 'Attachments',
    events: ['attachment.created', 'attachment.deleted'],
  },
};

export const EVENT_LABELS: Record<WebhookEventType, string> = {
  'issue.created': 'Issue Created',
  'issue.updated': 'Issue Updated',
  'issue.deleted': 'Issue Deleted',
  'issue.transitioned': 'Issue Transitioned',
  'issue.assigned': 'Issue Assigned',
  'issue.commented': 'Issue Commented',
  'sprint.created': 'Sprint Created',
  'sprint.started': 'Sprint Started',
  'sprint.completed': 'Sprint Completed',
  'sprint.deleted': 'Sprint Deleted',
  'project.updated': 'Project Updated',
  'project.member_added': 'Member Added',
  'project.member_removed': 'Member Removed',
  'board.issue_moved': 'Issue Moved on Board',
  'comment.created': 'Comment Created',
  'comment.updated': 'Comment Updated',
  'comment.deleted': 'Comment Deleted',
  'attachment.created': 'Attachment Created',
  'attachment.deleted': 'Attachment Deleted',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  success: 'Success',
  failed: 'Failed',
  retrying: 'Retrying',
};
