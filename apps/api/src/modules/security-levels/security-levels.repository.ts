import { prisma } from '../../database/prisma';
import {
  SecurityLevel,
  SecurityLevelWithRoles,
  CreateSecurityLevelInput,
  UpdateSecurityLevelInput,
} from './security-levels.types';

export class SecurityLevelsRepository {
  private mapRowToSecurityLevel(row: any): SecurityLevel {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      level: row.level ?? 0,
      isDefault: row.isDefault,
      sortOrder: row.position ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByProject(projectId: string): Promise<SecurityLevelWithRoles[]> {
    const levels = await prisma.securityLevel.findMany({
      where: { projectId },
      orderBy: [{ position: 'asc' }],
      include: {
        securityLevelRoles: {
          include: {
            role: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
      },
    });

    return levels.map((level) => ({
      ...this.mapRowToSecurityLevel(level),
      roles: level.securityLevelRoles.map((r) => ({
        id: r.role.id,
        name: r.role.name,
        displayName: r.role.displayName,
      })),
    }));
  }

  async findById(id: string): Promise<SecurityLevelWithRoles | null> {
    const level = await prisma.securityLevel.findUnique({
      where: { id },
      include: {
        securityLevelRoles: {
          include: {
            role: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
      },
    });

    if (!level) return null;

    return {
      ...this.mapRowToSecurityLevel(level),
      roles: level.securityLevelRoles.map((r) => ({
        id: r.role.id,
        name: r.role.name,
        displayName: r.role.displayName,
      })),
    };
  }

  async findByName(projectId: string, name: string): Promise<SecurityLevel | null> {
    const row = await prisma.securityLevel.findFirst({
      where: { projectId, name },
    });
    return row ? this.mapRowToSecurityLevel(row) : null;
  }

  async exists(projectId: string, name: string, excludeId?: string): Promise<boolean> {
    const where: any = { projectId, name };
    if (excludeId) {
      where.id = { not: excludeId };
    }
    const result = await prisma.securityLevel.findFirst({ where });
    return !!result;
  }

  async findDefaultForProject(projectId: string): Promise<SecurityLevel | null> {
    const row = await prisma.securityLevel.findFirst({
      where: { projectId, isDefault: true },
    });
    return row ? this.mapRowToSecurityLevel(row) : null;
  }

  async create(
    projectId: string,
    input: CreateSecurityLevelInput
  ): Promise<SecurityLevel> {
    // Get max position
    const maxOrder = await prisma.securityLevel.aggregate({
      where: { projectId },
      _max: { position: true },
    });

    const sortOrder = (maxOrder._max.position ?? -1) + 1;

    // If setting as default, clear other defaults
    if (input.isDefault) {
      await prisma.securityLevel.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const row = await prisma.securityLevel.create({
      data: {
        projectId,
        name: input.name,
        description: input.description,
        isDefault: input.isDefault ?? false,
        position: sortOrder,
      },
    });

    // Add role assignments
    if (input.roleIds && input.roleIds.length > 0) {
      await prisma.securityLevelRole.createMany({
        data: input.roleIds.map((roleId) => ({
          securityLevelId: row.id,
          roleId,
        })),
      });
    }

    return this.mapRowToSecurityLevel(row);
  }

  async update(
    id: string,
    input: UpdateSecurityLevelInput
  ): Promise<SecurityLevel | null> {
    const existing = await prisma.securityLevel.findUnique({ where: { id } });
    if (!existing) return null;

    // If setting as default, clear other defaults
    if (input.isDefault) {
      await prisma.securityLevel.updateMany({
        where: { projectId: existing.projectId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, any> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

    const row = await prisma.securityLevel.update({
      where: { id },
      data: updateData,
    });

    // Update role assignments
    if (input.roleIds !== undefined) {
      await prisma.securityLevelRole.deleteMany({ where: { securityLevelId: id } });
      if (input.roleIds.length > 0) {
        await prisma.securityLevelRole.createMany({
          data: input.roleIds.map((roleId) => ({
            securityLevelId: id,
            roleId,
          })),
        });
      }
    }

    return this.mapRowToSecurityLevel(row);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.securityLevel.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async reorder(projectId: string, orderedIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.securityLevel.updateMany({
          where: { id: orderedIds[i], projectId },
          data: { position: i },
        });
      }
    });
  }

  /**
   * Check if a user can view issues with a specific security level
   */
  async canUserViewSecurityLevel(
    securityLevelId: string,
    userId: string,
    projectId: string
  ): Promise<boolean> {
    // Get security level roles
    const securityLevel = await this.findById(securityLevelId);
    if (!securityLevel) return false;

    // If no roles are assigned, anyone with project access can view
    if (securityLevel.roles.length === 0) return true;

    // Check if user has one of the allowed roles in this project
    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
      },
    });

    if (!membership) return false;

    // Check if the user's global role is in the allowed security level roles
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    });

    if (!user?.roleId) return false;

    const allowedRoleIds = securityLevel.roles.map((r: any) => r.roleId);
    return allowedRoleIds.includes(user.roleId);
  }

  /**
   * Get all security level IDs a user can view for a project
   */
  async getViewableSecurityLevelIds(
    userId: string,
    projectId: string
  ): Promise<string[]> {
    // Get user's membership in the project
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId },
    });

    if (!membership) return [];

    // Get all security levels for the project
    const allLevels = await prisma.securityLevel.findMany({
      where: { projectId },
      include: {
        securityLevelRoles: {
          select: { roleId: true },
        },
      },
    });

    // Get user's global role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { roleId: true },
    });

    // Return levels where:
    // 1. No roles are specified (public within project)
    // 2. User's role is in the allowed roles
    return allLevels
      .filter((level) => {
        const allowedRoleIds = level.securityLevelRoles.map((r) => r.roleId);
        if (allowedRoleIds.length === 0) return true;
        return user?.roleId ? allowedRoleIds.includes(user.roleId) : false;
      })
      .map((l) => l.id);
  }
}

export const securityLevelsRepository = new SecurityLevelsRepository();
