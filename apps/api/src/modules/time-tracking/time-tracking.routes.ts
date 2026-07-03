import { Router } from 'express';
import { TimeTrackingController } from './time-tracking.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const controller = new TimeTrackingController();

// All routes require authentication
router.use(authenticate);

// Timer routes
router.get('/timer/active', controller.getActiveTimer.bind(controller));
router.post('/timer/start', controller.startTimer.bind(controller));
router.post('/timer/stop', controller.stopTimer.bind(controller));
router.post('/timer/pause', controller.pauseTimer.bind(controller));
router.post('/timer/resume', controller.resumeTimer.bind(controller));

// Timesheet route
router.get('/timesheet', controller.getTimesheet.bind(controller));
router.post('/timesheet/log', controller.logTimesheet.bind(controller));
router.get('/timesheet/history', controller.getTimesheetHistory.bind(controller));
router.get('/timesheet/summary', controller.getTimesheetSummary.bind(controller));
router.put('/timesheet/log/:logId', controller.updateTimesheetLog.bind(controller));
router.delete('/timesheet/log/:logId', controller.deleteTimesheetLog.bind(controller));

// Time reports
router.get('/time-reports/user/:userId?', controller.getUserTimeReport.bind(controller));

// Export
router.get('/time-logs/export', controller.exportTimeLogs.bind(controller));

// Individual time log routes
router.get('/time-logs/:timeLogId', controller.getTimeLog.bind(controller));
router.patch('/time-logs/:timeLogId', controller.updateTimeLog.bind(controller));
router.delete('/time-logs/:timeLogId', controller.deleteTimeLog.bind(controller));

export default router;

// Issue-specific time log routes (mounted under /issues/:issueId)
export const issueTimeLogsRouter = Router({ mergeParams: true });
issueTimeLogsRouter.use(authenticate);
issueTimeLogsRouter.post('/', controller.logTime.bind(controller));
issueTimeLogsRouter.get('/', controller.getTimeLogsByIssue.bind(controller));
issueTimeLogsRouter.get('/summary', controller.getIssueTimeSummary.bind(controller));

// Project time report routes (mounted under /projects/:projectId)
export const projectTimeReportRouter = Router({ mergeParams: true });
projectTimeReportRouter.use(authenticate);
projectTimeReportRouter.get('/', controller.getProjectTimeReport.bind(controller));
