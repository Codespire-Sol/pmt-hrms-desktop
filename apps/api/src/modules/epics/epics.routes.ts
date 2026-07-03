import { Router } from 'express';
import { EpicsController } from './epics.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const epicsController = new EpicsController();

router.use(authenticate);

// Project-level epic routes (nested under /projects/:projectId/epics)
export const projectEpicsRouter = Router({ mergeParams: true });
projectEpicsRouter.get('/', epicsController.getProjectEpics);
projectEpicsRouter.post('/', epicsController.createEpic);

// Epic-specific routes (/epics/:epicId)
router.get('/:epicId', epicsController.getEpic);
router.patch('/:epicId', epicsController.updateEpic);
router.delete('/:epicId', epicsController.deleteEpic);

// Epic issues
router.get('/:epicId/issues', epicsController.getEpicIssues);
router.post('/:epicId/issues', epicsController.assignIssues);
router.delete('/:epicId/issues', epicsController.removeIssues);

export default router;
