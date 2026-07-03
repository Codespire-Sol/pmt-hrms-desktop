import { useState } from 'react';
import {
  useGetGlobalRolesQuery,
  useGetRolePermissionsQuery,
  useGetPermissionsQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useSetRolePermissionsMutation,
} from '../rbacApi';
import { Role, Permission } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, Eye, Lock, Pencil, Trash2, Settings, Briefcase, Globe, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

const HUMANIZED_ACTIONS: Record<string, string> = {
  read: 'View',
  view: 'View',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  assign: 'Assign',
  export: 'Export',
  manage: 'Manage',
};

function humanizePermission(perm: Permission): string {
  if (perm.displayName) return perm.displayName;
  if (perm.name) return perm.name;

  const resource = perm.resource || 'Resource';
  const action = perm.action || 'Action';
  const actionLabel = HUMANIZED_ACTIONS[action] || action.replace(/_/g, ' ');
  const resourceLabel = resource.replace(/_/g, ' ');
  return `${actionLabel} ${resourceLabel}`.replace(/\s+/g, ' ').trim();
}

// Permission Editor Dialog
function EditRolePermissionsDialog({
  role,
  open,
  onOpenChange,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { data: rolePermissionsData, isLoading: isLoadingRolePermissions } = useGetRolePermissionsQuery(
    { roleId: role.id, app: 'pmt' },
    { skip: !open }
  );
  const { data: allPermissionsData, isLoading: isLoadingAllPermissions } = useGetPermissionsQuery(
    { app: 'pmt' },
    { skip: !open }
  );
  const [setRolePermissions, { isLoading: isSaving }] = useSetRolePermissionsMutation();

  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Initialize selected permissions when data loads
  if (rolePermissionsData && !initialized && !isLoadingRolePermissions) {
    const currentPermissionIds = rolePermissionsData.data.map(p => p.id);
    setSelectedPermissionIds(new Set(currentPermissionIds));
    setInitialized(true);
  }

  const allPermissions = allPermissionsData?.data || [];

  // Group permissions by resource
  const groupedPermissions = allPermissions.reduce(
    (acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  const handleTogglePermission = (permissionId: string) => {
    setSelectedPermissionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permissionId)) {
        newSet.delete(permissionId);
      } else {
        newSet.add(permissionId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      await setRolePermissions({
        roleId: role.id,
        permissionIds: Array.from(selectedPermissionIds),
      }).unwrap();
      toast({ title: 'Permissions updated successfully' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error updating permissions', description: error?.data?.error?.message, variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setInitialized(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Edit PMT Permissions: {role.displayName}
          </DialogTitle>
          <DialogDescription>
            Select Project Management Tool permissions for this role. Changes take effect immediately after saving.
          </DialogDescription>
        </DialogHeader>

        {isLoadingRolePermissions || isLoadingAllPermissions ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([resource, perms]) => (
              <div key={resource} className="border rounded-lg p-4">
                <h4 className="font-medium capitalize mb-3">{resource.replace(/_/g, ' ')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  {perms.map((perm) => (
                    <div key={perm.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.id}
                        checked={selectedPermissionIds.has(perm.id)}
                        onCheckedChange={() => handleTogglePermission(perm.id)}
                      />
                      <Label htmlFor={perm.id} className="text-sm cursor-pointer">
                        {humanizePermission(perm)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// View Permissions Dialog (read-only)
function RolePermissionsDialog({
  role,
  open,
  onOpenChange,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useGetRolePermissionsQuery(
    { roleId: role.id, app: 'pmt' },
    { skip: !open }
  );

  const permissions = data?.data || [];

  // Group permissions by resource
  const groupedPermissions = permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {role.displayName} — PMT Permissions
          </DialogTitle>
          <DialogDescription>
            {role.description || 'View permissions for this role'} (Project Management Tool scope)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No PMT permissions assigned to this role.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([resource, perms]) => (
              <div key={resource}>
                <h4 className="font-medium capitalize mb-2">{resource.replace(/_/g, ' ')}</h4>
                <div className="flex flex-wrap gap-2">
                  {perms.map((perm) => (
                    <div key={perm.id} className="flex items-center gap-1">
                      <Badge variant="secondary">{perm.displayName}</Badge>
                      {perm.app === 'global' && (
                        <Badge variant="outline" className="text-xs px-1 py-0">global</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Edit Role Dialog
function RoleFormDialog({
  role,
  open,
  onOpenChange,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();

  const [formData, setFormData] = useState({
    displayName: role.displayName || '',
    description: role.description || '',
    level: role.level || 10,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateRole({
        roleId: role.id,
        displayName: formData.displayName,
        description: formData.description,
        level: formData.level,
      }).unwrap();
      toast({ title: 'Role updated successfully' });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error updating role',
        description: error?.data?.error?.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogDescription>Update the role details below.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="e.g., Project Lead"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the role's purpose and responsibilities..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">Priority Level (1-100)</Label>
            <Input
              id="level"
              type="number"
              min={1}
              max={100}
              value={formData.level}
              onChange={(e) => setFormData(prev => ({ ...prev, level: parseInt(e.target.value) || 10 }))}
            />
            <p className="text-xs text-muted-foreground">Higher level = more authority. System roles have higher levels.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Create Role Dialog
function CreateRoleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [createRole, { isLoading }] = useCreateRoleMutation();
  const [formData, setFormData] = useState({ name: '', displayName: '', description: '', level: 10 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRole({
        name: formData.name,
        displayName: formData.displayName,
        description: formData.description || undefined,
        level: formData.level,
      }).unwrap();
      toast({ title: 'Role created successfully' });
      setFormData({ name: '', displayName: '', description: '', level: 10 });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error creating role',
        description: error?.data?.error?.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Custom Role</DialogTitle>
          <DialogDescription>
            Create a new PMT-specific role. It will only be visible in the Project Management Tool.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Role Key</Label>
            <Input
              id="create-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') }))}
              placeholder="e.g., project_lead"
              required
            />
            <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-displayName">Display Name</Label>
            <Input
              id="create-displayName"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="e.g., Project Lead"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-description">Description</Label>
            <Textarea
              id="create-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this role's purpose..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-level">Priority Level (1–100)</Label>
            <Input
              id="create-level"
              type="number"
              min={1}
              max={100}
              value={formData.level}
              onChange={(e) => setFormData(prev => ({ ...prev, level: parseInt(e.target.value) || 10 }))}
            />
            <p className="text-xs text-muted-foreground">Higher level = more authority.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RolesListPage() {
  const { hasPermission: canManageRoles } = usePermissionGuard('admin.settings');
  const { toast } = useToast();
  const { data, isLoading, isError } = useGetGlobalRolesQuery();
  const [deleteRole, { isLoading: isDeleting }] = useDeleteRoleMutation();

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editPermissionsRole, setEditPermissionsRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const roles = data?.data || [];

  const getRoleIcon = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'admin':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'lead':
        return <Briefcase className="h-4 w-4 text-blue-500" />;
      case 'member':
      case 'employee':
        return <Lock className="h-4 w-4 text-green-500" />;
      case 'viewer':
        return <Eye className="h-4 w-4 text-gray-500" />;
      default:
        return <Globe className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;

    try {
      await deleteRole(roleToDelete.id).unwrap();
      toast({ title: 'Role deleted successfully' });
      setRoleToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Error deleting role',
        description: error?.data?.error?.message,
        variant: 'destructive'
      });
    }
  };

  if (isError) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-10">
            <p className="text-destructive">Failed to load roles. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canManageRoles) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
            You don’t have permission to manage roles.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Global roles and their Project Management Tool permissions.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Roles</CardTitle>
          <CardDescription>
            All roles shared across the platform. Permissions shown are scoped to this application.
            System roles cannot be deleted; custom roles can be edited or removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role.name)}
                        <span className="font-medium">{role.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{role.level}</Badge>
                    </TableCell>
                    <TableCell>
                      {role.isSystem ? (
                        <Badge variant="secondary">System</Badge>
                      ) : (
                        <Badge>Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRole(role)}
                        >
                          View
                        </Button>
                        {/* Edit permissions is available for all roles (system and custom) */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Edit permissions"
                          onClick={() => setEditPermissionsRole(role)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        {/* Edit metadata and delete only for custom (non-system) roles */}
                        {!role.isSystem && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit role details"
                              onClick={() => setEditingRole(role)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete role"
                              onClick={() => setRoleToDelete(role)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Permissions Dialog */}
      {selectedRole && (
        <RolePermissionsDialog
          role={selectedRole}
          open={!!selectedRole}
          onOpenChange={(open) => !open && setSelectedRole(null)}
        />
      )}

      {/* Edit Permissions Dialog */}
      {editPermissionsRole && (
        <EditRolePermissionsDialog
          role={editPermissionsRole}
          open={!!editPermissionsRole}
          onOpenChange={(open) => !open && setEditPermissionsRole(null)}
        />
      )}

      {/* Edit Role Dialog */}
      {editingRole && (
        <RoleFormDialog
          role={editingRole}
          open={!!editingRole}
          onOpenChange={(open) => !open && setEditingRole(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete?.displayName}"?
              This action cannot be undone. Make sure no users are assigned to this role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Role Dialog */}
      <CreateRoleDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
