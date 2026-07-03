import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitCommit,
  GitPullRequest,
  GitBranch,
  ExternalLink,
  Plus,
  FileCode,
  Clock,
  User,
  XCircle,
  GitMerge,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  useGetCodeActivityQuery,
  useSuggestBranchNameMutation,
  useCreateBranchMutation,
} from '../githubApi';
import {
  IssueCommit,
  IssuePullRequest,
  IssueBranch,
  CodeActivitySummary,
} from '../types';

interface CodeActivityProps {
  issueId: string;
  issueKey: string;
  issueTitle: string;
  issueType: string;
  projectId: string;
  repositoryId?: string;
}

export function CodeActivity({
  issueId,
  issueKey,
  issueTitle,
  issueType,
  projectId,
  repositoryId,
}: CodeActivityProps) {
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [branchName, setBranchName] = useState('');

  const { data: activity, isLoading, error } = useGetCodeActivityQuery(issueId);
  const [suggestBranchName, { isLoading: isSuggesting }] = useSuggestBranchNameMutation();
  const [createBranch, { isLoading: isCreating }] = useCreateBranchMutation();

  const handleOpenCreateBranch = async () => {
    try {
      const suggestion = await suggestBranchName({
        projectId,
        data: { issueKey, issueTitle, issueType },
      }).unwrap();
      setBranchName(suggestion.suggestedName);
      setShowCreateBranch(true);
    } catch {
      setBranchName(`feature/${issueKey.toLowerCase()}`);
      setShowCreateBranch(true);
    }
  };

  const handleCreateBranch = async () => {
    if (!repositoryId || !branchName) return;

    try {
      await createBranch({
        repositoryId,
        data: { issueId, branchName },
      }).unwrap();
      setShowCreateBranch(false);
      setBranchName('');
    } catch (err) {
      console.error('Failed to create branch:', err);
    }
  };

  const getSummary = (): CodeActivitySummary => {
    if (!activity) {
      return {
        totalCommits: 0,
        totalPullRequests: 0,
        totalBranches: 0,
        lastActivity: null,
        openPRCount: 0,
        mergedPRCount: 0,
        linesAdded: 0,
        linesDeleted: 0,
      };
    }

    const openPRs = activity.pullRequests.filter((pr) => pr.state === 'open');
    const mergedPRs = activity.pullRequests.filter((pr) => pr.merged);
    const totalAdditions = activity.pullRequests.reduce((sum, pr) => sum + pr.additions, 0);
    const totalDeletions = activity.pullRequests.reduce((sum, pr) => sum + pr.deletions, 0);

    const dates = [
      ...activity.commits.map((c) => new Date(c.committedAt)),
      ...activity.pullRequests.map((pr) => new Date(pr.updatedAt)),
      ...activity.branches.map((b) => new Date(b.createdAt)),
    ];

    const lastActivity = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

    return {
      totalCommits: activity.commits.length,
      totalPullRequests: activity.pullRequests.length,
      totalBranches: activity.branches.length,
      lastActivity: lastActivity?.toISOString() || null,
      openPRCount: openPRs.length,
      mergedPRCount: mergedPRs.length,
      linesAdded: totalAdditions,
      linesDeleted: totalDeletions,
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load code activity
        </CardContent>
      </Card>
    );
  }

  const summary = getSummary();
  const hasActivity =
    summary.totalCommits > 0 || summary.totalPullRequests > 0 || summary.totalBranches > 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Code Activity
            </CardTitle>
            <CardDescription>
              {hasActivity
                ? `${summary.totalCommits} commits, ${summary.totalPullRequests} PRs, ${summary.totalBranches} branches`
                : 'No code activity yet'}
            </CardDescription>
          </div>
          {repositoryId && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenCreateBranch}
              disabled={isSuggesting}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Branch
            </Button>
          )}
        </CardHeader>

        {hasActivity && (
          <CardContent>
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{summary.totalCommits}</div>
                <div className="text-xs text-muted-foreground">Commits</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">+{summary.linesAdded}</div>
                <div className="text-xs text-muted-foreground">Lines Added</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">-{summary.linesDeleted}</div>
                <div className="text-xs text-muted-foreground">Lines Deleted</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{summary.mergedPRCount}</div>
                <div className="text-xs text-muted-foreground">PRs Merged</div>
              </div>
            </div>

            {/* Activity Tabs */}
            <Tabs defaultValue="commits" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="commits" className="flex items-center gap-1">
                  <GitCommit className="h-4 w-4" />
                  Commits ({activity?.commits.length || 0})
                </TabsTrigger>
                <TabsTrigger value="pull-requests" className="flex items-center gap-1">
                  <GitPullRequest className="h-4 w-4" />
                  PRs ({activity?.pullRequests.length || 0})
                </TabsTrigger>
                <TabsTrigger value="branches" className="flex items-center gap-1">
                  <GitBranch className="h-4 w-4" />
                  Branches ({activity?.branches.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="commits" className="mt-4">
                <CommitList commits={activity?.commits || []} />
              </TabsContent>

              <TabsContent value="pull-requests" className="mt-4">
                <PullRequestList pullRequests={activity?.pullRequests || []} />
              </TabsContent>

              <TabsContent value="branches" className="mt-4">
                <BranchList branches={activity?.branches || []} />
              </TabsContent>
            </Tabs>
          </CardContent>
        )}

        {!hasActivity && (
          <CardContent className="text-center py-8 text-muted-foreground">
            <FileCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No commits, pull requests, or branches linked to this issue yet.</p>
            {repositoryId && (
              <p className="text-sm mt-2">
                Create a branch or reference <span className="font-mono">{issueKey}</span> in your
                commits to link them.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Create Branch Dialog */}
      <Dialog open={showCreateBranch} onOpenChange={setShowCreateBranch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
            <DialogDescription>
              Create a new branch for this issue. The branch will be linked automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="feature/proj-123-add-login"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateBranch(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBranch} disabled={!branchName || isCreating}>
              {isCreating ? 'Creating...' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Commit List Component
function CommitList({ commits }: { commits: IssueCommit[] }) {
  if (commits.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No commits linked to this issue
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {commits.map((commit) => (
        <div
          key={commit.id}
          className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={commit.authorAvatarUrl || undefined} />
            <AvatarFallback>{commit.author.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                {commit.sha.substring(0, 7)}
              </span>
              <a
                href={commit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-sm mt-1 truncate">{commit.message.split('\n')[0]}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {commit.author}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(commit.committedAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Pull Request List Component
function PullRequestList({ pullRequests }: { pullRequests: IssuePullRequest[] }) {
  if (pullRequests.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No pull requests linked to this issue
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pullRequests.map((pr) => (
        <div
          key={pr.id}
          className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="mt-1">
            {pr.merged ? (
              <GitMerge className="h-5 w-5 text-purple-500" />
            ) : pr.state === 'open' ? (
              <GitPullRequest className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-primary truncate"
              >
                {pr.title}
              </a>
              <Badge
                variant={pr.merged ? 'default' : pr.state === 'open' ? 'secondary' : 'destructive'}
              >
                {pr.merged ? 'Merged' : pr.state}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>#{pr.prNumber}</span>
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {pr.author}
              </span>
              <span className="text-green-600">+{pr.additions}</span>
              <span className="text-red-600">-{pr.deletions}</span>
              <span>{pr.changedFiles} files</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {pr.headBranch} → {pr.baseBranch}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Branch List Component
function BranchList({ branches }: { branches: IssueBranch[] }) {
  if (branches.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No branches linked to this issue
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {branches.map((branch) => (
        <div
          key={branch.id}
          className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <GitBranch className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{branch.branchName}</span>
              <a
                href={branch.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Created {formatDistanceToNow(new Date(branch.createdAt), { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default CodeActivity;
