import { Request, Response } from 'express';
import { z } from 'zod';
import { TransitionConditionsService } from './transition-conditions.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

const createConditionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum([
    'required_fields',
    'field_value',
    'permission',
    'assignee',
    'reporter',
    'resolution',
    'custom_script',
    'linked_issues',
    'subtasks_done',
    'time_logged',
    'approval',
  ]),
  config: z.record(z.any()),
  isBlocking: z.boolean().optional(),
  errorMessage: z.string().max(500).optional(),
  executionOrder: z.number().int().min(0).optional(),
});

const createValidatorSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum([
    'validate_regex',
    'validate_date_range',
    'validate_numeric_range',
    'validate_email',
    'validate_url',
    'validate_custom',
  ]),
  field: z.string().min(1),
  config: z.record(z.any()),
  errorMessage: z.string().max(500).optional(),
  executionOrder: z.number().int().min(0).optional(),
});

const createPostFunctionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum([
    'set_field',
    'copy_field',
    'clear_field',
    'assign_to_reporter',
    'assign_to_lead',
    'unassign',
    'add_comment',
    'add_watcher',
    'send_notification',
    'update_parent',
    'trigger_webhook',
  ]),
  config: z.record(z.any()),
  executionOrder: z.number().int().min(0).optional(),
});

const createApprovalConfigSchema = z.object({
  requiredApprovals: z.number().int().min(1).max(10).optional(),
  approverType: z.enum(['any', 'all', 'specific_users', 'role', 'project_lead']),
  approvers: z.array(z.string()).optional(),
  allowSelfApproval: z.boolean().optional(),
  expiryHours: z.number().int().min(1).optional(),
});

export class TransitionConditionsController {
  private service: TransitionConditionsService;

  constructor() {
    this.service = new TransitionConditionsService();
  }

  // === Conditions ===

  createCondition = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createConditionSchema.parse(req.body);
      const condition = await this.service.createCondition(req.params.transitionId, input as any);

      res.status(201).json({
        success: true,
        message: 'Condition created successfully',
        data: condition,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getConditions = asyncHandler(async (req: Request, res: Response) => {
    const conditions = await this.service.getConditions(req.params.transitionId);

    res.json({
      success: true,
      data: conditions,
    });
  });

  updateCondition = asyncHandler(async (req: Request, res: Response) => {
    const condition = await this.service.updateCondition(req.params.conditionId, req.body);

    res.json({
      success: true,
      message: 'Condition updated successfully',
      data: condition,
    });
  });

  deleteCondition = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteCondition(req.params.conditionId);

    res.json({
      success: true,
      ...result,
    });
  });

  // === Validators ===

  createValidator = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createValidatorSchema.parse(req.body);
      const validator = await this.service.createValidator(req.params.transitionId, input as any);

      res.status(201).json({
        success: true,
        message: 'Validator created successfully',
        data: validator,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getValidators = asyncHandler(async (req: Request, res: Response) => {
    const validators = await this.service.getValidators(req.params.transitionId);

    res.json({
      success: true,
      data: validators,
    });
  });

  updateValidator = asyncHandler(async (req: Request, res: Response) => {
    const validator = await this.service.updateValidator(req.params.validatorId, req.body);

    res.json({
      success: true,
      message: 'Validator updated successfully',
      data: validator,
    });
  });

  deleteValidator = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteValidator(req.params.validatorId);

    res.json({
      success: true,
      ...result,
    });
  });

  // === Post Functions ===

  createPostFunction = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createPostFunctionSchema.parse(req.body);
      const postFunction = await this.service.createPostFunction(req.params.transitionId, input as any);

      res.status(201).json({
        success: true,
        message: 'Post function created successfully',
        data: postFunction,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getPostFunctions = asyncHandler(async (req: Request, res: Response) => {
    const postFunctions = await this.service.getPostFunctions(req.params.transitionId);

    res.json({
      success: true,
      data: postFunctions,
    });
  });

  updatePostFunction = asyncHandler(async (req: Request, res: Response) => {
    const postFunction = await this.service.updatePostFunction(req.params.postFunctionId, req.body);

    res.json({
      success: true,
      message: 'Post function updated successfully',
      data: postFunction,
    });
  });

  deletePostFunction = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deletePostFunction(req.params.postFunctionId);

    res.json({
      success: true,
      ...result,
    });
  });

  // === Approval Config ===

  setApprovalConfig = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createApprovalConfigSchema.parse(req.body);
      const config = await this.service.setApprovalConfig(req.params.transitionId, input as any);

      res.json({
        success: true,
        message: 'Approval configuration saved',
        data: config,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getApprovalConfig = asyncHandler(async (req: Request, res: Response) => {
    const config = await this.service.getApprovalConfig(req.params.transitionId);

    res.json({
      success: true,
      data: config,
    });
  });

  removeApprovalConfig = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.removeApprovalConfig(req.params.transitionId);

    res.json({
      success: true,
      ...result,
    });
  });

  // === Approval Handling ===

  requestApproval = asyncHandler(async (req: Request, res: Response) => {
    const approval = await this.service.requestApproval(
      req.params.issueId,
      req.params.transitionId,
      req.user!.id
    );

    res.status(201).json({
      success: true,
      message: 'Approval requested',
      data: approval,
    });
  });

  respondToApproval = asyncHandler(async (req: Request, res: Response) => {
    const { decision, comment } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      throw ApiError.badRequest('Decision must be "approved" or "rejected"');
    }

    const approval = await this.service.respondToApproval(
      req.params.approvalId,
      req.user!.id,
      decision,
      comment
    );

    res.json({
      success: true,
      message: `Approval ${decision}`,
      data: approval,
    });
  });

  // === Reference Data ===

  getConditionTypes = asyncHandler(async (_req: Request, res: Response) => {
    const types = this.service.getConditionTypes();

    res.json({
      success: true,
      data: types,
    });
  });

  getValidatorTypes = asyncHandler(async (_req: Request, res: Response) => {
    const types = this.service.getValidatorTypes();

    res.json({
      success: true,
      data: types,
    });
  });

  getPostFunctionTypes = asyncHandler(async (_req: Request, res: Response) => {
    const types = this.service.getPostFunctionTypes();

    res.json({
      success: true,
      data: types,
    });
  });
}
