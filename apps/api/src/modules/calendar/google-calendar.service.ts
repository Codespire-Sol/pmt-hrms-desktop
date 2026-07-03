import axios from 'axios';
import {
  CalendarEvent,
  CalendarListItem,
  GoogleCalendarEvent,
  GoogleTokenResponse,
  CalendarSyncResult,
} from './calendar.types';
import { calendarRepository } from './calendar.repository';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/integrations/google/callback';
const _APP_URL = process.env.APP_URL || 'http://localhost:3001';

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

class GoogleCalendarService {
  // OAuth Methods
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
    try {
      const params = new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      const response = await axios.post(GOOGLE_TOKEN_URL, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      return response.data;
    } catch (error: any) {
      console.error('Google token exchange failed:', {
        status: error.response?.status,
        data: error.response?.data,
        redirect_uri: GOOGLE_REDIRECT_URI,
      });
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    });

    const response = await axios.post(GOOGLE_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return response.data;
  }

  // Calendar List Methods
  async listCalendars(accessToken: string): Promise<CalendarListItem[]> {
    const response = await axios.get(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data.items.map((cal: any) => ({
      id: cal.id,
      name: cal.summary,
      primary: cal.primary || false,
      accessRole: cal.accessRole,
      backgroundColor: cal.backgroundColor,
    }));
  }

  async getPrimaryCalendar(accessToken: string): Promise<CalendarListItem | null> {
    const calendars = await this.listCalendars(accessToken);
    return calendars.find((cal) => cal.primary) || calendars[0] || null;
  }

  // Event Methods
  async createEvent(
    accessToken: string,
    calendarId: string,
    event: CalendarEvent
  ): Promise<GoogleCalendarEvent> {
    const eventData: any = {
      summary: event.title,
      description: event.description,
    };

    if (event.isAllDay) {
      // All-day event uses date format
      const startDate = event.startDate.split('T')[0];
      const endDate = event.endDate.split('T')[0];
      eventData.start = { date: startDate };
      eventData.end = { date: endDate };
    } else {
      eventData.start = {
        dateTime: event.startDate,
        timeZone: 'UTC',
      };
      eventData.end = {
        dateTime: event.endDate,
        timeZone: 'UTC',
      };
    }

    if (event.location) {
      eventData.location = event.location;
    }

    // Add reminders
    eventData.reminders = {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'email', minutes: 1440 }, // 24 hours
      ],
    };

    const response = await axios.post(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      eventData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<CalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    const eventData: any = {};

    if (event.title) {
      eventData.summary = event.title;
    }

    if (event.description) {
      eventData.description = event.description;
    }

    if (event.startDate && event.endDate) {
      if (event.isAllDay) {
        eventData.start = { date: event.startDate.split('T')[0] };
        eventData.end = { date: event.endDate.split('T')[0] };
      } else {
        eventData.start = { dateTime: event.startDate, timeZone: 'UTC' };
        eventData.end = { dateTime: event.endDate, timeZone: 'UTC' };
      }
    }

    if (event.location) {
      eventData.location = event.location;
    }

    const response = await axios.patch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      eventData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    await axios.delete(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  }

  async getEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<GoogleCalendarEvent | null> {
    try {
      const response = await axios.get(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  // Sync Methods
  async syncIssueDueDate(
    userId: string,
    issueId: string,
    issueKey: string,
    title: string,
    description: string,
    dueDate: string,
    issueUrl: string
  ): Promise<CalendarSyncResult> {
    const integration = await calendarRepository.findIntegrationByUserAndProvider(userId, 'google');

    if (!integration || !integration.enabled || !integration.syncDueDates) {
      return { success: false, action: 'skipped', message: 'Integration not enabled for due date sync' };
    }

    // Check if token needs refresh
    const accessToken = await this.ensureValidToken(integration.id, integration.refreshToken, integration.tokenExpiresAt);

    const existingMapping = await calendarRepository.findEventMappingByIssue(userId, issueId);

    const eventData: CalendarEvent = {
      issueKey,
      title: `[${issueKey}] ${title}`,
      description: `${description || ''}\n\nView issue: ${issueUrl}`,
      startDate: dueDate,
      endDate: dueDate,
      isAllDay: true,
      url: issueUrl,
    };

    try {
      if (existingMapping) {
        // Update existing event
        await this.updateEvent(accessToken, integration.calendarId, existingMapping.externalEventId, eventData);
        return { success: true, eventId: existingMapping.externalEventId, action: 'updated' };
      } else {
        // Create new event
        const created = await this.createEvent(accessToken, integration.calendarId, eventData);
        await calendarRepository.createEventMapping({
          userId,
          issueId,
          sprintId: null,
          externalEventId: created.id,
          provider: 'google',
        });
        return { success: true, eventId: created.id, action: 'created' };
      }
    } catch (error: any) {
      console.error('Failed to sync issue due date to Google Calendar:', error);
      return { success: false, action: 'skipped', message: error.message };
    }
  }

  async syncSprint(
    userId: string,
    sprintId: string,
    name: string,
    goal: string,
    startDate: string,
    endDate: string
  ): Promise<CalendarSyncResult> {
    const integration = await calendarRepository.findIntegrationByUserAndProvider(userId, 'google');

    if (!integration || !integration.enabled || !integration.syncSprints) {
      return { success: false, action: 'skipped', message: 'Integration not enabled for sprint sync' };
    }

    const accessToken = await this.ensureValidToken(integration.id, integration.refreshToken, integration.tokenExpiresAt);

    const existingMapping = await calendarRepository.findEventMappingBySprint(userId, sprintId);

    const eventData: CalendarEvent = {
      issueKey: name,
      title: `Sprint: ${name}`,
      description: goal ? `Sprint Goal: ${goal}` : `Sprint: ${name}`,
      startDate,
      endDate,
      isAllDay: true,
    };

    try {
      if (existingMapping) {
        await this.updateEvent(accessToken, integration.calendarId, existingMapping.externalEventId, eventData);
        return { success: true, eventId: existingMapping.externalEventId, action: 'updated' };
      } else {
        const created = await this.createEvent(accessToken, integration.calendarId, eventData);
        await calendarRepository.createEventMapping({
          userId,
          issueId: null,
          sprintId,
          externalEventId: created.id,
          provider: 'google',
        });
        return { success: true, eventId: created.id, action: 'created' };
      }
    } catch (error: any) {
      console.error('Failed to sync sprint to Google Calendar:', error);
      return { success: false, action: 'skipped', message: error.message };
    }
  }

  async removeIssueDueDate(userId: string, issueId: string): Promise<CalendarSyncResult> {
    const integration = await calendarRepository.findIntegrationByUserAndProvider(userId, 'google');

    if (!integration) {
      return { success: false, action: 'skipped', message: 'No integration found' };
    }

    const mapping = await calendarRepository.findEventMappingByIssue(userId, issueId);

    if (!mapping) {
      return { success: false, action: 'skipped', message: 'No event mapping found' };
    }

    try {
      const accessToken = await this.ensureValidToken(integration.id, integration.refreshToken, integration.tokenExpiresAt);
      await this.deleteEvent(accessToken, integration.calendarId, mapping.externalEventId);
      await calendarRepository.deleteEventMapping(mapping.id);
      return { success: true, action: 'deleted' };
    } catch (error: any) {
      console.error('Failed to remove issue due date from Google Calendar:', error);
      return { success: false, action: 'skipped', message: error.message };
    }
  }

  // Token Management
  private async ensureValidToken(
    integrationId: string,
    refreshToken: string,
    tokenExpiresAt: string
  ): Promise<string> {
    const expiresAt = new Date(tokenExpiresAt);
    const now = new Date();

    // Refresh if token expires in less than 5 minutes
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      const tokens = await this.refreshAccessToken(refreshToken);
      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await calendarRepository.updateIntegration(integrationId, {
        accessToken: tokens.access_token,
        tokenExpiresAt: newExpiresAt,
      });

      return tokens.access_token;
    }

    const integration = await calendarRepository.findIntegrationById(integrationId);
    return integration?.accessToken || '';
  }
}

export const googleCalendarService = new GoogleCalendarService();
