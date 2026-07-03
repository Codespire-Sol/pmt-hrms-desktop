import { z } from 'zod';

export const globalSearchSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(200, 'Query too long'),
  types: z.string().optional(), // comma-separated: 'issues,projects,comments,users'
  projectId: z.string().uuid('Invalid project ID').optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(50)).optional().default('20'),
});

export const issueSearchSchema = z.object({
  q: z.string().min(1).max(200),
  projectId: z.string().uuid().optional(),
  statusIds: z.string().optional(),
  assigneeIds: z.string().optional(),
  typeIds: z.string().optional(),
  priorityIds: z.string().optional(),
  labelIds: z.string().optional(),
  sprintId: z.string().uuid().optional(),
  includeArchived: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
  sortBy: z.enum(['relevance', 'created_at', 'updated_at', 'priority']).optional().default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const advancedSearchSchema = z.object({
  query: z.string().max(1000, 'Query too long'),
  filters: z.object({
    project: z.array(z.string().uuid()).optional(),
    type: z.array(z.string().uuid()).optional(),
    status: z.array(z.string().uuid()).optional(),
    priority: z.array(z.string().uuid()).optional(),
    assignee: z.array(z.string().uuid()).optional(),
    reporter: z.array(z.string().uuid()).optional(),
    label: z.array(z.string().uuid()).optional(),
    sprint: z.array(z.string().uuid()).optional(),
    createdDate: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional(),
    updatedDate: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional(),
    dueDate: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional(),
  }).optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const saveSearchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
  query: z.string().min(1).max(1000),
  filters: z.record(z.unknown()).optional(),
  isPublic: z.boolean().optional().default(false),
});

export const updateSavedSearchSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  query: z.string().min(1).max(1000).optional(),
  filters: z.record(z.unknown()).optional(),
  isPublic: z.boolean().optional(),
});

export const savedSearchIdParamSchema = z.object({
  searchId: z.string().uuid('Invalid search ID format'),
});

export type GlobalSearchParams = z.infer<typeof globalSearchSchema>;
export type IssueSearchParams = z.infer<typeof issueSearchSchema>;
export type AdvancedSearchInput = z.infer<typeof advancedSearchSchema>;
export type SaveSearchInput = z.infer<typeof saveSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
