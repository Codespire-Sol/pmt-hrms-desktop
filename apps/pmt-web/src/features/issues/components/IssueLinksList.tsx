import { useEffect, useMemo, useState } from 'react';
import { useIssueModal } from '../IssueDetailModal';
import {
  ArrowRight,
  ArrowLeft,
  Link2,
  Copy,
  GitBranch,
  Plus,
  Trash2,
  Search,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGetIssueLinksQuery,
  useCreateIssueLinkMutation,
  useDeleteIssueLinkMutation,
  useLazySearchIssuesForLinkQuery,
  useGetLinkTypesQuery,
  type IssueLink,
  type IssueLinkType,
  type Issue,
} from '../issuesApi';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

interface IssueLinksListProps {
  issueId: string;
  projectId: string;
  initialLinks?: IssueLink[];
}

const linkTypeLabels: Record<string, { label: string; icon: typeof ArrowRight; description: string }> = {
  blocks: { label: 'Blocks', icon: ArrowRight, description: 'This issue blocks another issue' },
  is_blocked_by: { label: 'Blocked by', icon: ArrowLeft, description: 'This issue is blocked by another issue' },
  relates_to: { label: 'Relates to', icon: Link2, description: 'This issue is related to another issue' },
  duplicates: { label: 'Duplicates', icon: Copy, description: 'This issue duplicates another issue' },
  is_duplicated_by: { label: 'Duplicated by', icon: Copy, description: 'This issue is duplicated by another issue' },
  causes: { label: 'Causes', icon: GitBranch, description: 'This issue causes another issue' },
  is_caused_by: { label: 'Caused by', icon: GitBranch, description: 'This issue is caused by another issue' },
  clones: { label: 'Clones', icon: Copy, description: 'This issue clones another issue' },
  is_cloned_by: { label: 'Cloned by', icon: Copy, description: 'This issue is cloned by another issue' },
};

const statusColors: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  'in-review': 'bg-yellow-100 text-yellow-800',
  done: 'bg-green-100 text-green-800',
};

export function IssueLinksList({ issueId, projectId, initialLinks }: IssueLinksListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { hasPermission: canUpdateIssue } = usePermissionGuard(
    ['issues.update', 'issues.update_own'],
    'any'
  );
  const { hasPermission: canViewIssues } = usePermissionGuard(
    ['issues.read', 'issues.create', 'issues.update', 'issues.update_own', 'issues.delete', 'issues.assign'],
    'any'
  );

  // Use embedded links from the issue response if provided, otherwise fetch separately
  const { data: fetchedLinks = [], isLoading: isFetchLoading, error } = useGetIssueLinksQuery(issueId, { skip: !!initialLinks });
  const links = initialLinks ?? fetchedLinks;
  const isLoading = !initialLinks && isFetchLoading;
  const { data: linkTypes = [] } = useGetLinkTypesQuery();
  const [deleteLink] = useDeleteIssueLinkMutation();

  const handleDeleteLink = async (linkId: string) => {
    try {
      await deleteLink({ issueId, linkId }).unwrap();
      toast.success('Link removed successfully');
    } catch {
      toast.error('Failed to remove link');
    }
  };

  // Group links by type
  const groupedLinks = links.reduce((acc, link) => {
    const type = (link.linkType?.name || link.linkDescription || 'relates_to') as IssueLinkType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(link);
    return acc;
  }, {} as Record<IssueLinkType, IssueLink[]>);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground">
        Failed to load issue links
      </div>
    );
  }

  if (!canViewIssues) {
    return (
      <div className="text-sm text-muted-foreground">
        You don't have permission to view linked issues.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Linked Issues</h3>
        {canUpdateIssue && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Link Issue
              </Button>
            </DialogTrigger>
            <AddLinkDialog
              issueId={issueId}
              projectId={projectId}
              linkTypes={linkTypes}
              onClose={() => setIsAddDialogOpen(false)}
            />
          </Dialog>
        )}
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No linked issues. Click "Link Issue" to add a relationship.
        </p>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedLinks).map(([type, typeLinks]) => {
            const linkInfo = linkTypeLabels[type as IssueLinkType];
            const LinkIcon = linkInfo?.icon || Link2;

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LinkIcon className="h-4 w-4" />
                  <span>{linkInfo?.label || type}</span>
                </div>
                <div className="space-y-1 pl-6">
                  {typeLinks.map((link) => (
                    <LinkedIssueItem
                      key={link.id}
                      link={link}
                      projectId={projectId}
                      onDelete={() => handleDeleteLink(link.id)}
                      canDelete={canUpdateIssue}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface LinkedIssueItemProps {
  link: IssueLink;
  projectId: string;
  onDelete: () => void;
  canDelete: boolean;
}

function LinkedIssueItem({ link, projectId, onDelete, canDelete }: LinkedIssueItemProps) {
  const { openIssue } = useIssueModal();
  const statusColor = statusColors[link.linkedIssue.status?.name?.toLowerCase()] || 'bg-gray-100 text-gray-800';

  return (
    <div className="flex items-center justify-between group py-1 px-2 rounded-md hover:bg-muted/50">
      <div
        onClick={() => openIssue(link.linkedIssue.id, projectId)}
        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
      >
        <span className="font-mono text-xs text-muted-foreground">
          {link.linkedIssue.issueKey}
        </span>
        <span className="text-sm truncate">{link.linkedIssue.title}</span>
        <Badge className={cn('text-xs', statusColor)}>
          {link.linkedIssue.status?.displayName || link.linkedIssue.status?.name}
        </Badge>
      </div>
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Link</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this link? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

interface AddLinkDialogProps {
  issueId: string;
  projectId: string;
  linkTypes: Array<{ id: string; name: string; outward: string; inward: string; description?: string | null }>;
  onClose: () => void;
}

function AddLinkDialog({ issueId, projectId, linkTypes, onClose }: AddLinkDialogProps) {
  const [linkType, setLinkType] = useState<IssueLinkType>('relates_to');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const [searchIssues, { data: searchResults = [], isFetching }] = useLazySearchIssuesForLinkQuery();
  const [createLink, { isLoading: isCreating }] = useCreateIssueLinkMutation();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      searchIssues({ projectId, query, excludeIssueId: issueId });
    }
  };

  const handleSelectIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setSearchQuery('');
  };

  const linkTypeOptions = useMemo(() => {
    const options: Array<{
      value: string;
      label: string;
      direction: 'outward' | 'inward';
      description?: string | null;
      baseName: string;
    }> = [];

    linkTypes.forEach((type) => {
      const outward = (type.outward || type.name).trim();
      const inward = (type.inward || type.name).trim();

      if (outward) {
        options.push({
          value: outward,
          label: outward,
          direction: 'outward',
          description: type.description,
          baseName: type.name,
        });
      }
      if (inward && inward !== outward) {
        options.push({
          value: inward,
          label: inward,
          direction: 'inward',
          description: type.description,
          baseName: type.name,
        });
      }
    });

    return options;
  }, [linkTypes]);

  useEffect(() => {
    if (linkTypeOptions.length === 0) return;
    if (!linkTypeOptions.some((option) => option.value === linkType)) {
      setLinkType(linkTypeOptions[0].value);
    }
  }, [linkTypeOptions, linkType]);

  const selectedLinkTypeOption = linkTypeOptions.find((option) => option.value === linkType);

  const handleSubmit = async () => {
    if (!selectedIssue) return;

    try {
      await createLink({
        issueId,
        data: {
          targetIssueId: selectedIssue.id,
          linkType,
        },
      }).unwrap();
      toast.success('Issue linked successfully');
      onClose();
    } catch {
      toast.error('Failed to link issue');
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Link Issue</DialogTitle>
        <DialogDescription>
          Create a relationship between this issue and another issue.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Link Type</label>
          <Select value={linkType} onValueChange={(v) => setLinkType(v as IssueLinkType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {linkTypeOptions.length > 0
                ? linkTypeOptions.map((option) => {
                    const Icon = option.direction === 'inward' ? ArrowLeft : ArrowRight;
                    return (
                      <SelectItem key={`${option.value}-${option.direction}`} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })
                : Object.entries(linkTypeLabels).map(([type, info]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <info.icon className="h-4 w-4" />
                        <span>{info.label}</span>
                      </div>
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {selectedLinkTypeOption?.description || linkTypeLabels[linkType]?.description}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Search Issue</label>
          {selectedIssue ? (
            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
              <span className="font-mono text-xs">{selectedIssue.issueKey}</span>
              <span className="text-sm flex-1 truncate">{selectedIssue.title}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setSelectedIssue(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by key or title..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
              {isFetching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
              )}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length > 0 && !selectedIssue && (
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {searchResults.map((issue) => (
                <button
                  key={issue.id}
                  className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-left"
                  onClick={() => handleSelectIssue(issue)}
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {issue.issueKey}
                  </span>
                  <span className="text-sm truncate">{issue.title}</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && !isFetching && (
            <p className="text-sm text-muted-foreground">No issues found</p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!selectedIssue || isCreating}>
          {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Link Issue
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default IssueLinksList;
