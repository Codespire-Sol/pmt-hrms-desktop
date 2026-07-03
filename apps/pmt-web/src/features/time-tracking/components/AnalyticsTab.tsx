import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3, PieChart, ListOrdered, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { DailyHoursChart } from './DailyHoursChart';
import { ProjectBreakdownChart } from './ProjectBreakdownChart';
import { IssueBreakdownChart } from './IssueBreakdownChart';
import { BillableBreakdownChart } from './BillableBreakdownChart';
import type { TimesheetHistoryResponse, TimesheetSummaryResponse } from '../types';
import { TS, cardClass, cardHoverClass } from './timesheet-styles';

interface Props {
  summary?: TimesheetSummaryResponse;
  history: TimesheetHistoryResponse;
  expectedPerDay: number;
}

export function AnalyticsTab({ summary, history, expectedPerDay }: Props) {
  const dailyData = useMemo(() => {
    const raw = summary?.breakdowns?.byDay || history.dayBuckets.map((b) => ({ date: b.date, hours: b.hoursWorked }));
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const mths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return raw.map((d) => {
      const dt = new Date(d.date + 'T00:00:00');
      return {
        date: `${daysMap[dt.getDay()]} ${mths[dt.getMonth()]} ${dt.getDate()}`,
        hours: Number(d.hours),
      };
    });
  }, [summary?.breakdowns?.byDay, history.dayBuckets]);

  const projectData = useMemo(() => {
    const raw = summary?.breakdowns?.byProject || [];
    return raw.map((p) => ({
      name: p.projectKey || p.projectId,
      label: p.projectName || p.projectKey || p.projectId,
      value: Number(p.workedHours),
    }));
  }, [summary?.breakdowns?.byProject]);

  const issueData = useMemo(() => {
    const raw = summary?.breakdowns?.byIssue || [];
    return [...raw]
      .sort((a, b) => Number(b.workedHours) - Number(a.workedHours))
      .slice(0, 10)
      .map((i) => ({
        name: i.issueKey,
        label: i.issueTitle || i.issueKey,
        worked: Number(i.workedHours),
        estimated: Number(i.estimatedHours ?? 0),
      }));
  }, [summary?.breakdowns?.byIssue]);

  const totalProjectHours = projectData.reduce((s, d) => s + d.value, 0);
  const totalDailyHours = dailyData.reduce((s, d) => s + d.hours, 0);
  const avgDailyHours = dailyData.length > 0 ? totalDailyHours / dailyData.filter((d) => d.hours > 0).length || 0 : 0;

  // Trend: compare first half vs second half of daily data
  const dailyTrend = useMemo(() => {
    if (dailyData.length < 2) return 0;
    const mid = Math.floor(dailyData.length / 2);
    const firstHalf = dailyData.slice(0, mid).reduce((s, d) => s + d.hours, 0);
    const secondHalf = dailyData.slice(mid).reduce((s, d) => s + d.hours, 0);
    if (firstHalf === 0) return secondHalf > 0 ? 1 : 0;
    return (secondHalf - firstHalf) / firstHalf;
  }, [dailyData]);

  const chartCards = [
    {
      key: 'daily',
      icon: <BarChart3 className="h-4 w-4 text-blue-600" />,
      iconBg: 'bg-blue-50',
      title: 'Daily Hours',
      description: `Hours logged per day vs ${expectedPerDay.toFixed(0)}h daily target`,
      trend: dailyTrend,
      trendLabel: avgDailyHours > 0 ? `${avgDailyHours.toFixed(1)}h avg` : undefined,
      content: <DailyHoursChart data={dailyData} expectedPerDay={expectedPerDay} />,
    },
    {
      key: 'project',
      icon: <PieChart className="h-4 w-4 text-purple-600" />,
      iconBg: 'bg-purple-50',
      title: 'Project Breakdown',
      description: 'Time distribution across projects',
      trendLabel: projectData.length > 0 ? `${projectData.length} project${projectData.length > 1 ? 's' : ''}` : undefined,
      content: <ProjectBreakdownChart data={projectData} totalHours={totalProjectHours} />,
    },
    {
      key: 'issue',
      icon: <ListOrdered className="h-4 w-4 text-orange-600" />,
      iconBg: 'bg-orange-50',
      title: 'Issue Breakdown',
      description: 'Top 10 issues — worked vs estimated hours',
      trendLabel: issueData.length > 0 ? `${issueData.length} issues` : undefined,
      content: issueData.length ? (
        <IssueBreakdownChart data={issueData} />
      ) : (
        <div className="h-[200px] flex items-center justify-center text-[13px] font-medium" style={{ color: TS.textMuted }}>
          No issue data for this period
        </div>
      ),
    },
    {
      key: 'billable',
      icon: <DollarSign className="h-4 w-4 text-green-600" />,
      iconBg: 'bg-green-50',
      title: 'Billable vs Non-billable',
      description: 'Daily breakdown of billable and non-billable time',
      content: <BillableBreakdownChart dayBuckets={history.dayBuckets} />,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {chartCards.map((card, idx) => (
        <motion.div
          key={card.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: idx * 0.05, ease: 'easeOut' }}
          whileHover={{ y: -1, transition: { duration: 0.15 } }}
        >
          <Card className={`${cardClass} ${cardHoverClass} h-full`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`h-8 w-8 rounded-[10px] ${card.iconBg} flex items-center justify-center`}>
                    {card.icon}
                  </div>
                  <div>
                    <CardTitle className="text-[14px] font-bold" style={{ color: TS.textPrimary }}>
                      {card.title}
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      {card.description}
                    </CardDescription>
                  </div>
                </div>
                {/* Trend indicator */}
                <div className="flex items-center gap-1.5">
                  {card.trendLabel && (
                    <span className="text-[11px] font-semibold" style={{ color: TS.textMuted }}>
                      {card.trendLabel}
                    </span>
                  )}
                  {card.trend !== undefined && card.trend !== 0 && (
                    <span
                      className="flex items-center gap-0.5 text-[11px] font-bold rounded-md px-1.5 py-0.5"
                      style={{
                        background: card.trend > 0 ? TS.successBg : TS.dangerBg,
                        color: card.trend > 0 ? TS.success : TS.danger,
                      }}
                    >
                      {card.trend > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(card.trend * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {card.content}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

export default AnalyticsTab;
