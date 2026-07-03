import { z } from 'zod';

export const dashboardFiltersSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional(),
  dateRange: z.enum(['7d', '14d', '30d', '90d', 'custom']).optional().default('30d'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const widgetConfigSchema = z.object({
  widgetId: z.string().min(1, 'Widget ID is required').max(50),
  type: z.enum([
    'issues_summary',
    'sprint_progress',
    'team_workload',
    'recent_activity',
    'upcoming_deadlines',
    'velocity_chart',
    'burndown_chart',
    'issue_distribution',
    'my_issues',
    'watched_issues',
  ]),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(8),
  }),
  settings: z.record(z.unknown()).optional(),
});

export const updateDashboardLayoutSchema = z.object({
  widgets: z.array(widgetConfigSchema).max(20, 'Maximum 20 widgets allowed'),
});

export const dashboardPreferencesSchema = z.object({
  defaultProjectId: z.string().uuid().nullable().optional(),
  defaultDateRange: z.enum(['7d', '14d', '30d', '90d']).optional(),
  refreshInterval: z.number().int().min(0).max(3600).optional(), // seconds, 0 = disabled
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

export const projectDashboardParamsSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
export type UpdateDashboardLayoutInput = z.infer<typeof updateDashboardLayoutSchema>;
export type DashboardPreferencesInput = z.infer<typeof dashboardPreferencesSchema>;
