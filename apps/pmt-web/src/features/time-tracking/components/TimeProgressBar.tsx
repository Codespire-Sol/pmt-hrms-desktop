import { Clock, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Progress } from '../../../components/ui/progress';
import { cn } from '../../../lib/utils';
import { useGetIssueTimeSummaryQuery } from '../timeTrackingApi';

interface TimeProgressBarProps {
  issueId: string;
  compact?: boolean;
  className?: string;
}

export function TimeProgressBar({ issueId, compact = false, className }: TimeProgressBarProps) {
  const { data, isLoading } = useGetIssueTimeSummaryQuery(issueId);

  if (isLoading || !data?.data) {
    return null;
  }

  const {
    originalEstimateHours,
    timeSpentHours,
    remainingEstimateHours,
    percentageComplete,
  } = data.data;

  // Don't show if no estimate
  if (originalEstimateHours === 0) {
    return null;
  }

  const isOverEstimate = timeSpentHours > originalEstimateHours;
  const overageHours = isOverEstimate ? timeSpentHours - originalEstimateHours : 0;
  const overagePercentage = isOverEstimate
    ? ((overageHours / originalEstimateHours) * 100).toFixed(0)
    : 0;

  const formatHours = (hours: number): string => {
    if (hours === 0) return '0h';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${minutes}m`;
  };

  const getProgressColor = () => {
    if (isOverEstimate) return 'bg-red-500';
    if (percentageComplete > 80) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getStatusIcon = () => {
    if (isOverEstimate) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    if (percentageComplete >= 100) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-xs', className)}>
        {getStatusIcon()}
        <div className="flex-1 min-w-[60px]">
          <Progress
            value={Math.min(percentageComplete, 100)}
            className="h-1.5"
            indicatorClassName={getProgressColor()}
          />
        </div>
        <span className="text-muted-foreground whitespace-nowrap">
          {formatHours(timeSpentHours)} / {formatHours(originalEstimateHours)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Time Progress</span>
        </div>
        <div className="flex items-center gap-1">
          {getStatusIcon()}
          <span
            className={cn(
              'text-sm font-medium',
              isOverEstimate ? 'text-red-600' : 'text-foreground'
            )}
          >
            {percentageComplete.toFixed(0)}%
          </span>
        </div>
      </div>

      <Progress
        value={Math.min(percentageComplete, 100)}
        className="h-2"
        indicatorClassName={getProgressColor()}
      />

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="text-center">
          <div className="text-muted-foreground text-xs">Estimated</div>
          <div className="font-medium">{formatHours(originalEstimateHours)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground text-xs">Spent</div>
          <div
            className={cn('font-medium', isOverEstimate && 'text-red-600')}
          >
            {formatHours(timeSpentHours)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground text-xs">Remaining</div>
          <div
            className={cn(
              'font-medium',
              isOverEstimate && 'text-red-600',
              remainingEstimateHours === 0 && !isOverEstimate && 'text-green-600'
            )}
          >
            {isOverEstimate ? (
              <span>+{formatHours(overageHours)} ({overagePercentage}% over)</span>
            ) : (
              formatHours(remainingEstimateHours)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
