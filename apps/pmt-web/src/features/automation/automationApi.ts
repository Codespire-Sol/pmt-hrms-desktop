import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';
import type {
  AutomationRuleWithCreator,
  AutomationRuleExecution,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
  AutomationField,
  TriggerTypeInfo,
  ActionTypeInfo,
  ConditionOperatorInfo,
  ExecutionStatus,
  TriggerType,
} from './types';

interface PaginatedResponse<T> {
  success: boolean;
  data: {
    rules?: T[];
    executions?: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface SingleResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface GetRulesParams {
  projectId: string;
  triggerType?: TriggerType;
  isEnabled?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

interface GetExecutionsParams {
  ruleId: string;
  status?: ExecutionStatus;
  page?: number;
  limit?: number;
}

export const automationApi = createApi({
  reducerPath: 'automationApi',
  baseQuery: createAuthBaseQuery('/api/v1/automation'),
  tagTypes: ['AutomationRule', 'AutomationExecution', 'AutomationFields'],
  endpoints: (builder) => ({
    // Reference data
    getAvailableFields: builder.query<AutomationField[], void>({
      query: () => '/fields',
      transformResponse: (response: SingleResponse<AutomationField[]>) => response.data,
      providesTags: ['AutomationFields'],
    }),

    getTriggerTypes: builder.query<TriggerTypeInfo[], void>({
      query: () => '/triggers',
      transformResponse: (response: SingleResponse<TriggerTypeInfo[]>) => response.data,
    }),

    getActionTypes: builder.query<ActionTypeInfo[], void>({
      query: () => '/actions',
      transformResponse: (response: SingleResponse<ActionTypeInfo[]>) => response.data,
    }),

    getConditionOperators: builder.query<ConditionOperatorInfo[], void>({
      query: () => '/operators',
      transformResponse: (response: SingleResponse<ConditionOperatorInfo[]>) => response.data,
    }),

    // Rule CRUD
    getRules: builder.query<
      { rules: AutomationRuleWithCreator[]; pagination: any },
      GetRulesParams
    >({
      query: ({ projectId, ...params }) => ({
        url: `/projects/${projectId}/rules`,
        params,
      }),
      transformResponse: (response: PaginatedResponse<AutomationRuleWithCreator>) => ({
        rules: response.data.rules || [],
        pagination: response.data.pagination,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.rules.map(({ id }) => ({ type: 'AutomationRule' as const, id })),
              { type: 'AutomationRule', id: 'LIST' },
            ]
          : [{ type: 'AutomationRule', id: 'LIST' }],
    }),

    getRule: builder.query<AutomationRuleWithCreator, string>({
      query: (ruleId) => `/rules/${ruleId}`,
      transformResponse: (response: SingleResponse<AutomationRuleWithCreator>) => response.data,
      providesTags: (_, __, id) => [{ type: 'AutomationRule', id }],
    }),

    createRule: builder.mutation<
      AutomationRuleWithCreator,
      { projectId: string; input: CreateAutomationRuleInput }
    >({
      query: ({ projectId, input }) => ({
        url: `/projects/${projectId}/rules`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (response: SingleResponse<AutomationRuleWithCreator>) => response.data,
      invalidatesTags: [{ type: 'AutomationRule', id: 'LIST' }],
    }),

    updateRule: builder.mutation<
      AutomationRuleWithCreator,
      { ruleId: string; input: UpdateAutomationRuleInput }
    >({
      query: ({ ruleId, input }) => ({
        url: `/rules/${ruleId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (response: SingleResponse<AutomationRuleWithCreator>) => response.data,
      invalidatesTags: (_, __, { ruleId }) => [
        { type: 'AutomationRule', id: ruleId },
        { type: 'AutomationRule', id: 'LIST' },
      ],
    }),

    deleteRule: builder.mutation<void, string>({
      query: (ruleId) => ({
        url: `/rules/${ruleId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'AutomationRule', id: 'LIST' }],
    }),

    toggleRule: builder.mutation<AutomationRuleWithCreator, { ruleId: string; isEnabled: boolean }>({
      query: ({ ruleId, isEnabled }) => ({
        url: `/rules/${ruleId}/toggle`,
        method: 'POST',
        body: { isEnabled },
      }),
      transformResponse: (response: SingleResponse<AutomationRuleWithCreator>) => response.data,
      invalidatesTags: (_, __, { ruleId }) => [
        { type: 'AutomationRule', id: ruleId },
        { type: 'AutomationRule', id: 'LIST' },
      ],
    }),

    duplicateRule: builder.mutation<AutomationRuleWithCreator, string>({
      query: (ruleId) => ({
        url: `/rules/${ruleId}/duplicate`,
        method: 'POST',
      }),
      transformResponse: (response: SingleResponse<AutomationRuleWithCreator>) => response.data,
      invalidatesTags: [{ type: 'AutomationRule', id: 'LIST' }],
    }),

    triggerRule: builder.mutation<{ message: string }, { ruleId: string; issueId?: string }>({
      query: ({ ruleId, issueId }) => ({
        url: `/rules/${ruleId}/trigger`,
        method: 'POST',
        body: { issueId },
      }),
      invalidatesTags: (_, __, { ruleId }) => [{ type: 'AutomationExecution', id: ruleId }],
    }),

    // Execution history
    getExecutions: builder.query<
      { executions: AutomationRuleExecution[]; pagination: any },
      GetExecutionsParams
    >({
      query: ({ ruleId, ...params }) => ({
        url: `/rules/${ruleId}/executions`,
        params,
      }),
      transformResponse: (response: PaginatedResponse<AutomationRuleExecution>) => ({
        executions: response.data.executions || [],
        pagination: response.data.pagination,
      }),
      providesTags: (_, __, { ruleId }) => [{ type: 'AutomationExecution', id: ruleId }],
    }),
  }),
});

export const {
  useGetAvailableFieldsQuery,
  useGetTriggerTypesQuery,
  useGetActionTypesQuery,
  useGetConditionOperatorsQuery,
  useGetRulesQuery,
  useGetRuleQuery,
  useCreateRuleMutation,
  useUpdateRuleMutation,
  useDeleteRuleMutation,
  useToggleRuleMutation,
  useDuplicateRuleMutation,
  useTriggerRuleMutation,
  useGetExecutionsQuery,
} = automationApi;
