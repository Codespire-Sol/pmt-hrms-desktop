import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';
import {
  CalendarIntegrationStatus,
  CalendarIntegration,
  CalendarListItem,
  CalendarProvider,
  OAuthUrlResponse,
  ConnectCalendarInput,
  SelectCalendarInput,
  UpdateCalendarSettingsInput,
} from './types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const calendarApi = createApi({
  reducerPath: 'calendarApi',
  baseQuery: createAuthBaseQuery('/api/v1/integrations/calendar'),
  tagTypes: ['CalendarStatus', 'CalendarList'],
  endpoints: (builder) => ({
    // Get OAuth URL for connecting
    getOAuthUrl: builder.query<OAuthUrlResponse, { provider: CalendarProvider; returnUrl?: string }>({
      query: ({ provider, returnUrl }) => ({
        url: '/oauth-url',
        params: { provider, returnUrl },
      }),
      transformResponse: (response: ApiResponse<OAuthUrlResponse>) => response.data,
    }),

    // Connect calendar (complete OAuth)
    connectCalendar: builder.mutation<CalendarIntegration, ConnectCalendarInput>({
      query: (data) => ({
        url: '/connect',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<{ integration: CalendarIntegration }>) =>
        response.data.integration,
      invalidatesTags: ['CalendarStatus', 'CalendarList'],
    }),

    // Get integration status
    getCalendarStatus: builder.query<CalendarIntegrationStatus, void>({
      query: () => '/status',
      transformResponse: (response: ApiResponse<CalendarIntegrationStatus>) => response.data,
      providesTags: ['CalendarStatus'],
    }),

    // Update settings
    updateCalendarSettings: builder.mutation<CalendarIntegration, UpdateCalendarSettingsInput>({
      query: (data) => ({
        url: '/settings',
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: ApiResponse<{ integration: CalendarIntegration }>) =>
        response.data.integration,
      invalidatesTags: ['CalendarStatus'],
    }),

    // Disconnect
    disconnectCalendar: builder.mutation<void, void>({
      query: () => ({
        url: '/disconnect',
        method: 'DELETE',
      }),
      invalidatesTags: ['CalendarStatus', 'CalendarList'],
    }),

    // List calendars
    listCalendars: builder.query<CalendarListItem[], void>({
      query: () => '/calendars',
      transformResponse: (response: ApiResponse<{ calendars: CalendarListItem[] }>) =>
        response.data.calendars,
      providesTags: ['CalendarList'],
    }),

    // Select calendar
    selectCalendar: builder.mutation<CalendarIntegration, SelectCalendarInput>({
      query: (data) => ({
        url: '/calendars/select',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: ApiResponse<{ integration: CalendarIntegration }>) =>
        response.data.integration,
      invalidatesTags: ['CalendarStatus'],
    }),
  }),
});

export const {
  useLazyGetOAuthUrlQuery,
  useConnectCalendarMutation,
  useGetCalendarStatusQuery,
  useUpdateCalendarSettingsMutation,
  useDisconnectCalendarMutation,
  useListCalendarsQuery,
  useLazyListCalendarsQuery,
  useSelectCalendarMutation,
} = calendarApi;
