import { prisma } from '../../database/prisma';

export interface Workflow {
  id: string;
  projectId?: string | null;
  name: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Status {
  id: string;
  workflowId: string;
  name: string;
  displayName: string;
  description?: string;
  color: string;
  category: string;
  position: number;
  wipLimit?: number;
  isInitial: boolean;
  isFinal: boolean;
  createdAt: Date;
}

export interface StatusTransition {
  id: string;
  workflowId: string;
  fromStatusId: string;
  toStatusId: string;
  name?: string | null;
}

export class WorkflowsRepository {
  // ==================== WORKFLOWS ====================

  async findAll(projectId?: string): Promise<Workflow[]> {
    if (projectId) {
      // Return project-specific workflows + global defaults (no projectId)
      return prisma.workflow.findMany({
        where: {
          OR: [
            { projectId },
            { projectId: null, isDefault: true },
          ],
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      }) as unknown as Workflow[];
    }

    return prisma.workflow.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    }) as unknown as Workflow[];
  }

  async findById(id: string): Promise<Workflow | null> {
    return prisma.workflow.findUnique({
      where: { id },
    }) as unknown as Workflow | null;
  }

  async findByProject(projectId: string): Promise<Workflow | null> {
    return prisma.workflow.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    }) as unknown as Workflow | null;
  }

  async findDefault(): Promise<Workflow | null> {
    // Prefer a global default (no projectId) first
    const global = await prisma.workflow.findFirst({
      where: { isDefault: true, projectId: null },
    }) as unknown as Workflow | null;
    if (global) return global;

    // Fall back to any default
    return prisma.workflow.findFirst({
      where: { isDefault: true },
    }) as unknown as Workflow | null;
  }

  async findOrCreateGlobalDefault(): Promise<Workflow> {
    const existing = await this.findDefault();
    if (existing) return existing;

    // Create the one global default workflow
    return prisma.workflow.create({
      data: {
        name: 'Default Workflow',
        description: 'Default workflow for all projects',
        projectId: null,
        isDefault: true,
        isActive: true,
      },
    }) as unknown as Workflow;
  }

  async create(data: {
    name: string;
    description?: string;
    projectId?: string | null;
    isDefault?: boolean;
  }): Promise<Workflow> {
    return prisma.workflow.create({
      data: {
        name: data.name,
        description: data.description,
        projectId: data.projectId ?? null,
        isDefault: data.isDefault || false,
      },
    }) as unknown as Workflow;
  }

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    isActive: boolean;
  }>): Promise<Workflow> {
    const updateData: any = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.workflow.update({
      where: { id },
      data: updateData,
    }) as unknown as Workflow;
  }

  async delete(id: string): Promise<boolean> {
    // Check if any issues reference statuses in this workflow
    const statuses = await prisma.status.findMany({
      where: { workflowId: id },
      select: { id: true },
    });
    const statusIds = statuses.map((s) => s.id);

    if (statusIds.length > 0) {
      const issueCount = await prisma.issue.count({
        where: { statusId: { in: statusIds } },
      });
      if (issueCount > 0) {
        throw new Error(
          `Cannot delete workflow: ${issueCount} issue(s) are using statuses from this workflow. Reassign or delete those issues first.`
        );
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Get all transitions for this workflow
        const transitions = await tx.statusTransition.findMany({
          where: { workflowId: id },
          select: { id: true },
        });
        const transitionIds = transitions.map((t) => t.id);

        // 2. Delete transition sub-records
        if (transitionIds.length > 0) {
          await tx.workflowTransitionCondition.deleteMany({ where: { transitionId: { in: transitionIds } } });
          await tx.workflowTransitionValidator.deleteMany({ where: { transitionId: { in: transitionIds } } });
          await tx.workflowTransitionPostfunction.deleteMany({ where: { transitionId: { in: transitionIds } } });
          await tx.workflowTransitionApproval.deleteMany({ where: { transitionId: { in: transitionIds } } });
          await tx.issueTransitionApproval.deleteMany({ where: { transitionId: { in: transitionIds } } });
        }

        // 3. Delete all transitions
        await tx.statusTransition.deleteMany({ where: { workflowId: id } });

        // 4. Delete all statuses (no issues reference them — checked above)
        await tx.status.deleteMany({ where: { workflowId: id } });

        // 5. Delete the workflow itself (only if not default)
        await tx.workflow.deleteMany({
          where: { id, isDefault: false },
        });
      });
      return true;
    } catch (err: any) {
      console.error('Failed to delete workflow:', err);
      throw err; // Re-throw so service/controller can handle with proper message
    }
  }

  async duplicate(sourceId: string, name: string, projectId?: string | null): Promise<Workflow> {
    const source = await this.findById(sourceId);
    if (!source) {
      throw new Error('Source workflow not found');
    }

    const workflow = await this.create({
      name,
      description: source.description,
      projectId: projectId ?? null,
    });

    // Copy statuses
    const statuses = await this.findStatusesByWorkflow(sourceId);
    const statusIdMap: Record<string, string> = {};

    for (const status of statuses) {
      const newStatus = await this.createStatus({
        workflowId: workflow.id,
        name: status.name,
        displayName: status.displayName,
        description: status.description,
        color: status.color,
        category: status.category,
        position: status.position,
        wipLimit: status.wipLimit,
        isInitial: status.isInitial,
        isFinal: status.isFinal,
      });
      statusIdMap[status.id] = newStatus.id;
    }

    // Copy transitions
    const transitions = await this.findTransitionsByWorkflow(sourceId);
    for (const transition of transitions) {
      const fromId = statusIdMap[transition.fromStatusId];
      const toId = statusIdMap[transition.toStatusId];
      if (fromId && toId) {
        await this.createTransition({
          workflowId: workflow.id,
          fromStatusId: fromId,
          toStatusId: toId,
          name: transition.name ?? undefined,
        });
      }
    }

    return workflow;
  }

  // ==================== STATUSES ====================

  async findStatusesByWorkflow(workflowId: string): Promise<Status[]> {
    return prisma.status.findMany({
      where: { workflowId },
      orderBy: { position: 'asc' },
    }) as unknown as Status[];
  }

  async findStatusById(id: string): Promise<Status | null> {
    return prisma.status.findUnique({
      where: { id },
    }) as unknown as Status | null;
  }

  async createStatus(data: {
    workflowId: string;
    name: string;
    displayName: string;
    description?: string;
    color?: string;
    category: string;
    position?: number;
    wipLimit?: number;
    isInitial?: boolean;
    isFinal?: boolean;
  }): Promise<Status> {
    let position = data.position;
    if (position === undefined) {
      const maxPos = await prisma.status.aggregate({
        where: { workflowId: data.workflowId },
        _max: { position: true },
      });
      position = (maxPos._max.position ?? 0) + 1;
    }

    return prisma.status.create({
      data: {
        workflowId: data.workflowId,
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        color: data.color || '#6B7280',
        category: data.category,
        position,
        wipLimit: data.wipLimit,
        isInitial: data.isInitial || false,
        isFinal: data.isFinal || false,
      },
    }) as unknown as Status;
  }

  async updateStatus(id: string, data: Partial<{
    name: string;
    displayName: string;
    description: string;
    color: string;
    category: string;
    position: number;
    wipLimit: number | null;
    isInitial: boolean;
    isFinal: boolean;
  }>): Promise<Status> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.wipLimit !== undefined) updateData.wipLimit = data.wipLimit;
    if (data.isInitial !== undefined) updateData.isInitial = data.isInitial;
    if (data.isFinal !== undefined) updateData.isFinal = data.isFinal;

    return prisma.status.update({
      where: { id },
      data: updateData,
    }) as unknown as Status;
  }

  async deleteStatus(id: string): Promise<boolean> {
    const issueCount = await prisma.issue.count({
      where: { statusId: id },
    });

    if (issueCount > 0) {
      throw new Error('Cannot delete status that is in use by issues');
    }

    // Delete related transitions first
    await prisma.statusTransition.deleteMany({
      where: {
        OR: [
          { fromStatusId: id },
          { toStatusId: id },
        ],
      },
    });

    await prisma.status.delete({ where: { id } });
    return true;
  }

  async reorderStatuses(workflowId: string, statusIds: string[]): Promise<void> {
    await prisma.$transaction(
      statusIds.map((statusId, i) =>
        prisma.status.updateMany({
          where: { id: statusId, workflowId },
          data: { position: i },
        })
      )
    );
  }

  // ==================== TRANSITIONS ====================

  async findTransitionsByWorkflow(workflowId: string): Promise<StatusTransition[]> {
    return prisma.statusTransition.findMany({
      where: { workflowId },
    }) as unknown as StatusTransition[];
  }

  async findTransitionsFrom(statusId: string): Promise<StatusTransition[]> {
    return prisma.statusTransition.findMany({
      where: { fromStatusId: statusId },
    }) as unknown as StatusTransition[];
  }

  async findTransitionByFromTo(fromStatusId: string, toStatusId: string): Promise<StatusTransition | null> {
    return prisma.statusTransition.findFirst({
      where: { fromStatusId, toStatusId },
    }) as unknown as StatusTransition | null;
  }

  async createTransition(data: {
    workflowId: string;
    fromStatusId: string;
    toStatusId: string;
    name?: string;
  }): Promise<StatusTransition> {
    // Check for duplicate
    const existing = await prisma.statusTransition.findFirst({
      where: {
        workflowId: data.workflowId,
        fromStatusId: data.fromStatusId,
        toStatusId: data.toStatusId,
      },
    });
    if (existing) return existing as unknown as StatusTransition;

    return prisma.statusTransition.create({
      data: {
        workflowId: data.workflowId,
        fromStatusId: data.fromStatusId,
        toStatusId: data.toStatusId,
        name: data.name ?? null,
      },
    }) as unknown as StatusTransition;
  }

  async deleteTransition(id: string): Promise<boolean> {
    try {
      // First delete related conditions/validators/postfunctions
      await prisma.workflowTransitionCondition.deleteMany({ where: { transitionId: id } });
      await prisma.workflowTransitionValidator.deleteMany({ where: { transitionId: id } });
      await prisma.workflowTransitionPostfunction.deleteMany({ where: { transitionId: id } });
      await prisma.workflowTransitionApproval.deleteMany({ where: { transitionId: id } });
      await prisma.statusTransition.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteTransitionByStatuses(fromStatusId: string, toStatusId: string): Promise<boolean> {
    const result = await prisma.statusTransition.deleteMany({
      where: { fromStatusId, toStatusId },
    });
    return result.count > 0;
  }

  async setTransitions(workflowId: string, transitions: { fromStatusId: string; toStatusId: string; name?: string }[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Delete conditions on existing transitions first
      const existing = await tx.statusTransition.findMany({ where: { workflowId }, select: { id: true } });
      const ids = existing.map((t) => t.id);
      if (ids.length > 0) {
        await tx.workflowTransitionCondition.deleteMany({ where: { transitionId: { in: ids } } });
        await tx.workflowTransitionValidator.deleteMany({ where: { transitionId: { in: ids } } });
        await tx.workflowTransitionPostfunction.deleteMany({ where: { transitionId: { in: ids } } });
        await tx.workflowTransitionApproval.deleteMany({ where: { transitionId: { in: ids } } });
      }

      await tx.statusTransition.deleteMany({ where: { workflowId } });

      if (transitions.length > 0) {
        await tx.statusTransition.createMany({
          data: transitions.map((t) => ({
            workflowId,
            fromStatusId: t.fromStatusId,
            toStatusId: t.toStatusId,
            name: t.name ?? null,
          })),
        });
      }
    });
  }
}

export const workflowsRepository = new WorkflowsRepository();
