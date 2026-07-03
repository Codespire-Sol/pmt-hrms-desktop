import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { tooltipClass } from './timesheet-styles';

const PALETTE = ['#1268ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

interface DataPoint {
  name: string;
  value: number;
  label?: string;
}

interface Props {
  data: DataPoint[];
  totalHours: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className={tooltipClass}>
      <p className="font-bold text-gray-800">{d.payload?.label || d.name}</p>
      <p className="font-semibold text-blue-600">{Number(d.value).toFixed(1)}h</p>
    </div>
  );
}

export function ProjectBreakdownChart({ data, totalHours }: Props) {
  if (!data.length) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-gray-400 font-medium">
        No project data for this period
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={88}
              paddingAngle={3}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ top: 0 }}
        >
          <span className="text-[22px] font-extrabold text-gray-900" style={{ letterSpacing: '-0.04em' }}>
            {totalHours.toFixed(1)}h
          </span>
          <span className="text-xs font-semibold text-gray-400">total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {data.slice(0, 6).map((d, idx) => {
          const pct = totalHours > 0 ? ((d.value / totalHours) * 100).toFixed(0) : '0';
          return (
            <div key={idx} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ background: PALETTE[idx % PALETTE.length] }}
              />
              <span className="text-xs font-semibold text-gray-600">{d.label || d.name}</span>
              <Badge
                variant="secondary"
                className="text-[10px] font-bold rounded-md px-1.5 py-0 h-4"
                style={{ background: `${PALETTE[idx % PALETTE.length]}18`, color: PALETTE[idx % PALETTE.length] }}
              >
                {pct}%
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProjectBreakdownChart;
