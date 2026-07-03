// Calendar Provider Types
export type CalendarProvider = 'google' | 'outlook';

// Calendar Integration Status
export interface CalendarIntegrationStatus {
  connected: boolean;
  provider: CalendarProvider | null;
  calendarName: string | null;
  syncDueDates: boolean;
  syncSprints: boolean;
  enabled: boolean;
}

// Calendar Integration (for responses)
export interface CalendarIntegration {
  id: string;
  provider: CalendarProvider;
  calendarName: string;
  syncDueDates: boolean;
  syncSprints: boolean;
  enabled: boolean;
}

// Calendar List Item
export interface CalendarListItem {
  id: string;
  name: string;
  primary: boolean;
  accessRole: 'owner' | 'writer' | 'reader';
  backgroundColor?: string;
}

// OAuth URL Response
export interface OAuthUrlResponse {
  url: string;
  provider: CalendarProvider;
}

// Sync Result
export interface CalendarSyncResult {
  success: boolean;
  eventId?: string;
  action: 'created' | 'updated' | 'deleted' | 'skipped';
  message?: string;
}

// Input Types
export interface ConnectCalendarInput {
  code: string;
  provider: CalendarProvider;
  state?: string;
}

export interface SelectCalendarInput {
  calendarId: string;
  calendarName: string;
}

export interface UpdateCalendarSettingsInput {
  syncDueDates?: boolean;
  syncSprints?: boolean;
  enabled?: boolean;
}

// Provider Info for UI
export interface CalendarProviderInfo {
  id: CalendarProvider;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export const CALENDAR_PROVIDERS: CalendarProviderInfo[] = [
  {
    id: 'google',
    name: 'Google Calendar',
    icon: 'google',
    description: 'Sync with your Google Calendar',
    color: '#4285F4',
  },
  {
    id: 'outlook',
    name: 'Outlook Calendar',
    icon: 'microsoft',
    description: 'Sync with your Outlook or Microsoft 365 Calendar',
    color: '#0078D4',
  },
];

// Feature Labels
export const SYNC_FEATURE_LABELS = {
  syncDueDates: {
    label: 'Sync Due Dates',
    description: 'Add issue due dates as calendar events',
  },
  syncSprints: {
    label: 'Sync Sprints',
    description: 'Add sprint dates as calendar events',
  },
};
