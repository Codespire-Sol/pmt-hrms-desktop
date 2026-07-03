import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TimesheetHistoryDayBucket, TimesheetLog } from '../types';
import { useGridScroll } from '../hooks/useGridScroll';
import { TS, cardClass, cellColors } from './timesheet-styles';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
type GroupBy = 'project' | 'issue';

export interface WeeklyCellClickParams {
  issueId?: string;
  projectId?: string;
  date: Date;
  existingLog?: TimesheetLog;
}

interface Props {
  days: Date[];
  dayMap: Map<string, TimesheetHistoryDayBucket>;
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onCellClick: (params: WeeklyCellClickParams) => void;
  expected: number;
  adminMode?: boolean;
  canLog?: boolean;
  selectedDay?: string;
  onSelectDay?: (d: string) => void;
  className?: string;
}

interface GridRow {
  id: string;
  type: 'project' | 'issue';
  name: string;
  parentId?: string;
  days: Map<string, { hours: number; logs: TimesheetLog[] }>;
  total: number;
  hasChildren: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtHours(h: number): string {
  if (h === 0) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (mm === 0) return `${hh}h`;
  return `${hh}h ${mm}m`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Component ────────────────────────────────────────────────────────────────
export function WeeklyGrid({
  days,
  dayMap,
  weekStart,
  onPrevWeek,
  onNextWeek,
  onCellClick,
  expected,
  adminMode,
  canLog,
  className,
}: Props) {
  const groupBy: GroupBy = 'project';
  const showSat = false;
  const showSun = false;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const today = fmtDate(new Date());

  const visibleDays = useMemo(
    () =>
      days.filter((d) => {
        const dow = d.getDay();
        if (dow === 6 && !showSat) return false;
        if (dow === 0 && !showSun) return false;
        return true;
      }),
    [days, showSat, showSun],
  );

  // Build grid rows from logs in dayMap
  const { rows, visibleRows, totalByDate, grandTotal } = useMemo(() => {
    const allLogs: TimesheetLog[] = [];
    dayMap.forEach((bucket) => allLogs.push(...bucket.logs));

    const totalByDate = new Map<string, number>();
    allLogs.forEach((log) => {
      totalByDate.set(log.workDate, (totalByDate.get(log.workDate) ?? 0) + log.hoursWorked);
    });
    const grandTotal = Array.from(totalByDate.values()).reduce((s, v) => s + v, 0);

    const rows: GridRow[] = [];

    if (groupBy === 'project') {
      type IssueData = { name: string; days: Map<string, TimesheetLog[]> };
      type ProjData = { name: string; issues: Map<string, IssueData> };
      const projectMap = new Map<string, ProjData>();

      allLogs.forEach((log) => {
        const pid = String(log.issue?.projectId ?? 'no-project');
        const pname = log.issue?.projectName ?? log.issue?.projectKey ?? 'No Project';
        const iid = String(log.issueId ?? 'no-issue');
        const iname = log.issue?.issueKey
          ? `${log.issue.issueKey} – ${log.issue.title ?? 'Untitled'}`
          : log.issue?.title ?? 'Untitled Issue';

        if (!projectMap.has(pid)) projectMap.set(pid, { name: pname, issues: new Map() });
        const proj = projectMap.get(pid)!;
        if (!proj.issues.has(iid)) proj.issues.set(iid, { name: iname, days: new Map() });
        const issue = proj.issues.get(iid)!;
        if (!issue.days.has(log.workDate)) issue.days.set(log.workDate, []);
        issue.days.get(log.workDate)!.push(log);
      });

      projectMap.forEach((proj, pid) => {
        const projDays = new Map<string, { hours: number; logs: TimesheetLog[] }>();
        let projTotal = 0;
        proj.issues.forEach((issue) => {
          issue.days.forEach((logs, date) => {
            const h = logs.reduce((s, l) => s + l.hoursWorked, 0);
            if (!projDays.has(date)) projDays.set(date, { hours: 0, logs: [] });
            projDays.get(date)!.hours += h;
            projDays.get(date)!.logs.push(...logs);
            projTotal += h;
          });
        });
        rows.push({ id: pid, type: 'project', name: proj.name, days: projDays, total: projTotal, hasChildren: proj.issues.size > 0 });

        proj.issues.forEach((issue, iid) => {
          const issueDays = new Map<string, { hours: number; logs: TimesheetLog[] }>();
          let issueTotal = 0;
          issue.days.forEach((logs, date) => {
            const h = logs.reduce((s, l) => s + l.hoursWorked, 0);
            issueDays.set(date, { hours: h, logs });
            issueTotal += h;
          });
          rows.push({ id: iid, type: 'issue', name: issue.name, parentId: pid, days: issueDays, total: issueTotal, hasChildren: false });
        });
      });
    } else {
      type IssueData = { name: string; projectId?: string; days: Map<string, TimesheetLog[]> };
      const issueMap = new Map<string, IssueData>();

      allLogs.forEach((log) => {
        const iid = String(log.issueId ?? 'no-issue');
        const iname = log.issue?.issueKey
          ? `${log.issue.issueKey} – ${log.issue.title ?? 'Untitled'}`
          : log.issue?.title ?? 'Untitled Issue';
        const pid = String(log.issue?.projectId ?? '');
        if (!issueMap.has(iid)) issueMap.set(iid, { name: iname, projectId: pid, days: new Map() });
        const issue = issueMap.get(iid)!;
        if (!issue.days.has(log.workDate)) issue.days.set(log.workDate, []);
        issue.days.get(log.workDate)!.push(log);
      });

      issueMap.forEach((issue, iid) => {
        const issueDays = new Map<string, { hours: number; logs: TimesheetLog[] }>();
        let issueTotal = 0;
        issue.days.forEach((logs, date) => {
          const h = logs.reduce((s, l) => s + l.hoursWorked, 0);
          issueDays.set(date, { hours: h, logs });
          issueTotal += h;
        });
        rows.push({ id: iid, type: 'issue', name: issue.name, days: issueDays, total: issueTotal, hasChildren: false });
      });
    }

    // Compute visible rows (filter out collapsed children)
    const visibleRows = rows.filter((row) => {
      if (row.type === 'issue' && row.parentId && groupBy === 'project') {
        return expanded.has(row.parentId);
      }
      return true;
    });

    return { rows, visibleRows, totalByDate, grandTotal };
  }, [dayMap, groupBy, expanded]);

  // Grid scroll hook
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleKeyDown,
    isDragging,
    focusedCell,
  } = useGridScroll({
    containerRef: scrollContainerRef,
    rows: visibleRows.length,
    cols: visibleDays.length,
    onCellActivate: (rowIdx, colIdx) => {
      const row = visibleRows[rowIdx];
      const d = visibleDays[colIdx];
      if (row && d) handleCellClick(row, d);
    },
  });

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleCellClick = (row: GridRow, d: Date) => {
    const dateStr = fmtDate(d);
    const cell = row.days.get(dateStr);
    onCellClick({
      issueId: row.type === 'issue' ? row.id : undefined,
      projectId: row.type === 'project' ? row.id : undefined,
      date: d,
      existingLog: cell?.logs?.[0],
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={cn(cardClass, 'overflow-hidden', className)}>
      {/* Admin mode badge */}
      {adminMode && (
        <div className="px-5 py-2.5 border-b border-[#F2F4F7] bg-[#F8FAFC]">
          <span className="text-[11px] font-bold rounded-lg px-2.5 py-1" style={{ background: TS.primaryLight, color: TS.primary }}>
            All Users
          </span>
        </div>
      )}

      {/* Scrollable table container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden relative focus-visible:outline-none"
        style={{
          cursor: isDragging ? 'grabbing' : 'auto',
          willChange: 'scroll-position',
          WebkitOverflowScrolling: 'touch',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="grid"
        aria-label="Weekly timesheet grid"
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            minWidth: 560,
          }}
        >
          {/* Column headers — sticky */}
          <thead>
            <tr>
              {/* Name column header */}
              <th
                className="text-left text-[11px] font-bold uppercase tracking-[0.05em] select-none"
                style={{
                  padding: '10px 20px',
                  color: TS.textTertiary,
                  minWidth: 240,
                  position: 'sticky',
                  left: 0,
                  top: 0,
                  zIndex: 4,
                  background: TS.gridHeaderBg,
                  borderRight: `1px solid ${TS.border}`,
                  borderBottom: `2px solid ${TS.border}`,
                }}
              >
                {groupBy === 'project' ? 'Project / Issue' : 'Issue'}
              </th>

              {/* Day columns */}
              {visibleDays.map((d) => {
                const dateStr = fmtDate(d);
                const isToday = dateStr === today;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th
                    key={dateStr}
                    className="text-center select-none"
                    style={{
                      padding: '8px 4px',
                      minWidth: 88,
                      position: 'sticky',
                      top: 0,
                      zIndex: 3,
                      background: isToday
                        ? TS.gridTodayTint
                        : isWeekend
                          ? TS.gridWeekendBg
                          : TS.gridHeaderBg,
                      borderLeft: `1px solid ${TS.borderSubtle}`,
                      borderBottom: isToday ? `2px solid ${TS.primary}` : `2px solid ${TS.border}`,
                    }}
                  >
                    {/* Today dot */}
                    {isToday && (
                      <div className="flex justify-center mb-0.5">
                        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: TS.primary }} />
                      </div>
                    )}
                    <div
                      className="text-[10px] font-bold uppercase tracking-[0.06em] mb-1"
                      style={{ color: isToday ? TS.primary : isWeekend ? '#94a3b8' : TS.textTertiary }}
                    >
                      {DAY_NAMES[d.getDay()]}
                    </div>
                    <div
                      className="inline-flex items-center justify-center rounded-full"
                      style={{
                        width: 26,
                        height: 26,
                        background: isToday ? TS.primary : 'transparent',
                        color: isToday ? '#fff' : isWeekend ? '#94a3b8' : TS.textPrimary,
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {d.getDate()}
                    </div>
                    <div className="text-[10px] font-medium mt-0.5" style={{ color: '#94a3b8' }}>
                      {MONTH_NAMES[d.getMonth()]}
                    </div>
                  </th>
                );
              })}

              {/* Total column header */}
              <th
                className="text-center text-[11px] font-bold uppercase tracking-[0.05em] select-none"
                style={{
                  padding: '10px 16px',
                  color: TS.textTertiary,
                  minWidth: 80,
                  position: 'sticky',
                  top: 0,
                  zIndex: 3,
                  borderLeft: `2px solid ${TS.border}`,
                  borderBottom: `2px solid ${TS.border}`,
                  background: '#f0f4ff',
                }}
              >
                Total
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleDays.length + 2}
                  className="text-center py-14 text-[14px] font-medium"
                  style={{ color: TS.textMuted }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="opacity-30">
                      <circle cx="20" cy="20" r="18" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" />
                      <path d="M20 12v8l5 3" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>No time logged this week</span>
                    {canLog && (
                      <span className="text-[12px]" style={{ color: TS.primary }}>
                        Click any cell to log time
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )}

            <AnimatePresence mode="popLayout">
              {visibleRows.map((row, rowIdx) => {
                const isProject = row.type === 'project';
                const isExp = isProject && expanded.has(row.id);

                return (
                  <motion.tr
                    key={`${row.type}-${row.id}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                    style={{
                      borderBottom: `1px solid ${isProject ? TS.border : TS.borderSubtle}`,
                      background: isProject ? '#FAFBFC' : '#FFFFFF',
                    }}
                  >
                    {/* Name cell — sticky left */}
                    <td
                      style={{
                        padding: isProject ? '10px 16px 10px 20px' : '8px 16px 8px 40px',
                        fontSize: isProject ? 13 : 12,
                        fontWeight: isProject ? 700 : 500,
                        color: isProject ? TS.textPrimary : TS.textSecondary,
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        background: isProject ? '#FAFBFC' : '#FFFFFF',
                        borderRight: `1px solid ${TS.border}`,
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isProject ? (
                          row.hasChildren ? (
                            <button
                              onClick={() => toggleExpand(row.id)}
                              className="p-0.5 rounded hover:bg-[#F2F4F7] transition-colors flex-shrink-0"
                              title={isExp ? 'Collapse' : 'Expand'}
                            >
                              <ChevronIcon open={isExp} />
                            </button>
                          ) : (
                            <span className="w-5 flex-shrink-0" />
                          )
                        ) : null}

                        {isProject ? <FolderIcon /> : <IssueIcon />}

                        <span className="overflow-hidden text-ellipsis whitespace-nowrap min-w-0" title={row.name}>
                          {row.name}
                        </span>
                      </div>
                    </td>

                    {/* Day cells */}
                    {visibleDays.map((d, colIdx) => {
                      const dateStr = fmtDate(d);
                      const isToday = dateStr === today;
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                      if (isProject && isExp) {
                        return (
                          <td
                            key={dateStr}
                            style={{
                              textAlign: 'center',
                              padding: 6,
                              background: isToday ? TS.gridTodayTint : isWeekend ? TS.gridWeekendBg : 'transparent',
                              borderLeft: `1px solid ${TS.borderSubtle}`,
                            }}
                          />
                        );
                      }

                      const cell = row.days.get(dateStr);
                      const hours = cell?.hours ?? 0;
                      const colors = cellColors(hours);
                      const cellKey = `${row.id}-${dateStr}`;
                      const isHovered = hoveredCell === cellKey;
                      const isFocused = focusedCell?.row === rowIdx && focusedCell?.col === colIdx;
                      const clickable = canLog || hours > 0;

                      return (
                        <td
                          key={dateStr}
                          style={{
                            textAlign: 'center',
                            padding: 6,
                            background: isToday ? TS.gridTodayTint : isWeekend ? TS.gridWeekendBg : 'transparent',
                            borderLeft: `1px solid ${TS.borderSubtle}`,
                          }}
                        >
                          <button
                            data-grid-cell
                            data-row={rowIdx}
                            data-col={colIdx}
                            onClick={() => clickable && handleCellClick(row, d)}
                            onMouseEnter={() => setHoveredCell(cellKey)}
                            onMouseLeave={() => setHoveredCell(null)}
                            title={
                              hours > 0
                                ? `${hours.toFixed(1)}h – click to edit`
                                : canLog
                                  ? 'Click to log time'
                                  : undefined
                            }
                            className={cn(
                              'w-full flex items-center justify-center gap-1 transition-all duration-[120ms] ease-out',
                              isFocused && 'ring-2 ring-[#1268ff] ring-offset-1',
                            )}
                            style={{
                              minWidth: 68,
                              height: 32,
                              borderRadius: 8,
                              border: hours > 0
                                ? `1px solid ${colors.border}`
                                : `1px dashed ${isHovered && canLog ? '#93c5fd' : '#E4E7EC'}`,
                              background: hours > 0
                                ? colors.bg
                                : isHovered && canLog
                                  ? 'rgba(18,104,255,0.04)'
                                  : 'transparent',
                              color: hours > 0 ? colors.text : '#94a3b8',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: clickable ? 'pointer' : 'default',
                            }}
                          >
                            {hours > 0 ? (
                              fmtHours(hours)
                            ) : isHovered && canLog ? (
                              <PlusIcon />
                            ) : (
                              <span className="text-[10px]">—</span>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Row total */}
                    <td
                      style={{
                        textAlign: 'center',
                        padding: '8px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: row.total > 0 && !(isProject && isExp) ? TS.textPrimary : '#d0d5dd',
                        borderLeft: `2px solid ${TS.border}`,
                        background: '#f8faff',
                      }}
                    >
                      {isProject && isExp ? '—' : fmtHours(row.total)}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>

            {/* Totals row */}
            <tr
              style={{
                borderTop: `2px solid ${TS.border}`,
                background: TS.gridTotalsBg,
              }}
            >
              <td
                style={{
                  padding: '12px 20px',
                  fontSize: 13,
                  fontWeight: 800,
                  color: TS.textPrimary,
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  background: TS.gridTotalsBg,
                  borderRight: `1px solid ${TS.border}`,
                }}
              >
                Total
              </td>
              {visibleDays.map((d) => {
                const dateStr = fmtDate(d);
                const h = totalByDate.get(dateStr) ?? 0;
                const isToday = dateStr === today;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <td
                    key={dateStr}
                    className="text-center"
                    style={{
                      padding: '12px 6px',
                      fontSize: 13,
                      fontWeight: 800,
                      color: h > 0 ? TS.textPrimary : '#b0bec9',
                      background: isToday
                        ? 'rgba(18,104,255,0.08)'
                        : isWeekend
                          ? 'rgba(0,0,0,0.015)'
                          : 'transparent',
                      borderLeft: `1px solid ${TS.border}`,
                    }}
                  >
                    {h > 0 ? fmtHours(h) : '—'}
                  </td>
                );
              })}
              <td
                className="text-center"
                style={{
                  padding: '12px 14px',
                  fontSize: 14,
                  fontWeight: 900,
                  color: TS.primary,
                  borderLeft: `2px solid ${TS.border}`,
                  background: '#e8eeff',
                }}
              >
                {fmtHours(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer — week total + legend */}
      <div
        className="flex items-center justify-between flex-wrap gap-2 px-5 py-2.5"
        style={{
          borderTop: `1px solid ${TS.border}`,
          background: TS.gridHeaderBg,
          fontSize: 12,
        }}
      >
        <div className="font-semibold" style={{ color: TS.textTertiary }}>
          Week total{' '}
          <span className="text-[14px] font-black" style={{ color: TS.textPrimary }}>
            {fmtHours(grandTotal)}
          </span>
          {expected > 0 && (
            <span className="font-medium ml-2" style={{ color: TS.textMuted }}>
              / {expected}h expected
            </span>
          )}
        </div>

        {/* Heatmap legend */}
        <div className="flex items-center gap-3">
          {[
            { bg: 'transparent', label: 'None', border: '#E4E7EC', dashed: true },
            { bg: '#eff6ff', label: '< 1h', border: '#bfdbfe' },
            { bg: '#dbeafe', label: '1–4h', border: '#93c5fd' },
            { bg: '#3b82f6', label: '4–8h', border: '#2563eb' },
            { bg: '#1d4ed8', label: '8h+', border: '#1e40af' },
          ].map(({ bg, label, border, dashed }) => (
            <span key={label} className="flex items-center gap-1 font-medium" style={{ color: TS.textTertiary }}>
              <span
                className="inline-block w-3 h-3 rounded-[3px]"
                style={{
                  background: bg,
                  border: `1px ${dashed ? 'dashed' : 'solid'} ${border}`,
                }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Small inline components ─────────────────────────────────────────────────
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="transition-transform duration-200"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <path d="M5 3.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
      <path
        d="M1.5 4a1 1 0 011-1h3l1.5 1.5H12a1 1 0 011 1V10a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4z"
        fill="#1268ff"
        fillOpacity={0.15}
        stroke="#1268ff"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function IssueIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
      <circle cx="6" cy="6" r="4.5" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="6" cy="6" r="2" fill="#94a3b8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M5.5 1v9M1 5.5h9" stroke="#1268ff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default WeeklyGrid;
