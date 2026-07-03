-- CreateEnum
CREATE TYPE "form_status" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "form_field_type" AS ENUM ('text', 'textarea', 'number', 'email', 'select', 'multiselect', 'checkbox', 'radio', 'date', 'datetime');

-- CreateEnum
CREATE TYPE "bulk_operation_type" AS ENUM ('update', 'delete', 'move', 'transition');

-- CreateEnum
CREATE TYPE "bulk_operation_status" AS ENUM ('pending', 'running', 'completed', 'failed', 'partial', 'cancelled');

-- CreateEnum
CREATE TYPE "bulk_operation_item_status" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "workflow_scheme_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "permission_scheme_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "scheme_principal_type" AS ENUM ('user', 'user_role', 'project_role', 'group');

-- CreateEnum
CREATE TYPE "permission_effect" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "notification_scheme_status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "notification_rule_event" AS ENUM ('issue_created', 'issue_updated', 'issue_assigned', 'issue_status_changed', 'issue_commented', 'issue_deleted', 'project_member_added');

-- CreateEnum
CREATE TYPE "notification_recipient_type" AS ENUM ('assignee', 'reporter', 'watchers', 'specific_user', 'user_role', 'project_role', 'group');

-- CreateTable
CREATE TABLE "forms" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "form_status" NOT NULL DEFAULT 'draft',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "issue_template" JSONB,
    "settings" JSONB DEFAULT '{}',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_fields" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "form_id" UUID NOT NULL,
    "field_key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "field_type" "form_field_type" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "placeholder" VARCHAR(255),
    "helper_text" VARCHAR(500),
    "options" JSONB,
    "validation" JSONB,
    "default_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "form_id" UUID NOT NULL,
    "submitted_by" UUID,
    "payload" JSONB NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "created_issue_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submission_field_values" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "submission_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submission_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_access_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "form_id" UUID NOT NULL,
    "token" VARCHAR(128) NOT NULL,
    "created_by" UUID,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_operations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "operation_type" "bulk_operation_type" NOT NULL,
    "status" "bulk_operation_status" NOT NULL DEFAULT 'pending',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB DEFAULT '{}',
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_operation_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "operation_id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "status" "bulk_operation_item_status" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_operation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_schemes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "workflow_scheme_status" NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_scheme_mappings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_scheme_id" UUID NOT NULL,
    "issue_type_id" UUID,
    "workflow_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_scheme_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_workflow_schemes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "workflow_scheme_id" UUID NOT NULL,
    "assigned_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_workflow_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_schemes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "permission_scheme_status" NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_scheme_rules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "permission_scheme_id" UUID NOT NULL,
    "permission_name" VARCHAR(100) NOT NULL,
    "principal_type" "scheme_principal_type" NOT NULL,
    "principal_id" VARCHAR(100) NOT NULL,
    "effect" "permission_effect" NOT NULL DEFAULT 'allow',
    "conditions" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_scheme_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_permission_schemes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "permission_scheme_id" UUID NOT NULL,
    "assigned_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_permission_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_schemes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "notification_scheme_status" NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_scheme_rules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "notification_scheme_id" UUID NOT NULL,
    "event_type" "notification_rule_event" NOT NULL,
    "recipient_type" "notification_recipient_type" NOT NULL,
    "recipient_id" VARCHAR(100),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_scheme_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_notification_schemes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "notification_scheme_id" UUID NOT NULL,
    "assigned_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_notification_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_members" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "added_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_role_bindings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "group_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "role_scope" VARCHAR(20) NOT NULL DEFAULT 'pmt',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_role_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_group_role_bindings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "group_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "project_role" "project_member_role" NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_group_role_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forms_project_id_idx" ON "forms"("project_id");

-- CreateIndex
CREATE INDEX "forms_status_idx" ON "forms"("status");

-- CreateIndex
CREATE INDEX "forms_created_by_idx" ON "forms"("created_by");

-- CreateIndex
CREATE INDEX "form_fields_form_id_position_idx" ON "form_fields"("form_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "form_fields_form_id_field_key_key" ON "form_fields"("form_id", "field_key");

-- CreateIndex
CREATE INDEX "form_submissions_form_id_idx" ON "form_submissions"("form_id");

-- CreateIndex
CREATE INDEX "form_submissions_submitted_by_idx" ON "form_submissions"("submitted_by");

-- CreateIndex
CREATE INDEX "form_submissions_created_issue_id_idx" ON "form_submissions"("created_issue_id");

-- CreateIndex
CREATE INDEX "form_submission_field_values_submission_id_idx" ON "form_submission_field_values"("submission_id");

-- CreateIndex
CREATE INDEX "form_submission_field_values_field_id_idx" ON "form_submission_field_values"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_submission_field_values_submission_id_field_id_key" ON "form_submission_field_values"("submission_id", "field_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_access_tokens_token_key" ON "form_access_tokens"("token");

-- CreateIndex
CREATE INDEX "form_access_tokens_form_id_is_active_idx" ON "form_access_tokens"("form_id", "is_active");

-- CreateIndex
CREATE INDEX "bulk_operations_project_id_idx" ON "bulk_operations"("project_id");

-- CreateIndex
CREATE INDEX "bulk_operations_requested_by_idx" ON "bulk_operations"("requested_by");

-- CreateIndex
CREATE INDEX "bulk_operations_status_created_at_idx" ON "bulk_operations"("status", "created_at");

-- CreateIndex
CREATE INDEX "bulk_operation_items_operation_id_status_idx" ON "bulk_operation_items"("operation_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_operation_items_operation_id_issue_id_key" ON "bulk_operation_items"("operation_id", "issue_id");

-- CreateIndex
CREATE INDEX "workflow_schemes_project_id_idx" ON "workflow_schemes"("project_id");

-- CreateIndex
CREATE INDEX "workflow_schemes_status_idx" ON "workflow_schemes"("status");

-- CreateIndex
CREATE INDEX "workflow_scheme_mappings_workflow_scheme_id_idx" ON "workflow_scheme_mappings"("workflow_scheme_id");

-- CreateIndex
CREATE INDEX "workflow_scheme_mappings_workflow_id_idx" ON "workflow_scheme_mappings"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_scheme_mappings_workflow_scheme_id_issue_type_id_key" ON "workflow_scheme_mappings"("workflow_scheme_id", "issue_type_id");

-- CreateIndex
CREATE INDEX "project_workflow_schemes_workflow_scheme_id_idx" ON "project_workflow_schemes"("workflow_scheme_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_workflow_schemes_project_id_key" ON "project_workflow_schemes"("project_id");

-- CreateIndex
CREATE INDEX "permission_schemes_project_id_idx" ON "permission_schemes"("project_id");

-- CreateIndex
CREATE INDEX "permission_schemes_status_idx" ON "permission_schemes"("status");

-- CreateIndex
CREATE INDEX "permission_scheme_rules_permission_scheme_id_idx" ON "permission_scheme_rules"("permission_scheme_id");

-- CreateIndex
CREATE INDEX "permission_scheme_rules_permission_name_idx" ON "permission_scheme_rules"("permission_name");

-- CreateIndex
CREATE INDEX "permission_scheme_rules_principal_type_principal_id_idx" ON "permission_scheme_rules"("principal_type", "principal_id");

-- CreateIndex
CREATE INDEX "project_permission_schemes_permission_scheme_id_idx" ON "project_permission_schemes"("permission_scheme_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_permission_schemes_project_id_key" ON "project_permission_schemes"("project_id");

-- CreateIndex
CREATE INDEX "notification_schemes_project_id_idx" ON "notification_schemes"("project_id");

-- CreateIndex
CREATE INDEX "notification_schemes_status_idx" ON "notification_schemes"("status");

-- CreateIndex
CREATE INDEX "notification_scheme_rules_notification_scheme_id_idx" ON "notification_scheme_rules"("notification_scheme_id");

-- CreateIndex
CREATE INDEX "notification_scheme_rules_event_type_is_enabled_idx" ON "notification_scheme_rules"("event_type", "is_enabled");

-- CreateIndex
CREATE INDEX "project_notification_schemes_notification_scheme_id_idx" ON "project_notification_schemes"("notification_scheme_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_notification_schemes_project_id_key" ON "project_notification_schemes"("project_id");

-- CreateIndex
CREATE INDEX "user_groups_project_id_idx" ON "user_groups"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_project_id_name_key" ON "user_groups"("project_id", "name");

-- CreateIndex
CREATE INDEX "user_group_members_group_id_idx" ON "user_group_members"("group_id");

-- CreateIndex
CREATE INDEX "user_group_members_user_id_idx" ON "user_group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_members_group_id_user_id_key" ON "user_group_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "group_role_bindings_group_id_idx" ON "group_role_bindings"("group_id");

-- CreateIndex
CREATE INDEX "group_role_bindings_role_id_idx" ON "group_role_bindings"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_role_bindings_group_id_role_id_role_scope_key" ON "group_role_bindings"("group_id", "role_id", "role_scope");

-- CreateIndex
CREATE INDEX "project_group_role_bindings_project_id_project_role_idx" ON "project_group_role_bindings"("project_id", "project_role");

-- CreateIndex
CREATE UNIQUE INDEX "project_group_role_bindings_group_id_project_id_key" ON "project_group_role_bindings"("group_id", "project_id");

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submission_field_values" ADD CONSTRAINT "form_submission_field_values_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submission_field_values" ADD CONSTRAINT "form_submission_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "form_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_access_tokens" ADD CONSTRAINT "form_access_tokens_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_operation_items" ADD CONSTRAINT "bulk_operation_items_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "bulk_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_scheme_mappings" ADD CONSTRAINT "workflow_scheme_mappings_workflow_scheme_id_fkey" FOREIGN KEY ("workflow_scheme_id") REFERENCES "workflow_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_workflow_schemes" ADD CONSTRAINT "project_workflow_schemes_workflow_scheme_id_fkey" FOREIGN KEY ("workflow_scheme_id") REFERENCES "workflow_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_scheme_rules" ADD CONSTRAINT "permission_scheme_rules_permission_scheme_id_fkey" FOREIGN KEY ("permission_scheme_id") REFERENCES "permission_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_permission_schemes" ADD CONSTRAINT "project_permission_schemes_permission_scheme_id_fkey" FOREIGN KEY ("permission_scheme_id") REFERENCES "permission_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_scheme_rules" ADD CONSTRAINT "notification_scheme_rules_notification_scheme_id_fkey" FOREIGN KEY ("notification_scheme_id") REFERENCES "notification_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_notification_schemes" ADD CONSTRAINT "project_notification_schemes_notification_scheme_id_fkey" FOREIGN KEY ("notification_scheme_id") REFERENCES "notification_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_role_bindings" ADD CONSTRAINT "group_role_bindings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_group_role_bindings" ADD CONSTRAINT "project_group_role_bindings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

