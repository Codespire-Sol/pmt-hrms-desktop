-- ============================================================
-- Combined pending migrations for GCP dev environment
-- Run this once on the GCP database
-- ============================================================

-- ─── 1. employee_documents: add review columns ───────────────
ALTER TABLE "employee_documents"
  ADD COLUMN IF NOT EXISTS "status"      VARCHAR(20)   NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_by" UUID,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

-- ─── 2. user_permissions: create table ───────────────────────
CREATE TABLE IF NOT EXISTS "user_permissions" (
    "id"            UUID         NOT NULL DEFAULT uuid_generate_v4(),
    "user_id"       UUID         NOT NULL,
    "permission_id" UUID         NOT NULL,
    "granted_by"    UUID,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_permissions_user_id_permission_id_key" UNIQUE ("user_id", "permission_id")
);

CREATE INDEX IF NOT EXISTS "user_permissions_user_id_idx" ON "user_permissions"("user_id");

ALTER TABLE "user_permissions"
    DROP CONSTRAINT IF EXISTS "user_permissions_user_id_fkey";
ALTER TABLE "user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permissions"
    DROP CONSTRAINT IF EXISTS "user_permissions_permission_id_fkey";
ALTER TABLE "user_permissions"
    ADD CONSTRAINT "user_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permissions"
    DROP CONSTRAINT IF EXISTS "user_permissions_granted_by_fkey";
ALTER TABLE "user_permissions"
    ADD CONSTRAINT "user_permissions_granted_by_fkey"
    FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
