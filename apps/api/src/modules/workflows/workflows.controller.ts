import { Request, Response } from 'express';
import { z } from 'zod';
import { workflowsService } from './workflows.service';
import { transitionConditionsService } from './transition-conditions.service';

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  projectId: z.string().uuid().optional(),
  copyFromId: z.string().uuid().optional(),
  fromTemplate: z.string().optional(),
});

const transitionRestrictionSchema = z.object({
  roles: z.array(z.string().min(1)).min(1, 'At least one role is required'),
  operator: z.enum(['any', 'all']).optional(),
  name: z.string().max(100).optional(),
  errorMessage: z.string().max(300).optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

const categorySchema = z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/, 'Category must be lowercase alphanumeric with underscores');

const createStatusSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z_]+$/, 'Name must be lowercase with underscores only'),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  category: categorySchema,
  wipLimit: z.number().int().min(0).optional(),
  isInitial: z.boolean().optional(),
  isFinal: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  displayName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  category: categorySchema.optional(),
  wipLimit: z.number().int().min(0).nullable().optional(),
  isInitial: z.boolean().optional(),
  isFinal: z.boolean().optional(),
});

const reorderStatusesSchema = z.object({
  statusIds: z.array(z.string().uuid()).min(1),
});

const addTransitionSchema = z.object({
  fromStatusId: z.string().uuid(),
  toStatusId: z.string().uuid(),
  name: z.string().max(100).optional(),
});

const setTransitionsSchema = z.object({
  transitions: z.array(z.object({
    fromStatusId: z.string().uuid(),
    toStatusId: z.string().uuid(),
    name: z.string().max(100).optional(),
  })),
});

export const workflowsController = {
  // ==================== WORKFLOW OPERATIONS ====================

  async getWorkflows(req: Request, res: Response) {
    try {
      const { projectId } = req.query as { projectId?: string };
      const workflows = await workflowsService.getWorkflows(projectId);

      res.json({
        success: true,
        data: workflows,
      });
    } catch (error) {
      console.error('Error getting workflows:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get workflows' },
      });
    }
  },

  async getWorkflow(req: Request, res: Response) {
    try {
      const { workflowId } = req.params;
      const workflow = await workflowsService.getWorkflow(workflowId);

      res.json({
        success: true,
        data: workflow,
      });
    } catch (error: any) {
      if (error.message === 'Workflow not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Workflow not found' },
        });
      }
      console.error('Error getting workflow:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get workflow' },
      });
    }
  },

  async assignWorkflowToProject(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { workflowId } = req.body;
      if (!workflowId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'workflowId is required' },
        });
      }
      const workflow = await workflowsService.assignWorkflowToProject(projectId, workflowId);
      res.json({ success: true, data: workflow });
    } catch (error: any) {
      console.error('Error assigning workflow to project:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to assign workflow' },
      });
    }
  },

  async getProjectWorkflow(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const workflow = await workflowsService.getProjectWorkflow(projectId);

      res.json({
        success: true,
        data: workflow,
      });
    } catch (error: any) {
      if (error.message === 'No workflow found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No workflow found for this project' },
        });
      }
      console.error('Error getting project workflow:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get workflow' },
      });
    }
  },

  async createWorkflow(req: Request, res: Response) {
    try {
      const input = createWorkflowSchema.parse(req.body);
      const workflow = await workflowsService.createWorkflow(input as any);

      res.status(201).json({
        success: true,
        message: 'Workflow created successfully',
        data: workflow,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      console.error('Error creating workflow:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create workflow' },
      });
    }
  },

  async updateWorkflow(req: Request, res: Response) {
    try {
      const { workflowId } = req.params;
      const input = updateWorkflowSchema.parse(req.body);
      const workflow = await workflowsService.updateWorkflow(workflowId, input);

      res.json({
        success: true,
        message: 'Workflow updated successfully',
        data: workflow,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      if (error.message === 'Workflow not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Workflow not found' },
        });
      }
      console.error('Error updating workflow:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update workflow' },
      });
    }
  },

  async deleteWorkflow(req: Request, res: Response) {
    try {
      const { workflowId } = req.params;
      const result = await workflowsService.deleteWorkflow(workflowId);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      if (error.message === 'Workflow not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Workflow not found' },
        });
      }
      if (
        error.message === 'Cannot delete the default workflow' ||
        error.message?.startsWith('Cannot delete workflow:')
      ) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_OPERATION', message: error.message },
        });
      }
      console.error('Error deleting workflow:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete workflow' },
      });
    }
  },

  // ==================== STATUS OPERATIONS ====================

  async getStatuses(req: Request, res: Response) {
    try {
      const { workflowId } = req.params;
      const statuses = await workflowsService.getStatuses(workflowId);

      res.json({
        success: true,
        data: statuses,
      });
    } catch (error) {
      console.error('Error getting statuses:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get statuses' },
      });
    }
  },

  async createStatus(req: Request, res: Response) {
    try {
      const { workflowId } = req.params;
      const input = createStatusSchema.parse(req.body);
      const status = await workflowsService.createStatus({ workflowId, ...input } as any);

      res.status(201).json({
        success: true,
        message: 'Status created successfully',
        data: status,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      if (error.message === 'Status name already exists in this workflow') {
        return res.status(400).json({
          success: false,
          error: { code: 'DUPLICATE_NAME', message: error.message },
        });
      }
      console.error('Error creating status:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create status' },
      });
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const { statusId } = req.params;
      const input = updateStatusSchema.parse(req.body);
      const status = await workflowsService.updateStatus(statusId, input);

      res.json({
        success: true,
        message: 'Status updated successfully',
        data: status,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      if (error.message === 'Status not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Status not found' },
        });
      }
      console.error('Error updating status:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update status' },
      });
    }
  },

  async deleteStatus(req: Request, res: Response) {
    try {
      const { statusId } = req.params;
      const result = await workflowsService.deleteStatus(statusId);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      if (error.message === 'Status not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Status not found' },
        });
      }
      if (error.message.includes('Cannot delete')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_OPERATION', message: error.message },
        });
      }
      console.error('Error deleting status:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete status' },
      });
    }
  },

  async reorderStatuses(req: Request, res: Response) {
    try {
      const { workflowId } = req.params;
      const { statusIds } = reorderStatusesSchema.parse(req.body);
      const statuses = await workflowsService.reorderStatuses(workflowId, statusIds);

      res.json({
        success: true,
        message: 'Statuses reordered successfully',
        data: statuses,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      console.error('Error reordering statuses:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to reorder statuses' },
      });
    }
  },

  // ==================== TRANSITION OPERATIONS ====================

  async getTransitions(req: Request, res: Response) {
    try {
      const { workflowId } = req.params;
      const transitions = await workflowsService.getTransitions(workflowId);

      res.json({
        success: true,
        data: transitions,
      });
    } catch (error) {
      console.error('Error getting transitions:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get transitions' },
      });
    }
  },

  async getAvailableTransitions(req: Request, res: Response) {
    try {
      const { statusId } = req.params;
      const statuses = await workflowsService.getAvailableTransitions(statusId);

      res.json({
        success: true,
        data: statuses,
      });
    } catch (error) {
      console.error('Error getting available transitions:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get available transitions' },
      });
    }
  },

  async addTransition(req: Request, res: Response) {
    try {
      const { workflowId } = req.params;
      const input = addTransitionSchema.parse(req.body);
      const transition = await workflowsService.addTransition({ workflowId, ...input } as any);

      res.status(201).json({
        success: true,
        message: 'Transition added successfully',
        data: transition,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      if (error.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: error.message },
        });
      }
      console.error('Error adding transition:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to add transition' },
      });
    }
  },

  async removeTransition(req: Request, res: Response) {
    try {
      const { transitionId } = req.params;
      const result = await workflowsService.removeTransition(transitionId);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      if (error.message === 'Transition not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Transition not found' },
        });
      }
      console.error('Error removing transition:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove transition' },
      });
    }
  },

  async setTransitions(req: Request, res: Response) {
    try {
      const { workflowId } = req.params;
      const { transitions } = setTransitionsSchema.parse(req.body);
      const result = await workflowsService.setTransitions(workflowId, transitions as any);

      res.json({
        success: true,
        message: 'Transitions updated successfully',
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      console.error('Error setting transitions:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to set transitions' },
      });
    }
  },

  // ==================== WORKFLOW TEMPLATES ====================

  async getTemplates(_req: Request, res: Response) {
    try {
      const templates = workflowsService.getTemplates();
      res.json({ success: true, data: templates });
    } catch (error) {
      console.error('Error getting workflow templates:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get workflow templates' },
      });
    }
  },

  // ==================== TRANSITION ROLE RESTRICTIONS ====================

  async getTransitionRestrictions(req: Request, res: Response) {
    try {
      const { transitionId } = req.params;
      const conditions = await transitionConditionsService.getConditions(transitionId);
      const restrictions = conditions.filter((c) => c.type === 'project_role');
      res.json({ success: true, data: restrictions });
    } catch (error) {
      console.error('Error getting transition restrictions:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get restrictions' },
      });
    }
  },

  async addTransitionRestriction(req: Request, res: Response) {
    try {
      const { transitionId } = req.params;
      const input = transitionRestrictionSchema.parse(req.body);

      const condition = await transitionConditionsService.createCondition(transitionId, {
        name: input.name ?? 'Role Restriction',
        type: 'project_role',
        config: { roles: input.roles, operator: input.operator ?? 'any' },
        isBlocking: true,
        errorMessage: input.errorMessage ?? `Role not permitted. Required: ${input.roles.join(' or ')}`,
        executionOrder: 1,
      });

      res.status(201).json({
        success: true,
        message: 'Role restriction added successfully',
        data: condition,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      console.error('Error adding transition restriction:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to add restriction' },
      });
    }
  },

  async setTransitionRestrictions(req: Request, res: Response) {
    try {
      const { transitionId } = req.params;
      const input = transitionRestrictionSchema.parse(req.body);

      // Remove all existing project_role conditions, then create the new one
      const existing = await transitionConditionsService.getConditions(transitionId);
      const roleConditions = existing.filter((c) => c.type === 'project_role');
      await Promise.all(roleConditions.map((c) => transitionConditionsService.deleteCondition(c.id)));

      const condition = await transitionConditionsService.createCondition(transitionId, {
        name: input.name ?? 'Role Restriction',
        type: 'project_role',
        config: { roles: input.roles, operator: input.operator ?? 'any' },
        isBlocking: true,
        errorMessage: input.errorMessage ?? `Role not permitted. Required: ${input.roles.join(' or ')}`,
        executionOrder: 1,
      });

      res.json({
        success: true,
        message: 'Role restrictions updated successfully',
        data: condition,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation error', details: error.errors },
        });
      }
      console.error('Error setting transition restrictions:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to set restrictions' },
      });
    }
  },

  async removeTransitionRestriction(req: Request, res: Response) {
    try {
      const { conditionId } = req.params;
      const result = await transitionConditionsService.deleteCondition(conditionId);
      res.json({ success: true, message: result.message });
    } catch (error: any) {
      if (error.message === 'Condition not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Restriction not found' },
        });
      }
      console.error('Error removing transition restriction:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove restriction' },
      });
    }
  },
};
