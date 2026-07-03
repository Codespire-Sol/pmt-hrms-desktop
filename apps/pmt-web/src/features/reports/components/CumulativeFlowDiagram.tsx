import { useMemo, useState } from 'react';
import { Empty, Skeleton } from 'antd';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import { useGetBoardQuery } from '../../boards/boardsApi';
import { useGetIssuesQuery } from '../../issues/issuesApi';

interface CumulativeFlowDiagramProps {
  projectId: string;
}

type DateRange = 7 | 14 | 30 | 90;

const DATE_RANGE_OPTIONS: { value: DateRange; label: string; short: string }[] = [
  { value: 7, label: 'Last 7 days', short: '7d' },
  { value: 14, label: 'Last 14 days', short: '14d' },
  { value: 30, label: 'Last 30 days', short: '30d' },
  { value: 90, label: 'Last 90 days', short: '90d' },
];

const SERIES = [
  { key: 'done', name: 'Done', color: '#22c55e', stroke: '#16a34a' },
  { key: 'in_progress', name: 'In Progress', color: '#f59e0b', stroke: '#d97706' },
  { key: 'in_review', name: 'In Review', color: '#a855f7', stroke: '#7c3aed' },
  { key: 'todo', name: 'To Do', color: '#3b82f6', stroke: '#2563eb' },
] as const;

// Normalise status category to one of 4 buckets
function normCategory(raw: string | null | undefined): 'todo' | 'in_progress' | 'in_review' | 'done' {
  const s = (raw || 'todo').toLowerCase().replace('-', '_');
  if (s === 'to_do') return 'todo';
  if (s === 'in_review') return 'in_review';
  if (s === 'in_progress') return 'in_progress';
  if (s === 'done') return 'done';
  return 'todo';
}

/* ── Custom Tooltip ──────────────────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(148, 163, 184, 0.15)',
        borderRadius: 12,
        padding: '14px 18px',
        fontSize: 12,
        color: '#e2e8f0',
        minWidth: 180,
        boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10, color: '#f8fafc', fontSize: 13, letterSpacing: '-0.01em' }}>
        {label}
      </div>
      {[...payload].reverse().map((p: any) => (
        <div
          key={p.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '3px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: p.color || p.stroke,
                boxShadow: `0 0 6px ${p.color || p.stroke}60`,
                flexShrink: 0,
              }}
            />
            <span style={{ color: '#cbd5e1' }}>{p.name}</span>
          </div>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.value}</span>
        </div>
      ))}
      <div
        style={{
          color: '#94a3b8',
          marginTop: 10,
          borderTop: '1px solid rgba(148, 163, 184, 0.15)',
          paddingTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 600,
        }}
      >
        <span>Total</span>
        <span style={{ color: '#f1f5f9' }}>{total}</span>
      </div>
    </div>
  );
}

/* ── Custom Active Dot (shows on hover) ──────────────────────────────────────── */
function ActiveDot(props: any) {
  const { cx, cy, stroke } = props;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="#fff"
      stroke={stroke}
      strokeWidth={2.5}
      style={{ filter: `drop-shadow(0 0 4px ${stroke}80)` }}
    />
  );
}

/* ── Main Component ──────────────────────────────────────────────────────────── */
export function CumulativeFlowDiagram({ projectId }: CumulativeFlowDiagramProps) {
  const [days, setDays] = useState<DateRange>(30);

  const { data: boardData, isLoading: boardLoading } = useGetBoardQuery({ projectId });
  const { data: issuesData, isLoading: issuesLoading } = useGetIssuesQuery({
    projectId,
    filters: { page: 1, limit: 500 },
  });

  const isLoading = boardLoading || issuesLoading;

  const chartData = useMemo(() => {
    if (!boardData?.columns || !issuesData) return null;

    const issues = Array.isArray(issuesData) ? issuesData : (issuesData as any)?.issues || [];
    if (issues.length === 0) return null;

    // Build date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates: Date[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d);
    }

    const allPoints = dates.map((date) => {
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      let todo = 0, in_progress = 0, in_review = 0, done = 0;

      for (const issue of issues) {
        const created = new Date(issue.createdAt);
        created.setHours(0, 0, 0, 0);
        if (created > date) continue;

        const cat = normCategory(issue.status?.category);

        if (cat === 'done') {
          if (issue.resolutionDate) {
            const resolved = new Date(issue.resolutionDate);
            resolved.setHours(0, 0, 0, 0);
            if (resolved <= date) { done++; continue; }
          } else {
            done++; continue;
          }
        }
        if (cat === 'in_progress') in_progress++;
        else if (cat === 'in_review') in_review++;
        else todo++;
      }

      return { date: label, todo, in_progress, in_review, done };
    });

    // Trim leading all-zero days but keep at least 1 day before the first
    // non-zero day so the area chart has a baseline to draw from.
    const firstNonZeroIdx = allPoints.findIndex(
      (d) => d.todo + d.in_progress + d.in_review + d.done > 0
    );
    if (firstNonZeroIdx < 0) return allPoints; // all zeros
    const startIdx = Math.max(0, firstNonZeroIdx - 1);
    return allPoints.slice(startIdx);
  }, [boardData, issuesData, days]);

  if (isLoading) {
    return (
      <div style={{ padding: 32 }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (!chartData) {
    return (
      <div style={{ padding: 32 }}>
        <Empty description="No issue data available for this project" />
      </div>
    );
  }

  const hasData = chartData.some((d) => d.todo + d.in_progress + d.in_review + d.done > 0);
  if (!hasData) {
    return (
      <div style={{ padding: 32 }}>
        <Empty description="No issues found in the selected time range" />
      </div>
    );
  }

  // Compute totals for the summary stat pills
  const latest = chartData[chartData.length - 1];
  const totalIssues = latest.todo + latest.in_progress + latest.in_review + latest.done;

  // Tick interval for x-axis
  const tickInterval = Math.max(1, Math.floor(chartData.length / 10));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f97316 0%, #facc15 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(249, 115, 22, 0.25)',
              flexShrink: 0,
            }}
          >
            <TrendingUp size={22} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                lineHeight: 1.3,
              }}
            >
              Cumulative Flow Diagram
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
              Work item distribution across statuses over time
            </p>
          </div>
        </div>

        {/* ── Date Range Pill Selector ──────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#f8fafc',
            borderRadius: 10,
            padding: 4,
            border: '1px solid #e2e8f0',
          }}
        >
          <Calendar size={14} color="#94a3b8" style={{ marginLeft: 8 }} />
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: days === opt.value ? 600 : 500,
                color: days === opt.value ? '#fff' : '#64748b',
                background: days === opt.value
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                  : 'transparent',
                border: 'none',
                borderRadius: 7,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                boxShadow: days === opt.value ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none',
              }}
            >
              {opt.short}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Stats ───────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {SERIES.map((s) => {
          const val = latest[s.key as keyof typeof latest] as number;
          return (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 10,
                background: `${s.color}08`,
                border: `1px solid ${s.color}20`,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: s.color,
                  boxShadow: `0 0 6px ${s.color}40`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{s.name}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                {val}
              </span>
            </div>
          );
        })}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 10,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            marginLeft: 'auto',
          }}
        >
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Total</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {totalIssues}
          </span>
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────── */}
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          padding: '24px 20px 16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 20, left: 4, bottom: 8 }}
            >
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`cfdGrad_${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.65} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
                dy={6}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={48}
              >
                <Label
                  value="Issue Count"
                  angle={-90}
                  position="insideLeft"
                  offset={8}
                  style={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                />
              </YAxis>
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
              />

              {/* Stacked areas — bottom to top: Done → In Progress → In Review → To Do */}
              {SERIES.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stackId="cfd"
                  stroke={s.stroke}
                  fill={`url(#cfdGrad_${s.key})`}
                  strokeWidth={2}
                  activeDot={<ActiveDot />}
                  dot={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Custom Legend ──────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            paddingTop: 16,
            borderTop: '1px solid #f1f5f9',
            marginTop: 8,
          }}
        >
          {[...SERIES].reverse().map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 4,
                  borderRadius: 2,
                  background: s.color,
                }}
              />
              <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{s.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
