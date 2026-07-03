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
}

export interface ActiveTimerWithElapsed extends ActiveTimer {
  elapsedSeconds: number;
  issue: {
    id: string;
    issueKey: string;
    title: string;
  };
}

export interface CreateTimeLogInput {
  hours: number;
  description?: string;
  workDate: string;
  isBillable?: boolean;
}

export interface UpdateTimeLogInput {
  hours?: number;
  description?: string;
  workDate?: string;
  isBillable?: boolean;
}

export interface StartTimerInput {
  issueId: string;
  description?: string;
}

export interface StopTimerInput {
  description?: string;
}

export interface TimesheetFilters {
  startDate: string;
  endDate: string;
  userId?: string;
}

export interface TimeReportFilters {
  startDate: string;
  endDate: string;
  projectId?: string;
  userId?: string;
}

export interface TimesheetDay {
  date: string;
  totalHours: number;
  logs: TimeLogWithIssue[];
}

export interface TimeLogWithIssue extends TimeLog {
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

export interface TimeReportByUser {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  hours: number;
  percentage: number;
}

export interface TimeReportByIssueType {
  type: string;
  hours: number;
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
  byUser: TimeReportByUser[];
  byIssueType: TimeReportByIssueType[];
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

export interface TimesheetLogInput {
  issueId: string;
  workDate: string;
  hoursWorked: number;
  notes?: string;
  isBillable?: boolean;
}

export interface TimesheetUpdateLogInput {
  hoursWorked?: number;
  notes?: string;
  workDate?: string;
  isBillable?: boolean;
}

export interface TimesheetHistoryFilters {
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

export interface TimesheetSummaryFilters {
  startDate: string;
  endDate: string;
  issueId?: string;
  projectId?: string;
  userId?: string;
  viewAll?: boolean;
  includeBreakdowns?: boolean;
}

export interface TimesheetHistoryLog {
  id: string;
  issueId: string;
  issueKey: string;
  issueTitle: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  userId: string;
  userName: string;
  hoursWorked: number;
  workDate: string;
  notes: string | null;
  isBillable: boolean;
  originalEstimateHours: number;
  remainingEstimateHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetDayBucket {
  date: string;
  hoursWorked: number;
  logCount: number;
  logs: TimesheetHistoryLog[];
}
