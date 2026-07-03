import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';
import {
  GitHubConnectionStatus,
  RepositoryStatus,
  AvailableRepository,
  GitHubRepository,
  BranchSuggestion,
  IssueBranch,
  CodeActivityResponse,
  LinkRepositoryInput,
  UpdateRepositoryInput,
  CreateBranchInput,
  SuggestBranchNameInput,
} from './types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface BuildRun {
  id: string;
  issueId: string;
  provider: 'github' | 'gitlab';
  runId: string;
  pipelineName: string;
  status: string;
  conclusion: string | null;
  url: string;
  commitSha: string;
  branchRef: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const githubApi = createApi({
  reducerPath: 'githubApi',
  baseQuery: createAuthBaseQuery('/api/v1/integrations/github'),
  tagTypes: ['GitHubConnection', 'GitHubStatus', 'CodeActivity', 'AvailableRepos'],
  endpoints: (builder) => ({
    // Account connection (PAT-based)
    getConnection: builder.query<GitHubConnectionStatus, void>({
      query: () => '/connect',
      transformResponse: (response: ApiResponse<GitHubConnectionStatus>) => response.data,
      providesTags: ['GitHubConnection'],
    }),

    connectGitHub: builder.mutation<GitHubConnectionStatus, { accessToken: string }>({
      query: (body) => ({
        url: '/connect',
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<GitHubConnectionStatus>) => response.data,
      invalidatesTags: ['GitHubConnection'],
    }),

    disconnectGitHub: builder.mutation<void, void>({
      query: () => ({
        url: '/connect',
        method: 'DELETE',
      }),
      invalidatesTags: ['GitHubConnection', 'AvailableRepos'],
    }),

    // Repository listing
    listRepositories: builder.query<AvailableRepository[], void>({
      query: () => '/repositories',
      transformResponse: (response: ApiResponse<{ repositories: AvailableRepository[] }>) =>
        response.data.repositories,
      providesTags: ['AvailableRepos'],
    }),

    // Repository status for a project
    getRepositoryStatus: builder.query<RepositoryStatus, string>({
      query: (projectId) => `/projects/${projectId}/repository`,
      transformResponse: (response: ApiResponse<RepositoryStatus>) => response.data,
      providesTags: (_result, _error, projectId) => [{ type: 'GitHubStatus', id: projectId }],
    }),

    // Link repository to project
    linkRepository: builder.mutation<
      GitHubRepository,
      { projectId: string; data: LinkRepositoryInput }
    >({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/repository`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<{ repository: GitHubRepository }>) =>
        response.data.repository,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'GitHubStatus', id: projectId }],
    }),

    // Unlink repository from project
    unlinkRepository: builder.mutation<void, string>({
      query: (projectId) => ({
        url: `/projects/${projectId}/repository`,
        method: 'DELETE',
      }),
      invalidatesTags: ['GitHubStatus'],
    }),

    // Update repository settings
    updateRepository: builder.mutation<
      GitHubRepository,
      { repositoryId: string; data: UpdateRepositoryInput }
    >({
      query: ({ repositoryId, data }) => ({
        url: `/repositories/${repositoryId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: ApiResponse<{ repository: GitHubRepository }>) =>
        response.data.repository,
      invalidatesTags: ['GitHubStatus'],
    }),

    // Suggest branch name
    suggestBranchName: builder.mutation<
      BranchSuggestion,
      { projectId: string; data: SuggestBranchNameInput }
    >({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/suggest-branch`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<BranchSuggestion>) => response.data,
    }),

    // Create branch
    createBranch: builder.mutation<IssueBranch, { repositoryId: string; data: CreateBranchInput }>({
      query: ({ repositoryId, data }) => ({
        url: `/repositories/${repositoryId}/branches`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<{ branch: IssueBranch }>) => response.data.branch,
      invalidatesTags: (_result, _error, { data }) => [{ type: 'CodeActivity', id: data.issueId }],
    }),

    // Code activity for an issue
    getCodeActivity: builder.query<CodeActivityResponse, string>({
      query: (issueId) => `/issues/${issueId}/code-activity`,
      transformResponse: (response: ApiResponse<CodeActivityResponse>) => response.data,
      providesTags: (_result, _error, issueId) => [{ type: 'CodeActivity', id: issueId }],
    }),

    // CI/CD build runs for an issue
    getBuildRuns: builder.query<BuildRun[], string>({
      query: (issueId) => `/issues/${issueId}/builds`,
      transformResponse: (response: ApiResponse<BuildRun[]>) => response.data,
      providesTags: (_result, _error, issueId) => [{ type: 'CodeActivity', id: `builds-${issueId}` }],
    }),
  }),
});

export const {
  useGetConnectionQuery,
  useConnectGitHubMutation,
  useDisconnectGitHubMutation,
  useLazyListRepositoriesQuery,
  useGetRepositoryStatusQuery,
  useLinkRepositoryMutation,
  useUnlinkRepositoryMutation,
  useUpdateRepositoryMutation,
  useSuggestBranchNameMutation,
  useCreateBranchMutation,
  useGetCodeActivityQuery,
  useGetBuildRunsQuery,
} = githubApi;
