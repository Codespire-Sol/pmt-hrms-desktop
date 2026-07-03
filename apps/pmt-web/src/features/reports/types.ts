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
