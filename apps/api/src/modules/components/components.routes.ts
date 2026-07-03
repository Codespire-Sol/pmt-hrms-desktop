import { Router } from 'express';
import { ComponentsController } from './components.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const componentsController = new ComponentsController();

router.use(authenticate);

// Project-level component routes (nested under /projects/:projectId/components)
export const projectComponentsRouter = Router({ mergeParams: true });
projectComponentsRouter.get('/', componentsController.getProjectComponents);
projectComponentsRouter.post('/', componentsController.createComponent);

// Component-specific routes (/components/:componentId)
router.get('/:componentId', componentsController.getComponent);
router.patch('/:componentId', componentsController.updateComponent);
router.delete('/:componentId', componentsController.deleteComponent);

// Component issues
router.get('/:componentId/issues', componentsController.getComponentIssues);
router.post('/:componentId/issues', componentsController.addIssueToComponent);
router.delete('/:componentId/issues', componentsController.removeIssueFromComponent);

export default router;
