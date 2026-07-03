import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  Target,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip as RechartsTooltip,
} from 'recharts';
import type { TimesheetHistoryResponse, TimesheetSummaryResponse } from '../types';
import { TS, cardClass, getUtilColor } from './timesheet-styles';

const fmtHours = (n: number) => `${Number(n || 0).toFixed(1)}h`;

interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}

function KpiCard({ title, value, sub, icon, accentColor, accentBg, badge, children }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="h-full"
    >
      <Card
        className={`${cardClass} h-full hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)] transition-shadow duration-200`}
      >
        <CardContent className="p-5 flex flex-col gap-3 min-h-[160px]">
          <div className="flex items-start justify-between">
            <div
              className="h-9 w-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: accentBg, color: accentColor }}
            >
              {icon}
            </div>
            {badge}
          </div>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: TS.textSecondary }}>
              {title}
            </p>
            <p
              className="text-[26px] font-extrabold mt-0.5 leading-none"
              style={{ color: TS.textPrimary, letterSpacing: '-0.03em' }}
            >
              {value}
            </p>
            {sub && (
              <p className="text-xs font-medium mt-1" style={{ color: TS.textSecondary }}>
                {sub}
              </p>
            )}
          </div>
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface Props {
  history: TimesheetHistoryResponse;
  summary?: TimesheetSummaryResponse;
  loading: boolean;
}

export function TimesheetKpiCards({ history, summary, loading }: Props) {
  const worked = Number(summary?.kpis.totalWorkedHours ?? history.totals.totalWorkedHours ?? 0);
  const expected = Number(summary?.kpis.expectedHours ?? history.totals.expectedHours ?? 0);
  const completion = expected > 0 ? Math.min((worked / expected) * 100, 100) : 0;
  const utilPct = Number(summary?.kpis.utilizationPercentVsExpected ?? completion);

  const sparkData = useMemo(() => {
    const raw = summary?.breakdowns?.byDay || history.dayBuckets.map((b) => ({ date: b.date, hours: b.hoursWorked }));
    return raw.map((d) => ({ v: Number(d.hours) }));
  }, [summary?.breakdowns?.byDay, history.dayBuckets]);

  const utilColors = getUtilColor(utilPct);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className={cardClass}>
            <CardContent className="p-5 space-y-3 min-h-[160px]">
              <Skeleton className="h-9 w-9 rounded-[10px]" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
      {/* 1. Total Logged */}
      <KpiCard
        title="Total Logged"
        value={fmtHours(worked)}
        sub={`of ${fmtHours(expected)} expected`}
        icon={<Clock className="h-[18px] w-[18px]" />}
        accentColor={TS.primary}
        accentBg={TS.primaryLight}
      >
        {sparkData.length > 1 && (
          <div className="h-10 -mx-1 mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={TS.primary} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={TS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={TS.primary}
                  strokeWidth={1.5}
                  fill="url(#sparkGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
                <RechartsTooltip
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="bg-white/95 backdrop-blur-sm border border-[#F2F4F7] rounded-lg px-2 py-1 text-xs font-bold shadow-lg">
                        {Number(payload[0].value).toFixed(1)}h
                      </div>
                    ) : null
                  }
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </KpiCard>

      {/* 2. Period Progress */}
      <KpiCard
        title="Period Progress"
        value={`${Math.round(completion)}%`}
        sub={`${fmtHours(worked)} / ${fmtHours(expected)}`}
        icon={<Target className="h-[18px] w-[18px]" />}
        accentColor={completion >= 100 ? TS.success : TS.primary}
        accentBg={completion >= 100 ? TS.successBg : TS.primaryLight}
      >
        <div className="mt-auto">
          <Progress
            value={completion}
            className="h-1.5 rounded-full"
            style={
              {
                '--progress-color':
                  completion >= 100 ? TS.success : completion >= 70 ? TS.primary : TS.warning,
              } as React.CSSProperties
            }
          />
        </div>
      </KpiCard>

      {/* 3. Utilization */}
      <KpiCard
        title="Utilization"
        value={`${Math.round(utilPct)}%`}
        sub="vs expected hours"
        icon={<BarChart3 className="h-[18px] w-[18px]" />}
        accentColor={utilColors.fg}
        accentBg={utilColors.bg}
        badge={
          <Badge
            className="text-[11px] font-bold border-none rounded-lg px-2"
            style={{ background: utilColors.bg, color: utilColors.fg }}
          >
            {utilPct >= 90 ? 'On Track' : utilPct >= 70 ? 'Below' : 'Low'}
          </Badge>
        }
      />

    </div>
  );
}

export default TimesheetKpiCards;
