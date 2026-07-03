import { z } from 'zod';
import { ALL_NOTIFICATION_TYPES } from './notifications.types';

export const markAsReadSchema = z.object({
  body: z.object({
    notificationIds: z
      .array(z.string().uuid('Invalid notification ID'))
      .min(1, 'At least one notification ID is required')
      .max(100, 'Cannot mark more than 100 notifications at once'),
  }),
});

export const updatePreferenceSchema = z.object({
  params: z.object({
    type: z.enum(ALL_NOTIFICATION_TYPES as [string, ...string[]], {
      errorMap: () => ({ message: 'Invalid notification type' }),
    }),
  }),
  body: z.object({
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
  }),
});

export const updatePreferencesSchema = z.object({
  body: z.object({
    preferences: z
      .array(
        z.object({
          notificationType: z.enum(ALL_NOTIFICATION_TYPES as [string, ...string[]], {
            errorMap: () => ({ message: 'Invalid notification type' }),
          }),
          inAppEnabled: z.boolean().optional(),
          emailEnabled: z.boolean().optional(),
        })
      )
      .min(1, 'At least one preference is required')
      .max(ALL_NOTIFICATION_TYPES.length, 'Too many preferences'),
  }),
});

export const getNotificationsQuerySchema = z.object({
  query: z.object({
    unreadOnly: z.enum(['true', 'false']).optional().default('false'),
    limit: z
      .string()
      .optional()
      .default('20')
      .transform((val) => Math.min(parseInt(val, 10) || 20, 100)),
    offset: z
      .string()
      .optional()
      .default('0')
      .transform((val) => parseInt(val, 10) || 0),
    type: z.enum(ALL_NOTIFICATION_TYPES as [string, ...string[]]).optional(),
    module: z.enum(['hrms', 'toolkit', 'all']).optional().default('all'),
  }),
});

export const hrmsBroadcastSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    message: z.string().min(1).max(2000),
    type: z.enum(ALL_NOTIFICATION_TYPES as [string, ...string[]]).optional(),
    recipientUserIds: z.array(z.string().uuid()).optional(),
    recipientRoleNames: z.array(z.string().min(1).max(50)).optional(),
    metadata: z.record(z.any()).optional(),
  }),
});
