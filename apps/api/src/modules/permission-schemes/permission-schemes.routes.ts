import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { permissionSchemesController } from './permission-schemes.controller';

const router = Router();
router.use(authenticate);

router.post('/', permissionSchemesController.create);
router.get('/', permissionSchemesController.list);
router.get('/:schemeId', permissionSchemesController.get);
router.patch('/:schemeId', permissionSchemesController.update);
router.delete('/:schemeId', permissionSchemesController.delete);
router.post('/:schemeId/rules', permissionSchemesController.createRule);

export default router;

export const projectPermissionSchemesRouter = Router({ mergeParams: true });
projectPermissionSchemesRouter.use(authenticate);
projectPermissionSchemesRouter.post('/assign', permissionSchemesController.assignProject);
projectPermissionSchemesRouter.post('/evaluate', permissionSchemesController.evaluate);
