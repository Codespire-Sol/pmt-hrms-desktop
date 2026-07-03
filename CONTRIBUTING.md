# Contributing to PMT + HRMS

Thanks for your interest in contributing! This guide covers how to set up the
project, make changes, and submit them.

## License of contributions

This project is released under the [Elastic License 2.0](LICENSE). By submitting a
contribution, you agree that your contribution is licensed under the same terms.

## Reporting bugs & requesting features

- Open a GitHub issue with clear steps to reproduce (for bugs) or a description of
  the use case (for features).
- **Do not** report security vulnerabilities in public issues — follow
  [SECURITY.md](SECURITY.md) instead.

## Development setup

The fastest way to run the whole stack is Docker (see the [README](README.md)):

```bash
cp .env.local.example .env
docker compose -f docker-compose.local.yml up -d --build
```

To work on a single service, see its README:
[apps/api](apps/api/README.md), [apps/pmt-web](apps/pmt-web/README.md),
[apps/hrms-web](apps/hrms-web/README.md). Architecture and configuration are
documented in [docs/](docs/README.md).

Requirements: Node.js >= 20, pnpm (`corepack enable`), Docker.

## Making changes

1. Fork the repo and create a branch from `main`
   (`git checkout -b fix/short-description`).
2. Make your change. Keep it focused — one logical change per pull request.
3. Match the existing code style. Run the linters before committing:
   - API: `cd apps/api && pnpm lint`
   - Frontends: `cd apps/pmt-web && pnpm lint` (and `apps/hrms-web`)
4. Add or update tests where it makes sense:
   - API: `pnpm test`
   - Frontends: `pnpm test`
5. Update documentation if your change affects setup, configuration, or behavior.

## Database changes (API)

Schema changes go through Prisma migrations:

```bash
cd apps/api
pnpm prisma:migrate    # create a migration during development
```

Never edit an already-released migration. Add a new one instead. Migrations are
applied automatically on API startup (`prisma migrate deploy`).

## Submitting a pull request

1. Push your branch and open a pull request against `main`.
2. Describe **what** changed and **why**. Link any related issue.
3. Ensure CI/linters/tests pass.
4. Be responsive to review feedback.

## Commit messages

Write clear, imperative commit messages (e.g. "Add leave-balance validation").
Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) are welcome but not
required.

## Code of conduct

By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).
