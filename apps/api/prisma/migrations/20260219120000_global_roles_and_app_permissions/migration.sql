-- ============================================================
-- Migration: Global Roles & Per-App Permission Tagging
-- ============================================================
-- 1. Add `app` column to permissions (hrms | pmt | global)
-- 2. Tag all existing permissions with the correct app
-- 3. Insert 4 new global job-title roles
-- 4. Insert PMT system permissions
-- 5. Wire up role ↔ permission mappings for all roles
-- ============================================================

-- ─── 1. Add app column ──────────────────────────────────────
ALTER TABLE permissions
  ADD COLUMN IF NOT EXISTS app VARCHAR(20) NOT NULL DEFAULT 'pmt';

CREATE INDEX IF NOT EXISTS "permissions_app_idx" ON permissions(app);

-- ─── 2. Tag existing HRMS permissions ───────────────────────
-- Permissions that are cross-cutting between both apps → 'global'
UPDATE permissions
SET app = 'global'
WHERE name IN (
  'admin.settings',
  'admin.audit',
  'users.read',
  'users.manage_roles',
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  'reports.view'
);

-- All other existing permissions belong to HRMS
UPDATE permissions
SET app = 'hrms'
WHERE app = 'pmt'
  AND name NOT IN (
    'admin.settings',
    'admin.audit',
    'users.read',
    'users.manage_roles',
    'roles.read',
    'roles.create',
    'roles.update',
    'roles.delete',
    'reports.view'
  );

-- ─── 3. Insert 4 new global job-title roles ─────────────────
INSERT INTO roles (id, name, display_name, description, is_system, level, created_at, updated_at)
VALUES
  (uuid_generate_v4(), 'product_manager',     'Product Manager',      'Product managers who drive product roadmap and project delivery',  TRUE, 50, NOW(), NOW()),
  (uuid_generate_v4(), 'fullstack_developer',  'Full Stack Developer',  'Full-stack engineers who build and maintain software products',    TRUE, 30, NOW(), NOW()),
  (uuid_generate_v4(), 'qa_tester',            'QA Tester',            'Quality assurance testers who validate software quality',          TRUE, 30, NOW(), NOW()),
  (uuid_generate_v4(), 'devops_engineer',      'DevOps Engineer',      'DevOps engineers who manage infrastructure and deployments',       TRUE, 30, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ─── 4. Insert PMT system permissions ───────────────────────
INSERT INTO permissions (id, name, display_name, description, resource, action, app)
VALUES
  (uuid_generate_v4(), 'projects.create',       'Projects Create',            'Create new projects',                                   'projects',      'create',            'pmt'),
  (uuid_generate_v4(), 'projects.view_all',     'Projects View All',          'View all projects regardless of membership',            'projects',      'view_all',          'pmt'),
  (uuid_generate_v4(), 'projects.manage_all',   'Projects Manage All',        'Manage all projects (admin-level)',                     'projects',      'manage_all',        'pmt'),
  (uuid_generate_v4(), 'issues.view_all',       'Issues View All',            'View all issues across all projects',                   'issues',        'view_all',          'pmt'),
  (uuid_generate_v4(), 'issues.manage_all',     'Issues Manage All',          'Full issue management across all projects',             'issues',        'manage_all',        'pmt'),
  (uuid_generate_v4(), 'members.invite',        'Members Invite',             'Invite users to any project',                           'members',       'invite',            'pmt'),
  (uuid_generate_v4(), 'ai.use',                'AI Use',                     'Use AI-powered features',                               'ai',            'use',               'pmt'),
  (uuid_generate_v4(), 'integrations.manage',   'Integrations Manage',        'Manage Slack, GitHub and Calendar integrations',        'integrations',  'manage',            'pmt')
ON CONFLICT (resource, action) DO NOTHING;

-- ─── 5. Role ↔ Permission mappings ──────────────────────────
-- Helper: assign a list of permission names to a role by name
-- We use a DO block so this is idempotent.

DO $$
DECLARE
  v_role_id      UUID;
  v_perm_id      UUID;
  v_perm_name    TEXT;

  -- admin: all permissions
  admin_pmt_perms TEXT[] := ARRAY[
    'admin.settings','admin.audit','users.read','users.manage_roles',
    'roles.read','roles.create','roles.update','roles.delete','reports.view',
    'projects.create','projects.view_all','projects.manage_all',
    'issues.view_all','issues.manage_all','members.invite','ai.use','integrations.manage'
  ];

  -- product_manager PMT permissions
  pm_pmt_perms TEXT[] := ARRAY[
    'projects.create','projects.view_all','issues.view_all',
    'members.invite','ai.use','reports.view'
  ];

  -- product_manager HRMS permissions (read-only access to org + employees)
  pm_hrms_perms TEXT[] := ARRAY[
    'org.read','employees.read_all','reports.view'
  ];

  -- fullstack_developer PMT permissions
  fsd_pmt_perms TEXT[] := ARRAY[
    'projects.view_all','ai.use'
  ];

  -- fullstack_developer HRMS permissions
  fsd_hrms_perms TEXT[] := ARRAY[
    'org.read'
  ];

  -- qa_tester PMT permissions
  qa_pmt_perms TEXT[] := ARRAY[
    'projects.view_all','issues.view_all','ai.use'
  ];

  -- qa_tester HRMS permissions
  qa_hrms_perms TEXT[] := ARRAY[
    'org.read'
  ];

  -- devops_engineer PMT permissions
  devops_pmt_perms TEXT[] := ARRAY[
    'projects.view_all','integrations.manage','ai.use'
  ];

  -- devops_engineer HRMS permissions
  devops_hrms_perms TEXT[] := ARRAY[
    'org.read'
  ];

  -- hr PMT permissions (can see all projects for resource planning)
  hr_pmt_perms TEXT[] := ARRAY[
    'projects.view_all','reports.view'
  ];

  -- manager PMT permissions
  manager_pmt_perms TEXT[] := ARRAY[
    'projects.view_all'
  ];

BEGIN
  -- ── admin: add all PMT+global perms ──
  SELECT id INTO v_role_id FROM roles WHERE name = 'admin';
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_name IN ARRAY admin_pmt_perms LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE name = v_perm_name;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (id, role_id, permission_id, created_at)
        VALUES (uuid_generate_v4(), v_role_id, v_perm_id, NOW())
        ON CONFLICT (role_id, permission_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- ── hrms_admin: add all PMT+global perms ──
  SELECT id INTO v_role_id FROM roles WHERE name = 'hrms_admin';
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_name IN ARRAY admin_pmt_perms LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE name = v_perm_name;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (id, role_id, permission_id, created_at)
        VALUES (uuid_generate_v4(), v_role_id, v_perm_id, NOW())
        ON CONFLICT (role_id, permission_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- ── product_manager ──
  SELECT id INTO v_role_id FROM roles WHERE name = 'product_manager';
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_name IN ARRAY (pm_pmt_perms || pm_hrms_perms) LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE name = v_perm_name;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (id, role_id, permission_id, created_at)
        VALUES (uuid_generate_v4(), v_role_id, v_perm_id, NOW())
        ON CONFLICT (role_id, permission_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- ── fullstack_developer ──
  SELECT id INTO v_role_id FROM roles WHERE name = 'fullstack_developer';
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_name IN ARRAY (fsd_pmt_perms || fsd_hrms_perms) LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE name = v_perm_name;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (id, role_id, permission_id, created_at)
        VALUES (uuid_generate_v4(), v_role_id, v_perm_id, NOW())
        ON CONFLICT (role_id, permission_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- ── qa_tester ──
  SELECT id INTO v_role_id FROM roles WHERE name = 'qa_tester';
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_name IN ARRAY (qa_pmt_perms || qa_hrms_perms) LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE name = v_perm_name;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (id, role_id, permission_id, created_at)
        VALUES (uuid_generate_v4(), v_role_id, v_perm_id, NOW())
        ON CONFLICT (role_id, permission_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- ── devops_engineer ──
  SELECT id INTO v_role_id FROM roles WHERE name = 'devops_engineer';
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_name IN ARRAY (devops_pmt_perms || devops_hrms_perms) LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE name = v_perm_name;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (id, role_id, permission_id, created_at)
        VALUES (uuid_generate_v4(), v_role_id, v_perm_id, NOW())
        ON CONFLICT (role_id, permission_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- ── hr: add PMT perms ──
  SELECT id INTO v_role_id FROM roles WHERE name = 'hr';
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_name IN ARRAY hr_pmt_perms LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE name = v_perm_name;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (id, role_id, permission_id, created_at)
        VALUES (uuid_generate_v4(), v_role_id, v_perm_id, NOW())
        ON CONFLICT (role_id, permission_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- ── manager: add PMT perms ──
  SELECT id INTO v_role_id FROM roles WHERE name = 'manager';
  IF v_role_id IS NOT NULL THEN
    FOREACH v_perm_name IN ARRAY manager_pmt_perms LOOP
      SELECT id INTO v_perm_id FROM permissions WHERE name = v_perm_name;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO role_permissions (id, role_id, permission_id, created_at)
        VALUES (uuid_generate_v4(), v_role_id, v_perm_id, NOW())
        ON CONFLICT (role_id, permission_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

END $$;
