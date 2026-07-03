import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

import { TS, tooltipClass } from './timesheet-styles';

const COLORS = {
  primary: TS.primary,
  success: TS.success,
  warning: '#f59e0b',
  border: TS.borderSubtle,
  textSecondary: TS.textTertiary,
};

interface DataPoint {
  date: string;
  hours: number;
}

interface Props {
  data: DataPoint[];
  expectedPerDay: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const hours = Number(payload[0]?.value ?? 0);
  return (
    <div className={tooltipClass}>
      <p className="font-bold text-gray-800 mb-1">{label}</p>
      <p className="font-semibold" style={{ color: COLORS.primary }}>
        {hours.toFixed(1)}h logged
      </p>
    </div>
  );
}

export function DailyHoursChart({ data, expectedPerDay }: Props) {
  if (!data.length) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-gray-400 font-medium">
        No data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={COLORS.border} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: COLORS.textSecondary, fontWeight: 600 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: COLORS.textSecondary }}
          tickLine={false}
          axisLine={false}
          unit="h"
          width={32}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(18,104,255,0.04)', radius: 8 }} />
        {expectedPerDay > 0 && (
          <ReferenceLine
            y={expectedPerDay}
            stroke={COLORS.primary}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            strokeOpacity={0.6}
            label={{
              value: `${expectedPerDay.toFixed(0)}h target`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: COLORS.primary,
              fontWeight: 700,
            }}
          />
        )}
        <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={44} name="Logged">
          {data.map((entry, idx) => (
            <Cell
              key={idx}
              fill={
                entry.hours === 0
                  ? '#e2e8f0'
                  : entry.hours >= expectedPerDay
                    ? COLORS.success
                    : COLORS.primary
              }
              opacity={0.9}
            />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey="hours"
          stroke={COLORS.primary}
          strokeWidth={2}
          dot={false}
          opacity={0.3}
          legendType="none"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default DailyHoursChart;
