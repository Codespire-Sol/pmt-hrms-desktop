import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import type { CostBreakdown } from '../types';

const BAR_COLORS = [
  '#1268ff', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

interface Props {
  data: CostBreakdown[];
  currency: string;
}

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload as CostBreakdown;
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-xl text-sm">
      <p className="font-bold text-gray-800 mb-1">{label}</p>
      <p className="font-semibold text-blue-600">Cost: {fmt(item.totalCost, currency)}</p>
      <p className="text-gray-500">{item.hoursLogged.toFixed(1)}h @ {fmt(item.hourlyRate, currency)}/hr</p>
      <p className="text-xs text-gray-400 mt-1">{item.percentOfTotal.toFixed(1)}% of total spend</p>
    </div>
  );
}

export function CostBreakdownChart({ data, currency }: Props) {
  const chartData = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.totalCost - a.totalCost)
        .map((item) => ({
          ...item,
          label: item.userName !== 'Unknown' ? item.userName : item.role,
        })),
    [data],
  );

  if (!chartData.length) {
    return (
      <div className="h-[240px] flex items-center justify-center text-sm text-gray-400 font-medium">
        No cost data available yet. Set resource rates and log time to see cost breakdown.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 40 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#667085', fontWeight: 600 }}
          tickLine={false}
          axisLine={false}
          angle={-30}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tickFormatter={(v) => fmt(v, currency)}
          tick={{ fontSize: 10, fill: '#667085' }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
        <Bar dataKey="totalCost" name="Cost" radius={[6, 6, 0, 0]}>
          {chartData.map((_, index) => (
            <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
