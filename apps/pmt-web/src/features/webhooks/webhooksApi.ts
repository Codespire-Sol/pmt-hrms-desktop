import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';
import type {
  WebhookWithCreator,
  WebhookDelivery,
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookEventInfo,
  DeliveryStatus,
  WebhookEventType,
} from './types';

interface PaginatedResponse<T> {
  success: boolean;
  data: {
    webhooks?: T[];
    deliveries?: T[];
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

interface GetWebhooksParams {
  projectId: string;
  isEnabled?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

interface GetDeliveriesParams {
  webhookId: string;
  status?: DeliveryStatus;
  eventType?: WebhookEventType;
  page?: number;
  limit?: number;
}

export const webhooksApi = createApi({
  reducerPath: 'webhooksApi',
  baseQuery: createAuthBaseQuery('/api/v1/webhooks'),
  tagTypes: ['Webhook', 'WebhookDelivery', 'WebhookEvents'],
  endpoints: (builder) => ({
    // Reference data
    getAvailableEvents: builder.query<WebhookEventInfo[], void>({
      query: () => '/events',
      transformResponse: (response: SingleResponse<WebhookEventInfo[]>) => response.data,
      providesTags: ['WebhookEvents'],
    }),

    // Webhook CRUD
    getWebhooks: builder.query<
      { webhooks: WebhookWithCreator[]; pagination: any },
      GetWebhooksParams
    >({
      query: ({ projectId, ...params }) => ({
        url: `/projects/${projectId}/webhooks`,
        params,
      }),
      transformResponse: (response: PaginatedResponse<WebhookWithCreator>) => ({
        webhooks: response.data.webhooks || [],
        pagination: response.data.pagination,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.webhooks.map(({ id }) => ({ type: 'Webhook' as const, id })),
              { type: 'Webhook', id: 'LIST' },
            ]
          : [{ type: 'Webhook', id: 'LIST' }],
    }),

    getWebhook: builder.query<WebhookWithCreator, string>({
      query: (webhookId) => `/webhooks/${webhookId}`,
      transformResponse: (response: SingleResponse<WebhookWithCreator>) => response.data,
      providesTags: (_, __, id) => [{ type: 'Webhook', id }],
    }),

    createWebhook: builder.mutation<
      WebhookWithCreator,
      { projectId: string; input: CreateWebhookInput }
    >({
      query: ({ projectId, input }) => ({
        url: `/projects/${projectId}/webhooks`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (response: SingleResponse<WebhookWithCreator>) => response.data,
      invalidatesTags: [{ type: 'Webhook', id: 'LIST' }],
    }),

    updateWebhook: builder.mutation<
      WebhookWithCreator,
      { webhookId: string; input: UpdateWebhookInput }
    >({
      query: ({ webhookId, input }) => ({
        url: `/webhooks/${webhookId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (response: SingleResponse<WebhookWithCreator>) => response.data,
      invalidatesTags: (_, __, { webhookId }) => [
        { type: 'Webhook', id: webhookId },
        { type: 'Webhook', id: 'LIST' },
      ],
    }),

    deleteWebhook: builder.mutation<void, string>({
      query: (webhookId) => ({
        url: `/webhooks/${webhookId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Webhook', id: 'LIST' }],
    }),

    toggleWebhook: builder.mutation<WebhookWithCreator, { webhookId: string; isEnabled: boolean }>({
      query: ({ webhookId, isEnabled }) => ({
        url: `/webhooks/${webhookId}/toggle`,
        method: 'POST',
        body: { isEnabled },
      }),
      transformResponse: (response: SingleResponse<WebhookWithCreator>) => response.data,
      invalidatesTags: (_, __, { webhookId }) => [
        { type: 'Webhook', id: webhookId },
        { type: 'Webhook', id: 'LIST' },
      ],
    }),

    testWebhook: builder.mutation<{ message: string }, string>({
      query: (webhookId) => ({
        url: `/webhooks/${webhookId}/test`,
        method: 'POST',
      }),
      invalidatesTags: (_, __, webhookId) => [{ type: 'WebhookDelivery', id: webhookId }],
    }),

    // Delivery history
    getDeliveries: builder.query<
      { deliveries: WebhookDelivery[]; pagination: any },
      GetDeliveriesParams
    >({
      query: ({ webhookId, ...params }) => ({
        url: `/webhooks/${webhookId}/deliveries`,
        params,
      }),
      transformResponse: (response: PaginatedResponse<WebhookDelivery>) => ({
        deliveries: response.data.deliveries || [],
        pagination: response.data.pagination,
      }),
      providesTags: (_, __, { webhookId }) => [{ type: 'WebhookDelivery', id: webhookId }],
    }),

    retryDelivery: builder.mutation<{ message: string }, string>({
      query: (deliveryId) => ({
        url: `/deliveries/${deliveryId}/retry`,
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useGetAvailableEventsQuery,
  useGetWebhooksQuery,
  useGetWebhookQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useDeleteWebhookMutation,
  useToggleWebhookMutation,
  useTestWebhookMutation,
  useGetDeliveriesQuery,
  useRetryDeliveryMutation,
} = webhooksApi;
