import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { userGroupsService } from './user-groups.service';

const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

const bindGlobalRoleSchema = z.object({
  roleId: z.string().uuid(),
  roleScope: z.enum(['hrms', 'pmt']).default('pmt'),
});

const bindProjectRoleSchema = z.object({
  projectId: z.string().uuid(),
  projectRole: z.enum(['admin', 'lead', 'member', 'viewer']),
});

export class UserGroupsController {
  create = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createGroupSchema.parse(req.body);
      const result = await userGroupsService.createGroup(req.params.projectId, req.user!.id, input as any);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await userGroupsService.listGroups(req.params.projectId, req.user!.id);
    res.json({ success: true, data: result });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const result = await userGroupsService.getGroup(req.params.groupId, req.user!.id);
    res.json({ success: true, data: result });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateGroupSchema.parse(req.body);
      const result = await userGroupsService.updateGroup(req.params.groupId, req.user!.id, input);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const result = await userGroupsService.deleteGroup(req.params.groupId, req.user!.id);
    res.json({ success: true, ...result });
  });

  addMember = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = addMemberSchema.parse(req.body);
      const result = await userGroupsService.addMember(req.params.groupId, input.userId, req.user!.id);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  removeMember = asyncHandler(async (req: Request, res: Response) => {
    const result = await userGroupsService.removeMember(req.params.groupId, req.params.userId, req.user!.id);
    res.json({ success: true, ...result });
  });

  bindGlobalRole = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = bindGlobalRoleSchema.parse(req.body);
      const result = await userGroupsService.bindGlobalRole(
        req.params.groupId,
        input.roleId,
        input.roleScope,
        req.user!.id
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  bindProjectRole = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = bindProjectRoleSchema.parse(req.body);
      const result = await userGroupsService.bindProjectRole(
        req.params.groupId,
        input.projectId,
        input.projectRole,
        req.user!.id
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });
}

export const userGroupsController = new UserGroupsController();
