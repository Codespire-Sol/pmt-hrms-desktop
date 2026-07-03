import { Wifi, WifiOff } from 'lucide-react';
import { useSocketContext } from '@/contexts/SocketContext';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * A small indicator showing the WebSocket connection status.
 * Useful for showing users when real-time features are available.
 */
export function ConnectionStatus({ className, showLabel = false }: ConnectionStatusProps) {
  const { isConnected } = useSocketContext();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs',
              isConnected ? 'text-green-600' : 'text-muted-foreground',
              className
            )}
          >
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {showLabel && (
              <span>{isConnected ? 'Connected' : 'Offline'}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isConnected
            ? 'Real-time updates are enabled'
            : 'Real-time updates are unavailable'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ConnectionStatus;
