import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';

export type EpicStatus = 'to_do' | 'in_progress' | 'done';

export interface EpicStats {
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  todoIssues: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
}

export interface Epic {
  id: string;
  projectId: string;
  name: string;
  summary?: string;
  description?: string;
  color: string;
  status: EpicStatus;
  startDate?: string;
  endDate?: string;
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  stats: EpicStats;
  progress: number;
}

export interface CreateEpicInput {
  name: string;
  summary?: string;
  description?: string;
  color?: string;
  status?: EpicStatus;
  startDate?: string;
  endDate?: string;
}

export interface UpdateEpicInput {
  name?: string;
  summary?: string;
  description?: string;
  color?: string;
  status?: EpicStatus;
  startDate?: string | null;
  endDate?: string | null;
  position?: number;
}

export interface EpicFilters {
  status?: EpicStatus;
  search?: string;
}

export const epicsApi = createApi({
  reducerPath: 'epicsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Epic', 'EpicIssues'],
  endpoints: (builder) => ({
    getProjectEpics: builder.query<Epic[], { projectId: string; filters?: EpicFilters }>({
      query: ({ projectId, filters }) => ({
        url: `/projects/${projectId}/epics`,
        params: filters,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Epic'],
    }),
    getEpic: builder.query<Epic, string>({
      query: (epicId) => `/epics/${epicId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Epic', id }],
    }),
    createEpic: builder.mutation<Epic, { projectId: string; data: CreateEpicInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/epics`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Epic'],
    }),
    updateEpic: builder.mutation<Epic, { epicId: string; data: UpdateEpicInput }>({
      query: ({ epicId, data }) => ({
        url: `/epics/${epicId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { epicId }) => [
        { type: 'Epic', id: epicId },
        'Epic',
      ],
    }),
    deleteEpic: builder.mutation<void, string>({
      query: (epicId) => ({
        url: `/epics/${epicId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Epic'],
    }),
    getEpicIssues: builder.query<{ issues: any[]; pagination: any }, { epicId: string; page?: number; limit?: number }>({
      query: ({ epicId, page = 1, limit = 50 }) => ({
        url: `/epics/${epicId}/issues`,
        params: { page, limit },
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, { epicId }) => [{ type: 'EpicIssues', id: epicId }],
    }),
    assignIssuesToEpic: builder.mutation<void, { epicId: string; issueIds: string[] }>({
      query: ({ epicId, issueIds }) => ({
        url: `/epics/${epicId}/issues`,
        method: 'POST',
        body: { issueIds },
      }),
      invalidatesTags: (_result, _error, { epicId }) => [
        { type: 'EpicIssues', id: epicId },
        'Epic',
      ],
    }),
    removeIssuesFromEpic: builder.mutation<void, { epicId: string; issueIds: string[] }>({
      query: ({ epicId, issueIds }) => ({
        url: `/epics/${epicId}/issues`,
        method: 'DELETE',
        body: { issueIds },
      }),
      invalidatesTags: (_result, _error, { epicId }) => [
        { type: 'EpicIssues', id: epicId },
        'Epic',
      ],
    }),
  }),
});

export const {
  useGetProjectEpicsQuery,
  useGetEpicQuery,
  useCreateEpicMutation,
  useUpdateEpicMutation,
  useDeleteEpicMutation,
  useGetEpicIssuesQuery,
  useAssignIssuesToEpicMutation,
  useRemoveIssuesFromEpicMutation,
} = epicsApi;
