CREATE TABLE "leads" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "project_id" UUID NOT NULL,
  "lead_key" VARCHAR(50) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'open',
  "assignee" VARCHAR(255),
  "priority" VARCHAR(50),
  "due_date" TIMESTAMP(3),
  "start_date" TIMESTAMP(3),
  "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sprint" VARCHAR(100),
  "story_points" INTEGER,
  "reporter" VARCHAR(255),
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leads_project_id_lead_key_key" ON "leads" ("project_id", "lead_key");
CREATE INDEX "leads_project_id_idx" ON "leads" ("project_id");
