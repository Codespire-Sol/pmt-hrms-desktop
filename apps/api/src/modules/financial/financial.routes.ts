import { Router } from 'express';
import { financialController } from './financial.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router({ mergeParams: true });

// All financial routes require authentication
router.use(authenticate);

// Budget endpoints
router.get(
  '/projects/:projectId/budget',
  requirePermission({ projectIdParam: 'projectId', permission: 'read' }),
  financialController.getProjectBudget,
);

router.post(
  '/projects/:projectId/budget',
  requirePermission({ projectIdParam: 'projectId', permission: 'manage_members' }),
  financialController.upsertProjectBudget,
);

// Resource rates endpoints
router.get(
  '/projects/:projectId/resource-rates',
  requirePermission({ projectIdParam: 'projectId', permission: 'read' }),
  financialController.getResourceRates,
);

router.post(
  '/projects/:projectId/resource-rates',
  requirePermission({ projectIdParam: 'projectId', permission: 'manage_members' }),
  financialController.createResourceRate,
);

router.put(
  '/projects/:projectId/resource-rates/:rateId',
  requirePermission({ projectIdParam: 'projectId', permission: 'manage_members' }),
  financialController.updateResourceRate,
);

router.delete(
  '/projects/:projectId/resource-rates/:rateId',
  requirePermission({ projectIdParam: 'projectId', permission: 'manage_members' }),
  financialController.deleteResourceRate,
);

// Analytics endpoints
router.get(
  '/projects/:projectId/burnout-chart',
  requirePermission({ projectIdParam: 'projectId', permission: 'read' }),
  financialController.getBurnoutChart,
);

router.get(
  '/projects/:projectId/budget-summary',
  requirePermission({ projectIdParam: 'projectId', permission: 'read' }),
  financialController.getBudgetSummary,
);

router.get(
  '/projects/:projectId/cost-breakdown',
  requirePermission({ projectIdParam: 'projectId', permission: 'read' }),
  financialController.getCostBreakdown,
);

router.get(
  '/projects/:projectId/budget-vs-actual',
  requirePermission({ projectIdParam: 'projectId', permission: 'read' }),
  financialController.getBudgetVsActual,
);

// Alerts endpoints
router.get(
  '/projects/:projectId/budget-alerts',
  requirePermission({ projectIdParam: 'projectId', permission: 'read' }),
  financialController.getAlerts,
);

router.post(
  '/projects/:projectId/budget-alerts/mark-read',
  requirePermission({ projectIdParam: 'projectId', permission: 'read' }),
  financialController.markAlertsRead,
);

export default router;
