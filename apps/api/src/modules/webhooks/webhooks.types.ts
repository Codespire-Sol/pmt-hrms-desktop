// Webhook Events
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

export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEventType, string> = {
  'issue.created': 'When an issue is created',
  'issue.updated': 'When an issue is updated',
  'issue.deleted': 'When an issue is deleted',
  'issue.transitioned': 'When an issue changes status',
  'issue.assigned': 'When an issue is assigned',
  'issue.commented': 'When a comment is added to an issue',
  'sprint.created': 'When a sprint is created',
  'sprint.started': 'When a sprint is started',
  'sprint.completed': 'When a sprint is completed',
  'sprint.deleted': 'When a sprint is deleted',
  'project.updated': 'When project settings are updated',
  'project.member_added': 'When a member is added to the project',
  'project.member_removed': 'When a member is removed from the project',
  'board.issue_moved': 'When an issue is moved on the board',
  'comment.created': 'When a comment is created',
  'comment.updated': 'When a comment is updated',
  'comment.deleted': 'When a comment is deleted',
  'attachment.created': 'When an attachment is added',
  'attachment.deleted': 'When an attachment is deleted',
};

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
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  createdAt: Date;
  updatedAt: Date;
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
  nextRetryAt?: Date;
  createdAt: Date;
  completedAt?: Date;
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

// Event Payload Types
export interface WebhookEventPayload {
  event: WebhookEventType;
  timestamp: string;
  projectId: string;
  projectName?: string;
  actor?: {
    id: string;
    displayName: string;
    email: string;
  };
  data: any;
}

// Delivery Queue Item
export interface DeliveryQueueItem {
  webhookId: string;
  deliveryId: string;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  payload: any;
  secret?: string;
  attemptNumber: number;
  maxAttempts: number;
}
