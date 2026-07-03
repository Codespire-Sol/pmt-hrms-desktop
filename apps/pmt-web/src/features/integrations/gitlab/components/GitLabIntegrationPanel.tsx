import { useState } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Check, X, ExternalLink, GitBranch, Link2, AlertTriangle, RefreshCw,
  Eye, EyeOff, Loader2,
} from 'lucide-react';
import {
  useGetConnectionQuery,
  useConnectGitLabMutation,
  useDisconnectGitLabMutation,
  useLazyListRepositoriesQuery,
  useGetRepositoryStatusQuery,
  useLinkRepositoryMutation,
  useUnlinkRepositoryMutation,
  AvailableGitLabProject,
} from '../gitlabApi';
import { toast } from '@/hooks/useToast';

// Inline GitLab logo SVG (no external dependency needed)
function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.49a.42.42 0 0 1 .11-.18.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
    </svg>
  );
}

interface GitLabIntegrationPanelProps {
  projectId: string;
}

export function GitLabIntegrationPanel({ projectId }: GitLabIntegrationPanelProps) {
  const [pat, setPat] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [showDisconnectAccountDialog, setShowDisconnectAccountDialog] = useState(false);
  const [showUnlinkRepoDialog, setShowUnlinkRepoDialog] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<AvailableGitLabProject | null>(null);
  const [connectError, setConnectError] = useState('');

  const { data: connection, isLoading: isLoadingConnection } = useGetConnectionQuery();
  const { data: repoStatus, isLoading: isLoadingRepo } = useGetRepositoryStatusQuery(projectId);

  const [connectGitLab, { isLoading: isConnecting }] = useConnectGitLabMutation();
  const [disconnectGitLab, { isLoading: isDisconnecting }] = useDisconnectGitLabMutation();
  const [listRepositories, { data: repos, isLoading: isLoadingRepos }] = useLazyListRepositoriesQuery();
  const [linkRepository, { isLoading: isLinking }] = useLinkRepositoryMutation();
  const [unlinkRepository, { isLoading: isUnlinking }] = useUnlinkRepositoryMutation();

  const isAccountConnected = connection?.connected;

  const handleConnect = async () => {
    if (!pat.trim()) return;
    setConnectError('');
    try {
      await connectGitLab({ accessToken: pat.trim() }).unwrap();
      setPat('');
      toast.success('GitLab account connected successfully');
    } catch (err: any) {
      const msg = err?.data?.error?.message || 'Invalid Personal Access Token. Make sure it has the "api" scope.';
      setConnectError(msg);
    }
  };

  const handleDisconnectAccount = async () => {
    try {
      await disconnectGitLab().unwrap();
      setShowDisconnectAccountDialog(false);
      toast.success('GitLab account disconnected');
    } catch {
      toast.error('Failed to disconnect GitLab account');
    }
  };

  const handleLoadRepos = () => {
    listRepositories(undefined);
    setSelectedRepo(null);
  };

  const handleLinkRepo = async () => {
    if (!selectedRepo) return;
    try {
      await linkRepository({ projectId, gitlabProjectId: selectedRepo.id }).unwrap();
      setSelectedRepo(null);
      toast.success(`Repository "${selectedRepo.name}" linked successfully`);
    } catch (err: any) {
      const msg = err?.data?.error?.message || 'Failed to link repository';
      toast.error(msg);
    }
  };

  const handleUnlinkRepo = async () => {
    try {
      await unlinkRepository(projectId).unwrap();
      setShowUnlinkRepoDialog(false);
      toast.success('Repository unlinked');
    } catch {
      toast.error('Failed to unlink repository');
    }
  };

  if (isLoadingConnection || isLoadingRepo) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="h-4 w-56 mt-1" />
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
              <GitLabIcon className="h-6 w-6 text-[#FC6D26]" />
              <CardTitle>GitLab Integration</CardTitle>
            </div>
            <Badge variant={repoStatus?.connected ? 'default' : 'secondary'}>
              {repoStatus?.connected ? (
                <><Check className="h-3 w-3 mr-1" />Connected</>
              ) : (
                <><X className="h-3 w-3 mr-1" />Not Connected</>
              )}
            </Badge>
          </div>
          <CardDescription>
            Link GitLab repositories to track commits, branches, and merge requests on issues.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">

          {/* ── Step 1: Account connection ───────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Step 1 — GitLab Account</h4>

            {isAccountConnected && connection?.connection ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-3">
                  <GitLabIcon className="h-8 w-8 text-[#FC6D26]" />
                  <div>
                    <div className="font-medium">@{connection.connection.gitlabUsername}</div>
                    <div className="text-xs text-muted-foreground">{connection.connection.gitlabEmail}</div>
                    {connection.connection.tokenScopes && (
                      <div className="text-xs text-muted-foreground">
                        Scopes: {connection.connection.tokenScopes}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisconnectAccountDialog(true)}
                >
                  Disconnect Account
                </Button>
              </div>
            ) : (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  Enter a GitLab{' '}
                  <a
                    href="https://gitlab.com/-/user_settings/personal_access_tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-600 inline-flex items-center gap-0.5"
                  >
                    Personal Access Token
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {' '}with the <code className="text-xs bg-muted px-1 rounded">api</code> scope.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPat ? 'text' : 'password'}
                      placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                      value={pat}
                      onChange={(e) => { setPat(e.target.value); setConnectError(''); }}
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPat((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={isConnecting || !pat.trim()}
                  >
                    {isConnecting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Connecting…</> : 'Connect'}
                  </Button>
                </div>
                {connectError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {connectError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Step 2: Repository linking (only when account connected) ── */}
          {isAccountConnected && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Step 2 — Link Repository</h4>

              {repoStatus?.connected && repoStatus.repository ? (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-3">
                    <GitLabIcon className="h-8 w-8 text-[#FC6D26]" />
                    <div>
                      <div className="font-medium">{repoStatus.repository.fullPath}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <GitBranch className="h-3 w-3" />
                        Default: {repoStatus.repository.defaultBranch}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={repoStatus.repository.webUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View on GitLab
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUnlinkRepoDialog(true)}
                    >
                      Unlink
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Select a GitLab repository to link</Label>
                    <Button variant="ghost" size="sm" onClick={handleLoadRepos} disabled={isLoadingRepos}>
                      <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingRepos ? 'animate-spin' : ''}`} />
                      {repos ? 'Refresh' : 'Load Repositories'}
                    </Button>
                  </div>

                  {isLoadingRepos && (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  )}

                  {repos && repos.length === 0 && (
                    <p className="text-sm text-center text-muted-foreground py-4">
                      No repositories found. Make sure your token has the <code className="text-xs bg-muted px-1 rounded">api</code> scope.
                    </p>
                  )}

                  {repos && repos.length > 0 && (
                    <div className="space-y-1 max-h-64 overflow-y-auto rounded-lg border">
                      {repos.map((repo) => (
                        <div
                          key={repo.id}
                          onClick={() => setSelectedRepo(repo)}
                          className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors ${
                            selectedRepo?.id === repo.id
                              ? 'bg-primary/10 border-l-2 border-primary'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <GitLabIcon className="h-4 w-4 text-[#FC6D26] flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{repo.fullPath}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <GitBranch className="h-2.5 w-2.5" />
                                {repo.defaultBranch}
                              </div>
                            </div>
                          </div>
                          {selectedRepo?.id === repo.id && (
                            <Check className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedRepo && (
                    <Button
                      className="w-full"
                      onClick={handleLinkRepo}
                      disabled={isLinking}
                    >
                      {isLinking
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Linking…</>
                        : `Link "${selectedRepo.name}"`
                      }
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Smart Commits info (shown when repo linked) ────── */}
          {repoStatus?.connected && (
            <Alert>
              <Link2 className="h-4 w-4" />
              <AlertTitle>Smart Commits</AlertTitle>
              <AlertDescription>
                <p className="mb-2">Reference issue keys in commits and MRs to link them automatically:</p>
                <ul className="text-sm space-y-1 font-mono">
                  <li><code>PROJ-123: Fix login bug</code> — links commit to issue</li>
                  <li><code>PROJ-123 #time 2h</code> — log 2 hours of work</li>
                  <li><code>PROJ-123 #done</code> — transition to done</li>
                  <li><code>PROJ-123 #comment Fixed it</code> — add comment</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* ── Features list (shown when not connected) ──────── */}
          {!repoStatus?.connected && !isAccountConnected && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm">Features</h4>
              <ul className="space-y-2 text-sm">
                {[
                  'Auto-link commits and MRs to issues',
                  'Create branches directly from issues',
                  'Smart commit actions (time logging, transitions)',
                  'Auto-transition issues when MRs merge',
                  'View code activity on issue details',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect account dialog */}
      <AlertDialog open={showDisconnectAccountDialog} onOpenChange={setShowDisconnectAccountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Disconnect GitLab Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your GitLab Personal Access Token. Any linked repositories will also be unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnectAccount}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink repository dialog */}
      <AlertDialog open={showUnlinkRepoDialog} onOpenChange={setShowUnlinkRepoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Unlink GitLab Repository?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to{' '}
              <span className="font-medium">{repoStatus?.repository?.fullPath}</span>.
              Existing commit links will be preserved, but no new links will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlinkRepo}
              disabled={isUnlinking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnlinking ? 'Unlinking…' : 'Unlink'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default GitLabIntegrationPanel;
