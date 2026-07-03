-- Add leave_session enum type
CREATE TYPE leave_session AS ENUM ('full_day', 'first_half', 'second_half');

-- Add session column to leaves table with default full_day
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS session leave_session NOT NULL DEFAULT 'full_day';
