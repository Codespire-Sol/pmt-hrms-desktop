import { z } from 'zod';

export const createIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  description: z.string().max(50000, 'Description too long').optional(),
  descriptionHtml: z.string().max(200000, 'Description HTML too long').optional(),
  typeId: z.string().uuid('Invalid type ID'),
  statusId: z.string().uuid('Invalid status ID').optional(),
  priorityId: z.string().uuid('Invalid priority ID').optional(),
  assigneeId: z.string().uuid('Invalid assignee ID').optional(),
  parentId: z.string().uuid('Invalid parent ID').optional(),
  storyPoints: z.number().min(0).max(100).optional(),
  originalEstimateHours: z.number().min(0).max(10000).optional(),
  dueDate: z.string().refine(
    (val) => {
      if (!val) return true; // optional
      // Accept both date (YYYY-MM-DD) and datetime (ISO-8601) formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/;
      return dateRegex.test(val) || datetimeRegex.test(val) || !isNaN(Date.parse(val));
    },
    { message: 'Invalid date format. Use YYYY-MM-DD or ISO-8601 datetime format.' }
  ).optional(),
  startDate: z.string().refine(
    (val) => {
      if (!val) return true; // optional
      // Accept both date (YYYY-MM-DD) and datetime (ISO-8601) formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/;
      return dateRegex.test(val) || datetimeRegex.test(val) || !isNaN(Date.parse(val));
    },
    { message: 'Invalid date format. Use YYYY-MM-DD or ISO-8601 datetime format.' }
  ).optional(),
  labels: z.array(z.string().uuid()).optional(),
});

export const updateIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long').optional(),
  description: z.string().max(50000, 'Description too long').optional(),
  descriptionHtml: z.string().max(200000, 'Description HTML too long').nullable().optional(),
  typeId: z.string().uuid('Invalid type ID').optional(),
  statusId: z.string().uuid('Invalid status ID').optional(),
  priorityId: z.string().uuid('Invalid priority ID').optional(),
  reporterId: z.string().uuid('Invalid reporter ID').optional(),
  assigneeId: z.string().uuid('Invalid assignee ID').nullable().optional(),
  storyPoints: z.number().min(0).max(100).nullable().optional(),
  remainingEstimateHours: z.number().min(0).max(10000).nullable().optional(),
  dueDate: z.string().refine(
    (val) => {
      if (!val || val === null) return true; // nullable
      // Accept both date (YYYY-MM-DD) and datetime (ISO-8601) formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/;
      return dateRegex.test(val) || datetimeRegex.test(val) || !isNaN(Date.parse(val));
    },
    { message: 'Invalid date format. Use YYYY-MM-DD or ISO-8601 datetime format.' }
  ).nullable().optional(),
  startDate: z.string().refine(
    (val) => {
      if (!val || val === null) return true; // nullable
      // Accept both date (YYYY-MM-DD) and datetime (ISO-8601) formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/;
      return dateRegex.test(val) || datetimeRegex.test(val) || !isNaN(Date.parse(val));
    },
    { message: 'Invalid date format. Use YYYY-MM-DD or ISO-8601 datetime format.' }
  ).nullable().optional(),
  resolution: z.string().max(100).nullable().optional(),
});

export const issueFiltersSchema = z.object({
  statusId: z.string().uuid().optional(),
  statusIds: z.string().optional(), // comma-separated UUIDs
  assigneeId: z.string().uuid().optional(),
  assigneeIds: z.string().optional(),
  priorityId: z.string().uuid().optional(),
  priorityIds: z.string().optional(),
  typeId: z.string().uuid().optional(),
  typeIds: z.string().optional(),
  labelIds: z.string().optional(),
  sprintId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('50'),
  sortBy: z.enum(['created_at', 'updated_at', 'priority', 'due_date', 'title', 'status', 'assignee']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const addLinkSchema = z.object({
  targetIssueId: z.string().uuid('Invalid target issue ID'),
  linkType: z.enum([
    'blocks',
    'is_blocked_by',
    'duplicates',
    'is_duplicated_by',
    'relates_to',
    'causes',
    'is_caused_by',
    'clones',
    'is_cloned_by',
  ]),
});

export const bulkUpdateSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1, 'At least one issue is required').max(100, 'Max 100 issues'),
  update: z.object({
    statusId: z.string().uuid().optional(),
    priorityId: z.string().uuid().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    sprintId: z.string().uuid().nullable().optional(),
    labels: z.array(z.string().uuid()).optional(),
  }),
});

export const bulkMoveSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1).max(100),
  targetProjectId: z.string().uuid(),
});

export const watchIssueSchema = z.object({
  watch: z.boolean(),
});

export const issueIdParamSchema = z.object({
  issueId: z.string().uuid('Invalid issue ID format'),
});

export const linkIdParamSchema = z.object({
  issueId: z.string().uuid('Invalid issue ID format'),
  linkId: z.string().uuid('Invalid link ID format'),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type IssueFilters = z.infer<typeof issueFiltersSchema>;
export type AddLinkInput = z.infer<typeof addLinkSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
export type BulkMoveInput = z.infer<typeof bulkMoveSchema>;
