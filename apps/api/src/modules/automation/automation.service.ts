import { AutomationRepository } from './automation.repository';
import { automationEngine } from './automation.engine';
import { ApiError } from '../../utils/ApiError';
import {
  AutomationRuleWithCreator,
  AutomationRuleExecution,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
  TriggerType,
  TriggerEventData,
  ExecutionStatus,
  AUTOMATION_FIELDS,
  TRIGGER_DESCRIPTIONS,
  ACTION_DESCRIPTIONS,
} from './automation.types';

export class AutomationService {
  private repository: AutomationRepository;

  constructor() {
    this.repository = new AutomationRepository();
  }

  // === Rule Management ===

  async createRule(
    projectId: string,
    userId: string,
    input: CreateAutomationRuleInput
  ): Promise<AutomationRuleWithCreator> {
    // Validate actions
    if (!input.actions || input.actions.length === 0) {
      throw ApiError.badRequest('At least one action is required');
    }

    const rule = await this.repository.create(projectId, userId, input);
    return (await this.repository.findByIdWithCreator(rule.id))!;
  }

  async getRule(ruleId: string): Promise<AutomationRuleWithCreator> {
    const rule = await this.repository.findByIdWithCreator(ruleId);
    if (!rule) {
      throw ApiError.notFound('Automation rule not found');
    }
    return rule;
  }

  async getRules(
    projectId: string,
    options: {
      triggerType?: TriggerType;
      isEnabled?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ rules: AutomationRuleWithCreator[]; pagination: any }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    const { rules, total } = await this.repository.findByProject(projectId, {
      ...options,
      limit,
      offset,
    });

    return {
      rules,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateRule(ruleId: string, input: UpdateAutomationRuleInput): Promise<AutomationRuleWithCreator> {
    const rule = await this.repository.findById(ruleId);
    if (!rule) {
      throw ApiError.notFound('Automation rule not found');
    }

    await this.repository.update(ruleId, input);
    return (await this.repository.findByIdWithCreator(ruleId))!;
  }

  async deleteRule(ruleId: string): Promise<{ message: string }> {
    const rule = await this.repository.findById(ruleId);
    if (!rule) {
      throw ApiError.notFound('Automation rule not found');
    }

    await this.repository.delete(ruleId);
    return { message: 'Automation rule deleted successfully' };
  }

  async toggleRule(ruleId: string, isEnabled: boolean): Promise<AutomationRuleWithCreator> {
    const rule = await this.repository.findById(ruleId);
    if (!rule) {
      throw ApiError.notFound('Automation rule not found');
    }

    await this.repository.toggleEnabled(ruleId, isEnabled);
    return (await this.repository.findByIdWithCreator(ruleId))!;
  }

  async duplicateRule(ruleId: string, userId: string): Promise<AutomationRuleWithCreator> {
    const rule = await this.repository.findById(ruleId);
    if (!rule) {
      throw ApiError.notFound('Automation rule not found');
    }

    const duplicateInput: CreateAutomationRuleInput = {
      name: `${rule.name} (Copy)`,
      description: rule.description,
      triggerType: rule.triggerType,
      triggerConfig: rule.triggerConfig,
      conditions: rule.conditions,
      actions: rule.actions,
      executionOrder: rule.executionOrder,
      stopOnError: rule.stopOnError,
    };

    const newRule = await this.repository.create(rule.projectId, userId, duplicateInput);
    return (await this.repository.findByIdWithCreator(newRule.id))!;
  }

  // === Rule Execution ===

  async triggerManually(ruleId: string, userId: string, issueId?: string): Promise<{ message: string }> {
    const rule = await this.repository.findById(ruleId);
    if (!rule) {
      throw ApiError.notFound('Automation rule not found');
    }

    if (!rule.isEnabled) {
      throw ApiError.badRequest('Cannot trigger a disabled rule');
    }

    await automationEngine.triggerManually(ruleId, userId, issueId);
    return { message: 'Rule triggered successfully' };
  }

  async processEvent(event: TriggerEventData): Promise<void> {
    await automationEngine.processEvent(event);
  }

  async dryRunRule(ruleId: string, issueId?: string) {
    const rule = await this.repository.findById(ruleId);
    if (!rule) throw ApiError.notFound('Automation rule not found');

    // Build a synthetic event for dry-run
    let issueData: any = null;
    if (issueId) {
      issueData = await this.fetchIssueForEvent(issueId);
    }

    const event: TriggerEventData = {
      type: rule.triggerType,
      projectId: rule.projectId,
      issue: issueData,
    };

    return automationEngine.dryRun(rule, event);
  }

  private async fetchIssueForEvent(issueId: string): Promise<any | null> {
    const { prisma } = await import('../../database/prisma');
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        title: true,
        issueNumber: true,
        statusId: true,
        priorityId: true,
        typeId: true,
        assigneeId: true,
        reporterId: true,
        projectId: true,
      },
    });
    return issue;
  }

  // === Execution History ===

  async getExecutions(
    ruleId: string,
    options: {
      status?: ExecutionStatus;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ executions: AutomationRuleExecution[]; pagination: any }> {
    const rule = await this.repository.findById(ruleId);
    if (!rule) {
      throw ApiError.notFound('Automation rule not found');
    }

    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    const { executions, total } = await this.repository.findExecutions(ruleId, {
      status: options.status,
      limit,
      offset,
    });

    return {
      executions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // === Reference Data ===

  getAvailableFields() {
    return AUTOMATION_FIELDS;
  }

  getTriggerTypes() {
    return Object.entries(TRIGGER_DESCRIPTIONS).map(([type, description]) => ({
      type,
      description,
    }));
  }

  getActionTypes() {
    return Object.entries(ACTION_DESCRIPTIONS).map(([type, description]) => ({
      type,
      description,
    }));
  }

  getConditionOperators() {
    return [
      { operator: 'equals', label: 'Equals', types: ['all'] },
      { operator: 'not_equals', label: 'Not Equals', types: ['all'] },
      { operator: 'contains', label: 'Contains', types: ['text'] },
      { operator: 'not_contains', label: 'Does Not Contain', types: ['text'] },
      { operator: 'starts_with', label: 'Starts With', types: ['text'] },
      { operator: 'ends_with', label: 'Ends With', types: ['text'] },
      { operator: 'greater_than', label: 'Greater Than', types: ['number', 'date'] },
      { operator: 'less_than', label: 'Less Than', types: ['number', 'date'] },
      { operator: 'greater_or_equal', label: 'Greater or Equal', types: ['number', 'date'] },
      { operator: 'less_or_equal', label: 'Less or Equal', types: ['number', 'date'] },
      { operator: 'is_empty', label: 'Is Empty', types: ['all'] },
      { operator: 'is_not_empty', label: 'Is Not Empty', types: ['all'] },
      { operator: 'in', label: 'In List', types: ['select', 'multiselect'] },
      { operator: 'not_in', label: 'Not In List', types: ['select', 'multiselect'] },
      { operator: 'changed', label: 'Changed', types: ['all'] },
      { operator: 'changed_from', label: 'Changed From', types: ['all'] },
      { operator: 'changed_to', label: 'Changed To', types: ['all'] },
    ];
  }
}
