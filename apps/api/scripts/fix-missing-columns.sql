-- ================================================================
-- EMERGENCY FIX: Restore columns dropped by migration 20260410104421
-- Run this directly on the PostgreSQL database
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards)
-- ================================================================

-- 1. employees table
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "work_mode"           VARCHAR(50)  DEFAULT 'office',
  ADD COLUMN IF NOT EXISTS "country"             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "biometric_device_id" VARCHAR(100);

-- 2. attendance_logs table
ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "source"         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "device_user_id" VARCHAR(100);

-- Restore unique constraint for biometric deduplication
ALTER TABLE "attendance_logs"
  DROP CONSTRAINT IF EXISTS "attendance_logs_employee_logged_at_type_source_key";
ALTER TABLE "attendance_logs"
  ADD CONSTRAINT "attendance_logs_employee_logged_at_type_source_key"
  UNIQUE (employee_id, logged_at, type, source);

-- 3. employee_documents table
ALTER TABLE "employee_documents"
  ADD COLUMN IF NOT EXISTS "status"      VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_by" UUID,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

-- 4. leaves table
ALTER TABLE "leaves"
  ADD COLUMN IF NOT EXISTS "is_auto_lop" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "leaves_employee_auto_lop_unique";
CREATE UNIQUE INDEX "leaves_employee_auto_lop_unique"
  ON "leaves" (employee_id, from_date)
  WHERE is_auto_lop = true;

-- 5. email_schedule_configs table (never created)
CREATE TABLE IF NOT EXISTS "email_schedule_configs" (
  "id"            UUID         NOT NULL DEFAULT uuid_generate_v4(),
  "schedule_type" VARCHAR(50)  NOT NULL,
  "enabled"       BOOLEAN      NOT NULL DEFAULT true,
  "recipients"    TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "last_sent_at"  TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_schedule_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_schedule_configs_schedule_type_key"
  ON "email_schedule_configs"("schedule_type");

-- ================================================================
-- Mark the restore migration as applied in Prisma's tracking table
-- so prisma migrate deploy doesn't try to re-run it
-- ================================================================
INSERT INTO "_prisma_migrations" (
  id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count
)
VALUES (
  gen_random_uuid()::text,
  'manual-fix',
  NOW(),
  '20260413100000_restore_employee_work_mode_country',
  'Applied manually via fix-missing-columns.sql',
  NOW(),
  1
)
ON CONFLICT DO NOTHING;

-- Verify all columns exist
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='employees'         AND column_name='work_mode')           AS employees_work_mode,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='employees'         AND column_name='country')             AS employees_country,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='employees'         AND column_name='biometric_device_id') AS employees_biometric_device_id,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='attendance_logs'   AND column_name='source')              AS attendance_logs_source,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='attendance_logs'   AND column_name='device_user_id')      AS attendance_logs_device_user_id,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='employee_documents' AND column_name='status')             AS employee_documents_status,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='employee_documents' AND column_name='review_note')        AS employee_documents_review_note,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='employee_documents' AND column_name='reviewed_by')        AS employee_documents_reviewed_by,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='employee_documents' AND column_name='reviewed_at')        AS employee_documents_reviewed_at,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='leaves'            AND column_name='is_auto_lop')         AS leaves_is_auto_lop,
  (SELECT COUNT(*) FROM information_schema.tables  WHERE table_name='email_schedule_configs')                                  AS email_schedule_configs_table;
-- Every column should show: 1
-- If any show 0, that column is still missing
