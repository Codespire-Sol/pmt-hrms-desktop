import { prisma } from '../../database/prisma';
import { Epic, EpicWithStats, CreateEpicInput, UpdateEpicInput, EpicFilters, EpicProgress } from './epics.types';

export class EpicsRepository {
  async create(projectId: string, input: CreateEpicInput, userId: string): Promise<Epic> {
    // Get max position for this project
    const maxSort = await prisma.epic.aggregate({
      where: { projectId },
      _max: { position: true },
    });

    const epic = await prisma.epic.create({
      data: {
        projectId,
        name: input.name,
        summary: input.summary,
        description: input.description,
        color: input.color || '#6366f1',
        status: input.status || 'to_do',
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        position: (maxSort._max.position ?? 0) + 1,
        createdBy: userId,
      },
    });

    return this.mapToEpic(epic);
  }

  async findById(id: string): Promise<EpicWithStats | null> {
    const epic = await prisma.epic.findUnique({
      where: { id },
    });

    if (!epic) return null;

    const stats = await this.getEpicStats(id);

    return this.mapToEpicWithStats(epic, stats);
  }

  async findByProject(projectId: string, filters: EpicFilters = {}): Promise<EpicWithStats[]> {
    const where: any = { projectId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { summary: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const epics = await prisma.epic.findMany({
      where,
      orderBy: { position: 'asc' },
    });

    // Get stats for all epics
    const result: EpicWithStats[] = [];
    for (const epic of epics) {
      const stats = await this.getEpicStats(epic.id);
      result.push(this.mapToEpicWithStats(epic, stats));
    }

    return result;
  }

  async update(id: string, input: UpdateEpicInput): Promise<Epic> {
    const updateData: Record<string, any> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.summary !== undefined) updateData.summary = input.summary;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.startDate !== undefined) updateData.startDate = input.startDate ? new Date(input.startDate) : null;
    if (input.endDate !== undefined) updateData.endDate = input.endDate ? new Date(input.endDate) : null;
    if (input.position !== undefined) updateData.position = input.position;

    const epic = await prisma.epic.update({
      where: { id },
      data: updateData,
    });

    return this.mapToEpic(epic);
  }

  async delete(id: string): Promise<void> {
    // Remove epic reference from all associated issues first
    await prisma.issue.updateMany({
      where: { epicId: id },
      data: { epicId: null },
    });

    await prisma.epic.delete({ where: { id } });
  }

  async exists(projectId: string, name: string, excludeId?: string): Promise<boolean> {
    const where: any = { projectId, name };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const result = await prisma.epic.findFirst({ where });
    return !!result;
  }

  async assignIssues(epicId: string, issueIds: string[]): Promise<void> {
    await prisma.issue.updateMany({
      where: {
        id: { in: issueIds },
        deletedAt: null,
      },
      data: { epicId },
    });
  }

  async removeIssues(epicId: string, issueIds: string[]): Promise<void> {
    await prisma.issue.updateMany({
      where: {
        id: { in: issueIds },
        epicId,
        deletedAt: null,
      },
      data: { epicId: null },
    });
  }

  async getEpicIssues(epicId: string, page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;

    const where: any = {
      epicId,
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

  async getEpicStats(epicId: string): Promise<EpicProgress> {
    const issues = await prisma.issue.findMany({
      where: {
        epicId,
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

  private mapToEpic(row: any): Epic {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      summary: row.summary,
      description: row.description,
      color: row.color,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      position: row.position,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapToEpicWithStats(
    row: any,
    stats: EpicProgress
  ): EpicWithStats {
    const progress = stats.totalIssues > 0
      ? Math.round((stats.completedIssues / stats.totalIssues) * 100)
      : 0;

    return {
      ...this.mapToEpic(row),
      stats,
      progress,
    };
  }
}
