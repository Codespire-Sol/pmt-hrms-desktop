import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { BurnoutChartPoint } from '../types';

const COLORS = {
  bar:     '#f97316',  // orange bars = actual periodic spend
  planned: '#94a3b8',  // grey dashed = planned remaining budget
  limit:   '#ef4444',  // red = budget limit thresholds
  warning: '#f59e0b',  // amber = warning threshold
  text:    '#667085',
  border:  '#f0f0f0',
};

interface Props {
  data: BurnoutChartPoint[];
  totalBudget: number;
  alertThreshold?: number;
  warningThreshold?: number;
  currency: string;
}

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(value);
}

function CustomTooltip({ active, payload, label, currency, totalBudget }: any) {
  if (!active || !payload?.length) return null;
  const spend     = payload.find((p: any) => p.dataKey === 'periodSpend')?.value ?? 0;
  const remaining = payload.find((p: any) => p.dataKey === 'remaining')?.value ?? 0;
  const cumActual = payload[0]?.payload?.cumActual ?? 0;
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, color: '#e2e8f0', minWidth: 190,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: '#f1f5f9' }}>{label}</p>
      <p style={{ color: COLORS.bar, margin: '2px 0' }}>
        Period Spend: <strong>{fmt(spend, currency)}</strong>
      </p>
      <p style={{ color: '#93c5fd', margin: '2px 0' }}>
        Cumulative Spent: <strong>{fmt(cumActual, currency)}</strong>
      </p>
      <p style={{ color: COLORS.planned, margin: '2px 0' }}>
        Remaining: <strong>{fmt(remaining, currency)}</strong>
      </p>
      {totalBudget > 0 && (
        <p style={{ color: '#94a3b8', marginTop: 4, fontSize: 11 }}>
          {((cumActual / totalBudget) * 100).toFixed(1)}% of budget used
        </p>
      )}
    </div>
  );
}

export function BurnoutChart({
  data,
  totalBudget,
  alertThreshold = 0.8,
  warningThreshold = 0.9,
  currency,
}: Props) {
  // Transform cumulative API data into per-period spend + remaining budget
  const chartData = useMemo(() => {
    if (!data.length) return [];
    return data.map((point, i) => {
      const prevActual = i === 0 ? 0 : data[i - 1].actual;
      const periodSpend = Math.max(0, point.actual - prevActual);
      const remaining   = totalBudget > 0 ? Math.max(0, totalBudget - point.actual) : 0;
      return {
        date: point.date,
        periodSpend,
        remaining,
        cumActual: point.actual,
      };
    });
  }, [data, totalBudget]);

  if (!chartData.length) {
    return (
      <div className="h-[320px] flex items-center justify-center text-sm text-gray-400 font-medium">
        No time logs found for this project yet. Start logging time to see the budget burndown.
      </div>
    );
  }

  // Y-axis covers the full remaining budget range (0 → totalBudget)
  // Bars (period spend) will appear small near 0, remaining budget line starts near totalBudget
  const yMax = totalBudget > 0 ? Math.ceil(totalBudget * 1.05) : Math.ceil(Math.max(...chartData.map((d) => d.periodSpend), 1) * 1.35);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.border} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: COLORS.text, fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => fmt(v, currency)}
          tick={{ fontSize: 10, fill: COLORS.text }}
          tickLine={false}
          axisLine={false}
          width={80}
          domain={[0, yMax]}
        />
        <Tooltip
          content={<CustomTooltip currency={currency} totalBudget={totalBudget} />}
          cursor={{ fill: 'rgba(249, 115, 22, 0.04)' }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => (
            <span style={{ color: COLORS.text, fontWeight: 500 }}>
              {value === 'periodSpend' ? 'Actual Spend' : value === 'remaining' ? 'Remaining Budget' : value}
            </span>
          )}
        />

        {/* Threshold lines on the remaining-budget axis:
            alertThreshold=0.8 → remaining drops to 20% → y = totalBudget * 0.2
            warningThreshold=0.9 → remaining drops to 10% → y = totalBudget * 0.1  */}
        {totalBudget > 0 && alertThreshold > 0 && (
          <ReferenceLine
            y={totalBudget * (1 - alertThreshold)}
            stroke={COLORS.warning}
            strokeDasharray="5 3"
            label={{
              value: `${Math.round(alertThreshold * 100)}% used`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: COLORS.warning,
            }}
          />
        )}
        {totalBudget > 0 && warningThreshold > 0 && (
          <ReferenceLine
            y={totalBudget * (1 - warningThreshold)}
            stroke={COLORS.limit}
            strokeDasharray="5 3"
            label={{
              value: `${Math.round(warningThreshold * 100)}% used`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: COLORS.limit,
            }}
          />
        )}

        {/* Orange bars — actual spend per period */}
        <Bar
          dataKey="periodSpend"
          name="periodSpend"
          fill={COLORS.bar}
          radius={[5, 5, 0, 0]}
          maxBarSize={60}
        />

        {/* Declining dashed line — remaining budget over time */}
        <Line
          type="monotone"
          dataKey="remaining"
          name="remaining"
          stroke={COLORS.planned}
          strokeWidth={1.5}
          strokeDasharray="6 3"
          dot={{ r: 3, fill: COLORS.planned, stroke: '#fff', strokeWidth: 1.5 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
