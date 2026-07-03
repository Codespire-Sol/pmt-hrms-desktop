import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Star, StarOff, Users, Lock, Globe, MoreHorizontal, Play, Pencil, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  useGetFiltersQuery,
  useDeleteFilterMutation,
  useUpdateFilterMutation,
  useSubscribeToFilterMutation,
  useUnsubscribeFromFilterMutation,
} from '../searchApi';
import { SavedFilter, FilterVisibility } from '../types';
import { FilterFormDialog } from './FilterFormDialog';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

export function SavedFiltersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { hasPermission: canViewIssues } = usePermissionGuard(
    ['issues.read', 'issues.create', 'issues.update', 'issues.update_own', 'issues.delete', 'issues.assign'],
    'any'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'subscribed' | 'favorites'>('all');
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(null);
  const [deletingFilter, setDeletingFilter] = useState<SavedFilter | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data, isLoading, error } = useGetFiltersQuery({
    search: searchQuery || undefined,
    ownedOnly: activeTab === 'mine',
    subscribedOnly: activeTab === 'subscribed',
    favoritesOnly: activeTab === 'favorites',
  });

  const [deleteFilter, { isLoading: isDeleting }] = useDeleteFilterMutation();
  const [updateFilter] = useUpdateFilterMutation();
  const [subscribeToFilter] = useSubscribeToFilterMutation();
  const [unsubscribeFromFilter] = useUnsubscribeFromFilterMutation();

  const handleExecuteFilter = (filter: SavedFilter) => {
    navigate(`/search?filterId=${filter.id}`);
  };

  const handleToggleFavorite = async (filter: SavedFilter) => {
    try {
      await updateFilter({
        filterId: filter.id,
        data: { isFavorite: !filter.isFavorite },
      }).unwrap();
      toast({
        title: filter.isFavorite ? 'Removed from favorites' : 'Added to favorites',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update favorite status',
        variant: 'destructive',
      });
    }
  };

  const handleToggleSubscription = async (filter: SavedFilter) => {
    try {
      if (filter.isSubscribed) {
        await unsubscribeFromFilter(filter.id).unwrap();
        toast({ title: 'Unsubscribed from filter' });
      } else {
        await subscribeToFilter(filter.id).unwrap();
        toast({ title: 'Subscribed to filter' });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update subscription',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteFilter = async () => {
    if (!deletingFilter) return;

    try {
      await deleteFilter(deletingFilter.id).unwrap();
      toast({ title: 'Filter deleted successfully' });
      setDeletingFilter(null);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete filter',
        variant: 'destructive',
      });
    }
  };

  const getVisibilityIcon = (visibility: FilterVisibility) => {
    switch (visibility) {
      case 'private':
        return <Lock className="h-3 w-3" />;
      case 'project':
        return <Users className="h-3 w-3" />;
      case 'global':
        return <Globe className="h-3 w-3" />;
    }
  };

  const getVisibilityLabel = (visibility: FilterVisibility) => {
    switch (visibility) {
      case 'private':
        return 'Private';
      case 'project':
        return 'Project';
      case 'global':
        return 'Global';
    }
  };

  if (!canViewIssues) {
    return (
      <div className="container mx-auto py-6">
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          You don't have permission to view saved filters.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Saved Filters</h1>
          <p className="text-muted-foreground">Create and manage JQL filters for quick issue searching</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Filter
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search filters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All Filters</TabsTrigger>
          <TabsTrigger value="mine">My Filters</TabsTrigger>
          <TabsTrigger value="subscribed">Subscribed</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Failed to load filters. Please try again.
              </CardContent>
            </Card>
          ) : data?.filters.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {activeTab === 'all' && 'No filters found. Create your first filter to get started.'}
                {activeTab === 'mine' && 'You haven\'t created any filters yet.'}
                {activeTab === 'subscribed' && 'You haven\'t subscribed to any filters yet.'}
                {activeTab === 'favorites' && 'No favorite filters yet.'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data?.filters.map((filter) => (
                <FilterCard
                  key={filter.id}
                  filter={filter}
                  onExecute={() => handleExecuteFilter(filter)}
                  onEdit={() => setEditingFilter(filter)}
                  onDelete={() => setDeletingFilter(filter)}
                  onToggleFavorite={() => handleToggleFavorite(filter)}
                  onToggleSubscription={() => handleToggleSubscription(filter)}
                  getVisibilityIcon={getVisibilityIcon}
                  getVisibilityLabel={getVisibilityLabel}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <FilterFormDialog
        open={showCreateDialog || !!editingFilter}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingFilter(null);
          }
        }}
        filter={editingFilter}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingFilter} onOpenChange={(open) => !open && setDeletingFilter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Filter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingFilter?.name}"? This action cannot be undone.
              {deletingFilter?.subscriberCount && deletingFilter.subscriberCount > 0 && (
                <span className="block mt-2 text-amber-500">
                  Warning: {deletingFilter.subscriberCount} user(s) are subscribed to this filter.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFilter}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface FilterCardProps {
  filter: SavedFilter;
  onExecute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onToggleSubscription: () => void;
  getVisibilityIcon: (visibility: FilterVisibility) => React.ReactNode;
  getVisibilityLabel: (visibility: FilterVisibility) => string;
}

function FilterCard({
  filter,
  onExecute,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleSubscription,
  getVisibilityIcon,
  getVisibilityLabel,
}: FilterCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate flex items-center gap-2">
              {filter.name}
              {filter.isFavorite && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {filter.description || 'No description'}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExecute}>
                <Play className="h-4 w-4 mr-2" />
                Run Filter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleFavorite}>
                {filter.isFavorite ? (
                  <>
                    <StarOff className="h-4 w-4 mr-2" />
                    Remove from Favorites
                  </>
                ) : (
                  <>
                    <Star className="h-4 w-4 mr-2" />
                    Add to Favorites
                  </>
                )}
              </DropdownMenuItem>
              {filter.visibility !== 'private' && (
                <DropdownMenuItem onClick={onToggleSubscription}>
                  {filter.isSubscribed ? (
                    <>
                      <UserMinus className="h-4 w-4 mr-2" />
                      Unsubscribe
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Subscribe
                    </>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/50 rounded-md p-2 mb-3">
          <code className="text-xs font-mono text-muted-foreground line-clamp-2">
            {filter.jql}
          </code>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={filter.owner.avatarUrl} />
              <AvatarFallback className="text-[10px]">
                {filter.owner.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span>{filter.owner.displayName}</span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1">
              {getVisibilityIcon(filter.visibility)}
              {getVisibilityLabel(filter.visibility)}
            </Badge>
            {filter.subscriberCount != null && filter.subscriberCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {filter.subscriberCount}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            Used {filter.usageCount} times
            {filter.lastUsedAt && ` • Last used ${formatDistanceToNow(new Date(filter.lastUsedAt))} ago`}
          </span>
          <Button size="sm" variant="secondary" onClick={onExecute}>
            <Play className="h-3 w-3 mr-1" />
            Run
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default SavedFiltersPage;
