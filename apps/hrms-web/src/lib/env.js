// Runtime environment variables for Docker/Kubernetes deployments.
// docker-entrypoint.sh generates /config/env.js at container startup which sets window.__ENV__.
// index.html loads /config/env.js before the main bundle, so window.__ENV__ is available
// when this module evaluates.
// Falls back to import.meta.env for local Vite development.

function getEnv(key, defaultValue = '') {
  return window.__ENV__?.[key]
    ?? import.meta.env[key]
    ?? defaultValue;
}

export const ENV = {
  API_BASE_URL: getEnv('VITE_API_BASE_URL'),
  API_URL: getEnv('VITE_API_URL', '/api'),
  API_VERSION: getEnv('VITE_API_VERSION', 'v1'),
  WS_URL: getEnv('VITE_WS_URL'),
  APP_NAME: getEnv('VITE_APP_NAME', 'HRMS'),
  UPLOADS_BASE_URL: getEnv('VITE_UPLOADS_BASE_URL'),
  // 'jwt' = local email/password login (no Keycloak); 'keycloak' = SSO.
  AUTH_MODE: getEnv('VITE_AUTH_MODE', 'keycloak'),
  // Host machine's LAN address (set by the installer) so the Share button can
  // show a link teammates can actually open, even when the admin uses localhost.
  PUBLIC_HOST: getEnv('PUBLIC_HOST'),
  KEYCLOAK_URL: getEnv('VITE_KEYCLOAK_URL'),
  KEYCLOAK_REALM: getEnv('VITE_KEYCLOAK_REALM'),
  KEYCLOAK_CLIENT_ID: getEnv('VITE_KEYCLOAK_CLIENT_ID'),
};
