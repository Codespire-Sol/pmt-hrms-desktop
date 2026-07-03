-- =============================================================
-- Restore columns & tables incorrectly dropped in 20260410104421
-- All items below are actively used in application code.
-- =============================================================

-- 1. employees — restore work_mode, country, biometric_device_id
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "work_mode"          VARCHAR(50)  DEFAULT 'office',
  ADD COLUMN IF NOT EXISTS "country"            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "biometric_device_id" VARCHAR(100);

-- 2. attendance_logs — restore source and device_user_id
ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "source"         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "device_user_id" VARCHAR(100);

-- Restore the unique constraint that biometric punch deduplication depends on
ALTER TABLE "attendance_logs"
  DROP CONSTRAINT IF EXISTS "attendance_logs_employee_logged_at_type_source_key";
ALTER TABLE "attendance_logs"
  ADD CONSTRAINT "attendance_logs_employee_logged_at_type_source_key"
  UNIQUE (employee_id, logged_at, type, source);

-- 3. employee_documents — restore document review workflow columns
ALTER TABLE "employee_documents"
  ADD COLUMN IF NOT EXISTS "status"      VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_by" UUID,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

-- 4. leaves — restore is_auto_lop and its unique partial index
ALTER TABLE "leaves"
  ADD COLUMN IF NOT EXISTS "is_auto_lop" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "leaves_employee_auto_lop_unique"
  ON "leaves" (employee_id, from_date)
  WHERE is_auto_lop = true;

-- 5. email_schedule_configs — table was never migrated to this database
CREATE TABLE IF NOT EXISTS "email_schedule_configs" (
  "id"            UUID        NOT NULL DEFAULT uuid_generate_v4(),
  "schedule_type" VARCHAR(50) NOT NULL,
  "enabled"       BOOLEAN     NOT NULL DEFAULT true,
  "recipients"    TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  "last_sent_at"  TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_schedule_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_schedule_configs_schedule_type_key"
  ON "email_schedule_configs"("schedule_type");
