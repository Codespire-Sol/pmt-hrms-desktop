import {
  CalendarProvider,
  CalendarIntegration,
  CalendarIntegrationStatus,
  CalendarListItem,
  CalendarSyncResult,
  OAuthState,
  UpdateCalendarSettingsInput,
} from './calendar.types';
import { calendarRepository } from './calendar.repository';
import { googleCalendarService } from './google-calendar.service';
import { outlookCalendarService } from './outlook-calendar.service';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

class CalendarService {
  // OAuth Methods
  getOAuthUrl(userId: string, provider: CalendarProvider, returnUrl?: string): string {
    const state: OAuthState = { userId, provider, returnUrl };
    const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');

    if (provider === 'google') {
      return googleCalendarService.getAuthorizationUrl(encodedState);
    } else {
      return outlookCalendarService.getAuthorizationUrl(encodedState);
    }
  }

  parseOAuthState(stateStr: string): OAuthState {
    const decoded = Buffer.from(stateStr, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  }

  async handleOAuthCallback(
    code: string,
    provider: CalendarProvider,
    userId: string
  ): Promise<CalendarIntegration> {
    // Exchange code for tokens
    let tokens;
    let calendars: CalendarListItem[];

    if (provider === 'google') {
      tokens = await googleCalendarService.exchangeCodeForTokens(code);
      calendars = await googleCalendarService.listCalendars(tokens.access_token);
    } else {
      tokens = await outlookCalendarService.exchangeCodeForTokens(code);
      calendars = await outlookCalendarService.listCalendars(tokens.access_token);
    }

    // Get primary calendar
    const primaryCalendar = calendars.find((c) => c.primary) || calendars[0];

    if (!primaryCalendar) {
      throw new Error('No calendars found');
    }

    // Check for existing integration
    const existingIntegration = await calendarRepository.findIntegrationByUserAndProvider(
      userId,
      provider
    );

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    if (existingIntegration) {
      // Update existing integration
      const updated = await calendarRepository.updateIntegration(existingIntegration.id, {
        calendarId: primaryCalendar.id,
        calendarName: primaryCalendar.name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || existingIntegration.refreshToken,
        tokenExpiresAt,
        enabled: true,
      });
      return updated!;
    }

    // Create new integration
    return calendarRepository.createIntegration({
      userId,
      provider,
      calendarId: primaryCalendar.id,
      calendarName: primaryCalendar.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      tokenExpiresAt,
      syncDueDates: true,
      syncSprints: true,
      enabled: true,
    });
  }

  // Integration Management
  async getIntegrationStatus(userId: string): Promise<CalendarIntegrationStatus> {
    const integration = await calendarRepository.findIntegrationByUserId(userId);

    if (!integration) {
      return {
        connected: false,
        provider: null,
        calendarName: null,
        syncDueDates: false,
        syncSprints: false,
        enabled: false,
      };
    }

    return {
      connected: true,
      provider: integration.provider,
      calendarName: integration.calendarName,
      syncDueDates: integration.syncDueDates,
      syncSprints: integration.syncSprints,
      enabled: integration.enabled,
    };
  }

  async getIntegration(userId: string): Promise<CalendarIntegration | null> {
    return calendarRepository.findIntegrationByUserId(userId);
  }

  async updateIntegrationSettings(
    userId: string,
    settings: UpdateCalendarSettingsInput
  ): Promise<CalendarIntegration | null> {
    const integration = await calendarRepository.findIntegrationByUserId(userId);

    if (!integration) {
      throw new Error('No integration found');
    }

    return calendarRepository.updateIntegration(integration.id, settings);
  }

  async disconnectIntegration(userId: string): Promise<boolean> {
    return calendarRepository.deleteIntegrationByUserId(userId);
  }

  // Calendar List
  async listCalendars(userId: string): Promise<CalendarListItem[]> {
    const integration = await calendarRepository.findIntegrationByUserId(userId);

    if (!integration) {
      return [];
    }

    try {
      if (integration.provider === 'google') {
        return googleCalendarService.listCalendars(integration.accessToken);
      } else {
        return outlookCalendarService.listCalendars(integration.accessToken);
      }
    } catch {
      return [];
    }
  }

  async selectCalendar(
    userId: string,
    calendarId: string,
    calendarName: string
  ): Promise<CalendarIntegration | null> {
    const integration = await calendarRepository.findIntegrationByUserId(userId);

    if (!integration) {
      throw new Error('No integration found');
    }

    return calendarRepository.updateIntegration(integration.id, {
      calendarId,
      calendarName,
    });
  }

  // Sync Methods
  async syncIssueDueDate(
    issueId: string,
    issueKey: string,
    title: string,
    description: string,
    dueDate: string,
    assigneeId: string | null
  ): Promise<CalendarSyncResult> {
    if (!assigneeId) {
      return { success: false, action: 'skipped', message: 'No assignee' };
    }

    const integration = await calendarRepository.findIntegrationByUserId(assigneeId);

    if (!integration || !integration.enabled || !integration.syncDueDates) {
      return { success: false, action: 'skipped', message: 'Sync not enabled' };
    }

    const issueUrl = `${APP_URL}/issues/${issueId}`;

    if (integration.provider === 'google') {
      return googleCalendarService.syncIssueDueDate(
        assigneeId,
        issueId,
        issueKey,
        title,
        description,
        dueDate,
        issueUrl
      );
    } else {
      return outlookCalendarService.syncIssueDueDate(
        assigneeId,
        issueId,
        issueKey,
        title,
        description,
        dueDate,
        issueUrl
      );
    }
  }

  async removeIssueDueDate(issueId: string, assigneeId: string | null): Promise<CalendarSyncResult> {
    if (!assigneeId) {
      return { success: false, action: 'skipped', message: 'No assignee' };
    }

    const integration = await calendarRepository.findIntegrationByUserId(assigneeId);

    if (!integration) {
      return { success: false, action: 'skipped', message: 'No integration found' };
    }

    if (integration.provider === 'google') {
      return googleCalendarService.removeIssueDueDate(assigneeId, issueId);
    } else {
      return outlookCalendarService.removeIssueDueDate(assigneeId, issueId);
    }
  }

  async syncSprintToUsers(
    sprintId: string,
    name: string,
    goal: string,
    startDate: string,
    endDate: string,
    userIds: string[]
  ): Promise<Map<string, CalendarSyncResult>> {
    const results = new Map<string, CalendarSyncResult>();

    for (const userId of userIds) {
      const integration = await calendarRepository.findIntegrationByUserId(userId);

      if (!integration || !integration.enabled || !integration.syncSprints) {
        results.set(userId, { success: false, action: 'skipped', message: 'Sync not enabled' });
        continue;
      }

      let result: CalendarSyncResult;

      if (integration.provider === 'google') {
        result = await googleCalendarService.syncSprint(userId, sprintId, name, goal, startDate, endDate);
      } else {
        result = await outlookCalendarService.syncSprint(userId, sprintId, name, goal, startDate, endDate);
      }

      results.set(userId, result);
    }

    return results;
  }

  // Bulk Sync (for initial sync or re-sync)
  async syncAllIssuesForUser(userId: string, issues: Array<{
    id: string;
    key: string;
    title: string;
    description: string;
    dueDate: string;
  }>): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    for (const issue of issues) {
      const result = await this.syncIssueDueDate(
        issue.id,
        issue.key,
        issue.title,
        issue.description,
        issue.dueDate,
        userId
      );

      if (result.success) {
        synced++;
      } else {
        failed++;
      }
    }

    return { synced, failed };
  }
}

export const calendarService = new CalendarService();
