-- Add actual_release_date and released_by to versions table
ALTER TABLE "versions"
  ADD COLUMN IF NOT EXISTS "actual_release_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "released_by" UUID;
