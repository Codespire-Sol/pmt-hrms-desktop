import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { isSystemAdmin } from '../../utils/system-admin';

export class NotificationSchemesService {
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
    return prisma.notificationScheme.create({
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
    return prisma.notificationScheme.findMany({
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
    const scheme = await prisma.notificationScheme.findUnique({
      where: { id: schemeId },
      include: { rules: true, assignments: true },
    });
    if (!scheme) {
      throw ApiError.notFound('Notification scheme not found');
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
    return prisma.notificationScheme.update({
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
    await prisma.notificationScheme.update({
      where: { id: schemeId },
      data: { status: 'inactive', updatedBy: userId },
    });
    return { message: 'Notification scheme deactivated' };
  }

  async createRule(
    userId: string,
    schemeId: string,
    input: {
      eventType: 'issue_created' | 'issue_updated' | 'issue_assigned' | 'issue_status_changed' | 'issue_commented' | 'issue_deleted' | 'project_member_added';
      recipientType: 'assignee' | 'reporter' | 'watchers' | 'specific_user' | 'user_role' | 'project_role' | 'group';
      recipientId?: string;
      isEnabled?: boolean;
      conditions?: Record<string, unknown>;
    }
  ) {
    const scheme = await this.getScheme(userId, schemeId);
    if (scheme.projectId) {
      await this.checkProjectAccess(scheme.projectId, userId, ['admin', 'lead']);
    }
    return prisma.notificationSchemeRule.create({
      data: {
        notificationSchemeId: schemeId,
        eventType: input.eventType,
        recipientType: input.recipientType,
        recipientId: input.recipientId || null,
        isEnabled: input.isEnabled ?? true,
        conditions: (input.conditions || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async assignProject(userId: string, projectId: string, notificationSchemeId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);
    return prisma.projectNotificationScheme.upsert({
      where: { projectId },
      create: {
        projectId,
        notificationSchemeId,
        assignedBy: userId,
      },
      update: {
        notificationSchemeId,
        assignedBy: userId,
      },
    });
  }
}

export const notificationSchemesService = new NotificationSchemesService();
