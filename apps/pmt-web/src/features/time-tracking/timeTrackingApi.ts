import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';
import {
  TimeLog,
  ActiveTimer,
  LogTimeRequest,
  UpdateTimeLogRequest,
  StartTimerRequest,
  StopTimerRequest,
  TimesheetResponse,
  ProjectTimeReport,
  UserTimeReport,
  IssueTimeSummary,
  LogTimesheetRequest,
  TimesheetHistoryQuery,
  TimesheetHistoryResponse,
  TimesheetLog,
  TimesheetLogIssueSummary,
  TimesheetSummaryQuery,
  TimesheetSummaryResponse,
  UpdateTimesheetLogRequest,
} from './types';

type TimesheetLogMutationResponse = {
  success: boolean;
  message?: string;
  data: {
    log: TimesheetLog;
    issue?: TimesheetLogIssueSummary;
  };
};

const pickFirst = (...values: any[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const toNumber = (value: any, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value: any): number | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toBoolean = (value: any, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }
  return fallback;
};

const normalizeIssueSummary = (raw: any): TimesheetLogIssueSummary | undefined => {
  if (!raw) {
    return undefined;
  }

  return {
    id: String(pickFirst(raw.id, raw.issueId, raw.issue_id, '')),
    issueKey: String(pickFirst(raw.issueKey, raw.issue_key, '')),
    title: String(pickFirst(raw.title, raw.summary, '')),
    projectId: pickFirst(raw.projectId, raw.project_id),
    projectKey: pickFirst(raw.projectKey, raw.project_key),
    projectName: pickFirst(raw.projectName, raw.project_name),
    originalEstimateHours: toNullableNumber(
      pickFirst(raw.originalEstimateHours, raw.original_estimate_hours)
    ),
    remainingEstimateHours: toNullableNumber(
      pickFirst(raw.remainingEstimateHours, raw.remaining_estimate_hours)
    ),
  };
};

const normalizeTimesheetLog = (raw: any): TimesheetLog => {
  // Prefer the nested issue object; fall back to flat fields the history endpoint returns
  const issueFromNested = normalizeIssueSummary(raw?.issue);
  const hasFlatIssueFields = !!(raw?.issueKey || raw?.issue_key || raw?.issueTitle || raw?.issue_title);
  const issue: TimesheetLogIssueSummary | undefined =
    issueFromNested ??
    (hasFlatIssueFields
      ? {
          id: String(pickFirst(raw?.issueId, raw?.issue_id, '')),
          issueKey: String(pickFirst(raw?.issueKey, raw?.issue_key, '')),
          title: String(
            pickFirst(raw?.issueTitle, raw?.issue_title, raw?.issueKey, raw?.issue_key, '')
          ),
          projectId: pickFirst(raw?.projectId, raw?.project_id) || undefined,
          projectKey: pickFirst(raw?.projectKey, raw?.project_key) || undefined,
          projectName: pickFirst(raw?.projectName, raw?.project_name) || undefined,
          originalEstimateHours: toNullableNumber(
            pickFirst(raw?.originalEstimateHours, raw?.original_estimate_hours)
          ),
          remainingEstimateHours: toNullableNumber(
            pickFirst(raw?.remainingEstimateHours, raw?.remaining_estimate_hours)
          ),
        }
      : undefined);

  const updatedAt = pickFirst(raw?.updatedAt, raw?.updated_at);

  const normalized: TimesheetLog = {
    id: String(pickFirst(raw?.id, '')),
    issueId: String(pickFirst(raw?.issueId, raw?.issue_id, issue?.id, '')),
    userId: String(pickFirst(raw?.userId, raw?.user_id, raw?.user?.id, '')),
    workDate: String(pickFirst(raw?.workDate, raw?.work_date, raw?.date, '')),
    hoursWorked: toNumber(
      pickFirst(raw?.hoursWorked, raw?.hours_worked, raw?.hours, raw?.timeSpent, raw?.time_spent)
    ),
    notes: pickFirst(raw?.notes, raw?.description, null),
    isBillable: toBoolean(pickFirst(raw?.isBillable, raw?.is_billable), true),
    createdAt: String(pickFirst(raw?.createdAt, raw?.created_at, '')),
    issue,
    user: raw?.user
      ? {
          id: String(pickFirst(raw.user.id, raw.user.userId, raw.user.user_id, '')),
          displayName: String(pickFirst(raw.user.displayName, raw.user.display_name, 'Unknown')),
          avatarUrl: pickFirst(raw.user.avatarUrl, raw.user.avatar_url, null),
        }
      : raw?.userName || raw?.user_name
        ? {
            id: String(pickFirst(raw?.userId, raw?.user_id, '')),
            displayName: String(pickFirst(raw?.userName, raw?.user_name, 'Unknown')),
            avatarUrl: null,
          }
        : undefined,
  };

  if (updatedAt) {
    normalized.updatedAt = String(updatedAt);
  }

  return normalized;
};

const normalizeTimesheetHistoryResponse = (
  raw: any,
  query: TimesheetHistoryQuery
): TimesheetHistoryResponse => {
  const rawDayBuckets = raw?.dayBuckets || raw?.day_buckets || [];
  const dayBuckets = Array.isArray(rawDayBuckets)
    ? rawDayBuckets.map((bucket: any) => ({
        date: String(pickFirst(bucket.date, '')),
        hoursWorked: toNumber(pickFirst(bucket.hoursWorked, bucket.hours_worked, 0)),
        logCount: toNumber(pickFirst(bucket.logCount, bucket.log_count, bucket.logs?.length, 0)),
        logs: Array.isArray(bucket.logs) ? bucket.logs.map(normalizeTimesheetLog) : [],
      }))
    : [];

  const rawLogs = Array.isArray(raw?.logs) ? raw.logs : [];
  const logs = rawLogs.map(normalizeTimesheetLog);

  return {
    period: {
      startDate: String(pickFirst(raw?.period?.startDate, raw?.period?.start_date, query.startDate)),
      endDate: String(pickFirst(raw?.period?.endDate, raw?.period?.end_date, query.endDate)),
      timezone: String(pickFirst(raw?.period?.timezone, 'UTC')),
    },
    filters: {
      issueId: pickFirst(raw?.filters?.issueId, raw?.filters?.issue_id, query.issueId, null),
      projectId: pickFirst(raw?.filters?.projectId, raw?.filters?.project_id, query.projectId, null),
      userId: pickFirst(raw?.filters?.userId, raw?.filters?.user_id, query.userId, null),
      isBillable: pickFirst(
        raw?.filters?.isBillable,
        raw?.filters?.is_billable,
        query.isBillable,
        null
      ),
    },
    totals: {
      totalWorkedHours: toNumber(pickFirst(raw?.totals?.totalWorkedHours, raw?.totals?.total_worked_hours, 0)),
      totalEstimatedHours: toNumber(
        pickFirst(raw?.totals?.totalEstimatedHours, raw?.totals?.total_estimated_hours, 0)
      ),
      remainingEstimatedHours: toNumber(
        pickFirst(raw?.totals?.remainingEstimatedHours, raw?.totals?.remaining_estimated_hours, 0)
      ),
      expectedHours: toNumber(pickFirst(raw?.totals?.expectedHours, raw?.totals?.expected_hours, 0)),
      overtimeVsExpected: toNumber(
        pickFirst(raw?.totals?.overtimeVsExpected, raw?.totals?.overtime_vs_expected, 0)
      ),
      underTimeVsExpected: toNumber(
        pickFirst(raw?.totals?.underTimeVsExpected, raw?.totals?.under_time_vs_expected, 0)
      ),
      overtimeVsEstimated: toNumber(
        pickFirst(raw?.totals?.overtimeVsEstimated, raw?.totals?.overtime_vs_estimated, 0)
      ),
      underTimeVsEstimated: toNumber(
        pickFirst(raw?.totals?.underTimeVsEstimated, raw?.totals?.under_time_vs_estimated, 0)
      ),
    },
    dayBuckets,
    logs: logs.length > 0 ? logs : dayBuckets.flatMap((bucket) => bucket.logs),
  };
};

const normalizeTimesheetSummaryResponse = (raw: any): TimesheetSummaryResponse => ({
  kpis: {
    totalWorkedHours: toNumber(pickFirst(raw?.kpis?.totalWorkedHours, raw?.kpis?.total_worked_hours, 0)),
    totalEstimatedHours: toNumber(
      pickFirst(raw?.kpis?.totalEstimatedHours, raw?.kpis?.total_estimated_hours, 0)
    ),
    expectedHours: toNumber(pickFirst(raw?.kpis?.expectedHours, raw?.kpis?.expected_hours, 0)),
    utilizationPercentVsExpected: toNumber(
      pickFirst(raw?.kpis?.utilizationPercentVsExpected, raw?.kpis?.utilization_percent_vs_expected, 0)
    ),
    accuracyPercentVsEstimate: toNumber(
      pickFirst(raw?.kpis?.accuracyPercentVsEstimate, raw?.kpis?.accuracy_percent_vs_estimate, 0)
    ),
  },
  variance: {
    vsExpected: {
      overtime: toNumber(
        pickFirst(
          raw?.variance?.vsExpected?.overtime,
          raw?.variance?.vs_expected?.overtime,
          raw?.variance?.vsExpected?.overTime,
          0
        )
      ),
      underTime: toNumber(
        pickFirst(
          raw?.variance?.vsExpected?.underTime,
          raw?.variance?.vs_expected?.under_time,
          raw?.variance?.vsExpected?.under_time,
          0
        )
      ),
    },
    vsEstimated: {
      overtime: toNumber(
        pickFirst(
          raw?.variance?.vsEstimated?.overtime,
          raw?.variance?.vs_estimated?.overtime,
          raw?.variance?.vsEstimated?.overTime,
          0
        )
      ),
      underTime: toNumber(
        pickFirst(
          raw?.variance?.vsEstimated?.underTime,
          raw?.variance?.vs_estimated?.under_time,
          raw?.variance?.vsEstimated?.under_time,
          0
        )
      ),
    },
  },
  breakdowns: raw?.breakdowns
    ? {
        byDay: Array.isArray(raw.breakdowns.byDay)
          ? raw.breakdowns.byDay.map((item: any) => ({
              date: String(pickFirst(item.date, '')),
              hours: toNumber(pickFirst(item.hours, 0)),
            }))
          : [],
        byIssue: Array.isArray(raw.breakdowns.byIssue)
          ? raw.breakdowns.byIssue.map((item: any) => ({
              issueId: String(pickFirst(item.issueId, item.issue_id, '')),
              issueKey: String(pickFirst(item.issueKey, item.issue_key, '')),
              workedHours: toNumber(pickFirst(item.workedHours, item.worked_hours, 0)),
              estimatedHours: toNumber(pickFirst(item.estimatedHours, item.estimated_hours, 0)),
              // Store as both 'title' and 'issueTitle' for component compatibility
              title: pickFirst(item.issueTitle, item.title, item.issue_title, undefined),
              issueTitle: pickFirst(item.issueTitle, item.title, item.issue_title, undefined),
            }))
          : [],
        byProject: Array.isArray(raw.breakdowns.byProject)
          ? raw.breakdowns.byProject.map((item: any) => ({
              projectId: String(pickFirst(item.projectId, item.project_id, '')),
              projectKey: String(pickFirst(item.projectKey, item.project_key, '')),
              workedHours: toNumber(pickFirst(item.workedHours, item.worked_hours, 0)),
              projectName: pickFirst(item.projectName, item.project_name, undefined),
            }))
          : [],
      }
    : undefined,
});

export const timeTrackingApi = createApi({
  reducerPath: 'timeTrackingApi',
  baseQuery: authBaseQuery,
  tagTypes: ['TimeLog', 'Timer', 'Timesheet'],
  endpoints: (builder) => ({
    // Time Log endpoints (legacy issue-scoped)
    logTime: builder.mutation<
      { success: boolean; data: TimeLog },
      { issueId: string; body: LogTimeRequest }
    >({
      query: ({ issueId, body }) => ({
        url: `/issues/${issueId}/time-logs`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['TimeLog', 'Timesheet'],
    }),

    getTimeLogsByIssue: builder.query<{ success: boolean; data: TimeLog[] }, string>({
      query: (issueId) => `/issues/${issueId}/time-logs`,
      providesTags: ['TimeLog'],
    }),

    getIssueTimeSummary: builder.query<{ success: boolean; data: IssueTimeSummary }, string>({
      query: (issueId) => `/issues/${issueId}/time-logs/summary`,
      providesTags: ['TimeLog'],
    }),

    getTimeLog: builder.query<{ success: boolean; data: TimeLog }, string>({
      query: (timeLogId) => `/time-logs/${timeLogId}`,
      providesTags: ['TimeLog'],
    }),

    updateTimeLog: builder.mutation<
      { success: boolean; data: TimeLog },
      { timeLogId: string; body: UpdateTimeLogRequest }
    >({
      query: ({ timeLogId, body }) => ({
        url: `/time-logs/${timeLogId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['TimeLog', 'Timesheet'],
    }),

    deleteTimeLog: builder.mutation<{ success: boolean; message: string }, string>({
      query: (timeLogId) => ({
        url: `/time-logs/${timeLogId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['TimeLog', 'Timesheet'],
    }),

    // Timesheet alias endpoints (Jira-style contract)
    logTimesheet: builder.mutation<TimesheetLogMutationResponse, LogTimesheetRequest>({
      query: (body) => ({
        url: '/timesheet/log',
        method: 'POST',
        body,
      }),
      transformResponse: (response: any): TimesheetLogMutationResponse => {
        const envelope = response?.data ? response : { success: true, data: response };
        const payload = envelope?.data || {};
        const rawLog = pickFirst(payload.log, payload.timeLog, payload);

        return {
          success: envelope?.success ?? true,
          message: envelope?.message,
          data: {
            ...payload,
            log: normalizeTimesheetLog(rawLog),
          },
        };
      },
      invalidatesTags: ['TimeLog', 'Timesheet'],
    }),

    getTimesheetHistory: builder.query<
      { success: boolean; data: TimesheetHistoryResponse },
      TimesheetHistoryQuery
    >({
      query: (params) => ({
        url: '/timesheet/history',
        params,
      }),
      transformResponse: (response: any, _meta, arg) => {
        const envelope = response?.data ? response : { success: true, data: response };
        return {
          success: envelope?.success ?? true,
          data: normalizeTimesheetHistoryResponse(envelope?.data || {}, arg),
        };
      },
      providesTags: ['Timesheet', 'TimeLog'],
    }),

    getTimesheetSummary: builder.query<
      { success: boolean; data: TimesheetSummaryResponse },
      TimesheetSummaryQuery
    >({
      query: (params) => ({
        url: '/timesheet/summary',
        params,
      }),
      transformResponse: (response: any) => {
        const envelope = response?.data ? response : { success: true, data: response };
        return {
          success: envelope?.success ?? true,
          data: normalizeTimesheetSummaryResponse(envelope?.data || {}),
        };
      },
      providesTags: ['Timesheet'],
    }),

    updateTimesheetLog: builder.mutation<
      TimesheetLogMutationResponse,
      { logId: string; body: UpdateTimesheetLogRequest }
    >({
      query: ({ logId, body }) => ({
        url: `/timesheet/log/${logId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response: any): TimesheetLogMutationResponse => {
        const envelope = response?.data ? response : { success: true, data: response };
        const payload = envelope?.data || {};
        const rawLog = pickFirst(payload.log, payload.timeLog, payload);

        return {
          success: envelope?.success ?? true,
          message: envelope?.message,
          data: {
            ...payload,
            log: normalizeTimesheetLog(rawLog),
          },
        };
      },
      invalidatesTags: ['TimeLog', 'Timesheet'],
    }),

    deleteTimesheetLog: builder.mutation<{ success: boolean; message: string }, string>({
      query: (logId) => ({
        url: `/timesheet/log/${logId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['TimeLog', 'Timesheet'],
    }),

    // Timer endpoints
    getActiveTimer: builder.query<{ success: boolean; data: ActiveTimer | null }, void>({
      query: () => '/timer/active',
      providesTags: ['Timer'],
    }),

    startTimer: builder.mutation<
      { success: boolean; data: ActiveTimer },
      StartTimerRequest
    >({
      query: (body) => ({
        url: '/timer/start',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Timer'],
    }),

    stopTimer: builder.mutation<
      { success: boolean; data: { timeLog: TimeLog } },
      StopTimerRequest
    >({
      query: (body) => ({
        url: '/timer/stop',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Timer', 'TimeLog', 'Timesheet'],
    }),

    pauseTimer: builder.mutation<{ success: boolean; data: ActiveTimer }, void>({
      query: () => ({
        url: '/timer/pause',
        method: 'POST',
      }),
      invalidatesTags: ['Timer'],
    }),

    resumeTimer: builder.mutation<{ success: boolean; data: ActiveTimer }, void>({
      query: () => ({
        url: '/timer/resume',
        method: 'POST',
      }),
      invalidatesTags: ['Timer'],
    }),

    // Legacy timesheet endpoint (kept for backward compatibility)
    getTimesheet: builder.query<
      { success: boolean; data: TimesheetResponse },
      { startDate: string; endDate: string; userId?: string }
    >({
      query: ({ startDate, endDate, userId }) => ({
        url: '/timesheet',
        params: { startDate, endDate, userId },
      }),
      providesTags: ['Timesheet'],
    }),

    // Report endpoints
    getProjectTimeReport: builder.query<
      { success: boolean; data: ProjectTimeReport },
      { projectId: string; startDate: string; endDate: string }
    >({
      query: ({ projectId, startDate, endDate }) => ({
        url: `/projects/${projectId}/time-report`,
        params: { startDate, endDate },
      }),
    }),

    getUserTimeReport: builder.query<
      { success: boolean; data: UserTimeReport },
      { userId?: string; startDate: string; endDate: string }
    >({
      query: ({ userId, startDate, endDate }) => ({
        url: `/time-reports/user/${userId || ''}`,
        params: { startDate, endDate },
      }),
    }),

    // Export endpoint
    exportTimeLogs: builder.query<
      string,
      { startDate: string; endDate: string; projectId?: string; userId?: string }
    >({
      query: ({ startDate, endDate, projectId, userId }) => ({
        url: '/time-logs/export',
        params: { format: 'csv', startDate, endDate, projectId, userId },
        responseHandler: 'text',
      }),
    }),
  }),
});

export const {
  useLogTimeMutation,
  useGetTimeLogsByIssueQuery,
  useGetIssueTimeSummaryQuery,
  useGetTimeLogQuery,
  useUpdateTimeLogMutation,
  useDeleteTimeLogMutation,
  useLogTimesheetMutation,
  useGetTimesheetHistoryQuery,
  useGetTimesheetSummaryQuery,
  useUpdateTimesheetLogMutation,
  useDeleteTimesheetLogMutation,
  useGetActiveTimerQuery,
  useStartTimerMutation,
  useStopTimerMutation,
  usePauseTimerMutation,
  useResumeTimerMutation,
  useGetTimesheetQuery,
  useGetProjectTimeReportQuery,
  useGetUserTimeReportQuery,
  useLazyExportTimeLogsQuery,
  useLazyGetTimesheetHistoryQuery,
  useLazyGetTimesheetSummaryQuery,
} = timeTrackingApi;
