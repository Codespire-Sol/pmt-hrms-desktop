import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { isSystemAdmin } from '../../utils/system-admin';

export class UserGroupsService {
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

  async createGroup(
    projectId: string,
    userId: string,
    input: { name: string; description?: string }
  ) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);
    return prisma.userGroup.create({
      data: {
        projectId,
        name: input.name,
        description: input.description,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async listGroups(projectId: string, userId: string) {
    await this.checkProjectAccess(projectId, userId);
    return prisma.userGroup.findMany({
      where: { projectId },
      include: {
        members: true,
        roleBindings: true,
        projectRoleBindings: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getGroup(groupId: string, userId: string) {
    const group = await prisma.userGroup.findUnique({
      where: { id: groupId },
      include: {
        members: true,
        roleBindings: true,
        projectRoleBindings: true,
      },
    });
    if (!group) {
      throw ApiError.notFound('User group not found');
    }
    if (group.projectId) {
      await this.checkProjectAccess(group.projectId, userId);
    }
    return group;
  }

  async updateGroup(groupId: string, userId: string, input: { name?: string; description?: string | null }) {
    const group = await this.getGroup(groupId, userId);
    if (group.projectId) {
      await this.checkProjectAccess(group.projectId, userId, ['admin', 'lead']);
    }
    return prisma.userGroup.update({
      where: { id: groupId },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        updatedBy: userId,
      },
    });
  }

  async deleteGroup(groupId: string, userId: string) {
    const group = await this.getGroup(groupId, userId);
    if (group.projectId) {
      await this.checkProjectAccess(group.projectId, userId, ['admin', 'lead']);
    }
    await prisma.userGroup.delete({ where: { id: groupId } });
    return { message: 'User group deleted successfully' };
  }

  async addMember(groupId: string, targetUserId: string, userId: string) {
    const group = await this.getGroup(groupId, userId);
    if (group.projectId) {
      await this.checkProjectAccess(group.projectId, userId, ['admin', 'lead']);
    }

    return prisma.userGroupMember.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
      create: {
        groupId,
        userId: targetUserId,
        addedBy: userId,
      },
      update: {
        addedBy: userId,
      },
    });
  }

  async removeMember(groupId: string, targetUserId: string, userId: string) {
    const group = await this.getGroup(groupId, userId);
    if (group.projectId) {
      await this.checkProjectAccess(group.projectId, userId, ['admin', 'lead']);
    }
    await prisma.userGroupMember.deleteMany({
      where: {
        groupId,
        userId: targetUserId,
      },
    });
    return { message: 'Member removed from group' };
  }

  async bindGlobalRole(groupId: string, roleId: string, roleScope: 'hrms' | 'pmt', userId: string) {
    const group = await this.getGroup(groupId, userId);
    if (group.projectId) {
      await this.checkProjectAccess(group.projectId, userId, ['admin', 'lead']);
    }

    return prisma.groupRoleBinding.upsert({
      where: {
        groupId_roleId_roleScope: {
          groupId,
          roleId,
          roleScope,
        },
      },
      create: {
        groupId,
        roleId,
        roleScope,
        createdBy: userId,
      },
      update: {
        createdBy: userId,
      },
    });
  }

  async bindProjectRole(
    groupId: string,
    projectId: string,
    projectRole: 'admin' | 'lead' | 'member' | 'viewer',
    userId: string
  ) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);
    const group = await this.getGroup(groupId, userId);
    if (group.projectId && group.projectId !== projectId) {
      throw ApiError.badRequest('Group belongs to a different project');
    }

    return prisma.projectGroupRoleBinding.upsert({
      where: {
        groupId_projectId: {
          groupId,
          projectId,
        },
      },
      create: {
        groupId,
        projectId,
        projectRole,
        createdBy: userId,
      },
      update: {
        projectRole,
        createdBy: userId,
      },
    });
  }
}

export const userGroupsService = new UserGroupsService();
