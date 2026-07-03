import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '@/lib/baseQuery';
import {
  SprintReport,
  SprintBurndown,
  TeamWorkloadReport,
  TimeTrackingReport,
  IssueDistributionReport,
} from './types';


export interface ControlChartPoint {
  issueId: string;
  issueKey: string;
  completedAt: string;
  cycleTimeDays: number;
}

export interface ControlChartData {
  projectId: string;
  projectName: string;
  dateRange: { startDate: string; endDate: string };
  points: ControlChartPoint[];
  percentiles: { p50: number; p75: number; p95: number };
}

export interface EpicReportIssue {
  id: string; issueKey: string; title: string;
  status: string | null; statusCategory: string | null;
  priority: string | null; assignee: string | null;
  storyPoints: number | null; completedAt: string | null;
}

export interface EpicReport {
  epic: { id: string; name: string; color: string; status: string; startDate: string | null; endDate: string | null };
  stats: { totalIssues: number; completedIssues: number; inProgressIssues: number; todoIssues: number; totalStoryPoints: number; completedStoryPoints: number; progress: number };
  burndown: Array<{ date: string; completed: number; remaining: number; total: number }>;
  issues: EpicReportIssue[];
}

export interface VersionReportIssue {
  id: string; issueKey: string; title: string;
  type: string | null; status: string | null; statusCategory: string | null;
  priority: string | null; assignee: string | null;
  storyPoints: number | null; completedAt: string | null;
}

export interface VersionReport {
  version: { id: string; name: string; status: string; releaseDate: string | null; startDate: string | null };
  stats: { totalIssues: number; completedIssues: number; inProgressIssues: number; todoIssues: number; totalStoryPoints: number; completedStoryPoints: number; progress: number };
  scopeTimeline: Array<{ date: string; total: number; completed: number }>;
  issues: VersionReportIssue[];
}

export const reportsApi = createApi({
  reducerPath: 'reportsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['SprintReport', 'TeamWorkload', 'TimeTracking', 'Distribution', 'ControlChart', 'EpicReport', 'VersionReport'],
  endpoints: (builder) => ({
    // Get sprint report for a project
    getSprintReport: builder.query<SprintReport, string>({
      query: (projectId) => `/projects/${projectId}/reports/sprint`,
      transformResponse: (response: { success: boolean; data: SprintReport }) =>
        response.data,
      providesTags: (_result, _error, projectId) => [
        { type: 'SprintReport', id: projectId },
      ],
    }),

    // Get sprint burndown
    getSprintBurndown: builder.query<SprintBurndown, string>({
      query: (sprintId) => `/sprints/${sprintId}/reports/burndown`,
      transformResponse: (response: { success: boolean; data: SprintBurndown }) =>
        response.data,
    }),

    // Get team workload report
    getTeamWorkloadReport: builder.query<
      TeamWorkloadReport,
      { projectId: string; startDate?: string; endDate?: string }
    >({
      query: ({ projectId, startDate, endDate }) => {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        return `/projects/${projectId}/reports/team-workload?${params.toString()}`;
      },
      transformResponse: (response: { success: boolean; data: TeamWorkloadReport }) =>
        response.data,
      providesTags: (_result, _error, { projectId }) => [
        { type: 'TeamWorkload', id: projectId },
      ],
    }),

    // Get time tracking report
    getTimeTrackingReport: builder.query<
      TimeTrackingReport,
      { startDate?: string; endDate?: string; projectId?: string }
    >({
      query: ({ startDate, endDate, projectId }) => {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (projectId) params.set('projectId', projectId);
        return `/reports/time-tracking?${params.toString()}`;
      },
      transformResponse: (response: { success: boolean; data: TimeTrackingReport }) =>
        response.data,
      providesTags: ['TimeTracking'],
    }),

    // Get issue distribution report
    getIssueDistributionReport: builder.query<IssueDistributionReport, string>({
      query: (projectId) => `/projects/${projectId}/reports/distribution`,
      transformResponse: (response: { success: boolean; data: IssueDistributionReport }) =>
        response.data,
      providesTags: (_result, _error, projectId) => [
        { type: 'Distribution', id: projectId },
      ],
    }),

    // Control Chart
    getControlChartData: builder.query<
      ControlChartData,
      { projectId: string; startDate?: string; endDate?: string }
    >({
      query: ({ projectId, startDate, endDate }) => {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        const qs = params.toString();
        return `/projects/${projectId}/reports/control-chart${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (r: { success: boolean; data: ControlChartData }) => r.data,
      providesTags: (_r, _e, { projectId }) => [{ type: 'ControlChart', id: projectId }],
    }),

    // Epic Report
    getEpicReport: builder.query<EpicReport, string>({
      query: (epicId) => `/epics/${epicId}/reports`,
      transformResponse: (r: { success: boolean; data: EpicReport }) => r.data,
      providesTags: (_r, _e, epicId) => [{ type: 'EpicReport', id: epicId }],
    }),

    // Version Report
    getVersionReport: builder.query<VersionReport, string>({
      query: (versionId) => `/versions/${versionId}/reports`,
      transformResponse: (r: { success: boolean; data: VersionReport }) => r.data,
      providesTags: (_r, _e, versionId) => [{ type: 'VersionReport', id: versionId }],
    }),
  }),
});

export const {
  useGetSprintReportQuery,
  useGetSprintBurndownQuery,
  useGetTeamWorkloadReportQuery,
  useGetTimeTrackingReportQuery,
  useGetIssueDistributionReportQuery,
  useGetControlChartDataQuery,
  useGetEpicReportQuery,
  useGetVersionReportQuery,
} = reportsApi;

// Export URLs for CSV download
export const getExportUrls = (_token: string) => ({
  sprintVelocity: (projectId: string, format: 'csv' | 'json' = 'csv') =>
    `/api/v1/projects/${projectId}/reports/sprint/export?format=${format}`,
  teamWorkload: (
    projectId: string,
    startDate?: string,
    endDate?: string,
    format: 'csv' | 'json' = 'csv'
  ) => {
    const params = new URLSearchParams({ format });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return `/api/v1/projects/${projectId}/reports/team-workload/export?${params.toString()}`;
  },
  timeTracking: (
    startDate?: string,
    endDate?: string,
    projectId?: string,
    format: 'csv' | 'json' = 'csv'
  ) => {
    const params = new URLSearchParams({ format });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (projectId) params.set('projectId', projectId);
    return `/api/v1/reports/time-tracking/export?${params.toString()}`;
  },
});
