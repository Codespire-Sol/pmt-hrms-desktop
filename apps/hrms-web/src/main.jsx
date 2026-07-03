import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './App.jsx';
import { antdTheme } from './styles/theme';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import GlobalErrorGate from './components/common/GlobalErrorGate';
import keycloak from './lib/keycloak';
import { useAuthStore } from './store/authStore';
import { ENV } from './lib/env';
import './styles/globals.css';

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ConfigProvider theme={antdTheme}>
      <AppErrorBoundary>
        <GlobalErrorGate>
          <App />
        </GlobalErrorGate>
      </AppErrorBoundary>
    </ConfigProvider>,
  );
}

// --- Local JWT mode: no Keycloak. Render immediately; App gates on auth. ---
if (ENV.AUTH_MODE === 'jwt') {
  // If a session token was persisted, mark authenticated up-front to avoid a
  // login-screen flash before App restores the profile.
  if (useAuthStore.getState().token) {
    useAuthStore.setState({ isAuthenticated: true });
  }
  renderApp();
} else {
  keycloak
    .init({
    onLoad: 'login-required',
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  })
  .then((authenticated) => {
    // If Keycloak authenticated (including after redirect-back from login),
    // seed the auth store with the token BEFORE rendering so Layout sees
    // isAuthenticated=true immediately and never triggers a second login redirect.
    if (authenticated && keycloak.token) {
      useAuthStore.getState().setKeycloakToken(keycloak.token);
    }

    // Strip Keycloak OAuth hash params from the URL so React Router gets a
    // clean path (e.g. /dashboard instead of /dashboard#state=...&code=...).
    // Without this the router misreads the hash and re-renders the wrong route.
    if (window.location.hash && window.location.hash.includes('state=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    renderApp();
  })
    .catch((err) => {
      console.error('Keycloak init failed:', err);
      // Render app anyway — Layout will call keycloak.login() when needed
      renderApp();
    });
}
