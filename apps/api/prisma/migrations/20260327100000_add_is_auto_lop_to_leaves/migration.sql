-- Add is_auto_lop flag to leaves table
-- Marks system-generated LOP entries from the auto-absent scheduler
-- so that attendance regularization can reverse them.
ALTER TABLE "leaves"
  ADD COLUMN IF NOT EXISTS "is_auto_lop" BOOLEAN NOT NULL DEFAULT false;

-- Partial unique index: prevents duplicate auto-LOP entries per employee per date
CREATE UNIQUE INDEX IF NOT EXISTS "leaves_employee_auto_lop_unique"
  ON "leaves" ("employee_id", "from_date")
  WHERE is_auto_lop = true;
