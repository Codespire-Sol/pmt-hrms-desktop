-- Migration: add_saml_financial_tables
-- Creates: saml_configs, project_budgets, resource_rates, budget_alerts

-- ─── SAML CONFIG ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "saml_configs" (
  "id"                    UUID          NOT NULL DEFAULT uuid_generate_v4(),
  "label"                 VARCHAR(200)  NOT NULL,
  "entry_point"           VARCHAR(1000) NOT NULL,
  "issuer"                VARCHAR(500)  NOT NULL,
  "idp_cert"              TEXT          NOT NULL,
  "callback_url"          VARCHAR(1000) NOT NULL,
  "attribute_mapping"     JSONB         NOT NULL DEFAULT '{}',
  "enforce_domain"        VARCHAR(255),
  "is_enabled"            BOOLEAN       NOT NULL DEFAULT false,
  "allow_jit_provisioning" BOOLEAN      NOT NULL DEFAULT true,
  "created_at"            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "saml_configs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "saml_configs_is_enabled_idx"    ON "saml_configs" ("is_enabled");
CREATE INDEX IF NOT EXISTS "saml_configs_enforce_domain_idx" ON "saml_configs" ("enforce_domain");

-- ─── PROJECT BUDGETS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "project_budgets" (
  "id"                UUID           NOT NULL DEFAULT uuid_generate_v4(),
  "project_id"        UUID           NOT NULL,
  "total_budget"      DECIMAL(12, 2) NOT NULL,
  "currency"          VARCHAR(10)    NOT NULL DEFAULT 'USD',
  "alert_threshold"   DECIMAL(3, 2)  NOT NULL DEFAULT 0.80,
  "warning_threshold" DECIMAL(3, 2)  NOT NULL DEFAULT 0.90,
  "notes"             TEXT,
  "created_at"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT "project_budgets_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "project_budgets_project_id_key" UNIQUE ("project_id"),
  CONSTRAINT "project_budgets_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
);

-- ─── RESOURCE RATES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "resource_rates" (
  "id"             UUID           NOT NULL DEFAULT uuid_generate_v4(),
  "project_id"     UUID           NOT NULL,
  "user_id"        UUID,
  "role"           VARCHAR(100)   NOT NULL,
  "hourly_rate"    DECIMAL(10, 2) NOT NULL,
  "currency"       VARCHAR(10)    NOT NULL DEFAULT 'USD',
  "effective_from" DATE           NOT NULL DEFAULT NOW(),
  "effective_to"   DATE,
  "created_at"     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT "resource_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resource_rates_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
  CONSTRAINT "resource_rates_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "resource_rates_project_id_idx" ON "resource_rates" ("project_id");
CREATE INDEX IF NOT EXISTS "resource_rates_user_id_idx"    ON "resource_rates" ("user_id");

-- ─── BUDGET ALERTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "budget_alerts" (
  "id"               UUID           NOT NULL DEFAULT uuid_generate_v4(),
  "project_id"       UUID           NOT NULL,
  "alert_type"       VARCHAR(50)    NOT NULL,
  "threshold_percent" DECIMAL(5, 2) NOT NULL,
  "current_spend"    DECIMAL(12, 2) NOT NULL,
  "total_budget"     DECIMAL(12, 2) NOT NULL,
  "triggered_at"     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "is_read"          BOOLEAN        NOT NULL DEFAULT false,
  "metadata"         JSONB          NOT NULL DEFAULT '{}',

  CONSTRAINT "budget_alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "budget_alerts_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "budget_alerts_project_id_idx" ON "budget_alerts" ("project_id");
CREATE INDEX IF NOT EXISTS "budget_alerts_is_read_idx"    ON "budget_alerts" ("is_read");
