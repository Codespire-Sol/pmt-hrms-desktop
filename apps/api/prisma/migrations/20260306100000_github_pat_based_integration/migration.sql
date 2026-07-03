-- Migration: Convert GitHub integration from App-based to PAT-based (like GitLab)
-- This replaces the github_installations table with github_connections
-- and updates github_repositories to use connected_by_id instead of installation_id

-- 1. Drop the old github_installations table
DROP TABLE IF EXISTS "github_installations" CASCADE;

-- 2. Create new github_connections table (PAT-based, per-user)
CREATE TABLE "github_connections" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "github_user_id" INTEGER NOT NULL,
    "github_username" VARCHAR(255) NOT NULL,
    "github_email" VARCHAR(255),
    "avatar_url" VARCHAR(500),
    "access_token" TEXT NOT NULL,
    "token_scopes" VARCHAR(500),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_connections_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one connection per user
CREATE UNIQUE INDEX "github_connections_user_id_key" ON "github_connections"("user_id");

-- Index for lookups
CREATE INDEX "github_connections_user_id_idx" ON "github_connections"("user_id");

-- Foreign key to users
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Update github_repositories table
--    Remove installation_id, add connected_by_id + webhook fields

-- Drop the old installation_id index first
DROP INDEX IF EXISTS "github_repositories_installation_id_idx";

-- Drop the installation_id column
ALTER TABLE "github_repositories" DROP COLUMN IF EXISTS "installation_id";

-- Add new columns
ALTER TABLE "github_repositories" ADD COLUMN IF NOT EXISTS "connected_by_id" UUID;
ALTER TABLE "github_repositories" ADD COLUMN IF NOT EXISTS "web_url" VARCHAR(500);
ALTER TABLE "github_repositories" ADD COLUMN IF NOT EXISTS "webhook_id" INTEGER;
ALTER TABLE "github_repositories" ADD COLUMN IF NOT EXISTS "webhook_secret" VARCHAR(100);
