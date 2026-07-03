import { Request, Response } from 'express';
import { financialService } from './financial.service';
import { ApiError } from '../../utils/ApiError';

export const financialController = {
  async getProjectBudget(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const budget = await financialService.getProjectBudget(projectId);
      res.json({ success: true, data: budget });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to retrieve project budget');
    }
  },

  async upsertProjectBudget(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const budget = await financialService.upsertProjectBudget(projectId, req.body);
      res.status(200).json({ success: true, data: budget });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to save project budget');
    }
  },

  async getResourceRates(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const rates = await financialService.getResourceRates(projectId);
      res.json({ success: true, data: rates });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to retrieve resource rates');
    }
  },

  async createResourceRate(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const rate = await financialService.createResourceRate(projectId, req.body);
      res.status(201).json({ success: true, data: rate });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to create resource rate');
    }
  },

  async updateResourceRate(req: Request, res: Response) {
    try {
      const { projectId, rateId } = req.params;
      const rate = await financialService.updateResourceRate(rateId, projectId, req.body);
      if (!rate) throw ApiError.notFound('Resource rate not found');
      res.json({ success: true, data: rate });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to update resource rate');
    }
  },

  async deleteResourceRate(req: Request, res: Response) {
    try {
      const { projectId, rateId } = req.params;
      const deleted = await financialService.deleteResourceRate(rateId, projectId);
      if (!deleted) throw ApiError.notFound('Resource rate not found');
      res.json({ success: true, message: 'Resource rate deleted' });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to delete resource rate');
    }
  },

  async getBurnoutChart(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { granularity, startDate, endDate } = req.query as Record<string, string | undefined>;
      const data = await financialService.getBurnoutChartData(projectId, {
        granularity: granularity as 'weekly' | 'monthly' | undefined,
        startDate,
        endDate,
      });
      res.json({ success: true, data });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to generate burnout chart data');
    }
  },

  async getBudgetSummary(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const summary = await financialService.calculateBudgetSummary(projectId);
      res.json({ success: true, data: summary });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to calculate budget summary');
    }
  },

  async getCostBreakdown(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { userId, role, startDate, endDate } = req.query as Record<string, string | undefined>;
      const breakdown = await financialService.getCostBreakdown(projectId, {
        userId,
        role,
        startDate,
        endDate,
      });
      res.json({ success: true, data: breakdown });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to calculate cost breakdown');
    }
  },

  async getBudgetVsActual(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const data = await financialService.getBudgetVsActual(projectId);
      res.json({ success: true, data });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to calculate budget vs actual');
    }
  },

  async getAlerts(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const alerts = await financialService.getAlerts(projectId);
      res.json({ success: true, data: alerts });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to retrieve budget alerts');
    }
  },

  async markAlertsRead(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      await financialService.markAlertsRead(projectId);
      res.json({ success: true, message: 'Alerts marked as read' });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.internal('Failed to mark alerts as read');
    }
  },
};
