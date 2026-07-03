// Local JWT token persistence (AUTH_MODE=jwt only). Keeps the session alive
// across page reloads. In Keycloak mode these are never used.

const KEY = 'pf_local_auth';

export interface PersistedTokens {
  accessToken: string;
  refreshToken: string | null;
}

export function loadPersistedTokens(): PersistedTokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.accessToken === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function savePersistedTokens(tokens: PersistedTokens): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tokens));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function clearPersistedTokens(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
