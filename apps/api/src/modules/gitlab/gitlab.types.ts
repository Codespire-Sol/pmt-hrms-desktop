// GitLab Connection (PAT-based)
export interface GitlabConnection {
  id: string;
  userId: string;
  gitlabUserId: number;
  gitlabUsername: string;
  gitlabEmail: string | null;
  tokenScopes: string | null;
  connectedAt: string;
}

// GitLab Repository (linked to a PM project)
export interface GitlabRepository {
  id: string;
  projectId: string;
  gitlabProjectId: number;
  connectedById: string | null;
  name: string;
  fullPath: string;
  defaultBranch: string;
  webUrl: string | null;
  webhookId: number | null;
  webhookSecret: string | null;
  createdAt: string;
  updatedAt: string;
}

// GitLab Commit (linked to an issue)
export interface GitlabCommit {
  id: string;
  issueId: string;
  repositoryId: string;
  sha: string;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  committedAt: string;
  webUrl: string | null;
  branch: string | null;
  createdAt: string;
}

// GitLab Branch (optionally linked to an issue)
export interface GitlabBranch {
  id: string;
  issueId: string | null;
  repositoryId: string;
  name: string;
  webUrl: string | null;
  createdAt: string;
}

// GitLab Merge Request (linked to an issue)
export interface GitlabMergeRequest {
  id: string;
  issueId: string;
  repositoryId: string;
  mrIid: number;
  title: string;
  state: 'opened' | 'merged' | 'closed';
  sourceBranch: string | null;
  targetBranch: string | null;
  authorName: string | null;
  webUrl: string | null;
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Input Types
export interface ConnectGitlabInput {
  accessToken: string;
}

export interface LinkRepositoryInput {
  projectId: string;
  gitlabProjectId: number;
  connectedById: string;
}

export interface CreateBranchInput {
  name: string;
  ref: string;
  issueId?: string;
}

// GitLab API user info (from GET /user)
export interface GitlabUserInfo {
  id: number;
  username: string;
  email: string;
  name: string;
  avatar_url: string;
}

// GitLab API project info (from GET /projects/:id)
export interface GitlabProjectInfo {
  id: number;
  name: string;
  path_with_namespace: string;
  default_branch: string;
  web_url: string;
}

// GitLab API branch info (from GET /projects/:id/repository/branches)
export interface GitlabBranchInfo {
  name: string;
  web_url: string;
  commit: {
    id: string;
    message: string;
    author_name: string;
    author_email: string;
    committed_date: string;
    web_url: string;
  };
}

// GitLab Webhook Payloads
export interface GitlabPushPayload {
  object_kind: 'push';
  ref: string;             // e.g. "refs/heads/main"
  project: {
    id: number;
    path_with_namespace: string;
    web_url: string;
  };
  repository: {
    name: string;
  };
  commits: Array<{
    id: string;            // SHA
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      email: string;
    };
  }>;
}

export interface GitlabMRPayload {
  object_kind: 'merge_request';
  project: {
    id: number;
    path_with_namespace: string;
  };
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    state: 'opened' | 'merged' | 'closed';
    source_branch: string;
    target_branch: string;
    url: string;
    merged_at: string | null;
    author_id: number;
  };
  user: {
    name: string;
    username: string;
  };
}

// Response Types
export interface CodeActivityResponse {
  commits: GitlabCommit[];
  mergeRequests: GitlabMergeRequest[];
  branches: GitlabBranch[];
}

export interface RepositoryStatus {
  connected: boolean;
  repository: {
    id: string;
    name: string;
    fullPath: string;
    defaultBranch: string;
    webUrl: string | null;
  } | null;
}

export interface AvailableGitlabProject {
  id: number;
  name: string;
  fullPath: string;
  defaultBranch: string;
  webUrl: string;
}
