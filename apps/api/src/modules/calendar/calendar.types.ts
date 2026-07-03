// Calendar Provider Types
export type CalendarProvider = 'google' | 'outlook';

// Calendar Integration
export interface CalendarIntegration {
  id: string;
  userId: string;
  provider: CalendarProvider;
  calendarId: string;
  calendarName: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  syncDueDates: boolean;
  syncSprints: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Calendar Event Mapping
export interface CalendarEventMapping {
  id: string;
  userId: string;
  issueId: string | null;
  sprintId: string | null;
  externalEventId: string;
  provider: CalendarProvider;
  createdAt: string;
}

// Calendar Event Data
export interface CalendarEvent {
  issueKey: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
  location?: string;
  url?: string;
}

// Calendar List Item
export interface CalendarListItem {
  id: string;
  name: string;
  primary: boolean;
  accessRole: 'owner' | 'writer' | 'reader';
  backgroundColor?: string;
}

// OAuth State
export interface OAuthState {
  userId: string;
  provider: CalendarProvider;
  returnUrl?: string;
}

// Input Types
export interface ConnectCalendarInput {
  code: string;
  provider: CalendarProvider;
}

export interface SelectCalendarInput {
  calendarId: string;
  calendarName: string;
}

export interface UpdateCalendarSettingsInput {
  syncDueDates?: boolean;
  syncSprints?: boolean;
  enabled?: boolean;
  calendarId?: string;
  calendarName?: string;
}

export interface SyncIssueDueDateInput {
  issueId: string;
  issueKey: string;
  title: string;
  description?: string;
  dueDate: string;
  url?: string;
}

export interface SyncSprintInput {
  sprintId: string;
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
  projectId: string;
}

// Response Types
export interface CalendarIntegrationStatus {
  connected: boolean;
  provider: CalendarProvider | null;
  calendarName: string | null;
  syncDueDates: boolean;
  syncSprints: boolean;
  enabled: boolean;
}

export interface OAuthUrlResponse {
  url: string;
  provider: CalendarProvider;
}

export interface CalendarSyncResult {
  success: boolean;
  eventId?: string;
  action: 'created' | 'updated' | 'deleted' | 'skipped';
  message?: string;
}

// Google OAuth Token Response
export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// Google Calendar Event
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink: string;
}

// Microsoft Graph Token Response
export interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// Microsoft Calendar Event
export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  body?: {
    contentType: string;
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  webLink: string;
}

// Webhook Payload Types
export interface GoogleWebhookPayload {
  kind: string;
  id: string;
  resourceUri: string;
  resourceId: string;
  token: string;
  expiration: number;
}

export interface OutlookWebhookPayload {
  value: Array<{
    subscriptionId: string;
    subscriptionExpirationDateTime: string;
    changeType: 'created' | 'updated' | 'deleted';
    resource: string;
    resourceData: {
      id: string;
    };
  }>;
}
