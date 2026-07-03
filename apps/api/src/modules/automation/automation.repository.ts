import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import {
  AutomationRule,
  AutomationRuleWithCreator,
  AutomationRuleExecution,
  ScheduledRuleRun,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
  TriggerType,
  ExecutionStatus,
  ConditionResult,
  ActionResult,
} from './automation.types';

export class AutomationRepository {
  // === Rule CRUD ===

  async create(projectId: string, createdBy: string, input: CreateAutomationRuleInput): Promise<AutomationRule> {
    const rule = await prisma.automationRule.create({
      data: {
        projectId,
        createdBy,
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        triggerConfig: (input.triggerConfig || {}) as Prisma.InputJsonValue,
        conditions: (input.conditions || []) as unknown as Prisma.InputJsonValue,
        actions: input.actions as unknown as Prisma.InputJsonValue,
        executionOrder: input.executionOrder || 0,
        stopOnError: input.stopOnError ?? true,
      },
    });

    // If scheduled trigger, create scheduled run entry
    if (input.triggerType === 'scheduled' && input.triggerConfig?.cronExpression) {
      await this.createScheduledRun(rule.id, input.triggerConfig.cronExpression);
    }

    return this.mapRule(rule);
  }

  async findById(id: string): Promise<AutomationRule | null> {
    const rule = await prisma.automationRule.findUnique({ where: { id } });
    return rule ? this.mapRule(rule) : null;
  }

  async findByIdWithCreator(id: string): Promise<AutomationRuleWithCreator | null> {
    const rule = await prisma.automationRule.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!rule) return null;

    return {
      ...this.mapRule(rule),
      creator: {
        id: rule.createdBy,
        displayName: `${(rule as any).creator?.firstName || ''} ${(rule as any).creator?.lastName || ''}`.trim(),
        email: (rule as any).creator?.email || '',
        avatarUrl: (rule as any).creator?.avatarUrl || null,
      },
    };
  }

  async findByProject(
    projectId: string,
    options: {
      triggerType?: TriggerType;
      isEnabled?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ rules: AutomationRuleWithCreator[]; total: number }> {
    const where: Prisma.AutomationRuleWhereInput = {
      projectId,
    };

    if (options.triggerType) {
      where.triggerType = options.triggerType;
    }

    if (options.isEnabled !== undefined) {
      where.isEnabled = options.isEnabled;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [total, rules] = await Promise.all([
      prisma.automationRule.count({ where }),
      prisma.automationRule.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [
          { executionOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
    ]);

    return {
      rules: rules.map((r) => ({
        ...this.mapRule(r),
        creator: {
          id: r.createdBy,
          displayName: `${(r as any).creator?.firstName || ''} ${(r as any).creator?.lastName || ''}`.trim(),
          email: (r as any).creator?.email || '',
          avatarUrl: (r as any).creator?.avatarUrl || null,
        },
      })),
      total,
    };
  }

  async findByTriggerType(projectId: string, triggerType: TriggerType): Promise<AutomationRule[]> {
    const rules = await prisma.automationRule.findMany({
      where: { projectId, triggerType, isEnabled: true },
      orderBy: { executionOrder: 'asc' },
    });

    return rules.map(r => this.mapRule(r));
  }

  async update(id: string, input: UpdateAutomationRuleInput): Promise<AutomationRule | null> {
    const updateData: Prisma.AutomationRuleUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;
    if (input.triggerType !== undefined) updateData.triggerType = input.triggerType;
    if (input.triggerConfig !== undefined) updateData.triggerConfig = input.triggerConfig as Prisma.InputJsonValue;
    if (input.conditions !== undefined) updateData.conditions = input.conditions as unknown as Prisma.InputJsonValue;
    if (input.actions !== undefined) updateData.actions = input.actions as unknown as Prisma.InputJsonValue;
    if (input.executionOrder !== undefined) updateData.executionOrder = input.executionOrder;
    if (input.stopOnError !== undefined) updateData.stopOnError = input.stopOnError;

    const rule = await prisma.automationRule.update({
      where: { id },
      data: updateData,
    });

    if (!rule) return null;

    // Update scheduled run if trigger config changed
    if (input.triggerType === 'scheduled' || (input.triggerConfig?.cronExpression && rule.triggerType === 'scheduled')) {
      const cronExpression = input.triggerConfig?.cronExpression;
      if (cronExpression) {
        await this.updateScheduledRun(id, cronExpression);
      }
    }

    return this.mapRule(rule);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.automationRule.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async toggleEnabled(id: string, isEnabled: boolean): Promise<AutomationRule | null> {
    const rule = await prisma.automationRule.update({
      where: { id },
      data: { isEnabled },
    });

    return rule ? this.mapRule(rule) : null;
  }

  // === Execution Logging ===

  async createExecution(data: {
    ruleId: string;
    triggeredByUserId?: string;
    triggeredByIssueId?: string;
    triggerData: any;
  }): Promise<AutomationRuleExecution> {
    const execution = await prisma.automationRuleExecution.create({
      data: {
        ruleId: data.ruleId,
        triggeredByUserId: data.triggeredByUserId,
        triggeredByIssueId: data.triggeredByIssueId,
        status: 'pending',
        triggerData: data.triggerData as Prisma.InputJsonValue,
      },
    });

    return this.mapExecution(execution);
  }

  async updateExecution(
    id: string,
    data: {
      status: ExecutionStatus;
      conditionResults?: ConditionResult[];
      actionResults?: ActionResult[];
      errorMessage?: string;
      durationMs?: number;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<AutomationRuleExecution | null> {
    const updateData: Prisma.AutomationRuleExecutionUpdateInput = {
      status: data.status,
    };

    if (data.conditionResults) updateData.conditionResults = data.conditionResults as unknown as Prisma.InputJsonValue;
    if (data.actionResults) updateData.actionResults = data.actionResults as unknown as Prisma.InputJsonValue;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
    if (data.durationMs !== undefined) updateData.durationMs = data.durationMs;
    if (data.startedAt) updateData.startedAt = data.startedAt;
    if (data.completedAt) updateData.completedAt = data.completedAt;

    const execution = await prisma.automationRuleExecution.update({
      where: { id },
      data: updateData,
    });

    return execution ? this.mapExecution(execution) : null;
  }

  async findExecutions(
    ruleId: string,
    options: {
      status?: ExecutionStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ executions: AutomationRuleExecution[]; total: number }> {
    const where: Prisma.AutomationRuleExecutionWhereInput = { ruleId };

    if (options.status) {
      where.status = options.status;
    }

    const [total, executions] = await Promise.all([
      prisma.automationRuleExecution.count({ where }),
      prisma.automationRuleExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
    ]);

    return {
      executions: executions.map(e => this.mapExecution(e)),
      total,
    };
  }

  async updateRuleStats(
    ruleId: string,
    success: boolean
  ): Promise<void> {
    if (success) {
      await prisma.automationRule.update({
        where: { id: ruleId },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date(),
          successCount: { increment: 1 },
          lastSuccessAt: new Date(),
        },
      });
    } else {
      await prisma.automationRule.update({
        where: { id: ruleId },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date(),
          failureCount: { increment: 1 },
          lastFailureAt: new Date(),
        },
      });
    }
  }

  // === Scheduled Runs ===

  async createScheduledRun(ruleId: string, cronExpression: string): Promise<ScheduledRuleRun> {
    const nextRunAt = this.calculateNextRun(cronExpression);

    const run = await prisma.scheduledRuleRun.upsert({
      where: { ruleId },
      update: {
        cronExpression,
        nextRunAt,
      },
      create: {
        ruleId,
        cronExpression,
        nextRunAt,
      },
    });

    return this.mapScheduledRun(run);
  }

  async updateScheduledRun(ruleId: string, cronExpression: string): Promise<void> {
    const nextRunAt = this.calculateNextRun(cronExpression);

    await prisma.scheduledRuleRun.update({
      where: { ruleId },
      data: {
        cronExpression,
        nextRunAt,
      },
    });
  }

  async findDueScheduledRuns(): Promise<ScheduledRuleRun[]> {
    const runs = await prisma.scheduledRuleRun.findMany({
      where: {
        nextRunAt: { lte: new Date() },
        rule: { isEnabled: true },
      },
    });

    return runs.map(r => this.mapScheduledRun(r));
  }

  async markScheduledRunExecuted(ruleId: string): Promise<void> {
    const run = await prisma.scheduledRuleRun.findUnique({ where: { ruleId } });
    if (!run) return;

    const nextRunAt = this.calculateNextRun(run.cronExpression);

    await prisma.scheduledRuleRun.update({
      where: { ruleId },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
      },
    });
  }

  private calculateNextRun(_cronExpression: string): Date {
    // Simple cron parsing - in production, use a library like node-cron or cron-parser
    // For now, default to 1 hour from now
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 1);
    return nextRun;
  }

  // === Mapping Methods ===

  private mapRule(row: any): AutomationRule {
    return {
      id: row.id,
      projectId: row.projectId,
      createdBy: row.createdBy,
      name: row.name,
      description: row.description,
      isEnabled: row.isEnabled,
      triggerType: row.triggerType,
      triggerConfig: row.triggerConfig as Record<string, any>,
      conditions: row.conditions as any[],
      actions: row.actions as any[],
      executionOrder: row.executionOrder,
      stopOnError: row.stopOnError,
      executionCount: row.executionCount,
      successCount: row.successCount,
      failureCount: row.failureCount,
      lastExecutedAt: row.lastExecutedAt,
      lastSuccessAt: row.lastSuccessAt,
      lastFailureAt: row.lastFailureAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapExecution(row: any): AutomationRuleExecution {
    return {
      id: row.id,
      ruleId: row.ruleId,
      triggeredByUserId: row.triggeredByUserId,
      triggeredByIssueId: row.triggeredByIssueId,
      status: row.status,
      triggerData: row.triggerData as Record<string, any>,
      conditionResults: row.conditionResults as ConditionResult[] | null,
      actionResults: row.actionResults as ActionResult[] | null,
      errorMessage: row.errorMessage,
      durationMs: row.durationMs,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
    };
  }

  private mapScheduledRun(row: any): ScheduledRuleRun {
    return {
      id: row.id,
      ruleId: row.ruleId,
      cronExpression: row.cronExpression,
      nextRunAt: row.nextRunAt,
      lastRunAt: row.lastRunAt,
      createdAt: row.createdAt,
    };
  }
}
