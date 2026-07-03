import {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  EyeOff,
  Zap,
  X,
  AlertCircle,
  Plus,
} from 'lucide-react';
import type { WorkflowWithStatuses, Status, StatusTransition } from '../types';
import { CATEGORY_LABELS } from '../types';
import { useGetWorkflowQuery, useAddTransitionMutation, useRemoveTransitionMutation } from '../workflowsApi';

// ─── Constants ─────────────────────────────────────────────────────────────────
const NODE_W = 172;
const NODE_H = 52;
const COLUMN_ORDER = ['todo', 'in_progress', 'in_review', 'done'] as const;

const CAT_DOT: Record<string, string> = {
  todo: '#64748b',
  in_progress: '#3b82f6',
  in_review: '#7c3aed',
  done: '#10b981',
};

const CAT_BG: Record<string, string> = {
  todo: '#f8fafc',
  in_progress: '#eff6ff',
  in_review: '#f5f3ff',
  done: '#f0fdf4',
};

const CAT_BORDER: Record<string, string> = {
  todo: '#e2e8f0',
  in_progress: '#bfdbfe',
  in_review: '#ddd6fe',
  done: '#bbf7d0',
};

// ─── Special "any-transition" statuses ────────────────────────────────────────
// These statuses (Rejected, On Hold, Dependency) are shown in a separate bottom
// row with a dashed "Any ←" arrow instead of individual transition arrows, since
// any status can transition to them.
const SPECIAL_STATUS_KEYWORDS = ['rejected', 'on hold', 'on_hold', 'dependency'];
function isSpecialStatus(status: Status): boolean {
  const combined = `${status.name} ${status.displayName}`.toLowerCase();
  return SPECIAL_STATUS_KEYWORDS.some((k) => combined.includes(k));
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface NodePos {
  x: number;
  y: number;
}

interface WorkflowDiagramProps {
  workflow: WorkflowWithStatuses;
  readOnly?: boolean;
  showTransitionLabels?: boolean;
}

// ─── Main component ─────────────────────────────────────────────────────────────
export function WorkflowDiagram({
  workflow,
  readOnly = true,
  showTransitionLabels: initialLabels = true,
}: WorkflowDiagramProps) {
  const [addTransition] = useAddTransitionMutation();
  const [removeTransition] = useRemoveTransitionMutation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas transform
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  // Node positions (draggable)
  const [nodePositions, setNodePositions] = useState<Record<string, NodePos>>({});
  const draggingNode = useRef<{ id: string; ox: number; oy: number } | null>(null);

  // UI state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(initialLabels);
  const [isPanningState, setIsPanningState] = useState(false);
  const didPanRef = useRef(false);

  // Connect mode (click-to-connect)
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  // Transition naming modal
  const [namingTransition, setNamingTransition] = useState<{
    fromId: string;
    toId: string;
  } | null>(null);
  const [transitionName, setTransitionName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-layout on first load ──────────────────────────────────────────────
  const defaultPositions = useMemo(() => {
    const COL_GAP = 240;
    const ROW_GAP = 90;
    const OFFSET_X = 80;
    const OFFSET_Y = 80;

    // Separate special statuses from regular ones
    const specialStatuses = workflow.statuses.filter(isSpecialStatus);
    const regularStatuses = workflow.statuses.filter((s) => !isSpecialStatus(s));

    const grouped: Record<string, Status[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
      other: [],
    };

    for (const s of regularStatuses) {
      if (COLUMN_ORDER.includes(s.category as any)) {
        grouped[s.category].push(s);
      } else {
        grouped.other.push(s);
      }
    }

    const positions: Record<string, NodePos> = {};
    const allCols: [string, Status[]][] = [
      ...COLUMN_ORDER.map((c) => [c, grouped[c]] as [string, Status[]]),
      ['other', grouped.other],
    ];

    let maxRows = 0;
    allCols.forEach(([, statuses], colIdx) => {
      maxRows = Math.max(maxRows, statuses.length);
      statuses.forEach((s, rowIdx) => {
        positions[s.id] = {
          x: OFFSET_X + colIdx * COL_GAP,
          y: OFFSET_Y + rowIdx * ROW_GAP,
        };
      });
    });

    // Place special statuses (Rejected, On Hold, Dependency) in a separate bottom
    // row, spaced evenly, below the main flow columns.
    const specialY = OFFSET_Y + Math.max(maxRows, 1) * ROW_GAP + 60;
    specialStatuses.forEach((s, idx) => {
      positions[s.id] = {
        x: OFFSET_X + idx * (NODE_W + 100),
        y: specialY,
      };
    });

    return positions;
  }, [workflow.statuses]);

  useEffect(() => {
    setNodePositions(defaultPositions);
  }, [workflow.id]);

  const posOf = useCallback(
    (id: string): NodePos =>
      nodePositions[id] ?? defaultPositions[id] ?? { x: 0, y: 0 },
    [nodePositions, defaultPositions]
  );

  // ── Canvas extent ──────────────────────────────────────────────────────────
  const canvasSize = useMemo(() => {
    const positions = Object.values(nodePositions);
    if (!positions.length) return { w: 1200, h: 600 };
    const maxX = Math.max(...Object.values({ ...defaultPositions, ...nodePositions }).map((p) => p.x + NODE_W + 80));
    const maxY = Math.max(...Object.values({ ...defaultPositions, ...nodePositions }).map((p) => p.y + NODE_H + 80));
    return { w: Math.max(maxX, 800), h: Math.max(maxY, 400) };
  }, [nodePositions, defaultPositions]);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const zoomAt = useCallback((delta: number, cx: number, cy: number) => {
    setZoom((z) => {
      const next = Math.min(3, Math.max(0.25, z + delta));
      const ratio = next / z;
      setPan((p) => ({
        x: cx - (cx - p.x) * ratio,
        y: cy - (cy - p.y) * ratio,
      }));
      return next;
    });
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current!.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      zoomAt(-e.deltaY * 0.001, cx, cy);
    },
    [zoomAt]
  );

  const fitView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const positions = Object.values({ ...defaultPositions, ...nodePositions });
    if (!positions.length) return;
    const minX = Math.min(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxX = Math.max(...positions.map((p) => p.x + NODE_W));
    const maxY = Math.max(...positions.map((p) => p.y + NODE_H));
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const z = Math.min(0.95, Math.min(rect.width / (contentW + 80), rect.height / (contentH + 80)));
    setZoom(z);
    setPan({
      x: (rect.width - contentW * z) / 2 - minX * z,
      y: (rect.height - contentH * z) / 2 - minY * z,
    });
  }, [nodePositions, defaultPositions]);

  // ── Pan — click-drag on canvas background to pan ──────────────────────────
  const handleCanvasMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (connectFrom) return; // clicking in connect mode cancels it via onClick
      e.preventDefault();
      isPanning.current = true;
      didPanRef.current = false;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...pan };
      setIsPanningState(true);
    },
    [connectFrom, pan]
  );

  const handleCanvasMouseMove = useCallback((e: ReactMouseEvent) => {
    if (isPanning.current && !draggingNode.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        didPanRef.current = true;
      }
      setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
      return;
    }
    if (draggingNode.current) {
      const { id, ox, oy } = draggingNode.current;
      const rect = containerRef.current!.getBoundingClientRect();
      const nx = (e.clientX - rect.left - pan.x) / zoom - ox;
      const ny = (e.clientY - rect.top - pan.y) / zoom - oy;
      setNodePositions((prev) => ({ ...prev, [id]: { x: nx, y: ny } }));
    }
  }, [pan, zoom]);

  const handleCanvasMouseUp = useCallback(() => {
    isPanning.current = false;
    draggingNode.current = null;
    setIsPanningState(false);
  }, []);

  // ── Node drag ─────────────────────────────────────────────────────────────
  const handleNodeMouseDown = useCallback(
    (e: ReactMouseEvent, id: string) => {
      e.stopPropagation(); // always prevent canvas pan from triggering
      if (readOnly) return;
      if (connectFrom) return; // don't drag when connecting
      e.preventDefault();
      const rect = containerRef.current!.getBoundingClientRect();
      const pos = posOf(id);
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;
      draggingNode.current = { id, ox: mx - pos.x, oy: my - pos.y };
    },
    [readOnly, connectFrom, posOf, pan, zoom]
  );

  // ── Connect mode ──────────────────────────────────────────────────────────
  const transitionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const t of workflow.transitions) {
      if (!map.has(t.fromStatusId)) map.set(t.fromStatusId, new Set());
      map.get(t.fromStatusId)!.add(t.toStatusId);
    }
    return map;
  }, [workflow.transitions]);

  const handleNodeClick = useCallback(
    (e: ReactMouseEvent, id: string) => {
      e.stopPropagation();
      if (!connectFrom) {
        setSelectedId((prev) => (prev === id ? null : id));
        return;
      }
      if (connectFrom === id) {
        setConnectFrom(null);
        return;
      }
      setNamingTransition({ fromId: connectFrom, toId: id });
      setTransitionName('');
      setConnectFrom(null);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    },
    [connectFrom]
  );

  const handleCanvasClick = useCallback(() => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    setSelectedId(null);
    if (connectFrom) setConnectFrom(null);
  }, [connectFrom]);

  // ── Arrow path calculation ─────────────────────────────────────────────────
  function arrowPath(
    from: NodePos,
    to: NodePos,
    hasReverse: boolean,
    offset = 0
  ): { d: string; labelX: number; labelY: number } {
    const fx = from.x + NODE_W;
    const fy = from.y + NODE_H / 2;
    const tx = to.x;
    const ty = to.y + NODE_H / 2;

    if (tx > fx + 20) {
      // Forward — S-curve
      const cy = offset;
      const mid = (fx + tx) / 2;
      const d = `M ${fx} ${fy + cy} C ${mid} ${fy + cy}, ${mid} ${ty + cy}, ${tx} ${ty + cy}`;
      return { d, labelX: mid, labelY: (fy + ty) / 2 + cy - 10 };
    }

    // Backward or same column — arc over top
    const topY = Math.min(from.y, to.y) - 55;
    const midX = (from.x + NODE_W / 2 + to.x + NODE_W / 2) / 2;
    const d = `M ${from.x + NODE_W / 2} ${from.y} Q ${midX} ${topY}, ${to.x + NODE_W / 2} ${to.y}`;
    return { d, labelX: midX, labelY: topY - 8 };
  }

  const selectedStatus = workflow.statuses.find((s) => s.id === selectedId) ?? null;
  const outgoing = selectedStatus
    ? workflow.transitions.filter((t) => t.fromStatusId === selectedId)
    : [];
  const incoming = selectedStatus
    ? workflow.transitions.filter((t) => t.toStatusId === selectedId)
    : [];

  const initialStatus = workflow.statuses.find((s) => s.isInitial);

  return (
    <div className="flex flex-col h-full relative">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Zoom */}
          <button
            onClick={() => zoomAt(0.15, 400, 300)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => zoomAt(-0.15, 400, 300)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-400 w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={fitView}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Fit view"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <div className="w-px h-4 bg-slate-200 mx-0.5" />

          {/* Labels toggle */}
          <button
            onClick={() => setShowLabels((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showLabels
                ? 'bg-[#1268ff]/10 text-[#1268ff]'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {showLabels ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Labels
          </button>

          {/* Connect mode */}
          {!readOnly && (
            <>
              <div className="w-px h-4 bg-slate-200 mx-0.5" />
              {connectFrom ? (
                <button
                  onClick={() => setConnectFrom(null)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Connecting… <X className="h-3 w-3 ml-0.5" />
                </button>
              ) : (
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Click a node's → button to connect
                </span>
              )}
            </>
          )}
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          {readOnly ? 'Click a status to inspect' : 'Drag to move nodes • Scroll to zoom'}
        </div>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden bg-[#f8f9fb] ${connectFrom ? 'cursor-default' : isPanningState ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          backgroundImage:
            'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x % (24 * zoom)}px ${pan.y % (24 * zoom)}px`,
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
      >
        {/* Transformed layer */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: canvasSize.w,
            height: canvasSize.h,
            position: 'absolute',
          }}
        >
          {/* SVG arrows */}
          <svg
            className="absolute inset-0 pointer-events-none overflow-visible"
            width={canvasSize.w}
            height={canvasSize.h}
          >
            <defs>
              <marker id="arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
              <marker id="arr-hi" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#1268ff" />
              </marker>
              <marker id="arr-sel" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
              </marker>
            </defs>

            {/* START → initial */}
            {initialStatus && (() => {
              const pos = posOf(initialStatus.id);
              const sx = pos.x - 50;
              const sy = pos.y + NODE_H / 2;
              return (
                <g>
                  <circle cx={sx - 16} cy={sy} r={12} fill="#1e293b" />
                  <text x={sx - 16} y={sy + 4} textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">
                    START
                  </text>
                  <line
                    x1={sx - 4} y1={sy}
                    x2={pos.x - 2} y2={sy}
                    stroke="#94a3b8" strokeWidth="1.5"
                    markerEnd="url(#arr)"
                  />
                </g>
              );
            })()}

            {/* Transition arrows */}
            {workflow.transitions.map((t) => {
              // Special statuses (On Hold, Rejected, Dependency) use a standalone
              // "Any" arrow — hide all transitions to OR from them so the diagram stays clean.
              const toStatus = workflow.statuses.find((s) => s.id === t.toStatusId);
              const fromStatus = workflow.statuses.find((s) => s.id === t.fromStatusId);
              if (
                (toStatus && isSpecialStatus(toStatus)) ||
                (fromStatus && isSpecialStatus(fromStatus))
              ) return null;

              const from = posOf(t.fromStatusId);
              const to = posOf(t.toStatusId);
              const isSelected =
                selectedId !== null &&
                (t.fromStatusId === selectedId || t.toStatusId === selectedId);
              const hasReverse = workflow.transitions.some(
                (r) => r.fromStatusId === t.toStatusId && r.toStatusId === t.fromStatusId
              );
              const offset = hasReverse
                ? t.fromStatusId < t.toStatusId
                  ? -12
                  : 12
                : 0;
              const { d, labelX, labelY } = arrowPath(from, to, hasReverse, offset);
              const color = isSelected ? '#1268ff' : '#94a3b8';
              const marker = isSelected ? 'url(#arr-hi)' : 'url(#arr)';

              return (
                <g key={t.id} className="group/arrow">
                  {/* Wider invisible hit area for hover */}
                  <path
                    d={d}
                    stroke="transparent"
                    strokeWidth={12}
                    fill="none"
                    className="pointer-events-stroke cursor-pointer"
                    style={{ pointerEvents: 'stroke' }}
                  />
                  <path
                    d={d}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1.5}
                    fill="none"
                    markerEnd={marker}
                    className="transition-all duration-200"
                  />
                  {showLabels && t.name && (
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      fill={color}
                      fontSize="10"
                      className="pointer-events-none"
                      style={{ fontFamily: 'system-ui' }}
                    >
                      <tspan dx="0" dy="0" style={{ filter: 'drop-shadow(0 0 3px #f8f9fb)' }}>
                        {t.name}
                      </tspan>
                    </text>
                  )}
                  {/* Remove button — visible when not read-only and arrow is selected */}
                  {!readOnly && isSelected && (
                    <g
                      transform={`translate(${labelX}, ${labelY - 8})`}
                      style={{ cursor: 'pointer', pointerEvents: 'all' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTransition(t.id).unwrap().catch((err: unknown) => {
                          console.error('Failed to remove transition', err);
                        });
                      }}
                    >
                      <circle r="8" fill="#ef4444" />
                      <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </g>
                  )}
                </g>
              );
            })}
            {/* "Any" arrows for special statuses (Rejected, On Hold, Dependency) */}
            {workflow.statuses.filter(isSpecialStatus).map((status) => {
              const pos = posOf(status.id);
              const cy = pos.y + NODE_H / 2;
              const arrowStartX = pos.x - 80;
              const isSelected = selectedId === status.id;
              const color = isSelected ? '#1268ff' : '#94a3b8';
              const marker = isSelected ? 'url(#arr-hi)' : 'url(#arr)';
              return (
                <g key={`any-${status.id}`}>
                  {/* Dashed "any" incoming arrow */}
                  <line
                    x1={arrowStartX}
                    y1={cy}
                    x2={pos.x - 2}
                    y2={cy}
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    markerEnd={marker}
                  />
                  {/* "Any" label pill */}
                  <rect
                    x={arrowStartX - 1}
                    y={cy - 11}
                    width={30}
                    height={14}
                    rx="4"
                    fill="#f1f5f9"
                    stroke={color}
                    strokeWidth="0.75"
                  />
                  <text
                    x={arrowStartX + 14}
                    y={cy - 1}
                    textAnchor="middle"
                    fill={color}
                    fontSize="8"
                    fontWeight="500"
                    style={{ fontFamily: 'system-ui' }}
                  >
                    Any
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Node layer */}
          {workflow.statuses.map((status) => {
            const pos = posOf(status.id);
            const isSelected = selectedId === status.id;
            const isConnectSrc = connectFrom === status.id;
            const isConnectTarget = connectFrom && connectFrom !== status.id;
            const hasTransition = connectFrom
              ? transitionMap.get(connectFrom)?.has(status.id) ?? false
              : false;
            const isRelated =
              selectedId &&
              (outgoing.some((t) => t.toStatusId === status.id) ||
                incoming.some((t) => t.fromStatusId === status.id));

            const catDot = CAT_DOT[status.category] ?? '#94a3b8';
            const catBg = isSelected
              ? '#eff6ff'
              : isConnectSrc
              ? '#fefce8'
              : isConnectTarget && hasTransition
              ? '#fef2f2'
              : isConnectTarget && !hasTransition && !isConnectSrc
              ? '#f0fdf4'
              : isRelated
              ? '#f0f9ff'
              : CAT_BG[status.category] ?? '#f8fafc';
            const catBorder = isSelected
              ? '#1268ff'
              : isConnectSrc
              ? '#f59e0b'
              : isConnectTarget && hasTransition
              ? '#f87171'
              : isConnectTarget && !hasTransition && !isConnectSrc
              ? '#34d399'
              : isRelated
              ? '#93c5fd'
              : CAT_BORDER[status.category] ?? '#e2e8f0';

            return (
              <div
                key={status.id}
                onMouseDown={(e) => handleNodeMouseDown(e, status.id)}
                onClick={(e) => handleNodeClick(e, status.id)}
                className="absolute transition-shadow duration-150 select-none group"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: NODE_W,
                  height: NODE_H,
                  cursor: readOnly
                    ? 'pointer'
                    : connectFrom
                    ? connectFrom === status.id
                      ? 'default'
                      : 'crosshair'
                    : draggingNode.current?.id === status.id
                    ? 'grabbing'
                    : 'grab',
                  zIndex: draggingNode.current?.id === status.id ? 20 : isSelected ? 10 : 1,
                }}
              >
                {/* Shadow ring */}
                <div
                  className="absolute inset-0 rounded-xl"
                  style={{
                    boxShadow: isSelected
                      ? '0 0 0 2px #1268ff, 0 4px 12px rgba(18,104,255,0.15)'
                      : isConnectSrc
                      ? '0 0 0 2px #f59e0b, 0 4px 12px rgba(245,158,11,0.15)'
                      : isConnectTarget && !isConnectSrc
                      ? `0 0 0 2px ${hasTransition ? '#f87171' : '#34d399'}`
                      : isRelated
                      ? '0 0 0 1.5px #93c5fd'
                      : '0 2px 6px rgba(0,0,0,0.06)',
                  }}
                />

                {/* Card */}
                <div
                  className="absolute inset-0 rounded-xl border flex items-center gap-2.5 px-3"
                  style={{
                    background: catBg,
                    borderColor: catBorder,
                    borderLeftWidth: 4,
                    borderLeftColor: status.color,
                  }}
                >
                  {/* Color dot + name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 truncate leading-tight">
                        {status.displayName}
                      </span>
                      {status.isInitial && (
                        <span className="text-[9px] bg-blue-100 text-blue-700 rounded px-1 font-medium flex-shrink-0">
                          START
                        </span>
                      )}
                      {status.isFinal && (
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 rounded px-1 font-medium flex-shrink-0">
                          END
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className="text-[10px] capitalize font-medium"
                        style={{ color: catDot }}
                      >
                        {CATEGORY_LABELS[status.category as keyof typeof CATEGORY_LABELS] ?? status.category}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Hover connect button — always visible layer */}
                {!readOnly && !connectFrom && (
                  <NodeConnectButton
                    onConnect={() => setConnectFrom(status.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status detail panel ────────────────────────────────────────────── */}
      {selectedStatus && (
        <StatusDetailPanel
          status={selectedStatus}
          outgoing={outgoing}
          incoming={incoming}
          allStatuses={workflow.statuses}
          onClose={() => setSelectedId(null)}
          readOnly={readOnly}
          onRemoveTransition={(transitionId) => {
            removeTransition(transitionId).unwrap().catch((err: unknown) => {
              console.error('Failed to remove transition', err);
            });
          }}
        />
      )}

      {/* ── Transition naming modal ───────────────────────────────────────── */}
      {namingTransition && (
        <DiagramTransitionModal
          fromStatus={workflow.statuses.find((s) => s.id === namingTransition.fromId)!}
          toStatus={workflow.statuses.find((s) => s.id === namingTransition.toId)!}
          value={transitionName}
          onChange={setTransitionName}
          inputRef={nameInputRef}
          onConfirm={async () => {
            if (!namingTransition) return;
            try {
              await addTransition({
                workflowId: workflow.id,
                data: {
                  fromStatusId: namingTransition.fromId,
                  toStatusId: namingTransition.toId,
                  name: transitionName.trim() || undefined,
                },
              }).unwrap();
            } catch (err) {
              console.error('Failed to create transition', err);
            }
            setNamingTransition(null);
            setTransitionName('');
          }}
          onCancel={() => {
            setNamingTransition(null);
            setTransitionName('');
          }}
        />
      )}
    </div>
  );
}

// ─── Hover connect button ─────────────────────────────────────────────────────
function NodeConnectButton({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onConnect();
        }}
        className="w-6 h-6 rounded-full bg-[#1268ff] flex items-center justify-center text-white shadow-md hover:bg-[#0f5ce0] transition-colors"
        title="Connect from this status"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// ─── Status detail panel ──────────────────────────────────────────────────────
function StatusDetailPanel({
  status,
  outgoing,
  incoming,
  allStatuses,
  onClose,
  readOnly,
  onRemoveTransition,
}: {
  status: Status;
  outgoing: StatusTransition[];
  incoming: StatusTransition[];
  allStatuses: Status[];
  onClose: () => void;
  readOnly?: boolean;
  onRemoveTransition?: (transitionId: string) => void;
}) {
  return (
    <div className="absolute bottom-4 right-4 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-30">
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
          <span className="text-sm font-semibold text-slate-800 truncate">{status.displayName}</span>
        </div>
        <button onClick={onClose} className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3.5 py-2.5 space-y-2.5 text-xs max-h-72 overflow-y-auto">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 w-16">Category</span>
          <span
            className="font-medium capitalize px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: CAT_BG[status.category] ?? '#f1f5f9',
              color: CAT_DOT[status.category] ?? '#475569',
            }}
          >
            {CATEGORY_LABELS[status.category as keyof typeof CATEGORY_LABELS] ?? status.category}
          </span>
        </div>

        {(status.isInitial || status.isFinal) && (
          <div className="flex gap-1.5 flex-wrap">
            {status.isInitial && (
              <span className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">Initial</span>
            )}
            {status.isFinal && (
              <span className="bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">Final</span>
            )}
          </div>
        )}

        {outgoing.length > 0 && (
          <div>
            <p className="text-slate-400 mb-1 font-medium">Can go to:</p>
            <div className="space-y-1">
              {outgoing.map((t) => {
                const to = allStatuses.find((s) => s.id === t.toStatusId);
                return to ? (
                  <div key={t.id} className="flex items-center gap-1.5 group/row">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: to.color }} />
                    <span className="text-slate-700 truncate flex-1">{to.displayName}</span>
                    {t.name && <span className="text-slate-400 italic truncate max-w-[60px]">"{t.name}"</span>}
                    {!readOnly && onRemoveTransition && (
                      <button
                        onClick={() => onRemoveTransition(t.id)}
                        className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0"
                        title="Remove transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        {outgoing.length === 0 && incoming.length === 0 && (
          <p className="text-slate-400 italic">No transitions defined.</p>
        )}

        {incoming.length > 0 && (
          <div>
            <p className="text-slate-400 mb-1 font-medium">Comes from:</p>
            <div className="space-y-1">
              {incoming.map((t) => {
                const from = allStatuses.find((s) => s.id === t.fromStatusId);
                return from ? (
                  <div key={t.id} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: from.color }} />
                    <span className="text-slate-700 truncate">{from.displayName}</span>
                    {t.name && <span className="text-slate-400 italic truncate max-w-[60px]">"{t.name}"</span>}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Transition naming modal (for diagram) ────────────────────────────────────
function DiagramTransitionModal({
  fromStatus,
  toStatus,
  value,
  onChange,
  inputRef,
  onConfirm,
  onCancel,
}: {
  fromStatus: Status;
  toStatus: Status;
  value: string;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={onCancel} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 m-4"
        style={{ animation: 'scaleIn 0.15s ease-out' }}
      >
        <style>{`
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `}</style>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Name Transition</h3>
          <button onClick={onCancel} className="p-1 rounded text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4">
          <span className="text-xs font-semibold text-slate-700">{fromStatus.displayName}</span>
          <div className="flex-1 h-px bg-slate-300 relative">
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-slate-400 rotate-45" />
          </div>
          <span className="text-xs font-semibold text-slate-700">{toStatus.displayName}</span>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Start Review (optional)"
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1268ff]/30 focus:border-[#1268ff] mb-4 transition-colors"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm();
            if (e.key === 'Escape') onCancel();
          }}
        />

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1268ff] hover:bg-[#0f5ce0] transition-colors shadow-sm"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wrapper ──────────────────────────────────────────────────────────────────
export function WorkflowDiagramWrapper({
  workflowId,
  readOnly = true,
}: {
  workflowId: string | undefined;
  readOnly?: boolean;
}) {
  const { data: workflow, isLoading, error } = useGetWorkflowQuery(workflowId ?? '', {
    skip: !workflowId,
  });

  if (!workflowId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
        <Plus className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">No workflow mapped yet</p>
        <p className="text-xs mt-1">Add a mapping to see the diagram</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-7 w-7 rounded-full border-2 border-[#1268ff] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-500">
        <AlertCircle className="h-6 w-6 mb-1" />
        <span className="text-sm">Failed to load workflow diagram</span>
      </div>
    );
  }

  return (
    <div className="h-[500px]">
      <WorkflowDiagram workflow={workflow} readOnly={readOnly} showTransitionLabels={true} />
    </div>
  );
}
