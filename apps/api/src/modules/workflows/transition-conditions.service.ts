import { TransitionConditionsRepository } from './transition-conditions.repository';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import {
  TransitionCondition,
  TransitionValidator,
  TransitionPostFunction,
  TransitionApprovalConfig,
  IssueTransitionApproval,
  CreateConditionInput,
  CreateValidatorInput,
  CreatePostFunctionInput,
  CreateApprovalConfigInput,
  TransitionEvaluationResult,
  ConditionEvaluationResult,
  ValidatorEvaluationResult,
  ConditionType,
  RequiredFieldsConfig,
  FieldValueConfig,
  LinkedIssuesConfig,
  SubtasksDoneConfig,
  TimeLoggedConfig,
  CONDITION_TYPE_DESCRIPTIONS,
  VALIDATOR_TYPE_DESCRIPTIONS,
  POSTFUNCTION_TYPE_DESCRIPTIONS,
} from './transition-conditions.types';

interface IssueContext {
  id: string;
  projectId: string;
  typeId: string;
  statusId: string;
  priorityId?: string;
  assigneeId?: string;
  reporterId: string;
  summary: string;
  description?: string;
  resolution?: string;
  [key: string]: any;
}

interface UserContext {
  id: string;
  roles: string[];
  permissions: string[];
}

export class TransitionConditionsService {
  private repository: TransitionConditionsRepository;

  constructor() {
    this.repository = new TransitionConditionsRepository();
  }

  // === Condition Management ===

  async createCondition(transitionId: string, input: CreateConditionInput): Promise<TransitionCondition> {
    return this.repository.createCondition(transitionId, input);
  }

  async getConditions(transitionId: string): Promise<TransitionCondition[]> {
    return this.repository.findConditionsByTransition(transitionId);
  }

  async updateCondition(
    conditionId: string,
    input: Partial<CreateConditionInput> & { isEnabled?: boolean }
  ): Promise<TransitionCondition> {
    const condition = await this.repository.updateCondition(conditionId, input);
    if (!condition) {
      throw ApiError.notFound('Condition not found');
    }
    return condition;
  }

  async deleteCondition(conditionId: string): Promise<{ message: string }> {
    const deleted = await this.repository.deleteCondition(conditionId);
    if (!deleted) {
      throw ApiError.notFound('Condition not found');
    }
    return { message: 'Condition deleted successfully' };
  }

  // === Validator Management ===

  async createValidator(transitionId: string, input: CreateValidatorInput): Promise<TransitionValidator> {
    return this.repository.createValidator(transitionId, input);
  }

  async getValidators(transitionId: string): Promise<TransitionValidator[]> {
    return this.repository.findValidatorsByTransition(transitionId);
  }

  async updateValidator(
    validatorId: string,
    input: Partial<CreateValidatorInput> & { isEnabled?: boolean }
  ): Promise<TransitionValidator> {
    const validator = await this.repository.updateValidator(validatorId, input);
    if (!validator) {
      throw ApiError.notFound('Validator not found');
    }
    return validator;
  }

  async deleteValidator(validatorId: string): Promise<{ message: string }> {
    const deleted = await this.repository.deleteValidator(validatorId);
    if (!deleted) {
      throw ApiError.notFound('Validator not found');
    }
    return { message: 'Validator deleted successfully' };
  }

  // === Post Function Management ===

  async createPostFunction(transitionId: string, input: CreatePostFunctionInput): Promise<TransitionPostFunction> {
    return this.repository.createPostFunction(transitionId, input);
  }

  async getPostFunctions(transitionId: string): Promise<TransitionPostFunction[]> {
    return this.repository.findPostFunctionsByTransition(transitionId);
  }

  async updatePostFunction(
    postFunctionId: string,
    input: Partial<CreatePostFunctionInput> & { isEnabled?: boolean }
  ): Promise<TransitionPostFunction> {
    const postFunction = await this.repository.updatePostFunction(postFunctionId, input);
    if (!postFunction) {
      throw ApiError.notFound('Post function not found');
    }
    return postFunction;
  }

  async deletePostFunction(postFunctionId: string): Promise<{ message: string }> {
    const deleted = await this.repository.deletePostFunction(postFunctionId);
    if (!deleted) {
      throw ApiError.notFound('Post function not found');
    }
    return { message: 'Post function deleted successfully' };
  }

  // === Approval Config Management ===

  async setApprovalConfig(transitionId: string, input: CreateApprovalConfigInput): Promise<TransitionApprovalConfig> {
    return this.repository.createApprovalConfig(transitionId, input);
  }

  async getApprovalConfig(transitionId: string): Promise<TransitionApprovalConfig | null> {
    return this.repository.findApprovalConfig(transitionId);
  }

  async removeApprovalConfig(transitionId: string): Promise<{ message: string }> {
    await this.repository.deleteApprovalConfig(transitionId);
    return { message: 'Approval configuration removed' };
  }

  // === Transition Evaluation ===

  async evaluateTransition(
    transitionId: string,
    issue: IssueContext,
    user: UserContext,
    additionalContext?: {
      linkedIssues?: { id: string; status: string; linkType: string }[];
      subtasks?: { id: string; statusCategory: string }[];
      timeLogged?: number;
      /** The user's project-level role (e.g. 'admin', 'lead', 'member', 'viewer') */
      projectRole?: string;
    }
  ): Promise<TransitionEvaluationResult> {
    const conditions = await this.repository.findConditionsByTransition(transitionId);
    const validators = await this.repository.findValidatorsByTransition(transitionId);
    const approvalConfig = await this.repository.findApprovalConfig(transitionId);

    const conditionResults: ConditionEvaluationResult[] = [];
    const validatorResults: ValidatorEvaluationResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Evaluate conditions
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, issue, user, additionalContext);
      conditionResults.push(result);

      if (!result.passed) {
        if (result.isBlocking) {
          errors.push(result.errorMessage || `Condition "${result.conditionName}" not met`);
        } else {
          warnings.push(result.errorMessage || `Warning: "${result.conditionName}" not met`);
        }
      }
    }

    // Evaluate validators
    for (const validator of validators) {
      const result = await this.evaluateValidator(validator, issue);
      validatorResults.push(result);

      if (!result.passed) {
        errors.push(result.errorMessage || `Validation failed for "${result.field}"`);
      }
    }

    // Check approval requirements
    let requiresApproval = false;
    let pendingApproval: IssueTransitionApproval | undefined;

    if (approvalConfig) {
      pendingApproval = await this.repository.findPendingApproval(issue.id, transitionId) || undefined;

      if (!pendingApproval || pendingApproval.approvalsReceived < pendingApproval.approvalsRequired) {
        requiresApproval = true;
        if (!pendingApproval) {
          errors.push('This transition requires approval');
        } else {
          errors.push(
            `Waiting for approvals: ${pendingApproval.approvalsReceived}/${pendingApproval.approvalsRequired}`
          );
        }
      }
    }

    const canTransition = errors.length === 0;

    return {
      canTransition,
      conditionResults,
      validatorResults,
      requiresApproval,
      pendingApproval,
      errors,
      warnings,
    };
  }

  private async evaluateCondition(
    condition: TransitionCondition,
    issue: IssueContext,
    user: UserContext,
    additionalContext?: any
  ): Promise<ConditionEvaluationResult> {
    let passed = false;
    let errorMessage = condition.errorMessage;

    try {
      switch (condition.type) {
        case 'required_fields': {
          const config = condition.config as RequiredFieldsConfig;
          const missingFields = config.fields.filter((field) => {
            const value = issue[field];
            return value === undefined || value === null || value === '';
          });
          passed = missingFields.length === 0;
          if (!passed && !errorMessage) {
            errorMessage = `Required fields missing: ${missingFields.join(', ')}`;
          }
          break;
        }

        case 'field_value': {
          const config = condition.config as FieldValueConfig;
          const fieldValue = issue[config.field];

          switch (config.operator) {
            case 'equals':
              passed = fieldValue === config.value;
              break;
            case 'not_equals':
              passed = fieldValue !== config.value;
              break;
            case 'contains':
              passed = String(fieldValue || '').includes(String(config.value));
              break;
            case 'is_empty':
              passed = !fieldValue || fieldValue === '';
              break;
            case 'is_not_empty':
              passed = !!fieldValue && fieldValue !== '';
              break;
            case 'in':
              passed = config.values?.includes(fieldValue) ?? false;
              break;
            case 'not_in':
              passed = config.values ? !config.values.includes(fieldValue) : true;
              break;
          }
          break;
        }

        case 'permission': {
          const config = condition.config as { permission: string };
          passed = user.permissions.includes(config.permission);
          break;
        }

        case 'assignee': {
          const config = condition.config as { condition: string; userId?: string; role?: string };
          switch (config.condition) {
            case 'is_assigned':
              passed = !!issue.assigneeId;
              break;
            case 'is_current_user':
              passed = issue.assigneeId === user.id;
              break;
            case 'is_specific_user':
              passed = issue.assigneeId === config.userId;
              break;
            case 'has_role':
              passed = user.roles.includes(config.role || '');
              break;
          }
          break;
        }

        case 'reporter': {
          passed = issue.reporterId === user.id;
          break;
        }

        case 'resolution': {
          passed = !!issue.resolution;
          if (!passed && !errorMessage) {
            errorMessage = 'Resolution is required';
          }
          break;
        }

        case 'linked_issues': {
          const config = condition.config as LinkedIssuesConfig;
          const linkedIssues = additionalContext?.linkedIssues || [];

          switch (config.condition) {
            case 'has_links':
              passed = linkedIssues.length > 0;
              break;
            case 'all_resolved':
              passed = linkedIssues.every((li: any) => li.status === 'Done' || li.status === 'Resolved');
              break;
            case 'none_blocking':
              passed = !linkedIssues.some((li: any) => li.linkType === 'blocks' && li.status !== 'Done');
              break;
          }
          break;
        }

        case 'subtasks_done': {
          const config = condition.config as SubtasksDoneConfig;
          const subtasks = additionalContext?.subtasks || [];
          const requiredPercent = config.percentComplete ?? 100;

          if (subtasks.length === 0) {
            passed = true;
          } else {
            const doneCount = subtasks.filter((s: any) => s.statusCategory === 'done').length;
            const percent = (doneCount / subtasks.length) * 100;
            passed = percent >= requiredPercent;
          }
          break;
        }

        case 'time_logged': {
          const config = condition.config as TimeLoggedConfig;
          const timeLogged = additionalContext?.timeLogged || 0;
          passed = timeLogged >= config.minimumMinutes;
          if (!passed && !errorMessage) {
            errorMessage = `Minimum ${config.minimumMinutes} minutes of time must be logged`;
          }
          break;
        }

        case 'approval': {
          // Approval is handled separately
          passed = true;
          break;
        }

        case 'custom_script': {
          // Custom scripts would require sandboxed execution - skip for now
          passed = true;
          break;
        }

        case 'project_role': {
          const config = condition.config as { roles: string[]; operator?: 'any' | 'all' };
          const operator = config.operator ?? 'any';
          // System admin always bypasses all role restrictions
          if (user.roles?.includes('admin')) {
            passed = true;
            break;
          }
          // Combine system roles with the user's project-level role
          const allUserRoles = [
            ...(user.roles ?? []),
            ...(additionalContext?.projectRole ? [additionalContext.projectRole] : []),
          ];
          passed = operator === 'any'
            ? config.roles.some((r) => allUserRoles.includes(r))
            : config.roles.every((r) => allUserRoles.includes(r));
          if (!passed && !errorMessage) {
            errorMessage = `Role not permitted for this transition. Required: ${config.roles.join(' or ')}`;
          }
          break;
        }
      }
    } catch (error) {
      logger.error(`Error evaluating condition ${condition.id}:`, error);
      passed = false;
      errorMessage = 'Error evaluating condition';
    }

    return {
      conditionId: condition.id,
      conditionName: condition.name,
      passed,
      isBlocking: condition.isBlocking,
      errorMessage: !passed ? errorMessage : undefined,
    };
  }

  private async evaluateValidator(
    validator: TransitionValidator,
    issue: IssueContext
  ): Promise<ValidatorEvaluationResult> {
    let passed = true;
    let errorMessage = validator.errorMessage;
    const fieldValue = issue[validator.field];

    try {
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        // Skip validation for empty fields (use required_fields condition for that)
        return {
          validatorId: validator.id,
          validatorName: validator.name,
          field: validator.field,
          passed: true,
        };
      }

      switch (validator.type) {
        case 'validate_regex': {
          const config = validator.config as { pattern: string; flags?: string };
          const regex = new RegExp(config.pattern, config.flags);
          passed = regex.test(String(fieldValue));
          if (!passed && !errorMessage) {
            errorMessage = `${validator.field} does not match required format`;
          }
          break;
        }

        case 'validate_date_range': {
          const config = validator.config as {
            minDate?: string;
            maxDate?: string;
            relativeToPast?: number;
            relativeToFuture?: number;
          };
          const dateValue = new Date(fieldValue);
          const now = new Date();

          if (config.minDate) {
            passed = dateValue >= new Date(config.minDate);
          }
          if (passed && config.maxDate) {
            passed = dateValue <= new Date(config.maxDate);
          }
          if (passed && config.relativeToPast !== undefined) {
            const minDate = new Date(now);
            minDate.setDate(minDate.getDate() - config.relativeToPast);
            passed = dateValue >= minDate;
          }
          if (passed && config.relativeToFuture !== undefined) {
            const maxDate = new Date(now);
            maxDate.setDate(maxDate.getDate() + config.relativeToFuture);
            passed = dateValue <= maxDate;
          }
          break;
        }

        case 'validate_numeric_range': {
          const config = validator.config as { min?: number; max?: number };
          const numValue = Number(fieldValue);
          if (config.min !== undefined) {
            passed = numValue >= config.min;
          }
          if (passed && config.max !== undefined) {
            passed = numValue <= config.max;
          }
          break;
        }

        case 'validate_email': {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          passed = emailRegex.test(String(fieldValue));
          if (!passed && !errorMessage) {
            errorMessage = `${validator.field} must be a valid email address`;
          }
          break;
        }

        case 'validate_url': {
          try {
            new URL(String(fieldValue));
            passed = true;
          } catch {
            passed = false;
            if (!errorMessage) {
              errorMessage = `${validator.field} must be a valid URL`;
            }
          }
          break;
        }

        case 'validate_custom': {
          // Custom validation would require sandboxed execution
          passed = true;
          break;
        }
      }
    } catch (error) {
      logger.error(`Error evaluating validator ${validator.id}:`, error);
      passed = false;
      errorMessage = 'Error validating field';
    }

    return {
      validatorId: validator.id,
      validatorName: validator.name,
      field: validator.field,
      passed,
      errorMessage: !passed ? errorMessage : undefined,
    };
  }

  // === Approval Handling ===

  async requestApproval(
    issueId: string,
    transitionId: string,
    userId: string
  ): Promise<IssueTransitionApproval> {
    const approvalConfig = await this.repository.findApprovalConfig(transitionId);
    if (!approvalConfig) {
      throw ApiError.badRequest('This transition does not require approval');
    }

    // Check for existing pending approval
    const existing = await this.repository.findPendingApproval(issueId, transitionId);
    if (existing) {
      return existing;
    }

    const expiresAt = approvalConfig.expiryHours
      ? new Date(Date.now() + approvalConfig.expiryHours * 60 * 60 * 1000)
      : undefined;

    return this.repository.createIssueApproval({
      issueId,
      transitionId,
      requestedBy: userId,
      approvalsRequired: approvalConfig.requiredApprovals,
      expiresAt,
    });
  }

  async respondToApproval(
    approvalId: string,
    userId: string,
    decision: 'approved' | 'rejected',
    comment?: string
  ): Promise<IssueTransitionApproval> {
    // Check if user already responded
    const hasResponded = await this.repository.hasUserResponded(approvalId, userId);
    if (hasResponded) {
      throw ApiError.badRequest('You have already responded to this approval request');
    }

    // Record the response
    await this.repository.createApprovalResponse({
      approvalId,
      userId,
      decision,
      comment,
    });

    // Get all responses and update approval status
    const responses = await this.repository.findApprovalResponses(approvalId);
    const approvedCount = responses.filter((r) => r.decision === 'approved').length;
    const rejectedCount = responses.filter((r) => r.decision === 'rejected').length;

    // Note: We need to get the approval to check approvalsRequired
    // For now, update the approvals received count
    const updatedApproval = await this.repository.updateIssueApproval(approvalId, {
      approvalsReceived: approvedCount,
    });

    if (!updatedApproval) {
      throw ApiError.notFound('Approval not found');
    }

    // Check if approval is complete
    if (rejectedCount > 0) {
      await this.repository.updateIssueApproval(approvalId, {
        status: 'rejected',
        completedAt: new Date(),
      });
    } else if (approvedCount >= updatedApproval.approvalsRequired) {
      await this.repository.updateIssueApproval(approvalId, {
        status: 'approved',
        completedAt: new Date(),
      });
    }

    return (await this.repository.findPendingApproval(
      updatedApproval.issueId,
      updatedApproval.transitionId
    ))!;
  }

  // === Reference Data ===

  getConditionTypes(): { type: ConditionType; description: string }[] {
    return Object.entries(CONDITION_TYPE_DESCRIPTIONS).map(([type, description]) => ({
      type: type as ConditionType,
      description,
    }));
  }

  getValidatorTypes() {
    return Object.entries(VALIDATOR_TYPE_DESCRIPTIONS).map(([type, description]) => ({
      type,
      description,
    }));
  }

  getPostFunctionTypes() {
    return Object.entries(POSTFUNCTION_TYPE_DESCRIPTIONS).map(([type, description]) => ({
      type,
      description,
    }));
  }

  // === Post-Function Execution ===

  /**
   * Execute all enabled post-functions for a transition after a successful status change.
   * Errors in individual post-functions are logged but never fail the transition.
   */
  async executePostFunctions(
    transitionId: string,
    issue: IssueContext,
    userId: string
  ): Promise<void> {
    const postFunctions = await this.repository.findPostFunctionsByTransition(transitionId);
    const enabled = postFunctions
      .filter((pf) => pf.isEnabled)
      .sort((a, b) => a.executionOrder - b.executionOrder);

    for (const pf of enabled) {
      try {
        await this.executePostFunction(pf, issue, userId);
      } catch (err) {
        logger.error(`Post-function '${pf.type}' (id=${pf.id}) failed for issue ${issue.id}:`, err);
      }
    }
  }

  private async executePostFunction(
    pf: TransitionPostFunction,
    issue: IssueContext,
    userId: string
  ): Promise<void> {
    const { prisma } = await import('../../database/prisma');

    switch (pf.type) {
      case 'set_field': {
        const config = pf.config as { field: string; value: any };
        await prisma.issue.update({
          where: { id: issue.id },
          data: { [config.field]: config.value },
        });
        break;
      }

      case 'clear_field': {
        const config = pf.config as { fields: string[] };
        const clearData: Record<string, null> = {};
        for (const f of config.fields) clearData[f] = null;
        await prisma.issue.update({ where: { id: issue.id }, data: clearData });
        break;
      }

      case 'copy_field': {
        const config = pf.config as { sourceField: string; targetField: string };
        const src = issue[config.sourceField];
        if (src !== undefined) {
          await prisma.issue.update({
            where: { id: issue.id },
            data: { [config.targetField]: src },
          });
        }
        break;
      }

      case 'assign_to_reporter': {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { assigneeId: issue.reporterId },
        });
        break;
      }

      case 'assign_to_lead': {
        const project = await prisma.project.findUnique({
          where: { id: issue.projectId },
          select: { leadId: true },
        });
        if (project?.leadId) {
          await prisma.issue.update({
            where: { id: issue.id },
            data: { assigneeId: project.leadId },
          });
        }
        break;
      }

      case 'unassign': {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { assigneeId: null },
        });
        break;
      }

      case 'add_comment': {
        const config = pf.config as { comment: string; isInternal?: boolean };
        const { commentsService } = await import('../comments/comments.service');
        await commentsService.createComment({
          issueId: issue.id,
          authorId: userId,
          content: config.comment,
        });
        break;
      }

      case 'add_watcher': {
        const config = pf.config as { userType: 'specific' | 'assignee' | 'reporter'; userId?: string };
        let watcherId: string | null = null;
        if (config.userType === 'specific' && config.userId) watcherId = config.userId;
        else if (config.userType === 'assignee' && issue.assigneeId) watcherId = issue.assigneeId;
        else if (config.userType === 'reporter') watcherId = issue.reporterId;

        if (watcherId) {
          await prisma.issueWatcher.upsert({
            where: { issueId_userId: { issueId: issue.id, userId: watcherId } },
            update: {},
            create: { issueId: issue.id, userId: watcherId },
          });
        }
        break;
      }

      case 'send_notification': {
        const config = pf.config as {
          recipients: 'assignee' | 'reporter' | 'watchers' | 'specific';
          userIds?: string[];
          message: string;
        };
        const { notificationsService } = await import('../notifications/notifications.service');
        let recipientIds: string[] = [];

        if (config.recipients === 'assignee' && issue.assigneeId) {
          recipientIds = [issue.assigneeId];
        } else if (config.recipients === 'reporter') {
          recipientIds = [issue.reporterId];
        } else if (config.recipients === 'watchers') {
          const watchers = await prisma.issueWatcher.findMany({
            where: { issueId: issue.id },
            select: { userId: true },
          });
          recipientIds = watchers.map((w) => w.userId);
        } else if (config.recipients === 'specific' && config.userIds) {
          recipientIds = config.userIds;
        }

        if (recipientIds.length > 0) {
          await notificationsService.notify(
            {
              type: 'issue_updated',
              recipientIds,
              actorId: userId,
              issueId: issue.id,
              projectId: issue.projectId,
              metadata: { message: config.message },
            },
            'Workflow'
          );
        }
        break;
      }

      case 'update_parent': {
        if (!issue.parentId) break;
        const siblings = await prisma.issue.findMany({
          where: { parentId: issue.parentId },
          include: { status: { select: { category: true } } },
        });
        const allDone = siblings.every((s) => s.status?.category === 'done');
        if (allDone) {
          // Find a done status in the workflow for the parent issue
          const parent = await prisma.issue.findUnique({
            where: { id: issue.parentId },
            include: { status: { include: { workflow: { include: { statuses: true } } } } },
          });
          const doneStatus = parent?.status?.workflow?.statuses?.find(
            (s) => s.category === 'done' && !s.isFinal
          ) ?? parent?.status?.workflow?.statuses?.find((s) => s.category === 'done');
          if (doneStatus && parent?.statusId !== doneStatus.id) {
            await prisma.issue.update({
              where: { id: issue.parentId },
              data: { statusId: doneStatus.id },
            });
          }
        }
        break;
      }

      case 'trigger_webhook': {
        const _config = pf.config as { webhookId: string };
        const { webhooksService } = await import('../webhooks/webhooks.service');
        // triggerWebhook fires all registered webhooks for this project + event type
        await webhooksService.triggerWebhook(issue.projectId, 'issue.updated', {
          issueId: issue.id,
          triggeredBy: userId,
          source: 'workflow_post_function',
        });
        break;
      }
    }
  }
}

export const transitionConditionsService = new TransitionConditionsService();
