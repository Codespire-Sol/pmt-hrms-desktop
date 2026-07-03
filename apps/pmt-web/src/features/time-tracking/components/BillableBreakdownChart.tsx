import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { TimesheetHistoryDayBucket } from '../types';

import { TS, tooltipClass } from './timesheet-styles';

const COLORS = {
  border: TS.borderSubtle,
  textSecondary: TS.textTertiary,
};

interface Props {
  dayBuckets: TimesheetHistoryDayBucket[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const billable = Number(payload.find((p: any) => p.dataKey === 'billable')?.value ?? 0);
  const nonBillable = Number(payload.find((p: any) => p.dataKey === 'nonBillable')?.value ?? 0);
  const total = billable + nonBillable;
  return (
    <div className={tooltipClass}>
      <p className="font-bold text-gray-800 mb-1">{label}</p>
      <p className="font-semibold" style={{ color: '#079455' }}>{billable.toFixed(1)}h billable</p>
      <p className="font-semibold" style={{ color: '#f59e0b' }}>{nonBillable.toFixed(1)}h non-billable</p>
      <p className="text-xs text-gray-400 mt-1">{total.toFixed(1)}h total</p>
    </div>
  );
}

export function BillableBreakdownChart({ dayBuckets }: Props) {
  const data = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayBuckets.map((bucket) => {
      let billable = 0;
      let nonBillable = 0;
      for (const log of bucket.logs) {
        if (log.isBillable) billable += Number(log.hoursWorked);
        else nonBillable += Number(log.hoursWorked);
      }
      const d = new Date(bucket.date + 'T00:00:00');
      const label = `${days[d.getDay()]} ${d.getDate()}`;
      return { date: label, billable, nonBillable };
    });
  }, [dayBuckets]);

  if (!data.length || data.every((d) => d.billable === 0 && d.nonBillable === 0)) {
    return (
      <div className="h-[180px] flex items-center justify-center text-sm text-gray-400 font-medium">
        No billable data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: COLORS.textSecondary, fontWeight: 600 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: COLORS.textSecondary }}
          tickLine={false}
          axisLine={false}
          unit="h"
          width={28}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
        <Legend
          formatter={(value) => (
            <span className="text-xs font-semibold capitalize" style={{ color: COLORS.textSecondary }}>
              {value === 'nonBillable' ? 'Non-billable' : 'Billable'}
            </span>
          )}
        />
        <Bar dataKey="billable" name="billable" fill="#079455" stackId="a" radius={[0, 0, 0, 0]} barSize={20} />
        <Bar dataKey="nonBillable" name="nonBillable" fill="#f59e0b" stackId="a" radius={[3, 3, 0, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default BillableBreakdownChart;
