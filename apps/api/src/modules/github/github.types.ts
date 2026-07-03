// GitHub Connection (PAT-based, stored per user)
export interface GitHubConnection {
  id: string;
  userId: string;
  githubUserId: number;
  githubUsername: string;
  githubEmail: string | null;
  avatarUrl: string | null;
  accessToken: string;
  tokenScopes: string | null;
  connectedAt: string;
}

// GitHub Repository Connection (per project)
export interface GitHubRepository {
  id: string;
  projectId: string;
  connectedById: string | null;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  webUrl: string | null;
  webhookId: number | null;
  webhookSecret: string | null;
  autoTransitionOnMerge: boolean;
  transitionStatusId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Issue Commit Link
export interface IssueCommit {
  id: string;
  issueId: string;
  repositoryId: string;
  sha: string;
  message: string;
  author: string;
  authorEmail: string | null;
  authorAvatarUrl: string | null;
  url: string;
  committedAt: string;
  createdAt: string;
}

// Issue Pull Request Link
export interface IssuePullRequest {
  id: string;
  issueId: string;
  repositoryId: string;
  prNumber: number;
  title: string;
  state: 'open' | 'closed';
  url: string;
  author: string;
  authorAvatarUrl: string | null;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: string | null;
  baseBranch: string;
  headBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  createdAt: string;
  updatedAt: string;
}

// Issue Branch Link
export interface IssueBranch {
  id: string;
  issueId: string;
  repositoryId: string;
  branchName: string;
  url: string;
  createdAt: string;
}

// GitHub Webhook Payloads
export interface GitHubPushPayload {
  ref: string;
  before: string;
  after: string;
  repository: {
    id: number;
    full_name: string;
    default_branch: string;
  };
  pusher: {
    name: string;
    email: string;
  };
  commits: Array<{
    id: string;
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    added: string[];
    removed: string[];
    modified: string[];
  }>;
}

export interface GitHubPullRequestPayload {
  action: 'opened' | 'closed' | 'reopened' | 'edited' | 'synchronize' | 'merged';
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
    html_url: string;
    body: string | null;
    user: {
      login: string;
      avatar_url: string;
    };
    merged: boolean;
    merged_at: string | null;
    merged_by: {
      login: string;
    } | null;
    base: {
      ref: string;
    };
    head: {
      ref: string;
    };
    additions: number;
    deletions: number;
    changed_files: number;
  };
  repository: {
    id: number;
    full_name: string;
  };
}

export interface GitHubBranchPayload {
  ref: string;
  ref_type: 'branch' | 'tag';
  repository: {
    id: number;
    full_name: string;
    html_url: string;
  };
}

// Input Types
export interface ConnectGitHubInput {
  accessToken: string;
}

export interface LinkRepositoryInput {
  owner: string;
  name: string;
  autoTransitionOnMerge?: boolean;
}

export interface UpdateRepositoryInput {
  autoTransitionOnMerge?: boolean;
  transitionStatusId?: string | null;
}

export interface CreateBranchInput {
  issueId: string;
  repositoryId: string;
  branchName: string;
  baseBranch?: string;
}

export interface LinkCommitInput {
  issueId: string;
  repositoryId: string;
  sha: string;
  message: string;
  author: string;
  authorEmail?: string;
  authorAvatarUrl?: string;
  url: string;
  committedAt: string;
}

export interface LinkPullRequestInput {
  issueId: string;
  repositoryId: string;
  prNumber: number;
  title: string;
  state: 'open' | 'closed';
  url: string;
  author: string;
  authorAvatarUrl?: string;
  merged?: boolean;
  mergedAt?: string;
  mergedBy?: string;
  baseBranch: string;
  headBranch: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
}

// Response Types
export interface CodeActivityResponse {
  commits: IssueCommit[];
  pullRequests: IssuePullRequest[];
  branches: IssueBranch[];
}

export interface ProjectCodeActivityItem {
  id: string;
  issueId: string;
  issueKey: string | null;
  issueTitle: string | null;
}

export interface ProjectCodeOverview {
  connected: boolean;
  repository: {
    id: string;
    fullName: string;
    defaultBranch: string;
    autoTransitionOnMerge: boolean;
  } | null;
  totals: {
    commits: number;
    pullRequests: number;
    branches: number;
  };
  commits: Array<IssueCommit & ProjectCodeActivityItem>;
  pullRequests: Array<IssuePullRequest & ProjectCodeActivityItem>;
  branches: Array<IssueBranch & ProjectCodeActivityItem>;
}

export interface RepositoryStatus {
  connected: boolean;
  repository: {
    id: string;
    fullName: string;
    defaultBranch: string;
    autoTransitionOnMerge: boolean;
  } | null;
}

export interface BranchSuggestion {
  suggestedName: string;
  issueKey: string;
  issueType: string;
  baseBranch: string;
}

export interface AvailableRepository {
  id: number;
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
  url: string;
}

// Smart Commit Actions
export interface SmartCommitAction {
  command: 'time' | 'comment' | 'transition';
  value: string;
}

export interface ParsedCommitMessage {
  issueKeys: string[];
  message: string;
  actions: SmartCommitAction[];
}
