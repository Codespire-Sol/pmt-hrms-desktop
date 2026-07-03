import { BoardsRepository } from './boards.repository';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { ApiError } from '../../utils/ApiError';
import { BoardQueryParams, SwimlaneGroupBy, BoardViewType } from './boards.types';
import { isSystemAdmin } from '../../utils/system-admin';
import { prisma } from '../../database/prisma';

export class BoardsService {
  private boardsRepository: BoardsRepository;
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.boardsRepository = new BoardsRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  /**
   * Get (or lazily create) the project's board record.
   */
  private async getProjectBoardOrThrow(projectId: string) {
    const board = await prisma.board.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    if (!board) {
      throw ApiError.badRequest(
        'No board found for this project. The project may need to be re-initialized.'
      );
    }
    return board;
  }

  async getBoardData(projectId: string, userId: string, params: BoardQueryParams = {}) {
    // Project membership check — members can see all project issues
    await this.checkAccess(projectId, userId);

    const { view = 'kanban', swimlane = 'none' } = params;

    let data;

    switch (view) {
      case 'list':
        data = await this.getListView(projectId, userId, params);
        break;
      case 'timeline':
        data = await this.getTimelineView(projectId, userId, params);
        break;
      case 'kanban':
      default:
        if (swimlane !== 'none') {
          data = await this.boardsRepository.getBoardDataWithSwimlanes(projectId, swimlane as SwimlaneGroupBy, params);
        } else {
          data = await this.boardsRepository.getBoardData(projectId, params);
        }
        break;
    }

    if (!data) {
      throw ApiError.notFound('Project not found');
    }

    // Add epics and sprints to filters
    if (data.filters) {
      data.filters.epics = await this.boardsRepository.getEpics(projectId);
      data.filters.sprints = await this.boardsRepository.getSprints(projectId);
    }

    return {
      ...data,
      viewType: view,
      swimlaneGroupBy: swimlane,
    };
  }

  async getListView(projectId: string, userId: string, params: BoardQueryParams = {}) {
    await this.checkAccess(projectId, userId);

    const items = await this.boardsRepository.getListViewData(projectId, params);

    // Get project info
    const project = await this.boardsRepository.getBoardData(projectId, params);

    return {
      project: project?.project,
      viewType: 'list' as BoardViewType,
      items,
      filters: project?.filters || {},
    };
  }

  async getTimelineView(projectId: string, userId: string, params: BoardQueryParams = {}) {
    await this.checkAccess(projectId, userId);

    const items = await this.boardsRepository.getTimelineViewData(projectId, params);

    // Get project info
    const project = await this.boardsRepository.getBoardData(projectId, params);

    return {
      project: project?.project,
      viewType: 'timeline' as BoardViewType,
      items,
      filters: project?.filters || {},
    };
  }

  async updateColumn(
    projectId: string,
    statusId: string,
    input: { wipLimit?: number | null; category?: string; displayName?: string; color?: string },
    userId: string
  ) {
    // Check project access (admin or lead only)
    await this.checkAccess(projectId, userId, ['admin', 'lead']);

    // Update the status record for display metadata
    const statusUpdate: any = {};
    if (input.wipLimit !== undefined) statusUpdate.wipLimit = input.wipLimit;
    if (input.category !== undefined) statusUpdate.category = input.category;
    if (input.displayName !== undefined) statusUpdate.displayName = input.displayName;
    if (input.color !== undefined) statusUpdate.color = input.color;

    const status = await prisma.status.update({
      where: { id: statusId },
      data: statusUpdate,
    });

    // Also update wipLimit on the board_column if present
    if (input.wipLimit !== undefined) {
      await prisma.boardColumn.updateMany({
        where: { statusId },
        data: { wipLimit: input.wipLimit },
      });
    }

    return status;
  }

  /** @deprecated Use updateColumn instead */
  async updateStatusWipLimit(projectId: string, statusId: string, wipLimit: number | null, userId: string) {
    return this.updateColumn(projectId, statusId, { wipLimit }, userId);
  }

  async checkWipLimit(projectId: string, statusId: string): Promise<{
    canAdd: boolean;
    wipLimit: number | null;
    currentCount: number;
  }> {
    const { wipLimit, currentCount } = await this.boardsRepository.getStatusWipInfo(statusId, projectId);
    return {
      canAdd: wipLimit === null || currentCount < wipLimit,
      wipLimit,
      currentCount,
    };
  }

  async createColumn(
    projectId: string,
    input: {
      name?: string;
      displayName: string;
      description?: string;
      color?: string;
      category?: string;
      wipLimit?: number | null;
    },
    userId: string
  ) {
    await this.checkAccess(projectId, userId, ['admin', 'lead']);
    const board = await this.getProjectBoardOrThrow(projectId);

    // Check existing board columns for name uniqueness
    const existingColumns = await prisma.boardColumn.findMany({
      where: { boardId: board.id },
      select: { name: true, position: true },
    });
    const existingNames = new Set(existingColumns.map((col) => col.name.toLowerCase()));

    const preferredName = (input.name || input.displayName || 'status').trim();
    const normalizedBaseName = preferredName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 45) || 'status';

    let resolvedName = normalizedBaseName;
    let suffix = 2;
    while (existingNames.has(resolvedName)) {
      resolvedName = `${normalizedBaseName}_${suffix++}`.slice(0, 50);
    }

    // Determine max position
    const maxPosition = existingColumns.reduce((max, col) => Math.max(max, col.position), -1);

    // Get or create the workflow for the project (needed to create a Status record)
    let workflow = await prisma.workflow.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    if (!workflow) {
      workflow = await prisma.workflow.create({
        data: {
          name: 'Board Workflow',
          description: 'Auto-created workflow for board columns',
          projectId,
          isDefault: false,
          isActive: true,
        },
      });
    }

    // Create both a status record and a board column in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const status = await tx.status.create({
        data: {
          workflowId: workflow!.id,
          name: resolvedName,
          displayName: input.displayName,
          description: input.description,
          color: input.color || '#6B7280',
          category: input.category || 'todo',
          position: maxPosition + 1,
          wipLimit: input.wipLimit ?? null,
          isInitial: false,
          isFinal: false,
        },
      });

      const boardColumn = await tx.boardColumn.create({
        data: {
          boardId: board.id,
          statusId: status.id,
          name: resolvedName,
          position: maxPosition + 1,
          wipLimit: input.wipLimit ?? null,
        },
      });

      return { ...status, boardColumnId: boardColumn.id };
    });

    return result;
  }

  async reorderColumns(projectId: string, statusIds: string[], userId: string) {
    await this.checkAccess(projectId, userId, ['admin', 'lead']);
    const board = await this.getProjectBoardOrThrow(projectId);

    // Get board columns joined with their statuses
    const existingColumns = await prisma.boardColumn.findMany({
      where: { boardId: board.id },
      select: { id: true, statusId: true, position: true },
      orderBy: { position: 'asc' },
    });
    const statusIdToColumnId = new Map(existingColumns.map((col) => [col.statusId, col.id]));
    const existingStatusIds = new Set(existingColumns.map((col) => col.statusId));

    for (const statusId of statusIds) {
      if (!existingStatusIds.has(statusId)) {
        throw ApiError.badRequest('One or more columns do not belong to this project board');
      }
    }

    // Allow partial reorder payloads by appending omitted columns in current order.
    const provided = new Set(statusIds);
    const remaining = existingColumns
      .map((col) => col.statusId)
      .filter((sid) => !provided.has(sid));
    const finalOrder = [...statusIds, ...remaining];

    // Update board_columns positions
    await prisma.$transaction(
      finalOrder.map((statusId, i) => {
        const columnId = statusIdToColumnId.get(statusId)!;
        return prisma.boardColumn.update({
          where: { id: columnId },
          data: { position: i },
        });
      })
    );

    // Return updated columns with status info
    const updated = await prisma.boardColumn.findMany({
      where: { boardId: board.id },
      include: { status: true },
      orderBy: { position: 'asc' },
    });

    return updated.map((col) => ({
      id: col.status.id,
      name: col.status.name,
      displayName: col.status.displayName,
      description: col.status.description,
      color: col.status.color,
      category: col.status.category,
      position: col.position,
      isInitial: col.status.isInitial,
      isFinal: col.status.isFinal,
      wipLimit: col.wipLimit ?? col.status.wipLimit,
    }));
  }

  async deleteColumn(projectId: string, statusId: string, userId: string): Promise<{ message: string }> {
    await this.checkAccess(projectId, userId, ['admin', 'lead']);
    const board = await this.getProjectBoardOrThrow(projectId);

    // Find the board column by its linked statusId
    const boardColumn = await prisma.boardColumn.findFirst({
      where: { boardId: board.id, statusId },
      include: { status: true },
    });
    if (!boardColumn) {
      throw ApiError.notFound('Column not found');
    }
    if (boardColumn.status.isInitial || boardColumn.status.isFinal) {
      throw ApiError.badRequest('Cannot delete initial or final column');
    }

    // Check if any issues reference this status
    const issueCount = await prisma.issue.count({
      where: { statusId, deletedAt: null },
    });
    if (issueCount > 0) {
      throw ApiError.badRequest('Cannot delete column that has issues assigned to it. Move or delete those issues first.');
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Delete the board column first (FK constraint)
        await tx.boardColumn.delete({ where: { id: boardColumn.id } });
        // Also delete related transitions
        await tx.statusTransition.deleteMany({
          where: { OR: [{ fromStatusId: statusId }, { toStatusId: statusId }] },
        });
        // Delete the status record
        await tx.status.delete({ where: { id: statusId } });
      });
    } catch (error: any) {
      throw ApiError.badRequest(error?.message || 'Failed to delete column');
    }

    return { message: 'Board column deleted successfully' };
  }

  async validateWipLimit(projectId: string, statusId: string): Promise<void> {
    const { canAdd, wipLimit, currentCount } = await this.checkWipLimit(projectId, statusId);
    if (!canAdd) {
      throw ApiError.badRequest(
        `WIP limit exceeded. Column has ${currentCount}/${wipLimit} issues.`,
        'WIP_LIMIT_EXCEEDED'
      );
    }
  }

  private async checkAccess(projectId: string, userId: string, requiredRoles?: string[]) {
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
}
