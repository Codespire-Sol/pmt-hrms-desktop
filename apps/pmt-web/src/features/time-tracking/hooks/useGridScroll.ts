import { useCallback, useEffect, useRef, useState } from 'react';

interface UseGridScrollOptions {
  containerRef: React.RefObject<HTMLDivElement>;
  cellSelector?: string;
  rows: number;
  cols: number;
  onCellFocus?: (row: number, col: number) => void;
  onCellActivate?: (row: number, col: number) => void;
}

interface UseGridScrollReturn {
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleMouseLeave: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  isDragging: boolean;
  focusedCell: { row: number; col: number } | null;
  setFocusedCell: (cell: { row: number; col: number } | null) => void;
}

const DRAG_THRESHOLD = 3; // px before considered a drag

export function useGridScroll({
  containerRef,
  cellSelector = '[data-grid-cell]',
  rows,
  cols,
  onCellFocus,
  onCellActivate,
}: UseGridScrollOptions): UseGridScrollReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  } | null>(null);

  // Shift+wheel → horizontal scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      // Shift+wheel OR horizontal scroll (deltaX != 0 already handled natively)
      if (e.shiftKey && Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [containerRef]);

  // Drag-to-pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // Don't initiate drag on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, a, [role="button"]')) return;

      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
        moved: false,
      };
    },
    [containerRef],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag?.active) return;

      const container = containerRef.current;
      if (!container) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (!drag.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        drag.moved = true;
        setIsDragging(true);
      }

      if (drag.moved) {
        requestAnimationFrame(() => {
          container.scrollLeft = drag.scrollLeft - dx;
        });
      }
    },
    [containerRef],
  );

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current.active = false;
      dragRef.current = null;
    }
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (dragRef.current?.active) {
      dragRef.current.active = false;
      dragRef.current = null;
      setIsDragging(false);
    }
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focusedCell) {
        // If no cell focused, arrow keys focus the first cell
        if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
          setFocusedCell({ row: 0, col: 0 });
          onCellFocus?.(0, 0);
          e.preventDefault();
        }
        return;
      }

      const { row, col } = focusedCell;
      let newRow = row;
      let newCol = col;

      switch (e.key) {
        case 'ArrowRight':
          newCol = Math.min(cols - 1, col + 1);
          break;
        case 'ArrowLeft':
          newCol = Math.max(0, col - 1);
          break;
        case 'ArrowDown':
          newRow = Math.min(rows - 1, row + 1);
          break;
        case 'ArrowUp':
          newRow = Math.max(0, row - 1);
          break;
        case 'Enter':
          onCellActivate?.(row, col);
          e.preventDefault();
          return;
        case 'Escape':
          setFocusedCell(null);
          e.preventDefault();
          return;
        default:
          return;
      }

      if (newRow !== row || newCol !== col) {
        setFocusedCell({ row: newRow, col: newCol });
        onCellFocus?.(newRow, newCol);

        // Scroll focused cell into view
        const container = containerRef.current;
        if (container) {
          const cell = container.querySelector(
            `${cellSelector}[data-row="${newRow}"][data-col="${newCol}"]`,
          ) as HTMLElement;
          cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }

      e.preventDefault();
    },
    [focusedCell, rows, cols, onCellFocus, onCellActivate, containerRef, cellSelector],
  );

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleKeyDown,
    isDragging,
    focusedCell,
    setFocusedCell,
  };
}
