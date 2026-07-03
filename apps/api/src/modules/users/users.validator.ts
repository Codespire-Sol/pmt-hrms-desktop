import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name too long')
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name too long')
    .trim()
    .optional(),
  phone: z
    .string()
    .max(20, 'Phone number too long')
    .regex(/^[+]?[\d\s-()]+$/, 'Invalid phone number format')
    .nullable()
    .optional(),
  timezone: z
    .string()
    .max(50, 'Timezone too long')
    .optional(),
  locale: z
    .string()
    .max(10, 'Locale too long')
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid locale format')
    .optional(),
});

export const updateAvatarSchema = z.object({
  avatarUrl: z
    .string()
    .url('Invalid URL format')
    .max(500, 'URL too long')
    .nullable(),
});

export const userSearchSchema = z.object({
  search: z.string().max(100).optional(),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  isVerified: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
  sortBy: z.enum(['firstName', 'lastName', 'email', 'createdAt', 'lastLoginAt']).optional().default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const updatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  mentionNotifications: z.boolean().optional(),
  issueAssignedNotifications: z.boolean().optional(),
  issueUpdatedNotifications: z.boolean().optional(),
  sprintNotifications: z.boolean().optional(),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

export const updateUserStatusSchema = z.object({
  params: userIdParamSchema,
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const updateUserSchema = z.object({
  params: userIdParamSchema,
  body: z.object({
    email: z.string().email().optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    isVerified: z.boolean().optional(),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;
export type UserSearchParams = z.infer<typeof userSearchSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
