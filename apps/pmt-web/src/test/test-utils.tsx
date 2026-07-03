import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import type { AuthState } from '@/features/auth/types';
import { authApi } from '@/features/auth/authApi';
import { projectsApi } from '@/features/projects/projectsApi';
import { issuesApi } from '@/features/issues/issuesApi';

// Create a mock store with preloaded state
export function createMockStore(preloadedState?: {
  auth?: Partial<AuthState>;
}): EnhancedStore {
  return configureStore({
    reducer: {
      auth: authReducer,
      [authApi.reducerPath]: authApi.reducer,
      [projectsApi.reducerPath]: projectsApi.reducer,
      [issuesApi.reducerPath]: issuesApi.reducer,
    },
    preloadedState: {
      auth: {
        isAuthenticated: false,
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
        ...preloadedState?.auth,
      } as AuthState,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .concat(authApi.middleware)
        .concat(projectsApi.middleware)
        .concat(issuesApi.middleware),
  });
}

// Mock user for authenticated tests
export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  displayName: 'Test User',
  avatarUrl: null,
  role: 'admin',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// Mock authenticated state
export const mockAuthenticatedState = {
  auth: {
    isAuthenticated: true,
    user: mockUser as any,
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    isLoading: false,
  },
};

interface AllProvidersProps {
  children: React.ReactNode;
  store?: EnhancedStore;
  initialEntries?: string[];
}

// All Providers wrapper for testing
function AllProviders({ children, store, initialEntries }: AllProvidersProps) {
  const testStore = store || createMockStore();

  return (
    <Provider store={testStore}>
      {initialEntries ? (
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      ) : (
        <BrowserRouter>{children}</BrowserRouter>
      )}
    </Provider>
  );
}

// Custom render function with all providers
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  store?: EnhancedStore;
  initialEntries?: string[];
  preloadedState?: { auth?: Partial<AuthState> };
}

export function renderWithProviders(
  ui: ReactElement,
  {
    store,
    initialEntries,
    preloadedState,
    ...renderOptions
  }: CustomRenderOptions = {}
): RenderResult & { store: EnhancedStore } {
  const testStore = store || createMockStore(preloadedState);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllProviders store={testStore} initialEntries={initialEntries}>
      {children}
    </AllProviders>
  );

  return {
    store: testStore,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Re-export everything from testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
