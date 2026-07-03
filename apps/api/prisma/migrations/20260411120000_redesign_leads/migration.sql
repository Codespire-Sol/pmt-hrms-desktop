-- Leads module redesign: replace old project-management fields with CRM fields

ALTER TABLE "leads"
  DROP COLUMN IF EXISTS "title",
  DROP COLUMN IF EXISTS "description",
  DROP COLUMN IF EXISTS "assignee",
  DROP COLUMN IF EXISTS "priority",
  DROP COLUMN IF EXISTS "due_date",
  DROP COLUMN IF EXISTS "start_date",
  DROP COLUMN IF EXISTS "labels",
  DROP COLUMN IF EXISTS "sprint",
  DROP COLUMN IF EXISTS "story_points",
  DROP COLUMN IF EXISTS "reporter";

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) NOT NULL DEFAULT 'Unnamed Lead',
  ADD COLUMN IF NOT EXISTS "company" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "source" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "remarks" TEXT,
  ADD COLUMN IF NOT EXISTS "follow_up_date" TIMESTAMP(3);

-- Migrate existing status values to new enum values
UPDATE "leads" SET "status" = 'new'  WHERE "status" IN ('open', 'in_progress');
UPDATE "leads" SET "status" = 'won'  WHERE "status" = 'won';
UPDATE "leads" SET "status" = 'lost' WHERE "status" = 'lost';
