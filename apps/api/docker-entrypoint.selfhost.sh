#!/bin/sh
# Self-host entrypoint: apply DB migrations on a fresh/updated database, then
# start the API. The server itself also runs ensureDatabaseSchema() + seeds the
# default admin on boot, but the base tables must exist first — hence migrate.
set -eu

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
# Retry briefly in case Postgres just became reachable.
n=0
until pnpm exec prisma migrate deploy --config prisma/prisma.config.mjs; do
  n=$((n+1))
  if [ "$n" -ge 10 ]; then
    echo "[entrypoint] migrate deploy failed after $n attempts — giving up." >&2
    exit 1
  fi
  echo "[entrypoint] migrate deploy failed (attempt $n) — retrying in 3s..."
  sleep 3
done

echo "[entrypoint] Migrations applied. Starting API..."
exec node dist/index.js
