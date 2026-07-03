import { fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../app/store';
import { setKeycloakToken, setLocalTokens, logout } from '../features/auth/authSlice';
import keycloak from './keycloak';
import { ENV } from './env';

const API_VERSION = ENV.API_VERSION;

function makeFetchBaseQuery(baseUrl: string) {
  return fetchBaseQuery({
    baseUrl,
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  });
}

/**
 * Wraps fetchBaseQuery with a Keycloak token-refresh retry on 401.
 * When a request returns 401, we attempt updateToken(30) once.
 * If the refresh succeeds the request is retried with the new token.
 * Only if the refresh itself fails do we let the 401 propagate (triggering logout).
 */
export function createAuthBaseQuery(baseUrl: string): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  const baseQuery = makeFetchBaseQuery(baseUrl);

  return async (args, api, extraOptions) => {
    let result = await baseQuery(args, api, extraOptions);

    if (result.error?.status === 401) {
      if (ENV.AUTH_MODE === 'jwt') {
        // Local JWT mode: try one refresh via /auth/refresh, else log out.
        const isRefreshCall = typeof args === 'object' && (args as FetchArgs).url?.includes('/auth/refresh');
        const rt = (api.getState() as RootState).auth.refreshToken;
        if (!isRefreshCall) {
          const refreshResult = await baseQuery(
            { url: '/auth/refresh', method: 'POST', body: rt ? { refreshToken: rt } : {} },
            api,
            extraOptions,
          );
          const newToken = (refreshResult.data as { data?: { accessToken?: string } } | undefined)?.data?.accessToken;
          if (newToken) {
            api.dispatch(setLocalTokens({ accessToken: newToken, refreshToken: rt }));
            result = await baseQuery(args, api, extraOptions);
          } else {
            api.dispatch(logout());
            window.location.assign('/login');
          }
        } else {
          api.dispatch(logout());
          window.location.assign('/login');
        }
      } else {
        try {
          await keycloak.updateToken(30);
          if (keycloak.token) {
            api.dispatch(setKeycloakToken(keycloak.token));
            // Retry original request — prepareHeaders will pick up the new token
            result = await baseQuery(args, api, extraOptions);
          }
        } catch {
          // Refresh failed — let the 401 propagate so apiErrorMiddleware handles logout
        }
      }
    }

    return result;
  };
}

/** Pre-configured base query with the default API version prefix */
export const authBaseQuery = createAuthBaseQuery(`/api/${API_VERSION}`);
