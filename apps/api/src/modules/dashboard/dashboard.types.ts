export interface DashboardStats {
  totalProjects: number;
  totalIssues: number;
  openIssues: number;
  completedIssues: number;
  overdueIssues: number;
  totalTimeLogged: number; // in minutes
}

export interface AssignedIssue {
  id: string;
  issueKey: string;
  title: string;
  status: string;
  statusColor: string;
  priority: string;
  priorityColor: string;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  projectKey: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecentActivity {
  id: string;
  action: string;
  entityType: 'issue' | 'project' | 'comment' | 'sprint';
  entityId: string;
  entityTitle: string;
  issueKey: string | null;
  projectId: string | null;
  projectName: string | null;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  key: string;
  description: string | null;
  openIssues: number;
  totalIssues: number;
  completedPercentage: number;
  activeSprint: {
    id: string;
    name: string;
    endDate: string;
    daysRemaining: number;
  } | null;
  recentActivity: string | null;
}

export interface SprintProgress {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  projectKey: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  todoIssues: number;
  completionPercentage: number;
}

export interface DueSoonIssue {
  id: string;
  issueKey: string;
  title: string;
  dueDate: string;
  daysUntilDue: number;
  status: string;
  statusColor: string;
  projectId: string;
  projectName: string;
}

export interface UserDashboard {
  stats: DashboardStats;
  assignedIssues: AssignedIssue[];
  recentActivity: RecentActivity[];
  projectSummaries: ProjectSummary[];
  activeSprintsProgress: SprintProgress[];
  dueSoonIssues: DueSoonIssue[];
}

export interface ProjectDashboard {
  projectId: string;
  projectName: string;
  projectKey: string;
  stats: {
    totalIssues: number;
    openIssues: number;
    inProgressIssues: number;
    completedIssues: number;
    overdueIssues: number;
    totalTimeLogged: number;
    avgResolutionTime: number | null; // in hours
  };
  issuesByStatus: { status: string; statusColor: string; count: number }[];
  issuesByPriority: { priority: string; priorityColor: string; count: number }[];
  issuesByType: { type: string; typeIcon: string; count: number }[];
  recentActivity: RecentActivity[];
  activeSprint: SprintProgress | null;
  teamMembers: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    assignedCount: number;
    completedCount: number;
  }[];
  dueSoonTrend: { day: string; count: number }[];
  throughput: { bucket: string; created: number; resolved: number }[];
  workloadBuckets: {
    low: number;
    medium: number;
    high: number;
    unassignedOpenIssues: number;
  };
}

// Dashboard Customization types
export type DashboardType = 'user' | 'project';

export type WidgetType =
  | 'stats'
  | 'assigned_issues'
  | 'recent_activity'
  | 'project_summaries'
  | 'sprints_progress'
  | 'due_soon'
  | 'issues_by_status'
  | 'issues_by_priority'
  | 'issues_by_type'
  | 'team_members';

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetLayout {
  widgetId: WidgetType;
  position: WidgetPosition;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetSettings {
  [widgetId: string]: {
    title?: string;
    limit?: number;
    showChart?: boolean;
    chartType?: 'bar' | 'pie' | 'line';
    refreshInterval?: number; // in seconds
    [key: string]: any;
  };
}

export interface DashboardPreferences {
  id: string;
  userId: string;
  dashboardType: DashboardType;
  projectId: string | null;
  layout: WidgetLayout[];
  hiddenWidgets: WidgetType[];
  widgetSettings: WidgetSettings;
  theme: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateDashboardPreferencesInput {
  layout?: WidgetLayout[];
  hiddenWidgets?: WidgetType[];
  widgetSettings?: WidgetSettings;
  theme?: string;
}

// Default layouts
export const DEFAULT_USER_DASHBOARD_LAYOUT: WidgetLayout[] = [
  { widgetId: 'stats', position: { x: 0, y: 0, w: 12, h: 2 } },
  { widgetId: 'assigned_issues', position: { x: 0, y: 2, w: 6, h: 4 } },
  { widgetId: 'due_soon', position: { x: 6, y: 2, w: 6, h: 4 } },
  { widgetId: 'recent_activity', position: { x: 0, y: 6, w: 6, h: 4 } },
  { widgetId: 'project_summaries', position: { x: 6, y: 6, w: 6, h: 4 } },
  { widgetId: 'sprints_progress', position: { x: 0, y: 10, w: 12, h: 3 } },
];

export const DEFAULT_PROJECT_DASHBOARD_LAYOUT: WidgetLayout[] = [
  { widgetId: 'stats', position: { x: 0, y: 0, w: 12, h: 2 } },
  { widgetId: 'issues_by_status', position: { x: 0, y: 2, w: 4, h: 3 } },
  { widgetId: 'issues_by_priority', position: { x: 4, y: 2, w: 4, h: 3 } },
  { widgetId: 'issues_by_type', position: { x: 8, y: 2, w: 4, h: 3 } },
  { widgetId: 'recent_activity', position: { x: 0, y: 5, w: 6, h: 4 } },
  { widgetId: 'team_members', position: { x: 6, y: 5, w: 6, h: 4 } },
  { widgetId: 'sprints_progress', position: { x: 0, y: 9, w: 12, h: 3 } },
];

// Dashboard Sharing types
export type SharePermission = 'view' | 'edit';

export interface DashboardShare {
  id: string;
  dashboardPreferencesId: string;
  ownerId: string;
  sharedWithUserId: string | null;
  isPublic: boolean;
  publicLinkToken: string | null;
  permission: SharePermission;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardShareWithDetails extends DashboardShare {
  owner: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  sharedWithUser?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  };
  dashboard: {
    id: string;
    dashboardType: DashboardType;
    projectId: string | null;
  };
}

export interface CreateDashboardShareInput {
  dashboardPreferencesId: string;
  sharedWithUserId?: string;
  isPublic?: boolean;
  permission?: SharePermission;
  expiresAt?: string;
}

export interface UpdateDashboardShareInput {
  permission?: SharePermission;
  expiresAt?: string | null;
}

export interface SharedDashboardInfo {
  share: DashboardShare;
  dashboard: DashboardPreferences;
  owner: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

// ============================================================
// ROLE-BASED DASHBOARD TYPES
// ============================================================

export type DashboardRole = 'admin' | 'manager' | 'employee';

// ---- Gantt Chart ----

export type GanttView = 'weekly' | 'monthly' | 'quarterly' | 'halfYearly' | 'annually';

export interface GanttPeriod {
  /** Human-readable label shown as the column header, e.g. "Apr 2025", "Q2 2025", "H1 2025", "2025" */
  label: string;
  /** ISO date string of the first day of the period */
  start: string;
  /** ISO date string of the last day of the period */
  end: string;
}

export interface GanttItem {
  id: string;
  issueKey: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  statusColor: string;
  statusCategory: string;
  priority: string;
  priorityColor: string;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  projectId: string;
  projectName: string;
  projectKey: string;
  sprintId: string | null;
  sprintName: string | null;
  epicId: string | null;
  epicName: string | null;
  issueTypeName: string;
  issueTypeIcon: string;
  storyPoints: number | null;
  estimatedHours: number | null;
  loggedHours: number;
  dependencies: { id: string; issueKey: string; linkType: string }[];
  progress: number;
  isOverdue: boolean;
  parentId: string | null;
}

export interface GanttChartData {
  projectId: string | null;
  projectName: string | null;
  items: GanttItem[];
  sprints: {
    id: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
  }[];
  /** The active time granularity */
  view: GanttView;
  /**
   * Ordered array of time periods used to render the chart header.
   * The dateRange is derived from the first and last period.
   */
  timeScale: GanttPeriod[];
  dateRange: { start: string; end: string };
}

// ---- Velocity Chart ----

export interface VelocityPoint {
  sprintId: string;
  sprintName: string;
  startDate: string | null;
  endDate: string | null;
  committedIssues: number;
  completedIssues: number;
  committedPoints: number | null;
  completedPoints: number | null;
  completionRate: number;
}

export interface VelocityChartData {
  projectId: string;
  projectName: string;
  points: VelocityPoint[];
  avgCompletionRate: number;
  trend: 'improving' | 'declining' | 'stable';
}

// ---- Burndown Chart ----

export interface BurndownPoint {
  date: string;
  remainingIssues: number;
  remainingPoints: number | null;
  idealRemaining: number;
}

export interface BurndownChartData {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  totalIssues: number;
  completedIssues: number;
  totalPoints: number | null;
  completedPoints: number | null;
  points: BurndownPoint[];
}

// ---- Cumulative Flow ----

export interface CumulativeFlowPoint {
  date: string;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
}

// ---- Admin Dashboard ----

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  activeProjects: number;
  totalIssues: number;
  openIssues: number;
  completedIssues: number;
  overdueIssues: number;
  activeSprintsCount: number;
  totalTimeLoggedMinutes: number;
  issuesCreatedThisWeek: number;
  issuesCompletedThisWeek: number;
}

export interface ProjectOverviewItem {
  id: string;
  name: string;
  key: string;
  status: string;
  totalIssues: number;
  openIssues: number;
  overdueIssues: number;
  completionPercentage: number;
  activeSprint: string | null;
  sprintDaysRemaining: number | null;
  leadId: string | null;
  leadName: string | null;
  memberCount: number;
  healthStatus: 'healthy' | 'at_risk' | 'critical';
  lastActivity: string | null;
}

export interface AdminDashboard {
  role: 'admin';
  stats: AdminStats;
  projectsOverview: ProjectOverviewItem[];
  orgThroughput: { bucket: string; created: number; resolved: number }[];
  issuesByProject: {
    projectId: string;
    projectName: string;
    projectKey: string;
    open: number;
    inProgress: number;
    done: number;
    overdue: number;
  }[];
  userActivity: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    issuesCreated: number;
    issuesCompleted: number;
    timeLoggedMinutes: number;
  }[];
  overdueByProject: { projectId: string; projectName: string; overdueCount: number }[];
  recentSystemEvents: RecentActivity[];
}

// ---- Manager Dashboard ----

export interface ManagerStats {
  managedProjects: number;
  totalTeamMembers: number;
  totalIssuesInManaged: number;
  openIssues: number;
  overdueIssues: number;
  activeSprintsCount: number;
  completionRateThisWeek: number;
  blockedIssues: number;
}

export interface TeamMemberWorkload {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  assignedCount: number;
  inProgressCount: number;
  completedCount: number;
  overdueCount: number;
  loggedMinutesThisWeek: number;
  capacityStatus: 'available' | 'normal' | 'overloaded';
}

export interface SprintHealthItem {
  sprintId: string;
  sprintName: string;
  projectId: string;
  projectName: string;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number;
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  blockedIssues: number;
  completionPercentage: number;
  healthStatus: 'on_track' | 'at_risk' | 'off_track';
}

export interface RiskIssue {
  id: string;
  issueKey: string;
  title: string;
  riskType: 'overdue' | 'blocked' | 'no_assignee' | 'high_priority_stale';
  status: string;
  statusColor: string;
  priority: string;
  priorityColor: string;
  dueDate: string | null;
  daysOverdue: number | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  projectId: string;
  projectName: string;
  blockedByCount: number;
}

export interface ManagerDashboard {
  role: 'manager';
  stats: ManagerStats;
  teamWorkload: TeamMemberWorkload[];
  sprintHealth: SprintHealthItem[];
  velocityData: VelocityPoint[];
  riskIssues: RiskIssue[];
  throughput: { bucket: string; created: number; resolved: number }[];
  recentTeamActivity: RecentActivity[];
}

// ---- Employee Dashboard ----

export interface MyStats {
  totalAssigned: number;
  inProgress: number;
  completedToday: number;
  completedThisWeek: number;
  overdueCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
  timeLoggedTodayMinutes: number;
  timeLoggedThisWeekMinutes: number;
}

export interface MyIssueItem {
  id: string;
  issueKey: string;
  title: string;
  status: string;
  statusColor: string;
  statusCategory: string;
  priority: string;
  priorityColor: string;
  dueDate: string | null;
  daysUntilDue: number | null;
  isOverdue: boolean;
  projectId: string;
  projectName: string;
  sprintName: string | null;
  epicName: string | null;
  storyPoints: number | null;
  estimatedHours: number | null;
  loggedHours: number;
  updatedAt: string;
}

export interface MySprintContext {
  sprintId: string;
  sprintName: string;
  projectId: string;
  projectName: string;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number;
  completionPercentage: number;
  myIssuesInSprint: number;
  myCompletedInSprint: number;
}

export interface MyPerformancePoint {
  week: string;
  completed: number;
  timeLoggedMinutes: number;
}

export interface EmployeeDashboard {
  role: 'employee';
  stats: MyStats;
  myIssues: MyIssueItem[];
  sprintContext: MySprintContext[];
  performance: MyPerformancePoint[];
  upcomingDeadlines: DueSoonIssue[];
  recentActivity: RecentActivity[];
}

// ---- Default Layouts for Role Dashboards ----

export const DEFAULT_ADMIN_DASHBOARD_LAYOUT: WidgetLayout[] = [
  { widgetId: 'admin_stats' as any, position: { x: 0, y: 0, w: 12, h: 2 } },
  { widgetId: 'projects_overview' as any, position: { x: 0, y: 2, w: 8, h: 5 } },
  { widgetId: 'user_activity' as any, position: { x: 8, y: 2, w: 4, h: 5 } },
  { widgetId: 'org_throughput' as any, position: { x: 0, y: 7, w: 6, h: 4 } },
  { widgetId: 'issues_by_project' as any, position: { x: 6, y: 7, w: 6, h: 4 } },
  { widgetId: 'overdue_by_project' as any, position: { x: 0, y: 11, w: 6, h: 3 } },
  { widgetId: 'system_events' as any, position: { x: 6, y: 11, w: 6, h: 3 } },
];

export const DEFAULT_MANAGER_DASHBOARD_LAYOUT: WidgetLayout[] = [
  { widgetId: 'team_stats' as any, position: { x: 0, y: 0, w: 12, h: 2 } },
  { widgetId: 'sprint_health' as any, position: { x: 0, y: 2, w: 7, h: 4 } },
  { widgetId: 'risk_issues' as any, position: { x: 7, y: 2, w: 5, h: 4 } },
  { widgetId: 'team_workload' as any, position: { x: 0, y: 6, w: 6, h: 4 } },
  { widgetId: 'velocity_chart' as any, position: { x: 6, y: 6, w: 6, h: 4 } },
  { widgetId: 'gantt_chart' as any, position: { x: 0, y: 10, w: 12, h: 5 } },
  { widgetId: 'throughput_chart' as any, position: { x: 0, y: 15, w: 8, h: 4 } },
  { widgetId: 'team_activity' as any, position: { x: 8, y: 15, w: 4, h: 4 } },
];

export const DEFAULT_EMPLOYEE_DASHBOARD_LAYOUT: WidgetLayout[] = [
  { widgetId: 'my_stats' as any, position: { x: 0, y: 0, w: 12, h: 2 } },
  { widgetId: 'my_issues' as any, position: { x: 0, y: 2, w: 6, h: 5 } },
  { widgetId: 'upcoming_deadlines' as any, position: { x: 6, y: 2, w: 6, h: 5 } },
  { widgetId: 'my_sprints' as any, position: { x: 0, y: 7, w: 8, h: 3 } },
  { widgetId: 'my_time' as any, position: { x: 8, y: 7, w: 4, h: 3 } },
  { widgetId: 'my_timeline' as any, position: { x: 0, y: 10, w: 12, h: 4 } },
  { widgetId: 'my_performance' as any, position: { x: 0, y: 14, w: 8, h: 3 } },
  { widgetId: 'team_context' as any, position: { x: 8, y: 14, w: 4, h: 3 } },
];
