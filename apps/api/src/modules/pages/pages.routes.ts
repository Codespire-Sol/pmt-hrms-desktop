import { Router } from 'express';
import { PagesController } from './pages.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const pagesController = new PagesController();

router.use(authenticate);

// Project-level page routes (nested under /projects/:projectId/pages)
export const projectPagesRouter = Router({ mergeParams: true });
projectPagesRouter.get('/', pagesController.getProjectPages);
projectPagesRouter.post('/', pagesController.createPage);

// Page-specific routes (/pages/:pageId)
router.get('/:pageId', pagesController.getPage);
router.patch('/:pageId', pagesController.updatePage);
router.delete('/:pageId', pagesController.deletePage);

// Page actions
router.post('/:pageId/reorder', pagesController.reorderPage);

export default router;
