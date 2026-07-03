import { prisma } from '../../database/prisma';
import { SprintMetric as PrismaSprintMetric } from '@prisma/client';
import { SprintMetric } from './sprints.types';

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date;
}

function toSnakeCaseMetric(p: PrismaSprintMetric): SprintMetric {
  return {
    id: p.id,
    sprint_id: p.sprintId,
    date: p.date.toISOString().split('T')[0],
    total_issues: p.totalIssues,
    completed_issues: p.completedIssues,
    total_story_points: p.totalStoryPoints,
    completed_story_points: p.completedStoryPoints,
    total_hours: Number(p.totalHours),
    completed_hours: Number(p.completedHours),
    added_issues: p.addedIssues,
    removed_issues: p.removedIssues,
    created_at: p.createdAt,
  };
}

export class SprintMetricsRepository {
  async findBySprint(sprintId: string): Promise<SprintMetric[]> {
    const metrics = await prisma.sprintMetric.findMany({
      where: { sprintId },
      orderBy: { date: 'asc' },
    });
    return metrics.map(toSnakeCaseMetric);
  }

  async upsert(data: Partial<SprintMetric>): Promise<SprintMetric> {
    const metricDate = toDate(data.date as any);
    const metric = await prisma.sprintMetric.upsert({
      where: {
        sprintId_date: {
          sprintId: data.sprint_id!,
          date: metricDate,
        },
      },
      update: {
        totalIssues: data.total_issues,
        completedIssues: data.completed_issues,
        totalStoryPoints: data.total_story_points,
        completedStoryPoints: data.completed_story_points,
        totalHours: data.total_hours,
        completedHours: data.completed_hours,
      },
      create: {
        sprintId: data.sprint_id!,
        date: metricDate,
        totalIssues: data.total_issues || 0,
        completedIssues: data.completed_issues || 0,
        totalStoryPoints: data.total_story_points || 0,
        completedStoryPoints: data.completed_story_points || 0,
        totalHours: data.total_hours || 0,
        completedHours: data.completed_hours || 0,
        addedIssues: data.added_issues || 0,
        removedIssues: data.removed_issues || 0,
      },
    });

    return toSnakeCaseMetric(metric);
  }

  async incrementScopeChange(
    sprintId: string,
    date: string | Date,
    added: number,
    removed: number
  ): Promise<void> {
    const metricDate = toDate(date);
    const existing = await prisma.sprintMetric.findUnique({
      where: {
        sprintId_date: { sprintId, date: metricDate },
      },
    });

    if (existing) {
      await prisma.sprintMetric.update({
        where: { id: existing.id },
        data: {
          addedIssues: { increment: added },
          removedIssues: { increment: removed },
        },
      });
    } else {
      await prisma.sprintMetric.create({
        data: {
          sprintId,
          date: metricDate,
          addedIssues: added,
          removedIssues: removed,
        },
      });
    }
  }

  async deleteBySprintId(sprintId: string): Promise<void> {
    await prisma.sprintMetric.deleteMany({ where: { sprintId } });
  }
}

export const sprintMetricsRepository = new SprintMetricsRepository();
