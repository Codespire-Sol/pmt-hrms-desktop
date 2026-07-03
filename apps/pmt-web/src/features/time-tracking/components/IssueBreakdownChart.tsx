import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { TS, tooltipClass } from './timesheet-styles';

const COLORS = {
  primary: TS.primary,
  border: TS.borderSubtle,
  textSecondary: TS.textTertiary,
};

interface DataPoint {
  name: string;
  worked: number;
  estimated: number;
  label?: string;
}

interface Props {
  data: DataPoint[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const worked = Number(payload.find((p: any) => p.dataKey === 'worked')?.value ?? 0);
  const estimated = Number(payload.find((p: any) => p.dataKey === 'estimated')?.value ?? 0);
  const delta = worked - estimated;
  return (
    <div className={`${tooltipClass} min-w-[140px]`}>
      <p className="font-bold text-gray-800 mb-1.5">{label}</p>
      <p className="font-semibold text-blue-600">{worked.toFixed(1)}h worked</p>
      <p className="font-semibold text-gray-400">{estimated.toFixed(1)}h estimated</p>
      {estimated > 0 && (
        <p
          className="font-bold text-xs mt-1"
          style={{ color: delta > 0 ? '#d92d20' : '#079455' }}
        >
          {delta > 0 ? `+${delta.toFixed(1)}h over` : `${Math.abs(delta).toFixed(1)}h under`}
        </p>
      )}
    </div>
  );
}

export function IssueBreakdownChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-gray-400 font-medium">
        No issue data for this period
      </div>
    );
  }

  const height = Math.max(200, data.length * 44);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
        barCategoryGap="35%"
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.border} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: COLORS.textSecondary }}
          tickLine={false}
          axisLine={false}
          unit="h"
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(18,104,255,0.04)' }} />
        <Legend
          formatter={(value) => (
            <span className="text-xs font-semibold capitalize" style={{ color: COLORS.textSecondary }}>
              {value}
            </span>
          )}
        />
        <Bar dataKey="estimated" name="Estimated" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={10} />
        <Bar dataKey="worked" name="Worked" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={10} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default IssueBreakdownChart;
