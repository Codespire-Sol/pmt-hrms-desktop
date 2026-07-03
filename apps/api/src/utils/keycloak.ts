import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '../config';

export interface KeycloakTokenPayload {
  sub: string;            // Keycloak user UUID
  email: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  jti?: string;           // JWT ID — used for Redis blacklist
  exp?: number;
  iat?: number;
  azp?: string;           // Authorized party — the client the token was issued for
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
}

// Keys are fetched from the INTERNAL url (reachable from the API container).
// The realm signing key is host-independent, so keys fetched here validate a
// token regardless of which hostname the browser used to obtain it.
const client = jwksClient({
  jwksUri: `${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/certs`,
  cache: true,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  rateLimit: true,
});

function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid!, (err, key) => {
    if (err) return callback(err);
    callback(null, key!.getPublicKey());
  });
}

export function verifyKeycloakToken(token: string): Promise<KeycloakTokenPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        // Validate against the PUBLIC issuer (the host the browser logged in
        // through). Equals `url` unless KEYCLOAK_ISSUER_URL overrides it.
        issuer: `${config.keycloak.issuerUrl}/realms/${config.keycloak.realm}`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(new Error('Invalid or expired token'));
        resolve(decoded as KeycloakTokenPayload);
      }
    );
  });
}
