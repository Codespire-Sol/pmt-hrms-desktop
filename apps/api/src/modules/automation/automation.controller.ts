import { Request, Response } from 'express';
import { z } from 'zod';
import { AutomationService } from './automation.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { CreateAutomationRuleInput, UpdateAutomationRuleInput } from './automation.types';

const conditionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    field: z.string(),
    operator: z.enum([
      'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with',
      'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal',
      'is_empty', 'is_not_empty', 'in', 'not_in', 'changed', 'changed_from', 'changed_to'
    ]),
    value: z.any().optional(),
    logicalOperator: z.enum(['AND', 'OR']).optional(),
    conditions: z.array(conditionSchema).optional(),
  })
);

const actionSchema = z.object({
  id: z.string(),
  type: z.enum([
    'set_field', 'transition_issue', 'assign_issue', 'add_comment', 'add_label',
    'remove_label', 'add_watcher', 'send_notification', 'send_email', 'call_webhook',
    'create_subtask', 'link_issue', 'log_work', 'set_due_date'
  ]),
  config: z.record(z.any()),
});

const triggerConfigSchema = z.object({
  issueTypes: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  priorities: z.array(z.string()).optional(),
  fieldChanged: z.array(z.string()).optional(),
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string().optional(),
}).optional();

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  triggerType: z.enum([
    'issue_created', 'issue_updated', 'issue_transitioned', 'issue_assigned',
    'issue_commented', 'sprint_started', 'sprint_completed', 'scheduled', 'manual'
  ]),
  triggerConfig: triggerConfigSchema,
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).min(1, 'At least one action is required'),
  executionOrder: z.number().int().min(0).optional(),
  stopOnError: z.boolean().optional(),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  isEnabled: z.boolean().optional(),
  triggerType: z.enum([
    'issue_created', 'issue_updated', 'issue_transitioned', 'issue_assigned',
    'issue_commented', 'sprint_started', 'sprint_completed', 'scheduled', 'manual'
  ]).optional(),
  triggerConfig: triggerConfigSchema,
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).optional(),
  executionOrder: z.number().int().min(0).optional(),
  stopOnError: z.boolean().optional(),
});

export class AutomationController {
  private service: AutomationService;

  constructor() {
    this.service = new AutomationService();
  }

  // === Rule Management ===

  createRule = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createRuleSchema.parse(req.body) as CreateAutomationRuleInput;
      const rule = await this.service.createRule(req.params.projectId, req.user!.id, input);

      res.status(201).json({
        success: true,
        message: 'Automation rule created successfully',
        data: rule,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getRule = asyncHandler(async (req: Request, res: Response) => {
    const rule = await this.service.getRule(req.params.ruleId);

    res.json({
      success: true,
      data: rule,
    });
  });

  getRules = asyncHandler(async (req: Request, res: Response) => {
    const options = {
      triggerType: req.query.triggerType as any,
      isEnabled: req.query.isEnabled === 'true' ? true : req.query.isEnabled === 'false' ? false : undefined,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    const result = await this.service.getRules(req.params.projectId, options);

    res.json({
      success: true,
      data: result,
    });
  });

  updateRule = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateRuleSchema.parse(req.body) as UpdateAutomationRuleInput;
      const rule = await this.service.updateRule(req.params.ruleId, input);

      res.json({
        success: true,
        message: 'Automation rule updated successfully',
        data: rule,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteRule = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteRule(req.params.ruleId);

    res.json({
      success: true,
      ...result,
    });
  });

  toggleRule = asyncHandler(async (req: Request, res: Response) => {
    const { isEnabled } = req.body;

    if (typeof isEnabled !== 'boolean') {
      throw ApiError.badRequest('isEnabled must be a boolean');
    }

    const rule = await this.service.toggleRule(req.params.ruleId, isEnabled);

    res.json({
      success: true,
      message: isEnabled ? 'Rule enabled' : 'Rule disabled',
      data: rule,
    });
  });

  duplicateRule = asyncHandler(async (req: Request, res: Response) => {
    const rule = await this.service.duplicateRule(req.params.ruleId, req.user!.id);

    res.status(201).json({
      success: true,
      message: 'Rule duplicated successfully',
      data: rule,
    });
  });

  // === Rule Execution ===

  triggerRule = asyncHandler(async (req: Request, res: Response) => {
    const issueId = req.body.issueId as string | undefined;
    const result = await this.service.triggerManually(req.params.ruleId, req.user!.id, issueId);

    res.json({
      success: true,
      ...result,
    });
  });

  testRule = asyncHandler(async (req: Request, res: Response) => {
    const issueId = req.body.issueId as string | undefined;
    const result = await this.service.dryRunRule(req.params.ruleId, issueId);

    res.json({
      success: true,
      dryRun: true,
      data: result,
    });
  });

  // === Execution History ===

  getExecutions = asyncHandler(async (req: Request, res: Response) => {
    const options = {
      status: req.query.status as any,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    };

    const result = await this.service.getExecutions(req.params.ruleId, options);

    res.json({
      success: true,
      data: result,
    });
  });

  // === Reference Data ===

  getAvailableFields = asyncHandler(async (_req: Request, res: Response) => {
    const fields = this.service.getAvailableFields();

    res.json({
      success: true,
      data: fields,
    });
  });

  getTriggerTypes = asyncHandler(async (_req: Request, res: Response) => {
    const triggers = this.service.getTriggerTypes();

    res.json({
      success: true,
      data: triggers,
    });
  });

  getActionTypes = asyncHandler(async (_req: Request, res: Response) => {
    const actions = this.service.getActionTypes();

    res.json({
      success: true,
      data: actions,
    });
  });

  getConditionOperators = asyncHandler(async (_req: Request, res: Response) => {
    const operators = this.service.getConditionOperators();

    res.json({
      success: true,
      data: operators,
    });
  });
}
