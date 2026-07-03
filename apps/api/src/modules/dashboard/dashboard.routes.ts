import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── Role-based dashboards (must be registered before /:dashboardId wildcard) ──
// GET /api/v1/dashboard/admin      → full admin dashboard
router.get('/admin', dashboardController.getAdminDashboard);
// GET /api/v1/dashboard/manager    → full manager dashboard
router.get('/manager', dashboardController.getManagerDashboard);
// GET /api/v1/dashboard/employee   → full employee / assignee dashboard
router.get('/employee', dashboardController.getEmployeeDashboard);

// ── Chart data endpoints ──
// GET /api/v1/dashboard/charts/gantt?projectId=&assigneeId=&sprintId=&epicId=
router.get('/charts/gantt', dashboardController.getGanttChartData);
// GET /api/v1/dashboard/charts/velocity?projectId=&limit=10
router.get('/charts/velocity', dashboardController.getVelocityChartData);
// GET /api/v1/dashboard/charts/burndown?sprintId=
router.get('/charts/burndown', dashboardController.getBurndownChartData);
// GET /api/v1/dashboard/charts/cumulative-flow?projectId=&days=30
router.get('/charts/cumulative-flow', dashboardController.getCumulativeFlowData);

// User dashboard routes
router.get('/', dashboardController.getUserDashboard);
router.get('/full', dashboardController.getFullDashboard);
router.get('/assigned-issues', dashboardController.getAssignedIssues);
router.get('/recent-activity', dashboardController.getRecentActivity);
router.get('/due-soon', dashboardController.getDueSoonIssues);

// User dashboard preferences
router.get('/preferences', dashboardController.getDashboardPreferences);
router.patch('/preferences', dashboardController.updateDashboardPreferences);
router.post('/preferences/reset', dashboardController.resetDashboardPreferences);

// Dashboard sharing routes
router.post('/shares', dashboardController.shareDashboard);
router.get('/shared-with-me', dashboardController.getSharedWithMe);
router.get('/shared/:token', dashboardController.getSharedDashboardByToken);
router.get('/:dashboardId/shares', dashboardController.getSharesByDashboard);
router.post('/:dashboardId/public-link', dashboardController.createPublicLink);
router.patch('/shares/:shareId', dashboardController.updateShare);
router.delete('/shares/:shareId', dashboardController.deleteShare);
router.post('/shares/:shareId/regenerate-link', dashboardController.regeneratePublicLink);

export default router;

// Project dashboard route (to be mounted separately)
export const projectDashboardRouter = Router({ mergeParams: true });
projectDashboardRouter.use(authenticate);
projectDashboardRouter.get('/', dashboardController.getProjectDashboard);
projectDashboardRouter.get('/summary', dashboardController.getProjectDashboard);
projectDashboardRouter.get('/full', dashboardController.getFullProjectDashboard);

// Project dashboard preferences
projectDashboardRouter.get('/preferences', dashboardController.getProjectDashboardPreferences);
projectDashboardRouter.patch('/preferences', dashboardController.updateProjectDashboardPreferences);
projectDashboardRouter.post('/preferences/reset', dashboardController.resetProjectDashboardPreferences);
