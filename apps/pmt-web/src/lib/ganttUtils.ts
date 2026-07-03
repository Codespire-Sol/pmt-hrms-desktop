import {
  getISOWeek,
  startOfISOWeek,
  addDays,
  format,
  startOfDay,
  differenceInCalendarDays,
  isWeekend,
  isSameDay,
} from 'date-fns';

// ─── Project Color Palette ──────────────────────────────────────────────────

const PROJECT_COLORS = [
  '#1268ff', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
];

export function getProjectColor(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

// ─── Milestone Detection ────────────────────────────────────────────────────

export function isMilestone(issueTypeName?: string): boolean {
  if (!issueTypeName) return false;
  return issueTypeName.toLowerCase() === 'milestone';
}

// ─── Day Cell ───────────────────────────────────────────────────────────────

export interface DayCell {
  date: Date;
  label: string;       // e.g., "3" (just day number)
  dayLabel: string;     // e.g., "Mon"
  isToday: boolean;
  isWeekend: boolean;
}

export function generateDayCells(rangeStart: Date, rangeEnd: Date): DayCell[] {
  const cells: DayCell[] = [];
  const today = startOfDay(new Date());
  let cursor = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);

  while (cursor <= end) {
    cells.push({
      date: new Date(cursor),
      label: format(cursor, 'd'),
      dayLabel: format(cursor, 'EEE'),
      isToday: isSameDay(cursor, today),
      isWeekend: isWeekend(cursor),
    });
    cursor = addDays(cursor, 1);
  }
  return cells;
}

// ─── Week Header ────────────────────────────────────────────────────────────

export interface WeekHeader {
  weekNumber: number;
  label: string;          // "Week 1 Jan 3 - Jan 9"
  shortLabel: string;     // "W1 Jan 3-9"
  start: Date;
  end: Date;
  days: DayCell[];
  isCurrentWeek: boolean;
}

export function generateWeekHeaders(rangeStart: Date, rangeEnd: Date): WeekHeader[] {
  const headers: WeekHeader[] = [];
  const today = startOfDay(new Date());
  const currentWeekStart = startOfISOWeek(today);

  let cursor = startOfISOWeek(rangeStart);
  const end = startOfDay(rangeEnd);

  while (cursor <= end) {
    const weekStart = new Date(cursor);
    const weekEnd = addDays(weekStart, 6);
    const weekNum = getISOWeek(weekStart);

    const startMonth = format(weekStart, 'MMM');
    const endMonth = format(weekEnd, 'MMM');
    const startDay = format(weekStart, 'd');
    const endDay = format(weekEnd, 'd');

    const label = startMonth === endMonth
      ? `Week ${weekNum} ${startMonth} ${startDay} - ${endDay}`
      : `Week ${weekNum} ${startMonth} ${startDay} - ${endMonth} ${endDay}`;

    const shortLabel = startMonth === endMonth
      ? `W${weekNum} ${startMonth} ${startDay}-${endDay}`
      : `W${weekNum} ${startMonth} ${startDay}-${endMonth} ${endDay}`;

    // Generate day cells within this week, clamped to range
    const dayStart = weekStart < rangeStart ? startOfDay(rangeStart) : weekStart;
    const dayEnd = weekEnd > rangeEnd ? startOfDay(rangeEnd) : weekEnd;
    const days = generateDayCells(dayStart, dayEnd);

    headers.push({
      weekNumber: weekNum,
      label,
      shortLabel,
      start: weekStart,
      end: weekEnd,
      days,
      isCurrentWeek: isSameDay(weekStart, currentWeekStart),
    });

    cursor = addDays(weekStart, 7);
  }
  return headers;
}

// ─── Week Label (standalone) ────────────────────────────────────────────────

export function getWeekLabel(d: Date): string {
  const weekNum = getISOWeek(d);
  const weekStart = startOfISOWeek(d);
  const weekEnd = addDays(weekStart, 6);
  const startMonth = format(weekStart, 'MMM');
  const endMonth = format(weekEnd, 'MMM');
  if (startMonth === endMonth) {
    return `Week ${weekNum} ${startMonth} ${format(weekStart, 'd')}-${format(weekEnd, 'd')}`;
  }
  return `Week ${weekNum} ${startMonth} ${format(weekStart, 'd')} - ${endMonth} ${format(weekEnd, 'd')}`;
}

// ─── Summary Bar Calculation ────────────────────────────────────────────────

export interface SummaryBarMetrics {
  minStartDate: Date;
  maxEndDate: Date;
  totalItems: number;
  avgProgress: number;
  overdueCount: number;
  durationDays: number;
}

export function calculateSummaryBar(
  items: Array<{ startDate: string; endDate: string; progress: number; isOverdue: boolean }>
): SummaryBarMetrics | null {
  if (items.length === 0) return null;

  let minStart = Infinity;
  let maxEnd = -Infinity;
  let totalProgress = 0;
  let overdueCount = 0;

  for (const item of items) {
    const s = new Date(item.startDate).getTime();
    const e = new Date(item.endDate).getTime();
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
    totalProgress += item.progress;
    if (item.isOverdue) overdueCount++;
  }

  if (minStart === Infinity || maxEnd === -Infinity) return null;

  const minStartDate = new Date(minStart);
  const maxEndDate = new Date(maxEnd);

  return {
    minStartDate,
    maxEndDate,
    totalItems: items.length,
    avgProgress: Math.round(totalProgress / items.length),
    overdueCount,
    durationDays: differenceInCalendarDays(maxEndDate, minStartDate) + 1,
  };
}
