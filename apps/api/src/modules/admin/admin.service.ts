import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { createKeycloakUser, listKeycloakUsers, getUserClientRole, sendPasswordResetEmail } from '../../utils/keycloakAdmin';
import { CreateHrAccountInput, CreateBranchInput, UpdateBranchInput } from './admin.validator';

export interface HrmsProfile {
  keycloakSub: string;
  userId?: string;
  phone?: string | null;
  designation?: string | null;
  department?: string | null;
  branchId?: string | null;
  employeeId?: string | null;
}

const ORG_BRANCHES_KEY = 'org.branches';
const HR_BRANCH_MAP_KEY = 'hr.branch_assignments';

export interface Branch {
  id: string;
  name: string;
  websiteUrl?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

const HR_ACCOUNT_LIMIT_KEY = 'hr.max_accounts';
const DEFAULT_HR_ACCOUNT_LIMIT = 5;

export class AdminService {
  private async generateNextEmployeeId(tx: any = prisma): Promise<string> {
    const latest = await tx.$queryRawUnsafe(
      `
      SELECT employee_id
      FROM employees
      WHERE employee_id ~ '^CSS[0-9]+$'
      ORDER BY CAST(SUBSTRING(employee_id FROM 4) AS INTEGER) DESC
      LIMIT 1
    `
    ) as Array<{ employee_id: string }>;

    const current = latest[0]?.employee_id ? parseInt(latest[0].employee_id.slice(3), 10) : 0;
    const next = current + 1;
    return `CSS${String(next).padStart(3, '0')}`;
  }

  async getHrAccountLimit(): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; setting_value: unknown }>
    >(
      'SELECT id, setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1',
      HR_ACCOUNT_LIMIT_KEY
    );
    const setting = rows[0];

    if (!setting) {
      return DEFAULT_HR_ACCOUNT_LIMIT;
    }

    if (typeof setting.setting_value === 'number') {
      return setting.setting_value;
    }

    if (
      setting.setting_value &&
      typeof setting.setting_value === 'object' &&
      'maxHrAccounts' in (setting.setting_value as Record<string, unknown>)
    ) {
      const value = (setting.setting_value as Record<string, unknown>).maxHrAccounts;
      if (typeof value === 'number') {
        return value;
      }
    }

    return DEFAULT_HR_ACCOUNT_LIMIT;
  }

  private async readBranchAssignments(): Promise<Record<string, string>> {
    const rows = await prisma.$queryRawUnsafe<Array<{ setting_value: unknown }>>(
      'SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1',
      HR_BRANCH_MAP_KEY
    );
    const raw = rows[0]?.setting_value;
    if (!raw) return {};
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, string>;
  }

  private async writeBranchAssignments(map: Record<string, string>, currentUserId: string): Promise<void> {
    const value = JSON.stringify(map);
    await prisma.$executeRawUnsafe(
      `INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
       VALUES ($1, $2::jsonb, $3, $4::uuid)
       ON CONFLICT (setting_key) DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      HR_BRANCH_MAP_KEY,
      value,
      'HR user to branch assignment map',
      currentUserId
    );
  }

  async listHrAccounts() {
    const [maxHrAccounts, hrUsers, branchMap] = await Promise.all([
      this.getHrAccountLimit(),
      prisma.user.findMany({
        where: {
          deletedAt: null,
          role: { name: 'hr' },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          keycloakSub: true,
        },
      }),
      this.readBranchAssignments(),
    ]);

    // Fetch designation from employees table for each user
    const userIds = hrUsers.map(u => u.id);
    const empRows = userIds.length > 0
      ? await prisma.$queryRawUnsafe<Array<{ user_id: string; designation: string | null }>>(
          `SELECT user_id::text, designation FROM employees WHERE user_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
          userIds
        )
      : [];
    const designationMap = Object.fromEntries(empRows.map(e => [e.user_id, e.designation]));

    const items = hrUsers.map(u => ({
      ...u,
      branchId: branchMap[u.id] ?? null,
      designation: designationMap[u.id] ?? null,
    }));

    return {
      items,
      total: items.length,
      maxHrAccounts,
    };
  }

  async createHrAccount(
    input: CreateHrAccountInput,
    currentUserId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const hrRole = await prisma.role.findUnique({ where: { name: 'hr' } });
    if (!hrRole) {
      throw ApiError.badRequest(
        'HR role is not configured yet. Create role "hr" first.',
        'HR_ROLE_NOT_CONFIGURED'
      );
    }

    // Check if user already exists (e.g. auto-provisioned by Keycloak login before admin created account)
    const existing = await prisma.user.findFirst({
      where: {
        email: input.email,
        deletedAt: null,
      },
      select: { id: true, roleId: true },
    });

    // If existing user already has HR role assigned, it's a true duplicate
    if (existing && existing.roleId === hrRole.id) {
      throw ApiError.conflict('An HR account with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const [currentHrCount, maxHrAccounts] = await Promise.all([
      prisma.user.count({
        where: {
          deletedAt: null,
          role: { name: 'hr' },
        },
      }),
      this.getHrAccountLimit(),
    ]);

    if (currentHrCount >= maxHrAccounts) {
      throw ApiError.unprocessable(
        `HR account limit reached (${maxHrAccounts}). Increase the limit or deactivate an HR account.`,
        'HR_ACCOUNT_LIMIT_REACHED'
      );
    }

    const passwordHash = await bcrypt.hash(input.temporaryPassword, 12);

    const created = await prisma.$transaction(async tx => {
      const employeeCode = await this.generateNextEmployeeId(tx);
      const joiningDate = new Date().toISOString().slice(0, 10);

      // Upsert user: if auto-provisioned by Keycloak login, update instead of create
      let user;
      if (existing) {
        // User was auto-provisioned on first Keycloak login — promote to HR account
        user = await tx.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            isActive: true,
            isVerified: true,
            roleId: hrRole.id,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            isVerified: true,
            createdAt: true,
            role: {
              select: { id: true, name: true, displayName: true },
            },
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            email: input.email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            isActive: true,
            isVerified: true,
            roleId: hrRole.id,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            isVerified: true,
            createdAt: true,
            role: {
              select: { id: true, name: true, displayName: true },
            },
          },
        });
      }

      await tx.$executeRawUnsafe(
        `
        INSERT INTO employees
          (user_id, employee_id, first_name, last_name, email, joining_date, designation, department, work_location, branch_id, status, created_by, updated_by)
        VALUES
          ($1::uuid, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, 'active'::employee_status, $1::uuid, $1::uuid)
        ON CONFLICT (user_id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          designation = EXCLUDED.designation,
          department = EXCLUDED.department,
          work_location = EXCLUDED.work_location,
          status = 'active'::employee_status,
          updated_by = $1::uuid,
          updated_at = NOW()
      `,
        user.id,
        employeeCode,
        input.firstName,
        input.lastName,
        input.email,
        joiningDate,
        'HR',
        'Human Resources',
        input.location,
        input.branchId || null
      );

      // Clean up any onboarding record created during auto-provisioning (HR doesn't go through onboarding)
      await tx.$executeRawUnsafe(
        `DELETE FROM onboarding WHERE employee_id IN (SELECT id FROM employees WHERE user_id = $1::uuid)`,
        user.id
      );

      await tx.auditLog.create({
        data: {
          userId: currentUserId,
          action: 'admin.hr_account_created',
          entityType: 'user',
          entityId: user.id,
          newValues: {
            email: user.email,
            role: 'hr',
            firstName: user.firstName,
            lastName: user.lastName,
          },
          metadata: {
            justification: input.justification,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
          },
        },
      });

      return user;
    });

    if (input.branchId) {
      const branchMap = await this.readBranchAssignments();
      branchMap[created.id] = input.branchId;
      await this.writeBranchAssignments(branchMap, currentUserId);
    }

    // Provision user in Keycloak so they can log in immediately (non-fatal if it fails)
    const keycloakSub = await createKeycloakUser({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      temporaryPassword: input.temporaryPassword,
    });
    if (keycloakSub) {
      await prisma.$executeRawUnsafe(
        `UPDATE users SET keycloak_sub = $1 WHERE id = $2::uuid`,
        keycloakSub,
        created.id
      );
    }

    return {
      user: { ...created, branchId: input.branchId ?? null },
      limits: {
        currentHrAccounts: currentHrCount + 1,
        maxHrAccounts,
      },
    };
  }

  async assignHrBranch(userId: string, branchId: string | null, currentUserId: string) {
    const branchMap = await this.readBranchAssignments();
    if (branchId) {
      branchMap[userId] = branchId;
    } else {
      delete branchMap[userId];
    }
    await this.writeBranchAssignments(branchMap, currentUserId);

    // Also update employees.branch_id for this user
    await prisma.$executeRawUnsafe(
      `UPDATE employees SET branch_id = $1, updated_at = NOW() WHERE user_id = $2::uuid AND deleted_at IS NULL`,
      branchId || null,
      userId
    );

    return { userId, branchId };
  }

  async updateHrAccountLimit(
    maxHrAccounts: number,
    currentUserId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const previousLimit = await this.getHrAccountLimit();
    const settingValue = JSON.stringify({ maxHrAccounts });
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
      VALUES ($1, $2::jsonb, $3, $4::uuid)
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `,
      HR_ACCOUNT_LIMIT_KEY,
      settingValue,
      'Maximum number of active HR accounts allowed',
      currentUserId
    );

    const settingRows = await prisma.$queryRawUnsafe<
      Array<{ id: string; setting_key: string; setting_value: unknown; updated_at: Date }>
    >(
      'SELECT id, setting_key, setting_value, updated_at FROM system_settings WHERE setting_key = $1 LIMIT 1',
      HR_ACCOUNT_LIMIT_KEY
    );
    const setting = settingRows[0];

    await prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'admin.hr_limit_updated',
        entityType: 'system_setting',
        entityId: setting?.id,
        oldValues: { maxHrAccounts: previousLimit },
        newValues: { maxHrAccounts },
        metadata: {
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        },
      },
    });

    return {
      setting,
      maxHrAccounts,
    };
  }

  async getAdminSettings() {
    const maxHrAccounts = await this.getHrAccountLimit();
    return {
      hr: {
        maxHrAccounts,
      },
    };
  }

  // ─── Branch Management ───────────────────────────────────────────────────

  private async readBranches(): Promise<Branch[]> {
    const rows = await prisma.$queryRawUnsafe<Array<{ setting_value: unknown }>>(
      'SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1',
      ORG_BRANCHES_KEY
    );
    const raw = rows[0]?.setting_value;
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
    return list as Branch[];
  }

  private async writeBranches(branches: Branch[], currentUserId: string): Promise<void> {
    const value = JSON.stringify(branches);
    await prisma.$executeRawUnsafe(
      `INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
       VALUES ($1, $2::jsonb, $3, $4::uuid)
       ON CONFLICT (setting_key) DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      ORG_BRANCHES_KEY,
      value,
      'Organisation branch offices',
      currentUserId
    );
  }

  async listBranches(): Promise<Branch[]> {
    return this.readBranches();
  }

  async createBranch(input: CreateBranchInput, currentUserId: string): Promise<Branch> {
    const branches = await this.readBranches();
    const now = new Date().toISOString();
    const branch: Branch = {
      id: uuidv4(),
      name: input.name,
      websiteUrl: input.websiteUrl || undefined,
      address: input.address || undefined,
      createdAt: now,
      updatedAt: now,
    };
    branches.push(branch);
    await this.writeBranches(branches, currentUserId);
    return branch;
  }

  async updateBranch(id: string, input: UpdateBranchInput, currentUserId: string): Promise<Branch> {
    const branches = await this.readBranches();
    const idx = branches.findIndex(b => b.id === id);
    if (idx === -1) throw ApiError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
    const updated: Branch = {
      ...branches[idx],
      ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
      id,
      updatedAt: new Date().toISOString(),
    };
    branches[idx] = updated;
    await this.writeBranches(branches, currentUserId);
    return updated;
  }

  async deleteBranch(id: string, currentUserId: string): Promise<void> {
    const branches = await this.readBranches();
    const idx = branches.findIndex(b => b.id === id);
    if (idx === -1) throw ApiError.notFound('Branch not found', 'BRANCH_NOT_FOUND');
    branches.splice(idx, 1);
    await this.writeBranches(branches, currentUserId);
  }

  async getAdminDashboard(branchId?: string | null) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const bid = branchId || null;

    // First day of current month and last month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

    // Get overview stats using raw SQL
    const [
      totalEmployeesRows,
      activeEmployeesRows,
      onboardingEmployeesRows,
      exitingEmployeesRows,
      totalHRsRows,
      totalManagersRows,
      departmentCountRows,
      locationCountRows,
      todayAttendanceRows,
      pendingLeavesRows,
      activeOnboardingRows,
      activeOffboardingRows,
      thisMonthGrowthRows,
      lastMonthGrowthRows,
    ] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.status NOT IN ('exited', 'deleted') AND e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.status = 'active' AND e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.status = 'onboarding' AND e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.status IN ('notice_period', 'exited') AND e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM users u JOIN roles r ON r.id = u.role_id JOIN employees e ON e.user_id = u.id WHERE r.name = 'hr' AND u.deleted_at IS NULL AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM users u JOIN roles r ON r.id = u.role_id JOIN employees e ON e.user_id = u.id WHERE r.name = 'manager' AND u.deleted_at IS NULL AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(DISTINCT e.department)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COALESCE(jsonb_array_length(setting_value), 0)::text as count FROM system_settings WHERE setting_key = 'org.branches'`),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM attendance a JOIN employees e ON e.id = a.employee_id LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE a.date = $1::date AND a.status IN ('checked_in', 'present') AND e.status = 'active' AND e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($2::text IS NULL OR e.branch_id = $2)`, today, bid),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM leaves l JOIN employees e ON e.id = l.employee_id WHERE l.status = 'pending' AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM onboarding o JOIN employees e ON e.id = o.employee_id LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE o.status = 'in_progress' AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM offboarding o JOIN employees e ON e.id = o.employee_id WHERE o.status = 'in_progress' AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      // Employees created this month (exclude admin)
      prisma.$queryRawUnsafe<Array<{ count: string }>>(
        `SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND e.created_at >= $1::date AND e.created_at < $2::date AND ($3::text IS NULL OR e.branch_id = $3)`,
        thisMonthStart,
        new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10),
        bid
      ),
      // Employees created last month (exclude admin)
      prisma.$queryRawUnsafe<Array<{ count: string }>>(
        `SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND e.created_at >= $1::date AND e.created_at < $2::date AND ($3::text IS NULL OR e.branch_id = $3)`,
        lastMonthStart,
        thisMonthStart,
        bid
      ),
    ]);

    const totalEmployees = parseInt(totalEmployeesRows[0]?.count || '0', 10);
    const activeEmployees = parseInt(activeEmployeesRows[0]?.count || '0', 10);
    const onboardingEmployees = parseInt(onboardingEmployeesRows[0]?.count || '0', 10);
    const exitingEmployees = parseInt(exitingEmployeesRows[0]?.count || '0', 10);
    const totalHRs = parseInt(totalHRsRows[0]?.count || '0', 10);
    const totalManagers = parseInt(totalManagersRows[0]?.count || '0', 10);
    const departmentCount = parseInt(departmentCountRows[0]?.count || '0', 10);
    const locationCount = parseInt(locationCountRows[0]?.count || '0', 10);
    const todayAttendance = parseInt(todayAttendanceRows[0]?.count || '0', 10);
    const pendingLeaves = parseInt(pendingLeavesRows[0]?.count || '0', 10);
    const activeOnboarding = parseInt(activeOnboardingRows[0]?.count || '0', 10);
    const activeOffboarding = parseInt(activeOffboardingRows[0]?.count || '0', 10);
    const thisMonthGrowth = parseInt(thisMonthGrowthRows[0]?.count || '0', 10);
    const lastMonthGrowth = parseInt(lastMonthGrowthRows[0]?.count || '0', 10);

    // Monthly breakdown for bar chart — cumulative headcount at end of each of last 12 months
    const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyBreakdown: Array<{ month: string; label: string; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).toISOString().slice(0, 10);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
        `SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id
         WHERE e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND e.created_at < $1::date
           AND ($2::text IS NULL OR e.branch_id = $2)`,
        endDate, bid
      );
      monthlyBreakdown.push({ month: key, label: monthLabels[d.getMonth()], count: parseInt(rows[0]?.count || '0', 10) });
    }

    // Calculate growth percentage and trend
    let changePercentage = 0;
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (lastMonthGrowth > 0) {
      changePercentage = Math.round(((thisMonthGrowth - lastMonthGrowth) / lastMonthGrowth) * 100);
      trend = changePercentage > 0 ? 'up' : changePercentage < 0 ? 'down' : 'neutral';
    } else if (thisMonthGrowth > 0) {
      changePercentage = 100;
      trend = 'up';
    }

    return {
      overview: {
        totalEmployees,
        activeEmployees,
        onboardingEmployees,
        exitingEmployees,
        totalHRs,
        totalManagers,
        departmentCount,
        locationCount,
      },
      employeeGrowth: {
        thisMonth: thisMonthGrowth,
        lastMonth: lastMonthGrowth,
        changePercentage: Math.abs(changePercentage),
        trend,
        monthlyBreakdown,
      },
      attendance: {
        today: {
          present: todayAttendance,
          absent: Math.max(0, totalEmployees - todayAttendance),
          attendanceRate: totalEmployees > 0 ? (todayAttendance / totalEmployees) * 100 : 0,
        },
      },
      leaves: {
        pending: pendingLeaves,
        approvedThisMonth: 0, // Placeholder
        rejectedThisMonth: 0, // Placeholder
      },
      onboarding: {
        active: activeOnboarding,
        completedThisMonth: 0, // Placeholder
      },
      offboarding: {
        active: activeOffboarding,
        completedThisMonth: 0, // Placeholder
      },
      systemActivity: {
        todayLogins: 0, // Placeholder
        activeUsers: 0, // Placeholder
        systemHealth: 'healthy',
      },
    };
  }

  // ─── Keycloak User Directory ─────────────────────────────────────────────

  /**
   * List all Keycloak users enriched with their client role and local HRMS profile (if any).
   */
  async listKeycloakUserDirectory() {
    const [kcUsers, branchMap] = await Promise.all([
      listKeycloakUsers(500),
      this.readBranchAssignments(),
    ]);

    // Fetch local users keyed by keycloak_sub for profile enrichment
    const localUsers = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        email: string;
        keycloak_sub: string | null;
        phone: string | null;
      }>
    >(`SELECT id, email, keycloak_sub, phone FROM users WHERE deleted_at IS NULL`);
    const localByKcSub = new Map<string, typeof localUsers[0]>();
    for (const u of localUsers) {
      if (u.keycloak_sub) localByKcSub.set(u.keycloak_sub, u);
    }

    // Fetch employee profile rows keyed by user_id
    const empRows = await prisma.$queryRawUnsafe<
      Array<{
        user_id: string;
        employee_id: string | null;
        designation: string | null;
        department: string | null;
        branch_id: string | null;
      }>
    >(
      `SELECT user_id::text, employee_id, designation, department, branch_id FROM employees WHERE deleted_at IS NULL`
    );
    const empByUserId = new Map<string, typeof empRows[0]>();
    for (const e of empRows) empByUserId.set(e.user_id, e);

    // Fetch roles for all Keycloak users in parallel (batched to avoid rate limits)
    const BATCH = 20;
    const roleMap = new Map<string, string | null>();
    for (let i = 0; i < kcUsers.length; i += BATCH) {
      const batch = kcUsers.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (u) => {
          const role = await getUserClientRole(u.id);
          roleMap.set(u.id, role);
        })
      );
    }

    return kcUsers.map((u) => {
      const local = localByKcSub.get(u.id);
      const emp = local ? empByUserId.get(local.id) : undefined;
      return {
        keycloakSub: u.id,
        email: u.email || u.username,
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        enabled: u.enabled,
        role: roleMap.get(u.id) ?? null,
        userId: local?.id ?? null,
        phone: local?.phone ?? null,
        designation: emp?.designation ?? null,
        department: emp?.department ?? null,
        branchId: local ? (branchMap[local.id] ?? emp?.branch_id ?? null) : null,
        employeeId: emp?.employee_id ?? null,
      };
    });
  }

  /**
   * Get the HRMS profile for a single Keycloak user.
   */
  async getKeycloakUserProfile(keycloakSub: string) {
    const localRows = await prisma.$queryRawUnsafe<
      Array<{ id: string; email: string; phone: string | null }>
    >(`SELECT id, email, phone FROM users WHERE keycloak_sub = $1 AND deleted_at IS NULL LIMIT 1`, keycloakSub);
    const local = localRows[0];

    const branchMap = await this.readBranchAssignments();

    if (!local) {
      return { keycloakSub, userId: null, phone: null, designation: null, department: null, branchId: null, employeeId: null };
    }

    const empRows = await prisma.$queryRawUnsafe<
      Array<{ employee_id: string | null; designation: string | null; department: string | null; branch_id: string | null }>
    >(`SELECT employee_id, designation, department, branch_id FROM employees WHERE user_id = $1::uuid AND deleted_at IS NULL LIMIT 1`, local.id);
    const emp = empRows[0];

    return {
      keycloakSub,
      userId: local.id,
      phone: local.phone,
      designation: emp?.designation ?? null,
      department: emp?.department ?? null,
      branchId: branchMap[local.id] ?? emp?.branch_id ?? null,
      employeeId: emp?.employee_id ?? null,
    };
  }

  /**
   * Upsert HRMS-specific profile fields for a Keycloak user.
   * The local user record must already exist (auto-provisioned on first login).
   */
  async updateKeycloakUserProfile(keycloakSub: string, input: {
    phone?: string;
    designation?: string;
    department?: string;
    branchId?: string;
  }, currentUserId: string) {
    const localRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM users WHERE keycloak_sub = $1 AND deleted_at IS NULL LIMIT 1`, keycloakSub
    );
    const local = localRows[0];
    if (!local) {
      throw ApiError.notFound('User has not logged in yet — no local profile exists', 'USER_NOT_PROVISIONED');
    }

    const { phone, designation, department, branchId } = input;

    // Update phone on users table
    if (phone !== undefined) {
      await prisma.$executeRawUnsafe(`UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2::uuid`, phone, local.id);
    }

    // Upsert employee row for designation/department/branch
    if (designation !== undefined || department !== undefined || branchId !== undefined) {
      const emp = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM employees WHERE user_id = $1::uuid AND deleted_at IS NULL LIMIT 1`, local.id
      );

      if (emp.length > 0) {
        const sets: string[] = [];
        const vals: unknown[] = [local.id];
        if (designation !== undefined) { vals.push(designation); sets.push(`designation = $${vals.length}`); }
        if (department !== undefined) { vals.push(department); sets.push(`department = $${vals.length}`); }
        if (branchId !== undefined) { vals.push(branchId || null); sets.push(`branch_id = $${vals.length}`); }
        if (sets.length > 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE employees SET ${sets.join(', ')}, updated_at = NOW() WHERE user_id = $1::uuid`,
            ...vals
          );
        }
      }
    }

    // Update branch assignment map
    if (branchId !== undefined) {
      const branchMap = await this.readBranchAssignments();
      if (branchId) {
        branchMap[local.id] = branchId;
      } else {
        delete branchMap[local.id];
      }
      await this.writeBranchAssignments(branchMap, currentUserId);
    }

    return this.getKeycloakUserProfile(keycloakSub);
  }

  /**
   * Trigger a Keycloak password-reset email for a user.
   */
  async sendUserPasswordResetEmail(keycloakSub: string) {
    await sendPasswordResetEmail(keycloakSub);
  }
}

export const adminService = new AdminService();

