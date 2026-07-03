import { Router } from 'express';
import { SecurityLevelsController } from './security-levels.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const securityLevelsController = new SecurityLevelsController();

router.use(authenticate);

// Project-level security level routes (nested under /projects/:projectId/security-levels)
export const projectSecurityLevelsRouter = Router({ mergeParams: true });
projectSecurityLevelsRouter.get('/', securityLevelsController.getProjectSecurityLevels);
projectSecurityLevelsRouter.post('/', securityLevelsController.createSecurityLevel);
projectSecurityLevelsRouter.post('/reorder', securityLevelsController.reorderSecurityLevels);

// Security level-specific routes (/security-levels/:levelId)
router.get('/:levelId', securityLevelsController.getSecurityLevel);
router.patch('/:levelId', securityLevelsController.updateSecurityLevel);
router.delete('/:levelId', securityLevelsController.deleteSecurityLevel);

export default router;
