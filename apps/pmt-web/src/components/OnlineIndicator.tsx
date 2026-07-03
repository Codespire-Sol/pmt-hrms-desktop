import { cn } from '@/lib/utils';
import { useUserPresence } from '@/contexts/SocketContext';

interface OnlineIndicatorProps {
  userId: string;
  className?: string;
  showOffline?: boolean;
}

/**
 * A small indicator dot that shows whether a user is currently online.
 * Must be used within a SocketProvider.
 */
export function OnlineIndicator({ userId, className, showOffline = false }: OnlineIndicatorProps) {
  const isOnline = useUserPresence(userId);

  if (!isOnline && !showOffline) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full border-2 border-background',
        isOnline ? 'bg-green-500' : 'bg-gray-300',
        className
      )}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
}

/**
 * A wrapper that adds an online indicator to any element (typically an Avatar).
 */
export function WithOnlineIndicator({
  userId,
  children,
  position = 'bottom-right',
}: {
  userId: string;
  children: React.ReactNode;
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
}) {
  const positionClasses = {
    'top-right': '-top-0.5 -right-0.5',
    'bottom-right': '-bottom-0.5 -right-0.5',
    'top-left': '-top-0.5 -left-0.5',
    'bottom-left': '-bottom-0.5 -left-0.5',
  };

  return (
    <div className="relative inline-block">
      {children}
      <OnlineIndicator
        userId={userId}
        className={cn('absolute', positionClasses[position])}
      />
    </div>
  );
}

export default OnlineIndicator;
