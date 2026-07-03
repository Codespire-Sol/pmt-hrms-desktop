// GitHub Connection (PAT-based)
export interface GitHubConnectionStatus {
  connected: boolean;
  githubUsername?: string;
  githubEmail?: string | null;
  avatarUrl?: string | null;
  tokenScopes?: string | null;
  connectedAt?: string;
}

// GitHub Repository Connection
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

// Repository Status Response
export interface RepositoryStatus {
  connected: boolean;
  repository: {
    id: string;
    fullName: string;
    defaultBranch: string;
    autoTransitionOnMerge: boolean;
  } | null;
}

// Available Repository
export interface AvailableRepository {
  id: number;
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
  url: string;
}

// Branch Suggestion
export interface BranchSuggestion {
  suggestedName: string;
  issueKey: string;
  issueType: string;
  baseBranch: string;
}

// Code Activity Response
export interface CodeActivityResponse {
  commits: IssueCommit[];
  pullRequests: IssuePullRequest[];
  branches: IssueBranch[];
}

// Input Types
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
  branchName: string;
  baseBranch?: string;
}

export interface SuggestBranchNameInput {
  issueKey: string;
  issueTitle: string;
  issueType: string;
}

// Code Activity Summary
export interface CodeActivitySummary {
  totalCommits: number;
  totalPullRequests: number;
  totalBranches: number;
  lastActivity: string | null;
  openPRCount: number;
  mergedPRCount: number;
  linesAdded: number;
  linesDeleted: number;
}
