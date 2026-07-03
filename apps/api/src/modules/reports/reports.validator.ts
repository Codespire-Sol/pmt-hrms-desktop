import { z } from 'zod';

export const reportFiltersSchema = z.object({
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  projectId: z.string().uuid('Invalid project ID').optional(),
  sprintId: z.string().uuid('Invalid sprint ID').optional(),
  assigneeIds: z.string().optional(), // comma-separated UUIDs
  typeIds: z.string().optional(),
  priorityIds: z.string().optional(),
  statusIds: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'assignee', 'type', 'priority', 'status']).optional(),
});

export const velocityReportSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  sprintCount: z.string().transform(Number).pipe(z.number().int().min(1).max(20)).optional().default('6'),
});

export const burndownReportSchema = z.object({
  sprintId: z.string().uuid('Invalid sprint ID'),
  metric: z.enum(['story_points', 'issue_count', 'hours']).optional().default('story_points'),
});

export const cumulativeFlowSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  groupBy: z.enum(['day', 'week']).optional().default('day'),
});

export const timeTrackingReportSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional(),
  userId: z.string().uuid('Invalid user ID').optional(),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  groupBy: z.enum(['day', 'week', 'month', 'user', 'project', 'issue']).optional().default('day'),
});

export const issueAgingReportSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  statusIds: z.string().optional(),
  thresholds: z.string().optional(), // comma-separated numbers in days
});

export const teamWorkloadReportSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  sprintId: z.string().uuid('Invalid sprint ID').optional(),
  metric: z.enum(['issue_count', 'story_points', 'hours']).optional().default('issue_count'),
});

export const exportReportSchema = z.object({
  reportType: z.enum([
    'velocity',
    'burndown',
    'cumulative_flow',
    'time_tracking',
    'issue_aging',
    'team_workload',
  ]),
  format: z.enum(['csv', 'pdf', 'xlsx']),
  filters: z.record(z.unknown()).optional(),
});

export const projectReportsParamsSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export const sprintReportsParamsSchema = z.object({
  sprintId: z.string().uuid('Invalid sprint ID format'),
});

export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export type VelocityReportParams = z.infer<typeof velocityReportSchema>;
export type BurndownReportParams = z.infer<typeof burndownReportSchema>;
export type CumulativeFlowParams = z.infer<typeof cumulativeFlowSchema>;
export type TimeTrackingReportParams = z.infer<typeof timeTrackingReportSchema>;
export type IssueAgingReportParams = z.infer<typeof issueAgingReportSchema>;
export type TeamWorkloadReportParams = z.infer<typeof teamWorkloadReportSchema>;
export type ExportReportInput = z.infer<typeof exportReportSchema>;
