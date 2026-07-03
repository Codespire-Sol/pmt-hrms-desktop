import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute IST date string "YYYY-MM-DD" from a UTC Date */
function toISTDateOnly(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

/** Return IST datetime as a naive ISO string "YYYY-MM-DDTHH:mm:ss.sss"
 *  (no timezone suffix) so it stores correctly in timestamp without time zone columns,
 *  matching how manual check-ins are stored.
 */
function toISTNaiveIso(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().replace('Z', '');
}

/** Find employee by biometric_device_id (strips leading zeros) */
async function findEmployeeByPin(pin: string): Promise<{ id: string } | null> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM employees
     WHERE LTRIM(biometric_device_id, '0') = LTRIM($1, '0')
       AND biometric_device_id IS NOT NULL
       AND deleted_at IS NULL
     LIMIT 1`,
    pin
  );
  return rows.length ? rows[0] : null;
}

// In-memory dedup cache: "userId|ioTime" → timestamp first seen
// Prevents duplicate processing when Realtime Cloud sends the same punch twice.
// DB ON CONFLICT also provides a safety net.
const seenPunches: Map<string, number> = new Map();
const SEEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isPunchSeen(userId: string, ioTime: string): boolean {
  const key = `${userId}|${ioTime}`;
  const ts = seenPunches.get(key);
  if (ts && Date.now() - ts < SEEN_TTL_MS) return true;
  seenPunches.set(key, Date.now());
  if (seenPunches.size > 1000) {
    const cutoff = Date.now() - SEEN_TTL_MS;
    for (const [k, t] of seenPunches) if (t < cutoff) seenPunches.delete(k);
  }
  return false;
}

/**
 * Upsert a biometric punch into attendance + attendance_logs.
 *
 * Logic:
 * - First punch of the day → check_in_time, status=checked_in, log type=clock_in
 * - Subsequent punches → update check_out_time to the latest punch,
 *   status=present if gap from check_in >= 1 hour
 */
async function upsertBiometricPunch(employeeId: string, punchIso: string, dateOnly: string, pin: string, source: 'biometric' | 'simulate' = 'biometric'): Promise<void> {
  // PrismaPg bug: appends +00:00 to "timestamp without tz" values, misinterpreting
  // IST as UTC. Return check_in_time as pre-formatted UTC text to bypass this.
  const attRows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO attendance (employee_id, date, check_in_time, status)
     VALUES ($1::uuid, $2::date, $3::timestamptz, 'checked_in')
     ON CONFLICT (employee_id, date) DO UPDATE
       SET check_in_time = LEAST(attendance.check_in_time, EXCLUDED.check_in_time),
           updated_at = NOW()
     RETURNING id,
       to_char(check_in_time::timestamptz AT TIME ZONE 'UTC',
               'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS check_in_utc`,
    employeeId, dateOnly, punchIso
  );

  const attendanceId = attRows[0].id;
  const checkInTime = new Date(attRows[0].check_in_utc);
  const punchTime = new Date(punchIso);
  const gapSeconds = (punchTime.getTime() - checkInTime.getTime()) / 1000;

  // Insert clock_in or clock_out log depending on gap
  const logType = gapSeconds >= 2 ? 'clock_out' : 'clock_in';
  await prisma.$queryRawUnsafe(
    `INSERT INTO attendance_logs (attendance_id, employee_id, date, type, logged_at, source, device_user_id)
     VALUES ($1::uuid, $2::uuid, $3::date, $4, $5::timestamptz, $6, $7)
     ON CONFLICT (employee_id, logged_at, type, source) DO NOTHING`,
    attendanceId, employeeId, dateOnly, logType, punchIso, source, pin
  );

  // If punch is later than check_in by >= 2 seconds, update check_out
  if (gapSeconds >= 2) {
    const fullDayHours = Number(process.env.FULL_DAY_HOURS ?? 9);
    const halfDayHours = Number(process.env.HALF_DAY_HOURS ?? 4);
    const workHours = gapSeconds / 3600;
    const status = workHours >= fullDayHours ? 'present'
      : workHours >= halfDayHours ? 'half_day'
      : 'checked_in';
    await prisma.$queryRawUnsafe(
      `UPDATE attendance
       SET check_out_time = GREATEST(COALESCE(check_out_time, $3::timestamptz), $3::timestamptz),
           status = CASE
             WHEN status = 'present'::attendance_status THEN 'present'::attendance_status
             WHEN status = 'half_day'::attendance_status AND $4::attendance_status = 'checked_in'::attendance_status THEN 'half_day'::attendance_status
             ELSE $4::attendance_status
           END,
           work_hours = ROUND(
             EXTRACT(EPOCH FROM ($3::timestamptz - check_in_time)) / 3600, 2),
           updated_at = NOW()
       WHERE id = $1::uuid
         AND date = $2::date
         AND ($3::timestamptz AT TIME ZONE 'Asia/Kolkata')::date = $2::date`,
      attendanceId, dateOnly, punchIso, status
    );
  }
}

// ─── Realtime Cloud Third-Party API push ─────────────────────────────────────

/**
 * POST /api/v1/biometric/realtime-push
 *
 * Receives punch events from Realtime Cloud's "Parallel Data Export" feature.
 *
 * Body: {
 *   "employee_code": "00000002",
 *   "log_datetime": "2026-03-13 09:04:00",  // IST
 *   "log_time": "09:04:00",
 *   "device_sn": "RSS202506119224",
 *   "downloaded_at": "2026-03-13 09:04:05"  // optional
 * }
 */
export async function realtimeCloudPush(req: Request, res: Response) {
  try {
    const body = req.body as Record<string, any>;
    const employeeCode: string = String(body.employee_code ?? '').trim();
    const logDatetime: string = String(body.log_datetime ?? '').trim();
    const deviceSn: string = String(body.device_sn ?? '').trim();

    if (!employeeCode || !logDatetime) {
      res.status(400).json({ success: false, message: 'employee_code and log_datetime are required' });
      return;
    }

    // Parse "YYYY-MM-DD HH:mm:ss" as IST
    const punchTime = new Date(logDatetime.replace(' ', 'T') + '+05:30');
    if (isNaN(punchTime.getTime())) {
      res.status(400).json({ success: false, message: `Invalid log_datetime: "${logDatetime}"` });
      return;
    }

    // Dedup: skip if this exact punch was already seen recently
    const ioTimeCompact = logDatetime.replace(/[-: ]/g, '');
    if (isPunchSeen(employeeCode, ioTimeCompact)) {
      res.json({ success: true, message: 'duplicate, already processed' });
      return;
    }

    const dateOnly = toISTDateOnly(punchTime);
    const punchIso = toISTNaiveIso(punchTime);

    const emp = await findEmployeeByPin(employeeCode);
    if (!emp) {
      console.warn(`[RealtimeCloud] UNMAPPED employee_code="${employeeCode}" device_sn=${deviceSn}`);
      res.status(404).json({ success: false, message: `No employee mapped to code "${employeeCode}"` });
      return;
    }

    await upsertBiometricPunch(emp.id, punchIso, dateOnly, employeeCode);

    const istStr = punchTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`[RealtimeCloud] Punch recorded — code=${employeeCode}, time=${istStr}, device=${deviceSn}`);

    res.json({ success: true, message: 'Punch recorded' });
  } catch (err: any) {
    console.error(`[RealtimeCloud] Error:`, err.message);
    res.status(500).json({ success: false, message: 'Internal error processing punch' });
  }
}

// ─── Data endpoints ───────────────────────────────────────────────────────────

/** GET /api/v1/biometric/push-logs — first check-in & last check-out per employee per day
 *  Query params:
 *    date  = YYYY-MM-DD  → show only that specific date
 *    from  = YYYY-MM-DD  → range start (default: 30 days ago)
 *    to    = YYYY-MM-DD  → range end   (default: today)
 */
export async function getPushLogs(req: Request, res: Response) {
  const { date, from, to } = req.query as { date?: string; from?: string; to?: string };

  let fromDate: string;
  let toDate: string;

  if (date) {
    // Show only the specific date
    fromDate = date;
    toDate = date;
  } else {
    fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    toDate   = to   || new Date().toISOString().slice(0, 10);
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       a.date,
       e.employee_id         AS "employeeCode",
       e.biometric_device_id AS "deviceUserId",
       e.first_name || ' ' || COALESCE(e.last_name, '') AS "employeeName",
       to_char(a.check_in_time::timestamptz AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS')  AS "firstPunch",
       to_char(a.check_out_time::timestamptz AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS') AS "lastPunch",
       a.work_hours  AS "workHours",
       a.status
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     WHERE e.biometric_device_id IS NOT NULL
       AND a.check_in_time IS NOT NULL
       AND a.date >= $1::date
       AND a.date <= $2::date
     ORDER BY a.date DESC, e.employee_id`,
    fromDate, toDate
  );
  res.json({ success: true, data: rows });
}

/** GET /api/v1/biometric/punch-logs — every individual punch from attendance_logs
 *  Query params: same as push-logs (date / from / to)
 */
export async function getPunchLogs(req: Request, res: Response) {
  const { date, from, to } = req.query as { date?: string; from?: string; to?: string };

  let fromDate: string;
  let toDate: string;

  if (date) {
    fromDate = date;
    toDate = date;
  } else {
    fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    toDate   = to   || new Date().toISOString().slice(0, 10);
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       al.id,
       al.date,
       al.type             AS "punchType",
       to_char(al.logged_at::timestamptz AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS') AS "loggedAt",
       al.device_user_id   AS "deviceUserId",
       al.source,
       e.employee_id       AS "employeeCode",
       e.first_name || ' ' || COALESCE(e.last_name, '') AS "employeeName"
     FROM attendance_logs al
     JOIN employees e ON e.id = al.employee_id
     WHERE al.source IN ('biometric', 'biometric_cron', 'simulate')
       AND al.date >= $1::date
       AND al.date <= $2::date
     ORDER BY al.logged_at DESC
     LIMIT 500`,
    fromDate, toDate
  );
  res.json({ success: true, data: rows });
}

/** POST /api/v1/biometric/simulate — inject a test punch */
export async function simulatePunch(req: Request, res: Response) {
  const { deviceUserId, isoTime } = req.body as { deviceUserId: string; isoTime?: string };

  if (!deviceUserId) {
    res.status(400).json({ success: false, message: 'deviceUserId is required' });
    return;
  }

  const punchTime = isoTime ? new Date(isoTime) : new Date();
  if (isNaN(punchTime.getTime())) {
    res.status(400).json({ success: false, message: 'Invalid isoTime' });
    return;
  }

  const dateOnly = toISTDateOnly(punchTime);
  const punchIso = toISTNaiveIso(punchTime);

  const empRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, employee_id, first_name, last_name FROM employees
     WHERE LTRIM(biometric_device_id, '0') = LTRIM($1, '0')
       AND biometric_device_id IS NOT NULL
       AND deleted_at IS NULL
     LIMIT 1`,
    String(deviceUserId)
  );

  if (!empRows.length) {
    res.status(404).json({ success: false, message: `No employee mapped to deviceUserId="${deviceUserId}"` });
    return;
  }

  const emp = empRows[0];
  await upsertBiometricPunch(emp.id, punchIso, dateOnly, String(deviceUserId), 'simulate');

  const istTime = punchTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  res.json({
    success: true,
    punchType: 'clock_in',
    date: dateOnly,
    employee: { id: emp.id, code: emp.employee_id, name: `${emp.first_name} ${emp.last_name}` },
    loggedAt: punchIso,
    istTime,
  });
}

// ─── Device-Employee Mapping endpoints ───────────────────────────────────────

/** GET /api/v1/biometric/mappings */
export async function getMappings(_req: Request, res: Response) {
  const mappings = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, employee_id AS "employeeCode",
            first_name || ' ' || COALESCE(last_name, '') AS "employeeName",
            email, biometric_device_id AS "deviceId"
     FROM employees
     WHERE deleted_at IS NULL
     ORDER BY biometric_device_id IS NULL, biometric_device_id::text, first_name`
  );
  res.json({ success: true, data: mappings });
}

/** POST /api/v1/biometric/mappings */
export async function upsertMapping(req: Request, res: Response) {
  const { employeeId, deviceId } = req.body as { employeeId: string; deviceId: string };

  if (!employeeId || !deviceId) {
    res.status(400).json({ success: false, message: 'employeeId and deviceId are required' });
    return;
  }

  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, employee_id, first_name, last_name FROM employees
     WHERE LTRIM(biometric_device_id, '0') = LTRIM($1, '0')
       AND biometric_device_id IS NOT NULL
       AND id != $2::uuid
       AND deleted_at IS NULL
     LIMIT 1`,
    String(deviceId), employeeId
  );

  if (existing.length) {
    res.status(409).json({
      success: false,
      message: `Device ID ${deviceId} is already mapped to ${existing[0].first_name} ${existing[0].last_name} (${existing[0].employee_id})`,
    });
    return;
  }

  await prisma.$queryRawUnsafe(
    `UPDATE employees SET biometric_device_id = $1, updated_at = NOW() WHERE id = $2::uuid AND deleted_at IS NULL`,
    String(deviceId), employeeId
  );

  res.json({ success: true, message: `Device ID ${deviceId} mapped successfully` });
}

/** DELETE /api/v1/biometric/mappings/:employeeId */
export async function deleteMapping(req: Request, res: Response) {
  const { employeeId } = req.params;
  await prisma.$queryRawUnsafe(
    `UPDATE employees SET biometric_device_id = NULL, updated_at = NOW() WHERE id = $1::uuid AND deleted_at IS NULL`,
    employeeId
  );
  res.json({ success: true, message: 'Mapping removed' });
}

// ─── Bulk import from desktop software ──────────────────────────────────────

/**
 * POST /api/v1/biometric/import
 *
 * Accepts tab/space-separated punch data exported from AttendanceTracker.
 * Each line: <sno> <deviceUserId> <date YYYY-MM-DD> <time HH:mm:ss> [...]
 *
 * Body: { data: string }
 */
export async function bulkImportPunches(req: Request, res: Response) {
  const { data } = req.body as { data?: string };
  if (!data || typeof data !== 'string') {
    res.status(400).json({ success: false, message: 'data (tab-separated text) is required' });
    return;
  }

  const lines = data.split('\n').map(l => l.trim()).filter(Boolean);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const unmapped = new Set<string>();

  for (const line of lines) {
    const parts = line.split(/\t+/).map(s => s.trim()).filter(Boolean);
    if (parts.length < 4) {
      const spaceParts = line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
      if (spaceParts.length >= 4) {
        parts.length = 0;
        parts.push(...spaceParts);
      }
    }

    if (parts.length < 4) { skipped++; continue; }

    const deviceUserId = parts[1];
    const dateStr = parts[2];
    const timeStr = parts[3];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
      skipped++;
      continue;
    }

    const punchTime = new Date(`${dateStr}T${timeStr}+05:30`);
    if (isNaN(punchTime.getTime())) { skipped++; continue; }

    const emp = await findEmployeeByPin(deviceUserId);
    if (!emp) { unmapped.add(deviceUserId); skipped++; continue; }

    try {
      await upsertBiometricPunch(emp.id, toISTNaiveIso(punchTime), dateStr, deviceUserId);
      imported++;
    } catch (err: any) {
      errors.push(`Line "${line.slice(0, 60)}": ${err.message}`);
    }
  }

  console.log(`[BulkImport] Imported ${imported}, skipped ${skipped}, errors ${errors.length}`);
  res.json({
    success: true,
    imported,
    skipped,
    total: lines.length,
    unmappedDeviceIds: Array.from(unmapped),
    errors: errors.slice(0, 10),
  });
}
