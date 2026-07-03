import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicFormPage } from './features/forms/PublicFormPage';
import { OAuthCallbackPage } from './features/integrations/calendar/components/OAuthCallbackPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ProjectsListPage } from './features/projects/ProjectsListPage';
import ProjectHubPage from './pages/ProjectHubPage';
import { CreateProjectPage } from './features/projects/CreateProjectPage';
import { ProjectDetailPage } from './features/projects/ProjectDetailPage';
import { KanbanBoardPage } from './features/boards/KanbanBoardPage';
import { SprintPlanningPage } from './features/sprints/SprintPlanningPage';
import { TimesheetPage } from './features/time-tracking/TimesheetPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import NotificationsPage from './pages/NotificationsPage';
import SearchResultsPage from './pages/SearchResultsPage';
import { IssueListPage } from './features/issues/IssueListPage';
import { IssueDetailPage } from './features/issues/IssueDetailPage';
import { IssueModalProvider } from './features/issues/IssueDetailModal';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { ProjectSettingsPage } from './features/projects/ProjectSettingsPage';
import { ProjectMembersPage } from './features/projects/ProjectMembersPage';
import { AutomationRulesPage } from './features/automation/components/AutomationRulesPage';
import { RuleBuilder } from './features/automation/components/RuleBuilder';
import { WebhooksPage } from './features/webhooks/components/WebhooksPage';
import { VersionsPage } from './features/versions/VersionsPage';
import { ComponentsPage } from './features/components/ComponentsPage';
import { SecurityLevelsPage } from './features/security-levels/SecurityLevelsPage';
import { ScreensPage } from './features/screens/ScreensPage';
import { SavedFiltersPage } from './features/search/components/SavedFiltersPage';
import { SprintRetrospectivePage } from './features/sprints/SprintRetrospectivePage';
import { SprintReportPage } from './features/reports/SprintReportPage';
import { ControlChartPage } from './features/reports/ControlChartPage';
import { EpicReportPage } from './features/reports/EpicReportPage';
import { VersionReportPage } from './features/reports/VersionReportPage';
import { WorkflowManagementPage } from './pages/admin/WorkflowManagementPage';
import { UsersPermissionsPage } from './pages/admin/UsersPermissionsPage';
import { LeadTrackerPage } from './features/leads/LeadTrackerPage';
import { LeadDetailPage } from './features/leads/LeadDetailPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { useAppSelector, useAppDispatch } from './app/hooks';
import { useGetCurrentUserPermissionsQuery } from './features/rbac/rbacApi';
import { useGetCurrentUserQuery } from './features/auth/authApi';
import { setIsAdmin, setUser, setKeycloakToken } from './features/auth/authSlice';
import keycloak from './lib/keycloak';
import { ENV } from './lib/env';
import LoginPage from './pages/LoginPage';
import { useEffect } from 'react';
import { ConfigProvider, Typography, Button } from 'antd';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Link } from 'react-router-dom';

// Design System Constants from .cursorrules
const COLORS = {
  primary: '#1268ff',
  appBackground: '#f9fafb',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
};

const DARK_COLORS = {
  primary: '#1268ff',
  appBackground: '#141414',
  textPrimary: '#e5e7eb',
  textSecondary: '#9ca3af',
  border: '#333333',
};

function AppContent() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, accessToken, user } = useAppSelector((state) => state.auth);

  // Bootstrap Keycloak session into Redux on mount and keep token fresh
  useEffect(() => {
    // Local JWT mode: no Keycloak bootstrap/refresh; session comes from the store.
    if (ENV.AUTH_MODE === 'jwt') return;
    if (keycloak.authenticated && keycloak.token) {
      dispatch(setKeycloakToken(keycloak.token));
    }

    // Callback when token expires (fallback for missed proactive refresh)
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(60).then((refreshed) => {
        if (refreshed && keycloak.token) {
          dispatch(setKeycloakToken(keycloak.token));
        }
      }).catch(() => {
        // Silently ignore — proactive interval will retry, or API 401 handler
        // will redirect as a last resort if the session is truly expired.
        console.warn('[Auth] Token-expired refresh failed, will retry on next interval');
      });
    };

    // Proactive refresh: every 60 s check if token expires within 90 s and refresh early.
    // This keeps the token alive while the user is active and prevents the
    // "session expired" flash that happens when a request fires with a stale token.
    const refreshInterval = window.setInterval(() => {
      if (!keycloak.authenticated) return;
      keycloak.updateToken(90).then((refreshed) => {
        if (refreshed && keycloak.token) {
          dispatch(setKeycloakToken(keycloak.token));
        }
      }).catch(() => {
        // Silently ignore — next tick will retry in 60s, or API 401 handler
        // will redirect as a last resort if the session is truly expired.
        console.warn('[Auth] Proactive token refresh failed, will retry in 60s');
      });
    }, 60_000);

    return () => window.clearInterval(refreshInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch /auth/me once authenticated to populate local user profile
  const { data: currentUserData } = useGetCurrentUserQuery(undefined, {
    skip: !isAuthenticated || !!user,
  });
  const { data: permissionsData } = useGetCurrentUserPermissionsQuery(undefined, {
    skip: !isAuthenticated,
  });
  const { theme, isDark } = useTheme();

  useEffect(() => {
    const roleName = permissionsData?.data?.role?.name;
    dispatch(setIsAdmin(roleName === 'admin'));
  }, [dispatch, permissionsData]);

  useEffect(() => {
    if (currentUserData?.data?.user) {
      dispatch(setUser(currentUserData.data.user));
    }
  }, [dispatch, currentUserData]);

  const themeColors = isDark ? DARK_COLORS : COLORS;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: themeColors.primary,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          borderRadius: 8,
          colorText: themeColors.textPrimary,
          colorTextDescription: themeColors.textSecondary,
          colorBgContainer: isDark ? '#1f1f1f' : '#ffffff',
          colorBgLayout: themeColors.appBackground,
          colorBorder: themeColors.border,
          colorBgElevated: isDark ? '#262626' : '#ffffff',
        },
        components: {
          Button: {
            borderRadius: 8,
            fontWeight: 600,
            controlHeight: 40,
            colorBgContainer: isDark ? '#1f1f1f' : '#ffffff',
            colorBorder: themeColors.border,
          },
          Card: {
            borderRadiusLG: 12,
            boxShadow: isDark
              ? '0 8px 16px rgba(0, 0, 0, 0.3)'
              : '0 8px 16px rgba(16, 24, 40, 0.06)',
          },
          Input: {
            borderRadius: 8,
            controlHeight: 40,
          },
          Select: {
            borderRadius: 8,
            controlHeight: 40,
          },
          Table: {
            headerBg: isDark ? '#1f1f1f' : '#f9fafb',
            headerColor: themeColors.textSecondary,
            headerSplitColor: 'transparent',
          },
        },
      }}
    >
      <ErrorBoundary>
        <div
          className={theme}
          style={{
            minHeight: '100vh',
            backgroundColor: themeColors.appBackground,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />

            {/* Local JWT login page (AUTH_MODE=jwt) — no auth required */}
            <Route path="/login" element={<LoginPage />} />

            {/* Public form submission page — no auth required */}
            <Route path="/forms/:formId/submit" element={<PublicFormPage />} />

            {/* OAuth callback pages — run inside popup, no auth needed */}
            <Route path="/integrations/google/callback" element={<OAuthCallbackPage />} />
            <Route path="/integrations/outlook/callback" element={<OAuthCallbackPage />} />

            {/* Full-screen pages (no sidebar) */}
            <Route path="/hub" element={<ProtectedRoute><IssueModalProvider><ProjectHubPage /></IssueModalProvider></ProtectedRoute>} />

            <Route
              element={
                <ProtectedRoute>
                  <IssueModalProvider>
                    <AppLayout />
                  </IssueModalProvider>
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsListPage />} />
              <Route path="/projects/new" element={<CreateProjectPage />} />
              <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/board" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/sprints" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/issues" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/issues/:issueId" element={<IssueDetailPage />} />

              <Route path="/projects/:projectId/members" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/settings" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/automation" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/integrations" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/automation/new" element={<RuleBuilder />} />
              <Route path="/projects/:projectId/automation/:ruleId" element={<RuleBuilder />} />
              <Route path="/projects/:projectId/webhooks" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/versions" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/backlog" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/pages" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/forms" element={<ProjectDetailPage />} />

              <Route path="/projects/:projectId/timeline" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/financial" element={<ProjectDetailPage />} />
              <Route path="/projects/:projectId/sprints/:sprintId/retrospective" element={<SprintRetrospectivePage />} />
              <Route path="/reports/sprint/:sprintId" element={<SprintReportPage />} />
              <Route path="/projects/:projectId/reports/control-chart" element={<ControlChartPage />} />
              <Route path="/epics/:epicId/reports" element={<EpicReportPage />} />
              <Route path="/versions/:versionId/reports" element={<VersionReportPage />} />
              <Route path="/projects/:projectId/components" element={<ComponentsPage />} />
              <Route path="/projects/:projectId/security-levels" element={<SecurityLevelsPage />} />
              <Route path="/projects/:projectId/screens" element={<ScreensPage />} />
              <Route path="/timesheet" element={<TimesheetPage />} />
              <Route path="/lead-tracker" element={<LeadTrackerPage />} />
              <Route path="/lead-tracker/:leadId" element={<LeadDetailPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/search" element={<SearchResultsPage />} />
              <Route path="/search/filters" element={<SavedFiltersPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin/audit-logs" element={<AuditLogPage />} />
              <Route path="/admin/workflows" element={<WorkflowManagementPage />} />
              <Route path="/admin/users" element={<UsersPermissionsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster />
        </div>
      </ErrorBoundary>
    </ConfigProvider>
  );
}

function NotFoundPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
      <div style={{ textAlign: 'center' }}>
        <Typography.Title level={1} style={{ fontSize: '80px', margin: 0, color: COLORS.primary }}>404</Typography.Title>
        <Typography.Title level={3}>Page not found</Typography.Title>
        <Typography.Text style={{ color: COLORS.textSecondary }}>The page you are looking for doesn't exist or has been moved.</Typography.Text>
        <div style={{ marginTop: '24px' }}>
          <Link to="/dashboard">
            <Button type="primary" size="large">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
