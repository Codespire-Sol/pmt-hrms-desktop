import { z } from 'zod';

export const calendarProviderSchema = z.enum(['google', 'outlook']);

export const connectCalendarSchema = z.object({
  code: z.string().min(1),
  provider: calendarProviderSchema,
  state: z.string().optional(),
});

export const selectCalendarSchema = z.object({
  calendarId: z.string().min(1),
  calendarName: z.string().min(1),
});

export const updateCalendarSettingsSchema = z.object({
  syncDueDates: z.boolean().optional(),
  syncSprints: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const getOAuthUrlSchema = z.object({
  provider: calendarProviderSchema,
  returnUrl: z.string().url().optional(),
});

export const syncIssueDueDateSchema = z.object({
  issueId: z.string().uuid(),
  issueKey: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().datetime(),
});

export const syncSprintSchema = z.object({
  sprintId: z.string().uuid(),
  name: z.string().min(1),
  goal: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  userIds: z.array(z.string().uuid()),
});

export type ConnectCalendarPayload = z.infer<typeof connectCalendarSchema>;
export type SelectCalendarPayload = z.infer<typeof selectCalendarSchema>;
export type UpdateCalendarSettingsPayload = z.infer<typeof updateCalendarSettingsSchema>;
export type GetOAuthUrlPayload = z.infer<typeof getOAuthUrlSchema>;
export type SyncIssueDueDatePayload = z.infer<typeof syncIssueDueDateSchema>;
export type SyncSprintPayload = z.infer<typeof syncSprintSchema>;
