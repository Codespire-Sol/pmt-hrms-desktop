import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resolveUserRole, normalizeAvatarUrl } from '../utils/auth';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,       // access token (Keycloak token, or local JWT in AUTH_MODE=jwt)
      refreshToken: null, // local JWT refresh token (jwt mode only)
      permissions: [],
      role: null,
      isAuthenticated: false,

      // Called after Keycloak authenticates to store the token in memory
      setKeycloakToken: (accessToken) => {
        set({ token: accessToken, isAuthenticated: true });
      },

      // Called after a local email/password login (AUTH_MODE=jwt)
      setLocalTokens: (accessToken, refreshToken) => {
        set({ token: accessToken, refreshToken: refreshToken ?? null, isAuthenticated: true });
      },

      // Called after fetching /auth/me + permissions + profile to populate user data
      setUserProfile: ({ user, permissions = [], role = null }) => {
        const effectiveRole = resolveUserRole(user, role);
        set({
          user: {
            ...user,
            avatarUrl: normalizeAvatarUrl(user?.avatarUrl),
            role: effectiveRole,
          },
          permissions,
          role: effectiveRole,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          permissions: [],
          role: null,
          isAuthenticated: false
        });
      },

      updateUser: (userData) => {
        const normalizedData = { ...userData };
        if (normalizedData.avatarUrl !== undefined) {
          normalizedData.avatarUrl = normalizeAvatarUrl(normalizedData.avatarUrl);
        }
        set((state) => ({
          user: { ...state.user, ...normalizedData }
        }));
      },

      // Getters
      getToken: () => get().token,
      getUser: () => get().user,
      isAdmin: () => get().user?.role === 'admin',
      isHR: () => get().user?.role === 'hr',
      isManager: () => get().user?.role === 'manager',
      isEmployee: () => get().user?.role === 'employee'
    }),
    {
      name: 'auth-storage',
      // Persist profile data + the local JWT tokens so a jwt-mode session
      // survives a page reload. In Keycloak mode the token is re-populated by
      // Keycloak on each load, so persisting it is harmless (it gets overwritten).
      partialize: (state) => ({
        user: state.user,
        permissions: state.permissions,
        role: state.role,
        token: state.token,
        refreshToken: state.refreshToken,
      })
    }
  )
);
