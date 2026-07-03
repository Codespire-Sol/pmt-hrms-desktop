-- AddValue to StatusCategory enum
-- Non-destructive: existing rows keep their current category values
ALTER TYPE "status_category" ADD VALUE IF NOT EXISTS 'in_review';
