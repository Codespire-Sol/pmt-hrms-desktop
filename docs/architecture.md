# Architecture

PMT and HRMS are **two frontends on top of one shared backend and one database**.
They are not separate products — the same API serves both, and they share users,
roles, and authentication.

## High-level diagram

```
                          ┌─────────────┐
  Browser ── :3001 ─────► │   pmt-web   │ ─┐  nginx; serves the SPA and
                          │  (nginx)    │  │  reverse-proxies /api → api:4000
                          └─────────────┘  │
                          ┌─────────────┐  ├──► ┌──────────────┐ ──► ┌────────────┐
  Browser ── :3000 ─────► │  hrms-web   │ ─┘    │     api      │     │  postgres  │
                          │  (nginx)    │       │  :4000       │ ──► │ (+pgvector)│
                          └─────────────┘       │  Express +   │     └────────────┘
                                                │  Prisma      │ ──► ┌────────────┐
                                                │  JWT auth    │     │   redis    │
                                                └──────────────┘     └────────────┘
```

Login is **local email/password (JWT)**, issued by the API itself — the desktop
edition has no external identity provider.

## Services

| Service | Image / stack | Port (host) | Responsibility |
|---------|---------------|-------------|----------------|
| `postgres` | `pgvector/pgvector:pg16` | internal | Primary database. pgvector is required by the `issue_embeddings` table (AI search). |
| `redis` | `redis:7-alpine` | internal | Caching + Socket.IO adapter (websocket fan-out). |
| `api` | Node 22 / Express / TypeScript / Prisma | 4000 | The shared backend for both apps. |
| `pmt-web` | React + Vite, served by nginx | 3001 | Project Management UI. |
| `hrms-web` | React + Vite, served by nginx | 3000 | HR Management UI. |

## Backend technology

- **Express 4** (REST API, `/api/v1/...`) + **Socket.IO** (real-time updates)
- **Prisma 7** ORM over **PostgreSQL 16** (with the `pgvector` extension)
- **Redis** for caching and websocket scaling
- **JWT** (`jsonwebtoken`) for local email/password auth
- Optional integrations (disabled when their env vars are blank): **OpenAI**
  (AI features), **SMTP** (email), **Google Cloud Storage** (file
  attachments), **Slack**, **GitHub**, **GitLab**

## Backend module map

The backend is organized into feature modules under `apps/api/src/modules/`:

- **PMT side:** `projects`, `epics`, `sprints`, `boards`, `issues`, `workflows`,
  `workflow-schemes`, `screens`, `custom-fields`, `versions`, `components`,
  `labels`, `time-tracking`, `reports`, `dashboard`, `comments`, `attachments`
- **HRMS side:** `hr`, `employee`, `workforce`, `attendance` (via `biometric`),
  `leads`, `calendar`, `forms`, `pages`
- **Shared / platform:** `auth`, `rbac`, `users`, `user-groups`,
  `permission-schemes`, `notification-schemes`, `security-levels`, `admin`,
  `ai`, `automation`, `notifications`, `email-schedule`, `search`, `files`,
  `reference`, `webhooks`, plus integrations (`slack`, `github`, `gitlab`)

## How the frontends are configured (runtime env)

The frontends are built once and configured **at container start**, not at build
time. The container entrypoint (`docker-entrypoint.sh`) writes a small
`/config/env.js` that sets `window.__ENV__`, and `index.html` loads it before the
app bundle. So the same image works in any environment by changing environment
variables — no rebuild needed.

Key frontend variables: `VITE_API_URL`, `BACKEND_URL` (enables the nginx
`/api` reverse-proxy), `VITE_AUTH_MODE` (`jwt`), and `PUBLIC_HOST` (the host PC's
LAN IP, so the in-app Share button shows a team-openable link). See
[configuration.md](configuration.md).

## How the backend bootstraps a database

On startup the `api` container:

1. Runs `prisma migrate deploy` (entrypoint) — creates/updates the schema on a
   fresh or upgraded database (42+ migrations).
2. Runs `ensureDatabaseSchema()` — idempotent `ALTER TABLE ... IF NOT EXISTS`
   safety net for columns added between migrations.
3. Seeds system **roles + permissions** (RBAC catalog).
4. Seeds the admin user (`ADMIN_EMAIL` / `ADMIN_PASSWORD` from the generated `.env`).
5. Seeds project categories, feature-flag defaults, and onboarding task templates.
6. Starts the HTTP server, websocket, and background schedulers (reports,
   reminders, auto-absent, sprint metrics, scheduled email).

This means a fresh `docker compose up` produces a working database with no manual
migration step.

## Authentication at a glance

The desktop edition uses **local JWT auth** (`AUTH_MODE=jwt`): browsers log in with
an email/password issued by the API, which signs short-lived access tokens
(`JWT_EXPIRES_IN`) and longer-lived refresh tokens (`JWT_REFRESH_EXPIRES_IN`).

**Roles and permissions live in the PostgreSQL database** — the DB is the single
source of truth for authorization (RBAC). The login only proves *identity* (who you
are); the database decides *what you can do*.

> The backend code also supports a Keycloak SSO mode, but the desktop stack ships
> without Keycloak — you don't need to configure or run it.

## Data flow: a typical authenticated request

1. Browser calls `/api/v1/...` on the frontend's origin (e.g. `localhost:3001`).
2. nginx in the frontend container reverse-proxies `/api` → `api:4000`.
3. The API's `authenticate` middleware verifies the bearer token (local JWT),
   loads the user from the DB, and resolves their role + branch context.
4. The route handler runs, enforcing `requirePermission(...)` against the DB RBAC.
5. Responses stream back; real-time changes are pushed over Socket.IO via Redis.
