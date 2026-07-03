-- Add `app` column to roles table
-- This column tracks which application owns a custom role: 'hrms' | 'pmt' | null (system/global)
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS app VARCHAR(10);
