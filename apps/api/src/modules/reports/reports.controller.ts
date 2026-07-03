import { Request, Response } from 'express';
import { reportsService } from './reports.service';
import { pdfService } from '../../services/pdf.service';

export const reportsController = {
  // GET /api/v1/projects/:projectId/reports/sprint
  async getSprintReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const report = await reportsService.getSprintReport(projectId);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('Error getting sprint report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get sprint report' },
      });
    }
  },

  // GET /api/v1/sprints/:sprintId/reports/burndown
  async getSprintBurndown(req: Request, res: Response) {
    try {
      const { sprintId } = req.params;
      const burndown = await reportsService.getSprintBurndown(sprintId);

      if (!burndown) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Sprint not found' },
        });
      }

      res.json({
        success: true,
        data: burndown,
      });
    } catch (error) {
      console.error('Error getting sprint burndown:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get burndown' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/team-workload
  async getTeamWorkloadReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const report = await reportsService.getTeamWorkloadReport(
        projectId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('Error getting team workload report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get workload report' },
      });
    }
  },

  // GET /api/v1/reports/time-tracking
  async getTimeTrackingReport(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { startDate, endDate, projectId } = req.query as {
        startDate?: string;
        endDate?: string;
        projectId?: string;
      };

      const report = await reportsService.getTimeTrackingReport(
        userId,
        startDate,
        endDate,
        projectId
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      console.error('Error getting time tracking report:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get time report' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/distribution
  async getIssueDistributionReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const report = await reportsService.getIssueDistributionReport(projectId);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('Error getting distribution report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get distribution report' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/sprint/export
  async exportSprintReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { format = 'csv' } = req.query as { format?: string };

      const report = await reportsService.getSprintReport(projectId);

      if (format === 'pdf') {
        const pdfBuffer = await pdfService.generateSprintReportPdf(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="sprint-report-${report.projectKey}.pdf"`
        );
        return res.send(pdfBuffer);
      }

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="sprint-velocity-${report.projectKey}.json"`
        );
        return res.send(JSON.stringify(report.velocityHistory, null, 2));
      }

      const csv = reportsService.exportVelocityToCsv(report.velocityHistory);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="sprint-velocity-${report.projectKey}.csv"`
      );
      res.send(csv);
    } catch (error: any) {
      console.error('Error exporting sprint report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to export report' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/team-workload/export
  async exportTeamWorkloadReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate, format = 'csv' } = req.query as {
        startDate?: string;
        endDate?: string;
        format?: string;
      };

      const report = await reportsService.getTeamWorkloadReport(
        projectId,
        startDate,
        endDate
      );

      if (format === 'pdf') {
        const pdfBuffer = await pdfService.generateTeamWorkloadPdf(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="team-workload-${projectId}.pdf"`
        );
        return res.send(pdfBuffer);
      }

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="team-workload-${projectId}.json"`
        );
        return res.send(JSON.stringify(report.members, null, 2));
      }

      const csv = reportsService.exportTeamWorkloadToCsv(report.members);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="team-workload-${projectId}.csv"`
      );
      res.send(csv);
    } catch (error: any) {
      console.error('Error exporting team workload report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to export report' },
      });
    }
  },

  // GET /api/v1/reports/time-tracking/export
  async exportTimeTrackingReport(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { startDate, endDate, projectId, format = 'csv' } = req.query as {
        startDate?: string;
        endDate?: string;
        projectId?: string;
        format?: string;
      };

      const report = await reportsService.getTimeTrackingReport(
        userId,
        startDate,
        endDate,
        projectId
      );

      if (format === 'pdf') {
        const pdfBuffer = await pdfService.generateTimeTrackingPdf(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="time-logs.pdf"');
        return res.send(pdfBuffer);
      }

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="time-logs.json"');
        return res.send(JSON.stringify(report.recentLogs, null, 2));
      }

      const csv = reportsService.exportTimeLogsToCsv(report.recentLogs);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="time-logs.csv"');
      res.send(csv);
    } catch (error) {
      console.error('Error exporting time tracking report:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to export report' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/estimate-actual
  async getEstimateActualReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const report = await reportsService.getEstimateActualReport(
        projectId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('Error getting estimate vs actual report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get estimate vs actual report' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/estimate-actual/export
  async exportEstimateActualReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate, format = 'csv' } = req.query as {
        startDate?: string;
        endDate?: string;
        format?: string;
      };

      const report = await reportsService.getEstimateActualReport(
        projectId,
        startDate,
        endDate
      );

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="estimate-actual-${projectId}.json"`
        );
        return res.send(JSON.stringify(report, null, 2));
      }

      const csv = reportsService.exportEstimateActualToCsv(report.issues);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="estimate-actual-${projectId}.csv"`
      );
      res.send(csv);
    } catch (error: any) {
      console.error('Error exporting estimate vs actual report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to export report' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/cumulative-flow
  async getCumulativeFlowReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const report = await reportsService.getCumulativeFlowReport(
        projectId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('Error getting cumulative flow report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get cumulative flow report' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/cycle-time
  async getCycleTimeReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const report = await reportsService.getCycleTimeReport(
        projectId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('Error getting cycle time report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get cycle time report' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/created-vs-resolved
  async getCreatedVsResolvedReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const report = await reportsService.getCreatedVsResolvedReport(
        projectId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('Error getting created-vs-resolved report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get created-vs-resolved report' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/resolution-time-summary
  async getResolutionTimeSummary(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const report = await reportsService.getResolutionTimeSummary(
        projectId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('Error getting resolution-time summary:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get resolution-time summary' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/control-chart
  async getControlChartData(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const report = await reportsService.getControlChartData(
        projectId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.error('Error getting control-chart data:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get control-chart data' },
      });
    }
  },

  // GET /api/v1/projects/:projectId/reports/cycle-time/export
  async exportCycleTimeReport(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { startDate, endDate, format = 'csv' } = req.query as {
        startDate?: string;
        endDate?: string;
        format?: string;
      };

      const report = await reportsService.getCycleTimeReport(
        projectId,
        startDate,
        endDate
      );

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="cycle-time-${projectId}.json"`
        );
        return res.send(JSON.stringify(report, null, 2));
      }

      const csv = reportsService.exportCycleTimeToCsv(report.issues);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cycle-time-${projectId}.csv"`
      );
      res.send(csv);
    } catch (error: any) {
      console.error('Error exporting cycle time report:', error);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to export report' },
      });
    }
  },

  // GET /api/v1/epics/:epicId/reports
  async getEpicReport(req: Request, res: Response) {
    try {
      const report = await reportsService.getEpicReport(req.params.epicId);
      res.json({ success: true, data: report });
    } catch (error: any) {
      if (error.message === 'Epic not found') {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Epic not found' } });
      }
      console.error('Epic report error:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate epic report' } });
    }
  },

  // GET /api/v1/versions/:versionId/reports
  async getVersionReport(req: Request, res: Response) {
    try {
      const report = await reportsService.getVersionReport(req.params.versionId);
      res.json({ success: true, data: report });
    } catch (error: any) {
      if (error.message === 'Version not found') {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Version not found' } });
      }
      console.error('Version report error:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate version report' } });
    }
  },
};
