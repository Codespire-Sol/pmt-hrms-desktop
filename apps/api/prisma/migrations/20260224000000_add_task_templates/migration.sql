-- CreateTable: onboarding_task_templates and offboarding_task_templates
-- These tables were defined in schema.prisma but never included in a migration.

CREATE TABLE IF NOT EXISTS "onboarding_task_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "task_name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "phase" VARCHAR(50) NOT NULL,
    "assignee" VARCHAR(100),
    "task_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "requires_document" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_task_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "offboarding_task_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "task_name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "phase" VARCHAR(50) NOT NULL,
    "assignee" VARCHAR(100),
    "task_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offboarding_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS to be safe)
CREATE INDEX IF NOT EXISTS "onboarding_task_templates_phase_idx" ON "onboarding_task_templates"("phase");
CREATE INDEX IF NOT EXISTS "onboarding_task_templates_is_active_idx" ON "onboarding_task_templates"("is_active");

CREATE INDEX IF NOT EXISTS "offboarding_task_templates_phase_idx" ON "offboarding_task_templates"("phase");
CREATE INDEX IF NOT EXISTS "offboarding_task_templates_is_active_idx" ON "offboarding_task_templates"("is_active");

-- AlterTable: add missing columns to onboarding_tasks
-- The original migration created this table without phase and assignee columns,
-- but the schema and service both require them.
ALTER TABLE "onboarding_tasks"
    ADD COLUMN IF NOT EXISTS "phase" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "assignee" VARCHAR(100);

-- AlterTable: add missing columns to offboarding_tasks
ALTER TABLE "offboarding_tasks"
    ADD COLUMN IF NOT EXISTS "phase" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "assignee" VARCHAR(100);
