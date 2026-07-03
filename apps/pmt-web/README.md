# pmt-web — Project Management frontend

The PMT (Project Management Tool) single-page app. React + Vite + Redux Toolkit,
served by nginx in production.

> Part of the [pmt-hrms](../../README.md) monorepo. For the full stack use the root
> `docker compose` setup. This README covers running just this frontend for local
> development.

## Prerequisites

- Node.js >= 20
- pnpm (`corepack enable`)
- The API running (see [../api](../api/README.md))

## Local development

```bash
pnpm install
cp .env.example .env        # point VITE_API_URL at your API (auth is local JWT)
pnpm dev                    # Vite dev server (http://localhost:5173)
```

## Useful scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Vite dev server with HMR |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Preview the production build |
| `pnpm lint` | Lint the project |
| `pnpm test` | Run the Vitest suite |

## Runtime configuration

In production the app is configured at container start (not build time): the
entrypoint writes `window.__ENV__` from environment variables. See
[../../docs/configuration.md](../../docs/configuration.md) for the variable list.

## License

[Elastic License 2.0](../../LICENSE).
