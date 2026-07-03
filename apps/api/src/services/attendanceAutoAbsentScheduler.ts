/**
 * Attendance Auto-Absent & Half-Day Scheduler
 *
 * Runs at 00:00 company-local time and classifies the PREVIOUS calendar day
 * for every active / notice-period employee.
 *
 * Classification rules (applied in order):
 * ─────────────────────────────────────────
 * 0. Non-working day (weekend / public holiday) → skip entirely.
 * 1. Employee is on approved leave for the target date → skip individually.
 * 2. No attendance record at all → insert absent.
 * 3. Record exists with status = checked_in / incomplete
 *    (employee checked in but never clocked out) → mark absent.
 * 4. Record exists with status = present AND work_hours < HALF_DAY_HOURS (default 4)
 *    → mark absent  (too short to count as any attendance).
 * 5. Record exists with status = present AND HALF_DAY_HOURS ≤ work_hours < FULL_DAY_HOURS (default 8)
 *    → mark half_day.
 * 6. Record exists with status = present AND work_hours ≥ FULL_DAY_HOURS → no change (stays present).
 *
 * Thresholds are configurable via environment variables:
 *   FULL_DAY_HOURS  (default: 9)  – minimum hours for "present"
 *   HALF_DAY_HOURS  (default: 4)  – minimum hours for "half_day"; below this → absent
 */

import { prisma } from '../database/prisma';
import { withDistributedLock } from '../utils/distributedLock';
import { logger } from '../utils/logger';

// Use IANA timezone name (handles DST automatically). Falls back to legacy offset env var.
const COMPANY_TIMEZONE = process.env.COMPANY_TIMEZONE || 'Asia/Kolkata';

// Configurable hour thresholds (read once at startup)
const FULL_DAY_HOURS = Number(process.env.FULL_DAY_HOURS ?? 9);  // ≥ this → present (no change)
const HALF_DAY_HOURS = Number(process.env.HALF_DAY_HOURS ?? 4);  // ≥ this & < FULL_DAY → half_day

function pad2(v: number): string {
  return String(v).padStart(2, '0');
}

/** Get current date/time parts in the company timezone using built-in Intl API */
function getCompanyTimeParts(input: Date): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: COMPANY_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  }).formatToParts(input);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

function toDateOnly(input: Date): string {
  const p = getCompanyTimeParts(input);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function shiftDateOnly(dateOnly: string, deltaDays: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(base.getUTCDate())}`;
}

// ─── Eligible employee CTE (reused in every query) ────────────────────────────
// Selects active/notice-period employees who were employed on the target date
// and are NOT on approved leave for that date.
const ELIGIBLE_CTE = `
  WITH eligible_employees AS (
    SELECT e.id
    FROM   employees e
    WHERE  e.status IN ('active', 'notice_period')
      AND  e.deleted_at IS NULL
      AND  e.joining_date <= $1::date
      AND  (e.exit_date IS NULL OR e.exit_date >= $1::date)
      AND  NOT EXISTS (
             SELECT 1
             FROM   leaves l
             WHERE  l.employee_id = e.id
               AND  l.status = 'approved'
               AND  $1::date BETWEEN l.from_date AND l.to_date
           )
  )
`;

// ─── On-leave employee CTE ─────────────────────────────────────────────────────
// Selects employees who are on approved leave for the target date (opposite of ELIGIBLE_CTE).
const ON_LEAVE_CTE = `
  WITH on_leave_employees AS (
    SELECT e.id AS employee_id, l.id AS leave_id
    FROM   employees e
    JOIN   leaves l ON l.employee_id = e.id
    WHERE  e.status IN ('active', 'notice_period')
      AND  e.deleted_at IS NULL
      AND  e.joining_date <= $1::date
      AND  (e.exit_date IS NULL OR e.exit_date >= $1::date)
      AND  l.status = 'approved'
      AND  $1::date BETWEEN l.from_date AND l.to_date
  )
`;

class AttendanceAutoAbsentScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private lastRunCompanyDate: string | null = null;
  private readonly checkIntervalMs: number;

  constructor(checkIntervalMinutes = 1) {
    this.checkIntervalMs = checkIntervalMinutes * 60 * 1000;
  }

  start(): void {
    if (this.intervalId) {
      logger.info('Attendance auto-absent scheduler is already running');
      return;
    }

    logger.info(
      `Starting attendance auto-absent scheduler ` +
      `(check interval: ${this.checkIntervalMs / 60000} min, ` +
      `full-day ≥ ${FULL_DAY_HOURS}h, half-day ≥ ${HALF_DAY_HOURS}h)`
    );

    void this.tick();

    this.intervalId = setInterval(() => {
      void this.tick();
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Attendance auto-absent scheduler stopped');
    }
  }

  private async tick(): Promise<void> {
    const now = new Date();
    const companyParts = getCompanyTimeParts(now);
    const companyHour = companyParts.hour;
    const companyDate = toDateOnly(now);

    // Run once per day when company-local time hits 00:xx
    if (companyHour !== 0 || this.lastRunCompanyDate === companyDate) {
      return;
    }

    const targetDate = shiftDateOnly(companyDate, -1);

    // Acquire distributed lock (TTL = 10 minutes) to prevent duplicate processing
    const result = await withDistributedLock(`scheduler:attendance:${companyDate}`, 600, async () => {
      await this.processForDate(targetDate);
    });

    if (result === null) {
      logger.debug('Attendance auto-absent skipped – another instance holds the lock');
    }

    this.lastRunCompanyDate = companyDate;
  }

  /**
   * Public entry-point so the route handler (or tests) can trigger a dry-run
   * for a specific date without waiting for midnight.
   */
  async processForDate(targetDate: string): Promise<{
    targetDate: string;
    insertedOnLeaveRows: number;
    updatedOpenCheckIns: number;
    markedAbsentShortHours: number;
    markedHalfDay: number;
    insertedAbsentRows: number;
    autoLopAbsent: number;
    autoLopHalfDay: number;
    skipped: boolean;
  }> {
    if (this.isProcessing) {
      logger.debug('Attendance scheduler already processing – skipping this trigger');
      return {
        targetDate,
        insertedOnLeaveRows: 0,
        updatedOpenCheckIns: 0,
        markedAbsentShortHours: 0,
        markedHalfDay: 0,
        insertedAbsentRows: 0,
        autoLopAbsent: 0,
        autoLopHalfDay: 0,
        skipped: true,
      };
    }

    this.isProcessing = true;
    try {

      // ── Step 0: Skip non-working days ────────────────────────────────────
      const workingDayRows = await prisma.$queryRawUnsafe<Array<{ isWorkingDay: boolean }>>(
        `SELECT
           CASE
             WHEN EXTRACT(DOW FROM $1::date) IN (0, 6) THEN false
             WHEN EXISTS (SELECT 1 FROM holidays h WHERE h.date = $1::date) THEN false
             ELSE true
           END AS "isWorkingDay"`,
        targetDate
      );

      const isWorkingDay = workingDayRows[0]?.isWorkingDay ?? false;
      if (!isWorkingDay) {
        logger.info(`Attendance scheduler skipped for ${targetDate} (weekend or holiday)`);
        return {
          targetDate,
          insertedOnLeaveRows: 0,
          updatedOpenCheckIns: 0,
          markedAbsentShortHours: 0,
          markedHalfDay: 0,
          insertedAbsentRows: 0,
          autoLopAbsent: 0,
          autoLopHalfDay: 0,
          skipped: true,
        };
      }

      // ── Step 0b: Insert/upsert on_leave rows for employees on approved leave ──
      // Ensures every working day has an attendance row for on-leave employees,
      // and populates the leave_id FK. Will not overwrite an existing present/half_day record.
      const onLeaveRows = await prisma.$queryRawUnsafe<Array<{ employeeId: string }>>(
        `${ON_LEAVE_CTE}
         INSERT INTO attendance (employee_id, date, status, leave_id, created_at, updated_at)
         SELECT ole.employee_id, $1::date, 'on_leave'::attendance_status, ole.leave_id, NOW(), NOW()
         FROM   on_leave_employees ole
         ON CONFLICT (employee_id, date)
         DO UPDATE SET
           status     = 'on_leave'::attendance_status,
           leave_id   = EXCLUDED.leave_id,
           updated_at = NOW()
         WHERE attendance.status NOT IN ('present', 'half_day')
         RETURNING employee_id AS "employeeId"`,
        targetDate
      );

      // ── Step 1a: Reconcile work_hours from attendance_logs for all records that
      //            have at least one clock_in/clock_out pair. This handles multi-session
      //            clock-in/clock-out: the last clock_out is the final checkout time, and
      //            work_hours is the sum of all completed sessions.
      await prisma.$queryRawUnsafe(
        `UPDATE attendance a
         SET check_out_time = sub.last_clock_out,
             work_hours     = sub.total_hours,
             status         = 'present',
             updated_at     = NOW()
         FROM (
           WITH ordered_logs AS (
             SELECT al.attendance_id,
                    al.type,
                    al.logged_at,
                    ROW_NUMBER() OVER (PARTITION BY al.attendance_id ORDER BY al.logged_at) AS rn
             FROM attendance_logs al
             JOIN attendance a2 ON a2.id = al.attendance_id AND a2.date = $1::date
           ),
           pairs AS (
             SELECT ci.attendance_id,
                    ci.logged_at AS cin,
                    co.logged_at AS cout
             FROM ordered_logs ci
             JOIN ordered_logs co ON co.attendance_id = ci.attendance_id AND co.rn = ci.rn + 1
             WHERE ci.type = 'clock_in' AND co.type = 'clock_out'
           ),
           agg AS (
             SELECT attendance_id,
                    MAX(cout) AS last_clock_out,
                    SUM(EXTRACT(EPOCH FROM (cout - cin)) / 3600) AS total_hours
             FROM pairs
             GROUP BY attendance_id
           )
           SELECT * FROM agg
         ) sub
         WHERE a.id = sub.attendance_id`,
        targetDate
      );

      // ── Step 1b: checked_in / incomplete with NO completed log pairs → absent ─
      // These employees clocked in but never clocked out (no clock_out log exists).
      const openCheckInRows = await prisma.$queryRawUnsafe<Array<{ employeeId: string }>>(
        `${ELIGIBLE_CTE}
         UPDATE attendance a
         SET    status     = 'absent',
                updated_at = NOW()
         FROM   eligible_employees ee
         WHERE  a.employee_id = ee.id
           AND  a.date   = $1::date
           AND  a.status IN ('checked_in', 'incomplete')
           AND  NOT EXISTS (
                  SELECT 1 FROM attendance_logs al
                  WHERE al.attendance_id = a.id AND al.type = 'clock_out'
                )
         RETURNING a.employee_id AS "employeeId"`,
        targetDate
      );

      // ── Step 2: present, work_hours < HALF_DAY_HOURS → absent ────────────
      // Employees who clocked out but worked fewer than the half-day minimum
      // (default 4 h) are marked absent – not enough attendance to count.
      const shortHoursAbsentRows = await prisma.$queryRawUnsafe<Array<{ employeeId: string }>>(
        `${ELIGIBLE_CTE}
         UPDATE attendance a
         SET    status     = 'absent',
                updated_at = NOW()
         FROM   eligible_employees ee
         WHERE  a.employee_id = ee.id
           AND  a.date      = $1::date
           AND  a.status    = 'present'
           AND  (a.work_hours IS NULL OR a.work_hours < $2)
         RETURNING a.employee_id AS "employeeId"`,
        targetDate,
        HALF_DAY_HOURS
      );

      // ── Step 3: present, HALF_DAY_HOURS ≤ work_hours < FULL_DAY_HOURS → half_day ──
      // Employees who clocked out with partial attendance get half_day.
      const halfDayRows = await prisma.$queryRawUnsafe<Array<{ employeeId: string }>>(
        `${ELIGIBLE_CTE}
         UPDATE attendance a
         SET    status     = 'half_day',
                updated_at = NOW()
         FROM   eligible_employees ee
         WHERE  a.employee_id = ee.id
           AND  a.date       = $1::date
           AND  a.status     = 'present'
           AND  a.work_hours >= $2
           AND  a.work_hours  < $3
         RETURNING a.employee_id AS "employeeId"`,
        targetDate,
        HALF_DAY_HOURS,
        FULL_DAY_HOURS
      );

      // ── Step 4: no record at all → insert absent ─────────────────────────
      // Employees with absolutely no attendance row for the target date
      // (never clocked in) get a fresh absent record.
      const insertedRows = await prisma.$queryRawUnsafe<Array<{ employeeId: string }>>(
        `${ELIGIBLE_CTE}
         INSERT INTO attendance (employee_id, date, status, created_at, updated_at)
         SELECT ee.id, $1::date, 'absent', NOW(), NOW()
         FROM   eligible_employees ee
         ON CONFLICT (employee_id, date) DO NOTHING
         RETURNING employee_id AS "employeeId"`,
        targetDate
      );

      // ── Step 5: Auto-LOP deduction ───────────────────────────────────────────
      // Insert an approved LOP leave for each employee marked absent or half_day.
      // is_auto_lop = true flags these as system-generated so regularization can reverse them.
      // The partial unique index (employee_id, from_date) WHERE is_auto_lop=true
      // combined with ON CONFLICT DO NOTHING ensures idempotency.
      const allAbsentIds = [
        ...new Set([
          ...openCheckInRows.map((r: { employeeId: string }) => r.employeeId),
          ...shortHoursAbsentRows.map((r: { employeeId: string }) => r.employeeId),
          ...insertedRows.map((r: { employeeId: string }) => r.employeeId),
        ]),
      ];
      const halfDayIds = [...new Set(halfDayRows.map((r: { employeeId: string }) => r.employeeId))];
      // Remove any half_day employees from absent list (edge-case dedup)
      const absentOnlyIds = allAbsentIds.filter(id => !halfDayIds.includes(id));

      if (absentOnlyIds.length > 0) {
        await prisma.$queryRawUnsafe(
          `INSERT INTO leaves
             (employee_id, leave_type, from_date, to_date, session, days, reason,
              status, is_auto_lop, applied_at, approved_at, created_at, updated_at)
           SELECT unnest($2::uuid[]), 'lop', $1::date, $1::date,
                  'full_day'::leave_session, 1.00,
                  'Auto-deducted: absent on working day',
                  'approved'::leave_status, true,
                  NOW(), NOW(), NOW(), NOW()
           ON CONFLICT DO NOTHING`,
          targetDate,
          absentOnlyIds
        );
      }

      if (halfDayIds.length > 0) {
        await prisma.$queryRawUnsafe(
          `INSERT INTO leaves
             (employee_id, leave_type, from_date, to_date, session, days, reason,
              status, is_auto_lop, applied_at, approved_at, created_at, updated_at)
           SELECT unnest($2::uuid[]), 'lop', $1::date, $1::date,
                  'full_day'::leave_session, 0.50,
                  'Auto-deducted: half-day attendance on working day',
                  'approved'::leave_status, true,
                  NOW(), NOW(), NOW(), NOW()
           ON CONFLICT DO NOTHING`,
          targetDate,
          halfDayIds
        );
      }

      const summary = {
        targetDate,
        insertedOnLeaveRows:    onLeaveRows.length,
        updatedOpenCheckIns:    openCheckInRows.length,
        markedAbsentShortHours: shortHoursAbsentRows.length,
        markedHalfDay:          halfDayRows.length,
        insertedAbsentRows:     insertedRows.length,
        autoLopAbsent:          absentOnlyIds.length,
        autoLopHalfDay:         halfDayIds.length,
        skipped:                false,
      };

      logger.info(
        `Attendance scheduler done for ${targetDate}: ` +
        `${summary.insertedOnLeaveRows} on_leave rows | ` +
        `${summary.updatedOpenCheckIns} open check-ins → absent | ` +
        `${summary.markedAbsentShortHours} short-hours → absent | ` +
        `${summary.markedHalfDay} → half_day | ` +
        `${summary.insertedAbsentRows} new absent rows | ` +
        `auto-LOP: ${summary.autoLopAbsent} absent, ${summary.autoLopHalfDay} half_day`
      );

      return summary;
    } catch (error) {
      logger.error(`Attendance scheduler failed for ${targetDate}:`, error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
}

export const attendanceAutoAbsentScheduler = new AttendanceAutoAbsentScheduler();
export { AttendanceAutoAbsentScheduler };
