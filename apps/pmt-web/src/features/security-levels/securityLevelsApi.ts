import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';

export interface SecurityLevelRole {
  id: string;
  name: string;
  displayName: string;
}

export interface SecurityLevel {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  level: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  roles: SecurityLevelRole[];
}

export interface CreateSecurityLevelInput {
  name: string;
  description?: string;
  level?: number;
  isDefault?: boolean;
  roleIds?: string[];
}

export interface UpdateSecurityLevelInput {
  name?: string;
  description?: string | null;
  level?: number;
  isDefault?: boolean;
  roleIds?: string[];
}

export const securityLevelsApi = createApi({
  reducerPath: 'securityLevelsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['SecurityLevel'],
  endpoints: (builder) => ({
    getProjectSecurityLevels: builder.query<SecurityLevel[], string>({
      query: (projectId) => `/projects/${projectId}/security-levels`,
      transformResponse: (response: any) => response.data,
      providesTags: ['SecurityLevel'],
    }),
    getSecurityLevel: builder.query<SecurityLevel, string>({
      query: (levelId) => `/security-levels/${levelId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'SecurityLevel', id }],
    }),
    createSecurityLevel: builder.mutation<SecurityLevel, { projectId: string; data: CreateSecurityLevelInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/security-levels`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['SecurityLevel'],
    }),
    updateSecurityLevel: builder.mutation<SecurityLevel, { levelId: string; data: UpdateSecurityLevelInput }>({
      query: ({ levelId, data }) => ({
        url: `/security-levels/${levelId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { levelId }) => [
        { type: 'SecurityLevel', id: levelId },
        'SecurityLevel',
      ],
    }),
    deleteSecurityLevel: builder.mutation<void, string>({
      query: (levelId) => ({
        url: `/security-levels/${levelId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['SecurityLevel'],
    }),
    reorderSecurityLevels: builder.mutation<void, { projectId: string; orderedIds: string[] }>({
      query: ({ projectId, orderedIds }) => ({
        url: `/projects/${projectId}/security-levels/reorder`,
        method: 'POST',
        body: { orderedIds },
      }),
      invalidatesTags: ['SecurityLevel'],
    }),
  }),
});

export const {
  useGetProjectSecurityLevelsQuery,
  useGetSecurityLevelQuery,
  useCreateSecurityLevelMutation,
  useUpdateSecurityLevelMutation,
  useDeleteSecurityLevelMutation,
  useReorderSecurityLevelsMutation,
} = securityLevelsApi;
