/*
  Warnings:

  - You are about to drop the column `device_user_id` on the `attendance_logs` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `attendance_logs` table. All the data in the column will be lost.
  - You are about to drop the column `review_note` on the `employee_documents` table. All the data in the column will be lost.
  - You are about to drop the column `reviewed_at` on the `employee_documents` table. All the data in the column will be lost.
  - You are about to drop the column `reviewed_by` on the `employee_documents` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `employee_documents` table. All the data in the column will be lost.
  - You are about to drop the column `biometric_device_id` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `work_mode` on the `employees` table. All the data in the column will be lost.
  - You are about to alter the column `embedding` on the `issue_embeddings` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Unsupported("vector(1536)")`.
  - You are about to drop the column `is_auto_lop` on the `leaves` table. All the data in the column will be lost.
  - Changed the type of `leave_type` on the `leave_types` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `leave_type` on the `leaves` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "budget_alerts" DROP CONSTRAINT IF EXISTS "budget_alerts_project_id_fkey";

-- DropForeignKey
ALTER TABLE "build_runs" DROP CONSTRAINT IF EXISTS "build_runs_issue_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_documents" DROP CONSTRAINT IF EXISTS "employee_documents_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "onboarding_invites" DROP CONSTRAINT IF EXISTS "onboarding_invites_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "project_budgets" DROP CONSTRAINT IF EXISTS "project_budgets_project_id_fkey";

-- DropForeignKey
ALTER TABLE "resource_rates" DROP CONSTRAINT IF EXISTS "resource_rates_project_id_fkey";

-- DropForeignKey
ALTER TABLE "resource_rates" DROP CONSTRAINT IF EXISTS "resource_rates_user_id_fkey";

-- Drop unique constraint (backed by index)
ALTER TABLE "attendance_logs" DROP CONSTRAINT IF EXISTS "attendance_logs_employee_logged_at_type_source_key";

-- DropIndex
DROP INDEX IF EXISTS "leaves_employee_auto_lop_unique";

-- AlterTable
ALTER TABLE "attendance_logs" DROP COLUMN "device_user_id",
DROP COLUMN "source";

-- AlterTable
ALTER TABLE "budget_alerts" ALTER COLUMN "triggered_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "employee_documents" DROP COLUMN "review_note",
DROP COLUMN "reviewed_at",
DROP COLUMN "reviewed_by",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "biometric_device_id",
DROP COLUMN "country",
DROP COLUMN "work_mode";

-- AlterTable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    ALTER TABLE "issue_embeddings" ALTER COLUMN "embedding" TYPE vector(1536) USING ("embedding"::vector(1536));
  END IF;
END $$;

-- AlterTable
ALTER TABLE "leave_types"
ALTER COLUMN "leave_type" TYPE VARCHAR(100) USING ("leave_type"::text);

-- AlterTable
ALTER TABLE "leaves" DROP COLUMN "is_auto_lop",
ALTER COLUMN "leave_type" TYPE VARCHAR(100) USING ("leave_type"::text);

-- AlterTable
ALTER TABLE "onboarding_otps" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "project_budgets" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "resource_rates" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "saml_configs" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "build_runs_provider_idx" ON "build_runs"("provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "build_runs_status_idx" ON "build_runs"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "build_runs_created_at_idx" ON "build_runs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "leave_types_leave_type_key" ON "leave_types"("leave_type");

-- AddForeignKey
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_rates" ADD CONSTRAINT "resource_rates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_rates" ADD CONSTRAINT "resource_rates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_alerts" ADD CONSTRAINT "budget_alerts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_invites" ADD CONSTRAINT "onboarding_invites_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_runs" ADD CONSTRAINT "build_runs_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

