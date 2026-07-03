# Configuration Reference

All configuration is via environment variables (12-factor). The backend reads them
in `apps/api/src/config/index.ts`; the frontends read a subset at container start
(injected into `window.__ENV__`).

> On the desktop edition the installer **generates `.env` for you** (from
> `.env.local.example`) with strong random secrets and the host PC's LAN IP — you
> normally never edit it by hand. For a manual run: `cp .env.local.example .env`.

Legend: **Req** = required to boot.

---

## Backend — core

| Variable | Default | Notes |
|----------|---------|-------|
| `NODE_ENV` | `development` | `production` enables strict checks (e.g. strong `JWT_SECRET`). |
| `PORT` | `4000` | API listen port. |
| `API_VERSION` | `v1` | URL prefix → `/api/v1`. |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error`. |

## Database (PostgreSQL) — **Req**

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_HOST` | `localhost` | In compose: `postgres`. **Required.** |
| `DATABASE_PORT` | `5432` | |
| `DATABASE_NAME` | `projectflow` | **Required.** |
| `DATABASE_USER` | `postgres` | |
| `DATABASE_PASSWORD` | `postgres` | **Change for production.** |
| `DATABASE_SSL` | `false` | `true` to require SSL. |
| `DATABASE_URL` | *(derived)* | Built from the parts above if unset. Used by Prisma/migrations. |
| `DATABASE_POOL_SIZE` | `15` | Connection pool size. |

> The database must have the **`pgvector`** extension. The bundled
> `pgvector/pgvector:pg16` image includes it.

## Redis

| Variable | Default | Notes |
|----------|---------|-------|
| `REDIS_HOST` | `localhost` | In compose: `redis`. Caching + websocket scaling. |
| `REDIS_PORT` | `6379` | |
| `REDIS_PASSWORD` | *(none)* | Optional. |

## Authentication

The desktop stack forces **local JWT auth** (`AUTH_MODE=jwt`) in
`docker-compose.local.yml` — there is no Keycloak.

| Variable | Default | Notes |
|----------|---------|-------|
| `AUTH_MODE` | `jwt` | Local email/password login. (Keycloak SSO exists in the code but is not shipped in the desktop stack.) |
| `ADMIN_EMAIL` | `admin@local.host` | Admin seeded on first boot. |
| `ADMIN_PASSWORD` | *(installer-generated)* | Random on first run; **change after first login.** |
| `AUTH_MAX_FAILED_LOGINS` | `5` | Lock account after N failures. |
| `AUTH_LOCKOUT_MINUTES` | `15` | Lockout duration. |

## JWT (local auth signing) — **Req**

| Variable | Default | Notes |
|----------|---------|-------|
| `JWT_SECRET` | `change-this-secret` | **Required.** ≥32 chars in production. `openssl rand -base64 48`. |
| `JWT_REFRESH_SECRET` | `change-this-refresh-secret` | Refresh-token secret. |
| `JWT_EXPIRES_IN` | `15m` | Access-token lifetime. |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh-token lifetime. |

## Frontend URLs & CORS

| Variable | Default | Notes |
|----------|---------|-------|
| `FRONTEND_URL` | `http://localhost:3001` | PMT URL (email links). Installer sets the host LAN IP. |
| `HRMS_FRONTEND_URL` | `http://localhost:3000` | HRMS URL. Installer sets the host LAN IP. |
| `CORS_ORIGINS` | `localhost:3000,3001` | Comma-separated allowed origins. |
| `PUBLIC_HOST` | *(empty)* | Host PC's LAN IP. Read by both frontends so the in-app **Share** button shows a team-openable link. Installer sets it. |

## Storage

| Variable | Default | Notes |
|----------|---------|-------|
| `UPLOAD_DIR` | `./uploads` | Local upload directory (compose mounts a volume). |
| `UPLOADS_BASE_URL` | *(empty)* | Set if serving uploads from a CDN/separate host. |

## Attendance (biometric)

| Variable | Default | Notes |
|----------|---------|-------|
| `FULL_DAY_HOURS` | `9` | Hours for `present`. |
| `HALF_DAY_HOURS` | `4` | Hours for `half_day`. |

## Rate limiting

| Variable | Default | Notes |
|----------|---------|-------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window size (ms). |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window. |

## Optional integrations (disabled when blank)

| Variable | Feature when set |
|----------|------------------|
| `OPENAI_API_KEY` (+ `OPENAI_MODEL`) | AI features (summaries, search, insights). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` | Outbound email. |
| `GCS_BUCKET_NAME`, `GCS_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud Storage for attachments. |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | Google OAuth login. |
| `GITHUB_OAUTH_CLIENT_ID` / `_SECRET` | GitHub OAuth login. |
| `AI_SERVICE_URL` | External AI microservice (defaults to `localhost:8000`). |

---

## Frontend container variables (`pmt-web`, `hrms-web`)

These are read at container start and written into `window.__ENV__`.

| Variable | Notes |
|----------|-------|
| `SERVER_PORT` | nginx listen port inside the container (default `8080`). |
| `BACKEND_URL` | When set (e.g. `http://api:4000`), nginx reverse-proxies `/api` and websockets to it. Avoids CORS. |
| `API_PATH_PREFIX` | Path proxied to the backend (default `/api`). |
| `VITE_API_URL` | API base the SPA calls (usually `/api` so it goes through the proxy). |
| `VITE_API_VERSION` | Default `v1`. |
| `VITE_APP_NAME`, `VITE_APP_DESCRIPTION` | UI branding. |
| `VITE_AUTH_MODE` | `jwt` — renders the local email/password login. |
| `PUBLIC_HOST` | Host PC's LAN IP, used by the in-app Share button. |

---

## Minimal `.env` example (desktop, JWT)

The installer generates this for you; shown here for reference / manual runs:

```env
AUTH_MODE=jwt
ADMIN_EMAIL=admin@local.host
ADMIN_PASSWORD=<strong random>
DATABASE_PASSWORD=<strong random>
JWT_SECRET=<strong random, 48 chars>
JWT_REFRESH_SECRET=<strong random, 48 chars>
PUBLIC_HOST=<host PC LAN IP, e.g. 192.168.1.50>
```
