import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';
import {
  CustomField,
  CustomFieldWithValue,
  CreateCustomFieldRequest,
  UpdateCustomFieldRequest,
  SetCustomFieldValueRequest,
  SetCustomFieldValuesRequest,
  ReorderFieldsRequest,
} from './types';

export const customFieldsApi = createApi({
  reducerPath: 'customFieldsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['CustomField', 'CustomFieldValue'],
  endpoints: (builder) => ({
    // Project custom fields
    getProjectCustomFields: builder.query<{ success: boolean; data: CustomField[] }, string>({
      query: (projectId) => `/projects/${projectId}/custom-fields`,
      providesTags: (result, _error, projectId) =>
        result
          ? [
              ...result.data.map((field) => ({ type: 'CustomField' as const, id: field.id })),
              { type: 'CustomField', id: `PROJECT-${projectId}` },
            ]
          : [{ type: 'CustomField', id: `PROJECT-${projectId}` }],
    }),

    createCustomField: builder.mutation<
      { success: boolean; data: CustomField },
      { projectId: string; body: CreateCustomFieldRequest }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/custom-fields`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'CustomField', id: `PROJECT-${projectId}` },
      ],
    }),

    getCustomField: builder.query<{ success: boolean; data: CustomField }, string>({
      query: (fieldId) => `/custom-fields/${fieldId}`,
      providesTags: (_result, _error, fieldId) => [{ type: 'CustomField', id: fieldId }],
    }),

    updateCustomField: builder.mutation<
      { success: boolean; data: CustomField },
      { fieldId: string; body: UpdateCustomFieldRequest }
    >({
      query: ({ fieldId, body }) => ({
        url: `/custom-fields/${fieldId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_result, _error, { fieldId }) => [{ type: 'CustomField', id: fieldId }],
    }),

    deleteCustomField: builder.mutation<{ success: boolean; message: string }, string>({
      query: (fieldId) => ({
        url: `/custom-fields/${fieldId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['CustomField'],
    }),

    reorderCustomFields: builder.mutation<
      { success: boolean; data: CustomField[] },
      { projectId: string; body: ReorderFieldsRequest }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/custom-fields/reorder`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'CustomField', id: `PROJECT-${projectId}` },
      ],
    }),

    // Issue custom field values
    getIssueCustomFields: builder.query<{ success: boolean; data: CustomFieldWithValue[] }, string>({
      query: (issueId) => `/issues/${issueId}/custom-fields`,
      providesTags: (_result, _error, issueId) => [
        { type: 'CustomFieldValue', id: `ISSUE-${issueId}` },
      ],
    }),

    setIssueCustomFieldValue: builder.mutation<
      { success: boolean; data: CustomFieldWithValue },
      { issueId: string; fieldId: string; body: SetCustomFieldValueRequest }
    >({
      query: ({ issueId, fieldId, body }) => ({
        url: `/issues/${issueId}/custom-fields/${fieldId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'CustomFieldValue', id: `ISSUE-${issueId}` },
      ],
    }),

    setIssueCustomFieldValues: builder.mutation<
      { success: boolean; data: CustomFieldWithValue[] },
      { issueId: string; body: SetCustomFieldValuesRequest }
    >({
      query: ({ issueId, body }) => ({
        url: `/issues/${issueId}/custom-fields`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'CustomFieldValue', id: `ISSUE-${issueId}` },
      ],
    }),

    deleteIssueCustomFieldValue: builder.mutation<
      { success: boolean; message: string },
      { issueId: string; fieldId: string }
    >({
      query: ({ issueId, fieldId }) => ({
        url: `/issues/${issueId}/custom-fields/${fieldId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'CustomFieldValue', id: `ISSUE-${issueId}` },
      ],
    }),
  }),
});

export const {
  useGetProjectCustomFieldsQuery,
  useCreateCustomFieldMutation,
  useGetCustomFieldQuery,
  useUpdateCustomFieldMutation,
  useDeleteCustomFieldMutation,
  useReorderCustomFieldsMutation,
  useGetIssueCustomFieldsQuery,
  useSetIssueCustomFieldValueMutation,
  useSetIssueCustomFieldValuesMutation,
  useDeleteIssueCustomFieldValueMutation,
} = customFieldsApi;
