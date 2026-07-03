import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Settings,
  X,
  ChevronRight,
  GripVertical,
  Check,
  AlertCircle,
  Zap,
  GitBranch,
} from 'lucide-react';
import {
  useGetWorkflowQuery,
  useCreateStatusMutation,
  useUpdateStatusMutation,
  useDeleteStatusMutation,
  useReorderStatusesMutation,
  useAddTransitionMutation,
  useRemoveTransitionMutation,
} from '../workflowsApi';
import type { Status, StatusTransition, CreateStatusInput, UpdateStatusInput } from '../types';
import { DEFAULT_STATUS_COLORS } from '../types';

interface WorkflowBuilderProps {
  workflowId: string;
  readOnly?: boolean;
  hideAddStatus?: boolean;
}

const COLUMN_ORDER = ['todo', 'in_progress', 'in_review', 'done'] as const;
type KnownCategory = typeof COLUMN_ORDER[number];

const CATEGORY_CONFIG: Record<
  KnownCategory,
  { label: string; dotColor: string; headerBg: string; headerText: string; colBg: string; colBorder: string; dropBg: string; dropBorder: string }
> = {
  todo: {
    label: 'To Do',
    dotColor: '#64748b',
    headerBg: 'bg-slate-100',
    headerText: 'text-slate-700',
    colBg: 'bg-slate-50',
    colBorder: 'border-slate-200',
    dropBg: 'bg-slate-100',
    dropBorder: 'border-slate-300',
  },
  in_progress: {
    label: 'In Progress',
    dotColor: '#3b82f6',
    headerBg: 'bg-blue-100',
    headerText: 'text-blue-700',
    colBg: 'bg-blue-50',
    colBorder: 'border-blue-200',
    dropBg: 'bg-blue-100',
    dropBorder: 'border-blue-300',
  },
  in_review: {
    label: 'In Review',
    dotColor: '#7c3aed',
    headerBg: 'bg-violet-100',
    headerText: 'text-violet-700',
    colBg: 'bg-violet-50',
    colBorder: 'border-violet-200',
    dropBg: 'bg-violet-100',
    dropBorder: 'border-violet-300',
  },
  done: {
    label: 'Done',
    dotColor: '#10b981',
    headerBg: 'bg-emerald-100',
    headerText: 'text-emerald-700',
    colBg: 'bg-emerald-50',
    colBorder: 'border-emerald-200',
    dropBg: 'bg-emerald-100',
    dropBorder: 'border-emerald-300',
  },
};

// ─── Main component ───────────────────────────────────────────────────────────
export function WorkflowBuilder({ workflowId, readOnly = false, hideAddStatus = false }: WorkflowBuilderProps) {
  const { data: workflow, isLoading, error } = useGetWorkflowQuery(workflowId);
  const [createStatus, { isLoading: isCreating }] = useCreateStatusMutation();
  const [updateStatus] = useUpdateStatusMutation();
  const [deleteStatus] = useDeleteStatusMutation();
  const [reorderStatuses] = useReorderStatusesMutation();
  const [addTransition] = useAddTransitionMutation();
  const [removeTransition] = useRemoveTransitionMutation();

  // Which status is selected for editing
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  // Modal open state — also tracks which column triggered the Add
  const [addStatusOpen, setAddStatusOpen] = useState(false);
  const [addStatusDefaultCategory, setAddStatusDefaultCategory] = useState<KnownCategory>('todo');
  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<KnownCategory | null>(null);
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(null);
  const [dragOverUnassigned, setDragOverUnassigned] = useState(false);
  // Connect-mode: click a status → click another to create transition
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  // Transition naming modal
  const [namingModal, setNamingModal] = useState<{ fromId: string; toId: string } | null>(null);
  const [transitionNameInput, setTransitionNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Derived data ──────────────────────────────────────────────────────────
  // All statuses are grouped by their category field into columns.
  // unconnectedIds tracks which statuses have no transitions (shown with warning badge).
  // unassigned lists statuses with no transitions for the info panel.
  const { columns, unassigned, unconnectedIds } = useMemo(() => {
    if (!workflow?.statuses) {
      return {
        columns: { todo: [], in_progress: [], in_review: [], done: [] } as Record<KnownCategory, Status[]>,
        unassigned: [] as Status[],
        unconnectedIds: new Set<string>(),
      };
    }
    const cols: Record<KnownCategory, Status[]> = { todo: [], in_progress: [], in_review: [], done: [] };

    // Build set of status IDs that participate in at least one transition
    const connectedIds = new Set<string>();
    for (const t of (workflow.transitions ?? [])) {
      connectedIds.add(t.fromStatusId);
      connectedIds.add(t.toStatusId);
    }

    const unconnectedIds = new Set<string>();
    const unassigned: Status[] = [];

    for (const s of workflow.statuses) {
      if (!connectedIds.has(s.id)) {
        // Statuses with no transitions go ONLY to the unassigned panel
        unconnectedIds.add(s.id);
        unassigned.push(s);
      } else if (COLUMN_ORDER.includes(s.category as KnownCategory)) {
        // Connected statuses go into their category column
        cols[s.category as KnownCategory].push(s);
      }
    }
    return { columns: cols, unassigned, unconnectedIds };
  }, [workflow?.statuses, workflow?.transitions]);

  const transitionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!workflow?.transitions) return map;
    for (const t of workflow.transitions) {
      if (!map.has(t.fromStatusId)) map.set(t.fromStatusId, new Set());
      map.get(t.fromStatusId)!.add(t.toStatusId);
    }
    return map;
  }, [workflow?.transitions]);

  // ── Status CRUD ───────────────────────────────────────────────────────────
  const handleAddStatus = async (data: CreateStatusInput) => {
    try {
      await createStatus({ workflowId, data }).unwrap();
      setAddStatusOpen(false);
    } catch (err: any) {
      alert(err?.data?.error?.message || 'Failed to create status');
    }
  };

  const handleUpdateStatus = async (statusId: string, data: UpdateStatusInput) => {
    try {
      await updateStatus({ statusId, data }).unwrap();
      setEditingStatus(null);
    } catch (err: any) {
      alert(err?.data?.error?.message || 'Failed to update status');
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!window.confirm('Delete this status? This will also remove all its transitions.')) return;
    try {
      await deleteStatus(statusId).unwrap();
      setEditingStatus(null);
    } catch (err: any) {
      alert(err?.data?.error?.message || 'Failed to delete status');
    }
  };

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, statusId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    draggedIdRef.current = statusId;
    setDraggedId(statusId);
  }, []);

  const handleDragEnd = useCallback(() => {
    draggedIdRef.current = null;
    setDraggedId(null);
    setDragOverCategory(null);
    setDragOverStatusId(null);
    setDragOverUnassigned(false);
  }, []);

  const handleDragOverStatus = useCallback((e: React.DragEvent, targetId: string, category: KnownCategory) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStatusId(targetId);
    setDragOverCategory(category);
  }, []);

  const handleDragOverColumn = useCallback((e: React.DragEvent, category: KnownCategory) => {
    e.preventDefault();
    setDragOverCategory(category);
  }, []);

  const handleDropOnColumn = useCallback(async (e: React.DragEvent, category: KnownCategory) => {
    e.preventDefault();
    const id = draggedIdRef.current;
    if (!id || !workflow?.statuses) { handleDragEnd(); return; }

    const draggedItem = workflow.statuses.find((s) => s.id === id);
    if (!draggedItem) { handleDragEnd(); return; }

    // Change category if needed
    if (draggedItem.category !== category) {
      await updateStatus({ statusId: id, data: { category } });
    }
    handleDragEnd();
  }, [workflow, updateStatus, handleDragEnd]);

  const handleDropOnStatus = useCallback(async (e: React.DragEvent, targetId: string, category: KnownCategory) => {
    e.preventDefault();
    e.stopPropagation();
    const id = draggedIdRef.current;
    if (!id || !workflow?.statuses) { handleDragEnd(); return; }
    if (id === targetId) { handleDragEnd(); return; }

    const draggedItem = workflow.statuses.find((s) => s.id === id);
    if (!draggedItem) { handleDragEnd(); return; }

    // Change category if dropping into different column
    if (draggedItem.category !== category) {
      await updateStatus({ statusId: id, data: { category } });
    }

    // Reorder within column
    const colStatuses = workflow.statuses.filter((s) => s.category === category);
    const fromIdx = colStatuses.findIndex((s) => s.id === id);
    const toIdx = colStatuses.findIndex((s) => s.id === targetId);

    if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
      const newColOrder = [...colStatuses];
      const [moved] = newColOrder.splice(fromIdx < 0 ? 0 : fromIdx, 1);
      newColOrder.splice(toIdx, 0, moved);

      // Build full reorder list across all statuses
      const allIds = workflow.statuses
        .filter((s) => s.category !== category)
        .concat(newColOrder)
        .sort((a, b) => {
          const catOrderA = COLUMN_ORDER.indexOf(a.category as KnownCategory);
          const catOrderB = COLUMN_ORDER.indexOf(b.category as KnownCategory);
          return catOrderA - catOrderB;
        })
        .map((s) => s.id);

      await reorderStatuses({ workflowId, statusIds: allIds });
    }

    handleDragEnd();
  }, [workflow, updateStatus, reorderStatuses, workflowId, handleDragEnd]);

  // ── Transitions ───────────────────────────────────────────────────────────
  const handleConnectClick = useCallback((statusId: string) => {
    setConnectFromId(statusId);
  }, []);

  const handleStatusNodeClick = useCallback((statusId: string) => {
    if (!connectFromId) return;
    if (connectFromId === statusId) { setConnectFromId(null); return; }

    // Open naming modal
    setNamingModal({ fromId: connectFromId, toId: statusId });
    setTransitionNameInput('');
    setConnectFromId(null);
    setTimeout(() => nameInputRef.current?.focus(), 60);
  }, [connectFromId]);

  const handleConfirmTransition = async () => {
    if (!namingModal || !workflow) return;
    try {
      await addTransition({
        workflowId,
        data: {
          fromStatusId: namingModal.fromId,
          toStatusId: namingModal.toId,
          name: transitionNameInput.trim() || undefined,
        },
      }).unwrap();
    } catch (err: any) {
      // Duplicate transition is silently ignored by the backend
    }
    setNamingModal(null);
    setTransitionNameInput('');
  };

  const handleRemoveTransition = useCallback(async (fromId: string, toId: string) => {
    const t = workflow?.transitions.find((tr) => tr.fromStatusId === fromId && tr.toStatusId === toId);
    if (!t) return;
    try {
      await removeTransition(t.id).unwrap();
    } catch { /* ignored */ }
  }, [workflow, removeTransition]);

  // Drop on unassigned panel — removes all transitions for the status
  const handleDropOnUnassigned = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const id = draggedIdRef.current;
    if (!id || !workflow?.transitions) { handleDragEnd(); return; }

    // Remove all transitions involving this status (both from and to)
    const related = workflow.transitions.filter(
      (t) => t.fromStatusId === id || t.toStatusId === id,
    );
    for (const t of related) {
      try {
        await removeTransition(t.id).unwrap();
      } catch { /* ignored */ }
    }
    handleDragEnd();
  }, [workflow, removeTransition, handleDragEnd]);

  // ── Loading/error ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#1268ff] border-t-transparent animate-spin" />
          <span className="text-sm text-slate-400">Loading workflow…</span>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-red-500">
        <AlertCircle className="h-6 w-6" />
        <span className="text-sm">Failed to load workflow. Please try again.</span>
      </div>
    );
  }

  const allStatuses = workflow.statuses;

  return (
    <div className="flex flex-col gap-4 select-none">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {!readOnly && !hideAddStatus && (
            <button
              onClick={() => { setAddStatusDefaultCategory('todo'); setAddStatusOpen(true); }}
              disabled={isCreating}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1268ff] hover:bg-[#0f5ce0] text-white text-sm font-medium transition-colors shadow-sm disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add Status
            </button>
          )}
          {!readOnly && connectFromId && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm animate-pulse">
              <Zap className="h-4 w-4" />
              <span className="font-medium">
                Connecting from: <span className="font-bold">{allStatuses.find(s => s.id === connectFromId)?.displayName}</span>
              </span>
              <span className="text-amber-500">→ Click a status to connect</span>
              <button onClick={() => setConnectFromId(null)} className="ml-1 text-amber-500 hover:text-amber-700">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
            <GripVertical className="h-3 w-3" /> Drag to reorder
          </span>
          {!readOnly && (
            <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
              <ChevronRight className="h-3 w-3" /> → to connect statuses
            </span>
          )}
        </div>
      </div>

      {/* ── Board ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-4 overflow-x-auto pb-4 w-full" style={{ minHeight: '320px' }}>
        {/* Unassigned panel — statuses with no transitions, draggable to category columns */}
        {(!readOnly || unassigned.length > 0) && (
          <div
            className={`w-56 flex-shrink-0 rounded-xl border-2 border-dashed transition-all duration-150 ${
              dragOverUnassigned
                ? 'border-amber-400 bg-amber-50/80'
                : 'border-slate-200 bg-slate-50/80'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOverUnassigned(true); setDragOverCategory(null); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverUnassigned(false); }}
            onDrop={handleDropOnUnassigned}
          >
            <div className="px-3 pt-3 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                UNASSIGNED ({unassigned.length})
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">Statuses with no transitions</p>
            </div>
            <div className="px-2 pb-3 space-y-2">
              {unassigned.length === 0 ? (
                <div className={`border-2 border-dashed rounded-lg p-4 text-center text-[11px] transition-all duration-150 ${
                  dragOverUnassigned
                    ? 'border-amber-300 text-amber-500'
                    : 'border-slate-200 text-slate-300'
                }`}>
                  {dragOverUnassigned ? 'Drop to remove transitions' : 'All statuses have transitions'}
                </div>
              ) : (
                unassigned.map((status) => {
                  const isConnectSource = connectFromId === status.id;
                  const isConnectTarget = connectFromId && connectFromId !== status.id;
                  const hasTransitionFrom = connectFromId ? (transitionMap.get(connectFromId)?.has(status.id) ?? false) : false;

                  let cardBorder = 'border-amber-200';
                  let cardBg = 'bg-amber-50';
                  let cardCursor = !readOnly && !connectFromId ? 'cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-amber-300' : '';
                  if (isConnectSource) {
                    cardBorder = 'border-amber-400'; cardBg = 'bg-amber-100'; cardCursor = 'cursor-default';
                  } else if (isConnectTarget) {
                    cardCursor = 'cursor-crosshair';
                    if (hasTransitionFrom) {
                      cardBorder = 'border-orange-400'; cardBg = 'bg-orange-50';
                    } else {
                      cardBorder = 'border-emerald-400'; cardBg = 'bg-emerald-50';
                    }
                  }

                  return (
                  <div
                    key={status.id}
                    draggable={!readOnly && !connectFromId}
                    onDragStart={(e) => handleDragStart(e, status.id)}
                    onDragEnd={handleDragEnd}
                    onClick={isConnectTarget ? () => handleStatusNodeClick(status.id) : undefined}
                    className={`relative rounded-lg border-2 ${cardBorder} ${cardBg} p-2 text-xs transition-all duration-100 ${cardCursor} ${draggedId === status.id ? 'opacity-40 scale-95' : ''}`}
                    style={{ borderLeftWidth: 4, borderLeftColor: status.color }}
                  >
                    <div className="flex items-start gap-1.5">
                      {!readOnly && !connectFromId && (
                        <GripVertical className="h-3 w-3 text-amber-300 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-700 truncate">{status.displayName}</span>
                          {status.isInitial && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 rounded px-1 py-0.5 font-semibold flex-shrink-0">START</span>
                          )}
                          {status.isFinal && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-700 rounded px-1 py-0.5 font-semibold flex-shrink-0">END</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block truncate">{status.name}</span>
                        <span className="text-[10px] text-amber-600 mt-0.5 block">
                          {CATEGORY_CONFIG[status.category as KnownCategory]?.label ?? status.category} · Drag to a column
                        </span>
                      </div>
                      {/* Action buttons */}
                      {!readOnly && !connectFromId && (
                        <div className="flex-shrink-0 flex flex-col gap-0.5">
                          <button
                            title="Add transition from this status"
                            onClick={(e) => { e.stopPropagation(); handleConnectClick(status.id); }}
                            className="p-1 rounded hover:bg-amber-100 text-amber-400 hover:text-[#1268ff] transition-colors"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="Edit status"
                            onClick={(e) => { e.stopPropagation(); setEditingStatus(editingStatus?.id === status.id ? null : status); }}
                            className="p-1 rounded hover:bg-amber-100 text-amber-400 hover:text-slate-700 transition-colors"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Connect target indicator */}
                    {isConnectTarget && (
                      <div className="absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none">
                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${hasTransitionFrom ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {hasTransitionFrom ? 'Already connected' : 'Click to connect'}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 4 category columns */}
        {COLUMN_ORDER.map((category) => {
          const cfg = CATEGORY_CONFIG[category];
          const catStatuses = columns[category];
          const isOver = dragOverCategory === category;

          return (
            <div
              key={category}
              className={`flex flex-col rounded-xl border-2 transition-all duration-150 min-w-[260px] w-[260px] flex-shrink-0 ${
                isOver ? `${cfg.dropBorder} ${cfg.dropBg}` : `${cfg.colBorder} ${cfg.colBg}`
              }`}
              onDragOver={(e) => handleDragOverColumn(e, category)}
              onDrop={(e) => handleDropOnColumn(e, category)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverCategory(null);
                }
              }}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${cfg.headerBg}`}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.dotColor }} />
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.headerText}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold ${cfg.headerText} opacity-70 bg-white/60 rounded-full px-1.5 py-0.5`}>
                    {catStatuses.length}
                  </span>
                  {!readOnly && !hideAddStatus && (
                    <button
                      title={`Add status to ${cfg.label}`}
                      onClick={() => { setAddStatusDefaultCategory(category); setAddStatusOpen(true); }}
                      className={`p-0.5 rounded hover:bg-white/60 ${cfg.headerText} opacity-60 hover:opacity-100 transition-all`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status cards */}
              <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                {catStatuses.length === 0 ? (
                  <div
                    className={`border-2 border-dashed rounded-lg p-5 text-center text-[11px] transition-all duration-150 ${
                      isOver
                        ? `${cfg.dropBorder} ${cfg.headerText} opacity-70`
                        : 'border-slate-200 text-slate-300'
                    }`}
                  >
                    {isOver ? 'Drop here' : 'No statuses'}
                  </div>
                ) : (
                  catStatuses.map((status) => (
                    <StatusCard
                      key={status.id}
                      status={status}
                      isEditing={editingStatus?.id === status.id}
                      isDragging={draggedId === status.id}
                      isDragOver={dragOverStatusId === status.id}
                      isUnconnected={unconnectedIds.has(status.id)}
                      connectFromId={connectFromId}
                      hasTransitionFrom={connectFromId ? (transitionMap.get(connectFromId)?.has(status.id) ?? false) : false}
                      transitionsFrom={transitionMap.get(status.id) ?? new Set()}
                      allStatuses={allStatuses}
                      readOnly={readOnly}
                      onEdit={() => setEditingStatus(editingStatus?.id === status.id ? null : status)}
                      onDragStart={(e) => handleDragStart(e, status.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOverStatus(e, status.id, category)}
                      onDrop={(e) => handleDropOnStatus(e, status.id, category)}
                      onConnectClick={() => handleConnectClick(status.id)}
                      onNodeClick={() => handleStatusNodeClick(status.id)}
                      onRemoveTransition={handleRemoveTransition}
                    />
                  ))
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* ── Workflow summary bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5" />
          <span><strong className="text-slate-700">{allStatuses.length}</strong> statuses</span>
        </span>
        <span className="w-px h-3 bg-slate-300" />
        <span><strong className="text-slate-700">{workflow.transitions.length}</strong> transitions</span>
        {workflow.transitions.length > 0 && (
          <>
            <span className="w-px h-3 bg-slate-300" />
            <span className="flex flex-wrap gap-1">
              {workflow.transitions.slice(0, 4).map((t) => {
                const from = allStatuses.find((s) => s.id === t.fromStatusId);
                const to = allStatuses.find((s) => s.id === t.toStatusId);
                if (!from || !to) return null;
                return (
                  <span key={t.id} className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: from.color }} />
                    {t.name || `${from.displayName} → ${to.displayName}`}
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: to.color }} />
                  </span>
                );
              })}
              {workflow.transitions.length > 4 && (
                <span className="text-slate-400">+{workflow.transitions.length - 4} more</span>
              )}
            </span>
          </>
        )}
      </div>

      {/* ── Status editor side panel ──────────────────────────────────────────── */}
      {editingStatus && !readOnly && (
        <StatusEditorPanel
          key={editingStatus.id}
          status={editingStatus}
          allStatuses={allStatuses}
          transitions={workflow.transitions}
          onSave={(data) => handleUpdateStatus(editingStatus.id, data)}
          onDelete={() => handleDeleteStatus(editingStatus.id)}
          onClose={() => setEditingStatus(null)}
          onRemoveTransition={handleRemoveTransition}
        />
      )}

      {/* ── Add status modal ──────────────────────────────────────────────────── */}
      {addStatusOpen && (
        <AddStatusModal
          onSave={handleAddStatus}
          onClose={() => setAddStatusOpen(false)}
          isLoading={isCreating}
          defaultCategory={addStatusDefaultCategory}
        />
      )}


      {/* ── Transition naming modal ─────────────────────────────────────────── */}
      {namingModal && workflow && (
        <TransitionNamingModal
          fromStatus={allStatuses.find((s) => s.id === namingModal.fromId)!}
          toStatus={allStatuses.find((s) => s.id === namingModal.toId)!}
          value={transitionNameInput}
          onChange={setTransitionNameInput}
          inputRef={nameInputRef}
          alreadyExists={transitionMap.get(namingModal.fromId)?.has(namingModal.toId) ?? false}
          onConfirm={handleConfirmTransition}
          onCancel={() => { setNamingModal(null); setTransitionNameInput(''); }}
        />
      )}
    </div>
  );
}

// ─── Status card ──────────────────────────────────────────────────────────────
function StatusCard({
  status,
  isEditing,
  isDragging,
  isDragOver,
  isUnconnected,
  connectFromId,
  hasTransitionFrom,
  transitionsFrom,
  allStatuses,
  readOnly,
  onEdit,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onConnectClick,
  onNodeClick,
  onRemoveTransition,
}: {
  status: Status;
  isEditing: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  isUnconnected: boolean;
  connectFromId: string | null;
  hasTransitionFrom: boolean;
  transitionsFrom: Set<string>;
  allStatuses: Status[];
  readOnly: boolean;
  onEdit: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onConnectClick: () => void;
  onNodeClick: () => void;
  onRemoveTransition: (fromId: string, toId: string) => void;
}) {
  const isConnectSource = connectFromId === status.id;
  const isConnectTarget = connectFromId && connectFromId !== status.id;

  // Determine card styles based on state
  let borderStyle = 'border-slate-200 hover:border-slate-300 hover:shadow-sm';
  let bgStyle = 'bg-white';
  let ringStyle = '';
  let cursor = readOnly ? 'cursor-default' : 'cursor-grab';

  if (isEditing) {
    borderStyle = 'border-[#1268ff]';
    ringStyle = 'ring-2 ring-[#1268ff]/20';
    bgStyle = 'bg-[#1268ff]/5';
  }
  if (isConnectSource) {
    borderStyle = 'border-amber-400';
    ringStyle = 'ring-2 ring-amber-400/20';
    bgStyle = 'bg-amber-50';
    cursor = 'cursor-default';
  }
  if (isConnectTarget) {
    cursor = 'cursor-crosshair';
    if (hasTransitionFrom) {
      // Already connected — clicking would be a no-op (backend deduplicates)
      borderStyle = 'border-orange-400';
      bgStyle = 'bg-orange-50';
      ringStyle = 'ring-2 ring-orange-400/20';
    } else {
      borderStyle = 'border-emerald-400';
      bgStyle = 'bg-emerald-50';
      ringStyle = 'ring-2 ring-emerald-400/20';
    }
  }
  if (isDragOver && !isConnectTarget) {
    borderStyle = 'border-blue-400';
    bgStyle = 'bg-blue-50';
  }

  return (
    <div
      draggable={!readOnly && !connectFromId}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={isConnectTarget ? onNodeClick : undefined}
      className={`relative rounded-lg border-2 p-2.5 transition-all duration-100 group/card ${bgStyle} ${borderStyle} ${ringStyle} ${cursor} ${isDragging ? 'opacity-40 scale-95 shadow-lg' : ''}`}
      style={{ borderLeftWidth: 4, borderLeftColor: status.color }}
    >
      <div className="flex items-start gap-1.5">
        {!readOnly && !connectFromId && (
          <GripVertical className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-800 truncate leading-tight">
              {status.displayName}
            </span>
            {status.isInitial && (
              <span className="text-[9px] bg-blue-100 text-blue-700 rounded px-1 py-0.5 font-semibold flex-shrink-0">
                START
              </span>
            )}
            {status.isFinal && (
              <span className="text-[9px] bg-emerald-100 text-emerald-700 rounded px-1 py-0.5 font-semibold flex-shrink-0">
                END
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-mono leading-none mt-0.5 block truncate">
            {status.name}
          </span>

          {/* No-transitions warning */}
          {isUnconnected && !connectFromId && (
            <span className="inline-flex items-center gap-1 mt-1 text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
              <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" />
              No transitions
            </span>
          )}

          {/* Outgoing transition chips */}
          {transitionsFrom.size > 0 && !connectFromId && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Array.from(transitionsFrom).map((toId) => {
                const toStatus = allStatuses.find((s) => s.id === toId);
                if (!toStatus) return null;
                return (
                  <span
                    key={toId}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-full px-1.5 py-0.5 transition-colors group/chip cursor-pointer"
                    title={`Transition to ${toStatus.displayName}${readOnly ? '' : ' — click to remove'}`}
                    onClick={readOnly ? undefined : (e) => {
                      e.stopPropagation();
                      onRemoveTransition(status.id, toId);
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: toStatus.color }} />
                    <span className="truncate max-w-[56px]">{toStatus.displayName}</span>
                    {!readOnly && <X className="h-2.5 w-2.5 opacity-0 group-hover/chip:opacity-100 transition-opacity" />}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Action buttons — shown on hover */}
        {!readOnly && !connectFromId && (
          <div className="flex-shrink-0 flex flex-col gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-100">
            <button
              title="Add transition from this status"
              onClick={(e) => { e.stopPropagation(); onConnectClick(); }}
              className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-[#1268ff] transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              title="Edit status"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-700 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Connect target indicator */}
      {isConnectTarget && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none">
          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${hasTransitionFrom ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {hasTransitionFrom ? 'Already connected' : 'Click to connect'}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status editor side panel ─────────────────────────────────────────────────
function StatusEditorPanel({
  status,
  allStatuses,
  transitions,
  onSave,
  onDelete,
  onClose,
  onRemoveTransition,
}: {
  status: Status;
  allStatuses: Status[];
  transitions: StatusTransition[];
  onSave: (data: UpdateStatusInput) => void;
  onDelete: () => void;
  onClose: () => void;
  onRemoveTransition: (fromId: string, toId: string) => void;
}) {
  const [form, setForm] = useState({
    displayName: status.displayName,
    name: status.name,
    color: status.color,
    category: status.category as KnownCategory,
    wipLimit: status.wipLimit?.toString() ?? '',
    isInitial: status.isInitial,
    isFinal: status.isFinal,
  });

  const outgoing = transitions.filter((t) => t.fromStatusId === status.id);
  const incoming = transitions.filter((t) => t.toStatusId === status.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      displayName: form.displayName,
      name: form.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''),
      color: form.color,
      category: form.category,
      wipLimit: form.wipLimit ? parseInt(form.wipLimit) : null,
      isInitial: form.isInitial,
      isFinal: form.isFinal,
    });
  };

  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <aside
        className="w-80 bg-white border-l border-slate-200 shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0.5; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: form.color }} />
            <span className="text-sm font-semibold text-slate-800 truncate">{form.displayName || 'Edit Status'}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto">
          <div className="px-5 py-4 space-y-4 flex-1">
            {/* Display name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm(f => ({ ...f, displayName: e.target.value }))}
                required
                autoFocus
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1268ff]/30 focus:border-[#1268ff] transition-colors"
              />
            </div>

            {/* Internal name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Internal Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1268ff]/30 focus:border-[#1268ff] font-mono transition-colors"
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Color</label>
              <div className="flex flex-wrap gap-2 items-center">
                {DEFAULT_STATUS_COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-500 scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color" value={form.color}
                  onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-7 h-7 rounded-full cursor-pointer border border-slate-200"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
              <div className="grid grid-cols-2 gap-1.5">
                {COLUMN_ORDER.map((cat) => {
                  const cfg = CATEGORY_CONFIG[cat];
                  return (
                    <button
                      key={cat} type="button"
                      onClick={() => setForm(f => ({ ...f, category: cat }))}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                        form.category === cat
                          ? `${cfg.dropBg} ${cfg.dropBorder} ${cfg.headerText}`
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dotColor }} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* WIP Limit */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                WIP Limit <span className="font-normal normal-case">(optional)</span>
              </label>
              <input
                type="number" value={form.wipLimit} min="0" placeholder="No limit"
                onChange={(e) => setForm(f => ({ ...f, wipLimit: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1268ff]/30 focus:border-[#1268ff] transition-colors"
              />
            </div>

            {/* Flags */}
            <div className="space-y-2.5">
              {(['isInitial', 'isFinal'] as const).map((flag) => (
                <label key={flag} className="flex items-center gap-3 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, [flag]: !f[flag] }))}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      form[flag]
                        ? flag === 'isInitial' ? 'bg-blue-500 border-blue-500' : 'bg-emerald-500 border-emerald-500'
                        : 'bg-white border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {form[flag] && <Check className="h-2.5 w-2.5 text-white" />}
                  </button>
                  <span className="text-sm text-slate-700">{flag === 'isInitial' ? 'Initial status' : 'Final status'}</span>
                  <span className="text-xs text-slate-400">{flag === 'isInitial' ? '(entry point)' : '(closed)'}</span>
                </label>
              ))}
            </div>

            {/* Transitions */}
            {(outgoing.length > 0 || incoming.length > 0) && (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transitions</p>
                {outgoing.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1.5">Can go to:</p>
                    <div className="space-y-1">
                      {outgoing.map((t) => {
                        const to = allStatuses.find((s) => s.id === t.toStatusId);
                        return to ? (
                          <div key={t.id} className="flex items-center gap-1.5 text-xs text-slate-600 group/tr">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: to.color }} />
                            <span className="flex-1 truncate">{to.displayName}</span>
                            {t.name && <span className="text-slate-400 text-[10px] italic">"{t.name}"</span>}
                            <button
                              type="button"
                              onClick={() => onRemoveTransition(status.id, t.toStatusId)}
                              className="text-slate-300 hover:text-red-500 opacity-0 group-hover/tr:opacity-100 transition-all"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
                {incoming.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1.5">Comes from:</p>
                    <div className="space-y-1">
                      {incoming.map((t) => {
                        const from = allStatuses.find((s) => s.id === t.fromStatusId);
                        return from ? (
                          <div key={t.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: from.color }} />
                            <span className="flex-1 truncate">{from.displayName}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
            <button
              type="button" onClick={onDelete}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <div className="flex gap-2">
              <button
                type="button" onClick={onClose}
                className="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#1268ff] hover:bg-[#0f5ce0] transition-colors shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}

// ─── Transition naming modal ──────────────────────────────────────────────────
function TransitionNamingModal({
  fromStatus, toStatus, value, onChange, inputRef, alreadyExists, onConfirm, onCancel,
}: {
  fromStatus: Status; toStatus: Status; value: string;
  onChange: (v: string) => void; inputRef: React.RefObject<HTMLInputElement>;
  alreadyExists: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 m-4"
        style={{ animation: 'scaleIn 0.15s ease-out' }}>
        <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">Name this transition</h3>
          <button onClick={onCancel} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fromStatus.color }} />
            <span className="text-xs font-semibold text-slate-700">{fromStatus.displayName}</span>
          </div>
          <div className="flex-1 flex items-center">
            <div className="h-px flex-1 bg-slate-300" />
            <div className="w-2 h-2 border-t-2 border-r-2 border-slate-400 rotate-45 -translate-x-1 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: toStatus.color }} />
            <span className="text-xs font-semibold text-slate-700">{toStatus.displayName}</span>
          </div>
        </div>

        {alreadyExists && (
          <div className="mb-4 p-2.5 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-700 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            This transition already exists. Creating it again will be ignored.
          </div>
        )}

        <div className="mb-4">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Transition Name <span className="font-normal normal-case">(optional)</span>
          </label>
          <input
            ref={inputRef} type="text" value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Start Progress, Send for Review…"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1268ff]/30 focus:border-[#1268ff] transition-colors"
            onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') onCancel(); }}
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1268ff] hover:bg-[#0f5ce0] transition-colors shadow-sm">
            {alreadyExists ? 'Update Name' : 'Create Transition'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add status modal ─────────────────────────────────────────────────────────
function AddStatusModal({
  onSave, onClose, isLoading, defaultCategory = 'todo',
}: {
  onSave: (data: CreateStatusInput) => void;
  onClose: () => void;
  isLoading: boolean;
  defaultCategory?: KnownCategory;
}) {
  const [form, setForm] = useState({
    displayName: '',
    name: '',
    color: DEFAULT_STATUS_COLORS[0],
    category: defaultCategory,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim()) return;
    const internalName = form.name.trim() || form.displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
    onSave({ displayName: form.displayName.trim(), name: internalName, color: form.color, category: form.category });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 m-4"
        style={{ animation: 'scaleIn 0.15s ease-out' }}>
        <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-800">Add Status</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Display Name *</label>
            <input
              type="text" value={form.displayName} autoFocus required
              onChange={(e) => {
                const v = e.target.value;
                setForm(f => ({ ...f, displayName: v, name: f.name || v.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '') }));
              }}
              placeholder="e.g. In Review"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1268ff]/30 focus:border-[#1268ff] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Internal Name</label>
            <input
              type="text" value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') }))}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1268ff]/30 focus:border-[#1268ff] font-mono transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2 items-center">
              {DEFAULT_STATUS_COLORS.map((c) => (
                <button key={c} type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-500 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
            <div className="grid grid-cols-2 gap-1.5">
              {COLUMN_ORDER.map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                return (
                  <button key={cat} type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                      form.category === cat
                        ? `${cfg.dropBg} ${cfg.dropBorder} ${cfg.headerText}`
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.dotColor }} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isLoading || !form.displayName.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1268ff] hover:bg-[#0f5ce0] disabled:opacity-60 transition-colors shadow-sm">
              {isLoading ? 'Adding…' : 'Add Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
