import { useAuthStore } from '../store/authStore';
import { authAPI } from '../api/auth';
import { settingsAPI } from '../api/settings';
import keycloak from '../lib/keycloak';
import { ENV } from '../lib/env';
import { buildDisplayName, resolveUserRole, normalizeRoleName, normalizeAvatarUrl } from '../utils/auth';

/**
 * Fetch /auth/me + permissions + profile and populate the store.
 * Assumes the access token is already set in the store.
 */
export async function loadUserProfile(accessToken) {
  const store = useAuthStore.getState();

  // 1. Fetch user identity (/auth/me)
  let currentUser = {};
  try {
    const userRes = await authAPI.getCurrentUser(accessToken);
    currentUser = userRes.data?.data?.user || userRes.data?.data || userRes.data || {};
  } catch (e) {
    console.warn('Failed to fetch /auth/me', e);
  }

  // 2. Fetch permissions
  let permissionNames = [];
  let roleData = null;
  try {
    const permRes = await authAPI.getMyPermissions(accessToken);
    const permBody = permRes.data || {};
    roleData = permBody?.role || permBody?.data?.role || null;
    permissionNames = permBody?.permissions || permBody?.data?.permissions || [];
  } catch (e) {
    console.error('Failed to fetch permissions', e);
  }

  const resolvedRoleName = normalizeRoleName(
    roleData?.name || currentUser?.role?.name || currentUser?.role
  );

  // Temporarily set role so settingsAPI.getProfile() picks the right endpoint
  useAuthStore.setState({
    user: {
      ...currentUser,
      avatarUrl: normalizeAvatarUrl(currentUser?.avatarUrl),
      role: resolvedRoleName,
    },
    role: resolvedRoleName,
  });

  // 3. Fetch full profile
  let profile = {};
  try {
    const meResponse = await settingsAPI.getProfile();
    const meBody = meResponse?.data || {};
    profile = meBody?.data || meBody || currentUser || {};
  } catch (e) {
    console.warn('Profile fetch failed, using /auth/me data', e);
    profile = currentUser || {};
  }

  const finalRole = resolveUserRole(profile, roleData) || resolvedRoleName;

  const normalizedUser = {
    ...profile,
    role: finalRole,
    roleName: finalRole,
    name: buildDisplayName(profile),
    avatarUrl: normalizeAvatarUrl(profile.avatarUrl || profile.personal?.avatarUrl || currentUser?.avatarUrl),
    email: profile.email || currentUser?.email,
    id: profile.id || currentUser?.id,
    branchId: profile.branchId || currentUser?.branchId || null,
  };

  store.setUserProfile({ user: normalizedUser, permissions: permissionNames, role: finalRole });
}

/**
 * Called once after Keycloak authenticates (page load or token refresh).
 */
export async function initFromKeycloak(accessToken) {
  useAuthStore.getState().setKeycloakToken(accessToken);
  await loadUserProfile(accessToken);
}

/**
 * Local email/password login (AUTH_MODE=jwt). Stores tokens, then loads profile.
 */
export async function loginLocal(email, password, rememberMe = false) {
  const res = await authAPI.login(email, password, rememberMe);
  const data = res.data?.data || res.data || {};
  const accessToken = data.accessToken;
  const refreshToken = data.refreshToken;
  if (!accessToken) throw new Error('Login failed: no token returned');
  useAuthStore.getState().setLocalTokens(accessToken, refreshToken);
  await loadUserProfile(accessToken);
  return useAuthStore.getState().user;
}

/**
 * Restore a persisted local JWT session on page load (AUTH_MODE=jwt).
 * Returns true if a token was present and the profile was (re)loaded.
 */
export async function initLocalSession() {
  const token = useAuthStore.getState().token;
  if (!token) return false;
  useAuthStore.setState({ isAuthenticated: true });
  try {
    await loadUserProfile(token);
  } catch (e) {
    console.warn('[Auth] Local session restore failed', e);
  }
  return true;
}

export function useAuth() {
  const { user: rawUser, token, permissions, role, isAuthenticated } = useAuthStore();
  const user = rawUser ? { ...rawUser, avatarUrl: normalizeAvatarUrl(rawUser.avatarUrl) } : null;
  const normalizedRole = normalizeRoleName(user?.role);

  const logout = () => {
    if (ENV.AUTH_MODE === 'jwt') {
      try { authAPI.logout(); } catch { /* best effort */ }
      useAuthStore.getState().logout();
      window.location.assign('/');
      return;
    }
    useAuthStore.getState().logout();
    keycloak.logout({ redirectUri: window.location.origin });
  };

  const refreshProfile = async () => {
    if (ENV.AUTH_MODE === 'jwt') {
      const t = useAuthStore.getState().token;
      if (!t) return;
      await loadUserProfile(t);
      return useAuthStore.getState().user;
    }
    if (!keycloak.token) return;
    await initFromKeycloak(keycloak.token);
    return useAuthStore.getState().user;
  };

  return {
    user,
    token,
    permissions,
    role,
    isAuthenticated,
    logout,
    refreshProfile,
    isAdmin: normalizedRole === 'admin',
    isHR: normalizedRole === 'hr',
    isManager: normalizedRole === 'manager',
    isEmployee: normalizedRole === 'employee',
  };
}
