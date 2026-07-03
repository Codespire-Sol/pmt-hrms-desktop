import { Request, Response, NextFunction } from 'express';
import { verifyKeycloakToken, KeycloakTokenPayload } from '../utils/keycloak';
import { cacheService } from '../services/cache.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../database/prisma';
import { config } from '../config';
import { JwtUtils } from '../utils/jwt';

/**
 * Authenticated request interface with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roleId: string;
    branchId?: string | null;
    roleName?: string | null;
  };
}

const TOKEN_BLACKLIST_PREFIX = 'token:bl';

const KNOWN_APP_ROLES = ['admin', 'hr', 'manager', 'employee'] as const;

/**
 * Resolve the app role from a Keycloak token.
 *
 * Strategy:
 *  1. Read roles from the `azp` (authorized party) client in resource_access.
 *     - HRMS users log in via "hr-management-system" → roles: admin | hr | manager | employee
 *     - PMT users log in via "project-management-tool" → roles: admin | employee
 *     Using azp ensures we never mix up roles across clients (e.g. PMT "admin" leaking into HRMS).
 *  2. Fall back to realm_access roles (realm-level assignments).
 *  3. Return null if no known role found (DB fallback handled by caller).
 */
function resolveRoleFromToken(payload: KeycloakTokenPayload): string | null {
  const azpRoles = payload.resource_access?.[payload.azp ?? '']?.roles ?? [];
  const realmRoles = payload.realm_access?.roles ?? [];
  return (
    azpRoles.find(r => (KNOWN_APP_ROLES as readonly string[]).includes(r)) ??
    realmRoles.find(r => (KNOWN_APP_ROLES as readonly string[]).includes(r)) ??
    null
  );
}

/**
 * Look up a local user row by Keycloak sub, resolve branch context,
 * and attach req.user. Auto-provisions a new user row if none is found.
 */
async function resolveUser(payload: KeycloakTokenPayload): Promise<{
  id: string;
  email: string;
  is_active: boolean;
  status: string | null;
  branch_id: string | null;
  role_name: string | null;
} | null> {
  // 1. Primary lookup: match by keycloak_sub
  let rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    email: string;
    status: string | null;
    is_active: boolean;
    branch_id: string | null;
    role_name: string | null;
  }>>(
    `SELECT u.id::text as id, u.email, e.status::text as status, u.is_active, e.branch_id, r.name as role_name
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.keycloak_sub = $1
     LIMIT 1`,
    payload.sub
  );

  if (!rows[0] && payload.email) {
    // 2. Fallback: match by email (JIT sub-linking for users imported into Keycloak before migration)
    rows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      email: string;
      status: string | null;
      is_active: boolean;
      branch_id: string | null;
      role_name: string | null;
    }>>(
      `SELECT u.id::text as id, u.email, e.status::text as status, u.is_active, e.branch_id, r.name as role_name
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1
       LIMIT 1`,
      payload.email.toLowerCase()
    );

    if (rows[0]) {
      // Link keycloak_sub to this user on first Keycloak login
      await prisma.$queryRawUnsafe(
        `UPDATE users SET keycloak_sub = $1 WHERE id = $2::uuid`,
        payload.sub,
        rows[0].id
      );
    }
  }

  // 3. Auto-provisioning: create user if not found but has a valid Keycloak token
  if (!rows[0] && payload.email && payload.sub) {
    const firstName = payload.given_name ?? payload.email.split('@')[0];
    const lastName = payload.family_name ?? '';
    const newRows = await prisma.$queryRawUnsafe<Array<{
      id: string;
      email: string;
      is_active: boolean;
    }>>(
      `INSERT INTO users (id, email, first_name, last_name, keycloak_sub, is_active, is_verified, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, true, true, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET keycloak_sub = EXCLUDED.keycloak_sub, is_active = true, is_verified = true, updated_at = NOW()
       RETURNING id::text as id, email, is_active`,
      payload.email.toLowerCase(),
      firstName,
      lastName,
      payload.sub
    );
    if (newRows[0]) {
      rows = newRows.map((r) => ({ ...r, status: null, branch_id: null, role_name: null }));

      // Resolve role from the Keycloak token so we can skip admin/hr provisioning.
      const tokenRole = resolveRoleFromToken(payload);

      // Only auto-create employees row for employee/manager roles.
      // Admin and HR are not managed as employees in this system.
      if (tokenRole === 'employee' || tokenRole === 'manager') {
      // Auto-create an employees row so the user appears in the HR onboarding list.
      // If only one branch exists, auto-assign it so HR can see them immediately.
      const userId = newRows[0].id;
      try {
        // Auto-detect single branch for default assignment
        let defaultBranchId: string | null = null;
        try {
          const branchesRow = await prisma.$queryRawUnsafe<Array<{ setting_value: unknown }>>(
            `SELECT setting_value FROM system_settings WHERE setting_key = 'org.branches' LIMIT 1`
          );
          const branchList = branchesRow[0]?.setting_value as Array<{ id: string }> | null;
          if (Array.isArray(branchList) && branchList.length === 1) {
            defaultBranchId = branchList[0].id;
          }
        } catch { /* non-fatal */ }

        // Generate next employee ID (CSS001 style)
        const latestId = await prisma.$queryRawUnsafe<Array<{ employee_id: string }>>(
          `SELECT employee_id FROM employees WHERE employee_id ~ '^CSS[0-9]+$'
           ORDER BY CAST(SUBSTRING(employee_id FROM 4) AS INTEGER) DESC LIMIT 1`
        );
        const nextNum = latestId[0]?.employee_id ? parseInt(latestId[0].employee_id.slice(3), 10) + 1 : 1;
        const newEmployeeId = `CSS${String(nextNum).padStart(3, '0')}`;

        const empRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `INSERT INTO employees
             (user_id, employee_id, first_name, last_name, email, joining_date, designation, department, status, branch_id, created_at, updated_at)
           VALUES
             ($1::uuid, $2, $3, $4, $5, CURRENT_DATE, 'Unassigned', 'Unassigned', 'onboarding'::employee_status, $6, NOW(), NOW())
           ON CONFLICT (user_id) DO NOTHING
           RETURNING id`,
          userId, newEmployeeId, firstName, lastName || '', payload.email.toLowerCase(), defaultBranchId
        );

        // Create onboarding record if employee was inserted
        if (empRows[0]) {
          const empId = empRows[0].id;
          // Load templates, fall back to empty (tasks can be added later)
          const templates = await prisma.$queryRawUnsafe<Array<{ task_name: string; phase: string | null; assignee: string | null; task_order: number }>>(
            `SELECT task_name, phase, assignee, task_order FROM onboarding_task_templates WHERE is_active = true ORDER BY task_order ASC`
          );
          const tasks = templates.length > 0 ? templates : [
            { task_name: 'Personal Documents Collected', phase: null, assignee: null, task_order: 1 },
            { task_name: 'Laptop/Equipment Assigned',   phase: null, assignee: null, task_order: 2 },
            { task_name: 'Email Account Created',        phase: null, assignee: null, task_order: 3 },
            { task_name: 'System Access Granted',        phase: null, assignee: null, task_order: 4 },
            { task_name: 'Team Introduction Completed',  phase: null, assignee: null, task_order: 5 },
            { task_name: 'Office Orientation Done',      phase: null, assignee: null, task_order: 6 },
          ];

          const onbRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
            `INSERT INTO onboarding (employee_id, target_completion_date, progress, status)
             VALUES ($1::uuid, CURRENT_DATE + INTERVAL '30 days', $2, 'in_progress')
             ON CONFLICT (employee_id) DO NOTHING
             RETURNING id`,
            empId, `0/${tasks.length}`
          );
          if (onbRows[0]) {
            for (const t of tasks) {
              await prisma.$executeRawUnsafe(
                `INSERT INTO onboarding_tasks (onboarding_id, task_name, phase, assignee, task_order, status)
                 VALUES ($1::uuid, $2, $3, $4, $5, 'pending')`,
                onbRows[0].id, t.task_name, t.phase ?? null, t.assignee ?? null, t.task_order
              );
            }
          }

          // Update rows with the new employee status so downstream middleware sees it
          rows = [{ ...newRows[0], status: 'onboarding', branch_id: defaultBranchId, role_name: null }];
        }
      } catch {
        // Non-fatal: employee row creation failed (e.g. duplicate email in employees).
        // User can still authenticate; admin can sort out their employee record manually.
      }
      } // end if (tokenRole === 'employee' || tokenRole === 'manager')
    }
  }

  return rows[0] ?? null;
}

/**
 * Look up a local user row by its own id (used in AUTH_MODE=jwt where the token
 * subject is the local users.id, not a Keycloak sub). Returns the same shape as
 * resolveUser so the rest of the middleware is identical across auth modes.
 */
async function resolveUserByLocalId(userId: string): Promise<{
  id: string;
  email: string;
  is_active: boolean;
  status: string | null;
  branch_id: string | null;
  role_name: string | null;
} | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    email: string;
    status: string | null;
    is_active: boolean;
    branch_id: string | null;
    role_name: string | null;
  }>>(
    `SELECT u.id::text as id, u.email, e.status::text as status, u.is_active, e.branch_id, r.name as role_name
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1::uuid AND u.deleted_at IS NULL
     LIMIT 1`,
    userId
  );
  return rows[0] ?? null;
}

/**
 * Attach req.user for AUTH_MODE=jwt: verify a locally-issued JWT, honour the
 * Redis blacklist, then load the user by local id.
 */
async function authenticateJwt(req: AuthenticatedRequest, token: string): Promise<void> {
  let payload;
  try {
    payload = JwtUtils.verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token', 'INVALID_TOKEN');
  }

  if (await JwtUtils.isTokenRevoked(payload)) {
    throw ApiError.unauthorized('Token has been revoked', 'TOKEN_REVOKED');
  }

  const userRow = await resolveUserByLocalId(payload.userId);
  if (!userRow) {
    throw ApiError.unauthorized('User account not found', 'USER_NOT_FOUND');
  }

  const blockedStatuses = ['exited', 'terminated'];
  if (userRow.status && blockedStatuses.includes(userRow.status)) {
    throw ApiError.unauthorized(
      'Access denied. Your employment status does not allow system access',
      'EMPLOYMENT_ENDED'
    );
  }
  if (userRow.is_active === false) {
    throw ApiError.unauthorized('Your account is inactive', 'ACCOUNT_INACTIVE');
  }

  req.user = {
    id: userRow.id,
    email: userRow.email,
    roleId: '',
    branchId: userRow.branch_id ?? null,
    roleName: userRow.role_name ?? null,
  };
}

/**
 * Authentication middleware
 * Verifies the access token (local JWT or Keycloak, per AUTH_MODE) and attaches user.
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    // Get token from Authorization header or httpOnly cookie
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.pf_access_token) {
      token = req.cookies.pf_access_token;
    }

    if (!token) {
      throw ApiError.unauthorized('Access token is required', 'NO_TOKEN');
    }

    // Local JWT mode — short-circuit the Keycloak path entirely.
    if (config.auth.mode === 'jwt') {
      await authenticateJwt(req as AuthenticatedRequest, token);
      return next();
    }

    try {
      // Verify token against Keycloak JWKS
      const payload = await verifyKeycloakToken(token);

      // Check token blacklist by JTI (Keycloak includes jti)
      if (payload.jti) {
        const revoked = await cacheService.get(`${TOKEN_BLACKLIST_PREFIX}:${payload.jti}`);
        if (revoked) {
          throw ApiError.unauthorized('Token has been revoked', 'TOKEN_REVOKED');
        }
      }

      // Resolve local user from keycloak_sub or email
      const userRow = await resolveUser(payload);

      if (!userRow) {
        throw ApiError.unauthorized('User account not found', 'USER_NOT_FOUND');
      }

      // Block access for deactivated users (exited/terminated/deleted employees)
      const deactivatedStatuses = ['exited', 'terminated', 'deleted'];
      if (userRow.is_active === false && userRow.status && deactivatedStatuses.includes(userRow.status)) {
        throw ApiError.unauthorized('Your account has been deactivated', 'ACCOUNT_INACTIVE');
      }

      // Auto-fix is_active only for users with active/onboarding employment status
      // (PrismaPg adapter can lose boolean values during create/upsert)
      const autoFixStatuses = ['active', 'onboarding', null, undefined];
      if (userRow.is_active === false && autoFixStatuses.includes(userRow.status)) {
        await prisma.$queryRawUnsafe(
          `UPDATE users SET is_active = true WHERE id = $1::uuid`,
          userRow.id
        );
      }

      // Block access for offboarded/exited employees
      const blockedStatuses = ['exited', 'terminated'];
      if (userRow.status && blockedStatuses.includes(userRow.status)) {
        throw ApiError.unauthorized(
          'Access denied. Your employment status does not allow system access',
          'EMPLOYMENT_ENDED'
        );
      }

      // Read role strictly from the azp client in the token (never from other clients).
      const keycloakRole = resolveRoleFromToken(payload);
      const roleName: string | null = keycloakRole ?? userRow.role_name ?? null;

      // Sync Keycloak role to DB (awaited so /permissions sees the updated role_id immediately)
      if (keycloakRole && keycloakRole !== userRow.role_name) {
        await prisma.$queryRawUnsafe(
          `UPDATE users SET role_id = (SELECT id FROM roles WHERE name = $1 LIMIT 1) WHERE id = $2::uuid`,
          keycloakRole,
          userRow.id
        ).catch(() => {/* non-fatal if role name not found in DB yet */});
      }

      // Resolve branch context (non-fatal)
      let branchId: string | null = userRow.branch_id ?? null;

      // HR-specific: check hr.branch_assignments setting first
      if (roleName === 'hr') {
        try {
          const settingRow = await prisma.$queryRawUnsafe<Array<{ setting_value: unknown }>>(
            `SELECT setting_value FROM system_settings WHERE setting_key = 'hr.branch_assignments' LIMIT 1`
          );
          const map = settingRow[0]?.setting_value as Record<string, string> | null;
          const hrBranch = (map && typeof map === 'object') ? (map[userRow.id] ?? null) : null;
          if (hrBranch) branchId = hrBranch;
        } catch { /* non-fatal */ }
      }

      // Auto-assign single branch for any role if branch not yet set
      if (!branchId && roleName !== 'admin') {
        try {
          const branchesRow = await prisma.$queryRawUnsafe<Array<{ setting_value: unknown }>>(
            `SELECT setting_value FROM system_settings WHERE setting_key = 'org.branches' LIMIT 1`
          );
          const branchList = branchesRow[0]?.setting_value as Array<{ id: string }> | null;
          if (Array.isArray(branchList) && branchList.length === 1) {
            branchId = branchList[0].id;
          }
        } catch { /* non-fatal */ }
      }

      // Attach user to request using local DB id (all downstream code unchanged)
      req.user = {
        id: userRow.id,
        email: userRow.email,
        roleId: '',
        branchId,
        roleName,
      };

      next();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.unauthorized('Invalid or expired token', 'INVALID_TOKEN');
    }
  }
);

/**
 * Optional authentication middleware
 * Attaches user if token is provided, but doesn't throw error if not
 */
export const optionalAuthenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.pf_access_token) {
      token = req.cookies.pf_access_token;
    }

    if (token && config.auth.mode === 'jwt') {
      // Local JWT optional auth — never throws, just attaches when valid.
      try {
        await authenticateJwt(req as AuthenticatedRequest, token);
      } catch {
        req.user = undefined;
      }
      return next();
    }

    if (token) {
      try {
        const payload = await verifyKeycloakToken(token);

        // Check blacklist even for optional auth
        if (payload.jti) {
          const revoked = await cacheService.get(`${TOKEN_BLACKLIST_PREFIX}:${payload.jti}`);
          if (revoked) {
            req.user = undefined;
            return next();
          }
        }

        const userRow = await resolveUser(payload);

        const blockedStatuses = ['exited', 'terminated'];
        if (
          !userRow ||
          userRow.is_active === false ||
          (userRow.status && blockedStatuses.includes(userRow.status))
        ) {
          req.user = undefined;
        } else {
          req.user = {
            id: userRow.id,
            email: userRow.email,
            roleId: '',
          };
        }
      } catch {
        req.user = undefined;
      }
    }

    next();
  }
);
