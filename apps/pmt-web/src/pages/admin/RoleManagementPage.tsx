import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useGetRolesQuery,
  useGetUsersWithRolesQuery,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useUpdateRoleMutation,
} from '../../features/rbac/rbacApi';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Pencil, Loader2 } from 'lucide-react';
import { UserWithRole, Role } from '../../features/rbac/types';

export function RoleManagementPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  // Edit role state
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editRoleForm, setEditRoleForm] = useState({ displayName: '', description: '' });

  const { hasPermission: canViewRoles } = usePermissionGuard(
    ['admin.settings', 'users.manage_roles', 'users.read'],
    'any'
  );
  const { hasPermission: canManageUsers } = usePermissionGuard('users.manage_roles');
  const { hasPermission: canEditRoles } = usePermissionGuard('admin.settings');

  const { data: rolesData, isLoading: rolesLoading } = useGetRolesQuery();
  const { data: usersData, isLoading: usersLoading } = useGetUsersWithRolesQuery({
    search: search || undefined,
    roleId: roleFilter || undefined,
    page,
    limit: 10,
  });

  const [assignRole, { isLoading: isAssigning }] = useAssignRoleToUserMutation();
  const [removeRole, { isLoading: isRemoving }] = useRemoveRoleFromUserMutation();
  const [updateRole, { isLoading: isUpdatingRole }] = useUpdateRoleMutation();

  const roles = rolesData?.data || [];
  const users = usersData?.data?.users || [];
  const pagination = usersData?.data?.pagination;

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRoleId) return;

    try {
      await assignRole({ userId: selectedUser.id, roleId: selectedRoleId, scope: 'pmt' }).unwrap();
      setIsAssignDialogOpen(false);
      setSelectedUser(null);
      setSelectedRoleId('');
    } catch (error) {
      console.error('Failed to assign role:', error);
    }
  };

  const handleRemoveRole = async (userId: string) => {
    try {
      await removeRole({ userId, scope: 'pmt' }).unwrap();
    } catch (error) {
      console.error('Failed to remove role:', error);
    }
  };

  const openAssignDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setSelectedRoleId(user.role?.id || '');
    setIsAssignDialogOpen(true);
  };

  const openEditRoleDialog = (role: Role) => {
    setEditingRole(role);
    setEditRoleForm({
      displayName: role.displayName,
      description: role.description || '',
    });
    setIsEditRoleDialogOpen(true);
  };

  const handleEditRole = async () => {
    if (!editingRole) return;
    try {
      await updateRole({
        roleId: editingRole.id,
        displayName: editRoleForm.displayName,
        description: editRoleForm.description,
      }).unwrap();
      setIsEditRoleDialogOpen(false);
      setEditingRole(null);
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const getRoleBadgeVariant = (role: Role | null) => {
    if (!role) return 'secondary';
    switch (role.name) {
      case 'admin':
        return 'destructive';
      case 'pm':
        return 'default';
      case 'lead':
        return 'default';
      default:
        return 'secondary';
    }
  };

  if (!canViewRoles) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You don't have permission to access this page.
          </p>
          <Link to="/dashboard" className="mt-4 inline-block text-primary hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Role Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage user roles and system permissions
            </p>
          </div>
          <Link to="/admin/audit-logs">
            <Button variant="outline">View Audit Logs</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Roles Overview */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">System Roles</h2>
          {rolesLoading ? (
            <div className="text-muted-foreground">Loading roles...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{role.displayName}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={getRoleBadgeVariant(role)}>
                        Level {role.level}
                      </Badge>
                      {canEditRoles && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => openEditRoleDialog(role)}
                          title="Edit role"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {role.description || 'No description'}
                  </p>
                  {role.isSystem && (
                    <Badge variant="outline" className="mt-2">
                      System Role
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Users with Roles */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">User Roles</h2>

          {/* Filters */}
          <div className="mb-4 flex gap-4">
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
            <Select
              value={roleFilter}
              onValueChange={(value) => {
                setRoleFilter(value === 'all' ? '' : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          {usersLoading ? (
            <div className="text-muted-foreground">Loading users...</div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {user.avatarUrl ? (
                                <img
                                  src={user.avatarUrl}
                                  alt={user.displayName}
                                  className="h-8 w-8 rounded-full"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                                </div>
                              )}
                              <span className="font-medium">{user.displayName}</span>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.role ? (
                              <Badge variant={getRoleBadgeVariant(user.role)}>
                                {user.role.displayName}
                              </Badge>
                            ) : (
                              <Badge variant="outline">No Role</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? 'default' : 'secondary'}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAssignDialog(user)}
                                disabled={!canManageUsers}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                {user.role ? 'Edit Role' : 'Assign Role'}
                              </Button>
                              {user.role && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRemoveRole(user.id)}
                                  disabled={isRemoving || !canManageUsers}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} users
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Assign / Edit User Role Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.role ? 'Edit User Role' : 'Assign Role to User'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>
                  Select a role for <strong>{selectedUser.displayName}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <span>{role.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        (Level {role.level})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoleId && (
              <p className="mt-2 text-sm text-muted-foreground">
                {roles.find((r) => r.id === selectedRoleId)?.description || 'No description'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignRole} disabled={!selectedRoleId || isAssigning || !canManageUsers}>
              {isAssigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Role'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Properties Dialog (admin only) */}
      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update the display name and description for{' '}
              <strong>{editingRole?.displayName}</strong>.
              {editingRole?.isSystem && (
                <span className="ml-1 text-amber-600">(System role — name is read-only)</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editDisplayName">Display Name</Label>
              <Input
                id="editDisplayName"
                value={editRoleForm.displayName}
                onChange={(e) =>
                  setEditRoleForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
                placeholder="e.g. Administrator"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editRoleForm.description}
                onChange={(e) =>
                  setEditRoleForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe what this role can do"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditRoleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditRole}
              disabled={!editRoleForm.displayName.trim() || isUpdatingRole}
            >
              {isUpdatingRole ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RoleManagementPage;
