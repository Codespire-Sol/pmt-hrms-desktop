import { Router, Request, Response, NextFunction } from 'express';
import { AutomationController } from './automation.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission, requireProjectMember } from '../../middleware/rbac.middleware';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';

const router = Router();
const controller = new AutomationController();

// All routes require authentication
router.use(authenticate);

/**
 * Middleware that resolves a rule's projectId from the database
 * and attaches it as req.params.projectId for downstream RBAC checks.
 */
function resolveRuleProject() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { ruleId } = req.params;
      if (!ruleId) {
        throw ApiError.badRequest('Rule ID is required');
      }

      const rule = await prisma.automationRule.findUnique({
        where: { id: ruleId },
        select: { projectId: true },
      });

      if (!rule) {
        throw ApiError.notFound('Automation rule not found');
      }

      // Attach projectId so downstream middleware can use it
      req.params.projectId = rule.projectId;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Read access: resolves rule -> checks project membership */
const requireRuleReadAccess = [
  resolveRuleProject(),
  requireProjectMember('projectId'),
];

/** Write access: resolves rule -> checks automation.manage permission */
const requireRuleWriteAccess = [
  resolveRuleProject(),
  requirePermission({ permission: 'automation.manage', projectIdParam: 'projectId' }),
];

// Reference data endpoints (no project context needed)
router.get('/fields', controller.getAvailableFields);
router.get('/triggers', controller.getTriggerTypes);
router.get('/actions', controller.getActionTypes);
router.get('/operators', controller.getConditionOperators);

// Project-specific routes
router.post(
  '/projects/:projectId/rules',
  requirePermission({ permission: 'automation.manage', projectIdParam: 'projectId' }),
  controller.createRule
);

router.get(
  '/projects/:projectId/rules',
  requireProjectMember('projectId'),
  controller.getRules
);

// Rule-specific routes — read access (project membership required)
router.get(
  '/rules/:ruleId',
  ...requireRuleReadAccess,
  controller.getRule
);

router.get(
  '/rules/:ruleId/executions',
  ...requireRuleReadAccess,
  controller.getExecutions
);

// Rule-specific routes — write access (automation.manage permission required)
router.patch(
  '/rules/:ruleId',
  ...requireRuleWriteAccess,
  controller.updateRule
);

router.delete(
  '/rules/:ruleId',
  ...requireRuleWriteAccess,
  controller.deleteRule
);

router.post(
  '/rules/:ruleId/toggle',
  ...requireRuleWriteAccess,
  controller.toggleRule
);

router.post(
  '/rules/:ruleId/duplicate',
  ...requireRuleWriteAccess,
  controller.duplicateRule
);

router.post(
  '/rules/:ruleId/trigger',
  ...requireRuleWriteAccess,
  controller.triggerRule
);

router.post(
  '/rules/:ruleId/test',
  ...requireRuleReadAccess,
  controller.testRule
);

export default router;
