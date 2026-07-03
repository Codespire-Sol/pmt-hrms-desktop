import { Router } from 'express';
import { reportsController } from './reports.controller';
import { scheduledReportsController } from './scheduledReports.controller';
import { authenticate } from '../../middleware/auth.middleware';

// Main reports router (for /api/v1/reports)
const router = Router();
router.use(authenticate);

// Time tracking reports
router.get('/time-tracking', reportsController.getTimeTrackingReport);
router.get('/time-tracking/export', reportsController.exportTimeTrackingReport);

// Scheduled reports
router.get('/scheduled', scheduledReportsController.list);
router.post('/scheduled', scheduledReportsController.create);
router.get('/scheduled/:reportId', scheduledReportsController.get);
router.patch('/scheduled/:reportId', scheduledReportsController.update);
router.delete('/scheduled/:reportId', scheduledReportsController.delete);
router.get('/scheduled/:reportId/history', scheduledReportsController.getHistory);
router.post('/scheduled/:reportId/send', scheduledReportsController.sendNow);
router.post('/scheduled/:reportId/toggle', scheduledReportsController.toggle);

export default router;

// Project reports router (for /api/v1/projects/:projectId/reports)
export const projectReportsRouter = Router({ mergeParams: true });
projectReportsRouter.use(authenticate);

// Sprint reports
projectReportsRouter.get('/sprint', reportsController.getSprintReport);
projectReportsRouter.get('/sprint/export', reportsController.exportSprintReport);

// Team workload reports
projectReportsRouter.get('/team-workload', reportsController.getTeamWorkloadReport);
projectReportsRouter.get('/team-workload/export', reportsController.exportTeamWorkloadReport);

// Issue distribution reports
projectReportsRouter.get('/distribution', reportsController.getIssueDistributionReport);

// Estimate vs Actual comparison reports
projectReportsRouter.get('/estimate-actual', reportsController.getEstimateActualReport);
projectReportsRouter.get('/estimate-actual/export', reportsController.exportEstimateActualReport);

// Cumulative Flow Diagram reports
projectReportsRouter.get('/cumulative-flow', reportsController.getCumulativeFlowReport);

// Cycle Time Analytics reports
projectReportsRouter.get('/cycle-time', reportsController.getCycleTimeReport);
projectReportsRouter.get('/cycle-time/export', reportsController.exportCycleTimeReport);
projectReportsRouter.get('/created-vs-resolved', reportsController.getCreatedVsResolvedReport);
projectReportsRouter.get('/resolution-time-summary', reportsController.getResolutionTimeSummary);
projectReportsRouter.get('/control-chart', reportsController.getControlChartData);

// Sprint burndown router (for /api/v1/sprints/:sprintId/reports)
export const sprintReportsRouter = Router({ mergeParams: true });
sprintReportsRouter.use(authenticate);
sprintReportsRouter.get('/burndown', reportsController.getSprintBurndown);

// Epic report router (for /api/v1/epics/:epicId/reports)
export const epicReportsRouter = Router({ mergeParams: true });
epicReportsRouter.use(authenticate);
epicReportsRouter.get('/', reportsController.getEpicReport);

// Version report router (for /api/v1/versions/:versionId/reports)
export const versionReportsRouter = Router({ mergeParams: true });
versionReportsRouter.use(authenticate);
versionReportsRouter.get('/', reportsController.getVersionReport);
