import { prisma } from '../database/prisma';
import { logger } from '../utils/logger';

/**
 * Ensures all required columns and tables exist in the database.
 * Runs on every server startup using Prisma's own connection —
 * no external CLI, no migration state dependency, no npx required.
 *
 * All statements use IF NOT EXISTS so they are completely safe
 * to re-execute on an already-healthy database (pure no-ops).
 */
export async function ensureDatabaseSchema(): Promise<void> {
  logger.info('🔍 Checking database schema integrity...');

  const fixes: Array<{ name: string; sql: string }> = [
    // ── employees ──────────────────────────────────────────────────────
    {
      name: 'employees.work_mode',
      sql: `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "work_mode" VARCHAR(50) DEFAULT 'office'`,
    },
    {
      name: 'employees.country',
      sql: `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "country" VARCHAR(100)`,
    },
    {
      name: 'employees.biometric_device_id',
      sql: `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "biometric_device_id" VARCHAR(100)`,
    },

    // ── attendance_logs ────────────────────────────────────────────────
    {
      name: 'attendance_logs.source',
      sql: `ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50)`,
    },
    {
      name: 'attendance_logs.device_user_id',
      sql: `ALTER TABLE "attendance_logs" ADD COLUMN IF NOT EXISTS "device_user_id" VARCHAR(100)`,
    },

    // ── employee_documents ─────────────────────────────────────────────
    {
      name: 'employee_documents.status',
      sql: `ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'pending'`,
    },
    {
      name: 'employee_documents.review_note',
      sql: `ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "review_note" TEXT`,
    },
    {
      name: 'employee_documents.reviewed_by',
      sql: `ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "reviewed_by" UUID`,
    },
    {
      name: 'employee_documents.reviewed_at',
      sql: `ALTER TABLE "employee_documents" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3)`,
    },

    // ── leaves ─────────────────────────────────────────────────────────
    {
      name: 'leaves.is_auto_lop',
      sql: `ALTER TABLE "leaves" ADD COLUMN IF NOT EXISTS "is_auto_lop" BOOLEAN NOT NULL DEFAULT false`,
    },

    // ── workflows + statuses (required by dashboard/projects/boards queries) ──
    {
      name: 'workflows table',
      sql: `
        CREATE TABLE IF NOT EXISTS "workflows" (
          "id"          UUID          NOT NULL DEFAULT uuid_generate_v4(),
          "project_id"  UUID,
          "name"        VARCHAR(100)  NOT NULL,
          "description" TEXT,
          "is_default"  BOOLEAN       NOT NULL DEFAULT false,
          "is_active"   BOOLEAN       NOT NULL DEFAULT true,
          "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
        )
      `,
    },
    {
      name: 'statuses table',
      sql: `
        CREATE TABLE IF NOT EXISTS "statuses" (
          "id"           UUID          NOT NULL DEFAULT uuid_generate_v4(),
          "workflow_id"  UUID          NOT NULL,
          "name"         VARCHAR(50)   NOT NULL,
          "display_name" VARCHAR(100)  NOT NULL,
          "description"  TEXT,
          "color"        VARCHAR(7),
          "category"     VARCHAR(50)   NOT NULL DEFAULT 'todo',
          "position"     INT           NOT NULL DEFAULT 0,
          "is_initial"   BOOLEAN       NOT NULL DEFAULT false,
          "is_final"     BOOLEAN       NOT NULL DEFAULT false,
          "wip_limit"    INT,
          "created_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "statuses_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "statuses_workflow_id_fkey" FOREIGN KEY ("workflow_id")
            REFERENCES "workflows"("id") ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'statuses workflow_id index',
      sql: `CREATE INDEX IF NOT EXISTS "statuses_workflow_id_idx" ON "statuses"("workflow_id")`,
    },
    {
      name: 'statuses unique workflow_id+name',
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'statuses_workflow_id_name_key'
          ) THEN
            ALTER TABLE "statuses" ADD CONSTRAINT "statuses_workflow_id_name_key" UNIQUE ("workflow_id", "name");
          END IF;
        END $$
      `,
    },

    // ── email_schedule_configs (full table) ────────────────────────────
    {
      name: 'email_schedule_configs table',
      sql: `
        CREATE TABLE IF NOT EXISTS "email_schedule_configs" (
          "id"            UUID         NOT NULL DEFAULT uuid_generate_v4(),
          "schedule_type" VARCHAR(50)  NOT NULL,
          "enabled"       BOOLEAN      NOT NULL DEFAULT true,
          "recipients"    TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
          "last_sent_at"  TIMESTAMP(3),
          "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "email_schedule_configs_pkey" PRIMARY KEY ("id")
        )
      `,
    },

    // ── indexes & constraints ──────────────────────────────────────────
    {
      name: 'email_schedule_configs_schedule_type_key index',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS "email_schedule_configs_schedule_type_key" ON "email_schedule_configs"("schedule_type")`,
    },
    {
      name: 'leaves_employee_auto_lop_unique partial index',
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS "leaves_employee_auto_lop_unique" ON "leaves" (employee_id, from_date) WHERE is_auto_lop = true`,
    },
    {
      name: 'attendance_logs unique constraint',
      sql: `
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'attendance_logs_employee_logged_at_type_source_key'
          ) THEN
            ALTER TABLE "attendance_logs"
              ADD CONSTRAINT "attendance_logs_employee_logged_at_type_source_key"
              UNIQUE (employee_id, logged_at, type, source);
          END IF;
        END $$
      `,
    },
  ];

  let applied = 0;
  let alreadyOk = 0;

  for (const fix of fixes) {
    try {
      await prisma.$executeRawUnsafe(fix.sql.trim());
      applied++;
      logger.info(`  ✔ applied: ${fix.name}`);
    } catch (err: any) {
      // PostgreSQL error codes for "already exists" — these are safe to ignore
      const alreadyExists =
        err?.code === '42701' || // duplicate_column
        err?.code === '42710' || // duplicate_object
        err?.code === '42P07' || // duplicate_table
        err?.message?.includes('already exists');

      if (alreadyExists) {
        alreadyOk++;
      } else {
        logger.warn(`  ⚠ failed [${fix.name}]: ${err?.message}`);
      }
    }
  }

  logger.info(
    `✅ Schema check complete — ${applied} fix(es) applied, ${alreadyOk} already up to date`
  );

  await ensureDefaultPriorities();
  await ensureDefaultIssueTypesForAllProjects();
}

// ── Default issue priorities (global, no projectId) ──────────────────────────
async function ensureDefaultPriorities(): Promise<void> {
  const defaultPriorities = [
    { name: 'critical', displayName: 'Critical', icon: 'AlertOctagon', color: '#FF0000', level: 1 },
    { name: 'high',     displayName: 'High',     icon: 'ArrowUp',      color: '#FF5630', level: 2 },
    { name: 'medium',   displayName: 'Medium',   icon: 'ArrowRight',   color: '#FFAB00', level: 3 },
    { name: 'low',      displayName: 'Low',       icon: 'ArrowDown',    color: '#36B37E', level: 4 },
    { name: 'none',     displayName: 'None',      icon: 'Minus',        color: '#97A0AF', level: 5 },
  ];

  let added = 0;
  for (const p of defaultPriorities) {
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "issue_priorities" (id, name, display_name, icon, color, level, created_at)
        VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, NOW())
        ON CONFLICT (name) DO NOTHING
      `, p.name, p.displayName, p.icon, p.color, p.level);
      added++;
    } catch (err: any) {
      logger.warn(`  ⚠ priority seed [${p.name}]: ${err?.message}`);
    }
  }
  logger.info(`  ✔ priorities: ${added} checked (upserted if missing)`);
}

// ── Default issue types per project ──────────────────────────────────────────
async function ensureDefaultIssueTypesForAllProjects(): Promise<void> {
  const defaultTypes = [
    { name: 'epic',        displayName: 'Epic',        icon: 'Layers',       color: '#6554C0', isSubtask: false, position: 0 },
    { name: 'task',        displayName: 'Task',        icon: 'CheckCircle2', color: '#0052CC', isSubtask: false, position: 1 },
    { name: 'bug',         displayName: 'Bug',         icon: 'Bug',          color: '#DE350B', isSubtask: false, position: 2 },
    { name: 'story',       displayName: 'Story',       icon: 'Tag',          color: '#36B37E', isSubtask: false, position: 3 },
    { name: 'improvement', displayName: 'Improvement', icon: 'Zap',          color: '#FF8B00', isSubtask: false, position: 4 },
    { name: 'subtask',     displayName: 'Subtask',     icon: 'CheckCircle2', color: '#6554C0', isSubtask: true,  position: 5 },
  ];

  // Get all active projects
  const projects = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM projects WHERE deleted_at IS NULL`
  );

  let totalAdded = 0;
  for (const project of projects) {
    for (const type of defaultTypes) {
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "issue_types" (id, project_id, name, display_name, icon, color, is_subtask, position, created_at)
          VALUES (uuid_generate_v4(), $1::uuid, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (project_id, name) DO NOTHING
        `, project.id, type.name, type.displayName, type.icon, type.color, type.isSubtask, type.position);
        totalAdded++;
      } catch (err: any) {
        logger.warn(`  ⚠ issue type seed [${project.id}/${type.name}]: ${err?.message}`);
      }
    }
  }
  logger.info(`  ✔ issue types: checked ${projects.length} project(s), ${totalAdded} upserted`);
}
