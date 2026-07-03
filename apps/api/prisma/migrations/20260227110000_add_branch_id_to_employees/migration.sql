-- Add `branch_id` column to employees table
-- Previously added manually via psql; now tracked as a proper migration
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS "employees_branch_id_idx" ON employees(branch_id);
