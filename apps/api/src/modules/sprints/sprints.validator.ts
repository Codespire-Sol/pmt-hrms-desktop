import { z } from 'zod';

export const createSprintSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
  goal: z.string().max(500, 'Goal too long').optional(),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
});

export const updateSprintSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim().optional(),
  goal: z.string().max(500, 'Goal too long').nullable().optional(),
  startDate: z.string().datetime('Invalid start date').optional(),
  endDate: z.string().datetime('Invalid end date').optional(),
  status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
});

export const sprintFiltersSchema = z.object({
  status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(50)).optional().default('10'),
  sortBy: z.enum(['name', 'start_date', 'end_date', 'created_at']).optional().default('start_date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const startSprintSchema = z.object({
  startDate: z.string().datetime('Invalid start date').optional(),
});

export const completeSprintSchema = z.object({
  moveIncompleteIssuesTo: z.enum(['backlog', 'next_sprint']).optional().default('backlog'),
  nextSprintId: z.string().uuid('Invalid sprint ID').optional(),
});

export const addIssueToSprintSchema = z.object({
  issueId: z.string().uuid('Invalid issue ID'),
});

export const bulkAddIssuesToSprintSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1, 'At least one issue is required').max(100, 'Max 100 issues'),
});

export const reorderSprintIssuesSchema = z.object({
  issueOrder: z.array(z.string().uuid()),
});

export const sprintIdParamSchema = z.object({
  sprintId: z.string().uuid('Invalid sprint ID format'),
});

export const sprintIssueParamSchema = z.object({
  sprintId: z.string().uuid('Invalid sprint ID format'),
  issueId: z.string().uuid('Invalid issue ID format'),
});

export const projectSprintParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
export type SprintFilters = z.infer<typeof sprintFiltersSchema>;
export type StartSprintInput = z.infer<typeof startSprintSchema>;
export type CompleteSprintInput = z.infer<typeof completeSprintSchema>;
export type AddIssueToSprintInput = z.infer<typeof addIssueToSprintSchema>;
export type BulkAddIssuesToSprintInput = z.infer<typeof bulkAddIssuesToSprintSchema>;
