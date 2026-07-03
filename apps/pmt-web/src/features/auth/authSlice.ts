import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, User } from './types';
import { ENV } from '@/lib/env';
import { loadPersistedTokens, savePersistedTokens, clearPersistedTokens } from '@/lib/authStorage';

// Keycloak mode: the access token is held in memory only; keycloak.init()
// re-authenticates on reload. JWT mode: tokens are persisted to localStorage
// so the session survives a reload (loaded into initialState below).
const persisted = ENV.AUTH_MODE === 'jwt' ? loadPersistedTokens() : null;

const initialState: AuthState = {
  user: null,
  accessToken: persisted?.accessToken ?? null,
  refreshToken: persisted?.refreshToken ?? null,
  isAuthenticated: !!persisted?.accessToken,
  isLoading: false,
  isAdmin: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Called after Keycloak authenticates (init or token refresh) to store the
    // current access token in memory for use as Bearer header in API calls.
    setKeycloakToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
      state.isAuthenticated = true;
    },
    // Local email/password login (AUTH_MODE=jwt). Persists tokens for reload.
    setLocalTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken?: string | null }>) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken ?? null;
      state.isAuthenticated = true;
      savePersistedTokens({ accessToken: action.payload.accessToken, refreshToken: action.payload.refreshToken ?? null });
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    setIsAdmin: (state, action: PayloadAction<boolean>) => {
      state.isAdmin = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isAdmin = false;
      clearPersistedTokens();
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setKeycloakToken, setLocalTokens, setUser, logout, setLoading, setIsAdmin } = authSlice.actions;

export default authSlice.reducer;
