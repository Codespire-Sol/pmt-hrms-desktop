// Runtime environment variables for Docker deployments.
// docker-entrypoint.sh generates /config/env.js at container startup which sets window.__ENV__.
// index.html loads /config/env.js before the main bundle, so window.__ENV__ is available
// when this module evaluates.
// Falls back to import.meta.env for local Vite development.

function getEnv(key: string, defaultValue = ''): string {
  return (window as Window & { __ENV__?: Record<string, string> }).__ENV__?.[key]
    ?? (import.meta.env as Record<string, string>)[key]
    ?? defaultValue;
}

export const ENV = {
  API_URL: getEnv('VITE_API_URL'),
  API_VERSION: getEnv('VITE_API_VERSION', 'v1'),
  WS_URL: getEnv('VITE_WS_URL'),
  APP_NAME: getEnv('VITE_APP_NAME', 'ProjectFlow AI'),
  APP_DESCRIPTION: getEnv('VITE_APP_DESCRIPTION', 'AI-Powered Project Management Platform'),
  // 'jwt' = local email/password login (no Keycloak); 'keycloak' = SSO.
  AUTH_MODE: getEnv('VITE_AUTH_MODE', 'keycloak'),
  // Host machine's LAN address (set by the installer) so the Share button can
  // show a link teammates can actually open, even when the admin uses localhost.
  PUBLIC_HOST: getEnv('PUBLIC_HOST'),
  KEYCLOAK_URL: getEnv('VITE_KEYCLOAK_URL'),
  KEYCLOAK_REALM: getEnv('VITE_KEYCLOAK_REALM'),
  KEYCLOAK_CLIENT_ID: getEnv('VITE_KEYCLOAK_CLIENT_ID'),
} as const;
