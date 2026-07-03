import { Router } from 'express';
import { VersionsController } from './versions.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const versionsController = new VersionsController();

router.use(authenticate);

// Project-level version routes (nested under /projects/:projectId/versions)
export const projectVersionsRouter = Router({ mergeParams: true });
projectVersionsRouter.get('/', versionsController.getProjectVersions);
projectVersionsRouter.post('/', versionsController.createVersion);
projectVersionsRouter.post('/reorder', versionsController.reorderVersions);

// Version-specific routes (/versions/:versionId)
router.get('/:versionId', versionsController.getVersion);
router.patch('/:versionId', versionsController.updateVersion);
router.delete('/:versionId', versionsController.deleteVersion);

// Version actions
router.post('/:versionId/release', versionsController.releaseVersion);
router.post('/:versionId/archive', versionsController.archiveVersion);
router.post('/:versionId/unarchive', versionsController.unarchiveVersion);

// Version issues
router.get('/:versionId/issues', versionsController.getVersionIssues);

export default router;
