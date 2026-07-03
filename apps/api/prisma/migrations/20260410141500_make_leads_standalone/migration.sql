DROP INDEX IF EXISTS "leads_project_id_idx";
DROP INDEX IF EXISTS "leads_project_id_lead_key_key";

ALTER TABLE "leads"
  DROP COLUMN IF EXISTS "project_id";

CREATE UNIQUE INDEX "leads_lead_key_key" ON "leads" ("lead_key");
