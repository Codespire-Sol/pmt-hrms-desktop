import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { sprintsController } from './sprints.controller';

const router = Router();

// Project-scoped routes
router.get('/projects/:projectId/sprints', authenticate, sprintsController.getSprints);
router.post('/projects/:projectId/sprints', authenticate, sprintsController.createSprint);
router.get('/projects/:projectId/backlog', authenticate, sprintsController.getBacklog);
router.get('/projects/:projectId/backlog/search', authenticate, sprintsController.searchBacklog);
router.get('/projects/:projectId/velocity', authenticate, sprintsController.getVelocity);

// Sprint-scoped routes
router.get('/sprints/:sprintId', authenticate, sprintsController.getSprint);
router.patch('/sprints/:sprintId', authenticate, sprintsController.updateSprint);
router.delete('/sprints/:sprintId', authenticate, sprintsController.deleteSprint);
router.post('/sprints/:sprintId/start', authenticate, sprintsController.startSprint);
router.post('/sprints/:sprintId/complete', authenticate, sprintsController.completeSprint);
router.post('/sprints/:sprintId/issues', authenticate, sprintsController.addIssuesToSprint);
router.delete('/sprints/:sprintId/issues/:issueId', authenticate, sprintsController.removeIssueFromSprint);
router.get('/sprints/:sprintId/estimate-totals', authenticate, sprintsController.getSprintEstimateTotals);
router.get('/sprints/:sprintId/burndown', authenticate, sprintsController.getBurndown);
router.get('/sprints/:sprintId/burnup', authenticate, sprintsController.getBurnup);
router.get('/sprints/:sprintId/over-commitment', authenticate, sprintsController.checkOverCommitment);
router.patch('/sprints/:sprintId/retrospective', authenticate, sprintsController.updateRetrospective);

export default router;
