#!/bin/sh
# Container entrypoint for hrms-web. Two responsibilities before nginx starts.
# Designed so the pod ALWAYS boots — missing/empty env vars never crash startup.
# If the backend is unreachable nginx returns 502 per request and stays up.
#
# 1. ASSEMBLE nginx.conf from snippets in /etc/nginx/snippets/.
#    The API reverse-proxy + WebSocket support are included ONLY when
#    BACKEND_URL is set. A pure-static deploy gets header + server-open +
#    static + footer with no proxy_pass at all.
#
# 2. Write /tmp/config.js, populating window.__ENV__ with non-secret
#    runtime config. index.html loads /config/env.js (nginx aliases it here)
#    BEFORE the main bundle so React reads it at startup.

set -eu

SNIPPETS=/etc/nginx/snippets
RENDERED=/tmp/nginx.conf

# ---- defaults (explicit empty value is honoured; only truly unset vars fall back) ----
: "${SERVER_PORT:=8080}"
: "${API_PATH_PREFIX:=/api}"
: "${APP_NAME:=HRMS}"
: "${APP_PROFILE:=dev}"
: "${VITE_API_URL:=${API_PATH_PREFIX}}"
: "${VITE_API_VERSION:=v1}"
: "${VITE_WS_URL:=}"
: "${VITE_APP_NAME:=${APP_NAME}}"
: "${VITE_APP_DESCRIPTION:=HR Management System}"
: "${VITE_AUTH_MODE:=keycloak}"
: "${PUBLIC_HOST:=}"
: "${VITE_KEYCLOAK_URL:=}"
: "${VITE_KEYCLOAK_REALM:=}"
: "${VITE_KEYCLOAK_CLIENT_ID:=hrms-web}"
# NOTE: BACKEND_URL has NO default. Setting it opts the SPA into the
# API/WebSocket reverse-proxy path. Leaving it unset = pure-static SPA,
# no proxy block in nginx.conf.

# ---- DNS resolver (only used when proxying) ----
DNS_RESOLVER=$(awk '/^nameserver / { print $2; exit }' /etc/resolv.conf 2>/dev/null || true)
: "${DNS_RESOLVER:=1.1.1.1}"

export SERVER_PORT API_PATH_PREFIX DNS_RESOLVER
[ -n "${BACKEND_URL:-}" ] && export BACKEND_URL

# ---- 1. Assemble nginx.conf from snippets ----
{
    cat "$SNIPPETS/header.conf"
    if [ -n "${BACKEND_URL:-}" ]; then
        envsubst '${DNS_RESOLVER}' < "$SNIPPETS/proxy.conf"
    fi
    envsubst '${SERVER_PORT}' < "$SNIPPETS/server-open.conf"
    if [ -n "${BACKEND_URL:-}" ]; then
        envsubst '${API_PATH_PREFIX} ${BACKEND_URL}' < "$SNIPPETS/api.conf"
    fi
    cat "$SNIPPETS/static.conf"
    cat "$SNIPPETS/footer.conf"
} > "$RENDERED"

# Validate rendered config now so a bad snippet fails fast.
if ! nginx -t -c "$RENDERED" 2>&1; then
    echo "[entrypoint] nginx -t failed; rendered config:" >&2
    cat "$RENDERED" >&2
    exit 1
fi

# ---- 2. SPA runtime config ----
# Written to /tmp (the only writable mount under readOnlyRootFilesystem=true).
# nginx serves /config/env.js via alias to this path — see static.conf.
# index.html already loads /config/env.js before the main bundle.
cat > /tmp/config.js << EOF
window.__ENV__ = {
  VITE_API_URL:            "${VITE_API_URL}",
  VITE_API_VERSION:        "${VITE_API_VERSION}",
  VITE_WS_URL:             "${VITE_WS_URL}",
  VITE_APP_NAME:           "${VITE_APP_NAME}",
  VITE_APP_DESCRIPTION:    "${VITE_APP_DESCRIPTION}",
  VITE_AUTH_MODE:          "${VITE_AUTH_MODE}",
  PUBLIC_HOST:             "${PUBLIC_HOST}",
  VITE_KEYCLOAK_URL:       "${VITE_KEYCLOAK_URL}",
  VITE_KEYCLOAK_REALM:     "${VITE_KEYCLOAK_REALM}",
  VITE_KEYCLOAK_CLIENT_ID: "${VITE_KEYCLOAK_CLIENT_ID}"
};
EOF

echo "[entrypoint] booted backend=${BACKEND_URL:-<none>} resolver=${DNS_RESOLVER} port=${SERVER_PORT}" >&2

exec "$@"
