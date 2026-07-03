import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';
import {
  SlackIntegrationStatus,
  SlackChannelConfig,
  SlackChannel,
  SlackUserMapping,
  InstallSlackInput,
  ConfigureChannelInput,
  UpdateChannelConfigInput,
  LinkSlackUserInput,
  SendTestNotificationInput,
} from './types';


export const slackApi = createApi({
  reducerPath: 'slackApi',
  baseQuery: createAuthBaseQuery('/api/v1/integrations/slack'),
  tagTypes: ['SlackStatus', 'SlackChannels', 'SlackUserMapping'],
  endpoints: (builder) => ({
    // Get OAuth URL
    getSlackOAuthUrl: builder.query<
      { url: string },
      { projectId: string; redirectUri: string }
    >({
      query: ({ projectId, redirectUri }) => ({
        url: `/${projectId}/oauth-url`,
        params: { redirectUri },
      }),
      transformResponse: (response: { data: { url: string } }) => response.data,
    }),

    // Install Slack
    installSlack: builder.mutation<
      { workspace: { id: string; teamName: string } },
      { projectId: string } & InstallSlackInput
    >({
      query: ({ projectId, ...body }) => ({
        url: `/${projectId}/install`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: { workspace: { id: string; teamName: string } } }) =>
        response.data,
      invalidatesTags: ['SlackStatus'],
    }),

    // Disconnect Slack
    disconnectSlack: builder.mutation<{ disconnected: boolean }, string>({
      query: (projectId) => ({
        url: `/${projectId}/disconnect`,
        method: 'DELETE',
      }),
      transformResponse: (response: { data: { disconnected: boolean } }) => response.data,
      invalidatesTags: ['SlackStatus', 'SlackChannels', 'SlackUserMapping'],
    }),

    // Get Integration Status
    getSlackStatus: builder.query<SlackIntegrationStatus, string>({
      query: (projectId) => `/${projectId}/status`,
      transformResponse: (response: { data: SlackIntegrationStatus }) => response.data,
      providesTags: ['SlackStatus'],
    }),

    // List Available Channels
    listSlackChannels: builder.query<{ channels: SlackChannel[] }, string>({
      query: (projectId) => `/${projectId}/channels`,
      transformResponse: (response: { data: { channels: SlackChannel[] } }) => response.data,
      providesTags: ['SlackChannels'],
    }),

    // Get Channel Configs
    getChannelConfigs: builder.query<{ configs: SlackChannelConfig[] }, string>({
      query: (projectId) => `/${projectId}/channel-configs`,
      transformResponse: (response: { data: { configs: SlackChannelConfig[] } }) =>
        response.data,
      providesTags: ['SlackChannels'],
    }),

    // Configure Channel
    configureChannel: builder.mutation<
      SlackChannelConfig,
      { projectId: string } & ConfigureChannelInput
    >({
      query: ({ projectId, ...body }) => ({
        url: `/${projectId}/channel-configs`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SlackChannelConfig }) => response.data,
      invalidatesTags: ['SlackChannels', 'SlackStatus'],
    }),

    // Update Channel Config
    updateChannelConfig: builder.mutation<
      SlackChannelConfig,
      { projectId: string; channelConfigId: string } & UpdateChannelConfigInput
    >({
      query: ({ projectId, channelConfigId, ...body }) => ({
        url: `/${projectId}/channel-configs/${channelConfigId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response: { data: SlackChannelConfig }) => response.data,
      invalidatesTags: ['SlackChannels', 'SlackStatus'],
    }),

    // Remove Channel
    removeChannel: builder.mutation<
      { removed: boolean },
      { projectId: string; channelConfigId: string }
    >({
      query: ({ projectId, channelConfigId }) => ({
        url: `/${projectId}/channel-configs/${channelConfigId}`,
        method: 'DELETE',
      }),
      transformResponse: (response: { data: { removed: boolean } }) => response.data,
      invalidatesTags: ['SlackChannels', 'SlackStatus'],
    }),

    // Get User Mapping
    getUserMapping: builder.query<{ mapping: SlackUserMapping | null }, string>({
      query: (projectId) => `/${projectId}/user-mapping`,
      transformResponse: (response: { data: { mapping: SlackUserMapping | null } }) =>
        response.data,
      providesTags: ['SlackUserMapping'],
    }),

    // Link Slack User
    linkSlackUser: builder.mutation<
      SlackUserMapping,
      { projectId: string } & LinkSlackUserInput
    >({
      query: ({ projectId, ...body }) => ({
        url: `/${projectId}/user-mapping`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SlackUserMapping }) => response.data,
      invalidatesTags: ['SlackUserMapping'],
    }),

    // Unlink Slack User
    unlinkSlackUser: builder.mutation<{ unlinked: boolean }, string>({
      query: (projectId) => ({
        url: `/${projectId}/user-mapping`,
        method: 'DELETE',
      }),
      transformResponse: (response: { data: { unlinked: boolean } }) => response.data,
      invalidatesTags: ['SlackUserMapping'],
    }),

    // Send Test Notification
    sendTestNotification: builder.mutation<
      { sent: boolean },
      { projectId: string } & SendTestNotificationInput
    >({
      query: ({ projectId, ...body }) => ({
        url: `/${projectId}/test-notification`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: { sent: boolean } }) => response.data,
    }),
  }),
});

export const {
  useGetSlackOAuthUrlQuery,
  useLazyGetSlackOAuthUrlQuery,
  useInstallSlackMutation,
  useDisconnectSlackMutation,
  useGetSlackStatusQuery,
  useListSlackChannelsQuery,
  useGetChannelConfigsQuery,
  useConfigureChannelMutation,
  useUpdateChannelConfigMutation,
  useRemoveChannelMutation,
  useGetUserMappingQuery,
  useLinkSlackUserMutation,
  useUnlinkSlackUserMutation,
  useSendTestNotificationMutation,
} = slackApi;
