import { Request, Response } from 'express';
import { teamsService } from './teams.service';
import { ApiError } from '../../utils/ApiError';
import { WebhookEventType } from '../webhooks/webhooks.types';

export class TeamsController {
  /** GET /integrations/teams/:projectId/status */
  getStatus = async (req: Request, res: Response): Promise<void> => {
    const status = await teamsService.getStatus(req.params.projectId);
    res.json({ success: true, data: status });
  };

  /** GET /integrations/teams/:projectId/config */
  getConfig = async (req: Request, res: Response): Promise<void> => {
    const config = await teamsService.getConfig(req.params.projectId);
    if (!config) throw ApiError.notFound('Teams integration not configured for this project');
    res.json({ success: true, data: config });
  };

  /** POST /integrations/teams/:projectId/connect */
  connect = async (req: Request, res: Response): Promise<void> => {
    const { webhookUrl, events, includeIssueDetails, notifyOnMention, validate } = req.body;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      throw ApiError.badRequest('webhookUrl is required');
    }

    // If validate=true, send a test card first
    if (validate !== false) {
      const result = await teamsService.validateWebhookUrl(webhookUrl);
      if (!result.success) {
        throw ApiError.badRequest(`Could not reach Teams webhook: ${result.message}`, 'TEAMS_WEBHOOK_UNREACHABLE');
      }
    }

    const config = await teamsService.upsertConfig(req.params.projectId, {
      webhookUrl,
      events: events as WebhookEventType[] | undefined,
      includeIssueDetails,
      notifyOnMention,
      isEnabled: true,
    });

    res.status(201).json({
      success: true,
      message: 'Microsoft Teams connected successfully',
      data: config,
    });
  };

  /** PUT /integrations/teams/:projectId/config */
  updateConfig = async (req: Request, res: Response): Promise<void> => {
    const { webhookUrl, events, includeIssueDetails, notifyOnMention, isEnabled } = req.body;

    const config = await teamsService.upsertConfig(req.params.projectId, {
      ...(webhookUrl !== undefined && { webhookUrl }),
      ...(events !== undefined && { events }),
      ...(includeIssueDetails !== undefined && { includeIssueDetails }),
      ...(notifyOnMention !== undefined && { notifyOnMention }),
      ...(isEnabled !== undefined && { isEnabled }),
    } as any);

    res.json({
      success: true,
      message: 'Teams configuration updated',
      data: config,
    });
  };

  /** PATCH /integrations/teams/:projectId/toggle */
  toggle = async (req: Request, res: Response): Promise<void> => {
    const { isEnabled } = req.body;
    if (typeof isEnabled !== 'boolean') throw ApiError.badRequest('isEnabled must be a boolean');

    const config = await teamsService.toggleConfig(req.params.projectId, isEnabled);
    res.json({
      success: true,
      message: isEnabled ? 'Teams notifications enabled' : 'Teams notifications disabled',
      data: config,
    });
  };

  /** POST /integrations/teams/:projectId/test */
  test = async (req: Request, res: Response): Promise<void> => {
    const result = await teamsService.sendTestNotification(req.params.projectId);

    if (!result.success) {
      throw ApiError.badRequest(result.message, 'TEAMS_DELIVERY_FAILED');
    }

    res.json({ success: true, message: result.message });
  };

  /** DELETE /integrations/teams/:projectId/disconnect */
  disconnect = async (req: Request, res: Response): Promise<void> => {
    await teamsService.deleteConfig(req.params.projectId);
    res.json({ success: true, message: 'Microsoft Teams disconnected' });
  };

  /** POST /integrations/teams/validate-url (public, no project required) */
  validateUrl = async (req: Request, res: Response): Promise<void> => {
    const { webhookUrl } = req.body;
    if (!webhookUrl || typeof webhookUrl !== 'string') throw ApiError.badRequest('webhookUrl is required');

    const result = await teamsService.validateWebhookUrl(webhookUrl);
    res.json({ success: result.success, message: result.message });
  };
}

export const teamsController = new TeamsController();
