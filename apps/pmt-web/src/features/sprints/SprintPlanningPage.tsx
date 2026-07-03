import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useIssueModal } from '../issues/IssueDetailModal';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ArrowLeft, Plus, Target, Calendar, Play, CheckCircle, MoreVertical } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import {
  useGetSprintsQuery,
  useGetBacklogQuery,
  useAddIssuesToSprintMutation,
  useRemoveIssueFromSprintMutation,
  useUpdateSprintMutation,
  useDeleteSprintMutation,
  useStartSprintMutation,
  BacklogIssue,
  SprintIssue,
  Sprint,
} from './sprintsApi';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { CreateSprintDialog } from './CreateSprintDialog';
import { CompleteSprintDialog } from './CompleteSprintDialog';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

function BacklogPanel({
  issues,
  totalPoints,
}: {
  issues: BacklogIssue[];
  totalPoints: number;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const { openIssue } = useIssueModal();
  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' });

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-white sticky top-0">
        <h2 className="text-lg font-semibold">Backlog</h2>
        <p className="text-sm text-muted-foreground">
          {issues.length} issues • {totalPoints} points
        </p>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 p-4 space-y-2 overflow-y-auto ${isOver ? 'bg-blue-50' : ''
          }`}
      >
        {issues.map((issue) => (
          <div key={issue.id} className="relative group">
            <DraggableIssueCard issue={issue} className="pr-16" />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-transparent border-0 p-0"
              onClick={(e) => { e.stopPropagation(); openIssue(issue.id, projectId); }}
            >
              <Button variant="ghost" size="sm">View</Button>
            </button>
          </div>
        ))}

        {issues.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No issues in backlog</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableIssueCard({
  issue,
  className,
}: {
  issue: BacklogIssue | SprintIssue;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.id,
  });

  const style = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 bg-white border rounded-lg cursor-grab active:cursor-grabbing hover:shadow-sm ${isDragging ? 'opacity-50' : ''
        } ${className || ''}`}
    >
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs text-muted-foreground font-mono">
          {issue.issueKey}
        </span>
        {issue.storyPoints && (
          <Badge variant="outline" className="text-xs">
            {issue.storyPoints} SP
          </Badge>
        )}
      </div>
      <p className="text-sm font-medium line-clamp-2">{issue.title}</p>
      <div className="flex items-center gap-2 mt-2">
        <Badge
          variant="secondary"
          className="text-xs"
          style={{
            backgroundColor: `${issue.type.color}20`,
            color: issue.type.color,
          }}
        >
          {issue.type.icon} {issue.type.name}
        </Badge>
      </div>
    </div>
  );
}

function SprintPanel({
  sprint,
  onComplete,
}: {
  sprint: Sprint;
  onComplete: () => void;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const { openIssue } = useIssueModal();
  const { hasPermission: canManageSprints } = usePermissionGuard('sprints.manage');
  const { setNodeRef, isOver } = useDroppable({ id: `sprint-${sprint.id}` });
  const [startSprint] = useStartSprintMutation();
  const [removeIssue] = useRemoveIssueFromSprintMutation();
  const [updateSprint, { isLoading: isUpdatingSprint }] = useUpdateSprintMutation();
  const [deleteSprint, { isLoading: isDeletingSprint }] = useDeleteSprintMutation();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [editForm, setEditForm] = useState({
    name: sprint.name,
    goal: sprint.goal || '',
    startDate: sprint.startDate ? sprint.startDate.split('T')[0] : '',
    endDate: sprint.endDate ? sprint.endDate.split('T')[0] : '',
    capacityHours: sprint.capacityHours ? String(sprint.capacityHours) : '',
  });

  const daysRemaining =
    sprint.status === 'active' && sprint.endDate
      ? differenceInDays(new Date(sprint.endDate), new Date())
      : null;

  const handleStartSprint = async () => {
    await startSprint(sprint.id);
  };

  const handleRemoveIssue = async (issueId: string) => {
    await removeIssue({ sprintId: sprint.id, issueId });
  };

  const openEditSprint = () => {
    setActionError('');
    setEditForm({
      name: sprint.name,
      goal: sprint.goal || '',
      startDate: sprint.startDate ? sprint.startDate.split('T')[0] : '',
      endDate: sprint.endDate ? sprint.endDate.split('T')[0] : '',
      capacityHours: sprint.capacityHours ? String(sprint.capacityHours) : '',
    });
    setIsEditOpen(true);
  };

  const handleUpdateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');

    if (!editForm.name.trim()) {
      setActionError('Sprint name is required');
      return;
    }

    try {
      await updateSprint({
        sprintId: sprint.id,
        data: {
          name: editForm.name.trim(),
          goal: editForm.goal.trim() || undefined,
          startDate: editForm.startDate || undefined,
          endDate: editForm.endDate || undefined,
          capacityHours: editForm.capacityHours ? Number(editForm.capacityHours) : undefined,
        },
      }).unwrap();
      setIsEditOpen(false);
    } catch (error: any) {
      setActionError(error?.data?.error?.message || 'Failed to update sprint');
    }
  };

  const handleDeleteSprint = async () => {
    setActionError('');
    try {
      await deleteSprint(sprint.id).unwrap();
      setIsDeleteOpen(false);
    } catch (error: any) {
      setActionError(error?.data?.error?.message || 'Failed to delete sprint');
    }
  };

  return (
    <Card
      ref={setNodeRef}
      className={`transition-all ${isOver ? 'ring-2 ring-primary bg-primary/5' : ''}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{sprint.name}</CardTitle>
              <Badge
                variant={
                  sprint.status === 'active'
                    ? 'default'
                    : sprint.status === 'completed'
                      ? 'secondary'
                      : 'outline'
                }
              >
                {sprint.status}
              </Badge>
            </div>
            {sprint.goal && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                {sprint.goal}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {sprint.status === 'planned' && canManageSprints && (
              <Button size="sm" onClick={handleStartSprint}>
                <Play className="h-4 w-4 mr-1" />
                Start Sprint
              </Button>
            )}
            {sprint.status === 'active' && canManageSprints && (
              <Button size="sm" variant="outline" onClick={onComplete}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Complete
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManageSprints && (
                  <DropdownMenuItem onClick={openEditSprint}>Edit Sprint</DropdownMenuItem>
                )}
                {canManageSprints && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      setActionError('');
                      setIsDeleteOpen(true);
                    }}
                  >
                    Delete Sprint
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
          {sprint.startDate && sprint.endDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(sprint.startDate), 'MMM d')} -{' '}
              {format(new Date(sprint.endDate), 'MMM d')}
            </div>
          )}
          {daysRemaining !== null && (
            <Badge variant={daysRemaining < 3 ? 'destructive' : 'outline'}>
              {daysRemaining} days remaining
            </Badge>
          )}
        </div>

        {sprint.progress && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                {sprint.progress.completedIssues} / {sprint.progress.totalIssues} issues
              </span>
              <span>
                {sprint.progress.completedStoryPoints} / {sprint.progress.totalStoryPoints}{' '}
                points
              </span>
            </div>
            <Progress value={sprint.progress.percentComplete} />
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="space-y-2 min-h-[100px]">
          {sprint.issues?.map((issue) => (
            <div key={issue.id} className="relative group">
              <DraggableIssueCard issue={issue} className="pr-36" />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  className="bg-transparent border-0 p-0"
                  onClick={(e) => { e.stopPropagation(); openIssue(issue.id, projectId); }}
                >
                  <Button variant="ghost" size="sm">View</Button>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveIssue(issue.id);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}

          {(!sprint.issues || sprint.issues.length === 0) && (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
              Drag issues here
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sprint</DialogTitle>
            <DialogDescription>Update sprint details.</DialogDescription>
          </DialogHeader>

          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}

          <form className="space-y-4" onSubmit={handleUpdateSprint}>
            <div className="space-y-2">
              <Label htmlFor={`sprint-name-${sprint.id}`}>Sprint Name</Label>
              <Input
                id={`sprint-name-${sprint.id}`}
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`sprint-goal-${sprint.id}`}>Goal</Label>
              <Input
                id={`sprint-goal-${sprint.id}`}
                value={editForm.goal}
                onChange={(e) => setEditForm((prev) => ({ ...prev, goal: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`sprint-start-${sprint.id}`}>Start Date</Label>
                <Input
                  id={`sprint-start-${sprint.id}`}
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`sprint-end-${sprint.id}`}>End Date</Label>
                <Input
                  id={`sprint-end-${sprint.id}`}
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`sprint-capacity-${sprint.id}`}>Capacity (Hours)</Label>
              <Input
                id={`sprint-capacity-${sprint.id}`}
                type="number"
                min="0"
                step="0.5"
                value={editForm.capacityHours}
                onChange={(e) => setEditForm((prev) => ({ ...prev, capacityHours: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdatingSprint}>
                {isUpdatingSprint ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sprint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{sprint.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSprint}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSprint}
              disabled={isDeletingSprint}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingSprint ? 'Deleting...' : 'Delete Sprint'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function SprintPlanningPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { openIssue } = useIssueModal();
  const [activeIssue, setActiveIssue] = useState<BacklogIssue | SprintIssue | null>(null);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [sprintToComplete, setSprintToComplete] = useState<Sprint | null>(null);
  const { hasPermission: canCreateSprints } = usePermissionGuard('sprints.create');

  const { data: sprintsData, refetch: refetchSprints } = useGetSprintsQuery({
    projectId: projectId!,
    status: 'planned,active',
  });
  const { data: backlogData, refetch: refetchBacklog } = useGetBacklogQuery(projectId!);
  const [addIssuesToSprint] = useAddIssuesToSprintMutation();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const issueId = event.active.id as string;
    const issue = findIssue(issueId);
    setActiveIssue(issue);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIssue(null);

    if (!over) return;

    const issueId = active.id as string;
    const targetId = over.id as string;

    // If dropped on a sprint
    if (targetId.startsWith('sprint-')) {
      const sprintId = targetId.replace('sprint-', '');
      await addIssuesToSprint({
        sprintId,
        issueIds: [issueId],
      });
      refetchSprints();
      refetchBacklog();
    }
  };

  const findIssue = (id: string): BacklogIssue | SprintIssue | null => {
    const backlogIssue = backlogData?.issues.find((i) => i.id === id);
    if (backlogIssue) return backlogIssue;

    for (const sprint of sprintsData?.sprints || []) {
      const sprintIssue = sprint.issues?.find((i) => i.id === id);
      if (sprintIssue) return sprintIssue;
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          {/* <Link to={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link> */}
          <div>
            <h1 className="text-2xl font-bold">Sprint Planning</h1>
            <p className="text-muted-foreground">Drag issues from backlog to sprints</p>
          </div>
        </div>
        {canCreateSprints && (
          <Button onClick={() => setShowCreateSprint(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Sprint
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/3 border-r overflow-y-auto bg-gray-50">
            <BacklogPanel
              issues={backlogData?.issues || []}
              totalPoints={backlogData?.totalStoryPoints || 0}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {sprintsData?.sprints.map((sprint) => (
              <SprintPanel
                key={sprint.id}
                sprint={sprint}
                onComplete={() => setSprintToComplete(sprint)}
              />
            ))}

            {sprintsData?.sprints.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No sprints yet. Create your first sprint to get started.</p>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeIssue && (
            <div className="opacity-80 rotate-3">
              <div className="p-3 bg-white border rounded-lg shadow-lg">
                <p className="text-sm font-medium">{activeIssue.title}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {canCreateSprints && (
        <CreateSprintDialog
          projectId={projectId!}
          open={showCreateSprint}
          onOpenChange={setShowCreateSprint}
        />
      )}

      {sprintToComplete && (
        <CompleteSprintDialog
          sprint={sprintToComplete}
          sprints={sprintsData?.sprints.filter((s) => s.status === 'planned') || []}
          open={!!sprintToComplete}
          onOpenChange={(open) => !open && setSprintToComplete(null)}
        />
      )}
    </div>
  );
}
