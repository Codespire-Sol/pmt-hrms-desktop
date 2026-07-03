import { prisma } from '../../database/prisma';
import {
  GitlabConnection,
  GitlabRepository,
  GitlabCommit,
  GitlabBranch,
  GitlabMergeRequest,
  CodeActivityResponse,
} from './gitlab.types';

class GitlabRepositoryDB {
  // ─── Connection ───────────────────────────────────────────────────────────

  async upsertConnection(
    userId: string,
    data: {
      gitlabUserId: number;
      gitlabUsername: string;
      gitlabEmail?: string;
      accessToken: string;
      tokenScopes?: string;
    }
  ): Promise<GitlabConnection> {
    const conn = await prisma.gitlabConnection.upsert({
      where: { userId },
      create: {
        userId,
        gitlabUserId: data.gitlabUserId,
        gitlabUsername: data.gitlabUsername,
        gitlabEmail: data.gitlabEmail ?? null,
        accessToken: data.accessToken,
        tokenScopes: data.tokenScopes ?? null,
      },
      update: {
        gitlabUserId: data.gitlabUserId,
        gitlabUsername: data.gitlabUsername,
        gitlabEmail: data.gitlabEmail ?? null,
        accessToken: data.accessToken,
        tokenScopes: data.tokenScopes ?? null,
        connectedAt: new Date(),
      },
    });
    return conn as unknown as GitlabConnection;
  }

  async findConnectionByUser(userId: string): Promise<GitlabConnection | null> {
    const conn = await prisma.gitlabConnection.findUnique({ where: { userId } });
    return conn as unknown as GitlabConnection | null;
  }

  async deleteConnection(userId: string): Promise<void> {
    await prisma.gitlabConnection.deleteMany({ where: { userId } });
  }

  // ─── Repository ───────────────────────────────────────────────────────────

  async upsertRepository(
    projectId: string,
    data: {
      gitlabProjectId: number;
      connectedById: string;
      name: string;
      fullPath: string;
      defaultBranch: string;
      webUrl?: string;
      webhookId?: number;
      webhookSecret?: string | null;
    }
  ): Promise<GitlabRepository> {
    const repo = await prisma.gitlabRepository.upsert({
      where: { projectId },
      create: {
        projectId,
        gitlabProjectId: data.gitlabProjectId,
        connectedById: data.connectedById,
        name: data.name,
        fullPath: data.fullPath,
        defaultBranch: data.defaultBranch,
        webUrl: data.webUrl ?? null,
        webhookId: data.webhookId ?? null,
        webhookSecret: data.webhookSecret ?? null,
      },
      update: {
        gitlabProjectId: data.gitlabProjectId,
        connectedById: data.connectedById,
        name: data.name,
        fullPath: data.fullPath,
        defaultBranch: data.defaultBranch,
        webUrl: data.webUrl ?? null,
        webhookId: data.webhookId ?? null,
        webhookSecret: data.webhookSecret ?? null,
      },
    });
    return repo as unknown as GitlabRepository;
  }

  async findRepositoryByProjectId(projectId: string): Promise<GitlabRepository | null> {
    const repo = await prisma.gitlabRepository.findUnique({ where: { projectId } });
    return repo as unknown as GitlabRepository | null;
  }

  async findRepositoryByGitlabProjectId(gitlabProjectId: number): Promise<GitlabRepository | null> {
    const repo = await prisma.gitlabRepository.findFirst({ where: { gitlabProjectId } });
    return repo as unknown as GitlabRepository | null;
  }

  async deleteRepository(projectId: string): Promise<void> {
    await prisma.gitlabRepository.deleteMany({ where: { projectId } });
  }

  async updateWebhookId(repositoryId: string, webhookId: number | null): Promise<void> {
    await prisma.gitlabRepository.update({
      where: { id: repositoryId },
      data: { webhookId },
    });
  }

  // ─── Commits ──────────────────────────────────────────────────────────────

  async upsertCommit(
    repositoryId: string,
    issueId: string,
    data: {
      sha: string;
      message: string;
      authorName?: string;
      authorEmail?: string;
      committedAt: string;
      webUrl?: string;
      branch?: string;
    }
  ): Promise<GitlabCommit> {
    const commit = await prisma.gitlabCommit.upsert({
      where: { repositoryId_sha: { repositoryId, sha: data.sha } },
      create: {
        issueId,
        repositoryId,
        sha: data.sha,
        message: data.message,
        authorName: data.authorName ?? null,
        authorEmail: data.authorEmail ?? null,
        committedAt: new Date(data.committedAt),
        webUrl: data.webUrl ?? null,
        branch: data.branch ?? null,
      },
      update: {
        message: data.message,
        authorName: data.authorName ?? null,
        authorEmail: data.authorEmail ?? null,
        branch: data.branch ?? null,
      },
    });
    return commit as unknown as GitlabCommit;
  }

  async findCommitBySha(sha: string, repositoryId: string): Promise<GitlabCommit | null> {
    const commit = await prisma.gitlabCommit.findUnique({
      where: { repositoryId_sha: { repositoryId, sha } },
    });
    return commit as unknown as GitlabCommit | null;
  }

  async findCommitsByIssueId(issueId: string): Promise<GitlabCommit[]> {
    const commits = await prisma.gitlabCommit.findMany({
      where: { issueId },
      orderBy: { committedAt: 'desc' },
    });
    return commits as unknown as GitlabCommit[];
  }

  async findCommitsByRepositoryId(repositoryId: string, limit = 50): Promise<GitlabCommit[]> {
    const commits = await prisma.gitlabCommit.findMany({
      where: { repositoryId },
      orderBy: { committedAt: 'desc' },
      take: limit,
    });
    return commits as unknown as GitlabCommit[];
  }

  // ─── Branches ─────────────────────────────────────────────────────────────

  async upsertBranch(
    repositoryId: string,
    name: string,
    data: {
      issueId?: string | null;
      webUrl?: string;
    }
  ): Promise<GitlabBranch> {
    const branch = await prisma.gitlabBranch.upsert({
      where: { repositoryId_name: { repositoryId, name } },
      create: {
        repositoryId,
        name,
        issueId: data.issueId ?? null,
        webUrl: data.webUrl ?? null,
      },
      update: {
        issueId: data.issueId ?? null,
        webUrl: data.webUrl ?? null,
      },
    });
    return branch as unknown as GitlabBranch;
  }

  async findBranchesByIssueId(issueId: string): Promise<GitlabBranch[]> {
    const branches = await prisma.gitlabBranch.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
    });
    return branches as unknown as GitlabBranch[];
  }

  async findBranchesByRepositoryId(repositoryId: string, limit = 50): Promise<GitlabBranch[]> {
    const branches = await prisma.gitlabBranch.findMany({
      where: { repositoryId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return branches as unknown as GitlabBranch[];
  }

  // ─── Merge Requests ───────────────────────────────────────────────────────

  async upsertMergeRequest(
    repositoryId: string,
    issueId: string,
    data: {
      mrIid: number;
      title: string;
      state: string;
      sourceBranch?: string;
      targetBranch?: string;
      authorName?: string;
      webUrl?: string;
      mergedAt?: string | null;
    }
  ): Promise<GitlabMergeRequest> {
    const mr = await prisma.gitlabMergeRequest.upsert({
      where: { repositoryId_mrIid: { repositoryId, mrIid: data.mrIid } },
      create: {
        issueId,
        repositoryId,
        mrIid: data.mrIid,
        title: data.title,
        state: data.state,
        sourceBranch: data.sourceBranch ?? null,
        targetBranch: data.targetBranch ?? null,
        authorName: data.authorName ?? null,
        webUrl: data.webUrl ?? null,
        mergedAt: data.mergedAt ? new Date(data.mergedAt) : null,
      },
      update: {
        title: data.title,
        state: data.state,
        authorName: data.authorName ?? null,
        webUrl: data.webUrl ?? null,
        mergedAt: data.mergedAt ? new Date(data.mergedAt) : null,
      },
    });
    return mr as unknown as GitlabMergeRequest;
  }

  async findMergeRequestsByIssueId(issueId: string): Promise<GitlabMergeRequest[]> {
    const mrs = await prisma.gitlabMergeRequest.findMany({
      where: { issueId },
      orderBy: { updatedAt: 'desc' },
    });
    return mrs as unknown as GitlabMergeRequest[];
  }

  // ─── Code Activity (for issue dev panel) ──────────────────────────────────

  async getIssueCodeActivity(issueId: string): Promise<CodeActivityResponse> {
    const [commits, mergeRequests, branches] = await Promise.all([
      this.findCommitsByIssueId(issueId),
      this.findMergeRequestsByIssueId(issueId),
      this.findBranchesByIssueId(issueId),
    ]);
    return { commits, mergeRequests, branches };
  }
}

export const gitlabRepository = new GitlabRepositoryDB();
