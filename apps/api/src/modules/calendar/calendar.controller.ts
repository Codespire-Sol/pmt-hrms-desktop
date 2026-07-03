import { Request, Response, NextFunction } from 'express';
import { calendarService } from './calendar.service';
import {
  connectCalendarSchema,
  selectCalendarSchema,
  updateCalendarSettingsSchema,
  getOAuthUrlSchema,
} from './calendar.validator';

// Extended request with user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roleId: string;
    role?: {
      id: string;
      name: string;
      displayName: string;
    };
  };
}

class CalendarController {
  // Get OAuth URL
  async getOAuthUrl(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const validated = getOAuthUrlSchema.parse(req.query);
      const url = calendarService.getOAuthUrl(userId, validated.provider, validated.returnUrl);

      res.json({
        success: true,
        data: { url, provider: validated.provider },
      });
    } catch (error) {
      next(error);
    }
  }

  // Handle OAuth callback
  async handleOAuthCallback(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const validated = connectCalendarSchema.parse(req.body);

      // Parse state to get userId
      let userId = req.user?.id;
      if (validated.state) {
        const state = calendarService.parseOAuthState(validated.state);
        userId = state.userId;
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const integration = await calendarService.handleOAuthCallback(
        validated.code,
        validated.provider,
        userId
      );

      res.status(201).json({
        success: true,
        data: {
          integration: {
            id: integration.id,
            provider: integration.provider,
            calendarName: integration.calendarName,
            syncDueDates: integration.syncDueDates,
            syncSprints: integration.syncSprints,
            enabled: integration.enabled,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get integration status
  async getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const status = await calendarService.getIntegrationStatus(userId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  // Update integration settings
  async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const validated = updateCalendarSettingsSchema.parse(req.body);
      const integration = await calendarService.updateIntegrationSettings(userId, validated);

      if (!integration) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No integration found' },
        });
      }

      res.json({
        success: true,
        data: {
          integration: {
            id: integration.id,
            provider: integration.provider,
            calendarName: integration.calendarName,
            syncDueDates: integration.syncDueDates,
            syncSprints: integration.syncSprints,
            enabled: integration.enabled,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Disconnect integration
  async disconnect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      await calendarService.disconnectIntegration(userId);

      res.json({
        success: true,
        data: { message: 'Calendar integration disconnected' },
      });
    } catch (error) {
      next(error);
    }
  }

  // List available calendars
  async listCalendars(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const calendars = await calendarService.listCalendars(userId);

      res.json({
        success: true,
        data: { calendars },
      });
    } catch (error) {
      next(error);
    }
  }

  // Select a calendar
  async selectCalendar(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const validated = selectCalendarSchema.parse(req.body);
      const integration = await calendarService.selectCalendar(
        userId,
        validated.calendarId,
        validated.calendarName
      );

      if (!integration) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No integration found' },
        });
      }

      res.json({
        success: true,
        data: {
          integration: {
            id: integration.id,
            provider: integration.provider,
            calendarName: integration.calendarName,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Manual sync trigger for issues (internal use)
  async syncIssueDueDate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { issueId, issueKey, title, description, dueDate, assigneeId } = req.body;

      const result = await calendarService.syncIssueDueDate(
        issueId,
        issueKey,
        title,
        description || '',
        dueDate,
        assigneeId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Remove issue from calendar (internal use)
  async removeIssueDueDate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { issueId, assigneeId } = req.body;

      const result = await calendarService.removeIssueDueDate(issueId, assigneeId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Manual sync trigger for sprints (internal use)
  async syncSprint(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { sprintId, name, goal, startDate, endDate, userIds } = req.body;

      const results = await calendarService.syncSprintToUsers(
        sprintId,
        name,
        goal || '',
        startDate,
        endDate,
        userIds
      );

      const resultArray: { userId: string; result: any }[] = [];
      results.forEach((result, userId) => {
        resultArray.push({ userId, result });
      });

      res.json({
        success: true,
        data: { results: resultArray },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const calendarController = new CalendarController();
