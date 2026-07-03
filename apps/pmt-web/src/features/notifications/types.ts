export type NotificationType =
  | 'issue_created'
  | 'issue_updated'
  | 'issue_assigned'
  | 'issue_commented'
  | 'issue_mentioned'
  | 'sprint_started'
  | 'sprint_ending'
  | 'due_date_approaching'
  | 'issue_status_changed';

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
  id: string | null;
  userId: string;
  notificationType: NotificationType;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  label: string;
  description: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface NotificationTypeInfo {
  type: NotificationType;
  title: string;
  description: string;
}

export interface NotificationsResponse {
  notifications: NotificationWithDetails[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface UpdatePreferenceInput {
  notificationType: NotificationType;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
}
