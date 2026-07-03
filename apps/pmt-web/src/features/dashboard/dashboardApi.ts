import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '@/lib/baseQuery';
import {
  UserDashboard,
  ProjectDashboard,
  AssignedIssue,
  RecentActivity,
  DueSoonIssue,
  DashboardShare,
  DashboardShareWithDetails,
  CreateDashboardShareInput,
  UpdateDashboardShareInput,
  SharedDashboardInfo,
  DashboardPreferences,
  UpdateDashboardPreferencesInput,
  AdminDashboardData,
  ManagerDashboardData,
  EmployeeDashboardData,
  GanttData,
  GanttQueryParams,
  VelocityChartData,
  BurndownData,
  CumulativeFlowPoint,
} from './types';


export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Dashboard', 'ProjectDashboard', 'DashboardShare', 'DashboardPreferences'],
  endpoints: (builder) => ({
    // Get user dashboard
    getUserDashboard: builder.query<UserDashboard, void>({
      query: () => '/dashboard',
      transformResponse: (response: { success: boolean; data: UserDashboard }) =>
        response.data,
      providesTags: ['Dashboard'],
    }),

    // Get assigned issues
    getAssignedIssues: builder.query<AssignedIssue[], { limit?: number }>({
      query: ({ limit = 10 }) => `/dashboard/assigned-issues?limit=${limit}`,
      transformResponse: (response: { success: boolean; data: { issues: AssignedIssue[] } }) =>
        response.data.issues,
      providesTags: ['Dashboard'],
    }),

    // Get recent activity
    getRecentActivity: builder.query<RecentActivity[], { limit?: number }>({
      query: ({ limit = 20 }) => `/dashboard/recent-activity?limit=${limit}`,
      transformResponse: (response: { success: boolean; data: { activity: RecentActivity[] } }) =>
        response.data.activity,
      providesTags: ['Dashboard'],
    }),

    // Get due soon issues
    getDueSoonIssues: builder.query<DueSoonIssue[], { days?: number }>({
      query: ({ days = 7 }) => `/dashboard/due-soon?days=${days}`,
      transformResponse: (response: { success: boolean; data: { issues: DueSoonIssue[] } }) =>
        response.data.issues,
      providesTags: ['Dashboard'],
    }),

    // Get project dashboard
    getProjectDashboard: builder.query<ProjectDashboard, string>({
      query: (projectId) => `/projects/${projectId}/dashboard`,
      transformResponse: (response: { success: boolean; data: ProjectDashboard }) =>
        response.data,
      providesTags: (_result, _error, projectId) => [
        { type: 'ProjectDashboard', id: projectId },
      ],
    }),

    // ========== Dashboard Preferences ==========

    // Get user dashboard preferences
    getDashboardPreferences: builder.query<DashboardPreferences, void>({
      query: () => '/dashboard/preferences',
      transformResponse: (response: { success: boolean; data: DashboardPreferences }) =>
        response.data,
      providesTags: ['DashboardPreferences'],
    }),

    // Update user dashboard preferences
    updateDashboardPreferences: builder.mutation<DashboardPreferences, UpdateDashboardPreferencesInput>({
      query: (input) => ({
        url: '/dashboard/preferences',
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (response: { success: boolean; data: DashboardPreferences }) =>
        response.data,
      invalidatesTags: ['DashboardPreferences'],
    }),

    // Reset user dashboard preferences
    resetDashboardPreferences: builder.mutation<DashboardPreferences, void>({
      query: () => ({
        url: '/dashboard/preferences/reset',
        method: 'POST',
      }),
      transformResponse: (response: { success: boolean; data: DashboardPreferences }) =>
        response.data,
      invalidatesTags: ['DashboardPreferences'],
    }),

    // ========== Dashboard Sharing ==========

    // Share dashboard with a user
    shareDashboard: builder.mutation<DashboardShare, CreateDashboardShareInput>({
      query: (input) => ({
        url: '/dashboard/shares',
        method: 'POST',
        body: input,
      }),
      transformResponse: (response: { success: boolean; data: DashboardShare }) =>
        response.data,
      invalidatesTags: ['DashboardShare'],
    }),

    // Get shares for a dashboard
    getSharesByDashboard: builder.query<DashboardShareWithDetails[], string>({
      query: (dashboardId) => `/dashboard/${dashboardId}/shares`,
      transformResponse: (response: { success: boolean; data: DashboardShareWithDetails[] }) =>
        response.data,
      providesTags: (_result, _error, dashboardId) => [
        { type: 'DashboardShare', id: dashboardId },
        'DashboardShare',
      ],
    }),

    // Get dashboards shared with the current user
    getSharedWithMe: builder.query<SharedDashboardInfo[], void>({
      query: () => '/dashboard/shared-with-me',
      transformResponse: (response: { success: boolean; data: SharedDashboardInfo[] }) =>
        response.data,
      providesTags: ['DashboardShare'],
    }),

    // Get shared dashboard by public token
    getSharedDashboardByToken: builder.query<SharedDashboardInfo, string>({
      query: (token) => `/dashboard/shared/${token}`,
      transformResponse: (response: { success: boolean; data: SharedDashboardInfo }) =>
        response.data,
    }),

    // Update a share
    updateShare: builder.mutation<DashboardShare, { shareId: string; input: UpdateDashboardShareInput }>({
      query: ({ shareId, input }) => ({
        url: `/dashboard/shares/${shareId}`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (response: { success: boolean; data: DashboardShare }) =>
        response.data,
      invalidatesTags: ['DashboardShare'],
    }),

    // Delete a share
    deleteShare: builder.mutation<void, string>({
      query: (shareId) => ({
        url: `/dashboard/shares/${shareId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['DashboardShare'],
    }),

    // Create a public link for a dashboard
    createPublicLink: builder.mutation<DashboardShare, { dashboardId: string; expiresAt?: string }>({
      query: ({ dashboardId, expiresAt }) => ({
        url: `/dashboard/${dashboardId}/public-link`,
        method: 'POST',
        body: expiresAt ? { expiresAt } : {},
      }),
      transformResponse: (response: { success: boolean; data: DashboardShare }) =>
        response.data,
      invalidatesTags: ['DashboardShare'],
    }),

    // Regenerate a public link
    regeneratePublicLink: builder.mutation<DashboardShare, string>({
      query: (shareId) => ({
        url: `/dashboard/shares/${shareId}/regenerate-link`,
        method: 'POST',
      }),
      transformResponse: (response: { success: boolean; data: DashboardShare }) =>
        response.data,
      invalidatesTags: ['DashboardShare'],
    }),

    // ========== Role-Based Dashboards ==========

    getAdminDashboard: builder.query<AdminDashboardData, void>({
      query: () => '/dashboard/admin',
      transformResponse: (response: { success: boolean; data: AdminDashboardData }) =>
        response.data,
      providesTags: ['Dashboard'],
    }),

    getManagerDashboard: builder.query<ManagerDashboardData, void>({
      query: () => '/dashboard/manager',
      transformResponse: (response: { success: boolean; data: ManagerDashboardData }) =>
        response.data,
      providesTags: ['Dashboard'],
    }),

    getEmployeeDashboard: builder.query<EmployeeDashboardData, void>({
      query: () => '/dashboard/employee',
      transformResponse: (response: { success: boolean; data: EmployeeDashboardData }) =>
        response.data,
      providesTags: ['Dashboard'],
    }),

    // ========== Chart Endpoints ==========

    getGanttData: builder.query<GanttData, GanttQueryParams>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.view)               queryParams.set('view', params.view);
        if (params.projectId)          queryParams.set('projectId', params.projectId);
        if (params.projectIds?.length) queryParams.set('projectIds', params.projectIds.join(','));
        if (params.assigneeId)         queryParams.set('assigneeId', params.assigneeId);
        if (params.sprintId)           queryParams.set('sprintId', params.sprintId);
        if (params.epicId)             queryParams.set('epicId', params.epicId);
        return `/dashboard/charts/gantt?${queryParams.toString()}`;
      },
      transformResponse: (response: { success: boolean; data: GanttData }) => response.data,
      providesTags: ['Dashboard'],
    }),

    getVelocityChart: builder.query<VelocityChartData, { projectId: string; limit?: number }>({
      query: ({ projectId, limit = 10 }) =>
        `/dashboard/charts/velocity?projectId=${projectId}&limit=${limit}`,
      transformResponse: (response: { success: boolean; data: VelocityChartData }) =>
        response.data,
      providesTags: ['Dashboard'],
    }),

    getBurndownChart: builder.query<BurndownData, string>({
      query: (sprintId) => `/dashboard/charts/burndown?sprintId=${sprintId}`,
      transformResponse: (response: { success: boolean; data: BurndownData }) => response.data,
      providesTags: ['Dashboard'],
    }),

    getCumulativeFlow: builder.query<CumulativeFlowPoint[], { projectId: string; days?: number }>({
      query: ({ projectId, days = 30 }) =>
        `/dashboard/charts/cumulative-flow?projectId=${projectId}&days=${days}`,
      transformResponse: (response: { success: boolean; data: CumulativeFlowPoint[] }) =>
        response.data,
      providesTags: ['Dashboard'],
    }),
  }),
});

export const {
  useGetUserDashboardQuery,
  useGetAssignedIssuesQuery,
  useGetRecentActivityQuery,
  useGetDueSoonIssuesQuery,
  useGetProjectDashboardQuery,
  // Dashboard Preferences hooks
  useGetDashboardPreferencesQuery,
  useUpdateDashboardPreferencesMutation,
  useResetDashboardPreferencesMutation,
  // Dashboard Sharing hooks
  useShareDashboardMutation,
  useGetSharesByDashboardQuery,
  useGetSharedWithMeQuery,
  useGetSharedDashboardByTokenQuery,
  useUpdateShareMutation,
  useDeleteShareMutation,
  useCreatePublicLinkMutation,
  useRegeneratePublicLinkMutation,
  // Role-Based Dashboard hooks
  useGetAdminDashboardQuery,
  useGetManagerDashboardQuery,
  useGetEmployeeDashboardQuery,
  // Chart hooks
  useGetGanttDataQuery,
  useGetVelocityChartQuery,
  useGetBurndownChartQuery,
  useGetCumulativeFlowQuery,
} = dashboardApi;
