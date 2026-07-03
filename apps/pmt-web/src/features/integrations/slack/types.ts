// Slack Event Types
export type SlackEventType =
  | 'issue_created'
  | 'issue_updated'
  | 'issue_assigned'
  | 'issue_status_changed'
  | 'issue_commented'
  | 'sprint_started'
  | 'sprint_completed'
  | 'mention';

// Integration Status
export interface SlackIntegrationStatus {
  connected: boolean;
  workspace: {
    teamId: string;
    teamName: string;
    installedAt: string;
  } | null;
  channels: SlackChannelSummary[];
}

export interface SlackChannelSummary {
  channelId: string;
  channelName: string;
  events: SlackEventType[];
}

// Channel Config
export interface SlackChannelConfig {
  id: string;
  workspaceId: string;
  channelId: string;
  channelName: string;
  events: SlackEventType[];
  createdAt: string;
  updatedAt: string;
}

// Slack Channel
export interface SlackChannel {
  id: string;
  name: string;
}

// User Mapping
export interface SlackUserMapping {
  id: string;
  userId: string;
  slackUserId: string;
  slackUsername: string;
  workspaceId: string;
  createdAt: string;
}

// Input Types
export interface InstallSlackInput {
  code: string;
  redirectUri: string;
}

export interface ConfigureChannelInput {
  channelId: string;
  channelName: string;
  events: SlackEventType[];
}

export interface UpdateChannelConfigInput {
  events: SlackEventType[];
}

export interface LinkSlackUserInput {
  slackUserId: string;
  slackUsername: string;
}

export interface SendTestNotificationInput {
  channelId: string;
  event: SlackEventType;
}

// Event Labels
export const SLACK_EVENT_LABELS: Record<
  SlackEventType,
  { label: string; description: string }
> = {
  issue_created: {
    label: 'Issue Created',
    description: 'When a new issue is created',
  },
  issue_updated: {
    label: 'Issue Updated',
    description: 'When an issue is modified',
  },
  issue_assigned: {
    label: 'Issue Assigned',
    description: 'When an issue is assigned to someone',
  },
  issue_status_changed: {
    label: 'Status Changed',
    description: 'When an issue status changes',
  },
  issue_commented: {
    label: 'New Comment',
    description: 'When a comment is added to an issue',
  },
  sprint_started: {
    label: 'Sprint Started',
    description: 'When a sprint begins',
  },
  sprint_completed: {
    label: 'Sprint Completed',
    description: 'When a sprint is completed',
  },
  mention: {
    label: 'Mentions',
    description: 'When someone is mentioned',
  },
};

export const ALL_SLACK_EVENTS: SlackEventType[] = [
  'issue_created',
  'issue_updated',
  'issue_assigned',
  'issue_status_changed',
  'issue_commented',
  'sprint_started',
  'sprint_completed',
  'mention',
];

export const DEFAULT_SLACK_EVENTS: SlackEventType[] = [
  'issue_created',
  'issue_assigned',
  'issue_status_changed',
  'sprint_started',
];
