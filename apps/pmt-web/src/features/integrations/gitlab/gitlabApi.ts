import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface GitLabConnection {
  connected: boolean;
  connection: {
    gitlabUsername: string;
    gitlabEmail: string;
    tokenScopes?: string;
    connectedAt: string;
  } | null;
}

export interface GitLabRepository {
  id: string;
  name: string;
  fullPath: string;
  defaultBranch: string;
  webUrl: string;
}

export interface GitLabRepositoryStatus {
  connected: boolean;
  repository: GitLabRepository | null;
}

export interface AvailableGitLabProject {
  id: number;
  name: string;
  fullPath: string;
  defaultBranch: string;
  webUrl: string;
}

export const gitlabApi = createApi({
  reducerPath: 'gitlabApi',
  baseQuery: createAuthBaseQuery('/api/v1/integrations/gitlab'),
  tagTypes: ['GitLabConnection', 'GitLabRepo'],
  endpoints: (builder) => ({
    // Get connection status for the current user
    getConnection: builder.query<GitLabConnection, void>({
      query: () => '/connect',
      transformResponse: (response: ApiResponse<GitLabConnection>) => response.data,
      providesTags: ['GitLabConnection'],
    }),

    // Connect with a Personal Access Token
    connectGitLab: builder.mutation<void, { accessToken: string }>({
      query: (body) => ({
        url: '/connect',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['GitLabConnection'],
    }),

    // Disconnect GitLab account
    disconnectGitLab: builder.mutation<void, void>({
      query: () => ({
        url: '/connect',
        method: 'DELETE',
      }),
      invalidatesTags: ['GitLabConnection', 'GitLabRepo'],
    }),

    // List user's accessible GitLab repositories
    listRepositories: builder.query<AvailableGitLabProject[], string | undefined>({
      query: (search) => ({
        url: '/repositories',
        params: search ? { search } : undefined,
      }),
      transformResponse: (response: ApiResponse<{ repositories: AvailableGitLabProject[] }>) =>
        response.data.repositories,
    }),

    // Get linked repository status for a project
    getRepositoryStatus: builder.query<GitLabRepositoryStatus, string>({
      query: (projectId) => `/projects/${projectId}/repository`,
      transformResponse: (response: ApiResponse<GitLabRepositoryStatus>) => response.data,
      providesTags: (_result, _error, projectId) => [{ type: 'GitLabRepo', id: projectId }],
    }),

    // Link a GitLab repository to a project
    linkRepository: builder.mutation<void, { projectId: string; gitlabProjectId: number }>({
      query: ({ projectId, gitlabProjectId }) => ({
        url: `/projects/${projectId}/repository`,
        method: 'POST',
        body: { gitlabProjectId },
      }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'GitLabRepo', id: projectId }],
    }),

    // Unlink a GitLab repository from a project
    unlinkRepository: builder.mutation<void, string>({
      query: (projectId) => ({
        url: `/projects/${projectId}/repository`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, projectId) => [{ type: 'GitLabRepo', id: projectId }],
    }),

    // Create a branch in the linked GitLab repository
    createBranch: builder.mutation<
      { branch: { name: string; webUrl?: string } },
      { projectId: string; name: string; ref?: string; issueId?: string }
    >({
      query: ({ projectId, name, ref, issueId }) => ({
        url: `/projects/${projectId}/branches`,
        method: 'POST',
        body: { name, ref: ref ?? 'main', issueId },
      }),
      transformResponse: (response: ApiResponse<{ branch: { name: string; webUrl?: string } }>) =>
        response.data,
    }),
  }),
});

export const {
  useGetConnectionQuery,
  useConnectGitLabMutation,
  useDisconnectGitLabMutation,
  useLazyListRepositoriesQuery,
  useGetRepositoryStatusQuery,
  useLinkRepositoryMutation,
  useUnlinkRepositoryMutation,
  useCreateBranchMutation,
} = gitlabApi;
