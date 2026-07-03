-- Add missing columns to leave_balances table
-- comp_off, maternity, and paternity were referenced in code but never added via migration

ALTER TABLE "leave_balances"
  ADD COLUMN IF NOT EXISTS "comp_off" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maternity" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paternity" DECIMAL(5,2) NOT NULL DEFAULT 0;
