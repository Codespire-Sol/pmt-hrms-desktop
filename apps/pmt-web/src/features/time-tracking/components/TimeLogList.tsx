import { Clock, Trash2 } from 'lucide-react';
import { useGetTimeLogsByIssueQuery, useDeleteTimeLogMutation } from '../timeTrackingApi';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

interface TimeLogListProps {
  issueId: string;
  initialData?: any[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TimeLogList({ issueId, initialData }: TimeLogListProps) {
  const { data: fetchedData, isLoading: isFetchLoading } = useGetTimeLogsByIssueQuery(issueId, { skip: !!initialData });
  const data = initialData ? { data: initialData } : fetchedData;
  const isLoading = !initialData && isFetchLoading;
  const [deleteTimeLog] = useDeleteTimeLogMutation();
  const { hasPermission: canViewTimeLogs } = usePermissionGuard(
    ['time.log', 'time.view_all', 'time.edit_all', 'time.delete_all'],
    'any'
  );
  const { hasPermission: canManageTimeLogs } = usePermissionGuard('time.log');

  const timeLogs = data?.data || [];

  const handleDelete = async (timeLogId: string) => {
    if (confirm('Are you sure you want to delete this time log?')) {
      try {
        await deleteTimeLog(timeLogId).unwrap();
      } catch (error) {
        console.error('Failed to delete time log:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!canViewTimeLogs) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        You don't have permission to view time logs.
      </div>
    );
  }

  if (timeLogs.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No time logged yet
      </div>
    );
  }

  const totalHours = timeLogs.reduce((sum, log) => sum + Number(log.hours || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Time Logged</span>
        <span className="text-muted-foreground">
          Total: {totalHours.toFixed(2)}h
        </span>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {timeLogs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 group"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={log.user?.avatarUrl || undefined} />
              <AvatarFallback>
                {log.user?.displayName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {log.user?.displayName || 'Unknown'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(log.work_date)}
                </span>
              </div>
              {log.description && (
                <p className="text-sm text-muted-foreground truncate">
                  {log.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span>{log.hours}h</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(log.id)}
                disabled={!canManageTimeLogs}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TimeLogList;
