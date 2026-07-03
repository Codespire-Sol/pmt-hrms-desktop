-- Make workflows.project_id nullable (allow global/default workflows without a project)
ALTER TABLE "workflows" DROP CONSTRAINT IF EXISTS "workflows_project_id_fkey";
ALTER TABLE "workflows" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON UPDATE CASCADE ON DELETE CASCADE;

-- Make status_transitions.name nullable (transition names are optional)
ALTER TABLE "status_transitions" ALTER COLUMN "name" DROP NOT NULL;

-- Ensure the default global workflow exists (project_id = NULL, is_default = TRUE)
-- Only inserts if no default workflow with null project_id already exists
INSERT INTO "workflows" ("name", "description", "project_id", "is_default", "is_active")
SELECT 'Default Workflow', 'Default workflow for all projects', NULL, TRUE, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM "workflows" WHERE "is_default" = TRUE AND "project_id" IS NULL
);
