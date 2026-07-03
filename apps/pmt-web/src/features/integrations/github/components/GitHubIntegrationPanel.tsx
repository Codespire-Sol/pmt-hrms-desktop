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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Github,
  Check,
  X,
  ExternalLink,
  Settings,
  GitBranch,
  Link2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  User,
} from 'lucide-react';
import {
  useGetConnectionQuery,
  useConnectGitHubMutation,
  useDisconnectGitHubMutation,
  useGetRepositoryStatusQuery,
  useLazyListRepositoriesQuery,
  useLinkRepositoryMutation,
  useUnlinkRepositoryMutation,
  useUpdateRepositoryMutation,
} from '../githubApi';
import { AvailableRepository } from '../types';

interface GitHubIntegrationPanelProps {
  projectId: string;
  statuses?: Array<{ id: string; name: string }>;
}

export function GitHubIntegrationPanel({ projectId, statuses = [] }: GitHubIntegrationPanelProps) {
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<AvailableRepository | null>(null);

  // Account connection queries
  const { data: connection, isLoading: isLoadingConnection } = useGetConnectionQuery();
  const [connectGitHub, { isLoading: isConnecting }] = useConnectGitHubMutation();
  const [disconnectGitHub, { isLoading: isDisconnecting }] = useDisconnectGitHubMutation();

  // Repository queries
  const { data: repoStatus, isLoading: isLoadingRepo } = useGetRepositoryStatusQuery(projectId);
  const [listRepos, { data: availableRepos, isLoading: isLoadingRepos }] =
    useLazyListRepositoriesQuery();
  const [linkRepository, { isLoading: isLinking }] = useLinkRepositoryMutation();
  const [unlinkRepository, { isLoading: isUnlinking }] = useUnlinkRepositoryMutation();
  const [updateRepository, { isLoading: isUpdating }] = useUpdateRepositoryMutation();

  const isConnected = connection?.connected;
  const isRepoLinked = repoStatus?.connected && repoStatus.repository;

  const handleConnect = async () => {
    if (!accessToken.trim()) return;
    try {
      await connectGitHub({ accessToken: accessToken.trim() }).unwrap();
      setAccessToken('');
    } catch (err) {
      console.error('Failed to connect GitHub:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGitHub().unwrap();
      setShowDisconnectDialog(false);
    } catch (err) {
      console.error('Failed to disconnect GitHub:', err);
    }
  };

  const handleLoadRepos = () => {
    listRepos();
  };

  const handleLinkRepository = async () => {
    if (!selectedRepo) return;
    try {
      const [owner, name] = selectedRepo.fullName.split('/');
      await linkRepository({
        projectId,
        data: { owner, name, autoTransitionOnMerge: true },
      }).unwrap();
      setSelectedRepo(null);
    } catch (err) {
      console.error('Failed to link repository:', err);
    }
  };

  const handleUnlink = async () => {
    try {
      await unlinkRepository(projectId).unwrap();
      setShowUnlinkDialog(false);
    } catch (err) {
      console.error('Failed to unlink repository:', err);
    }
  };

  const handleToggleAutoTransition = async (enabled: boolean) => {
    if (!repoStatus?.repository) return;
    try {
      await updateRepository({
        repositoryId: repoStatus.repository.id,
        data: { autoTransitionOnMerge: enabled },
      }).unwrap();
    } catch (err) {
      console.error('Failed to update repository:', err);
    }
  };

  const handleUpdateTransitionStatus = async (statusId: string | null) => {
    if (!repoStatus?.repository) return;
    try {
      await updateRepository({
        repositoryId: repoStatus.repository.id,
        data: { transitionStatusId: statusId },
      }).unwrap();
    } catch (err) {
      console.error('Failed to update transition status:', err);
    }
  };

  if (isLoadingConnection || isLoadingRepo) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Github className="h-6 w-6" />
              <CardTitle>GitHub Integration</CardTitle>
            </div>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Not Connected
                </>
              )}
            </Badge>
          </div>
          <CardDescription>
            Connect your GitHub account to track commits, branches, and pull requests on issues.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ── Step 1: Account Connection ──────────────────────────── */}
          {!isConnected ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <Github className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">Connect Your GitHub Account</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                  Enter a GitHub Personal Access Token (PAT) with <code>repo</code> and{' '}
                  <code>admin:repo_hook</code> scopes.
                </p>
              </div>

              <div className="space-y-3 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="github-pat">Personal Access Token</Label>
                  <div className="relative">
                    <Input
                      id="github-pat"
                      type={showToken ? 'text' : 'password'}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,admin:repo_hook"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Generate a new token
                    </a>{' '}
                    with <code>repo</code> and <code>admin:repo_hook</code> scopes.
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleConnect}
                  disabled={!accessToken.trim() || isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect GitHub Account'}
                </Button>
              </div>

              {/* Features List */}
              <div className="border-t pt-4 mt-6">
                <h4 className="font-medium mb-3">Features</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Auto-link commits and PRs to issues
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Create branches directly from issues
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Smart commit actions (time logging, transitions)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Auto-transition issues when PRs merge
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    View code activity on issue details
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Connected Account Info */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {connection.avatarUrl ? (
                    <img
                      src={connection.avatarUrl}
                      alt={connection.githubUsername}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <User className="h-10 w-10 p-2 bg-muted rounded-full" />
                  )}
                  <div>
                    <div className="font-medium">@{connection.githubUsername}</div>
                    {connection.githubEmail && (
                      <div className="text-sm text-muted-foreground">{connection.githubEmail}</div>
                    )}
                    {connection.tokenScopes && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Scopes: {connection.tokenScopes}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisconnectDialog(true)}
                >
                  Disconnect
                </Button>
              </div>

              {/* ── Step 2: Repository Linking ──────────────────────────── */}
              {isRepoLinked ? (
                <div className="space-y-6">
                  {/* Linked Repository Info */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Github className="h-8 w-8" />
                      <div>
                        <div className="font-medium">{repoStatus.repository!.fullName}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <GitBranch className="h-3 w-3" />
                          Default: {repoStatus.repository!.defaultBranch}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://github.com/${repoStatus.repository!.fullName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View on GitHub
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowUnlinkDialog(true)}
                      >
                        Unlink
                      </Button>
                    </div>
                  </div>

                  {/* Integration Settings */}
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Integration Settings
                    </h4>

                    <div className="space-y-4 pl-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Auto-transition on merge</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically move issues when PRs are merged
                          </p>
                        </div>
                        <Switch
                          checked={repoStatus.repository!.autoTransitionOnMerge}
                          onCheckedChange={handleToggleAutoTransition}
                          disabled={isUpdating}
                        />
                      </div>

                      {repoStatus.repository!.autoTransitionOnMerge && statuses.length > 0 && (
                        <div className="space-y-2">
                          <Label>Transition to status</Label>
                          <Select
                            defaultValue="done"
                            onValueChange={(value) =>
                              handleUpdateTransitionStatus(value === 'done' ? null : value)
                            }
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="done">Done (default)</SelectItem>
                              {statuses.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Smart Commits Info */}
                  <Alert>
                    <Link2 className="h-4 w-4" />
                    <AlertTitle>Smart Commits</AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">
                        Reference issue keys in commits and PRs to automatically link them:
                      </p>
                      <ul className="text-sm space-y-1 font-mono">
                        <li>
                          <code>PROJ-123: Fix login bug</code> - Links commit to issue
                        </li>
                        <li>
                          <code>PROJ-123 #time 2h</code> - Log 2 hours of work
                        </li>
                        <li>
                          <code>PROJ-123 #done</code> - Transition to done
                        </li>
                        <li>
                          <code>PROJ-123 #comment Fixed it</code> - Add comment
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                /* Repository Selection */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Link a Repository</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadRepos}
                      disabled={isLoadingRepos}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingRepos ? 'animate-spin' : ''}`} />
                      {availableRepos ? 'Refresh' : 'Load Repositories'}
                    </Button>
                  </div>

                  {isLoadingRepos ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : availableRepos && availableRepos.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {availableRepos.map((repo) => (
                        <div
                          key={repo.id}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedRepo?.id === repo.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedRepo(repo)}
                        >
                          <div className="flex items-center gap-3">
                            <Github className="h-5 w-5" />
                            <div>
                              <div className="font-medium">{repo.fullName}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <GitBranch className="h-3 w-3" />
                                {repo.defaultBranch}
                                {repo.isPrivate && (
                                  <Badge variant="outline" className="text-xs">
                                    Private
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {selectedRepo?.id === repo.id && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : availableRepos ? (
                    <div className="text-center py-6 text-muted-foreground">
                      No repositories available
                    </div>
                  ) : null}

                  {selectedRepo && (
                    <Button
                      className="w-full"
                      onClick={handleLinkRepository}
                      disabled={isLinking}
                    >
                      {isLinking ? 'Linking...' : `Link ${selectedRepo.name}`}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Account Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Disconnect GitHub Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your GitHub connection. Existing commit and PR links will be
              preserved, but no new links will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink Repository Dialog */}
      <AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Unlink GitHub Repository?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to{' '}
              <span className="font-medium">{repoStatus?.repository?.fullName}</span>. Existing
              commit and PR links will be preserved, but no new links will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              disabled={isUnlinking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnlinking ? 'Unlinking...' : 'Unlink'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default GitHubIntegrationPanel;
