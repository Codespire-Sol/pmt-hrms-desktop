import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  UserPlus,
  AlertCircle,
  Calendar,
  PlayCircle,
  Clock,
  GitPullRequest,
  AtSign,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} from '../notificationsApi';
import { NotificationWithDetails, NotificationType } from '../types';
import { cn } from '@/lib/utils';

// Icon mapping for notification types
const notificationIcons: Record<NotificationType, React.ReactNode> = {
  issue_created: <GitPullRequest className="h-4 w-4" />,
  issue_updated: <GitPullRequest className="h-4 w-4" />,
  issue_assigned: <UserPlus className="h-4 w-4" />,
  issue_commented: <MessageSquare className="h-4 w-4" />,
  issue_mentioned: <AtSign className="h-4 w-4" />,
  sprint_started: <PlayCircle className="h-4 w-4" />,
  sprint_ending: <AlertCircle className="h-4 w-4" />,
  due_date_approaching: <Calendar className="h-4 w-4" />,
  issue_status_changed: <Clock className="h-4 w-4" />,
};

// Color mapping for notification types
const notificationColors: Record<NotificationType, string> = {
  issue_created: 'text-green-500 bg-green-500/10',
  issue_updated: 'text-blue-500 bg-blue-500/10',
  issue_assigned: 'text-purple-500 bg-purple-500/10',
  issue_commented: 'text-yellow-500 bg-yellow-500/10',
  issue_mentioned: 'text-pink-500 bg-pink-500/10',
  sprint_started: 'text-cyan-500 bg-cyan-500/10',
  sprint_ending: 'text-orange-500 bg-orange-500/10',
  due_date_approaching: 'text-red-500 bg-red-500/10',
  issue_status_changed: 'text-indigo-500 bg-indigo-500/10',
};

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: NotificationWithDetails;
  onMarkRead: (id: string) => void;
}) {
  const issueUrl = notification.issueId
    ? `/projects/${notification.projectId}/issues/${notification.issueId}`
    : notification.projectId
      ? `/projects/${notification.projectId}`
      : '#';

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer group',
        !notification.isRead && 'bg-muted/30'
      )}
      onClick={() => {
        if (!notification.isRead) {
          onMarkRead(notification.id);
        }
      }}
    >
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          notificationColors[notification.type]
        )}
      >
        {notificationIcons[notification.type]}
      </div>

      <div className="flex-1 min-w-0">
        <Link
          to={issueUrl}
          className="block"
          onClick={(e) => {
            e.stopPropagation();
            if (!notification.isRead) {
              onMarkRead(notification.id);
            }
          }}
        >
          <p className="text-sm font-medium text-foreground line-clamp-1">
            {notification.title}
          </p>
          {notification.message && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {notification.message}
            </p>
          )}
        </Link>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>

      {!notification.isRead && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkRead(notification.id);
          }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
          title="Mark as read"
        >
          <Check className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {!notification.isRead && (
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
      )}
    </div>
  );
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useGetUnreadCountQuery(undefined, {
    pollingInterval: 60000, // Poll every minute
  });

  const { data: notificationsData, isLoading } = useGetNotificationsQuery(
    { limit: 10, offset: 0 },
    { skip: !isOpen }
  );

  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();

  const notifications = notificationsData?.notifications || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead([id]).unwrap();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead().unwrap();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-popover border rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-[400px] overflow-y-auto divide-y">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t p-2">
              <Link
                to="/notifications"
                className="flex items-center justify-center gap-1 text-sm text-primary hover:underline py-2"
                onClick={() => setIsOpen(false)}
              >
                View all notifications
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
