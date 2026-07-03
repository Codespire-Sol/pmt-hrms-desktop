import { config } from '../config';
import { logger } from './logger';

interface KeycloakAdminTokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: KeycloakAdminTokenCache | null = null;

/**
 * Get a short-lived admin access token from Keycloak using client credentials.
 * Requires a confidential service-account client (keycloak-admin-client) with
 * realm-management → manage-users role assigned.
 */
async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 10_000) {
    return tokenCache.token;
  }

  const url = `${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.keycloak.adminClientId,
    client_secret: config.keycloak.adminClientSecret,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak admin token fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return tokenCache.token;
}

/**
 * Update a Keycloak user's email and username by their sub UUID.
 * Non-fatal: logs a warning on failure.
 */
export async function updateKeycloakUserEmail(keycloakSub: string, newEmail: string): Promise<void> {
  if (config.auth.mode === 'jwt') return;
  try {
    const token = await getAdminToken();
    const url = `${config.keycloak.url}/admin/realms/${config.keycloak.realm}/users/${keycloakSub}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: newEmail, username: newEmail }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn(`Keycloak email update failed for ${keycloakSub} (${res.status}): ${text}`);
    } else {
      logger.info(`Keycloak email updated for sub: ${keycloakSub} → ${newEmail}`);
    }
  } catch (err) {
    logger.warn(`Keycloak email update error for ${keycloakSub}: ${(err as Error).message}`);
  }
}

/**
 * Reset (or set) a Keycloak user's password by their sub UUID.
 * @param temporary - if true, user must change password on next login (default false)
 * Non-fatal: logs a warning on failure.
 */
export async function resetKeycloakUserPassword(keycloakSub: string, newPassword: string, temporary = false): Promise<void> {
  if (config.auth.mode === 'jwt') return;
  try {
    const token = await getAdminToken();
    const url = `${config.keycloak.url}/admin/realms/${config.keycloak.realm}/users/${keycloakSub}/reset-password`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type: 'password', value: newPassword, temporary }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn(`Keycloak password reset failed for ${keycloakSub} (${res.status}): ${text}`);
    } else {
      logger.info(`Keycloak password reset for sub: ${keycloakSub}`);
    }
  } catch (err) {
    logger.warn(`Keycloak password reset error for ${keycloakSub}: ${(err as Error).message}`);
  }
}

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  emailVerified: boolean;
  createdTimestamp: number;
}

/**
 * List all users in the Keycloak realm.
 * Returns up to `max` users (default 200).
 */
export async function listKeycloakUsers(max = 200): Promise<KeycloakUser[]> {
  if (config.auth.mode === 'jwt') return [];
  const token = await getAdminToken();
  const url = `${config.keycloak.url}/admin/realms/${config.keycloak.realm}/users?max=${max}&briefRepresentation=false`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak listUsers failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<KeycloakUser[]>;
}

/**
 * Get client-level role mappings for a Keycloak user by their sub UUID.
 * Returns the first client role name found (e.g. 'admin', 'hr', 'manager', 'employee'), or null.
 */
export async function getUserClientRole(keycloakSub: string): Promise<string | null> {
  if (config.auth.mode === 'jwt') return null;
  try {
    const token = await getAdminToken();
    const adminBase = `${config.keycloak.url}/admin/realms/${config.keycloak.realm}`;

    // First, find the internal ID of our SPA client
    const clientsRes = await fetch(
      `${adminBase}/clients?clientId=${encodeURIComponent(config.keycloak.clientId)}&briefRepresentation=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!clientsRes.ok) return null;
    const clients = await clientsRes.json() as Array<{ id: string }>;
    const clientInternalId = clients[0]?.id;
    if (!clientInternalId) return null;

    // Fetch client role mappings for the user
    const rolesRes = await fetch(
      `${adminBase}/users/${keycloakSub}/role-mappings/clients/${clientInternalId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!rolesRes.ok) return null;
    const roles = await rolesRes.json() as Array<{ name: string }>;
    return roles[0]?.name ?? null;
  } catch (err) {
    logger.warn(`getUserClientRole error for ${keycloakSub}: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Send a password-reset email to a Keycloak user by their sub UUID.
 * Uses Keycloak's execute-actions-email endpoint with UPDATE_PASSWORD action.
 */
export async function sendPasswordResetEmail(keycloakSub: string): Promise<void> {
  if (config.auth.mode === 'jwt') return;
  const token = await getAdminToken();
  const url = `${config.keycloak.url}/admin/realms/${config.keycloak.realm}/users/${keycloakSub}/execute-actions-email`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(['UPDATE_PASSWORD']),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak sendPasswordResetEmail failed for ${keycloakSub} (${res.status}): ${text}`);
  }
  logger.info(`Password reset email sent for Keycloak sub: ${keycloakSub}`);
}

/**
 * Disable a Keycloak user by their sub UUID.
 * Used during offboarding to prevent further logins.
 * Non-fatal: logs a warning on failure.
 */
export async function disableKeycloakUser(keycloakSub: string): Promise<void> {
  if (config.auth.mode === 'jwt') return;
  try {
    const token = await getAdminToken();
    const url = `${config.keycloak.url}/admin/realms/${config.keycloak.realm}/users/${keycloakSub}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled: false }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn(`Keycloak user disable failed for ${keycloakSub} (${res.status}): ${text}`);
    } else {
      logger.info(`Keycloak user disabled for sub: ${keycloakSub}`);
    }
  } catch (err) {
    logger.warn(`Keycloak user disable error for ${keycloakSub}: ${(err as Error).message}`);
  }
}

/**
 * Create a user in Keycloak and return the new user's Keycloak UUID (sub).
 * If the user already exists in Keycloak (409), fetches and returns the existing sub.
 * Non-fatal: logs a warning and returns null on failure so DB creation is not rolled back.
 */
export async function createKeycloakUser(params: {
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword: string;
  temporary?: boolean;
}): Promise<string | null> {
  // In local JWT mode there is no Keycloak — skip provisioning entirely.
  if (config.auth.mode === 'jwt') return null;
  try {
    const token = await getAdminToken();
    const adminBaseUrl = `${config.keycloak.url}/admin/realms/${config.keycloak.realm}`;

    const body = {
      username: params.email,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      enabled: true,
      emailVerified: true,
      credentials: [
        { type: 'password', value: params.temporaryPassword, temporary: params.temporary ?? true },
      ],
    };

    const createRes = await fetch(`${adminBaseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (createRes.status === 201) {
      // Location header: .../users/{uuid}
      const location = createRes.headers.get('Location') ?? '';
      const sub = location.split('/').pop() ?? null;
      logger.info(`Keycloak user created: ${params.email} → ${sub}`);
      return sub;
    }

    if (createRes.status === 409) {
      // User already exists — look them up by email to get sub
      logger.warn(`Keycloak user already exists for ${params.email}, fetching existing sub`);
      const searchRes = await fetch(
        `${adminBaseUrl}/users?email=${encodeURIComponent(params.email)}&exact=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const users = await searchRes.json() as Array<{ id: string }>;
        return users[0]?.id ?? null;
      }
    }

    const text = await createRes.text();
    logger.warn(`Keycloak user creation failed for ${params.email} (${createRes.status}): ${text}`);
    return null;
  } catch (err) {
    logger.warn(`Keycloak user provisioning error for ${params.email}: ${(err as Error).message}`);
    return null;
  }
}
