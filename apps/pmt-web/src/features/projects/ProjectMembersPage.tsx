import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  UserPlus,
  MoreHorizontal,
  User,
  Crown,
  AlertCircle,
  Search,
  X,
  Check,
  ChevronDown,
  Shield,
  ShieldCheck,
  Terminal,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { normalizeAvatarUrl, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useGetProjectQuery, useGetProjectMembersQuery, useAddProjectMemberMutation, useRemoveProjectMemberMutation, useUpdateMemberRoleMutation } from './projectsApi';
import { useGetUsersQuery } from '@/features/users/usersApi';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

const roleIcons: Record<string, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  lead: ShieldCheck,
  member: Terminal,
  viewer: Eye,
};

const roleColors: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800',
  admin: 'bg-purple-100 text-purple-800',
  lead: 'bg-emerald-100 text-emerald-800',
  member: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-800',
};

const roleTextColors: Record<string, string> = {
  owner: '#92400e',
  admin: '#6b21a8',
  lead: '#065f46',
  member: '#1e40af',
  viewer: '#374151',
};

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  lead: 'Lead',
  member: 'Member',
  viewer: 'Viewer',
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

export function ProjectMembersPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedInviteUserId, setSelectedInviteUserId] = useState<string>('');
  const [inviteRole, setInviteRole] = useState('member');
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);
  const { hasPermission: canManageMembers } = usePermissionGuard('projects.manage_members');

  const { data: projectData, isLoading: isProjectLoading } = useGetProjectQuery(projectId!);
  const { data: membersData, isLoading: isMembersLoading, refetch: refetchMembers } = useGetProjectMembersQuery(projectId!);
  const [addMember, { isLoading: isAdding }] = useAddProjectMemberMutation();
  const [removeMember, { isLoading: isRemoving }] = useRemoveProjectMemberMutation();
  const [updateRole, { isLoading: isUpdating }] = useUpdateMemberRoleMutation();
  const { data: usersData } = useGetUsersQuery(
    { page: 1, limit: 200 },
    { skip: !inviteDialogOpen }
  );

  const project = projectData;
  const members = membersData || [];
  const memberUserIds = new Set(members.map((m: any) => m.userId));
  const availableUsers = (usersData?.users || []).filter(
    (user: any) => !memberUserIds.has(user.id) &&
      (user.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearchQuery.toLowerCase()))
  );

  const selectedInviteUser = (usersData?.users || []).find((u: any) => u.id === selectedInviteUserId);

  const filteredMembers = members.filter((member: any) =>
    member.user?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.user?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.user?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await updateRole({
        projectId: projectId!,
        memberId,
        role: newRole,
      }).unwrap();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleRemove = async () => {
    if (!removeMemberId) return;
    try {
      await removeMember({
        projectId: projectId!,
        memberId: removeMemberId,
      }).unwrap();
      setRemoveMemberId(null);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleInvite = async () => {
    try {
      if (!selectedInviteUserId) return;
      await addMember({
        projectId: projectId!,
        userId: selectedInviteUserId,
        role: inviteRole,
      }).unwrap();

      setInviteDialogOpen(false);
      setSelectedInviteUserId('');
      setInviteRole('member');
    } catch (error) {
      console.error('Failed to invite member:', error);
    }
  };

  if (isProjectLoading || isMembersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Project not found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-muted-foreground">
            Manage who has access to {project.name}
          </p>
        </div>
        {canManageMembers && (
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Search & Stats */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary" className="text-sm">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Members List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Access Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'No members found matching your search' : 'No members yet'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member: any) => {
                  const RoleIcon = roleIcons[member.role] || User;
                  const roleColor = roleColors[member.role] || 'bg-gray-100 text-gray-800';
                  const isOwner = member.role === 'owner';

                  return (
                    <TableRow key={member.id} className="group transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3 py-1">
                          <Avatar className="h-10 w-10 border border-black/5">
                            <AvatarImage src={normalizeAvatarUrl(member.user?.avatarUrl)} />
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                              {getInitials(member.user?.displayName || `${member.user?.firstName || ''} ${member.user?.lastName || ''}` || member.user?.email || 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <div className="font-semibold text-sm truncate flex items-center gap-2">
                              {member.user?.displayName || `${member.user?.firstName || ''} ${member.user?.lastName || ''}`}
                              {!member.user?.firstName && !member.user?.lastName && !member.user?.displayName && (
                                <span className="text-muted-foreground italic font-normal">Pending user details</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                              <span>{member.user?.email}</span>
                              {member.user?.designation && (
                                <>
                                  <span className="text-muted-foreground/30">•</span>
                                  <span className="font-medium text-primary/70 uppercase tracking-tighter text-[10px]">
                                    {member.user.designation}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isOwner ? (
                          <Badge className={cn("flex w-fit items-center gap-1 px-2 py-0.5", roleColor)}>
                            <RoleIcon className="h-3 w-3" />
                            <span className="capitalize">{roleLabels[member.role] ?? member.role}</span>
                          </Badge>
                        ) : (
                          <Select
                            value={member.role}
                            onValueChange={(value) => handleRoleChange(member.id, value)}
                            disabled={isUpdating || !canManageMembers}
                          >
                            <SelectTrigger
                              className="w-[120px] h-8 border-none shadow-none focus:ring-0 px-2 hover:bg-black/5 transition-colors font-semibold text-sm"
                              style={{ color: roleTextColors[member.role] ?? '#374151' }}
                            >
                              <div className="flex items-center gap-1.5">
                                <RoleIcon className="h-3.5 w-3.5 shrink-0" />
                                <span>{roleLabels[member.role] ?? member.role}</span>
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  <span>Admin</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="lead">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="h-4 w-4" />
                                  <span>Lead</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="member">
                                <div className="flex items-center gap-2">
                                  <Terminal className="h-4 w-4" />
                                  <span>Member</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="viewer">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  <span>Viewer</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {member.joinedAt
                          ? new Date(member.joinedAt).toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' })
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {!isOwner && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canManageMembers && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setRemoveMemberId(member.id)}
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Remove from Project
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Permissions hidden (code kept) */}

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isUserPopoverOpen}
                    className="w-full justify-between h-auto py-2 px-3 bg-background hover:bg-background border-input ring-offset-background transition-all duration-200"
                  >
                    {selectedInviteUser ? (
                      <div className="flex items-center gap-3 text-left">
                        <Avatar className="h-8 w-8 border border-primary/10">
                          <AvatarImage src={normalizeAvatarUrl(selectedInviteUser.avatarUrl)} />
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                            {getInitials(selectedInviteUser.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold truncate leading-none mb-1">
                            {selectedInviteUser.displayName}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate uppercase tracking-wider font-medium">
                            {selectedInviteUser.designation || 'Team Member'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select a user to invite...</span>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="flex flex-col">
                    <div className="flex items-center border-b px-3 py-2">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <input
                        className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Search users..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1 custom-scrollbar">
                      {availableUsers.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No available users found.
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {availableUsers.map((user: any) => (
                            <motion.div
                              key={user.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className={cn(
                                "relative flex w-full cursor-default select-none items-center rounded-sm py-2.5 px-3 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 group",
                                selectedInviteUserId === user.id && "bg-accent/50"
                              )}
                              onClick={() => {
                                setSelectedInviteUserId(user.id);
                                setIsUserPopoverOpen(false);
                                setUserSearchQuery('');
                              }}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Avatar className="h-9 w-9 border border-black/5 group-hover:border-primary/20 transition-colors">
                                  <AvatarImage src={normalizeAvatarUrl(user.avatarUrl)} />
                                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                    {getInitials(user.displayName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold truncate leading-none mb-1">
                                    {user.displayName}
                                  </span>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-[11px] text-muted-foreground truncate">
                                      {user.designation || 'Team Member'}
                                    </span>
                                    {(user.designation || user.department) && (
                                      <span className="text-[10px] text-muted-foreground/30">•</span>
                                    )}
                                    <span className="text-[11px] text-primary/70 font-medium truncate uppercase tracking-tighter">
                                      {user.department || 'General'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {selectedInviteUserId === user.id && (
                                <Check className="h-4 w-4 text-primary ml-2 shrink-0" />
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!selectedInviteUserId || isAdding}>
              {isAdding ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog open={!!removeMemberId} onOpenChange={() => setRemoveMemberId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member from the project?
              They will lose access to all project content.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMemberId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={isRemoving}>
              {isRemoving ? 'Removing...' : 'Remove Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectMembersPage;
