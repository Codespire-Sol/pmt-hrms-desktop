-- Add half_day value to the attendance_status enum.
-- Employees who clock in but work >= 4 h and < 8 h will be reclassified as
-- half_day by the nightly attendance scheduler instead of present.
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'half_day';
