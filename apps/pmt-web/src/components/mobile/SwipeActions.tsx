import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface SwipeAction {
  label: string;
  icon?: React.ReactNode;
  color: string;
  textColor?: string;
  onAction: () => void;
}

interface SwipeActionsProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  threshold?: number;
  className?: string;
  disabled?: boolean;
}

export function SwipeActions({
  children,
  leftAction,
  rightAction,
  threshold = 80,
  className,
  disabled = false,
}: SwipeActionsProps) {
  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startX = useRef<number>(0);
  const startY = useRef<number>(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      isHorizontalSwipe.current = null;
      setIsAnimating(false);
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - startX.current;
      const deltaY = currentY - startY.current;

      // Determine swipe direction on first move
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
        }
      }

      // Only handle horizontal swipes
      if (!isHorizontalSwipe.current) return;

      // Prevent vertical scroll when swiping horizontally
      e.preventDefault();

      // Calculate offset with resistance at edges
      let newOffset = deltaX;
      const maxOffset = threshold + 20;

      // Apply resistance
      if (newOffset > 0 && rightAction) {
        newOffset = Math.min(newOffset, maxOffset);
        // Rubber band effect
        if (newOffset > threshold) {
          newOffset = threshold + (newOffset - threshold) * 0.3;
        }
      } else if (newOffset < 0 && leftAction) {
        newOffset = Math.max(newOffset, -maxOffset);
        if (newOffset < -threshold) {
          newOffset = -threshold + (newOffset + threshold) * 0.3;
        }
      } else {
        newOffset = 0;
      }

      setOffset(newOffset);
    },
    [disabled, leftAction, rightAction, threshold]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;

    setIsAnimating(true);

    // Trigger action if threshold exceeded
    if (offset >= threshold && rightAction) {
      rightAction.onAction();
    } else if (offset <= -threshold && leftAction) {
      leftAction.onAction();
    }

    // Reset position
    setOffset(0);
    isHorizontalSwipe.current = null;
  }, [disabled, offset, threshold, leftAction, rightAction]);

  const leftOpacity = Math.min(1, Math.abs(offset) / threshold);
  const rightOpacity = Math.min(1, offset / threshold);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Left Action Background (revealed on swipe left) */}
      {leftAction && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end px-4"
          style={{
            backgroundColor: leftAction.color,
            opacity: offset < 0 ? leftOpacity : 0,
            width: Math.abs(offset),
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{ color: leftAction.textColor || 'white' }}
          >
            {leftAction.icon}
            <span className="font-medium">{leftAction.label}</span>
          </div>
        </div>
      )}

      {/* Right Action Background (revealed on swipe right) */}
      {rightAction && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start px-4"
          style={{
            backgroundColor: rightAction.color,
            opacity: offset > 0 ? rightOpacity : 0,
            width: offset,
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{ color: rightAction.textColor || 'white' }}
          >
            {rightAction.icon}
            <span className="font-medium">{rightAction.label}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          'relative bg-background',
          isAnimating && 'transition-transform duration-200 ease-out'
        )}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

// Preset swipe action configurations
export const swipeActionPresets = {
  delete: {
    label: 'Delete',
    color: '#ef4444',
    textColor: 'white',
  },
  archive: {
    label: 'Archive',
    color: '#6b7280',
    textColor: 'white',
  },
  complete: {
    label: 'Done',
    color: '#22c55e',
    textColor: 'white',
  },
  edit: {
    label: 'Edit',
    color: '#3b82f6',
    textColor: 'white',
  },
  flag: {
    label: 'Flag',
    color: '#f59e0b',
    textColor: 'white',
  },
};

// Example usage component
interface SwipeableListItemProps {
  children: React.ReactNode;
  onDelete?: () => void;
  onComplete?: () => void;
  onArchive?: () => void;
}

export function SwipeableListItem({
  children,
  onDelete,
  onComplete,
  onArchive,
}: SwipeableListItemProps) {
  return (
    <SwipeActions
      leftAction={
        onDelete
          ? {
              ...swipeActionPresets.delete,
              onAction: onDelete,
            }
          : undefined
      }
      rightAction={
        onComplete
          ? {
              ...swipeActionPresets.complete,
              onAction: onComplete,
            }
          : onArchive
          ? {
              ...swipeActionPresets.archive,
              onAction: onArchive,
            }
          : undefined
      }
    >
      {children}
    </SwipeActions>
  );
}

export default SwipeActions;
