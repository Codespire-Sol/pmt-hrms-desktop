CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS vector; -- pgvector not installed on this system


-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('active', 'archived', 'on_hold');

-- CreateEnum
CREATE TYPE "project_visibility" AS ENUM ('private', 'internal', 'public');

-- CreateEnum
CREATE TYPE "project_member_role" AS ENUM ('admin', 'lead', 'member', 'viewer');

-- CreateEnum
CREATE TYPE "status_category" AS ENUM ('todo', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "sprint_status" AS ENUM ('planned', 'active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "issue_link_type" AS ENUM ('blocks', 'is_blocked_by', 'duplicates', 'is_duplicated_by', 'relates_to', 'causes', 'is_caused_by', 'clones', 'is_cloned_by');

-- CreateEnum
CREATE TYPE "issue_change_type" AS ENUM ('create', 'update', 'delete');

-- CreateEnum
CREATE TYPE "custom_field_type" AS ENUM ('text', 'number', 'date', 'datetime', 'select', 'multiselect', 'checkbox', 'url', 'email', 'user');

-- CreateEnum
CREATE TYPE "dashboard_type" AS ENUM ('user', 'project');

-- CreateEnum
CREATE TYPE "dashboard_permission" AS ENUM ('view', 'edit');

-- CreateEnum
CREATE TYPE "saved_filter_visibility" AS ENUM ('private', 'project', 'global');

-- CreateEnum
CREATE TYPE "screen_operation" AS ENUM ('create', 'view', 'edit', 'transition');

-- CreateEnum
CREATE TYPE "wip_limit_type" AS ENUM ('soft', 'hard');

-- CreateEnum
CREATE TYPE "webhook_method" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

-- CreateEnum
CREATE TYPE "webhook_delivery_status" AS ENUM ('pending', 'success', 'failed', 'retrying');

-- CreateEnum
CREATE TYPE "webhook_payload_format" AS ENUM ('json', 'form');

-- CreateEnum
CREATE TYPE "automation_trigger_type" AS ENUM ('issue_created', 'issue_updated', 'issue_transitioned', 'issue_assigned', 'issue_commented', 'sprint_started', 'sprint_completed', 'scheduled', 'manual');

-- CreateEnum
CREATE TYPE "automation_execution_status" AS ENUM ('pending', 'running', 'success', 'failure', 'skipped');

-- CreateEnum
CREATE TYPE "transition_condition_type" AS ENUM ('required_fields', 'field_value', 'permission', 'assignee', 'reporter', 'resolution', 'custom_script', 'linked_issues', 'subtasks_done', 'time_logged', 'approval');

-- CreateEnum
CREATE TYPE "transition_validator_type" AS ENUM ('validate_regex', 'validate_date_range', 'validate_numeric_range', 'validate_email', 'validate_url', 'validate_custom');

-- CreateEnum
CREATE TYPE "transition_postfunction_type" AS ENUM ('set_field', 'copy_field', 'clear_field', 'assign_to_reporter', 'assign_to_lead', 'unassign', 'add_comment', 'add_watcher', 'send_notification', 'update_parent', 'trigger_webhook');

-- CreateEnum
CREATE TYPE "approval_decision" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "issue_transition_approval_status" AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "version_status" AS ENUM ('unreleased', 'released', 'archived');

-- CreateEnum
CREATE TYPE "wip_violation_action" AS ENUM ('override', 'blocked');

-- CreateEnum
CREATE TYPE "recent_item_entity_type" AS ENUM ('issue', 'project', 'user', 'comment');

-- CreateEnum
CREATE TYPE "screen_tab_field_type" AS ENUM ('system', 'custom');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "avatar_url" VARCHAR(500),
    "phone" VARCHAR(20),
    "timezone" VARCHAR(50) DEFAULT 'UTC',
    "locale" VARCHAR(10) DEFAULT 'en',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3),
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" VARCHAR(255),
    "role_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" VARCHAR(10) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "owner_id" UUID NOT NULL,
    "lead_id" UUID,
    "category_id" UUID,
    "category" VARCHAR(100),
    "status" "project_status" NOT NULL DEFAULT 'active',
    "visibility" "project_visibility" NOT NULL DEFAULT 'private',
    "start_date" DATE,
    "target_end_date" DATE,
    "actual_end_date" DATE,
    "default_assignee_id" UUID,
    "settings" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "project_member_role" NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by" UUID,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7),
    "icon" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "project_id" UUID NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statuses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7),
    "category" "status_category" NOT NULL DEFAULT 'todo',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "wip_limit" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_transitions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workflow_id" UUID NOT NULL,
    "from_status_id" UUID NOT NULL,
    "to_status_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "status_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_types" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "is_subtask" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_priorities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7),
    "description" TEXT,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "issue_number" INTEGER NOT NULL,
    "parent_id" UUID,
    "type_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "priority_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "description_html" TEXT,
    "reporter_id" UUID NOT NULL,
    "assignee_id" UUID,
    "sprint_id" UUID,
    "story_points" INTEGER,
    "original_estimate_hours" DECIMAL(10,2),
    "remaining_estimate_hours" DECIMAL(10,2),
    "time_spent_hours" DECIMAL(10,2) DEFAULT 0,
    "due_date" DATE,
    "start_date" DATE,
    "resolution" VARCHAR(100),
    "resolution_date" TIMESTAMP(3),
    "environment" TEXT,
    "affected_version" VARCHAR(50),
    "fix_version" VARCHAR(50),
    "components" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "watcher_count" INTEGER NOT NULL DEFAULT 0,
    "security_level_id" UUID,
    "search_vector" tsvector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_labels" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" UUID,

    CONSTRAINT "issue_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_links" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "source_issue_id" UUID NOT NULL,
    "target_issue_id" UUID NOT NULL,
    "link_type_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_types" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(50) NOT NULL,
    "inward" VARCHAR(100) NOT NULL,
    "outward" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "old_value_id" UUID,
    "new_value_id" UUID,
    "change_type" "issue_change_type" NOT NULL DEFAULT 'update',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_watchers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_watchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_votes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_embeddings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "embedding" TEXT, -- vector(1536) replaced: pgvector not installed
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" TEXT NOT NULL,
    "content_html" TEXT,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "comment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_mentions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "comment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprints" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "goal" TEXT,
    "status" "sprint_status" NOT NULL DEFAULT 'planned',
    "start_date" DATE,
    "end_date" DATE,
    "actual_start_date" DATE,
    "actual_end_date" DATE,
    "capacity_hours" DECIMAL(10,2),
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "completed_by" UUID,
    "retrospective_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_metrics" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "sprint_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_issues" INTEGER NOT NULL DEFAULT 0,
    "completed_issues" INTEGER NOT NULL DEFAULT 0,
    "total_story_points" INTEGER NOT NULL DEFAULT 0,
    "completed_story_points" INTEGER NOT NULL DEFAULT 0,
    "total_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "completed_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "added_issues" INTEGER NOT NULL DEFAULT 0,
    "removed_issues" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprint_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "hours" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "work_date" DATE NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_timers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "paused_at" TIMESTAMP(3),
    "total_paused_seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "active_timers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID,
    "comment_id" UUID,
    "uploaded_by" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "thumbnail_path" VARCHAR(500),
    "metadata" JSONB DEFAULT '{}',
    "parent_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "is_latest_version" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "actor_id" UUID,
    "issue_id" UUID,
    "comment_id" UUID,
    "project_id" UUID,
    "metadata" JSONB DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "notification_type" VARCHAR(50) NOT NULL,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_info" JSONB,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_providers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_id" VARCHAR(255) NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "profile" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_backup_codes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "field_name" VARCHAR(100),
    "old_value" TEXT,
    "new_value" TEXT,
    "comment_id" UUID,
    "project_id" UUID,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_fields" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "field_key" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "field_type" "custom_field_type" NOT NULL,
    "options" JSONB DEFAULT '[]',
    "validation" JSONB DEFAULT '{}',
    "default_value" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_filterable" BOOLEAN NOT NULL DEFAULT true,
    "is_visible_in_list" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_custom_field_values" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "custom_field_id" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "issue_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "components" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "lead_id" UUID,
    "default_assignee_id" UUID,
    "color" VARCHAR(7),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_components" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "status" "version_status" NOT NULL DEFAULT 'unreleased',
    "release_date" DATE,
    "start_date" DATE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_levels" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_level_roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "security_level_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_level_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boards" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'kanban',
    "config" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_columns" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "board_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "wip_limit" INTEGER,
    "wip_limit_enabled" BOOLEAN NOT NULL DEFAULT false,
    "wip_limit_type" "wip_limit_type" NOT NULL DEFAULT 'soft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "board_id" UUID NOT NULL,
    "wip_limits_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_wip_type" "wip_limit_type" NOT NULL DEFAULT 'soft',
    "show_wip_warnings" BOOLEAN NOT NULL DEFAULT true,
    "track_wip_violations" BOOLEAN NOT NULL DEFAULT true,
    "swimlane_wip_limits" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wip_limit_violations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "board_id" UUID NOT NULL,
    "column_id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" "wip_violation_action" NOT NULL,
    "limit_at_time" INTEGER NOT NULL,
    "count_at_time" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wip_limit_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen_tabs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "screen_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screen_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen_tab_fields" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tab_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "field_type" "screen_tab_field_type" NOT NULL DEFAULT 'system',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screen_tab_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen_schemes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screen_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen_scheme_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "screen_scheme_id" UUID NOT NULL,
    "screen_id" UUID NOT NULL,
    "operation" "screen_operation" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screen_scheme_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_type_screen_schemes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_type_screen_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_type_screen_scheme_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_type_screen_scheme_id" UUID NOT NULL,
    "issue_type_id" UUID,
    "screen_scheme_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_type_screen_scheme_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_filters" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "project_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "jql" TEXT,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "visibility" "saved_filter_visibility" NOT NULL DEFAULT 'private',
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "filter_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filter_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recent_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "entity_type" "recent_item_entity_type" NOT NULL,
    "entity_id" UUID NOT NULL,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recent_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "query" VARCHAR(500) NOT NULL,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "query" VARCHAR(500) NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_preferences" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "type" "dashboard_type" NOT NULL DEFAULT 'user',
    "project_id" UUID,
    "layout" JSONB NOT NULL DEFAULT '[]',
    "widgets" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_shares" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "dashboard_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "share_type" VARCHAR(20) NOT NULL,
    "user_id" UUID,
    "permission" "dashboard_permission" NOT NULL DEFAULT 'view',
    "public_token" VARCHAR(100),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "project_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "report_type" VARCHAR(50) NOT NULL,
    "format" VARCHAR(20) NOT NULL DEFAULT 'pdf',
    "frequency" VARCHAR(20) NOT NULL,
    "day_of_week" INTEGER,
    "day_of_month" INTEGER,
    "time_of_day" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "recipients" TEXT[],
    "include_self" BOOLEAN NOT NULL DEFAULT true,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "send_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_report_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "scheduled_report_id" UUID NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) NOT NULL,
    "recipients_count" INTEGER NOT NULL DEFAULT 0,
    "successful_deliveries" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "file_size_bytes" INTEGER,
    "generation_time_ms" INTEGER,

    CONSTRAINT "scheduled_report_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_project_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "smart_suggestions_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_assignment_enabled" BOOLEAN NOT NULL DEFAULT false,
    "time_estimation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "risk_analysis_enabled" BOOLEAN NOT NULL DEFAULT true,
    "standup_generation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "duplicate_detection_enabled" BOOLEAN NOT NULL DEFAULT true,
    "confidence_threshold" DECIMAL(3,2) NOT NULL DEFAULT 0.70,
    "preferred_model" VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "feature_flags" JSONB NOT NULL DEFAULT '{}',
    "custom_prompts" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_project_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_request_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID,
    "user_id" UUID,
    "feature" VARCHAR(100) NOT NULL,
    "endpoint" VARCHAR(255) NOT NULL,
    "model" VARCHAR(100),
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "response_time_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedback" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID,
    "user_id" UUID,
    "issue_id" UUID,
    "feature" VARCHAR(100) NOT NULL,
    "feedback_type" VARCHAR(50) NOT NULL,
    "rating" INTEGER,
    "original_suggestion" JSONB NOT NULL DEFAULT '{}',
    "final_value" JSONB NOT NULL DEFAULT '{}',
    "user_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "project_id" UUID,
    "operation" VARCHAR(100) NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "response_time_ms" INTEGER NOT NULL,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "model" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "suggestion_type" VARCHAR(50) NOT NULL,
    "suggested_value" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "skill_name" VARCHAR(100) NOT NULL,
    "proficiency_level" INTEGER NOT NULL DEFAULT 1,
    "issues_completed" INTEGER NOT NULL DEFAULT 0,
    "avg_completion_time_hours" DECIMAL(10,2),
    "success_rate" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_predictions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "predicted_by_user" UUID,
    "predicted_hours" INTEGER NOT NULL,
    "confidence_score" DECIMAL(3,2) NOT NULL,
    "model_version" VARCHAR(100),
    "factors" JSONB NOT NULL DEFAULT '{}',
    "actual_hours" INTEGER,
    "accuracy_score" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "time_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID,
    "sprint_id" UUID,
    "issue_id" UUID,
    "recommendation_type" VARCHAR(50) NOT NULL,
    "recommendation_data" JSONB NOT NULL,
    "confidence_score" DECIMAL(3,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "acted_on_by" UUID,
    "acted_on_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger_type" "automation_trigger_type" NOT NULL,
    "trigger_config" JSONB NOT NULL DEFAULT '{}',
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "execution_order" INTEGER NOT NULL DEFAULT 0,
    "stop_on_error" BOOLEAN NOT NULL DEFAULT false,
    "execution_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_executed_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rule_executions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "rule_id" UUID NOT NULL,
    "triggered_by_user_id" UUID,
    "triggered_by_issue_id" UUID,
    "status" "automation_execution_status" NOT NULL DEFAULT 'pending',
    "trigger_data" JSONB NOT NULL DEFAULT '{}',
    "condition_results" JSONB NOT NULL DEFAULT '[]',
    "action_results" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_rule_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_rule_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "rule_id" UUID NOT NULL,
    "cron_expression" VARCHAR(100) NOT NULL,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_rule_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "method" "webhook_method" NOT NULL DEFAULT 'POST',
    "headers" JSONB NOT NULL DEFAULT '{}',
    "secret" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "events" JSONB NOT NULL DEFAULT '[]',
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_delay_seconds" INTEGER NOT NULL DEFAULT 60,
    "exponential_backoff" BOOLEAN NOT NULL DEFAULT true,
    "payload_format" "webhook_payload_format" NOT NULL DEFAULT 'json',
    "custom_payload" TEXT,
    "total_deliveries" INTEGER NOT NULL DEFAULT 0,
    "successful_deliveries" INTEGER NOT NULL DEFAULT 0,
    "failed_deliveries" INTEGER NOT NULL DEFAULT 0,
    "last_delivery_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "webhook_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "event_id" UUID,
    "payload" JSONB NOT NULL,
    "headers_sent" JSONB NOT NULL DEFAULT '{}',
    "request_url" TEXT NOT NULL,
    "request_method" VARCHAR(10) NOT NULL,
    "status" "webhook_delivery_status" NOT NULL DEFAULT 'pending',
    "response_status_code" INTEGER,
    "response_body" TEXT,
    "response_headers" JSONB,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "max_attempts" INTEGER NOT NULL DEFAULT 4,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transition_conditions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "transition_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "transition_condition_type" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_blocking" BOOLEAN NOT NULL DEFAULT true,
    "error_message" VARCHAR(500),
    "execution_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transition_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transition_validators" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "transition_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "transition_validator_type" NOT NULL,
    "field" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "error_message" VARCHAR(500),
    "execution_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transition_validators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transition_postfunctions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "transition_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "transition_postfunction_type" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "execution_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transition_postfunctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transition_approvals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "transition_id" UUID NOT NULL,
    "required_approvals" INTEGER NOT NULL DEFAULT 1,
    "approver_type" JSONB NOT NULL DEFAULT '"any"',
    "approvers" JSONB NOT NULL DEFAULT '[]',
    "allow_self_approval" BOOLEAN NOT NULL DEFAULT false,
    "expiry_hours" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transition_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_transition_approvals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "transition_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "status" "issue_transition_approval_status" NOT NULL DEFAULT 'pending',
    "approvals_received" INTEGER NOT NULL DEFAULT 0,
    "approvals_required" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_transition_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_transition_approval_responses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "approval_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "decision" "approval_decision" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_transition_approval_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_workspaces" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "team_id" VARCHAR(50) NOT NULL,
    "team_name" VARCHAR(255) NOT NULL,
    "access_token" TEXT NOT NULL,
    "bot_user_id" VARCHAR(50) NOT NULL,
    "default_channel_id" VARCHAR(50),
    "installed_by" UUID NOT NULL,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_channel_configs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workspace_id" UUID NOT NULL,
    "channel_id" VARCHAR(50) NOT NULL,
    "channel_name" VARCHAR(255) NOT NULL,
    "events" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_user_mappings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "slack_user_id" VARCHAR(50) NOT NULL,
    "slack_username" VARCHAR(255) NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_user_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_installations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "installation_id" INTEGER NOT NULL,
    "account_login" VARCHAR(255) NOT NULL,
    "account_type" VARCHAR(50) NOT NULL,
    "account_avatar_url" VARCHAR(500),
    "access_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "installed_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_repositories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "installation_id" INTEGER NOT NULL,
    "owner" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(511) NOT NULL,
    "default_branch" VARCHAR(255) NOT NULL DEFAULT 'main',
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "auto_transition_on_merge" BOOLEAN NOT NULL DEFAULT false,
    "transition_status_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_commits" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "sha" VARCHAR(40) NOT NULL,
    "message" TEXT NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "author_email" VARCHAR(255),
    "author_avatar_url" VARCHAR(500),
    "url" VARCHAR(500) NOT NULL,
    "committed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_pull_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "state" VARCHAR(20) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "author_avatar_url" VARCHAR(500),
    "merged" BOOLEAN NOT NULL DEFAULT false,
    "merged_at" TIMESTAMP(3),
    "merged_by" VARCHAR(255),
    "base_branch" VARCHAR(255) NOT NULL,
    "head_branch" VARCHAR(255) NOT NULL,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "changed_files" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_branches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "branch_name" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_integrations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "calendar_id" VARCHAR(255) NOT NULL,
    "calendar_name" VARCHAR(255) NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "sync_due_dates" BOOLEAN NOT NULL DEFAULT true,
    "sync_sprints" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_mappings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "issue_id" UUID,
    "sprint_id" UUID,
    "external_event_id" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "due_date_reminders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reminder_type" VARCHAR(50) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "due_date_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_key_key" ON "projects"("key");

-- CreateIndex
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_category_id_idx" ON "projects"("category_id");

-- CreateIndex
CREATE INDEX "project_members_project_id_idx" ON "project_members"("project_id");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_categories_name_key" ON "project_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "project_categories_slug_key" ON "project_categories"("slug");

-- CreateIndex
CREATE INDEX "workflows_project_id_idx" ON "workflows"("project_id");

-- CreateIndex
CREATE INDEX "statuses_workflow_id_idx" ON "statuses"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_workflow_id_name_key" ON "statuses"("workflow_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "status_transitions_workflow_id_from_status_id_to_status_id_key" ON "status_transitions"("workflow_id", "from_status_id", "to_status_id");

-- CreateIndex
CREATE INDEX "issue_types_project_id_idx" ON "issue_types"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_types_project_id_name_key" ON "issue_types"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "issue_priorities_name_key" ON "issue_priorities"("name");

-- CreateIndex
CREATE INDEX "labels_project_id_idx" ON "labels"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "labels_project_id_name_key" ON "labels"("project_id", "name");

-- CreateIndex
CREATE INDEX "issues_project_id_idx" ON "issues"("project_id");

-- CreateIndex
CREATE INDEX "issues_assignee_id_idx" ON "issues"("assignee_id");

-- CreateIndex
CREATE INDEX "issues_reporter_id_idx" ON "issues"("reporter_id");

-- CreateIndex
CREATE INDEX "issues_status_id_idx" ON "issues"("status_id");

-- CreateIndex
CREATE INDEX "issues_type_id_idx" ON "issues"("type_id");

-- CreateIndex
CREATE INDEX "issues_parent_id_idx" ON "issues"("parent_id");

-- CreateIndex
CREATE INDEX "issues_sprint_id_idx" ON "issues"("sprint_id");

-- CreateIndex
CREATE INDEX "issues_due_date_idx" ON "issues"("due_date");

-- CreateIndex
CREATE INDEX "issues_priority_id_idx" ON "issues"("priority_id");

-- CreateIndex
CREATE INDEX "issues_security_level_id_idx" ON "issues"("security_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "issues_project_id_issue_number_key" ON "issues"("project_id", "issue_number");

-- CreateIndex
CREATE INDEX "issue_labels_issue_id_idx" ON "issue_labels"("issue_id");

-- CreateIndex
CREATE INDEX "issue_labels_label_id_idx" ON "issue_labels"("label_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_labels_issue_id_label_id_key" ON "issue_labels"("issue_id", "label_id");

-- CreateIndex
CREATE INDEX "issue_links_source_issue_id_idx" ON "issue_links"("source_issue_id");

-- CreateIndex
CREATE INDEX "issue_links_target_issue_id_idx" ON "issue_links"("target_issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_links_source_issue_id_target_issue_id_link_type_id_key" ON "issue_links"("source_issue_id", "target_issue_id", "link_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "link_types_name_key" ON "link_types"("name");

-- CreateIndex
CREATE INDEX "issue_history_issue_id_idx" ON "issue_history"("issue_id");

-- CreateIndex
CREATE INDEX "issue_history_created_at_idx" ON "issue_history"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "issue_watchers_issue_id_user_id_key" ON "issue_watchers"("issue_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_votes_issue_id_user_id_key" ON "issue_votes"("issue_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_embeddings_issue_id_key" ON "issue_embeddings"("issue_id");

-- CreateIndex
CREATE INDEX "comments_issue_id_idx" ON "comments"("issue_id");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "comments_parent_id_idx" ON "comments"("parent_id");

-- CreateIndex
CREATE INDEX "comments_created_at_idx" ON "comments"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reactions_comment_id_user_id_emoji_key" ON "comment_reactions"("comment_id", "user_id", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "comment_mentions_comment_id_user_id_key" ON "comment_mentions"("comment_id", "user_id");

-- CreateIndex
CREATE INDEX "sprints_project_id_idx" ON "sprints"("project_id");

-- CreateIndex
CREATE INDEX "sprints_status_idx" ON "sprints"("status");

-- CreateIndex
CREATE INDEX "sprints_start_date_end_date_idx" ON "sprints"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "sprint_metrics_sprint_id_idx" ON "sprint_metrics"("sprint_id");

-- CreateIndex
CREATE UNIQUE INDEX "sprint_metrics_sprint_id_date_key" ON "sprint_metrics"("sprint_id", "date");

-- CreateIndex
CREATE INDEX "time_logs_issue_id_idx" ON "time_logs"("issue_id");

-- CreateIndex
CREATE INDEX "time_logs_user_id_idx" ON "time_logs"("user_id");

-- CreateIndex
CREATE INDEX "time_logs_work_date_idx" ON "time_logs"("work_date");

-- CreateIndex
CREATE INDEX "time_logs_user_id_work_date_idx" ON "time_logs"("user_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "active_timers_user_id_key" ON "active_timers"("user_id");

-- CreateIndex
CREATE INDEX "attachments_issue_id_idx" ON "attachments"("issue_id");

-- CreateIndex
CREATE INDEX "attachments_comment_id_idx" ON "attachments"("comment_id");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_idx" ON "attachments"("uploaded_by");

-- CreateIndex
CREATE INDEX "attachments_created_at_idx" ON "attachments"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_notification_type_key" ON "notification_preferences"("user_id", "notification_type");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_providers_provider_provider_id_key" ON "oauth_providers"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_providers_user_id_provider_key" ON "oauth_providers"("user_id", "provider");

-- CreateIndex
CREATE INDEX "two_factor_backup_codes_user_id_idx" ON "two_factor_backup_codes"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_issue_id_idx" ON "activity_logs"("issue_id");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "custom_fields_project_id_idx" ON "custom_fields"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_fields_project_id_field_key_key" ON "custom_fields"("project_id", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "issue_custom_field_values_issue_id_custom_field_id_key" ON "issue_custom_field_values"("issue_id", "custom_field_id");

-- CreateIndex
CREATE INDEX "components_project_id_idx" ON "components"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "components_project_id_name_key" ON "components"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "issue_components_issue_id_component_id_key" ON "issue_components"("issue_id", "component_id");

-- CreateIndex
CREATE INDEX "versions_project_id_idx" ON "versions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "versions_project_id_name_key" ON "versions"("project_id", "name");

-- CreateIndex
CREATE INDEX "security_levels_project_id_idx" ON "security_levels"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "security_levels_project_id_name_key" ON "security_levels"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "security_level_roles_security_level_id_role_id_key" ON "security_level_roles"("security_level_id", "role_id");

-- CreateIndex
CREATE INDEX "boards_project_id_idx" ON "boards"("project_id");

-- CreateIndex
CREATE INDEX "board_columns_board_id_idx" ON "board_columns"("board_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_columns_board_id_status_id_key" ON "board_columns"("board_id", "status_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_settings_board_id_key" ON "board_settings"("board_id");

-- CreateIndex
CREATE INDEX "wip_limit_violations_board_id_idx" ON "wip_limit_violations"("board_id");

-- CreateIndex
CREATE INDEX "wip_limit_violations_column_id_idx" ON "wip_limit_violations"("column_id");

-- CreateIndex
CREATE INDEX "wip_limit_violations_created_at_idx" ON "wip_limit_violations"("created_at");

-- CreateIndex
CREATE INDEX "screens_project_id_idx" ON "screens"("project_id");

-- CreateIndex
CREATE INDEX "screen_tabs_screen_id_idx" ON "screen_tabs"("screen_id");

-- CreateIndex
CREATE UNIQUE INDEX "screen_tab_fields_tab_id_field_name_key" ON "screen_tab_fields"("tab_id", "field_name");

-- CreateIndex
CREATE INDEX "screen_schemes_project_id_idx" ON "screen_schemes"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "screen_scheme_items_screen_scheme_id_operation_key" ON "screen_scheme_items"("screen_scheme_id", "operation");

-- CreateIndex
CREATE INDEX "issue_type_screen_schemes_project_id_idx" ON "issue_type_screen_schemes"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_type_screen_scheme_items_issue_type_screen_scheme_id__key" ON "issue_type_screen_scheme_items"("issue_type_screen_scheme_id", "issue_type_id");

-- CreateIndex
CREATE INDEX "saved_filters_user_id_idx" ON "saved_filters"("user_id");

-- CreateIndex
CREATE INDEX "saved_filters_project_id_idx" ON "saved_filters"("project_id");

-- CreateIndex
CREATE INDEX "filter_subscriptions_user_id_idx" ON "filter_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "filter_subscriptions_filter_id_user_id_key" ON "filter_subscriptions"("filter_id", "user_id");

-- CreateIndex
CREATE INDEX "recent_items_user_id_idx" ON "recent_items"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "recent_items_user_id_entity_type_entity_id_key" ON "recent_items"("user_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "search_history_user_id_idx" ON "search_history"("user_id");

-- CreateIndex
CREATE INDEX "saved_searches_user_id_idx" ON "saved_searches"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_preferences_user_id_type_project_id_key" ON "dashboard_preferences"("user_id", "type", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_shares_public_token_key" ON "dashboard_shares"("public_token");

-- CreateIndex
CREATE INDEX "scheduled_report_history_scheduled_report_id_executed_at_idx" ON "scheduled_report_history"("scheduled_report_id", "executed_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_project_configs_project_id_key" ON "ai_project_configs"("project_id");

-- CreateIndex
CREATE INDEX "ai_request_logs_project_id_idx" ON "ai_request_logs"("project_id");

-- CreateIndex
CREATE INDEX "ai_request_logs_user_id_idx" ON "ai_request_logs"("user_id");

-- CreateIndex
CREATE INDEX "ai_request_logs_feature_idx" ON "ai_request_logs"("feature");

-- CreateIndex
CREATE INDEX "ai_request_logs_created_at_idx" ON "ai_request_logs"("created_at");

-- CreateIndex
CREATE INDEX "ai_request_logs_success_idx" ON "ai_request_logs"("success");

-- CreateIndex
CREATE INDEX "ai_feedback_project_id_idx" ON "ai_feedback"("project_id");

-- CreateIndex
CREATE INDEX "ai_feedback_user_id_idx" ON "ai_feedback"("user_id");

-- CreateIndex
CREATE INDEX "ai_feedback_feature_idx" ON "ai_feedback"("feature");

-- CreateIndex
CREATE INDEX "ai_feedback_feedback_type_idx" ON "ai_feedback"("feedback_type");

-- CreateIndex
CREATE INDEX "ai_feedback_created_at_idx" ON "ai_feedback"("created_at");

-- CreateIndex
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage"("user_id");

-- CreateIndex
CREATE INDEX "ai_usage_project_id_idx" ON "ai_usage"("project_id");

-- CreateIndex
CREATE INDEX "ai_usage_operation_idx" ON "ai_usage"("operation");

-- CreateIndex
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage"("created_at");

-- CreateIndex
CREATE INDEX "ai_suggestions_issue_id_suggestion_type_idx" ON "ai_suggestions"("issue_id", "suggestion_type");

-- CreateIndex
CREATE INDEX "ai_suggestions_user_id_idx" ON "ai_suggestions"("user_id");

-- CreateIndex
CREATE INDEX "ai_suggestions_status_idx" ON "ai_suggestions"("status");

-- CreateIndex
CREATE INDEX "user_skills_user_id_idx" ON "user_skills"("user_id");

-- CreateIndex
CREATE INDEX "user_skills_skill_name_idx" ON "user_skills"("skill_name");

-- CreateIndex
CREATE UNIQUE INDEX "user_skills_user_id_skill_name_key" ON "user_skills"("user_id", "skill_name");

-- CreateIndex
CREATE INDEX "time_predictions_issue_id_idx" ON "time_predictions"("issue_id");

-- CreateIndex
CREATE INDEX "time_predictions_created_at_idx" ON "time_predictions"("created_at");

-- CreateIndex
CREATE INDEX "ai_recommendations_project_id_idx" ON "ai_recommendations"("project_id");

-- CreateIndex
CREATE INDEX "ai_recommendations_sprint_id_idx" ON "ai_recommendations"("sprint_id");

-- CreateIndex
CREATE INDEX "ai_recommendations_issue_id_idx" ON "ai_recommendations"("issue_id");

-- CreateIndex
CREATE INDEX "ai_recommendations_recommendation_type_idx" ON "ai_recommendations"("recommendation_type");

-- CreateIndex
CREATE INDEX "ai_recommendations_status_idx" ON "ai_recommendations"("status");

-- CreateIndex
CREATE INDEX "ai_recommendations_created_at_idx" ON "ai_recommendations"("created_at");

-- CreateIndex
CREATE INDEX "automation_rules_project_id_idx" ON "automation_rules"("project_id");

-- CreateIndex
CREATE INDEX "automation_rules_trigger_type_idx" ON "automation_rules"("trigger_type");

-- CreateIndex
CREATE INDEX "automation_rules_is_enabled_idx" ON "automation_rules"("is_enabled");

-- CreateIndex
CREATE INDEX "automation_rule_executions_rule_id_idx" ON "automation_rule_executions"("rule_id");

-- CreateIndex
CREATE INDEX "automation_rule_executions_status_idx" ON "automation_rule_executions"("status");

-- CreateIndex
CREATE INDEX "automation_rule_executions_created_at_idx" ON "automation_rule_executions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_rule_runs_rule_id_key" ON "scheduled_rule_runs"("rule_id");

-- CreateIndex
CREATE INDEX "scheduled_rule_runs_next_run_at_idx" ON "scheduled_rule_runs"("next_run_at");

-- CreateIndex
CREATE INDEX "webhooks_project_id_idx" ON "webhooks"("project_id");

-- CreateIndex
CREATE INDEX "webhooks_is_enabled_idx" ON "webhooks"("is_enabled");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries"("webhook_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries"("status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_event_type_idx" ON "webhook_deliveries"("event_type");

-- CreateIndex
CREATE INDEX "workflow_transition_conditions_transition_id_idx" ON "workflow_transition_conditions"("transition_id");

-- CreateIndex
CREATE INDEX "workflow_transition_validators_transition_id_idx" ON "workflow_transition_validators"("transition_id");

-- CreateIndex
CREATE INDEX "workflow_transition_postfunctions_transition_id_idx" ON "workflow_transition_postfunctions"("transition_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transition_approvals_transition_id_key" ON "workflow_transition_approvals"("transition_id");

-- CreateIndex
CREATE INDEX "issue_transition_approvals_issue_id_status_idx" ON "issue_transition_approvals"("issue_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "issue_transition_approval_responses_approval_id_user_id_key" ON "issue_transition_approval_responses"("approval_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_workspaces_project_id_key" ON "slack_workspaces"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_workspaces_team_id_key" ON "slack_workspaces"("team_id");

-- CreateIndex
CREATE INDEX "slack_channel_configs_workspace_id_idx" ON "slack_channel_configs"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_channel_configs_workspace_id_channel_id_key" ON "slack_channel_configs"("workspace_id", "channel_id");

-- CreateIndex
CREATE INDEX "slack_user_mappings_workspace_id_idx" ON "slack_user_mappings"("workspace_id");

-- CreateIndex
CREATE INDEX "slack_user_mappings_user_id_idx" ON "slack_user_mappings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_user_mappings_user_id_workspace_id_key" ON "slack_user_mappings"("user_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_user_mappings_slack_user_id_workspace_id_key" ON "slack_user_mappings"("slack_user_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_installations_installation_id_key" ON "github_installations"("installation_id");

-- CreateIndex
CREATE INDEX "github_installations_installation_id_idx" ON "github_installations"("installation_id");

-- CreateIndex
CREATE INDEX "github_installations_account_login_idx" ON "github_installations"("account_login");

-- CreateIndex
CREATE UNIQUE INDEX "github_repositories_project_id_key" ON "github_repositories"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_repositories_full_name_key" ON "github_repositories"("full_name");

-- CreateIndex
CREATE INDEX "github_repositories_project_id_idx" ON "github_repositories"("project_id");

-- CreateIndex
CREATE INDEX "github_repositories_installation_id_idx" ON "github_repositories"("installation_id");

-- CreateIndex
CREATE INDEX "github_commits_issue_id_idx" ON "github_commits"("issue_id");

-- CreateIndex
CREATE INDEX "github_commits_repository_id_idx" ON "github_commits"("repository_id");

-- CreateIndex
CREATE INDEX "github_commits_committed_at_idx" ON "github_commits"("committed_at");

-- CreateIndex
CREATE UNIQUE INDEX "github_commits_repository_id_sha_key" ON "github_commits"("repository_id", "sha");

-- CreateIndex
CREATE INDEX "github_pull_requests_issue_id_idx" ON "github_pull_requests"("issue_id");

-- CreateIndex
CREATE INDEX "github_pull_requests_repository_id_idx" ON "github_pull_requests"("repository_id");

-- CreateIndex
CREATE INDEX "github_pull_requests_state_idx" ON "github_pull_requests"("state");

-- CreateIndex
CREATE UNIQUE INDEX "github_pull_requests_repository_id_pr_number_key" ON "github_pull_requests"("repository_id", "pr_number");

-- CreateIndex
CREATE INDEX "github_branches_issue_id_idx" ON "github_branches"("issue_id");

-- CreateIndex
CREATE INDEX "github_branches_repository_id_idx" ON "github_branches"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_branches_repository_id_branch_name_key" ON "github_branches"("repository_id", "branch_name");

-- CreateIndex
CREATE INDEX "calendar_integrations_user_id_idx" ON "calendar_integrations"("user_id");

-- CreateIndex
CREATE INDEX "calendar_integrations_provider_idx" ON "calendar_integrations"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_integrations_user_id_provider_key" ON "calendar_integrations"("user_id", "provider");

-- CreateIndex
CREATE INDEX "calendar_event_mappings_user_id_idx" ON "calendar_event_mappings"("user_id");

-- CreateIndex
CREATE INDEX "calendar_event_mappings_issue_id_idx" ON "calendar_event_mappings"("issue_id");

-- CreateIndex
CREATE INDEX "calendar_event_mappings_sprint_id_idx" ON "calendar_event_mappings"("sprint_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_mappings_user_id_external_event_id_provider_key" ON "calendar_event_mappings"("user_id", "external_event_id", "provider");

-- CreateIndex
CREATE INDEX "due_date_reminders_issue_id_reminder_type_sent_at_idx" ON "due_date_reminders"("issue_id", "reminder_type", "sent_at");

-- CreateIndex
CREATE INDEX "due_date_reminders_user_id_sent_at_idx" ON "due_date_reminders"("user_id", "sent_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_assignee_id_fkey" FOREIGN KEY ("default_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "project_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_types" ADD CONSTRAINT "issue_types_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "issue_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "issue_priorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_security_level_id_fkey" FOREIGN KEY ("security_level_id") REFERENCES "security_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_source_issue_id_fkey" FOREIGN KEY ("source_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_target_issue_id_fkey" FOREIGN KEY ("target_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_link_type_id_fkey" FOREIGN KEY ("link_type_id") REFERENCES "link_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_history" ADD CONSTRAINT "issue_history_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_history" ADD CONSTRAINT "issue_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_watchers" ADD CONSTRAINT "issue_watchers_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_watchers" ADD CONSTRAINT "issue_watchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_votes" ADD CONSTRAINT "issue_votes_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_votes" ADD CONSTRAINT "issue_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_embeddings" ADD CONSTRAINT "issue_embeddings_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_metrics" ADD CONSTRAINT "sprint_metrics_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_providers" ADD CONSTRAINT "oauth_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_custom_field_values" ADD CONSTRAINT "issue_custom_field_values_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_custom_field_values" ADD CONSTRAINT "issue_custom_field_values_custom_field_id_fkey" FOREIGN KEY ("custom_field_id") REFERENCES "custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_custom_field_values" ADD CONSTRAINT "issue_custom_field_values_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_components" ADD CONSTRAINT "issue_components_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_components" ADD CONSTRAINT "issue_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions" ADD CONSTRAINT "versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_levels" ADD CONSTRAINT "security_levels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_level_roles" ADD CONSTRAINT "security_level_roles_security_level_id_fkey" FOREIGN KEY ("security_level_id") REFERENCES "security_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_level_roles" ADD CONSTRAINT "security_level_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_settings" ADD CONSTRAINT "board_settings_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_limit_violations" ADD CONSTRAINT "wip_limit_violations_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_limit_violations" ADD CONSTRAINT "wip_limit_violations_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "board_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_limit_violations" ADD CONSTRAINT "wip_limit_violations_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_limit_violations" ADD CONSTRAINT "wip_limit_violations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screens" ADD CONSTRAINT "screens_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_tabs" ADD CONSTRAINT "screen_tabs_screen_id_fkey" FOREIGN KEY ("screen_id") REFERENCES "screens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_tab_fields" ADD CONSTRAINT "screen_tab_fields_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "screen_tabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_schemes" ADD CONSTRAINT "screen_schemes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_scheme_items" ADD CONSTRAINT "screen_scheme_items_screen_scheme_id_fkey" FOREIGN KEY ("screen_scheme_id") REFERENCES "screen_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screen_scheme_items" ADD CONSTRAINT "screen_scheme_items_screen_id_fkey" FOREIGN KEY ("screen_id") REFERENCES "screens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_type_screen_schemes" ADD CONSTRAINT "issue_type_screen_schemes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_type_screen_scheme_items" ADD CONSTRAINT "issue_type_screen_scheme_items_issue_type_screen_scheme_id_fkey" FOREIGN KEY ("issue_type_screen_scheme_id") REFERENCES "issue_type_screen_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_type_screen_scheme_items" ADD CONSTRAINT "issue_type_screen_scheme_items_issue_type_id_fkey" FOREIGN KEY ("issue_type_id") REFERENCES "issue_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_type_screen_scheme_items" ADD CONSTRAINT "issue_type_screen_scheme_items_screen_scheme_id_fkey" FOREIGN KEY ("screen_scheme_id") REFERENCES "screen_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filter_subscriptions" ADD CONSTRAINT "filter_subscriptions_filter_id_fkey" FOREIGN KEY ("filter_id") REFERENCES "saved_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filter_subscriptions" ADD CONSTRAINT "filter_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_items" ADD CONSTRAINT "recent_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboard_preferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_report_history" ADD CONSTRAINT "scheduled_report_history_scheduled_report_id_fkey" FOREIGN KEY ("scheduled_report_id") REFERENCES "scheduled_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_project_configs" ADD CONSTRAINT "ai_project_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_request_logs" ADD CONSTRAINT "ai_request_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_request_logs" ADD CONSTRAINT "ai_request_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_predictions" ADD CONSTRAINT "time_predictions_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_predictions" ADD CONSTRAINT "time_predictions_predicted_by_user_fkey" FOREIGN KEY ("predicted_by_user") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_acted_on_by_fkey" FOREIGN KEY ("acted_on_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule_executions" ADD CONSTRAINT "automation_rule_executions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule_executions" ADD CONSTRAINT "automation_rule_executions_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule_executions" ADD CONSTRAINT "automation_rule_executions_triggered_by_issue_id_fkey" FOREIGN KEY ("triggered_by_issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_rule_runs" ADD CONSTRAINT "scheduled_rule_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transition_conditions" ADD CONSTRAINT "workflow_transition_conditions_transition_id_fkey" FOREIGN KEY ("transition_id") REFERENCES "status_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transition_validators" ADD CONSTRAINT "workflow_transition_validators_transition_id_fkey" FOREIGN KEY ("transition_id") REFERENCES "status_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transition_postfunctions" ADD CONSTRAINT "workflow_transition_postfunctions_transition_id_fkey" FOREIGN KEY ("transition_id") REFERENCES "status_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transition_approvals" ADD CONSTRAINT "workflow_transition_approvals_transition_id_fkey" FOREIGN KEY ("transition_id") REFERENCES "status_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_transition_approvals" ADD CONSTRAINT "issue_transition_approvals_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_transition_approvals" ADD CONSTRAINT "issue_transition_approvals_transition_id_fkey" FOREIGN KEY ("transition_id") REFERENCES "status_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_transition_approvals" ADD CONSTRAINT "issue_transition_approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_transition_approval_responses" ADD CONSTRAINT "issue_transition_approval_responses_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "issue_transition_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_transition_approval_responses" ADD CONSTRAINT "issue_transition_approval_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_workspaces" ADD CONSTRAINT "slack_workspaces_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_workspaces" ADD CONSTRAINT "slack_workspaces_installed_by_fkey" FOREIGN KEY ("installed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_channel_configs" ADD CONSTRAINT "slack_channel_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_user_mappings" ADD CONSTRAINT "slack_user_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_user_mappings" ADD CONSTRAINT "slack_user_mappings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "slack_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_installed_by_fkey" FOREIGN KEY ("installed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_transition_status_id_fkey" FOREIGN KEY ("transition_status_id") REFERENCES "statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_commits" ADD CONSTRAINT "github_commits_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_commits" ADD CONSTRAINT "github_commits_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_branches" ADD CONSTRAINT "github_branches_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_branches" ADD CONSTRAINT "github_branches_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "github_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_mappings" ADD CONSTRAINT "calendar_event_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_mappings" ADD CONSTRAINT "calendar_event_mappings_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_mappings" ADD CONSTRAINT "calendar_event_mappings_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_date_reminders" ADD CONSTRAINT "due_date_reminders_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "due_date_reminders" ADD CONSTRAINT "due_date_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
