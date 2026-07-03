import { useState, useEffect } from 'react';
import {
  useGetUsersWithRolesQuery,
  useGetPermissionsQuery,
  useGetUserDirectPermissionsQuery,
  useSetUserDirectPermissionsMutation,
} from '@/features/rbac/rbacApi';
import { UserWithRole, Permission } from '@/features/rbac/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Settings2, ChevronLeft, ChevronRight, User, Crown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeAvatarUrl } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import { useAppSelector } from '@/app/hooks';

// ── Permission presets ────────────────────────────────────────────────────────

/** Permissions that are dangerous / admin-only — never shown or pre-selected */
const DANGER_ZONE_PERMS = new Set([
  'projects.delete',
  'projects.manage_all',
  'projects.create',
  'projects.view_all',
  'time.delete_all',
  'time.edit_all',
  'issues.manage_all',
  'integrations.manage',
  'admin.settings',
  'admin.audit',
  'users.manage_roles',
  'users.read',
  'roles.create',
  'roles.read',
  'roles.update',
  'roles.delete',
]);

/** Basic member: can work on tasks assigned to them */
const MEMBER_PRESET = new Set([
  'issues.read',
  'issues.create',
  'issues.update_own',
  'issues.assign',
  'time.log',
  'sprints.read',
  'reports.view',
  'ai.use',
]);

/** Project Lead: full project access + workflow management, no danger zone */
const LEAD_PRESET = new Set([
  'issues.read',
  'issues.create',
  'issues.update',
  'issues.delete',
  'issues.assign',
  'issues.view_all',
  'projects.read',
  'projects.update',
  'projects.manage_members',
  'sprints.read',
  'sprints.create',
  'sprints.manage',
  'time.log',
  'time.view_all',
  'members.invite',
  'reports.view',
  'reports.export',
  'workflows.view',
  'workflows.create',
  'workflows.manage',
  'ai.use',
]);

// ── Manage permissions dialog ─────────────────────────────────────────────────
function ManagePermissionsDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserWithRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const { data: allPermsData, isLoading: isLoadingAll } = useGetPermissionsQuery(
    { app: 'pmt' },
    { skip: !open }
  );
  const { data: userPermsData, isLoading: isLoadingUser } = useGetUserDirectPermissionsQuery(
    user.id,
    { skip: !open }
  );
  const [setPerms, { isLoading: isSaving }] = useSetUserDirectPermissionsMutation();

  // Init: if user has no saved permissions yet, apply Member preset as default
  useEffect(() => {
    if (!initialized && allPermsData && userPermsData && !isLoadingUser && !isLoadingAll) {
      const saved = userPermsData.data.map((p) => p.id);
      if (saved.length > 0) {
        setSelected(new Set(saved));
      } else {
        // No permissions yet — default to Member preset (match by name)
        const memberIds = new Set(
          allPermsData.data
            .filter((p) => MEMBER_PRESET.has(p.name))
            .map((p) => p.id)
        );
        setSelected(memberIds);
      }
      setInitialized(true);
    }
  }, [allPermsData, userPermsData, isLoadingUser, isLoadingAll, initialized]);

  useEffect(() => {
    if (!open) setInitialized(false);
  }, [open]);

  // Only show non-danger-zone permissions
  const allPermissions = (allPermsData?.data || []).filter((p) => !DANGER_ZONE_PERMS.has(p.name));

  const grouped = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) acc[perm.resource] = [];
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applyPreset = (preset: Set<string>) => {
    const ids = new Set(
      allPermissions.filter((p) => preset.has(p.name)).map((p) => p.id)
    );
    setSelected(ids);
  };

  const handleSave = async () => {
    try {
      await setPerms({ userId: user.id, permissionIds: Array.from(selected) }).unwrap();
      toast({ title: 'Permissions saved', description: `Updated permissions for ${user.displayName}.` });
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save permissions.', variant: 'destructive' });
    }
  };

  const initials = user.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const isLoading = isLoadingAll || isLoadingUser;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Manage Permissions
          </DialogTitle>
          <DialogDescription>
            Select permissions for {user.displayName}. Use a preset to apply common permission sets.
          </DialogDescription>
        </DialogHeader>

        {/* User info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <Avatar className="h-10 w-10">
            <AvatarImage src={normalizeAvatarUrl(user.avatarUrl) || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="ml-auto">
            <Badge variant={user.isActive ? 'default' : 'secondary'} className={user.isActive ? 'bg-green-500' : ''}>
              {user.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {/* Presets */}
        {!isLoading && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Quick preset:</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => applyPreset(MEMBER_PRESET)}
            >
              <User className="h-3 w-3" />
              Member
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => applyPreset(LEAD_PRESET)}
            >
              <Crown className="h-3 w-3" />
              Project Lead
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setSelected(new Set())}
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Permission checkboxes */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([resource, perms]) => (
              <div key={resource} className="border rounded-lg p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {resource.replace(/_/g, ' ')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {perms.map((perm) => (
                    <div key={perm.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`p-${perm.id}`}
                        checked={selected.has(perm.id)}
                        onCheckedChange={() => toggle(perm.id)}
                      />
                      <Label htmlFor={`p-${perm.id}`} className="text-sm cursor-pointer leading-tight">
                        {perm.displayName || perm.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save Permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function UsersPermissionsPage() {
  const { hasPermission: canAccess } = usePermissionGuard(['users.manage_roles', 'users.read'], 'any');
  const { hasPermission: canManage } = usePermissionGuard('users.manage_roles');
  const currentUserId = useAppSelector((state) => state.auth.user?.id);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);

  const { data: usersData, isLoading } = useGetUsersWithRolesQuery({
    search: search || undefined,
    page,
    limit: 15,
  });

  const allUsers = usersData?.data.users || [];
  const users = allUsers.filter((u) => u.role?.name !== 'admin');
  const pagination = usersData?.data.pagination;

  if (!canAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
            You don't have permission to view this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users & Permissions</h1>
        <p className="text-muted-foreground mt-1">
          Manage what each user can do in the application.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Click "Manage Permissions" on any user to control their access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No users found.</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const initials = user.displayName
                      ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                      : 'U';
                    const isCurrentUser = user.id === currentUserId;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={normalizeAvatarUrl(user.avatarUrl) || undefined} />
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{user.displayName}</span>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={user.isActive ? 'default' : 'secondary'}
                            className={user.isActive ? 'bg-green-500 text-white' : ''}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            {isCurrentUser ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                                <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                                Manage Permissions
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {(pagination.page - 1) * pagination.limit + 1}–
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} users
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={pagination.page === 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={pagination.page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedUser && (
        <ManagePermissionsDialog
          user={selectedUser}
          open={!!selectedUser}
          onOpenChange={(open) => !open && setSelectedUser(null)}
        />
      )}
    </div>
  );
}
