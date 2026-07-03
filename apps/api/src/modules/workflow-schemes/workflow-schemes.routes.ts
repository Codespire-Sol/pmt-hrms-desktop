import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { workflowSchemesController } from './workflow-schemes.controller';

const router = Router();
router.use(authenticate);

router.post('/', requirePermission('workflows.create'), workflowSchemesController.create);
router.get('/', workflowSchemesController.list);
router.get('/:schemeId', workflowSchemesController.get);
router.patch('/:schemeId', requirePermission('workflows.manage'), workflowSchemesController.update);
router.delete('/:schemeId', requirePermission('workflows.manage'), workflowSchemesController.delete);
router.post('/:schemeId/mappings', requirePermission('workflows.manage'), workflowSchemesController.upsertMapping);

export default router;

export const projectWorkflowSchemesRouter = Router({ mergeParams: true });
projectWorkflowSchemesRouter.use(authenticate);
projectWorkflowSchemesRouter.post('/assign', workflowSchemesController.assignProject);
projectWorkflowSchemesRouter.get('/effective', workflowSchemesController.getEffectiveWorkflow);
