import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Rocket,
  Archive,
  RotateCcw,
  Calendar,
  Tag,
  CheckCircle2,
  BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useGetProjectVersionsQuery,
  useDeleteVersionMutation,
  useReleaseVersionMutation,
  useArchiveVersionMutation,
  useUnarchiveVersionMutation,
  Version,
  VersionStatus,
} from './versionsApi';
import { VersionFormDialog } from './VersionFormDialog';
import { toast } from '@/hooks/useToast';
import { format } from 'date-fns';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

const statusConfig: Record<VersionStatus, { label: string; color: string; icon: any }> = {
  unreleased: { label: 'Unreleased', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Tag },
  released: { label: 'Released', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2 },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: Archive },
};

export function VersionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VersionStatus | 'all'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<Version | null>(null);
  const [deletingVersion, setDeletingVersion] = useState<Version | null>(null);
  const [releasingVersion, setReleasingVersion] = useState<Version | null>(null);
  const navigate = useNavigate();
  const { hasPermission: canUpdateProject } = usePermissionGuard('projects.update');
  const { hasPermission: canDeleteProject } = usePermissionGuard('projects.delete');

  const { data: versions, isLoading, error } = useGetProjectVersionsQuery({
    projectId: projectId!,
    filters: {
      search: searchQuery || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    },
  });

  const [deleteVersion, { isLoading: isDeleting }] = useDeleteVersionMutation();
  const [releaseVersion, { isLoading: isReleasing }] = useReleaseVersionMutation();
  const [archiveVersion, { isLoading: isArchiving }] = useArchiveVersionMutation();
  const [unarchiveVersion, { isLoading: isUnarchiving }] = useUnarchiveVersionMutation();

  const handleDelete = async () => {
    if (!deletingVersion) return;

    try {
      await deleteVersion(deletingVersion.id).unwrap();
      toast.success('Version deleted successfully');
      setDeletingVersion(null);
    } catch {
      toast.error('Failed to delete version');
    }
  };

  const handleRelease = async () => {
    if (!releasingVersion) return;

    try {
      await releaseVersion(releasingVersion.id).unwrap();
      toast.success('Version released successfully');
      setReleasingVersion(null);
    } catch {
      toast.error('Failed to release version');
    }
  };

  const handleArchive = async (version: Version) => {
    try {
      await archiveVersion(version.id).unwrap();
      toast.success('Version archived');
    } catch {
      toast.error('Failed to archive version');
    }
  };

  const handleUnarchive = async (version: Version) => {
    try {
      await unarchiveVersion(version.id).unwrap();
      toast.success('Version unarchived');
    } catch {
      toast.error('Failed to unarchive version');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Failed to load versions</h3>
          <p className="text-muted-foreground">Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Releases</h1>
          <p className="text-muted-foreground">
            Track and manage software versions
          </p>
        </div>
        {canUpdateProject && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Release
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search releases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as VersionStatus | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="unreleased">Unreleased</SelectItem>
            <SelectItem value="released">Released</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!versions || versions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No releases yet</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Create releases to track versions of your software.
            </p>
            {canUpdateProject && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Release
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {versions.map((version) => {
            const StatusIcon = statusConfig[version.status].icon;
            return (
              <Card key={version.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{version.name}</CardTitle>
                        <Badge className={statusConfig[version.status].color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[version.status].label}
                        </Badge>
                      </div>
                      {version.description && (
                        <CardDescription>{version.description}</CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/versions/${version.id}/reports`)}>
                          <BarChart2 className="h-4 w-4 mr-2" />
                          View Report
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {canUpdateProject && (
                          <DropdownMenuItem onClick={() => setEditingVersion(version)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canUpdateProject && version.status === 'unreleased' && (
                          <DropdownMenuItem onClick={() => setReleasingVersion(version)}>
                            <Rocket className="h-4 w-4 mr-2" />
                            Release
                          </DropdownMenuItem>
                        )}
                        {canUpdateProject && version.status !== 'archived' && (
                          <DropdownMenuItem onClick={() => handleArchive(version)}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        )}
                        {canUpdateProject && version.status === 'archived' && (
                          <DropdownMenuItem onClick={() => handleUnarchive(version)}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Unarchive
                          </DropdownMenuItem>
                        )}
                        {canDeleteProject && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeletingVersion(version)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    {version.releaseDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {version.status === 'released' && version.actualReleaseDate
                            ? `Released ${format(new Date(version.actualReleaseDate), 'MMM d, yyyy')}`
                            : `Target: ${format(new Date(version.releaseDate), 'MMM d, yyyy')}`}
                        </span>
                      </div>
                    )}
                    <div>
                      {version.stats.completedIssues} / {version.stats.totalIssues} issues
                    </div>
                    {version.stats.totalStoryPoints > 0 && (
                      <div>
                        {version.stats.completedStoryPoints} / {version.stats.totalStoryPoints} points
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span className="font-medium">{version.progress}%</span>
                    </div>
                    <Progress value={version.progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {canUpdateProject && (
        <VersionFormDialog
          projectId={projectId!}
          version={editingVersion}
          open={isCreateDialogOpen || !!editingVersion}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreateDialogOpen(false);
              setEditingVersion(null);
            }
          }}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deletingVersion} onOpenChange={() => setDeletingVersion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Release</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingVersion?.name}"? Issues will be
              unlinked from this release but not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingVersion(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Confirmation */}
      <Dialog open={!!releasingVersion} onOpenChange={() => setReleasingVersion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to release "{releasingVersion?.name}"? This will mark
              the version as released with today's date.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleasingVersion(null)}>
              Cancel
            </Button>
            <Button onClick={handleRelease} disabled={isReleasing}>
              <Rocket className="h-4 w-4 mr-2" />
              {isReleasing ? 'Releasing...' : 'Release'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VersionsPage;
