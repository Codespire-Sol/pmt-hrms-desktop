-- Convert status_category enum to VARCHAR to allow custom categories

-- 1. Add a temporary varchar column
ALTER TABLE "statuses" ADD COLUMN "category_new" VARCHAR(50);

-- 2. Copy existing enum values to the new column
UPDATE "statuses" SET "category_new" = "category"::text;

-- 3. Drop the old enum column
ALTER TABLE "statuses" DROP COLUMN "category";

-- 4. Rename the new column
ALTER TABLE "statuses" RENAME COLUMN "category_new" TO "category";

-- 5. Set NOT NULL and default
ALTER TABLE "statuses" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "statuses" ALTER COLUMN "category" SET DEFAULT 'todo';

-- 6. Drop the enum type (no longer needed)
DROP TYPE IF EXISTS "status_category";
