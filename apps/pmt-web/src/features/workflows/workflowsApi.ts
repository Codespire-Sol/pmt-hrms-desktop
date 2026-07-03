import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';
import type {
  Workflow,
  WorkflowWithStatuses,
  Status,
  StatusTransition,
  CreateWorkflowInput,
  CreateStatusInput,
  UpdateStatusInput,
  AddTransitionInput,
  WorkflowTemplate,
  WorkflowScheme,
  WorkflowSchemeWithMappings,
  CreateWorkflowSchemeInput,
  WorkflowSchemeMapping,
  TransitionRestriction,
  CreateTransitionRestrictionInput,
} from './types';

export const workflowsApi = createApi({
  reducerPath: 'workflowsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Workflow', 'Status', 'Transition', 'WorkflowScheme'],
  endpoints: (builder) => ({
    // Workflow operations
    getWorkflows: builder.query<Workflow[], { projectId?: string }>({
      query: (params) => ({
        url: '/workflows',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Workflow'],
    }),

    getWorkflow: builder.query<WorkflowWithStatuses, string>({
      query: (workflowId) => `/workflows/${workflowId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [
        { type: 'Workflow', id },
        'Status',
        'Transition',
      ],
    }),

    getProjectWorkflow: builder.query<WorkflowWithStatuses, string>({
      query: (projectId) => `/projects/${projectId}/workflow`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, projectId) => [
        { type: 'Workflow', id: projectId },
        'Status',
        'Transition',
      ],
    }),

    assignWorkflowToProject: builder.mutation<WorkflowWithStatuses, { projectId: string; workflowId: string }>({
      query: ({ projectId, workflowId }) => ({
        url: `/projects/${projectId}/workflow/assign`,
        method: 'POST',
        body: { workflowId },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Workflow'],
    }),

    createWorkflow: builder.mutation<WorkflowWithStatuses, CreateWorkflowInput>({
      query: (body) => ({
        url: '/workflows',
        method: 'POST',
        body,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Workflow'],
    }),

    updateWorkflow: builder.mutation<
      WorkflowWithStatuses,
      { workflowId: string; data: Partial<{ name: string; description: string; isActive: boolean }> }
    >({
      query: ({ workflowId, data }) => ({
        url: `/workflows/${workflowId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { workflowId }) => [{ type: 'Workflow', id: workflowId }],
    }),

    deleteWorkflow: builder.mutation<void, string>({
      query: (workflowId) => ({
        url: `/workflows/${workflowId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Workflow'],
    }),

    // Status operations
    getStatuses: builder.query<Status[], string>({
      query: (workflowId) => `/workflows/${workflowId}/statuses`,
      transformResponse: (response: any) => response.data,
      providesTags: ['Status'],
    }),

    createStatus: builder.mutation<Status, { workflowId: string; data: CreateStatusInput }>({
      query: ({ workflowId, data }) => ({
        url: `/workflows/${workflowId}/statuses`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Status', 'Workflow'],
    }),

    updateStatus: builder.mutation<Status, { statusId: string; data: UpdateStatusInput }>({
      query: ({ statusId, data }) => ({
        url: `/workflows/statuses/${statusId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Status', 'Workflow'],
    }),

    deleteStatus: builder.mutation<void, string>({
      query: (statusId) => ({
        url: `/workflows/statuses/${statusId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Status', 'Workflow'],
    }),

    reorderStatuses: builder.mutation<Status[], { workflowId: string; statusIds: string[] }>({
      query: ({ workflowId, statusIds }) => ({
        url: `/workflows/${workflowId}/statuses/reorder`,
        method: 'POST',
        body: { statusIds },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Status', 'Workflow'],
    }),

    // Transition operations
    getTransitions: builder.query<StatusTransition[], string>({
      query: (workflowId) => `/workflows/${workflowId}/transitions`,
      transformResponse: (response: any) => response.data,
      providesTags: ['Transition'],
    }),

    addTransition: builder.mutation<StatusTransition, { workflowId: string; data: AddTransitionInput }>({
      query: ({ workflowId, data }) => ({
        url: `/workflows/${workflowId}/transitions`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Transition', 'Workflow'],
    }),

    removeTransition: builder.mutation<void, string>({
      query: (transitionId) => ({
        url: `/workflows/transitions/${transitionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Transition', 'Workflow'],
    }),

    setTransitions: builder.mutation<
      StatusTransition[],
      { workflowId: string; transitions: AddTransitionInput[] }
    >({
      query: ({ workflowId, transitions }) => ({
        url: `/workflows/${workflowId}/transitions`,
        method: 'PUT',
        body: { transitions },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Transition', 'Workflow'],
    }),

    getAvailableTransitions: builder.query<Status[], string>({
      query: (statusId) => `/workflows/statuses/${statusId}/available-transitions`,
      transformResponse: (response: any) => response.data,
    }),

    // Templates
    getWorkflowTemplates: builder.query<WorkflowTemplate[], void>({
      query: () => '/workflows/templates',
      transformResponse: (response: any) => response.data,
    }),

    createWorkflowFromTemplate: builder.mutation<WorkflowWithStatuses, { name: string; description?: string; fromTemplate: string }>({
      query: (body) => ({
        url: '/workflows',
        method: 'POST',
        body,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Workflow'],
    }),

    // Transition restrictions
    getTransitionRestrictions: builder.query<TransitionRestriction[], string>({
      query: (transitionId) => `/workflows/transitions/${transitionId}/restrictions`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, transitionId) => [{ type: 'Transition', id: `restrictions-${transitionId}` }],
    }),

    createTransitionRestriction: builder.mutation<TransitionRestriction, { transitionId: string; data: CreateTransitionRestrictionInput }>({
      query: ({ transitionId, data }) => ({
        url: `/workflows/transitions/${transitionId}/restrictions`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { transitionId }) => [{ type: 'Transition', id: `restrictions-${transitionId}` }],
    }),

    updateTransitionRestriction: builder.mutation<TransitionRestriction, { restrictionId: string; transitionId: string; data: Partial<CreateTransitionRestrictionInput> }>({
      query: ({ restrictionId, data }) => ({
        url: `/workflows/transitions/restrictions/${restrictionId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { transitionId }) => [{ type: 'Transition', id: `restrictions-${transitionId}` }],
    }),

    deleteTransitionRestriction: builder.mutation<void, { restrictionId: string; transitionId: string }>({
      query: ({ restrictionId }) => ({
        url: `/workflows/transitions/restrictions/${restrictionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { transitionId }) => [{ type: 'Transition', id: `restrictions-${transitionId}` }],
    }),

    // Workflow Schemes
    getWorkflowSchemes: builder.query<WorkflowScheme[], void>({
      query: () => '/workflow-schemes',
      transformResponse: (response: any) => response.data,
      providesTags: ['WorkflowScheme'],
    }),

    getWorkflowScheme: builder.query<WorkflowSchemeWithMappings, string>({
      query: (schemeId) => `/workflow-schemes/${schemeId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'WorkflowScheme', id }],
    }),

    createWorkflowScheme: builder.mutation<WorkflowScheme, CreateWorkflowSchemeInput>({
      query: (body) => ({
        url: '/workflow-schemes',
        method: 'POST',
        body,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['WorkflowScheme'],
    }),

    updateWorkflowScheme: builder.mutation<WorkflowScheme, { schemeId: string; data: Partial<CreateWorkflowSchemeInput> }>({
      query: ({ schemeId, data }) => ({
        url: `/workflow-schemes/${schemeId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { schemeId }) => [{ type: 'WorkflowScheme', id: schemeId }],
    }),

    deleteWorkflowScheme: builder.mutation<void, string>({
      query: (schemeId) => ({
        url: `/workflow-schemes/${schemeId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['WorkflowScheme'],
    }),

    addSchemeMapping: builder.mutation<WorkflowSchemeMapping, { schemeId: string; data: { issueTypeId?: string; workflowId: string; isDefault?: boolean } }>({
      query: ({ schemeId, data }) => ({
        url: `/workflow-schemes/${schemeId}/mappings`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { schemeId }) => [{ type: 'WorkflowScheme', id: schemeId }],
    }),

    removeSchemeMapping: builder.mutation<void, { schemeId: string; mappingId: string }>({
      query: ({ schemeId, mappingId }) => ({
        url: `/workflow-schemes/${schemeId}/mappings/${mappingId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { schemeId }) => [{ type: 'WorkflowScheme', id: schemeId }],
    }),
  }),
});

export const {
  useGetWorkflowsQuery,
  useGetWorkflowQuery,
  useGetProjectWorkflowQuery,
  useAssignWorkflowToProjectMutation,
  useCreateWorkflowMutation,
  useUpdateWorkflowMutation,
  useDeleteWorkflowMutation,
  useGetStatusesQuery,
  useCreateStatusMutation,
  useUpdateStatusMutation,
  useDeleteStatusMutation,
  useReorderStatusesMutation,
  useGetTransitionsQuery,
  useAddTransitionMutation,
  useRemoveTransitionMutation,
  useSetTransitionsMutation,
  useGetAvailableTransitionsQuery,
  useGetWorkflowTemplatesQuery,
  useCreateWorkflowFromTemplateMutation,
  useGetTransitionRestrictionsQuery,
  useCreateTransitionRestrictionMutation,
  useUpdateTransitionRestrictionMutation,
  useDeleteTransitionRestrictionMutation,
  useGetWorkflowSchemesQuery,
  useGetWorkflowSchemeQuery,
  useCreateWorkflowSchemeMutation,
  useUpdateWorkflowSchemeMutation,
  useDeleteWorkflowSchemeMutation,
  useAddSchemeMappingMutation,
  useRemoveSchemeMappingMutation,
} = workflowsApi;
