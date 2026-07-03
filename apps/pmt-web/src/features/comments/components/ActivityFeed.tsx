import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  MessageSquare,
  ArrowRight,
  User,
  Flag,
  Type,
  FileText,
  Calendar,
  Clock,
  Tag,
  Link2,
  Plus,
} from 'lucide-react';
import { useGetActivityQuery } from '../commentsApi';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ActivityLog } from '../types';

interface ActivityFeedProps {
  issueId: string;
}

export function ActivityFeed({ issueId }: ActivityFeedProps) {
  const { data, isLoading, error } = useGetActivityQuery({ issueId });

  const activities = data?.data?.activities || [];

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Plus className="h-4 w-4" />;
      case 'commented':
        return <MessageSquare className="h-4 w-4" />;
      case 'status_changed':
        return <ArrowRight className="h-4 w-4" />;
      case 'assignee_changed':
        return <User className="h-4 w-4" />;
      case 'priority_changed':
        return <Flag className="h-4 w-4" />;
      case 'type_changed':
        return <Type className="h-4 w-4" />;
      case 'title_changed':
      case 'description_changed':
        return <FileText className="h-4 w-4" />;
      case 'due_date_changed':
        return <Calendar className="h-4 w-4" />;
      case 'estimate_changed':
        return <Clock className="h-4 w-4" />;
      case 'labels_changed':
        return <Tag className="h-4 w-4" />;
      case 'linked':
      case 'unlinked':
        return <Link2 className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityDescription = (activity: ActivityLog) => {
    switch (activity.action) {
      case 'created':
        return 'created this issue';
      case 'commented':
        return 'added a comment';
      case 'status_changed':
        return (
          <>
            changed status from{' '}
            <Badge variant="outline" className="mx-1">
              {activity.oldValue || 'None'}
            </Badge>
            to
            <Badge variant="outline" className="mx-1">
              {activity.newValue}
            </Badge>
          </>
        );
      case 'assignee_changed':
        return (
          <>
            changed assignee from{' '}
            <span className="font-medium">{activity.oldValue || 'Unassigned'}</span>
            {' to '}
            <span className="font-medium">{activity.newValue || 'Unassigned'}</span>
          </>
        );
      case 'priority_changed':
        return (
          <>
            changed priority from{' '}
            <Badge variant="outline" className="mx-1">
              {activity.oldValue || 'None'}
            </Badge>
            to
            <Badge variant="outline" className="mx-1">
              {activity.newValue}
            </Badge>
          </>
        );
      case 'type_changed':
        return `changed type from ${activity.oldValue || 'None'} to ${activity.newValue}`;
      case 'title_changed':
        return 'updated the title';
      case 'description_changed':
        return 'updated the description';
      case 'due_date_changed':
        return `changed due date from ${activity.oldValue || 'None'} to ${activity.newValue || 'None'}`;
      case 'estimate_changed':
        return `changed estimate from ${activity.oldValue || 'None'} to ${activity.newValue}h`;
      case 'sprint_changed':
        return `moved to sprint: ${activity.newValue || 'Backlog'}`;
      case 'labels_changed':
        return 'updated labels';
      case 'linked':
        return `linked to ${activity.newValue}`;
      case 'unlinked':
        return `unlinked from ${activity.oldValue}`;
      default:
        return activity.fieldName
          ? `updated ${activity.fieldName}`
          : 'made changes';
    }
  };

  if (error) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Failed to load activity. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5" />
        <h3 className="font-semibold">Activity</h3>
      </div>

      {/* Activity timeline */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No activity yet
        </p>
      ) : (
        <div className="space-y-0">
          {activities.map((activity, index) => (
            <div key={activity.id} className="relative flex gap-3">
              {/* Timeline line */}
              {index < activities.length - 1 && (
                <div className="absolute left-4 top-8 h-full w-px bg-border" />
              )}

              {/* Avatar */}
              <div className="relative z-10 flex flex-col items-center">
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarImage src={activity.user.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {activity.user.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-full bg-muted p-1">
                    {getActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1 text-sm">
                      <span className="font-medium">{activity.user.displayName}</span>
                      <span className="text-muted-foreground">
                        {getActivityDescription(activity)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                      })}
                    </p>

                    {/* Comment preview */}
                    {activity.action === 'commented' && activity.comment && (
                      <div className="mt-2 rounded-lg bg-muted p-3 text-sm">
                        {activity.comment.content.length > 200
                          ? `${activity.comment.content.substring(0, 200)}...`
                          : activity.comment.content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
