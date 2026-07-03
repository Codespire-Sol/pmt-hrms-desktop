import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';
import {
  NotificationPreference,
  NotificationTypeInfo,
  NotificationsResponse,
  UpdatePreferenceInput,
} from './types';


export const notificationsApi = createApi({
  reducerPath: 'notificationsApi',
  baseQuery: createAuthBaseQuery('/api/v1/notifications'),
  tagTypes: ['Notifications', 'NotificationPreferences', 'UnreadCount'],
  endpoints: (builder) => ({
    // Get user's notifications
    getNotifications: builder.query<
      NotificationsResponse,
      { unreadOnly?: boolean; limit?: number; offset?: number }
    >({
      query: ({ unreadOnly = false, limit = 20, offset = 0 }) => ({
        url: '',
        params: {
          unreadOnly: unreadOnly.toString(),
          limit: limit.toString(),
          offset: offset.toString(),
          module: 'toolkit',
        },
      }),
      transformResponse: (response: { success: boolean; data: NotificationsResponse }) =>
        response.data,
      providesTags: (result) =>
        result
          ? [
              ...result.notifications.map(({ id }) => ({
                type: 'Notifications' as const,
                id,
              })),
              { type: 'Notifications', id: 'LIST' },
            ]
          : [{ type: 'Notifications', id: 'LIST' }],
    }),

    // Get unread count
    getUnreadCount: builder.query<number, void>({
      query: () => ({
        url: '/unread-count',
        params: { module: 'toolkit' },
      }),
      transformResponse: (response: { success: boolean; data: { count: number } }) =>
        response.data.count,
      providesTags: ['UnreadCount'],
    }),

    // Get notification types
    getNotificationTypes: builder.query<NotificationTypeInfo[], void>({
      query: () => '/types',
      transformResponse: (response: { success: boolean; data: { types: NotificationTypeInfo[] } }) =>
        response.data.types,
    }),

    // Mark notifications as read
    markAsRead: builder.mutation<{ markedCount: number }, string[]>({
      query: (notificationIds) => ({
        url: '/mark-read',
        method: 'POST',
        body: { notificationIds },
      }),
      transformResponse: (response: { success: boolean; data: { markedCount: number } }) =>
        response.data,
      invalidatesTags: (_result, _error, notificationIds) => [
        ...notificationIds.map((id) => ({ type: 'Notifications' as const, id })),
        'UnreadCount',
      ],
    }),

    // Mark all as read
    markAllAsRead: builder.mutation<{ markedCount: number }, void>({
      query: () => ({
        url: '/mark-all-read',
        method: 'POST',
        body: { module: 'toolkit' },
      }),
      transformResponse: (response: { success: boolean; data: { markedCount: number } }) =>
        response.data,
      invalidatesTags: ['Notifications', 'UnreadCount'],
    }),

    // Get user preferences
    getPreferences: builder.query<NotificationPreference[], void>({
      query: () => '/preferences',
      transformResponse: (response: {
        success: boolean;
        data: { preferences: NotificationPreference[] };
      }) => response.data.preferences,
      providesTags: ['NotificationPreferences'],
    }),

    // Update single preference
    updatePreference: builder.mutation<
      NotificationPreference,
      { type: string; inAppEnabled?: boolean; emailEnabled?: boolean }
    >({
      query: ({ type, ...body }) => ({
        url: `/preferences/${type}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response: {
        success: boolean;
        data: { preference: NotificationPreference };
      }) => response.data.preference,
      invalidatesTags: ['NotificationPreferences'],
    }),

    // Update multiple preferences
    updatePreferences: builder.mutation<NotificationPreference[], UpdatePreferenceInput[]>({
      query: (preferences) => ({
        url: '/preferences',
        method: 'PUT',
        body: { preferences },
      }),
      transformResponse: (response: {
        success: boolean;
        data: { preferences: NotificationPreference[] };
      }) => response.data.preferences,
      invalidatesTags: ['NotificationPreferences'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useGetNotificationTypesQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useGetPreferencesQuery,
  useUpdatePreferenceMutation,
  useUpdatePreferencesMutation,
} = notificationsApi;
