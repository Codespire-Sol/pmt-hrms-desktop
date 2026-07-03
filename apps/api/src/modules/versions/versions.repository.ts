import { prisma } from '../../database/prisma';
import { Version, VersionWithStats, CreateVersionInput, UpdateVersionInput, VersionFilters } from './versions.types';

export class VersionsRepository {
  async create(projectId: string, input: CreateVersionInput): Promise<Version> {
    // Get max position for this project
    const maxSort = await prisma.version.aggregate({
      where: { projectId },
      _max: { position: true },
    });

    const version = await prisma.version.create({
      data: {
        projectId,
        name: input.name,
        description: input.description,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        releaseDate: input.releaseDate ? new Date(input.releaseDate) : undefined,
        position: (maxSort._max.position ?? 0) + 1,
      },
    });

    return this.mapToVersion(version);
  }

  async findById(id: string): Promise<VersionWithStats | null> {
    const version = await prisma.version.findUnique({
      where: { id },
    });

    if (!version) return null;

    const stats = await this.getVersionStats(id);

    return this.mapToVersionWithStats(version, stats);
  }

  async findByProject(projectId: string, filters: VersionFilters = {}): Promise<VersionWithStats[]> {
    const where: any = { projectId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const versions = await prisma.version.findMany({
      where,
      orderBy: { position: 'asc' },
    });

    // Get stats for all versions
    const result: VersionWithStats[] = [];
    for (const version of versions) {
      const stats = await this.getVersionStats(version.id);
      result.push(this.mapToVersionWithStats(version, stats));
    }

    return result;
  }

  async update(id: string, input: UpdateVersionInput): Promise<Version> {
    const updateData: Record<string, any> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.startDate !== undefined) updateData.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.releaseDate !== undefined) updateData.releaseDate = input.releaseDate ? new Date(input.releaseDate) : null;

    const version = await prisma.version.update({
      where: { id },
      data: updateData,
    });

    return this.mapToVersion(version);
  }

  async release(id: string, userId: string): Promise<Version> {
    const version = await prisma.version.update({
      where: { id },
      data: {
        status: 'released',
        actualReleaseDate: new Date(),
        releasedBy: userId,
      },
    });

    return this.mapToVersion(version);
  }

  async archive(id: string): Promise<Version> {
    const version = await prisma.version.update({
      where: { id },
      data: { status: 'archived' },
    });

    return this.mapToVersion(version);
  }

  async unarchive(id: string): Promise<Version> {
    const version = await prisma.version.update({
      where: { id },
      data: { status: 'unreleased' },
    });

    return this.mapToVersion(version);
  }

  async delete(id: string): Promise<void> {
    await prisma.version.delete({ where: { id } });
  }

  async exists(projectId: string, name: string, excludeId?: string): Promise<boolean> {
    const where: any = { projectId, name };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const result = await prisma.version.findFirst({ where });
    return !!result;
  }

  async reorder(projectId: string, orderedIds: string[]): Promise<void> {
    const updates = orderedIds.map((id, index) =>
      prisma.version.updateMany({
        where: { id, projectId },
        data: { position: index + 1 },
      })
    );

    await Promise.all(updates);
  }

  async getVersionIssues(versionId: string, type: 'fix' | 'affected' = 'fix', page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;
    const versionField = type === 'fix' ? 'fixVersion' : 'affectedVersion';

    // Since the Issue model uses string fields (fixVersion, affectedVersion) not FK references,
    // we need to find the version name first
    const version = await prisma.version.findUnique({ where: { id: versionId } });
    if (!version) return { issues: [], total: 0 };

    const where: any = {
      [versionField]: version.name,
      deletedAt: null,
    };

    const issues = await prisma.issue.findMany({
      where,
      include: {
        project: { select: { id: true, key: true } },
        status: { select: { id: true, name: true, displayName: true, color: true, category: true } },
        priority: { select: { id: true, name: true, displayName: true, color: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.issue.count({ where });

    return {
      issues: issues.map((i) => ({
        id: i.id,
        issue_key: `${i.project.key}-${i.issueNumber}`,
        title: i.title,
        status: i.status ? {
          id: i.status.id,
          name: i.status.name,
          displayName: i.status.displayName,
          color: i.status.color,
          category: i.status.category,
        } : null,
        priority: i.priority ? {
          id: i.priority.id,
          name: i.priority.name,
          displayName: i.priority.displayName,
          color: i.priority.color,
        } : null,
        assignee: i.assignee ? {
          id: i.assignee.id,
          displayName: `${i.assignee.firstName} ${i.assignee.lastName}`,
          avatarUrl: i.assignee.avatarUrl,
        } : null,
        story_points: i.storyPoints,
      })),
      total,
    };
  }

  async getVersionStats(versionId: string): Promise<{
    totalIssues: number;
    completedIssues: number;
    inProgressIssues: number;
    todoIssues: number;
    totalStoryPoints: number;
    completedStoryPoints: number;
  }> {
    // Get the version name for matching
    const version = await prisma.version.findUnique({ where: { id: versionId } });
    if (!version) {
      return {
        totalIssues: 0,
        completedIssues: 0,
        inProgressIssues: 0,
        todoIssues: 0,
        totalStoryPoints: 0,
        completedStoryPoints: 0,
      };
    }

    const issues = await prisma.issue.findMany({
      where: {
        fixVersion: version.name,
        deletedAt: null,
      },
      select: {
        id: true,
        storyPoints: true,
        status: { select: { category: true } },
      },
    });

    const totalIssues = issues.length;
    const completedIssues = issues.filter(i => i.status.category === 'done').length;
    const inProgressIssues = issues.filter(i => i.status.category === 'in_progress').length;
    const todoIssues = issues.filter(i => i.status.category === 'todo').length;
    const totalStoryPoints = issues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    const completedStoryPoints = issues
      .filter(i => i.status.category === 'done')
      .reduce((sum, i) => sum + (i.storyPoints || 0), 0);

    return {
      totalIssues,
      completedIssues,
      inProgressIssues,
      todoIssues,
      totalStoryPoints,
      completedStoryPoints,
    };
  }

  private mapToVersion(row: any): Version {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      status: row.status,
      startDate: row.startDate,
      releaseDate: row.releaseDate,
      actualReleaseDate: row.actualReleaseDate,
      releasedBy: row.releasedBy,
      sortOrder: row.position,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapToVersionWithStats(
    row: any,
    stats: {
      totalIssues: number;
      completedIssues: number;
      inProgressIssues: number;
      todoIssues: number;
      totalStoryPoints: number;
      completedStoryPoints: number;
    }
  ): VersionWithStats {
    const progress = stats.totalIssues > 0
      ? Math.round((stats.completedIssues / stats.totalIssues) * 100)
      : 0;

    return {
      ...this.mapToVersion(row),
      releasedByUser: undefined,
      stats,
      progress,
    };
  }
}
