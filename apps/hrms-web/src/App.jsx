import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import keycloak from './lib/keycloak';
import { ENV } from './lib/env';
import { initFromKeycloak, initLocalSession } from './hooks/useAuth';

// Pages
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import AddEmployee from './pages/AddEmployee';
import EditEmployee from './pages/EditEmployee';
import Attendance from './pages/Attendance';
import TeamAttendance from './pages/TeamAttendance';
import Leave from './pages/Leave';
import LeaveApprovals from './pages/LeaveApprovals';
import Payroll from './pages/Payroll';
import PayrollAdmin from './pages/PayrollAdmin';
import Organization from './pages/Organization';
import Settings from './pages/Settings';
import EmailSettings from './pages/EmailSettings';
import AdminHrAccounts from './pages/AdminHrAccounts';
import AdminBranches from './pages/AdminBranches';
import HrOperations from './pages/HrOperations';
import AdminAccessControl from './pages/AdminAccessControl';
import BiometricMappings from './pages/BiometricMappings';
import BiometricTest from './pages/BiometricTest';
import OnboardingRegister from './pages/OnboardingRegister';
import DbAdmin from './pages/DbAdmin';
import Login from './pages/Login';
import AdminSettings from './pages/AdminSettings';
import RoleGuard from './components/common/RoleGuard';

function App() {
  const { isAuthenticated, setKeycloakToken } = useAuthStore();

  useEffect(() => {
    // --- Local JWT mode: restore a persisted session; no Keycloak timers. ---
    if (ENV.AUTH_MODE === 'jwt') {
      if (useAuthStore.getState().token) {
        initLocalSession();
      }
      return;
    }

    // Bootstrap from Keycloak session on mount
    if (keycloak.authenticated && keycloak.token) {
      initFromKeycloak(keycloak.token);
    }

    // Callback when token expires (fallback for missed proactive refresh)
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(60)
        .then(() => { setKeycloakToken(keycloak.token); })
        .catch(() => {
          // Silently ignore — proactive interval will retry, or API 401 handler
          // will redirect as a last resort if the session is truly expired.
          console.warn('[Auth] Token-expired refresh failed, will retry on next interval');
        });
    };

    // Proactive refresh: every 60 s refresh if token expires within 90 s.
    // Keeps token alive while user is active; prevents stale-token 401 flashes.
    const refreshInterval = window.setInterval(() => {
      if (!keycloak.authenticated) return;
      keycloak.updateToken(90)
        .then((refreshed) => { if (refreshed && keycloak.token) setKeycloakToken(keycloak.token); })
        .catch(() => {
          // Silently ignore — next tick will retry in 60s, or API 401 handler
          // will redirect as a last resort if the session is truly expired.
          console.warn('[Auth] Proactive token refresh failed, will retry in 60s');
        });
    }, 60_000);

    return () => window.clearInterval(refreshInterval);
  }, []);

  // Local JWT mode: show the login screen until authenticated (public pages exempt).
  if (ENV.AUTH_MODE === 'jwt' && !isAuthenticated) {
    const path = window.location.pathname;
    const isPublic = path.startsWith('/register/') || path === '/db-admin';
    if (!isPublic) {
      return <Login />;
    }
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/register/onboarding" element={<OnboardingRegister />} />
        <Route path="/db-admin" element={<DbAdmin />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Employee Management — admin, HR & manager (team view) */}
        <Route path="/employees" element={<RoleGuard roles={['admin', 'hr', 'manager']}><Employees /></RoleGuard>} />
        <Route path="/employees/new" element={<RoleGuard roles={['admin', 'hr']}><AddEmployee /></RoleGuard>} />
        <Route path="/employees/:id/edit" element={<RoleGuard roles={['admin', 'hr']}><EditEmployee /></RoleGuard>} />
        <Route path="/employees/:id" element={<RoleGuard roles={['admin', 'hr', 'manager']}><EmployeeDetail /></RoleGuard>} />

        {/* Attendance */}
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/attendance/team" element={<RoleGuard roles={['admin', 'hr', 'manager']}><TeamAttendance /></RoleGuard>} />

        {/* Leave */}
        <Route path="/leave" element={<Leave />} />
        <Route path="/leave/approvals" element={<RoleGuard roles={['admin', 'hr', 'manager']}><LeaveApprovals /></RoleGuard>} />

        {/* Payroll */}
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/payroll/admin" element={<RoleGuard roles={['admin', 'hr']}><PayrollAdmin /></RoleGuard>} />

        {/* Organization */}
        <Route path="/organization" element={<Organization />} />

        {/* Settings */}
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/email-schedule" element={<RoleGuard roles={['admin', 'hr']}><EmailSettings /></RoleGuard>} />

        {/* Admin-only routes */}
        <Route path="/admin/settings" element={<RoleGuard roles={['admin']}><AdminSettings /></RoleGuard>} />
        <Route path="/admin/hr-accounts" element={<RoleGuard roles={['admin']}><AdminHrAccounts /></RoleGuard>} />
        <Route path="/admin/branches" element={<RoleGuard roles={['admin']}><AdminBranches /></RoleGuard>} />
        <Route path="/admin/access-control" element={<RoleGuard roles={['admin']}><AdminAccessControl /></RoleGuard>} />

        {/* HR Operations — admin & HR only */}
        <Route path="/hr/operations" element={<RoleGuard roles={['admin', 'hr']}><HrOperations /></RoleGuard>} />

        {/* Biometric — admin only */}
        <Route path="/biometric-mappings" element={<RoleGuard roles={['admin']}><BiometricMappings /></RoleGuard>} />
        <Route path="/biometric-test" element={<RoleGuard roles={['admin']}><BiometricTest /></RoleGuard>} />

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-800 mb-4">404</h1>
        <p className="text-slate-600 mb-6">Page not found</p>
        <a href="/" className="text-primary-600 hover:text-primary-700 font-medium">
          Go back home
        </a>
      </div>
    </div>
  );
}

export default App;
