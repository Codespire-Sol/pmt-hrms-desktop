import { Request, Response } from 'express';
import { z } from 'zod';
import { scheduledReportsService } from '../../services/scheduledReports.service';

const createScheduledReportSchema = z.object({
  name: z.string().min(1).max(255),
  reportType: z.enum(['sprint', 'team_workload', 'time_tracking', 'distribution'] as const),
  format: z.enum(['pdf', 'csv', 'json'] as const).optional(),
  projectId: z.string().uuid().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly'] as const),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Must be in HH:MM format').optional(),
  timezone: z.string().optional(),
  recipients: z.array(z.string().email()).min(0),
  includeSelf: z.boolean().optional(),
  filters: z.record(z.any()).optional(),
});

const updateScheduledReportSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  format: z.enum(['pdf', 'csv', 'json'] as const).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly'] as const).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Must be in HH:MM format').optional(),
  timezone: z.string().optional(),
  recipients: z.array(z.string().email()).optional(),
  includeSelf: z.boolean().optional(),
  filters: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

export const scheduledReportsController = {
  /**
   * Create a new scheduled report
   * POST /api/v1/reports/scheduled
   */
  async create(req: Request, res: Response) {
    try {
      const input = createScheduledReportSchema.parse(req.body);
      const userId = req.user!.id;

      // Validate project-specific requirements
      if (['sprint', 'team_workload', 'distribution'].includes(input.reportType) && !input.projectId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Project ID is required for this report type' },
        });
      }

      // Validate weekly schedule
      if (input.frequency === 'weekly' && input.dayOfWeek === undefined) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Day of week is required for weekly reports' },
        });
      }

      // Validate monthly schedule
      if (input.frequency === 'monthly' && input.dayOfMonth === undefined) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Day of month is required for monthly reports' },
        });
      }

      const report = await scheduledReportsService.create(userId, input as any);

      res.status(201).json({
        success: true,
        message: 'Scheduled report created successfully',
        data: report,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      console.error('Error creating scheduled report:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create scheduled report' },
      });
    }
  },

  /**
   * Get all scheduled reports for the current user
   * GET /api/v1/reports/scheduled
   */
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const reports = await scheduledReportsService.getByUser(userId);

      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      console.error('Error listing scheduled reports:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list scheduled reports' },
      });
    }
  },

  /**
   * Get a single scheduled report
   * GET /api/v1/reports/scheduled/:reportId
   */
  async get(req: Request, res: Response) {
    try {
      const { reportId } = req.params;
      const userId = req.user!.id;

      const report = await scheduledReportsService.getById(reportId, userId);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled report not found' },
        });
      }

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Error getting scheduled report:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get scheduled report' },
      });
    }
  },

  /**
   * Update a scheduled report
   * PATCH /api/v1/reports/scheduled/:reportId
   */
  async update(req: Request, res: Response) {
    try {
      const { reportId } = req.params;
      const userId = req.user!.id;
      const input = updateScheduledReportSchema.parse(req.body);

      const report = await scheduledReportsService.update(reportId, userId, input);

      res.json({
        success: true,
        message: 'Scheduled report updated successfully',
        data: report,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      if (error.message === 'Scheduled report not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled report not found' },
        });
      }
      console.error('Error updating scheduled report:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update scheduled report' },
      });
    }
  },

  /**
   * Delete a scheduled report
   * DELETE /api/v1/reports/scheduled/:reportId
   */
  async delete(req: Request, res: Response) {
    try {
      const { reportId } = req.params;
      const userId = req.user!.id;

      await scheduledReportsService.delete(reportId, userId);

      res.json({
        success: true,
        message: 'Scheduled report deleted successfully',
      });
    } catch (error: any) {
      if (error.message === 'Scheduled report not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled report not found' },
        });
      }
      console.error('Error deleting scheduled report:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete scheduled report' },
      });
    }
  },

  /**
   * Get execution history for a scheduled report
   * GET /api/v1/reports/scheduled/:reportId/history
   */
  async getHistory(req: Request, res: Response) {
    try {
      const { reportId } = req.params;
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 20;

      const history = await scheduledReportsService.getHistory(reportId, userId, limit);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      if (error.message === 'Scheduled report not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled report not found' },
        });
      }
      console.error('Error getting report history:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get report history' },
      });
    }
  },

  /**
   * Manually trigger a scheduled report (for testing)
   * POST /api/v1/reports/scheduled/:reportId/send
   */
  async sendNow(req: Request, res: Response) {
    try {
      const { reportId } = req.params;
      const userId = req.user!.id;

      const report = await scheduledReportsService.getById(reportId, userId);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled report not found' },
        });
      }

      const result = await scheduledReportsService.execute(report);

      res.json({
        success: true,
        message: `Report sent to ${result.successfulDeliveries} of ${result.recipientsCount} recipients`,
        data: result,
      });
    } catch (error) {
      console.error('Error sending scheduled report:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to send report' },
      });
    }
  },

  /**
   * Toggle active status
   * POST /api/v1/reports/scheduled/:reportId/toggle
   */
  async toggle(req: Request, res: Response) {
    try {
      const { reportId } = req.params;
      const userId = req.user!.id;

      const report = await scheduledReportsService.getById(reportId, userId);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Scheduled report not found' },
        });
      }

      const updated = await scheduledReportsService.update(reportId, userId, {
        isActive: !report.isActive,
      });

      res.json({
        success: true,
        message: `Scheduled report ${updated.isActive ? 'activated' : 'paused'}`,
        data: updated,
      });
    } catch (error) {
      console.error('Error toggling scheduled report:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle report' },
      });
    }
  },
};
