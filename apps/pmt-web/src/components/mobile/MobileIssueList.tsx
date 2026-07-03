import React from 'react';
import { ChevronRight, Circle, CheckCircle2, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SwipeActions, swipeActionPresets } from './SwipeActions';
import { cn } from '@/lib/utils';

interface Issue {
  id: string;
  key: string;
  title: string;
  status: {
    id: string;
    name: string;
    color?: string;
  };
  priority: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
  assignee?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  issueType: string;
  dueDate?: string;
  storyPoints?: number;
}

interface MobileIssueListProps {
  issues: Issue[];
  onIssueClick?: (issue: Issue) => void;
  onIssueComplete?: (issueId: string) => void;
  onIssueDelete?: (issueId: string) => void;
  showSwipeActions?: boolean;
  emptyMessage?: string;
}

const priorityIcons: Record<string, { color: string; order: number }> = {
  highest: { color: '#ef4444', order: 1 },
  high: { color: '#f97316', order: 2 },
  medium: { color: '#eab308', order: 3 },
  low: { color: '#3b82f6', order: 4 },
  lowest: { color: '#6b7280', order: 5 },
};

export function MobileIssueList({
  issues,
  onIssueClick,
  onIssueComplete,
  onIssueDelete,
  showSwipeActions = true,
  emptyMessage = 'No issues found',
}: MobileIssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Circle className="h-12 w-12 mb-4 opacity-30" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const renderIssueItem = (issue: Issue) => {
    const isDueSoon = issue.dueDate && isWithinDays(issue.dueDate, 3);
    const isOverdue = issue.dueDate && isPast(issue.dueDate);

    const content = (
      <div
        className="flex items-center gap-3 p-4 bg-background border-b active:bg-muted/50 transition-colors"
        onClick={() => onIssueClick?.(issue)}
      >
        {/* Priority Indicator */}
        <div
          className="w-1 h-12 rounded-full flex-shrink-0"
          style={{ backgroundColor: priorityIcons[issue.priority]?.color }}
        />

        {/* Issue Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">
              {issue.key}
            </span>
            <Badge
              variant="outline"
              className="text-xs h-5"
              style={{
                borderColor: issue.status.color,
                color: issue.status.color,
              }}
            >
              {issue.status.name}
            </Badge>
          </div>

          <h3 className="font-medium text-sm line-clamp-2 mb-1">
            {issue.title}
          </h3>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {issue.dueDate && (
              <span
                className={cn(
                  'flex items-center gap-1',
                  isOverdue && 'text-destructive',
                  isDueSoon && !isOverdue && 'text-warning'
                )}
              >
                <Clock className="h-3 w-3" />
                {formatDueDate(issue.dueDate)}
              </span>
            )}
            {issue.storyPoints !== undefined && (
              <span>{issue.storyPoints} pts</span>
            )}
          </div>
        </div>

        {/* Assignee */}
        {issue.assignee ? (
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={issue.assignee.avatarUrl} />
            <AvatarFallback className="text-xs">
              {issue.assignee.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <Circle className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </div>
    );

    if (showSwipeActions) {
      return (
        <SwipeActions
          key={issue.id}
          leftAction={
            onIssueDelete
              ? {
                  ...swipeActionPresets.delete,
                  onAction: () => onIssueDelete(issue.id),
                }
              : undefined
          }
          rightAction={
            onIssueComplete
              ? {
                  ...swipeActionPresets.complete,
                  icon: <CheckCircle2 className="h-5 w-5" />,
                  onAction: () => onIssueComplete(issue.id),
                }
              : undefined
          }
        >
          {content}
        </SwipeActions>
      );
    }

    return <div key={issue.id}>{content}</div>;
  };

  return (
    <div className="divide-y">{issues.map((issue) => renderIssueItem(issue))}</div>
  );
}

// Date helper functions
function isWithinDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

function isPast(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return date < now;
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)}d overdue`;
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else if (diffDays <= 7) {
    return `In ${diffDays}d`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// Grouped Issue List by Status
interface GroupedMobileIssueListProps extends MobileIssueListProps {
  groupBy: 'status' | 'priority' | 'assignee';
}

export function GroupedMobileIssueList({
  issues,
  groupBy,
  ...props
}: GroupedMobileIssueListProps) {
  const groups = React.useMemo(() => {
    const grouped = new Map<string, { label: string; issues: Issue[] }>();

    issues.forEach((issue) => {
      let key: string;
      let label: string;

      switch (groupBy) {
        case 'status':
          key = issue.status.id;
          label = issue.status.name;
          break;
        case 'priority':
          key = issue.priority;
          label = issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1);
          break;
        case 'assignee':
          key = issue.assignee?.id || 'unassigned';
          label = issue.assignee?.name || 'Unassigned';
          break;
        default:
          key = 'all';
          label = 'All Issues';
      }

      if (!grouped.has(key)) {
        grouped.set(key, { label, issues: [] });
      }
      grouped.get(key)!.issues.push(issue);
    });

    return Array.from(grouped.values());
  }, [issues, groupBy]);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted/30 sticky top-0">
            {group.label}
            <span className="ml-2 text-xs">({group.issues.length})</span>
          </h3>
          <MobileIssueList issues={group.issues} {...props} />
        </div>
      ))}
    </div>
  );
}

export default MobileIssueList;
