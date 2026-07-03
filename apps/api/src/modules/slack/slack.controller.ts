import { Request, Response, NextFunction } from 'express';
import { slackService } from './slack.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { SlackCommand, SlackInteractivePayload, SlackEventType } from './slack.types';

export class SlackController {
  // Get OAuth URL
  async getOAuthUrl(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const { redirectUri } = req.query as { redirectUri: string };

      const url = slackService.getOAuthUrl(projectId, redirectUri);

      res.json({ success: true, data: { url } });
    } catch (error) {
      next(error);
    }
  }

  // Complete OAuth / Install Slack
  async installSlack(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const { code, redirectUri } = req.body;

      const workspace = await slackService.completeOAuth({
        projectId,
        code,
        redirectUri,
      });

      res.json({ success: true, data: { workspace } });
    } catch (error) {
      next(error);
    }
  }

  // Disconnect Slack
  async disconnectSlack(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;

      const success = await slackService.disconnectWorkspace(projectId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Slack integration not found' },
        });
        return;
      }

      res.json({ success: true, data: { disconnected: true } });
    } catch (error) {
      next(error);
    }
  }

  // Get Integration Status
  async getIntegrationStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;

      const status = await slackService.getIntegrationStatus(projectId);

      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  // List Slack Channels
  async listChannels(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;

      const channels = await slackService.listChannels(projectId);

      res.json({ success: true, data: { channels } });
    } catch (error) {
      next(error);
    }
  }

  // Configure Channel
  async configureChannel(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const { channelId, channelName, events } = req.body;

      const status = await slackService.getIntegrationStatus(projectId);
      if (!status.connected || !status.workspace) {
        res.status(400).json({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Slack is not connected' },
        });
        return;
      }

      // Get workspace ID from status (we need to add this)
      const configs = await slackService.getChannelConfigs(projectId);
      const workspaceId = configs[0]?.workspaceId;

      if (!workspaceId) {
        // Need to get from repository
        res.status(400).json({
          success: false,
          error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' },
        });
        return;
      }

      const config = await slackService.configureChannel({
        workspaceId,
        channelId,
        channelName,
        events: events as SlackEventType[],
      });

      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  // Update Channel Config
  async updateChannelConfig(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { channelConfigId } = req.params;
      const { events } = req.body;

      const config = await slackService.updateChannelConfig(channelConfigId, {
        events: events as SlackEventType[],
      });

      if (!config) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Channel configuration not found' },
        });
        return;
      }

      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  // Remove Channel
  async removeChannel(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { channelConfigId } = req.params;

      const success = await slackService.removeChannel(channelConfigId);

      if (!success) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Channel configuration not found' },
        });
        return;
      }

      res.json({ success: true, data: { removed: true } });
    } catch (error) {
      next(error);
    }
  }

  // Get Channel Configs
  async getChannelConfigs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;

      const configs = await slackService.getChannelConfigs(projectId);

      res.json({ success: true, data: { configs } });
    } catch (error) {
      next(error);
    }
  }

  // Link Slack User
  async linkSlackUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const { slackUserId, slackUsername } = req.body;
      const userId = req.user!.id;

      const configs = await slackService.getChannelConfigs(projectId);
      const workspaceId = configs[0]?.workspaceId;

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Slack is not connected' },
        });
        return;
      }

      const mapping = await slackService.linkSlackUser(userId, {
        slackUserId,
        slackUsername,
        workspaceId,
      });

      res.json({ success: true, data: mapping });
    } catch (error) {
      next(error);
    }
  }

  // Unlink Slack User
  async unlinkSlackUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;

      const configs = await slackService.getChannelConfigs(projectId);
      const workspaceId = configs[0]?.workspaceId;

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Slack is not connected' },
        });
        return;
      }

      const success = await slackService.unlinkSlackUser(userId, workspaceId);

      res.json({ success: true, data: { unlinked: success } });
    } catch (error) {
      next(error);
    }
  }

  // Get User Mapping
  async getUserMapping(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;

      const mapping = await slackService.getSlackUserMapping(userId, projectId);

      res.json({ success: true, data: { mapping } });
    } catch (error) {
      next(error);
    }
  }

  // Handle Slash Command (Slack webhook)
  async handleSlashCommand(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Verify Slack signature
      const signature = req.headers['x-slack-signature'] as string;
      const timestamp = req.headers['x-slack-request-timestamp'] as string;

      if (!slackService.verifySignature(signature, timestamp, JSON.stringify(req.body))) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const command: SlackCommand = req.body;
      const response = await slackService.handleSlashCommand(command);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Handle Interactive Actions (Slack webhook)
  async handleInteraction(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Verify Slack signature
      const signature = req.headers['x-slack-signature'] as string;
      const timestamp = req.headers['x-slack-request-timestamp'] as string;

      if (!slackService.verifySignature(signature, timestamp, JSON.stringify(req.body))) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const payload: SlackInteractivePayload = JSON.parse(req.body.payload);
      const response = await slackService.handleInteraction(payload);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Send Test Notification
  async sendTestNotification(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const { event } = req.body;
      const userId = req.user!.id;

      const success = await slackService.sendNotification({
        projectId,
        event: event as SlackEventType,
        actorId: userId,
        metadata: { test: true },
      });

      if (!success) {
        res.status(400).json({
          success: false,
          error: { code: 'SEND_FAILED', message: 'Failed to send test notification' },
        });
        return;
      }

      res.json({ success: true, data: { sent: true } });
    } catch (error) {
      next(error);
    }
  }
}

export const slackController = new SlackController();
