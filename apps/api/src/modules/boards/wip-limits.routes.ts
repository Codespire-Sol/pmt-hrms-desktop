import { Router } from 'express';
import { WipLimitsController } from './wip-limits.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const controller = new WipLimitsController();

// All routes require authentication
router.use(authenticate);

// Board-level settings
router.get('/boards/:boardId/wip-settings', controller.getBoardSettings);
router.patch('/boards/:boardId/wip-settings', controller.updateBoardSettings);

// Column WIP limits
router.get('/boards/:boardId/wip-limits', controller.getColumnWipLimits);
router.patch('/columns/:columnId/wip-limit', controller.updateColumnWipLimit);

// WIP status
router.get('/boards/:boardId/wip-status', controller.getBoardWipStatus);
router.get('/boards/:boardId/can-move', controller.checkCanMoveIssue);

// Violations
router.get('/boards/:boardId/wip-violations', controller.getViolations);

export default router;
