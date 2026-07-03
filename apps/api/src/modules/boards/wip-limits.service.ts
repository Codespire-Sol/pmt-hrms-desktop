import { prisma } from '../../database/prisma';
import {
  ColumnWipLimit,
  BoardSettings,
  WipLimitViolation,
  WipLimitStatus,
  BoardWipStatus,
  UpdateColumnWipLimitInput,
  UpdateBoardSettingsInput,
  WipLimitType,
} from './wip-limits.types';

export class WipLimitsService {
  // === Board Settings ===

  async getBoardSettings(boardId: string): Promise<BoardSettings | null> {
    const settings = await prisma.boardSettings.findUnique({
      where: { boardId },
    });
    return settings ? this.mapBoardSettings(settings) : null;
  }

  async updateBoardSettings(boardId: string, input: UpdateBoardSettingsInput): Promise<BoardSettings> {
    const existing = await this.getBoardSettings(boardId);

    if (existing) {
      const updateData: any = {};
      if (input.wipLimitsEnabled !== undefined) updateData.wipLimitsEnabled = input.wipLimitsEnabled;
      if (input.defaultWipType !== undefined) updateData.defaultWipType = input.defaultWipType;
      if (input.showWipWarnings !== undefined) updateData.showWipWarnings = input.showWipWarnings;
      if (input.trackWipViolations !== undefined) updateData.trackWipViolations = input.trackWipViolations;
      if (input.swimlaneWipLimits !== undefined) updateData.swimlaneWipLimits = input.swimlaneWipLimits;

      await prisma.boardSettings.update({
        where: { boardId },
        data: updateData,
      });
    } else {
      await prisma.boardSettings.create({
        data: {
          boardId,
          wipLimitsEnabled: input.wipLimitsEnabled ?? false,
          defaultWipType: input.defaultWipType ?? 'soft',
          showWipWarnings: input.showWipWarnings ?? true,
          trackWipViolations: input.trackWipViolations ?? true,
          swimlaneWipLimits: input.swimlaneWipLimits ?? {},
        },
      });
    }

    return (await this.getBoardSettings(boardId))!;
  }

  // === Column WIP Limits ===

  async getColumnWipLimits(boardId: string): Promise<ColumnWipLimit[]> {
    const columns = await prisma.boardColumn.findMany({
      where: { boardId },
      select: { id: true, wipLimit: true, wipLimitEnabled: true, wipLimitType: true, position: true },
      orderBy: { position: 'asc' },
    });

    return columns.map((col) => ({
      columnId: col.id,
      wipLimit: col.wipLimit,
      wipLimitEnabled: col.wipLimitEnabled,
      wipLimitType: col.wipLimitType,
    }));
  }

  async updateColumnWipLimit(columnId: string, input: UpdateColumnWipLimitInput): Promise<ColumnWipLimit> {
    const updateData: any = {};
    if (input.wipLimit !== undefined) updateData.wipLimit = input.wipLimit;
    if (input.wipLimitEnabled !== undefined) updateData.wipLimitEnabled = input.wipLimitEnabled;
    if (input.wipLimitType !== undefined) updateData.wipLimitType = input.wipLimitType;

    await prisma.boardColumn.update({
      where: { id: columnId },
      data: updateData,
    });

    const column = await prisma.boardColumn.findUnique({
      where: { id: columnId },
      select: { id: true, wipLimit: true, wipLimitEnabled: true, wipLimitType: true },
    });

    return {
      columnId: column!.id,
      wipLimit: column!.wipLimit,
      wipLimitEnabled: column!.wipLimitEnabled,
      wipLimitType: column!.wipLimitType,
    };
  }

  // === WIP Status ===

  async getBoardWipStatus(boardId: string): Promise<BoardWipStatus> {
    const settings = await this.getBoardSettings(boardId);
    const wipLimitsEnabled = settings?.wipLimitsEnabled ?? false;

    // Get the project_id for the board
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { projectId: true },
    });

    // Get columns with their issue counts using raw query for the join/group aggregation
    const columns = await prisma.$queryRaw<any[]>`
      SELECT
        bc.id,
        bc.name,
        bc.wip_limit AS "wipLimit",
        bc.wip_limit_enabled AS "wipLimitEnabled",
        bc.wip_limit_type AS "wipLimitType",
        COUNT(i.id)::int AS "issueCount"
      FROM board_columns bc
      LEFT JOIN issues i ON bc.status_id = i.status_id AND i.project_id = ${board?.projectId}
      WHERE bc.board_id = ${boardId}::uuid
      GROUP BY bc.id, bc.name, bc.wip_limit, bc.wip_limit_enabled, bc.wip_limit_type, bc.position
      ORDER BY bc.position ASC
    `;

    const columnStatuses: WipLimitStatus[] = columns.map((col: any) => {
      const wipLimit = col.wipLimit;
      const wipLimitEnabled = col.wipLimitEnabled;
      const wipLimitType = col.wipLimitType as WipLimitType;
      const currentCount = col.issueCount || 0;
      const isOverLimit = wipLimitEnabled && wipLimit !== null && currentCount >= wipLimit;
      const canAdd = !isOverLimit || wipLimitType === 'soft';

      let warningMessage: string | undefined;
      if (isOverLimit) {
        if (wipLimitType === 'hard') {
          warningMessage = `Column "${col.name}" has reached its WIP limit of ${wipLimit}. Cannot add more issues.`;
        } else {
          warningMessage = `Column "${col.name}" has exceeded its WIP limit of ${wipLimit}.`;
        }
      } else if (wipLimitEnabled && wipLimit !== null && currentCount === wipLimit - 1) {
        warningMessage = `Column "${col.name}" is at ${currentCount}/${wipLimit} - one away from WIP limit.`;
      }

      return {
        columnId: col.id,
        columnName: col.name,
        wipLimit,
        wipLimitType,
        currentCount,
        isOverLimit,
        canAdd,
        warningMessage,
      };
    });

    const hasViolations = columnStatuses.some((cs) => cs.isOverLimit);

    return {
      boardId,
      wipLimitsEnabled,
      columns: columnStatuses,
      hasViolations,
    };
  }

  async checkCanMoveIssue(
    boardId: string,
    toColumnId: string,
    _fromColumnId?: string
  ): Promise<{ canMove: boolean; warningMessage?: string; requiresOverride: boolean }> {
    const settings = await this.getBoardSettings(boardId);
    if (!settings?.wipLimitsEnabled) {
      return { canMove: true, requiresOverride: false };
    }

    const column = await prisma.boardColumn.findUnique({
      where: { id: toColumnId },
      select: { id: true, name: true, wipLimit: true, wipLimitEnabled: true, wipLimitType: true, statusId: true },
    });

    if (!column || !column.wipLimitEnabled || column.wipLimit === null) {
      return { canMove: true, requiresOverride: false };
    }

    // Count current issues in the target column
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { projectId: true },
    });

    const count = await prisma.issue.count({
      where: {
        projectId: board!.projectId,
        statusId: column.statusId,
      },
    });

    const currentCount = count;
    const isAtLimit = currentCount >= column.wipLimit;

    if (!isAtLimit) {
      return { canMove: true, requiresOverride: false };
    }

    if (column.wipLimitType === 'hard') {
      return {
        canMove: false,
        warningMessage: `Cannot move issue: "${column.name}" has reached its WIP limit of ${column.wipLimit}`,
        requiresOverride: true,
      };
    }

    return {
      canMove: true,
      warningMessage: `Warning: "${column.name}" will exceed its WIP limit of ${column.wipLimit}`,
      requiresOverride: false,
    };
  }

  // === Violation Tracking ===

  async recordViolation(data: {
    boardId: string;
    columnId: string;
    issueId: string;
    userId: string;
    action: 'override' | 'blocked';
    limitAtTime: number;
    countAtTime: number;
    reason?: string;
  }): Promise<WipLimitViolation> {
    const settings = await this.getBoardSettings(data.boardId);
    if (!settings?.trackWipViolations) {
      // Return a mock violation if tracking is disabled
      return {
        id: 'not-tracked',
        ...data,
        createdAt: new Date(),
      };
    }

    const violation = await prisma.wipLimitViolation.create({
      data: {
        boardId: data.boardId,
        columnId: data.columnId,
        issueId: data.issueId,
        userId: data.userId,
        action: data.action,
        limitAtTime: data.limitAtTime,
        countAtTime: data.countAtTime,
        reason: data.reason,
      },
    });

    return this.mapViolation(violation);
  }

  async getViolations(
    boardId: string,
    options: {
      columnId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ violations: WipLimitViolation[]; total: number }> {
    const where: any = { boardId };

    if (options.columnId) {
      where.columnId = options.columnId;
    }
    if (options.startDate) {
      where.createdAt = { ...(where.createdAt || {}), gte: options.startDate };
    }
    if (options.endDate) {
      where.createdAt = { ...(where.createdAt || {}), lte: options.endDate };
    }

    const total = await prisma.wipLimitViolation.count({ where });

    const violations = await prisma.wipLimitViolation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return {
      violations: violations.map((v: any) => this.mapViolation(v)),
      total,
    };
  }

  // === Mapping ===

  private mapBoardSettings(row: any): BoardSettings {
    return {
      id: row.id,
      boardId: row.boardId,
      wipLimitsEnabled: row.wipLimitsEnabled,
      defaultWipType: row.defaultWipType,
      showWipWarnings: row.showWipWarnings,
      trackWipViolations: row.trackWipViolations,
      swimlaneWipLimits:
        typeof row.swimlaneWipLimits === 'string'
          ? JSON.parse(row.swimlaneWipLimits)
          : row.swimlaneWipLimits,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapViolation(row: any): WipLimitViolation {
    return {
      id: row.id,
      boardId: row.boardId,
      columnId: row.columnId,
      issueId: row.issueId,
      userId: row.userId,
      action: row.action,
      limitAtTime: row.limitAtTime,
      countAtTime: row.countAtTime,
      reason: row.reason,
      createdAt: row.createdAt,
    };
  }
}

export const wipLimitsService = new WipLimitsService();
