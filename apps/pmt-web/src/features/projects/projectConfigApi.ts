import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '@/lib/baseQuery';
import { boardsApi } from '@/features/boards/boardsApi';
import { issuesApi } from '@/features/issues/issuesApi';

// Issue Types
export interface IssueType {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  color?: string;
  isSubtask: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssueTypeInput {
  projectId: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  color?: string;
  isSubtask: boolean;
}

export interface UpdateIssueTypeInput {
  name?: string;
  displayName?: string;
  description?: string;
  icon?: string;
  color?: string;
  isSubtask?: boolean;
}

// Priorities
export interface Priority {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  color?: string;
  level: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePriorityInput {
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  color?: string;
  level: number;
}

export interface UpdatePriorityInput {
  name?: string;
  displayName?: string;
  description?: string;
  icon?: string;
  color?: string;
  level?: number;
}

export const projectConfigApi = createApi({
  reducerPath: 'projectConfigApi',
  baseQuery: authBaseQuery,
  tagTypes: ['IssueType', 'Priority'],
  endpoints: (builder) => ({
    // Issue Types
    getIssueTypes: builder.query<IssueType[], string>({
      query: (projectId) => `/reference/issue-types?projectId=${projectId}`,
      transformResponse: (response: any) => response.data || [],
      providesTags: ['IssueType'],
    }),
    createIssueType: builder.mutation<IssueType, CreateIssueTypeInput>({
      query: (data) => ({
        url: '/reference/issue-types',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['IssueType'],
    }),
    updateIssueType: builder.mutation<IssueType, { id: string; data: UpdateIssueTypeInput }>({
      query: ({ id, data }) => ({
        url: `/reference/issue-types/${id}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'IssueType', id }],
    }),
    deleteIssueType: builder.mutation<void, string>({
      query: (id) => ({
        url: `/reference/issue-types/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['IssueType'],
    }),
    reorderIssueTypes: builder.mutation<void, { projectId: string; typeIds: string[] }>({
      query: ({ projectId, typeIds }) => ({
        url: `/reference/issue-types/reorder`,
        method: 'PUT',
        body: { projectId, typeIds },
      }),
      invalidatesTags: ['IssueType'],
    }),

    // Priorities
    getPriorities: builder.query<Priority[], void>({
      query: () => '/reference/priorities',
      transformResponse: (response: any) => response.data || [],
      providesTags: ['Priority'],
    }),
    createPriority: builder.mutation<Priority, CreatePriorityInput>({
      query: (data) => ({
        url: '/reference/priorities',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Priority'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: 'LIST' }]));
        } catch { /* ignored */ }
      },
    }),
    updatePriority: builder.mutation<Priority, { id: string; data: UpdatePriorityInput }>({
      query: ({ id, data }) => ({
        url: `/reference/priorities/${id}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Priority', id }, 'Priority'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: 'LIST' }]));
        } catch { /* ignored */ }
      },
    }),
    deletePriority: builder.mutation<void, string>({
      query: (id) => ({
        url: `/reference/priorities/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Priority'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: 'LIST' }]));
        } catch { /* ignored */ }
      },
    }),
  }),
});

export const {
  // Issue Types
  useGetIssueTypesQuery,
  useCreateIssueTypeMutation,
  useUpdateIssueTypeMutation,
  useDeleteIssueTypeMutation,
  useReorderIssueTypesMutation,
  // Priorities
  useGetPrioritiesQuery,
  useCreatePriorityMutation,
  useUpdatePriorityMutation,
  useDeletePriorityMutation,
} = projectConfigApi;
