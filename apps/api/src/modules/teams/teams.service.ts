import { prisma } from '../../database/prisma';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/ApiError';
import { WebhookEventType, WebhookEventPayload } from '../webhooks/webhooks.types';
import { UpsertTeamsConfigInput, TeamsConfig, TeamsConfigStatus } from './teams.types';
import { buildAdaptiveCard, buildTestCard } from './teams.cards';

// ── Settings key helpers ───────────────────────────────────────────────────────
function configKey(projectId: string) {
  return `teams_config_${projectId}`;
}

/**
 * TeamsService manages per-project Teams integration configurations and
 * delivers Adaptive Card notifications to Microsoft Teams incoming webhook URLs.
 */
export class TeamsService {
  // ── Config CRUD ─────────────────────────────────────────────────────────────

  async getConfig(projectId: string): Promise<TeamsConfig | null> {
    const row = await prisma.systemSetting.findUnique({
      where: { settingKey: configKey(projectId) },
    });

    if (!row) return null;

    return row.settingValue as unknown as TeamsConfig;
  }

  async getStatus(projectId: string): Promise<TeamsConfigStatus> {
    const config = await this.getConfig(projectId);
    return {
      connected: config !== null,
      config,
    };
  }

  async upsertConfig(projectId: string, input: UpsertTeamsConfigInput): Promise<TeamsConfig> {
    // Validate webhook URL
    try {
      const parsed = new URL(input.webhookUrl);
      // Microsoft Teams incoming webhook URLs
      const validHosts = ['outlook.office.com', 'outlook.office365.com', 'prod-*.logic.azure.com'];
      const isValid = validHosts.some(h =>
        h.includes('*')
          ? parsed.hostname.startsWith(h.replace('*.', ''))
          : parsed.hostname === h
      );
      if (!isValid && !input.webhookUrl.includes('outlook.office') && !input.webhookUrl.includes('webhook.office')) {
        // Allow any URL in dev — just warn
        logger.warn(`Teams webhook URL may not be a valid Teams incoming webhook: ${parsed.hostname}`);
      }
    } catch {
      throw ApiError.badRequest('Invalid Teams webhook URL');
    }

    const existing = await this.getConfig(projectId);

    const now = new Date().toISOString();
    const config: TeamsConfig = {
      projectId,
      webhookUrl: input.webhookUrl,
      isEnabled: input.isEnabled ?? existing?.isEnabled ?? true,
      events: input.events ?? existing?.events ?? this.defaultEvents(),
      notifyOnMention: input.notifyOnMention ?? existing?.notifyOnMention ?? true,
      includeIssueDetails: input.includeIssueDetails ?? existing?.includeIssueDetails ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await prisma.systemSetting.upsert({
      where: { settingKey: configKey(projectId) },
      create: { settingKey: configKey(projectId), settingValue: config as any },
      update: { settingValue: config as any },
    });

    return config;
  }

  async deleteConfig(projectId: string): Promise<void> {
    await prisma.systemSetting.deleteMany({
      where: { settingKey: configKey(projectId) },
    });
  }

  async toggleConfig(projectId: string, isEnabled: boolean): Promise<TeamsConfig> {
    const existing = await this.getConfig(projectId);
    if (!existing) throw ApiError.notFound('Teams integration not configured for this project');

    return this.upsertConfig(projectId, { ...existing, isEnabled });
  }

  // ── Delivery ─────────────────────────────────────────────────────────────────

  /**
   * Send a test Adaptive Card to validate the webhook URL.
   */
  async sendTestNotification(projectId: string): Promise<{ success: boolean; message: string }> {
    const config = await this.getConfig(projectId);
    if (!config) throw ApiError.notFound('Teams integration not configured for this project');

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    const payload = buildTestCard(project?.name);
    return this.postToTeams(config.webhookUrl, payload);
  }

  /**
   * Validate a webhook URL by sending a test card (used during initial connect).
   */
  async validateWebhookUrl(webhookUrl: string): Promise<{ success: boolean; message: string }> {
    const payload = buildTestCard();
    return this.postToTeams(webhookUrl, payload);
  }

  /**
   * Deliver a webhook event as an Adaptive Card to the configured Teams channel.
   * Called from the webhook delivery pipeline when a webhook is named
   * "Microsoft Teams Channel".
   */
  async deliverEvent(
    projectId: string,
    eventPayload: WebhookEventPayload
  ): Promise<void> {
    const config = await this.getConfig(projectId);
    if (!config || !config.isEnabled) return;

    // Check if the event is subscribed
    if (!config.events.includes(eventPayload.event as WebhookEventType)) return;

    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const card = buildAdaptiveCard(eventPayload, config.includeIssueDetails, frontendBaseUrl);

    const result = await this.postToTeams(config.webhookUrl, card);

    if (!result.success) {
      logger.warn(`Teams delivery failed for project ${projectId}: ${result.message}`);
    }
  }

  // ── HTTP ──────────────────────────────────────────────────────────────────────

  private async postToTeams(
    webhookUrl: string,
    payload: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const body = await response.text().catch(() => '');

      if (response.ok || body === '1') {
        // Teams returns "1" for successful delivery
        return { success: true, message: 'Message delivered successfully' };
      }

      return {
        success: false,
        message: `Teams returned HTTP ${response.status}: ${body.substring(0, 200)}`,
      };
    } catch (error: any) {
      const message = error?.name === 'AbortError'
        ? 'Request timed out (15s)'
        : error?.message || 'Network error';

      return { success: false, message };
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private defaultEvents(): WebhookEventType[] {
    return [
      'issue.created',
      'issue.transitioned',
      'issue.assigned',
      'issue.commented',
      'sprint.started',
      'sprint.completed',
    ];
  }
}

export const teamsService = new TeamsService();
