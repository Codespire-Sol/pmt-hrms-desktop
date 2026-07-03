export interface TimeLog {
  id: string;
  issue_id: string;
  user_id: string;
  hours: number;
  description: string | null;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  is_billable: boolean;
  created_at: string;
  updated_at: string;
  issue: {
    id: string;
    issueKey: string;
    title: string;
  };
  user?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface ActiveTimer {
  id: string;
  user_id: string;
  issue_id: string;
  started_at: string;
  description: string | null;
  is_paused: boolean;
  paused_at: string | null;
  accumulated_seconds: number;
  elapsedSeconds: number;
  elapsedMinutes: number;
  issue: {
    id: string;
    issueKey: string;
    title: string;
  };
}

export interface LogTimeRequest {
  hours: number;
  description?: string;
  workDate: string;
  isBillable?: boolean;
}

export interface UpdateTimeLogRequest {
  hours?: number;
  description?: string;
  workDate?: string;
  isBillable?: boolean;
}

export interface StartTimerRequest {
  issueId: string;
  description?: string;
}

export interface StopTimerRequest {
  description?: string;
}

export interface TimesheetDay {
  date: string;
  totalHours: number;
  logs: TimeLog[];
}

export interface TimesheetResponse {
  startDate: string;
  endDate: string;
  user: {
    id: string;
    displayName: string;
  };
  days: TimesheetDay[];
  totalHours: number;
  expectedHours: number;
}

export interface ProjectTimeReport {
  project: {
    id: string;
    name: string;
    key: string;
  };
  period: {
    start: string;
    end: string;
  };
  totalHours: number;
  totalEstimatedHours: number;
  byUser: {
    user: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
    };
    hours: number;
    percentage: number;
  }[];
  byIssueType: {
    type: string;
    hours: number;
  }[];
}

export interface UserTimeReport {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  period: {
    start: string;
    end: string;
  };
  totalHours: number;
  byProject: {
    project: { id: string; name: string; key: string };
    hours: number;
  }[];
  byDay: {
    date: string;
    hours: number;
  }[];
}

export interface IssueTimeSummary {
  originalEstimateHours: number;
  timeSpentHours: number;
  remainingEstimateHours: number;
  percentageComplete: number;
}

// Timesheet alias contract models (canonical camelCase)
export interface TimesheetLogIssueSummary {
  id: string;
  issueKey: string;
  title: string;
  projectId?: string;
  projectKey?: string;
  projectName?: string;
  originalEstimateHours?: number | null;
  remainingEstimateHours?: number | null;
}

export interface TimesheetLogUserSummary {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface TimesheetLog {
  id: string;
  issueId: string;
  userId: string;
  workDate: string;
  hoursWorked: number;
  notes: string | null;
  isBillable: boolean;
  createdAt: string;
  updatedAt?: string;
  issue?: TimesheetLogIssueSummary;
  user?: TimesheetLogUserSummary;
}

export interface LogTimesheetRequest {
  issueId: string;
  workDate: string;
  hoursWorked: number;
  notes?: string;
  isBillable?: boolean;
}

export interface UpdateTimesheetLogRequest {
  workDate?: string;
  hoursWorked?: number;
  notes?: string;
  isBillable?: boolean;
}

export interface TimesheetHistoryQuery {
  startDate: string;
  endDate: string;
  issueId?: string;
  projectId?: string;
  userId?: string;
  viewAll?: boolean;
  isBillable?: boolean;
  groupBy?: 'day' | 'none';
  page?: number;
  limit?: number;
}

export interface TimesheetHistoryTotals {
  totalWorkedHours: number;
  totalEstimatedHours: number;
  remainingEstimatedHours: number;
  expectedHours: number;
  overtimeVsExpected: number;
  underTimeVsExpected: number;
  overtimeVsEstimated: number;
  underTimeVsEstimated: number;
}

export interface TimesheetHistoryDayBucket {
  date: string;
  hoursWorked: number;
  logCount: number;
  logs: TimesheetLog[];
}

export interface TimesheetHistoryResponse {
  period: {
    startDate: string;
    endDate: string;
    timezone: string;
  };
  filters: {
    issueId: string | null;
    projectId: string | null;
    userId: string | null;
    isBillable: boolean | null;
  };
  totals: TimesheetHistoryTotals;
  dayBuckets: TimesheetHistoryDayBucket[];
  logs: TimesheetLog[];
}

export interface TimesheetSummaryQuery {
  startDate: string;
  endDate: string;
  userId?: string;
  projectId?: string;
  issueId?: string;
  viewAll?: boolean;
  includeBreakdowns?: boolean;
}

export interface TimesheetSummaryBreakdowns {
  byDay: Array<{ date: string; hours: number }>;
  byIssue: Array<{
    issueId: string;
    issueKey: string;
    workedHours: number;
    estimatedHours: number;
    title?: string;
    issueTitle?: string;
  }>;
  byProject: Array<{
    projectId: string;
    projectKey: string;
    workedHours: number;
    projectName?: string;
  }>;
}

export interface TimesheetSummaryResponse {
  kpis: {
    totalWorkedHours: number;
    totalEstimatedHours: number;
    expectedHours: number;
    utilizationPercentVsExpected: number;
    accuracyPercentVsEstimate: number;
  };
  variance: {
    vsExpected: {
      overtime: number;
      underTime: number;
    };
    vsEstimated: {
      overtime: number;
      underTime: number;
    };
  };
  breakdowns?: TimesheetSummaryBreakdowns;
}
