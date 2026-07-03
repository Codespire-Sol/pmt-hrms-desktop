import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { CreateEmployeeInput, CreateManagerInput } from './hr.validator';
import { createKeycloakUser, resetKeycloakUserPassword, updateKeycloakUserEmail, disableKeycloakUser } from '../../utils/keycloakAdmin';
import { notificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.types';
import { LeaveApplyInput, workforceService, normalizeAttendanceTimestamps, toDateOnly } from '../workforce/workforce.service';
import { pdfService } from '../../services/pdf.service';
import { getCompanyCached } from '../../services/appSettings.service';
import { storageService } from '../../services/storage.service';
import { emailService } from '../../services/email.service';
import { emailTemplates } from '../../services/email.templates';
import { config } from '../../config';
import { JwtUtils } from '../../utils/jwt';
import { normalizeMediaUrl } from '../../utils/media-url';
import { logger } from '../../utils/logger';

/** Normalize avatar URLs in a query row so they are absolute when UPLOADS_BASE_URL is set. */
function normalizeRowAvatars<T extends Record<string, any>>(row: T): T {
  const out = { ...row };
  for (const key of Object.keys(out)) {
    if (/avatar/i.test(key) && typeof out[key] === 'string') {
      (out as any)[key] = normalizeMediaUrl(out[key]) ?? out[key];
    }
  }
  return out;
}

const ONBOARDING_TASKS = [
  'Personal Documents Collected',
  'Laptop/Equipment Assigned',
  'Email Account Created',
  'System Access Granted',
  'Team Introduction Completed',
  'Office Orientation Done',
];

type EmployeeStatusValue = 'onboarding' | 'active' | 'notice_period' | 'exited' | 'deleted';
type AttendanceStatusValue =
  | 'checked_in'
  | 'present'
  | 'absent'
  | 'incomplete'
  | 'on_leave'
  | 'holiday';

interface PayrollNormalizedRow {
  employeeId: string;
  gross: number;
  deductions: number;
  net: number;
  earningsBreakdown?: Array<{ label: string; amount: number }>;
  deductionsBreakdown?: Array<{ label: string; amount: number }>;
  totalWorkingDays?: number;
  leaves?: number;
  lopDays?: number;
  paidDays?: number;
}

interface PayrollCsvParseResult {
  month: number;
  year: number;
  rows: PayrollNormalizedRow[];
  templateType: 'basic' | 'detailed';
}

function calculateStatus(joiningDate: Date, requested?: EmployeeStatusValue): EmployeeStatusValue {
  if (requested) return requested;
  return joiningDate > new Date() ? 'onboarding' : 'active';
}

function isUserActiveForEmployeeStatus(status: EmployeeStatusValue): boolean {
  return status === 'active' || status === 'notice_period';
}

function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!%*?&';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

function proratedLeave(total: number, joiningDate: Date): number {
  const remainingMonths = 12 - joiningDate.getMonth();
  const value = (total * remainingMonths) / 12;
  return Math.round(value * 100) / 100;
}

const CSV_HEADER_LABELS: Record<string, string> = {
  employeeId: 'Employee ID', employeeName: 'Employee Name', employeeCode: 'Employee ID',
  department: 'Department', designation: 'Designation', date: 'Date',
  checkInTime: 'Check In', checkOutTime: 'Check Out', workHours: 'Work Hours',
  status: 'Status', lateArrival: 'Late Arrival', leaveType: 'Leave Type',
  fromDate: 'From Date', toDate: 'To Date', days: 'Days', reason: 'Reason',
  appliedAt: 'Applied At', approvedBy: 'Approved By', approvedAt: 'Approved At',
  rejectedBy: 'Rejected By', rejectedAt: 'Rejected At', rejectionReason: 'Rejection Reason',
  month: 'Month', year: 'Year', gross: 'Gross Pay', deductions: 'Deductions', net: 'Net Pay',
  generatedAt: 'Generated At', finalizedAt: 'Finalized At',
  lastWorkingDay: 'Last Working Day', exitReason: 'Exit Reason',
  additionalNotes: 'Notes', offboardingStatus: 'Status', tasksProgress: 'Progress',
  completedAt: 'Completed At',
};

function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const displayHeaders = headers.map(h => CSV_HEADER_LABELS[h] || h);
  const lines = [displayHeaders.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => esc(row[h])).join(','));
  }
  return lines.join('\n');
}

function parseNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function toRelativeTime(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return null;

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'just now';
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function buildAttendanceCards(totalDays: number, statusCounts: Partial<Record<AttendanceStatusValue, number>>) {
  const daysPresent = statusCounts.present || 0;
  const incomplete = (statusCounts.incomplete || 0) + (statusCounts.checked_in || 0);
  const attendanceRate = totalDays === 0 ? 0 : Math.round((daysPresent / totalDays) * 10000) / 100;

  return {
    totalDays,
    daysPresent,
    incomplete,
    attendanceRate,
  };
}

export class HrService {
  private async getActorDisplayName(userId: string): Promise<string> {
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!actor) return 'System';
    const name = `${actor.firstName || ''} ${actor.lastName || ''}`.trim();
    return name || actor.email;
  }

  private async getHrmsAdminRecipients(): Promise<string[]> {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      SELECT u.id
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'admin'
        AND u.is_active = true
        AND u.deleted_at IS NULL
    `
    );
    return rows.map(r => r.id);
  }

  private async getEmployeeAudience(employeeId: string): Promise<{
    employeeName: string;
    employeeUserId: string | null;
    managerUserId: string | null;
    managerName: string | null;
    adminUserIds: string[];
  }> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    const whereClause = isUuid ? `e.id = $1::uuid` : `LOWER(e.employee_id) = LOWER($1)`;
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        employee_name: string;
        employee_user_id: string | null;
        manager_user_id: string | null;
        manager_name: string | null;
      }>
    >(
      `
      SELECT
        CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as employee_name,
        e.user_id as employee_user_id,
        mu.id as manager_user_id,
        CASE
          WHEN m.id IS NULL THEN NULL
          ELSE CONCAT(m.first_name, ' ', COALESCE(m.last_name, ''))
        END as manager_name
      FROM employees e
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN users mu ON mu.id = m.user_id
      WHERE ${whereClause}
      LIMIT 1
    `,
      employeeId
    );
    const row = rows[0];
    if (!row) {
      return {
        employeeName: 'Employee',
        employeeUserId: null,
        managerUserId: null,
        managerName: null,
        adminUserIds: [],
      };
    }
    return {
      employeeName: row.employee_name?.trim() || 'Employee',
      employeeUserId: row.employee_user_id,
      managerUserId: row.manager_user_id,
      managerName: row.manager_name?.trim() || null,
      adminUserIds: await this.getHrmsAdminRecipients(),
    };
  }

  private async getLeaveAudience(leaveId: string): Promise<{
    leaveId: string;
    employeeId: string;
    employeeName: string;
    employeeUserId: string | null;
    managerUserId: string | null;
    fromDate: string;
    toDate: string;
  }> {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        leave_id: string;
        employee_id: string;
        employee_name: string;
        employee_user_id: string | null;
        manager_user_id: string | null;
        from_date: string;
        to_date: string;
      }>
    >(
      `
      SELECT
        l.id as leave_id,
        e.id as employee_id,
        CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as employee_name,
        e.user_id as employee_user_id,
        mu.id as manager_user_id,
        l.from_date::text as from_date,
        l.to_date::text as to_date
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN users mu ON mu.id = m.user_id
      WHERE l.id = $1::uuid
      LIMIT 1
    `,
      leaveId
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound('Leave not found', 'LEAVE_NOT_FOUND');
    return {
      leaveId: row.leave_id,
      employeeId: row.employee_id,
      employeeName: row.employee_name?.trim() || 'Employee',
      employeeUserId: row.employee_user_id,
      managerUserId: row.manager_user_id,
      fromDate: row.from_date,
      toDate: row.to_date,
    };
  }

  private async notifyHrms(
    type: NotificationType,
    actorId: string,
    recipientIds: Array<string | null | undefined>,
    metadata: Record<string, any>
  ): Promise<void> {
    const filtered = Array.from(new Set(recipientIds.filter(Boolean) as string[]));
    if (filtered.length === 0) return;
    try {
      const actorName = await this.getActorDisplayName(actorId);
      await notificationsService.notify(
        {
          type,
          recipientIds: filtered,
          actorId,
          metadata,
        },
        actorName
      );
    } catch {
      // Notification delivery should never block core HRMS workflows.
    }
  }

  private async getRoleIdByName(roleName: 'manager' | 'employee') {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw ApiError.badRequest(
        `Role "${roleName}" is not configured. Create role "${roleName}" first.`,
        'ROLE_NOT_CONFIGURED'
      );
    }
    return role.id;
  }

  private async ensureJoiningDateIsValid(joiningDate: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 30);
    if (joiningDate > maxDate) {
      throw ApiError.unprocessable(
        'Joining date cannot be more than 30 days in the future',
        'INVALID_JOINING_DATE'
      );
    }
  }

  private async getEmployeeById(employeeId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        user_id: string | null;
        manager_id: string | null;
        status: EmployeeStatusValue;
        role_name: string | null;
      }>
    >(
      isUuid
        ? `SELECT e.id, e.user_id, e.manager_id, e.status::text as status, r.name as role_name
           FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id
           WHERE e.id = $1::uuid LIMIT 1`
        : `SELECT e.id, e.user_id, e.manager_id, e.status::text as status, r.name as role_name
           FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id
           WHERE LOWER(e.employee_id) = LOWER($1) AND e.deleted_at IS NULL LIMIT 1`,
      employeeId
    );
    const employee = rows[0];
    if (!employee) {
      throw ApiError.notFound('Employee not found', 'EMPLOYEE_NOT_FOUND');
    }
    return employee;
  }

  private async validateManagerAssignment(employeeId: string, managerEmployeeId: string) {
    if (employeeId === managerEmployeeId) {
      throw ApiError.unprocessable('Cannot assign self as manager', 'SELF_MANAGER_ASSIGNMENT');
    }

    const manager = await this.getEmployeeById(managerEmployeeId);
    if (manager.status !== 'active') {
      throw ApiError.unprocessable('Manager must be active', 'MANAGER_NOT_ACTIVE');
    }

    // Cycle check: walk up manager chain and ensure employeeId is not encountered.
    let currentManagerId: string | null = manager.id;
    const visited = new Set<string>([employeeId]);
    let depth = 0;
    while (currentManagerId && depth < 20) {
      if (visited.has(currentManagerId)) {
        throw ApiError.unprocessable(
          'This assignment creates a circular reporting structure',
          'CIRCULAR_MANAGER_REFERENCE'
        );
      }
      visited.add(currentManagerId);
      const chainRows = await prisma.$queryRawUnsafe<Array<{ manager_id: string | null }>>(
        'SELECT manager_id FROM employees WHERE id = $1 LIMIT 1',
        currentManagerId
      );
      currentManagerId = chainRows[0]?.manager_id || null;
      depth += 1;
    }
  }

  private async generateNextEmployeeId(): Promise<string> {
    const latest = await prisma.$queryRawUnsafe<Array<{ employee_id: string }>>(
      `
      SELECT employee_id
      FROM employees
      WHERE employee_id ~ '^CSS[0-9]+$'
      ORDER BY CAST(SUBSTRING(employee_id FROM 4) AS INTEGER) DESC
      LIMIT 1
    `
    );
    const current = latest[0]?.employee_id ? parseInt(latest[0].employee_id.slice(3), 10) : 0;
    const next = current + 1;
    return `CSS${String(next).padStart(3, '0')}`;
  }

  private async createEmployeeWithRole(
    payload: CreateManagerInput | CreateEmployeeInput,
    roleName: 'manager' | 'employee',
    createdByUserId: string,
    branchId?: string | null
  ) {
    const joiningDate = new Date(payload.joiningDate);
    await this.ensureJoiningDateIsValid(joiningDate);

    if (payload.managerEmployeeId) {
      const manager = await this.getEmployeeById(payload.managerEmployeeId);
      if (manager.status !== 'active' || manager.role_name !== 'manager') {
        throw ApiError.unprocessable('Manager must be active and have manager role', 'INVALID_MANAGER');
      }
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: payload.email, deletedAt: null },
      select: { id: true },
    });
    if (existingUser) {
      throw ApiError.conflict('Email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const roleId = await this.getRoleIdByName(roleName);
    const status = calculateStatus(joiningDate, payload.status as EmployeeStatusValue | undefined);
    const temporaryPassword = payload.temporaryPassword || generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const employeeId = await this.generateNextEmployeeId();

    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email: payload.email,
          passwordHash,
          firstName: payload.firstName,
          lastName: payload.lastName || '',
          phone: payload.phone,
          isActive: isUserActiveForEmployeeStatus(status),
          isVerified: true,
          roleId,
        },
      });

      const employeeRows = await tx.$queryRawUnsafe<Array<{ id: string; employee_id: string; email: string; manager_id: string | null; status: string }>>(
        `
        INSERT INTO employees
          (user_id, employee_id, first_name, last_name, email, phone, date_of_birth, joining_date, designation, department, work_mode, work_location, country, manager_id, status, created_by, updated_by, branch_id)
        VALUES
          ($1::uuid, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11, $12, $13, $14::uuid, $15::employee_status, $16::uuid, $16::uuid, $17)
        RETURNING id, employee_id, email, manager_id, status::text
      `,
        user.id,                           // $1 user_id
        employeeId,                        // $2 employee_id
        payload.firstName,                 // $3 first_name
        payload.lastName || null,          // $4 last_name
        payload.email,                     // $5 email
        payload.phone || null,             // $6 phone
        payload.dateOfBirth || null,       // $7 date_of_birth
        payload.joiningDate,               // $8 joining_date
        payload.designation,               // $9 designation
        payload.department,                // $10 department
        payload.workMode || null,          // $11 work_mode
        payload.workLocation || null,      // $12 work_location
        payload.country || null,           // $13 country
        payload.managerEmployeeId || null, // $14 manager_id
        status,                            // $15 status
        createdByUserId,                   // $16 created_by / updated_by
        branchId || null                   // $17 branch_id
      );
      const employee = employeeRows[0];

      const year = joiningDate.getFullYear();
      const casual = proratedLeave(12, joiningDate);
      const sick = proratedLeave(12, joiningDate);
      const earned = proratedLeave(15, joiningDate);

      await tx.$executeRawUnsafe(
        `
        INSERT INTO leave_balances
          (employee_id, year, casual, sick, earned, lop, carried_forward_earned)
        VALUES
          ($1::uuid, $2, $3, $4, $5, 0, 0)
      `,
        employee.id,
        year,
        casual,
        sick,
        earned
      );

      if (status === 'onboarding') {
        // Load active templates; fall back to hardcoded list if none exist yet
        const dbTemplates = await tx.$queryRawUnsafe<Array<{
          task_name: string; phase: string | null; assignee: string | null; task_order: number;
        }>>(
          `SELECT task_name, phase, assignee, task_order
           FROM onboarding_task_templates WHERE is_active = true ORDER BY task_order ASC`
        );
        const tasksToInsert = dbTemplates.length > 0
          ? dbTemplates
          : ONBOARDING_TASKS.map((name, i) => ({ task_name: name, phase: null, assignee: null, task_order: i + 1 }));

        const onboardingRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `INSERT INTO onboarding (employee_id, target_completion_date, progress)
           VALUES ($1::uuid, $2::date, $3)
           RETURNING id`,
          employee.id,
          payload.joiningDate,
          `0/${tasksToInsert.length}`
        );
        const onboardingId = onboardingRows[0].id;

        for (const task of tasksToInsert) {
          await tx.$executeRawUnsafe(
            `INSERT INTO onboarding_tasks (onboarding_id, task_name, phase, assignee, task_order, completed)
             VALUES ($1::uuid, $2, $3, $4, $5, false)`,
            onboardingId, task.task_name, task.phase, task.assignee, task.task_order
          );
        }
      }

      await tx.auditLog.create({
        data: {
          userId: createdByUserId,
          action: roleName === 'manager' ? 'hr.manager_created' : 'hr.employee_created',
          entityType: 'employee',
          entityId: employee.id,
          newValues: {
            employeeId: employee.employee_id,
            email: employee.email,
            role: roleName,
            status: employee.status,
            managerId: employee.manager_id,
          },
        },
      });

      return {
        user, employee: {
          id: employee.id,
          employeeId: employee.employee_id,
          email: employee.email,
          managerId: employee.manager_id,
          status: employee.status,
        }
      };
    });

    // Provision user in Keycloak so they can log in immediately (non-fatal if it fails)
    const keycloakSub = await createKeycloakUser({
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName || '',
      temporaryPassword,
    });
    if (keycloakSub) {
      await prisma.$executeRawUnsafe(
        `UPDATE users SET keycloak_sub = $1 WHERE id = $2::uuid`,
        keycloakSub,
        result.user.id
      );
    }

    return {
      ...result,
      temporaryPassword,
    };
  }

  async createManager(payload: CreateManagerInput, createdByUserId: string, branchId?: string | null) {
    return this.createEmployeeWithRole(payload, 'manager', createdByUserId, branchId);
  }

  async createEmployee(payload: CreateEmployeeInput, createdByUserId: string, branchId?: string | null) {
    return this.createEmployeeWithRole(payload, 'employee', createdByUserId, branchId);
  }

  async listEmployees(filters: {
    role?: 'manager' | 'employee' | 'hr';
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    branchId?: string | null;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      role: filters.role || null,
      status: filters.status || null,
      search: filters.search || null,
      department: filters.department || null,
      branchId: filters.branchId || null,
    };

    const items = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        e.id,
        e.employee_id as "employeeId",
        e.first_name as "firstName",
        e.last_name as "lastName",
        u.avatar_url as "avatarUrl",
        e.email,
        e.phone,
        e.designation,
        e.department,
        e.work_mode as "workMode",
        e.work_location as "workLocation",
        e.country,
        e.branch_id as "branchId",
        (
          SELECT b->>'name'
          FROM system_settings ss,
               jsonb_array_elements(ss.setting_value) AS b
          WHERE ss.setting_key = 'org.branches' AND b->>'id' = e.branch_id
          LIMIT 1
        ) as "branchName",
        e.status::text as status,
        e.joining_date as "joiningDate",
        e.created_at as "createdAt",
        r.name as "role",
        m.id as "manager.id",
        m.employee_id as "manager.employeeId",
        m.first_name as "manager.firstName",
        m.last_name as "manager.lastName",
        m.email as "manager.email",
        mu.avatar_url as "manager.avatarUrl"
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN users mu ON mu.id = m.user_id
      WHERE e.deleted_at IS NULL
        AND ($1::text IS NULL OR r.name = $1)
        AND ($2::text IS NULL OR e.status::text = $2)
        AND ($4::text IS NULL OR e.department ILIKE $4)
        AND ($7::text IS NULL OR e.branch_id = $7 OR e.branch_id IS NULL)
        AND (
          $3::text IS NULL OR
          e.first_name ILIKE '%' || $3 || '%' OR
          COALESCE(e.last_name, '') ILIKE '%' || $3 || '%' OR
          CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) ILIKE '%' || $3 || '%' OR
          e.email ILIKE '%' || $3 || '%' OR
          e.employee_id ILIKE '%' || $3 || '%'
        )
      ORDER BY e.created_at DESC
      LIMIT $5 OFFSET $6
    `,
      where.role,
      where.status,
      where.search,
      where.department,
      limit,
      skip,
      where.branchId
    );

    const totalRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `
      SELECT COUNT(*)::text as count
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE e.deleted_at IS NULL
        AND ($1::text IS NULL OR r.name = $1)
        AND ($2::text IS NULL OR e.status::text = $2)
        AND ($4::text IS NULL OR e.department ILIKE $4)
        AND ($5::text IS NULL OR e.branch_id = $5 OR e.branch_id IS NULL)
        AND (
          $3::text IS NULL OR
          e.first_name ILIKE '%' || $3 || '%' OR
          COALESCE(e.last_name, '') ILIKE '%' || $3 || '%' OR
          CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) ILIKE '%' || $3 || '%' OR
          e.email ILIKE '%' || $3 || '%' OR
          e.employee_id ILIKE '%' || $3 || '%'
        )
    `,
      where.role,
      where.status,
      where.search,
      where.department,
      where.branchId
    );
    const total = parseInt(totalRows[0]?.count || '0', 10);

    return {
      items: items.map(normalizeRowAvatars),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listActiveManagers(branchId?: string | null) {
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        e.id,
        e.employee_id as "employeeId",
        e.first_name as "firstName",
        e.last_name as "lastName",
        e.email,
        e.designation,
        e.department,
        r.name as "roleName",
        r.display_name as "roleDisplayName"
      FROM employees e
      JOIN users u ON u.id = e.user_id
      JOIN roles r ON r.id = u.role_id
      WHERE e.deleted_at IS NULL
        AND e.status = 'active'
        AND r.name IN ('admin', 'manager', 'hr')
        AND ($1::text IS NULL OR e.branch_id = $1)
      ORDER BY r.level DESC, e.first_name ASC
    `,
      branchId ?? null
    );
  }

  async assignManager(employeeId: string, managerEmployeeId: string, updatedByUserId: string) {
    const employee = await this.getEmployeeById(employeeId);
    const resolvedId = employee.id;
    if (employee.status === 'exited' || employee.status === 'deleted') {
      throw ApiError.unprocessable('Cannot assign manager for exited/deleted employee', 'INVALID_STATUS');
    }
    await this.validateManagerAssignment(resolvedId, managerEmployeeId);

    await prisma.$executeRawUnsafe(
      `
      UPDATE employees
      SET manager_id = $2::uuid, updated_by = $3::uuid, updated_at = NOW()
      WHERE id = $1::uuid
    `,
      resolvedId,
      managerEmployeeId,
      updatedByUserId
    );
    const updatedRows = await prisma.$queryRawUnsafe<Array<{ id: string; employee_id: string; manager_id: string | null }>>(
      'SELECT id, employee_id, manager_id FROM employees WHERE id = $1::uuid LIMIT 1',
      resolvedId
    );
    const updated = updatedRows[0];

    await prisma.auditLog.create({
      data: {
        userId: updatedByUserId,
        action: 'hr.manager_assigned',
        entityType: 'employee',
        entityId: resolvedId,
        oldValues: { managerId: employee.manager_id },
        newValues: { managerId: managerEmployeeId },
      },
    });

    const audience = await this.getEmployeeAudience(resolvedId);
    await this.notifyHrms(
      'hrms_manager_assigned',
      updatedByUserId,
      [audience.employeeUserId, audience.managerUserId, ...audience.adminUserIds],
      {
        employeeId,
        employeeName: audience.employeeName,
        managerId: managerEmployeeId,
        managerName: audience.managerName,
      }
    );

    return {
      id: updated.id,
      employeeId: updated.employee_id,
      managerId: updated.manager_id,
    };
  }

  async changeEmployeeRole(employeeId: string, roleName: 'manager' | 'employee', updatedByUserId: string) {
    const employee = await this.getEmployeeById(employeeId);
    if (!employee.user_id) {
      throw ApiError.unprocessable('Employee has no linked user account', 'USER_NOT_LINKED');
    }
    const roleId = await this.getRoleIdByName(roleName);

    await prisma.user.update({
      where: { id: employee.user_id },
      data: { roleId },
    });

    await prisma.auditLog.create({
      data: {
        userId: updatedByUserId,
        action: 'hr.employee_role_changed',
        entityType: 'employee',
        entityId: employeeId,
        oldValues: { role: employee.role_name || null },
        newValues: { role: roleName },
      },
    });

    const audience = await this.getEmployeeAudience(employeeId);
    await this.notifyHrms(
      'hrms_role_changed',
      updatedByUserId,
      [audience.employeeUserId, audience.managerUserId, ...audience.adminUserIds],
      {
        employeeId,
        employeeName: audience.employeeName,
        oldRole: employee.role_name || null,
        newRole: roleName,
      }
    );

    return { employeeId, role: roleName };
  }

  async getEmployeeByIdDetailed(employeeId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    const whereClause = isUuid
      ? `WHERE e.id = $1::uuid AND e.deleted_at IS NULL`
      : `WHERE LOWER(e.employee_id) = LOWER($1) AND e.deleted_at IS NULL`;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        e.id,
        e.employee_id as "employeeId",
        e.first_name as "firstName",
        e.last_name as "lastName",
        u.avatar_url as "avatarUrl",
        e.email,
        e.phone,
        e.date_of_birth as "dateOfBirth",
        e.gender::text as gender,
        e.joining_date as "joiningDate",
        e.exit_date as "exitDate",
        e.designation,
        e.department,
        e.work_mode as "workMode",
        e.work_location as "workLocation",
        e.country,
        e.status::text as status,
        e.branch_id as "branchId",
        (
          SELECT b->>'name'
          FROM system_settings ss,
               jsonb_array_elements(ss.setting_value::jsonb) AS b
          WHERE ss.setting_key = 'org.branches' AND b->>'id' = e.branch_id
          LIMIT 1
        ) as "branchName",
        ep.personal_email as "personalEmail",
        ep.blood_group as "bloodGroup",
        ep.marital_status::text as "maritalStatus",
        ep.current_address as "currentAddress",
        ep.permanent_address as "permanentAddress",
        ep.emergency_contact_name as "emergencyContactName",
        ep.emergency_contact_phone as "emergencyContactPhone",
        ep.emergency_contact_relation as "emergencyContactRelation",
        ep.bank_name as "bankName",
        ep.bank_account_number as "bankAccountNumber",
        ep.bank_ifsc_code as "bankIfscCode",
        ep.bank_branch_name as "bankBranchName",
        ep.bank_account_holder_name as "bankAccountHolderName",
        u.id as "user.id",
        u.email as "user.email",
        e.email as "workEmail",
        u.avatar_url as "user.avatarUrl",
        r.name as "user.role",
        m.id as "manager.id",
        m.employee_id as "manager.employeeId",
        m.first_name as "manager.firstName",
        m.last_name as "manager.lastName",
        mu.avatar_url as "manager.avatarUrl"
      FROM employees e
      LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN users mu ON mu.id = m.user_id
      ${whereClause}
      LIMIT 1
    `,
      employeeId
    );
    if (!rows[0]) {
      throw ApiError.notFound('Employee not found', 'EMPLOYEE_NOT_FOUND');
    }

    // Use the resolved UUID for all subsequent queries (supports slug-based lookup)
    const resolvedUuid: string = rows[0].id;

    const monthSummaryRows = await prisma.$queryRawUnsafe<
      Array<{ month: number; year: number; presentDays: number; workingDays: number }>
    >(
      `
      WITH bounds AS (
        SELECT
          DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Kolkata'))::date AS start_date,
          (DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Kolkata')) + INTERVAL '1 month - 1 day')::date AS end_date
      ),
      working_days AS (
        SELECT d::date AS dt
        FROM bounds b
        JOIN GENERATE_SERIES(b.start_date, b.end_date, INTERVAL '1 day') d ON TRUE
        WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
          AND NOT EXISTS (
            SELECT 1
            FROM holidays h
            WHERE h.date = d::date
          )
      ),
      present_days AS (
        SELECT COUNT(*)::int AS present_days
        FROM attendance a
        JOIN bounds b ON a.date BETWEEN b.start_date AND b.end_date
        WHERE a.employee_id = $1::uuid
          AND a.status IN ('present', 'checked_in')
      )
      SELECT
        EXTRACT(MONTH FROM b.start_date)::int AS month,
        EXTRACT(YEAR FROM b.start_date)::int AS year,
        COALESCE(p.present_days, 0)::int AS "presentDays",
        (SELECT COUNT(*)::int FROM working_days)::int AS "workingDays"
      FROM bounds b
      LEFT JOIN present_days p ON TRUE
      LIMIT 1
    `,
      resolvedUuid
    );

    const monthSummary = monthSummaryRows[0] || {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      presentDays: 0,
      workingDays: 0,
    };
    const workingDays = Number(monthSummary.workingDays || 0);
    const presentDays = Number(monthSummary.presentDays || 0);
    const absentDays = Math.max(0, workingDays - presentDays);
    const attendanceRate = workingDays > 0 ? Math.round((presentDays / workingDays) * 10000) / 100 : 0;

    const leaveSummary = await workforceService.getEmployeeLeaveSummaryByEmployeeId(
      resolvedUuid,
      monthSummary.year
    );
    const leaveBalance = {
      year: leaveSummary.year,
      casual: leaveSummary.casual,
      sick: leaveSummary.sick,
      earned: leaveSummary.earned,
      lop: leaveSummary.lop,
      totalAvailable:
        Math.round(
          (Number(leaveSummary.casual || 0) +
            Number(leaveSummary.sick || 0) +
            Number(leaveSummary.earned || 0) +
            Number(leaveSummary.lop || 0)) * 100
        ) / 100,
      cards: leaveSummary.cards,
    };

    const directReportRows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        e.id,
        e.employee_id as "employeeCode",
        e.first_name as "firstName",
        e.last_name as "lastName",
        e.designation,
        e.department,
        u.avatar_url as "avatarUrl"
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.manager_id = $1::uuid AND e.deleted_at IS NULL
      ORDER BY e.first_name, e.last_name
    `,
      resolvedUuid
    );

    const directReports = directReportRows.map(r => ({
      id: r.id,
      employeeCode: r.employeeCode,
      name: `${r.firstName} ${r.lastName}`.trim(),
      designation: r.designation,
      department: r.department,
      avatarUrl: normalizeMediaUrl(r.avatarUrl),
    }));

    return {
      ...normalizeRowAvatars(rows[0]),
      currentMonthAttendance: {
        month: monthSummary.month,
        year: monthSummary.year,
        presentDays,
        workingDays,
        absentDays,
        attendanceRate,
        display: `${presentDays}/${workingDays}`,
      },
      leaveBalance,
      directReports,
    };
  }

  async updateEmployee(
    employeeId: string,
    payload: Record<string, unknown>,
    updatedByUserId: string
  ) {
    const existing = await this.getEmployeeById(employeeId);

    if (payload.joiningDate) {
      await this.ensureJoiningDateIsValid(new Date(payload.joiningDate as string));
    }

    const updatedRows = await prisma.$queryRawUnsafe<
      Array<{ id: string; employee_id: string; status: string }>
    >(
      `
      UPDATE employees
      SET
        first_name = COALESCE($2, first_name),
        last_name = CASE WHEN $3::text IS NULL THEN last_name ELSE $3 END,
        email = CASE WHEN $4::text IS NULL THEN email ELSE $4 END,
        phone = CASE WHEN $5::text IS NULL THEN phone ELSE $5 END,
        date_of_birth = CASE WHEN $6::date IS NULL THEN date_of_birth ELSE $6::date END,
        joining_date = CASE WHEN $7::date IS NULL THEN joining_date ELSE $7::date END,
        designation = COALESCE($8, designation),
        department = COALESCE($9, department),
        work_mode = CASE WHEN $10::text IS NULL THEN work_mode ELSE $10 END,
        work_location = CASE WHEN $11::text IS NULL THEN work_location ELSE $11 END,
        country = CASE WHEN $12::text IS NULL THEN country ELSE $12 END,
        status = CASE WHEN $13::text IS NULL THEN status ELSE $13::employee_status END,
        updated_by = $14::uuid,
        updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING id, employee_id, status::text
    `,
      existing.id,
      (payload.firstName as string | undefined) ?? null,
      (payload.lastName as string | undefined) ?? null,
      (payload.email as string | undefined) ?? null,
      payload.phone === undefined ? null : (payload.phone as string | null),
      payload.dateOfBirth === undefined ? null : (payload.dateOfBirth as string | null),
      (payload.joiningDate as string | undefined) ?? null,
      (payload.designation as string | undefined) ?? null,
      (payload.department as string | undefined) ?? null,
      payload.workMode === undefined ? null : (payload.workMode as string | null),
      payload.workLocation === undefined ? null : (payload.workLocation as string | null),
      payload.country === undefined ? null : (payload.country as string | null),
      (payload.status as string | undefined) ?? null,
      updatedByUserId
    );

    const updated = updatedRows[0];
    if (existing.user_id && (payload.status || payload.email)) {
      await prisma.user.update({
        where: { id: existing.user_id },
        data: {
          ...(payload.status ? { isActive: isUserActiveForEmployeeStatus(updated.status as EmployeeStatusValue) } : {}),
          ...(payload.email ? { email: payload.email as string } : {}),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: updatedByUserId,
        action: 'hr.employee_updated',
        entityType: 'employee',
        entityId: existing.id,
        oldValues: {
          status: existing.status,
        },
        newValues: payload as any,
      },
    });

    if (payload.status && String(payload.status) !== existing.status) {
      const audience = await this.getEmployeeAudience(existing.id);
      await this.notifyHrms(
        'hrms_employee_status_changed',
        updatedByUserId,
        [audience.employeeUserId, audience.managerUserId, ...audience.adminUserIds],
        {
          employeeId: existing.id,
          employeeName: audience.employeeName,
          oldStatus: existing.status,
          newStatus: updated.status,
        }
      );
    }

    // Update gender on employees table if provided
    if (payload.gender) {
      await prisma.$executeRawUnsafe(
        `UPDATE employees SET gender = $2::gender WHERE id = $1::uuid`,
        existing.id,
        payload.gender as string
      );
    }

    // Update personal email in employee_profiles if provided
    if (payload.personalEmail !== undefined) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO employee_profiles (employee_id, personal_email)
         VALUES ($1::uuid, $2)
         ON CONFLICT (employee_id) DO UPDATE SET
           personal_email = EXCLUDED.personal_email,
           updated_at = NOW()`,
        existing.id,
        (payload.personalEmail as string | null) || null
      );
    }

    // Update personal email in employee_profiles if provided
    if (payload.personalEmail !== undefined) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO employee_profiles (employee_id, personal_email)
         VALUES ($1::uuid, $2)
         ON CONFLICT (employee_id) DO UPDATE SET
           personal_email = EXCLUDED.personal_email,
           updated_at = NOW()`,
        existing.id,
        (payload.personalEmail as string | null) || null
      );
    }

    // Update branch_id if provided
    if (payload.branchId !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE employees SET branch_id = $2 WHERE id = $1::uuid`,
        existing.id,
        (payload.branchId as string | null) || null
      );

      // If this employee has a user with HR role, also update hr.branch_assignments system setting
      if (existing.user_id) {
        const roleRows = await prisma.$queryRawUnsafe<Array<{ role_name: string }>>(
          `SELECT r.name as role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1::uuid LIMIT 1`,
          existing.user_id
        );
        if (roleRows[0]?.role_name === 'hr') {
          const HR_BRANCH_MAP_KEY = 'hr.branch_assignments';
          const settingRows = await prisma.$queryRawUnsafe<Array<{ setting_value: unknown }>>(
            'SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1',
            HR_BRANCH_MAP_KEY
          );
          const raw = settingRows[0]?.setting_value;
          const branchMap: Record<string, string> = raw
            ? (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, string>
            : {};

          const newBranchId = (payload.branchId as string | null) || null;
          if (newBranchId) {
            branchMap[existing.user_id] = newBranchId;
          } else {
            delete branchMap[existing.user_id];
          }

          await prisma.$executeRawUnsafe(
            `INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
             VALUES ($1, $2::jsonb, $3, $4::uuid)
             ON CONFLICT (setting_key) DO UPDATE SET
               setting_value = EXCLUDED.setting_value,
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()`,
            HR_BRANCH_MAP_KEY,
            JSON.stringify(branchMap),
            'HR user to branch assignment map',
            updatedByUserId
          );
        }
      }
    }

    // Update manager_id if provided
    if (payload.managerId !== undefined) {
      const newManagerId = (payload.managerId as string | null) || null;
      const currentManagerId = existing.manager_id || null;

      if (newManagerId !== currentManagerId) {
        if (newManagerId) {
          // Validate and assign new manager (checks self-assignment, active status, role, circular refs)
          await this.validateManagerAssignment(existing.id, newManagerId);
          await prisma.$executeRawUnsafe(
            `UPDATE employees SET manager_id = $2::uuid, updated_by = $3::uuid, updated_at = NOW() WHERE id = $1::uuid`,
            existing.id,
            newManagerId,
            updatedByUserId
          );
        } else {
          // Remove manager (set to null)
          await prisma.$executeRawUnsafe(
            `UPDATE employees SET manager_id = NULL, updated_by = $2::uuid, updated_at = NOW() WHERE id = $1::uuid`,
            existing.id,
            updatedByUserId
          );
        }

        // Audit log for manager change
        await prisma.auditLog.create({
          data: {
            userId: updatedByUserId,
            action: 'hr.manager_assigned',
            entityType: 'employee',
            entityId: existing.id,
            oldValues: { managerId: currentManagerId },
            newValues: { managerId: newManagerId },
          },
        });
      }
    }

    // Update manager_id if provided
    if (payload.managerId !== undefined) {
      const newManagerId = (payload.managerId as string | null) || null;
      const currentManagerId = existing.manager_id || null;

      if (newManagerId !== currentManagerId) {
        if (newManagerId) {
          // Validate and assign new manager (checks self-assignment, active status, role, circular refs)
          await this.validateManagerAssignment(existing.id, newManagerId);
          await prisma.$executeRawUnsafe(
            `UPDATE employees SET manager_id = $2::uuid, updated_by = $3::uuid, updated_at = NOW() WHERE id = $1::uuid`,
            existing.id,
            newManagerId,
            updatedByUserId
          );
        } else {
          // Remove manager (set to null)
          await prisma.$executeRawUnsafe(
            `UPDATE employees SET manager_id = NULL, updated_by = $2::uuid, updated_at = NOW() WHERE id = $1::uuid`,
            existing.id,
            updatedByUserId
          );
        }

        // Audit log for manager change
        await prisma.auditLog.create({
          data: {
            userId: updatedByUserId,
            action: 'hr.manager_assigned',
            entityType: 'employee',
            entityId: existing.id,
            oldValues: { managerId: currentManagerId },
            newValues: { managerId: newManagerId },
          },
        });
      }
    }

    return updated;
  }

  async softDeleteEmployee(employeeId: string, deletedByUserId: string) {
    const employee = await this.getEmployeeById(employeeId);
    const resolvedId = employee.id;
    const activeReporteesCountRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `
      SELECT COUNT(*)::text as count
      FROM employees
      WHERE manager_id = $1::uuid
        AND deleted_at IS NULL
        AND status NOT IN ('exited', 'deleted')
    `,
      resolvedId
    );
    const activeReporteesCount = parseInt(activeReporteesCountRows[0]?.count || '0', 10);
    if (activeReporteesCount > 0) {
      throw ApiError.unprocessable(
        `Cannot delete employee with ${activeReporteesCount} active reportees. Reassign them first.`,
        'ACTIVE_REPORTEES_EXIST'
      );
    }

    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(
        `
        UPDATE employees
        SET status = 'deleted', deleted_at = NOW(), deleted_by = $2::uuid, updated_by = $2::uuid, updated_at = NOW()
        WHERE id = $1::uuid
      `,
        resolvedId,
        deletedByUserId
      );
      if (employee.user_id) {
        await tx.user.update({
          where: { id: employee.user_id },
          data: { isActive: false },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: deletedByUserId,
          action: 'hr.employee_deleted',
          entityType: 'employee',
          entityId: resolvedId,
          oldValues: { status: employee.status },
          newValues: { status: 'deleted' },
        },
      });
    });

    return { employeeId: resolvedId, status: 'deleted' };
  }

  async hardDeleteEmployee(employeeId: string) {
    const employee = await this.getEmployeeById(employeeId);
    const resolvedId = employee.id;
    await prisma.$transaction(async (tx) => {
      // Delete RESTRICT-constrained employee tables first
      await tx.$executeRawUnsafe(`DELETE FROM attendance_logs WHERE employee_id = $1::uuid`, resolvedId);
      await tx.$executeRawUnsafe(`DELETE FROM attendance WHERE employee_id = $1::uuid`, resolvedId);
      await tx.$executeRawUnsafe(`DELETE FROM attendance_regularization_requests WHERE employee_id = $1::uuid`, resolvedId);
      await tx.$executeRawUnsafe(`DELETE FROM leave_balances WHERE employee_id = $1::uuid`, resolvedId);
      await tx.$executeRawUnsafe(`DELETE FROM leaves WHERE employee_id = $1::uuid`, resolvedId);
      await tx.$executeRawUnsafe(`DELETE FROM payroll WHERE employee_id = $1::uuid`, resolvedId);
      await tx.$executeRawUnsafe(`DELETE FROM approvals WHERE requester_id = $1::uuid`, resolvedId);
      await tx.$executeRawUnsafe(`DELETE FROM offboarding WHERE employee_id = $1::uuid`, resolvedId);
      // Delete employee — CASCADE handles: employee_profiles, employee_documents,
      // onboarding → onboarding_tasks, onboarding_invites, onboarding_otps
      await tx.$executeRawUnsafe(`DELETE FROM employees WHERE id = $1::uuid`, resolvedId);
      // Delete linked user: NULL out all RESTRICT FK references first
      if (employee.user_id) {
        const uid = employee.user_id;
        await tx.$executeRawUnsafe(`UPDATE holidays SET created_by = NULL WHERE created_by = $1::uuid`, uid);
        await tx.$executeRawUnsafe(`UPDATE holidays SET updated_by = NULL WHERE updated_by = $1::uuid`, uid);
        await tx.$executeRawUnsafe(`UPDATE issues SET assignee_id = NULL WHERE assignee_id = $1::uuid`, uid);
        await tx.$executeRawUnsafe(`UPDATE issues SET reporter_id = NULL WHERE reporter_id = $1::uuid`, uid);
        await tx.$executeRawUnsafe(`DELETE FROM project_members WHERE user_id = $1::uuid`, uid);
        await tx.$executeRawUnsafe(`DELETE FROM audit_logs WHERE user_id = $1::uuid`, uid);
        await tx.$executeRawUnsafe(`UPDATE users SET role_id = NULL WHERE id = $1::uuid`, uid);
        await tx.$executeRawUnsafe(`DELETE FROM users WHERE id = $1::uuid`, uid);
      }
    });
    return { employeeId, deleted: true };
  }

  async purgeAllEmployees(excludeEmails: string[]) {
    // Validate all emails are strings to prevent injection via non-string array elements
    const safeEmails = excludeEmails.filter(e => typeof e === 'string' && e.length > 0 && e.length < 256);
    const placeholders = safeEmails.map((_, i) => `$${i + 1}`).join(', ');
    const excludeClause = safeEmails.length > 0
      ? `AND e.email NOT IN (${placeholders})`
      : '';

    // Get all employees (and their linked user IDs) to delete
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; user_id: string | null }>>(
      `SELECT e.id, e.user_id FROM employees e WHERE 1=1 ${excludeClause}`,
      ...safeEmails
    );

    if (rows.length === 0) return { deleted: 0 };

    const employeeIds = rows.map(r => r.id);
    const userIds = rows.filter(r => r.user_id).map(r => r.user_id as string);
    const empIdList = employeeIds.map((_, i) => `$${i + 1}::uuid`).join(', ');

    await prisma.$transaction(async (tx) => {
      // Delete RESTRICT-constrained employee data first
      await tx.$executeRawUnsafe(`DELETE FROM attendance WHERE employee_id IN (${empIdList})`, ...employeeIds);
      await tx.$executeRawUnsafe(`DELETE FROM leaves WHERE employee_id IN (${empIdList})`, ...employeeIds);
      await tx.$executeRawUnsafe(`DELETE FROM payroll WHERE employee_id IN (${empIdList})`, ...employeeIds);
      await tx.$executeRawUnsafe(`DELETE FROM approvals WHERE requester_id IN (${empIdList})`, ...employeeIds);
      await tx.$executeRawUnsafe(`DELETE FROM offboarding WHERE employee_id IN (${empIdList})`, ...employeeIds);
      // Delete employees (cascades: employee_profiles, employee_documents, leave_balances,
      // onboarding → onboarding_tasks, onboarding_invites, onboarding_otps)
      await tx.$executeRawUnsafe(`DELETE FROM employees WHERE id IN (${empIdList})`, ...employeeIds);

      // Delete linked users: NULL out all RESTRICT FK references first
      if (userIds.length > 0) {
        const userIdList = userIds.map((_, i) => `$${i + 1}::uuid`).join(', ');
        await tx.$executeRawUnsafe(`UPDATE holidays SET created_by = NULL WHERE created_by IN (${userIdList})`, ...userIds);
        await tx.$executeRawUnsafe(`UPDATE holidays SET updated_by = NULL WHERE updated_by IN (${userIdList})`, ...userIds);
        await tx.$executeRawUnsafe(`UPDATE issues SET assignee_id = NULL WHERE assignee_id IN (${userIdList})`, ...userIds);
        await tx.$executeRawUnsafe(`UPDATE issues SET reporter_id = NULL WHERE reporter_id IN (${userIdList})`, ...userIds);
        await tx.$executeRawUnsafe(`DELETE FROM project_members WHERE user_id IN (${userIdList})`, ...userIds);
        await tx.$executeRawUnsafe(`DELETE FROM audit_logs WHERE user_id IN (${userIdList})`, ...userIds);
        await tx.$executeRawUnsafe(`UPDATE users SET role_id = NULL WHERE id IN (${userIdList})`, ...userIds);
        await tx.$executeRawUnsafe(`DELETE FROM users WHERE id IN (${userIdList})`, ...userIds);
      }
    }, { timeout: 60000 });

    return { deleted: employeeIds.length };
  }

  async initiateOnboarding(
    employeeId: string,
    initiatedByUserId: string,
    payload: { targetCompletionDate?: string }
  ) {
    const employee = await this.getEmployeeById(employeeId);
    const resolvedId = employee.id;
    if (employee.status === 'deleted' || employee.status === 'exited') {
      throw ApiError.unprocessable('Cannot initiate onboarding for deleted/exited employee', 'INVALID_STATUS');
    }
    const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM onboarding WHERE employee_id = $1::uuid LIMIT 1',
      resolvedId
    );
    if (existingRows[0]) {
      throw ApiError.conflict('Onboarding already exists for this employee', 'ONBOARDING_EXISTS');
    }

    const targetDate = payload.targetCompletionDate || new Date().toISOString().slice(0, 10);

    // Load templates from DB; fall back to hardcoded list if none configured
    const templates = await prisma.$queryRawUnsafe<Array<{
      task_name: string; phase: string | null; assignee: string | null; task_order: number;
    }>>(
      `SELECT task_name, phase, assignee, task_order
       FROM onboarding_task_templates WHERE is_active = true ORDER BY task_order ASC`
    );
    const tasksToCreate = templates.length > 0
      ? templates
      : ONBOARDING_TASKS.map((name, i) => ({ task_name: name, phase: null, assignee: null, task_order: i + 1 }));

    const totalTasks = tasksToCreate.length;
    const onboardingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO onboarding (employee_id, target_completion_date, progress, status)
      VALUES ($1::uuid, $2::date, $3, 'in_progress')
      RETURNING id
    `,
      resolvedId,
      targetDate,
      `0/${totalTasks}`
    );
    const onboardingId = onboardingRows[0].id;

    for (const task of tasksToCreate) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO onboarding_tasks (onboarding_id, task_name, phase, assignee, task_order, completed)
         VALUES ($1::uuid, $2, $3, $4, $5, false)`,
        onboardingId, task.task_name, task.phase, task.assignee, task.task_order
      );
    }

    await prisma.$executeRawUnsafe(
      `
      UPDATE employees
      SET status = 'onboarding', updated_by = $2::uuid, updated_at = NOW()
      WHERE id = $1::uuid
    `,
      resolvedId,
      initiatedByUserId
    );
    if (employee.user_id) {
      await prisma.user.update({
        where: { id: employee.user_id },
        data: { isActive: false },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: initiatedByUserId,
        action: 'hr.onboarding_initiated',
        entityType: 'onboarding',
        entityId: onboardingId,
        newValues: { employeeId: resolvedId },
      },
    });

    {
      const audience = await this.getEmployeeAudience(resolvedId);
      await this.notifyHrms(
        'hrms_onboarding_initiated',
        initiatedByUserId,
        [audience.employeeUserId, audience.managerUserId, ...audience.adminUserIds],
        {
          employeeId: resolvedId,
          employeeName: audience.employeeName,
          targetCompletionDate: targetDate,
        }
      );
    }

    return { onboardingId, employeeId: resolvedId, status: 'in_progress' };
  }

  async listOnboarding(filters: { status?: string; branchId?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const items = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        o.id,
        o.employee_id as "employeeId",
        o.status::text as status,
        o.progress,
        o.started_at as "startedAt",
        o.target_completion_date as "targetCompletionDate",
        e.employee_id as "employeeCode",
        e.first_name as "employeeFirstName",
        e.last_name as "employeeLastName"
      FROM onboarding o
      JOIN employees e ON e.id = o.employee_id
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE e.deleted_at IS NULL
        AND (r.name IS NULL OR r.name != 'admin')
        AND ($1::text IS NULL OR o.status::text = $1)
        AND ($4::text IS NULL OR e.branch_id = $4)
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      filters.status || null,
      limit,
      skip,
      filters.branchId || null
    );
    const totalRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `
      SELECT COUNT(*)::text as count
      FROM onboarding o
      JOIN employees e ON e.id = o.employee_id
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE e.deleted_at IS NULL
        AND (r.name IS NULL OR r.name != 'admin')
        AND ($1::text IS NULL OR o.status::text = $1)
        AND ($2::text IS NULL OR e.branch_id = $2)
    `,
      filters.status || null,
      filters.branchId || null
    );
    const total = parseInt(totalRows[0]?.count || '0', 10);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOnboardingByEmployee(employeeId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    const whereClause = isUuid
      ? `o.employee_id = $1::uuid`
      : `o.employee_id = (SELECT id FROM employees WHERE LOWER(employee_id) = LOWER($1) AND deleted_at IS NULL LIMIT 1)`;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        o.id,
        o.employee_id as "employeeId",
        o.status::text as status,
        o.progress,
        o.started_at as "startedAt",
        o.target_completion_date as "targetCompletionDate",
        o.completed_at as "completedAt"
      FROM onboarding o
      WHERE ${whereClause}
      LIMIT 1
    `,
      employeeId
    );
    if (!rows[0]) throw ApiError.notFound('Onboarding not found', 'ONBOARDING_NOT_FOUND');

    // Auto-migrate: if the current task count doesn't match the active templates,
    // silently replace tasks so the checklist always reflects the latest template.
    const templateRows = await prisma.$queryRawUnsafe<Array<{
      task_name: string; phase: string | null; assignee: string | null; task_order: number;
    }>>(
      `SELECT task_name, phase, assignee, task_order
       FROM onboarding_task_templates WHERE is_active = true ORDER BY task_order ASC`
    );
    if (templateRows.length > 0) {
      const taskCountRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
        `SELECT COUNT(*)::text as count FROM onboarding_tasks WHERE onboarding_id = $1::uuid`,
        rows[0].id
      );
      const existingCount = parseInt(taskCountRows[0]?.count || '0', 10);
      if (existingCount !== templateRows.length) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM onboarding_tasks WHERE onboarding_id = $1::uuid`,
          rows[0].id
        );
        for (const t of templateRows) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO onboarding_tasks (onboarding_id, task_name, phase, assignee, task_order, completed)
             VALUES ($1::uuid, $2, $3, $4, $5, false)`,
            rows[0].id, t.task_name, t.phase, t.assignee, t.task_order
          );
        }
        await prisma.$executeRawUnsafe(
          `UPDATE onboarding SET progress = $2, updated_at = NOW() WHERE id = $1::uuid`,
          rows[0].id, `0/${templateRows.length}`
        );
      }
    }

    const tasks = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, task_name as "taskName", task_order as "taskOrder",
             phase, assignee, completed, notes, completed_at as "completedAt"
      FROM onboarding_tasks
      WHERE onboarding_id = $1::uuid
      ORDER BY task_order ASC
    `,
      rows[0].id
    );
    return { ...rows[0], tasks };
  }

  async updateOnboardingTask(
    onboardingId: string,
    taskId: string,
    payload: { completed: boolean; notes?: string },
    updatedByUserId: string
  ) {
    await prisma.$executeRawUnsafe(
      `
      UPDATE onboarding_tasks
      SET
        completed = $3,
        notes = COALESCE($4, notes),
        completed_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
        completed_by = CASE WHEN $3 THEN $5::uuid ELSE NULL END,
        updated_at = NOW()
      WHERE id = $1::uuid AND onboarding_id = $2::uuid
    `,
      taskId,
      onboardingId,
      payload.completed,
      payload.notes || null,
      updatedByUserId
    );
    const progressRows = await prisma.$queryRawUnsafe<Array<{ total: string; done: string }>>(
      `
      SELECT COUNT(*)::text as total, COUNT(*) FILTER (WHERE completed = true)::text as done
      FROM onboarding_tasks
      WHERE onboarding_id = $1::uuid
    `,
      onboardingId
    );
    const total = parseInt(progressRows[0]?.total || '0', 10);
    const done = parseInt(progressRows[0]?.done || '0', 10);
    // Auto-complete onboarding status when all tasks are done
    if (total > 0 && done === total) {
      await prisma.$executeRawUnsafe(
        `UPDATE onboarding SET progress = $2, status = 'completed', completed_at = NOW(), completed_by = $3::uuid, updated_at = NOW() WHERE id = $1::uuid`,
        onboardingId,
        `${done}/${total}`,
        updatedByUserId
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE onboarding SET progress = $2, updated_at = NOW() WHERE id = $1::uuid`,
        onboardingId,
        `${done}/${total}`
      );
    }

    // ── Auto-activate employee when all pre_boarding AND day_1 tasks are done ──
    let autoActivated = false;
    if (payload.completed) {
      const coreRows = await prisma.$queryRawUnsafe<Array<{ total: string; done: string }>>(
        `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE completed = true)::text AS done
         FROM   onboarding_tasks
         WHERE  onboarding_id = $1::uuid
           AND  phase IN ('pre_boarding', 'day_1')`,
        onboardingId
      );
      const coreTotal = parseInt(coreRows[0]?.total || '0', 10);
      const coreDone  = parseInt(coreRows[0]?.done  || '0', 10);

      if (coreTotal > 0 && coreDone === coreTotal) {
        // Fetch the employee linked to this onboarding record
        const empRows = await prisma.$queryRawUnsafe<Array<{ employee_id: string }>>(
          `SELECT employee_id FROM onboarding WHERE id = $1::uuid LIMIT 1`,
          onboardingId
        );
        const employeeId = empRows[0]?.employee_id;
        if (employeeId) {
          const updated = await prisma.$executeRawUnsafe(
            `UPDATE employees
             SET    status     = 'active',
                    updated_by = $2::uuid,
                    updated_at = NOW()
             WHERE  id = $1::uuid
               AND  status = 'onboarding'`,
            employeeId,
            updatedByUserId
          );
          autoActivated = (updated as number) > 0;
        }
      }
    }

    return { onboardingId, taskId, progress: `${done}/${total}`, autoActivated };
  }

  async completeOnboarding(employeeId: string, completedByUserId: string) {
    const onboarding = await this.getOnboardingByEmployee(employeeId);
    const resolvedId = (onboarding.employeeId as string);
    const tasks = onboarding.tasks as Array<{ completed: boolean }>;
    if (tasks.some(t => !t.completed)) {
      throw ApiError.unprocessable('All onboarding tasks must be completed', 'ONBOARDING_TASKS_PENDING');
    }

    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(
        `
        UPDATE onboarding
        SET status = 'completed', completed_at = NOW(), completed_by = $2::uuid, updated_at = NOW()
        WHERE employee_id = $1::uuid
      `,
        resolvedId,
        completedByUserId
      );
      await tx.$executeRawUnsafe(
        `
        UPDATE employees
        SET status = 'active', updated_by = $2::uuid, updated_at = NOW()
        WHERE id = $1::uuid
      `,
        resolvedId,
        completedByUserId
      );
      const userRows = await tx.$queryRawUnsafe<Array<{ user_id: string | null }>>(
        'SELECT user_id FROM employees WHERE id = $1::uuid LIMIT 1',
        resolvedId
      );
      const userId = userRows[0]?.user_id;
      if (userId) {
        await tx.user.update({ where: { id: userId }, data: { isActive: true } });
      }
      await tx.auditLog.create({
        data: {
          userId: completedByUserId,
          action: 'hr.onboarding_completed',
          entityType: 'onboarding',
          entityId: onboarding.id,
          newValues: { employeeId: resolvedId },
        },
      });
    });

    {
      const audience = await this.getEmployeeAudience(resolvedId);
      await this.notifyHrms(
        'hrms_onboarding_completed',
        completedByUserId,
        [audience.employeeUserId, audience.managerUserId, ...audience.adminUserIds],
        {
          employeeId: resolvedId,
          employeeName: audience.employeeName,
          newStatus: 'active',
        }
      );
    }

    return { employeeId: resolvedId, status: 'active' };
  }

  async initiateOffboarding(
    employeeId: string,
    payload: { lastWorkingDay: string; exitReason: string; additionalNotes?: string },
    initiatedByUserId: string
  ) {
    const employee = await this.getEmployeeById(employeeId);
    const resolvedId = employee.id;
    if (employee.status !== 'active') {
      throw ApiError.unprocessable('Only active employees can be offboarded', 'INVALID_STATUS');
    }

    // Prevent offboarding the last HR account
    if (employee.role_name === 'hr') {
      const hrCountRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
        `SELECT COUNT(*)::text as count
         FROM users u
         JOIN roles r ON r.id = u.role_id
         JOIN employees e ON e.user_id = u.id
         WHERE r.name = 'hr'
           AND u.deleted_at IS NULL
           AND e.deleted_at IS NULL
           AND e.status = 'active'`
      );
      const activeHrCount = parseInt(hrCountRows[0]?.count || '0', 10);
      if (activeHrCount <= 1) {
        throw ApiError.unprocessable(
          'Cannot offboard the last active HR account. At least one HR account must remain active.',
          'LAST_HR_ACCOUNT'
        );
      }
    }

    const reporteesCountRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `
      SELECT COUNT(*)::text as count
      FROM employees
      WHERE manager_id = $1::uuid
        AND deleted_at IS NULL
        AND status NOT IN ('exited', 'deleted')
    `,
      resolvedId
    );
    if (parseInt(reporteesCountRows[0]?.count || '0', 10) > 0) {
      throw ApiError.unprocessable('Reassign active reportees before offboarding', 'ACTIVE_REPORTEES_EXIST');
    }
    const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM offboarding WHERE employee_id = $1::uuid LIMIT 1',
      resolvedId
    );
    if (existingRows[0]) {
      throw ApiError.conflict('Offboarding already exists for this employee', 'OFFBOARDING_EXISTS');
    }

    const offboardingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO offboarding (employee_id, last_working_day, exit_reason, additional_notes, status, progress, initiated_by)
      VALUES ($1::uuid, $2::date, $3::offboarding_reason, $4, 'in_progress', '0/6', $5::uuid)
      RETURNING id
    `,
      resolvedId,
      payload.lastWorkingDay,
      payload.exitReason,
      payload.additionalNotes || null,
      initiatedByUserId
    );
    const offboardingId = offboardingRows[0].id;
    const tasks = [
      'Exit Reason Captured',
      'Laptop/Equipment Returned',
      'Access Revoked',
      'Knowledge Transfer Completed',
      'Final Payroll Processed',
      'Exit Interview Conducted',
    ];
    for (let i = 0; i < tasks.length; i += 1) {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO offboarding_tasks (offboarding_id, task_name, task_order, completed)
        VALUES ($1::uuid, $2, $3, false)
      `,
        offboardingId,
        tasks[i],
        i + 1
      );
    }

    await prisma.$executeRawUnsafe(
      `
      UPDATE employees
      SET status = 'notice_period', exit_date = $2::date, updated_by = $3::uuid, updated_at = NOW()
      WHERE id = $1::uuid
    `,
      resolvedId,
      payload.lastWorkingDay,
      initiatedByUserId
    );

    await prisma.auditLog.create({
      data: {
        userId: initiatedByUserId,
        action: 'hr.offboarding_initiated',
        entityType: 'offboarding',
        entityId: offboardingId,
        newValues: { employeeId: resolvedId, lastWorkingDay: payload.lastWorkingDay, exitReason: payload.exitReason },
      },
    });

    {
      const audience = await this.getEmployeeAudience(resolvedId);
      await this.notifyHrms(
        'hrms_offboarding_initiated',
        initiatedByUserId,
        [audience.employeeUserId, audience.managerUserId, ...audience.adminUserIds],
        {
          employeeId: resolvedId,
          employeeName: audience.employeeName,
          lastWorkingDay: payload.lastWorkingDay,
          exitReason: payload.exitReason,
        }
      );
    }

    return { offboardingId, employeeId: resolvedId, status: 'in_progress' };
  }

  async listOffboarding(filters: { status?: string; branchId?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    const normalizedStatus = filters.status && filters.status !== 'all' ? filters.status : null;
    const items = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT o.id, o.employee_id as "employeeId", o.status::text as status, o.progress,
             o.last_working_day as "lastWorkingDay", o.exit_reason::text as "exitReason",
             e.employee_id as "employeeCode", e.first_name as "employeeFirstName", e.last_name as "employeeLastName"
      FROM offboarding o
      JOIN employees e ON e.id = o.employee_id
      WHERE ($1::text IS NULL OR o.status::text = $1)
        AND ($4::text IS NULL OR e.branch_id = $4)
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      normalizedStatus,
      limit,
      skip,
      filters.branchId || null
    );
    const totalRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT COUNT(*)::text as count FROM offboarding o JOIN employees e ON e.id = o.employee_id
       WHERE ($1::text IS NULL OR o.status::text = $1) AND ($2::text IS NULL OR e.branch_id = $2)`,
      normalizedStatus,
      filters.branchId || null
    );
    const total = parseInt(totalRows[0]?.count || '0', 10);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getOffboardingByEmployee(employeeId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    const whereClause = isUuid
      ? `employee_id = $1::uuid`
      : `employee_id = (SELECT id FROM employees WHERE LOWER(employee_id) = LOWER($1) AND deleted_at IS NULL LIMIT 1)`;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, employee_id as "employeeId", status::text as status, progress,
             last_working_day as "lastWorkingDay", exit_reason::text as "exitReason",
             additional_notes as "additionalNotes", completed_at as "completedAt"
      FROM offboarding
      WHERE ${whereClause}
      LIMIT 1
    `,
      employeeId
    );
    if (!rows[0]) throw ApiError.notFound('Offboarding not found', 'OFFBOARDING_NOT_FOUND');
    const tasks = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, task_name as "taskName", task_order as "taskOrder", completed, notes, completed_at as "completedAt"
      FROM offboarding_tasks
      WHERE offboarding_id = $1::uuid
      ORDER BY task_order ASC
    `,
      rows[0].id
    );
    return { ...rows[0], tasks };
  }

  async updateOffboardingTask(
    offboardingId: string,
    taskId: string,
    payload: { completed: boolean; notes?: string },
    updatedByUserId: string
  ) {
    await prisma.$executeRawUnsafe(
      `
      UPDATE offboarding_tasks
      SET completed = $3,
          notes = COALESCE($4, notes),
          completed_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
          completed_by = CASE WHEN $3 THEN $5::uuid ELSE NULL END,
          updated_at = NOW()
      WHERE id = $1::uuid AND offboarding_id = $2::uuid
    `,
      taskId,
      offboardingId,
      payload.completed,
      payload.notes || null,
      updatedByUserId
    );
    const progressRows = await prisma.$queryRawUnsafe<Array<{ total: string; done: string }>>(
      `
      SELECT COUNT(*)::text as total, COUNT(*) FILTER (WHERE completed = true)::text as done
      FROM offboarding_tasks
      WHERE offboarding_id = $1::uuid
    `,
      offboardingId
    );
    const total = parseInt(progressRows[0]?.total || '0', 10);
    const done = parseInt(progressRows[0]?.done || '0', 10);
    await prisma.$executeRawUnsafe(
      'UPDATE offboarding SET progress = $2, updated_at = NOW() WHERE id = $1::uuid',
      offboardingId,
      `${done}/${total}`
    );
    return { offboardingId, taskId, progress: `${done}/${total}` };
  }

  async completeOffboarding(employeeId: string, completedByUserId: string) {
    const offboarding = await this.getOffboardingByEmployee(employeeId);
    const resolvedId = (offboarding.employeeId as string);
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(
        `
        UPDATE offboarding
        SET status = 'completed', completed_at = NOW(), completed_by = $2::uuid, access_revoked_at = NOW(), updated_at = NOW()
        WHERE employee_id = $1::uuid
      `,
        resolvedId,
        completedByUserId
      );
      await tx.$executeRawUnsafe(
        `
        UPDATE employees
        SET status = 'exited', updated_by = $2::uuid, updated_at = NOW()
        WHERE id = $1::uuid
      `,
        resolvedId,
        completedByUserId
      );
      const userRows = await tx.$queryRawUnsafe<Array<{ user_id: string | null }>>(
        'SELECT user_id FROM employees WHERE id = $1::uuid LIMIT 1',
        resolvedId
      );
      const userId = userRows[0]?.user_id;
      if (userId) {
        await tx.user.update({ where: { id: userId }, data: { isActive: false } });
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        // Disable Keycloak user to prevent further logins
        const kcRows = await tx.$queryRawUnsafe<Array<{ keycloak_sub: string | null }>>(
          'SELECT keycloak_sub FROM users WHERE id = $1::uuid LIMIT 1',
          userId
        );
        const keycloakSub = kcRows[0]?.keycloak_sub;
        if (keycloakSub) {
          // Fire-and-forget outside transaction; non-fatal
          disableKeycloakUser(keycloakSub).catch(() => {});
        }
      }
      await tx.auditLog.create({
        data: {
          userId: completedByUserId,
          action: 'hr.offboarding_completed',
          entityType: 'offboarding',
          entityId: offboarding.id,
          newValues: { employeeId: resolvedId },
        },
      });
    });

    {
      const audience = await this.getEmployeeAudience(resolvedId);
      await this.notifyHrms(
        'hrms_offboarding_completed',
        completedByUserId,
        [audience.employeeUserId, audience.managerUserId, ...audience.adminUserIds],
        {
          employeeId: resolvedId,
          employeeName: audience.employeeName,
          newStatus: 'exited',
        }
      );
    }
    return { employeeId: resolvedId, status: 'exited' };
  }

  async listAttendance(filters: {
    employeeId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    branchId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    // "late" is a computed status (not in DB enum), so we handle it post-query
    const isLateFilter = filters.status === 'late';
    const dbStatus = isLateFilter ? null : (filters.status || null);

    const items = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT a.id, a.employee_id as "employeeId", e.employee_id as "employeeCode",
             e.first_name as "employeeFirstName", e.last_name as "employeeLastName",
             e.department,
             a.date, a.check_in_time as "checkInTime", a.check_out_time as "checkOutTime",
             a.status::text as status, a.manual_correction as "manualCorrection",
             a.correction_reason as "correctionReason", a.work_hours as "workHours"
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE ($1::uuid IS NULL OR a.employee_id = $1::uuid)
        AND ($2::text IS NULL OR a.status::text = $2)
        AND ($3::date IS NULL OR a.date >= $3::date)
        AND ($4::date IS NULL OR a.date <= $4::date)
        -- Branch filter: include unbranched employees (admin / org-wide) so an
        -- HR scoped to one branch can still see them. Matches listEmployees.
        AND ($7::text IS NULL OR e.branch_id = $7 OR e.branch_id IS NULL)
        AND e.deleted_at IS NULL
        AND e.status NOT IN ('exited', 'deleted')
      ORDER BY a.date DESC
      LIMIT $5 OFFSET $6
    `,
      filters.employeeId || null,
      dbStatus,
      filters.fromDate || null,
      filters.toDate || null,
      isLateFilter ? 10000 : limit,
      isLateFilter ? 0 : skip,
      filters.branchId || null
    );

    let normalizedItems = items.map(row => normalizeAttendanceTimestamps(row));

    // Post-filter for "late" status
    if (isLateFilter) {
      normalizedItems = normalizedItems.filter((row: any) => row.isLate === true);
    }

    const totalRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `
      SELECT COUNT(*)::text as count
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE ($1::uuid IS NULL OR a.employee_id = $1::uuid)
        AND ($2::text IS NULL OR a.status::text = $2)
        AND ($3::date IS NULL OR a.date >= $3::date)
        AND ($4::date IS NULL OR a.date <= $4::date)
        -- Include unbranched employees (admin / org-wide) — matches the SELECT
        AND ($5::text IS NULL OR e.branch_id = $5 OR e.branch_id IS NULL)
        AND e.deleted_at IS NULL
        AND e.status NOT IN ('exited', 'deleted')
    `,
      filters.employeeId || null,
      dbStatus,
      filters.fromDate || null,
      filters.toDate || null,
      filters.branchId || null
    );
    const statusRows = await prisma.$queryRawUnsafe<Array<{ status: AttendanceStatusValue; count: string }>>(
      `
      SELECT a.status::text as status, COUNT(*)::text as count
      FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE ($1::uuid IS NULL OR a.employee_id = $1::uuid)
        AND ($2::text IS NULL OR a.status::text = $2)
        AND ($3::date IS NULL OR a.date >= $3::date)
        AND ($4::date IS NULL OR a.date <= $4::date)
        AND ($5::text IS NULL OR e.branch_id = $5)
        AND e.deleted_at IS NULL
        AND e.status NOT IN ('exited', 'deleted')
      GROUP BY a.status
    `,
      filters.employeeId || null,
      dbStatus,
      filters.fromDate || null,
      filters.toDate || null,
      filters.branchId || null
    );

    const total = isLateFilter
      ? normalizedItems.length
      : parseInt(totalRows[0]?.count || '0', 10);
    const statusCounts = statusRows.reduce(
      (acc, row) => {
        acc[row.status] = parseInt(row.count || '0', 10);
        return acc;
      },
      {} as Partial<Record<AttendanceStatusValue, number>>
    );

    // Apply pagination for late filter (post-filtered)
    let paginatedItems = isLateFilter
      ? normalizedItems.slice(skip, skip + limit)
      : normalizedItems;

    // Synthesize "absent" placeholders for employees with NO attendance row
    // on the requested date. Only do this for SINGLE-day queries (fromDate ===
    // toDate) — that's the HR Operations daily view + any external consumer
    // asking for one specific day. For multi-day ranges we leave the result
    // as-is so pagination semantics aren't surprising.
    const sameDay = !!(filters.fromDate && filters.toDate && filters.fromDate === filters.toDate);
    if (sameDay && !filters.status && !filters.employeeId) {
      const dateStr = filters.fromDate!;
      const recordedEmployeeIds = new Set(paginatedItems.map((r: any) => r.employeeId));
      const missingEmployees = await prisma.$queryRawUnsafe<Array<{
        id: string; employeeCode: string; firstName: string; lastName: string | null; department: string | null;
      }>>(
        `
        SELECT e.id, e.employee_id as "employeeCode", e.first_name as "firstName",
               e.last_name as "lastName", e.department
        FROM employees e
        WHERE e.deleted_at IS NULL
          AND e.status NOT IN ('exited', 'deleted')
          -- Include unbranched employees (admin / org-wide) so they get an
          -- absent placeholder when missing — matches the main SELECT filter
          AND ($1::text IS NULL OR e.branch_id = $1 OR e.branch_id IS NULL)
          AND e.id NOT IN (
            SELECT a.employee_id FROM attendance a WHERE a.date = $2::date
          )
        `,
        filters.branchId || null,
        dateStr
      );

      // Filter out any that somehow ended up in recordedEmployeeIds (defensive)
      const placeholders = missingEmployees
        .filter(emp => !recordedEmployeeIds.has(emp.id))
        .map(emp => ({
          id: `absent-${emp.id}-${dateStr}`,
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          employeeFirstName: emp.firstName,
          employeeLastName: emp.lastName,
          department: emp.department,
          date: new Date(dateStr),
          checkInTime: null,
          checkOutTime: null,
          status: 'absent',
          manualCorrection: false,
          correctionReason: null,
          workHours: null,
          isLate: false,
          isPlaceholder: true,
        }));

      paginatedItems = [...paginatedItems, ...placeholders];
    }

    return {
      items: paginatedItems,
      cards: buildAttendanceCards(total, statusCounts),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async correctAttendance(
    attendanceId: string,
    payload: { checkInTime?: string | null; checkOutTime?: string | null; reason: string },
    correctedByUserId: string
  ) {
    // Verify the attendance record exists and check for approved leave on that date
    const attRows = await prisma.$queryRawUnsafe<Array<{ employee_id: string; date: string }>>(
      `SELECT employee_id, date::text FROM attendance WHERE id = $1::uuid LIMIT 1`,
      attendanceId
    );
    if (attRows[0]) {
      const leaveRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM leaves WHERE employee_id = $1::uuid AND status = 'approved' AND from_date <= $2::date AND to_date >= $2::date LIMIT 1`,
        attRows[0].employee_id,
        attRows[0].date
      );
      if (leaveRows.length > 0) {
        throw ApiError.conflict(
          'Cannot correct attendance for a date with approved leave. Cancel the leave first.',
          'LEAVE_CONFLICT'
        );
      }
    }

    let status: string;
    let workHours: number | null = null;

    if (payload.checkInTime && payload.checkOutTime) {
      const diffMs = new Date(payload.checkOutTime).getTime() - new Date(payload.checkInTime).getTime();
      workHours = Math.round((diffMs / 3_600_000) * 100) / 100;
      const fullDayHours = Number(process.env.FULL_DAY_HOURS ?? 9);
      const halfDayHours = Number(process.env.HALF_DAY_HOURS ?? 4);
      if (workHours < halfDayHours) status = 'absent';
      else if (workHours < fullDayHours) status = 'half_day';
      else status = 'present';
    } else if (payload.checkInTime) {
      status = 'incomplete';
    } else {
      status = 'absent';
    }

    // Cast input as timestamptz so ISO strings with Z or +05:30 are parsed
    // correctly; Postgres then converts to the session TZ (Asia/Kolkata) before
    // dropping the offset for the `timestamp without time zone` column.
    await prisma.$executeRawUnsafe(
      `
      UPDATE attendance
      SET
        check_in_time = $2::timestamptz,
        check_out_time = $3::timestamptz,
        status = $4::attendance_status,
        work_hours = $7,
        manual_correction = true,
        correction_reason = $5,
        corrected_by = $6::uuid,
        corrected_at = NOW(),
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      attendanceId,
      payload.checkInTime || null,
      payload.checkOutTime || null,
      status,
      payload.reason,
      correctedByUserId,
      workHours
    );
    await prisma.auditLog.create({
      data: {
        userId: correctedByUserId,
        action: 'hr.attendance_corrected',
        entityType: 'attendance',
        entityId: attendanceId,
        newValues: payload,
      },
    });
    return { attendanceId, status };
  }

  async addManualAttendance(
    payload: {
      employeeId: string;
      date: string;
      checkInTime?: string | null;
      checkOutTime?: string | null;
      status: string;
      reason: string;
    },
    createdByUserId: string
  ) {
    // Compute work_hours from check-in/check-out so reports show the duration
    // instead of an empty / zero column. Without this the INSERT leaves
    // work_hours NULL and the exportAttendance row shows '0'. (Bug 1.)
    let workHours: number | null = null;
    if (payload.checkInTime && payload.checkOutTime) {
      const diffMs = new Date(payload.checkOutTime).getTime() - new Date(payload.checkInTime).getTime();
      if (Number.isFinite(diffMs) && diffMs > 0) {
        workHours = Math.round((diffMs / 3_600_000) * 100) / 100;
      }
    }

    // Same reasoning as correctAttendance — accept ISO strings with TZ offsets
    // and let Postgres convert to session TZ before storing wall-clock.
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO attendance
        (employee_id, date, check_in_time, check_out_time, status, work_hours, manual_correction, correction_reason, corrected_by, corrected_at, created_by)
      VALUES
        ($1::uuid, $2::date, $3::timestamptz, $4::timestamptz, $5::attendance_status, $8, true, $6, $7::uuid, NOW(), $7::uuid)
      RETURNING id
    `,
      payload.employeeId,
      payload.date,
      payload.checkInTime || null,
      payload.checkOutTime || null,
      payload.status,
      payload.reason,
      createdByUserId,
      workHours
    );
    return { attendanceId: rows[0].id };
  }

  async exportAttendance(filters: { employeeId?: string; status?: string; fromDate?: string; toDate?: string; branchId?: string | null }) {
    // Build a CROSS JOIN of every eligible employee × every workday in range,
    // then LEFT JOIN the attendance rows. Days without an attendance row come
    // back as synthetic "Absent" entries — this is Bug 2's fix. Weekends are
    // skipped (matches the monthly email's working-days definition).
    // Date range is required for this report; default to last 30 days if not set.
    const fromDate = filters.fromDate || null;
    const toDate = filters.toDate || null;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      WITH
        eligible AS (
          SELECT e.id, e.employee_id, e.first_name, e.last_name, e.department, e.branch_id, e.joining_date
          FROM employees e
          WHERE e.deleted_at IS NULL
            AND ($5::text IS NULL OR e.branch_id = $5)
            AND ($1::uuid IS NULL OR e.id = $1::uuid)
        ),
        workdays AS (
          SELECT d::date AS date
          FROM generate_series(
            COALESCE($3::date, CURRENT_DATE - INTERVAL '30 days'),
            COALESCE($4::date, CURRENT_DATE),
            '1 day'
          ) AS d
          WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
        ),
        expected AS (
          SELECT e.id AS employee_id,
                 e.employee_id AS employee_code,
                 e.first_name, e.last_name, e.department,
                 w.date
          FROM eligible e
          CROSS JOIN workdays w
          WHERE e.joining_date IS NULL OR w.date >= e.joining_date
        )
      SELECT
        ex.employee_code as "employeeId",
        CONCAT(ex.first_name, ' ', COALESCE(ex.last_name, '')) as "employeeName",
        ex.department as "department",
        TO_CHAR(ex.date, 'YYYY-MM-DD') as "date",
        COALESCE(TO_CHAR(a.check_in_time, 'HH12:MI AM'), '') as "checkInTime",
        COALESCE(TO_CHAR(a.check_out_time, 'HH12:MI AM'), '') as "checkOutTime",
        COALESCE(ROUND(a.work_hours::numeric, 2)::text, '0') as "workHours",
        INITCAP(COALESCE(a.status::text, 'absent')) as "status",
        CASE
          WHEN a.check_in_time IS NOT NULL AND (
            EXTRACT(HOUR FROM a.check_in_time) > $6
            OR (EXTRACT(HOUR FROM a.check_in_time) = $6 AND EXTRACT(MINUTE FROM a.check_in_time) > $7)
          ) THEN 'Yes'
          ELSE 'No'
        END as "lateArrival"
      FROM expected ex
      LEFT JOIN attendance a ON a.employee_id = ex.employee_id AND a.date = ex.date
      WHERE ($2::text IS NULL OR COALESCE(a.status::text, 'absent') = $2)
      ORDER BY ex.date DESC, ex.employee_code ASC
    `,
      filters.employeeId || null,
      filters.status || null,
      fromDate,
      toDate,
      filters.branchId ?? null,
      parseInt(process.env.OFFICE_START_TIME?.split(':')[0] || '9', 10),
      parseInt(process.env.OFFICE_START_TIME?.split(':')[1] || '30', 10)
    );
    const headers = ['employeeId', 'employeeName', 'department', 'date', 'checkInTime', 'checkOutTime', 'workHours', 'status', 'lateArrival'];
    return { rows, csv: toCsv(headers, rows) };
  }

  async exportOffboardingCsv(branchId?: string | null) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        e.employee_id         AS "employeeCode",
        CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS "employeeName",
        e.department,
        e.designation,
        TO_CHAR(o.last_working_day, 'YYYY-MM-DD') AS "lastWorkingDay",
        o.exit_reason         AS "exitReason",
        o.additional_notes    AS "additionalNotes",
        o.status::text        AS "offboardingStatus",
        o.progress            AS "tasksProgress",
        TO_CHAR(o.completed_at, 'YYYY-MM-DD') AS "completedAt"
      FROM offboarding o
      JOIN employees e ON e.id = o.employee_id
      WHERE ($1::text IS NULL OR e.branch_id = $1)
        AND e.deleted_at IS NULL
      ORDER BY o.created_at DESC
      `,
      branchId ?? null
    );
    const headers = [
      'employeeCode', 'employeeName', 'department', 'designation',
      'lastWorkingDay', 'exitReason', 'additionalNotes',
      'offboardingStatus', 'tasksProgress', 'completedAt',
    ];
    return toCsv(headers, rows);
  }

  async exportLeaves(filters: { employeeId?: string; status?: string; fromDate?: string; toDate?: string; branchId?: string | null }) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        e.employee_id as "employeeId",
        CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as "employeeName",
        l.leave_type::text as "leaveType",
        TO_CHAR(l.from_date, 'YYYY-MM-DD') as "fromDate",
        TO_CHAR(l.to_date, 'YYYY-MM-DD') as "toDate",
        l.days::text as "days",
        l.status::text as status,
        COALESCE(l.reason, '') as reason,
        TO_CHAR(l.applied_at, 'YYYY-MM-DD HH12:MI:SS AM') as "appliedAt",
        CASE
          WHEN l.approved_by IS NULL THEN ''
          ELSE TRIM(CONCAT(COALESCE(approved_by_user.first_name, ''), ' ', COALESCE(approved_by_user.last_name, '')))
        END as "approvedBy",
        TO_CHAR(l.approved_at, 'YYYY-MM-DD HH12:MI:SS AM') as "approvedAt",
        CASE
          WHEN l.rejected_by IS NULL THEN ''
          ELSE TRIM(CONCAT(COALESCE(rejected_by_user.first_name, ''), ' ', COALESCE(rejected_by_user.last_name, '')))
        END as "rejectedBy",
        TO_CHAR(l.rejected_at, 'YYYY-MM-DD HH12:MI:SS AM') as "rejectedAt",
        COALESCE(l.rejection_reason, '') as "rejectionReason"
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      LEFT JOIN users approved_by_user ON approved_by_user.id = l.approved_by
      LEFT JOIN users rejected_by_user ON rejected_by_user.id = l.rejected_by
      WHERE ($1::uuid IS NULL OR l.employee_id = $1::uuid)
        AND ($2::text IS NULL OR l.status::text = $2)
        AND ($3::date IS NULL OR l.from_date >= $3::date)
        AND ($4::date IS NULL OR l.to_date <= $4::date)
        AND ($5::text IS NULL OR e.branch_id = $5 OR e.branch_id IS NULL)
      ORDER BY l.applied_at DESC
      `,
      filters.employeeId || null,
      filters.status || null,
      filters.fromDate || null,
      filters.toDate || null,
      filters.branchId ?? null
    );
    const headers = [
      'employeeId',
      'employeeName',
      'leaveType',
      'fromDate',
      'toDate',
      'days',
      'status',
      'reason',
      'appliedAt',
      'approvedBy',
      'approvedAt',
      'rejectedBy',
      'rejectedAt',
      'rejectionReason',
    ];
    return { rows, csv: toCsv(headers, rows) };
  }

  async listLeaves(filters: {
    employeeId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    branchId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    const items = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT l.id, l.employee_id as "employeeId", e.employee_id as "employeeCode",
             e.first_name as "employeeFirstName", e.last_name as "employeeLastName",
             l.leave_type::text as "leaveType", l.from_date as "fromDate", l.to_date as "toDate",
             l.session::text as session, l.days, l.status::text as status, l.reason, l.applied_at as "appliedAt"
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      WHERE ($1::uuid IS NULL OR l.employee_id = $1::uuid)
        AND ($2::text IS NULL OR l.status::text = $2)
        AND ($3::date IS NULL OR l.from_date >= $3::date)
        AND ($4::date IS NULL OR l.to_date <= $4::date)
        AND ($7::text IS NULL OR e.branch_id = $7 OR e.branch_id IS NULL)
      ORDER BY l.applied_at DESC
      LIMIT $5 OFFSET $6
    `,
      filters.employeeId || null,
      filters.status || null,
      filters.fromDate || null,
      filters.toDate || null,
      limit,
      skip,
      filters.branchId || null
    );
    const totalRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `
      SELECT COUNT(*)::text as count
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      WHERE ($1::uuid IS NULL OR l.employee_id = $1::uuid)
        AND ($2::text IS NULL OR l.status::text = $2)
        AND ($3::date IS NULL OR l.from_date >= $3::date)
        AND ($4::date IS NULL OR l.to_date <= $4::date)
        AND ($5::text IS NULL OR e.branch_id = $5 OR e.branch_id IS NULL)
    `,
      filters.employeeId || null,
      filters.status || null,
      filters.fromDate || null,
      filters.toDate || null,
      filters.branchId || null
    );
    const normalizedItems = items.map((item: any) => {
      const employeeName =
        `${item.employeeFirstName || ''} ${item.employeeLastName || ''}`.trim() ||
        item.employeeCode ||
        'Employee';
      const appliedAtIso = item.appliedAt ? new Date(item.appliedAt).toISOString() : null;
      return {
        ...item,
        appliedAt: appliedAtIso,
        appliedAgo: toRelativeTime(appliedAtIso),
        appliedAtRelative: toRelativeTime(appliedAtIso),
        name: employeeName,
        employeeName,
        employeeFirstName: item.employeeFirstName || null,
        employeeLastName: item.employeeLastName || null,
        employee: {
          id: item.employeeId || null,
          employeeId: item.employeeCode || null,
          firstName: item.employeeFirstName || null,
          lastName: item.employeeLastName || null,
          fullName: employeeName,
          name: employeeName,
        },
      };
    });
    const total = parseInt(totalRows[0]?.count || '0', 10);
    return { items: normalizedItems, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async approveLeave(leaveId: string, approverUserId: string, branchId?: string | null) {
    const leaveRows = await prisma.$queryRawUnsafe<Array<{ id: string; status: string; employee_user_id: string | null }>>(
      `SELECT l.id, l.status::text as status, e.user_id as employee_user_id
       FROM leaves l
       JOIN employees e ON e.id = l.employee_id
       WHERE l.id = $1::uuid AND ($2::text IS NULL OR e.branch_id = $2 OR e.branch_id IS NULL) LIMIT 1`,
      leaveId,
      branchId ?? null
    );
    const leave = leaveRows[0];
    if (!leave) throw ApiError.notFound('Leave not found', 'LEAVE_NOT_FOUND');
    if (leave.status !== 'pending') {
      throw ApiError.unprocessable('Only pending leave can be approved', 'INVALID_LEAVE_STATUS');
    }
    if (leave.employee_user_id && leave.employee_user_id === approverUserId) {
      throw ApiError.forbidden('You cannot approve your own leave', 'SELF_APPROVAL_NOT_ALLOWED');
    }
    await prisma.$executeRawUnsafe(
      `
      UPDATE leaves
      SET status = 'approved', approved_by = $2::uuid, approved_at = NOW(), updated_at = NOW()
      WHERE id = $1::uuid
    `,
      leaveId,
      approverUserId
    );

    {
      const leaveAudience = await this.getLeaveAudience(leaveId);
      const adminUserIds = await this.getHrmsAdminRecipients();
      await this.notifyHrms(
        'hrms_leave_approved',
        approverUserId,
        [leaveAudience.employeeUserId, leaveAudience.managerUserId, ...adminUserIds],
        {
          leaveId,
          employeeId: leaveAudience.employeeId,
          employeeName: leaveAudience.employeeName,
          leaveRange: `${leaveAudience.fromDate} to ${leaveAudience.toDate}`,
        }
      );
    }
    return { leaveId, status: 'approved' };
  }

  async rejectLeave(leaveId: string, reason: string | undefined, approverUserId: string, branchId?: string | null) {
    const leaveRows = await prisma.$queryRawUnsafe<Array<{ id: string; employee_user_id: string | null }>>(
      `SELECT l.id, e.user_id as employee_user_id FROM leaves l JOIN employees e ON e.id = l.employee_id
       WHERE l.id = $1::uuid AND ($2::text IS NULL OR e.branch_id = $2 OR e.branch_id IS NULL) LIMIT 1`,
      leaveId,
      branchId ?? null
    );
    if (!leaveRows[0]) throw ApiError.notFound('Leave not found', 'LEAVE_NOT_FOUND');
    if (leaveRows[0].employee_user_id && leaveRows[0].employee_user_id === approverUserId) {
      throw ApiError.forbidden('You cannot reject your own leave', 'SELF_APPROVAL_NOT_ALLOWED');
    }
    await prisma.$executeRawUnsafe(
      `
      UPDATE leaves
      SET status = 'rejected', rejected_by = $2::uuid, rejected_at = NOW(), rejection_reason = $3, updated_at = NOW()
      WHERE id = $1::uuid
    `,
      leaveId,
      approverUserId,
      reason || null
    );

    {
      const leaveAudience = await this.getLeaveAudience(leaveId);
      const adminUserIds = await this.getHrmsAdminRecipients();
      await this.notifyHrms(
        'hrms_leave_rejected',
        approverUserId,
        [leaveAudience.employeeUserId, leaveAudience.managerUserId, ...adminUserIds],
        {
          leaveId,
          employeeId: leaveAudience.employeeId,
          employeeName: leaveAudience.employeeName,
          reason: reason || '',
          leaveRange: `${leaveAudience.fromDate} to ${leaveAudience.toDate}`,
        }
      );
    }
    return { leaveId, status: 'rejected' };
  }

  async cancelLeave(leaveId: string, reason: string | undefined, cancelledByUserId: string, branchId?: string | null) {
    const leaveRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT l.id FROM leaves l JOIN employees e ON e.id = l.employee_id
       WHERE l.id = $1::uuid AND ($2::text IS NULL OR e.branch_id = $2 OR e.branch_id IS NULL) LIMIT 1`,
      leaveId,
      branchId ?? null
    );
    if (!leaveRows[0]) throw ApiError.notFound('Leave not found', 'LEAVE_NOT_FOUND');
    await prisma.$executeRawUnsafe(
      `
      UPDATE leaves
      SET status = 'cancelled', cancelled_at = NOW(), rejection_reason = COALESCE($3, rejection_reason), updated_at = NOW()
      WHERE id = $1::uuid
    `,
      leaveId,
      cancelledByUserId,
      reason || null
    );

    {
      const leaveAudience = await this.getLeaveAudience(leaveId);
      const adminUserIds = await this.getHrmsAdminRecipients();
      await this.notifyHrms(
        'hrms_leave_cancelled',
        cancelledByUserId,
        [leaveAudience.employeeUserId, leaveAudience.managerUserId, ...adminUserIds],
        {
          leaveId,
          employeeId: leaveAudience.employeeId,
          employeeName: leaveAudience.employeeName,
          reason: reason || '',
          leaveRange: `${leaveAudience.fromDate} to ${leaveAudience.toDate}`,
        }
      );
    }
    return { leaveId, status: 'cancelled' };
  }

  async adjustLeaveBalance(
    employeeId: string,
    payload: { leaveType: string; adjustment: number; reason: string; year?: number },
    adjustedByUserId: string
  ) {
    const employee = await this.getEmployeeById(employeeId);
    const resolvedId = employee.id;
    const year = payload.year || new Date().getFullYear();
    // Update leave_balances table for all supported leave types.
    // NOTE: maternity and paternity columns must be added via manual psql migration:
    //   ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS maternity NUMERIC(6,2) DEFAULT 0;
    //   ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS paternity NUMERIC(6,2) DEFAULT 0;
    const SUPPORTED_COLUMNS = ['casual', 'sick', 'earned', 'lop', 'comp_off', 'maternity', 'paternity'];
    if (!SUPPORTED_COLUMNS.includes(payload.leaveType)) {
      throw ApiError.unprocessable(
        `Unsupported leave type: ${payload.leaveType}. Supported types: ${SUPPORTED_COLUMNS.join(', ')}`,
        'INVALID_LEAVE_TYPE'
      );
    }
    const column = SUPPORTED_COLUMNS.find(c => c === payload.leaveType)!;
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO leave_balances (employee_id, year, casual, sick, earned, lop, comp_off, maternity, paternity, carried_forward_earned)
      VALUES ($1::uuid, $2, 0, 0, 0, 0, 0, 0, 0, 0)
      ON CONFLICT (employee_id, year) DO NOTHING
    `,
      resolvedId,
      year
    );
    await prisma.$executeRawUnsafe(
      `
      UPDATE leave_balances
      SET "${column}" = COALESCE("${column}", 0) + $3,
          updated_at = NOW()
      WHERE employee_id = $1::uuid AND year = $2
    `,
      resolvedId,
      year,
      payload.adjustment
    );
    // Audit log drives the dynamic leave summary for ALL leave types
    await prisma.auditLog.create({
      data: {
        userId: adjustedByUserId,
        action: 'hr.leave_balance_adjusted',
        entityType: 'leave_balance',
        newValues: payload,
        metadata: { employeeId: resolvedId, year },
      },
    });
    return { employeeId: resolvedId, year, ...payload };
  }

  async getLeaveBalance(employeeId: string, yearInput?: string) {
    const year = yearInput ? parseInt(yearInput, 10) : undefined;
    return workforceService.getEmployeeLeaveSummaryByEmployeeId(employeeId, year);
  }

  async getLeaveSummaryByEmployee(employeeId: string, year?: number) {
    return workforceService.getEmployeeLeaveSummaryByEmployeeId(employeeId, year);
  }

  async getLeaveAccrualConfig(branchId?: string | null) {
    return workforceService.getLeaveAccrualConfig(branchId);
  }

  async updateLeaveAccrualConfig(
    payload: { casualPerMonth: number; sickPerMonth: number; earnedPerMonth: number },
    updatedByUserId: string,
    branchId?: string | null
  ) {
    return workforceService.updateLeaveAccrualConfig(payload, updatedByUserId, branchId);
  }

  async editLeave(
    leaveId: string,
    payload: {
      leaveType?: string;
      fromDate?: string;
      toDate?: string;
      days?: number;
      session?: string;
      status?: string;
      reason?: string;
    },
    editedByUserId: string,
    branchId?: string | null
  ) {
    // Fetch existing leave
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT l.*, e.branch_id AS "branchId"
       FROM leaves l
       JOIN employees e ON e.id = l.employee_id
       WHERE l.id = $1::uuid`,
      leaveId
    );
    if (!rows.length) throw ApiError.notFound('Leave not found');
    const leave = rows[0];

    // Branch guard for HR
    if (branchId && leave.branchId && leave.branchId !== branchId) {
      throw ApiError.forbidden('Cannot edit leave of employee from another branch');
    }

    // Build SET clauses dynamically
    const setClauses: string[] = [];
    const params: any[] = [leaveId];
    let paramIdx = 2;

    if (payload.leaveType !== undefined) {
      setClauses.push(`leave_type = $${paramIdx}`);
      params.push(payload.leaveType);
      paramIdx++;
    }
    if (payload.fromDate !== undefined) {
      setClauses.push(`from_date = $${paramIdx}::date`);
      params.push(payload.fromDate);
      paramIdx++;
    }
    if (payload.toDate !== undefined) {
      setClauses.push(`to_date = $${paramIdx}::date`);
      params.push(payload.toDate);
      paramIdx++;
    }
    if (payload.days !== undefined) {
      setClauses.push(`days = $${paramIdx}`);
      params.push(payload.days);
      paramIdx++;
    }
    if (payload.session !== undefined) {
      setClauses.push(`session = $${paramIdx}::leave_session`);
      params.push(payload.session);
      paramIdx++;
    }
    if (payload.status !== undefined) {
      setClauses.push(`status = $${paramIdx}::leave_status`);
      params.push(payload.status);
      paramIdx++;
      if (payload.status === 'approved') {
        setClauses.push(`approved_by = $${paramIdx}::uuid, approved_at = NOW()`);
        params.push(editedByUserId);
        paramIdx++;
      } else if (payload.status === 'rejected') {
        setClauses.push(`rejected_by = $${paramIdx}::uuid, rejected_at = NOW()`);
        params.push(editedByUserId);
        paramIdx++;
      } else if (payload.status === 'cancelled') {
        setClauses.push(`cancelled_at = NOW()`);
      }
    }
    if (payload.reason !== undefined) {
      setClauses.push(`reason = $${paramIdx}`);
      params.push(payload.reason);
      paramIdx++;
    }

    setClauses.push('updated_at = NOW()');

    const updated = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE leaves SET ${setClauses.join(', ')} WHERE id = $1::uuid RETURNING *`,
      ...params
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: editedByUserId,
        action: 'hr.leave_edited',
        entityType: 'leave',
        entityId: leaveId,
        oldValues: leave,
        newValues: payload,
      },
    });

    return updated[0];
  }

  async applyMyLeave(userId: string, payload: LeaveApplyInput) {
    return workforceService.applyMyLeaveDirect(userId, payload);
  }

  async listMyLeaves(userId: string, status?: string, year?: number) {
    return workforceService.listMyLeaves(userId, status, year);
  }

  async cancelMyLeave(userId: string, leaveId: string) {
    return workforceService.cancelMyLeave(userId, leaveId);
  }

  async getMyLeaveBalance(userId: string, year?: number) {
    return workforceService.getMyLeaveBalance(userId, year);
  }

  async getMyLeaveSummary(userId: string, year?: number) {
    return workforceService.getMyLeaveSummary(userId, year);
  }

  async listHolidays(filters: { year?: string; type?: string; branchId?: string | null }) {
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, date, name, type::text as type, location, description, branch_id as "branchId", created_at as "createdAt", updated_at as "updatedAt"
      FROM holidays
      WHERE ($1::int IS NULL OR EXTRACT(YEAR FROM date) = $1)
        AND ($2::text IS NULL OR type::text = $2)
        AND ($3::text IS NULL OR branch_id = $3 OR branch_id IS NULL)
      ORDER BY date ASC
    `,
      filters.year ? parseInt(filters.year, 10) : null,
      filters.type || null,
      filters.branchId || null
    );
  }

  // All-company employee birthdays. Returns only name + month/day —
  // the birth year is intentionally omitted for privacy.
  async listBirthdays(): Promise<
    Array<{ employeeId: string; name: string; month: number; day: number }>
  > {
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id                                   AS "employeeId",
             (first_name || ' ' || COALESCE(last_name, '')) AS "name",
             EXTRACT(MONTH FROM date_of_birth)::int AS month,
             EXTRACT(DAY   FROM date_of_birth)::int AS day
      FROM   employees
      WHERE  deleted_at IS NULL
        AND  date_of_birth IS NOT NULL
        AND  status IN ('active', 'notice_period')
      ORDER BY month ASC, day ASC, name ASC
    `
    );
  }

  async createHoliday(payload: any, createdByUserId: string) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO holidays (date, name, type, location, description, branch_id, created_by, updated_by)
      VALUES ($1::date, $2, $3::holiday_type, $4, $5, $6, $7::uuid, $7::uuid)
      RETURNING id
    `,
      payload.date,
      payload.name,
      payload.type,
      payload.location || null,
      payload.description || null,
      payload.branchId || null,
      createdByUserId
    );
    return { holidayId: rows[0].id };
  }

  async updateHoliday(holidayId: string, payload: any, updatedByUserId: string) {
    await prisma.$executeRawUnsafe(
      `
      UPDATE holidays
      SET name = COALESCE($2, name),
          type = CASE WHEN $3::text IS NULL THEN type ELSE $3::holiday_type END,
          location = CASE WHEN $4::text IS NULL THEN location ELSE $4 END,
          description = CASE WHEN $5::text IS NULL THEN description ELSE $5 END,
          branch_id = CASE WHEN $7::text IS NULL THEN branch_id ELSE $7 END,
          updated_by = $6::uuid,
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
      holidayId,
      payload.name || null,
      payload.type || null,
      payload.location === undefined ? null : payload.location,
      payload.description === undefined ? null : payload.description,
      updatedByUserId,
      payload.branchId === undefined ? null : payload.branchId
    );
    return { holidayId };
  }

  async deleteHoliday(holidayId: string, deletedByUserId: string) {
    await prisma.$executeRawUnsafe('DELETE FROM holidays WHERE id = $1::uuid', holidayId);
    await prisma.auditLog.create({
      data: {
        userId: deletedByUserId,
        action: 'hr.holiday_deleted',
        entityType: 'holiday',
        entityId: holidayId,
      },
    });
    return { holidayId };
  }

  async uploadHolidays(holidays: any[], uploadedByUserId: string) {
    let inserted = 0;
    const errors: Array<{ index: number; reason: string }> = [];
    for (let i = 0; i < holidays.length; i += 1) {
      try {
        await this.createHoliday(holidays[i], uploadedByUserId);
        inserted += 1;
      } catch (e: any) {
        errors.push({ index: i, reason: e?.message || 'failed' });
      }
    }
    return { total: holidays.length, inserted, errors };
  }

  async exportHolidays(filters: { year?: string; type?: string; branchId?: string | null }) {
    const rows = await this.listHolidays(filters);
    const headers = ['id', 'date', 'name', 'type', 'location', 'description', 'branchId'];
    return { rows, csv: toCsv(headers, rows) };
  }

  private validatePayrollPeriod(month: number, year: number) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw ApiError.badRequest('Month must be between 1 and 12', 'INVALID_PAYROLL_MONTH');
    }
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      throw ApiError.badRequest('Year must be between 2020 and 2100', 'INVALID_PAYROLL_YEAR');
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (year > currentYear || (year === currentYear && month > currentMonth)) {
      throw ApiError.unprocessable(
        'Payroll period cannot be in the future',
        'PAYROLL_PERIOD_IN_FUTURE'
      );
    }
  }

  private async assertPayrollPeriodEditable(month: number, year: number) {
    const lockRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      SELECT id
      FROM payroll_locks
      WHERE month = $1 AND year = $2
      LIMIT 1
    `,
      month,
      year
    );
    if (lockRows[0]) {
      throw ApiError.conflict(
        `Payroll for ${String(month).padStart(2, '0')}/${year} is finalized and locked`,
        'PAYROLL_LOCKED'
      );
    }

    const finalizedRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `
      SELECT COUNT(*)::text as count
      FROM payroll
      WHERE month = $1 AND year = $2 AND status = 'finalized'
    `,
      month,
      year
    );
    if (parseInt(finalizedRows[0]?.count || '0', 10) > 0) {
      throw ApiError.conflict(
        `Payroll for ${String(month).padStart(2, '0')}/${year} is already finalized`,
        'PAYROLL_ALREADY_FINALIZED'
      );
    }
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }

    values.push(current.trim());
    return values.map((v, idx) => (idx === 0 ? v.replace(/^\uFEFF/, '') : v));
  }

  private roundAmount(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private sanitizeBreakdownItems(
    items: Array<{ label: string; amount: unknown }> | undefined
  ): Array<{ label: string; amount: number }> {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => ({
        label: String(item?.label || '').trim(),
        amount: this.roundAmount(parseNumber(item?.amount)),
      }))
      .filter((item) => item.label.length > 0 && Number.isFinite(item.amount) && item.amount > 0);
  }

  private normalizeBreakdownTotals(
    gross: number,
    deductions: number,
    inputEarnings: Array<{ label: string; amount: number }>,
    inputDeductions: Array<{ label: string; amount: number }>
  ) {
    const earnings = [...inputEarnings];
    const deductionItems = [...inputDeductions];

    const earningsTotal = this.roundAmount(earnings.reduce((sum, item) => sum + item.amount, 0));
    const earningsDiff = this.roundAmount(gross - earningsTotal);
    if (earningsDiff > 0) {
      earnings.push({ label: 'Other Allowances', amount: earningsDiff });
    } else if (earningsDiff < 0 && earnings.length > 0) {
      const idx = earnings.length - 1;
      earnings[idx] = {
        ...earnings[idx],
        amount: this.roundAmount(Math.max(0, earnings[idx].amount + earningsDiff)),
      };
    }

    const deductionsTotal = this.roundAmount(
      deductionItems.reduce((sum, item) => sum + item.amount, 0)
    );
    const deductionsDiff = this.roundAmount(deductions - deductionsTotal);
    if (deductionsDiff > 0) {
      deductionItems.push({ label: 'Other Deductions', amount: deductionsDiff });
    } else if (deductionsDiff < 0 && deductionItems.length > 0) {
      const idx = deductionItems.length - 1;
      deductionItems[idx] = {
        ...deductionItems[idx],
        amount: this.roundAmount(Math.max(0, deductionItems[idx].amount + deductionsDiff)),
      };
    }

    return {
      earningsBreakdown: earnings.filter((item) => item.amount > 0),
      deductionsBreakdown: deductionItems.filter((item) => item.amount > 0),
    };
  }

  private buildRuleBasedPayrollBreakdown(gross: number, deductions: number) {
    const safeGross = this.roundAmount(Math.max(0, gross));
    const safeDeductions = this.roundAmount(Math.max(0, deductions));

    const basic = this.roundAmount(safeGross * 0.5);
    const hra = this.roundAmount(basic * 0.4);
    let conveyance = safeGross >= 1600 ? 1600 : this.roundAmount(Math.max(0, safeGross * 0.1));
    let medical = safeGross >= 1250 ? 1250 : 0;
    let special = this.roundAmount(safeGross - (basic + hra + conveyance + medical));
    if (special < 0) {
      const deficit = Math.abs(special);
      const medicalReduce = Math.min(medical, deficit);
      medical = this.roundAmount(medical - medicalReduce);
      const remaining = this.roundAmount(deficit - medicalReduce);
      if (remaining > 0) {
        const conveyReduce = Math.min(conveyance, remaining);
        conveyance = this.roundAmount(conveyance - conveyReduce);
      }
      special = 0;
    }

    const earningsBreakdown = this.sanitizeBreakdownItems([
      { label: 'Basic', amount: basic },
      { label: 'HRA', amount: hra },
      { label: 'Conveyance Allowance', amount: conveyance },
      { label: 'Medical Allowance', amount: medical },
      { label: 'Special Allowance', amount: special },
    ]);

    let pf = this.roundAmount(basic * 0.12);
    let esi = safeGross <= 21000 ? this.roundAmount(safeGross * 0.0075) : 0;
    let professionalTax = safeGross >= 15000 ? 200 : safeGross >= 10000 ? 150 : safeGross >= 7500 ? 100 : 0;
    let baseSum = this.roundAmount(pf + esi + professionalTax);
    if (baseSum > safeDeductions && baseSum > 0) {
      const factor = safeDeductions / baseSum;
      pf = this.roundAmount(pf * factor);
      esi = this.roundAmount(esi * factor);
      professionalTax = this.roundAmount(professionalTax * factor);
      baseSum = this.roundAmount(pf + esi + professionalTax);
    }
    const tds = this.roundAmount(Math.max(0, safeDeductions - baseSum));

    const deductionsBreakdown = this.sanitizeBreakdownItems([
      { label: 'EPF', amount: pf },
      { label: 'ESI', amount: esi },
      { label: 'Professional Tax', amount: professionalTax },
      { label: 'TDS', amount: tds },
    ]);

    return this.normalizeBreakdownTotals(
      safeGross,
      safeDeductions,
      earningsBreakdown,
      deductionsBreakdown
    );
  }

  private async loadPayrollBreakdownFromAudit(payrollId: string): Promise<{
    earningsBreakdown: Array<{ label: string; amount: number }>;
    deductionsBreakdown: Array<{ label: string; amount: number }>;
    totalWorkingDays?: number;
    leaves?: number;
    lopDays?: number;
    paidDays?: number;
  }> {
    const rows = await prisma.$queryRawUnsafe<Array<{ newValues: any }>>(
      `
      SELECT new_values as "newValues"
      FROM audit_logs
      WHERE action = 'hr.payroll_breakdown_upserted'
        AND entity_type = 'payroll'
        AND entity_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `,
      payrollId
    );
    const raw = rows[0]?.newValues || {};
    const earningsBreakdown = this.sanitizeBreakdownItems(raw.earningsBreakdown || []);
    const deductionsBreakdown = this.sanitizeBreakdownItems(raw.deductionsBreakdown || []);

    const toInt = (v: unknown): number | undefined => {
      const n = parseNumber(v);
      if (!Number.isFinite(n)) return undefined;
      return Math.max(0, Math.round(n));
    };

    return {
      earningsBreakdown,
      deductionsBreakdown,
      totalWorkingDays: toInt(raw.totalWorkingDays),
      leaves: toInt(raw.leaves),
      lopDays: toInt(raw.lopDays),
      paidDays: toInt(raw.paidDays),
    };
  }

  private async upsertPayrollBreakdownAudit(
    payrollId: string,
    uploadedByUserId: string,
    row: PayrollNormalizedRow
  ): Promise<void> {
    const gross = this.roundAmount(row.gross);
    const deductions = this.roundAmount(row.deductions);
    const inputEarnings = this.sanitizeBreakdownItems(row.earningsBreakdown || []);
    const inputDeductions = this.sanitizeBreakdownItems(row.deductionsBreakdown || []);
    const normalized =
      inputEarnings.length > 0 || inputDeductions.length > 0
        ? this.normalizeBreakdownTotals(gross, deductions, inputEarnings, inputDeductions)
        : this.buildRuleBasedPayrollBreakdown(gross, deductions);

    await prisma.auditLog.create({
      data: {
        userId: uploadedByUserId,
        action: 'hr.payroll_breakdown_upserted',
        entityType: 'payroll',
        entityId: payrollId,
        newValues: {
          earningsBreakdown: normalized.earningsBreakdown,
          deductionsBreakdown: normalized.deductionsBreakdown,
          totalWorkingDays: row.totalWorkingDays ?? 30,
          leaves: row.leaves ?? 0,
          lopDays: row.lopDays ?? 0,
          paidDays:
            row.paidDays ??
            Math.max(0, (row.totalWorkingDays ?? 30) - (row.lopDays ?? 0)),
        },
      },
    });
  }

  private parsePayrollCsvTemplate(
    csvContent: string,
    defaultMonth?: number,
    defaultYear?: number
  ): PayrollCsvParseResult {
    if ((defaultMonth && !defaultYear) || (!defaultMonth && defaultYear)) {
      throw ApiError.badRequest(
        'Provide both month and year together, or omit both',
        'PAYROLL_PERIOD_INCOMPLETE'
      );
    }

    if (defaultMonth && defaultYear) {
      this.validatePayrollPeriod(defaultMonth, defaultYear);
    }

    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length < 2) {
      throw ApiError.badRequest('CSV file is empty', 'PAYROLL_CSV_EMPTY');
    }

    const headers = this.parseCsvLine(lines[0]).map(h => h.toLowerCase());
    // month/year may come as form fields (defaultMonth/defaultYear) — not required in CSV headers
    const hasBasicTemplate = ['employee_id', 'gross', 'deductions', 'net'].every(
      h => headers.includes(h)
    );
    const hasDetailedTemplate = [
      'employee_id',
      'gross_salary',
      'total_deductions',
      'net_salary',
    ].every(h => headers.includes(h));

    if (!hasBasicTemplate && !hasDetailedTemplate) {
      throw ApiError.badRequest(
        'Invalid CSV headers. Use the provided payroll template',
        'PAYROLL_CSV_INVALID_HEADER'
      );
    }

    const templateType: PayrollCsvParseResult['templateType'] = hasBasicTemplate ? 'basic' : 'detailed';
    const rows: PayrollNormalizedRow[] = [];
    const errors: Array<{ line: number; reason: string }> = [];
    const seenEmployeeIds = new Set<string>();

    let periodMonth = defaultMonth || 0;
    let periodYear = defaultYear || 0;

    const valueOf = (values: string[], key: string): string => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? (values[idx] || '').trim() : '';
    };

    for (let i = 1; i < lines.length; i += 1) {
      const lineNo = i + 1;
      const values = this.parseCsvLine(lines[i]);

      const employeeId = valueOf(values, 'employee_id');
      if (!employeeId) {
        errors.push({ line: lineNo, reason: 'employee_id is required' });
        continue;
      }

      const monthFromCsv = parseNumber(valueOf(values, 'month'));
      const yearFromCsv = parseNumber(valueOf(values, 'year'));

      const rowMonth = defaultMonth || monthFromCsv;
      const rowYear = defaultYear || yearFromCsv;

      if (!Number.isInteger(rowMonth) || rowMonth < 1 || rowMonth > 12) {
        errors.push({ line: lineNo, reason: `Invalid month for ${employeeId}` });
        continue;
      }
      if (!Number.isInteger(rowYear) || rowYear < 2020 || rowYear > 2100) {
        errors.push({ line: lineNo, reason: `Invalid year for ${employeeId}` });
        continue;
      }

      // Only validate mismatch when the CSV actually contains a valid month/year value
      if (defaultMonth && monthFromCsv >= 1 && monthFromCsv <= 12 && monthFromCsv !== defaultMonth) {
        errors.push({
          line: lineNo,
          reason: `Month mismatch for ${employeeId}. Expected ${defaultMonth}, got ${monthFromCsv}`,
        });
        continue;
      }
      if (defaultYear && yearFromCsv >= 2020 && yearFromCsv !== defaultYear) {
        errors.push({
          line: lineNo,
          reason: `Year mismatch for ${employeeId}. Expected ${defaultYear}, got ${yearFromCsv}`,
        });
        continue;
      }

      if (!periodMonth) periodMonth = rowMonth;
      if (!periodYear) periodYear = rowYear;
      if (periodMonth !== rowMonth || periodYear !== rowYear) {
        errors.push({
          line: lineNo,
          reason: `All rows must belong to one period. Found ${rowMonth}/${rowYear}, expected ${periodMonth}/${periodYear}`,
        });
        continue;
      }

      const gross = parseNumber(templateType === 'basic' ? valueOf(values, 'gross') : valueOf(values, 'gross_salary'));
      const deductions = parseNumber(
        templateType === 'basic' ? valueOf(values, 'deductions') : valueOf(values, 'total_deductions')
      );
      const net = parseNumber(templateType === 'basic' ? valueOf(values, 'net') : valueOf(values, 'net_salary'));

      if (!Number.isFinite(gross) || gross <= 0) {
        errors.push({ line: lineNo, reason: `Invalid gross amount for ${employeeId}` });
        continue;
      }
      if (!Number.isFinite(deductions) || deductions < 0) {
        errors.push({ line: lineNo, reason: `Invalid deductions amount for ${employeeId}` });
        continue;
      }
      if (!Number.isFinite(net) || net <= 0) {
        errors.push({ line: lineNo, reason: `Invalid net amount for ${employeeId}` });
        continue;
      }
      if (Math.abs(gross - (deductions + net)) > 0.02) {
        errors.push({
          line: lineNo,
          reason: `Math mismatch for ${employeeId}: gross must equal deductions + net`,
        });
        continue;
      }

      const key = employeeId.toUpperCase();
      if (seenEmployeeIds.has(key)) {
        errors.push({ line: lineNo, reason: `Duplicate employee_id ${employeeId}` });
        continue;
      }
      seenEmployeeIds.add(key);

      let earningsBreakdown: Array<{ label: string; amount: number }> | undefined;
      let deductionsBreakdown: Array<{ label: string; amount: number }> | undefined;
      if (templateType === 'detailed') {
        const basicSalary = parseNumber(valueOf(values, 'basic_salary'));
        const hra = parseNumber(valueOf(values, 'hra'));
        const specialAllowance = parseNumber(valueOf(values, 'special_allowance'));
        const conveyanceAllowance = parseNumber(valueOf(values, 'conveyance_allowance'));
        const medicalAllowance = parseNumber(valueOf(values, 'medical_allowance'));
        const pfEmployee = parseNumber(valueOf(values, 'pf_employee'));
        const esicEmployee = parseNumber(valueOf(values, 'esic_employee'));
        const professionalTax = parseNumber(valueOf(values, 'professional_tax'));
        const tds = parseNumber(valueOf(values, 'tds'));

        const safe = (n: number) => (Number.isFinite(n) && n > 0 ? this.roundAmount(n) : 0);
        const rawEarnings = [
          { label: 'Basic', amount: safe(basicSalary) },
          { label: 'HRA', amount: safe(hra) },
          { label: 'Special Allowance', amount: safe(specialAllowance) },
          { label: 'Conveyance Allowance', amount: safe(conveyanceAllowance) },
          { label: 'Medical Allowance', amount: safe(medicalAllowance) },
        ].filter((item) => item.amount > 0);
        const rawDeductions = [
          { label: 'EPF', amount: safe(pfEmployee) },
          { label: 'ESI', amount: safe(esicEmployee) },
          { label: 'Professional Tax', amount: safe(professionalTax) },
          { label: 'TDS', amount: safe(tds) },
        ].filter((item) => item.amount > 0);

        const normalized = this.normalizeBreakdownTotals(gross, deductions, rawEarnings, rawDeductions);
        earningsBreakdown = normalized.earningsBreakdown;
        deductionsBreakdown = normalized.deductionsBreakdown;
      }
      const maybeInt = (v: string): number | undefined => {
        const n = parseNumber(v);
        if (!Number.isFinite(n)) return undefined;
        return Math.max(0, Math.round(n));
      };
      const totalWorkingDays = maybeInt(valueOf(values, 'total_working_days'));
      const leaves = maybeInt(valueOf(values, 'leaves'));
      const lopDays = maybeInt(valueOf(values, 'lop_days'));
      const paidDays = maybeInt(valueOf(values, 'paid_days'));

      rows.push({
        employeeId,
        gross: Math.round(gross * 100) / 100,
        deductions: Math.round(deductions * 100) / 100,
        net: Math.round(net * 100) / 100,
        earningsBreakdown,
        deductionsBreakdown,
        totalWorkingDays,
        leaves,
        lopDays,
        paidDays,
      });
    }

    if (errors.length > 0) {
      throw ApiError.badRequest('Payroll CSV validation failed', 'PAYROLL_CSV_VALIDATION_FAILED', {
        errors,
      });
    }
    if (!periodMonth || !periodYear) {
      throw ApiError.badRequest('No valid payroll rows found in CSV', 'PAYROLL_CSV_NO_VALID_ROWS');
    }

    this.validatePayrollPeriod(periodMonth, periodYear);
    return {
      month: periodMonth,
      year: periodYear,
      rows,
      templateType,
    };
  }

  private async generatePayslipForPayrollRow(
    row: {
      id: string;
      employeeId: string;
      firstName: string;
      lastName: string | null;
      designation: string | null;
      department: string | null;
      joiningDate: Date | null;
      bankName: string | null;
      bankAccountNumber: string | null;
      month: number;
      year: number;
      gross: unknown;
      deductions: unknown;
      net: unknown;
    },
    generatedByUserId: string
  ) {
    const gross = parseNumber(row.gross);
    const deductions = parseNumber(row.deductions);
    const net = parseNumber(row.net);

    if (!Number.isFinite(gross) || !Number.isFinite(deductions) || !Number.isFinite(net)) {
      throw new Error('Invalid payroll amounts');
    }
    if (Math.abs(gross - (deductions + net)) > 0.02) {
      throw new Error('Gross must equal deductions + net');
    }

    const persistedBreakdown = await this.loadPayrollBreakdownFromAudit(row.id);
    const fallbackBreakdown = this.buildRuleBasedPayrollBreakdown(gross, deductions);
    const earningsBreakdown =
      persistedBreakdown.earningsBreakdown.length > 0
        ? persistedBreakdown.earningsBreakdown
        : fallbackBreakdown.earningsBreakdown;
    const deductionsBreakdown =
      persistedBreakdown.deductionsBreakdown.length > 0
        ? persistedBreakdown.deductionsBreakdown
        : fallbackBreakdown.deductionsBreakdown;

    const employeeName = `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.employeeId;
    const pdfBuffer = await pdfService.generateHrmsPayslipPdf({
      employeeName,
      employeeId: row.employeeId,
      designation: row.designation,
      department: row.department,
      joiningDate: row.joiningDate,
      bankName: row.bankName,
      accountNo: row.bankAccountNumber,
      month: row.month,
      year: row.year,
      gross,
      deductions,
      net,
      earningsBreakdown,
      deductionsBreakdown,
      totalWorkingDays: persistedBreakdown.totalWorkingDays ?? 30,
      leaves: persistedBreakdown.leaves ?? 0,
      lopDays: persistedBreakdown.lopDays ?? 0,
      paidDays:
        persistedBreakdown.paidDays ??
        Math.max(0, (persistedBreakdown.totalWorkingDays ?? 30) - (persistedBreakdown.lopDays ?? 0)),
      companyName: getCompanyCached().name,
      companyAddress: '25th Floor, Gold Tower, Wave One, 2514, Sector 18, Noida, Uttar Pradesh 201301, India',
    });

    const safeEmployeeId = row.employeeId.replace(/[^a-zA-Z0-9_-]/g, '');
    const upload = await storageService.uploadFile(
      {
        fieldname: 'file',
        originalname: `payslip-${safeEmployeeId}-${row.year}-${String(row.month).padStart(2, '0')}.pdf`,
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        buffer: pdfBuffer,
      },
      generatedByUserId
    );
    return storageService.getFileUrl(upload.storagePath);
  }

  async uploadPayrollCsv(
    file: { buffer: Buffer; mimetype: string; originalname: string },
    period: { month?: number; year?: number },
    uploadedByUserId: string
  ) {
    if (!file?.buffer || file.buffer.length === 0) {
      throw ApiError.badRequest('CSV file is required', 'PAYROLL_CSV_REQUIRED');
    }

    const mime = (file.mimetype || '').toLowerCase();
    const looksLikeCsv =
      mime.includes('csv') ||
      mime === 'application/vnd.ms-excel' ||
      mime === 'text/plain' ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (!looksLikeCsv) {
      throw ApiError.badRequest('Only CSV files are supported', 'PAYROLL_CSV_INVALID_MIME');
    }

    const parsed = this.parsePayrollCsvTemplate(file.buffer.toString('utf-8'), period.month, period.year);
    const result = await this.uploadPayroll(
      {
        month: parsed.month,
        year: parsed.year,
        rows: parsed.rows,
      },
      uploadedByUserId
    );

    return {
      ...result,
      templateType: parsed.templateType,
      sourceFile: file.originalname,
    };
  }

  async uploadPayroll(payload: { month: number; year: number; rows: any[] }, uploadedByUserId: string) {
    const month = parseNumber(payload.month);
    const year = parseNumber(payload.year);
    if (!Number.isInteger(month) || !Number.isInteger(year)) {
      throw ApiError.badRequest('Month and year are required', 'PAYROLL_PERIOD_REQUIRED');
    }
    this.validatePayrollPeriod(month, year);
    await this.assertPayrollPeriodEditable(month, year);

    if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
      throw ApiError.badRequest('Payroll rows are required', 'PAYROLL_ROWS_REQUIRED');
    }

    let processed = 0;
    const errors: Array<{ index: number; employeeId: string; reason: string }> = [];
    const seenEmployeeIds = new Set<string>();

    for (let i = 0; i < payload.rows.length; i += 1) {
      const row = payload.rows[i];
      const employeeCode = String(row?.employeeId || '').trim();
      try {
        if (!employeeCode) {
          throw new Error('employeeId is required');
        }
        const key = employeeCode.toUpperCase();
        if (seenEmployeeIds.has(key)) {
          throw new Error('Duplicate employeeId in payload');
        }
        seenEmployeeIds.add(key);

        const gross = parseNumber(row.gross);
        const deductions = parseNumber(row.deductions);
        const net = parseNumber(row.net);

        if (!Number.isFinite(gross) || gross <= 0) {
          throw new Error('Invalid gross amount');
        }
        if (!Number.isFinite(deductions) || deductions < 0) {
          throw new Error('Invalid deductions amount');
        }
        if (!Number.isFinite(net) || net <= 0) {
          throw new Error('Invalid net amount');
        }
        if (Math.abs(gross - (deductions + net)) > 0.02) {
          throw new Error('Gross must equal deductions + net');
        }

        const empRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `
          SELECT id
          FROM employees
          WHERE employee_id = $1
            AND deleted_at IS NULL
            AND status IN ('active', 'notice_period')
          LIMIT 1
        `,
          employeeCode
        );
        if (!empRows[0]) {
          throw new Error('Employee not found or not payroll-eligible');
        }

        const payrollRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `
          INSERT INTO payroll (employee_id, month, year, gross, deductions, net, status, uploaded_by, uploaded_at)
          VALUES ($1::uuid, $2, $3, $4, $5, $6, 'draft', $7::uuid, NOW())
          ON CONFLICT (employee_id, month, year)
          DO UPDATE SET
            gross = EXCLUDED.gross,
            deductions = EXCLUDED.deductions,
            net = EXCLUDED.net,
            status = 'draft',
            payslip_url = NULL,
            uploaded_by = EXCLUDED.uploaded_by,
            uploaded_at = NOW(),
            generated_at = NULL,
            finalized_at = NULL,
            finalized_by = NULL,
            updated_at = NOW()
          RETURNING id
        `,
          empRows[0].id,
          month,
          year,
          gross,
          deductions,
          net,
          uploadedByUserId
        );
        if (!payrollRows[0]?.id) {
          throw new Error('Unable to persist payroll row');
        }
        await this.upsertPayrollBreakdownAudit(payrollRows[0].id, uploadedByUserId, {
          employeeId: employeeCode,
          gross,
          deductions,
          net,
          earningsBreakdown: row.earningsBreakdown,
          deductionsBreakdown: row.deductionsBreakdown,
          totalWorkingDays: row.totalWorkingDays,
          leaves: row.leaves,
          lopDays: row.lopDays,
          paidDays: row.paidDays,
        });
        processed += 1;
      } catch (e: any) {
        errors.push({ index: i, employeeId: employeeCode || 'N/A', reason: e?.message || 'failed' });
      }
    }

    if (processed === 0) {
      throw ApiError.unprocessable('No valid payroll rows were uploaded', 'PAYROLL_UPLOAD_FAILED', {
        errors,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: uploadedByUserId,
        action: 'hr.payroll_uploaded',
        entityType: 'payroll',
        newValues: {
          month,
          year,
          totalRows: payload.rows.length,
          processed,
          failed: errors.length,
        },
      },
    });

    return {
      month,
      year,
      totalRows: payload.rows.length,
      processed,
      failed: errors.length,
      errors,
    };
  }

  async generatePayroll(monthInput: number, yearInput: number, generatedByUserId: string) {
    const month = parseNumber(monthInput);
    const year = parseNumber(yearInput);
    if (!Number.isInteger(month) || !Number.isInteger(year)) {
      throw ApiError.badRequest('Month and year are required', 'PAYROLL_PERIOD_REQUIRED');
    }
    this.validatePayrollPeriod(month, year);
    await this.assertPayrollPeriodEditable(month, year);

    const payrollRows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        month: number;
        year: number;
        status: string;
        employeeId: string;
        firstName: string;
        lastName: string | null;
        designation: string | null;
        department: string | null;
        joiningDate: Date | null;
        bankName: string | null;
        bankAccountNumber: string | null;
        userId: string | null;
        gross: unknown;
        deductions: unknown;
        net: unknown;
      }>
    >(
      `
      SELECT
        p.id,
        p.month,
        p.year,
        p.status::text as status,
        p.gross,
        p.deductions,
        p.net,
        e.employee_id as "employeeId",
        e.first_name as "firstName",
        e.last_name as "lastName",
        e.designation,
        e.department,
        e.joining_date as "joiningDate",
        ep.bank_name as "bankName",
        ep.bank_account_number as "bankAccountNumber",
        e.user_id as "userId"
      FROM payroll p
      JOIN employees e ON e.id = p.employee_id
      LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
      WHERE p.month = $1 AND p.year = $2
      ORDER BY e.employee_id ASC
    `,
      month,
      year
    );

    if (payrollRows.length === 0) {
      throw ApiError.notFound(
        `No payroll data found for ${month}/${year}. Please upload payroll CSV first before generating payslips.`,
        'PAYROLL_NOT_FOUND'
      );
    }

    let generated = 0;
    const errors: Array<{ payrollId: string; employeeId: string; reason: string }> = [];
    const generatedUserIds = new Set<string>();

    for (const row of payrollRows) {
      try {
        const payslipUrl = await this.generatePayslipForPayrollRow(row, generatedByUserId);
        await prisma.$executeRawUnsafe(
          `
          UPDATE payroll
          SET status = 'generated',
              payslip_url = $2,
              generated_at = NOW(),
              updated_at = NOW()
          WHERE id = $1::uuid
        `,
          row.id,
          payslipUrl
        );
        generated += 1;
        if (row.userId) generatedUserIds.add(row.userId);
      } catch (e: any) {
        errors.push({
          payrollId: row.id,
          employeeId: row.employeeId,
          reason: e?.message || 'failed',
        });
      }
    }

    if (generated === 0) {
      throw ApiError.unprocessable('Failed to generate any payslips', 'PAYSLIP_GENERATION_FAILED', {
        errors,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: generatedByUserId,
        action: 'hr.payroll_generated',
        entityType: 'payroll',
        newValues: {
          month,
          year,
          totalRows: payrollRows.length,
          generated,
          failed: errors.length,
        },
      },
    });

    {
      const adminUserIds = await this.getHrmsAdminRecipients();
      const monthYear = `${String(month).padStart(2, '0')}/${year}`;
      await this.notifyHrms(
        'hrms_payroll_generated',
        generatedByUserId,
        [...generatedUserIds, ...adminUserIds],
        {
          month,
          year,
          monthYear,
          generated,
          failed: errors.length,
        }
      );
    }

    return {
      month,
      year,
      status: errors.length > 0 ? 'partially_generated' : 'generated',
      totalRows: payrollRows.length,
      generated,
      failed: errors.length,
      errors,
    };
  }

  async finalizePayroll(monthInput: number, yearInput: number, finalizedByUserId: string) {
    const month = parseNumber(monthInput);
    const year = parseNumber(yearInput);
    if (!Number.isInteger(month) || !Number.isInteger(year)) {
      throw ApiError.badRequest('Month and year are required', 'PAYROLL_PERIOD_REQUIRED');
    }
    this.validatePayrollPeriod(month, year);
    await this.assertPayrollPeriodEditable(month, year);

    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; status: string; payslipUrl: string | null; userId: string | null }>
    >(
      `
      SELECT p.id, p.status::text as status, p.payslip_url as "payslipUrl", e.user_id as "userId"
      FROM payroll p
      JOIN employees e ON e.id = p.employee_id
      WHERE p.month = $1 AND p.year = $2
    `,
      month,
      year
    );
    if (rows.length === 0) {
      throw ApiError.notFound('No payroll rows found for this period', 'PAYROLL_NOT_FOUND');
    }

    const pendingRows = rows.filter(row => row.status !== 'generated' || !row.payslipUrl);
    if (pendingRows.length > 0) {
      throw ApiError.unprocessable(
        'All payroll rows must be generated with payslip URLs before finalization',
        'PAYROLL_NOT_READY_FOR_FINALIZATION',
        {
          totalRows: rows.length,
          pendingRows: pendingRows.length,
          sample: pendingRows.slice(0, 10).map(row => ({ payrollId: row.id, status: row.status })),
        }
      );
    }

    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(
        `
        UPDATE payroll
        SET status = 'finalized', finalized_at = NOW(), finalized_by = $3::uuid, updated_at = NOW()
        WHERE month = $1 AND year = $2 AND status = 'generated'
      `,
        month,
        year,
        finalizedByUserId
      );

      await tx.$executeRawUnsafe(
        `
        INSERT INTO payroll_locks (month, year, locked_by)
        VALUES ($1, $2, $3::uuid)
        ON CONFLICT (month, year) DO UPDATE SET locked_by = EXCLUDED.locked_by, locked_at = NOW()
      `,
        month,
        year,
        finalizedByUserId
      );

      await tx.auditLog.create({
        data: {
          userId: finalizedByUserId,
          action: 'hr.payroll_finalized',
          entityType: 'payroll',
          newValues: { month, year, totalRows: rows.length },
        },
      });
    });

    {
      const adminUserIds = await this.getHrmsAdminRecipients();
      const monthYear = `${String(month).padStart(2, '0')}/${year}`;
      const employeeUserIds = rows.map((r) => r.userId).filter(Boolean) as string[];
      await this.notifyHrms(
        'hrms_payroll_finalized',
        finalizedByUserId,
        [...employeeUserIds, ...adminUserIds],
        { month, year, monthYear }
      );
    }

    return { month, year, status: 'finalized', totalRows: rows.length, finalized: rows.length, locked: true };
  }

  async getPayrollStatus(monthInput: number, yearInput: number) {
    const month = parseNumber(monthInput);
    const year = parseNumber(yearInput);
    if (!Number.isInteger(month) || !Number.isInteger(year)) {
      throw ApiError.badRequest('Month and year are required', 'PAYROLL_PERIOD_REQUIRED');
    }

    const summaryRows = await prisma.$queryRawUnsafe<
      Array<{
        total: number;
        draft: number;
        generated: number;
        finalized: number;
        withPayslips: number;
      }>
    >(
      `
      SELECT
        COUNT(*)::int as total,
        COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0)::int as draft,
        COALESCE(SUM(CASE WHEN status = 'generated' THEN 1 ELSE 0 END), 0)::int as generated,
        COALESCE(SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END), 0)::int as finalized,
        COALESCE(SUM(CASE WHEN payslip_url IS NOT NULL THEN 1 ELSE 0 END), 0)::int as "withPayslips"
      FROM payroll
      WHERE month = $1 AND year = $2
    `,
      month,
      year
    );

    const lockRows = await prisma.$queryRawUnsafe<Array<{ lockedAt: Date }>>(
      `
      SELECT locked_at as "lockedAt"
      FROM payroll_locks
      WHERE month = $1 AND year = $2
      LIMIT 1
    `,
      month,
      year
    );

    const summary = summaryRows[0] || {
      total: 0,
      draft: 0,
      generated: 0,
      finalized: 0,
      withPayslips: 0,
    };

    const employeeRows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        p.id           AS "payrollId",
        e.employee_id  AS "employeeCode",
        e.first_name   AS "firstName",
        e.last_name    AS "lastName",
        e.department,
        p.gross::float AS gross,
        p.net::float   AS net,
        p.status::text AS status,
        p.payslip_url  AS "payslipUrl"
      FROM payroll p
      JOIN employees e ON e.id = p.employee_id
      WHERE p.month = $1 AND p.year = $2
      ORDER BY e.first_name, e.last_name
      `,
      month,
      year
    );

    return {
      month,
      year,
      locked: Boolean(lockRows[0]),
      lockedAt: lockRows[0]?.lockedAt || null,
      summary,
      breakdown: [
        { status: 'draft', count: summary.draft },
        { status: 'generated', count: summary.generated },
        { status: 'finalized', count: summary.finalized },
      ],
      employees: employeeRows,
    };
  }

  async exportPayroll(monthInput: number, yearInput: number) {
    const month = parseNumber(monthInput);
    const year = parseNumber(yearInput);
    if (!Number.isInteger(month) || !Number.isInteger(year)) {
      throw ApiError.badRequest('Month and year are required', 'PAYROLL_PERIOD_REQUIRED');
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        e.employee_id        AS "employeeId",
        e.first_name         AS "firstName",
        e.last_name          AS "lastName",
        e.designation,
        e.department,
        p.month,
        p.year,
        p.gross::float       AS gross,
        p.deductions::float  AS deductions,
        p.net::float         AS net,
        p.status::text       AS status,
        TO_CHAR(p.generated_at, 'DD-Mon-YYYY HH12:MI AM') AS "generatedAt",
        TO_CHAR(p.finalized_at, 'DD-Mon-YYYY HH12:MI AM') AS "finalizedAt",
        al.new_values        AS breakdown
      FROM payroll p
      JOIN employees e ON e.id = p.employee_id
      LEFT JOIN LATERAL (
        SELECT new_values FROM audit_logs
        WHERE entity_type = 'payroll'
          AND entity_id   = p.id
          AND action      = 'hr.payroll_breakdown_upserted'
        ORDER BY created_at DESC LIMIT 1
      ) al ON true
      WHERE p.month = $1 AND p.year = $2
      ORDER BY e.employee_id ASC
      `,
      month,
      year
    );

    // Helper — find amount for a component label (case-insensitive, substring match)
    const getAmount = (
      items: Array<{ label: string; amount: number }> | undefined,
      ...labels: string[]
    ): number | string => {
      if (!items) return '';
      for (const lbl of labels) {
        const found = items.find((i) =>
          i.label.toLowerCase().includes(lbl.toLowerCase())
        );
        if (found) return found.amount;
      }
      return '';
    };

    const EXPORT_HEADERS = [
      'Employee ID', 'First Name', 'Last Name', 'Designation', 'Department',
      'Month', 'Year',
      'Basic Salary', 'HRA', 'Conveyance Allowance', 'Medical Allowance', 'Special Allowance',
      'Gross Salary',
      'EPF (Employee)', 'ESIC (Employee)', 'Professional Tax', 'TDS',
      'Total Deductions', 'Net Salary',
      'Status', 'Generated At', 'Finalized At',
    ];

    const flatRows = rows.map((row) => {
      const bd = row.breakdown || {};
      const earn: Array<{ label: string; amount: number }> = bd.earningsBreakdown   || [];
      const ded:  Array<{ label: string; amount: number }> = bd.deductionsBreakdown || [];

      return {
        'Employee ID':          row.employeeId,
        'First Name':           row.firstName,
        'Last Name':            row.lastName  || '',
        'Designation':          row.designation || '',
        'Department':           row.department  || '',
        'Month':                row.month,
        'Year':                 row.year,
        'Basic Salary':         getAmount(earn, 'basic'),
        'HRA':                  getAmount(earn, 'hra', 'house rent'),
        'Conveyance Allowance': getAmount(earn, 'conveyance'),
        'Medical Allowance':    getAmount(earn, 'medical'),
        'Special Allowance':    getAmount(earn, 'special'),
        'Gross Salary':         row.gross,
        'EPF (Employee)':       getAmount(ded, 'epf', 'pf'),
        'ESIC (Employee)':      getAmount(ded, 'esi'),
        'Professional Tax':     getAmount(ded, 'professional'),
        'TDS':                  getAmount(ded, 'tds'),
        'Total Deductions':     row.deductions,
        'Net Salary':           row.net,
        'Status':               row.status,
        'Generated At':         row.generatedAt  || '',
        'Finalized At':         row.finalizedAt  || '',
      };
    });

    return { rows: flatRows, csv: toCsv(EXPORT_HEADERS, flatRows) };
  }

  async getOrgChart(branchId?: string | null) {
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT e.id, e.employee_id as "employeeId", e.first_name as "firstName", e.last_name as "lastName",
             e.designation, e.department, e.manager_id as "managerId", e.status::text as status
      FROM employees e
      WHERE e.deleted_at IS NULL AND e.status IN ('active', 'notice_period', 'onboarding')
        AND ($1::text IS NULL OR e.branch_id = $1)
      ORDER BY e.first_name ASC
    `,
      branchId ?? null
    );
  }

  async getTeamHierarchy(managerEmployeeId: string) {
    const manager = await this.getEmployeeByIdDetailed(managerEmployeeId);
    const reports = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, employee_id as "employeeId", first_name as "firstName", last_name as "lastName",
             designation, department, status::text as status
      FROM employees
      WHERE manager_id = $1::uuid AND deleted_at IS NULL
      ORDER BY first_name ASC
    `,
      managerEmployeeId
    );
    return { manager, directReports: reports, totalTeamSize: reports.length };
  }

  async reassignManager(employeeId: string, managerEmployeeId: string | null, updatedByUserId: string) {
    const employee = await this.getEmployeeById(employeeId);
    const resolvedId = employee.id;
    if (managerEmployeeId) {
      await this.validateManagerAssignment(resolvedId, managerEmployeeId);
    }
    await prisma.$executeRawUnsafe(
      `
      UPDATE employees
      SET manager_id = $2::uuid, updated_by = $3::uuid, updated_at = NOW()
      WHERE id = $1::uuid
    `,
      resolvedId,
      managerEmployeeId,
      updatedByUserId
    );
    return { employeeId: resolvedId, managerEmployeeId };
  }

  async exportOrgChart(branchId?: string | null) {
    const rows = await this.getOrgChart(branchId);
    const headers = ['employeeId', 'firstName', 'lastName', 'designation', 'department', 'managerId', 'status'];
    return { rows, csv: toCsv(headers, rows) };
  }

  async attendanceReport(query: any, branchId?: string | null) {
    const employeeId = query.employeeId as string | undefined;
    // Use exportAttendance for BOTH the JSON and CSV paths so that synthesized
    // "Absent" rows for missing (employee × day) combinations show up in both —
    // the on-screen report and the download were inconsistent before.
    const attendanceExport = await this.exportAttendance({
      fromDate: query.fromDate as string | undefined,
      toDate: query.toDate as string | undefined,
      branchId,
      employeeId,
    });

    // Aggregate the same rows into the "cards" the UI expects, so the report
    // summary boxes match the row list. Reuses buildAttendanceCards via a
    // status-count map (statuses come from exportAttendance as INITCAP'd
    // strings like 'Present' / 'Absent' / 'Half_Day' — normalize back).
    const statusCounts: Record<string, number> = {};
    for (const r of attendanceExport.rows) {
      const s = String(r.status || 'Absent').toLowerCase();
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    const total = attendanceExport.rows.length;
    const cards = buildAttendanceCards(total, statusCounts as any);

    return {
      json: {
        items: attendanceExport.rows,
        cards,
        pagination: { page: 1, limit: total, total, totalPages: 1 },
      },
      csv: attendanceExport.csv,
    };
  }

  async leaveReport(query: any, branchId?: string | null) {
    const data = await this.listLeaves({
      fromDate: query.fromDate as string | undefined,
      toDate: query.toDate as string | undefined,
      branchId: branchId ?? undefined,
      page: 1,
      limit: 100000,
    });
    const leaveExport = await this.exportLeaves({
      employeeId: query.employeeId as string | undefined,
      status: query.status as string | undefined,
      fromDate: query.fromDate as string | undefined,
      toDate: query.toDate as string | undefined,
      branchId,
    });
    return { json: data, csv: leaveExport.csv };
  }

  async payrollReport(query: any) {
    const month = query.month ? parseInt(query.month as string, 10) : new Date().getMonth() + 1;
    const year = query.year ? parseInt(query.year as string, 10) : new Date().getFullYear();
    const data = await this.exportPayroll(month, year);
    return { json: { month, year, rows: data.rows }, csv: data.csv };
  }

  // Dashboard Method
  async getHrDashboard(branchId?: string | null) {
    const today = new Date();
    // attendance.date stores IST date (set via toDateOnly elsewhere). Match it
    // here so the dashboard's "today" count uses the IST calendar day, not the
    // UTC one — otherwise the count is wrong for the last ~5.5h of every IST day.
    const dateOnly = toDateOnly(today);
    const istParts = dateOnly.split('-').map(Number);
    const currentYear = istParts[0];
    const currentMonth = istParts[1];
    const bid = branchId || null;

    const [
      totalEmployeesRows,
      activeEmployeesRows,
      onboardingEmployeesRows,
      exitingEmployeesRows,
      todayAttendanceRows,
      pendingLeavesRows,
      urgentLeavesRows,
      activeOnboardingRows,
      delayedOnboardingRows,
      activeOffboardingRows,
      delayedOffboardingRows,
      payrollStatus,
    ] = await Promise.all([
      // 1. Total employees (all non-deleted, non-admin employees regardless of status)
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      // 2. Active employees
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.status = 'active' AND e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      // 3. Onboarding employees
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.status = 'onboarding' AND e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      // 4. Exiting employees (notice_period or exited)
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM employees e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE e.status IN ('notice_period', 'exited') AND e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      // 5. Today's attendance (present / checked-in)
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM attendance a JOIN employees e ON e.id = a.employee_id LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE a.date = $1::date AND a.status IN ('checked_in', 'present') AND e.status = 'active' AND e.deleted_at IS NULL AND (r.name IS NULL OR r.name != 'admin') AND ($2::text IS NULL OR e.branch_id = $2)`, dateOnly, bid),
      // 6. Pending leaves
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM leaves l JOIN employees e ON e.id = l.employee_id WHERE l.status = 'pending' AND ($1::text IS NULL OR e.branch_id = $1 OR e.branch_id IS NULL)`, bid),
      // 7. Urgent leaves (starting within 3 days)
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM leaves l JOIN employees e ON e.id = l.employee_id WHERE l.status = 'pending' AND l.from_date <= CURRENT_DATE + INTERVAL '3 days' AND ($1::text IS NULL OR e.branch_id = $1 OR e.branch_id IS NULL)`, bid),
      // 8. Active onboarding
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM onboarding o JOIN employees e ON e.id = o.employee_id LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE o.status = 'in_progress' AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      // 9. Delayed onboarding
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM onboarding o JOIN employees e ON e.id = o.employee_id LEFT JOIN users u ON u.id = e.user_id LEFT JOIN roles r ON r.id = u.role_id WHERE o.status = 'in_progress' AND o.target_completion_date < CURRENT_DATE AND (r.name IS NULL OR r.name != 'admin') AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      // 10. Active offboarding
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM offboarding o JOIN employees e ON e.id = o.employee_id WHERE o.status = 'in_progress' AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      // 11. Delayed offboarding
      prisma.$queryRawUnsafe<Array<{ count: string }>>(`SELECT COUNT(*)::text as count FROM offboarding o JOIN employees e ON e.id = o.employee_id WHERE o.status = 'in_progress' AND o.last_working_day < CURRENT_DATE AND ($1::text IS NULL OR e.branch_id = $1)`, bid),
      // 12. Payroll status
      this.getPayrollStatus(currentMonth, currentYear),
    ]);

    const totalEmployees = parseInt(totalEmployeesRows[0]?.count || '0', 10);
    const activeEmployees = parseInt(activeEmployeesRows[0]?.count || '0', 10);
    const onboardingEmployees = parseInt(onboardingEmployeesRows[0]?.count || '0', 10);
    const exitingEmployees = parseInt(exitingEmployeesRows[0]?.count || '0', 10);
    const todayAttendance = parseInt(todayAttendanceRows[0]?.count || '0', 10);
    const pendingLeaves = parseInt(pendingLeavesRows[0]?.count || '0', 10);
    const urgentLeaves = parseInt(urgentLeavesRows[0]?.count || '0', 10);
    const activeOnboarding = parseInt(activeOnboardingRows[0]?.count || '0', 10);
    const delayedOnboarding = parseInt(delayedOnboardingRows[0]?.count || '0', 10);
    const activeOffboarding = parseInt(activeOffboardingRows[0]?.count || '0', 10);
    const delayedOffboarding = parseInt(delayedOffboardingRows[0]?.count || '0', 10);

    return {
      overview: {
        totalEmployees,
        activeEmployees,
        onboardingEmployees,
        exitingEmployees,
      },
      attendance: {
        today: {
          present: todayAttendance,
          absent: Math.max(0, activeEmployees - todayAttendance),
        },
      },
      leaves: {
        pending: pendingLeaves,
        urgent: urgentLeaves,
      },
      onboarding: {
        active: activeOnboarding,
        delayed: delayedOnboarding,
      },
      offboarding: {
        active: activeOffboarding,
        delayed: delayedOffboarding,
      },
      payroll: payrollStatus,
    };
  }
  // ── Onboarding Self-Registration Invite ─────────────────────────────────────

  async sendOnboardingInvite(employeeId: string, initiatedByUserId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    const whereClause = isUuid ? `id = $1::uuid` : `LOWER(employee_id) = LOWER($1)`;
    const employee = await prisma.$queryRawUnsafe<Array<{
      id: string; first_name: string; last_name: string | null; email: string;
      joining_date: Date; status: string;
    }>>(
      `SELECT id, first_name, last_name, email, joining_date, status::text as status
       FROM employees WHERE ${whereClause} AND deleted_at IS NULL LIMIT 1`,
      employeeId
    );
    const emp = employee[0];
    if (!emp) throw ApiError.notFound('Employee not found');
    const resolvedId = emp.id;
    if (emp.status === 'exited' || emp.status === 'deleted') {
      throw ApiError.unprocessable('Cannot send invite to exited/deleted employee');
    }
    if (!emp.email || !emp.email.trim()) {
      throw ApiError.unprocessable(
        'Employee does not have a personal email address on record. Please add an email before sending an invite.',
        'MISSING_PERSONAL_EMAIL'
      );
    }

    // Upsert invite — regenerate token if already sent
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    await prisma.$executeRawUnsafe(
      `INSERT INTO onboarding_invites (employee_id, token, expires_at, created_by)
       VALUES ($1::uuid, $2, $3, $4::uuid)
       ON CONFLICT (employee_id) DO UPDATE
         SET token = EXCLUDED.token,
             expires_at = EXCLUDED.expires_at,
             used_at = NULL,
             created_by = EXCLUDED.created_by`,
      resolvedId, token, expiresAt, initiatedByUserId
    );

    const actorName = await this.getActorDisplayName(initiatedByUserId);
    const registrationUrl = `${config.frontend.hrmsUrl}/register/onboarding?token=${token}`;
    const joiningDateStr = emp.joining_date instanceof Date
      ? emp.joining_date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : String(emp.joining_date);

    await emailService.sendEmail({
      to: emp.email,
      subject: 'Welcome! Complete Your Onboarding Registration',
      html: emailTemplates.onboardingInvite({
        employeeName: `${emp.first_name} ${emp.last_name || ''}`.trim(),
        companyName: getCompanyCached().name,
        joiningDate: joiningDateStr,
        registrationUrl,
        expiresIn: '72 hours',
        hrName: actorName,
      }),
    });

    return { success: true, message: 'Onboarding invite sent successfully', expiresAt };
  }

  /**
   * Set (or update) the work email and password for an active employee.
   * Updates the DB user account and Keycloak. No email is sent — HR shares credentials directly.
   */
  async setWorkEmail(employeeId: string, workEmail: string, updatedByUserId: string, password: string) {
    // 1. Load employee — must be active
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    const whereClause = isUuid ? `e.id = $1::uuid` : `LOWER(e.employee_id) = LOWER($1)`;
    const empRows = await prisma.$queryRawUnsafe<Array<{
      id: string; first_name: string; last_name: string | null;
      email: string; status: string; user_id: string | null;
    }>>(
      `SELECT e.id, e.first_name, e.last_name, e.email, e.status, e.user_id
       FROM employees e
       WHERE ${whereClause} AND e.deleted_at IS NULL LIMIT 1`,
      employeeId
    );
    const emp = empRows[0];
    if (!emp) throw ApiError.notFound('Employee not found');
    const resolvedId = emp.id;
    const allowedStatuses = ['active', 'onboarding'];
    if (!allowedStatuses.includes(emp.status)) {
      throw ApiError.unprocessable(
        `Work email cannot be set for employees with status "${emp.status}". Employee must be active or in onboarding.`,
        'EMPLOYEE_NOT_ACTIVE'
      );
    }

    // 2. Ensure the work email is not already taken by another user/employee
    const emailConflict = await prisma.$queryRawUnsafe<Array<{ cnt: string }>>(
      `SELECT COUNT(*)::text AS cnt
       FROM employees
       WHERE email = $1 AND id != $2::uuid AND deleted_at IS NULL`,
      workEmail, resolvedId
    );
    if (parseInt(emailConflict[0]?.cnt || '0', 10) > 0) {
      throw ApiError.conflict('This email address is already assigned to another employee', 'EMAIL_TAKEN');
    }
    const userEmailConflict = await prisma.$queryRawUnsafe<Array<{ cnt: string }>>(
      `SELECT COUNT(*)::text AS cnt FROM users WHERE email = $1 AND id != $2`,
      workEmail, emp.user_id || '00000000-0000-0000-0000-000000000000'
    );
    if (parseInt(userEmailConflict[0]?.cnt || '0', 10) > 0) {
      throw ApiError.conflict('This email address is already in use by another account', 'EMAIL_TAKEN');
    }

    // 3. Hash the HR-provided password
    if (!password || password.length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters', 'INVALID_PASSWORD');
    }
    const passwordHash = await bcrypt.hash(password, 12);

    let userId = emp.user_id;

    await prisma.$transaction(async tx => {
      // 4a. Preserve the current employees.email as personal_email in employee_profiles
      //     (only if personal_email is not already set — emp.email holds the personal email before this update)
      if (emp.email && emp.email !== workEmail) {
        await tx.$executeRawUnsafe(
          `INSERT INTO employee_profiles (employee_id, personal_email)
           VALUES ($1::uuid, $2)
           ON CONFLICT (employee_id) DO UPDATE
             SET personal_email = COALESCE(employee_profiles.personal_email, EXCLUDED.personal_email)`,
          resolvedId, emp.email
        );
      }

      // 4b. Update employee work email
      await tx.$executeRawUnsafe(
        `UPDATE employees SET email = $2, updated_by = $3::uuid, updated_at = NOW() WHERE id = $1::uuid`,
        resolvedId, workEmail, updatedByUserId
      );

      if (userId) {
        // 4b. Update existing User account — set work email + activate + new password
        await tx.$executeRawUnsafe(
          `UPDATE users
           SET email = $2, password_hash = $3, is_active = true, updated_at = NOW()
           WHERE id = $1::uuid`,
          userId, workEmail, passwordHash
        );
      } else {
        // 4c. Create a brand-new User account linked to this employee
        const newUserRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `INSERT INTO users (email, password_hash, first_name, last_name, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())
           RETURNING id`,
          workEmail, passwordHash, emp.first_name, emp.last_name || ''
        );
        userId = newUserRows[0]?.id;
        if (userId) {
          await tx.$executeRawUnsafe(
            `UPDATE employees SET user_id = $2::uuid, updated_at = NOW() WHERE id = $1::uuid`,
            resolvedId, userId
          );
        }
      }

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          userId: updatedByUserId,
          action: 'hr.work_email_set',
          entityType: 'employee',
          entityId: resolvedId,
          newValues: { workEmail, employeeId: resolvedId },
        },
      });
    });

    // 6. Sync email + password to Keycloak (non-blocking — DB already committed above)
    if (userId) {
      try {
        const subRows = await prisma.$queryRawUnsafe<Array<{ keycloak_sub: string | null }>>(
          `SELECT keycloak_sub FROM users WHERE id = $1::uuid`, userId
        );
        let keycloakSub = subRows[0]?.keycloak_sub ?? null;

        if (!keycloakSub) {
          // No Keycloak user yet — create one with the work email (non-temporary password)
          keycloakSub = await createKeycloakUser({
            email: workEmail,
            firstName: emp.first_name,
            lastName: emp.last_name || '',
            temporaryPassword: password,
            temporary: false,
          });
          if (keycloakSub) {
            await prisma.$executeRawUnsafe(
              `UPDATE users SET keycloak_sub = $1 WHERE id = $2::uuid`,
              keycloakSub, userId
            );
          }
        } else {
          // Existing Keycloak user — update email and set new password (non-temporary)
          await Promise.all([
            updateKeycloakUserEmail(keycloakSub, workEmail),
            resetKeycloakUserPassword(keycloakSub, password, false),
          ]);
        }
      } catch (kcError: any) {
        logger.warn('Keycloak sync failed during setWorkEmail — DB updated, Keycloak out of sync:', kcError?.message);
        // Do not throw — DB and local user account are already updated successfully
      }
    }

    // 7. Send credentials email to the work email address
    const fullName = `${emp.first_name} ${emp.last_name || ''}`.trim();
    const loginUrl = `${config.frontend.hrmsUrl}/login`;
    const pmtLoginUrl = `${config.frontend.url}/login`;
    await emailService.sendEmail({
      to: workEmail,
      subject: `Your Account is Ready — Welcome to ${getCompanyCached().name}!`,
      html: emailTemplates.workEmailWelcome({
        employeeName: fullName,
        workEmail,
        tempPassword: password,
        loginUrl,
        pmtLoginUrl,
      }),
    });

    return { success: true, message: 'Work email assigned and credentials sent.', workEmail };
  }

  async sendOnboardingOtp(token: string) {
    const invite = await this.validateInviteToken(token);

    // Generate a 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in DB (replace any existing unverified OTP for this employee)
    await prisma.$executeRawUnsafe(
      `INSERT INTO onboarding_otps (employee_id, otp_hash, expires_at)
       VALUES ($1::uuid, $2, $3)`,
      invite.employeeId, otpHash, expiresAt
    );

    // Send OTP email
    await emailService.sendEmail({
      to: invite.email,
      subject: 'Your Email Verification OTP – Onboarding Registration',
      html: emailTemplates.onboardingOtp({
        employeeName: invite.name,
        otp,
        expiresIn: '10 minutes',
      }),
    });

    return { success: true, message: 'OTP sent to your registered email address' };
  }

  async verifyOnboardingOtp(token: string, otp: string) {
    const invite = await this.validateInviteToken(token);

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string; expires_at: Date; verified_at: Date | null;
    }>>(
      `SELECT id, expires_at, verified_at
       FROM onboarding_otps
       WHERE employee_id = $1::uuid AND otp_hash = $2
       ORDER BY created_at DESC LIMIT 1`,
      invite.employeeId, otpHash
    );

    const row = rows[0];
    if (!row) throw ApiError.unprocessable('Invalid OTP. Please check and try again.', 'INVALID_OTP');
    if (row.verified_at) throw ApiError.conflict('This OTP has already been used.', 'OTP_USED');
    if (new Date(row.expires_at) < new Date()) {
      throw ApiError.unprocessable('OTP has expired. Please request a new one.', 'OTP_EXPIRED');
    }

    // Mark OTP as verified
    await prisma.$executeRawUnsafe(
      `UPDATE onboarding_otps SET verified_at = NOW() WHERE id = $1::uuid`,
      row.id
    );

    // Issue short-lived session token for the onboarding registration
    const sessionToken = JwtUtils.generateOnboardingSessionToken(invite.employeeId, token);

    return { success: true, sessionToken };
  }

  async validateInviteToken(token: string) {
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string; employee_id: string; expires_at: Date; used_at: Date | null;
      first_name: string; last_name: string | null; email: string;
      employee_code: string; designation: string; department: string;
      joining_date: Date;
    }>>(
      `SELECT oi.id, oi.employee_id, oi.expires_at, oi.used_at,
              e.first_name, e.last_name, e.email,
              e.employee_id as employee_code, e.designation, e.department, e.joining_date
       FROM onboarding_invites oi
       JOIN employees e ON e.id = oi.employee_id
       WHERE oi.token = $1 LIMIT 1`,
      token
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound('Invalid or expired registration link', 'INVALID_TOKEN');
    if (row.used_at) throw ApiError.conflict('This registration link has already been used', 'TOKEN_USED');
    if (new Date(row.expires_at) < new Date()) {
      throw ApiError.unprocessable('This registration link has expired. Please contact HR for a new link.', 'TOKEN_EXPIRED');
    }
    return {
      employeeId: row.employee_id,
      name: `${row.first_name} ${row.last_name || ''}`.trim(),
      email: row.email,
      employeeCode: row.employee_code,
      designation: row.designation,
      department: row.department,
      joiningDate: row.joining_date,
    };
  }

  /**
   * Public token status check — used when employee revisits the onboarding URL.
   * Unlike validateInviteToken, this does NOT throw on used tokens; instead it
   * returns a tokenStatus field so the frontend can show the right screen.
   */
  async getInviteTokenStatus(token: string) {
    const rows = await prisma.$queryRawUnsafe<Array<{
      employee_id: string; expires_at: Date; used_at: Date | null;
      first_name: string; last_name: string | null; email: string; phone: string | null;
      employee_code: string; designation: string; department: string;
      joining_date: Date;
    }>>(
      `SELECT oi.employee_id, oi.expires_at, oi.used_at,
              e.first_name, e.last_name, e.email, e.phone,
              e.employee_id as employee_code, e.designation, e.department, e.joining_date
       FROM onboarding_invites oi
       JOIN employees e ON e.id = oi.employee_id
       WHERE oi.token = $1 LIMIT 1`,
      token
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound('Invalid or expired registration link', 'INVALID_TOKEN');
    if (new Date(row.expires_at) < new Date()) {
      throw ApiError.unprocessable('This registration link has expired. Please contact HR for a new link.', 'TOKEN_EXPIRED');
    }

    const baseInfo = {
      employeeId: row.employee_id,
      name: `${row.first_name} ${row.last_name || ''}`.trim(),
      email: row.email,
      phone: row.phone || null,
      employeeCode: row.employee_code,
      designation: row.designation,
      department: row.department,
      joiningDate: row.joining_date,
    };

    if (!row.used_at) {
      return { ...baseInfo, tokenStatus: 'active' as const };
    }

    // Token already used — check if HR has released the offer letter
    const offerLetterRows = await prisma.$queryRawUnsafe<Array<{ completed: boolean }>>(
      `SELECT ot.completed
       FROM onboarding_tasks ot
       JOIN onboarding o ON o.id = ot.onboarding_id
       WHERE o.employee_id = $1::uuid
         AND LOWER(ot.task_name) LIKE '%offer letter%'
       LIMIT 1`,
      row.employee_id
    );
    const offerLetterSent = offerLetterRows[0]?.completed === true;

    return {
      ...baseInfo,
      tokenStatus: (offerLetterSent ? 'offer_letter_sent' : 'pending_offer_letter') as 'offer_letter_sent' | 'pending_offer_letter',
    };
  }

  async releaseOfferLetter(employeeId: string, releasedByUserId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    const empWhereClause = isUuid ? `id = $1::uuid` : `LOWER(employee_id) = LOWER($1)`;
    const empRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM employees WHERE ${empWhereClause} AND deleted_at IS NULL LIMIT 1`,
      employeeId
    );
    if (!empRows[0]) throw ApiError.notFound('Employee not found', 'EMPLOYEE_NOT_FOUND');
    const resolvedId = empRows[0].id;

    const onboardingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM onboarding WHERE employee_id = $1::uuid AND status = 'in_progress' LIMIT 1`,
      resolvedId
    );
    const onboarding = onboardingRows[0];
    if (!onboarding) throw ApiError.notFound('No active onboarding found for this employee', 'ONBOARDING_NOT_FOUND');

    const taskRows = await prisma.$queryRawUnsafe<Array<{ id: string; completed: boolean }>>(
      `SELECT id, completed FROM onboarding_tasks
       WHERE onboarding_id = $1::uuid AND LOWER(task_name) LIKE '%offer letter%'
       LIMIT 1`,
      onboarding.id
    );
    const task = taskRows[0];
    if (!task) throw ApiError.notFound('Offer letter task not found in onboarding checklist', 'TASK_NOT_FOUND');
    if (task.completed) throw ApiError.conflict('Offer letter has already been released', 'ALREADY_RELEASED');

    await prisma.$executeRawUnsafe(
      `UPDATE onboarding_tasks
       SET completed = true, completed_at = NOW(), completed_by = $2::uuid,
           notes = 'Offer letter released to employee email'
       WHERE id = $1::uuid`,
      task.id, releasedByUserId
    );

    // Recalculate onboarding progress
    const progressRows = await prisma.$queryRawUnsafe<Array<{ total: string; done: string }>>(
      `SELECT COUNT(*)::text as total,
              SUM(CASE WHEN completed THEN 1 ELSE 0 END)::text as done
       FROM onboarding_tasks WHERE onboarding_id = $1::uuid`,
      onboarding.id
    );
    const total = parseInt(progressRows[0]?.total || '0', 10);
    const done = parseInt(progressRows[0]?.done || '0', 10);
    await prisma.$executeRawUnsafe(
      `UPDATE onboarding SET progress = $2, updated_at = NOW() WHERE id = $1::uuid`,
      onboarding.id, `${done}/${total}`
    );

    return { success: true, message: 'Offer letter released successfully' };
  }

  async submitSelfRegistration(token: string, personalData: {
    personalEmail?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    maritalStatus?: string;
    currentAddress?: string;
    permanentAddress?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankIfscCode?: string;
    bankBranchName?: string;
    bankAccountHolderName?: string;
  }) {
    // Use relaxed lookup so employee can re-submit personal details after going
    // back from the documents step (token may already be marked used_at).
    const rows = await prisma.$queryRawUnsafe<Array<{
      employee_id: string; expires_at: Date;
    }>>(
      `SELECT oi.employee_id, oi.expires_at
       FROM onboarding_invites oi
       WHERE oi.token = $1 LIMIT 1`,
      token
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound('Invalid or expired registration link', 'INVALID_TOKEN');
    if (new Date(row.expires_at) < new Date()) {
      throw ApiError.unprocessable('This registration link has expired. Please contact HR for a new link.', 'TOKEN_EXPIRED');
    }
    const invite = { employeeId: row.employee_id };

    // Upsert employee profile
    await prisma.$executeRawUnsafe(
      `INSERT INTO employee_profiles (
         employee_id, personal_email, blood_group, marital_status,
         current_address, permanent_address,
         emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
         bank_name, bank_account_number, bank_ifsc_code, bank_branch_name, bank_account_holder_name
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (employee_id) DO UPDATE SET
         personal_email = COALESCE(EXCLUDED.personal_email, employee_profiles.personal_email),
         blood_group = COALESCE(EXCLUDED.blood_group, employee_profiles.blood_group),
         marital_status = COALESCE(EXCLUDED.marital_status::employee_marital_status, employee_profiles.marital_status),
         current_address = COALESCE(EXCLUDED.current_address, employee_profiles.current_address),
         permanent_address = COALESCE(EXCLUDED.permanent_address, employee_profiles.permanent_address),
         emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, employee_profiles.emergency_contact_name),
         emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, employee_profiles.emergency_contact_phone),
         emergency_contact_relation = COALESCE(EXCLUDED.emergency_contact_relation, employee_profiles.emergency_contact_relation),
         bank_name = COALESCE(EXCLUDED.bank_name, employee_profiles.bank_name),
         bank_account_number = COALESCE(EXCLUDED.bank_account_number, employee_profiles.bank_account_number),
         bank_ifsc_code = COALESCE(EXCLUDED.bank_ifsc_code, employee_profiles.bank_ifsc_code),
         bank_branch_name = COALESCE(EXCLUDED.bank_branch_name, employee_profiles.bank_branch_name),
         bank_account_holder_name = COALESCE(EXCLUDED.bank_account_holder_name, employee_profiles.bank_account_holder_name),
         updated_at = NOW()`,
      invite.employeeId,
      personalData.personalEmail || null,
      personalData.bloodGroup || null,
      personalData.maritalStatus || null,
      personalData.currentAddress || null,
      personalData.permanentAddress || null,
      personalData.emergencyContactName || null,
      personalData.emergencyContactPhone || null,
      personalData.emergencyContactRelation || null,
      personalData.bankName || null,
      personalData.bankAccountNumber || null,
      personalData.bankIfscCode || null,
      personalData.bankBranchName || null,
      personalData.bankAccountHolderName || null,
    );

    // Update phone/DOB/gender on employee if provided
    if (personalData.phone || personalData.dateOfBirth || personalData.gender) {
      const updates: string[] = [];
      const params: any[] = [invite.employeeId];
      if (personalData.phone) {
        params.push(personalData.phone);
        updates.push(`phone = $${params.length}`);
      }
      if (personalData.dateOfBirth) {
        params.push(personalData.dateOfBirth);
        updates.push(`date_of_birth = $${params.length}::date`);
      }
      if (personalData.gender) {
        params.push(personalData.gender);
        updates.push(`gender = $${params.length}::gender`);
      }
      if (updates.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE employees SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1::uuid`,
          ...params
        );
      }
    }

    return { success: true, message: 'Registration details saved successfully' };
  }

  async markOnboardingSubmissionComplete(token: string) {
    // Mark the invite as used — called after the employee has uploaded all required documents.
    // This is the point at which the link transitions to "pending_offer_letter" state.
    const rows = await prisma.$queryRawUnsafe<Array<{
      employee_id: string; expires_at: Date;
    }>>(
      `SELECT oi.employee_id, oi.expires_at
       FROM onboarding_invites oi
       WHERE oi.token = $1 LIMIT 1`,
      token
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound('Invalid or expired registration link', 'INVALID_TOKEN');
    if (new Date(row.expires_at) < new Date()) {
      throw ApiError.unprocessable('This registration link has expired.', 'TOKEN_EXPIRED');
    }
    await prisma.$executeRawUnsafe(
      `UPDATE onboarding_invites SET used_at = NOW() WHERE employee_id = $1::uuid AND used_at IS NULL`,
      row.employee_id
    );
    return { success: true, message: 'Onboarding submission complete' };
  }

  async getDocumentsByToken(token: string) {
    const rows = await prisma.$queryRawUnsafe<Array<{
      employee_id: string; expires_at: Date;
    }>>(
      `SELECT oi.employee_id, oi.expires_at
       FROM onboarding_invites oi
       WHERE oi.token = $1 LIMIT 1`,
      token
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound('Invalid or expired registration link', 'INVALID_TOKEN');
    if (new Date(row.expires_at) < new Date()) {
      throw ApiError.unprocessable('This registration link has expired.', 'TOKEN_EXPIRED');
    }
    const docs = await prisma.$queryRawUnsafe<Array<{
      id: string; documentType: string; documentName: string; fileUrl: string; uploadedAt: Date;
    }>>(
      `SELECT id, document_type as "documentType", document_name as "documentName",
              file_url as "fileUrl", uploaded_at as "uploadedAt"
       FROM employee_documents
       WHERE employee_id = $1::uuid
       ORDER BY uploaded_at ASC`,
      row.employee_id
    );
    return docs.map(d => ({ ...d, fileUrl: storageService.normalizePublicUrl(d.fileUrl) ?? d.fileUrl }));
  }

  async uploadEmployeeDocumentByToken(token: string, file: Express.Multer.File, documentType: string) {
    // Use a relaxed validation that allows already-used tokens.
    // The token is marked used after personal data submission, but document
    // upload is a subsequent step in the same onboarding flow.
    const rows = await prisma.$queryRawUnsafe<Array<{
      employee_id: string; expires_at: Date;
    }>>(
      `SELECT oi.employee_id, oi.expires_at
       FROM onboarding_invites oi
       WHERE oi.token = $1 LIMIT 1`,
      token
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound('Invalid or expired registration link', 'INVALID_TOKEN');
    if (new Date(row.expires_at) < new Date()) {
      throw ApiError.unprocessable('This registration link has expired. Please contact HR for a new link.', 'TOKEN_EXPIRED');
    }
    const result = await this.saveEmployeeDocument(row.employee_id, file, documentType, null);

    // Notify HR/Admin about the uploaded document (non-blocking)
    (async () => {
      try {
        const recipients = await this.getHrmsAdminRecipients();
        if (recipients.length > 0) {
          const nameRows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
            `SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) as name FROM employees WHERE id = $1::uuid LIMIT 1`,
            row.employee_id
          );
          const employeeName = nameRows[0]?.name?.trim() || 'Employee';
          await this.notifyHrms('hrms_document_uploaded', row.employee_id, recipients, {
            employeeName,
            documentType,
            fileName: file.originalname,
          });
        }
      } catch { /* notification failure should not block primary workflow */ }
    })();

    return result;
  }

  async saveEmployeeDocument(
    employeeId: string,
    file: Express.Multer.File,
    documentType: string,
    uploadedBy: string | null
  ) {
    // Resolve employee code to UUID if needed
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    let resolvedId = employeeId;
    if (!isUuid) {
      const idRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM employees WHERE LOWER(employee_id) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
        employeeId
      );
      if (!idRows[0]) throw ApiError.notFound('Employee not found', 'EMPLOYEE_NOT_FOUND');
      resolvedId = idRows[0].id;
    }
    const uploadResult = await storageService.uploadFile(file, resolvedId);
    // Store a relative path so the URL is domain-agnostic and works from any frontend.
    const fileUrl = `/uploads/${uploadResult.storagePath.replace(/^\/+/, '')}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO employee_documents (employee_id, document_type, document_name, file_url, uploaded_by)
       VALUES ($1::uuid, $2, $3, $4, $5::uuid)`,
      resolvedId, documentType, file.originalname, fileUrl,
      uploadedBy
    );
    return { success: true, documentType, fileUrl: storageService.normalizePublicUrl(fileUrl) ?? fileUrl, fileName: file.originalname };
  }

  async getEmployeeDocuments(employeeId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    let resolvedUuid = employeeId;
    if (!isUuid) {
      const idRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM employees WHERE LOWER(employee_id) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
        employeeId
      );
      if (!idRows[0]) throw ApiError.notFound('Employee not found', 'EMPLOYEE_NOT_FOUND');
      resolvedUuid = idRows[0].id;
    }
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string; documentType: string; documentName: string;
      fileUrl: string; uploadedAt: Date; uploadedBy: string | null;
      status: string; reviewNote: string | null; reviewedAt: Date | null;
    }>>(
      `SELECT id, document_type as "documentType", document_name as "documentName",
              file_url as "fileUrl", uploaded_at as "uploadedAt", uploaded_by as "uploadedBy",
              status, review_note as "reviewNote", reviewed_at as "reviewedAt"
       FROM employee_documents WHERE employee_id = $1::uuid ORDER BY uploaded_at DESC`,
      resolvedUuid
    );
    return rows.map(r => ({ ...r, fileUrl: storageService.normalizePublicUrl(r.fileUrl) ?? r.fileUrl }));
  }

  async reviewEmployeeDocument(documentId: string, reviewerUserId: string, status: string, reviewNote?: string) {
    const validStatuses = ['pending', 'verified', 'approved', 'rejected', 'reupload_requested'];
    if (!validStatuses.includes(status)) throw ApiError.badRequest('Invalid status');
    // reviewed_by FK references employees.id — resolve user → employee
    const empRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM employees WHERE user_id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
      reviewerUserId
    );
    const reviewerEmployeeId = empRows[0]?.id ?? null;
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      `UPDATE employee_documents
       SET status = $1, review_note = $2, reviewed_by = $3::uuid, reviewed_at = NOW()
       WHERE id = $4::uuid
       RETURNING id, status`,
      status, reviewNote ?? null, reviewerEmployeeId, documentId
    );
    if (!rows.length) throw ApiError.notFound('Document not found');
    return rows[0];
  }

  async getMyDocuments(userId: string) {
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string; documentType: string; documentName: string;
      fileUrl: string; uploadedAt: Date; uploadedBy: string | null;
      status: string; reviewNote: string | null;
    }>>(
      `SELECT ed.id, ed.document_type as "documentType", ed.document_name as "documentName",
              ed.file_url as "fileUrl", ed.uploaded_at as "uploadedAt", ed.uploaded_by as "uploadedBy",
              ed.status, ed.review_note as "reviewNote"
       FROM employee_documents ed
       JOIN employees e ON e.id = ed.employee_id
       WHERE e.user_id = $1::uuid
       ORDER BY ed.uploaded_at DESC`,
      userId
    );
    return rows.map(r => ({ ...r, fileUrl: storageService.normalizePublicUrl(r.fileUrl) ?? r.fileUrl }));
  }

  async saveMyDocument(
    userId: string,
    file: Express.Multer.File,
    documentType: string
  ) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM employees WHERE user_id = $1::uuid AND status != 'exited' LIMIT 1`,
      userId
    );
    if (!rows.length) throw new Error('No active employee record found for this user');
    const employeeId = rows[0].id;
    return this.saveEmployeeDocument(employeeId, file, documentType, userId);
  }

  // ── Task Templates ───────────────────────────────────────────────────────────

  private static readonly DEFAULT_ONBOARDING_TEMPLATES = [
    { taskName: 'Review submitted personal details and documents', phase: 'pre_boarding', assignee: 'HR', taskOrder: 1, requiresDocument: true },
    { taskName: 'Release offer letter to employee email', phase: 'pre_boarding', assignee: 'HR', taskOrder: 2, requiresDocument: false },
    { taskName: 'Create employee account, email ID and system access', phase: 'pre_boarding', assignee: 'IT Admin', taskOrder: 3, requiresDocument: false },
    { taskName: 'Welcome meeting, office tour and team introductions', phase: 'day_1', assignee: 'HR', taskOrder: 4, requiresDocument: false },
    { taskName: 'IT setup – laptop, VPN, software and tool access', phase: 'day_1', assignee: 'IT Admin', taskOrder: 5, requiresDocument: false },
    { taskName: '30-day check-in and probation review with manager', phase: 'month_1', assignee: 'HR', taskOrder: 6, requiresDocument: false },
  ];

  private static readonly DEFAULT_OFFBOARDING_TEMPLATES = [
    { taskName: 'Exit interview completed', phase: 'pre_exit', assignee: 'HR', taskOrder: 1 },
    { taskName: 'Knowledge transfer document submitted', phase: 'pre_exit', assignee: 'Manager', taskOrder: 2 },
    { taskName: 'Pending work handover completed', phase: 'pre_exit', assignee: 'Manager', taskOrder: 3 },
    { taskName: 'System and application access revoked (email, VPN, internal tools)', phase: 'last_day', assignee: 'IT Admin', taskOrder: 4 },
    { taskName: 'Company assets returned (laptop, access card, equipment)', phase: 'last_day', assignee: 'Admin', taskOrder: 5 },
    { taskName: 'Final settlement form submitted and verified', phase: 'last_day', assignee: 'HR', taskOrder: 6 },
    { taskName: 'PF / gratuity / full-and-final processing initiated', phase: 'post_exit', assignee: 'HR', taskOrder: 7 },
    { taskName: 'Relieving letter and experience certificate issued', phase: 'post_exit', assignee: 'HR', taskOrder: 8 },
    { taskName: 'Remove from company directory and internal systems', phase: 'post_exit', assignee: 'IT Admin', taskOrder: 9 },
  ];

  async seedDefaultTaskTemplates() {
    // Always replace onboarding templates so template changes take effect immediately.
    await prisma.$executeRawUnsafe(`DELETE FROM onboarding_task_templates`);
    for (const t of HrService.DEFAULT_ONBOARDING_TEMPLATES) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO onboarding_task_templates
           (task_name, phase, assignee, task_order, requires_document, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        t.taskName, t.phase, t.assignee, t.taskOrder, t.requiresDocument
      );
    }

    // Offboarding templates: only seed if empty (they haven't changed).
    const offboardingCount = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT COUNT(*)::text as count FROM offboarding_task_templates`
    );
    if (parseInt(offboardingCount[0]?.count || '0', 10) === 0) {
      for (const t of HrService.DEFAULT_OFFBOARDING_TEMPLATES) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO offboarding_task_templates
             (task_name, phase, assignee, task_order, is_active)
           VALUES ($1, $2, $3, $4, true)`,
          t.taskName, t.phase, t.assignee, t.taskOrder
        );
      }
    }
    return { success: true, message: 'Default task templates updated (6 onboarding tasks)' };
  }

  /**
   * Replace the onboarding tasks for an existing in-progress onboarding
   * with the current active templates. Safe to call multiple times.
   */
  async resetOnboardingTasks(employeeId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    const whereClause = isUuid
      ? `employee_id = $1::uuid`
      : `employee_id = (SELECT id FROM employees WHERE LOWER(employee_id) = LOWER($1) AND deleted_at IS NULL LIMIT 1)`;
    const onboardingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM onboarding WHERE ${whereClause} AND status = 'in_progress' LIMIT 1`,
      employeeId
    );
    const onboarding = onboardingRows[0];
    if (!onboarding) throw ApiError.notFound('No active onboarding found for this employee', 'ONBOARDING_NOT_FOUND');

    const templates = await prisma.$queryRawUnsafe<Array<{
      task_name: string; phase: string | null; assignee: string | null; task_order: number;
    }>>(
      `SELECT task_name, phase, assignee, task_order
       FROM onboarding_task_templates WHERE is_active = true ORDER BY task_order ASC`
    );
    if (templates.length === 0) throw ApiError.unprocessable('No active task templates found. Run seed first.', 'NO_TEMPLATES');

    // Delete old tasks and re-insert from current templates
    await prisma.$executeRawUnsafe(
      `DELETE FROM onboarding_tasks WHERE onboarding_id = $1::uuid`,
      onboarding.id
    );
    for (const t of templates) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO onboarding_tasks (onboarding_id, task_name, phase, assignee, task_order, completed)
         VALUES ($1::uuid, $2, $3, $4, $5, false)`,
        onboarding.id, t.task_name, t.phase, t.assignee, t.task_order
      );
    }
    await prisma.$executeRawUnsafe(
      `UPDATE onboarding SET progress = $2, updated_at = NOW() WHERE id = $1::uuid`,
      onboarding.id, `0/${templates.length}`
    );
    return { success: true, message: `Onboarding tasks reset to ${templates.length} tasks` };
  }

  async listOnboardingTaskTemplates() {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT id, task_name as "taskName", description, phase, assignee,
              task_order as "taskOrder", is_active as "isActive",
              requires_document as "requiresDocument", notes, created_at as "createdAt", updated_at as "updatedAt"
       FROM onboarding_task_templates
       ORDER BY task_order ASC`
    );
  }

  async createOnboardingTaskTemplate(data: {
    taskName: string; description?: string; phase: string; assignee?: string;
    taskOrder: number; requiresDocument?: boolean; notes?: string;
  }) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO onboarding_task_templates
         (task_name, description, phase, assignee, task_order, requires_document, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id`,
      data.taskName, data.description || null, data.phase, data.assignee || null,
      data.taskOrder, data.requiresDocument ?? false, data.notes || null
    );
    return { id: rows[0].id, ...data };
  }

  async updateOnboardingTaskTemplate(id: string, data: {
    taskName?: string; description?: string; phase?: string; assignee?: string;
    taskOrder?: number; requiresDocument?: boolean; notes?: string; isActive?: boolean;
  }) {
    await prisma.$executeRawUnsafe(
      `UPDATE onboarding_task_templates
       SET task_name = COALESCE($2, task_name),
           description = COALESCE($3, description),
           phase = COALESCE($4, phase),
           assignee = COALESCE($5, assignee),
           task_order = COALESCE($6, task_order),
           requires_document = COALESCE($7, requires_document),
           notes = COALESCE($8, notes),
           is_active = COALESCE($9, is_active),
           updated_at = NOW()
       WHERE id = $1::uuid`,
      id, data.taskName ?? null, data.description ?? null, data.phase ?? null,
      data.assignee ?? null, data.taskOrder ?? null, data.requiresDocument ?? null,
      data.notes ?? null, data.isActive ?? null
    );
    return { success: true };
  }

  async deleteOnboardingTaskTemplate(id: string) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM onboarding_task_templates WHERE id = $1::uuid`, id
    );
    return { success: true };
  }

  async listOffboardingTaskTemplates() {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT id, task_name as "taskName", description, phase, assignee,
              task_order as "taskOrder", is_active as "isActive",
              notes, created_at as "createdAt", updated_at as "updatedAt"
       FROM offboarding_task_templates
       ORDER BY task_order ASC`
    );
  }

  async createOffboardingTaskTemplate(data: {
    taskName: string; description?: string; phase: string; assignee?: string;
    taskOrder: number; notes?: string;
  }) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO offboarding_task_templates
         (task_name, description, phase, assignee, task_order, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id`,
      data.taskName, data.description || null, data.phase, data.assignee || null,
      data.taskOrder, data.notes || null
    );
    return { id: rows[0].id, ...data };
  }

  async updateOffboardingTaskTemplate(id: string, data: {
    taskName?: string; description?: string; phase?: string; assignee?: string;
    taskOrder?: number; notes?: string; isActive?: boolean;
  }) {
    await prisma.$executeRawUnsafe(
      `UPDATE offboarding_task_templates
       SET task_name = COALESCE($2, task_name),
           description = COALESCE($3, description),
           phase = COALESCE($4, phase),
           assignee = COALESCE($5, assignee),
           task_order = COALESCE($6, task_order),
           notes = COALESCE($7, notes),
           is_active = COALESCE($8, is_active),
           updated_at = NOW()
       WHERE id = $1::uuid`,
      id, data.taskName ?? null, data.description ?? null, data.phase ?? null,
      data.assignee ?? null, data.taskOrder ?? null, data.notes ?? null, data.isActive ?? null
    );
    return { success: true };
  }

  async deleteOffboardingTaskTemplate(id: string) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM offboarding_task_templates WHERE id = $1::uuid`, id
    );
    return { success: true };
  }

  async getEmployeePayrollHistory(employeeId: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        p.id,
        p.month,
        p.year,
        p.gross::float       AS gross,
        p.deductions::float  AS deductions,
        p.net::float         AS net,
        p.status::text       AS status,
        p.payslip_url        AS "payslipUrl",
        TO_CHAR(p.generated_at, 'DD-Mon-YYYY') AS "generatedAt",
        TO_CHAR(p.finalized_at, 'DD-Mon-YYYY') AS "finalizedAt"
      FROM payroll p
      JOIN employees e ON e.id = p.employee_id
      WHERE e.id = $1::uuid
      ORDER BY p.year DESC, p.month DESC
      LIMIT 24
      `,
      employeeId
    );
    return rows;
  }
}

export const hrService = new HrService();

