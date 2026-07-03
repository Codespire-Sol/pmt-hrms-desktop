import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Card, Col, Empty, Row, Select, Skeleton, Tag,
} from 'antd';
import {
  CalendarRange, TrendingDown, TrendingUp, GitBranch, Link2,
  Flame, ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { useGetBoardQuery } from '@/features/boards/boardsApi';
import { BoardTimelineView } from '@/features/boards/components/BoardTimelineView';
import { useGetProjectTimelineQuery } from './timelineApi';
import { useGetSprintsQuery, useGetBurndownQuery, useGetBurnupQuery } from '@/features/sprints/sprintsApi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary:   '#1268ff',
  primaryBg: 'rgba(18,104,255,0.08)',
  success:   '#10b981',
  successBg: 'rgba(16,185,129,0.08)',
  warning:   '#faad14',
  danger:    '#ff4d4f',
  dangerBg:  'rgba(255,77,79,0.08)',
  purple:    '#8b5cf6',
  purpleBg:  'rgba(139,92,246,0.08)',
  text:      '#101828',
  textSub:   '#4a5565',
  textMuted: '#6a7282',
  border:    '#e5e7eb',
  bg:        '#f9fafb',
  card:      '#ffffff',
  shadow:    '0 4px 16px rgba(16,24,40,0.06)',
};

const TOOLTIP_STYLE = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px',
  boxShadow: C.shadow, padding: '10px 14px', fontSize: '13px',
};

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'MMM d'); } catch { return iso; }
}

// ─── Burndown section ─────────────────────────────────────────────────────────
function BurndownSection({ sprintId }: { sprintId: string }) {
  const { data, isLoading } = useGetBurndownQuery(sprintId, { skip: !sprintId });

  const chartData = useMemo(() => {
    if (!data?.burndown) return [];
    return data.burndown.map(p => ({
      date: fmtDate(p.date),
      Ideal: p.idealRemaining,
      Actual: p.actualRemaining,
    }));
  }, [data]);

  if (isLoading) return <Skeleton active paragraph={{ rows: 5 }} />;
  if (!data || chartData.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span style={{ color: C.textMuted, fontSize: 13 }}>No burndown data yet</span>}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingDown size={15} color={C.danger} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Burndown Chart</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>{data.sprint.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: data.isOnTrack ? C.successBg : C.dangerBg,
            color: data.isOnTrack ? C.success : C.danger,
          }}>
            {data.isOnTrack ? '✓ On Track' : '⚠ At Risk'}
          </span>
          {data.projectedCompletion && (
            <span style={{ fontSize: 11, color: C.textMuted }}>
              Projected: {fmtDate(data.projectedCompletion)}
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textMuted }} />
          <YAxis tick={{ fontSize: 10, fill: C.textMuted }} />
          <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="linear" dataKey="Ideal" name="Ideal Remaining" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
          <Line type="monotone" dataKey="Actual" name="Actual Remaining" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Burnup section ───────────────────────────────────────────────────────────
function BurnupSection({ sprintId }: { sprintId: string }) {
  const { data, isLoading } = useGetBurnupQuery(sprintId, { skip: !sprintId });

  const chartData = useMemo(() => {
    if (!data?.burnup) return [];
    return data.burnup.map(p => ({
      date: fmtDate(p.date),
      Total: p.totalScope,
      Completed: p.completedPoints,
    }));
  }, [data]);

  if (isLoading) return <Skeleton active paragraph={{ rows: 5 }} />;
  if (!data || chartData.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span style={{ color: C.textMuted, fontSize: 13 }}>No burnup data yet</span>}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={15} color={C.success} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Burnup Chart</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>{data.sprint.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: data.isOnTrack ? C.successBg : C.dangerBg,
            color: data.isOnTrack ? C.success : C.danger,
          }}>
            {data.isOnTrack ? '✓ On Track' : '⚠ At Risk'}
          </span>
          {data.projectedCompletion && (
            <span style={{ fontSize: 11, color: C.textMuted }}>
              Projected: {fmtDate(data.projectedCompletion)}
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textMuted }} />
          <YAxis tick={{ fontSize: 10, fill: C.textMuted }} />
          <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="Total" name="Total Work" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="Completed" name="Completed Work" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function ProjectTimelinePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

  const { data: boardData, isLoading: isBoardLoading, isError: isBoardError } = useGetBoardQuery(
    { projectId: projectId! },
    { skip: !projectId }
  );

  const { data: timelineData, isError: isTimelineError } = useGetProjectTimelineQuery(
    { projectId: projectId! },
    { skip: !projectId }
  );

  const { data: sprintsData, isLoading: isSprintsLoading } = useGetSprintsQuery(
    { projectId: projectId! },
    { skip: !projectId }
  );

  const sprints = sprintsData?.sprints ?? [];
  const activeSprint = sprintsData?.activeSprint ?? sprints.find(s => s.status === 'active') ?? null;
  const effectiveSprintId = selectedSprintId ?? activeSprint?.id ?? sprints[0]?.id ?? null;

  const sprintOptions = useMemo(() => {
    return sprints.map(s => ({
      value: s.id,
      label: `${s.name}${s.status === 'active' ? ' (Active)' : s.status === 'completed' ? ' ✓' : ''}`,
    }));
  }, [sprintsData]);

  if (!projectId) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Empty description="Project not found" />
      </div>
    );
  }

  if (isBoardLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {[10, 8].map((rows, i) => (
          <Card key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadow }}>
            <Skeleton active paragraph={{ rows }} />
          </Card>
        ))}
      </div>
    );
  }

  if (isBoardError || !boardData?.columns) {
    return (
      <Card style={{ border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Could not load timeline data. Please try again."
        />
      </Card>
    );
  }

  const depCount = timelineData?.dependencyLinks?.length || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.primary}, #06b6d4)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px rgba(18,104,255,0.3)`,
          }}>
            <CalendarRange size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
              Project Timeline
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>
              Issue schedule, dependency links &amp; sprint analytics
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {depCount > 0 && (
            <Tag
              icon={<Link2 size={11} style={{ marginRight: 4 }} />}
              color="blue"
              style={{ margin: 0, fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center' }}
            >
              {depCount} {depCount === 1 ? 'dependency' : 'dependencies'}
            </Tag>
          )}
          {activeSprint && (
            <Tag
              icon={<Flame size={11} style={{ marginRight: 4 }} />}
              color="orange"
              style={{ margin: 0, fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center' }}
            >
              {activeSprint.name} active
            </Tag>
          )}
        </div>
      </div>

      {/* ── Dependency error warning ─────────────────────────────────────── */}
      {isTimelineError && (
        <Alert
          type="warning"
          showIcon
          message="Dependency overlays unavailable"
          description="Timeline bars are shown. Dependency links need the timeline API to be reachable."
          style={{ borderRadius: 12 }}
        />
      )}

      {/* ── Gantt chart ─────────────────────────────────────────────────── */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: C.primaryBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GitBranch size={14} color={C.primary} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Issue Timeline</span>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 400 }}>
              · Weeks / Months / Quarters
            </span>
          </div>
        }
        style={{ border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadow }}
        styles={{ body: { padding: 16 } }}
      >
        <BoardTimelineView
          columns={boardData.columns}
          projectId={projectId}
          dependencyLinks={timelineData?.dependencyLinks || []}
        />
      </Card>

      {/* Sprint Analytics hidden (code kept) */}

    </div>
  );
}
