import axios from 'axios';
import {
  SlackWorkspace,
  SlackChannelConfig,
  SlackUserMapping,
  SlackOAuthResponse,
  SlackCommand,
  SlackCommandResponse,
  SlackBlock,
  SlackEventType,
  SlackIntegrationStatus,
  InstallSlackInput,
  ConfigureChannelInput,
  UpdateChannelConfigInput,
  LinkSlackUserInput,
  SendNotificationInput,
  SlackInteractivePayload,
  DEFAULT_SLACK_EVENTS,
} from './slack.types';
import { slackRepository } from './slack.repository';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

class SlackService {
  // OAuth Methods
  getOAuthUrl(projectId: string, redirectUri: string): string {
    const state = Buffer.from(JSON.stringify({ projectId })).toString('base64');
    const scopes = [
      'chat:write',
      'commands',
      'channels:read',
      'groups:read',
      'users:read',
      'team:read',
    ].join(',');

    return `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  }

  async completeOAuth(input: InstallSlackInput): Promise<SlackWorkspace> {
    // Exchange code for token
    const tokenResponse = await axios.post<SlackOAuthResponse>(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code: input.code,
        redirect_uri: input.redirectUri,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    if (!tokenResponse.data.ok) {
      throw new Error('Failed to complete Slack OAuth');
    }

    const data = tokenResponse.data;

    // Check if workspace already exists for this project
    const existing = await slackRepository.findWorkspaceByProjectId(input.projectId);
    if (existing) {
      // Update existing workspace
      const updated = await slackRepository.updateWorkspace(existing.id, {
        accessToken: data.access_token,
        botUserId: data.bot_user_id,
        teamName: data.team.name,
      });
      return updated!;
    }

    // Create new workspace
    const workspace = await slackRepository.createWorkspace({
      projectId: input.projectId,
      teamId: data.team.id,
      teamName: data.team.name,
      accessToken: data.access_token,
      botUserId: data.bot_user_id,
      defaultChannelId: data.incoming_webhook?.channel_id || null,
      installedBy: data.authed_user.id,
    });

    // Set up default channel if webhook was configured
    if (data.incoming_webhook) {
      await slackRepository.createChannelConfig({
        workspaceId: workspace.id,
        channelId: data.incoming_webhook.channel_id,
        channelName: data.incoming_webhook.channel,
        events: DEFAULT_SLACK_EVENTS,
      });
    }

    return workspace;
  }

  async disconnectWorkspace(projectId: string): Promise<boolean> {
    const workspace = await slackRepository.findWorkspaceByProjectId(projectId);
    if (!workspace) return false;

    // Revoke token
    try {
      await axios.post(
        'https://slack.com/api/auth.revoke',
        new URLSearchParams({ token: workspace.accessToken }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
    } catch {
      // Continue even if revocation fails
    }

    return slackRepository.deleteWorkspace(workspace.id);
  }

  // Integration Status
  async getIntegrationStatus(projectId: string): Promise<SlackIntegrationStatus> {
    const workspace = await slackRepository.findWorkspaceByProjectId(projectId);

    if (!workspace) {
      return {
        connected: false,
        workspace: null,
        channels: [],
      };
    }

    const channels = await slackRepository.findChannelConfigsByWorkspaceId(workspace.id);

    return {
      connected: true,
      workspace: {
        teamId: workspace.teamId,
        teamName: workspace.teamName,
        installedAt: workspace.installedAt,
      },
      channels: channels.map((c) => ({
        channelId: c.channelId,
        channelName: c.channelName,
        events: c.events,
      })),
    };
  }

  // Channel Configuration
  async configureChannel(input: ConfigureChannelInput): Promise<SlackChannelConfig> {
    const existing = await slackRepository.findChannelConfigByChannelId(
      input.workspaceId,
      input.channelId
    );

    if (existing) {
      const updated = await slackRepository.updateChannelConfig(existing.id, {
        events: input.events,
      });
      return updated!;
    }

    return slackRepository.createChannelConfig({
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      channelName: input.channelName,
      events: input.events,
    });
  }

  async updateChannelConfig(
    channelConfigId: string,
    input: UpdateChannelConfigInput
  ): Promise<SlackChannelConfig | null> {
    return slackRepository.updateChannelConfig(channelConfigId, input);
  }

  async removeChannel(channelConfigId: string): Promise<boolean> {
    return slackRepository.deleteChannelConfig(channelConfigId);
  }

  async getChannelConfigs(projectId: string): Promise<SlackChannelConfig[]> {
    const workspace = await slackRepository.findWorkspaceByProjectId(projectId);
    if (!workspace) return [];
    return slackRepository.findChannelConfigsByWorkspaceId(workspace.id);
  }

  // User Mapping
  async linkSlackUser(userId: string, input: LinkSlackUserInput): Promise<SlackUserMapping> {
    const existing = await slackRepository.findUserMappingByUserId(userId, input.workspaceId);
    if (existing) {
      await slackRepository.deleteUserMapping(existing.id);
    }

    return slackRepository.createUserMapping({
      userId,
      slackUserId: input.slackUserId,
      slackUsername: input.slackUsername,
      workspaceId: input.workspaceId,
    });
  }

  async unlinkSlackUser(userId: string, workspaceId: string): Promise<boolean> {
    return slackRepository.deleteUserMappingByUserId(userId, workspaceId);
  }

  async getSlackUserMapping(
    userId: string,
    projectId: string
  ): Promise<SlackUserMapping | null> {
    const workspace = await slackRepository.findWorkspaceByProjectId(projectId);
    if (!workspace) return null;
    return slackRepository.findUserMappingByUserId(userId, workspace.id);
  }

  // Slash Commands
  async handleSlashCommand(command: SlackCommand): Promise<SlackCommandResponse> {
    const workspace = await slackRepository.findWorkspaceByTeamId(command.team_id);
    if (!workspace) {
      return {
        response_type: 'ephemeral',
        text: 'This workspace is not connected to ProjectFlow. Please set up the integration first.',
      };
    }

    switch (command.command) {
      case '/pf-create':
        return this.handleCreateCommand(command, workspace);
      case '/pf-search':
        return this.handleSearchCommand(command, workspace);
      case '/pf-my-issues':
        return this.handleMyIssuesCommand(command, workspace);
      case '/pf-help':
        return this.handleHelpCommand();
      default:
        return {
          response_type: 'ephemeral',
          text: `Unknown command: ${command.command}. Use /pf-help for available commands.`,
        };
    }
  }

  private async handleCreateCommand(
    command: SlackCommand,
    workspace: SlackWorkspace
  ): Promise<SlackCommandResponse> {
    if (!command.text.trim()) {
      return {
        response_type: 'ephemeral',
        text: 'Please provide an issue title. Usage: `/pf-create [title] - [optional description]`',
      };
    }

    const parts = command.text.split(' - ');
    const title = parts[0].trim();
    const description = parts.slice(1).join(' - ').trim();

    // Return a modal trigger or confirmation
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Create Issue Preview*',
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Title:*\n${title}` },
            { type: 'mrkdwn', text: `*Description:*\n${description || '_No description_'}` },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Create Issue', emoji: true },
              style: 'primary',
              action_id: 'create_issue_confirm',
              value: JSON.stringify({ title, description, projectId: workspace.projectId }),
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Cancel', emoji: true },
              action_id: 'create_issue_cancel',
            },
          ],
        },
      ],
    };
  }

  private async handleSearchCommand(
    command: SlackCommand,
    workspace: SlackWorkspace
  ): Promise<SlackCommandResponse> {
    if (!command.text.trim()) {
      return {
        response_type: 'ephemeral',
        text: 'Please provide a search query. Usage: `/pf-search [query]`',
      };
    }

    // In a real implementation, this would search issues
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Search Results for "${command.text}"*`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<${APP_URL}/projects/${workspace.projectId}/search?q=${encodeURIComponent(command.text)}|View full results in ProjectFlow>`,
          },
        },
      ],
    };
  }

  private async handleMyIssuesCommand(
    command: SlackCommand,
    workspace: SlackWorkspace
  ): Promise<SlackCommandResponse> {
    const userMapping = await slackRepository.findUserMappingBySlackUserId(
      command.user_id,
      workspace.id
    );

    if (!userMapping) {
      return {
        response_type: 'ephemeral',
        text: `Your Slack account is not linked to ProjectFlow. <${APP_URL}/settings/integrations|Link your account>`,
      };
    }

    // In a real implementation, this would fetch user's issues
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Your Assigned Issues*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<${APP_URL}/my-work|View all your issues in ProjectFlow>`,
          },
        },
      ],
    };
  }

  private handleHelpCommand(): SlackCommandResponse {
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'ProjectFlow Commands',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Available Commands:*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '`/pf-create [title] - [description]` - Create a new issue',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '`/pf-search [query]` - Search for issues',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '`/pf-my-issues` - View your assigned issues',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '`/pf-help` - Show this help message',
          },
        },
      ],
    };
  }

  // Interactive Actions
  async handleInteraction(payload: SlackInteractivePayload): Promise<SlackCommandResponse> {
    if (!payload.actions || payload.actions.length === 0) {
      return { text: 'No action specified' };
    }

    const action = payload.actions[0];

    switch (action.action_id) {
      case 'create_issue_confirm':
        return this.handleCreateIssueConfirm(payload, action.value);
      case 'create_issue_cancel':
        return { text: 'Issue creation cancelled.', response_type: 'ephemeral' };
      case 'view_issue':
        return { text: 'Opening issue...' };
      default:
        return { text: 'Unknown action' };
    }
  }

  private async handleCreateIssueConfirm(
    payload: SlackInteractivePayload,
    value?: string
  ): Promise<SlackCommandResponse> {
    if (!value) {
      return { text: 'Invalid action data', response_type: 'ephemeral' };
    }

    const data = JSON.parse(value);
    // In a real implementation, this would create the issue via the issues service

    return {
      response_type: 'in_channel',
      blocks: this.buildIssueCreatedBlocks({
        issueKey: 'PROJ-123',
        title: data.title,
        description: data.description,
        url: `${APP_URL}/issues/new-issue-id`,
      }),
    };
  }

  // Notification Methods
  async sendNotification(input: SendNotificationInput): Promise<boolean> {
    const workspace = await slackRepository.findWorkspaceByProjectId(input.projectId);
    if (!workspace) return false;

    const channels = await slackRepository.findChannelsForEvent(workspace.id, input.event);
    if (channels.length === 0) return false;

    const blocks = this.buildNotificationBlocks(input);

    for (const channel of channels) {
      try {
        await this.postMessage(workspace.accessToken, channel.channelId, blocks);
      } catch (error) {
        console.error(`Failed to send notification to channel ${channel.channelId}:`, error);
      }
    }

    return true;
  }

  private async postMessage(
    token: string,
    channel: string,
    blocks: SlackBlock[]
  ): Promise<void> {
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  private buildNotificationBlocks(input: SendNotificationInput): SlackBlock[] {
    const eventLabels: Record<SlackEventType, string> = {
      issue_created: 'Issue Created',
      issue_updated: 'Issue Updated',
      issue_assigned: 'Issue Assigned',
      issue_status_changed: 'Status Changed',
      issue_commented: 'New Comment',
      sprint_started: 'Sprint Started',
      sprint_completed: 'Sprint Completed',
      mention: 'You were mentioned',
    };

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${eventLabels[input.event]}*`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `From ProjectFlow`,
          },
        ],
      },
    ];
  }

  private buildIssueCreatedBlocks(issue: {
    issueKey: string;
    title: string;
    description?: string;
    url: string;
  }): SlackBlock[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Issue Created:* <${issue.url}|${issue.issueKey}> ${issue.title}`,
        },
      },
      ...(issue.description
        ? [
            {
              type: 'section' as const,
              text: {
                type: 'mrkdwn' as const,
                text: issue.description.substring(0, 200) + (issue.description.length > 200 ? '...' : ''),
              },
            },
          ]
        : []),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Issue', emoji: true },
            url: issue.url,
            action_id: 'view_issue',
          },
        ],
      },
    ];
  }

  // Build rich message blocks for issues
  buildIssueBlocks(
    issue: {
      id: string;
      issueKey: string;
      title: string;
      status: { displayName: string };
      priority?: { displayName: string };
      assignee?: { displayName: string };
    },
    event: string
  ): SlackBlock[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${event}*: <${APP_URL}/issues/${issue.id}|${issue.issueKey}> ${issue.title}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Status:* ${issue.status.displayName}` },
          { type: 'mrkdwn', text: `*Priority:* ${issue.priority?.displayName || 'None'}` },
          { type: 'mrkdwn', text: `*Assignee:* ${issue.assignee?.displayName || 'Unassigned'}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Issue', emoji: true },
            url: `${APP_URL}/issues/${issue.id}`,
            action_id: 'view_issue',
          },
        ],
      },
    ];
  }

  // List available Slack channels
  async listChannels(projectId: string): Promise<Array<{ id: string; name: string }>> {
    const workspace = await slackRepository.findWorkspaceByProjectId(projectId);
    if (!workspace) return [];

    try {
      const response = await axios.get('https://slack.com/api/conversations.list', {
        headers: { Authorization: `Bearer ${workspace.accessToken}` },
        params: {
          types: 'public_channel,private_channel',
          exclude_archived: true,
          limit: 200,
        },
      });

      if (!response.data.ok) return [];

      return response.data.channels.map((ch: { id: string; name: string }) => ({
        id: ch.id,
        name: ch.name,
      }));
    } catch {
      return [];
    }
  }

  // Verify Slack request signature
  verifySignature(signature: string, timestamp: string, body: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    const baseString = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET);
    const computedSignature = `v0=${hmac.update(baseString).digest('hex')}`;
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  }
}

export const slackService = new SlackService();
