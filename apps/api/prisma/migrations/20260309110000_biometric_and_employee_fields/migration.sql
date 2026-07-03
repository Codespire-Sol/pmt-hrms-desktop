-- Migration: biometric support + employee field cleanup
-- Applied manually via psql on 2026-03-09
-- Covers:
--   1. attendance_logs  — add source, device_user_id, unique constraint
--   2. employees        — add biometric_device_id, work_mode, country

-- ── 1. attendance_logs ────────────────────────────────────────────────────────

-- source: tracks where the log came from (manual clock-in, biometric push, etc.)
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- device_user_id: the raw user ID sent by the biometric device
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS device_user_id TEXT;

-- Unique constraint used by ON CONFLICT in the biometric push handler
ALTER TABLE attendance_logs
  DROP CONSTRAINT IF EXISTS attendance_logs_employee_logged_at_type_source_key;

ALTER TABLE attendance_logs
  ADD CONSTRAINT attendance_logs_employee_logged_at_type_source_key
  UNIQUE (employee_id, logged_at, type, source);

-- ── 2. employees ─────────────────────────────────────────────────────────────

-- biometric_device_id: maps employee to their ID on the biometric device
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS biometric_device_id TEXT;

-- work_mode: how the employee works — office | hybrid | remote
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS work_mode VARCHAR(20) DEFAULT 'office';

-- country: employee's country (shown in listing/profile)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS country VARCHAR(100);
