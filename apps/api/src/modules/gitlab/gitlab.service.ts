import axios from 'axios';
import crypto from 'crypto';
import { gitlabRepository } from './gitlab.repository';
import { prisma } from '../../database/prisma';
import {
  GitlabConnection,
  GitlabRepository,
  GitlabBranch,
  GitlabCommit,
  CodeActivityResponse,
  RepositoryStatus,
  AvailableGitlabProject,
  GitlabUserInfo,
  GitlabProjectInfo,
  GitlabBranchInfo,
  GitlabPushPayload,
  GitlabMRPayload,
} from './gitlab.types';

const GITLAB_API = 'https://gitlab.com/api/v4';
const APP_URL = process.env.APP_URL || 'http://localhost:4000';

class GitlabService {
  private apiHeaders(accessToken: string) {
    return { 'PRIVATE-TOKEN': accessToken };
  }

  // ─── Connection ───────────────────────────────────────────────────────────

  async verifyAndConnect(userId: string, accessToken: string): Promise<GitlabConnection> {
    // Verify the token works by fetching current user info
    let userInfo: GitlabUserInfo;
    try {
      const response = await axios.get<GitlabUserInfo>(`${GITLAB_API}/user`, {
        headers: this.apiHeaders(accessToken),
      });
      userInfo = response.data;
    } catch (err: any) {
      // Log real error details for debugging
      console.error('[GitLab connect] Raw error:', {
        code: err?.code,
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        data: err?.response?.data,
        message: err?.message,
      });

      if (err?.response) {
        const status = err.response.status as number;
        const gitlabMsg: string =
          err.response.data?.message ||
          (Array.isArray(err.response.data?.error_description) ? err.response.data.error_description.join(', ') : '') ||
          err.response.data?.error ||
          err.response.statusText ||
          '';
        if (status === 401 || status === 403) {
          throw new Error(
            `GitLab rejected the token (HTTP ${status}). Make sure it is active and has the "api" scope.${gitlabMsg ? ` GitLab says: ${gitlabMsg}` : ''}`
          );
        }
        throw new Error(`GitLab API error (HTTP ${status}): ${gitlabMsg || 'unexpected response'}`);
      } else if (
        err?.code === 'ECONNREFUSED' ||
        err?.code === 'ENOTFOUND' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'EAI_AGAIN'
      ) {
        throw new Error(
          `Cannot reach gitlab.com (${err.code}). Check that the API server has outbound internet access.`
        );
      } else {
        throw new Error(err?.message || 'Failed to connect to GitLab. Please try again.');
      }
    }

    // Fetch token metadata (scopes)
    let tokenScopes: string | undefined;
    try {
      const metaRes = await axios.get(`${GITLAB_API}/personal_access_tokens/self`, {
        headers: this.apiHeaders(accessToken),
      });
      tokenScopes = (metaRes.data.scopes as string[]).join(', ');
    } catch {
      // scopes not critical — continue
    }

    const conn = await gitlabRepository.upsertConnection(userId, {
      gitlabUserId: userInfo.id,
      gitlabUsername: userInfo.username,
      gitlabEmail: userInfo.email,
      accessToken,
      tokenScopes,
    });

    return conn;
  }

  async getConnection(userId: string): Promise<GitlabConnection | null> {
    return gitlabRepository.findConnectionByUser(userId);
  }

  async disconnect(userId: string): Promise<void> {
    await gitlabRepository.deleteConnection(userId);
  }

  private async getAccessToken(userId: string): Promise<string> {
    const conn = await gitlabRepository.findConnectionByUser(userId);
    if (!conn) {
      throw new Error('GitLab account not connected. Please connect your GitLab account first.');
    }
    return (conn as any).accessToken as string;
  }

  // ─── Repository Listing ───────────────────────────────────────────────────

  async listUserProjects(userId: string, search?: string): Promise<AvailableGitlabProject[]> {
    const token = await this.getAccessToken(userId);

    try {
      const response = await axios.get<GitlabProjectInfo[]>(`${GITLAB_API}/projects`, {
        headers: this.apiHeaders(token),
        params: {
          membership: true,
          simple: true,
          per_page: 100,
          search: search || undefined,
          order_by: 'last_activity_at',
        },
      });

      return response.data.map((p) => ({
        id: p.id,
        name: p.name,
        fullPath: p.path_with_namespace,
        defaultBranch: p.default_branch || 'main',
        webUrl: p.web_url,
      }));
    } catch {
      return [];
    }
  }

  // ─── Link Repository ──────────────────────────────────────────────────────

  async linkRepository(
    projectId: string,
    userId: string,
    gitlabProjectId: number
  ): Promise<GitlabRepository> {
    const token = await this.getAccessToken(userId);

    // Fetch repo info from GitLab
    let projectInfo: GitlabProjectInfo;
    try {
      const response = await axios.get<GitlabProjectInfo>(
        `${GITLAB_API}/projects/${gitlabProjectId}`,
        { headers: this.apiHeaders(token) }
      );
      projectInfo = response.data;
    } catch {
      throw new Error(`GitLab project ${gitlabProjectId} not found or not accessible.`);
    }

    // Generate a per-repository webhook secret stored in the DB
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const repo = await gitlabRepository.upsertRepository(projectId, {
      gitlabProjectId,
      connectedById: userId,
      name: projectInfo.name,
      fullPath: projectInfo.path_with_namespace,
      defaultBranch: projectInfo.default_branch || 'main',
      webUrl: projectInfo.web_url,
      webhookSecret,
    });

    // Register webhook on GitLab repo
    try {
      const webhookUrl = `${APP_URL}/api/v1/integrations/gitlab/webhook`;
      const hookRes = await axios.post(
        `${GITLAB_API}/projects/${gitlabProjectId}/hooks`,
        {
          url: webhookUrl,
          token: webhookSecret,
          push_events: true,
          merge_requests_events: true,
          tag_push_events: false,
          enable_ssl_verification: true,
        },
        { headers: this.apiHeaders(token) }
      );
      await gitlabRepository.updateWebhookId(repo.id, hookRes.data.id);
    } catch {
      // Webhook setup is best-effort; don't fail the connection
    }

    return repo;
  }

  async getRepositoryStatus(projectId: string): Promise<RepositoryStatus> {
    const repo = await gitlabRepository.findRepositoryByProjectId(projectId);
    if (!repo) {
      return { connected: false, repository: null };
    }
    return {
      connected: true,
      repository: {
        id: repo.id,
        name: repo.name,
        fullPath: repo.fullPath,
        defaultBranch: repo.defaultBranch,
        webUrl: repo.webUrl,
      },
    };
  }

  async unlinkRepository(projectId: string, userId: string): Promise<void> {
    const repo = await gitlabRepository.findRepositoryByProjectId(projectId);
    if (!repo) return;

    // Remove webhook from GitLab
    if (repo.webhookId) {
      try {
        const token = await this.getAccessToken(userId);
        await axios.delete(
          `${GITLAB_API}/projects/${repo.gitlabProjectId}/hooks/${repo.webhookId}`,
          { headers: this.apiHeaders(token) }
        );
      } catch {
        // Best-effort
      }
    }

    await gitlabRepository.deleteRepository(projectId);
  }

  // ─── Branches ─────────────────────────────────────────────────────────────

  async listBranches(projectId: string, userId: string): Promise<GitlabBranchInfo[]> {
    const repo = await gitlabRepository.findRepositoryByProjectId(projectId);
    if (!repo) throw new Error('No GitLab repository linked to this project.');

    const token = await this.getAccessToken(userId);

    try {
      const response = await axios.get<GitlabBranchInfo[]>(
        `${GITLAB_API}/projects/${repo.gitlabProjectId}/repository/branches`,
        {
          headers: this.apiHeaders(token),
          params: { per_page: 100, order_by: 'updated_at' },
        }
      );
      return response.data;
    } catch {
      return [];
    }
  }

  async createBranch(
    projectId: string,
    userId: string,
    name: string,
    ref: string,
    issueId?: string
  ): Promise<GitlabBranch> {
    const repo = await gitlabRepository.findRepositoryByProjectId(projectId);
    if (!repo) throw new Error('No GitLab repository linked to this project.');

    const token = await this.getAccessToken(userId);

    let webUrl: string | undefined;
    try {
      const response = await axios.post(
        `${GITLAB_API}/projects/${repo.gitlabProjectId}/repository/branches`,
        { branch: name, ref },
        { headers: this.apiHeaders(token) }
      );
      webUrl = response.data.web_url;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create branch';
      throw new Error(msg);
    }

    return gitlabRepository.upsertBranch(repo.id, name, { issueId, webUrl });
  }

  // ─── Commits ──────────────────────────────────────────────────────────────

  async getProjectCommits(projectId: string, userId: string, limit = 50): Promise<GitlabCommit[]> {
    const repo = await gitlabRepository.findRepositoryByProjectId(projectId);
    if (!repo) return [];
    return gitlabRepository.findCommitsByRepositoryId(repo.id, limit);
  }

  // ─── Code Activity (issue dev panel) ──────────────────────────────────────

  async getIssueCodeActivity(issueId: string): Promise<CodeActivityResponse> {
    return gitlabRepository.getIssueCodeActivity(issueId);
  }

  // ─── Webhook Processing ───────────────────────────────────────────────────

  async verifyWebhookToken(gitlabProjectId: number, token: string): Promise<boolean> {
    const repo = await gitlabRepository.findRepositoryByGitlabProjectId(gitlabProjectId);
    if (!repo || !repo.webhookSecret) return false;
    return token === repo.webhookSecret;
  }

  async handlePushWebhook(payload: GitlabPushPayload): Promise<void> {
    const repo = await gitlabRepository.findRepositoryByGitlabProjectId(payload.project.id);
    if (!repo) return;

    // Determine branch name from ref (e.g. "refs/heads/main" → "main")
    const branch = payload.ref.replace(/^refs\/heads\//, '');

    // Fetch the project key for issue key extraction
    const project = await prisma.project.findUnique({
      where: { id: repo.projectId },
      select: { key: true },
    });
    if (!project) return;

    for (const commit of payload.commits) {
      const issueKeys = this.extractIssueKeys(commit.message, project.key);

      for (const issueKey of issueKeys) {
        const issueId = await this.findIssueIdByKey(issueKey, repo.projectId);
        if (!issueId) continue;

        await gitlabRepository.upsertCommit(repo.id, issueId, {
          sha: commit.id,
          message: commit.message,
          authorName: commit.author.name,
          authorEmail: commit.author.email,
          committedAt: commit.timestamp,
          webUrl: commit.url,
          branch,
        });
      }
    }
  }

  async handleMRWebhook(payload: GitlabMRPayload): Promise<void> {
    const repo = await gitlabRepository.findRepositoryByGitlabProjectId(payload.project.id);
    if (!repo) return;

    const project = await prisma.project.findUnique({
      where: { id: repo.projectId },
      select: { key: true },
    });
    if (!project) return;

    const mr = payload.object_attributes;
    const searchText = `${mr.title} ${mr.description || ''}`;
    const issueKeys = this.extractIssueKeys(searchText, project.key);

    for (const issueKey of issueKeys) {
      const issueId = await this.findIssueIdByKey(issueKey, repo.projectId);
      if (!issueId) continue;

      await gitlabRepository.upsertMergeRequest(repo.id, issueId, {
        mrIid: mr.iid,
        title: mr.title,
        state: mr.state,
        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch,
        authorName: payload.user.name,
        webUrl: mr.url,
        mergedAt: mr.merged_at,
      });
    }
  }

  /**
   * Handle GitLab `Pipeline Hook` webhook events.
   * Stores each pipeline run as a BuildRun linked to issues referencing the
   * head commit SHA (via linked GitlabCommits).
   */
  async handlePipelineWebhook(payload: any): Promise<void> {
    const pipeline = payload.object_attributes;
    if (!pipeline) return;

    const gitlabProjectId = payload.project?.id;
    if (!gitlabProjectId) return;

    const repo = await gitlabRepository.findRepositoryByGitlabProjectId(gitlabProjectId);
    if (!repo) return;

    const sha: string = pipeline.sha;
    if (!sha) return;

    // Find all issues linked to commits with this SHA in this repo
    const linkedCommits = await prisma.gitlabCommit.findMany({
      where: { repositoryId: repo.id, sha },
      select: { issueId: true },
    });

    if (linkedCommits.length === 0) return;

    const status = this.mapPipelineStatus(pipeline.status);
    const runId = String(pipeline.id);

    await Promise.all(
      linkedCommits.map(({ issueId }) =>
        prisma.buildRun.upsert({
          where: { issueId_provider_runId: { issueId, provider: 'gitlab', runId } },
          create: {
            issueId,
            provider: 'gitlab',
            runId,
            pipelineName: payload.project?.name ? `${payload.project.name} Pipeline` : 'GitLab CI/CD',
            status,
            conclusion: pipeline.status === 'success' ? 'success'
              : pipeline.status === 'failed' ? 'failure'
              : pipeline.status === 'canceled' ? 'cancelled'
              : null,
            url: `${payload.project?.web_url || ''}/-/pipelines/${pipeline.id}`,
            commitSha: sha,
            branchRef: pipeline.ref || null,
            startedAt: pipeline.created_at ? new Date(pipeline.created_at) : null,
            completedAt: pipeline.finished_at ? new Date(pipeline.finished_at) : null,
          },
          update: {
            status,
            conclusion: pipeline.status === 'success' ? 'success'
              : pipeline.status === 'failed' ? 'failure'
              : pipeline.status === 'canceled' ? 'cancelled'
              : null,
            completedAt: pipeline.finished_at ? new Date(pipeline.finished_at) : null,
          },
        })
      )
    );
  }

  private mapPipelineStatus(status: string): string {
    switch (status) {
      case 'created': case 'waiting_for_resource': case 'preparing': return 'pending';
      case 'pending': return 'pending';
      case 'running': return 'running';
      case 'success': return 'success';
      case 'failed': return 'failure';
      case 'canceled': return 'cancelled';
      case 'skipped': return 'skipped';
      default: return 'pending';
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  extractIssueKeys(text: string, projectKey: string): string[] {
    // Match patterns like PROJ-5, SCRUM-42
    const escapedKey = projectKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKey}-(\\d+)\\b`, 'gi');
    const matches: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push(`${projectKey}-${match[1]}`);
    }
    return [...new Set(matches)];
  }

  private async findIssueIdByKey(issueKey: string, projectId: string): Promise<string | null> {
    const parts = issueKey.split('-');
    const issueNumber = Number(parts[parts.length - 1]);
    if (Number.isNaN(issueNumber)) return null;

    const issue = await prisma.issue.findFirst({
      where: {
        projectId,
        issueNumber,
        deletedAt: null,
      },
      select: { id: true },
    });

    return issue?.id ?? null;
  }
}

export const gitlabService = new GitlabService();
