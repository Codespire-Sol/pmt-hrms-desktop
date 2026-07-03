import { z } from 'zod';

export const updateWipLimitSchema = z.object({
  wipLimit: z.number().min(0).nullable(),
});

export const boardQuerySchema = z.object({
  view: z.enum(['kanban', 'list', 'timeline']).optional(),
  swimlane: z.enum(['none', 'assignee', 'epic', 'priority', 'type', 'sprint']).optional(),
  assigneeIds: z.string().optional(),
  typeIds: z.string().optional(),
  priorityIds: z.string().optional(),
  labelIds: z.string().optional(),
  sprintId: z.string().uuid().optional(),
  epicId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
});

export const moveIssueSchema = z.object({
  issueId: z.string().uuid(),
  targetStatusId: z.string().uuid(),
  targetPosition: z.number().int().min(0),
  swimlaneId: z.string().uuid().optional(),
});

export const reorderColumnsSchema = z.object({
  columnOrder: z.array(z.string().uuid()),
});

export const boardSettingsSchema = z.object({
  defaultView: z.enum(['kanban', 'list', 'timeline']).optional(),
  defaultSwimlane: z.enum(['none', 'assignee', 'epic', 'priority', 'type', 'sprint']).optional(),
  showEmptySwimlanes: z.boolean().optional(),
  cardFields: z.array(z.string()).optional(),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export const statusIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  statusId: z.string().uuid('Invalid status ID format'),
});

export type UpdateWipLimitInput = z.infer<typeof updateWipLimitSchema>;
export type BoardQueryParams = z.infer<typeof boardQuerySchema>;
export type MoveIssueInput = z.infer<typeof moveIssueSchema>;
export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;
export type BoardSettingsInput = z.infer<typeof boardSettingsSchema>;
