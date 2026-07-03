import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
  className?: string;
  blur?: boolean;
}

/**
 * A loading overlay that displays over its children when isLoading is true.
 * Useful for showing loading states during form submissions or data mutations.
 */
export function LoadingOverlay({
  isLoading,
  message = 'Loading...',
  children,
  className,
  blur = true,
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 z-50 flex items-center justify-center bg-background/80',
            blur && 'backdrop-blur-sm'
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A full-screen loading overlay for page-level loading states.
 */
export function FullPageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/**
 * An inline loading spinner for buttons or small loading states.
 */
export function LoadingSpinner({
  size = 'default',
  className,
}: {
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2
      className={cn('animate-spin text-current', sizeClasses[size], className)}
    />
  );
}

/**
 * A button loading state wrapper that shows a spinner while loading.
 */
export function ButtonLoader({
  isLoading,
  children,
  loadingText,
}: {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
}) {
  if (isLoading) {
    return (
      <>
        <LoadingSpinner size="sm" className="mr-2" />
        {loadingText || 'Loading...'}
      </>
    );
  }
  return <>{children}</>;
}

export default LoadingOverlay;
