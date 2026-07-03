import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '../../lib/baseQuery';

// Types
export type ConditionType =
  | 'required_fields'
  | 'field_value'
  | 'permission'
  | 'assignee'
  | 'reporter'
  | 'resolution'
  | 'custom_script'
  | 'linked_issues'
  | 'subtasks_done'
  | 'time_logged'
  | 'approval';

export type ValidatorType =
  | 'validate_regex'
  | 'validate_date_range'
  | 'validate_numeric_range'
  | 'validate_email'
  | 'validate_url'
  | 'validate_custom';

export type PostFunctionType =
  | 'set_field'
  | 'copy_field'
  | 'clear_field'
  | 'assign_to_reporter'
  | 'assign_to_lead'
  | 'unassign'
  | 'add_comment'
  | 'add_watcher'
  | 'send_notification'
  | 'update_parent'
  | 'trigger_webhook';

export type ApproverType = 'any' | 'all' | 'specific_users' | 'role' | 'project_lead';

export interface TransitionCondition {
  id: string;
  transitionId: string;
  name: string;
  description?: string;
  type: ConditionType;
  config: any;
  isBlocking: boolean;
  errorMessage?: string;
  executionOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransitionValidator {
  id: string;
  transitionId: string;
  name: string;
  description?: string;
  type: ValidatorType;
  field: string;
  config: any;
  errorMessage?: string;
  executionOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransitionPostFunction {
  id: string;
  transitionId: string;
  name: string;
  description?: string;
  type: PostFunctionType;
  config: any;
  executionOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransitionApprovalConfig {
  id: string;
  transitionId: string;
  requiredApprovals: number;
  approverType: ApproverType;
  approvers: string[];
  allowSelfApproval: boolean;
  expiryHours?: number;
  createdAt: string;
  updatedAt: string;
}

// Input Types
export interface CreateConditionInput {
  name: string;
  description?: string;
  type: ConditionType;
  config: any;
  isBlocking?: boolean;
  errorMessage?: string;
  executionOrder?: number;
}

export interface CreateValidatorInput {
  name: string;
  description?: string;
  type: ValidatorType;
  field: string;
  config: any;
  errorMessage?: string;
  executionOrder?: number;
}

export interface CreatePostFunctionInput {
  name: string;
  description?: string;
  type: PostFunctionType;
  config: any;
  executionOrder?: number;
}

export interface CreateApprovalConfigInput {
  requiredApprovals?: number;
  approverType: ApproverType;
  approvers?: string[];
  allowSelfApproval?: boolean;
  expiryHours?: number;
}

// Type descriptions
export const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  required_fields: 'Required Fields',
  field_value: 'Field Value Check',
  permission: 'Permission Required',
  assignee: 'Assignee Check',
  reporter: 'Reporter Check',
  resolution: 'Resolution Required',
  custom_script: 'Custom Script',
  linked_issues: 'Linked Issues Check',
  subtasks_done: 'Subtasks Completed',
  time_logged: 'Time Logged',
  approval: 'Approval Required',
};

export const VALIDATOR_TYPE_LABELS: Record<ValidatorType, string> = {
  validate_regex: 'Regular Expression',
  validate_date_range: 'Date Range',
  validate_numeric_range: 'Numeric Range',
  validate_email: 'Email Format',
  validate_url: 'URL Format',
  validate_custom: 'Custom Validation',
};

export const POSTFUNCTION_TYPE_LABELS: Record<PostFunctionType, string> = {
  set_field: 'Set Field Value',
  copy_field: 'Copy Field',
  clear_field: 'Clear Field',
  assign_to_reporter: 'Assign to Reporter',
  assign_to_lead: 'Assign to Project Lead',
  unassign: 'Remove Assignee',
  add_comment: 'Add Comment',
  add_watcher: 'Add Watcher',
  send_notification: 'Send Notification',
  update_parent: 'Update Parent Issue',
  trigger_webhook: 'Trigger Webhook',
};

interface SingleResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const transitionConditionsApi = createApi({
  reducerPath: 'transitionConditionsApi',
  baseQuery: createAuthBaseQuery('/api/v1/workflow-config'),
  tagTypes: ['Condition', 'Validator', 'PostFunction', 'ApprovalConfig'],
  endpoints: (builder) => ({
    // Reference data
    getConditionTypes: builder.query<{ type: ConditionType; description: string }[], void>({
      query: () => '/condition-types',
      transformResponse: (response: SingleResponse<any[]>) => response.data,
    }),

    getValidatorTypes: builder.query<{ type: ValidatorType; description: string }[], void>({
      query: () => '/validator-types',
      transformResponse: (response: SingleResponse<any[]>) => response.data,
    }),

    getPostFunctionTypes: builder.query<{ type: PostFunctionType; description: string }[], void>({
      query: () => '/postfunction-types',
      transformResponse: (response: SingleResponse<any[]>) => response.data,
    }),

    // Conditions
    getConditions: builder.query<TransitionCondition[], string>({
      query: (transitionId) => `/transitions/${transitionId}/conditions`,
      transformResponse: (response: SingleResponse<TransitionCondition[]>) => response.data,
      providesTags: (_, __, transitionId) => [{ type: 'Condition', id: transitionId }],
    }),

    createCondition: builder.mutation<
      TransitionCondition,
      { transitionId: string; input: CreateConditionInput }
    >({
      query: ({ transitionId, input }) => ({
        url: `/transitions/${transitionId}/conditions`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (response: SingleResponse<TransitionCondition>) => response.data,
      invalidatesTags: (_, __, { transitionId }) => [{ type: 'Condition', id: transitionId }],
    }),

    updateCondition: builder.mutation<
      TransitionCondition,
      { conditionId: string; transitionId: string; input: Partial<CreateConditionInput> & { isEnabled?: boolean } }
    >({
      query: ({ conditionId, input }) => ({
        url: `/conditions/${conditionId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (response: SingleResponse<TransitionCondition>) => response.data,
      invalidatesTags: (_, __, { transitionId }) => [{ type: 'Condition', id: transitionId }],
    }),

    deleteCondition: builder.mutation<void, { conditionId: string; transitionId: string }>({
      query: ({ conditionId }) => ({
        url: `/conditions/${conditionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_, __, { transitionId }) => [{ type: 'Condition', id: transitionId }],
    }),

    // Validators
    getValidators: builder.query<TransitionValidator[], string>({
      query: (transitionId) => `/transitions/${transitionId}/validators`,
      transformResponse: (response: SingleResponse<TransitionValidator[]>) => response.data,
      providesTags: (_, __, transitionId) => [{ type: 'Validator', id: transitionId }],
    }),

    createValidator: builder.mutation<
      TransitionValidator,
      { transitionId: string; input: CreateValidatorInput }
    >({
      query: ({ transitionId, input }) => ({
        url: `/transitions/${transitionId}/validators`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (response: SingleResponse<TransitionValidator>) => response.data,
      invalidatesTags: (_, __, { transitionId }) => [{ type: 'Validator', id: transitionId }],
    }),

    updateValidator: builder.mutation<
      TransitionValidator,
      { validatorId: string; transitionId: string; input: Partial<CreateValidatorInput> & { isEnabled?: boolean } }
    >({
      query: ({ validatorId, input }) => ({
        url: `/validators/${validatorId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (response: SingleResponse<TransitionValidator>) => response.data,
      invalidatesTags: (_, __, { transitionId }) => [{ type: 'Validator', id: transitionId }],
    }),

    deleteValidator: builder.mutation<void, { validatorId: string; transitionId: string }>({
      query: ({ validatorId }) => ({
        url: `/validators/${validatorId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_, __, { transitionId }) => [{ type: 'Validator', id: transitionId }],
    }),

    // Post Functions
    getPostFunctions: builder.query<TransitionPostFunction[], string>({
      query: (transitionId) => `/transitions/${transitionId}/postfunctions`,
      transformResponse: (response: SingleResponse<TransitionPostFunction[]>) => response.data,
      providesTags: (_, __, transitionId) => [{ type: 'PostFunction', id: transitionId }],
    }),

    createPostFunction: builder.mutation<
      TransitionPostFunction,
      { transitionId: string; input: CreatePostFunctionInput }
    >({
      query: ({ transitionId, input }) => ({
        url: `/transitions/${transitionId}/postfunctions`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (response: SingleResponse<TransitionPostFunction>) => response.data,
      invalidatesTags: (_, __, { transitionId }) => [{ type: 'PostFunction', id: transitionId }],
    }),

    updatePostFunction: builder.mutation<
      TransitionPostFunction,
      { postFunctionId: string; transitionId: string; input: Partial<CreatePostFunctionInput> & { isEnabled?: boolean } }
    >({
      query: ({ postFunctionId, input }) => ({
        url: `/postfunctions/${postFunctionId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (response: SingleResponse<TransitionPostFunction>) => response.data,
      invalidatesTags: (_, __, { transitionId }) => [{ type: 'PostFunction', id: transitionId }],
    }),

    deletePostFunction: builder.mutation<void, { postFunctionId: string; transitionId: string }>({
      query: ({ postFunctionId }) => ({
        url: `/postfunctions/${postFunctionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_, __, { transitionId }) => [{ type: 'PostFunction', id: transitionId }],
    }),

    // Approval Config
    getApprovalConfig: builder.query<TransitionApprovalConfig | null, string>({
      query: (transitionId) => `/transitions/${transitionId}/approval`,
      transformResponse: (response: SingleResponse<TransitionApprovalConfig | null>) => response.data,
      providesTags: (_, __, transitionId) => [{ type: 'ApprovalConfig', id: transitionId }],
    }),

    setApprovalConfig: builder.mutation<
      TransitionApprovalConfig,
      { transitionId: string; input: CreateApprovalConfigInput }
    >({
      query: ({ transitionId, input }) => ({
        url: `/transitions/${transitionId}/approval`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (response: SingleResponse<TransitionApprovalConfig>) => response.data,
      invalidatesTags: (_, __, { transitionId }) => [{ type: 'ApprovalConfig', id: transitionId }],
    }),

    removeApprovalConfig: builder.mutation<void, string>({
      query: (transitionId) => ({
        url: `/transitions/${transitionId}/approval`,
        method: 'DELETE',
      }),
      invalidatesTags: (_, __, transitionId) => [{ type: 'ApprovalConfig', id: transitionId }],
    }),
  }),
});

export const {
  useGetConditionTypesQuery,
  useGetValidatorTypesQuery,
  useGetPostFunctionTypesQuery,
  useGetConditionsQuery,
  useCreateConditionMutation,
  useUpdateConditionMutation,
  useDeleteConditionMutation,
  useGetValidatorsQuery,
  useCreateValidatorMutation,
  useUpdateValidatorMutation,
  useDeleteValidatorMutation,
  useGetPostFunctionsQuery,
  useCreatePostFunctionMutation,
  useUpdatePostFunctionMutation,
  useDeletePostFunctionMutation,
  useGetApprovalConfigQuery,
  useSetApprovalConfigMutation,
  useRemoveApprovalConfigMutation,
} = transitionConditionsApi;
