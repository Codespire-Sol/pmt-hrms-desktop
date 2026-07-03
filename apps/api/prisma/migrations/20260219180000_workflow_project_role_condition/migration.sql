-- Add 'project_role' to TransitionConditionType enum
-- This enables role-based transition restrictions in the workflow engine

ALTER TYPE "transition_condition_type" ADD VALUE IF NOT EXISTS 'project_role';
