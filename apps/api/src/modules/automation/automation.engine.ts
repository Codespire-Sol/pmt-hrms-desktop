import { AutomationRepository } from './automation.repository';
import { prisma } from '../../database/prisma';
import { logger } from '../../utils/logger';
import { format } from 'date-fns';
import { emailService } from '../../services/email.service';
import { TimeTrackingService } from '../time-tracking/time-tracking.service';
import {
  AutomationRule,
  TriggerEventData,
  Condition,
  ConditionOperator,
  Action,
  ConditionResult,
  ActionResult,
  ExecutionStatus,
} from './automation.types';

export class AutomationEngine {
  private repository: AutomationRepository;

  constructor() {
    this.repository = new AutomationRepository();
  }

  /**
   * Process an event and execute matching automation rules
   */
  async processEvent(event: TriggerEventData): Promise<void> {
    try {
      // Find all enabled rules for this trigger type and project
      const rules = await this.repository.findByTriggerType(event.projectId, event.type);

      logger.info(`Processing automation event: ${event.type} for project ${event.projectId}, found ${rules.length} rules`);

      for (const rule of rules) {
        try {
          await this.executeRule(rule, event);
        } catch (error) {
          logger.error(`Error executing automation rule ${rule.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error processing automation event:', error);
    }
  }

  /**
   * Execute a single automation rule
   */
  async executeRule(rule: AutomationRule, event: TriggerEventData): Promise<void> {
    const startTime = Date.now();

    // Create execution record
    const execution = await this.repository.createExecution({
      ruleId: rule.id,
      triggeredByUserId: event.userId,
      triggeredByIssueId: event.issue?.id,
      triggerData: event,
    });

    try {
      // Update execution to running
      await this.repository.updateExecution(execution.id, {
        status: 'running',
        startedAt: new Date(),
      });

      // Check trigger config filters
      if (!this.matchesTriggerConfig(rule, event)) {
        await this.repository.updateExecution(execution.id, {
          status: 'skipped',
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        });
        return;
      }

      // Evaluate conditions
      const conditionResults = await this.evaluateConditions(rule.conditions, event);
      const conditionsPassed = conditionResults.every(r => r.passed);

      if (!conditionsPassed) {
        await this.repository.updateExecution(execution.id, {
          status: 'skipped',
          conditionResults,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        });
        return;
      }

      // Execute actions
      const actionResults: ActionResult[] = [];
      let hasError = false;

      for (const action of rule.actions) {
        const result = await this.executeAction(action, event, rule);
        actionResults.push(result);

        if (!result.success) {
          hasError = true;
          if (rule.stopOnError) {
            break;
          }
        }
      }

      const status: ExecutionStatus = hasError ? 'failure' : 'success';

      await this.repository.updateExecution(execution.id, {
        status,
        conditionResults,
        actionResults,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      });

      // Update rule stats
      await this.repository.updateRuleStats(rule.id, !hasError);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.repository.updateExecution(execution.id, {
        status: 'failure',
        errorMessage,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      });

      await this.repository.updateRuleStats(rule.id, false);

      throw error;
    }
  }

  /**
   * Manually trigger a rule execution
   */
  async triggerManually(ruleId: string, userId: string, issueId?: string): Promise<void> {
    const rule = await this.repository.findById(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    const event: TriggerEventData = {
      type: 'manual',
      projectId: rule.projectId,
      userId,
    };

    // If issue provided, fetch issue data
    if (issueId) {
      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
      });
      if (issue) {
        event.issue = {
          id: issue.id,
          key: `${issue.projectId}-${issue.issueNumber}`,
          typeId: issue.typeId,
          statusId: issue.statusId,
          priorityId: issue.priorityId,
          assigneeId: issue.assigneeId,
          reporterId: issue.reporterId,
        };
      }
    }

    await this.executeRule(rule, event);
  }

  /**
   * Check if event matches rule's trigger config
   */
  private matchesTriggerConfig(rule: AutomationRule, event: TriggerEventData): boolean {
    const config = rule.triggerConfig;
    const issue = event.issue;

    // Check issue type filter
    if (config.issueTypes?.length && issue) {
      if (!config.issueTypes.includes(issue.typeId)) {
        return false;
      }
    }

    // Check status filter
    if (config.statuses?.length && issue) {
      if (!config.statuses.includes(issue.statusId)) {
        return false;
      }
    }

    // Check priority filter
    if (config.priorities?.length && issue) {
      if (!issue.priorityId || !config.priorities.includes(issue.priorityId)) {
        return false;
      }
    }

    // Check field changed filter for update events
    if (event.type === 'issue_updated' && config.fieldChanged?.length && event.changes) {
      const changedFields = event.changes.map(c => c.field);
      const hasMatchingChange = config.fieldChanged.some(f => changedFields.includes(f));
      if (!hasMatchingChange) {
        return false;
      }
    }

    // Check transition filter
    if (event.type === 'issue_transitioned' && event.changes) {
      const statusChange = event.changes.find(c => c.field === 'status');
      if (statusChange) {
        if (config.fromStatus && statusChange.oldValue !== config.fromStatus) {
          return false;
        }
        if (config.toStatus && statusChange.newValue !== config.toStatus) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate conditions
   */
  private async evaluateConditions(conditions: Condition[], event: TriggerEventData): Promise<ConditionResult[]> {
    const results: ConditionResult[] = [];

    for (const condition of conditions) {
      // Handle nested conditions
      if (condition.conditions && condition.conditions.length > 0) {
        const nestedResults = await this.evaluateConditions(condition.conditions, event);
        const logicalOp = condition.logicalOperator || 'AND';

        const passed = logicalOp === 'AND'
          ? nestedResults.every(r => r.passed)
          : nestedResults.some(r => r.passed);

        results.push(...nestedResults);
        results.push({
          conditionId: condition.id,
          field: 'group',
          operator: logicalOp,
          expectedValue: null,
          actualValue: null,
          passed,
        });
        continue;
      }

      const actualValue = this.getFieldValue(condition.field, event);
      const passed = this.evaluateCondition(condition.operator, actualValue, condition.value, event);

      results.push({
        conditionId: condition.id,
        field: condition.field,
        operator: condition.operator,
        expectedValue: condition.value,
        actualValue,
        passed,
      });
    }

    return results;
  }

  /**
   * Get field value from event data
   */
  private getFieldValue(field: string, event: TriggerEventData): any {
    const issue = event.issue;
    if (!issue) return null;

    switch (field) {
      case 'type':
        return issue.typeId;
      case 'status':
        return issue.statusId;
      case 'priority':
        return issue.priorityId;
      case 'assignee':
        return issue.assigneeId;
      case 'reporter':
        return issue.reporterId;
      case 'summary':
        return issue.title || issue.summary;
      case 'description':
        return issue.description;
      default:
        return issue[field];
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    operator: ConditionOperator,
    actualValue: any,
    expectedValue: any,
    event: TriggerEventData
  ): boolean {
    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;

      case 'not_equals':
        return actualValue !== expectedValue;

      case 'contains':
        return typeof actualValue === 'string' && actualValue.toLowerCase().includes(String(expectedValue).toLowerCase());

      case 'not_contains':
        return typeof actualValue === 'string' && !actualValue.toLowerCase().includes(String(expectedValue).toLowerCase());

      case 'starts_with':
        return typeof actualValue === 'string' && actualValue.toLowerCase().startsWith(String(expectedValue).toLowerCase());

      case 'ends_with':
        return typeof actualValue === 'string' && actualValue.toLowerCase().endsWith(String(expectedValue).toLowerCase());

      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);

      case 'less_than':
        return Number(actualValue) < Number(expectedValue);

      case 'greater_or_equal':
        return Number(actualValue) >= Number(expectedValue);

      case 'less_or_equal':
        return Number(actualValue) <= Number(expectedValue);

      case 'is_empty':
        return actualValue === null || actualValue === undefined || actualValue === '';

      case 'is_not_empty':
        return actualValue !== null && actualValue !== undefined && actualValue !== '';

      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);

      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);

      case 'changed':
        return event.changes?.some(c => c.field === expectedValue) ?? false;

      case 'changed_from': {
        const changeFrom = event.changes?.find(c => c.field === expectedValue.field);
        return changeFrom?.oldValue === expectedValue.value;
      }

      case 'changed_to': {
        const changeTo = event.changes?.find(c => c.field === expectedValue.field);
        return changeTo?.newValue === expectedValue.value;
      }

      default:
        return false;
    }
  }

  /**
   * Execute an action
   */
  private async executeAction(
    action: Action,
    event: TriggerEventData,
    rule: AutomationRule
  ): Promise<ActionResult> {
    try {
      const result = await this.performAction(action, event, rule);
      return {
        actionId: action.id,
        type: action.type,
        success: true,
        details: result,
      };
    } catch (error) {
      return {
        actionId: action.id,
        type: action.type,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Perform the actual action
   */
  private async performAction(action: Action, event: TriggerEventData, rule: AutomationRule): Promise<any> {
    const config = action.config;
    const issueId = event.issue?.id;

    switch (action.type) {
      case 'set_field':
        if (!issueId || !config.field) return null;
        return this.setField(issueId, config.field, config.value);

      case 'transition_issue':
        if (!issueId || !config.statusId) return null;
        return this.transitionIssue(issueId, config.statusId);

      case 'assign_issue':
        if (!issueId) return null;
        return this.assignIssue(issueId, config, event);

      case 'add_comment':
        if (!issueId || !config.comment) return null;
        return this.addComment(issueId, config.comment, event.userId, config.isInternal);

      case 'add_label':
        if (!issueId || !config.labelId) return null;
        return this.addLabel(issueId, config.labelId);

      case 'remove_label':
        if (!issueId || !config.labelId) return null;
        return this.removeLabel(issueId, config.labelId);

      case 'add_watcher':
        if (!issueId) return null;
        return this.addWatcher(issueId, config, event);

      case 'send_notification':
        return this.sendNotification(config, event, rule);

      case 'call_webhook':
        return this.callWebhook(config, event, rule);

      case 'create_subtask':
        if (!issueId) return null;
        return this.createSubtask(issueId, config, event);

      case 'set_due_date':
        if (!issueId) return null;
        return this.setDueDate(issueId, config);

      case 'send_email':
        return this.sendEmail(config, event, rule);

      case 'link_issue':
        if (!issueId || !config.targetIssueId || !config.linkType) return null;
        return this.linkIssue(issueId, config.targetIssueId, config.linkType);

      case 'log_work':
        if (!issueId || !config.timeSpent) return null;
        return this.logWork(issueId, config, event);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  // === Action Implementations ===

  private async setField(issueId: string, field: string, value: any): Promise<any> {
    const updateData: any = {};

    // Map field names to Prisma model fields (camelCase)
    const fieldMap: Record<string, string> = {
      priority: 'priorityId',
      status: 'statusId',
      type: 'typeId',
      assignee: 'assigneeId',
      storyPoints: 'storyPoints',
      dueDate: 'dueDate',
      startDate: 'startDate',
    };

    const prismaField = fieldMap[field] || field;
    updateData[prismaField] = value;

    await prisma.issue.update({
      where: { id: issueId },
      data: updateData,
    });
    return { field, value };
  }

  private async transitionIssue(issueId: string, statusId: string): Promise<any> {
    await prisma.issue.update({
      where: { id: issueId },
      data: { statusId },
    });
    return { statusId };
  }

  private async assignIssue(issueId: string, config: any, event: TriggerEventData): Promise<any> {
    let assigneeId: string | null = null;

    switch (config.assigneeType) {
      case 'specific':
        assigneeId = config.assigneeId;
        break;
      case 'reporter':
        assigneeId = event.issue?.reporterId || null;
        break;
      case 'unassigned':
        assigneeId = null;
        break;
      default:
        assigneeId = config.assigneeId;
    }

    await prisma.issue.update({
      where: { id: issueId },
      data: { assigneeId },
    });
    return { assigneeId };
  }

  private async addComment(issueId: string, content: string, userId?: string, _isInternal?: boolean): Promise<any> {
    const comment = await prisma.comment.create({
      data: {
        issueId,
        authorId: userId!,
        content,
      },
    });

    return { commentId: comment.id };
  }

  private async addLabel(issueId: string, labelId: string): Promise<any> {
    // Use upsert to handle the onConflict ignore behavior
    await prisma.issueLabel.upsert({
      where: {
        issueId_labelId: { issueId, labelId },
      },
      update: {},
      create: { issueId, labelId },
    });

    return { labelId };
  }

  private async removeLabel(issueId: string, labelId: string): Promise<any> {
    await prisma.issueLabel.deleteMany({
      where: { issueId, labelId },
    });

    return { labelId };
  }

  private async addWatcher(issueId: string, config: any, event: TriggerEventData): Promise<any> {
    let userId: string | null = null;

    switch (config.userType) {
      case 'specific':
        userId = config.userId;
        break;
      case 'reporter':
        userId = event.issue?.reporterId || null;
        break;
      case 'assignee':
        userId = event.issue?.assigneeId || null;
        break;
    }

    if (userId) {
      await prisma.issueWatcher.upsert({
        where: {
          issueId_userId: { issueId, userId },
        },
        update: {},
        create: { issueId, userId },
      });
    }

    return { userId };
  }

  private async sendNotification(config: any, event: TriggerEventData, rule: AutomationRule): Promise<any> {
    // Get recipients based on type
    const recipients: string[] = [];

    if (config.recipientType === 'specific' && config.recipients) {
      recipients.push(...config.recipients);
    } else if (config.recipientType === 'assignee' && event.issue?.assigneeId) {
      recipients.push(event.issue.assigneeId);
    } else if (config.recipientType === 'reporter' && event.issue?.reporterId) {
      recipients.push(event.issue.reporterId);
    }

    // Create notifications
    for (const userId of recipients) {
      await prisma.notification.create({
        data: {
          userId,
          type: 'automation',
          title: config.subject || `Automation: ${rule.name}`,
          message: config.message,
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
            issueId: event.issue?.id,
            issueKey: event.issue?.key,
          },
        },
      });
    }

    return { recipientCount: recipients.length };
  }

  private async callWebhook(config: any, event: TriggerEventData, rule: AutomationRule): Promise<any> {
    const url = config.webhookUrl;
    if (!url) throw new Error('Webhook URL not configured');

    const payload = {
      rule: {
        id: rule.id,
        name: rule.name,
      },
      event: {
        type: event.type,
        timestamp: new Date().toISOString(),
      },
      issue: event.issue,
      changes: event.changes,
    };

    const response = await fetch(url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(config.body || payload),
    });

    return {
      status: response.status,
      success: response.ok,
    };
  }

  private async createSubtask(parentIssueId: string, config: any, event: TriggerEventData): Promise<any> {
    const parent = await prisma.issue.findUnique({
      where: { id: parentIssueId },
    });
    if (!parent) throw new Error('Parent issue not found');

    // Get next issue number for project
    const maxResult = await prisma.issue.aggregate({
      where: { projectId: parent.projectId },
      _max: { issueNumber: true },
    });

    const issueNumber = (maxResult._max.issueNumber || 0) + 1;

    const project = await prisma.project.findUnique({
      where: { id: parent.projectId },
    });
    const issueKey = `${project!.key}-${issueNumber}`;

    const subtask = await prisma.issue.create({
      data: {
        projectId: parent.projectId,
        parentId: parentIssueId,
        typeId: config.subtaskTypeId,
        statusId: parent.statusId,
        title: config.subtaskTitle,
        description: config.subtaskDescription,
        reporterId: event.userId!,
        issueNumber,
      },
    });

    return { subtaskId: subtask.id, issueKey };
  }

  private async setDueDate(issueId: string, config: any): Promise<any> {
    let dueDate: Date;

    if (config.dueDateType === 'specific') {
      dueDate = new Date(config.dueDate);
    } else {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (config.relativeDays || 0));
    }

    await prisma.issue.update({
      where: { id: issueId },
      data: { dueDate },
    });
    return { dueDate };
  }

  private async sendEmail(config: any, event: TriggerEventData, rule: AutomationRule): Promise<any> {
    // Resolve recipient email addresses
    const toAddresses: string[] = [];

    if (config.recipientType === 'specific' && Array.isArray(config.recipients)) {
      // config.recipients may be user IDs or email addresses
      for (const recipient of config.recipients) {
        if (recipient.includes('@')) {
          toAddresses.push(recipient);
        } else {
          const user = await prisma.user.findUnique({ where: { id: recipient }, select: { email: true } });
          if (user?.email) toAddresses.push(user.email);
        }
      }
    } else if (config.recipientType === 'assignee' && event.issue?.assigneeId) {
      const user = await prisma.user.findUnique({ where: { id: event.issue.assigneeId }, select: { email: true } });
      if (user?.email) toAddresses.push(user.email);
    } else if (config.recipientType === 'reporter' && event.issue?.reporterId) {
      const user = await prisma.user.findUnique({ where: { id: event.issue.reporterId }, select: { email: true } });
      if (user?.email) toAddresses.push(user.email);
    } else if (config.recipientType === 'project_members' && event.projectId) {
      const members = await prisma.projectMember.findMany({
        where: { projectId: event.projectId },
        include: { user: { select: { email: true } } },
      });
      for (const m of members) {
        if (m.user.email) toAddresses.push(m.user.email);
      }
    }

    if (toAddresses.length === 0) return { sent: false, reason: 'No recipients resolved' };

    const subject = config.subject || `[Automation] ${rule.name}`;
    const body = config.message || '';

    await emailService.sendEmail({
      to: toAddresses,
      subject,
      html: `<p>${body.replace(/\n/g, '<br/>')}</p><hr/><p style="color:#888;font-size:12px;">Sent by automation rule: ${rule.name}</p>`,
    });

    return { sent: true, recipientCount: toAddresses.length };
  }

  private async linkIssue(sourceIssueId: string, targetIssueId: string, linkTypeName: string): Promise<any> {
    // Resolve link type by name
    const linkType = await prisma.linkType.findFirst({
      where: {
        OR: [
          { name: { equals: linkTypeName, mode: 'insensitive' } },
          { inward: { equals: linkTypeName, mode: 'insensitive' } },
          { outward: { equals: linkTypeName, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });

    if (!linkType) {
      throw new Error(`Link type '${linkTypeName}' not found`);
    }

    // Upsert to avoid duplicate links
    await prisma.issueLink.upsert({
      where: {
        sourceIssueId_targetIssueId_linkTypeId: {
          sourceIssueId,
          targetIssueId,
          linkTypeId: linkType.id,
        },
      },
      update: {},
      create: { sourceIssueId, targetIssueId, linkTypeId: linkType.id } as any,
    });

    return { sourceIssueId, targetIssueId, linkType: linkType.name };
  }

  private async logWork(issueId: string, config: any, event: TriggerEventData): Promise<any> {
    // Parse timeSpent: "2h", "30m", "1.5h"
    const timeStr: string = config.timeSpent || '0h';
    const hoursMatch = timeStr.match(/^(\d+(?:\.\d+)?)h$/i);
    const minsMatch = timeStr.match(/^(\d+)m$/i);
    let hours = 0;
    if (hoursMatch) hours = parseFloat(hoursMatch[1]);
    else if (minsMatch) hours = parseInt(minsMatch[1], 10) / 60;

    if (hours <= 0) return { logged: false, reason: 'Invalid time value' };

    const userId = event.userId || event.issue?.reporterId;
    if (!userId) return { logged: false, reason: 'No user context' };

    const timeService = new TimeTrackingService();
    const timeLog = await timeService.logTime(issueId, {
      hours: Math.max(0.25, Math.round(hours * 4) / 4),
      description: config.workDescription || `Logged by automation: ${config.timeSpent}`,
      workDate: format(new Date(), 'yyyy-MM-dd'),
    }, userId);

    return { logged: true, timeLogId: (timeLog as any).id, hours };
  }

  /**
   * Dry-run mode: evaluate a rule against a synthetic event without performing any DB writes.
   * Returns what would have happened.
   */
  async dryRun(rule: AutomationRule, event: TriggerEventData): Promise<{
    wouldTrigger: boolean;
    triggerMatchReason: string;
    conditionResults: ConditionResult[];
    conditionsPassed: boolean;
    actionsPreview: Array<{ type: string; config: any; wouldExecute: boolean }>;
  }> {
    const wouldTrigger = this.matchesTriggerConfig(rule, event);
    const triggerMatchReason = wouldTrigger
      ? `Trigger type '${rule.triggerType}' matches event`
      : `Trigger config filters did not match`;

    const conditionResults = wouldTrigger
      ? await this.evaluateConditions(rule.conditions, event)
      : [];
    const conditionsPassed = conditionResults.length === 0 || conditionResults.every(r => r.passed);

    const actionsPreview = rule.actions.map(action => ({
      type: action.type,
      config: action.config,
      wouldExecute: wouldTrigger && conditionsPassed,
    }));

    return { wouldTrigger, triggerMatchReason, conditionResults, conditionsPassed, actionsPreview };
  }
}

// Singleton instance
export const automationEngine = new AutomationEngine();
