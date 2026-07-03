// Sprint Reports
export interface SprintVelocity {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  committedPoints: number;
  completedPoints: number;
  completedIssues: number;
  totalIssues: number;
  velocity: number;
}

export interface BurndownDataPoint {
  date: string;
  idealRemaining: number;
  actualRemaining: number;
  completedPoints: number;
}

export interface SprintBurndown {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  totalPoints: number;
  dataPoints: BurndownDataPoint[];
}

export interface SprintReport {
  projectId: string;
  projectName: string;
  projectKey: string;
  velocityHistory: SprintVelocity[];
  averageVelocity: number;
  currentSprint: SprintBurndown | null;
}

// Team Workload Reports
export interface TeamMemberWorkload {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  assignedIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  totalPoints: number;
  completedPoints: number;
  hoursLogged: number;
  overdueIssues: number;
}

export interface TeamWorkloadReport {
  projectId: string;
  projectName: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  members: TeamMemberWorkload[];
  totals: {
    totalAssigned: number;
    totalCompleted: number;
    totalInProgress: number;
    totalPoints: number;
    totalHoursLogged: number;
  };
}

// Time Tracking Reports
export interface TimeLogEntry {
  id: string;
  userId: string;
  userName: string;
  issueId: string;
  issueKey: string;
  issueTitle: string;
  projectId: string;
  projectName: string;
  durationMinutes: number;
  description: string | null;
  loggedAt: string;
  createdAt: string;
}

export interface TimeByUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalMinutes: number;
  logCount: number;
}

export interface TimeByProject {
  projectId: string;
  projectName: string;
  projectKey: string;
  totalMinutes: number;
  logCount: number;
}

export interface TimeByIssue {
  issueId: string;
  issueKey: string;
  issueTitle: string;
  projectId: string;
  totalMinutes: number;
  estimatedMinutes: number | null;
  logCount: number;
}

export interface TimeTrackingReport {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalMinutes: number;
  totalLogs: number;
  byUser: TimeByUser[];
  byProject: TimeByProject[];
  byIssue: TimeByIssue[];
  recentLogs: TimeLogEntry[];
}

// Issue Distribution Reports
export interface IssueDistribution {
  label: string;
  value: string;
  count: number;
  percentage: number;
  color: string | null;
}

export interface IssueDistributionReport {
  projectId: string;
  projectName: string;
  byStatus: IssueDistribution[];
  byPriority: IssueDistribution[];
  byType: IssueDistribution[];
  byAssignee: IssueDistribution[];
}

// Estimate vs Actual Comparison
export interface IssueEstimateActual {
  issueId: string;
  issueKey: string;
  issueTitle: string;
  issueType: string;
  assignee: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  estimatedHours: number;
  actualHours: number;
  remainingHours: number;
  variance: number; // actualHours - estimatedHours
  variancePercentage: number; // (variance / estimatedHours) * 100
  status: string;
  isOverEstimate: boolean; // actual < estimated (good)
  isUnderEstimate: boolean; // actual > estimated (bad)
}

export interface EstimateAccuracyByType {
  issueType: string;
  totalEstimated: number;
  totalActual: number;
  variance: number;
  variancePercentage: number;
  issueCount: number;
}

export interface EstimateAccuracyByUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalEstimated: number;
  totalActual: number;
  variance: number;
  variancePercentage: number;
  issueCount: number;
  accuracyScore: number; // 0-100 based on how close estimates are
}

export interface EstimateActualReport {
  projectId: string;
  projectName: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalEstimatedHours: number;
    totalActualHours: number;
    totalVariance: number;
    variancePercentage: number;
    overEstimatedCount: number;
    underEstimatedCount: number;
    accurateCount: number; // within 10% variance
    averageAccuracy: number; // 0-100
  };
  byIssueType: EstimateAccuracyByType[];
  byUser: EstimateAccuracyByUser[];
  issues: IssueEstimateActual[];
}

// Cumulative Flow Diagram
export interface CFDDataPoint {
  date: string;
  [status: string]: number | string; // Dynamic status columns
}

export interface CFDStatusInfo {
  statusId: string;
  statusName: string;
  displayName: string;
  color: string;
  category: string;
}

export interface CumulativeFlowReport {
  projectId: string;
  projectName: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  statuses: CFDStatusInfo[];
  dataPoints: CFDDataPoint[];
}

// Cycle Time Analytics
export interface CycleTimeDataPoint {
  issueId: string;
  issueKey: string;
  issueTitle: string;
  issueType: string;
  storyPoints: number | null;
  cycleTimeHours: number;
  cycleTimeDays: number;
  startedAt: string;
  completedAt: string;
  assignee: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

export interface CycleTimeByStatus {
  statusName: string;
  displayName: string;
  color: string;
  averageHours: number;
  averageDays: number;
  issueCount: number;
}

export interface CycleTimeReport {
  projectId: string;
  projectName: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    averageCycleTimeDays: number;
    medianCycleTimeDays: number;
    minCycleTimeDays: number;
    maxCycleTimeDays: number;
    issueCount: number;
  };
  byIssueType: {
    issueType: string;
    averageDays: number;
    issueCount: number;
  }[];
  byStoryPoints: {
    storyPoints: number;
    averageDays: number;
    issueCount: number;
  }[];
  byStatus: CycleTimeByStatus[];
  issues: CycleTimeDataPoint[];
}

// Export types
export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeHeaders?: boolean;
  dateFormat?: string;
}
