import { Router } from 'express';
import { gitlabController } from './gitlab.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Webhook endpoint — no JWT auth, verified by X-Gitlab-Token header
router.post('/webhook', gitlabController.handleWebhook.bind(gitlabController));

// All other routes require authentication
router.use(authenticate);

// Account connection
router.post('/connect', gitlabController.connectGitlab.bind(gitlabController));
router.get('/connect', gitlabController.getConnection.bind(gitlabController));
router.delete('/connect', gitlabController.disconnectGitlab.bind(gitlabController));

// List accessible GitLab repositories
router.get('/repositories', gitlabController.listRepositories.bind(gitlabController));

// Project-scoped: link / unlink / status
router.post('/projects/:projectId/repository', gitlabController.linkRepository.bind(gitlabController));
router.get('/projects/:projectId/repository', gitlabController.getLinkedRepository.bind(gitlabController));
router.delete('/projects/:projectId/repository', gitlabController.unlinkRepository.bind(gitlabController));

// Project-scoped: branches
router.get('/projects/:projectId/branches', gitlabController.listBranches.bind(gitlabController));
router.post('/projects/:projectId/branches', gitlabController.createBranch.bind(gitlabController));

// Project-scoped: commits
router.get('/projects/:projectId/commits', gitlabController.getProjectCommits.bind(gitlabController));

// Issue dev panel: commits + branches + MRs linked to an issue
router.get('/issues/:issueId/dev-data', gitlabController.getIssueDevData.bind(gitlabController));

export default router;
