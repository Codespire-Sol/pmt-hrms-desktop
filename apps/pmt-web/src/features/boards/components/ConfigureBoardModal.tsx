import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  MouseSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { Modal, Button, Tooltip, Input, InputNumber, Popconfirm, Spin } from 'antd';
import {
  GripVertical,
  Settings2,
  Trash2,
  Gauge,
} from 'lucide-react';
import type { BoardColumn } from '../boardsApi';
import {
  boardsApi,
  useCreateBoardColumnMutation,
  useUpdateWipLimitMutation,
  useUpdateBoardColumnMutation,
  useDeleteBoardColumnMutation,
} from '../boardsApi';
import { useAppDispatch } from '@/app/hooks';
import { toast } from '@/hooks/useToast';

// ─── Constants ───────────────────────────────────────────────────────────────

const C = {
  primary: '#0052cc',
  primaryBg: '#e8f0fe',
  textPrimary: '#172b4d',
  textSecondary: '#6b778c',
  border: '#dfe1e6',
  surface: '#f4f5f7',
  danger: '#de350b',
  success: '#36b37e',
  warning: '#ff8b00',
  white: '#ffffff',
  bgPage: '#f4f5f7',
  bgHover: '#ebecf0',
};

const CAT_META: Record<string, { label: string; color: string }> = {
  todo: { label: 'TO DO', color: '#64748b' },
  in_progress: { label: 'IN PROGRESS', color: '#3b82f6' },
  in_review: { label: 'IN REVIEW', color: '#7c3aed' },
  done: { label: 'DONE', color: '#10b981' },
};

const CAT_ORDER = ['todo', 'in_progress', 'in_review', 'done'];

const UNASSIGNED_DROP_ID = 'unassigned-panel';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfigureBoardModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  boardColumns: BoardColumn[];
  onSaved: () => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ConfigureBoardModal({
  open,
  onClose,
  projectId,
  boardColumns,
  onSaved,
}: ConfigureBoardModalProps) {
  // API mutations
  const dispatch = useAppDispatch();
  const [updateBoardColumn] = useUpdateBoardColumnMutation();
  const [deleteBoardColumn] = useDeleteBoardColumnMutation();
  const [createBoardColumn] = useCreateBoardColumnMutation();
  const [updateWipLimit] = useUpdateWipLimitMutation();

  // Helper to refresh board data across APIs
  const refreshBoard = useCallback(() => {
    dispatch(boardsApi.util.invalidateTags(['Board']));
  }, [dispatch]);

  // UI state
  const [draggedStatusId, setDraggedStatusId] = useState<string | null>(null);
  const [addColumnModal, setAddColumnModal] = useState(false);
  const [addColumnName, setAddColumnName] = useState('');

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setDraggedStatusId(null);
      setAddColumnModal(false);
      setAddColumnName('');
    }
  }, [open]);

  // ── Derive columns from boardColumns prop ──────────────────────────────────

  // Group boardColumns by category into column sections
  const columns = useMemo(() => {
    const groups = new Map<string, BoardColumn[]>();
    for (const col of boardColumns) {
      if (col.category === 'unassigned') continue;
      if (!groups.has(col.category)) groups.set(col.category, []);
      groups.get(col.category)!.push(col);
    }
    // Order: well-known first, then any custom
    const ordered = [
      ...CAT_ORDER.filter((c) => groups.has(c)),
      ...Array.from(groups.keys())
        .filter((c) => !CAT_ORDER.includes(c))
        .sort(),
    ];
    return ordered.map((cat) => ({
      category: cat,
      statuses: (groups.get(cat) ?? []).sort((a, b) => a.position - b.position),
    }));
  }, [boardColumns]);

  // Unassigned = boardColumns with 'unassigned' category
  const unassignedStatuses = useMemo(
    () => boardColumns.filter((col) => col.category === 'unassigned'),
    [boardColumns]
  );

  // ── DnD sensors ───────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } })
  );

  // ── DnD handlers — drag individual statuses between columns ───────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggedStatusId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggedStatusId(null);
      if (!over) return;

      const columnId = active.id as string;
      const targetCategory = over.id as string;

      // Find the board column being dragged
      const column = boardColumns.find((c) => c.id === columnId);
      if (!column) return;

      // Determine the new category
      const newCategory = targetCategory === 'unassigned-panel' ? 'unassigned' : targetCategory;

      // If same category, no-op
      if (column.category === newCategory) return;

      // Validate it's a real category or unassigned
      if (newCategory !== 'unassigned' && !CAT_ORDER.includes(newCategory) && !columns.some((c) => c.category === newCategory)) return;

      // Block if moving this column would leave its source category empty
      if (column.category !== 'unassigned') {
        const sourceCol = columns.find((c) => c.category === column.category);
        if (sourceCol && sourceCol.statuses.length <= 1) {
          const sourceLabel = CAT_META[column.category]?.label ?? column.category;
          toast.warning('Cannot Move', `"${sourceLabel}" column cannot be empty. Add another column to it first.`);
          return;
        }
      }

      // Update the board column category via API
      try {
        await updateBoardColumn({
          projectId,
          statusId: column.id,
          data: { category: newCategory as any },
        }).unwrap();
        refreshBoard();
        const label = newCategory === 'unassigned' ? 'Unassigned' : (CAT_META[newCategory]?.label ?? newCategory);
        toast.success('Column Moved', `"${column.displayName}" moved to ${label}.`);
      } catch (err: any) {
        toast.error('Move Failed', err?.data?.error?.message || 'Could not move column.');
      }
    },
    [boardColumns, columns, projectId, updateBoardColumn, refreshBoard]
  );

  const handleAddColumn = useCallback(
    async () => {
      const name = addColumnName.trim();
      if (!name) return;
      // Generate a category key from the name
      const categoryKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom';
      const displayName = CAT_META[categoryKey]?.label
        ? CAT_META[categoryKey].label.charAt(0) + CAT_META[categoryKey].label.slice(1).toLowerCase()
        : name;
      try {
        await createBoardColumn({
          projectId,
          displayName,
          category: categoryKey,
        }).unwrap();
        refreshBoard();
        toast.success('Column Added', `"${displayName}" column created.`);
        setAddColumnModal(false);
        setAddColumnName('');
        onSaved();
      } catch (err: any) {
        toast.error('Failed', err?.data?.error?.message || 'Could not create column.');
      }
    },
    [addColumnName, projectId, createBoardColumn, refreshBoard, onSaved]
  );

  // Delete a category column — moves all its board columns to 'unassigned'
  const handleDeleteColumn = useCallback(
    async (category: string) => {
      const col = columns.find((c) => c.category === category);
      if (!col) return;
      try {
        // Move all board columns in this category to unassigned
        await Promise.all(
          col.statuses.map((boardCol) =>
            updateBoardColumn({ projectId, statusId: boardCol.id, data: { category: 'unassigned' as any } }).unwrap()
          )
        );
        refreshBoard();
        const label = CAT_META[category]?.label ?? category.replace(/_/g, ' ').toUpperCase();
        toast.success('Column Deleted', `"${label}" column removed. Board columns moved to Unassigned.`);
      } catch (err: any) {
        toast.error('Delete Failed', err?.data?.error?.message || 'Could not delete column.');
      }
    },
    [columns, projectId, updateBoardColumn, refreshBoard]
  );

  // Update WIP limit for a column status
  const handleUpdateWipLimit = useCallback(
    async (statusId: string, wipLimit: number | null) => {
      try {
        await updateWipLimit({ projectId, statusId, wipLimit }).unwrap();
        refreshBoard();
        toast.success('WIP Limit Updated', wipLimit ? `WIP limit set to ${wipLimit}.` : 'WIP limit removed.');
      } catch (err: any) {
        toast.error('Failed', err?.data?.error?.message || 'Could not update WIP limit.');
      }
    },
    [projectId, updateWipLimit, refreshBoard]
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ── Dragged column for overlay ─────────────────────────────────────────────

  const draggedStatus = useMemo(
    () => boardColumns.find((col) => col.id === draggedStatusId) ?? null,
    [boardColumns, draggedStatusId]
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Modal
        open={open}
        onCancel={handleClose}
        footer={null}
        width={1160}
        destroyOnHidden
        styles={{ body: { padding: 0, overflow: 'hidden' } }}
        title={null}
        closable={false}
      >
        {/* ── Modal Header ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: `1px solid ${C.border}`,
            backgroundColor: C.white,
            borderRadius: '8px 8px 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings2 size={18} color={C.primary} />
            <span style={{ fontSize: '17px', fontWeight: 700, color: C.textPrimary }}>
              Configure Board
            </span>
            <span
              style={{
                fontSize: '13px',
                color: C.textSecondary,
                paddingLeft: '8px',
                borderLeft: `1px solid ${C.border}`,
                marginLeft: '2px',
              }}
            >
              Columns and statuses
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>

        {/* ── Modal Body — single DndContext wraps EVERYTHING ──────── */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div style={{ display: 'flex', height: '560px' }}>
            {/* Left: Unassigned columns panel */}
            <UnassignedPanel
              statuses={unassignedStatuses}
              isLoading={false}
            />

            {/* Right: Board columns toolbar + columns area */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minWidth: 0,
                backgroundColor: C.bgPage,
              }}
            >
              {/* Column toolbar */}
              <BoardColumnsToolbar
                columnCount={boardColumns.length}
                onAddColumn={() => setAddColumnModal(true)}
              />

              {/* Board columns area */}
              <div
                style={{
                  flex: 1,
                  overflowX: 'auto',
                  overflowY: 'auto',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  minHeight: '120px',
                }}
              >
                {columns.map(({ category, statuses }) => (
                  <CategoryColumn
                    key={category}
                    category={category}
                    statuses={statuses}
                    draggedStatusId={draggedStatusId}
                    projectId={projectId}
                    onDeleteColumn={handleDeleteColumn}
                    onUpdateWipLimit={handleUpdateWipLimit}
                  />
                ))}

                {columns.length === 0 && (
                  <div
                    style={{
                      flex: 1,
                      padding: '40px',
                      textAlign: 'center',
                      border: `2px dashed ${C.border}`,
                      borderRadius: '8px',
                      color: C.textSecondary,
                      fontSize: '13px',
                    }}
                  >
                    No columns configured. Add a column to get started.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DragOverlay — shown while dragging */}
          <DragOverlay dropAnimation={null}>
            {draggedStatus && <StatusChipOverlay status={draggedStatus} />}
          </DragOverlay>
        </DndContext>
      </Modal>

      {/* ── Add Column modal ──────────────────────────────────────── */}
      <Modal
        open={addColumnModal}
        title="Add Column"
        onCancel={() => { setAddColumnModal(false); setAddColumnName(''); }}
        onOk={handleAddColumn}
        okText="Add"
        okButtonProps={{
          style: { backgroundColor: C.primary, borderColor: C.primary },
          disabled: !addColumnName.trim(),
        }}
        destroyOnHidden
        width={380}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: C.textPrimary, display: 'block', marginBottom: '4px' }}>
              Column name
            </label>
            <Input
              autoFocus
              value={addColumnName}
              onChange={(e) => setAddColumnName(e.target.value)}
              onPressEnter={handleAddColumn}
              placeholder="e.g. Testing, Staging, Blocked…"
              maxLength={100}
            />
          </div>
          <p style={{ fontSize: '12px', color: C.textSecondary, margin: 0 }}>
            Creates a new column on the board. You can then drag statuses into it.
          </p>
        </div>
      </Modal>
    </>
  );
}

// ─── CategoryColumn — a droppable column that holds draggable statuses ───────

function CategoryColumn({
  category,
  statuses,
  draggedStatusId,
  projectId,
  onDeleteColumn,
  onUpdateWipLimit,
}: {
  category: string;
  statuses: BoardColumn[];
  draggedStatusId: string | null;
  projectId: string;
  onDeleteColumn: (category: string) => void;
  onUpdateWipLimit: (statusId: string, wipLimit: number | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: category });
  const meta = CAT_META[category] ?? { label: category.replace(/_/g, ' ').toUpperCase(), color: '#999' };
  const [wipEditing, setWipEditing] = useState<string | null>(null);
  const [wipValue, setWipValue] = useState<number | null>(null);

  return (
    <div
      ref={setNodeRef}
      style={{
        width: '220px',
        flexShrink: 0,
        backgroundColor: isOver ? `${meta.color}12` : C.white,
        border: `1px solid ${isOver ? meta.color : C.border}`,
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.15s ease',
        overflow: 'hidden',
      }}
    >
      {/* Column header */}
      <div
        style={{
          padding: '0 12px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderBottom: `3px solid ${meta.color}`,
          backgroundColor: `${meta.color}10`,
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: meta.color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            flex: 1,
            fontSize: '12px',
            fontWeight: 700,
            color: C.textPrimary,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {meta.label}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: C.textSecondary,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {statuses.length}
        </span>
        <Popconfirm
          title="Delete this column?"
          description="All statuses will be moved to Unassigned."
          onConfirm={() => onDeleteColumn(category)}
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Tooltip title="Delete column">
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '3px',
                color: C.textSecondary,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textSecondary)}
            >
              <Trash2 size={13} />
            </button>
          </Tooltip>
        </Popconfirm>
      </div>

      {/* Statuses list */}
      <div
        style={{
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minHeight: '60px',
        }}
      >
        {statuses.map((status) => (
          <div key={status.id}>
            <DraggableStatusChip
              status={status}
              isDragging={draggedStatusId === status.id}
            />
            {/* Inline WIP limit row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px 0',
                justifyContent: 'flex-end',
              }}
            >
              {wipEditing === status.id ? (
                <>
                  <InputNumber
                    size="small"
                    min={0}
                    value={wipValue}
                    onChange={(v) => setWipValue(v)}
                    placeholder="0 = off"
                    style={{ width: '70px', fontSize: '11px' }}
                    autoFocus
                    onPressEnter={() => {
                      onUpdateWipLimit(status.id, wipValue && wipValue > 0 ? wipValue : null);
                      setWipEditing(null);
                    }}
                    onBlur={() => {
                      onUpdateWipLimit(status.id, wipValue && wipValue > 0 ? wipValue : null);
                      setWipEditing(null);
                    }}
                  />
                </>
              ) : (
                <Tooltip title="Set WIP limit for this status">
                  <button
                    onClick={() => {
                      setWipEditing(status.id);
                      setWipValue(status.wipLimit ?? null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '1px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      borderRadius: '3px',
                      color: status.wipLimit ? C.warning : C.textSecondary,
                      fontSize: '10px',
                      fontWeight: 500,
                      opacity: status.wipLimit ? 1 : 0.6,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = status.wipLimit ? '1' : '0.6')}
                  >
                    <Gauge size={10} />
                    {status.wipLimit ? `WIP: ${status.wipLimit}` : 'WIP'}
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        ))}

        {/* Drop placeholder when dragging */}
        {isOver && draggedStatusId && !statuses.some((s) => s.id === draggedStatusId) && (
          <div
            style={{
              height: '32px',
              border: `2px dashed ${meta.color}`,
              borderRadius: '4px',
              backgroundColor: `${meta.color}08`,
            }}
          />
        )}

        {statuses.length === 0 && !isOver && (
          <div
            style={{
              padding: '12px 8px',
              textAlign: 'center',
              color: C.textSecondary,
              fontSize: '11px',
              border: `1px dashed ${C.border}`,
              borderRadius: '4px',
            }}
          >
            Drop statuses here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DraggableStatusChip — draggable status within a column ──────────────────

function DraggableStatusChip({
  status,
  isDragging,
}: {
  status: BoardColumn;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: status.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 8px',
        backgroundColor: isDragging ? 'transparent' : C.surface,
        border: `1px solid ${isDragging ? 'transparent' : C.border}`,
        borderRadius: '4px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.3 : 1,
        fontSize: '12px',
        color: C.textPrimary,
        userSelect: 'none',
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
    >
      <GripVertical size={11} color={C.textSecondary} style={{ flexShrink: 0 }} />
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: status.color || '#6b7280',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}
      >
        {status.displayName}
      </span>
      {status.isInitial && (
        <span style={{ fontSize: '8px', color: C.primary, fontWeight: 800 }}>START</span>
      )}
      {status.isFinal && (
        <span style={{ fontSize: '8px', color: C.success, fontWeight: 800 }}>END</span>
      )}
    </div>
  );
}

// ─── UnassignedPanel ─────────────────────────────────────────────────────────

function UnassignedPanel({
  statuses,
  isLoading,
}: {
  statuses: BoardColumn[];
  isLoading: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_DROP_ID });

  return (
    <div
      ref={setNodeRef}
      style={{
        width: '224px',
        flexShrink: 0,
        borderRight: `1px solid ${C.border}`,
        backgroundColor: isOver ? C.primaryBg : C.white,
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 0.12s ease',
      }}
    >
      <div
        style={{
          padding: '12px 14px 8px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: C.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Unassigned statuses
        </div>
        <div
          style={{
            fontSize: '11px',
            color: C.textSecondary,
            marginTop: '4px',
            lineHeight: '1.4',
          }}
        >
          Drag statuses between columns to reassign their category.
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <Spin size="small" />
          </div>
        ) : (
          <>
            {statuses.map((s) => (
              <DraggableStatusChip key={s.id} status={s} isDragging={false} />
            ))}

            {statuses.length === 0 && (
              <div
                style={{
                  border: `2px dashed ${C.border}`,
                  borderRadius: '6px',
                  padding: '16px 12px',
                  textAlign: 'center',
                  color: C.textSecondary,
                  fontSize: '12px',
                  marginTop: '8px',
                }}
              >
                All statuses are assigned to columns
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── BoardColumnsToolbar ─────────────────────────────────────────────────────

function BoardColumnsToolbar({
  columnCount,
  onAddColumn,
}: {
  columnCount: number;
  onAddColumn: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: `1px solid ${C.border}`,
        backgroundColor: C.white,
        flexShrink: 0,
        gap: '12px',
        minHeight: '44px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {CAT_ORDER.map((cat) => (
          <Tooltip key={cat} title={CAT_META[cat].label}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                backgroundColor: `${CAT_META[cat].color}22`,
                border: `1px solid ${CAT_META[cat].color}66`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: CAT_META[cat].color,
                }}
              />
            </span>
          </Tooltip>
        ))}
        <span style={{ fontSize: '12px', color: C.textSecondary }}>{columnCount} columns</span>
      </div>
      <Button
        size="small"
        type="primary"
        ghost
        onClick={onAddColumn}
        style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> Add Column
      </Button>
    </div>
  );
}

// ─── DragOverlay ghost ────────────────────────────────────────────────────────

function StatusChipOverlay({ status }: { status: BoardColumn }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        backgroundColor: C.white,
        border: `2px solid ${C.primary}`,
        borderRadius: '4px',
        boxShadow: '0 10px 28px rgba(0,82,204,0.2)',
        fontSize: '12px',
        fontWeight: 500,
        color: C.textPrimary,
        width: '180px',
        cursor: 'grabbing',
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: status.color || '#6b7280',
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {status.displayName}
      </span>
    </div>
  );
}
