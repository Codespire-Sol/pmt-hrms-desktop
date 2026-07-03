import { prisma } from '../../database/prisma';
import { Sprint as PrismaSprint } from '@prisma/client';
import { Sprint, SprintFilters } from './sprints.types';

function toSnakeCaseSprint(p: PrismaSprint): Sprint {
  return {
    id: p.id,
    project_id: p.projectId,
    name: p.name,
    goal: p.goal ?? undefined,
    status: p.status as Sprint['status'],
    start_date: p.startDate?.toISOString(),
    end_date: p.endDate?.toISOString(),
    actual_start_date: p.actualStartDate?.toISOString(),
    actual_end_date: p.actualEndDate?.toISOString(),
    capacity_hours: p.capacityHours ? Number(p.capacityHours) : undefined,
    sequence: p.sequence,
    created_by: p.createdBy,
    completed_by: p.completedBy ?? undefined,
    retrospective_notes: p.retrospectiveNotes ?? undefined,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export class SprintsRepository {
  async create(data: Partial<Sprint>): Promise<Sprint> {
    const sprint = await prisma.sprint.create({
      data: {
        id: data.id,
        projectId: data.project_id!,
        name: data.name!,
        goal: data.goal,
        status: data.status || 'planned',
        startDate: data.start_date,
        endDate: data.end_date,
        capacityHours: data.capacity_hours,
        sequence: data.sequence,
        createdBy: data.created_by!,
      },
    });

    return toSnakeCaseSprint(sprint);
  }

  async findById(id: string): Promise<Sprint | null> {
    const sprint = await prisma.sprint.findUnique({ where: { id } });
    return sprint ? toSnakeCaseSprint(sprint) : null;
  }

  async findByProject(projectId: string, filters: SprintFilters): Promise<Sprint[]> {
    const where: any = { projectId };

    if (filters.status) {
      const statuses = filters.status.split(',');
      where.status = { in: statuses };
    }

    const sprints = await prisma.sprint.findMany({
      where,
      orderBy: { sequence: 'desc' },
      ...(filters.limit ? { take: filters.limit } : {}),
      ...(filters.page && filters.limit
        ? { skip: (filters.page - 1) * filters.limit }
        : {}),
    });

    return sprints.map(toSnakeCaseSprint);
  }

  async findActive(projectId: string): Promise<Sprint | null> {
    const sprint = await prisma.sprint.findFirst({
      where: { projectId, status: 'active' },
    });
    return sprint ? toSnakeCaseSprint(sprint) : null;
  }

  async findCompleted(projectId: string, limit: number = 5): Promise<Sprint[]> {
    const sprints = await prisma.sprint.findMany({
      where: { projectId, status: 'completed' },
      orderBy: { actualEndDate: 'desc' },
      take: limit,
    });
    return sprints.map(toSnakeCaseSprint);
  }

  async countByProject(projectId: string, filters: SprintFilters): Promise<number> {
    const where: any = { projectId };

    if (filters.status) {
      const statuses = filters.status.split(',');
      where.status = { in: statuses };
    }

    return prisma.sprint.count({ where });
  }

  async getNextSequence(projectId: string): Promise<number> {
    const result = await prisma.sprint.aggregate({
      where: { projectId },
      _max: { sequence: true },
    });

    return (result._max.sequence || 0) + 1;
  }

  async update(id: string, data: Partial<Sprint>): Promise<Sprint> {
    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.goal !== undefined) updateData.goal = data.goal;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.start_date !== undefined) updateData.startDate = data.start_date;
    if (data.end_date !== undefined) updateData.endDate = data.end_date;
    if (data.actual_start_date !== undefined) updateData.actualStartDate = data.actual_start_date;
    if (data.actual_end_date !== undefined) updateData.actualEndDate = data.actual_end_date;
    if (data.capacity_hours !== undefined) updateData.capacityHours = data.capacity_hours;
    if (data.completed_by !== undefined) updateData.completedBy = data.completed_by;
    if (data.retrospective_notes !== undefined) updateData.retrospectiveNotes = data.retrospective_notes;

    const sprint = await prisma.sprint.update({
      where: { id },
      data: updateData,
    });

    return toSnakeCaseSprint(sprint);
  }

  async delete(id: string): Promise<void> {
    await prisma.sprint.delete({ where: { id } });
  }
}

export const sprintsRepository = new SprintsRepository();
