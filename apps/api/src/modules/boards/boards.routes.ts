import { Router } from 'express';
import { BoardsController } from './boards.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true });
const boardsController = new BoardsController();

router.use(authenticate);

// GET /api/v1/projects/:projectId/board - Main board with query params for view/swimlane
router.get('/', boardsController.getBoardData);

// GET /api/v1/projects/:projectId/board/list - List view
router.get('/list', boardsController.getListView);

// GET /api/v1/projects/:projectId/board/timeline - Timeline/Gantt view
router.get('/timeline', boardsController.getTimelineView);

// POST /api/v1/projects/:projectId/board/columns
router.post('/columns', boardsController.createColumn);

// POST /api/v1/projects/:projectId/board/columns/reorder
router.post('/columns/reorder', boardsController.reorderColumns);

// DELETE /api/v1/projects/:projectId/board/columns/:statusId
router.delete('/columns/:statusId', boardsController.deleteColumn);

// PATCH /api/v1/projects/:projectId/board/columns/:statusId
router.patch('/columns/:statusId', boardsController.updateStatusWipLimit);

// GET /api/v1/projects/:projectId/board/columns/:statusId/wip-check
router.get('/columns/:statusId/wip-check', boardsController.checkWipLimit);

export default router;
