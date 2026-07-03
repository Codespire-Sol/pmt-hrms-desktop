import { useState } from 'react';
import {
  useGetUsersWithRolesQuery,
  useGetGlobalRolesQuery,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
} from '../rbacApi';
import { useUpdateUserStatusMutation, useUpdateUserMutation } from '@/features/users/usersApi';
import { UserWithRole, Role } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserCog, Shield, Trash2, Pencil, Power, MoreHorizontal } from 'lucide-react';
import { normalizeAvatarUrl } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import { useAppSelector } from '@/app/hooks';

function AssignRoleDialog({
  user,
  roles,
  open,
  onOpenChange,
}: {
  user: UserWithRole;
  roles: Role[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState(user.role?.id || '');
  const [assignRole, { isLoading }] = useAssignRoleToUserMutation();
  const { toast } = useToast();

  const handleAssign = async () => {
    try {
      await assignRole({ userId: user.id, roleId: selectedRoleId, scope: 'pmt' }).unwrap();
      toast({
        title: 'Role assigned',
        description: `Successfully assigned role to ${user.displayName}`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign role. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user.role ? 'Edit User Role' : 'Assign Role'}</DialogTitle>
          <DialogDescription>
            Select a role for {user.displayName}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center gap-3 mb-4">
            <Avatar>
              <AvatarImage src={normalizeAvatarUrl(user.avatarUrl) || undefined} />
              <AvatarFallback>
                {user.displayName
                  ? user.displayName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                  : 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.displayName}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {role.displayName}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedRoleId || isLoading}>
            {isLoading ? 'Saving...' : user.role ? 'Update Role' : 'Assign Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user: UserWithRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [updateUser, { isLoading }] = useUpdateUserMutation();
  const [form, setForm] = useState({
    email: user.email,
    firstName: user.displayName?.split(' ')[0] || '',
    lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
    isActive: user.isActive,
    isVerified: user.isVerified ?? false,
  });

  const handleSave = async () => {
    try {
      await updateUser({
        userId: user.id,
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        isActive: form.isActive,
        isVerified: form.isVerified,
      }).unwrap();
      toast({ title: 'User updated' });
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.data?.error?.message || 'Failed to update user.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user details and status.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-first">First Name</Label>
              <Input
                id="edit-first"
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last">Last Name</Label>
              <Input
                id="edit-last"
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Verified</Label>
            <Switch
              checked={form.isVerified}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isVerified: checked }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserRolesPage() {
  const { hasPermission: canViewUsers } = usePermissionGuard(['users.manage_roles', 'users.read'], 'any');
  const { hasPermission: canManageUsers } = usePermissionGuard('users.manage_roles');
  const currentUserId = useAppSelector((state) => state.auth.user?.id);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [userToRemoveRole, setUserToRemoveRole] = useState<UserWithRole | null>(null);
  const [userToToggleStatus, setUserToToggleStatus] = useState<UserWithRole | null>(null);
  const [userToEdit, setUserToEdit] = useState<UserWithRole | null>(null);

  const { data: usersData, isLoading: isLoadingUsers, refetch } = useGetUsersWithRolesQuery({
    search: search || undefined,
    roleId: roleFilter || undefined,
    page,
    limit: 10,
  });

  const { data: rolesData } = useGetGlobalRolesQuery();
  const [removeRole, { isLoading: isRemovingRole }] = useRemoveRoleFromUserMutation();
  const [updateUserStatus, { isLoading: isUpdatingStatus }] = useUpdateUserStatusMutation();
  const { toast } = useToast();

  const users = usersData?.data.users || [];
  const pagination = usersData?.data.pagination;
  const roles = rolesData?.data || [];

  const handleRemoveRole = async () => {
    if (!userToRemoveRole) return;

    try {
      await removeRole({ userId: userToRemoveRole.id, scope: 'pmt' }).unwrap();
      toast({
        title: 'Role removed',
        description: `Successfully removed role from ${userToRemoveRole.displayName}`,
      });
      setUserToRemoveRole(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove role. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleStatus = async () => {
    if (!userToToggleStatus) return;

    try {
      await updateUserStatus({
        userId: userToToggleStatus.id,
        isActive: !userToToggleStatus.isActive,
      }).unwrap();
      toast({
        title: userToToggleStatus.isActive ? 'User deactivated' : 'User activated',
        description: `${userToToggleStatus.displayName} is now ${userToToggleStatus.isActive ? 'inactive' : 'active'}.`,
      });
      setUserToToggleStatus(null);
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update user status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!canViewUsers) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
            You don’t have permission to view users.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Roles</h1>
          <p className="text-muted-foreground">Manage role assignments for system users.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            View and manage user role assignments. Use the filters to find specific users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter || 'all'} onValueChange={(val) => setRoleFilter(val === 'all' ? '' : val)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          {isLoadingUsers ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No users found matching your criteria.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    {canManageUsers && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={normalizeAvatarUrl(user.avatarUrl) || undefined} />
                            <AvatarFallback>
                              {user.displayName
                                ? user.displayName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                : 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        {user.role ? (
                          <Badge variant="secondary">{user.role.displayName}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No role</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge variant="default" className="bg-green-500">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </TableCell>
                      {canManageUsers && (
                        <TableCell className="text-right">
                          {user.id === currentUserId ? (
                            <span className="text-xs text-muted-foreground pr-2">You</span>
                          ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" aria-label="Open actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                                {user.role ? (
                                  <>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit Role
                                  </>
                                ) : (
                                  <>
                                    <UserCog className="h-4 w-4 mr-2" />
                                    Assign Role
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setUserToEdit(user)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setUserToToggleStatus(user)}>
                                <Power className="h-4 w-4 mr-2" />
                                {user.isActive ? 'Deactivate User' : 'Activate User'}
                              </DropdownMenuItem>
                              {user.role && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setUserToRemoveRole(user)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove Role
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} users
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Assign Role Dialog */}
      {canManageUsers && selectedUser && (
        <AssignRoleDialog
          user={selectedUser}
          roles={roles}
          open={!!selectedUser}
          onOpenChange={(open) => !open && setSelectedUser(null)}
        />
      )}

      {/* Remove Role Confirmation */}
      {canManageUsers && (
        <AlertDialog open={!!userToRemoveRole} onOpenChange={(open) => !open && setUserToRemoveRole(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove the role from {userToRemoveRole?.displayName}? They
                will lose all permissions associated with this role.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveRole}
                disabled={isRemovingRole}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isRemovingRole ? 'Removing...' : 'Remove Role'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Edit User Dialog */}
      {canManageUsers && userToEdit && (
        <EditUserDialog
          user={userToEdit}
          open={!!userToEdit}
          onOpenChange={(open) => !open && setUserToEdit(null)}
          onSaved={() => refetch()}
        />
      )}

      {/* Activate/Deactivate Confirmation */}
      {canManageUsers && (
        <AlertDialog open={!!userToToggleStatus} onOpenChange={(open) => !open && setUserToToggleStatus(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {userToToggleStatus?.isActive ? 'Deactivate User' : 'Activate User'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {userToToggleStatus?.isActive
                  ? `Are you sure you want to deactivate ${userToToggleStatus?.displayName}? They will not be able to log in.`
                  : `Activate ${userToToggleStatus?.displayName} to restore access.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleToggleStatus}
                disabled={isUpdatingStatus}
                className={userToToggleStatus?.isActive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              >
                {isUpdatingStatus
                  ? 'Updating...'
                  : userToToggleStatus?.isActive
                    ? 'Deactivate'
                    : 'Activate'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}
