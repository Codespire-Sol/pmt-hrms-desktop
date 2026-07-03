import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import {
  GitHubConnection,
  GitHubRepository,
  IssueCommit,
  IssuePullRequest,
  IssueBranch,
  LinkCommitInput,
  LinkPullRequestInput,
} from './github.types';

class GitHubRepositoryDB {
  // ── Connection Methods (PAT-based) ──────────────────────────────────────────

  async upsertConnection(
    userId: string,
    data: {
      githubUserId: number;
      githubUsername: string;
      githubEmail?: string | null;
      avatarUrl?: string | null;
      accessToken: string;
      tokenScopes?: string | null;
    }
  ): Promise<GitHubConnection> {
    const connection = await prisma.githubConnection.upsert({
      where: { userId },
      create: {
        userId,
        githubUserId: data.githubUserId,
        githubUsername: data.githubUsername,
        githubEmail: data.githubEmail || null,
        avatarUrl: data.avatarUrl || null,
        accessToken: data.accessToken,
        tokenScopes: data.tokenScopes || null,
      },
      update: {
        githubUserId: data.githubUserId,
        githubUsername: data.githubUsername,
        githubEmail: data.githubEmail || null,
        avatarUrl: data.avatarUrl || null,
        accessToken: data.accessToken,
        tokenScopes: data.tokenScopes || null,
      },
    });
    return connection as unknown as GitHubConnection;
  }

  async findConnectionByUserId(userId: string): Promise<GitHubConnection | null> {
    const connection = await prisma.githubConnection.findUnique({ where: { userId } });
    return connection as unknown as GitHubConnection | null;
  }

  async deleteConnection(userId: string): Promise<boolean> {
    try {
      await prisma.githubConnection.delete({ where: { userId } });
      return true;
    } catch {
      return false;
    }
  }

  // ── Repository Methods ──────────────────────────────────────────────────────

  async createRepository(data: {
    projectId: string;
    connectedById?: string;
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    isPrivate: boolean;
    webUrl?: string;
    webhookSecret?: string;
    autoTransitionOnMerge?: boolean;
  }): Promise<GitHubRepository> {
    const repo = await prisma.githubRepository.create({
      data: {
        projectId: data.projectId,
        connectedById: data.connectedById || null,
        owner: data.owner,
        name: data.name,
        fullName: data.fullName,
        defaultBranch: data.defaultBranch,
        isPrivate: data.isPrivate,
        webUrl: data.webUrl || null,
        webhookSecret: data.webhookSecret || null,
        autoTransitionOnMerge: data.autoTransitionOnMerge ?? true,
      },
    });
    return repo as unknown as GitHubRepository;
  }

  async findRepositoryById(id: string): Promise<GitHubRepository | null> {
    const repo = await prisma.githubRepository.findUnique({ where: { id } });
    return repo as unknown as GitHubRepository | null;
  }

  async findRepositoryByProjectId(projectId: string): Promise<GitHubRepository | null> {
    const repo = await prisma.githubRepository.findFirst({ where: { projectId } });
    return repo as unknown as GitHubRepository | null;
  }

  async findRepositoryByFullName(fullName: string): Promise<GitHubRepository | null> {
    const repo = await prisma.githubRepository.findFirst({ where: { fullName } });
    return repo as unknown as GitHubRepository | null;
  }

  async updateRepository(id: string, data: Partial<GitHubRepository>): Promise<GitHubRepository | null> {
    const updateData: Prisma.GithubRepositoryUpdateInput = {};

    if (data.defaultBranch !== undefined) updateData.defaultBranch = data.defaultBranch;
    if (data.webhookId !== undefined) updateData.webhookId = data.webhookId;
    if (data.autoTransitionOnMerge !== undefined) updateData.autoTransitionOnMerge = data.autoTransitionOnMerge;
    if (data.transitionStatusId !== undefined) {
      updateData.transitionStatus = data.transitionStatusId
        ? { connect: { id: data.transitionStatusId } }
        : { disconnect: true };
    }

    const repo = await prisma.githubRepository.update({
      where: { id },
      data: updateData,
    });
    return repo as unknown as GitHubRepository | null;
  }

  async deleteRepository(id: string): Promise<boolean> {
    try {
      await prisma.githubRepository.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // ── Commit Methods ──────────────────────────────────────────────────────────

  async createCommit(data: LinkCommitInput): Promise<IssueCommit> {
    const commit = await prisma.githubCommit.create({
      data: {
        issueId: data.issueId,
        repositoryId: data.repositoryId,
        sha: data.sha,
        message: data.message,
        author: data.author,
        authorEmail: data.authorEmail || null,
        authorAvatarUrl: data.authorAvatarUrl || null,
        url: data.url,
        committedAt: data.committedAt,
      },
    });
    return commit as unknown as IssueCommit;
  }

  async findCommitBySha(sha: string, repositoryId: string): Promise<IssueCommit | null> {
    const commit = await prisma.githubCommit.findFirst({
      where: { sha, repositoryId },
    });
    return commit as unknown as IssueCommit | null;
  }

  async findCommitsByIssueId(issueId: string): Promise<IssueCommit[]> {
    const commits = await prisma.githubCommit.findMany({
      where: { issueId },
      orderBy: { committedAt: 'desc' },
    });
    return commits as unknown as IssueCommit[];
  }

  // ── Pull Request Methods ────────────────────────────────────────────────────

  async createPullRequest(data: LinkPullRequestInput): Promise<IssuePullRequest> {
    const pr = await prisma.githubPullRequest.create({
      data: {
        issueId: data.issueId,
        repositoryId: data.repositoryId,
        prNumber: data.prNumber,
        title: data.title,
        state: data.state,
        url: data.url,
        author: data.author,
        authorAvatarUrl: data.authorAvatarUrl || null,
        merged: data.merged || false,
        mergedAt: data.mergedAt || null,
        mergedBy: data.mergedBy || null,
        baseBranch: data.baseBranch,
        headBranch: data.headBranch,
        additions: data.additions || 0,
        deletions: data.deletions || 0,
        changedFiles: data.changedFiles || 0,
      },
    });
    return pr as unknown as IssuePullRequest;
  }

  async findPullRequestByNumber(prNumber: number, repositoryId: string): Promise<IssuePullRequest | null> {
    const pr = await prisma.githubPullRequest.findFirst({
      where: { prNumber, repositoryId },
    });
    return pr as unknown as IssuePullRequest | null;
  }

  async findPullRequestsByIssueId(issueId: string): Promise<IssuePullRequest[]> {
    const prs = await prisma.githubPullRequest.findMany({
      where: { issueId },
      orderBy: { updatedAt: 'desc' },
    });
    return prs as unknown as IssuePullRequest[];
  }

  async updatePullRequest(id: string, data: Partial<IssuePullRequest>): Promise<IssuePullRequest | null> {
    const updateData: Prisma.GithubPullRequestUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.merged !== undefined) updateData.merged = data.merged;
    if (data.mergedAt !== undefined) updateData.mergedAt = data.mergedAt;
    if (data.mergedBy !== undefined) updateData.mergedBy = data.mergedBy;
    if (data.additions !== undefined) updateData.additions = data.additions;
    if (data.deletions !== undefined) updateData.deletions = data.deletions;
    if (data.changedFiles !== undefined) updateData.changedFiles = data.changedFiles;

    const pr = await prisma.githubPullRequest.update({
      where: { id },
      data: updateData,
    });
    return pr as unknown as IssuePullRequest | null;
  }

  // ── Branch Methods ──────────────────────────────────────────────────────────

  async createBranch(data: { issueId: string; repositoryId: string; branchName: string; url: string }): Promise<IssueBranch> {
    const branch = await prisma.githubBranch.create({
      data: {
        issueId: data.issueId,
        repositoryId: data.repositoryId,
        branchName: data.branchName,
        url: data.url,
      },
    });
    return branch as unknown as IssueBranch;
  }

  async findBranchesByIssueId(issueId: string): Promise<IssueBranch[]> {
    const branches = await prisma.githubBranch.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
    });
    return branches as unknown as IssueBranch[];
  }
}

export const githubRepository = new GitHubRepositoryDB();
