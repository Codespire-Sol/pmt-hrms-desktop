import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { emitAppFatalError } from '../utils/errorEvents';
import keycloak from '../lib/keycloak';
import { ENV } from '../lib/env';

const VITE_API_BASE_URL = ENV.API_BASE_URL;
const VITE_API_URL = ENV.API_URL;
const VITE_API_VERSION = ENV.API_VERSION;

// If VITE_API_BASE_URL is relative or absolute, use it. 
// Otherwise construct from VITE_API_URL and VITE_API_VERSION
const API_BASE_URL = VITE_API_BASE_URL || `${VITE_API_URL}${VITE_API_VERSION ? `/${VITE_API_VERSION}` : ''}`;

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;

    // Only inject the auth-store token if the caller didn't already set an
    // Authorization header (e.g. onboarding session token).
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request ID
    config.headers['X-Request-ID'] = generateRequestId();

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;

      // Handle 401 - Unauthorized
      // Skip auto-logout on public onboarding pages (they use their own session token).
      if (status === 401 && !window.location.pathname.startsWith('/register/')) {
        if (ENV.AUTH_MODE === 'jwt') {
          // Local JWT mode: try one refresh, else log out and return to login.
          const isRefreshCall = (error.config?.url || '').includes('/auth/refresh');
          if (!isRefreshCall) {
            try {
              const rt = useAuthStore.getState().refreshToken;
              const r = await apiClient.post('/auth/refresh', rt ? { refreshToken: rt } : {});
              const newToken = r.data?.data?.accessToken || r.data?.accessToken;
              if (!newToken) throw new Error('no token');
              useAuthStore.setState({ token: newToken });
              error.config.headers.Authorization = `Bearer ${newToken}`;
              return apiClient(error.config);
            } catch {
              useAuthStore.getState().logout();
              window.location.assign('/');
            }
          } else {
            useAuthStore.getState().logout();
            window.location.assign('/');
          }
        } else {
          try {
            await keycloak.updateToken(30);
            useAuthStore.getState().setKeycloakToken(keycloak.token);
            // Retry the original request with the refreshed token
            error.config.headers.Authorization = `Bearer ${keycloak.token}`;
            return apiClient(error.config);
          } catch {
            useAuthStore.getState().logout();
            keycloak.login({ redirectUri: window.location.href });
          }
        }
      }

      // Return error data
      return Promise.reject(data?.error || { message: 'An error occurred' });
    } else if (error.request) {
      // Request made but no response
      emitAppFatalError({
        title: 'Server is not responding',
        message: 'No response from server. Please ensure backend is running and reachable.',
        code: 'SERVER_UNREACHABLE',
      });
      return Promise.reject({
        code: 'SERVER_UNREACHABLE',
        message: 'No response from server. Please check your connection.'
      });
    } else {
      // Something else happened
      return Promise.reject({
        message: error.message || 'An unexpected error occurred'
      });
    }
  }
);

// Helper function to generate request ID
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default apiClient;
