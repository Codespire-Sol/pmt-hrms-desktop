import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';
import {
  ProjectBudget,
  ResourceRate,
  BurnoutChartPoint,
  BudgetSummary,
  CostBreakdown,
  BudgetVsActual,
  BudgetAlert,
  UpsertBudgetInput,
  CreateResourceRateInput,
  UpdateResourceRateInput,
  AIFinancialInsight,
} from './types';

export const financialApi = createApi({
  reducerPath: 'financialApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Budget', 'ResourceRates', 'BurnoutChart', 'BudgetAlerts', 'CostBreakdown', 'BudgetVsActual'],
  endpoints: (builder) => ({
    // Budget
    getProjectBudget: builder.query<ProjectBudget | null, string>({
      query: (projectId) => `/projects/${projectId}/budget`,
      transformResponse: (res: { data: ProjectBudget | null }) => res.data,
      providesTags: (_result, _err, projectId) => [{ type: 'Budget', id: projectId }],
    }),

    upsertProjectBudget: builder.mutation<ProjectBudget, { projectId: string; data: UpsertBudgetInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/budget`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (res: { data: ProjectBudget }) => res.data,
      invalidatesTags: (_result, _err, { projectId }) => [
        { type: 'Budget', id: projectId },
        { type: 'BurnoutChart', id: projectId },
        { type: 'BudgetVsActual', id: projectId },
      ],
    }),

    // Resource Rates
    getResourceRates: builder.query<ResourceRate[], string>({
      query: (projectId) => `/projects/${projectId}/resource-rates`,
      transformResponse: (res: { data: ResourceRate[] }) => res.data,
      providesTags: (_result, _err, projectId) => [{ type: 'ResourceRates', id: projectId }],
    }),

    createResourceRate: builder.mutation<ResourceRate, { projectId: string; data: CreateResourceRateInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/resource-rates`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (res: { data: ResourceRate }) => res.data,
      invalidatesTags: (_result, _err, { projectId }) => [
        { type: 'ResourceRates', id: projectId },
        { type: 'BurnoutChart', id: projectId },
        { type: 'CostBreakdown', id: projectId },
        { type: 'BudgetVsActual', id: projectId },
      ],
    }),

    updateResourceRate: builder.mutation<ResourceRate, { projectId: string; rateId: string; data: UpdateResourceRateInput }>({
      query: ({ projectId, rateId, data }) => ({
        url: `/projects/${projectId}/resource-rates/${rateId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (res: { data: ResourceRate }) => res.data,
      invalidatesTags: (_result, _err, { projectId }) => [
        { type: 'ResourceRates', id: projectId },
        { type: 'Budget', id: projectId },
        { type: 'BurnoutChart', id: projectId },
        { type: 'CostBreakdown', id: projectId },
        { type: 'BudgetVsActual', id: projectId },
      ],
    }),

    deleteResourceRate: builder.mutation<void, { projectId: string; rateId: string }>({
      query: ({ projectId, rateId }) => ({
        url: `/projects/${projectId}/resource-rates/${rateId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _err, { projectId }) => [
        { type: 'ResourceRates', id: projectId },
        { type: 'Budget', id: projectId },
        { type: 'BurnoutChart', id: projectId },
        { type: 'CostBreakdown', id: projectId },
        { type: 'BudgetVsActual', id: projectId },
      ],
    }),

    // Analytics
    getBurnoutChart: builder.query<
      BurnoutChartPoint[],
      { projectId: string; granularity?: 'weekly' | 'monthly'; startDate?: string; endDate?: string }
    >({
      query: ({ projectId, granularity = 'weekly', startDate, endDate }) => {
        const params = new URLSearchParams();
        params.set('granularity', granularity);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        return `/projects/${projectId}/burnout-chart?${params.toString()}`;
      },
      transformResponse: (res: { data: BurnoutChartPoint[] }) => res.data,
      providesTags: (_result, _err, { projectId }) => [{ type: 'BurnoutChart', id: projectId }],
    }),

    getBudgetSummary: builder.query<BudgetSummary, string>({
      query: (projectId) => `/projects/${projectId}/budget-summary`,
      transformResponse: (res: { data: BudgetSummary }) => res.data,
      providesTags: (_result, _err, projectId) => [{ type: 'Budget', id: projectId }],
    }),

    getCostBreakdown: builder.query<
      CostBreakdown[],
      { projectId: string; userId?: string; role?: string; startDate?: string; endDate?: string }
    >({
      query: ({ projectId, userId, role, startDate, endDate }) => {
        const params = new URLSearchParams();
        if (userId) params.set('userId', userId);
        if (role) params.set('role', role);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        return `/projects/${projectId}/cost-breakdown?${params.toString()}`;
      },
      transformResponse: (res: { data: CostBreakdown[] }) => res.data,
      providesTags: (_result, _err, { projectId }) => [{ type: 'CostBreakdown', id: projectId }],
    }),

    getBudgetVsActual: builder.query<BudgetVsActual[], string>({
      query: (projectId) => `/projects/${projectId}/budget-vs-actual`,
      transformResponse: (res: { data: BudgetVsActual[] }) => res.data,
      providesTags: (_result, _err, projectId) => [{ type: 'BudgetVsActual', id: projectId }],
    }),

    // Alerts
    getBudgetAlerts: builder.query<BudgetAlert[], string>({
      query: (projectId) => `/projects/${projectId}/budget-alerts`,
      transformResponse: (res: { data: BudgetAlert[] }) => res.data,
      providesTags: (_result, _err, projectId) => [{ type: 'BudgetAlerts', id: projectId }],
    }),

    markAlertsRead: builder.mutation<void, string>({
      query: (projectId) => ({
        url: `/projects/${projectId}/budget-alerts/mark-read`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, projectId) => [{ type: 'BudgetAlerts', id: projectId }],
    }),

    // AI
    getAIFinancialAnalysis: builder.mutation<AIFinancialInsight, { metrics: Record<string, unknown>; context?: string }>({
      query: (body) => ({
        url: '/ai/reports/financial-analysis',
        method: 'POST',
        body,
      }),
      transformResponse: (res: any) => res.data ?? res,
    }),

    getBudgetForecast: builder.mutation<AIFinancialInsight, { reportData: Record<string, unknown>; audience?: string }>({
      query: (body) => ({
        url: '/ai/predictions/budget-forecast',
        method: 'POST',
        body,
      }),
      transformResponse: (res: any) => res.data ?? res,
    }),
  }),
});

export const {
  useGetProjectBudgetQuery,
  useUpsertProjectBudgetMutation,
  useGetResourceRatesQuery,
  useCreateResourceRateMutation,
  useUpdateResourceRateMutation,
  useDeleteResourceRateMutation,
  useGetBurnoutChartQuery,
  useGetBudgetSummaryQuery,
  useGetCostBreakdownQuery,
  useGetBudgetVsActualQuery,
  useGetBudgetAlertsQuery,
  useMarkAlertsReadMutation,
  useGetAIFinancialAnalysisMutation,
  useGetBudgetForecastMutation,
} = financialApi;
