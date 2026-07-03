import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';
import type { WebhookEventType } from '@/features/webhooks/types';

export interface TeamsConfig {
  projectId: string;
  webhookUrl: string;
  isEnabled: boolean;
  events: WebhookEventType[];
  notifyOnMention: boolean;
  includeIssueDetails: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamsConfigStatus {
  connected: boolean;
  config: TeamsConfig | null;
}

export interface ConnectTeamsInput {
  webhookUrl: string;
  events?: WebhookEventType[];
  includeIssueDetails?: boolean;
  notifyOnMention?: boolean;
  /** If true (default), send a test card before saving to validate the URL */
  validate?: boolean;
}

export interface UpdateTeamsConfigInput {
  webhookUrl?: string;
  events?: WebhookEventType[];
  includeIssueDetails?: boolean;
  notifyOnMention?: boolean;
  isEnabled?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const teamsApi = createApi({
  reducerPath: 'teamsApi',
  baseQuery: createAuthBaseQuery('/api/v1/integrations/teams'),
  tagTypes: ['TeamsConfig'],
  endpoints: (builder) => ({
    getTeamsStatus: builder.query<TeamsConfigStatus, string>({
      query: (projectId) => `/${projectId}/status`,
      transformResponse: (r: ApiResponse<TeamsConfigStatus>) => r.data,
      providesTags: (_, __, projectId) => [{ type: 'TeamsConfig', id: projectId }],
    }),

    getTeamsConfig: builder.query<TeamsConfig, string>({
      query: (projectId) => `/${projectId}/config`,
      transformResponse: (r: ApiResponse<TeamsConfig>) => r.data,
      providesTags: (_, __, projectId) => [{ type: 'TeamsConfig', id: projectId }],
    }),

    connectTeams: builder.mutation<TeamsConfig, { projectId: string; input: ConnectTeamsInput }>({
      query: ({ projectId, input }) => ({
        url: `/${projectId}/connect`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (r: ApiResponse<TeamsConfig>) => r.data,
      invalidatesTags: (_, __, { projectId }) => [{ type: 'TeamsConfig', id: projectId }],
    }),

    updateTeamsConfig: builder.mutation<
      TeamsConfig,
      { projectId: string; input: UpdateTeamsConfigInput }
    >({
      query: ({ projectId, input }) => ({
        url: `/${projectId}/config`,
        method: 'PUT',
        body: input,
      }),
      transformResponse: (r: ApiResponse<TeamsConfig>) => r.data,
      invalidatesTags: (_, __, { projectId }) => [{ type: 'TeamsConfig', id: projectId }],
    }),

    toggleTeams: builder.mutation<TeamsConfig, { projectId: string; isEnabled: boolean }>({
      query: ({ projectId, isEnabled }) => ({
        url: `/${projectId}/toggle`,
        method: 'PATCH',
        body: { isEnabled },
      }),
      transformResponse: (r: ApiResponse<TeamsConfig>) => r.data,
      invalidatesTags: (_, __, { projectId }) => [{ type: 'TeamsConfig', id: projectId }],
    }),

    testTeams: builder.mutation<{ message: string }, string>({
      query: (projectId) => ({
        url: `/${projectId}/test`,
        method: 'POST',
      }),
      transformResponse: (r: ApiResponse<any>) => ({ message: r.message || 'Test sent' }),
    }),

    disconnectTeams: builder.mutation<void, string>({
      query: (projectId) => ({
        url: `/${projectId}/disconnect`,
        method: 'DELETE',
      }),
      invalidatesTags: (_, __, projectId) => [{ type: 'TeamsConfig', id: projectId }],
    }),

    validateTeamsUrl: builder.mutation<{ success: boolean; message: string }, string>({
      query: (webhookUrl) => ({
        url: '/validate-url',
        method: 'POST',
        body: { webhookUrl },
      }),
    }),
  }),
});

export const {
  useGetTeamsStatusQuery,
  useGetTeamsConfigQuery,
  useConnectTeamsMutation,
  useUpdateTeamsConfigMutation,
  useToggleTeamsMutation,
  useTestTeamsMutation,
  useDisconnectTeamsMutation,
  useValidateTeamsUrlMutation,
} = teamsApi;
