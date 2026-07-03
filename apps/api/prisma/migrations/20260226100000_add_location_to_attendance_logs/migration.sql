-- Add location tracking columns to attendance_logs
ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "latitude"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "accuracy"  DOUBLE PRECISION;
