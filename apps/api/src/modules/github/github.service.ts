import crypto from 'crypto';
import axios from 'axios';
import { format } from 'date-fns';
import { commentsService } from '../comments/comments.service';
import { TimeTrackingService } from '../time-tracking/time-tracking.service';
import {
  GitHubRepository,
  GitHubConnection,
  GitHubPushPayload,
  GitHubPullRequestPayload,
  LinkRepositoryInput,
  UpdateRepositoryInput,
  CreateBranchInput,
  CodeActivityResponse,
  RepositoryStatus,
  BranchSuggestion,
  AvailableRepository,
  ParsedCommitMessage,
  SmartCommitAction,
  ProjectCodeOverview,
} from './github.types';
import { githubRepository } from './github.repository';
import { prisma } from '../../database/prisma';

const GITHUB_API = 'https://api.github.com';
const APP_URL = process.env.APP_URL || 'http://localhost:4000';

class GitHubService {
  // ── Connection (PAT-based) ──────────────────────────────────────────────────

  async verifyAndConnect(userId: string, accessToken: string): Promise<{
    githubUsername: string;
    githubEmail: string | null;
    avatarUrl: string | null;
    tokenScopes: string | null;
    connectedAt: Date;
  }> {
    // Verify token by calling GitHub API
    const userResponse = await axios.get(`${GITHUB_API}/user`, {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const githubUser = userResponse.data;
    const tokenScopes = userResponse.headers['x-oauth-scopes'] || null;

    // Store in database
    const connection = await githubRepository.upsertConnection(userId, {
      githubUserId: githubUser.id,
      githubUsername: githubUser.login,
      githubEmail: githubUser.email || null,
      avatarUrl: githubUser.avatar_url || null,
      accessToken,
      tokenScopes,
    });

    return {
      githubUsername: githubUser.login,
      githubEmail: githubUser.email || null,
      avatarUrl: githubUser.avatar_url || null,
      tokenScopes,
      connectedAt: new Date(connection.connectedAt),
    };
  }

  async getConnection(userId: string): Promise<GitHubConnection | null> {
    return githubRepository.findConnectionByUserId(userId);
  }

  async disconnect(userId: string): Promise<boolean> {
    return githubRepository.deleteConnection(userId);
  }

  // ── Repository Listing & Linking ────────────────────────────────────────────

  async listRepositories(userId: string): Promise<AvailableRepository[]> {
    const connection = await githubRepository.findConnectionByUserId(userId);
    if (!connection) return [];

    try {
      const response = await axios.get(`${GITHUB_API}/user/repos`, {
        headers: {
          Authorization: `token ${connection.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: {
          per_page: 100,
          sort: 'updated',
          affiliation: 'owner,collaborator,organization_member',
        },
      });

      return response.data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch,
        url: repo.html_url,
      }));
    } catch {
      return [];
    }
  }

  async linkRepository(
    projectId: string,
    userId: string,
    input: LinkRepositoryInput
  ): Promise<GitHubRepository> {
    const connection = await githubRepository.findConnectionByUserId(userId);
    if (!connection) {
      throw new Error('GitHub account not connected. Please connect your GitHub account first.');
    }

    // Fetch repo info from GitHub
    const repoResponse = await axios.get(`${GITHUB_API}/repos/${input.owner}/${input.name}`, {
      headers: {
        Authorization: `token ${connection.accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const repoInfo = repoResponse.data;
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Create repo record in DB
    const repo = await githubRepository.createRepository({
      projectId,
      connectedById: userId,
      owner: input.owner,
      name: input.name,
      fullName: repoInfo.full_name,
      defaultBranch: repoInfo.default_branch,
      isPrivate: repoInfo.private,
      webUrl: repoInfo.html_url,
      webhookSecret,
      autoTransitionOnMerge: input.autoTransitionOnMerge ?? true,
    });

    // Try to register webhook on GitHub
    try {
      const hookResponse = await axios.post(
        `${GITHUB_API}/repos/${repoInfo.full_name}/hooks`,
        {
          name: 'web',
          active: true,
          events: ['push', 'pull_request', 'check_run', 'workflow_run'],
          config: {
            url: `${APP_URL}/api/v1/integrations/github/webhook`,
            content_type: 'json',
            secret: webhookSecret,
            insecure_ssl: '0',
          },
        },
        {
          headers: {
            Authorization: `token ${connection.accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      await githubRepository.updateRepository(repo.id, {
        webhookId: hookResponse.data.id,
      } as any);
    } catch (err: any) {
      console.warn('Failed to create GitHub webhook (may need admin:repo_hook scope):', err.message);
    }

    return repo;
  }

  async unlinkRepository(projectId: string, userId: string): Promise<boolean> {
    const repo = await githubRepository.findRepositoryByProjectId(projectId);
    if (!repo) return false;

    // Try to delete webhook from GitHub
    if (repo.webhookId) {
      const connection = await githubRepository.findConnectionByUserId(userId);
      if (connection) {
        try {
          await axios.delete(
            `${GITHUB_API}/repos/${repo.fullName}/hooks/${repo.webhookId}`,
            {
              headers: {
                Authorization: `token ${connection.accessToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            }
          );
        } catch {
          // Webhook may already be deleted
        }
      }
    }

    return githubRepository.deleteRepository(repo.id);
  }

  async getRepositoryStatus(projectId: string): Promise<RepositoryStatus> {
    const repo = await githubRepository.findRepositoryByProjectId(projectId);
    if (!repo) {
      return { connected: false, repository: null };
    }
    return {
      connected: true,
      repository: {
        id: repo.id,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        autoTransitionOnMerge: repo.autoTransitionOnMerge,
      },
    };
  }

  async updateRepository(repositoryId: string, input: UpdateRepositoryInput): Promise<GitHubRepository | null> {
    return githubRepository.updateRepository(repositoryId, input);
  }

  async disconnectRepository(repositoryId: string): Promise<boolean> {
    return githubRepository.deleteRepository(repositoryId);
  }

  // ── Webhook Handling ────────────────────────────────────────────────────────

  async handlePushWebhook(payload: GitHubPushPayload): Promise<void> {
    const repo = await githubRepository.findRepositoryByFullName(payload.repository.full_name);
    if (!repo) return;

    for (const commit of payload.commits) {
      const parsed = this.parseCommitMessage(commit.message);

      for (const issueKey of parsed.issueKeys) {
        const issueId = await this.findIssueIdByKey(issueKey, repo.projectId);
        if (!issueId) continue;

        const existing = await githubRepository.findCommitBySha(commit.id, repo.id);
        if (existing) continue;

        await githubRepository.createCommit({
          issueId,
          repositoryId: repo.id,
          sha: commit.id,
          message: commit.message,
          author: commit.author.name,
          authorEmail: commit.author.email,
          url: commit.url,
          committedAt: commit.timestamp,
        });

        for (const action of parsed.actions) {
          await this.handleSmartCommitAction(issueId, action, commit.author.email);
        }
      }
    }
  }

  async handlePullRequestWebhook(payload: GitHubPullRequestPayload): Promise<void> {
    const repo = await githubRepository.findRepositoryByFullName(payload.repository.full_name);
    if (!repo) return;

    const pr = payload.pull_request;
    const issueKeys = this.extractIssueKeys(pr.title + ' ' + (pr.body || ''));

    for (const issueKey of issueKeys) {
      const issueId = await this.findIssueIdByKey(issueKey, repo.projectId);
      if (!issueId) continue;

      const existing = await githubRepository.findPullRequestByNumber(pr.number, repo.id);

      if (existing) {
        await githubRepository.updatePullRequest(existing.id, {
          title: pr.title,
          state: pr.state,
          merged: pr.merged,
          mergedAt: pr.merged_at || undefined,
          mergedBy: pr.merged_by?.login,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changed_files,
        });
      } else {
        await githubRepository.createPullRequest({
          issueId,
          repositoryId: repo.id,
          prNumber: pr.number,
          title: pr.title,
          state: pr.state,
          url: pr.html_url,
          author: pr.user.login,
          authorAvatarUrl: pr.user.avatar_url,
          merged: pr.merged,
          mergedAt: pr.merged_at || undefined,
          mergedBy: pr.merged_by?.login,
          baseBranch: pr.base.ref,
          headBranch: pr.head.ref,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changed_files,
        });
      }

      if (payload.action === 'closed' && pr.merged && repo.autoTransitionOnMerge) {
        await this.transitionIssueOnMerge(issueId, repo.transitionStatusId);
      }
    }
  }

  // ── CI/CD Build Status ──────────────────────────────────────────────────────

  async handleCheckRunWebhook(payload: any): Promise<void> {
    const checkRun = payload.check_run;
    if (!checkRun) return;

    const repoFullName: string = payload.repository?.full_name;
    if (!repoFullName) return;

    const repo = await githubRepository.findRepositoryByFullName(repoFullName);
    if (!repo) return;

    const sha: string = checkRun.head_sha || checkRun.head_commit?.id;
    if (!sha) return;

    const linkedCommits = await prisma.githubCommit.findMany({
      where: { repositoryId: repo.id, sha },
      select: { issueId: true },
    });

    if (linkedCommits.length === 0) return;

    const status = this.mapCheckRunStatus(checkRun.status, checkRun.conclusion);
    const runData = {
      provider: 'github' as const,
      runId: String(checkRun.id),
      pipelineName: checkRun.name || checkRun.app?.name || 'GitHub Check',
      status,
      conclusion: checkRun.conclusion || null,
      url: checkRun.html_url || checkRun.details_url || '',
      commitSha: sha,
      branchRef: checkRun.check_suite?.head_branch || payload.repository?.default_branch || null,
      startedAt: checkRun.started_at ? new Date(checkRun.started_at) : null,
      completedAt: checkRun.completed_at ? new Date(checkRun.completed_at) : null,
    };

    await Promise.all(
      linkedCommits.map(({ issueId }) =>
        prisma.buildRun.upsert({
          where: { issueId_provider_runId: { issueId, provider: 'github', runId: runData.runId } },
          create: { issueId, ...runData },
          update: { status: runData.status, conclusion: runData.conclusion, completedAt: runData.completedAt },
        })
      )
    );
  }

  async handleWorkflowRunWebhook(payload: any): Promise<void> {
    const workflowRun = payload.workflow_run;
    if (!workflowRun) return;

    const repoFullName: string = payload.repository?.full_name;
    if (!repoFullName) return;

    const repo = await githubRepository.findRepositoryByFullName(repoFullName);
    if (!repo) return;

    const sha: string = workflowRun.head_sha || workflowRun.head_commit?.id;
    if (!sha) return;

    const linkedCommits = await prisma.githubCommit.findMany({
      where: { repositoryId: repo.id, sha },
      select: { issueId: true },
    });

    if (linkedCommits.length === 0) return;

    const status = this.mapWorkflowRunStatus(workflowRun.status, workflowRun.conclusion);
    const runData = {
      provider: 'github' as const,
      runId: String(workflowRun.id),
      pipelineName: workflowRun.name || workflowRun.workflow?.name || 'GitHub Actions',
      status,
      conclusion: workflowRun.conclusion || null,
      url: workflowRun.html_url || '',
      commitSha: sha,
      branchRef: workflowRun.head_branch || null,
      startedAt: workflowRun.run_started_at ? new Date(workflowRun.run_started_at) : null,
      completedAt: workflowRun.updated_at ? new Date(workflowRun.updated_at) : null,
    };

    await Promise.all(
      linkedCommits.map(({ issueId }) =>
        prisma.buildRun.upsert({
          where: { issueId_provider_runId: { issueId, provider: 'github', runId: runData.runId } },
          create: { issueId, ...runData },
          update: { status: runData.status, conclusion: runData.conclusion, completedAt: runData.completedAt },
        })
      )
    );
  }

  async getBuildRuns(issueId: string, limit = 20): Promise<any[]> {
    return prisma.buildRun.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── Issue Key Extraction / Smart Commits ────────────────────────────────────

  extractIssueKeys(text: string): string[] {
    const regex = /([A-Z]+-\d+)/g;
    return [...new Set(text.match(regex) || [])];
  }

  parseCommitMessage(message: string): ParsedCommitMessage {
    const issueKeys = this.extractIssueKeys(message);
    const actions: SmartCommitAction[] = [];

    const timeMatch = message.match(/#time\s+(\d+[hm])/i);
    if (timeMatch) {
      actions.push({ command: 'time', value: timeMatch[1] });
    }

    const commentMatch = message.match(/#comment\s+(.+?)(?=#|$)/i);
    if (commentMatch) {
      actions.push({ command: 'comment', value: commentMatch[1].trim() });
    }

    const transitionMatches = message.match(/#(done|todo|in-progress|review)/gi);
    if (transitionMatches) {
      for (const match of transitionMatches) {
        actions.push({ command: 'transition', value: match.slice(1).toLowerCase() });
      }
    }

    return { issueKeys, message, actions };
  }

  private async handleSmartCommitAction(issueId: string, action: SmartCommitAction, commitAuthorEmail?: string): Promise<void> {
    try {
      if (action.command === 'time') {
        const hoursMatch = action.value.match(/^(\d+)h$/i);
        const minsMatch = action.value.match(/^(\d+)m$/i);
        let hours = 0;
        if (hoursMatch) hours = parseInt(hoursMatch[1], 10);
        else if (minsMatch) hours = parseInt(minsMatch[1], 10) / 60;
        if (hours > 0) {
          let userId: string | null = null;
          if (commitAuthorEmail) {
            const user = await prisma.user.findFirst({ where: { email: commitAuthorEmail }, select: { id: true } });
            userId = user?.id || null;
          }
          if (!userId) {
            const systemUser = await prisma.user.findFirst({ where: { role: { name: 'admin' } }, select: { id: true } });
            userId = systemUser?.id || null;
          }
          if (userId) {
            const timeService = new TimeTrackingService();
            await timeService.logTime(issueId, {
              hours: Math.max(0.25, Math.round(hours * 4) / 4),
              description: 'Logged via smart commit',
              workDate: format(new Date(), 'yyyy-MM-dd'),
            }, userId);
          }
        }
      } else if (action.command === 'comment') {
        const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { projectId: true } });
        if (issue) {
          let authorId: string | null = null;
          if (commitAuthorEmail) {
            const user = await prisma.user.findFirst({ where: { email: commitAuthorEmail }, select: { id: true } });
            authorId = user?.id || null;
          }
          if (!authorId) {
            const systemUser = await prisma.user.findFirst({ where: { role: { name: 'admin' } }, select: { id: true } });
            authorId = systemUser?.id || null;
          }
          if (authorId) {
            await commentsService.createComment({ issueId, authorId, content: action.value });
          }
        }
      } else if (action.command === 'transition') {
        const categoryMap: Record<string, string> = {
          done: 'done',
          todo: 'todo',
          'in-progress': 'in_progress',
          review: 'in_progress',
        };
        const category = categoryMap[action.value.toLowerCase()];
        if (category) {
          const issue = await prisma.issue.findUnique({
            where: { id: issueId },
            select: { projectId: true, typeId: true },
          });
          if (issue) {
            const targetStatus = await prisma.status.findFirst({
              where: { workflow: { projectId: issue.projectId }, category: category as any },
              orderBy: { position: 'asc' },
              select: { id: true },
            });
            if (targetStatus) {
              await prisma.issue.update({
                where: { id: issueId },
                data: {
                  statusId: targetStatus.id,
                  ...(category === 'done' ? { resolutionDate: new Date() } : {}),
                },
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Smart commit action '${action.command}' failed for issue ${issueId}:`, err);
    }
  }

  private async findIssueIdByKey(issueKey: string, projectId: string): Promise<string | null> {
    const [projectKey, issueNumberRaw] = issueKey.split('-');
    const issueNumber = Number(issueNumberRaw);
    if (!projectKey || Number.isNaN(issueNumber)) return null;

    const issue = await prisma.issue.findFirst({
      where: { projectId, project: { key: projectKey }, issueNumber, deletedAt: null },
      select: { id: true },
    });
    return issue?.id || null;
  }

  private async transitionIssueOnMerge(issueId: string, statusId: string | null): Promise<void> {
    if (statusId) {
      await prisma.issue.update({
        where: { id: issueId },
        data: { statusId, resolutionDate: new Date() },
      });
      return;
    }

    const doneStatus = await prisma.status.findFirst({
      where: { category: 'done', issues: { some: { id: issueId } } },
      select: { id: true },
    });

    if (doneStatus) {
      await prisma.issue.update({
        where: { id: issueId },
        data: { statusId: doneStatus.id, resolutionDate: new Date() },
      });
    }
  }

  // ── Branch Operations ───────────────────────────────────────────────────────

  async suggestBranchName(
    issueKey: string,
    issueTitle: string,
    issueType: string,
    defaultBranch: string
  ): Promise<BranchSuggestion> {
    const type = issueType.toLowerCase().replace(/\s+/g, '-');
    const key = issueKey.toLowerCase();
    const title = issueTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    return {
      suggestedName: `${type}/${key}-${title}`,
      issueKey,
      issueType,
      baseBranch: defaultBranch,
    };
  }

  async createBranch(input: CreateBranchInput, userId: string): Promise<any> {
    const repo = await githubRepository.findRepositoryById(input.repositoryId);
    if (!repo) throw new Error('Repository not found');

    const connection = await githubRepository.findConnectionByUserId(userId);
    if (!connection) throw new Error('GitHub account not connected');

    const baseBranch = input.baseBranch || repo.defaultBranch;

    const baseRef = await axios.get(
      `${GITHUB_API}/repos/${repo.fullName}/git/ref/heads/${baseBranch}`,
      {
        headers: {
          Authorization: `token ${connection.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    await axios.post(
      `${GITHUB_API}/repos/${repo.fullName}/git/refs`,
      {
        ref: `refs/heads/${input.branchName}`,
        sha: baseRef.data.object.sha,
      },
      {
        headers: {
          Authorization: `token ${connection.accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const branchUrl = `https://github.com/${repo.fullName}/tree/${input.branchName}`;

    return githubRepository.createBranch({
      issueId: input.issueId,
      repositoryId: repo.id,
      branchName: input.branchName,
      url: branchUrl,
    });
  }

  // ── Code Activity ───────────────────────────────────────────────────────────

  async getCodeActivity(issueId: string): Promise<CodeActivityResponse> {
    const [commits, pullRequests, branches] = await Promise.all([
      githubRepository.findCommitsByIssueId(issueId),
      githubRepository.findPullRequestsByIssueId(issueId),
      githubRepository.findBranchesByIssueId(issueId),
    ]);
    return { commits, pullRequests, branches };
  }

  async getProjectCodeOverview(projectId: string, limit = 20): Promise<ProjectCodeOverview> {
    const status = await this.getRepositoryStatus(projectId);
    if (!status.connected || !status.repository) {
      return {
        connected: false, repository: null,
        totals: { commits: 0, pullRequests: 0, branches: 0 },
        commits: [], pullRequests: [], branches: [],
      };
    }

    const repo = await githubRepository.findRepositoryByProjectId(projectId);
    if (!repo) {
      return {
        connected: false, repository: null,
        totals: { commits: 0, pullRequests: 0, branches: 0 },
        commits: [], pullRequests: [], branches: [],
      };
    }

    const [commitCount, prCount, branchCount, commitsRaw, prsRaw, branchesRaw] = await Promise.all([
      prisma.githubCommit.count({ where: { repositoryId: repo.id } }),
      prisma.githubPullRequest.count({ where: { repositoryId: repo.id } }),
      prisma.githubBranch.count({ where: { repositoryId: repo.id } }),
      prisma.githubCommit.findMany({
        where: { repositoryId: repo.id }, orderBy: { committedAt: 'desc' }, take: limit,
        include: { issue: { select: { issueNumber: true, title: true, project: { select: { key: true } } } } },
      }),
      prisma.githubPullRequest.findMany({
        where: { repositoryId: repo.id }, orderBy: { updatedAt: 'desc' }, take: limit,
        include: { issue: { select: { issueNumber: true, title: true, project: { select: { key: true } } } } },
      }),
      prisma.githubBranch.findMany({
        where: { repositoryId: repo.id }, orderBy: { createdAt: 'desc' }, take: limit,
        include: { issue: { select: { issueNumber: true, title: true, project: { select: { key: true } } } } },
      }),
    ]);

    return {
      connected: true,
      repository: status.repository,
      totals: { commits: commitCount, pullRequests: prCount, branches: branchCount },
      commits: commitsRaw.map((item) => ({
        ...(item as any),
        issueKey: item.issue ? `${item.issue.project.key}-${item.issue.issueNumber}` : null,
        issueTitle: item.issue?.title || null,
      })),
      pullRequests: prsRaw.map((item) => ({
        ...(item as any),
        issueKey: item.issue ? `${item.issue.project.key}-${item.issue.issueNumber}` : null,
        issueTitle: item.issue?.title || null,
      })),
      branches: branchesRaw.map((item) => ({
        ...(item as any),
        issueKey: item.issue ? `${item.issue.project.key}-${item.issue.issueNumber}` : null,
        issueTitle: item.issue?.title || null,
      })),
    };
  }

  // ── Webhook Signature Verification ──────────────────────────────────────────

  async verifyWebhookByRepo(repoFullName: string, signature: string, payload: string): Promise<boolean> {
    const repo = await githubRepository.findRepositoryByFullName(repoFullName);
    if (!repo || !repo.webhookSecret) return false;

    const hmac = crypto.createHmac('sha256', repo.webhookSecret);
    const digest = `sha256=${hmac.update(payload).digest('hex')}`;

    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch {
      return false;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private mapCheckRunStatus(status: string, conclusion: string | null): string {
    if (status === 'queued') return 'pending';
    if (status === 'in_progress') return 'running';
    if (status === 'completed') {
      if (conclusion === 'success') return 'success';
      if (conclusion === 'failure' || conclusion === 'timed_out') return 'failure';
      if (conclusion === 'cancelled') return 'cancelled';
      return 'skipped';
    }
    return 'pending';
  }

  private mapWorkflowRunStatus(status: string, conclusion: string | null): string {
    if (status === 'queued' || status === 'waiting') return 'pending';
    if (status === 'in_progress') return 'running';
    if (status === 'completed') {
      if (conclusion === 'success') return 'success';
      if (conclusion === 'failure' || conclusion === 'timed_out') return 'failure';
      if (conclusion === 'cancelled') return 'cancelled';
      return 'skipped';
    }
    return 'pending';
  }
}

export const githubService = new GitHubService();
