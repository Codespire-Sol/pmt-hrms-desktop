import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { store } from './app/store';
import { injectStore } from './lib/api';
import { SocketProvider } from './contexts/SocketContext';
import keycloak from './lib/keycloak';
import { setKeycloakToken } from './features/auth/authSlice';
import { ENV } from './lib/env';
import './index.css';

// Give the axios instance access to the Redux store so it can dispatch logout()
// when a token refresh fails, keeping Redux state in sync with the redirect.
injectStore(store);

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <SocketProvider>
            <App />
          </SocketProvider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>
  );
}

if (ENV.AUTH_MODE === 'jwt') {
  // Local JWT mode: no Keycloak. The store's initial state already holds any
  // persisted token (see authSlice), so render immediately.
  renderApp();
} else {
  keycloak
    .init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    })
    .then((authenticated) => {
    // If Keycloak authenticated (including after redirect-back from login),
    // seed Redux with the token BEFORE rendering so ProtectedRoute sees
    // isAuthenticated=true immediately and never shows a blank page.
    if (authenticated && keycloak.token) {
      store.dispatch(setKeycloakToken(keycloak.token));
    }

    // Strip Keycloak OAuth hash params from the URL so the router gets a
    // clean path (e.g. /admin/workflows instead of /admin/workflows#state=...).
    if (window.location.hash && window.location.hash.includes('state=')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    renderApp();
  })
    .catch((err) => {
      console.error('Keycloak init failed', err);
      // Render app anyway — ProtectedRoute will trigger keycloak.login() when needed
      renderApp();
    });
}
