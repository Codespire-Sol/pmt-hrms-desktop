import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';
import {
  UpdateDashboardPreferencesInput,
  CreateDashboardShareInput,
  UpdateDashboardShareInput,
} from './dashboard.types';

export const dashboardController = {
  // GET /api/v1/dashboard
  async getUserDashboard(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const dashboard = await dashboardService.getUserDashboard(userId);

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error getting user dashboard:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get dashboard',
        },
      });
    }
  },

  // GET /api/v1/dashboard/assigned-issues
  async getAssignedIssues(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const issues = await dashboardService.getAssignedIssues(userId, Math.min(limit, 50));

      res.json({
        success: true,
        data: { issues },
      });
    } catch (error) {
      console.error('Error getting assigned issues:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get assigned issues',
        },
      });
    }
  },

  // GET /api/v1/dashboard/recent-activity
  async getRecentActivity(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const activity = await dashboardService.getRecentActivity(userId, Math.min(limit, 50));

      res.json({
        success: true,
        data: { activity },
      });
    } catch (error) {
      console.error('Error getting recent activity:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get recent activity',
        },
      });
    }
  },

  // GET /api/v1/dashboard/due-soon
  async getDueSoonIssues(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const days = parseInt(req.query.days as string, 10) || 7;
      const issues = await dashboardService.getDueSoonIssues(userId, Math.min(days, 30));

      res.json({
        success: true,
        data: { issues },
      });
    } catch (error) {
      console.error('Error getting due soon issues:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get due soon issues',
        },
      });
    }
  },

  // GET /api/v1/projects/:projectId/dashboard
  async getProjectDashboard(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const dashboard = await dashboardService.getProjectDashboard(projectId);

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error: any) {
      console.error('Error getting project dashboard:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get project dashboard',
        },
      });
    }
  },

  // ========== Dashboard Preferences ==========

  // GET /api/v1/dashboard/preferences
  async getDashboardPreferences(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const preferences = await dashboardService.getDashboardPreferences(userId, 'user');

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      console.error('Error getting dashboard preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get dashboard preferences',
        },
      });
    }
  },

  // PATCH /api/v1/dashboard/preferences
  async updateDashboardPreferences(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const input = req.body as UpdateDashboardPreferencesInput;

      const preferences = await dashboardService.updateDashboardPreferences(userId, 'user', input);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      console.error('Error updating dashboard preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update dashboard preferences',
        },
      });
    }
  },

  // POST /api/v1/dashboard/preferences/reset
  async resetDashboardPreferences(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const preferences = await dashboardService.resetDashboardPreferences(userId, 'user');

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      console.error('Error resetting dashboard preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reset dashboard preferences',
        },
      });
    }
  },

  // GET /api/v1/dashboard/full
  async getFullDashboard(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await dashboardService.getUserDashboardWithPreferences(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error getting full dashboard:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get dashboard',
        },
      });
    }
  },

  // GET /api/v1/projects/:projectId/dashboard/preferences
  async getProjectDashboardPreferences(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;

      const preferences = await dashboardService.getDashboardPreferences(userId, 'project', projectId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      console.error('Error getting project dashboard preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get dashboard preferences',
        },
      });
    }
  },

  // PATCH /api/v1/projects/:projectId/dashboard/preferences
  async updateProjectDashboardPreferences(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;
      const input = req.body as UpdateDashboardPreferencesInput;

      const preferences = await dashboardService.updateDashboardPreferences(
        userId,
        'project',
        input,
        projectId
      );

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      console.error('Error updating project dashboard preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update dashboard preferences',
        },
      });
    }
  },

  // POST /api/v1/projects/:projectId/dashboard/preferences/reset
  async resetProjectDashboardPreferences(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;

      const preferences = await dashboardService.resetDashboardPreferences(userId, 'project', projectId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      console.error('Error resetting project dashboard preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reset dashboard preferences',
        },
      });
    }
  },

  // GET /api/v1/projects/:projectId/dashboard/full
  async getFullProjectDashboard(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;

      const result = await dashboardService.getProjectDashboardWithPreferences(projectId, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error getting full project dashboard:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get project dashboard',
        },
      });
    }
  },

  // ========== Dashboard Sharing ==========

  // POST /api/v1/dashboard/shares
  async shareDashboard(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const input = req.body as CreateDashboardShareInput;

      const share = await dashboardService.shareDashboard(userId, input);

      res.status(201).json({
        success: true,
        data: share,
      });
    } catch (error: any) {
      console.error('Error sharing dashboard:', error);

      if (error.message.includes('not found') || error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message,
          },
        });
      }

      if (error.message.includes('already shared')) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to share dashboard',
        },
      });
    }
  },

  // GET /api/v1/dashboard/:dashboardId/shares
  async getSharesByDashboard(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { dashboardId } = req.params;

      const shares = await dashboardService.getSharesByDashboard(dashboardId, userId);

      res.json({
        success: true,
        data: shares,
      });
    } catch (error: any) {
      console.error('Error getting dashboard shares:', error);

      if (error.message.includes('not found') || error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get dashboard shares',
        },
      });
    }
  },

  // GET /api/v1/dashboard/shared-with-me
  async getSharedWithMe(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const sharedDashboards = await dashboardService.getSharedWithMe(userId);

      res.json({
        success: true,
        data: sharedDashboards,
      });
    } catch (error) {
      console.error('Error getting shared dashboards:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get shared dashboards',
        },
      });
    }
  },

  // GET /api/v1/dashboard/shared/:token
  async getSharedDashboardByToken(req: Request, res: Response) {
    try {
      const { token } = req.params;

      const share = await dashboardService.getSharedDashboardByToken(token);

      if (!share) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Shared dashboard not found or link has expired',
          },
        });
      }

      res.json({
        success: true,
        data: share,
      });
    } catch (error) {
      console.error('Error getting shared dashboard:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get shared dashboard',
        },
      });
    }
  },

  // PATCH /api/v1/dashboard/shares/:shareId
  async updateShare(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;
      const input = req.body as UpdateDashboardShareInput;

      const share = await dashboardService.updateShare(shareId, userId, input);

      res.json({
        success: true,
        data: share,
      });
    } catch (error: any) {
      console.error('Error updating share:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
      }

      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update share',
        },
      });
    }
  },

  // DELETE /api/v1/dashboard/shares/:shareId
  async deleteShare(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      await dashboardService.deleteShare(shareId, userId);

      res.json({
        success: true,
        message: 'Share deleted',
      });
    } catch (error: any) {
      console.error('Error deleting share:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
      }

      if (error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete share',
        },
      });
    }
  },

  // POST /api/v1/dashboard/shares/:shareId/regenerate-link
  async regeneratePublicLink(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      const share = await dashboardService.regeneratePublicLink(shareId, userId);

      res.json({
        success: true,
        data: share,
      });
    } catch (error: any) {
      console.error('Error regenerating link:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
      }

      if (error.message.includes('permission') || error.message.includes('public link')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to regenerate link',
        },
      });
    }
  },

  // POST /api/v1/dashboard/:dashboardId/public-link
  async createPublicLink(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { dashboardId } = req.params;
      const { expiresAt } = req.body;

      const share = await dashboardService.createPublicLink(dashboardId, userId, expiresAt);

      res.status(201).json({
        success: true,
        data: share,
      });
    } catch (error: any) {
      console.error('Error creating public link:', error);

      if (error.message.includes('not found') || error.message.includes('permission')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create public link',
        },
      });
    }
  },

  // ============================================================
  // ROLE-BASED DASHBOARD CONTROLLERS
  // ============================================================

  // GET /api/v1/dashboard/admin
  async getAdminDashboard(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const data = await dashboardService.getAdminDashboard(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting admin dashboard:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get admin dashboard' },
      });
    }
  },

  // GET /api/v1/dashboard/manager
  async getManagerDashboard(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const data = await dashboardService.getManagerDashboard(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting manager dashboard:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get manager dashboard' },
      });
    }
  },

  // GET /api/v1/dashboard/employee
  async getEmployeeDashboard(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const data = await dashboardService.getEmployeeDashboard(userId);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error getting employee dashboard:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get employee dashboard' },
      });
    }
  },

  // ============================================================
  // CHART DATA CONTROLLERS
  // ============================================================

  // GET /api/v1/dashboard/charts/gantt
  // ?view=monthly|quarterly|halfYearly|annually  (default: monthly)
  async getGanttChartData(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const {
        projectId,
        projectIds,
        assigneeId,
        sprintId,
        epicId,
        view,
      } = req.query as Record<string, string>;

      const VALID_VIEWS = ['weekly', 'monthly', 'quarterly', 'halfYearly', 'annually'] as const;
      type GanttViewLocal = typeof VALID_VIEWS[number];
      const resolvedView: GanttViewLocal = VALID_VIEWS.includes(view as GanttViewLocal)
        ? (view as GanttViewLocal)
        : 'monthly';

      const data = await dashboardService.getGanttChartData(userId, {
        projectId,
        projectIds: projectIds ? projectIds.split(',') : undefined,
        assigneeId,
        sprintId,
        epicId,
        view: resolvedView,
      });

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error getting gantt chart data:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get gantt chart data' },
      });
    }
  },

  // GET /api/v1/dashboard/charts/velocity?projectId=xxx&limit=10
  async getVelocityChartData(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { projectId } = req.query as { projectId?: string };
      const limit = parseInt(req.query.limit as string, 10) || 10;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'projectId query parameter is required' },
        });
      }

      const data = await dashboardService.getVelocityChartData(
        userId,
        projectId,
        Math.min(limit, 20)
      );
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error getting velocity chart:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get velocity chart data' },
      });
    }
  },

  // GET /api/v1/dashboard/charts/burndown?sprintId=xxx
  async getBurndownChartData(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { sprintId } = req.query as { sprintId?: string };

      if (!sprintId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'sprintId query parameter is required' },
        });
      }

      const data = await dashboardService.getBurndownChartData(userId, sprintId);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error getting burndown chart:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get burndown chart data' },
      });
    }
  },

  // GET /api/v1/dashboard/charts/cumulative-flow?projectId=xxx&days=30
  async getCumulativeFlowData(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { projectId } = req.query as { projectId?: string };
      const days = parseInt(req.query.days as string, 10) || 30;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'projectId query parameter is required' },
        });
      }

      const data = await dashboardService.getCumulativeFlowData(
        userId,
        projectId,
        Math.min(days, 90)
      );
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error getting cumulative flow data:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get cumulative flow data' },
      });
    }
  },
};
