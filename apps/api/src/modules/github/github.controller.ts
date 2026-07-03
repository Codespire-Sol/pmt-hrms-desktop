import { Request, Response, NextFunction } from 'express';
import { githubService } from './github.service';
import {
  connectGithubSchema,
  linkRepositorySchema,
  updateRepositorySchema,
  createBranchSchema,
  suggestBranchNameSchema,
} from './github.validator';
import {
  GitHubPushPayload,
  GitHubPullRequestPayload,
  GitHubBranchPayload,
  LinkRepositoryInput,
  CreateBranchInput,
} from './github.types';

class GitHubController {
  // ── Account Connection (PAT-based) ──────────────────────────────────────────

  async connect(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

      const { accessToken } = connectGithubSchema.parse(req.body);
      const result = await githubService.verifyAndConnect(userId, accessToken);

      res.status(201).json({
        success: true,
        message: 'GitHub account connected successfully',
        data: result,
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid GitHub personal access token' },
        });
      }
      next(error);
    }
  }

  async getConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

      const connection = await githubService.getConnection(userId);
      if (!connection) {
        return res.json({ success: true, data: { connected: false } });
      }

      res.json({
        success: true,
        data: {
          connected: true,
          githubUsername: connection.githubUsername,
          githubEmail: connection.githubEmail,
          avatarUrl: connection.avatarUrl,
          tokenScopes: connection.tokenScopes,
          connectedAt: connection.connectedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

      await githubService.disconnect(userId);
      res.json({ success: true, message: 'GitHub account disconnected' });
    } catch (error) {
      next(error);
    }
  }

  // ── Repository Listing & Linking ────────────────────────────────────────────

  async listRepositories(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

      const repositories = await githubService.listRepositories(userId);
      res.json({ success: true, data: { repositories } });
    } catch (error) {
      next(error);
    }
  }

  async linkRepository(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

      const { projectId } = req.params;
      const validated = linkRepositorySchema.parse(req.body);

      const repository = await githubService.linkRepository(projectId, userId, validated as LinkRepositoryInput);

      res.status(201).json({
        success: true,
        message: 'GitHub repository linked successfully',
        data: { repository },
      });
    } catch (error) {
      next(error);
    }
  }

  async unlinkRepository(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

      const { projectId } = req.params;
      await githubService.unlinkRepository(projectId, userId);

      res.json({ success: true, message: 'GitHub repository unlinked successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ── Repository Status & Settings ────────────────────────────────────────────

  async getRepositoryStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const status = await githubService.getRepositoryStatus(projectId);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  async updateRepository(req: Request, res: Response, next: NextFunction) {
    try {
      const { repositoryId } = req.params;
      const validated = updateRepositorySchema.parse(req.body);
      const repository = await githubService.updateRepository(repositoryId, validated);

      if (!repository) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Repository not found' },
        });
      }

      res.json({ success: true, data: { repository } });
    } catch (error) {
      next(error);
    }
  }

  // ── Code Overview ───────────────────────────────────────────────────────────

  async getProjectCodeOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
      const overview = await githubService.getProjectCodeOverview(projectId, limit);
      res.json({ success: true, data: overview });
    } catch (error) {
      next(error);
    }
  }

  // ── Branch Operations ───────────────────────────────────────────────────────

  async suggestBranchName(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const validated = suggestBranchNameSchema.parse(req.body);

      const status = await githubService.getRepositoryStatus(projectId);
      if (!status.connected || !status.repository) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_REPOSITORY', message: 'No repository connected to this project' },
        });
      }

      const suggestion = await githubService.suggestBranchName(
        validated.issueKey,
        validated.issueTitle,
        validated.issueType,
        status.repository.defaultBranch
      );

      res.json({ success: true, data: suggestion });
    } catch (error) {
      next(error);
    }
  }

  async createBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

      const { repositoryId } = req.params;
      const validated = createBranchSchema.parse(req.body);

      const branch = await githubService.createBranch(
        { repositoryId, ...validated } as CreateBranchInput,
        userId
      );

      res.status(201).json({ success: true, data: { branch } });
    } catch (error) {
      next(error);
    }
  }

  // ── Issue Code Activity & Builds ────────────────────────────────────────────

  async getCodeActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { issueId } = req.params;
      const activity = await githubService.getCodeActivity(issueId);
      res.json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }

  async getBuilds(req: Request, res: Response, next: NextFunction) {
    try {
      const { issueId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50);
      const builds = await githubService.getBuildRuns(issueId, limit);
      res.json({ success: true, data: builds });
    } catch (error) {
      next(error);
    }
  }

  // ── Webhook Handler ─────────────────────────────────────────────────────────

  async handleWebhook(req: Request, res: Response, _next: NextFunction) {
    try {
      const event = req.headers['x-github-event'] as string;
      const signature = req.headers['x-hub-signature-256'] as string;
      const rawBody = JSON.stringify(req.body);
      const repoFullName = req.body?.repository?.full_name;

      // Verify webhook signature using per-repo secret
      if (signature && repoFullName) {
        const valid = await githubService.verifyWebhookByRepo(repoFullName, signature, rawBody);
        if (!valid) {
          return res.status(401).json({
            success: false,
            error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
          });
        }
      }

      switch (event) {
        case 'push':
          await githubService.handlePushWebhook(req.body as GitHubPushPayload);
          break;
        case 'pull_request':
          await githubService.handlePullRequestWebhook(req.body as GitHubPullRequestPayload);
          break;
        case 'check_run':
          await githubService.handleCheckRunWebhook(req.body);
          break;
        case 'workflow_run':
          await githubService.handleWorkflowRunWebhook(req.body);
          break;
        case 'create':
          console.log('Branch/tag created:', (req.body as GitHubBranchPayload).ref);
          break;
        case 'delete':
          console.log('Branch/tag deleted:', (req.body as GitHubBranchPayload).ref);
          break;
        default:
          console.log(`Unhandled webhook event: ${event}`);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(200).json({ success: false });
    }
  }
}

export const githubController = new GitHubController();
