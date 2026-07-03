import { Router } from 'express';
import { workflowsController } from './workflows.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

// Templates (must be before /:workflowId routes)
router.get('/templates', workflowsController.getTemplates);

// Workflow CRUD
router.get('/', workflowsController.getWorkflows);
router.get('/:workflowId', workflowsController.getWorkflow);
router.post('/', requirePermission('workflows.create'), workflowsController.createWorkflow);
router.patch('/:workflowId', requirePermission('workflows.manage'), workflowsController.updateWorkflow);
router.delete('/:workflowId', requirePermission('workflows.manage'), workflowsController.deleteWorkflow);

// Status operations
router.get('/:workflowId/statuses', workflowsController.getStatuses);
router.post('/:workflowId/statuses', requirePermission('workflows.manage'), workflowsController.createStatus);
router.post('/:workflowId/statuses/reorder', requirePermission('workflows.manage'), workflowsController.reorderStatuses);
router.patch('/statuses/:statusId', requirePermission('workflows.manage'), workflowsController.updateStatus);
router.delete('/statuses/:statusId', requirePermission('workflows.manage'), workflowsController.deleteStatus);

// Transition operations
router.get('/:workflowId/transitions', workflowsController.getTransitions);
router.post('/:workflowId/transitions', requirePermission('workflows.manage'), workflowsController.addTransition);
router.put('/:workflowId/transitions', requirePermission('workflows.manage'), workflowsController.setTransitions);
router.delete('/transitions/:transitionId', requirePermission('workflows.manage'), workflowsController.removeTransition);

// Transition role restriction management
router.get('/transitions/:transitionId/restrictions', requirePermission('workflows.view'), workflowsController.getTransitionRestrictions);
router.post('/transitions/:transitionId/restrictions', requirePermission('workflows.manage'), workflowsController.addTransitionRestriction);
router.put('/transitions/:transitionId/restrictions', requirePermission('workflows.manage'), workflowsController.setTransitionRestrictions);
router.delete('/transitions/:transitionId/restrictions/:conditionId', requirePermission('workflows.manage'), workflowsController.removeTransitionRestriction);

// Available transitions for a status (used during issue editing)
router.get('/statuses/:statusId/available-transitions', workflowsController.getAvailableTransitions);

// Project-specific workflow
export const projectWorkflowRouter = Router({ mergeParams: true });
projectWorkflowRouter.use(authenticate);
projectWorkflowRouter.get('/', workflowsController.getProjectWorkflow);
projectWorkflowRouter.post('/assign', workflowsController.assignWorkflowToProject);

export default router;
