import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import 'express-async-errors';
import { config } from './config';
import { errorHandler, notFound } from './middleware/errorHandler.middleware';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { logger } from './utils/logger';

const app: Application = express();

// Trust proxy (required when behind load balancer/ingress for correct IP detection)
app.set('trust proxy', 1);

// Request ID - must be first middleware for full tracing coverage
app.use(requestIdMiddleware);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontend.corsOrigins,
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser (required for httpOnly cookie token transport)
app.use(cookieParser());

if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );
}

// Rate limiting (disabled for development)
// app.use(generalLimiter);

// Health check (legacy)
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    environment: config.env,
    timestamp: new Date().toISOString(),
  });
});

// Kubernetes liveness/readiness probes — required by the nestjs-pnpm Helm chart.
// Liveness: confirms the process is alive (restart pod if this fails).
// Readiness: confirms the app can serve traffic (remove from LB if this fails).
app.get('/healthz/liveness', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/healthz/readiness', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
import authRoutes from './modules/auth/auth.routes';
import projectsRoutes from './modules/projects/projects.routes';
import issuesRoutes, { projectIssuesRouter } from './modules/issues/issues.routes';
import referenceRoutes from './modules/reference/reference.routes';
import boardsRoutes from './modules/boards/boards.routes';
import sprintsRoutes from './modules/sprints/sprints.routes';
import timeTrackingRoutes, { issueTimeLogsRouter, projectTimeReportRouter } from './modules/time-tracking/time-tracking.routes';
import rbacRoutes from './modules/rbac/rbac.routes';
import commentsRoutes from './modules/comments/comments.routes';
import attachmentsRoutes from './modules/attachments/attachments.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import dashboardRoutes, { projectDashboardRouter } from './modules/dashboard/dashboard.routes';
import searchRoutes from './modules/search/search.routes';
import reportsRoutes, { projectReportsRouter, sprintReportsRouter, epicReportsRouter, versionReportsRouter } from './modules/reports/reports.routes';
import aiRoutes from './modules/ai/ai.routes';
import slackRoutes from './modules/slack/slack.routes';
import teamsRoutes from './modules/teams/teams.routes';
import githubRoutes from './modules/github/github.routes';
import gitlabRoutes from './modules/gitlab/gitlab.routes';
import calendarRoutes from './modules/calendar/calendar.routes';
import usersRoutes from './modules/users/users.routes';
import workflowsRoutes, { projectWorkflowRouter } from './modules/workflows/workflows.routes';
import customFieldsRoutes, { projectCustomFieldsRouter, issueCustomFieldsRouter } from './modules/custom-fields/custom-fields.routes';
import componentsRoutes, { projectComponentsRouter } from './modules/components/components.routes';
import versionsRoutes, { projectVersionsRouter } from './modules/versions/versions.routes';
import pagesRoutes, { projectPagesRouter } from './modules/pages/pages.routes';
import epicsRoutes, { projectEpicsRouter } from './modules/epics/epics.routes';
import securityLevelsRoutes, { projectSecurityLevelsRouter } from './modules/security-levels/security-levels.routes';
import screensRoutes from './modules/screens/screens.routes';
import automationRoutes from './modules/automation/automation.routes';
import webhooksRoutes from './modules/webhooks/webhooks.routes';
import transitionConditionsRoutes from './modules/workflows/transition-conditions.routes';
import wipLimitsRoutes from './modules/boards/wip-limits.routes';
import adminRoutes from './modules/admin/admin.routes';
import hrRoutes from './modules/hr/hr.routes';
import hrPublicRoutes from './modules/hr/hr-public.routes';
import managerRoutes from './modules/manager/manager.routes';
import employeeRoutes from './modules/employee/employee.routes';
import formsRoutes, { projectFormsRouter } from './modules/forms/forms.routes';
import workflowSchemesRoutes, { projectWorkflowSchemesRouter } from './modules/workflow-schemes/workflow-schemes.routes';
import { projectLabelsRouter } from './modules/labels/labels.routes';
import financialRoutes from './modules/financial/financial.routes';
import biometricRoutes from './modules/biometric/biometric.routes';
import permissionSchemesRoutes, { projectPermissionSchemesRouter } from './modules/permission-schemes/permission-schemes.routes';
import notificationSchemesRoutes, { projectNotificationSchemesRouter } from './modules/notification-schemes/notification-schemes.routes';
import userGroupsRoutes, { projectUserGroupsRouter } from './modules/user-groups/user-groups.routes';
import { storageService } from './services/storage.service';
import filesRoutes from './modules/files/files.routes';
import { usersController } from './modules/users/users.controller';
import leadsRoutes from './modules/leads/leads.routes';
import emailScheduleRoutes from './modules/email-schedule/email-schedule.routes';

// Serve uploaded files statically (direct access for local development).
app.use(
  '/uploads',
  express.static(storageService.getStorageDir(), {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// Public avatar route — mounted at app level to guarantee no auth middleware intercepts.
// <img> tags cannot send Bearer tokens, so this MUST be public.
app.get(
  `/api/${config.apiVersion}/users/avatars/:userId`,
  usersController.getAvatar.bind(usersController)
);

// Public avatar route — mounted at app level to guarantee no auth middleware intercepts.
// <img> tags cannot send Bearer tokens, so this MUST be public.
app.get(
  `/api/${config.apiVersion}/users/avatars/:userId`,
  usersController.getAvatar.bind(usersController)
);

// Public file-serving route — kept for backward-compat (old DB records / direct links).
app.use(`/api/${config.apiVersion}/files`, filesRoutes);

app.use(`/api/${config.apiVersion}/auth`, authRoutes);
// Public onboarding must be registered before wildcard-mounted routers that
// apply authenticate internally, otherwise they intercept the request first.
app.use(`/api/${config.apiVersion}/public/onboarding`, hrPublicRoutes);
// Biometric routes are public (no auth) — must be before wildcard-mounted routers
app.use(`/api/${config.apiVersion}/biometric`, biometricRoutes);
app.use(`/api/${config.apiVersion}/projects`, projectsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/issues`, projectIssuesRouter);
app.use(`/api/${config.apiVersion}/projects/:projectId/board`, boardsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/time-report`, projectTimeReportRouter);
app.use(`/api/${config.apiVersion}/issues/:issueId/time-logs`, issueTimeLogsRouter);
app.use(`/api/${config.apiVersion}/issues`, issuesRoutes);
app.use(`/api/${config.apiVersion}/reference`, referenceRoutes);
app.use(`/api/${config.apiVersion}`, sprintsRoutes);
app.use(`/api/${config.apiVersion}`, timeTrackingRoutes);
app.use(`/api/${config.apiVersion}/rbac`, rbacRoutes);
app.use(`/api/${config.apiVersion}`, commentsRoutes);
app.use(`/api/${config.apiVersion}`, attachmentsRoutes);
app.use(`/api/${config.apiVersion}/notifications`, notificationsRoutes);
app.use(`/api/${config.apiVersion}/dashboard`, dashboardRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/dashboard`, projectDashboardRouter);
app.use(`/api/${config.apiVersion}/search`, searchRoutes);
app.use(`/api/${config.apiVersion}/reports`, reportsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/reports`, projectReportsRouter);
app.use(`/api/${config.apiVersion}/sprints/:sprintId/reports`, sprintReportsRouter);
app.use(`/api/${config.apiVersion}/epics/:epicId/reports`, epicReportsRouter);
app.use(`/api/${config.apiVersion}/versions/:versionId/reports`, versionReportsRouter);
app.use(`/api/${config.apiVersion}/ai`, aiRoutes);
app.use(`/api/${config.apiVersion}/integrations/slack`, slackRoutes);
app.use(`/api/${config.apiVersion}/integrations/teams`, teamsRoutes);
app.use(`/api/${config.apiVersion}/integrations/github`, githubRoutes);
app.use(`/api/${config.apiVersion}/integrations/gitlab`, gitlabRoutes);
app.use(`/api/${config.apiVersion}/integrations/calendar`, calendarRoutes);
app.use(`/api/${config.apiVersion}/users`, usersRoutes);
app.use(`/api/${config.apiVersion}/workflows`, workflowsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/workflow`, projectWorkflowRouter);
app.use(`/api/${config.apiVersion}/custom-fields`, customFieldsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/custom-fields`, projectCustomFieldsRouter);
app.use(`/api/${config.apiVersion}/issues/:issueId/custom-fields`, issueCustomFieldsRouter);
app.use(`/api/${config.apiVersion}/components`, componentsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/components`, projectComponentsRouter);
app.use(`/api/${config.apiVersion}/versions`, versionsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/versions`, projectVersionsRouter);
app.use(`/api/${config.apiVersion}/pages`, pagesRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/pages`, projectPagesRouter);
app.use(`/api/${config.apiVersion}/epics`, epicsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/epics`, projectEpicsRouter);
app.use(`/api/${config.apiVersion}/security-levels`, securityLevelsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/security-levels`, projectSecurityLevelsRouter);
app.use(`/api/${config.apiVersion}/screens`, screensRoutes);
app.use(`/api/${config.apiVersion}/automation`, automationRoutes);
app.use(`/api/${config.apiVersion}/webhooks`, webhooksRoutes);
app.use(`/api/${config.apiVersion}/workflow-config`, transitionConditionsRoutes);
app.use(`/api/${config.apiVersion}/wip`, wipLimitsRoutes);
app.use(`/api/${config.apiVersion}/admin`, adminRoutes);
app.use(`/api/${config.apiVersion}/hr`, hrRoutes);
app.use(`/api/${config.apiVersion}/manager`, managerRoutes);
app.use(`/api/${config.apiVersion}/employee`, employeeRoutes);
app.use(`/api/${config.apiVersion}/forms`, formsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/forms`, projectFormsRouter);
app.use(`/api/${config.apiVersion}/workflow-schemes`, workflowSchemesRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/workflow-scheme`, projectWorkflowSchemesRouter);
app.use(`/api/${config.apiVersion}/permission-schemes`, permissionSchemesRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/permission-scheme`, projectPermissionSchemesRouter);
app.use(`/api/${config.apiVersion}/notification-schemes`, notificationSchemesRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/notification-scheme`, projectNotificationSchemesRouter);
app.use(`/api/${config.apiVersion}/user-groups`, userGroupsRoutes);
app.use(`/api/${config.apiVersion}/projects/:projectId/user-groups`, projectUserGroupsRouter);
app.use(`/api/${config.apiVersion}/projects/:projectId/labels`, projectLabelsRouter);
app.use(`/api/${config.apiVersion}/leads`, leadsRoutes);
app.use(`/api/${config.apiVersion}/email-schedule`, emailScheduleRoutes);
app.use(`/api/${config.apiVersion}`, financialRoutes);
// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

export default app;
