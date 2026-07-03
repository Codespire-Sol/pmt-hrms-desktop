-- Missing tables that exist in schema.prisma but were never added to any migration.

-- CreateTable: onboarding_invites
CREATE TABLE IF NOT EXISTS "onboarding_invites" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "token" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_invites_employee_id_key" ON "onboarding_invites"("employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_invites_token_key" ON "onboarding_invites"("token");
CREATE INDEX IF NOT EXISTS "onboarding_invites_token_idx" ON "onboarding_invites"("token");

ALTER TABLE "onboarding_invites"
    DROP CONSTRAINT IF EXISTS "onboarding_invites_employee_id_fkey";
ALTER TABLE "onboarding_invites"
    ADD CONSTRAINT "onboarding_invites_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE;

-- CreateTable: employee_documents
CREATE TABLE IF NOT EXISTS "employee_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "employee_id" UUID NOT NULL,
    "document_type" VARCHAR(100) NOT NULL,
    "document_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" UUID,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "employee_documents_employee_id_idx" ON "employee_documents"("employee_id");
CREATE INDEX IF NOT EXISTS "employee_documents_document_type_idx" ON "employee_documents"("document_type");

ALTER TABLE "employee_documents"
    DROP CONSTRAINT IF EXISTS "employee_documents_employee_id_fkey";
ALTER TABLE "employee_documents"
    ADD CONSTRAINT "employee_documents_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE;

-- CreateTable: build_runs
CREATE TABLE IF NOT EXISTS "build_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "run_id" VARCHAR(100) NOT NULL,
    "pipeline_name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "conclusion" VARCHAR(20),
    "url" VARCHAR(500) NOT NULL,
    "commit_sha" VARCHAR(40) NOT NULL,
    "branch_ref" VARCHAR(255),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "build_runs_issue_id_provider_run_id_key" ON "build_runs"("issue_id", "provider", "run_id");
CREATE INDEX IF NOT EXISTS "build_runs_issue_id_idx" ON "build_runs"("issue_id");

ALTER TABLE "build_runs"
    DROP CONSTRAINT IF EXISTS "build_runs_issue_id_fkey";
ALTER TABLE "build_runs"
    ADD CONSTRAINT "build_runs_issue_id_fkey"
    FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;
