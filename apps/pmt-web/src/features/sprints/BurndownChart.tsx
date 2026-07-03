import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { useGetBurndownQuery } from './sprintsApi';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';

interface BurndownChartProps {
  sprintId: string;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, color: '#e2e8f0',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: '#f1f5f9' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{p.value != null ? p.value.toFixed(1) : '—'}</strong> pts
        </p>
      ))}
    </div>
  );
}

export function BurndownChart({ sprintId }: BurndownChartProps) {
  const { data, isLoading } = useGetBurndownQuery(sprintId);

  const chartData = useMemo(() => {
    if (!data?.burndown) return [];
    return data.burndown.map((point) => ({
      date: format(new Date(point.date), 'MMM d'),
      ideal: point.idealRemaining,
      actual: point.actualRemaining,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Burndown Chart</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const lastActual = [...chartData].reverse().find((p) => p.actual != null)?.actual ?? 0;
  const totalPts = data.totalPoints;
  const completedPct = totalPts > 0 ? Math.round(((totalPts - lastActual) / totalPts) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Burndown Chart</CardTitle>
            {data.sprint && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.sprint.name} &middot; {format(new Date(data.sprint.startDate), 'MMM d')} — {format(new Date(data.sprint.endDate), 'MMM d, yyyy')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{totalPts} pts</Badge>
            <Badge variant={data.isOnTrack ? 'default' : 'destructive'}>
              {data.isOnTrack ? '✓ On Track' : 'At Risk'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-7 py-6">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-slate-800">{totalPts}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Points</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">{totalPts - lastActual}</p>
            <p className="text-xs text-slate-500 mt-0.5">Completed</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-orange-500">{completedPct}%</p>
            <p className="text-xs text-slate-500 mt-0.5">Done</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-5 mb-3 flex-wrap items-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <div className="w-5 h-0.5 bg-blue-500 rounded-full" />
            Ideal Remaining
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <div className="w-5 h-0.5 bg-red-500 rounded-full" />
            Actual Remaining
          </div>
        </div>

        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                interval={Math.max(0, Math.floor(chartData.length / 7) - 1)}
                angle={-30}
                textAnchor="end"
                height={40}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                width={45}
                label={{
                  value: 'Story Points',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#94a3b8',
                  fontSize: 10,
                  dx: 4,
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Ideal — blue straight line from total → 0 */}
              <Line
                type="linear"
                dataKey="ideal"
                name="Ideal Remaining"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6' }}
              />
              {/* Actual — red line showing real remaining (stops at today) */}
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Remaining"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null || payload.actual == null) return <g key={props.key} />;
                  return <circle key={props.key} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
                }}
                activeDot={{ r: 6, fill: '#ef4444' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {data.projectedCompletion && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Projected completion: <strong>{format(new Date(data.projectedCompletion), 'MMM d, yyyy')}</strong>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
