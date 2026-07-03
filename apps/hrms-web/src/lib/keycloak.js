import Keycloak from 'keycloak-js';
import { ENV } from './env';

if (!ENV.KEYCLOAK_URL || !ENV.KEYCLOAK_REALM || !ENV.KEYCLOAK_CLIENT_ID) {
  console.error(
    '[Keycloak] ❌ Missing required environment variables:\n' +
    `  VITE_KEYCLOAK_URL     = "${ENV.KEYCLOAK_URL}"\n` +
    `  VITE_KEYCLOAK_REALM   = "${ENV.KEYCLOAK_REALM}"\n` +
    `  VITE_KEYCLOAK_CLIENT_ID = "${ENV.KEYCLOAK_CLIENT_ID}"\n\n` +
    'Set these in the server environment (Docker/CI) or in .env for local dev.'
  );
}

const keycloak = new Keycloak({
  url: ENV.KEYCLOAK_URL,
  realm: ENV.KEYCLOAK_REALM,
  clientId: ENV.KEYCLOAK_CLIENT_ID,
});

export default keycloak;
