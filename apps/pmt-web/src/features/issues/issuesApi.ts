import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';
import { boardsApi } from '../boards/boardsApi';
import { dashboardApi } from '../dashboard/dashboardApi';
import { sprintsApi } from '../sprints/sprintsApi';
import { versionsApi } from '../versions/versionsApi';

export interface Issue {
  id: string;
  projectId: string;
  issueKey: string;
  issueNumber: number;
  parentId?: string | null;
  title: string;
  description?: string;
  descriptionHtml?: string;
  type: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
    isSubtask?: boolean;
  };
  status: {
    id: string;
    name: string;
    displayName: string;
    color: string;
    category: string;
  };
  priority?: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
  };
  assignee?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  reporter: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  storyPoints?: number;
  startDate?: string;
  dueDate?: string;
  resolution?: string;
  resolutionDate?: string;
  environment?: string;
  affectedVersionId?: string;
  fixVersionId?: string;
  epicId?: string;
  sprintId?: string;
  sprint?: { id: string; name: string; status: string };
  affectedVersion?: { id: string; name: string };
  fixVersion?: { id: string; name: string };
  epic?: { id: string; name: string; color: string };
  createdAt: string;
  updatedAt: string;
  labels?: Array<{ id: string; name: string; color: string }>;
  commentCount?: number;
  attachmentCount?: number;
  watcherCount?: number;
  voteCount?: number;
  // Embedded data from getIssueById
  children?: Subtask[];
  links?: IssueLink[];
  watchers?: WatchersResponse;
  history?: any[];
  // Optional embedded data (via ?include= param)
  subtaskProgress?: SubtaskProgress;
  attachments?: any[];
  timeLogs?: any[];
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  typeId: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string;
  storyPoints?: number;
  dueDate?: string;
  labels?: string[];
  environment?: string;
  affectedVersionId?: string;
  fixVersionId?: string;
  epicId?: string;
  parentId?: string;
  sprintId?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  typeId?: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string | null;
  storyPoints?: number;
  dueDate?: string | null;
  startDate?: string | null;
  resolution?: string;
  environment?: string;
  affectedVersionId?: string | null;
  fixVersionId?: string | null;
  epicId?: string | null;
  sprintId?: string | null;
  labels?: string[];
}

export type IssueLinkType = string;

export interface LinkType {
  id: string;
  name: string;
  outward: string;
  inward: string;
  description?: string | null;
}

export interface IssueLink {
  id: string;
  direction: 'outward' | 'inward';
  linkType: LinkType;
  linkDescription: string;
  linkedIssue: {
    id: string;
    issueKey: string;
    title: string;
    status: {
      id: string;
      name: string;
      displayName: string;
      color: string;
      category: string;
    };
    type: {
      id: string;
      name: string;
      icon: string;
      color: string;
    };
    priority?: {
      id: string;
      name: string;
      icon: string;
      color: string;
    };
  };
  createdAt: string;
}

export interface CreateIssueLinkInput {
  targetIssueId: string;
  linkType: IssueLinkType;
}

export interface CreateLinkTypeInput {
  name: string;
  outward: string;
  inward: string;
  description?: string | null;
}

export interface UpdateLinkTypeInput {
  name?: string;
  outward?: string;
  inward?: string;
  description?: string | null;
}

// Voting & Watching types
export interface IssueVoter {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  votedAt: string;
}

export interface IssueWatcher {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  watchingSince: string;
}

export interface VoteResponse {
  voteCount: number;
  hasVoted: boolean;
}

export interface WatcherResponse {
  watcherCount: number;
  isWatching: boolean;
}

export interface VotersResponse {
  voters: IssueVoter[];
  voteCount: number;
  hasVoted: boolean;
}

export interface WatchersResponse {
  watchers: IssueWatcher[];
  watcherCount: number;
  isWatching: boolean;
}

// Sub-task types
export interface Subtask {
  id: string;
  issueKey: string;
  title: string;
  storyPoints?: number;
  timeSpentHours?: number;
  originalEstimateHours?: number;
  remainingEstimateHours?: number;
  type: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  status: {
    id: string;
    name: string;
    displayName: string;
    color: string;
    category: string;
  };
  priority?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  assignee?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface SubtaskProgress {
  totalSubtasks: number;
  completedSubtasks: number;
  inProgressSubtasks: number;
  todoSubtasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  totalTimeSpent: number;
  totalOriginalEstimate: number;
  totalRemainingEstimate: number;
  progressPercentage: number;
}

export const issuesApi = createApi({
  reducerPath: 'issuesApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Issue', 'IssueLink', 'LinkType'],
  endpoints: (builder) => ({
    getIssues: builder.query<{ issues: Issue[]; pagination: any }, { projectId: string; filters?: any }>({
      query: ({ projectId, filters }) => ({
        url: `/projects/${projectId}/issues`,
        params: filters,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (result) =>
        result
          ? [
            ...result.issues.map(({ id }) => ({ type: 'Issue' as const, id })),
            { type: 'Issue', id: 'LIST' },
          ]
          : [{ type: 'Issue', id: 'LIST' }],
    }),
    getIssue: builder.query<Issue, string | { issueId: string; include?: string[] }>({
      query: (arg) => {
        const issueId = typeof arg === 'string' ? arg : arg.issueId;
        const include = typeof arg === 'string' ? undefined : arg.include;
        return {
          url: `/issues/${issueId}`,
          params: include?.length ? { include: include.join(',') } : undefined,
        };
      },
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, arg) => {
        const id = typeof arg === 'string' ? arg : arg.issueId;
        return [
          { type: 'Issue', id },
          { type: 'Issue', id: 'LIST' }
        ];
      },
    }),
    createIssue: builder.mutation<Issue, { projectId: string; data: CreateIssueInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/issues`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: [{ type: 'Issue', id: 'LIST' }],
      async onQueryStarted({ projectId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags([{ type: 'ProjectDashboard', id: projectId }, 'Dashboard']));
          dispatch(sprintsApi.util.invalidateTags(['Sprint', 'Backlog']));
        } catch { /* ignored */ }
      },
    }),
    updateIssue: builder.mutation<Issue, { issueId: string; data: UpdateIssueInput }>({
      query: ({ issueId, data }) => ({
        url: `/issues/${issueId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'Issue', id: issueId },
        { type: 'Issue', id: 'LIST' }
      ],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
          dispatch(sprintsApi.util.invalidateTags(['Sprint', 'Backlog', 'Burnup', 'Burndown']));
          dispatch(versionsApi.util.invalidateTags(['Version', 'VersionIssues']));
        } catch { /* ignored */ }
      },
    }),
    deleteIssue: builder.mutation<void, string>({
      query: (issueId) => ({
        url: `/issues/${issueId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Issue', id: 'LIST' }],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
          dispatch(sprintsApi.util.invalidateTags(['Sprint', 'Backlog']));
        } catch { /* ignored */ }
      },
    }),
    cloneIssue: builder.mutation<Issue, string>({
      query: (issueId) => ({
        url: `/issues/${issueId}/clone`,
        method: 'POST',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: [{ type: 'Issue', id: 'LIST' }],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
          dispatch(sprintsApi.util.invalidateTags(['Sprint', 'Backlog']));
        } catch { /* ignored */ }
      },
    }),
    moveIssues: builder.mutation<void, { issueIds: string[]; targetProjectId: string }>({
      query: (data) => ({
        url: `/issues/bulk/move`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Issue', id: 'LIST' }],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
          dispatch(sprintsApi.util.invalidateTags(['Sprint', 'Backlog']));
        } catch { /* ignored */ }
      },
    }),
    // Issue Links
    getIssueLinks: builder.query<IssueLink[], string>({
      query: (issueId) => `/issues/${issueId}/links`,
      transformResponse: (response: any) => response.data || [],
      providesTags: (_result, _error, issueId) => [{ type: 'IssueLink', id: issueId }],
    }),
    createIssueLink: builder.mutation<IssueLink, { issueId: string; data: CreateIssueLinkInput }>({
      query: ({ issueId, data }) => ({
        url: `/issues/${issueId}/links`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'IssueLink', id: issueId },
        { type: 'Issue', id: issueId },
      ],
    }),
    deleteIssueLink: builder.mutation<void, { issueId: string; linkId: string }>({
      query: ({ issueId, linkId }) => ({
        url: `/issues/${issueId}/links/${linkId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'IssueLink', id: issueId },
        { type: 'Issue', id: issueId },
      ],
    }),
    // Link types reference
    getLinkTypes: builder.query<LinkType[], void>({
      query: () => `/issues/reference/link-types`,
      transformResponse: (response: any) => response.data || [],
      providesTags: ['LinkType'],
    }),
    createLinkType: builder.mutation<LinkType, CreateLinkTypeInput>({
      query: (data) => ({
        url: `/issues/reference/link-types`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['LinkType'],
    }),
    updateLinkType: builder.mutation<LinkType, { linkTypeId: string; data: UpdateLinkTypeInput }>({
      query: ({ linkTypeId, data }) => ({
        url: `/issues/reference/link-types/${linkTypeId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['LinkType'],
    }),
    deleteLinkType: builder.mutation<void, string>({
      query: (linkTypeId) => ({
        url: `/issues/reference/link-types/${linkTypeId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['LinkType'],
    }),
    // Search issues for linking
    searchIssuesForLink: builder.query<Issue[], { projectId: string; query: string; excludeIssueId?: string }>({
      query: ({ projectId, query, excludeIssueId }) => ({
        url: `/projects/${projectId}/issues`,
        params: { search: query, limit: 10, excludeId: excludeIssueId },
      }),
      transformResponse: (response: any) => response.data?.issues || [],
    }),

    // Voting endpoints
    addVote: builder.mutation<VoteResponse, string>({
      query: (issueId) => ({
        url: `/issues/${issueId}/votes`,
        method: 'POST',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, issueId) => [{ type: 'Issue', id: issueId }],
    }),
    removeVote: builder.mutation<VoteResponse, string>({
      query: (issueId) => ({
        url: `/issues/${issueId}/votes`,
        method: 'DELETE',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, issueId) => [{ type: 'Issue', id: issueId }],
    }),
    getVoters: builder.query<VotersResponse, string>({
      query: (issueId) => `/issues/${issueId}/voters`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, issueId) => [{ type: 'Issue', id: issueId }],
    }),
    getVotedIssues: builder.query<{ issues: Issue[]; pagination: any }, { page?: number; limit?: number }>({
      query: ({ page = 1, limit = 50 }) => ({
        url: `/issues/me/voted`,
        params: { page, limit },
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Issue'],
    }),

    // Watcher endpoints
    addWatcher: builder.mutation<WatcherResponse, { issueId: string; userId?: string }>({
      query: ({ issueId, userId }) => ({
        url: `/issues/${issueId}/watchers`,
        method: 'POST',
        body: userId ? { userId } : {},
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { issueId }) => [{ type: 'Issue', id: issueId }],
    }),
    removeWatcher: builder.mutation<WatcherResponse, { issueId: string; userId?: string }>({
      query: ({ issueId, userId }) => ({
        url: `/issues/${issueId}/watchers`,
        method: 'DELETE',
        body: userId ? { userId } : {},
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { issueId }) => [{ type: 'Issue', id: issueId }],
    }),
    getWatchers: builder.query<WatchersResponse, string>({
      query: (issueId) => `/issues/${issueId}/watchers`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, issueId) => [{ type: 'Issue', id: issueId }],
    }),
    getWatchedIssues: builder.query<{ issues: Issue[]; pagination: any }, { page?: number; limit?: number }>({
      query: ({ page = 1, limit = 50 }) => ({
        url: `/issues/me/watched`,
        params: { page, limit },
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Issue'],
    }),

    // Sub-task endpoints
    getSubtasks: builder.query<Subtask[], string>({
      query: (issueId) => `/issues/${issueId}/subtasks`,
      transformResponse: (response: any) => response.data || [],
      providesTags: (_result, _error, issueId) => [{ type: 'Issue', id: issueId }],
    }),
    getSubtaskProgress: builder.query<SubtaskProgress, string>({
      query: (issueId) => `/issues/${issueId}/subtasks/progress`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, issueId) => [{ type: 'Issue', id: issueId }],
    }),
    createSubtask: builder.mutation<Issue, { issueId: string; data: Omit<CreateIssueInput, 'typeId' | 'parentId'> }>({
      query: ({ issueId, data }) => ({
        url: `/issues/${issueId}/subtasks`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'Issue', id: issueId },
        { type: 'Issue', id: 'LIST' }
      ],
      async onQueryStarted({ issueId }, { dispatch, queryFulfilled }) {
        try {
          const { data: createdSubtask } = await queryFulfilled;
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags([{ type: 'ProjectDashboard', id: createdSubtask.projectId }, 'Dashboard']));
          dispatch(sprintsApi.util.invalidateTags(['Sprint', 'Backlog']));
        } catch { /* ignored */ }
      },
    }),
  }),
});

export const {
  useGetIssuesQuery,
  useGetIssuesQuery: useGetProjectIssuesQuery,
  useGetIssueQuery,
  useCreateIssueMutation,
  useUpdateIssueMutation,
  useDeleteIssueMutation,
  useCloneIssueMutation,
  useMoveIssuesMutation,
  useGetIssueLinksQuery,
  useCreateIssueLinkMutation,
  useDeleteIssueLinkMutation,
  useGetLinkTypesQuery,
  useCreateLinkTypeMutation,
  useUpdateLinkTypeMutation,
  useDeleteLinkTypeMutation,
  useSearchIssuesForLinkQuery,
  useLazySearchIssuesForLinkQuery,
  // Voting hooks
  useAddVoteMutation,
  useRemoveVoteMutation,
  useGetVotersQuery,
  useGetVotedIssuesQuery,
  // Watcher hooks
  useAddWatcherMutation,
  useRemoveWatcherMutation,
  useGetWatchersQuery,
  useGetWatchedIssuesQuery,
  // Sub-task hooks
  useGetSubtasksQuery,
  useGetSubtaskProgressQuery,
  useCreateSubtaskMutation,
} = issuesApi;
