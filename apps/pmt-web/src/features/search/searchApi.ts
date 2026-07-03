import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';
import {
  SearchResponse,
  SearchFilters,
  QuickSearchResult,
  SearchResult,
  SavedFilter,
  FilterVisibility,
  JQLValidationResult,
  JQLExecutionResult,
  FilterSubscription,
  FilterSubscriber,
  CreateFilterInput,
  UpdateFilterInput,
} from './types';


export const searchApi = createApi({
  reducerPath: 'searchApi',
  baseQuery: createAuthBaseQuery('/api/v1/search'),
  tagTypes: ['SavedFilter', 'JQLResult'],
  endpoints: (builder) => ({
    // Full search
    search: builder.query<
      SearchResponse,
      {
        query: string;
        filters?: SearchFilters;
        limit?: number;
        offset?: number;
      }
    >({
      query: ({ query, filters = {}, limit = 20, offset = 0 }) => {
        const params = new URLSearchParams();
        params.set('q', query);
        params.set('limit', limit.toString());
        params.set('offset', offset.toString());

        if (filters.types?.length) {
          params.set('types', filters.types.join(','));
        }
        if (filters.projectIds?.length) {
          params.set('projectIds', filters.projectIds.join(','));
        }
        if (filters.status?.length) {
          params.set('status', filters.status.join(','));
        }
        if (filters.priority?.length) {
          params.set('priority', filters.priority.join(','));
        }
        if (filters.assigneeIds?.length) {
          params.set('assigneeIds', filters.assigneeIds.join(','));
        }
        if (filters.createdAfter) {
          params.set('createdAfter', filters.createdAfter);
        }
        if (filters.createdBefore) {
          params.set('createdBefore', filters.createdBefore);
        }

        return `?${params.toString()}`;
      },
      transformResponse: (response: { success: boolean; data: SearchResponse }) =>
        response.data,
    }),

    // Quick search (for command palette)
    quickSearch: builder.query<QuickSearchResult, string>({
      query: (query) => `/quick?q=${encodeURIComponent(query)}`,
      transformResponse: (response: { success: boolean; data: QuickSearchResult }) =>
        response.data,
    }),

    // Search issues only
    searchIssues: builder.query<
      { results: SearchResult[]; total: number },
      {
        query: string;
        projectIds?: string[];
        status?: string[];
        priority?: string[];
        limit?: number;
        offset?: number;
      }
    >({
      query: ({ query, projectIds, status, priority, limit = 20, offset = 0 }) => {
        const params = new URLSearchParams();
        params.set('q', query);
        params.set('limit', limit.toString());
        params.set('offset', offset.toString());

        if (projectIds?.length) {
          params.set('projectIds', projectIds.join(','));
        }
        if (status?.length) {
          params.set('status', status.join(','));
        }
        if (priority?.length) {
          params.set('priority', priority.join(','));
        }

        return `/issues?${params.toString()}`;
      },
      transformResponse: (response: {
        success: boolean;
        data: { results: SearchResult[]; total: number };
      }) => response.data,
    }),

    // Search projects only
    searchProjects: builder.query<
      { results: SearchResult[]; total: number },
      { query: string; limit?: number; offset?: number }
    >({
      query: ({ query, limit = 20, offset = 0 }) =>
        `/projects?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
      transformResponse: (response: {
        success: boolean;
        data: { results: SearchResult[]; total: number };
      }) => response.data,
    }),

    // Search users only
    searchUsers: builder.query<
      { results: SearchResult[]; total: number },
      { query: string; limit?: number; offset?: number }
    >({
      query: ({ query, limit = 20, offset = 0 }) =>
        `/users?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
      transformResponse: (response: {
        success: boolean;
        data: { results: SearchResult[]; total: number };
      }) => response.data,
    }),

    // JQL Operations
    executeJQL: builder.mutation<JQLExecutionResult, { jql: string; projectId?: string; page?: number; limit?: number }>({
      query: ({ jql, projectId, page, limit }) => ({
        url: '/jql/execute',
        method: 'POST',
        body: { jql },
        params: { projectId, page, limit },
      }),
      transformResponse: (response: { success: boolean; data: JQLExecutionResult }) => response.data,
    }),

    validateJQL: builder.query<JQLValidationResult, string>({
      query: (jql) => ({
        url: '/jql/validate',
        params: { jql },
      }),
      transformResponse: (response: { success: boolean; data: JQLValidationResult }) => response.data,
    }),

    // Saved Filters
    getFilters: builder.query<
      { filters: SavedFilter[]; pagination: any },
      {
        projectId?: string;
        search?: string;
        visibility?: FilterVisibility;
        ownedOnly?: boolean;
        subscribedOnly?: boolean;
        favoritesOnly?: boolean;
        page?: number;
        limit?: number;
      }
    >({
      query: (params) => ({
        url: '/filters',
        params,
      }),
      transformResponse: (response: { success: boolean; data: { filters: SavedFilter[]; pagination: any } }) => response.data,
      providesTags: ['SavedFilter'],
    }),

    getFilter: builder.query<SavedFilter, string>({
      query: (filterId) => `/filters/${filterId}`,
      transformResponse: (response: { success: boolean; data: SavedFilter }) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'SavedFilter', id }],
    }),

    createFilter: builder.mutation<SavedFilter, CreateFilterInput>({
      query: (data) => ({
        url: '/filters',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: { success: boolean; data: SavedFilter }) => response.data,
      invalidatesTags: ['SavedFilter'],
    }),

    updateFilter: builder.mutation<SavedFilter, { filterId: string; data: UpdateFilterInput }>({
      query: ({ filterId, data }) => ({
        url: `/filters/${filterId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: { success: boolean; data: SavedFilter }) => response.data,
      invalidatesTags: (_result, _error, { filterId }) => [{ type: 'SavedFilter', id: filterId }, 'SavedFilter'],
    }),

    deleteFilter: builder.mutation<void, string>({
      query: (filterId) => ({
        url: `/filters/${filterId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['SavedFilter'],
    }),

    executeFilter: builder.query<JQLExecutionResult, { filterId: string; projectId?: string; page?: number; limit?: number }>({
      query: ({ filterId, ...params }) => ({
        url: `/filters/${filterId}/execute`,
        params,
      }),
      transformResponse: (response: { success: boolean; data: JQLExecutionResult }) => response.data,
      providesTags: ['JQLResult'],
    }),

    // Filter Subscriptions
    subscribeToFilter: builder.mutation<FilterSubscription, string>({
      query: (filterId) => ({
        url: `/filters/${filterId}/subscribe`,
        method: 'POST',
      }),
      transformResponse: (response: { success: boolean; data: FilterSubscription }) => response.data,
      invalidatesTags: (_result, _error, filterId) => [{ type: 'SavedFilter', id: filterId }],
    }),

    unsubscribeFromFilter: builder.mutation<void, string>({
      query: (filterId) => ({
        url: `/filters/${filterId}/subscribe`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, filterId) => [{ type: 'SavedFilter', id: filterId }],
    }),

    toggleSubscriptionFavorite: builder.mutation<FilterSubscription, { filterId: string; isFavorite: boolean }>({
      query: ({ filterId, isFavorite }) => ({
        url: `/filters/${filterId}/subscribe`,
        method: 'PATCH',
        body: { isFavorite },
      }),
      transformResponse: (response: { success: boolean; data: FilterSubscription }) => response.data,
      invalidatesTags: (_result, _error, { filterId }) => [{ type: 'SavedFilter', id: filterId }],
    }),

    getFilterSubscribers: builder.query<FilterSubscriber[], string>({
      query: (filterId) => `/filters/${filterId}/subscribers`,
      transformResponse: (response: { success: boolean; data: FilterSubscriber[] }) => response.data,
    }),
  }),
});

export const {
  useSearchQuery,
  useLazySearchQuery,
  useQuickSearchQuery,
  useLazyQuickSearchQuery,
  useSearchIssuesQuery,
  useLazySearchIssuesQuery,
  useSearchProjectsQuery,
  useSearchUsersQuery,
  // JQL hooks
  useExecuteJQLMutation,
  useValidateJQLQuery,
  useLazyValidateJQLQuery,
  // Saved Filter hooks
  useGetFiltersQuery,
  useGetFilterQuery,
  useCreateFilterMutation,
  useUpdateFilterMutation,
  useDeleteFilterMutation,
  useExecuteFilterQuery,
  useLazyExecuteFilterQuery,
  // Subscription hooks
  useSubscribeToFilterMutation,
  useUnsubscribeFromFilterMutation,
  useToggleSubscriptionFavoriteMutation,
  useGetFilterSubscribersQuery,
} = searchApi;
