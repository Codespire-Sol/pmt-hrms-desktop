import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { notificationSchemesController } from './notification-schemes.controller';

const router = Router();
router.use(authenticate);

router.post('/', notificationSchemesController.create);
router.get('/', notificationSchemesController.list);
router.get('/:schemeId', notificationSchemesController.get);
router.patch('/:schemeId', notificationSchemesController.update);
router.delete('/:schemeId', notificationSchemesController.delete);
router.post('/:schemeId/rules', notificationSchemesController.createRule);

export default router;

export const projectNotificationSchemesRouter = Router({ mergeParams: true });
projectNotificationSchemesRouter.use(authenticate);
projectNotificationSchemesRouter.post('/assign', notificationSchemesController.assignProject);
