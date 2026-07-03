# API — PMT/HRMS backend

The shared backend for both PMT and HRMS. Express + TypeScript + Prisma over
PostgreSQL, with Redis for caching/websockets.

> Part of the [pmt-hrms](../../README.md) monorepo. For the full stack (database,
> Redis, frontends) use the root `docker compose -f docker-compose.local.yml`
> setup. This README covers running just the API for local development.

## Prerequisites

- Node.js >= 20
- pnpm (`corepack enable`)
- A PostgreSQL 16 database with the `pgvector` extension
- Redis (optional — caching/websockets degrade gracefully without it)

## Local development

```bash
pnpm install
cp .env.example .env        # then fill in DATABASE_*, JWT_*, AUTH_MODE, etc.
pnpm prisma:migrate:deploy  # apply migrations
pnpm dev                    # start with hot reload (nodemon)
```

The server listens on `PORT` (default `4000`). Health check: `GET /health`.

## Useful scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server with reload |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run the compiled server |
| `pnpm test` | Run the Jest test suite |
| `pnpm lint` | Lint `src/` |
| `pnpm prisma:migrate` | Create/apply a migration (dev) |
| `pnpm prisma:studio` | Open Prisma Studio |

## Configuration

All settings come from environment variables — see
[../../docs/configuration.md](../../docs/configuration.md) for the full reference
(including the `AUTH_MODE` local-JWT login used by the desktop edition).

A reference of the REST endpoints is in [API-Documentation.md](API-Documentation.md).

## License

[Elastic License 2.0](../../LICENSE).
