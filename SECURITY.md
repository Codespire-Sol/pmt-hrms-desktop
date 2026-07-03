# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in PMT/HRMS, report it privately:

- Email: **admin@codespiresolutions.com**
- Include: a description, steps to reproduce, affected component, and impact.

We will acknowledge your report within 3 business days and aim to provide a
remediation timeline within 10 business days.

## Before You Use It

The desktop installer (`Start-PMT-HRMS.bat`) already generates a `.env` with
**strong random secrets** (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_PASSWORD`)
and a **random admin password** on the first run — so a fresh install is not using
shared default credentials.

You should still:

- [ ] **Change the admin password** (`admin@local.host`) right after your first
      login, and keep the first-run password print somewhere safe.
- [ ] Keep the generated `.env` **private** — it holds all secrets. It is
      git-ignored and must never be committed or shared.
- [ ] Only run `Allow-Team-Access.bat` on a **trusted office network** — it opens
      the Windows Firewall on ports 3000/3001 (and 4000 for the API) so teammates
      can connect.
- [ ] Keep the host PC and Docker Desktop **updated**.

If you go beyond a single office LAN (e.g. expose it to the internet), also:

- [ ] Set `NODE_ENV=production` (the app then refuses weak JWT secrets).
- [ ] Put the stack behind **HTTPS** (a reverse proxy / load balancer).
- [ ] Use backed-up PostgreSQL and Redis.

## Supported Versions

Security fixes are applied to the latest released version on the default branch.
