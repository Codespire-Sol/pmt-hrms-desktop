import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * Restricts route access to specified roles.
 * If the user's role is not in the allowed list, redirects to /dashboard.
 *
 * Usage: <RoleGuard roles={['admin', 'hr']}><Component /></RoleGuard>
 */
export default function RoleGuard({ roles, children }) {
  const { role, isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  const normalizedRole = (role || '').toLowerCase();
  if (!roles.includes(normalizedRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
