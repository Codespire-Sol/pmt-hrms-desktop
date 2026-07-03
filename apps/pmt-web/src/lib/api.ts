import axios, { AxiosInstance } from 'axios';
import keycloak from './keycloak';
import { ENV } from './env';

const API_VERSION = ENV.API_VERSION;

// Lazily import the store to avoid circular dependency issues at module init time.
let _store: import('../app/store').AppStore | null = null;
export function injectStore(store: import('../app/store').AppStore) {
  _store = store;
}

export const api: AxiosInstance = axios.create({
  baseURL: `/api/${API_VERSION}`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor — attach Keycloak access token as Bearer header
api.interceptors.request.use(
  (config) => {
    const token = keycloak.token || (_store?.getState().auth.accessToken ?? null);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — on 401, ask Keycloak to refresh the token then retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const isRefreshCall = (originalRequest.url || '').includes('/auth/refresh');

      if (ENV.AUTH_MODE === 'jwt') {
        // Local JWT mode: try one refresh via the store's refresh token, else log out.
        if (!isRefreshCall) {
          try {
            const rt = _store?.getState().auth.refreshToken ?? null;
            const resp = await api.post('/auth/refresh', rt ? { refreshToken: rt } : {});
            const newToken = resp.data?.data?.accessToken;
            if (newToken && _store) {
              const { setLocalTokens } = await import('../features/auth/authSlice');
              _store.dispatch(setLocalTokens({ accessToken: newToken, refreshToken: rt }));
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return api(originalRequest);
            }
          } catch { /* fall through to logout */ }
        }
        if (_store) {
          const { logout } = await import('../features/auth/authSlice');
          _store.dispatch(logout());
        }
        window.location.assign('/login');
        return Promise.reject(error);
      }

      try {
        // Ask Keycloak to refresh if the token expires within 30 seconds
        const refreshed = await keycloak.updateToken(30);
        if (refreshed && keycloak.token && _store) {
          const { setKeycloakToken } = await import('../features/auth/authSlice');
          _store.dispatch(setKeycloakToken(keycloak.token));
        }
        if (keycloak.token) {
          originalRequest.headers.Authorization = `Bearer ${keycloak.token}`;
          return api(originalRequest);
        }
      } catch {
        // Refresh failed — Keycloak session ended, redirect to login
        keycloak.logout({ redirectUri: window.location.origin });
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
