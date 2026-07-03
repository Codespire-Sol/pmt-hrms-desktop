import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { gitlabService } from './gitlab.service';
import { connectGitlabSchema, linkRepositorySchema, createBranchSchema } from './gitlab.validator';
import { GitlabPushPayload, GitlabMRPayload } from './gitlab.types';

class GitlabController {
  // POST /connect — store user's PAT, verify it works
  async connectGitlab(req: Request, res: Response, next: NextFunction) {
    try {
      const { accessToken } = connectGitlabSchema.parse(req.body);
      const connection = await gitlabService.verifyAndConnect(req.user!.id, accessToken);

      res.status(201).json({
        success: true,
        message: 'GitLab account connected successfully',
        data: {
          gitlabUsername: connection.gitlabUsername,
          gitlabEmail: connection.gitlabEmail,
          tokenScopes: connection.tokenScopes,
          connectedAt: connection.connectedAt,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
        });
      }
      next(error);
    }
  }

  // GET /connect — get current connection status
  async getConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const connection = await gitlabService.getConnection(req.user!.id);

      if (!connection) {
        return res.json({
          success: true,
          data: { connected: false, connection: null },
        });
      }

      res.json({
        success: true,
        data: {
          connected: true,
          connection: {
            gitlabUsername: connection.gitlabUsername,
            gitlabEmail: connection.gitlabEmail,
            tokenScopes: connection.tokenScopes,
            connectedAt: connection.connectedAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /connect — disconnect GitLab account
  async disconnectGitlab(req: Request, res: Response, next: NextFunction) {
    try {
      await gitlabService.disconnect(req.user!.id);
      res.json({ success: true, message: 'GitLab account disconnected' });
    } catch (error) {
      next(error);
    }
  }

  // GET /repositories — list user's accessible GitLab repos
  async listRepositories(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const repositories = await gitlabService.listUserProjects(req.user!.id, search);
      res.json({ success: true, data: { repositories } });
    } catch (error) {
      next(error);
    }
  }

  // POST /projects/:projectId/repository — link a GitLab repo to a PM project
  async linkRepository(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const { gitlabProjectId } = linkRepositorySchema.parse(req.body);

      const repository = await gitlabService.linkRepository(projectId, req.user!.id, gitlabProjectId);

      res.status(201).json({
        success: true,
        message: 'GitLab repository linked successfully',
        data: { repository },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
        });
      }
      next(error);
    }
  }

  // GET /projects/:projectId/repository — get linked repo info
  async getLinkedRepository(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const status = await gitlabService.getRepositoryStatus(projectId);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /projects/:projectId/repository — unlink repo
  async unlinkRepository(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      await gitlabService.unlinkRepository(projectId, req.user!.id);
      res.json({ success: true, message: 'GitLab repository unlinked' });
    } catch (error) {
      next(error);
    }
  }

  // GET /projects/:projectId/branches — list branches
  async listBranches(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const branches = await gitlabService.listBranches(projectId, req.user!.id);
      res.json({ success: true, data: { branches } });
    } catch (error) {
      next(error);
    }
  }

  // POST /projects/:projectId/branches — create a branch
  async createBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const { name, ref, issueId } = createBranchSchema.parse(req.body);

      const branch = await gitlabService.createBranch(projectId, req.user!.id, name, ref, issueId);

      res.status(201).json({
        success: true,
        message: 'Branch created successfully',
        data: { branch },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
        });
      }
      next(error);
    }
  }

  // GET /projects/:projectId/commits — get project commit history
  async getProjectCommits(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
      const commits = await gitlabService.getProjectCommits(projectId, req.user!.id, limit);
      res.json({ success: true, data: { commits } });
    } catch (error) {
      next(error);
    }
  }

  // GET /issues/:issueId/dev-data — get commits/branches/MRs linked to an issue
  async getIssueDevData(req: Request, res: Response, next: NextFunction) {
    try {
      const { issueId } = req.params;
      const activity = await gitlabService.getIssueCodeActivity(issueId);
      res.json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }

  // POST /webhook — receive GitLab webhook events (no auth, verified by X-Gitlab-Token)
  async handleWebhook(req: Request, res: Response) {
    try {
      const token = req.headers['x-gitlab-token'] as string;
      const gitlabProjectId = req.body?.project?.id ? Number(req.body.project.id) : undefined;

      if (!gitlabProjectId || !await gitlabService.verifyWebhookToken(gitlabProjectId, token)) {
        return res.status(401).json({ success: false, error: 'Invalid webhook token' });
      }

      const eventType = req.headers['x-gitlab-event'] as string;

      switch (eventType) {
        case 'Push Hook':
          await gitlabService.handlePushWebhook(req.body as GitlabPushPayload);
          break;
        case 'Merge Request Hook':
          await gitlabService.handleMRWebhook(req.body as GitlabMRPayload);
          break;
        case 'Pipeline Hook':
          await gitlabService.handlePipelineWebhook(req.body);
          break;
        default:
          // Unhandled event type — acknowledge without processing
          break;
      }

      // Always return 200 to GitLab to prevent retries
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('GitLab webhook error:', error);
      res.status(200).json({ success: false });
    }
  }
}

export const gitlabController = new GitlabController();
