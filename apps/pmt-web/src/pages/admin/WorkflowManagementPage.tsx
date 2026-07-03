/**
 * WorkflowManagementPage — Jira-style workflow editor
 *
 * Two tabs:
 *   1. Workflows  — full-screen diagram canvas editor (Jira-like)
 *   2. Workflow Schemes — manage scheme ↔ workflow mappings
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Edit2,
  GitBranch,
  Network,
  AlignLeft,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Loader2,
  AlertCircle,
  X,
  Layers,
  MoreHorizontal,
  Copy,
  Lock,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  useGetWorkflowsQuery,
  useGetWorkflowQuery,
  useCreateWorkflowMutation,
  useDeleteWorkflowMutation,
  useUpdateWorkflowMutation,
  useCreateStatusMutation,
  useDeleteStatusMutation,
  useUpdateStatusMutation,
  useGetWorkflowSchemesQuery,
  useCreateWorkflowSchemeMutation,
  useDeleteWorkflowSchemeMutation,
  useGetWorkflowSchemeQuery,
  useAddSchemeMappingMutation,
  useRemoveSchemeMappingMutation,
} from '../../features/workflows/workflowsApi';
import { WorkflowDiagram } from '../../features/workflows/components/WorkflowDiagram';
import type {
  Workflow,
  Status,
  WorkflowWithStatuses,
} from '../../features/workflows/types';
import { DEFAULT_STATUS_COLORS } from '../../features/workflows/types';

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'todo' as const, label: 'To Do', color: '#64748b', bg: '#f1f5f9' },
  { key: 'in_progress' as const, label: 'In Progress', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'in_review' as const, label: 'In Review', color: '#7c3aed', bg: '#f5f3ff' },
  { key: 'done' as const, label: 'Done', color: '#10b981', bg: '#f0fdf4' },
];
type Category = 'todo' | 'in_progress' | 'in_review' | 'done';

// ─── Root page ────────────────────────────────────────────────────────────────
export function WorkflowManagementPage() {
  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 flex-shrink-0">
        <div className="w-8 h-8 bg-[#1268ff]/10 rounded-lg flex items-center justify-center">
          <GitBranch className="h-4 w-4 text-[#1268ff]" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-900">Workflow Management</h1>
          <p className="text-xs text-slate-500">Design workflows and assign them to projects</p>
        </div>
      </div>

      {/* Content — directly show workflows, no scheme tab */}
      <div className="flex-1 overflow-hidden">
        <WorkflowsTab />
      </div>
    </div>
  );
}

// ─── Workflows Tab ────────────────────────────────────────────────────────────
function WorkflowsTab() {
  const [searchParams] = useSearchParams();
  const preselectedWorkflowId = searchParams.get('workflowId');

  const { data: allWorkflows = [], isLoading } = useGetWorkflowsQuery({});
  // Also fetch the specific workflow if navigated with a workflowId (may be project-specific)
  const { data: preselectedWorkflow } = useGetWorkflowQuery(preselectedWorkflowId!, {
    skip: !preselectedWorkflowId,
  });
  const [deleteWorkflow] = useDeleteWorkflowMutation();
  const [createWorkflow] = useCreateWorkflowMutation();

  // Global workflows (no projectId) for the main list
  const globalWorkflows = allWorkflows.filter((w: Workflow) => !w.projectId);

  // If navigated from a project's configure board, include that project workflow in the list
  const displayWorkflows: Workflow[] = (() => {
    if (
      preselectedWorkflow &&
      preselectedWorkflow.projectId &&
      !globalWorkflows.some((w: Workflow) => w.id === preselectedWorkflow.id)
    ) {
      return [preselectedWorkflow as Workflow, ...globalWorkflows];
    }
    return globalWorkflows;
  })();

  const [selectedId, setSelectedId] = useState<string | null>(preselectedWorkflowId);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renameWorkflow, setRenameWorkflow] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Auto-select preselected workflow once data loads
  useEffect(() => {
    if (preselectedWorkflowId && !selectedId) {
      setSelectedId(preselectedWorkflowId);
    }
  }, [preselectedWorkflowId, selectedId]);

  const selectedWorkflow =
    displayWorkflows.find((w: Workflow) => w.id === selectedId) ??
    displayWorkflows[0] ??
    null;

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteWorkflow(id).unwrap();
      setDeleteConfirmId(null);
      if (selectedId === id) setSelectedId(null);
    } catch (e: any) {
      setDeleteError(e?.data?.error?.message ?? 'Failed to delete workflow. It may be in use by existing issues.');
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-[#1268ff]" />
      </div>
    );
  }

  if (!selectedWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
          <GitBranch className="h-8 w-8 text-slate-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">No workflows yet</h2>
          <p className="text-sm text-slate-500 max-w-sm">
            Create a workflow to define how issues move through your project using statuses and transitions.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-[#1268ff] hover:bg-[#0f5ce0] text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create Workflow
        </Button>

        {showCreate && (
          <CreateWorkflowModal
            onClose={() => setShowCreate(false)}
            onCreated={(id) => { setShowCreate(false); setSelectedId(id); }}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <WorkflowEditor
        workflow={selectedWorkflow}
        allWorkflows={displayWorkflows}
        onSelectWorkflow={(id) => setSelectedId(id)}
        onRequestCreate={() => setShowCreate(true)}
        onRequestDelete={(id) => setDeleteConfirmId(id)}
        onRequestRename={(w) => setRenameWorkflow(w)}
      />

      {showCreate && (
        <CreateWorkflowModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); setSelectedId(id); }}
        />
      )}

      {renameWorkflow && (
        <RenameWorkflowModal
          workflow={renameWorkflow}
          onClose={() => setRenameWorkflow(null)}
        />
      )}

      {deleteConfirmId && (
        <ConfirmModal
          title="Delete Workflow"
          description="Are you sure? This will permanently delete the workflow and all its statuses and transitions."
          confirmLabel="Delete"
          danger
          loading={deleting}
          error={deleteError}
          onConfirm={() => handleDelete(deleteConfirmId)}
          onCancel={() => { setDeleteConfirmId(null); setDeleteError(null); }}
        />
      )}
    </>
  );
}

// ─── Workflow Editor (Jira-style) ─────────────────────────────────────────────
function WorkflowEditor({
  workflow,
  allWorkflows,
  onSelectWorkflow,
  onRequestCreate,
  onRequestDelete,
  onRequestRename,
}: {
  workflow: Workflow;
  allWorkflows: Workflow[];
  onSelectWorkflow: (id: string) => void;
  onRequestCreate: () => void;
  onRequestDelete: (id: string) => void;
  onRequestRename: (w: Workflow) => void;
}) {
  const { data: fullWorkflow, isLoading } = useGetWorkflowQuery(workflow.id);
  const [deleteStatus] = useDeleteStatusMutation();

  const [showAddStatus, setShowAddStatus] = useState(false);
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  const [deleteStatusId, setDeleteStatusId] = useState<string | null>(null);
  const [deletingStatus, setDeletingStatus] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const isDefault = workflow.isDefault;

  const handleDeleteStatus = async () => {
    if (!deleteStatusId) return;
    setDeletingStatus(true);
    try {
      await deleteStatus(deleteStatusId).unwrap();
      setDeleteStatusId(null);
    } catch (e: any) {
      console.error('Delete status failed', e);
    } finally {
      setDeletingStatus(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left sidebar ── */}
      {sidebarVisible && <div className="w-60 flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50">
        {/* Workflow switcher */}
        <div className="p-3 border-b border-slate-200">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
            Workflows
          </p>
          <div className="space-y-0.5">
            {allWorkflows.map((w) => (
              <button
                key={w.id}
                onClick={() => onSelectWorkflow(w.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                  w.id === workflow.id
                    ? 'bg-[#1268ff]/10 text-[#1268ff]'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <GitBranch className="h-3 w-3 flex-shrink-0" />
                <span className="truncate flex-1">{w.name}</span>
                {w.isDefault && (
                  <span className="text-[8px] font-medium px-1 py-0.5 bg-[#1268ff]/10 text-[#1268ff] rounded flex-shrink-0">
                    DEFAULT
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={onRequestCreate}
            className="mt-1.5 w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Plus className="h-3 w-3" /> New workflow
          </button>
        </div>

        {/* Current workflow info + actions */}
        <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{workflow.name}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {fullWorkflow?.statuses?.length ?? 0} statuses ·{' '}
              {fullWorkflow?.transitions?.length ?? 0} transitions
            </p>
          </div>
          {isDefault ? (
            /* Default workflow: only Copy action */
            <button
              onClick={() => setShowCopyModal(true)}
              className="p-1 rounded hover:bg-slate-200 text-slate-400 transition-colors flex-shrink-0 ml-1"
              title="Copy to new workflow"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-slate-200 text-slate-400 transition-colors flex-shrink-0 ml-1">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setShowCopyModal(true)}>
                  <Copy className="h-3.5 w-3.5 mr-2" /> Copy workflow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRequestRename(workflow)}>
                  <Edit2 className="h-3.5 w-3.5 mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onRequestDelete(workflow.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Status list */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Statuses</p>
            {!isDefault && (
              <button
                onClick={() => setShowAddStatus(true)}
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                title="Add status"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          ) : (fullWorkflow?.statuses ?? []).length === 0 ? (
            isDefault ? (
              <p className="text-[11px] text-slate-400 italic px-1">No statuses defined.</p>
            ) : (
              <button
                onClick={() => setShowAddStatus(true)}
                className="w-full flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#1268ff] hover:text-[#1268ff] transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span className="text-[11px]">Add your first status</span>
              </button>
            )
          ) : (
            <div className="space-y-0.5">
              {(fullWorkflow?.statuses ?? []).map((status) => (
                isDefault ? (
                  /* Read-only status item for default workflow */
                  <ReadOnlyStatusSidebarItem key={status.id} status={status} />
                ) : (
                  <StatusSidebarItem
                    key={status.id}
                    status={status}
                    onEdit={() => setEditingStatus(status)}
                    onDelete={() => setDeleteStatusId(status.id)}
                  />
                )
              ))}
            </div>
          )}
        </div>

        {/* Hint / Lock notice */}
        <div className="p-3 border-t border-slate-200 flex-shrink-0">
          {isDefault ? (
            <div className="bg-amber-50 rounded-lg p-2.5 text-[10px] text-amber-700 leading-relaxed flex items-start gap-1.5">
              <Lock className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span><strong>Read-only.</strong> The default workflow cannot be edited. Use <strong>Copy</strong> to create a new editable workflow from it.</span>
            </div>
          ) : (
            <div className="bg-blue-50 rounded-lg p-2.5 text-[10px] text-blue-700 leading-relaxed">
              <strong>Tip:</strong> Hover a node on the canvas and click the{' '}
              <span className="font-mono bg-blue-100 px-0.5 rounded">→</span> button to create a transition between statuses.
            </div>
          )}
        </div>
      </div>}

      {/* ── Main canvas ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Canvas header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarVisible((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                sidebarVisible
                  ? 'text-[#1268ff] bg-[#1268ff]/10 hover:bg-[#1268ff]/20'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
              title={sidebarVisible ? 'Hide panel' : 'Show panel'}
            >
              {sidebarVisible ? <ChevronLeft className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
            </button>
            <span className="text-sm font-semibold text-slate-800">{workflow.name}</span>
            {workflow.isDefault && (
              <Badge className="text-[10px] bg-[#1268ff]/10 text-[#1268ff] border-0 px-2 py-0.5">Default</Badge>
            )}
            {!workflow.isActive && (
              <Badge variant="outline" className="text-[10px] text-slate-500 px-2 py-0.5">Inactive</Badge>
            )}
          </div>
          <p className="text-[11px] text-slate-400 hidden md:block">
            {isDefault
              ? 'Scroll or use toolbar to zoom · Click a status to inspect'
              : 'Hover node → click → to connect · Drag nodes · Scroll to zoom'}
          </p>
        </div>

        {/* Diagram */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#1268ff]" />
          </div>
        ) : fullWorkflow ? (
          <div className="flex-1 overflow-hidden">
            <WorkflowDiagram
              workflow={fullWorkflow}
              readOnly={isDefault}
              showTransitionLabels={true}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">Failed to load workflow</span>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddStatus && fullWorkflow && !isDefault && (
        <AddStatusModal
          workflowId={fullWorkflow.id}
          existingNames={(fullWorkflow.statuses ?? []).map((s) => s.name)}
          onClose={() => setShowAddStatus(false)}
        />
      )}

      {editingStatus && !isDefault && (
        <EditStatusModal status={editingStatus} onClose={() => setEditingStatus(null)} />
      )}

      {deleteStatusId && !isDefault && (
        <ConfirmModal
          title="Delete Status"
          description="Are you sure? This will remove the status and all its transitions from the workflow."
          confirmLabel="Delete"
          danger
          loading={deletingStatus}
          onConfirm={handleDeleteStatus}
          onCancel={() => setDeleteStatusId(null)}
        />
      )}

      {showCopyModal && (
        <CopyWorkflowModal
          sourceWorkflow={workflow}
          onClose={() => setShowCopyModal(false)}
          onCreated={(id) => { setShowCopyModal(false); onSelectWorkflow(id); }}
        />
      )}
    </div>
  );
}

// ─── Status sidebar item ──────────────────────────────────────────────────────
function StatusSidebarItem({
  status,
  onEdit,
  onDelete,
}: {
  status: Status;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cat = CATEGORIES.find((c) => c.key === status.category);
  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: status.color }}
      />
      <span className="text-xs text-slate-700 truncate flex-1">{status.displayName}</span>
      <span
        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 hidden group-hover:inline"
        style={{ backgroundColor: cat?.bg ?? '#f1f5f9', color: cat?.color ?? '#475569' }}
      >
        {cat?.label ?? status.category}
      </span>
      {status.isInitial && (
        <span className="text-[8px] font-medium px-1 py-0.5 bg-blue-100 text-blue-700 rounded flex-shrink-0">
          START
        </span>
      )}
      {status.isFinal && (
        <span className="text-[8px] font-medium px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded flex-shrink-0">
          END
        </span>
      )}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200"
          title="Edit status"
        >
          <Edit2 className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          className="p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
          title="Delete status"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Read-only Status sidebar item (for default workflow) ─────────────────────
function ReadOnlyStatusSidebarItem({ status }: { status: Status }) {
  const cat = CATEGORIES.find((c) => c.key === status.category);
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
      <span className="text-xs text-slate-600 truncate flex-1">{status.displayName}</span>
      <span
        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: cat?.bg ?? '#f1f5f9', color: cat?.color ?? '#475569' }}
      >
        {cat?.label ?? status.category}
      </span>
      {status.isInitial && (
        <span className="text-[8px] font-medium px-1 py-0.5 bg-blue-100 text-blue-700 rounded flex-shrink-0">START</span>
      )}
      {status.isFinal && (
        <span className="text-[8px] font-medium px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded flex-shrink-0">END</span>
      )}
    </div>
  );
}

// ─── Copy Workflow Modal ───────────────────────────────────────────────────────
function CopyWorkflowModal({
  sourceWorkflow,
  onClose,
  onCreated,
}: {
  sourceWorkflow: Workflow;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [createWorkflow] = useCreateWorkflowMutation();
  const [name, setName] = useState(`${sourceWorkflow.name} (Copy)`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await createWorkflow({
        name: name.trim(),
        copyFromId: sourceWorkflow.id,
      } as any).unwrap();
      onCreated(result.id);
    } catch (e: any) {
      setError(e?.data?.error?.message ?? 'Failed to copy workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Workflow</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-xs text-slate-500">
            Creates a new editable workflow with all statuses and transitions copied from <strong>{sourceWorkflow.name}</strong>.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              New workflow name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="bg-[#1268ff] hover:bg-[#0f5ce0] text-white"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Copy Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Status Modal ─────────────────────────────────────────────────────────
function AddStatusModal({
  workflowId,
  existingNames,
  onClose,
}: {
  workflowId: string;
  existingNames: string[];
  onClose: () => void;
}) {
  const [createStatus] = useCreateStatusMutation();
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState<Category>('todo');
  const [color, setColor] = useState(DEFAULT_STATUS_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const derivedName = displayName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z_]/g, '');

  const handleSubmit = async () => {
    if (!displayName.trim()) { setError('Display name is required'); return; }
    if (!derivedName) { setError('Cannot derive a valid internal name from this display name'); return; }
    if (existingNames.includes(derivedName)) { setError('A status with this internal name already exists'); return; }

    setLoading(true);
    setError('');
    try {
      await createStatus({
        workflowId,
        data: { name: derivedName, displayName: displayName.trim(), color, category },
      }).unwrap();
      onClose();
    } catch (e: any) {
      setError(e?.data?.error?.message ?? 'Failed to create status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Display Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. In Progress"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {derivedName && (
              <p className="mt-1 text-[10px] text-slate-400">
                Internal name:{' '}
                <span className="font-mono text-slate-600 bg-slate-100 px-1 rounded">{derivedName}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key as Category)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                    category === cat.key
                      ? 'border-[#1268ff] bg-[#1268ff]/5 text-[#1268ff]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_STATUS_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-[#1268ff] scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 rounded-full cursor-pointer border border-slate-200"
                title="Custom color"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !displayName.trim()}
            className="bg-[#1268ff] hover:bg-[#0f5ce0] text-white"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Add Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Status Modal ────────────────────────────────────────────────────────
function EditStatusModal({ status, onClose }: { status: Status; onClose: () => void }) {
  const [updateStatus] = useUpdateStatusMutation();
  const [displayName, setDisplayName] = useState(status.displayName);
  const [category, setCategory] = useState<Category>(status.category as Category);
  const [color, setColor] = useState(status.color);
  const [isInitial, setIsInitial] = useState(status.isInitial);
  const [isFinal, setIsFinal] = useState(status.isFinal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!displayName.trim()) { setError('Display name is required'); return; }
    setLoading(true);
    setError('');
    try {
      await updateStatus({
        statusId: status.id,
        data: { displayName: displayName.trim(), color, category, isInitial, isFinal },
      }).unwrap();
      onClose();
    } catch (e: any) {
      setError(e?.data?.error?.message ?? 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Display Name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Internal name:{' '}
              <span className="font-mono text-slate-600 bg-slate-100 px-1 rounded">{status.name}</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key as Category)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                    category === cat.key
                      ? 'border-[#1268ff] bg-[#1268ff]/5 text-[#1268ff]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_STATUS_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-[#1268ff] scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 rounded-full cursor-pointer border border-slate-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isInitial}
                onChange={(e) => setIsInitial(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#1268ff]"
              />
              <span className="text-xs text-slate-700">Initial status (START)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFinal}
                onChange={(e) => setIsFinal(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#1268ff]"
              />
              <span className="text-xs text-slate-700">Final status (END)</span>
            </label>
          </div>

          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !displayName.trim()}
            className="bg-[#1268ff] hover:bg-[#0f5ce0] text-white"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Workflow Modal ────────────────────────────────────────────────────
function CreateWorkflowModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [createWorkflow] = useCreateWorkflowMutation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await createWorkflow({
        name: name.trim(),
        description: description.trim() || undefined,
      }).unwrap();
      onCreated(result.id);
    } catch (e: any) {
      setError(e?.data?.error?.message ?? 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Software Project Workflow"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this workflow..."
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="bg-[#1268ff] hover:bg-[#0f5ce0] text-white"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rename Workflow Modal ────────────────────────────────────────────────────
function RenameWorkflowModal({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const [updateWorkflow] = useUpdateWorkflowMutation();
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError('');
    try {
      await updateWorkflow({
        workflowId: workflow.id,
        data: { name: name.trim(), description: description.trim() || undefined },
      }).unwrap();
      onClose();
    } catch (e: any) {
      setError(e?.data?.error?.message ?? 'Failed to rename workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Workflow</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional..." />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()} className="bg-[#1268ff] hover:bg-[#0f5ce0] text-white">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Generic Confirm Modal ────────────────────────────────────────────────────
function ConfirmModal({
  title,
  description,
  confirmLabel,
  danger,
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className={danger ? 'text-red-600' : ''}>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 py-1">{description}</p>
        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1.5 -mt-1 pb-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#1268ff] hover:bg-[#0f5ce0] text-white'}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Workflow Schemes Tab ─────────────────────────────────────────────────────
function WorkflowSchemesTab() {
  const { data: schemes = [], isLoading } = useGetWorkflowSchemesQuery();
  const [deleteScheme] = useDeleteWorkflowSchemeMutation();

  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'diagram' | 'tree'>('diagram');

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteScheme(id).unwrap();
      setDeleteConfirmId(null);
      if (selectedSchemeId === id) setSelectedSchemeId(null);
    } catch (e) {
      console.error('Delete scheme failed', e);
    } finally {
      setDeleting(false);
    }
  };

  // Auto-select first scheme
  const effectiveSelectedId = selectedSchemeId ?? schemes[0]?.id ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-[#1268ff]" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Schemes</p>
          <button
            onClick={() => setShowCreate(true)}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {schemes.length === 0 ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#1268ff] hover:text-[#1268ff] transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[11px]">Create your first scheme</span>
            </button>
          ) : (
            schemes.map((scheme: any) => (
              <div
                key={scheme.id}
                onClick={() => setSelectedSchemeId(scheme.id)}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                  effectiveSelectedId === scheme.id
                    ? 'bg-[#1268ff]/10 text-[#1268ff]'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="h-3 w-3 flex-shrink-0" />
                <span className="text-xs font-medium truncate flex-1">{scheme.name}</span>
                {scheme.isDefault && (
                  <span className="text-[8px] font-medium px-1 py-0.5 bg-[#1268ff]/10 text-[#1268ff] rounded flex-shrink-0">
                    DEFAULT
                  </span>
                )}
                {!scheme.isDefault && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(scheme.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {effectiveSelectedId ? (
          <SchemeDetailPanel
            schemeId={effectiveSelectedId}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center px-8">
            <div>
              <Layers className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">No scheme selected</p>
              <p className="text-xs text-slate-400 mt-1">Create a scheme to get started.</p>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateSchemeModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); setSelectedSchemeId(id); }}
        />
      )}
      {deleteConfirmId && (
        <ConfirmModal
          title="Delete Scheme"
          description="Are you sure you want to delete this workflow scheme? This cannot be undone."
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={() => handleDelete(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}

// ─── Scheme Detail Panel ──────────────────────────────────────────────────────
function SchemeDetailPanel({
  schemeId,
  viewMode,
  onViewModeChange,
}: {
  schemeId: string;
  viewMode: 'diagram' | 'tree';
  onViewModeChange: (v: 'diagram' | 'tree') => void;
}) {
  const { data: scheme, isLoading } = useGetWorkflowSchemeQuery(schemeId);
  const { data: allWorkflows = [] } = useGetWorkflowsQuery({});
  const [addMapping] = useAddSchemeMappingMutation();
  const [removeMapping] = useRemoveSchemeMappingMutation();

  const mappings: any[] = scheme?.mappings ?? [];
  const [addWorkflowId, setAddWorkflowId] = useState('');
  const [addingMapping, setAddingMapping] = useState(false);

  const firstMappedWorkflowId =
    mappings.find((m) => m.isDefault)?.workflowId ?? mappings[0]?.workflowId ?? undefined;

  const handleAddMapping = async () => {
    if (!addWorkflowId) return;
    setAddingMapping(true);
    try {
      await addMapping({
        schemeId,
        data: { workflowId: addWorkflowId, isDefault: mappings.length === 0 },
      }).unwrap();
      setAddWorkflowId('');
    } catch (e) {
      console.error('Add mapping failed', e);
    } finally {
      setAddingMapping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#1268ff]" />
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-red-500">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">Failed to load scheme</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Mappings panel */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">{scheme.name}</h3>
          {scheme.description && (
            <p className="text-xs text-slate-500 mt-0.5">{scheme.description}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Workflow Mappings
            </p>
            {mappings.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No mappings yet.</p>
            ) : (
              <div className="space-y-2">
                {mappings.map((m: any) => {
                  const wf = (allWorkflows as Workflow[]).find((w) => w.id === m.workflowId);
                  return (
                    <div key={m.id} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <GitBranch className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {wf?.name ?? 'Unknown workflow'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {m.issueTypeId ? `Issue type: ${m.issueTypeId}` : 'Default mapping'}
                        </p>
                      </div>
                      {m.isDefault && (
                        <span className="text-[8px] font-medium px-1 py-0.5 bg-green-100 text-green-700 rounded flex-shrink-0">
                          DEFAULT
                        </span>
                      )}
                      <button
                        onClick={() => removeMapping({ schemeId, mappingId: m.id })}
                        className="p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Add Mapping
            </p>
            <select
              value={addWorkflowId}
              onChange={(e) => setAddWorkflowId(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1268ff]/30 focus:border-[#1268ff]"
            >
              <option value="">Select workflow…</option>
              {(allWorkflows as Workflow[]).filter((w) => !w.projectId).map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <button
              onClick={handleAddMapping}
              disabled={!addWorkflowId || addingMapping}
              className="w-full py-2 text-xs font-medium bg-[#1268ff] text-white rounded-lg hover:bg-[#0f5ce0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {addingMapping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add Mapping
            </button>
          </div>
        </div>
      </div>

      {/* Diagram / Tree view */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
          <span className="text-[11px] text-slate-400">
            {firstMappedWorkflowId ? 'Mapped workflow' : 'No workflow mapped yet'}
          </span>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => onViewModeChange('diagram')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'diagram' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Network className="h-3.5 w-3.5" /> Diagram
            </button>
            <button
              onClick={() => onViewModeChange('tree')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'tree' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <AlignLeft className="h-3.5 w-3.5" /> Tree
            </button>
          </div>
        </div>

        {viewMode === 'diagram' ? (
          <SchemeWorkflowDiagram workflowId={firstMappedWorkflowId} />
        ) : (
          <SchemeTreeView scheme={scheme} allWorkflows={allWorkflows as Workflow[]} />
        )}
      </div>
    </div>
  );
}

// ─── Scheme Workflow Diagram ──────────────────────────────────────────────────
function SchemeWorkflowDiagram({ workflowId }: { workflowId?: string }) {
  const { data: wfData, isLoading } = useGetWorkflowQuery(workflowId ?? '', {
    skip: !workflowId,
  });

  if (!workflowId) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-8">
        <div>
          <Network className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No workflow mapped.</p>
          <p className="text-xs text-slate-400 mt-1">Add a mapping on the left to see the diagram.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#1268ff]" />
      </div>
    );
  }

  if (!wfData) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-red-500">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">Failed to load workflow</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <WorkflowDiagram workflow={wfData} readOnly={true} showTransitionLabels={true} />
    </div>
  );
}

// ─── Scheme Tree View ─────────────────────────────────────────────────────────
function SchemeTreeView({
  scheme,
  allWorkflows,
}: {
  scheme: any;
  allWorkflows: Workflow[];
}) {
  const mappings: any[] = scheme?.mappings ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        {/* Scheme root node */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{scheme.name}</p>
            <p className="text-xs text-slate-400">Workflow Scheme · {mappings.length} mapping(s)</p>
          </div>
        </div>

        {mappings.length === 0 ? (
          <div className="ml-4 pl-5 border-l-2 border-dashed border-slate-200 py-4">
            <p className="text-xs text-slate-400 italic">No workflow mappings yet.</p>
          </div>
        ) : (
          <div className="ml-4 pl-5 border-l-2 border-slate-200 space-y-3">
            {mappings.map((m: any) => {
              const wf = allWorkflows.find((w) => w.id === m.workflowId);
              return (
                <SchemeTreeWorkflowNode key={m.id} mapping={m} workflow={wf ?? null} />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SchemeTreeWorkflowNode({
  mapping,
  workflow,
}: {
  mapping: any;
  workflow: Workflow | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const { data: wfData } = useGetWorkflowQuery(mapping.workflowId);
  const statuses: Status[] = wfData?.statuses ?? [];
  const transitions = wfData?.transitions ?? [];

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left hover:bg-slate-50 rounded-lg px-2 py-2 -ml-2 transition-colors"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
        <div className="w-7 h-7 bg-[#1268ff]/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <GitBranch className="h-3.5 w-3.5 text-[#1268ff]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">
            {workflow?.name ?? 'Unknown Workflow'}
          </p>
          <p className="text-[10px] text-slate-400">
            {mapping.isDefault ? 'Default mapping' : `Issue type: ${mapping.issueTypeId ?? '—'}`}
            {' · '}
            {statuses.length} status{statuses.length !== 1 ? 'es' : ''} ·{' '}
            {transitions.length} transition{transitions.length !== 1 ? 's' : ''}
          </p>
        </div>
        {mapping.isDefault && (
          <span className="text-[8px] font-medium px-1.5 py-0.5 bg-green-100 text-green-700 rounded flex-shrink-0">
            DEFAULT
          </span>
        )}
      </button>

      {expanded && statuses.length > 0 && (
        <div className="ml-9 mt-1 mb-2 pl-4 border-l-2 border-slate-100 space-y-0.5">
          {statuses.map((s) => {
            const cat = CATEGORIES.find((c) => c.key === s.category);
            const outgoing = transitions.filter((t: any) => t.fromStatusId === s.id);
            return (
              <div key={s.id}>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs text-slate-700 flex-1 truncate">{s.displayName}</span>
                  <span
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat?.bg ?? '#f1f5f9', color: cat?.color ?? '#64748b' }}
                  >
                    {cat?.label ?? s.category}
                  </span>
                  {s.isInitial && (
                    <span className="text-[8px] font-medium px-1 py-0.5 bg-blue-100 text-blue-700 rounded">
                      START
                    </span>
                  )}
                  {s.isFinal && (
                    <span className="text-[8px] font-medium px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                      END
                    </span>
                  )}
                </div>
                {outgoing.length > 0 && (
                  <div className="ml-5 pl-3 border-l border-dashed border-slate-200 space-y-0.5 my-0.5">
                    {outgoing.map((t: any) => {
                      const toStatus = statuses.find((ss) => ss.id === t.toStatusId);
                      return (
                        <div key={t.id} className="flex items-center gap-1.5 py-0.5 text-[10px] text-slate-400">
                          <span>→</span>
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: toStatus?.color ?? '#94a3b8' }}
                          />
                          <span>{toStatus?.displayName ?? 'Unknown'}</span>
                          {t.name && (
                            <span className="italic text-slate-300">"{t.name}"</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Create Scheme Modal ──────────────────────────────────────────────────────
function CreateSchemeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [createScheme] = useCreateWorkflowSchemeMutation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await createScheme({
        name: name.trim(),
        description: description.trim() || undefined,
      }).unwrap();
      onCreated(result.id);
    } catch (e: any) {
      setError(e?.data?.error?.message ?? 'Failed to create scheme');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Workflow Scheme</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Software Project Scheme"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Description (optional)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()} className="bg-[#1268ff] hover:bg-[#0f5ce0] text-white">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
