import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';

export interface Component {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  leadId?: string;
  defaultAssigneeId?: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  defaultAssignee?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  issueCount: number;
}

export interface CreateComponentInput {
  name: string;
  description?: string;
  leadId?: string;
  defaultAssigneeId?: string;
  color?: string;
}

export interface UpdateComponentInput {
  name?: string;
  description?: string | null;
  leadId?: string | null;
  defaultAssigneeId?: string | null;
  color?: string;
  isActive?: boolean;
}

export interface ComponentFilters {
  isActive?: boolean;
  leadId?: string;
  search?: string;
}

export const componentsApi = createApi({
  reducerPath: 'componentsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Component', 'ComponentIssues'],
  endpoints: (builder) => ({
    getProjectComponents: builder.query<Component[], { projectId: string; filters?: ComponentFilters }>({
      query: ({ projectId, filters }) => ({
        url: `/projects/${projectId}/components`,
        params: filters,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Component'],
    }),
    getComponent: builder.query<Component, string>({
      query: (componentId) => `/components/${componentId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Component', id }],
    }),
    createComponent: builder.mutation<Component, { projectId: string; data: CreateComponentInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/components`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Component'],
    }),
    updateComponent: builder.mutation<Component, { componentId: string; data: UpdateComponentInput }>({
      query: ({ componentId, data }) => ({
        url: `/components/${componentId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { componentId }) => [
        { type: 'Component', id: componentId },
        'Component',
      ],
    }),
    deleteComponent: builder.mutation<void, string>({
      query: (componentId) => ({
        url: `/components/${componentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Component'],
    }),
    getComponentIssues: builder.query<{ issues: any[]; pagination: any }, { componentId: string; page?: number; limit?: number }>({
      query: ({ componentId, page = 1, limit = 50 }) => ({
        url: `/components/${componentId}/issues`,
        params: { page, limit },
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, { componentId }) => [{ type: 'ComponentIssues', id: componentId }],
    }),
    addIssueToComponent: builder.mutation<void, { componentId: string; issueId: string }>({
      query: ({ componentId, issueId }) => ({
        url: `/components/${componentId}/issues`,
        method: 'POST',
        body: { issueId },
      }),
      invalidatesTags: (_result, _error, { componentId }) => [
        { type: 'Component', id: componentId },
        { type: 'ComponentIssues', id: componentId },
      ],
    }),
    removeIssueFromComponent: builder.mutation<void, { componentId: string; issueId: string }>({
      query: ({ componentId, issueId }) => ({
        url: `/components/${componentId}/issues`,
        method: 'DELETE',
        body: { issueId },
      }),
      invalidatesTags: (_result, _error, { componentId }) => [
        { type: 'Component', id: componentId },
        { type: 'ComponentIssues', id: componentId },
      ],
    }),
  }),
});

export const {
  useGetProjectComponentsQuery,
  useGetComponentQuery,
  useCreateComponentMutation,
  useUpdateComponentMutation,
  useDeleteComponentMutation,
  useGetComponentIssuesQuery,
  useAddIssueToComponentMutation,
  useRemoveIssueFromComponentMutation,
} = componentsApi;
