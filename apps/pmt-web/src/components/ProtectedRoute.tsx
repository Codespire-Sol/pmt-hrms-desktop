import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import keycloak from '../lib/keycloak';
import { ENV } from '../lib/env';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const loginTriggered = useRef(false);

  useEffect(() => {
    // Local JWT mode: unauthenticated users are redirected to /login (below).
    if (ENV.AUTH_MODE === 'jwt') return;
    if (!isAuthenticated && !keycloak.authenticated && !loginTriggered.current) {
      loginTriggered.current = true;
      keycloak.login({ redirectUri: window.location.href });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    if (ENV.AUTH_MODE === 'jwt') {
      return <Navigate to="/login" replace />;
    }
    return null;
  }

  return <>{children}</>;
}
