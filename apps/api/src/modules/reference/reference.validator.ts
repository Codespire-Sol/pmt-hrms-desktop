import { z } from 'zod';

export const issueTypeFiltersSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional(),
  includeSubtasks: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
});

export const priorityFiltersSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional(),
});

export const statusFiltersSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  workflowId: z.string().uuid('Invalid workflow ID').optional(),
});

export const labelFiltersSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  search: z.string().max(100).optional(),
});

export const workflowFiltersSchema = z.object({
  projectId: z.string().uuid('Invalid project ID').optional(),
  isDefault: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
});

export const createIssueTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long').trim(),
  description: z.string().max(255).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  isSubtask: z.boolean().optional().default(false),
});

export const createPrioritySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long').trim(),
  description: z.string().max(255).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  level: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createStatusSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long').trim(),
  description: z.string().max(255).optional(),
  category: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createLabelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long').trim(),
  description: z.string().max(255).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
});

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  description: z.string().max(255).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
});

export const updateIssueTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long').trim().optional(),
  displayName: z.string().min(1).max(50).trim().optional(),
  description: z.string().max(255).nullable().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  isSubtask: z.boolean().optional(),
});

export const updatePrioritySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long').trim().optional(),
  displayName: z.string().min(1).max(50).trim().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  level: z.number().int().min(0).optional(),
});

export const reorderIssueTypesSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  typeIds: z.array(z.string().uuid()).min(1),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
  description: z.string().max(255).optional(),
  isDefault: z.boolean().optional().default(false),
  transitions: z.array(z.object({
    fromStatusId: z.string().uuid().nullable(),
    toStatusId: z.string().uuid(),
    name: z.string().max(50).optional(),
  })).optional(),
});

export const projectIdQuerySchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export const referenceIdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export type IssueTypeFilters = z.infer<typeof issueTypeFiltersSchema>;
export type PriorityFilters = z.infer<typeof priorityFiltersSchema>;
export type StatusFilters = z.infer<typeof statusFiltersSchema>;
export type LabelFilters = z.infer<typeof labelFiltersSchema>;
export type WorkflowFilters = z.infer<typeof workflowFiltersSchema>;
export type CreateIssueTypeInput = z.infer<typeof createIssueTypeSchema>;
export type CreatePriorityInput = z.infer<typeof createPrioritySchema>;
export type CreateStatusInput = z.infer<typeof createStatusSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type UpdateIssueTypeInput = z.infer<typeof updateIssueTypeSchema>;
export type UpdatePriorityInput = z.infer<typeof updatePrioritySchema>;
export type ReorderIssueTypesInput = z.infer<typeof reorderIssueTypesSchema>;
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
