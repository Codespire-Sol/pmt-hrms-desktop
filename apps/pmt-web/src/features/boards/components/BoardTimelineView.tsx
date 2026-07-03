import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useIssueModal } from '../../issues/IssueDetailModal';
import { Avatar, Button, Empty, Select, Tag, Tooltip, Typography, theme } from 'antd';
import { CalendarX2, Filter, ZoomIn, ZoomOut, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import type { BoardColumn } from '../boardsApi';
import type { Issue } from '../../issues/issuesApi';
import { normalizeAvatarUrl } from '../../../lib/utils';
import type { TimelineDependencyLink } from '@/features/timeline/timelineApi';
import { generateWeekHeaders, isMilestone as checkMilestone } from '@/lib/ganttUtils';

const { Text } = Typography;

interface BoardTimelineViewProps {
  columns: BoardColumn[];
  projectId?: string;
  dependencyLinks?: TimelineDependencyLink[];
}

type ZoomLevel = 'days' | 'weeks' | 'months' | 'quarters';
type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done';
type GroupBy = 'none' | 'status' | 'assignee';

interface TimelineIssue extends Issue {
  statusName: string;
  statusColor: string;
  statusCategory: string;
}

interface IssueGroup {
  key: string;
  label: string;
  color: string;
  items: TimelineIssue[];
}

const COLORS = {
  primary: '#1268ff',
  success: '#10b981',
  warning: '#f59e0b',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  textMuted: '#6a7282',
  border: '#e5e7eb',
  todayLine: '#ef4444',
  todo: '#9ca3af',
  inProgress: '#3b82f6',
  done: '#10b981',
  dependency: '#6366f1',
  bg: '#f9fafb',
};

const STATUS_CATEGORY_COLORS: Record<string, string> = {
  todo: COLORS.todo,
  to_do: COLORS.todo,
  in_progress: COLORS.inProgress,
  inprogress: COLORS.inProgress,
  done: COLORS.done,
};

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const GROUP_BY_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: 'none', label: 'No grouping' },
  { value: 'status', label: 'By status' },
  { value: 'assignee', label: 'By assignee' },
];

const LEFT_PANEL_WIDTH = 320;
const ROW_HEIGHT = 46;
const DAY_CELL_WIDTH = 40;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(d1: Date, d2: Date): number {
  const oneDay = 86400000;
  return Math.round((d2.getTime() - d1.getTime()) / oneDay);
}

function startOfDay(d: Date): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(d: Date): Date {
  const result = startOfDay(d);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date): Date {
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), quarterStartMonth, 1);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatWeek(d: Date): string {
  const end = addDays(d, 6);
  const sm = d.toLocaleDateString('en-US', { month: 'short' });
  const em = end.toLocaleDateString('en-US', { month: 'short' });
  if (sm === em) return `${sm} ${d.getDate()}-${end.getDate()}`;
  return `${sm} ${d.getDate()} - ${em} ${end.getDate()}`;
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'narrow' });
}

function formatQuarter(d: Date): string {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

function normalizeStatusCategory(rawValue?: string): 'todo' | 'in_progress' | 'done' {
  const value = String(rawValue || '').toLowerCase().replace('-', '_');
  if (value.includes('done')) return 'done';
  if (value.includes('progress')) return 'in_progress';
  return 'todo';
}

function fmtDate(d: Date | string): string {
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    return format(date, 'MMM d');
  } catch {
    return String(d);
  }
}

export function BoardTimelineView({ columns, projectId, dependencyLinks = [] }: BoardTimelineViewProps) {
  const navigate = useNavigate();
  const { openIssue } = useIssueModal();
  const { projectId: projectIdFromRoute } = useParams<{ projectId: string }>();
  const effectiveProjectId = projectId || projectIdFromRoute || '';

  const [zoom, setZoom] = useState<ZoomLevel>('weeks');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { token } = theme.useToken();

  const {
    scheduledIssues,
    unscheduledIssues,
    cells,
    dayCells,
    weekHeadersForDays,
    timelineStart,
    timelineEnd,
    totalDays,
  } = useMemo(() => {
    const allIssues: TimelineIssue[] = columns.flatMap((column) =>
      (column.issues || []).map((issue: any) => ({
        ...issue,
        statusName: column.displayName || column.name,
        statusColor: column.color || '#6b7280',
        statusCategory: normalizeStatusCategory(issue?.status?.category || column.category),
      }))
    );

    const statusFiltered =
      statusFilter === 'all'
        ? allIssues
        : allIssues.filter((issue) => issue.statusCategory === statusFilter);

    const scheduled = statusFiltered.filter((issue) => issue.startDate || issue.dueDate);
    const unscheduled = statusFiltered.filter((issue) => !issue.startDate && !issue.dueDate);

    if (scheduled.length === 0) {
      return {
        scheduledIssues: [],
        unscheduledIssues: unscheduled,
        cells: [],
        dayCells: [],
        weekHeadersForDays: null,
        timelineStart: null,
        timelineEnd: null,
        totalDays: 0,
      };
    }

    const today = startOfDay(new Date());
    let minDate = today;
    let maxDate = addDays(today, 14);

    scheduled.forEach((issue) => {
      const start = issue.startDate ? startOfDay(new Date(issue.startDate)) : null;
      const end = issue.dueDate ? startOfDay(new Date(issue.dueDate)) : null;
      const effectiveStart = start || end;
      const effectiveEnd = end || start;

      if (effectiveStart && effectiveStart < minDate) minDate = effectiveStart;
      if (effectiveEnd && effectiveEnd > maxDate) maxDate = effectiveEnd;
    });

    minDate = addDays(minDate, -7);
    maxDate = addDays(maxDate, 7);

    const generatedCells: Array<{ start: Date; end: Date; label: string; isToday: boolean; isWeekend?: boolean }> = [];
    let cursor: Date;

    if (zoom === 'days') {
      // Generate day-level cells
      cursor = startOfWeek(minDate);
      const endDay = addDays(maxDate, 1);
      while (cursor <= endDay) {
        const cellStart = new Date(cursor);
        const cellEnd = addDays(cellStart, 1);
        const isToday = daysBetween(today, cellStart) === 0;
        const dayOfWeek = cellStart.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        generatedCells.push({
          start: cellStart,
          end: cellEnd,
          label: `${formatDayShort(cellStart)} ${cellStart.getDate()}`,
          isToday,
          isWeekend,
        });
        cursor = cellEnd;
      }
    } else if (zoom === 'weeks') {
      cursor = startOfWeek(minDate);
      while (cursor <= maxDate) {
        const cellStart = new Date(cursor);
        const cellEnd = addDays(cellStart, 7);
        const isToday = today >= cellStart && today < cellEnd;
        generatedCells.push({ start: cellStart, end: cellEnd, label: formatWeek(cellStart), isToday });
        cursor = cellEnd;
      }
    } else if (zoom === 'months') {
      cursor = startOfMonth(minDate);
      while (cursor <= maxDate) {
        const cellStart = new Date(cursor);
        const cellEnd = addMonths(cellStart, 1);
        const isToday = today >= cellStart && today < cellEnd;
        generatedCells.push({ start: cellStart, end: cellEnd, label: formatMonth(cellStart), isToday });
        cursor = cellEnd;
      }
    } else {
      cursor = startOfQuarter(minDate);
      while (cursor <= maxDate) {
        const cellStart = new Date(cursor);
        const cellEnd = addMonths(cellStart, 3);
        const isToday = today >= cellStart && today < cellEnd;
        generatedCells.push({ start: cellStart, end: cellEnd, label: formatQuarter(cellStart), isToday });
        cursor = cellEnd;
      }
    }

    const start = generatedCells[0]?.start ?? null;
    const end = generatedCells[generatedCells.length - 1]?.end ?? null;
    const days = start && end ? Math.max(daysBetween(start, end), 1) : 0;

    // Generate week headers for days view
    let weekHeaders = null;
    if (zoom === 'days' && start && end) {
      weekHeaders = generateWeekHeaders(start, end);
    }

    return {
      scheduledIssues: scheduled,
      unscheduledIssues: unscheduled,
      cells: generatedCells,
      dayCells: zoom === 'days' ? generatedCells : [],
      weekHeadersForDays: weekHeaders,
      timelineStart: start,
      timelineEnd: end,
      totalDays: days,
    };
  }, [columns, zoom, statusFilter]);

  // Grouping logic
  const groupedIssues = useMemo((): IssueGroup[] => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All Issues', color: COLORS.primary, items: scheduledIssues }];
    }
    if (groupBy === 'status') {
      const groups = new Map<string, IssueGroup>();
      const order = ['todo', 'in_progress', 'done'];
      for (const cat of order) {
        const catLabel = cat === 'todo' ? 'To Do' : cat === 'in_progress' ? 'In Progress' : 'Done';
        groups.set(cat, { key: cat, label: catLabel, color: STATUS_CATEGORY_COLORS[cat] || COLORS.todo, items: [] });
      }
      for (const issue of scheduledIssues) {
        const cat = issue.statusCategory;
        if (!groups.has(cat)) {
          groups.set(cat, { key: cat, label: cat, color: STATUS_CATEGORY_COLORS[cat] || COLORS.todo, items: [] });
        }
        groups.get(cat)!.items.push(issue);
      }
      return Array.from(groups.values()).filter(g => g.items.length > 0);
    }
    // Assignee grouping
    const groups = new Map<string, IssueGroup>();
    const assigneeColors = ['#1268ff', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#06b6d4'];
    let colorIdx = 0;
    for (const issue of scheduledIssues) {
      const key = issue.assignee?.id || 'unassigned';
      const label = issue.assignee?.displayName || 'Unassigned';
      if (!groups.has(key)) {
        groups.set(key, { key, label, color: assigneeColors[colorIdx++ % assigneeColors.length], items: [] });
      }
      groups.get(key)!.items.push(issue);
    }
    return Array.from(groups.values());
  }, [scheduledIssues, groupBy]);

  // Auto-expand all groups when groupBy changes
  useEffect(() => {
    setExpandedGroups(new Set(groupedIssues.map(g => g.key)));
  }, [groupBy, groupedIssues.length]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getBarMetrics = useCallback(
    (issue: TimelineIssue) => {
      if (!timelineStart || !timelineEnd || totalDays <= 0) return null;

      const hasStart = !!issue.startDate;
      const hasEnd = !!issue.dueDate;

      const issueStart = issue.startDate
        ? startOfDay(new Date(issue.startDate))
        : issue.dueDate
          ? startOfDay(new Date(issue.dueDate))
          : null;
      const issueEnd = issue.dueDate
        ? startOfDay(new Date(issue.dueDate))
        : issue.startDate
          ? startOfDay(new Date(issue.startDate))
          : null;

      if (!issueStart || !issueEnd) return null;

      let startDay = Math.max(0, daysBetween(timelineStart, issueStart));
      let endDay = Math.max(startDay + 1, daysBetween(timelineStart, addDays(issueEnd, 1)));

      // When only one date is set, ensure a minimum 3-day visual width
      if ((!hasStart || !hasEnd) && (endDay - startDay) < 3) {
        if (!hasStart) {
          // Only dueDate: extend bar to the left
          startDay = Math.max(0, endDay - 3);
        } else {
          // Only startDate: extend bar to the right
          endDay = startDay + 3;
        }
      }

      const leftPct = (startDay / totalDays) * 100;
      const widthPct = ((endDay - startDay) / totalDays) * 100;

      return {
        startDay,
        endDay,
        leftPct,
        widthPct: Math.max(widthPct, 0.5),
        partial: !hasStart || !hasEnd,
      };
    },
    [timelineStart, timelineEnd, totalDays]
  );

  const cellWidth = zoom === 'days' ? DAY_CELL_WIDTH : zoom === 'weeks' ? 128 : zoom === 'months' ? 170 : 220;
  const totalWidth = Math.max(cells.length * cellWidth, 240);

  // Flatten all visible issues for dependency path computation (respecting group expansion)
  const visibleIssues = useMemo(() => {
    const result: TimelineIssue[] = [];
    for (const group of groupedIssues) {
      if (groupBy === 'none' || expandedGroups.has(group.key)) {
        result.push(...group.items);
      }
    }
    return result;
  }, [groupedIssues, expandedGroups, groupBy]);

  const issueBarMap = useMemo(() => {
    const barMap = new Map<string, { rowIndex: number; startDay: number; endDay: number }>();
    // Compute global row index accounting for group headers
    let rowIdx = 0;
    for (const group of groupedIssues) {
      if (groupBy !== 'none') rowIdx++; // group header row
      if (groupBy === 'none' || expandedGroups.has(group.key)) {
        for (const issue of group.items) {
          const metrics = getBarMetrics(issue);
          if (metrics) {
            barMap.set(issue.id, { rowIndex: rowIdx, startDay: metrics.startDay, endDay: metrics.endDay });
          }
          rowIdx++;
        }
      }
    }
    return barMap;
  }, [groupedIssues, expandedGroups, groupBy, getBarMetrics]);

  const totalVisibleRows = useMemo(() => {
    let count = 0;
    for (const group of groupedIssues) {
      if (groupBy !== 'none') count++; // group header
      if (groupBy === 'none' || expandedGroups.has(group.key)) {
        count += group.items.length;
      }
    }
    return count;
  }, [groupedIssues, expandedGroups, groupBy]);

  const dependencyPaths = useMemo(() => {
    if (dependencyLinks.length === 0 || totalDays <= 0) return [];

    return dependencyLinks
      .map((dependency, index) => {
        const source = issueBarMap.get(dependency.sourceIssueId);
        const target = issueBarMap.get(dependency.targetIssueId);
        if (!source || !target) return null;

        const x1 = (source.endDay / totalDays) * totalWidth;
        const x2 = (target.startDay / totalDays) * totalWidth;
        const y1 = source.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const y2 = target.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        const distance = Math.abs(x2 - x1);
        const curve = Math.max(24, distance * 0.35);
        const c1x = x1 + curve;
        const c2x = x2 - curve;

        return {
          id: `${dependency.sourceIssueId}-${dependency.targetIssueId}-${index}`,
          path: `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`,
          markerX: x2,
          markerY: y2,
          label: dependency.linkType || 'depends_on',
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        path: string;
        markerX: number;
        markerY: number;
        label: string;
      }>;
  }, [dependencyLinks, issueBarMap, totalDays, totalWidth]);

  const getTodayPosition = useCallback(() => {
    if (!timelineStart || !timelineEnd || totalDays <= 0) return null;
    const today = startOfDay(new Date());
    const offset = daysBetween(timelineStart, today);
    if (offset < 0 || offset > totalDays) return null;
    return `${(offset / totalDays) * 100}%`;
  }, [timelineStart, timelineEnd, totalDays]);

  const todayPos = getTodayPosition();

  const handleZoomIn = () => {
    if (zoom === 'quarters') setZoom('months');
    else if (zoom === 'months') setZoom('weeks');
    else if (zoom === 'weeks') setZoom('days');
  };

  const handleZoomOut = () => {
    if (zoom === 'days') setZoom('weeks');
    else if (zoom === 'weeks') setZoom('months');
    else if (zoom === 'months') setZoom('quarters');
  };

  const goToIssue = (issueId: string) => {
    openIssue(issueId, effectiveProjectId || undefined);
  };

  // Summary bar metrics for collapsed groups
  const getGroupSummaryBar = useCallback((items: TimelineIssue[]) => {
    if (!timelineStart || !timelineEnd || totalDays <= 0 || items.length === 0) return null;
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const issue of items) {
      const s = issue.startDate ? new Date(issue.startDate).getTime() : issue.dueDate ? new Date(issue.dueDate).getTime() : null;
      const e = issue.dueDate ? new Date(issue.dueDate).getTime() : issue.startDate ? new Date(issue.startDate).getTime() : null;
      if (s && s < minStart) minStart = s;
      if (e && e > maxEnd) maxEnd = e;
    }
    if (minStart === Infinity) return null;
    const startDay = Math.max(0, daysBetween(timelineStart, new Date(minStart)));
    const endDay = Math.max(startDay + 1, daysBetween(timelineStart, addDays(new Date(maxEnd), 1)));
    return {
      leftPct: (startDay / totalDays) * 100,
      widthPct: Math.max(((endDay - startDay) / totalDays) * 100, 1),
    };
  }, [timelineStart, timelineEnd, totalDays]);

  if (scheduledIssues.length === 0 && unscheduledIssues.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <Empty
          image={<CalendarX2 size={48} style={{ color: COLORS.textSecondary }} />}
          description={
            <div>
              <Text strong>No issues to display</Text>
              <br />
              <Text type="secondary">Add start or due dates to issues to see them on the timeline.</Text>
            </div>
          }
        />
      </div>
    );
  }

  // Render a single issue row (left panel + right bar)
  const renderIssueLeftPanel = (issue: TimelineIssue) => (
    <div
      key={`left-${issue.id}`}
      onClick={() => goToIssue(issue.id)}
      style={{
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: groupBy !== 'none' ? '0 12px 0 28px' : '0 12px',
        gap: '8px',
        cursor: effectiveProjectId ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.bg; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <Text style={{ fontSize: 11, fontWeight: 600, color: COLORS.primary, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {issue.issueKey}
      </Text>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12, color: COLORS.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {issue.title}
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.textMuted }}>
          {issue.startDate && issue.dueDate
            ? `${fmtDate(issue.startDate)} – ${fmtDate(issue.dueDate)}`
            : issue.dueDate
              ? `Due ${fmtDate(issue.dueDate)}`
              : issue.startDate
                ? `Start ${fmtDate(issue.startDate)}`
                : ''}
        </Text>
      </div>
      {issue.assignee && (
        <Tooltip title={issue.assignee.displayName}>
          <Avatar
            size={20}
            src={normalizeAvatarUrl(issue.assignee.avatarUrl)}
            style={{ backgroundColor: COLORS.primary, fontSize: 10, flexShrink: 0 }}
          >
            {issue.assignee.displayName?.charAt(0)}
          </Avatar>
        </Tooltip>
      )}
    </div>
  );

  const renderIssueBar = (issue: TimelineIssue, barColor: string) => {
    const bar = getBarMetrics(issue);
    const isMilestoneIssue = checkMilestone((issue as any).type?.name || (issue as any).issueTypeName);

    return (
      <div
        key={`bar-${issue.id}`}
        style={{ height: ROW_HEIGHT, borderBottom: `1px solid ${COLORS.border}`, position: 'relative' }}
      >
        {/* Grid background cells */}
        <div style={{ display: 'flex', height: '100%', position: 'absolute', inset: 0 }}>
          {cells.map((cell, index) => (
            <div
              key={index}
              style={{
                width: cellWidth,
                minWidth: cellWidth,
                borderRight: `1px solid ${COLORS.border}`,
                backgroundColor: cell.isToday ? '#eff6ff08' : cell.isWeekend ? 'rgba(0,0,0,0.015)' : undefined,
              }}
            />
          ))}
        </div>

        {/* Milestone diamond or bar */}
        {bar && isMilestoneIssue ? (
          <Tooltip
            title={
              <div>
                <div style={{ fontWeight: 600 }}>{issue.issueKey}: {issue.title}</div>
                <div>Milestone · {issue.startDate ? fmtDate(issue.startDate) : fmtDate(issue.dueDate!)}</div>
              </div>
            }
          >
            <div
              onClick={() => goToIssue(issue.id)}
              style={{
                position: 'absolute',
                top: ROW_HEIGHT / 2,
                left: `${bar.leftPct}%`,
                transform: 'translate(-50%, -50%) rotate(45deg)',
                width: 16, height: 16,
                backgroundColor: COLORS.warning,
                border: '2px solid #d97706',
                borderRadius: 2,
                cursor: effectiveProjectId ? 'pointer' : 'default',
                zIndex: 3,
                boxShadow: `0 2px 6px rgba(245,158,11,0.4)`,
              }}
            />
          </Tooltip>
        ) : bar ? (
          <Tooltip
            title={
              <div>
                <div style={{ fontWeight: 600 }}>{issue.issueKey}: {issue.title}</div>
                <div>Status: {issue.statusName}</div>
                {issue.startDate && <div>Start: {new Date(issue.startDate).toLocaleDateString()}</div>}
                {issue.dueDate && <div>Due: {new Date(issue.dueDate).toLocaleDateString()}</div>}
                {issue.assignee && <div>Assignee: {issue.assignee.displayName}</div>}
              </div>
            }
          >
            <div
              onClick={() => goToIssue(issue.id)}
              style={{
                position: 'absolute',
                top: 8,
                height: 28,
                left: `${bar.leftPct}%`,
                width: `${bar.widthPct}%`,
                background: bar.partial
                  ? `repeating-linear-gradient(135deg, ${barColor} 0px, ${barColor} 4px, ${barColor}99 4px, ${barColor}99 8px)`
                  : `linear-gradient(90deg, ${barColor} 0%, ${barColor}cc 100%)`,
                borderRadius: 6,
                cursor: effectiveProjectId ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
                paddingRight: 8,
                overflow: 'hidden',
                zIndex: 2,
                minWidth: 4,
                boxShadow: `0 1px 3px ${barColor}30`,
                opacity: bar.partial ? 0.85 : 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: '#fff',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textShadow: '0 1px 2px rgba(0,0,0,0.25)',
                }}
              >
                {issue.issueKey}: {issue.title}
              </Text>
            </div>
          </Tooltip>
        ) : null}
      </div>
    );
  };

  // Render group header row (left + right)
  const renderGroupHeaderLeft = (group: IssueGroup) => (
    <div
      key={`gh-left-${group.key}`}
      onClick={() => toggleGroup(group.key)}
      style={{
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: '8px',
        cursor: 'pointer',
        backgroundColor: expandedGroups.has(group.key) ? `${group.color}08` : COLORS.bg,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${group.color}10`; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = expandedGroups.has(group.key) ? `${group.color}08` : COLORS.bg; }}
    >
      <div style={{ color: expandedGroups.has(group.key) ? group.color : COLORS.textMuted, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {expandedGroups.has(group.key) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>
      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: group.color, flexShrink: 0 }} />
      <Text strong style={{ fontSize: 12, color: COLORS.textPrimary, flex: 1 }}>
        {group.label}
      </Text>
      <Tag color="default" style={{ borderRadius: 10, margin: 0, fontSize: 10 }}>{group.items.length}</Tag>
    </div>
  );

  const renderGroupHeaderBar = (group: IssueGroup) => {
    const isExpanded = expandedGroups.has(group.key);
    const summaryBar = !isExpanded ? getGroupSummaryBar(group.items) : null;

    return (
      <div
        key={`gh-bar-${group.key}`}
        style={{
          height: ROW_HEIGHT,
          borderBottom: `1px solid ${COLORS.border}`,
          position: 'relative',
          backgroundColor: isExpanded ? `${group.color}06` : COLORS.bg,
        }}
      >
        {/* Grid cells */}
        <div style={{ display: 'flex', height: '100%', position: 'absolute', inset: 0 }}>
          {cells.map((cell, index) => (
            <div
              key={index}
              style={{
                width: cellWidth,
                minWidth: cellWidth,
                borderRight: `1px solid ${COLORS.border}`,
                backgroundColor: cell.isToday ? '#eff6ff08' : cell.isWeekend ? 'rgba(0,0,0,0.015)' : undefined,
              }}
            />
          ))}
        </div>
        {/* Summary bar when collapsed */}
        {summaryBar && (
          <div style={{
            position: 'absolute',
            top: 10, height: 24,
            left: `${summaryBar.leftPct}%`,
            width: `${summaryBar.widthPct}%`,
            background: `linear-gradient(90deg, ${group.color}dd, ${group.color}88)`,
            borderRadius: 12,
            border: `1.5px solid ${group.color}`,
            display: 'flex', alignItems: 'center',
            paddingLeft: 10, paddingRight: 10,
            zIndex: 2,
            boxShadow: `0 2px 6px ${group.color}25`,
          }}>
            <Text style={{
              fontSize: 10, color: '#fff', fontWeight: 700,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}>
              {group.items.length} issues · {fmtDate(group.items.reduce((min, i) => {
                const d = i.startDate || i.dueDate || '';
                return !min || d < min ? d : min;
              }, ''))} - {fmtDate(group.items.reduce((max, i) => {
                const d = i.dueDate || i.startDate || '';
                return !max || d > max ? d : max;
              }, ''))}
            </Text>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Select
            size="small"
            value={groupBy}
            onChange={(value) => setGroupBy(value as GroupBy)}
            style={{ width: 140 }}
            options={GROUP_BY_OPTIONS}
            suffixIcon={<Layers size={13} />}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Select
            size="small"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            style={{ width: 140 }}
            options={STATUS_FILTER_OPTIONS}
            suffixIcon={<Filter size={13} />}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button
              size="small"
              icon={<ZoomOut size={14} />}
              onClick={handleZoomOut}
              disabled={zoom === 'quarters'}
            />
            <Select
              value={zoom}
              onChange={(value) => setZoom(value as ZoomLevel)}
              size="small"
              style={{ width: 100 }}
              options={[
                { value: 'days', label: 'Days' },
                { value: 'weeks', label: 'Weeks' },
                { value: 'months', label: 'Months' },
                { value: 'quarters', label: 'Quarters' },
              ]}
            />
            <Button
              size="small"
              icon={<ZoomIn size={14} />}
              onClick={handleZoomIn}
              disabled={zoom === 'days'}
            />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="grid"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {scheduledIssues.length} scheduled issue{scheduledIssues.length !== 1 ? 's' : ''}
              {unscheduledIssues.length > 0 && ` · ${unscheduledIssues.length} unscheduled`}
            </Text>
            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {[
                { color: COLORS.todo, label: 'To Do' },
                { color: COLORS.inProgress, label: 'In Progress' },
                { color: COLORS.done, label: 'Done' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 14, height: 6, borderRadius: 3, background: l.color }} />
                  <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>{l.label}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: COLORS.warning, border: '1px solid #d97706', borderRadius: 1 }} />
                <span style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>Milestone</span>
              </div>
            </div>
          </div>

          <div
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              overflow: 'hidden',
              backgroundColor: '#fff',
            }}
          >
            <div style={{ display: 'flex' }}>
              {/* Left Panel */}
              <div
                style={{
                  width: LEFT_PANEL_WIDTH,
                  minWidth: LEFT_PANEL_WIDTH,
                  borderRight: `2px solid ${COLORS.border}`,
                  flexShrink: 0,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    height: zoom === 'days' ? 68 : ROW_HEIGHT,
                    borderBottom: `1px solid ${COLORS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    backgroundColor: COLORS.bg,
                  }}
                >
                  <Text strong style={{ fontSize: 12, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Issues
                  </Text>
                </div>

                {/* Group headers + issue rows */}
                {groupedIssues.map((group) => {
                  const isExpanded = expandedGroups.has(group.key);
                  return (
                    <div key={`left-group-${group.key}`}>
                      {groupBy !== 'none' && renderGroupHeaderLeft(group)}
                      {(groupBy === 'none' || isExpanded) && group.items.map(renderIssueLeftPanel)}
                    </div>
                  );
                })}
              </div>

              {/* Right Panel (scrollable) */}
              <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
                <div style={{ minWidth: totalWidth, position: 'relative' }}>
                  {/* Column headers */}
                  {zoom === 'days' && weekHeadersForDays ? (
                    /* Two-tier header for days view */
                    <div style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bg, position: 'sticky', top: 0, zIndex: 3 }}>
                      {/* Week-level row */}
                      <div style={{ display: 'flex', height: 32 }}>
                        {weekHeadersForDays.map((wh, wi) => (
                          <div key={wi} style={{
                            width: DAY_CELL_WIDTH * wh.days.length,
                            minWidth: DAY_CELL_WIDTH * wh.days.length,
                            flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: wh.isCurrentWeek ? 700 : 500,
                            color: wh.isCurrentWeek ? COLORS.primary : COLORS.textSecondary,
                            borderRight: `1px solid ${COLORS.border}`,
                            backgroundColor: wh.isCurrentWeek ? '#eff6ff' : undefined,
                            borderBottom: `1px solid ${COLORS.border}`,
                          }}>
                            {wh.shortLabel}
                          </div>
                        ))}
                      </div>
                      {/* Day-level sub-row */}
                      <div style={{ display: 'flex', height: 34 }}>
                        {cells.map((cell, index) => (
                          <div
                            key={index}
                            style={{
                              width: DAY_CELL_WIDTH,
                              minWidth: DAY_CELL_WIDTH,
                              borderRight: `1px solid ${COLORS.border}`,
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center',
                              fontSize: 9,
                              fontWeight: cell.isToday ? 700 : 400,
                              color: cell.isToday ? COLORS.primary : cell.isWeekend ? COLORS.textMuted : COLORS.textSecondary,
                              backgroundColor: cell.isToday ? '#eff6ff' : cell.isWeekend ? 'rgba(0,0,0,0.02)' : undefined,
                            }}
                          >
                            <span>{cell.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Single-tier header */
                    <div
                      style={{
                        height: ROW_HEIGHT,
                        borderBottom: `1px solid ${COLORS.border}`,
                        display: 'flex',
                        backgroundColor: COLORS.bg,
                        position: 'sticky',
                        top: 0,
                        zIndex: 3,
                      }}
                    >
                      {cells.map((cell, index) => (
                        <div
                          key={index}
                          style={{
                            width: cellWidth,
                            minWidth: cellWidth,
                            borderRight: `1px solid ${COLORS.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: cell.isToday ? 700 : 500,
                            color: cell.isToday ? COLORS.primary : COLORS.textSecondary,
                            backgroundColor: cell.isToday ? '#eff6ff' : undefined,
                          }}
                        >
                          {cell.label}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dependency arrows */}
                  {dependencyPaths.length > 0 && (
                    <svg
                      style={{
                        position: 'absolute',
                        top: zoom === 'days' ? 68 : ROW_HEIGHT,
                        left: 0,
                        width: totalWidth,
                        height: totalVisibleRows * ROW_HEIGHT,
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    >
                      <defs>
                        <marker
                          id="timeline-dependency-arrow"
                          markerWidth="6"
                          markerHeight="6"
                          refX="5"
                          refY="3"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path d="M 0 0 L 6 3 L 0 6 z" fill={COLORS.dependency} />
                        </marker>
                      </defs>

                      {dependencyPaths.map((dependency) => (
                        <g key={dependency.id}>
                          <path
                            d={dependency.path}
                            fill="none"
                            stroke={COLORS.dependency}
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            markerEnd="url(#timeline-dependency-arrow)"
                          />
                        </g>
                      ))}
                    </svg>
                  )}

                  {/* Issue bar rows (grouped) */}
                  {groupedIssues.map((group) => {
                    const isExpanded = expandedGroups.has(group.key);
                    const barColor = STATUS_CATEGORY_COLORS[group.key] || group.color;
                    return (
                      <div key={`bar-group-${group.key}`}>
                        {groupBy !== 'none' && renderGroupHeaderBar(group)}
                        {(groupBy === 'none' || isExpanded) && group.items.map((issue) => {
                          const issueBarColor = STATUS_CATEGORY_COLORS[issue.statusCategory] || COLORS.todo;
                          return renderIssueBar(issue, issueBarColor);
                        })}
                      </div>
                    );
                  })}

                  {/* Today line */}
                  {todayPos && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: todayPos,
                        width: 2,
                        backgroundColor: COLORS.todayLine,
                        zIndex: 4,
                        pointerEvents: 'none',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: -1,
                          left: -10,
                          backgroundColor: COLORS.todayLine,
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 4px',
                          borderRadius: 3,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Today
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </motion.div>
      </AnimatePresence>

      {/* Unscheduled Issues */}
      {unscheduledIssues.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#fff',
            marginTop: 8,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: COLORS.bg,
              borderBottom: `1px solid ${COLORS.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarX2 size={14} style={{ color: COLORS.textSecondary }} />
              <Text strong style={{ fontSize: 13 }}>Unscheduled Issues</Text>
            </div>
            <Tag color="default" style={{ borderRadius: 10 }}>{unscheduledIssues.length}</Tag>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: '0 8px' }}>
            {unscheduledIssues.map((issue) => (
              <div
                key={issue.id}
                onClick={() => goToIssue(issue.id)}
                style={{
                  height: 40,
                  borderBottom: `1px solid ${COLORS.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  gap: '12px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  margin: '4px 0',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: STATUS_CATEGORY_COLORS[issue.statusCategory] || COLORS.todo,
                    flexShrink: 0,
                  }}
                />
                <Text style={{ fontSize: 11, fontWeight: 700, color: COLORS.primary, width: 60, flexShrink: 0 }}>
                  {issue.issueKey}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: COLORS.textPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {issue.title}
                </Text>
                {issue.assignee && (
                  <Avatar
                    size={22}
                    src={normalizeAvatarUrl(issue.assignee.avatarUrl)}
                    style={{ backgroundColor: COLORS.primary, fontSize: 10, flexShrink: 0 }}
                  >
                    {issue.assignee.displayName?.charAt(0)}
                  </Avatar>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
          border: 2px solid #f8fafc;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
