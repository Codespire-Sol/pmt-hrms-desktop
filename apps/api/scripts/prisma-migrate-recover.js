#!/usr/bin/env node
require("dotenv").config();

const { Client } = require("pg");
const { spawnSync } = require("child_process");

function parseArgs(argv) {
  const options = {
    mode: "rolled-back",
    migration: null,
    applyAll: false,
    skipDeploy: false,
    config: "prisma/prisma.config.ts",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--mode") {
      options.mode = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--migration") {
      options.migration = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--all") {
      options.applyAll = true;
      continue;
    }

    if (arg === "--skip-deploy") {
      options.skipDeploy = true;
      continue;
    }

    if (arg === "--config") {
      options.config = argv[i + 1];
      i += 1;
      continue;
    }
  }

  if (!["rolled-back", "applied"].includes(options.mode)) {
    throw new Error("Invalid --mode. Use 'rolled-back' or 'applied'.");
  }

  return options;
}

function runPrisma(args) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

async function getMigrationState(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Check if _prisma_migrations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
      ) AS exists
    `);
    const hasMigrationsTable = tableCheck.rows[0].exists;

    if (!hasMigrationsTable) {
      return { needsBaseline: true, failed: [] };
    }

    // Check for failed migrations
    const result = await client.query(`
      SELECT migration_name, started_at, logs
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
      ORDER BY started_at ASC
    `);
    return { needsBaseline: false, failed: result.rows };
  } finally {
    await client.end();
  }
}

// All migration names in order — used for baselining an existing DB (P3005)
const ALL_MIGRATIONS = [
  "20260202091006",
  "20260212150000_add_hrms_schema",
  "20260218114800_add_epics_and_pages",
  "20260218140000_gap_closure_foundations",
  "20260218174000_timesheet_indexes",
  "20260219120000_global_roles_and_app_permissions",
  "20260219180000_workflow_project_role_condition",
  "20260219190000_seed_link_types",
  "20260219200000_add_in_review_category",
  "20260219220000_make_workflow_projectid_nullable_transition_name_nullable",
  "20260220000000_add_gitlab_integration",
  "20260220110000_add_saml_financial_tables",
  "20260220120000_add_version_release_fields",
  "20260223000000_add_gender_and_onboarding_otp",
  "20260224000000_add_task_templates",
  "20260224100000_add_phase_assignee_to_tasks",
  "20260224110000_add_missing_tables",
  "20260225100000_add_half_day_attendance_status",
  "20260225200000_add_leave_session",
  "20260225300000_add_attendance_logs",
  "20260226100000_add_location_to_attendance_logs",
  "20260226200000_flexible_status_categories",
  "20260227100000_add_app_to_roles",
  "20260227110000_add_branch_id_to_employees",
  "20260227120000_add_branch_id_to_holidays",
  "20260306100000_github_pat_based_integration",
  "20260309100000_add_keycloak_sub_to_users",
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const { needsBaseline, failed } = await getMigrationState(dbUrl);

  // P3005: DB schema exists but no _prisma_migrations table — baseline via direct SQL (fast)
  if (needsBaseline) {
    console.log("No _prisma_migrations table found (P3005). Baselining all migrations via SQL...");
    const baselineClient = new Client({ connectionString: dbUrl });
    await baselineClient.connect();
    try {
      // Create _prisma_migrations table (Prisma format)
      await baselineClient.query(`
        CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
          id VARCHAR(36) NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          finished_at TIMESTAMPTZ,
          migration_name VARCHAR(255) NOT NULL,
          logs TEXT,
          rolled_back_at TIMESTAMPTZ,
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          applied_steps_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (id)
        )
      `);
      // Insert all migrations as already applied in one query
      const now = new Date().toISOString();
      for (const migrationName of ALL_MIGRATIONS) {
        await baselineClient.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
           VALUES (gen_random_uuid()::text, 'baselined', $1, $2, 'Baselined by prisma-migrate-recover.js', $1, 1)
           ON CONFLICT DO NOTHING`,
          [now, migrationName]
        );
      }
      console.log(`Baselined ${ALL_MIGRATIONS.length} migrations. Running deploy for any new ones...`);
    } finally {
      await baselineClient.end();
    }
    runPrisma(["prisma", "migrate", "deploy", "--config", options.config]);
    return;
  }

  if (failed.length === 0) {
    console.log("No failed migrations found.");
    if (!options.skipDeploy) {
      console.log("Running prisma migrate deploy...");
      runPrisma(["prisma", "migrate", "deploy", "--config", options.config]);
    }
    return;
  }

  console.log("Failed migrations found:");
  failed.forEach((m) => {
    console.log(`- ${m.migration_name} (started_at: ${m.started_at?.toISOString?.() || m.started_at})`);
    if (m.logs) {
      const preview = String(m.logs).split("\n").slice(0, 3).join(" | ");
      console.log(`  logs: ${preview}`);
    }
  });

  let targets = failed.map((m) => m.migration_name);

  if (options.migration) {
    const exists = targets.includes(options.migration);
    if (!exists) {
      throw new Error(
        `Migration '${options.migration}' is not currently failed in _prisma_migrations.`
      );
    }
    targets = [options.migration];
  } else if (!options.applyAll) {
    targets = [targets[0]];
  }

  console.log(
    `Resolving ${targets.length} migration(s) as '${options.mode}': ${targets.join(", ")}`
  );

  for (const migrationName of targets) {
    runPrisma([
      "prisma",
      "migrate",
      "resolve",
      `--${options.mode}`,
      migrationName,
      "--config",
      options.config,
    ]);
  }

  if (!options.skipDeploy) {
    console.log("Running prisma migrate deploy...");
    runPrisma(["prisma", "migrate", "deploy", "--config", options.config]);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
