import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  ShieldCheck,
  Users,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  useGetProjectSecurityLevelsQuery,
  useDeleteSecurityLevelMutation,
  SecurityLevel,
} from './securityLevelsApi';
import { SecurityLevelFormDialog } from './SecurityLevelFormDialog';
import { toast } from '@/hooks/useToast';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

export function SecurityLevelsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<SecurityLevel | null>(null);
  const [deletingLevel, setDeletingLevel] = useState<SecurityLevel | null>(null);
  const { hasPermission: canUpdateProject } = usePermissionGuard('projects.update');
  const { hasPermission: canDeleteProject } = usePermissionGuard('projects.delete');

  const { data: securityLevels, isLoading, error } = useGetProjectSecurityLevelsQuery(projectId!);

  const [deleteSecurityLevel, { isLoading: isDeleting }] = useDeleteSecurityLevelMutation();

  const handleDelete = async () => {
    if (!deletingLevel) return;

    try {
      await deleteSecurityLevel(deletingLevel.id).unwrap();
      toast.success('Security level deleted successfully');
      setDeletingLevel(null);
    } catch {
      toast.error('Failed to delete security level');
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
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Failed to load security levels</h3>
          <p className="text-muted-foreground">Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Levels</h1>
          <p className="text-muted-foreground">
            Control issue visibility based on user roles
          </p>
        </div>
        {canUpdateProject && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Security Level
          </Button>
        )}
      </div>

      {!securityLevels || securityLevels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No security levels yet</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Create security levels to restrict issue visibility to specific roles.
            </p>
            {canUpdateProject && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Security Level
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {securityLevels.map((level) => (
            <Card key={level.id} className="group">
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground cursor-grab">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-3">
                      {level.isDefault ? (
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                      ) : (
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{level.name}</CardTitle>
                          {level.isDefault && (
                            <Badge variant="outline" className="text-xs">Default</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            Level {level.level}
                          </Badge>
                        </div>
                        {level.description && (
                          <CardDescription className="mt-0.5">{level.description}</CardDescription>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>
                        {level.roles.length === 0
                          ? 'All members'
                          : `${level.roles.length} role${level.roles.length !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdateProject && (
                          <DropdownMenuItem onClick={() => setEditingLevel(level)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canDeleteProject && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeletingLevel(level)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              {level.roles.length > 0 && (
                <CardContent className="pt-0 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {level.roles.map((role) => (
                      <Badge key={role.id} variant="outline">
                        {role.displayName}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {canUpdateProject && (
        <SecurityLevelFormDialog
          projectId={projectId!}
          securityLevel={editingLevel}
          open={isCreateDialogOpen || !!editingLevel}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreateDialogOpen(false);
              setEditingLevel(null);
            }
          }}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deletingLevel} onOpenChange={() => setDeletingLevel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Security Level</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingLevel?.name}"? Issues with this
              security level will become visible to all project members.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingLevel(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SecurityLevelsPage;
