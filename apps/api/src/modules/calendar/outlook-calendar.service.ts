import axios from 'axios';
import {
  CalendarEvent,
  CalendarListItem,
  OutlookCalendarEvent,
  MicrosoftTokenResponse,
  CalendarSyncResult,
} from './calendar.types';
import { calendarRepository } from './calendar.repository';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || '';
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/integrations/outlook/callback';
const MICROSOFT_TENANT = process.env.MICROSOFT_TENANT || 'common';

const MICROSOFT_AUTH_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize`;
const MICROSOFT_TOKEN_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`;
const GRAPH_API = 'https://graph.microsoft.com/v1.0';

const SCOPES = [
  'Calendars.ReadWrite',
  'User.Read',
  'offline_access',
].join(' ');

class OutlookCalendarService {
  // OAuth Methods
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      redirect_uri: MICROSOFT_REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      response_mode: 'query',
      state,
    });

    return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<MicrosoftTokenResponse> {
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code,
      redirect_uri: MICROSOFT_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const response = await axios.post(MICROSOFT_TOKEN_URL, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  }

  async refreshAccessToken(refreshToken: string): Promise<MicrosoftTokenResponse> {
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await axios.post(MICROSOFT_TOKEN_URL, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  }

  // Calendar List Methods
  async listCalendars(accessToken: string): Promise<CalendarListItem[]> {
    const response = await axios.get(`${GRAPH_API}/me/calendars`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data.value.map((cal: any) => ({
      id: cal.id,
      name: cal.name,
      primary: cal.isDefaultCalendar || false,
      accessRole: cal.canEdit ? 'owner' : 'reader',
      backgroundColor: cal.hexColor,
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
  ): Promise<OutlookCalendarEvent> {
    const eventData: any = {
      subject: event.title,
      body: {
        contentType: 'HTML',
        content: event.description?.replace(/\n/g, '<br>') || '',
      },
    };

    if (event.isAllDay) {
      eventData.isAllDay = true;
      eventData.start = {
        dateTime: `${event.startDate.split('T')[0]}T00:00:00`,
        timeZone: 'UTC',
      };
      eventData.end = {
        dateTime: `${event.endDate.split('T')[0]}T23:59:59`,
        timeZone: 'UTC',
      };
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
      eventData.location = {
        displayName: event.location,
      };
    }

    // Add reminder
    eventData.reminderMinutesBeforeStart = 60;
    eventData.isReminderOn = true;

    const response = await axios.post(
      `${GRAPH_API}/me/calendars/${calendarId}/events`,
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
  ): Promise<OutlookCalendarEvent> {
    const eventData: any = {};

    if (event.title) {
      eventData.subject = event.title;
    }

    if (event.description) {
      eventData.body = {
        contentType: 'HTML',
        content: event.description.replace(/\n/g, '<br>'),
      };
    }

    if (event.startDate && event.endDate) {
      if (event.isAllDay) {
        eventData.isAllDay = true;
        eventData.start = {
          dateTime: `${event.startDate.split('T')[0]}T00:00:00`,
          timeZone: 'UTC',
        };
        eventData.end = {
          dateTime: `${event.endDate.split('T')[0]}T23:59:59`,
          timeZone: 'UTC',
        };
      } else {
        eventData.start = { dateTime: event.startDate, timeZone: 'UTC' };
        eventData.end = { dateTime: event.endDate, timeZone: 'UTC' };
      }
    }

    if (event.location) {
      eventData.location = { displayName: event.location };
    }

    const response = await axios.patch(
      `${GRAPH_API}/me/calendars/${calendarId}/events/${eventId}`,
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
    await axios.delete(`${GRAPH_API}/me/calendars/${calendarId}/events/${eventId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  async getEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<OutlookCalendarEvent | null> {
    try {
      const response = await axios.get(
        `${GRAPH_API}/me/calendars/${calendarId}/events/${eventId}`,
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
    const integration = await calendarRepository.findIntegrationByUserAndProvider(userId, 'outlook');

    if (!integration || !integration.enabled || !integration.syncDueDates) {
      return { success: false, action: 'skipped', message: 'Integration not enabled for due date sync' };
    }

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
        await this.updateEvent(accessToken, integration.calendarId, existingMapping.externalEventId, eventData);
        return { success: true, eventId: existingMapping.externalEventId, action: 'updated' };
      } else {
        const created = await this.createEvent(accessToken, integration.calendarId, eventData);
        await calendarRepository.createEventMapping({
          userId,
          issueId,
          sprintId: null,
          externalEventId: created.id,
          provider: 'outlook',
        });
        return { success: true, eventId: created.id, action: 'created' };
      }
    } catch (error: any) {
      console.error('Failed to sync issue due date to Outlook Calendar:', error);
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
    const integration = await calendarRepository.findIntegrationByUserAndProvider(userId, 'outlook');

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
          provider: 'outlook',
        });
        return { success: true, eventId: created.id, action: 'created' };
      }
    } catch (error: any) {
      console.error('Failed to sync sprint to Outlook Calendar:', error);
      return { success: false, action: 'skipped', message: error.message };
    }
  }

  async removeIssueDueDate(userId: string, issueId: string): Promise<CalendarSyncResult> {
    const integration = await calendarRepository.findIntegrationByUserAndProvider(userId, 'outlook');

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
      console.error('Failed to remove issue due date from Outlook Calendar:', error);
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
        refreshToken: tokens.refresh_token || refreshToken,
        tokenExpiresAt: newExpiresAt,
      });

      return tokens.access_token;
    }

    const integration = await calendarRepository.findIntegrationById(integrationId);
    return integration?.accessToken || '';
  }
}

export const outlookCalendarService = new OutlookCalendarService();
