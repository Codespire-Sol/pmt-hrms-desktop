import Keycloak from 'keycloak-js';
import { ENV } from './env';

const keycloak = new Keycloak({
  url: ENV.KEYCLOAK_URL,
  realm: ENV.KEYCLOAK_REALM,
  clientId: ENV.KEYCLOAK_CLIENT_ID,
});

export default keycloak;
