import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { notificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.types';
import { randomUUID } from 'crypto';
import { normalizeMediaUrl } from '../../utils/media-url';

type EmployeeStatus = 'onboarding' | 'active' | 'notice_period' | 'exited' | 'deleted';
type LeaveTypeName = 'casual' | 'sick' | 'earned' | 'lop' | 'comp_off';
type _AccruedLeaveType = 'casual' | 'sick' | 'earned';

export type LeaveSessionType = 'full_day' | 'first_half' | 'second_half';

export interface LeaveApplyInput {
  leaveType: LeaveTypeName;
  fromDate: string;
  toDate: string;
  session?: LeaveSessionType;
  reason?: string;
}

export interface AttendanceRegularizationInput {
  attendanceDate: string;
  requestedCheckInTime?: string;
  requestedCheckOutTime?: string;
  reason: string;
}

interface AttendanceRegularizationRequestFilters {
  status?: string;
  branchId?: string;
  page?: number;
  limit?: number;
}

interface AttendanceRegularizationDecisionPayload {
  note?: string;
  reason?: string;
}

interface AttendanceRegularizationPayload {
  attendanceDate: string | null;
  requestedCheckInTime: string | null;
  requestedCheckOutTime: string | null;
  reason: string | null;
}

type RegularizationApproverType = 'manager' | 'hr';

interface LeaveTypeConfig {
  id: string;
  name: string;
  code: string;
  accrualType: string;
  accrualValue: number;
  maxBalance: number;
  applicableTo: string;
  active: boolean;
  carryForward: boolean;
  encashment: boolean;
  color?: string;
}

interface LeaveTypeConfig {
  id: string;
  name: string;
  code: string;
  accrualType: string;
  accrualValue: number;
  maxBalance: number;
  applicableTo: string;
  active: boolean;
  carryForward: boolean;
  encashment: boolean;
  color?: string;
}

interface LeaveAccrualConfig {
  casualPerMonth: number;
  sickPerMonth: number;
  earnedPerMonth: number;
  maxPaidLeavesPerMonth?: number;
  leaveTypes?: LeaveTypeConfig[];
}

interface CurrentEmployee {
  id: string;
  employeeCode: string;
  status: EmployeeStatus;
  managerId: string | null;
  branchId: string | null;
  roleName: string | null;
  workLocation: string | null;
}

interface AttendanceCards {
  totalDays: number;
  daysPresent: number;
  incomplete: number;
  attendanceRate: number;
}

const COMPANY_TIMEZONE_OFFSET_MINUTES = parseInt(
  process.env.COMPANY_TIMEZONE_OFFSET_MINUTES || '330',
  10
);

// Office start time for late marking (HH:mm in company timezone, e.g. "09:30")
const OFFICE_START_TIME = process.env.OFFICE_START_TIME || '09:30';
const [OFFICE_START_HOUR, OFFICE_START_MINUTE] = OFFICE_START_TIME.split(':').map(Number);

// Work-hours thresholds (must match attendanceAutoAbsentScheduler.ts)
const FULL_DAY_HOURS = Number(process.env.FULL_DAY_HOURS ?? 9);
const HALF_DAY_HOURS = Number(process.env.HALF_DAY_HOURS ?? 4);

function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(row => headers.map(h => esc(row[h])).join(','))].join('\n');
}

function pad2(v: number): string {
  return String(v).padStart(2, '0');
}

function pad3(v: number): string {
  return String(v).padStart(3, '0');
}

function toCompanyDateTime(input: Date): Date {
  return new Date(input.getTime() + COMPANY_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
}

export function toDateOnly(input: Date): string {
  const shifted = toCompanyDateTime(input);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

function _toCompanyOffsetIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return null;

  const shifted = toCompanyDateTime(d);
  const sign = COMPANY_TIMEZONE_OFFSET_MINUTES >= 0 ? '+' : '-';
  const offsetAbs = Math.abs(COMPANY_TIMEZONE_OFFSET_MINUTES);
  const offsetHours = Math.floor(offsetAbs / 60);
  const offsetMinutes = offsetAbs % 60;

  return (
    `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}` +
    `T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}.` +
    `${pad3(shifted.getUTCMilliseconds())}${sign}${pad2(offsetHours)}:${pad2(offsetMinutes)}`
  );
}

function toCompanyDisplayTime(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(d);
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

/**
 * PrismaPg adapter returns `timestamp without time zone` columns with `+00:00`
 * appended, treating the stored value as UTC. But PostgreSQL stores these in the
 * session timezone (Asia/Kolkata), so the value is actually IST.
 * This helper corrects for that by subtracting the company timezone offset.
 */
function fixTimestampWithoutTz(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - COMPANY_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
}

export function normalizeAttendanceTimestamps<T extends Record<string, any>>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const out: any = { ...row };

  if (out.checkInTime) {
    const checkInDate = fixTimestampWithoutTz(out.checkInTime);
    if (checkInDate) {
      out.checkInTime = checkInDate.toISOString();
      out.checkInTimeUtc = out.checkInTime;
      out.checkInTimeDisplay = toCompanyDisplayTime(checkInDate);

      // Late marking: compare check-in (company tz) against office start time
      const companyCheckIn = toCompanyDateTime(checkInDate);
      const h = companyCheckIn.getUTCHours();
      const m = companyCheckIn.getUTCMinutes();
      out.isLate = (h > OFFICE_START_HOUR) ||
                   (h === OFFICE_START_HOUR && m > OFFICE_START_MINUTE);
    }
  }

  if (out.checkOutTime) {
    const checkOutDate = fixTimestampWithoutTz(out.checkOutTime);
    if (checkOutDate) {
      out.checkOutTime = checkOutDate.toISOString();
      out.checkOutTimeUtc = out.checkOutTime;
      out.checkOutTimeDisplay = toCompanyDisplayTime(checkOutDate);
    }
  }

  if (out.isLate === undefined) {
    out.isLate = false;
  }

  if (out.isLate === undefined) {
    out.isLate = false;
  }

  return out as T;
}

/** Max allowed drift between client time and server time (5 minutes) */
const MAX_CLIENT_DRIFT_MS = 5 * 60 * 1000;

/**
 * Parse and validate client-provided ISO timestamp.
 * Returns a valid Date if within acceptable drift from server time, otherwise falls back to server NOW.
 */
function resolveClientTime(clientTime?: string): Date {
  if (!clientTime) return new Date();
  const parsed = new Date(clientTime);
  if (Number.isNaN(parsed.getTime())) return new Date();
  const drift = Math.abs(Date.now() - parsed.getTime());
  if (drift > MAX_CLIENT_DRIFT_MS) return new Date();
  return parsed;
}

function isWeekend(d: Date): boolean {
  const day = toCompanyDateTime(d).getUTCDay();
  return day === 0 || day === 6;
}

function buildAttendanceCards(rows: Array<{ status?: string | null; date?: any }>): AttendanceCards {
  // Only count weekday (Mon-Fri) rows in attendance statistics
  const weekdayRows = rows.filter(row => {
    if (!row.date) return true; // include if no date info
    const d = row.date instanceof Date ? row.date : new Date(row.date);
    if (isNaN(d.getTime())) return true;
    const day = toCompanyDateTime(d).getUTCDay();
    return day !== 0 && day !== 6; // exclude Sunday (0) and Saturday (6)
  });
  const totalDays = weekdayRows.length;
  const daysPresent = weekdayRows.filter(row => row.status === 'present' || row.status === 'half_day').length;
  const incomplete = weekdayRows.filter(
    row => row.status === 'incomplete' || row.status === 'checked_in'
  ).length;
  const attendanceRate = totalDays === 0 ? 0 : Math.round((daysPresent / totalDays) * 10000) / 100;

  return {
    totalDays,
    daysPresent,
    incomplete,
    attendanceRate,
  };
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const LEAVE_ACCRUAL_CONFIG_KEY = 'leave.monthly_accrual';
const DEFAULT_LEAVE_ACCRUAL_CONFIG: LeaveAccrualConfig = {
  casualPerMonth: 1,
  sickPerMonth: 1,
  earnedPerMonth: 1.25,
};

export class WorkforceService {
  private async getActorDisplayName(userId: string): Promise<string> {
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!actor) return 'System';
    const fullName = `${actor.firstName || ''} ${actor.lastName || ''}`.trim();
    return fullName || actor.email;
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
    return rows.map((r) => r.id);
  }

  private async getHrRecipients(): Promise<string[]> {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      SELECT u.id
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'hr'
        AND u.is_active = true
        AND u.deleted_at IS NULL
    `
    );
    return rows.map((r) => r.id);
  }

  private async getLeaveAudienceByEmployeeId(employeeId: string): Promise<{
    employeeUserId: string | null;
    managerUserId: string | null;
    employeeName: string;
  }> {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        employee_user_id: string | null;
        manager_user_id: string | null;
        employee_name: string;
      }>
    >(
      `
      SELECT
        e.user_id as employee_user_id,
        mu.id as manager_user_id,
        CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as employee_name
      FROM employees e
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN users mu ON mu.id = m.user_id
      WHERE e.id = $1::uuid
      LIMIT 1
    `,
      employeeId
    );
    return {
      employeeUserId: rows[0]?.employee_user_id || null,
      managerUserId: rows[0]?.manager_user_id || null,
      employeeName: rows[0]?.employee_name?.trim() || 'Employee',
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
      // Notification delivery should not block primary workflow.
    }
  }

  private async findCurrentEmployeeByUserId(userId: string): Promise<CurrentEmployee | null> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT e.id,
             e.employee_id as "employeeCode",
             e.status::text as status,
             e.manager_id as "managerId",
             e.branch_id as "branchId",
             r.name as "roleName",
             e.work_location as "workLocation"
      FROM employees e
      JOIN users u ON u.id = e.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1::uuid AND e.deleted_at IS NULL
      LIMIT 1
    `,
      userId
    );
    return (rows[0] as CurrentEmployee | undefined) || null;
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

  private async provisionOnboardingRecord(employeeId: string, joiningDate: string): Promise<void> {
    const FALLBACK_TASKS = [
      'Personal Documents Collected',
      'Laptop/Equipment Assigned',
      'Email Account Created',
      'System Access Granted',
      'Team Introduction Completed',
      'Office Orientation Done',
    ];

    const dbTemplates = await prisma.$queryRawUnsafe<Array<{
      task_name: string; phase: string | null; assignee: string | null; task_order: number;
    }>>(
      `SELECT task_name, phase, assignee, task_order FROM onboarding_task_templates WHERE is_active = true ORDER BY task_order ASC`
    );
    const tasks = dbTemplates.length > 0
      ? dbTemplates
      : FALLBACK_TASKS.map((name, i) => ({ task_name: name, phase: null, assignee: null, task_order: i + 1 }));

    const onboardingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO onboarding (employee_id, target_completion_date, progress)
       VALUES ($1::uuid, $2::date, $3)
       ON CONFLICT (employee_id) DO NOTHING
       RETURNING id`,
      employeeId,
      joiningDate,
      `0/${tasks.length}`
    );
    const onboardingId = onboardingRows[0]?.id;
    if (!onboardingId) return;

    for (const task of tasks) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO onboarding_tasks (onboarding_id, task_name, phase, assignee, task_order, completed)
         VALUES ($1::uuid, $2, $3, $4, $5, false)`,
        onboardingId, task.task_name, task.phase ?? null, task.assignee ?? null, task.task_order
      );
    }
  }

  private async provisionAdminEmployeeProfileIfMissing(userId: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        role: { select: { name: true } },
      },
    });

    if (!user || user.role?.name !== 'admin') {
      return;
    }

    // Check if employee row already exists
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      `SELECT id, status::text FROM employees WHERE user_id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
      user.id
    );
    if (existing[0]) return; // already provisioned

    const employeeCode = await this.generateNextEmployeeId();
    const joiningDate = toDateOnly(new Date());

    const empRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO employees
        (user_id, employee_id, first_name, last_name, email, joining_date, designation, department, status, created_by, updated_by)
      VALUES
        ($1::uuid, $2, $3, $4, $5, $6::date, $7, $8, 'active'::employee_status, $1::uuid, $1::uuid)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING id
    `,
      user.id,
      employeeCode,
      user.firstName,
      user.lastName || null,
      user.email,
      joiningDate,
      'Administrator',
      'Administration'
    );

    const employeeId = empRows[0]?.id;
    if (!employeeId) return;
  }

  private async provisionHrEmployeeProfileIfMissing(userId: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        role: { select: { name: true } },
      },
    });

    if (!user || user.role?.name !== 'hr') {
      return;
    }

    // Check if employee row already exists
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      `SELECT id, status::text FROM employees WHERE user_id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
      user.id
    );
    if (existing[0]) return; // already provisioned

    const employeeCode = await this.generateNextEmployeeId();
    const joiningDate = toDateOnly(new Date());

    const empRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO employees
        (user_id, employee_id, first_name, last_name, email, joining_date, designation, department, status, created_by, updated_by)
      VALUES
        ($1::uuid, $2, $3, $4, $5, $6::date, $7, $8, 'onboarding'::employee_status, $1::uuid, $1::uuid)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING id
    `,
      user.id,
      employeeCode,
      user.firstName,
      user.lastName || null,
      user.email,
      joiningDate,
      'HR',
      'Human Resources'
    );

    const employeeId = empRows[0]?.id;
    if (!employeeId) return;

    // Deactivate user account until onboarding completes
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    // Create onboarding record + tasks
    await this.provisionOnboardingRecord(employeeId, joiningDate);
  }

  private async provisionManagerEmployeeProfileIfMissing(userId: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        role: { select: { name: true } },
      },
    });

    if (!user || user.role?.name !== 'manager') {
      return;
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account is inactive. Please contact support.', 'ACCOUNT_INACTIVE');
    }

    const employeeCode = await this.generateNextEmployeeId();
    const joiningDate = toDateOnly(new Date());

    // Auto-assign single branch if only one branch exists
    let branchId: string | null = null;
    try {
      const branchesRow = await prisma.$queryRawUnsafe<Array<{ setting_value: unknown }>>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'org.branches' LIMIT 1`
      );
      const branchList = branchesRow[0]?.setting_value as Array<{ id: string }> | null;
      if (Array.isArray(branchList) && branchList.length === 1) {
        branchId = branchList[0].id;
      }
    } catch {
      // non-fatal
    }

    // Check if employee row already exists
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
      `SELECT id, status::text FROM employees WHERE user_id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
      user.id
    );
    if (existing[0]) {
      // Backfill branch_id if still NULL
      if (branchId) {
        await prisma.$executeRawUnsafe(
          `UPDATE employees SET branch_id = $1, updated_at = NOW() WHERE user_id = $2::uuid AND branch_id IS NULL AND deleted_at IS NULL`,
          branchId,
          user.id
        );
      }
      return;
    }

    const empRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO employees
        (user_id, employee_id, first_name, last_name, email, joining_date, designation, department, status, branch_id, created_by, updated_by)
      VALUES
        ($1::uuid, $2, $3, $4, $5, $6::date, $7, $8, 'onboarding'::employee_status, $9, $1::uuid, $1::uuid)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING id
    `,
      user.id,
      employeeCode,
      user.firstName,
      user.lastName || null,
      user.email,
      joiningDate,
      'Manager',
      'Management',
      branchId
    );

    const employeeId = empRows[0]?.id;
    if (!employeeId) return;

    // Deactivate user account until onboarding completes
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    // Create onboarding record + tasks
    await this.provisionOnboardingRecord(employeeId, joiningDate);
  }

  private async getCurrentEmployeeByUserId(userId: string): Promise<CurrentEmployee> {
    let employee = await this.findCurrentEmployeeByUserId(userId);
    if (!employee) {
      await this.provisionAdminEmployeeProfileIfMissing(userId);
      await this.provisionHrEmployeeProfileIfMissing(userId);
      await this.provisionManagerEmployeeProfileIfMissing(userId);
      employee = await this.findCurrentEmployeeByUserId(userId);
    }
    if (!employee) {
      throw ApiError.notFound('Employee profile not found for user', 'EMPLOYEE_PROFILE_NOT_FOUND');
    }
    return employee;
  }

  private async getEmployeeById(employeeId: string): Promise<{
    id: string;
    employeeCode: string;
    joiningDate: Date;
    userId: string | null;
    firstName: string;
    lastName: string | null;
    gender: string | null;
  }> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        e.id,
        e.employee_id as "employeeCode",
        e.joining_date as "joiningDate",
        e.user_id as "userId",
        e.first_name as "firstName",
        e.last_name as "lastName",
        e.gender as "gender"
      FROM employees e
      WHERE e.id = $1::uuid AND e.deleted_at IS NULL
      LIMIT 1
    `,
      employeeId
    );
    if (!rows[0]) {
      throw ApiError.notFound('Employee not found', 'EMPLOYEE_NOT_FOUND');
    }
    return rows[0];
  }

  private normalizeLeaveAccrualConfig(input: Partial<LeaveAccrualConfig>): LeaveAccrualConfig {
    const result: LeaveAccrualConfig = {
      casualPerMonth: Math.max(0, Number(input.casualPerMonth ?? DEFAULT_LEAVE_ACCRUAL_CONFIG.casualPerMonth)),
      sickPerMonth: Math.max(0, Number(input.sickPerMonth ?? DEFAULT_LEAVE_ACCRUAL_CONFIG.sickPerMonth)),
      earnedPerMonth: Math.max(0, Number(input.earnedPerMonth ?? DEFAULT_LEAVE_ACCRUAL_CONFIG.earnedPerMonth)),
    };
    if (input.maxPaidLeavesPerMonth != null) {
      result.maxPaidLeavesPerMonth = Math.max(0, Number(input.maxPaidLeavesPerMonth));
    }
    if (Array.isArray(input.leaveTypes)) {
      result.leaveTypes = input.leaveTypes;
    }
    return result;
  }

  /** Parse raw setting_value JSON — supports legacy flat format and new {default, branches} format */
  private parseLeaveAccrualSettingValue(raw: unknown): { default: LeaveAccrualConfig; branches: Record<string, LeaveAccrualConfig> } {
    let parsed: any = raw;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
    }
    if (!parsed || typeof parsed !== 'object') {
      return { default: { ...DEFAULT_LEAVE_ACCRUAL_CONFIG }, branches: {} };
    }
    // Legacy flat format: { casualPerMonth, sickPerMonth, earnedPerMonth }
    if ('casualPerMonth' in parsed || 'sickPerMonth' in parsed || 'earnedPerMonth' in parsed) {
      return { default: this.normalizeLeaveAccrualConfig(parsed), branches: {} };
    }
    // New format: { default: {...}, branches: { branchId: {...} } }
    const defaultConfig = this.normalizeLeaveAccrualConfig(parsed.default || {});
    const branches: Record<string, LeaveAccrualConfig> = {};
    if (parsed.branches && typeof parsed.branches === 'object') {
      for (const [bid, cfg] of Object.entries(parsed.branches)) {
        branches[bid] = this.normalizeLeaveAccrualConfig(cfg as Partial<LeaveAccrualConfig>);
      }
    }
    return { default: defaultConfig, branches };
  }

  async getLeaveAccrualConfig(branchId?: string | null): Promise<LeaveAccrualConfig & { updatedAt?: string; branchId?: string | null }> {
    const rows = await prisma.$queryRawUnsafe<Array<{ setting_value: unknown; updated_at: Date | null }>>(
      `SELECT setting_value, updated_at FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      LEAVE_ACCRUAL_CONFIG_KEY
    );
    const setting = rows[0];
    if (!setting) {
      return { ...DEFAULT_LEAVE_ACCRUAL_CONFIG, branchId: branchId || null };
    }
    const { default: defaultConfig, branches } = this.parseLeaveAccrualSettingValue(setting.setting_value);
    const config = (branchId && branches[branchId]) ? branches[branchId] : defaultConfig;
    return {
      ...config,
      branchId: branchId || null,
      ...(setting.updated_at ? { updatedAt: setting.updated_at.toISOString() } : {}),
    };
  }

  async updateLeaveAccrualConfig(
    payload: LeaveAccrualConfig,
    updatedByUserId: string,
    branchId?: string | null
  ): Promise<LeaveAccrualConfig & { updatedAt: string; branchId?: string | null }> {
    const newConfig = this.normalizeLeaveAccrualConfig(payload);

    // Read current stored value to merge
    const existing = await prisma.$queryRawUnsafe<Array<{ setting_value: unknown }>>(
      `SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      LEAVE_ACCRUAL_CONFIG_KEY
    );
    const current = this.parseLeaveAccrualSettingValue(existing[0]?.setting_value ?? null);

    let storedValue: { default: LeaveAccrualConfig; branches: Record<string, LeaveAccrualConfig> };
    if (branchId) {
      // Update only this branch's config
      storedValue = { default: current.default, branches: { ...current.branches, [branchId]: newConfig } };
    } else {
      // Update global default (admin)
      storedValue = { default: newConfig, branches: current.branches };
    }

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
      VALUES ($1, $2::jsonb, $3, $4::uuid)
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `,
      LEAVE_ACCRUAL_CONFIG_KEY,
      JSON.stringify(storedValue),
      'Per-branch monthly leave accrual configuration',
      updatedByUserId
    );

    const rows = await prisma.$queryRawUnsafe<Array<{ updated_at: Date }>>(
      `SELECT updated_at FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      LEAVE_ACCRUAL_CONFIG_KEY
    );
    return {
      ...newConfig,
      branchId: branchId || null,
      updatedAt: rows[0]?.updated_at?.toISOString() || new Date().toISOString(),
    };
  }

  private computeCredited(lt: LeaveTypeConfig, accrualMonths: number, joiningDate: Date, year: number): number {
    if (lt.accrualType === 'monthly') {
      return Math.round(lt.accrualValue * accrualMonths * 100) / 100;
    }
    if (lt.accrualType === 'fixed') {
      const joinYear = joiningDate.getUTCFullYear();
      // If the year is before joining, no credit
      if (year < joinYear) return 0;
      // Maternity and paternity are entitlements — full amount regardless of joining date
      const isMatPaternity = lt.id === 'maternity' || lt.id === 'paternity' || lt.code === 'ML' || lt.code === 'PL';
      if (isMatPaternity) {
        return Math.round(lt.accrualValue * 100) / 100;
      }
      // Joining year: prorate based on remaining months from join month
      if (year === joinYear) {
        const remainingMonths = 12 - joiningDate.getUTCMonth();
        return Math.round((lt.accrualValue * remainingMonths) / 12 * 100) / 100;
      }
      // Full year credit for subsequent years
      return Math.round(lt.accrualValue * 100) / 100;
    }
    // accrualType === 'none' or unknown
    return 0;
  }

  private getAccrualMonthsForYear(joiningDate: Date, year: number): number {
    const joinYear = joiningDate.getUTCFullYear();
    const joinMonth = joiningDate.getUTCMonth();
    const now = new Date();
    const nowYear = now.getUTCFullYear();

    if (year > nowYear || year < joinYear) return 0;

    // Leave year runs Jan–Dec: full year credit allocated upfront
    const startMonth = year === joinYear ? joinMonth : 0;
    const endMonth = 11; // Always December — full calendar year
    if (endMonth < startMonth) return 0;
    return endMonth - startMonth + 1;
  }

  private async calculateLeaveDays(fromDate: string, toDate: string): Promise<number> {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    let days = 0;
    const d = new Date(from);

    while (d <= to) {
      if (!isWeekend(d)) {
        const holiday = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM holidays WHERE date = $1::date LIMIT 1`,
          toDateOnly(d)
        );
        if (!holiday[0]) {
          days += 1;
        }
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return days;
  }

  async getEmployeeLeaveSummaryByEmployeeId(employeeId: string, year?: number) {
    const y = year || new Date().getUTCFullYear();
    const employee = await this.getEmployeeById(employeeId);
    // Resolve the employee's branch_id for per-branch accrual config
    const branchRows = await prisma.$queryRawUnsafe<Array<{ branch_id: string | null }>>(
      `SELECT branch_id FROM employees WHERE id = $1::uuid LIMIT 1`, employeeId
    );
    const employeeBranchId = branchRows[0]?.branch_id ?? null;
    const config = await this.getLeaveAccrualConfig(employeeBranchId);

    const joiningDate = new Date(employee.joiningDate);
    const joinYear = joiningDate.getUTCFullYear();
    const joinMonth = joiningDate.getUTCMonth();
    const now = new Date();
    const nowYear = now.getUTCFullYear();
    const nowMonth = now.getUTCMonth();
    const accrualMonths = this.getAccrualMonthsForYear(joiningDate, y);

    // Build the effective leave type list from config.leaveTypes if present,
    // otherwise fall back to the legacy 3-type monthly config.
    const effectiveLeaveTypes: Array<LeaveTypeConfig & { _legacyMonthly?: boolean }> =
      Array.isArray(config.leaveTypes) && config.leaveTypes.length > 0
        ? [...config.leaveTypes]
        : [
            { id: 'casual', name: 'Casual Leave', code: 'CL', accrualType: 'monthly', accrualValue: config.casualPerMonth, maxBalance: Infinity as unknown as number, applicableTo: 'all', active: true, carryForward: false, encashment: false, _legacyMonthly: true },
            { id: 'sick', name: 'Sick Leave', code: 'SL', accrualType: 'monthly', accrualValue: config.sickPerMonth, maxBalance: Infinity as unknown as number, applicableTo: 'all', active: true, carryForward: false, encashment: false, _legacyMonthly: true },
            { id: 'earned', name: 'Earned Leave', code: 'EL', accrualType: 'monthly', accrualValue: config.earnedPerMonth, maxBalance: Infinity as unknown as number, applicableTo: 'all', active: true, carryForward: true, encashment: false, _legacyMonthly: true },
          ];

    // Always include lop and comp_off as manual-only types if not already in list
    const MANUAL_TYPES = ['lop', 'comp_off'];
    for (const mtId of MANUAL_TYPES) {
      if (!effectiveLeaveTypes.find(lt => lt.id === mtId)) {
        effectiveLeaveTypes.push({ id: mtId, name: mtId === 'lop' ? 'Loss of Pay' : 'Comp Off', code: mtId.toUpperCase(), accrualType: 'none', accrualValue: 0, maxBalance: Infinity as unknown as number, applicableTo: 'all', active: true, carryForward: false, encashment: false });
      }
    }

    // Filter leave types by employee gender (applicableTo: 'all' | 'male' | 'female')
    const empGender = (employee.gender || '').toLowerCase();
    const filteredLeaveTypes = effectiveLeaveTypes.filter(lt => {
      if (!lt.applicableTo || lt.applicableTo === 'all') return true;
      return lt.applicableTo === empGender;
    });
    // Replace effectiveLeaveTypes with filtered version for all downstream logic
    effectiveLeaveTypes.length = 0;
    effectiveLeaveTypes.push(...filteredLeaveTypes);

    const manualAdjustmentRows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        new_values->>'leaveType' as "leaveType",
        COALESCE((new_values->>'adjustment')::numeric, 0) as "adjustment",
        new_values->>'reason' as "reason",
        created_at as "createdAt"
      FROM audit_logs
      WHERE action = 'hr.leave_balance_adjusted'
        AND metadata->>'employeeId' = $1
        AND COALESCE((metadata->>'year')::int, $2) = $2
      ORDER BY created_at DESC
    `,
      employeeId,
      y
    );
    const manualAdjustments: Record<string, number> = {};
    for (const lt of effectiveLeaveTypes) manualAdjustments[lt.id] = 0;
    for (const row of manualAdjustmentRows) {
      const ltId = String(row.leaveType);
      if (ltId in manualAdjustments) manualAdjustments[ltId] += toNumber(row.adjustment);
      else manualAdjustments[ltId] = toNumber(row.adjustment);
    }

    const leaveRows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        id,
        leave_type::text as "leaveType",
        days,
        status::text as status,
        reason,
        from_date as "fromDate",
        to_date as "toDate",
        applied_at as "appliedAt",
        approved_at as "approvedAt",
        rejected_at as "rejectedAt",
        cancelled_at as "cancelledAt",
        is_auto_lop as "isAutoLop"
      FROM leaves
      WHERE employee_id = $1::uuid
        AND EXTRACT(YEAR FROM from_date) = $2
      ORDER BY applied_at DESC
    `,
      employeeId,
      y
    );

    const utilized: Record<string, number> = {};
    const pending: Record<string, number> = {};
    for (const lt of effectiveLeaveTypes) { utilized[lt.id] = 0; pending[lt.id] = 0; }

    // Build fallback map: legacy leave type IDs → current config IDs (e.g. 'casual' → 'custom_xxx' if config uses custom ID with code CL)
    const LEGACY_CODE_MAP: Record<string, string> = { casual: 'CL', sick: 'SL', earned: 'EL', privilege: 'PL' };
    const legacyIdToConfigId: Record<string, string> = {};
    for (const [legacyId, code] of Object.entries(LEGACY_CODE_MAP)) {
      if (!(legacyId in utilized)) {
        const match = effectiveLeaveTypes.find(lt => lt.code === code);
        if (match) legacyIdToConfigId[legacyId] = match.id;
      }
    }

    const normalizedLeaves = leaveRows.map((row) => {
      const days = Math.round(toNumber(row.days) * 100) / 100;
      let ltId = String(row.leaveType);
      // Remap legacy IDs to current config IDs
      if (!(ltId in utilized) && ltId in legacyIdToConfigId) ltId = legacyIdToConfigId[ltId];
      if (row.status === 'approved') {
        utilized[ltId] = (utilized[ltId] ?? 0) + days;
      } else if (row.status === 'pending') {
        pending[ltId] = (pending[ltId] ?? 0) + days;
      }
      return { ...row, days, leaveType: ltId };
    });

    // Compute previous-year raw available for carry-forward types (no recursion)
    const prevYearAvailable: Record<string, number> = {};
    const carryForwardTypes = effectiveLeaveTypes.filter(lt => lt.carryForward);
    if (carryForwardTypes.length > 0) {
      const prevY = y - 1;
      const prevAccrualMonths = this.getAccrualMonthsForYear(joiningDate, prevY);
      const prevManualRows = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          new_values->>'leaveType' as "leaveType",
          COALESCE((new_values->>'adjustment')::numeric, 0) as "adjustment"
        FROM audit_logs
        WHERE action = 'hr.leave_balance_adjusted'
          AND metadata->>'employeeId' = $1
          AND COALESCE((metadata->>'year')::int, $2) = $2
        `,
        employeeId,
        prevY
      );
      const prevManual: Record<string, number> = {};
      for (const lt of carryForwardTypes) prevManual[lt.id] = 0;
      for (const row of prevManualRows) {
        const ltId = String(row.leaveType);
        if (ltId in prevManual) prevManual[ltId] += toNumber(row.adjustment);
      }
      const prevLeaveRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT leave_type::text as "leaveType", days, status::text as status
         FROM leaves WHERE employee_id = $1::uuid AND EXTRACT(YEAR FROM from_date) = $2`,
        employeeId,
        prevY
      );
      const prevUtilized: Record<string, number> = {};
      for (const lt of carryForwardTypes) prevUtilized[lt.id] = 0;
      for (const row of prevLeaveRows) {
        if (row.status === 'approved') {
          let ltId = String(row.leaveType);
          if (!(ltId in prevUtilized) && ltId in legacyIdToConfigId) ltId = legacyIdToConfigId[ltId];
          if (ltId in prevUtilized) prevUtilized[ltId] += Math.round(toNumber(row.days) * 100) / 100;
        }
      }
      for (const lt of carryForwardTypes) {
        const prevCredited = this.computeCredited(lt, prevAccrualMonths, joiningDate, prevY);
        const prevMaxBal = Number.isFinite(lt.maxBalance) ? lt.maxBalance : Infinity;
        const prevCappedCredited = prevMaxBal < Infinity ? Math.min(prevCredited + prevManual[lt.id], prevMaxBal) : prevCredited + prevManual[lt.id];
        prevYearAvailable[lt.id] = Math.max(0, Math.round((prevCappedCredited - prevUtilized[lt.id]) * 100) / 100);
      }
    }

    // Log unrecognized leave types that exist in records but not in config
    const knownIds = new Set(effectiveLeaveTypes.map(lt => lt.id));
    for (const ltId of Object.keys(utilized)) {
      if (!knownIds.has(ltId) && utilized[ltId] > 0) {
        logger.warn(`Leave type "${ltId}" found in records for employee ${employeeId} but not in config — ${utilized[ltId]} days utilized will not appear in summary`);
      }
    }

    // Build cards dynamically
    const cards: Record<string, { name: string; available: number; credited: number; maxBalance: number | null; manualAdjustment: number; utilized: number; pending: number; monthlyCredit: number; carryForward?: number }> = {};
    for (const lt of effectiveLeaveTypes) {
      const rawCredited = this.computeCredited(lt, accrualMonths, joiningDate, y);
      const manAdj = manualAdjustments[lt.id] ?? 0;
      const carryAmt = lt.carryForward ? (prevYearAvailable[lt.id] ?? 0) : 0;
      const maxBal = Number.isFinite(lt.maxBalance) && lt.maxBalance > 0 ? lt.maxBalance : Infinity;
      const totalCredited = rawCredited + manAdj + carryAmt;
      const cappedCredited = maxBal < Infinity ? Math.min(totalCredited, maxBal) : totalCredited;
      const util = utilized[lt.id] ?? 0;
      cards[lt.id] = {
        name: lt.name,
        available: Math.max(0, Math.round((cappedCredited - util) * 100) / 100),
        credited: Math.round(cappedCredited * 100) / 100,
        maxBalance: Number.isFinite(maxBal) ? maxBal : null,
        manualAdjustment: Math.round(manAdj * 100) / 100,
        utilized: Math.round(util * 100) / 100,
        pending: Math.round((pending[lt.id] ?? 0) * 100) / 100,
        monthlyCredit: lt.accrualType === 'monthly' ? lt.accrualValue : 0,
        ...(lt.carryForward && carryAmt > 0 ? { carryForward: Math.round(carryAmt * 100) / 100 } : {}),
      };
    }

    const creditStartMonth = y === joinYear ? joinMonth : 0;
    const creditEndMonth = y === nowYear ? nowMonth : 11;
    const history: any[] = [];
    const monthLabel = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // History: carry-forward entries at start of year
    for (const lt of effectiveLeaveTypes) {
      if (lt.carryForward && prevYearAvailable[lt.id] > 0) {
        history.push({
          type: 'credit',
          leaveType: lt.id,
          leaveTypeName: lt.name,
          amount: prevYearAvailable[lt.id],
          date: new Date(Date.UTC(y, 0, 1)).toISOString(),
          note: `Carry forward from ${y - 1}`,
        });
      }
    }

    // History: monthly credit entries
    if (accrualMonths > 0 && creditEndMonth >= creditStartMonth) {
      for (let m = creditStartMonth; m <= creditEndMonth; m += 1) {
        for (const lt of effectiveLeaveTypes) {
          if (lt.accrualType !== 'monthly') continue;
          const creditValue = lt.accrualValue;
          if (creditValue <= 0) continue;
          history.push({
            type: 'credit',
            leaveType: lt.id,
            leaveTypeName: lt.name,
            amount: creditValue,
            date: new Date(Date.UTC(y, m, 1)).toISOString(),
            note: `Monthly credit for ${monthLabel[m]} ${y}`,
          });
        }
      }
    }

    // History: fixed accrual — one entry per year
    for (const lt of effectiveLeaveTypes) {
      if (lt.accrualType !== 'fixed' || accrualMonths === 0) continue;
      const fixedAmt = this.computeCredited(lt, accrualMonths, joiningDate, y);
      if (fixedAmt <= 0) continue;
      history.push({
        type: 'credit',
        leaveType: lt.id,
        leaveTypeName: lt.name,
        amount: fixedAmt,
        date: new Date(Date.UTC(y, creditStartMonth, 1)).toISOString(),
        note: `Annual credit for ${y}${(y === joinYear && lt.id !== 'maternity' && lt.id !== 'paternity' && lt.code !== 'ML' && lt.code !== 'PL') ? ` (prorated: ${fixedAmt} days)` : ''}`,
      });
    }
    const ltNameMap: Record<string, string> = {};
    for (const lt of effectiveLeaveTypes) { ltNameMap[lt.id] = lt.name; }
    ltNameMap['lop'] = ltNameMap['lop'] || 'Loss of Pay';
    ltNameMap['comp_off'] = ltNameMap['comp_off'] || 'Comp Off';

    for (const leave of normalizedLeaves) {
      history.push({
        type:
          leave.status === 'approved'
            ? 'utilized'
            : leave.status === 'pending'
            ? 'requested'
            : leave.status,
        leaveType: leave.leaveType,
        leaveTypeName: ltNameMap[leave.leaveType] || leave.leaveType,
        amount: leave.days,
        date:
          leave.status === 'approved'
            ? leave.approvedAt || leave.appliedAt
            : leave.status === 'rejected'
            ? leave.rejectedAt || leave.appliedAt
            : leave.status === 'cancelled'
            ? leave.cancelledAt || leave.appliedAt
            : leave.appliedAt,
        leaveId: leave.id,
        status: leave.status,
        isAutoLop: leave.isAutoLop ?? false,
        reason: leave.reason || null,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
      });
    }
    for (const adjustment of manualAdjustmentRows) {
      const amount = Math.round(toNumber(adjustment.adjustment) * 100) / 100;
      history.push({
        type: amount >= 0 ? 'manual_credit' : 'manual_debit',
        leaveType: adjustment.leaveType,
        leaveTypeName: ltNameMap[adjustment.leaveType] || adjustment.leaveType,
        amount: Math.abs(amount),
        signedAmount: amount,
        date: adjustment.createdAt,
        note: adjustment.reason || 'Manual leave balance adjustment',
        reason: adjustment.reason || null,
      });
    }
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const normalizedManualAdjustments: Record<string, number> = {};
    for (const [k, v] of Object.entries(manualAdjustments)) {
      normalizedManualAdjustments[k] = Math.round(v * 100) / 100;
    }

    return {
      employeeId,
      employeeCode: employee.employeeCode,
      employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
      year: y,
      accrualMonths,
      config,
      manualAdjustments: normalizedManualAdjustments,
      casual: cards.casual?.available ?? 0,
      sick: cards.sick?.available ?? 0,
      earned: cards.earned?.available ?? 0,
      lop: cards.lop?.available ?? 0,
      comp_off: cards.comp_off?.available ?? 0,
      cards,
      leaves: normalizedLeaves,
      history,
    };
  }

  async getMyLeaveSummary(userId: string, year?: number) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    return this.getEmployeeLeaveSummaryByEmployeeId(employee.id, year);
  }

  private ensureAttendanceEligible(status: EmployeeStatus) {
    if (status !== 'active' && status !== 'notice_period') {
      throw ApiError.unprocessable(
        'Attendance allowed only for active or notice period employees',
        'ATTENDANCE_NOT_ALLOWED'
      );
    }
  }

  private async ensureNoHolidayOrApprovedLeave(employeeId: string, dateOnly: string) {
    const holidayRows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
      `SELECT id, name FROM holidays WHERE date = $1::date LIMIT 1`,
      dateOnly
    );
    if (holidayRows[0]) {
      throw ApiError.unprocessable(`Cannot mark attendance on holiday: ${holidayRows[0].name}`, 'HOLIDAY_BLOCK');
    }

    const leaveRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      SELECT id
      FROM leaves
      WHERE employee_id = $1::uuid
        AND status = 'approved'
        AND $2::date BETWEEN from_date AND to_date
      LIMIT 1
    `,
      employeeId,
      dateOnly
    );
    if (leaveRows[0]) {
      throw ApiError.unprocessable('Cannot mark attendance on approved leave', 'LEAVE_BLOCK');
    }
  }

  async checkIn(userId: string, location?: { latitude?: number; longitude?: number; accuracy?: number }, clientTime?: string) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    this.ensureAttendanceEligible(employee.status);

    const now = resolveClientTime(clientTime);
    if (isWeekend(now)) {
      throw ApiError.unprocessable('Check-in is not allowed on weekends', 'WEEKEND_BLOCK');
    }
    const dateOnly = toDateOnly(now);
    await this.ensureNoHolidayOrApprovedLeave(employee.id, dateOnly);

    const nowIso = now.toISOString();

    // Wrap check-and-insert in a transaction to prevent race conditions (double clock-in)
    const attendanceId = await prisma.$transaction(async (tx) => {
      // Fetch today's attendance row with FOR UPDATE lock to prevent concurrent modifications
      const existingRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, check_in_time as "checkInTime", status::text as status
         FROM attendance
         WHERE employee_id = $1::uuid AND date = $2::date
         LIMIT 1
         FOR UPDATE`,
        employee.id,
        dateOnly
      );
      const existing = existingRows[0];

      // Check the last log entry — must not be an unclosed clock_in
      if (existing) {
        const lastLogRows = await tx.$queryRawUnsafe<any[]>(
          `SELECT type FROM attendance_logs
           WHERE attendance_id = $1::uuid
           ORDER BY logged_at DESC
           LIMIT 1`,
          existing.id
        );
        const lastLog = lastLogRows[0];
        if (lastLog?.type === 'clock_in') {
          throw ApiError.conflict('Already clocked in. Please clock out first.', 'ALREADY_CHECKED_IN');
        }
      }

      let attId: string;

      if (!existing) {
        // First clock-in of the day — create the attendance row
        const rows = await tx.$queryRawUnsafe<any[]>(
          `INSERT INTO attendance (employee_id, date, check_in_time, status, created_by)
           VALUES ($1::uuid, $2::date, $3::timestamptz, 'checked_in', $4::uuid)
           RETURNING id, date, check_in_time as "checkInTime", status::text as status`,
          employee.id,
          dateOnly,
          nowIso,
          userId
        );
        attId = rows[0].id;
      } else {
        // Subsequent clock-in — update status to checked_in, keep first check_in_time
        await tx.$queryRawUnsafe(
          `UPDATE attendance
           SET status = 'checked_in', updated_at = $2::timestamptz
           WHERE id = $1::uuid`,
          existing.id,
          nowIso
        );
        attId = existing.id;
      }

      // Insert the clock_in log entry
      await tx.$queryRawUnsafe(
        `INSERT INTO attendance_logs (attendance_id, employee_id, date, type, logged_at, latitude, longitude, accuracy)
         VALUES ($1::uuid, $2::uuid, $3::date, 'clock_in', $4::timestamptz, $5, $6, $7)`,
        attId,
        employee.id,
        dateOnly,
        nowIso,
        location?.latitude ?? null,
        location?.longitude ?? null,
        location?.accuracy ?? null
      );

      return attId;
    });

    const freshRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, date, check_in_time as "checkInTime", status::text as status
       FROM attendance WHERE id = $1::uuid`,
      attendanceId
    );
    const normalized = normalizeAttendanceTimestamps(freshRows[0]);

    return {
      attendanceId: normalized.id,
      date: normalized.date,
      checkInTime: normalized.checkInTime,
      checkInTimeUtc: normalized.checkInTimeUtc || null,
      checkInTimeDisplay: normalized.checkInTimeDisplay || null,
      status: normalized.status,
    };
  }

  async checkOut(userId: string, location?: { latitude?: number; longitude?: number; accuracy?: number }, clientTime?: string) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    this.ensureAttendanceEligible(employee.status);

    const now = resolveClientTime(clientTime);
    const nowIso = now.toISOString();
    const dateOnly = toDateOnly(now);

    // Wrap in transaction with row lock to prevent race conditions (double clock-out)
    const updatedRows = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, check_in_time as "checkInTime", check_out_time as "checkOutTime", status::text as status
         FROM attendance
         WHERE employee_id = $1::uuid AND date = $2::date
         LIMIT 1
         FOR UPDATE`,
        employee.id,
        dateOnly
      );
      const attendance = rows[0];
      if (!attendance?.checkInTime) {
        throw ApiError.unprocessable('Check-in is required before check-out', 'CHECKIN_REQUIRED');
      }

      // Check the last log — must be a clock_in (i.e. currently clocked in)
      const lastLogRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT type FROM attendance_logs
         WHERE attendance_id = $1::uuid
         ORDER BY logged_at DESC
         LIMIT 1`,
        attendance.id
      );
      const lastLog = lastLogRows[0];
      if (lastLog) {
        if (lastLog.type === 'clock_out') {
          throw ApiError.conflict('Not currently clocked in', 'NOT_CHECKED_IN');
        }
      } else {
        if (attendance.checkOutTime) {
          throw ApiError.conflict('Not currently clocked in', 'NOT_CHECKED_IN');
        }
      }

      // Insert the clock_out log entry
      await tx.$queryRawUnsafe(
        `INSERT INTO attendance_logs (attendance_id, employee_id, date, type, logged_at, latitude, longitude, accuracy)
         VALUES ($1::uuid, $2::uuid, $3::date, 'clock_out', $4::timestamptz, $5, $6, $7)`,
        attendance.id,
        employee.id,
        dateOnly,
        nowIso,
        location?.latitude ?? null,
        location?.longitude ?? null,
        location?.accuracy ?? null
      );

      // Recompute total work_hours from all paired clock_in/clock_out log sessions
      const computedRows = await tx.$queryRawUnsafe<Array<{ totalHours: number }>>(
        `WITH ordered_logs AS (
           SELECT type, logged_at,
                  ROW_NUMBER() OVER (ORDER BY logged_at) AS rn
           FROM attendance_logs
           WHERE attendance_id = $1::uuid
         ),
         pairs AS (
           SELECT ci.logged_at AS cin, co.logged_at AS cout
           FROM ordered_logs ci
           JOIN ordered_logs co ON co.rn = ci.rn + 1
           WHERE ci.type = 'clock_in' AND co.type = 'clock_out'
         )
         SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (cout - cin)) / 3600), 0) AS "totalHours"
         FROM pairs`,
        attendance.id
      );
      const totalHours = Number(computedRows[0]?.totalHours ?? 0);

      // Update attendance: last checkout time, work_hours = total from logs, status = present
      return tx.$queryRawUnsafe<any[]>(
        `UPDATE attendance
         SET check_out_time = $2::timestamptz,
             status = 'present',
             work_hours = $3,
             updated_at = $2::timestamptz
         WHERE id = $1::uuid
         RETURNING id, check_in_time as "checkInTime", check_out_time as "checkOutTime", work_hours as "workHours", status::text as status`,
        attendance.id,
        nowIso,
        totalHours
      );
    });
    const normalized = normalizeAttendanceTimestamps(updatedRows[0]);
    return {
      attendanceId: normalized.id,
      checkInTime: normalized.checkInTime,
      checkInTimeUtc: normalized.checkInTimeUtc || null,
      checkInTimeDisplay: normalized.checkInTimeDisplay || null,
      checkOutTime: normalized.checkOutTime,
      checkOutTimeUtc: normalized.checkOutTimeUtc || null,
      checkOutTimeDisplay: normalized.checkOutTimeDisplay || null,
      workHours: Number(normalized.workHours || 0),
      status: normalized.status,
    };
  }

  /** Return today's clock-in/out log entries for the current user */
  async getAttendanceClockLogs(userId: string, attendanceId: string) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    // Verify the attendance record belongs to this employee
    const attendanceRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM attendance WHERE id = $1::uuid AND employee_id = $2::uuid LIMIT 1`,
      attendanceId,
      employee.id
    );
    if (!attendanceRows[0]) return { logs: [] };

    const logRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT type, logged_at as "loggedAt", latitude, longitude, accuracy
       FROM attendance_logs
       WHERE attendance_id = $1::uuid
       ORDER BY logged_at ASC`,
      attendanceId
    );

    const logs = logRows.map((r: any) => {
      const fixed = fixTimestampWithoutTz(r.loggedAt instanceof Date ? r.loggedAt : new Date(r.loggedAt));
      return {
        type: r.type,
        loggedAt: fixed ? fixed.toISOString() : (r.loggedAt instanceof Date ? r.loggedAt.toISOString() : r.loggedAt),
        display: toCompanyDisplayTime(fixed || r.loggedAt),
        location: (r.latitude != null && r.longitude != null) ? { latitude: r.latitude, longitude: r.longitude, accuracy: r.accuracy ?? null } : null,
      };
    });

    return { logs };
  }

  async getTodayClockLogs(userId: string) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    const dateOnly = toDateOnly(new Date());

    const attendanceRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM attendance WHERE employee_id = $1::uuid AND date = $2::date LIMIT 1`,
      employee.id,
      dateOnly
    );
    if (!attendanceRows[0]) return { logs: [], date: dateOnly };

    const logRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT type, logged_at as "loggedAt", latitude, longitude, accuracy
       FROM attendance_logs
       WHERE attendance_id = $1::uuid
       ORDER BY logged_at ASC`,
      attendanceRows[0].id
    );

    const logs = logRows.map((r: any) => {
      const fixed = fixTimestampWithoutTz(r.loggedAt instanceof Date ? r.loggedAt : new Date(r.loggedAt));
      return {
        type: r.type,
        loggedAt: fixed ? fixed.toISOString() : (r.loggedAt instanceof Date ? r.loggedAt.toISOString() : r.loggedAt),
        display: toCompanyDisplayTime(fixed || r.loggedAt),
        location: (r.latitude != null && r.longitude != null) ? { latitude: r.latitude, longitude: r.longitude, accuracy: r.accuracy ?? null } : null,
      };
    });

    return { logs, date: dateOnly };
  }

  async getMyAttendance(userId: string, month?: number, year?: number, fromDate?: string, toDate?: string) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    const todayStr = toDateOnly(toCompanyDateTime(new Date()));

    let rows: any[];
    if (fromDate && toDate) {
      // Week / date-range based query
      rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, date, check_in_time as "checkInTime", check_out_time as "checkOutTime",
                status::text as status, work_hours as "workHours"
         FROM attendance
         WHERE employee_id = $1::uuid
           AND date >= $2::date
           AND date <= $3::date
         ORDER BY date DESC`,
        employee.id,
        fromDate,
        toDate
      );
    } else {
      // Legacy month-based query
      const y = year || new Date().getFullYear();
      const m = month || new Date().getMonth() + 1;
      rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, date, check_in_time as "checkInTime", check_out_time as "checkOutTime",
                status::text as status, work_hours as "workHours"
         FROM attendance
         WHERE employee_id = $1::uuid
           AND EXTRACT(YEAR FROM date) = $2
           AND EXTRACT(MONTH FROM date) = $3
         ORDER BY date DESC`,
        employee.id,
        y,
        m
      );
    }

    const attendance = rows.map(row => normalizeAttendanceTimestamps(row));
    // Exclude today from stats — today's record is still in-progress
    const statsRows = attendance.filter(r => {
      const rd = r.date instanceof Date ? toDateOnly(r.date) : String(r.date).slice(0, 10);
      return rd !== todayStr;
    });
    return {
      employeeId: employee.id,
      month: month || new Date().getMonth() + 1,
      year: year || new Date().getFullYear(),
      fromDate: fromDate || null,
      toDate: toDate || null,
      attendance,
      cards: buildAttendanceCards(statsRows),
    };
  }

  private normalizeRegularizationFilters(filters: AttendanceRegularizationRequestFilters) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Math.min(100, Number(filters.limit || 20)));
    return {
      status: filters.status || undefined,
      branchId: filters.branchId || undefined,
      page,
      limit,
      offset: (page - 1) * limit,
    };
  }

  private parseRegularizationPayload(rawPayload: string | null, strict: boolean): AttendanceRegularizationPayload {
    let parsed: any = {};
    if (rawPayload) {
      try {
        parsed = JSON.parse(rawPayload);
      } catch {
        if (strict) {
          throw ApiError.unprocessable(
            'Attendance regularization request payload is invalid',
            'REGULARIZATION_PAYLOAD_INVALID'
          );
        }
        parsed = {};
      }
    } else if (strict) {
      throw ApiError.unprocessable(
        'Attendance regularization request payload is missing',
        'REGULARIZATION_PAYLOAD_MISSING'
      );
    }

    const payload: AttendanceRegularizationPayload = {
      attendanceDate: typeof parsed.attendanceDate === 'string' ? parsed.attendanceDate : null,
      requestedCheckInTime:
        typeof parsed.requestedCheckInTime === 'string' ? parsed.requestedCheckInTime : null,
      requestedCheckOutTime:
        typeof parsed.requestedCheckOutTime === 'string' ? parsed.requestedCheckOutTime : null,
      reason: typeof parsed.reason === 'string' ? parsed.reason : null,
    };

    if (strict) {
      if (!payload.attendanceDate) {
        throw ApiError.unprocessable(
          'Attendance date is missing in regularization request',
          'REGULARIZATION_DATE_MISSING'
        );
      }
      if (!payload.requestedCheckInTime && !payload.requestedCheckOutTime) {
        throw ApiError.unprocessable(
          'Requested check-in or check-out time is required in regularization request',
          'REGULARIZATION_TIME_MISSING'
        );
      }
    }

    return payload;
  }

  private deriveRegularizedAttendanceStatus(checkInTime?: string | null, checkOutTime?: string | null): { status: string; workHours: number | null } {
    if (checkInTime && checkOutTime) {
      const diffMs = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
      const workHours = Math.round((diffMs / 3_600_000) * 100) / 100; // 2 decimal places
      let status = 'present';
      if (workHours < HALF_DAY_HOURS) status = 'absent';
      else if (workHours < FULL_DAY_HOURS) status = 'half_day';
      return { status, workHours };
    }
    if (checkInTime || checkOutTime) return { status: 'incomplete', workHours: null };
    return { status: 'absent', workHours: null };
  }

  private async getPendingRegularizationRequestForApprover(
    tx: any,
    requestId: string,
    approverUserId: string,
    approverType: RegularizationApproverType,
    managerEmployeeId?: string,
    branchId?: string | null
  ) {
    if (approverType === 'manager') {
      const rows = (await tx.$queryRawUnsafe(
        `
        SELECT
          a.id as "requestId",
          a.status::text as status,
          a.resource_id as "attendanceId",
          a.requester_id as "requesterEmployeeId",
          ah.note as "requestPayload"
        FROM approvals a
        JOIN employees e ON e.id = a.requester_id
        LEFT JOIN LATERAL (
          SELECT h.note
          FROM approval_history h
          WHERE h.approval_id = a.id
          ORDER BY h.created_at ASC
          LIMIT 1
        ) ah ON TRUE
        WHERE a.id = $1::uuid
          AND a.resource_type = 'attendance_correction'
          AND a.current_approver_id = $2::uuid
          AND e.manager_id = $3::uuid
        LIMIT 1
        FOR UPDATE OF a
        `,
        requestId,
        approverUserId,
        managerEmployeeId
      )) as Array<{
        requestId: string;
        status: string;
        attendanceId: string;
        requesterEmployeeId: string;
        requestPayload: string | null;
      }>;
      return rows[0];
    }

    const rows = (await tx.$queryRawUnsafe(
      `
      SELECT
        a.id as "requestId",
        a.status::text as status,
        a.resource_id as "attendanceId",
        a.requester_id as "requesterEmployeeId",
        ah.note as "requestPayload"
      FROM approvals a
      JOIN employees e ON e.id = a.requester_id
      LEFT JOIN LATERAL (
        SELECT h.note
        FROM approval_history h
        WHERE h.approval_id = a.id
        ORDER BY h.created_at ASC
        LIMIT 1
      ) ah ON TRUE
      WHERE a.id = $1::uuid
        AND a.resource_type = 'attendance_correction'
        AND ($2::text IS NULL OR e.branch_id = $2)
      LIMIT 1
      FOR UPDATE OF a
      `,
      requestId,
      branchId ?? null
    )) as Array<{
      requestId: string;
      status: string;
      attendanceId: string;
      requesterEmployeeId: string;
      requestPayload: string | null;
    }>;
    return rows[0];
  }

  private async listRegularizationsForApprover(
    approverType: RegularizationApproverType,
    approverUserId: string,
    filters: AttendanceRegularizationRequestFilters,
    managerEmployeeId?: string,
    managerBranchId?: string | null
  ) {
    const { status, branchId, page, limit, offset } = this.normalizeRegularizationFilters(filters);

    let items: any[] = [];
    let total = 0;

    if (approverType === 'manager') {
      items = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          a.id as "requestId",
          a.resource_id as "attendanceId",
          a.status::text as status,
          a.approver_type::text as "approverType",
          a.created_at as "requestedAt",
          a.responded_at as "respondedAt",
          a.response_note as "decisionNote",
          ah.note as "requestPayload",
          TRIM(CONCAT(COALESCE(approver.first_name, ''), ' ', COALESCE(approver.last_name, ''))) as "currentApproverName",
          e.id as "employeeId",
          e.employee_id as "employeeCode",
          e.first_name as "employeeFirstName",
          e.last_name as "employeeLastName"
        FROM approvals a
        JOIN employees e ON e.id = a.requester_id
        LEFT JOIN users approver ON approver.id = a.current_approver_id
        LEFT JOIN LATERAL (
          SELECT h.note
          FROM approval_history h
          WHERE h.approval_id = a.id
          ORDER BY h.created_at ASC
          LIMIT 1
        ) ah ON TRUE
        WHERE a.resource_type = 'attendance_correction'
          AND e.manager_id = $1::uuid
          AND (a.current_approver_id = $2::uuid OR a.approver_id = $2::uuid)
          AND ($3::text IS NULL OR a.status::text = $3)
          AND ($6::text IS NULL OR e.branch_id = $6)
        ORDER BY a.created_at DESC
        LIMIT $4 OFFSET $5
        `,
        managerEmployeeId,
        approverUserId,
        status || null,
        limit,
        offset,
        managerBranchId ?? null
      );

      const totalRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
        `
        SELECT COUNT(*)::text as count
        FROM approvals a
        JOIN employees e ON e.id = a.requester_id
        WHERE a.resource_type = 'attendance_correction'
          AND e.manager_id = $1::uuid
          AND (a.current_approver_id = $2::uuid OR a.approver_id = $2::uuid)
          AND ($3::text IS NULL OR a.status::text = $3)
          AND ($4::text IS NULL OR e.branch_id = $4)
        `,
        managerEmployeeId,
        approverUserId,
        status || null,
        managerBranchId ?? null
      );
      total = parseInt(totalRows[0]?.count || '0', 10);
    } else {
      items = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          a.id as "requestId",
          a.resource_id as "attendanceId",
          a.status::text as status,
          a.approver_type::text as "approverType",
          a.created_at as "requestedAt",
          a.responded_at as "respondedAt",
          a.response_note as "decisionNote",
          ah.note as "requestPayload",
          TRIM(CONCAT(COALESCE(approver.first_name, ''), ' ', COALESCE(approver.last_name, ''))) as "currentApproverName",
          e.id as "employeeId",
          e.employee_id as "employeeCode",
          e.first_name as "employeeFirstName",
          e.last_name as "employeeLastName"
        FROM approvals a
        JOIN employees e ON e.id = a.requester_id
        LEFT JOIN users approver ON approver.id = a.current_approver_id
        LEFT JOIN LATERAL (
          SELECT h.note
          FROM approval_history h
          WHERE h.approval_id = a.id
          ORDER BY h.created_at ASC
          LIMIT 1
        ) ah ON TRUE
        WHERE a.resource_type = 'attendance_correction'
          AND ($1::text IS NULL OR a.status::text = $1)
          AND ($4::text IS NULL OR e.branch_id = $4)
        ORDER BY a.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        status || null,
        limit,
        offset,
        branchId || null
      );

      const totalRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
        `
        SELECT COUNT(*)::text as count
        FROM approvals a
        JOIN employees e ON e.id = a.requester_id
        WHERE a.resource_type = 'attendance_correction'
          AND ($1::text IS NULL OR a.status::text = $1)
          AND ($2::text IS NULL OR e.branch_id = $2)
        `,
        status || null,
        branchId || null
      );
      total = parseInt(totalRows[0]?.count || '0', 10);
    }

    return {
      items: items.map((item: any) => {
        const payload = this.parseRegularizationPayload(item.requestPayload, false);
        const requestedAtIso = item.requestedAt ? new Date(item.requestedAt).toISOString() : null;
        const fullName =
          `${item.employeeFirstName || ''} ${item.employeeLastName || ''}`.trim() ||
          item.employeeCode ||
          'Employee';
        return {
          requestId: item.requestId,
          attendanceId: item.attendanceId,
          status: item.status,
          approverType: item.approverType,
          attendanceDate: payload.attendanceDate,
          requestedCheckInTime: payload.requestedCheckInTime,
          requestedCheckOutTime: payload.requestedCheckOutTime,
          reason: payload.reason,
          decisionNote: item.decisionNote || null,
          currentApproverName: item.currentApproverName || null,
          requestedAt: requestedAtIso,
          appliedAt: requestedAtIso,
          appliedAgo: toRelativeTime(requestedAtIso),
          appliedAtRelative: toRelativeTime(requestedAtIso),
          respondedAt: item.respondedAt || null,
          name: fullName,
          employeeName: fullName,
          employeeFirstName: item.employeeFirstName || null,
          employeeLastName: item.employeeLastName || null,
          employeeId: item.employeeId || null,
          employeeCode: item.employeeCode || null,
          'employee.id': item.employeeId || null,
          'employee.employeeId': item.employeeCode || null,
          'employee.firstName': item.employeeFirstName || null,
          'employee.lastName': item.employeeLastName || null,
          employee: {
            id: item.employeeId,
            employeeCode: item.employeeCode,
            firstName: item.employeeFirstName,
            lastName: item.employeeLastName,
            fullName,
            name: fullName,
          },
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async approveRegularizationRequest(
    approverType: RegularizationApproverType,
    approverUserId: string,
    requestId: string,
    decisionPayload: AttendanceRegularizationDecisionPayload,
    managerEmployeeId?: string,
    branchId?: string | null
  ) {
    let capturedRequesterEmpId: string | null = null;
    let capturedAttendanceDate: string | null = null;

    const result = await prisma.$transaction(async tx => {
      const request = await this.getPendingRegularizationRequestForApprover(
        tx,
        requestId,
        approverUserId,
        approverType,
        managerEmployeeId,
        branchId
      );

      if (!request) {
        throw ApiError.notFound(
          approverType === 'manager'
            ? 'Attendance regularization request not found for your team'
            : 'Attendance regularization request not found',
          'REGULARIZATION_REQUEST_NOT_FOUND'
        );
      }
      if (request.status !== 'pending') {
        throw ApiError.unprocessable(
          'Only pending attendance regularization requests can be approved',
          'INVALID_REGULARIZATION_STATUS'
        );
      }

      capturedRequesterEmpId = request.requesterEmployeeId;
      const payload = this.parseRegularizationPayload(request.requestPayload, true);
      capturedAttendanceDate = payload.attendanceDate;
      const { status: attendanceStatus, workHours } = this.deriveRegularizedAttendanceStatus(
        payload.requestedCheckInTime,
        payload.requestedCheckOutTime
      );
      const attendanceRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `
        INSERT INTO attendance
          (id, employee_id, date, check_in_time, check_out_time, status, work_hours, manual_correction, correction_reason, corrected_by, corrected_at, created_by, updated_at)
        VALUES
          ($1::uuid, $2::uuid, $3::date, $4::timestamp, $5::timestamp, $6::attendance_status, $9, true, $7, $8::uuid, NOW(), $8::uuid, NOW())
        ON CONFLICT (employee_id, date)
        DO UPDATE SET
          check_in_time = EXCLUDED.check_in_time,
          check_out_time = EXCLUDED.check_out_time,
          status = EXCLUDED.status,
          work_hours = EXCLUDED.work_hours,
          manual_correction = true,
          correction_reason = EXCLUDED.correction_reason,
          corrected_by = EXCLUDED.corrected_by,
          corrected_at = NOW(),
          updated_at = NOW()
        RETURNING id
        `,
        request.attendanceId,
        request.requesterEmployeeId,
        payload.attendanceDate,
        payload.requestedCheckInTime,
        payload.requestedCheckOutTime,
        attendanceStatus,
        payload.reason,
        approverUserId,
        workHours
      );
      const resolvedAttendanceId = attendanceRows[0]?.id || request.attendanceId;
      const decisionNote = decisionPayload.note || null;

      // Reverse any system-generated auto-LOP for this date when attendance is corrected to present or half_day
      if (attendanceStatus === 'present' || attendanceStatus === 'half_day') {
        await tx.$executeRawUnsafe(
          `UPDATE leaves
           SET    status       = 'cancelled'::leave_status,
                  cancelled_at = NOW(),
                  updated_at   = NOW()
           WHERE  employee_id  = $1::uuid
             AND  from_date    = $2::date
             AND  is_auto_lop  = true
             AND  status       = 'approved'::leave_status`,
          request.requesterEmployeeId,
          payload.attendanceDate
        );
      }

      await tx.$executeRawUnsafe(
        `
        UPDATE approvals
        SET
          resource_id = $2::uuid,
          status = 'approved',
          response = 'approved',
          response_note = $3,
          rejection_reason = NULL,
          responded_at = NOW(),
          updated_at = NOW()
        WHERE id = $1::uuid
        `,
        requestId,
        resolvedAttendanceId,
        decisionNote
      );

      await tx.$executeRawUnsafe(
        `
        INSERT INTO approval_history
          (approval_id, status, acted_by, note)
        VALUES
          ($1::uuid, 'approved', $2::uuid, $3)
        `,
        requestId,
        approverUserId,
        JSON.stringify({
          action: 'approved',
          note: decisionNote,
          attendanceDate: payload.attendanceDate,
          requestedCheckInTime: payload.requestedCheckInTime,
          requestedCheckOutTime: payload.requestedCheckOutTime,
          requestReason: payload.reason,
        })
      );

      return {
        requestId,
        attendanceId: resolvedAttendanceId,
        status: 'approved',
        attendanceStatus,
        note: decisionNote,
      };
    });

    // Notify the employee that their regularization was approved (non-blocking)
    if (capturedRequesterEmpId) {
      (async () => {
        try {
          const empRows = await prisma.$queryRawUnsafe<Array<{ userId: string; name: string }>>(
            `SELECT e.user_id as "userId", CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as name FROM employees WHERE id = $1::uuid LIMIT 1`,
            capturedRequesterEmpId
          );
          const empUserId = empRows[0]?.userId;
          const empName = empRows[0]?.name?.trim() || 'Employee';
          if (empUserId) {
            await this.notifyHrms('hrms_regularization_approved', approverUserId, [empUserId], {
              employeeName: empName,
              attendanceDate: capturedAttendanceDate || '',
            });
          }
        } catch { /* no-op */ }
      })();
    }

    return result;
  }

  private async rejectRegularizationRequest(
    approverType: RegularizationApproverType,
    approverUserId: string,
    requestId: string,
    decisionPayload: AttendanceRegularizationDecisionPayload,
    managerEmployeeId?: string,
    branchId?: string | null
  ) {
    let capturedRequesterEmpId: string | null = null;

    const result = await prisma.$transaction(async tx => {
      const request = await this.getPendingRegularizationRequestForApprover(
        tx,
        requestId,
        approverUserId,
        approverType,
        managerEmployeeId,
        branchId
      );

      if (!request) {
        throw ApiError.notFound(
          approverType === 'manager'
            ? 'Attendance regularization request not found for your team'
            : 'Attendance regularization request not found',
          'REGULARIZATION_REQUEST_NOT_FOUND'
        );
      }
      if (request.status !== 'pending') {
        throw ApiError.unprocessable(
          'Only pending attendance regularization requests can be rejected',
          'INVALID_REGULARIZATION_STATUS'
        );
      }

      capturedRequesterEmpId = request.requesterEmployeeId;
      const reason = decisionPayload.reason || null;
      await tx.$executeRawUnsafe(
        `
        UPDATE approvals
        SET
          status = 'rejected',
          response = 'rejected',
          response_note = $2,
          rejection_reason = $2,
          responded_at = NOW(),
          updated_at = NOW()
        WHERE id = $1::uuid
        `,
        requestId,
        reason
      );

      await tx.$executeRawUnsafe(
        `
        INSERT INTO approval_history
          (approval_id, status, acted_by, note)
        VALUES
          ($1::uuid, 'rejected', $2::uuid, $3)
        `,
        requestId,
        approverUserId,
        JSON.stringify({
          action: 'rejected',
          reason,
        })
      );

      return {
        requestId,
        status: 'rejected',
        reason,
      };
    });

    // Notify the employee that their regularization was rejected (non-blocking)
    if (capturedRequesterEmpId) {
      (async () => {
        try {
          const empRows = await prisma.$queryRawUnsafe<Array<{ userId: string; name: string }>>(
            `SELECT e.user_id as "userId", CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as name FROM employees WHERE id = $1::uuid LIMIT 1`,
            capturedRequesterEmpId
          );
          const empUserId = empRows[0]?.userId;
          const empName = empRows[0]?.name?.trim() || 'Employee';
          if (empUserId) {
            await this.notifyHrms('hrms_regularization_rejected', approverUserId, [empUserId], {
              employeeName: empName,
              reason: decisionPayload.reason || '',
            });
          }
        } catch { /* no-op */ }
      })();
    }

    return result;
  }

  async submitAttendanceRegularization(userId: string, payload: AttendanceRegularizationInput) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    if (!['active', 'notice_period'].includes(employee.status)) {
      throw ApiError.forbidden('Regularization is allowed only for active employees', 'REGULARIZATION_NOT_ALLOWED');
    }

    const todayDate = toDateOnly(new Date());
    if (payload.attendanceDate > todayDate) {
      throw ApiError.unprocessable('Attendance date cannot be in the future', 'INVALID_ATTENDANCE_DATE');
    }

    if (!payload.requestedCheckInTime && !payload.requestedCheckOutTime) {
      throw ApiError.badRequest(
        'At least one of requestedCheckInTime or requestedCheckOutTime is required',
        'INVALID_REGULARIZATION_PAYLOAD'
      );
    }

    const usageRows = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
      `
      SELECT COUNT(*)::text as count
      FROM approvals
      WHERE requester_id = $1::uuid
        AND resource_type = 'attendance_correction'
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
      `,
      employee.id
    );
    const usedThisMonth = parseInt(usageRows[0]?.count || '0', 10);
    const monthlyLimit = 3;
    if (usedThisMonth >= monthlyLimit) {
      throw ApiError.unprocessable(
        `Monthly regularization limit reached (${monthlyLimit})`,
        'REGULARIZATION_LIMIT_EXCEEDED',
        { limit: monthlyLimit, used: usedThisMonth }
      );
    }

    const attendanceRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      SELECT id
      FROM attendance
      WHERE employee_id = $1::uuid
        AND date = $2::date
      LIMIT 1
      `,
      employee.id,
      payload.attendanceDate
    );
    const attendanceId = attendanceRows[0]?.id || randomUUID();

    const approverRows = await prisma.$queryRawUnsafe<Array<{ managerUserId: string | null }>>(
      `
      SELECT m.user_id as "managerUserId"
      FROM employees e
      LEFT JOIN employees m ON m.id = e.manager_id
      WHERE e.id = $1::uuid
      LIMIT 1
      `,
      employee.id
    );

    let approverId = approverRows[0]?.managerUserId || null;
    let approverType: 'manager' | 'hr' = 'manager';
    if (!approverId) {
      const hrUserIds = await this.getHrRecipients();
      approverId = hrUserIds[0] || null;
      approverType = 'hr';
    }
    if (!approverId) {
      throw ApiError.unprocessable('No approver available for regularization request', 'APPROVER_NOT_FOUND');
    }

    const approvalRows = await prisma.$queryRawUnsafe<Array<{ id: string; status: string; createdAt: Date }>>(
      `
      INSERT INTO approvals
        (resource_type, resource_id, requester_id, approver_id, current_approver_id, approver_type, status, priority)
      VALUES
        ('attendance_correction', $1::uuid, $2::uuid, $3::uuid, $3::uuid, $4::approval_approver_type, 'pending', 'normal')
      RETURNING id, status::text as status, created_at as "createdAt"
      `,
      attendanceId,
      employee.id,
      approverId,
      approverType
    );
    const request = approvalRows[0];

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO approval_history
        (approval_id, status, acted_by, note)
      VALUES
        ($1::uuid, 'pending', $2::uuid, $3)
      `,
      request.id,
      userId,
      JSON.stringify({
        attendanceDate: payload.attendanceDate,
        requestedCheckInTime: payload.requestedCheckInTime || null,
        requestedCheckOutTime: payload.requestedCheckOutTime || null,
        reason: payload.reason,
      })
    );

    // Notify the approver about the new regularization request (non-blocking)
    (async () => {
      try {
        const nameRows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) as name FROM employees WHERE id = $1::uuid LIMIT 1`,
          employee.id
        );
        const employeeName = nameRows[0]?.name?.trim() || 'Employee';
        await this.notifyHrms('hrms_regularization_submitted', userId, [approverId], {
          employeeName,
          attendanceDate: payload.attendanceDate,
        });
      } catch { /* notification failure should not block primary workflow */ }
    })();

    return {
      requestId: request.id,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      status: request.status,
      attendanceDate: payload.attendanceDate,
      requestedCheckInTime: payload.requestedCheckInTime || null,
      requestedCheckOutTime: payload.requestedCheckOutTime || null,
      reason: payload.reason,
      approverType,
      monthlyLimit,
      usedThisMonth: usedThisMonth + 1,
      remainingThisMonth: Math.max(0, monthlyLimit - (usedThisMonth + 1)),
      requestedAt: request.createdAt,
    };
  }

  async listMyAttendanceRegularizations(
    userId: string,
    filters: { month?: number; year?: number; status?: string }
  ) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    const items = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        a.id as "requestId",
        a.status::text as status,
        a.created_at as "requestedAt",
        a.response_note as "decisionNote",
        ah.note as "requestPayload",
        TRIM(CONCAT(COALESCE(approver.first_name, ''), ' ', COALESCE(approver.last_name, ''))) as "currentApproverName"
      FROM approvals a
      LEFT JOIN users approver ON approver.id = a.current_approver_id
      LEFT JOIN LATERAL (
        SELECT h.note
        FROM approval_history h
        WHERE h.approval_id = a.id
        ORDER BY h.created_at ASC
        LIMIT 1
      ) ah ON TRUE
      WHERE a.requester_id = $1::uuid
        AND a.resource_type = 'attendance_correction'
        AND ($2::text IS NULL OR a.status::text = $2)
        AND ($3::int IS NULL OR EXTRACT(MONTH FROM a.created_at) = $3)
        AND ($4::int IS NULL OR EXTRACT(YEAR FROM a.created_at) = $4)
      ORDER BY a.created_at DESC
      `,
      employee.id,
      filters.status || null,
      filters.month ?? null,
      filters.year ?? null
    );

    return {
      employeeId: employee.id,
      items: items.map((item: any) => {
        let payload = {} as Record<string, any>;
        try {
          payload = item.requestPayload ? JSON.parse(item.requestPayload) : {};
        } catch {
          payload = {};
        }
        return {
          requestId: item.requestId,
          status: item.status,
          attendanceDate: payload.attendanceDate || null,
          requestedCheckInTime: payload.requestedCheckInTime || null,
          requestedCheckOutTime: payload.requestedCheckOutTime || null,
          reason: payload.reason || null,
          currentApproverName: item.currentApproverName || null,
          decisionNote: item.decisionNote || null,
          requestedAt: item.requestedAt,
        };
      }),
    };
  }

  async listManagerAttendanceRegularizations(
    userId: string,
    filters: AttendanceRegularizationRequestFilters
  ) {
    const current = await this.getCurrentEmployeeByUserId(userId);
    return this.listRegularizationsForApprover('manager', userId, filters, current.id, current.branchId ?? null);
  }

  async managerApproveAttendanceRegularization(
    userId: string,
    requestId: string,
    payload: AttendanceRegularizationDecisionPayload
  ) {
    const current = await this.getCurrentEmployeeByUserId(userId);
    return this.approveRegularizationRequest('manager', userId, requestId, payload, current.id);
  }

  async managerRejectAttendanceRegularization(
    userId: string,
    requestId: string,
    payload: AttendanceRegularizationDecisionPayload
  ) {
    const current = await this.getCurrentEmployeeByUserId(userId);
    return this.rejectRegularizationRequest('manager', userId, requestId, payload, current.id);
  }

  async listHrAttendanceRegularizations(userId: string, filters: AttendanceRegularizationRequestFilters) {
    await this.getCurrentEmployeeByUserId(userId);
    return this.listRegularizationsForApprover('hr', userId, filters);
  }

  async hrApproveAttendanceRegularization(
    userId: string,
    requestId: string,
    payload: AttendanceRegularizationDecisionPayload
  ) {
    const current = await this.getCurrentEmployeeByUserId(userId);
    return this.approveRegularizationRequest('hr', userId, requestId, payload, undefined, current.branchId ?? null);
  }

  async hrRejectAttendanceRegularization(
    userId: string,
    requestId: string,
    payload: AttendanceRegularizationDecisionPayload
  ) {
    const current = await this.getCurrentEmployeeByUserId(userId);
    return this.rejectRegularizationRequest('hr', userId, requestId, payload, undefined, current.branchId ?? null);
  }

  async getMyProfile(userId: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        e.id, e.employee_id as "employeeId", e.first_name as "firstName", e.last_name as "lastName",
        u.avatar_url as "avatarUrl", u.updated_at as "userUpdatedAt",
        e.email, u.email as "workEmail", e.phone, e.date_of_birth as "dateOfBirth", e.joining_date as "joiningDate",
        e.designation, e.department, e.work_mode as "workMode", e.work_location as "workLocation", e.country, e.status::text as status,
        e.branch_id as "branchId",
        (
          SELECT b->>'name'
          FROM system_settings ss,
               jsonb_array_elements(ss.setting_value::jsonb) AS b
          WHERE ss.setting_key = 'org.branches' AND b->>'id' = e.branch_id
          LIMIT 1
        ) as "branchName",
        ep.personal_email as "personalEmail", ep.current_address as "currentAddress", ep.permanent_address as "permanentAddress",
        ep.marital_status::text as "maritalStatus",
        ep.emergency_contact_name as "emergencyContactName", ep.emergency_contact_phone as "emergencyContactPhone",
        ep.emergency_contact_relation as "emergencyContactRelation",
        m.id as "manager.id", m.employee_id as "manager.employeeId", m.first_name as "manager.firstName", m.last_name as "manager.lastName",
        m.designation as "manager.designation", m.department as "manager.department",
        mu.avatar_url as "manager.avatarUrl", mu.updated_at as "managerUserUpdatedAt"
      FROM employees e
      JOIN users u ON u.id = e.user_id
      LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN users mu ON mu.id = m.user_id
      WHERE u.id = $1::uuid AND e.deleted_at IS NULL
      LIMIT 1
      `,
      userId
    );
    if (!rows[0]) throw ApiError.notFound('Profile not found', 'PROFILE_NOT_FOUND');
    const row = rows[0];
    const avatarBase = normalizeMediaUrl(row.avatarUrl);
    const managerAvatarBase = normalizeMediaUrl(row['manager.avatarUrl']);

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
      row.id
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
      ...row,
      userUpdatedAt: undefined,
      managerUserUpdatedAt: undefined,
      avatarUrl: avatarBase && row.userUpdatedAt
        ? `${avatarBase.split('?')[0]}?v=${new Date(row.userUpdatedAt).getTime()}`
        : avatarBase,
      'manager.avatarUrl': managerAvatarBase && row.managerUserUpdatedAt
        ? `${managerAvatarBase.split('?')[0]}?v=${new Date(row.managerUserUpdatedAt).getTime()}`
        : managerAvatarBase,
      directReports,
    };
  }

  async updateMyProfile(userId: string, payload: any) {
    const employee = await this.getCurrentEmployeeByUserId(userId);

    await prisma.$transaction(async tx => {
      // Update Employee basic details
      await tx.$executeRawUnsafe(
        `
        UPDATE employees
        SET
          first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          phone = COALESCE($4, phone),
          date_of_birth = COALESCE($5::date, date_of_birth),
          work_location = COALESCE($6, work_location),
          updated_at = NOW(),
          updated_by = $7::uuid
        WHERE id = $1::uuid
        `,
        employee.id,
        payload.firstName || null,
        payload.lastName || null,
        payload.phone || null,
        payload.dateOfBirth || null,
        payload.workLocation || null,
        userId
      );

      // Upsert Employee Profile additional details
      await tx.$executeRawUnsafe(
        `
        INSERT INTO employee_profiles (
          employee_id, personal_email, current_address, permanent_address,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
          marital_status
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::employee_marital_status)
        ON CONFLICT (employee_id)
        DO UPDATE SET
          personal_email = COALESCE(EXCLUDED.personal_email, employee_profiles.personal_email),
          current_address = COALESCE(EXCLUDED.current_address, employee_profiles.current_address),
          permanent_address = COALESCE(EXCLUDED.permanent_address, employee_profiles.permanent_address),
          emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, employee_profiles.emergency_contact_name),
          emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, employee_profiles.emergency_contact_phone),
          emergency_contact_relation = COALESCE(EXCLUDED.emergency_contact_relation, employee_profiles.emergency_contact_relation),
          marital_status = COALESCE(EXCLUDED.marital_status, employee_profiles.marital_status),
          updated_at = NOW()
        `,
        employee.id,
        payload.personalEmail || null,
        payload.currentAddress || null,
        payload.permanentAddress || null,
        payload.emergencyContactName || null,
        payload.emergencyContactPhone || null,
        payload.emergencyContactRelation || null,
        payload.maritalStatus || null
      );
    });

    return { employeeId: employee.id };
  }

  private async validateLeaveRequest(employeeId: string, payload: LeaveApplyInput) {
    const from = new Date(payload.fromDate);
    const to = new Date(payload.toDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const session: LeaveSessionType = payload.session || 'full_day';
    const isHalfDay = session === 'first_half' || session === 'second_half';

    if (from < today) {
      throw ApiError.unprocessable('From date must be today or future', 'INVALID_FROM_DATE');
    }
    if (to < from) {
      throw ApiError.unprocessable('To date must be on or after from date', 'INVALID_TO_DATE');
    }
    if (isHalfDay && payload.fromDate !== payload.toDate) {
      throw ApiError.unprocessable('Half-day leave must be for a single day only', 'HALF_DAY_SINGLE_DAY_ONLY');
    }

    // ── Attendance-conflict validation ────────────────────────────────────────
    // If the leave starts today, check whether the employee already has an
    // attendance record (clock-in) that conflicts with the requested session.
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
    if (payload.fromDate === todayStr) {
      const todayAttRows = await prisma.$queryRawUnsafe<Array<{
        checkInTime: string | null;
        checkOutTime: string | null;
      }>>(
        `SELECT check_in_time as "checkInTime", check_out_time as "checkOutTime"
         FROM attendance
         WHERE employee_id = $1::uuid AND date = $2::date
         LIMIT 1`,
        employeeId,
        todayStr,
      );
      const todayAtt = todayAttRows[0];
      if (todayAtt) {
        if (todayAtt.checkOutTime) {
          // Employee has completed the full workday — no leave is applicable for today
          throw ApiError.unprocessable(
            'You have already clocked out for today. Leave cannot be applied for a completed workday.',
            'ATTENDANCE_ALREADY_COMPLETED',
          );
        }
        if (todayAtt.checkInTime) {
          if (session === 'first_half') {
            throw ApiError.unprocessable(
              'You have already clocked in for today\'s first half. First Half leave cannot be applied after attendance is marked.',
              'ATTENDANCE_FIRST_HALF_CONFLICT',
            );
          }
          if (session === 'full_day') {
            throw ApiError.unprocessable(
              'You have already clocked in for today. Full Day leave cannot be applied after attendance has been marked. You may apply for Second Half leave instead.',
              'ATTENDANCE_FULL_DAY_CONFLICT',
            );
          }
          // session === 'second_half': employee is present for first half and
          // wants the afternoon off — this is perfectly valid, allow it.
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const overlapRows = await prisma.$queryRawUnsafe<Array<{ id: string; session: string }>>(
      `
      SELECT id, session::text as session FROM leaves
      WHERE employee_id = $1::uuid
        AND status IN('pending', 'approved')
        AND daterange(from_date, to_date, '[]') && daterange($2::date, $3::date, '[]')
      LIMIT 1
      `,
      employeeId,
      payload.fromDate,
      payload.toDate
    );
    if (overlapRows[0]) {
      const existingSession = overlapRows[0].session || 'full_day';
      const existingIsHalfDay = existingSession === 'first_half' || existingSession === 'second_half';
      // Allow two half-days on the same day only if they are different halves
      const isComplementaryHalfDays =
        isHalfDay &&
        existingIsHalfDay &&
        payload.fromDate === payload.toDate &&
        existingSession !== session;
      if (!isComplementaryHalfDays) {
        throw ApiError.conflict('Leave overlaps with existing leave request', 'LEAVE_OVERLAP');
      }
    }

    let days: number;
    if (isHalfDay) {
      // Verify the day is a working day (not weekend/holiday)
      const workingDays = await this.calculateLeaveDays(payload.fromDate, payload.toDate);
      if (workingDays <= 0) {
        throw ApiError.unprocessable('Selected date is not a working day', 'NO_WORKING_DAYS');
      }
      days = 0.5;
    } else {
      days = await this.calculateLeaveDays(payload.fromDate, payload.toDate);
      if (days <= 0) {
        throw ApiError.unprocessable('No working days found in selected date range', 'NO_WORKING_DAYS');
      }
    }

    if (payload.leaveType !== 'lop') {
      const summary = await this.getEmployeeLeaveSummaryByEmployeeId(employeeId, from.getUTCFullYear());
      const available = toNumber(summary.cards[payload.leaveType]?.available);
      if (days > available) {
        throw ApiError.unprocessable(
          `Insufficient ${payload.leaveType} leave balance. Available: ${available}, requested: ${days}`,
          'INSUFFICIENT_LEAVE_BALANCE'
        );
      }

      // ── Max paid leaves per month check ──
      const empBranchRows = await prisma.$queryRawUnsafe<Array<{ branch_id: string | null }>>(
        'SELECT branch_id FROM employees WHERE id = $1::uuid LIMIT 1', employeeId
      );
      const empBranchId = empBranchRows[0]?.branch_id || null;
      const leaveConfig = await workforceService.getLeaveAccrualConfig(empBranchId);
      const maxPerMonth = leaveConfig.maxPaidLeavesPerMonth;
      if (maxPerMonth && maxPerMonth > 0) {
        // Count approved + pending paid leaves in the same month as fromDate
        const leaveMonth = from.getUTCMonth() + 1;
        const leaveYear = from.getUTCFullYear();
        const usedRows = await prisma.$queryRawUnsafe<Array<{ total: string }>>(
          `SELECT COALESCE(SUM(days), 0)::text as total FROM leaves
           WHERE employee_id = $1::uuid
             AND status IN ('pending', 'approved')
             AND leave_type != 'lop'
             AND EXTRACT(MONTH FROM from_date) = $2
             AND EXTRACT(YEAR FROM from_date) = $3`,
          employeeId, leaveMonth, leaveYear
        );
        const usedThisMonth = parseFloat(usedRows[0]?.total || '0');
        if (usedThisMonth + days > maxPerMonth) {
          throw ApiError.unprocessable(
            `Maximum ${maxPerMonth} paid leave days allowed per month. Already used/pending: ${usedThisMonth}, requested: ${days}`,
            'MONTHLY_PAID_LEAVE_LIMIT'
          );
        }
      }
    }

    return { days, session };
  }

  async applyMyLeave(userId: string, payload: LeaveApplyInput) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    const { days, session } = await this.validateLeaveRequest(employee.id, payload);

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO leaves(employee_id, leave_type, from_date, to_date, session, days, reason, status)
      VALUES($1::uuid, $2, $3::date, $4::date, $5::leave_session, $6, $7, 'pending')
      RETURNING id, leave_type::text as "leaveType", from_date as "fromDate", to_date as "toDate", session::text as session, days, status::text as status
    `,
      employee.id,
      payload.leaveType,
      payload.fromDate,
      payload.toDate,
      session,
      days,
      payload.reason || null
    );
    const leave = rows[0];
    const [audience, hrUserIds, adminUserIds] = await Promise.all([
      this.getLeaveAudienceByEmployeeId(employee.id),
      this.getHrRecipients(),
      this.getHrmsAdminRecipients(),
    ]);
    await this.notifyHrms(
      'hrms_leave_submitted',
      userId,
      [audience.managerUserId, ...hrUserIds, ...adminUserIds],
      {
        leaveId: leave.id,
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        employeeName: audience.employeeName,
        leaveType: payload.leaveType,
        leaveRange: `${payload.fromDate} to ${payload.toDate}`,
      }
    );
    return leave;
  }

  async applyMyLeaveDirect(userId: string, payload: LeaveApplyInput) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    if (employee.roleName !== 'manager' && employee.roleName !== 'hr' && employee.roleName !== 'admin') {
      throw ApiError.forbidden(
        'Direct leave application is allowed only for manager, HR, and admin users',
        'DIRECT_LEAVE_RESTRICTED'
      );
    }
    const { days, session } = await this.validateLeaveRequest(employee.id, payload);

    // Submit as pending — manager leaves need HR/admin approval; HR leaves need admin approval
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      INSERT INTO leaves(employee_id, leave_type, from_date, to_date, session, days, reason, status)
      VALUES($1::uuid, $2, $3::date, $4::date, $5::leave_session, $6, $7, 'pending')
      RETURNING id, leave_type::text as "leaveType", from_date as "fromDate", to_date as "toDate", session::text as session, days, status::text as status
    `,
      employee.id,
      payload.leaveType,
      payload.fromDate,
      payload.toDate,
      session,
      days,
      payload.reason || null
    );
    const leave = rows[0];
    const [audience, hrUserIds, adminUserIds] = await Promise.all([
      this.getLeaveAudienceByEmployeeId(employee.id),
      this.getHrRecipients(),
      this.getHrmsAdminRecipients(),
    ]);

    // Manager leave → notify HR + admin for approval
    // Admin leave → notify HR + other admins for approval
    // HR leave → notify admin only for approval
    const notifyRecipients = employee.roleName === 'manager' || employee.roleName === 'admin'
      ? [...hrUserIds, ...adminUserIds]
      : [...adminUserIds];

    await this.notifyHrms(
      'hrms_leave_submitted',
      userId,
      notifyRecipients,
      {
        leaveId: leave.id,
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        employeeName: audience.employeeName,
        leaveType: payload.leaveType,
        leaveRange: `${payload.fromDate} to ${payload.toDate}`,
      }
    );
    return leave;
  }

  async listMyLeaves(userId: string, status?: string, year?: number) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, leave_type:: text as "leaveType", from_date as "fromDate", to_date as "toDate",
      session:: text as session, days, reason, status:: text as status, applied_at as "appliedAt"
      FROM leaves
      WHERE employee_id = $1:: uuid
        AND($2:: text IS NULL OR status:: text = $2)
        AND($3:: int IS NULL OR EXTRACT(YEAR FROM from_date) = $3)
      ORDER BY applied_at DESC
      `,
      employee.id,
      status || null,
      year || null
    );
  }

  async cancelMyLeave(userId: string, leaveId: string) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, status:: text as status, from_date as "fromDate"
      FROM leaves
      WHERE id = $1:: uuid AND employee_id = $2:: uuid
      LIMIT 1
      `,
      leaveId,
      employee.id
    );
    const leave = rows[0];
    if (!leave) throw ApiError.notFound('Leave not found', 'LEAVE_NOT_FOUND');
    if (leave.status === 'rejected' || leave.status === 'cancelled') {
      throw ApiError.unprocessable('Leave cannot be cancelled', 'INVALID_LEAVE_STATUS');
    }

    await prisma.$executeRawUnsafe(
      `UPDATE leaves SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1:: uuid`,
      leaveId
    );
    const [audience, hrUserIds, adminUserIds] = await Promise.all([
      this.getLeaveAudienceByEmployeeId(employee.id),
      this.getHrRecipients(),
      this.getHrmsAdminRecipients(),
    ]);
    await this.notifyHrms(
      'hrms_leave_cancelled',
      userId,
      [audience.managerUserId, ...hrUserIds, ...adminUserIds],
      {
        leaveId,
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        employeeName: audience.employeeName,
      }
    );
    return { leaveId, status: 'cancelled' };
  }

  async getMyLeaveBalance(userId: string, year?: number) {
    return this.getMyLeaveSummary(userId, year);
  }

  async getMyPayroll(userId: string, month?: number, year?: number) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, month, year, gross, deductions, net, status:: text as status, payslip_url as "payslipUrl", generated_at as "generatedAt"
      FROM payroll
      WHERE employee_id = $1:: uuid AND month = $2 AND year = $3
      LIMIT 1
      `,
      employee.id,
      m,
      y
    );
    if (!rows[0]) throw ApiError.notFound('Payroll not found', 'PAYROLL_NOT_FOUND');
    return rows[0];
  }

  async getOrgChartView(branchId?: string | null) {
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, employee_id as "employeeId", first_name as "firstName", last_name as "lastName",
      designation, department, manager_id as "managerId", status:: text as status
      FROM employees
      WHERE deleted_at IS NULL AND status IN('onboarding', 'active', 'notice_period')
        AND ($1::text IS NULL OR branch_id = $1)
      ORDER BY first_name ASC
      `,
      branchId ?? null
    );
  }

  async getManagerTeamEmployees(userId: string) {
    const current = await this.getCurrentEmployeeByUserId(userId);
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, employee_id as "employeeId", first_name as "firstName", last_name as "lastName",
      email, designation, department, status:: text as status, country, work_location as "workLocation"
      FROM employees
      WHERE manager_id = $1:: uuid AND deleted_at IS NULL
        AND ($2::text IS NULL OR branch_id = $2)
      ORDER BY first_name ASC
      `,
      current.id,
      current.branchId ?? null
    );
  }

  async getManagerTeamMemberDetail(userId: string, employeeId: string) {
    const current = await this.getCurrentEmployeeByUserId(userId);

    // Resolve to UUID — param may be UUID or employee_id code (e.g. "TM001")
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId);
    let resolvedUuid = employeeId;
    if (!isUuid) {
      const lookup = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM employees WHERE employee_id = $1 AND deleted_at IS NULL LIMIT 1`,
        employeeId
      );
      if (!lookup[0]) throw ApiError.notFound('Employee not found or not in your team', 'EMPLOYEE_NOT_FOUND');
      resolvedUuid = lookup[0].id;
    }

    // Verify the employee is a direct report of this manager
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
        ep.emergency_contact_name as "emergencyContactName",
        ep.emergency_contact_phone as "emergencyContactPhone",
        ep.emergency_contact_relation as "emergencyContactRelation",
        ep.current_address as "currentAddress",
        ep.permanent_address as "permanentAddress",
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
      WHERE e.id = $1::uuid AND e.manager_id = $2::uuid AND e.deleted_at IS NULL
      LIMIT 1
      `,
      resolvedUuid,
      current.id
    );

    if (!rows[0]) {
      throw ApiError.notFound('Employee not found or not in your team', 'EMPLOYEE_NOT_FOUND');
    }

    // Normalize avatar URLs so they use /uploads/ path (no auth needed for img tags)
    rows[0].avatarUrl = normalizeMediaUrl(rows[0].avatarUrl);
    if (rows[0]['manager.avatarUrl']) {
      rows[0]['manager.avatarUrl'] = normalizeMediaUrl(rows[0]['manager.avatarUrl']);
    }

    // Fetch current month attendance summary
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
          AND EXTRACT(DOW FROM a.date) NOT IN (0, 6)
          AND NOT EXISTS (
            SELECT 1 FROM holidays h WHERE h.date = a.date
          )
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
    const attendanceRate = workingDays > 0 ? Math.round((presentDays / workingDays) * 10000) / 100 : 0;

    const leaveSummary = await this.getEmployeeLeaveSummaryByEmployeeId(
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
      ...rows[0],
      currentMonthAttendance: {
        month: monthSummary.month,
        year: monthSummary.year,
        presentDays,
        workingDays,
        absentDays: Math.max(0, workingDays - presentDays),
        attendanceRate,
        display: `${presentDays}/${workingDays}`,
      },
      leaveBalance,
      directReports,
    };
  }

  async getManagerTeamAttendance(userId: string, month?: number, year?: number, date?: string) {
    const current = await this.getCurrentEmployeeByUserId(userId);

    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;

    let rows: any[];
    if (date) {
      // Single-day mode: filter by exact date
      rows = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT a.id, a.date, a.status::text as status, a.check_in_time as "checkInTime", a.check_out_time as "checkOutTime",
        e.id as "employee.id", e.employee_id as "employee.employeeId", e.first_name as "employee.firstName", e.last_name as "employee.lastName",
        e.designation as "employee.designation", e.department as "employee.department"
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        WHERE e.manager_id = $1::uuid
          AND a.date = $2::date
          AND ($3::text IS NULL OR e.branch_id = $3)
        ORDER BY e.first_name, e.last_name
        `,
        current.id,
        date,
        current.branchId ?? null
      );
    } else {
      rows = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT a.id, a.date, a.status::text as status, a.check_in_time as "checkInTime", a.check_out_time as "checkOutTime",
        e.id as "employee.id", e.employee_id as "employee.employeeId", e.first_name as "employee.firstName", e.last_name as "employee.lastName",
        e.designation as "employee.designation", e.department as "employee.department"
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        WHERE e.manager_id = $1::uuid
          AND EXTRACT(YEAR FROM a.date) = $2
          AND EXTRACT(MONTH FROM a.date) = $3
          AND ($4::text IS NULL OR e.branch_id = $4)
        ORDER BY a.date DESC
        `,
        current.id,
        y,
        m,
        current.branchId ?? null
      );
    }

    const items = rows.map(row => {
      const normalized = normalizeAttendanceTimestamps(row) as any;
      return {
        ...normalized,
        employee: {
          id: normalized['employee.id'] || null,
          employeeId: normalized['employee.employeeId'] || null,
          firstName: normalized['employee.firstName'] || null,
          lastName: normalized['employee.lastName'] || null,
          designation: normalized['employee.designation'] || null,
          department: normalized['employee.department'] || null,
        },
      };
    });
    return {
      month: m,
      year: y,
      items,
      cards: buildAttendanceCards(items),
    };
  }

  async getManagerPendingLeaves(userId: string) {
    const current = await this.getCurrentEmployeeByUserId(userId);
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT l.id, l.leave_type:: text as "leaveType", l.from_date as "fromDate", l.to_date as "toDate",
      l.days, l.reason, l.status:: text as status, l.applied_at as "appliedAt",
      e.id as "employee.id", e.employee_id as "employee.employeeId", e.first_name as "employee.firstName", e.last_name as "employee.lastName"
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      WHERE e.manager_id = $1:: uuid AND l.status = 'pending'
        AND ($2::text IS NULL OR e.branch_id = $2)
      ORDER BY l.applied_at ASC
      `,
      current.id,
      current.branchId ?? null
    );
    return rows.map(row => {
      const fullName = `${row['employee.firstName'] || ''} ${row['employee.lastName'] || ''}`.trim() || null;
      const appliedAtIso = row.appliedAt ? new Date(row.appliedAt).toISOString() : null;
      return {
        ...row,
        appliedAt: appliedAtIso,
        appliedAgo: toRelativeTime(appliedAtIso),
        appliedAtRelative: toRelativeTime(appliedAtIso),
        name: fullName,
        employeeName: fullName,
        employeeFirstName: row['employee.firstName'] || null,
        employeeLastName: row['employee.lastName'] || null,
        employeeId: row['employee.id'] || null,
        employeeCode: row['employee.employeeId'] || null,
        employee: {
          id: row['employee.id'] || null,
          employeeId: row['employee.employeeId'] || null,
          firstName: row['employee.firstName'] || null,
          lastName: row['employee.lastName'] || null,
          fullName,
          name: fullName,
        },
      };
    });
  }

  private async ensureManagerCanActOnLeave(userId: string, leaveId: string) {
    const current = await this.getCurrentEmployeeByUserId(userId);
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT l.id, l.status:: text as status
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      WHERE l.id = $1:: uuid
        AND e.manager_id = $2:: uuid
        AND ($3::text IS NULL OR e.branch_id = $3)
      LIMIT 1
      `,
      leaveId,
      current.id,
      current.branchId ?? null
    );
    const leave = rows[0];
    if (!leave) throw ApiError.notFound('Leave not found for your team', 'LEAVE_NOT_FOUND');
    if (leave.status !== 'pending') {
      throw ApiError.unprocessable('Only pending leave can be actioned', 'INVALID_LEAVE_STATUS');
    }
  }

  async managerApproveLeave(userId: string, leaveId: string) {
    await this.ensureManagerCanActOnLeave(userId, leaveId);
    await prisma.$executeRawUnsafe(
      `
      UPDATE leaves
      SET status = 'approved', approved_by = $2:: uuid, approved_at = NOW(), updated_at = NOW()
      WHERE id = $1:: uuid
      `,
      leaveId,
      userId
    );
    const leaveRows = await prisma.$queryRawUnsafe<Array<{ employee_id: string; employee_user_id: string | null; employee_name: string }>>(
      `
      SELECT e.id as employee_id, e.user_id as employee_user_id, CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as employee_name
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      WHERE l.id = $1:: uuid
      LIMIT 1
      `,
      leaveId
    );
    if (!leaveRows[0]) {
      throw ApiError.notFound('Leave not found', 'LEAVE_NOT_FOUND');
    }
    const [audience, hrUserIds, adminUserIds] = await Promise.all([
      this.getLeaveAudienceByEmployeeId(leaveRows[0].employee_id),
      this.getHrRecipients(),
      this.getHrmsAdminRecipients(),
    ]);
    await this.notifyHrms(
      'hrms_leave_approved',
      userId,
      [leaveRows[0]?.employee_user_id || null, audience.managerUserId, ...hrUserIds, ...adminUserIds],
      {
        leaveId,
        employeeName: audience.employeeName || leaveRows[0]?.employee_name?.trim() || 'Employee',
      }
    );
    return { leaveId, status: 'approved' };
  }

  async managerRejectLeave(userId: string, leaveId: string, reason: string) {
    await this.ensureManagerCanActOnLeave(userId, leaveId);
    await prisma.$executeRawUnsafe(
      `
      UPDATE leaves
      SET status = 'rejected', rejected_by = $2:: uuid, rejected_at = NOW(), rejection_reason = $3, updated_at = NOW()
      WHERE id = $1:: uuid
      `,
      leaveId,
      userId,
      reason
    );
    const leaveRows = await prisma.$queryRawUnsafe<Array<{ employee_id: string; employee_user_id: string | null; employee_name: string }>>(
      `
      SELECT e.id as employee_id, e.user_id as employee_user_id, CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as employee_name
      FROM leaves l
      JOIN employees e ON e.id = l.employee_id
      WHERE l.id = $1:: uuid
      LIMIT 1
      `,
      leaveId
    );
    if (!leaveRows[0]) {
      throw ApiError.notFound('Leave not found', 'LEAVE_NOT_FOUND');
    }
    const [audience, hrUserIds, adminUserIds] = await Promise.all([
      this.getLeaveAudienceByEmployeeId(leaveRows[0].employee_id),
      this.getHrRecipients(),
      this.getHrmsAdminRecipients(),
    ]);
    await this.notifyHrms(
      'hrms_leave_rejected',
      userId,
      [leaveRows[0]?.employee_user_id || null, audience.managerUserId, ...hrUserIds, ...adminUserIds],
      {
        leaveId,
        employeeName: audience.employeeName || leaveRows[0]?.employee_name?.trim() || 'Employee',
        reason,
      }
    );
    return { leaveId, status: 'rejected' };
  }

  async getManagerTeamOnboarding(userId: string) {
    const current = await this.getCurrentEmployeeByUserId(userId);
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT o.id, o.employee_id as "employeeId", o.status:: text as status, o.progress,
      e.employee_id as "employeeCode", e.first_name as "firstName", e.last_name as "lastName"
      FROM onboarding o
      JOIN employees e ON e.id = o.employee_id
      WHERE e.manager_id = $1:: uuid
        AND ($2::text IS NULL OR e.branch_id = $2)
      ORDER BY o.created_at DESC
      `,
      current.id,
      current.branchId ?? null
    );
  }

  async getManagerTeamOffboarding(userId: string) {
    const current = await this.getCurrentEmployeeByUserId(userId);
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT o.id, o.employee_id as "employeeId", o.status:: text as status, o.progress,
      o.last_working_day as "lastWorkingDay", o.exit_reason:: text as "exitReason",
      e.employee_id as "employeeCode", e.first_name as "firstName", e.last_name as "lastName"
      FROM offboarding o
      JOIN employees e ON e.id = o.employee_id
      WHERE e.manager_id = $1:: uuid
        AND ($2::text IS NULL OR e.branch_id = $2)
      ORDER BY o.created_at DESC
      `,
      current.id,
      current.branchId ?? null
    );
  }

  async exportManagerTeamAttendance(userId: string, month?: number, year?: number) {
    const data = await this.getManagerTeamAttendance(userId, month, year);
    const rows = data.items as Array<Record<string, unknown>>;
    const headers = ['date', 'status', 'checkInTime', 'checkOutTime'];
    return { ...data, csv: toCsv(headers, rows) };
  }

  // Dashboard Methods
  async getEmployeeDashboard(userId: string) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const dateOnly = toDateOnly(today);

    const [
      profileData,
      todayAttendance,
      monthAttendance,
      leaveBalance,
      recentLeaves,
      upcomingHolidays,
      attendanceTrend
    ] = await Promise.all([
      this.getMyProfile(userId),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT id, check_in_time as "checkInTime", check_out_time as "checkOutTime", status:: text as status
         FROM attendance WHERE employee_id = $1:: uuid AND date = $2:: date LIMIT 1`,
        employee.id,
        dateOnly
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT status:: text as status, COUNT(*) as count
         FROM attendance WHERE employee_id = $1:: uuid
         AND EXTRACT(YEAR FROM date) = $2 AND EXTRACT(MONTH FROM date) = $3
         GROUP BY status`,
        employee.id,
        currentYear,
        currentMonth
      ),
      this.getMyLeaveBalance(userId, currentYear),
      this.listMyLeaves(userId, undefined, currentYear),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, date, type:: text as type
         FROM holidays WHERE date >= $1:: date
         AND ($2::text IS NULL OR branch_id = $2)
         ORDER BY date ASC LIMIT 5`,
        dateOnly,
        employee.branchId || null
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', date), 'Mon') as month,
           EXTRACT(YEAR FROM date)::int as year,
           EXTRACT(MONTH FROM date)::int as month_num,
           COUNT(*) FILTER (WHERE status IN ('present','checked_in','incomplete','half_day')) as present,
           COUNT(*) FILTER (WHERE status = 'absent') as absent
         FROM attendance
         WHERE employee_id = $1::uuid
           AND date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
           AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
         GROUP BY DATE_TRUNC('month', date), EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
         ORDER BY year ASC, month_num ASC`,
        employee.id
      )
    ]);
    const todayAttendanceRow = todayAttendance[0] ? normalizeAttendanceTimestamps(todayAttendance[0]) : null;

    // Build a full 6-month array (fills missing months with 0)
    const trendMap = new Map<string, number>();
    attendanceTrend.forEach(r => {
      trendMap.set(`${r.year}-${String(r.month_num).padStart(2, '0')}`, Number(r.present || 0));
    });
    const trendData: { month: string; present: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short' });
      trendData.push({ month: label, present: trendMap.get(key) ?? 0 });
    }

    return {
      profile: profileData,
      attendance: {
        today: todayAttendanceRow,
        thisMonth: {
          present: Number(monthAttendance.find(a => a.status === 'present')?.count || 0),
          absent: Number(monthAttendance.find(a => a.status === 'absent')?.count || 0),
          incomplete: Number(monthAttendance.find(a => a.status === 'incomplete')?.count || 0),
        },
        trend: trendData,
      },
      leaves: {
        balance: leaveBalance,
        recent: recentLeaves.slice(0, 5)
      },
      holidays: {
        upcoming: upcomingHolidays
      }
    };
  }

  async getManagerDashboard(userId: string) {
    const employee = await this.getCurrentEmployeeByUserId(userId);
    const today = new Date();
    const dateOnly = toDateOnly(today);

    const [
      teamMembers,
      todayAttendance,
      pendingLeaves,
      todayAttendanceCount,
      teamOnboarding,
      teamOffboarding,
    ] = await Promise.all([
      this.getManagerTeamEmployees(userId),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT e.id, e.employee_id as "employeeId", e.first_name as "firstName", e.last_name as "lastName",
      a.status:: text as status, a.check_in_time as "checkInTime"
         FROM employees e
         LEFT JOIN attendance a ON a.employee_id = e.id AND a.date = $1:: date
         WHERE e.manager_id = $2:: uuid AND e.deleted_at IS NULL
           AND ($3::text IS NULL OR e.branch_id = $3)
         ORDER BY e.first_name ASC`,
        dateOnly,
        employee.id,
        employee.branchId ?? null
      ),
      this.getManagerPendingLeaves(userId),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as count FROM attendance a
         JOIN employees e ON e.id = a.employee_id
         WHERE e.manager_id = $1:: uuid AND a.date = $2:: date AND a.status IN('checked_in', 'present') AND e.status = 'active' AND e.deleted_at IS NULL
           AND ($3::text IS NULL OR e.branch_id = $3)`,
        employee.id,
        dateOnly,
        employee.branchId ?? null
      ),
      this.getManagerTeamOnboarding(userId),
      this.getManagerTeamOffboarding(userId),
    ]);
    const normalizedTodayAttendance = todayAttendance.map((row) => normalizeAttendanceTimestamps(row));

    const teamSize = Array.isArray(teamMembers) ? teamMembers.length : 0;
    const presentToday = Number(todayAttendanceCount[0]?.count || 0);

    return {
      team: {
        size: teamSize,
        presentToday,
        onLeaveToday: Math.max(0, teamSize - presentToday),
        members: teamMembers
      },
      attendance: {
        today: normalizedTodayAttendance
      },
      leaves: {
        pending: pendingLeaves
      },
      onboarding: teamOnboarding.filter(o => o.status === 'in_progress'),
      offboarding: teamOffboarding.filter(o => o.status === 'in_progress'),
    };
  }
}

export const workforceService = new WorkforceService();


