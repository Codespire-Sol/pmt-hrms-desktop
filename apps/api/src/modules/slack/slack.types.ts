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

// Slack Workspace Integration
export interface SlackWorkspace {
  id: string;
  projectId: string;
  teamId: string;
  teamName: string;
  accessToken: string;
  botUserId: string;
  defaultChannelId: string | null;
  installedBy: string;
  installedAt: string;
  updatedAt: string;
}

// Slack Channel Configuration
export interface SlackChannelConfig {
  id: string;
  workspaceId: string;
  channelId: string;
  channelName: string;
  events: SlackEventType[];
  createdAt: string;
  updatedAt: string;
}

// Slack User Mapping
export interface SlackUserMapping {
  id: string;
  userId: string;
  slackUserId: string;
  slackUsername: string;
  workspaceId: string;
  createdAt: string;
}

// OAuth Response
export interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
}

// Slack Command
export interface SlackCommand {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

// Slack Command Response
export interface SlackCommandResponse {
  response_type?: 'in_channel' | 'ephemeral';
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

// Slack Block Types
export interface SlackBlock {
  type: 'section' | 'divider' | 'actions' | 'context' | 'header';
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: 'plain_text' | 'mrkdwn';
    text: string;
  }>;
  elements?: SlackBlockElement[];
  accessory?: SlackBlockElement;
  block_id?: string;
}

export interface SlackBlockElement {
  type: 'button' | 'static_select' | 'overflow' | 'image' | 'plain_text' | 'mrkdwn';
  text?: string | {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  action_id?: string;
  url?: string;
  value?: string;
  style?: 'primary' | 'danger';
  options?: Array<{
    text: { type: 'plain_text'; text: string };
    value: string;
  }>;
  image_url?: string;
  alt_text?: string;
}

export interface SlackAttachment {
  color?: string;
  blocks?: SlackBlock[];
  fallback?: string;
}

// Slack Interactive Payload
export interface SlackInteractivePayload {
  type: 'block_actions' | 'view_submission' | 'shortcut';
  user: {
    id: string;
    username: string;
    name: string;
    team_id: string;
  };
  team: {
    id: string;
    domain: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  actions?: Array<{
    action_id: string;
    block_id: string;
    type: string;
    value?: string;
    selected_option?: {
      value: string;
    };
  }>;
  trigger_id: string;
  response_url: string;
  message?: {
    ts: string;
    text: string;
  };
}

// Input/Output Types
export interface InstallSlackInput {
  projectId: string;
  code: string;
  redirectUri: string;
}

export interface ConfigureChannelInput {
  workspaceId: string;
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
  workspaceId: string;
}

export interface SendNotificationInput {
  projectId: string;
  event: SlackEventType;
  issueId?: string;
  sprintId?: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}

// Response Types
export interface SlackIntegrationStatus {
  connected: boolean;
  workspace: {
    teamId: string;
    teamName: string;
    installedAt: string;
  } | null;
  channels: Array<{
    channelId: string;
    channelName: string;
    events: SlackEventType[];
  }>;
}

export interface SlackInstallResponse {
  success: boolean;
  workspace: SlackWorkspace;
  authUrl?: string;
}

// Event Labels and Configuration
export const SLACK_EVENT_LABELS: Record<SlackEventType, { label: string; description: string }> = {
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
