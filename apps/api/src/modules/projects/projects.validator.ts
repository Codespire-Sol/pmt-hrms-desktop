import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
  key: z
    .string()
    .min(2, 'Key must be at least 2 characters')
    .max(10, 'Key must be at most 10 characters')
    .regex(/^[A-Z][A-Z0-9]*$/, 'Key must be uppercase letters and numbers, starting with a letter')
    .transform((val) => val.toUpperCase()),
  description: z.string().max(5000, 'Description too long').optional(),
  leadId: z.string().uuid('Invalid lead ID'),
  categoryId: z.string().uuid('Invalid category ID'),
  templateId: z.string().uuid('Invalid template ID').optional(),
  visibility: z.enum(['private', 'internal', 'public']).optional().default('private'),
  category: z.string().max(50).optional(),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim().optional(),
  description: z.string().max(5000, 'Description too long').optional(),
  leadId: z.string().uuid('Invalid lead ID').nullable().optional(),
  categoryId: z.string().uuid('Invalid category ID').nullable().optional(),
  visibility: z.enum(['private', 'internal', 'public']).optional(),
  category: z.string().max(50).nullable().optional(),
  iconUrl: z.string().url('Invalid URL').max(500).nullable().optional(),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
  startDate: z.string().datetime().nullable().optional(),
  targetEndDate: z.string().datetime().nullable().optional(),
});

export const projectFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
  visibility: z.enum(['private', 'internal', 'public']).optional(),
  category: z.string().max(50).optional(),
  isFavorite: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
  sortBy: z.enum(['name', 'created_at', 'updated_at', 'key']).optional().default('updated_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  roleId: z.string().uuid('Invalid role ID'),
});

export const updateMemberRoleSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export const projectMemberParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  memberId: z.string().uuid('Invalid member ID format'),
});

export const favoriteProjectSchema = z.object({
  isFavorite: z.boolean(),
});

export const archiveProjectSchema = z.object({
  archive: z.boolean(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectFilters = z.infer<typeof projectFiltersSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
