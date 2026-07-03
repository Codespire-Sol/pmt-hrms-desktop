import { Router } from 'express';
import { IssuesController } from './issues.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();
const issuesController = new IssuesController();

router.use(authenticate);

// Issue routes - nested under /projects/:projectId/issues
export const projectIssuesRouter = Router({ mergeParams: true });
projectIssuesRouter.use(authenticate);
projectIssuesRouter.post('/', issuesController.createIssue);
projectIssuesRouter.get('/', issuesController.getIssues);
projectIssuesRouter.get('/export', issuesController.exportIssues);

// Bulk operations - must be before :issueId routes
router.post('/bulk/update', issuesController.bulkUpdate);
router.post('/bulk/delete', issuesController.bulkDelete);
router.post('/bulk/move', issuesController.bulkMove);
router.post('/bulk/transition', issuesController.bulkTransition);
router.get('/bulk/:operationId', issuesController.getBulkOperation);

// Issue routes - direct /issues/:issueId
router.get('/:issueId', issuesController.getIssue);
router.patch('/:issueId', issuesController.updateIssue);
router.delete('/:issueId', issuesController.deleteIssue);

// Clone issue
router.post('/:issueId/clone', issuesController.cloneIssue);

// Workflow transitions
router.get('/:issueId/transitions', issuesController.getAvailableTransitions);
router.post('/:issueId/transition', issuesController.performTransition);

// Issue links
router.get('/:issueId/links', issuesController.getLinks);
router.post('/:issueId/links', issuesController.addLink);
router.delete('/:issueId/links/:linkId', issuesController.deleteLink);

// Link types reference
router.get('/reference/link-types', issuesController.getLinkTypes);
router.post('/reference/link-types', requirePermission('admin.settings'), issuesController.createLinkType);
router.patch('/reference/link-types/:linkTypeId', requirePermission('admin.settings'), issuesController.updateLinkType);
router.delete('/reference/link-types/:linkTypeId', requirePermission('admin.settings'), issuesController.deleteLinkType);

// Sub-task routes
router.post('/:issueId/subtasks', issuesController.createSubtask);
router.get('/:issueId/subtasks', issuesController.getSubtasks);
router.get('/:issueId/subtasks/progress', issuesController.getSubtaskProgress);

// Voting routes
router.post('/:issueId/votes', issuesController.addVote);
router.delete('/:issueId/votes', issuesController.removeVote);
router.get('/:issueId/voters', issuesController.getVoters);

// User's voted issues (at top level /issues/voted)
router.get('/me/voted', issuesController.getVotedIssues);

// Watcher routes
router.post('/:issueId/watchers', issuesController.addWatcher);
router.delete('/:issueId/watchers', issuesController.removeWatcher);
router.get('/:issueId/watchers', issuesController.getWatchers);

// User's watched issues (at top level /issues/watched)
router.get('/me/watched', issuesController.getWatchedIssues);

export default router;
