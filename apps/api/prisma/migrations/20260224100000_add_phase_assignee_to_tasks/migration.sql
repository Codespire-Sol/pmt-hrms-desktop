-- AlterTable: add missing phase and assignee columns to onboarding_tasks
-- These columns exist in schema.prisma but were missing from the original migration.
ALTER TABLE "onboarding_tasks"
    ADD COLUMN IF NOT EXISTS "phase" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "assignee" VARCHAR(100);

-- AlterTable: add missing phase and assignee columns to offboarding_tasks
ALTER TABLE "offboarding_tasks"
    ADD COLUMN IF NOT EXISTS "phase" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "assignee" VARCHAR(100);
