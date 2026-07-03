import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useLazyGetTimesheetHistoryQuery } from '../timeTrackingApi';
import type { TimesheetHistoryDayBucket } from '../types';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TS,
  cardClass,
  segmentedContainerClass,
  segmentActiveClass,
  segmentInactiveClass,
  tooltipClass,
} from './timesheet-styles';

const LABEL_WIDTH = 220;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 52;
const MIN_COL_WIDTH = 32;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const cur = new Date(s);
  while (cur <= e) {
    dates.push(fmtDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  r.setDate(1);
  r.setHours(0, 0, 0, 0);
  return r;
}

function getCellColor(hours: number): string {
  if (hours === 0) return TS.gridHeaderBg;
  if (hours < 2) return '#dbeafe';
  if (hours < 4) return '#93c5fd';
  if (hours < 8) return '#3b82f6';
  return '#1d4ed8';
}

function getCellTextColor(hours: number): string {
  if (hours === 0) return 'transparent';
  if (hours < 4) return '#1e40af';
  return '#fff';
}

type GanttPeriod = 'week' | 'month' | 'last_month' | 'custom';

interface IssueRow {
  issueId: string;
  issueKey: string;
  issueTitle?: string;
  workedHours: number;
}

interface Props {
  defaultDayBuckets: TimesheetHistoryDayBucket[];
  defaultIssues: IssueRow[];
  defaultStartDate: string;
  defaultEndDate: string;
  userId?: string;
  projectId?: string;
  issueId?: string;
  onLogClick?: (issueId: string, date: string) => void;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  issueKey: string;
  date: string;
  hours: number;
  logCount: number;
}

export function TimesheetGanttChart({
  defaultDayBuckets, defaultIssues, defaultStartDate, defaultEndDate,
  userId, projectId, issueId, onLogClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const today = fmtDate(new Date());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [period, setPeriod] = useState<GanttPeriod>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [monthRef, setMonthRef] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const { startDate, endDate } = useMemo(() => {
    if (period === 'week') return { startDate: defaultStartDate, endDate: defaultEndDate };
    if (period === 'month') {
      const s = monthRef;
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
      return { startDate: fmtDate(s), endDate: fmtDate(e) };
    }
    if (period === 'last_month') {
      const now = new Date();
      const s = addMonths(now, -1);
      const e = new Date(s.getFullYear(), s.getMonth() + 1, 0);
      return { startDate: fmtDate(s), endDate: fmtDate(e) };
    }
    return {
      startDate: customStart || defaultStartDate,
      endDate: customEnd || defaultEndDate,
    };
  }, [period, monthRef, customStart, customEnd, defaultStartDate, defaultEndDate]);

  const [fetchHistory, { data: fetchedData, isFetching }] = useLazyGetTimesheetHistoryQuery();

  useEffect(() => {
    if (period !== 'week' && startDate && endDate) {
      fetchHistory({ startDate, endDate, userId, projectId, issueId, groupBy: 'day', limit: 1000 });
    }
  }, [period, startDate, endDate]);

  const activeBuckets = period === 'week' ? defaultDayBuckets : (fetchedData?.data?.dayBuckets || []);

  // Build heatmap
  const heatmap = useMemo(() => {
    const map = new Map<string, Map<string, { hours: number; logCount: number }>>();
    for (const bucket of activeBuckets) {
      for (const log of bucket.logs) {
        if (!map.has(log.issueId)) map.set(log.issueId, new Map());
        const issueMap = map.get(log.issueId)!;
        const cur = issueMap.get(bucket.date) || { hours: 0, logCount: 0 };
        issueMap.set(bucket.date, { hours: cur.hours + Number(log.hoursWorked), logCount: cur.logCount + 1 });
      }
    }
    return map;
  }, [activeBuckets]);

  // Build daily totals
  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const bucket of activeBuckets) {
      for (const log of bucket.logs) {
        totals.set(bucket.date, (totals.get(bucket.date) ?? 0) + Number(log.hoursWorked));
      }
    }
    return totals;
  }, [activeBuckets]);

  const issueRows = useMemo<IssueRow[]>(() => {
    if (period === 'week') return defaultIssues;
    const issueMap = new Map<string, IssueRow>();
    for (const bucket of activeBuckets) {
      for (const log of bucket.logs) {
        const existing = issueMap.get(log.issueId);
        if (!existing) {
          issueMap.set(log.issueId, {
            issueId: log.issueId,
            issueKey: log.issue?.issueKey || log.issueId.slice(0, 8),
            issueTitle: log.issue?.title,
            workedHours: Number(log.hoursWorked),
          });
        } else {
          existing.workedHours += Number(log.hoursWorked);
        }
      }
    }
    return Array.from(issueMap.values()).sort((a, b) => b.workedHours - a.workedHours);
  }, [period, defaultIssues, activeBuckets]);

  const dateRange = useMemo(() => generateDateRange(startDate, endDate), [startDate, endDate]);
  const colWidth = Math.max(MIN_COL_WIDTH, Math.floor((containerWidth - LABEL_WIDTH) / dateRange.length));
  const svgWidth = LABEL_WIDTH + dateRange.length * colWidth;
  const svgHeight = HEADER_HEIGHT + Math.max(issueRows.length + 1, 2) * ROW_HEIGHT; // +1 for summary row

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, issueKey: '', date: '', hours: 0, logCount: 0,
  });

  const handleCellMouseEnter = useCallback((e: React.MouseEvent, issueKey: string, date: string, hours: number, logCount: number) => {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setTooltip({
      visible: true,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 10,
      issueKey, date, hours, logCount,
    });
  }, []);

  const handleCellMouseLeave = useCallback(() => {
    setTooltip((t) => ({ ...t, visible: false }));
  }, []);

  const navMonth = (dir: number) => {
    setMonthRef((m) => addMonths(m, dir));
  };

  const periodLabels: Record<GanttPeriod, string> = {
    week: 'This Week',
    month: 'This Month',
    last_month: 'Last Month',
    custom: 'Custom',
  };

  return (
    <div className="space-y-4">
      {/* Period controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={segmentedContainerClass}>
          {(['week', 'month', 'last_month', 'custom'] as GanttPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'cursor-pointer select-none whitespace-nowrap',
                period === p ? segmentActiveClass : segmentInactiveClass,
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {period === 'month' && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-[#F2F4F7]" onClick={() => navMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[13px] font-bold px-2" style={{ color: TS.textSecondary }}>
              {MONTHS[monthRef.getMonth()]} {monthRef.getFullYear()}
            </span>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-[#F2F4F7]" onClick={() => navMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-9 rounded-xl text-[13px] w-36 border-[#eaecf0]"
            />
            <span className="text-[13px] font-medium" style={{ color: TS.textMuted }}>→</span>
            <Input
              type="date"
              value={customEnd}
              min={customStart}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-9 rounded-xl text-[13px] w-36 border-[#eaecf0]"
            />
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 ml-auto">
          {[
            { color: TS.gridHeaderBg, label: 'No logs', border: TS.border },
            { color: '#dbeafe', label: '< 2h', border: '#93c5fd' },
            { color: '#93c5fd', label: '2–4h', border: '#60a5fa' },
            { color: '#3b82f6', label: '4–8h', border: '#2563eb' },
            { color: '#1d4ed8', label: '8h+', border: '#1e40af' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ background: item.color, border: `1px solid ${item.border}` }}
              />
              <span className="text-[11px] font-medium" style={{ color: TS.textTertiary }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isFetching && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-full rounded-[12px]" />)}
        </div>
      )}

      {/* Gantt SVG */}
      {!isFetching && (
        <div
          ref={containerRef}
          className={cn(cardClass, 'relative overflow-auto')}
          style={{ maxHeight: 560 }}
        >
          {/* Sticky issue label overlay */}
          <div
            className="absolute top-0 left-0 z-10 pointer-events-none"
            style={{ width: LABEL_WIDTH }}
          >
            <div
              style={{
                height: HEADER_HEIGHT,
                background: TS.gridHeaderBg,
                borderBottom: `1px solid ${TS.border}`,
                borderRight: `2px solid ${TS.border}`,
              }}
            />
            {issueRows.map((row, i) => (
              <div
                key={row.issueId}
                style={{
                  height: ROW_HEIGHT,
                  borderBottom: `1px solid ${TS.borderSubtle}`,
                  borderRight: `2px solid ${TS.border}`,
                  background: i % 2 === 0 ? '#fff' : TS.gridRowAlt,
                  padding: '0 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <span className="text-[12px] font-bold truncate" style={{ color: TS.textPrimary }}>{row.issueKey}</span>
                {row.issueTitle && (
                  <span className="text-[10px] truncate" style={{ color: TS.textMuted }}>{row.issueTitle}</span>
                )}
              </div>
            ))}
            {/* Summary row label */}
            {issueRows.length > 0 && (
              <div
                style={{
                  height: ROW_HEIGHT,
                  borderRight: `2px solid ${TS.border}`,
                  borderTop: `2px solid ${TS.border}`,
                  background: TS.gridTotalsBg,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 800,
                  fontSize: 12,
                  color: TS.textPrimary,
                }}
              >
                Total
              </div>
            )}
            {issueRows.length === 0 && (
              <div
                style={{
                  height: ROW_HEIGHT * 3,
                  borderRight: `2px solid ${TS.border}`,
                  background: '#fff',
                }}
              />
            )}
          </div>

          {/* SVG grid */}
          <svg
            width={svgWidth}
            height={Math.max(svgHeight, HEADER_HEIGHT + ROW_HEIGHT)}
            style={{ display: 'block' }}
          >
            {/* Header background */}
            <rect x={0} y={0} width={svgWidth} height={HEADER_HEIGHT} fill={TS.gridHeaderBg} />
            <line x1={0} y1={HEADER_HEIGHT} x2={svgWidth} y2={HEADER_HEIGHT} stroke={TS.border} strokeWidth={1} />

            {/* Date column headers */}
            {dateRange.map((date, i) => {
              const x = LABEL_WIDTH + i * colWidth;
              const d = new Date(date + 'T00:00:00');
              const dow = d.getDay();
              const isToday = date === today;
              const isWeekend = dow === 0 || dow === 6;
              return (
                <g key={date}>
                  {isWeekend && (
                    <rect
                      x={x}
                      y={HEADER_HEIGHT}
                      width={colWidth}
                      height={Math.max(issueRows.length + 1, 1) * ROW_HEIGHT}
                      fill="rgba(0,0,0,0.015)"
                    />
                  )}
                  {isToday && (
                    <>
                      <rect x={x} y={0} width={colWidth} height={HEADER_HEIGHT} fill={TS.gridTodayTint} />
                      <line x1={x} y1={0} x2={x} y2={svgHeight} stroke={TS.primary} strokeWidth={1.5} opacity={0.4} />
                    </>
                  )}
                  {colWidth >= 28 && (
                    <text
                      x={x + colWidth / 2}
                      y={HEADER_HEIGHT / 2 - 4}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={600}
                      fill={isToday ? TS.primary : isWeekend ? '#94a3b8' : '#9ca3af'}
                    >
                      {DAY_NAMES[dow]}
                    </text>
                  )}
                  <text
                    x={x + colWidth / 2}
                    y={HEADER_HEIGHT / 2 + 9}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={isToday ? 800 : 600}
                    fill={isToday ? TS.primary : isWeekend ? '#94a3b8' : TS.textPrimary}
                  >
                    {d.getDate()}
                  </text>
                  {d.getDate() === 1 && colWidth >= 32 && (
                    <text x={x + 4} y={12} textAnchor="start" fontSize={9} fontWeight={700} fill="#94a3b8">
                      {MONTHS[d.getMonth()]}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Issue rows */}
            {issueRows.length === 0 ? (
              <text
                x={LABEL_WIDTH + (svgWidth - LABEL_WIDTH) / 2}
                y={HEADER_HEIGHT + ROW_HEIGHT / 2 + 5}
                textAnchor="middle"
                fontSize={13}
                fill={TS.textMuted}
                fontWeight={500}
              >
                No time logged in this period
              </text>
            ) : (
              <>
                {issueRows.map((row, rowIdx) => {
                  const y = HEADER_HEIGHT + rowIdx * ROW_HEIGHT;
                  const issueHeatmap = heatmap.get(row.issueId);
                  return (
                    <g key={row.issueId}>
                      <rect
                        x={LABEL_WIDTH}
                        y={y}
                        width={svgWidth - LABEL_WIDTH}
                        height={ROW_HEIGHT}
                        fill={rowIdx % 2 === 0 ? '#fff' : TS.gridRowAlt}
                      />
                      <line x1={LABEL_WIDTH} y1={y + ROW_HEIGHT} x2={svgWidth} y2={y + ROW_HEIGHT} stroke={TS.borderSubtle} strokeWidth={1} />
                      {dateRange.map((date, colIdx) => {
                        const cx = LABEL_WIDTH + colIdx * colWidth;
                        const cell = issueHeatmap?.get(date) || { hours: 0, logCount: 0 };
                        const color = getCellColor(cell.hours);
                        const textColor = getCellTextColor(cell.hours);
                        return (
                          <g key={date}>
                            <rect
                              x={cx + 1}
                              y={y + 2}
                              width={colWidth - 2}
                              height={ROW_HEIGHT - 4}
                              rx={4}
                              fill={color}
                              style={{ cursor: onLogClick ? 'pointer' : 'default' }}
                              onMouseEnter={(e) =>
                                handleCellMouseEnter(e, row.issueKey, date, cell.hours, cell.logCount)
                              }
                              onMouseLeave={handleCellMouseLeave}
                              onClick={() => {
                                if (onLogClick) onLogClick(row.issueId, date);
                              }}
                            />
                            {cell.hours > 0 && colWidth >= 40 && (
                              <text
                                x={cx + colWidth / 2}
                                y={y + ROW_HEIGHT / 2 + 4}
                                textAnchor="middle"
                                fontSize={10}
                                fontWeight={700}
                                fill={textColor}
                                style={{ pointerEvents: 'none' }}
                              >
                                {cell.hours.toFixed(1)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                {/* Summary totals row */}
                {(() => {
                  const summaryY = HEADER_HEIGHT + issueRows.length * ROW_HEIGHT;
                  return (
                    <g>
                      <rect x={LABEL_WIDTH} y={summaryY} width={svgWidth - LABEL_WIDTH} height={ROW_HEIGHT} fill={TS.gridTotalsBg} />
                      <line x1={LABEL_WIDTH} y1={summaryY} x2={svgWidth} y2={summaryY} stroke={TS.border} strokeWidth={2} />
                      {dateRange.map((date, colIdx) => {
                        const cx = LABEL_WIDTH + colIdx * colWidth;
                        const total = dailyTotals.get(date) ?? 0;
                        return (
                          <text
                            key={date}
                            x={cx + colWidth / 2}
                            y={summaryY + ROW_HEIGHT / 2 + 4}
                            textAnchor="middle"
                            fontSize={10}
                            fontWeight={800}
                            fill={total > 0 ? TS.textPrimary : '#b0bec9'}
                          >
                            {total > 0 ? total.toFixed(1) : '—'}
                          </text>
                        );
                      })}
                    </g>
                  );
                })()}
              </>
            )}
          </svg>

          {/* Tooltip */}
          {tooltip.visible && (
            <div
              className={cn(tooltipClass, 'absolute z-30 pointer-events-none')}
              style={{
                left: tooltip.x,
                top: tooltip.y - 80,
                transform: 'translateX(-50%)',
                minWidth: 140,
              }}
            >
              <p className="font-bold" style={{ color: TS.textPrimary }}>{tooltip.issueKey}</p>
              <p className="text-[11px] mb-1" style={{ color: TS.textTertiary }}>{tooltip.date}</p>
              {tooltip.hours > 0 ? (
                <>
                  <p className="font-semibold" style={{ color: TS.primary }}>{tooltip.hours.toFixed(1)}h logged</p>
                  <p className="text-[11px]" style={{ color: TS.textMuted }}>{tooltip.logCount} log{tooltip.logCount > 1 ? 's' : ''}</p>
                </>
              ) : (
                <p className="text-[11px]" style={{ color: TS.textMuted }}>No time logged</p>
              )}
              {onLogClick && tooltip.hours === 0 && (
                <p className="text-[11px] font-semibold mt-1" style={{ color: TS.primary }}>Click to log time</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isFetching && issueRows.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: TS.borderSubtle }}>
            <CalendarDays className="h-8 w-8" style={{ color: TS.textMuted }} />
          </div>
          <p className="text-[15px] font-semibold" style={{ color: TS.textTertiary }}>No time logged in this period</p>
          <p className="text-[13px]" style={{ color: TS.textMuted }}>
            Log time on issues to see them on the Gantt heatmap
          </p>
        </div>
      )}
    </div>
  );
}

export default TimesheetGanttChart;
