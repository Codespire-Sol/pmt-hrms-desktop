import { Router } from 'express';
import { githubController } from './github.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// Webhook endpoint (no auth required — uses per-repo signature verification)
router.post('/webhook', githubController.handleWebhook.bind(githubController));

// All other endpoints require authentication
router.use(authenticate);

// Account connection (PAT-based)
router.post('/connect', githubController.connect.bind(githubController));
router.get('/connect', githubController.getConnection.bind(githubController));
router.delete('/connect', githubController.disconnect.bind(githubController));

// Repository listing
router.get('/repositories', githubController.listRepositories.bind(githubController));

// Project-scoped routes
router.get(
  '/projects/:projectId/repository',
  githubController.getRepositoryStatus.bind(githubController)
);
router.post(
  '/projects/:projectId/repository',
  githubController.linkRepository.bind(githubController)
);
router.delete(
  '/projects/:projectId/repository',
  githubController.unlinkRepository.bind(githubController)
);
router.get(
  '/projects/:projectId/code-overview',
  githubController.getProjectCodeOverview.bind(githubController)
);
router.post(
  '/projects/:projectId/suggest-branch',
  githubController.suggestBranchName.bind(githubController)
);

// Repository settings
router.put(
  '/repositories/:repositoryId',
  githubController.updateRepository.bind(githubController)
);

// Branch creation
router.post(
  '/repositories/:repositoryId/branches',
  githubController.createBranch.bind(githubController)
);

// Issue-level routes
router.get(
  '/issues/:issueId/code-activity',
  githubController.getCodeActivity.bind(githubController)
);
router.get(
  '/issues/:issueId/builds',
  githubController.getBuilds.bind(githubController)
);

export default router;
