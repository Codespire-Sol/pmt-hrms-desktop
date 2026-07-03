import React, { useRef, useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Virtualized List Component
 *
 * Efficiently renders large lists by only rendering visible items.
 * Uses a custom windowing implementation for flexibility.
 */

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  renderItem: (item: T, index: number) => React.ReactNode;
  height?: number | string;
  width?: number | string;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  estimatedItemSize?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  height = 400,
  width = '100%',
  overscan = 5,
  className,
  onScroll,
  onEndReached,
  endReachedThreshold = 200,
  getItemKey,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate item height
  const getItemHeight = useCallback(
    (index: number) => {
      return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
    },
    [itemHeight]
  );

  // Calculate total height and item positions
  const { totalHeight, itemPositions } = useMemo(() => {
    const positions: number[] = [];
    let total = 0;

    for (let i = 0; i < items.length; i++) {
      positions.push(total);
      total += getItemHeight(i);
    }

    return { totalHeight: total, itemPositions: positions };
  }, [items.length, getItemHeight]);

  // Get container height as number
  const containerHeight = useMemo(() => {
    if (typeof height === 'number') return height;
    return 400; // Default fallback
  }, [height]);

  // Calculate visible range
  const { startIndex, endIndex } = useMemo(() => {
    // Binary search for start index
    let start = 0;
    let end = items.length - 1;

    while (start <= end) {
      const mid = Math.floor((start + end) / 2);
      if (itemPositions[mid] < scrollTop) {
        start = mid + 1;
      } else {
        end = mid - 1;
      }
    }

    const startIdx = Math.max(0, end - overscan);

    // Find end index
    let endIdx = startIdx;
    const maxScroll = scrollTop + containerHeight;

    while (endIdx < items.length && itemPositions[endIdx] < maxScroll) {
      endIdx++;
    }

    endIdx = Math.min(items.length - 1, endIdx + overscan);

    return { startIndex: startIdx, endIndex: endIdx };
  }, [scrollTop, containerHeight, items.length, itemPositions, overscan]);

  // Handle scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      setScrollTop(newScrollTop);
      onScroll?.(newScrollTop);

      // Check if we've reached the end
      if (onEndReached) {
        const scrollHeight = e.currentTarget.scrollHeight;
        const clientHeight = e.currentTarget.clientHeight;

        if (scrollHeight - newScrollTop - clientHeight < endReachedThreshold) {
          onEndReached();
        }
      }
    },
    [onScroll, onEndReached, endReachedThreshold]
  );

  // Render visible items
  const visibleItems = useMemo(() => {
    const rendered: React.ReactNode[] = [];

    for (let i = startIndex; i <= endIndex && i < items.length; i++) {
      const item = items[i];
      const key = getItemKey ? getItemKey(item, i) : i;
      const itemH = getItemHeight(i);

      rendered.push(
        <div
          key={key}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: itemH,
            transform: `translateY(${itemPositions[i]}px)`,
          }}
        >
          {renderItem(item, i)}
        </div>
      );
    }

    return rendered;
  }, [startIndex, endIndex, items, itemPositions, getItemHeight, renderItem, getItemKey]);

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      style={{ height, width }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalHeight,
          width: '100%',
          position: 'relative',
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
}

// ============================================
// VIRTUALIZED GRID
// ============================================

interface VirtualizedGridProps<T> {
  items: T[];
  columnCount: number;
  rowHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  height?: number | string;
  width?: number | string;
  gap?: number;
  overscan?: number;
  className?: string;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualizedGrid<T>({
  items,
  columnCount,
  rowHeight,
  renderItem,
  height = 400,
  width = '100%',
  gap = 16,
  overscan = 2,
  className,
  getItemKey,
}: VirtualizedGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const rowCount = Math.ceil(items.length / columnCount);
  const totalHeight = rowCount * (rowHeight + gap) - gap;

  const containerHeight = typeof height === 'number' ? height : 400;

  // Calculate visible rows
  const { startRow, endRow } = useMemo(() => {
    const rowWithGap = rowHeight + gap;
    const start = Math.max(0, Math.floor(scrollTop / rowWithGap) - overscan);
    const end = Math.min(
      rowCount - 1,
      Math.ceil((scrollTop + containerHeight) / rowWithGap) + overscan
    );
    return { startRow: start, endRow: end };
  }, [scrollTop, containerHeight, rowHeight, gap, rowCount, overscan]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Render visible items
  const visibleItems = useMemo(() => {
    const rendered: React.ReactNode[] = [];
    const rowWithGap = rowHeight + gap;

    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < columnCount; col++) {
        const index = row * columnCount + col;
        if (index >= items.length) break;

        const item = items[index];
        const key = getItemKey ? getItemKey(item, index) : index;

        rendered.push(
          <div
            key={key}
            style={{
              position: 'absolute',
              top: row * rowWithGap,
              left: `calc(${(col / columnCount) * 100}% + ${col > 0 ? gap / 2 : 0}px)`,
              width: `calc(${100 / columnCount}% - ${gap * (columnCount - 1) / columnCount}px)`,
              height: rowHeight,
            }}
          >
            {renderItem(item, index)}
          </div>
        );
      }
    }

    return rendered;
  }, [startRow, endRow, items, columnCount, rowHeight, gap, renderItem, getItemKey]);

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      style={{ height, width }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalHeight,
          width: '100%',
          position: 'relative',
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
}

// ============================================
// INFINITE SCROLL LIST
// ============================================

interface InfiniteScrollListProps<T> extends Omit<VirtualizedListProps<T>, 'onEndReached'> {
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
  loadingComponent?: React.ReactNode;
}

export function InfiniteScrollList<T>({
  hasMore,
  isLoading,
  loadMore,
  loadingComponent,
  ...props
}: InfiniteScrollListProps<T>) {
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  return (
    <div className="relative">
      <VirtualizedList {...props} onEndReached={handleEndReached} />
      {isLoading && (
        <div className="flex justify-center py-4">
          {loadingComponent || (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// SIMPLE WINDOWED LIST (Fixed height items)
// ============================================

interface SimpleVirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  containerHeight: number;
  className?: string;
}

export function SimpleVirtualList<T>({
  items,
  itemHeight,
  renderItem,
  containerHeight,
  className,
}: SimpleVirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, items.length);

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return (
    <div
      className={cn('overflow-auto', className)}
      style={{ height: containerHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedList;
