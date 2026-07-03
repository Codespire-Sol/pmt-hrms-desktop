import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { teamsController } from './teams.controller';

const router = Router();

// Validate a Teams webhook URL (no project required — used during setup before saving)
router.post('/validate-url', authenticate, asyncHandler(teamsController.validateUrl));

// Per-project Teams integration management
router.get('/:projectId/status',     authenticate, asyncHandler(teamsController.getStatus));
router.get('/:projectId/config',     authenticate, asyncHandler(teamsController.getConfig));
router.post('/:projectId/connect',   authenticate, asyncHandler(teamsController.connect));
router.put('/:projectId/config',     authenticate, asyncHandler(teamsController.updateConfig));
router.patch('/:projectId/toggle',   authenticate, asyncHandler(teamsController.toggle));
router.post('/:projectId/test',      authenticate, asyncHandler(teamsController.test));
router.delete('/:projectId/disconnect', authenticate, asyncHandler(teamsController.disconnect));

export default router;
