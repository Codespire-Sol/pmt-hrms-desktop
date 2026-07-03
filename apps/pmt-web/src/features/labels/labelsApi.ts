import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';

export interface Label {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export const labelsApi = createApi({
  reducerPath: 'labelsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Label'],
  endpoints: (builder) => ({
    getProjectLabels: builder.query<Label[], string>({
      query: (projectId) => `/projects/${projectId}/labels`,
      transformResponse: (response: any) => response.data || [],
      providesTags: (_result, _error, projectId) => [{ type: 'Label', id: projectId }],
    }),
    createLabel: builder.mutation<Label, { projectId: string; name: string; color?: string; description?: string }>({
      query: ({ projectId, ...data }) => ({
        url: `/projects/${projectId}/labels`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Label', id: projectId }],
    }),
    updateLabel: builder.mutation<Label, { projectId: string; labelId: string; name?: string; color?: string; description?: string }>({
      query: ({ projectId, labelId, ...data }) => ({
        url: `/projects/${projectId}/labels/${labelId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Label', id: projectId }],
    }),
    deleteLabel: builder.mutation<void, { projectId: string; labelId: string }>({
      query: ({ projectId, labelId }) => ({
        url: `/projects/${projectId}/labels/${labelId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Label', id: projectId }],
    }),
  }),
});

export const {
  useGetProjectLabelsQuery,
  useCreateLabelMutation,
  useUpdateLabelMutation,
  useDeleteLabelMutation,
} = labelsApi;
