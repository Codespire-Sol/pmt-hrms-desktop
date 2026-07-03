import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';

export type VersionStatus = 'unreleased' | 'released' | 'archived';

export interface VersionStats {
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  todoIssues: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
}

export interface Version {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: VersionStatus;
  startDate?: string;
  releaseDate?: string;
  actualReleaseDate?: string;
  releasedBy?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  releasedByUser?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  stats: VersionStats;
  progress: number;
}

export interface CreateVersionInput {
  name: string;
  description?: string;
  startDate?: string;
  releaseDate?: string;
}

export interface UpdateVersionInput {
  name?: string;
  description?: string | null;
  startDate?: string | null;
  releaseDate?: string | null;
}

export interface VersionFilters {
  status?: VersionStatus;
  search?: string;
}

export const versionsApi = createApi({
  reducerPath: 'versionsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Version', 'VersionIssues'],
  endpoints: (builder) => ({
    getProjectVersions: builder.query<Version[], { projectId: string; filters?: VersionFilters }>({
      query: ({ projectId, filters }) => ({
        url: `/projects/${projectId}/versions`,
        params: filters,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Version'],
    }),
    getVersion: builder.query<Version, string>({
      query: (versionId) => `/versions/${versionId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Version', id }],
    }),
    createVersion: builder.mutation<Version, { projectId: string; data: CreateVersionInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/versions`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Version'],
    }),
    updateVersion: builder.mutation<Version, { versionId: string; data: UpdateVersionInput }>({
      query: ({ versionId, data }) => ({
        url: `/versions/${versionId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { versionId }) => [
        { type: 'Version', id: versionId },
        'Version',
      ],
    }),
    deleteVersion: builder.mutation<void, string>({
      query: (versionId) => ({
        url: `/versions/${versionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Version'],
    }),
    releaseVersion: builder.mutation<Version, string>({
      query: (versionId) => ({
        url: `/versions/${versionId}/release`,
        method: 'POST',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, versionId) => [
        { type: 'Version', id: versionId },
        'Version',
      ],
    }),
    archiveVersion: builder.mutation<Version, string>({
      query: (versionId) => ({
        url: `/versions/${versionId}/archive`,
        method: 'POST',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, versionId) => [
        { type: 'Version', id: versionId },
        'Version',
      ],
    }),
    unarchiveVersion: builder.mutation<Version, string>({
      query: (versionId) => ({
        url: `/versions/${versionId}/unarchive`,
        method: 'POST',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, versionId) => [
        { type: 'Version', id: versionId },
        'Version',
      ],
    }),
    reorderVersions: builder.mutation<void, { projectId: string; orderedIds: string[] }>({
      query: ({ projectId, orderedIds }) => ({
        url: `/projects/${projectId}/versions/reorder`,
        method: 'POST',
        body: { orderedIds },
      }),
      invalidatesTags: ['Version'],
    }),
    getVersionIssues: builder.query<{ issues: any[]; pagination: any }, { versionId: string; type?: 'fix' | 'affected'; page?: number; limit?: number }>({
      query: ({ versionId, type = 'fix', page = 1, limit = 50 }) => ({
        url: `/versions/${versionId}/issues`,
        params: { type, page, limit },
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, { versionId }) => [{ type: 'VersionIssues', id: versionId }],
    }),
  }),
});

export const {
  useGetProjectVersionsQuery,
  useGetVersionQuery,
  useCreateVersionMutation,
  useUpdateVersionMutation,
  useDeleteVersionMutation,
  useReleaseVersionMutation,
  useArchiveVersionMutation,
  useUnarchiveVersionMutation,
  useReorderVersionsMutation,
  useGetVersionIssuesQuery,
} = versionsApi;
