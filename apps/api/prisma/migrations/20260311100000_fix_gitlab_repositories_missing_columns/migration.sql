-- Fix: ensure all gitlab_repositories columns exist on production
-- The original migration (20260220000000_add_gitlab_integration) may have run
-- on a schema version that was missing these columns.

ALTER TABLE "gitlab_repositories"
  ADD COLUMN IF NOT EXISTS "connected_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "webhook_secret" VARCHAR(100);
