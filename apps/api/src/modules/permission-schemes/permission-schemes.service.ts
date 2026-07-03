import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { isSystemAdmin } from '../../utils/system-admin';
import { policyService } from '../../services/policy.service';

export class PermissionSchemesService {
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  private async checkProjectAccess(projectId: string, userId: string, requiredRoles?: string[]) {
    if (await isSystemAdmin(userId)) {
      return;
    }
    const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);
    if (!membership) {
      throw ApiError.forbidden('Access denied');
    }
    if (requiredRoles && !requiredRoles.includes(membership.role)) {
      throw ApiError.forbidden('Insufficient permissions');
    }
  }

  async createScheme(
    userId: string,
    input: { projectId?: string; name: string; description?: string; isDefault?: boolean }
  ) {
    if (input.projectId) {
      await this.checkProjectAccess(input.projectId, userId, ['admin', 'lead']);
    }
    return prisma.permissionScheme.create({
      data: {
        projectId: input.projectId || null,
        name: input.name,
        description: input.description,
        isDefault: input.isDefault ?? false,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async listSchemes(userId: string, projectId?: string) {
    if (projectId) {
      await this.checkProjectAccess(projectId, userId);
    }
    return prisma.permissionScheme.findMany({
      where: projectId
        ? {
            OR: [{ projectId }, { projectId: null as any }],
          }
        : undefined,
      include: { rules: true, assignments: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getScheme(userId: string, schemeId: string) {
    const scheme = await prisma.permissionScheme.findUnique({
      where: { id: schemeId },
      include: { rules: true, assignments: true },
    });
    if (!scheme) {
      throw ApiError.notFound('Permission scheme not found');
    }
    if (scheme.projectId) {
      await this.checkProjectAccess(scheme.projectId, userId);
    }
    return scheme;
  }

  async updateScheme(
    userId: string,
    schemeId: string,
    input: { name?: string; description?: string | null; status?: 'active' | 'inactive'; isDefault?: boolean }
  ) {
    const scheme = await this.getScheme(userId, schemeId);
    if (scheme.projectId) {
      await this.checkProjectAccess(scheme.projectId, userId, ['admin', 'lead']);
    }
    return prisma.permissionScheme.update({
      where: { id: schemeId },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        status: input.status,
        isDefault: input.isDefault,
        updatedBy: userId,
      },
    });
  }

  async deleteScheme(userId: string, schemeId: string) {
    const scheme = await this.getScheme(userId, schemeId);
    if (scheme.projectId) {
      await this.checkProjectAccess(scheme.projectId, userId, ['admin', 'lead']);
    }
    await prisma.permissionScheme.update({
      where: { id: schemeId },
      data: { status: 'inactive', updatedBy: userId },
    });
    return { message: 'Permission scheme deactivated' };
  }

  async upsertRule(
    userId: string,
    schemeId: string,
    input: {
      permissionName: string;
      principalType: 'user' | 'user_role' | 'project_role' | 'group';
      principalId: string;
      effect?: 'allow' | 'deny';
      conditions?: Record<string, unknown>;
    }
  ) {
    const scheme = await this.getScheme(userId, schemeId);
    if (scheme.projectId) {
      await this.checkProjectAccess(scheme.projectId, userId, ['admin', 'lead']);
    }

    return prisma.permissionSchemeRule.create({
      data: {
        permissionSchemeId: schemeId,
        permissionName: input.permissionName,
        principalType: input.principalType,
        principalId: input.principalId,
        effect: input.effect || 'allow',
        conditions: (input.conditions || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async assignProject(userId: string, projectId: string, permissionSchemeId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);
    return prisma.projectPermissionScheme.upsert({
      where: { projectId },
      create: {
        projectId,
        permissionSchemeId,
        assignedBy: userId,
      },
      update: {
        permissionSchemeId,
        assignedBy: userId,
      },
    });
  }

  async evaluatePolicy(projectId: string, permission: string, userId: string) {
    const allowed = await policyService.hasPermission({
      projectId,
      permission,
      userId,
    });
    return {
      projectId,
      permission,
      userId,
      allowed,
    };
  }
}

export const permissionSchemesService = new PermissionSchemesService();
