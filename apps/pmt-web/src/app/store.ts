import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import onboardingReducer from '../features/onboarding/onboardingSlice';
import { authApi } from '../features/auth/authApi';
import { projectsApi } from '../features/projects/projectsApi';
import { issuesApi } from '../features/issues/issuesApi';
import { boardsApi } from '../features/boards/boardsApi';
import { sprintsApi } from '../features/sprints/sprintsApi';
import { timeTrackingApi } from '../features/time-tracking/timeTrackingApi';
import { rbacApi } from '../features/rbac/rbacApi';
import { commentsApi } from '../features/comments/commentsApi';
import { attachmentsApi } from '../features/attachments/attachmentsApi';
import { notificationsApi } from '../features/notifications/notificationsApi';
import { dashboardApi } from '../features/dashboard/dashboardApi';
import { searchApi } from '../features/search/searchApi';
import { reportsApi } from '../features/reports/reportsApi';
import { aiApi } from '../features/ai/aiApi';
import { onboardingApi } from '../features/onboarding/onboardingApi';
import { slackApi } from '../features/integrations/slack/slackApi';
import { teamsApi } from '../features/integrations/teams/teamsApi';
import { githubApi } from '../features/integrations/github/githubApi';
import { calendarApi } from '../features/integrations/calendar/calendarApi';
import { gitlabApi } from '../features/integrations/gitlab/gitlabApi';
import { workflowsApi } from '../features/workflows/workflowsApi';
import { componentsApi } from '../features/components/componentsApi';
import { versionsApi } from '../features/versions/versionsApi';
import { pagesApi } from '../features/pages/pagesApi';
import { securityLevelsApi } from '../features/security-levels/securityLevelsApi';
import { screensApi } from '../features/screens/screensApi';
import { automationApi } from '../features/automation/automationApi';
import { webhooksApi } from '../features/webhooks/webhooksApi';
import { transitionConditionsApi } from '../features/workflows/transitionConditionsApi';
import { wipLimitsApi } from '../features/boards/wipLimitsApi';
import { customFieldsApi } from '../features/custom-fields/customFieldsApi';
import { projectConfigApi } from '../features/projects/projectConfigApi';
import { usersApi } from '../features/users/usersApi';
import { epicsApi } from '../features/epics/epicsApi';
import { labelsApi } from '../features/labels/labelsApi';
import { formsApi } from '../features/forms/formsApi';
import { timelineApi } from '../features/timeline/timelineApi';
import { financialApi } from '../features/financial/financialApi';
import { apiErrorMiddleware } from './apiErrorMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    onboarding: onboardingReducer,
    [authApi.reducerPath]: authApi.reducer,
    [projectsApi.reducerPath]: projectsApi.reducer,
    [issuesApi.reducerPath]: issuesApi.reducer,
    [boardsApi.reducerPath]: boardsApi.reducer,
    [sprintsApi.reducerPath]: sprintsApi.reducer,
    [timeTrackingApi.reducerPath]: timeTrackingApi.reducer,
    [rbacApi.reducerPath]: rbacApi.reducer,
    [commentsApi.reducerPath]: commentsApi.reducer,
    [attachmentsApi.reducerPath]: attachmentsApi.reducer,
    [notificationsApi.reducerPath]: notificationsApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [searchApi.reducerPath]: searchApi.reducer,
    [reportsApi.reducerPath]: reportsApi.reducer,
    [aiApi.reducerPath]: aiApi.reducer,
    [onboardingApi.reducerPath]: onboardingApi.reducer,
    [slackApi.reducerPath]: slackApi.reducer,
    [teamsApi.reducerPath]: teamsApi.reducer,
    [githubApi.reducerPath]: githubApi.reducer,
    [calendarApi.reducerPath]: calendarApi.reducer,
    [gitlabApi.reducerPath]: gitlabApi.reducer,
    [workflowsApi.reducerPath]: workflowsApi.reducer,
    [componentsApi.reducerPath]: componentsApi.reducer,
    [versionsApi.reducerPath]: versionsApi.reducer,
    [pagesApi.reducerPath]: pagesApi.reducer,
    [securityLevelsApi.reducerPath]: securityLevelsApi.reducer,
    [screensApi.reducerPath]: screensApi.reducer,
    [automationApi.reducerPath]: automationApi.reducer,
    [webhooksApi.reducerPath]: webhooksApi.reducer,
    [transitionConditionsApi.reducerPath]: transitionConditionsApi.reducer,
    [wipLimitsApi.reducerPath]: wipLimitsApi.reducer,
    [customFieldsApi.reducerPath]: customFieldsApi.reducer,
    [projectConfigApi.reducerPath]: projectConfigApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [epicsApi.reducerPath]: epicsApi.reducer,
    [labelsApi.reducerPath]: labelsApi.reducer,
    [formsApi.reducerPath]: formsApi.reducer,
    [timelineApi.reducerPath]: timelineApi.reducer,
    [financialApi.reducerPath]: financialApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(apiErrorMiddleware)
      .concat(authApi.middleware)
      .concat(projectsApi.middleware)
      .concat(issuesApi.middleware)
      .concat(boardsApi.middleware)
      .concat(sprintsApi.middleware)
      .concat(timeTrackingApi.middleware)
      .concat(rbacApi.middleware)
      .concat(commentsApi.middleware)
      .concat(attachmentsApi.middleware)
      .concat(notificationsApi.middleware)
      .concat(dashboardApi.middleware)
      .concat(searchApi.middleware)
      .concat(reportsApi.middleware)
      .concat(aiApi.middleware)
      .concat(onboardingApi.middleware)
      .concat(slackApi.middleware)
      .concat(teamsApi.middleware)
      .concat(githubApi.middleware)
      .concat(calendarApi.middleware)
      .concat(gitlabApi.middleware)
      .concat(workflowsApi.middleware)
      .concat(componentsApi.middleware)
      .concat(versionsApi.middleware)
      .concat(pagesApi.middleware)
      .concat(securityLevelsApi.middleware)
      .concat(screensApi.middleware)
      .concat(automationApi.middleware)
      .concat(webhooksApi.middleware)
      .concat(transitionConditionsApi.middleware)
      .concat(wipLimitsApi.middleware)
      .concat(customFieldsApi.middleware)
      .concat(projectConfigApi.middleware)
      .concat(usersApi.middleware)
      .concat(epicsApi.middleware)
      .concat(labelsApi.middleware)
      .concat(formsApi.middleware)
      .concat(timelineApi.middleware)
      .concat(financialApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;
