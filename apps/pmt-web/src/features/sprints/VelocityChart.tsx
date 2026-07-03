import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { useGetVelocityQuery } from './sprintsApi';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface VelocityChartProps {
  projectId: string;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const committed = payload.find((p: any) => p.dataKey === 'committed');
  const completed = payload.find((p: any) => p.dataKey === 'completed');
  const rate = payload.find((p: any) => p.dataKey === 'completionRate');
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, color: '#e2e8f0', minWidth: 160,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: '#f1f5f9' }}>{label}</p>
      {committed && (
        <p style={{ color: committed.color, margin: '2px 0' }}>
          Committed: <strong>{committed.value} pts</strong>
        </p>
      )}
      {completed && (
        <p style={{ color: completed.color, margin: '2px 0' }}>
          Done: <strong>{completed.value} pts</strong>
        </p>
      )}
      {rate && (
        <p style={{ color: '#f87171', margin: '2px 0' }}>
          Completion: <strong>{rate.value}%</strong>
        </p>
      )}
    </div>
  );
}

// Label on top of bar
function BarLabel(props: any) {
  const { x, y, width, value } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      fill="#475569"
      textAnchor="middle"
      fontSize={11}
      fontWeight={600}
    >
      {value}
    </text>
  );
}

export function VelocityChart({ projectId }: VelocityChartProps) {
  const { data, isLoading } = useGetVelocityQuery({ projectId, sprints: 5 });

  const chartData = useMemo(() => {
    if (!data?.sprints) return [];
    return data.sprints.map((sprint) => ({
      name: sprint.name.length > 12 ? sprint.name.slice(0, 12) + '…' : sprint.name,
      fullName: sprint.name,
      committed: sprint.committedPoints,
      completed: sprint.completedPoints,
      completionRate: sprint.completionRate,
    }));
  }, [data]);

  const TrendIcon = useMemo(() => {
    if (!data?.trend) return Minus;
    return data.trend === 'increasing' ? TrendingUp : data.trend === 'decreasing' ? TrendingDown : Minus;
  }, [data?.trend]);

  const trendColor = data?.trend === 'increasing'
    ? 'text-emerald-600'
    : data?.trend === 'decreasing'
    ? 'text-red-500'
    : 'text-slate-500';

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Team Velocity</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.sprints.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Team Velocity</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No completed sprints yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Team Velocity</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Committed vs completed story points per sprint</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`flex items-center gap-1 ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              {data.trend === 'increasing' ? 'Improving' : data.trend === 'decreasing' ? 'Declining' : 'Stable'}
            </Badge>
            <span className="text-sm font-semibold text-slate-700">
              Avg {data.averageVelocity} pts
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 24, right: 24, left: 0, bottom: 0 }}
              barCategoryGap="25%"
              barGap={3}
            >
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              {/* Hide Y axis — values shown on bars */}
              <YAxis hide domain={[0, (dataMax: number) => dataMax * 1.25]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />

              {/* Committed bars — blue */}
              <Bar dataKey="committed" name="Committed" fill="#93c5fd" radius={[4, 4, 0, 0]}>
                <LabelList content={<BarLabel />} />
              </Bar>

              {/* Done bars — green */}
              <Bar dataKey="completed" name="Done" fill="#34d399" radius={[4, 4, 0, 0]}>
                <LabelList content={<BarLabel />} />
              </Bar>

              {/* Velocity trend line — red line connecting completed points */}
              <Line
                type="monotone"
                dataKey="completed"
                name="Velocity"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={{ r: 5, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7 }}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
