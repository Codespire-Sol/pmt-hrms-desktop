-- Add `branch_id` column to holidays table to support branch-specific holidays.
-- Holidays with branch_id NULL are org-wide (visible to all branches).
ALTER TABLE holidays
  ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS "holidays_branch_id_idx" ON holidays(branch_id);
