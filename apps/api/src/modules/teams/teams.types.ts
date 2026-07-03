import { WebhookEventType } from '../webhooks/webhooks.types';

// ── Teams Config ──────────────────────────────────────────────────────────────
export interface TeamsConfig {
  projectId: string;
  webhookUrl: string;
  isEnabled: boolean;
  events: WebhookEventType[];
  notifyOnMention: boolean;
  includeIssueDetails: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertTeamsConfigInput {
  webhookUrl: string;
  isEnabled?: boolean;
  events?: WebhookEventType[];
  notifyOnMention?: boolean;
  includeIssueDetails?: boolean;
}

export interface TeamsConfigStatus {
  connected: boolean;
  config: TeamsConfig | null;
}

// ── Adaptive Card types (Teams card schema) ───────────────────────────────────
export interface AdaptiveCardBody {
  type: string;
  [key: string]: any;
}

export interface AdaptiveCard {
  type: 'AdaptiveCard';
  version: string;
  body: AdaptiveCardBody[];
  actions?: AdaptiveCardAction[];
  $schema?: string;
  msteams?: {
    width?: 'Full' | 'Auto';
    entities?: Array<{ type: string; text: string; mentioned?: any }>;
  };
}

export interface AdaptiveCardAction {
  type: 'Action.OpenUrl' | 'Action.Submit' | 'Action.ShowCard';
  title: string;
  url?: string;
  data?: Record<string, any>;
}

// Teams Incoming Webhook payload
export interface TeamsWebhookPayload {
  type: 'message';
  attachments: Array<{
    contentType: 'application/vnd.microsoft.card.adaptive';
    content: AdaptiveCard;
  }>;
}
