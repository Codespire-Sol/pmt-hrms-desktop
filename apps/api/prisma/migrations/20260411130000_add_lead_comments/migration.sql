-- Create lead_comments table
CREATE TABLE "lead_comments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "lead_id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "author_name" VARCHAR(255) NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lead_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_comments_lead_id_idx" ON "lead_comments"("lead_id");

ALTER TABLE "lead_comments"
  ADD CONSTRAINT "lead_comments_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
