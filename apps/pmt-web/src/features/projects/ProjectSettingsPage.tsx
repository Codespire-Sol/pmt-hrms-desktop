import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Archive, Settings, GitBranch, ExternalLink, CheckCircle2, Wand2 } from 'lucide-react';
import { useGenerateDescriptionMutation } from '@/features/ai/aiApi';
import { WritingAssistant } from '@/features/ai/components/WritingAssistant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/useToast';
import {
  useGetProjectQuery,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useArchiveProjectMutation,
  useGetProjectMembersQuery,
} from './projectsApi';
import { useGetCurrentUserPermissionsQuery } from '../rbac/rbacApi';
import {
  useGetIssueTypesQuery,
  useCreateIssueTypeMutation,
  useUpdateIssueTypeMutation,
  useDeleteIssueTypeMutation,
  useReorderIssueTypesMutation,
  useGetPrioritiesQuery,
  useCreatePriorityMutation,
  useUpdatePriorityMutation,
  useDeletePriorityMutation,
} from './projectConfigApi';
import type { IssueType } from './components/IssueTypesSettings';
import { IssueTypesSettings } from './components/IssueTypesSettings';
import { PrioritiesSettings } from './components/PrioritiesSettings';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import { Link } from 'react-router-dom';
import {
  useGetWorkflowsQuery,
  useGetProjectWorkflowQuery,
  useAssignWorkflowToProjectMutation,
} from '../workflows/workflowsApi';
import { WorkflowBuilder } from '../workflows/components/WorkflowBuilder';

function GenerateDescriptionButton({
  projectName,
  hasDescription,
  onGenerated,
}: {
  projectName: string;
  hasDescription: boolean;
  onGenerated: (text: string) => void;
}) {
  const [generate, { isLoading }] = useGenerateDescriptionMutation();

  if (hasDescription) return null;

  const handleGenerate = async () => {
    if (!projectName || projectName.length < 3) return;
    try {
      const result = await generate({ title: projectName, issueType: 'project' }).unwrap();
      if (result.description) onGenerated(result.description);
    } catch {
      // silent — user can type manually
    }
  };

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={isLoading || projectName.length < 3}
      className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Wand2 size={12} className={isLoading ? 'animate-pulse' : ''} />
      {isLoading ? 'Generating…' : 'Generate'}
    </button>
  );
}

export function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetProjectQuery(projectId!);
  const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();
  const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation();
  const [archiveProject, { isLoading: isArchiving }] = useArchiveProjectMutation();
  const { hasPermission: canUpdateProject } = usePermissionGuard('projects.update');
  const { hasPermission: canDeleteProject } = usePermissionGuard('projects.delete');
  const { hasPermission: canManageMembers } = usePermissionGuard('projects.manage_members');

  const canUpdate = canUpdateProject && canManageMembers;
  const canDelete = canDeleteProject && canManageMembers;

  const { data: issueTypes, isLoading: isLoadingIssueTypes, error: issueTypesError } =
    useGetIssueTypesQuery(projectId!);
  const { data: priorities, isLoading: isLoadingPriorities, error: prioritiesError } =
    useGetPrioritiesQuery();
  const [createIssueType] = useCreateIssueTypeMutation();
  const [updateIssueType] = useUpdateIssueTypeMutation();
  const [deleteIssueType] = useDeleteIssueTypeMutation();
  const [reorderIssueTypes] = useReorderIssueTypesMutation();
  const [createPriority] = useCreatePriorityMutation();
  const [updatePriority] = useUpdatePriorityMutation();
  const [deletePriority] = useDeletePriorityMutation();

  const project = data;
  const { data: members } = useGetProjectMembersQuery(projectId!, { skip: !projectId });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'private',
    leadId: '',
    status: 'active',
    startDate: '',
    targetEndDate: '',
    actualEndDate: '',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const toDateInputValue = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (!project) return;
    setFormData({
      name: project.name || '',
      description: project.description || '',
      visibility: project.visibility || 'private',
      leadId: project.leadId || '',
      status: project.status || 'active',
      startDate: toDateInputValue(project.startDate),
      targetEndDate: toDateInputValue(project.targetEndDate),
      actualEndDate: toDateInputValue(project.actualEndDate),
    });
  }, [project]);

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Project not found</h3>
          <p className="text-muted-foreground">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    try {
      const toIso = (value: string) => (value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined);

      await updateProject({
        projectId: projectId!,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          visibility: formData.visibility as any,
          leadId: formData.leadId || undefined,
          status: formData.status as any,
          startDate: toIso(formData.startDate),
          targetEndDate: toIso(formData.targetEndDate),
          actualEndDate: toIso(formData.actualEndDate),
        },
      }).unwrap();
      toast.success('Project updated');
      refetch();
    } catch (err: any) {
      toast.error('Failed to update project');
    }
  };

  const handleArchive = async () => {
    try {
      await archiveProject(projectId!).unwrap();
      toast.success('Project archived');
      setArchiveDialogOpen(false);
      refetch();
    } catch {
      toast.error('Failed to archive project');
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation !== project.name) return;
    try {
      await deleteProject(projectId!).unwrap();
      toast.success('Project deleted');
      navigate('/projects');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const handleCreateIssueType = async (data: any) => {
    try {
      await createIssueType({ ...data, projectId: projectId! }).unwrap();
      toast.success('Issue type created');
    } catch {
      toast.error('Failed to create issue type');
    }
  };

  const handleCreatePriority = async (data: any) => {
    try {
      await createPriority(data).unwrap();
      toast.success('Priority created');
    } catch {
      toast.error('Failed to create priority');
    }
  };

  const handleUpdateIssueType = async (id: string, data: any) => {
    try {
      await updateIssueType({ id, data }).unwrap();
      toast.success('Issue type updated');
    } catch {
      toast.error('Failed to update issue type');
    }
  };

  const handleDeleteIssueType = async (id: string) => {
    try {
      await deleteIssueType(id).unwrap();
      toast.success('Issue type deleted');
    } catch {
      toast.error('Failed to delete issue type');
    }
  };

  const handleReorderIssueTypes = async (types: IssueType[]) => {
    try {
      await reorderIssueTypes({ projectId: projectId!, typeIds: types.map(t => t.id) }).unwrap();
    } catch {
      toast.error('Failed to reorder issue types');
    }
  };

  const handleUpdatePriority = async (id: string, data: any) => {
    try {
      await updatePriority({ id, data }).unwrap();
      toast.success('Priority updated');
    } catch {
      toast.error('Failed to update priority');
    }
  };

  const handleDeletePriority = async (id: string) => {
    try {
      await deletePriority(id).unwrap();
      toast.success('Priority deleted');
    } catch {
      toast.error('Failed to delete priority');
    }
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Project Settings</h1>
        <p className="text-muted-foreground">
          Manage settings for {project.name}
        </p>
      </div>

      {!canManageMembers && (
        <div className="bg-muted/50 border rounded-lg p-4 flex items-center gap-3 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">You are in View-Only mode. Developers cannot modify project settings.</p>
        </div>
      )}

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className={`grid w-full ${canDelete ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="issue-types">Issue Types</TabsTrigger>
          <TabsTrigger value="priorities">Priorities</TabsTrigger>
          {canDelete && <TabsTrigger value="danger">Danger Zone</TabsTrigger>}
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                Basic Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!canUpdate}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Key</Label>
                  <Input value={project.key} disabled />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="description">Description</Label>
                  {canUpdate && (
                    <div className="flex items-center gap-2">
                      <GenerateDescriptionButton
                        projectName={formData.name}
                        hasDescription={!!formData.description}
                        onGenerated={(text) => setFormData(f => ({ ...f, description: text }))}
                      />
                      <WritingAssistant
                        text={formData.description}
                        onTextChange={(text) => setFormData(f => ({ ...f, description: text }))}
                        type="description"
                      />
                    </div>
                  )}
                </div>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  disabled={!canUpdate}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select
                    value={formData.visibility}
                    onValueChange={(value) => setFormData({ ...formData, visibility: value })}
                    disabled={!canUpdate}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                    disabled={!canUpdate}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    disabled={!canUpdate}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target End Date</Label>
                  <Input
                    type="date"
                    value={formData.targetEndDate}
                    onChange={(e) => setFormData({ ...formData, targetEndDate: e.target.value })}
                    disabled={!canUpdate}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Actual End Date</Label>
                  <Input
                    type="date"
                    value={formData.actualEndDate}
                    onChange={(e) => setFormData({ ...formData, actualEndDate: e.target.value })}
                    disabled={!canUpdate}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Project Lead</Label>
                <Select
                  value={formData.leadId || 'none'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, leadId: value === 'none' ? '' : value })
                  }
                  disabled={!canUpdate}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lead</SelectItem>
                    {(members || []).map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.user.displayName} ({member.user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                {canUpdateProject && (
                  <Button onClick={handleSubmit} disabled={isUpdating || !canUpdate}>
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issue-types">
          <IssueTypesSettings
            projectId={projectId!}
            issueTypes={issueTypes}
            isLoading={isLoadingIssueTypes}
            error={issueTypesError}
            onCreate={handleCreateIssueType}
            onUpdate={handleUpdateIssueType}
            onDelete={handleDeleteIssueType}
            onReorder={handleReorderIssueTypes}
            disabled={!canUpdate}
          />
        </TabsContent>

        <TabsContent value="priorities">
          <PrioritiesSettings
            projectId={projectId!}
            priorities={priorities}
            isLoading={isLoadingPriorities}
            error={prioritiesError}
            onCreate={handleCreatePriority}
            onUpdate={handleUpdatePriority}
            onDelete={handleDeletePriority}
            disabled={!canUpdate}
          />
        </TabsContent>

        {canDelete && <TabsContent value="danger">
          <div className="space-y-4">
            <Card className="border-green-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Mark as Completed
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Mark this project as completed/released. The project will move to the done section.
                </div>
                {canUpdate && (
                  <Button
                    variant="outline"
                    className="border-green-500 text-green-600 hover:bg-green-50"
                    disabled={project?.status === 'completed'}
                    onClick={async () => {
                      try {
                        await updateProject({ projectId: projectId!, data: { status: 'completed' } }).unwrap();
                        toast.success('Project marked as completed');
                        refetch();
                      } catch {
                        toast.error('Failed to mark project as completed');
                      }
                    }}
                  >
                    {project?.status === 'completed' ? 'Already Completed' : 'Mark Completed'}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Archive className="h-5 w-5" />
                  Archive Project
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Archive this project to make it read-only. You can restore later.
                </div>
                {canUpdate && (
                  <Button variant="outline" onClick={() => setArchiveDialogOpen(true)}>
                    Archive
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-destructive/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Delete Project
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Permanently delete this project and all associated data.
                </div>
                {canDelete && (
                  <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                    Delete
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>}
      </Tabs>

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Project</DialogTitle>
            <DialogDescription>
              This will make the project read-only. You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleArchive} disabled={isArchiving}>
              {isArchiving ? 'Archiving...' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. Type the project name to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              Type <strong>{project.name}</strong> to confirm
            </Label>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Enter project name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmation !== project.name || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectSettingsPage;

// ─── Workflow Settings for a project ─────────────────────────────────────────
function ProjectWorkflowSettings({
  projectId,
  canUpdate,
}: {
  projectId: string;
  canUpdate: boolean;
}) {
  const [showBuilder, setShowBuilder] = useState(false);
  const [changeWorkflowOpen, setChangeWorkflowOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const { data: projectWorkflow, isLoading } = useGetProjectWorkflowQuery(projectId);
  const { data: allWorkflows = [] } = useGetWorkflowsQuery({});
  const [assignWorkflow] = useAssignWorkflowToProjectMutation();

  // All global (non-project-specific) workflows available as choices
  const globalWorkflows = allWorkflows.filter((w) => !(w as any).projectId);

  const handleChangeWorkflow = async () => {
    if (!selectedWorkflowId) return;
    setIsApplying(true);
    // Hide the workflow builder before assigning so the stale getWorkflow(oldId) query
    // doesn't refetch a now-deleted workflow and trigger a "Workflow not found" error.
    setShowBuilder(false);
    try {
      await assignWorkflow({ projectId, workflowId: selectedWorkflowId }).unwrap();
      toast.success('Workflow updated for this project');
      setChangeWorkflowOpen(false);
      setSelectedWorkflowId('');
    } catch {
      toast.error('Failed to change workflow');
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-lg border bg-muted animate-pulse" />
        <div className="h-64 rounded-lg border bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Current workflow card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-muted-foreground" />
              Current Workflow
            </div>
            <Link to="/admin/workflows" target="_blank" className="text-xs text-primary flex items-center gap-1 font-normal hover:underline">
              Manage workflows <ExternalLink className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projectWorkflow ? (
            <div className="space-y-4">
              {/* Workflow info row */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{projectWorkflow.name}</p>
                    {projectWorkflow.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{projectWorkflow.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {projectWorkflow.statuses?.length ?? 0} statuses
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {projectWorkflow.transitions?.length ?? 0} transitions
                      </span>
                    </div>
                  </div>
                </div>
                {canUpdate && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChangeWorkflowOpen(true)}
                    >
                      Change Workflow
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBuilder(!showBuilder)}
                    >
                      {showBuilder ? 'Hide Editor' : 'Edit Workflow'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Inline workflow builder */}
              {showBuilder && (
                <div className="rounded-lg border p-4 bg-white overflow-x-auto">
                  <WorkflowBuilder workflowId={projectWorkflow.id} readOnly={!canUpdate} hideAddStatus />
                </div>
              )}

              {/* Status transition summary (shown when editor is hidden) */}
              {!showBuilder && projectWorkflow.statuses && projectWorkflow.statuses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Status transition map</p>
                  <div className="grid gap-2">
                    {projectWorkflow.statuses.map((status) => {
                      const outgoing = (projectWorkflow.transitions || []).filter(t => t.fromStatusId === status.id);
                      const toStatuses = outgoing.map(t =>
                        projectWorkflow.statuses!.find(s => s.id === t.toStatusId)
                      ).filter(Boolean);
                      return (
                        <div key={status.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm bg-background">
                          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                          <span className="font-medium min-w-[120px]">{status.displayName}</span>
                          {toStatuses.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-muted-foreground text-xs">→</span>
                              {toStatuses.map((s: any) => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border"
                                  style={{ borderColor: s.color + '60', backgroundColor: s.color + '15', color: s.color }}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                                  {s.displayName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No outgoing transitions</span>
                          )}
                          <div className="ml-auto flex gap-1">
                            {status.isInitial && <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">Initial</span>}
                            {status.isFinal && <span className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5">Final</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <GitBranch className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-sm">No workflow assigned</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Go to Workflows admin to create a workflow, then select it here.
              </p>
              {canUpdate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 flex items-center gap-2"
                  onClick={() => setChangeWorkflowOpen(true)}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Select a Workflow
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Workflow dialog — dropdown of all global workflows */}
      <Dialog open={changeWorkflowOpen} onOpenChange={setChangeWorkflowOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Project Workflow</DialogTitle>
            <DialogDescription>
              Select a workflow to use for this project. A copy of the selected workflow will
              be assigned to this project, replacing the current one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {globalWorkflows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No workflows available.{' '}
                <Link to="/admin/workflows" className="text-primary hover:underline">
                  Create one in Workflow Admin
                </Link>
                .
              </p>
            ) : (
              <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a workflow…" />
                </SelectTrigger>
                <SelectContent>
                  {globalWorkflows.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      <span className="flex items-center gap-2">
                        {w.name}
                        {w.isDefault && <span className="text-xs text-muted-foreground">(Default)</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChangeWorkflowOpen(false); setSelectedWorkflowId(''); }}>
              Cancel
            </Button>
            <Button disabled={!selectedWorkflowId || isApplying} onClick={handleChangeWorkflow}>
              {isApplying ? 'Applying…' : 'Apply Workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
