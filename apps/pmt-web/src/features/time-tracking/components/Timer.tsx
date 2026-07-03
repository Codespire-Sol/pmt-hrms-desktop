import { useState, useEffect } from 'react';
import { Play, Square, Pause, Clock } from 'lucide-react';
import {
  useGetActiveTimerQuery,
  useStartTimerMutation,
  useStopTimerMutation,
  usePauseTimerMutation,
  useResumeTimerMutation,
} from '../timeTrackingApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

interface TimerProps {
  issueId?: string;
  issueKey?: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function Timer({ issueId }: TimerProps) {
  const { hasPermission: canLogTime } = usePermissionGuard('time.log');
  const { data: timerData, refetch } = useGetActiveTimerQuery();
  const [startTimer] = useStartTimerMutation();
  const [stopTimer] = useStopTimerMutation();
  const [pauseTimer] = usePauseTimerMutation();
  const [resumeTimer] = useResumeTimerMutation();
  const [elapsed, setElapsed] = useState(0);

  const activeTimer = timerData?.data;
  const isRunning = activeTimer?.id && activeTimer.issue.id === issueId;
  const hasOtherTimer = activeTimer?.id && activeTimer.issue.id !== issueId;
  const isPaused = activeTimer?.is_paused;

  useEffect(() => {
    if (!activeTimer) {
      setElapsed(0);
      return;
    }

    // Start with accumulated seconds
    const accumulatedSeconds = activeTimer.accumulated_seconds || 0;

    if (activeTimer.is_paused) {
      // If paused, just show accumulated time
      setElapsed(accumulatedSeconds);
      return;
    }

    // Timer is running - calculate elapsed from start time + accumulated
    const startTime = new Date(activeTimer.started_at).getTime();

    const updateElapsed = () => {
      const currentSeconds = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(accumulatedSeconds + currentSeconds);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  const handleStart = async () => {
    if (!issueId) return;
    try {
      await startTimer({ issueId }).unwrap();
      refetch();
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handleStop = async () => {
    try {
      await stopTimer({}).unwrap();
      refetch();
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
  };

  const handlePause = async () => {
    try {
      await pauseTimer().unwrap();
      refetch();
    } catch (error) {
      console.error('Failed to pause timer:', error);
    }
  };

  const handleResume = async () => {
    try {
      await resumeTimer().unwrap();
      refetch();
    } catch (error) {
      console.error('Failed to resume timer:', error);
    }
  };

  if (hasOtherTimer) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Timer on {activeTimer?.issue.issueKey}
        </Badge>
      </div>
    );
  }

  if (!canLogTime) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        You don't have permission to log time.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isRunning ? (
        <>
          <Badge
            variant="default"
            className={`gap-1 ${isPaused ? 'bg-yellow-600' : 'bg-green-600 animate-pulse'}`}
          >
            <Clock className="h-3 w-3" />
            {formatDuration(elapsed)}
            {isPaused && <span className="ml-1 text-xs">(Paused)</span>}
          </Badge>
          {isPaused ? (
            <Button size="sm" variant="outline" onClick={handleResume}>
              <Play className="h-4 w-4 mr-1" />
              Resume
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handlePause}>
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={handleStop}>
            <Square className="h-4 w-4 mr-1" />
            Stop
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={handleStart} disabled={!issueId}>
          <Play className="h-4 w-4 mr-1" />
          Start Timer
        </Button>
      )}
    </div>
  );
}

export default Timer;
