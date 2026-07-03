import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long').trim(),
  description: z.string().max(255, 'Description too long').optional(),
  permissions: z.array(z.string().uuid('Invalid permission ID')).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  description: z.string().max(255).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const assignPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid('Invalid permission ID')).min(1, 'At least one permission is required'),
});

export const removePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid('Invalid permission ID')).min(1, 'At least one permission is required'),
});

export const assignRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  roleId: z.string().uuid('Invalid role ID'),
  projectId: z.string().uuid('Invalid project ID').optional(),
});

export const roleFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  isSystemRole: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
});

export const permissionFiltersSchema = z.object({
  resource: z.string().max(50).optional(),
  action: z.string().max(50).optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('50'),
});

export const checkPermissionSchema = z.object({
  resource: z.string().min(1, 'Resource is required').max(50),
  action: z.string().min(1, 'Action is required').max(50),
  projectId: z.string().uuid('Invalid project ID').optional(),
});

export const roleIdParamSchema = z.object({
  roleId: z.string().uuid('Invalid role ID format'),
});

export const permissionIdParamSchema = z.object({
  permissionId: z.string().uuid('Invalid permission ID format'),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>;
export type RemovePermissionsInput = z.infer<typeof removePermissionsSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type RoleFilters = z.infer<typeof roleFiltersSchema>;
export type PermissionFilters = z.infer<typeof permissionFiltersSchema>;
export type CheckPermissionInput = z.infer<typeof checkPermissionSchema>;
