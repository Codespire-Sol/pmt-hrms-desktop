/**
 * Email templates for the 4 scheduled email types.
 * All return full HTML strings ready to pass to emailService.sendEmail().
 */

const BASE_STYLE = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .wrapper { max-width: 700px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #1a1a2e; color: #fff; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .header p  { margin: 6px 0 0; font-size: 14px; color: #aaa; }
    .body { padding: 28px 32px; }
    .section-title { font-size: 16px; font-weight: 700; color: #1a1a2e; margin: 24px 0 12px; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f8f8f8; padding: 10px 12px; text-align: left; color: #555; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; color: #333; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-present  { background: #d1fae5; color: #065f46; }
    .badge-absent   { background: #fee2e2; color: #991b1b; }
    .badge-leave    { background: #fef3c7; color: #92400e; }
    .badge-half     { background: #dbeafe; color: #1d4ed8; }
    .badge-holiday  { background: #f3f4f6; color: #374151; }
    .badge-late     { background: #ffedd5; color: #c2410c; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
    .stat-card { background: #f8f9ff; border-radius: 10px; padding: 16px; text-align: center; }
    .stat-card .num { font-size: 28px; font-weight: 800; color: #1a1a2e; }
    .stat-card .lbl { font-size: 12px; color: #888; margin-top: 4px; }
    .footer { background: #f8f8f8; padding: 16px 32px; text-align: center; font-size: 12px; color: #aaa; }
    .no-data { color: #aaa; font-size: 13px; padding: 16px 0; }
    .user-row { margin-bottom: 20px; background: #fafafa; border-radius: 8px; overflow: hidden; }
    .user-row .name { font-weight: 700; font-size: 14px; color: #1a1a2e; padding: 10px 14px; background: #f0f0f8; }
  </style>
`;

function footer(): string {
  return `
    <div class="footer">
      This is an automated email from <strong>ProjectFlow</strong>. Do not reply.<br/>
      Sent at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
    </div>
  `;
}

// ─── 1. Daily PMT (5:30 PM IST) ─────────────────────────────────────────────

interface DailyPMTUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  timeLogs: Array<{
    hours: any;
    description: string | null;
    issue: { title: string; project: { name: string } };
  }>;
}

function dailyPMT({ users, date }: { users: DailyPMTUser[]; date: string }): string {
  const activeUsers = users.filter(u => u.timeLogs.length > 0);

  const rows = activeUsers.map(u => {
    const total = u.timeLogs.reduce((s, l) => s + parseFloat(l.hours), 0);
    const logRows = u.timeLogs.map(l => `
      <tr>
        <td style="padding-left:24px;color:#666">${l.issue.project.name}</td>
        <td>${l.issue.title}</td>
        <td style="color:#555">${l.description || '—'}</td>
        <td style="text-align:right;font-weight:600">${parseFloat(l.hours).toFixed(2)} h</td>
      </tr>
    `).join('');

    return `
      <div class="user-row">
        <div class="name">${u.firstName} ${u.lastName} <span style="font-weight:400;color:#888;font-size:12px">${u.email}</span> &nbsp;·&nbsp; <span style="color:#4f46e5">${total.toFixed(2)} hrs total</span></div>
        <table>
          <thead><tr><th>Project</th><th>Issue</th><th>Description</th><th style="text-align:right">Hours</th></tr></thead>
          <tbody>${logRows}</tbody>
        </table>
      </div>
    `;
  }).join('');

  const noData = activeUsers.length === 0
    ? `<p class="no-data">No time logs recorded today.</p>`
    : '';

  return `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body>
    <div class="wrapper">
      <div class="header">
        <h1>📋 Daily PMT Time Log Summary</h1>
        <p>${date} &nbsp;·&nbsp; ${activeUsers.length} user(s) logged time</p>
      </div>
      <div class="body">
        <p style="color:#555;margin:0 0 20px">Below is the project time log summary for all team members for today.</p>
        ${rows}${noData}
      </div>
      ${footer()}
    </div>
  </body></html>`;
}

// ─── 2. Daily Attendance (8:00 PM IST) ──────────────────────────────────────

interface AttendanceRecord {
  employee: {
    user: { firstName: string; lastName: string; email: string } | null;
  };
  checkInTime: Date | null;
  checkOutTime: Date | null;
  workHours: any;
  status: string;
  logs: Array<{ type: string; loggedAt: Date }>;
}

function fmtTime(d: Date | null): string {
  if (!d) return '—';
  // `timestamp without time zone` columns are stored as IST but read back by the
  // PrismaPg adapter with a `+00:00` suffix (treated as UTC). Reading the UTC
  // wall-clock of that Date gives the original IST hours/minutes.
  // See workforce.service.ts:fixTimestampWithoutTz for the same correction.
  const dt = new Date(d);
  return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' });
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    present: 'badge-present', absent: 'badge-absent',
    on_leave: 'badge-leave', half_day: 'badge-half',
    holiday: 'badge-holiday', checked_in: 'badge-present',
    incomplete: 'badge-half',
    late: 'badge-late',
  };
  const labels: Record<string, string> = {
    present: 'Present', absent: 'Absent', on_leave: 'On Leave',
    half_day: 'Half Day', holiday: 'Holiday', checked_in: 'Checked In',
    incomplete: 'Incomplete',
    late: 'Late',
  };
  return `<span class="badge ${map[status] || ''}">${labels[status] || status}</span>`;
}

// Same thresholds the auto-absent scheduler uses for the end-of-day pass.
// Kept in sync with attendanceAutoAbsentScheduler.ts so the daily email shows
// the final classification (Absent / Half Day / Present) for clocked-out rows
// instead of the in-progress 'checked_in' badge. (process.env override for ops.)
const EMAIL_FULL_DAY_HOURS = Number(process.env.FULL_DAY_HOURS ?? 9);
const EMAIL_HALF_DAY_HOURS = Number(process.env.HALF_DAY_HOURS ?? 4);

/**
 * Display status = what the auto-absent scheduler SHOULD set, computed
 * client-side so the email is correct even if production stored a stale or
 * wrong DB status (e.g. the scheduler flipped a regularized row to 'absent'
 * because work_hours was NULL).
 *
 * Rules:
 * - Keep 'on_leave' and 'holiday' as-is (they're explicit non-work states).
 * - If both check-in AND check-out exist, classify by hours — preferring the
 *   backend's `workHours`, falling back to (checkOut − checkIn) so rows with
 *   missing work_hours still get the right label.
 * - Otherwise use the raw DB status (covers 'checked_in', 'incomplete',
 *   and absent placeholders synthesized for missing rows).
 */
// Office start cutoff for the "Late" badge. Anyone whose IST wall-clock
// check-in is after this hour:minute is flagged as Late (unless they're
// already classified as Absent — too few hours — or on leave).
const EMAIL_LATE_HOUR = Number(process.env.OFFICE_START_TIME?.split(':')[0] ?? 9);
const EMAIL_LATE_MINUTE = Number(process.env.OFFICE_START_TIME?.split(':')[1] ?? 10);

function isLateCheckIn(checkInTime: unknown): boolean {
  if (!checkInTime) return false;
  const d = new Date(checkInTime as any);
  if (Number.isNaN(d.getTime())) return false;
  // checkInTime is stored as IST wall-clock encoded as UTC by PrismaPg, so
  // the UTC hours/minutes ARE the IST hours/minutes to compare against.
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  return hour > EMAIL_LATE_HOUR
    || (hour === EMAIL_LATE_HOUR && minute > EMAIL_LATE_MINUTE);
}

function deriveDisplayStatus(a: AttendanceRecord): string {
  const raw = a.status;
  if (raw === 'on_leave' || raw === 'holiday') return raw;
  const hasIn = !!a.checkInTime;
  const hasOut = !!a.checkOutTime;
  if (!hasIn || !hasOut) return raw; // no times → keep raw (absent / checked_in)
  let h = Number(a.workHours);
  if (!Number.isFinite(h) || h <= 0) {
    // Fallback: derive hours from times — covers the production case where
    // addManualAttendance didn't store work_hours.
    const inMs = new Date(a.checkInTime as any).getTime();
    const outMs = new Date(a.checkOutTime as any).getTime();
    if (Number.isFinite(inMs) && Number.isFinite(outMs) && outMs > inMs) {
      h = (outMs - inMs) / 3_600_000;
    }
  }
  if (!Number.isFinite(h) || h <= 0) return 'absent';
  if (h < EMAIL_HALF_DAY_HOURS) return 'absent';
  // "Late" overrides Half Day / Present when check-in is after the office
  // start cutoff. Late employees DID come to work, so they still count as
  // present in the KPI rollup below.
  if (isLateCheckIn(a.checkInTime)) return 'late';
  if (h < EMAIL_FULL_DAY_HOURS) return 'half_day';
  return 'present';
}

function dailyAttendance({ attendance, date }: { attendance: AttendanceRecord[]; date: string }): string {
  const displayStatuses = attendance.map(deriveDisplayStatus);
  // Any "in-office" state counts toward Present in the KPI cards. Late and
  // Half Day both mean the employee came to work, just not a full on-time day.
  const presentCount  = displayStatuses.filter(s =>
    s === 'present' || s === 'checked_in' || s === 'half_day' || s === 'late'
  ).length;
  const absentCount   = displayStatuses.filter(s => s === 'absent').length;
  const leaveCount    = displayStatuses.filter(s => s === 'on_leave').length;

  const rows = attendance.map((a, i) => {
    const name = a.employee.user
      ? `${a.employee.user.firstName} ${a.employee.user.lastName}`
      : 'Unknown';
    const email = a.employee.user?.email || '';
    const checkIn  = fmtTime(a.checkInTime);
    const checkOut = fmtTime(a.checkOutTime);
    // Prefer backend's workHours; fall back to (checkOut − checkIn) so rows
    // where the server forgot to store work_hours still show real duration
    // instead of '—'. Negative diffs render as '—' (mis-regularized rows).
    let hoursNum = Number(a.workHours);
    if (!Number.isFinite(hoursNum) || hoursNum <= 0) {
      if (a.checkInTime && a.checkOutTime) {
        const inMs = new Date(a.checkInTime as any).getTime();
        const outMs = new Date(a.checkOutTime as any).getTime();
        if (Number.isFinite(inMs) && Number.isFinite(outMs) && outMs > inMs) {
          hoursNum = (outMs - inMs) / 3_600_000;
        }
      }
    }
    const hours = Number.isFinite(hoursNum) && hoursNum > 0
      ? `${hoursNum.toFixed(2)} h`
      : '—';
    return `
      <tr>
        <td>${name}<br/><span style="font-size:11px;color:#aaa">${email}</span></td>
        <td>${checkIn}</td>
        <td>${checkOut}</td>
        <td>${hours}</td>
        <td>${statusBadge(displayStatuses[i])}</td>
      </tr>
    `;
  }).join('');

  const noData = attendance.length === 0 ? `<p class="no-data">No attendance records for today.</p>` : '';

  return `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body>
    <div class="wrapper">
      <div class="header">
        <h1>🕐 Daily Attendance Report</h1>
        <p>${date}</p>
      </div>
      <div class="body">
        <!-- Use a table for the KPI row: CSS Grid is stripped by Gmail/Outlook
             so the divs stack vertically. A 3-column table renders the same
             horizontal layout across every email client. -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
          <tr>
            <td width="33.33%" style="padding:0 8px 0 0;">
              <div class="stat-card"><div class="num" style="color:#065f46">${presentCount}</div><div class="lbl">Present</div></div>
            </td>
            <td width="33.33%" style="padding:0 4px;">
              <div class="stat-card"><div class="num" style="color:#991b1b">${absentCount}</div><div class="lbl">Absent</div></div>
            </td>
            <td width="33.33%" style="padding:0 0 0 8px;">
              <div class="stat-card"><div class="num" style="color:#92400e">${leaveCount}</div><div class="lbl">On Leave</div></div>
            </td>
          </tr>
        </table>
        ${attendance.length > 0 ? `
        <table>
          <thead><tr><th>Employee</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>` : noData}
      </div>
      ${footer()}
    </div>
  </body></html>`;
}

// ─── 3. Weekly Report (Monday 9:00 AM IST) ──────────────────────────────────

interface WeeklyProject {
  id: string;
  name: string;
  issues: Array<{
    id: string; title: string; status: string;
    timeLogs: Array<{ hours: any; user: { firstName: string; lastName: string } }>;
  }>;
  members: Array<{ user: { firstName: string; lastName: string } | null }>;
}

function weeklyReport({ projects, startDate, endDate }: { projects: WeeklyProject[]; startDate: string; endDate: string }): string {
  const projectRows = projects.map(p => {
    const totalHours = p.issues.reduce((s, i) =>
      s + i.timeLogs.reduce((ss, l) => ss + parseFloat(l.hours), 0), 0);

    const issueRows = p.issues
      .filter(i => i.timeLogs.length > 0)
      .map(i => {
        const iHours = i.timeLogs.reduce((s, l) => s + parseFloat(l.hours), 0);
        const contributors = [...new Set(i.timeLogs.map(l => `${l.user.firstName} ${l.user.lastName}`))].join(', ');
        return `
          <tr>
            <td style="padding-left:20px;color:#555">${i.title}</td>
            <td style="font-size:11px;color:#888">${i.status.replace(/_/g,' ')}</td>
            <td>${contributors}</td>
            <td style="text-align:right;font-weight:600">${iHours.toFixed(2)} h</td>
          </tr>
        `;
      }).join('');

    return `
      <tr style="background:#f8f9ff">
        <td colspan="4" style="font-weight:700;font-size:14px;padding:12px 14px;color:#1a1a2e">
          📁 ${p.name} &nbsp;<span style="font-weight:400;color:#4f46e5;font-size:13px">${totalHours.toFixed(2)} hrs this week</span>
        </td>
      </tr>
      ${issueRows || `<tr><td colspan="4" style="padding-left:20px;color:#aaa;font-size:12px">No time logged this week</td></tr>`}
    `;
  }).join('');

  const grandTotal = projects.reduce((s, p) =>
    s + p.issues.reduce((ss, i) =>
      ss + i.timeLogs.reduce((sss, l) => sss + parseFloat(l.hours), 0), 0), 0);

  return `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body>
    <div class="wrapper">
      <div class="header">
        <h1>📊 Weekly Project Report</h1>
        <p>${startDate} → ${endDate} &nbsp;·&nbsp; ${projects.length} active project(s) &nbsp;·&nbsp; ${grandTotal.toFixed(2)} total hrs</p>
      </div>
      <div class="body">
        <table>
          <thead><tr><th>Issue / Project</th><th>Status</th><th>Contributors</th><th style="text-align:right">Hours</th></tr></thead>
          <tbody>${projectRows}</tbody>
        </table>
      </div>
      ${footer()}
    </div>
  </body></html>`;
}

// ─── 4. Monthly Summary (1st of month 9:00 AM IST) ──────────────────────────

interface MonthlyEmployee {
  id: string;
  user: { firstName: string; lastName: string; email: string } | null;
  attendance: Array<{ status: string }>;
  // Optional: when supplied, working days won't count weekdays before the
  // employee joined (e.g. someone who joined mid-month doesn't get marked
  // absent for the pre-joining portion).
  joiningDate?: Date | string | null;
  // Optional: branch id used to decide which holidays apply to this employee.
  branchId?: string | null;
  // Pre-computed leave days for the month (from the `leaves` table). Required
  // because approving a leave doesn't create attendance rows with
  // status='on_leave', so counting attendance alone misses them.
  leaveDays?: number;
}

interface MonthlyHoliday {
  date: string;            // 'YYYY-MM-DD'
  branchId?: string | null; // null = org-wide; non-null = applies only to that branch
}

function monthlySummary({ employees, monthName, year, month, holidays = [] }: {
  employees: MonthlyEmployee[];
  monthName: string;
  year: number;
  month: number;
  // WEEKDAY holidays (caller already dropped Sat/Sun and 'optional' type).
  // Org-wide holidays have branchId=null; branch-specific have a value.
  holidays?: MonthlyHoliday[];
}): string {
  // Org-wide weekday count (before any holiday subtraction)
  const weekdayCount = getWorkingDays(year, month);
  // Org-wide holiday count (branchId === null) — affects every employee
  const orgHolidayCount = holidays.filter(h => !h.branchId).length;
  // Header subtitle shows the org-wide effective working days
  const orgWorkingDays = Math.max(0, weekdayCount - orgHolidayCount);

  // Per-employee working days helper:
  //   weekdays in month
  //   − weekdays before joiningDate (so pre-joining days aren't "absent")
  //   − weekday holidays applicable to the employee's branch (org-wide + matching branch)
  const computeWorkingDaysFor = (e: MonthlyEmployee): number => {
    const joinDate = e.joiningDate
      ? new Date(e.joiningDate as any)
      : null;
    let weekdays = weekdayCount;

    // Use YYYY-MM-DD strings for date comparisons to avoid TZ edge cases —
    // a joiningDate stored as `DATE` in Postgres comes back as UTC midnight,
    // which can land on a different day in IST. Compare via the date portion only.
    const joinDateStr = joinDate && !isNaN(joinDate.getTime())
      ? joinDate.toISOString().slice(0, 10)
      : null;

    if (joinDateStr) {
      // Count weekdays from month start to (joiningDate − 1) that should be
      // excluded for this employee (they weren't on payroll yet).
      const monthStart = new Date(year, month - 1, 1);
      let preJoining = 0;
      const d = new Date(monthStart);
      while (d.getMonth() === month - 1) {
        const dow = d.getDay();
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (dow !== 0 && dow !== 6 && dStr < joinDateStr) preJoining++;
        d.setDate(d.getDate() + 1);
      }
      weekdays = Math.max(0, weekdays - preJoining);
    }

    // Only subtract holidays that fall on or after the employee's joining date
    // (otherwise a holiday in the pre-joining period gets double-counted —
    // already excluded as pre-joining AND subtracted as a holiday).
    const applicableHolidays = holidays.filter(h => {
      if (joinDateStr && h.date < joinDateStr) return false; // pre-joining
      if (!h.branchId) return true;                          // org-wide
      return !!(e.branchId && h.branchId === e.branchId);    // branch-match
    });
    return Math.max(0, weekdays - applicableHolidays.length);
  };

  const rows = employees.map(e => {
    const name   = e.user ? `${e.user.firstName} ${e.user.lastName}` : 'Unknown';
    const email  = e.user?.email || '';
    const workingDays = computeWorkingDaysFor(e);
    const present = e.attendance.filter(a => ['present', 'checked_in', 'half_day'].includes(a.status)).length;
    // Prefer the scheduler-supplied `leaveDays` (from the `leaves` table) so
    // approved leaves count even when no attendance row was created.
    // Fall back to counting attendance.status='on_leave' rows for callers
    // that haven't supplied leaveDays.
    const attendanceLeaveCount = e.attendance.filter(a => a.status === 'on_leave').length;
    const onLeave = Math.min(
      workingDays, // cap at workingDays so the sum doesn't exceed the denominator
      typeof e.leaveDays === 'number' ? e.leaveDays : attendanceLeaveCount
    );
    // Days without any attendance row are treated as absent.
    // absent = workingDays − present − onLeave (clamped to 0 in case of bad data)
    const absent  = Math.max(0, workingDays - present - onLeave);
    return `
      <tr>
        <td>${name}<br/><span style="font-size:11px;color:#aaa">${email}</span></td>
        <td style="text-align:center"><span class="badge badge-present">${present}</span></td>
        <td style="text-align:center"><span class="badge badge-absent">${absent}</span></td>
        <td style="text-align:center"><span class="badge badge-leave">${onLeave}</span></td>
        <td style="text-align:center;color:#555">${workingDays}</td>
      </tr>
    `;
  }).join('');

  // Header subtitle: show both raw weekday count and effective working days
  // (after subtracting holidays) so HR can verify the calculation at a glance.
  const headerSubtitle = orgHolidayCount > 0
    ? `${monthName} &nbsp;·&nbsp; ${employees.length} employee(s) &nbsp;·&nbsp; ${orgWorkingDays} working days (${weekdayCount} weekdays − ${orgHolidayCount} holiday${orgHolidayCount === 1 ? '' : 's'})`
    : `${monthName} &nbsp;·&nbsp; ${employees.length} employee(s) &nbsp;·&nbsp; ${orgWorkingDays} working days`;

  return `<!DOCTYPE html><html><head>${BASE_STYLE}</head><body>
    <div class="wrapper">
      <div class="header">
        <h1>📅 Monthly Attendance Summary</h1>
        <p>${headerSubtitle}</p>
      </div>
      <div class="body">
        <div class="section-title">Employee Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th style="text-align:center">Present</th>
              <th style="text-align:center">Absent</th>
              <th style="text-align:center">On Leave</th>
              <th style="text-align:center">Working Days</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="5" style="color:#aaa;text-align:center">No employee records found</td></tr>`}</tbody>
        </table>
      </div>
      ${footer()}
    </div>
  </body></html>`;
}

function getWorkingDays(year: number, month: number): number {
  // Count Mon-Fri in the given month (1-indexed)
  const d = new Date(year, month - 1, 1);
  let count = 0;
  while (d.getMonth() === month - 1) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export const emailScheduleTemplates = { dailyPMT, dailyAttendance, weeklyReport, monthlySummary };
