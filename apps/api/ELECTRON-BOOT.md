# Electron Boot Contract — PMT/HRMS API

How to boot this Express + Prisma API **without Docker**, embedded inside an
Electron app, against a **plain PostgreSQL 16** (no pgvector) and with **no Redis**.

---

## 1. Entry point

After `pnpm build` (which runs `tsc`, emitting to `dist/`), start the HTTP server with:

```
node dist/index.js
```

- `package.json` → `"main": "dist/index.js"`, `"start": "node dist/index.js"`.
- `dist/index.js` is compiled from `src/index.ts`, whose only job is `import './server';`.
- `dist/server.js` (from `src/server.ts`) contains `startServer()`, which:
  1. tests the DB connection,
  2. runs `ensureDatabaseSchema()` (idempotent column/table patcher — **not** a
     replacement for migrations),
  3. seeds the default admin (jwt mode), project categories, feature flags,
     onboarding task templates,
  4. creates the HTTP server, attaches Socket.IO, and calls `httpServer.listen(PORT)`.

The server listens on `config.port` (env `PORT`, default `4000`).

---

## 2. Migrations — who runs them

**The server does NOT run `prisma migrate deploy` on boot.** It only runs
`ensureDatabaseSchema()` (adds missing columns/tables idempotently), which assumes
the base schema already exists. **The Electron host (caller) must run migrations
before starting the server**, exactly as `docker-entrypoint.selfhost.sh` does.

Run this once against the embedded Postgres before `node dist/index.js`:

```
pnpm exec prisma migrate deploy --config prisma/prisma.config.mjs
```

- Config file: `prisma/prisma.config.mjs` (JS variant — use this in production /
  packaged builds; a `.ts` variant exists for dev). It reads
  `datasource.url = process.env.DATABASE_URL`, so `DATABASE_URL` must be set in the
  environment when the command runs.
- Migrations live in `prisma/migrations/` and require **only stock PostgreSQL 16**
  after the pgvector neutralization (see section 5). `uuid-ossp` and `tsvector` are
  core Postgres features — no extra extensions needed.
- The repo also provides `pnpm prisma:migrate:deploy` (a wrapper that auto-recovers
  a rolled-back migration state), but the raw `prisma migrate deploy` command above
  is sufficient for a fresh embedded database.

---

## 3. Environment variables to boot in local JWT mode

`src/config/index.ts` calls `config.validate()` on import (unless `NODE_ENV=test`).

**Hard requirement:** these env vars must be *literally present* (validate() checks
`process.env`, not the defaulted config values): `DATABASE_HOST`, `DATABASE_NAME`,
`JWT_SECRET`. Set them explicitly even though the config object has fallbacks.

### Required

| Env var             | Purpose                                   | Default (config)          | Required? |
|---------------------|-------------------------------------------|---------------------------|-----------|
| `AUTH_MODE`         | `jwt` = local email/password (no Keycloak)| `keycloak`                | **Yes** — set to `jwt` |
| `DATABASE_HOST`     | Postgres host                             | `localhost`               | **Yes** (validate) |
| `DATABASE_NAME`     | Postgres database name                    | `projectflow`             | **Yes** (validate) |
| `JWT_SECRET`        | Access-token signing secret               | `change-this-secret`      | **Yes** (validate; must be ≥32 chars & non-default when `NODE_ENV=production`) |

### DB connection (DATABASE_URL is derived if unset)

`config/index.ts` composes `DATABASE_URL` from the parts below when `DATABASE_URL`
is not already set. Either set `DATABASE_URL` directly, **or** set the parts.

| Env var             | Purpose                    | Default     | Required? |
|---------------------|----------------------------|-------------|-----------|
| `DATABASE_URL`      | Full Prisma/pg conn string | *(derived from parts)* | Recommended — set directly for the packaged app, and it MUST be present when running `prisma migrate deploy` |
| `DATABASE_PORT`     | Postgres port              | `5432`      | No |
| `DATABASE_USER`     | Postgres user              | `postgres`  | No |
| `DATABASE_PASSWORD` | Postgres password          | `postgres`  | No |
| `DATABASE_SSL`      | `true` → append `?sslmode=require` | `false` | No (keep `false` for embedded) |

### JWT-mode auth / admin seed

| Env var               | Purpose                                | Default                  | Required? |
|-----------------------|----------------------------------------|--------------------------|-----------|
| `ADMIN_EMAIL`         | Seeded admin login (jwt mode only)     | `admin@projectflow.ai`   | Recommended |
| `ADMIN_PASSWORD`      | Seeded admin password                  | `admin123`               | Recommended (change it) |
| `JWT_REFRESH_SECRET`  | Refresh-token signing secret           | `change-this-refresh-secret` | Recommended (set a strong value) |
| `JWT_EXPIRES_IN`      | Access token TTL                       | `15m`                    | No |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL                   | `7d`                     | No |
| `AUTH_MAX_FAILED_LOGINS` | Lockout threshold                   | `5`                      | No |
| `AUTH_LOCKOUT_MINUTES`   | Lockout duration                    | `15`                     | No |

### Server / networking

| Env var          | Purpose                              | Default                                           | Required? |
|------------------|--------------------------------------|---------------------------------------------------|-----------|
| `PORT`           | HTTP + WS listen port                | `4000`                                            | No |
| `NODE_ENV`       | Environment                          | `development`                                     | No (avoid `production` unless you set strong secrets — validate() is stricter) |
| `API_VERSION`    | URL version segment                  | `v1`                                              | No |
| `FRONTEND_URL`   | PMT app URL (email/OAuth links)      | `http://localhost:3001`                           | No |
| `HRMS_FRONTEND_URL` | HRMS app URL                      | `http://localhost:3000`                           | No |
| `CORS_ORIGINS`   | Comma-separated allowed origins      | `http://localhost:3000,http://localhost:3001`     | No |

### Storage (uploads → Electron app-data folder)

| Env var            | Purpose                              | Default                    | Required? |
|--------------------|--------------------------------------|----------------------------|-----------|
| `UPLOAD_DIR`       | Local disk folder for file uploads   | `<cwd>/uploads`            | No — **set this to the Electron app-data path** |
| `UPLOADS_BASE_URL` | Base URL for stored files            | `` (relative URLs)         | No |

`config.storage.uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'))`.
**Confirmed configurable** — point `UPLOAD_DIR` at e.g. `app.getPath('userData')/uploads`.

### Optional integrations — leave UNSET to keep off

| Env var                          | Effect when unset                                  |
|----------------------------------|----------------------------------------------------|
| `REDIS_URL` / `REDIS_HOST`       | **In-memory cache + single-node Socket.IO** (see §4). Leave both empty/unset for the Electron build. |
| `OPENAI_API_KEY`                 | AI features disabled                               |
| `AI_SERVICE_URL`                 | Semantic search calls default `http://localhost:8000` (external AI service; unused for core app) |
| `SMTP_*`                         | Email sending disabled (also configurable in-app)  |
| `GCS_*` / `GOOGLE_APPLICATION_CREDENTIALS` | Attachments stored on local disk instead of GCS |
| `KEYCLOAK_*`                     | Only needed when `AUTH_MODE=keycloak`; irrelevant in jwt mode |

---

## 4. Redis is optional (no Redis required)

Redis is now **opt-in**. The selector is: **Redis is used only if `REDIS_URL` OR
`REDIS_HOST` is set (non-empty).** When both are unset/empty:

- **Cache** (`src/services/cache.service.ts`) uses a built-in **in-memory store**
  (Map-based, with TTL, tag sets, `SET NX`, compare-and-delete). No ioredis client
  is created, so nothing attempts to reach `localhost:6379`. `isHealthy()` returns
  true; `getStats()` reports backend `in-memory`.
- **Socket.IO** (`src/websocket/index.ts`) runs **single-node** with its default
  in-memory adapter — the `@socket.io/redis-adapter` and `ioredis` modules are only
  `require()`d when Redis is configured.
- Everything that touches Redis (CSRF tokens, security audit log, account lockout,
  rate limiting) goes through `cacheService`, so it all works against the in-memory
  backend automatically.

When `REDIS_URL`/`REDIS_HOST` **are** set, the original Redis behavior is preserved
unchanged (distributed cache + Redis Socket.IO adapter).

> ⚠️ `.env.example` ships `REDIS_HOST=localhost`. For the Electron/no-Redis build,
> **remove or blank `REDIS_HOST` (and `REDIS_URL`)** in the runtime environment,
> otherwise the app will try to use Redis.

---

## 5. pgvector neutralization (plain Postgres 16)

The `issue_embeddings.embedding` column stays `TEXT`; no `vector` extension is
required. Changes made:

- `prisma/migrations/20260202091006/migration.sql` — already neutralized upstream:
  `CREATE EXTENSION ... vector` is commented out; `embedding` is `TEXT`.
- `prisma/migrations/20260410104421/migration.sql` — already guards the
  `embedding → vector(1536)` conversion behind `IF EXISTS (SELECT 1 FROM pg_type
  WHERE typname = 'vector')`, so it is a no-op on plain Postgres.
- `prisma/migrations/20260410105639/migration.sql` — **edited here**: the
  unconditional `CREATE EXTENSION IF NOT EXISTS vector;` is commented out, and the
  `ALTER TABLE ... TYPE vector(1536)` is wrapped in the same `pg_type` guard so it
  only runs if a real `vector` type exists. On stock Postgres it does nothing and
  the column remains `TEXT`.

`schema.prisma` still declares `embedding Unsupported("vector(1536)")?`. This is
harmless for `prisma migrate deploy` (deploy runs the SQL files verbatim; it does
not re-diff the schema) and for the generated client (`Unsupported` columns are not
selectable, so no query reads it). Runtime semantic search delegates to an external
AI service (`aiService.findSimilarIssues`), **not** a local pgvector query.

To re-enable pgvector later, run against a Postgres image shipping the `vector`
extension and uncomment the guarded statements.

---

## 6. Minimal boot sequence (summary)

```sh
# 1. Build
pnpm build

# 2. Environment (example — no Redis, local JWT, embedded Postgres)
export AUTH_MODE=jwt
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/projectflow"
export DATABASE_HOST=127.0.0.1          # required by config.validate()
export DATABASE_NAME=projectflow        # required by config.validate()
export JWT_SECRET="<32+ char random>"   # required by config.validate()
export JWT_REFRESH_SECRET="<random>"
export ADMIN_EMAIL=admin@local.host
export ADMIN_PASSWORD="<strong>"
export PORT=4000
export UPLOAD_DIR="<electron userData>/uploads"
# REDIS_URL / REDIS_HOST intentionally UNSET

# 3. Apply migrations (caller runs this — server does not)
pnpm exec prisma migrate deploy --config prisma/prisma.config.mjs

# 4. Start
node dist/index.js
```
