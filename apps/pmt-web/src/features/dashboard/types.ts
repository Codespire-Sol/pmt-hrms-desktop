export interface DashboardStats {
  totalProjects: number;
  totalIssues: number;
  openIssues: number;
  completedIssues: number;
  overdueIssues: number;
  totalTimeLogged: number;
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
    avgResolutionTime: number | null;
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
}

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
    dashboardType: 'user' | 'project';
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
  dashboard: any;
  owner: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

// Dashboard Customization types
export type DashboardType = 'user' | 'project';

export type WidgetType =
  // Employee widgets
  | 'stats'
  | 'assigned_issues'
  | 'recent_activity'
  | 'project_summaries'
  | 'sprints_progress'
  | 'due_soon'
  | 'issues_by_status'
  | 'issues_by_priority'
  | 'issues_by_type'
  | 'team_members'
  // Admin widgets
  | 'kpi_cards'
  | 'projects_overview'
  | 'gantt_chart'
  | 'throughput_chart'
  | 'burndown_burnup'
  | 'burndown'
  | 'burnup'
  | 'issues_by_project'
  | 'overdue_by_project'
  | 'top_contributors'
  | 'system_events'
  | 'velocity_chart'
  | 'sprint_health_overview'
  | 'cumulative_flow'
  // Manager widgets
  | 'sprint_health'
  | 'risk_issues'
  | 'team_workload'
  | 'team_velocity'
  | 'team_activity';

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
    refreshInterval?: number;
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

// ============================================================
// ROLE-BASED DASHBOARD TYPES
// ============================================================

// --- Shared ---

export interface SystemEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  issueKey?: string;
  projectId: string;
  projectName: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ThroughputPoint {
  bucket: string;
  created: number;
  resolved: number;
}

// --- Admin Dashboard ---

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

export type HealthStatus = 'critical' | 'at_risk' | 'healthy';

export interface ProjectOverview {
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
  leadId: string;
  leadName: string;
  memberCount: number;
  healthStatus: HealthStatus;
  lastActivity: string;
}

export interface UserActivityItem {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  issuesCreated: number;
  issuesCompleted: number;
  timeLoggedMinutes: number;
}

export interface IssuesByProjectItem {
  projectId: string;
  projectName: string;
  projectKey: string;
  open: number;
  inProgress: number;
  done: number;
  overdue: number;
}

export interface OverdueByProject {
  projectId: string;
  projectName: string;
  overdueCount: number;
}

export interface AdminDashboardData {
  role: 'admin';
  stats: AdminStats;
  projectsOverview: ProjectOverview[];
  orgThroughput: ThroughputPoint[];
  issuesByProject: IssuesByProjectItem[];
  userActivity: UserActivityItem[];
  overdueByProject: OverdueByProject[];
  recentSystemEvents: SystemEvent[];
}

// --- Manager Dashboard ---

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

export type CapacityStatus = 'available' | 'normal' | 'overloaded';

export interface TeamWorkloadMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  assignedCount: number;
  inProgressCount: number;
  completedCount: number;
  overdueCount: number;
  loggedMinutesThisWeek: number;
  capacityStatus: CapacityStatus;
}

export type SprintHealthStatus = 'on_track' | 'at_risk' | 'off_track';

export interface SprintHealthItem {
  sprintId: string;
  sprintName: string;
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  blockedIssues: number;
  completionPercentage: number;
  healthStatus: SprintHealthStatus;
}

export interface VelocityPoint {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  committedIssues: number;
  completedIssues: number;
  committedPoints: number | null;
  completedPoints: number | null;
  completionRate: number;
}

export type RiskType = 'overdue' | 'blocked' | 'no_assignee' | 'high_priority_stale';

export interface RiskIssue {
  id: string;
  issueKey: string;
  title: string;
  riskType: RiskType;
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

export interface ManagerDashboardData {
  role: 'manager';
  stats: ManagerStats;
  teamWorkload: TeamWorkloadMember[];
  sprintHealth: SprintHealthItem[];
  velocityData: VelocityPoint[];
  riskIssues: RiskIssue[];
  throughput: ThroughputPoint[];
  recentTeamActivity: SystemEvent[];
}

// --- Employee Dashboard ---

export interface EmployeeStats {
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

export interface MyIssue {
  id: string;
  issueKey: string;
  title: string;
  status: string;
  statusColor: string;
  statusCategory: 'todo' | 'in_progress' | 'done';
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

export interface SprintContextItem {
  sprintId: string;
  sprintName: string;
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  completionPercentage: number;
  myIssuesInSprint: number;
  myCompletedInSprint: number;
}

export interface PerformancePoint {
  week: string;
  completed: number;
  timeLoggedMinutes: number;
}

export interface UpcomingDeadline {
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

export interface EmployeeDashboardData {
  role: 'employee';
  stats: EmployeeStats;
  myIssues: MyIssue[];
  sprintContext: SprintContextItem[];
  performance: PerformancePoint[];
  upcomingDeadlines: UpcomingDeadline[];
  recentActivity: SystemEvent[];
}

// --- Chart Types ---

export interface GanttDependency {
  id: string;
  issueKey: string;
  linkType: string;
}

export interface GanttItem {
  id: string;
  issueKey: string;
  title: string;
  startDate: string;
  endDate: string;
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
  progress: number;
  isOverdue: boolean;
  parentId: string | null;
  dependencies: GanttDependency[];
}

export interface GanttSprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

export type GanttView = 'weekly' | 'quarterly' | 'halfYearly' | 'annually';

export interface GanttTimeScalePeriod {
  label: string;
  start: string;
  end: string;
}

export interface GanttData {
  view?: GanttView;
  projectId?: string;
  projectName?: string;
  dateRange: { start: string; end: string };
  timeScale?: GanttTimeScalePeriod[];
  sprints: GanttSprint[];
  items: GanttItem[];
}

export interface GanttQueryParams {
  view?: GanttView;
  projectId?: string;
  projectIds?: string[];
  assigneeId?: string;
  sprintId?: string;
  epicId?: string;
}

export interface VelocityChartData {
  projectId: string;
  projectName: string;
  avgCompletionRate: number;
  trend: 'improving' | 'declining' | 'stable';
  points: VelocityPoint[];
}

export interface BurndownPoint {
  date: string;
  remainingIssues: number;
  remainingPoints: number | null;
  idealRemaining: number;
}

export interface BurndownData {
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

export interface CumulativeFlowPoint {
  date: string;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
}

// Widget display info
export const WIDGET_INFO: Record<WidgetType, { label: string; description: string }> = {
  // Employee
  stats: { label: 'Statistics', description: 'Overview of your projects and issues' },
  assigned_issues: { label: 'Assigned Issues', description: 'Issues assigned to you' },
  recent_activity: { label: 'Recent Activity', description: 'Latest activity in your projects' },
  project_summaries: { label: 'Project Summaries', description: 'Quick overview of your projects' },
  sprints_progress: { label: 'Sprint Progress', description: 'Active sprint progress' },
  due_soon: { label: 'Due Soon', description: 'Issues due in the near future' },
  issues_by_status: { label: 'Issues by Status', description: 'Distribution of issues by status' },
  issues_by_priority: { label: 'Issues by Priority', description: 'Distribution by priority' },
  issues_by_type: { label: 'Issues by Type', description: 'Distribution by issue type' },
  team_members: { label: 'Team Members', description: 'Team member statistics' },
  // Admin
  kpi_cards: { label: 'KPI Cards', description: 'Key performance indicators at a glance' },
  projects_overview: { label: 'Projects Overview', description: 'Health, progress and sprint status for all projects' },
  gantt_chart: { label: 'Issue Timeline', description: 'Gantt-style timeline of issues with due dates' },
  throughput_chart: { label: 'Throughput', description: 'Created vs resolved issues over time' },
  burndown_burnup: { label: 'Burndown / Burnup', description: 'Sprint burndown and burnup charts by project' },
  burndown: { label: 'Burndown Chart', description: 'Sprint remaining work vs ideal burndown by date' },
  burnup: { label: 'Burnup Chart', description: 'Sprint scope, completed and ideal progress by date' },
  velocity_chart: { label: 'Team Velocity', description: 'Committed vs completed story points per sprint' },
  sprint_health_overview: { label: 'Sprint Health Overview', description: 'Health status of all active sprints across projects' },
  cumulative_flow: { label: 'Cumulative Flow', description: 'Work item distribution across statuses over time' },
  issues_by_project: { label: 'Issues by Project', description: 'Issue breakdown per project' },
  overdue_by_project: { label: 'Overdue by Project', description: 'Overdue issue count per project' },
  top_contributors: { label: 'Top Contributors', description: 'Team members ranked by completed issues' },
  system_events: { label: 'System Events', description: 'Recent activity across the organisation' },
  // Manager
  sprint_health: { label: 'Sprint Health', description: 'Health status of all active sprints' },
  risk_issues: { label: 'Risk Issues', description: 'Blocked, overdue and high-priority stale issues' },
  team_workload: { label: 'Team Workload', description: 'Issue distribution and capacity per team member' },
  team_velocity: { label: 'Team Velocity', description: 'Sprint committed vs completed trend' },
  team_activity: { label: 'Team Activity', description: 'Recent team actions and updates' },
};
