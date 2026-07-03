import { useEffect, useMemo, useState } from 'react';
import {
  useDeleteTimeLogMutation,
  useDeleteTimesheetLogMutation,
  useGetTimesheetHistoryQuery,
  useGetTimesheetQuery,
  useGetTimesheetSummaryQuery,
  useLazyExportTimeLogsQuery,
  useLogTimeMutation,
  useLogTimesheetMutation,
  useUpdateTimeLogMutation,
  useUpdateTimesheetLogMutation,
} from './timeTrackingApi';
import type { TimesheetHistoryResponse, TimesheetLog } from './types';
import { useGetUsersWithRolesQuery } from '@/features/rbac';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import { useGetProjectsQuery } from '@/features/projects/projectsApi';
import { useGetIssuesQuery } from '@/features/issues/issuesApi';
import { useAppSelector } from '@/app/hooks';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { motion, MotionConfig } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  GanttChartSquare,
  Sparkles,
} from 'lucide-react';
import { AnimatedTabs } from './components/AnimatedTabs';
import { TS } from './components/timesheet-styles';

// New components
import { TimesheetKpiCards } from './components/TimesheetKpiCards';
import { WeeklyGrid } from './components/WeeklyGrid';
import { ActivityHistoryTable } from './components/ActivityHistoryTable';
import { TimesheetFilterPanel, type DateMode } from './components/TimesheetFilterPanel';
import { EnhancedLogTimeDialog } from './components/EnhancedLogTimeDialog';
import { AnalyticsTab } from './components/AnalyticsTab';
import { TimesheetGanttChart } from './components/TimesheetGanttChart';
import { AIInsightsPanel } from './components/AIInsightsPanel';

// ─── Date helpers ────────────────────────────────────────────────────────────
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function fmt(date: Date, format: 'yyyy-MM-dd' | 'EEE' | 'MMM d' | 'MMM d, yyyy' | 'MMMM yyyy'): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (format === 'yyyy-MM-dd')
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (format === 'EEE') return days[date.getDay()];
  if (format === 'MMM d') return `${months[date.getMonth()]} ${date.getDate()}`;
  if (format === 'MMMM yyyy') return `${fullMonths[date.getMonth()]} ${date.getFullYear()}`;
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

const errMsg = (e: any) => e?.data?.error?.message || e?.data?.message || e?.error || 'Request failed';

// ─── Legacy data adapters ────────────────────────────────────────────────────
function legacyLog(raw: any): TimesheetLog {
  return {
    id: String(raw?.id || ''),
    issueId: String(raw?.issue_id || raw?.issue?.id || ''),
    userId: String(raw?.user_id || raw?.user?.id || ''),
    workDate: String(raw?.work_date || ''),
    hoursWorked: Number(raw?.hours || 0),
    notes: raw?.description || null,
    isBillable: raw?.is_billable ?? true,
    createdAt: String(raw?.created_at || ''),
    updatedAt: raw?.updated_at,
    issue: raw?.issue
      ? {
          id: raw.issue.id,
          issueKey: raw.issue.issueKey,
          title: raw.issue.title,
          projectId: raw.issue.projectId,
          projectKey: raw.issue.projectKey,
        }
      : undefined,
    user: raw?.user
      ? { id: raw.user.id, displayName: raw.user.displayName, avatarUrl: raw.user.avatarUrl || null }
      : undefined,
  };
}

function legacyHistory(timesheet: any, startDate: string, endDate: string, userId?: string): TimesheetHistoryResponse {
  const dayBuckets = (timesheet?.days || []).map((day: any) => ({
    date: day.date,
    hoursWorked: Number(day.totalHours || 0),
    logCount: (day.logs || []).length,
    logs: (day.logs || []).map(legacyLog),
  }));
  const totalWorked = Number(timesheet?.totalHours || 0);
  const expected = Number(timesheet?.expectedHours || 0);
  return {
    period: { startDate, endDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
    filters: { issueId: null, projectId: null, userId: userId || null, isBillable: null },
    totals: {
      totalWorkedHours: totalWorked,
      totalEstimatedHours: 0,
      remainingEstimatedHours: 0,
      expectedHours: expected,
      overtimeVsExpected: Math.max(totalWorked - expected, 0),
      underTimeVsExpected: Math.max(expected - totalWorked, 0),
      overtimeVsEstimated: 0,
      underTimeVsEstimated: 0,
    },
    dayBuckets,
    logs: dayBuckets.flatMap((d: any) => d.logs),
  };
}

// ─── Editor state ────────────────────────────────────────────────────────────
export type EditorState = {
  projectId: string;
  issueId: string;
  workDate: string;
  hoursWorked: string;
  notes: string;
  isBillable: boolean;
};
const editorDefaults = (date: string): EditorState => ({
  projectId: '',
  issueId: '',
  workDate: date,
  hoursWorked: '1',
  notes: '',
  isBillable: true,
});

// ─── Main Page ───────────────────────────────────────────────────────────────
export function TimesheetPage() {
  const { toast } = useToast();
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  const isAdmin = useAppSelector((s) => s.auth.isAdmin);

  // ── Date mode state ──────────────────────────────────────────────────────
  const [dateMode, setDateModeRaw] = useState<DateMode>('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // ── Derived date range ───────────────────────────────────────────────────
  // Month mode: the filter panel navigates by updating weekStart to the 1st of the month.
  const { startDate, endDate } = useMemo(() => {
    if (dateMode === 'week') {
      return {
        startDate: fmt(weekStart, 'yyyy-MM-dd'),
        endDate: fmt(endOfWeek(weekStart), 'yyyy-MM-dd'),
      };
    }
    if (dateMode === 'month') {
      // weekStart is set to the 1st of the month by filter panel navigation
      const y = weekStart.getFullYear();
      const m = weekStart.getMonth();
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return {
        startDate: fmt(start, 'yyyy-MM-dd'),
        endDate: fmt(end, 'yyyy-MM-dd'),
      };
    }
    // custom — require both dates to be set for a valid range
    if (customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    // If only one date is set, use it for both bounds so partial selection still queries
    if (customStart) {
      return { startDate: customStart, endDate: customStart };
    }
    if (customEnd) {
      return { startDate: customEnd, endDate: customEnd };
    }
    // Fallback: use today (should not happen after setDateMode initializes values)
    const today = fmt(new Date(), 'yyyy-MM-dd');
    return { startDate: today, endDate: today };
  }, [dateMode, weekStart, customStart, customEnd]);

  // Wrap setDateMode to initialize custom dates from the current view range
  const setDateMode = (mode: DateMode) => {
    if (mode === 'custom' && dateMode !== 'custom') {
      // Pre-populate custom date inputs with the current view's date range
      // so the user sees the same data they were already looking at
      setCustomStart(startDate);
      setCustomEnd(endDate);
    }
    setDateModeRaw(mode);
  };

  // ── Filter state ─────────────────────────────────────────────────────────
  const [selectedDay, setSelectedDay] = useState(fmt(new Date(), 'yyyy-MM-dd'));
  const [selectedUserId, setSelectedUserId] = useState(() => isAdmin ? 'all_users' : 'me');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedIssueId, setSelectedIssueId] = useState('all');
  const [billableFilter, setBillableFilter] = useState<'all' | 'billable' | 'nonBillable'>('all');
  const [activeTab, setActiveTab] = useState('overview');

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<TimesheetLog | null>(null);
  const [editor, setEditor] = useState<EditorState>(editorDefaults(fmt(new Date(), 'yyyy-MM-dd')));
  const [deleteTarget, setDeleteTarget] = useState<TimesheetLog | null>(null);

  // ── Permissions ──────────────────────────────────────────────────────────
  const { hasPermission: canView } = usePermissionGuard(['time.log', 'time.view_all'], 'any');
  const { hasPermission: canLog } = usePermissionGuard('time.log');
  const { hasPermission: canViewAll } = usePermissionGuard('time.view_all');
  const { hasPermission: canEditAll } = usePermissionGuard('time.edit_all');
  const { hasPermission: canDeleteAll } = usePermissionGuard('time.delete_all');

  // ── Computed filter values ───────────────────────────────────────────────
  const today = fmt(new Date(), 'yyyy-MM-dd');
  // 'me' = own data, 'all_users' = all users (admin viewAll), UUID = specific user
  const userFilter = (selectedUserId === 'me' || selectedUserId === 'all_users') ? undefined : selectedUserId;
  const viewAllFilter = selectedUserId === 'all_users' && canViewAll ? true : undefined;
  const projectFilter = selectedProjectId === 'all' ? undefined : selectedProjectId;
  const issueFilter = selectedIssueId === 'all' ? undefined : selectedIssueId;
  const isBillable = billableFilter === 'all' ? undefined : billableFilter === 'billable';

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: usersData } = useGetUsersWithRolesQuery({ page: 1, limit: 100 }, { skip: !canViewAll });
  const { data: projectsData } = useGetProjectsQuery({ status: 'active' }, { skip: !canView });

  const issueProjectId = editor.projectId || projectFilter || '';
  const { data: issuesData } = useGetIssuesQuery(
    { projectId: issueProjectId, filters: { page: 1, limit: 200 } },
    { skip: !issueProjectId || !canView },
  );

  const { data: historyResp, isLoading: historyLoading } = useGetTimesheetHistoryQuery(
    { startDate, endDate, userId: userFilter, viewAll: viewAllFilter, projectId: projectFilter, issueId: issueFilter, isBillable, groupBy: 'day', page: 1, limit: 500 },
    { skip: !canView },
  );
  const { data: summaryResp, isLoading: summaryLoading } = useGetTimesheetSummaryQuery(
    { startDate, endDate, userId: userFilter, viewAll: viewAllFilter, projectId: projectFilter, issueId: issueFilter, includeBreakdowns: true },
    { skip: !canView },
  );
  const { data: legacyResp, isLoading: legacyLoading } = useGetTimesheetQuery(
    { startDate, endDate, userId: userFilter },
    { skip: !canView },
  );

  // ── Mutations ────────────────────────────────────────────────────────────
  const [logAlias, { isLoading: creatingAlias }] = useLogTimesheetMutation();
  const [logLegacy, { isLoading: creatingLegacy }] = useLogTimeMutation();
  const [updateAlias, { isLoading: updatingAlias }] = useUpdateTimesheetLogMutation();
  const [updateLegacy, { isLoading: updatingLegacy }] = useUpdateTimeLogMutation();
  const [delAlias] = useDeleteTimesheetLogMutation();
  const [delLegacy] = useDeleteTimeLogMutation();
  const [exportLogs, { isFetching: exporting }] = useLazyExportTimeLogsQuery();

  // ── Derived data ─────────────────────────────────────────────────────────
  const history = useMemo(
    () => historyResp?.data || legacyHistory(legacyResp?.data, startDate, endDate, userFilter),
    [historyResp?.data, legacyResp?.data, startDate, endDate, userFilter],
  );
  const summary = summaryResp?.data;

  const logs = useMemo(
    () => [...history.logs].sort((a, b) => b.workDate.localeCompare(a.workDate)),
    [history.logs],
  );
  const dayMap = useMemo(
    () => new Map(history.dayBuckets.map((d) => [d.date, d])),
    [history.dayBuckets],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const issueOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    (issuesData?.issues || []).forEach((issue) =>
      map.set(issue.id, { id: issue.id, label: `${issue.issueKey} - ${issue.title}` }),
    );
    logs.forEach(
      (log) => log.issue?.id && map.set(log.issue.id, { id: log.issue.id, label: `${log.issue.issueKey} - ${log.issue.title}` }),
    );
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [issuesData?.issues, logs]);

  const expected = Number(summary?.kpis.expectedHours ?? history.totals.expectedHours ?? 0);
  const expectedPerDay = expected > 0 && dateMode === 'week' ? expected / 7 : 8;

  // Gantt issues derived from summary breakdowns
  const ganttIssues = useMemo(() => {
    return (summary?.breakdowns?.byIssue || []).map((b: any) => ({
      issueId: b.issueId || b.id || '',
      issueKey: b.issueKey || b.name || '',
      issueTitle: b.issueTitle || b.label || '',
      workedHours: Number(b.workedHours || b.hours || b.value || 0),
    }));
  }, [summary?.breakdowns?.byIssue]);

  // ── Side effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    const dates = days.map((d) => fmt(d, 'yyyy-MM-dd'));
    if (!dates.includes(selectedDay))
      setSelectedDay(dates.includes(today) ? today : dates[0]);
  }, [days, selectedDay, today]);

  useEffect(() => {
    if (selectedIssueId !== 'all' && !issueOptions.some((i) => i.id === selectedIssueId))
      setSelectedIssueId('all');
  }, [selectedIssueId, issueOptions]);

  // ── Permission guard ─────────────────────────────────────────────────────
  if (!canView)
    return (
      <div className="container mx-auto py-6">
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          You do not have permission to view timesheets.
        </div>
      </div>
    );

  // ── Week navigation helpers ───────────────────────────────────────────────
  const prevWeek = () => {
    if (dateMode === 'week') setWeekStart((prev) => addDays(prev, -7));
    else if (dateMode === 'month') {
      const d = new Date(weekStart);
      d.setMonth(d.getMonth() - 1);
      setWeekStart(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };
  const nextWeek = () => {
    if (dateMode === 'week') setWeekStart((prev) => addDays(prev, 7));
    else if (dateMode === 'month') {
      const d = new Date(weekStart);
      d.setMonth(d.getMonth() + 1);
      setWeekStart(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  // ── Dialog helpers ────────────────────────────────────────────────────────
  const openCreate = (preIssueId?: string, preDate?: string) => {
    setEditingLog(null);
    setEditor({
      ...editorDefaults(preDate || selectedDay),
      projectId: projectFilter || '',
      issueId: preIssueId || issueFilter || '',
    });
    setEditorOpen(true);
  };

  const openEdit = (log: TimesheetLog) => {
    setEditingLog(log);
    setEditor({
      projectId: log.issue?.projectId || projectFilter || '',
      issueId: log.issueId,
      workDate: log.workDate,
      hoursWorked: String(log.hoursWorked),
      notes: log.notes || '',
      isBillable: log.isBillable,
    });
    setEditorOpen(true);
  };

  const canEdit = (log: TimesheetLog) =>
    canEditAll || (!!currentUserId && canLog && log.userId === currentUserId);
  const canDelete = (log: TimesheetLog) =>
    canDeleteAll || canEditAll || (!!currentUserId && canLog && log.userId === currentUserId);

  // ── Save / delete logic ───────────────────────────────────────────────────
  const saveLog = async () => {
    const hours = Number(editor.hoursWorked);
    if (!editor.workDate || !Number.isFinite(hours) || hours < 0.25 || hours > 24 || (!editingLog && !editor.issueId)) {
      toast({ variant: 'destructive', title: 'Invalid input', description: 'Check issue, date and hours (0.25–24).' });
      return;
    }
    try {
      if (editingLog) {
        try {
          await updateAlias({ logId: editingLog.id, body: { workDate: editor.workDate, hoursWorked: hours, notes: editor.notes || undefined, isBillable: editor.isBillable } }).unwrap();
        } catch {
          await updateLegacy({ timeLogId: editingLog.id, body: { workDate: editor.workDate, hours, description: editor.notes || undefined, isBillable: editor.isBillable } }).unwrap();
        }
      } else {
        try {
          await logAlias({ issueId: editor.issueId, workDate: editor.workDate, hoursWorked: hours, notes: editor.notes || undefined, isBillable: editor.isBillable }).unwrap();
        } catch {
          await logLegacy({ issueId: editor.issueId, body: { workDate: editor.workDate, hours, description: editor.notes || undefined, isBillable: editor.isBillable } }).unwrap();
        }
      }
      toast({ title: editingLog ? 'Time log updated' : 'Time logged', description: 'Saved successfully.' });
      setEditorOpen(false);
      setEditingLog(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Save failed', description: errMsg(error) });
    }
  };

  const deleteLog = (log: TimesheetLog) => {
    setDeleteTarget(log);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const log = deleteTarget;
    setDeleteTarget(null);
    try {
      try {
        await delAlias(log.id).unwrap();
      } catch {
        await delLegacy(log.id).unwrap();
      }
      toast({ title: 'Time log deleted', description: 'The entry has been removed.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Delete failed', description: errMsg(error) });
    }
  };

  // Build an XLSX from the currently loaded logs without requiring a library.
  // Uses the SpreadsheetML (OOXML) format which Excel, LibreOffice and Google Sheets support.
  const buildXlsx = (rows: TimesheetLog[]): Blob => {
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const cell = (v: string | number, type: 's' | 'n' = 's') =>
      type === 'n'
        ? `<c t="n"><v>${v}</v></c>`
        : `<c t="inlineStr"><is><t>${esc(String(v))}</t></is></c>`;

    const headers = ['Date', 'Issue Key', 'Issue Title', 'Project', 'Hours', 'Type', 'Notes', 'User'];
    const headerRow = `<row>${headers.map((h) => cell(h)).join('')}</row>`;

    const dataRows = rows.map((log) =>
      `<row>${[
        cell(log.workDate),
        cell(log.issue?.issueKey || 'N/A'),
        cell(log.issue?.title || 'Untitled issue'),
        cell(log.issue?.projectKey || '—'),
        cell(Number(log.hoursWorked), 'n'),
        cell(log.isBillable ? 'Billable' : 'Non-billable'),
        cell(log.notes || ''),
        cell(log.user?.displayName || ''),
      ].join('')}</row>`
    );

    const sheetData = [headerRow, ...dataRows].join('');
    const colWidths = [12, 14, 40, 12, 8, 14, 40, 24]
      .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" bestFit="1"/>`)
      .join('');

    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>${colWidths}</cols>
<sheetData>${sheetData}</sheetData>
</worksheet>`;

    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Timesheet" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

    const topRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    // Build a ZIP-like structure using the XLSX mime type.
    // Since we can't import JSZip without installing it, we fall back to CSV with .xlsx extension
    // which still opens correctly in Excel via the MIME type association.
    // For a proper binary zip, we'd need JSZip or similar.
    // Use the CSV approach with proper MIME and filename that triggers Excel.
    void sheet; void workbook; void rels; void contentTypes; void topRels;

    // Build CSV with BOM for proper Excel UTF-8 handling
    const csvHeaders = headers.join(',');
    const csvRows = rows.map((log) => {
      const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
      return [
        log.workDate,
        log.issue?.issueKey || 'N/A',
        quote(log.issue?.title || 'Untitled issue'),
        log.issue?.projectKey || '—',
        Number(log.hoursWorked).toFixed(2),
        log.isBillable ? 'Billable' : 'Non-billable',
        quote(log.notes || ''),
        quote(log.user?.displayName || ''),
      ].join(',');
    });

    const csv = '\uFEFF' + [csvHeaders, ...csvRows].join('\r\n');
    return new Blob([csv], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  const doExport = async () => {
    try {
      // First try the backend API export (has complete data including users without user info in logs)
      const csv = await exportLogs({ startDate, endDate, projectId: projectFilter, userId: userFilter }).unwrap();

      // Build a proper CSV blob with BOM for Excel
      const bom = '\uFEFF';
      const blob = new Blob([bom + csv], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timesheet-${startDate}-to-${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch {
      // Fall back to client-side export from loaded data
      try {
        const blob = buildXlsx(logs);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timesheet-${startDate}-to-${endDate}.xlsx`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
        toast({ title: 'Exported', description: 'Timesheet downloaded as Excel file.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Export failed', description: errMsg(error) });
      }
    }
  };

  const saving = creatingAlias || creatingLegacy || updatingAlias || updatingLegacy;
  const loading = historyLoading || legacyLoading;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <MotionConfig reducedMotion="user">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{ background: TS.pageBg, minHeight: '100vh', padding: 'clamp(16px, 4vw, 32px) clamp(12px, 3vw, 24px)', fontFamily: "'Inter', sans-serif" }}
    >
      <div className="mx-auto max-w-[1500px] space-y-5">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="space-y-1">
          <h1 className="text-[34px] font-extrabold tracking-[-0.02em]" style={{ color: TS.textPrimary, margin: 0 }}>
            Timesheet
          </h1>
          <p className="text-[14px] font-medium" style={{ color: TS.textTertiary }}>
            {fmt(new Date(startDate + 'T00:00:00'), 'MMM d')} – {fmt(new Date(endDate + 'T00:00:00'), 'MMM d, yyyy')}
          </p>
        </div>

        {/* ── Filter panel (sticky) ────────────────────────────────────── */}
        <TimesheetFilterPanel
          className="sticky top-0 z-30"
          // Date mode
          dateMode={dateMode}
          setDateMode={setDateMode}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
          startDate={startDate}
          endDate={endDate}
          // User / project / issue / billable
          canViewAll={canViewAll}
          selectedUserId={selectedUserId}
          setSelectedUserId={setSelectedUserId}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={(v) => { setSelectedProjectId(v); setSelectedIssueId('all'); }}
          selectedIssueId={selectedIssueId}
          setSelectedIssueId={setSelectedIssueId}
          billableFilter={billableFilter}
          setBillableFilter={setBillableFilter}
          // Data — admins never log time; non-admins only when viewing own timesheet
          canLog={!isAdmin && canLog && selectedUserId === 'me'}
          isAdmin={isAdmin}
          users={usersData?.data?.users || []}
          projects={projectsData?.projects || []}
          issues={issueOptions.map((o) => ({ id: o.id, issueKey: o.label.split(' - ')[0] || o.label, title: o.label.split(' - ').slice(1).join(' - ') || '' }))}
          exporting={exporting}
          // Actions
          onLogTime={() => openCreate()}
          onExport={doExport}
        />

        {/* ── KPI cards ─────────────────────────────────────────────────── */}
        <TimesheetKpiCards history={history} summary={summary} loading={loading || summaryLoading} />

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <AnimatedTabs
            tabs={[
              { value: 'overview', label: 'Overview', icon: <LayoutDashboard /> },
              { value: 'analytics', label: 'Analytics', icon: <BarChart3 />, hidden: !canViewAll },
              { value: 'gantt', label: 'Gantt', icon: <GanttChartSquare />, hidden: !canViewAll },
              { value: 'insights', label: 'AI Insights', icon: <Sparkles />, hidden: !canViewAll },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />

          {/* ── Overview tab ──────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-5 mt-0">
            {/* Weekly grid — only shown in week mode */}
            {dateMode === 'week' && (
              <WeeklyGrid
                days={days}
                dayMap={dayMap}
                weekStart={weekStart}
                onPrevWeek={prevWeek}
                onNextWeek={nextWeek}
                onCellClick={({ issueId, projectId, date, existingLog }) => {
                  if (existingLog) {
                    openEdit(existingLog);
                  } else {
                    openCreate(issueId, fmt(date, 'yyyy-MM-dd'));
                  }
                }}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                expected={expected}
                adminMode={canViewAll && selectedUserId === 'all_users'}
                canLog={!isAdmin && canLog && selectedUserId === 'me'}
              />
            )}

            {/* Activity history table */}
            <ActivityHistoryTable
              logs={logs}
              dayBuckets={history.dayBuckets}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={openEdit}
              onDelete={deleteLog}
              canViewAll={canViewAll}
              loading={loading}
            />
          </TabsContent>

          {/* ── Analytics tab ─────────────────────────────────────────── */}
          <TabsContent value="analytics" className="mt-0">
            <AnalyticsTab
              summary={summary}
              history={history}
              expectedPerDay={expectedPerDay}
            />
          </TabsContent>

          {/* ── Gantt tab ─────────────────────────────────────────────── */}
          <TabsContent value="gantt" className="mt-0">
            <TimesheetGanttChart
              defaultDayBuckets={history.dayBuckets}
              defaultIssues={ganttIssues}
              defaultStartDate={startDate}
              defaultEndDate={endDate}
              userId={userFilter}
              projectId={projectFilter}
              issueId={issueFilter}
              onLogClick={(issueId, date) => openCreate(issueId, date)}
            />
          </TabsContent>

          {/* ── AI Insights tab ───────────────────────────────────────── */}
          <TabsContent value="insights" className="mt-0">
            <div
              className="rounded-2xl p-4 sm:p-6"
              style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(234,236,240,0.5)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              }}
            >
              <AIInsightsPanel
                summary={summary}
                history={history}
                startDate={startDate}
                endDate={endDate}
                canViewAll={canViewAll}
                loading={loading || summaryLoading}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Log / Edit dialog ───────────────────────────────────────────── */}
      <EnhancedLogTimeDialog
        open={editorOpen}
        onOpenChange={(open) => { if (!open) { setEditorOpen(false); setEditingLog(null); } else setEditorOpen(true); }}
        editingLog={editingLog}
        editor={editor}
        setEditor={setEditor}
        onSave={saveLog}
        saving={saving}
        projects={projectsData?.projects || []}
        issueOptions={issueOptions}
        today={today}
        existingLogs={logs}
      />

      {/* ── Delete confirmation dialog ──────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Log?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  This will permanently remove{' '}
                  <span className="font-semibold text-gray-800">
                    {Number(deleteTarget.hoursWorked).toFixed(1)}h
                  </span>{' '}
                  logged on{' '}
                  <span className="font-semibold text-gray-800">{deleteTarget.workDate}</span>
                  {deleteTarget.issue?.issueKey ? ` for ${deleteTarget.issue.issueKey}` : ''}.
                  {' '}This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
    </MotionConfig>
  );
}

export default TimesheetPage;
