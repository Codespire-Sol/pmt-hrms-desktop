import { z } from 'zod';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/;

export const createHrAccountSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(100).trim(),
    lastName: z.string().min(1).max(100).trim(),
    email: z.string().email().max(255).transform(v => v.toLowerCase()),
    temporaryPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        passwordRegex,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    phone: z.string().max(20).optional(),
    location: z.string().max(200).trim().optional().default(''),
    branchId: z.string().uuid().optional(),
    justification: z.string().min(3).max(500).optional(),
  }),
});

export const updateHrAccountLimitSchema = z.object({
  body: z.object({
    maxHrAccounts: z.number().int().min(1).max(100),
  }),
});

export type CreateHrAccountInput = z.infer<typeof createHrAccountSchema>['body'];
export type UpdateHrAccountLimitInput = z.infer<typeof updateHrAccountLimitSchema>['body'];

export const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).trim(),
    websiteUrl: z.string().url('Enter a valid URL').max(500).optional().or(z.literal('')),
    address: z.string().max(500).trim().optional(),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(200).trim().optional(),
    websiteUrl: z.string().url('Enter a valid URL').max(500).optional().or(z.literal('')),
    address: z.string().max(500).trim().optional(),
  }),
});

export const branchIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>['body'];
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>['body'];

