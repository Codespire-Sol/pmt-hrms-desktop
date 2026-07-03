import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIssueModal } from '../issues/IssueDetailModal';
import { Typography, Button, Avatar, Tooltip, Tag, Space, Badge, Empty } from 'antd';
import { ChevronLeft, ChevronRight, CalendarX2 } from 'lucide-react';
import { normalizeAvatarUrl } from '../../lib/utils';
import type { BoardColumn } from '../boards/boardsApi';
import type { Issue } from '../issues/issuesApi';

const { Text } = Typography;

interface CalendarViewProps {
  columns: BoardColumn[];
  projectId: string;
}

const COLORS = {
  primary: '#1268ff',
  success: '#10b981',
  warning: '#f59e0b',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  todo: '#9ca3af',
  inProgress: '#3b82f6',
  done: '#10b981',
};

const STATUS_CATEGORY_COLORS: Record<string, string> = {
  todo: COLORS.todo,
  to_do: COLORS.todo,
  in_progress: COLORS.inProgress,
  done: COLORS.done,
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalendarIssue extends Issue {
  statusCategory: string;
  statusName: string;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();
  // Adjust to Monday-start: Mon=0, Sun=6
  const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const days: Date[] = [];
  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, 1);
    d.setDate(d.getDate() - i - 1);
    days.push(d);
  }

  // Current month days
  const daysInMonth = getDaysInMonth(year, month);
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  // Next month padding to fill 6 rows
  while (days.length < 42) {
    const lastDay = days[days.length - 1];
    const next = new Date(lastDay);
    next.setDate(next.getDate() + 1);
    days.push(next);
  }

  return days;
}

export function CalendarView({ columns, projectId }: CalendarViewProps) {
  const navigate = useNavigate();
  const { openIssue } = useIssueModal();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const allIssues: CalendarIssue[] = useMemo(
    () =>
      columns.flatMap((col) =>
        col.issues.map((issue) => ({
          ...issue,
          statusCategory: col.category || 'todo',
          statusName: col.name,
        }))
      ),
    [columns]
  );

  const issuesByDate = useMemo(() => {
    const map = new Map<string, CalendarIssue[]>();
    allIssues.forEach((issue) => {
      if (issue.dueDate) {
        const d = new Date(issue.dueDate);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(issue);
      }
    });
    return map;
  }, [allIssues]);

  const calendarDays = useMemo(
    () => getMonthCalendarDays(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const issuesWithDates = allIssues.filter((i) => i.dueDate);

  if (allIssues.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <Empty
          image={<CalendarX2 size={48} style={{ color: COLORS.textSecondary }} />}
          description={
            <div>
              <Text strong>No issues to display</Text>
              <br />
              <Text type="secondary">Create issues with due dates to see them on the calendar</Text>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {issuesWithDates.length} issue{issuesWithDates.length !== 1 ? 's' : ''} with due dates
        </Text>
        <Space>
          <Button size="small" icon={<ChevronLeft size={14} />} onClick={goToPrevMonth} style={{ borderRadius: '6px' }} />
          <Button size="small" onClick={goToToday} style={{ borderRadius: '6px' }}>
            Today
          </Button>
          <Text strong style={{ fontSize: 15, minWidth: 160, textAlign: 'center', display: 'inline-block' }}>
            {monthLabel}
          </Text>
          <Button size="small" icon={<ChevronRight size={14} />} onClick={goToNextMonth} style={{ borderRadius: '6px' }} />
        </Space>
      </div>

      {/* Calendar Grid */}
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: '10px',
          overflow: 'hidden',
          backgroundColor: '#fff',
        }}
      >
        {/* Weekday Headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: `1px solid ${COLORS.border}`,
            backgroundColor: '#f9fafb',
          }}
        >
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              style={{
                padding: '8px',
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridAutoRows: 'minmax(100px, auto)',
          }}
        >
          {calendarDays.map((day, i) => {
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayIssues = issuesByDate.get(key) || [];
            const isCurrentMonth = day.getMonth() === currentMonth;
            const isToday = isSameDay(day, today);
            const maxDisplay = 3;

            return (
              <div
                key={i}
                style={{
                  borderRight: (i + 1) % 7 !== 0 ? `1px solid ${COLORS.border}` : undefined,
                  borderBottom: i < 35 ? `1px solid ${COLORS.border}` : undefined,
                  padding: '4px',
                  minHeight: 100,
                  backgroundColor: isToday ? '#eff6ff' : !isCurrentMonth ? '#fafafa' : undefined,
                  opacity: isCurrentMonth ? 1 : 0.5,
                }}
              >
                {/* Day Number */}
                <div style={{ textAlign: 'right', padding: '2px 4px', marginBottom: 2 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? COLORS.primary : COLORS.textSecondary,
                      ...(isToday
                        ? {
                            backgroundColor: COLORS.primary,
                            color: '#fff',
                            borderRadius: '50%',
                            width: 22,
                            height: 22,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }
                        : {}),
                    }}
                  >
                    {day.getDate()}
                  </Text>
                </div>

                {/* Issue Events */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dayIssues.slice(0, maxDisplay).map((issue) => {
                    const barColor = STATUS_CATEGORY_COLORS[issue.statusCategory] || COLORS.todo;
                    return (
                      <Tooltip
                        key={issue.id}
                        title={
                          <div>
                            <div style={{ fontWeight: 600 }}>{issue.issueKey}</div>
                            <div>{issue.title}</div>
                            <div>Status: {issue.statusName}</div>
                            {issue.assignee && <div>Assignee: {issue.assignee.displayName}</div>}
                          </div>
                        }
                      >
                        <div
                          onClick={() => openIssue(issue.id, projectId)}
                          style={{
                            padding: '1px 4px',
                            borderRadius: 3,
                            backgroundColor: barColor,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#fff',
                            lineHeight: '16px',
                          }}
                        >
                          {issue.issueKey} {issue.title}
                        </div>
                      </Tooltip>
                    );
                  })}
                  {dayIssues.length > maxDisplay && (
                    <Text style={{ fontSize: 10, color: COLORS.textSecondary, paddingLeft: 4 }}>
                      +{dayIssues.length - maxDisplay} more
                    </Text>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
