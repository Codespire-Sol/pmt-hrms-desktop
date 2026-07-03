import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import {
  SlackWorkspace,
  SlackChannelConfig,
  SlackUserMapping,
  SlackEventType,
} from './slack.types';

class SlackRepository {
  // Workspace Methods
  async createWorkspace(data: Omit<SlackWorkspace, 'id' | 'installedAt' | 'updatedAt'>): Promise<SlackWorkspace> {
    const workspace = await prisma.slackWorkspace.create({
      data: {
        projectId: data.projectId,
        teamId: data.teamId,
        teamName: data.teamName,
        accessToken: data.accessToken,
        botUserId: data.botUserId,
        defaultChannelId: data.defaultChannelId || null,
        installedBy: data.installedBy,
      },
    });

    return workspace as unknown as SlackWorkspace;
  }

  async findWorkspaceById(id: string): Promise<SlackWorkspace | null> {
    const workspace = await prisma.slackWorkspace.findUnique({ where: { id } });
    return workspace as unknown as SlackWorkspace | null;
  }

  async findWorkspaceByProjectId(projectId: string): Promise<SlackWorkspace | null> {
    const workspace = await prisma.slackWorkspace.findFirst({
      where: { projectId },
    });
    return workspace as unknown as SlackWorkspace | null;
  }

  async findWorkspaceByTeamId(teamId: string): Promise<SlackWorkspace | null> {
    const workspace = await prisma.slackWorkspace.findFirst({
      where: { teamId },
    });
    return workspace as unknown as SlackWorkspace | null;
  }

  async updateWorkspace(id: string, data: Partial<SlackWorkspace>): Promise<SlackWorkspace | null> {
    const updateData: Prisma.SlackWorkspaceUpdateInput = {};

    if (data.teamName !== undefined) updateData.teamName = data.teamName;
    if (data.accessToken !== undefined) updateData.accessToken = data.accessToken;
    if (data.botUserId !== undefined) updateData.botUserId = data.botUserId;
    if (data.defaultChannelId !== undefined) updateData.defaultChannelId = data.defaultChannelId;

    const workspace = await prisma.slackWorkspace.update({
      where: { id },
      data: updateData,
    });

    return workspace as unknown as SlackWorkspace | null;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    try {
      // Channel configs and user mappings are deleted by CASCADE
      await prisma.slackWorkspace.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // Channel Config Methods
  async createChannelConfig(
    data: Omit<SlackChannelConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SlackChannelConfig> {
    const config = await prisma.slackChannelConfig.create({
      data: {
        workspaceId: data.workspaceId,
        channelId: data.channelId,
        channelName: data.channelName,
        events: data.events as Prisma.InputJsonValue,
      },
    });

    return {
      ...config,
      events: config.events as unknown as SlackEventType[],
    } as unknown as SlackChannelConfig;
  }

  async findChannelConfigById(id: string): Promise<SlackChannelConfig | null> {
    const config = await prisma.slackChannelConfig.findUnique({ where: { id } });
    if (!config) return null;

    return {
      ...config,
      events: config.events as unknown as SlackEventType[],
    } as unknown as SlackChannelConfig;
  }

  async findChannelConfigsByWorkspaceId(workspaceId: string): Promise<SlackChannelConfig[]> {
    const configs = await prisma.slackChannelConfig.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    return configs.map((config) => ({
      ...config,
      events: config.events as unknown as SlackEventType[],
    })) as unknown as SlackChannelConfig[];
  }

  async findChannelConfigByChannelId(
    workspaceId: string,
    channelId: string
  ): Promise<SlackChannelConfig | null> {
    const config = await prisma.slackChannelConfig.findFirst({
      where: { workspaceId, channelId },
    });

    if (!config) return null;

    return {
      ...config,
      events: config.events as unknown as SlackEventType[],
    } as unknown as SlackChannelConfig;
  }

  async updateChannelConfig(
    id: string,
    data: Partial<SlackChannelConfig>
  ): Promise<SlackChannelConfig | null> {
    const updateData: Prisma.SlackChannelConfigUpdateInput = {};

    if (data.channelName !== undefined) updateData.channelName = data.channelName;
    if (data.events !== undefined) updateData.events = data.events as Prisma.InputJsonValue;

    const config = await prisma.slackChannelConfig.update({
      where: { id },
      data: updateData,
    });

    if (!config) return null;

    return {
      ...config,
      events: config.events as unknown as SlackEventType[],
    } as unknown as SlackChannelConfig;
  }

  async deleteChannelConfig(id: string): Promise<boolean> {
    try {
      await prisma.slackChannelConfig.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async findChannelsForEvent(
    workspaceId: string,
    event: SlackEventType
  ): Promise<SlackChannelConfig[]> {
    const configs = await prisma.$queryRaw<any[]>`
      SELECT * FROM slack_channel_configs
      WHERE workspace_id = ${workspaceId}
        AND events::jsonb @> ${JSON.stringify([event])}::jsonb
    `;

    return configs.map((config) => ({
      id: config.id,
      workspaceId: config.workspace_id,
      channelId: config.channel_id,
      channelName: config.channel_name,
      events: typeof config.events === 'string' ? JSON.parse(config.events) : config.events,
      createdAt: config.created_at,
      updatedAt: config.updated_at,
    })) as SlackChannelConfig[];
  }

  // User Mapping Methods
  async createUserMapping(
    data: Omit<SlackUserMapping, 'id' | 'createdAt'>
  ): Promise<SlackUserMapping> {
    const mapping = await prisma.slackUserMapping.create({
      data: {
        userId: data.userId,
        slackUserId: data.slackUserId,
        slackUsername: data.slackUsername,
        workspaceId: data.workspaceId,
      },
    });

    return mapping as unknown as SlackUserMapping;
  }

  async findUserMappingByUserId(
    userId: string,
    workspaceId: string
  ): Promise<SlackUserMapping | null> {
    const mapping = await prisma.slackUserMapping.findFirst({
      where: { userId, workspaceId },
    });

    return mapping as unknown as SlackUserMapping | null;
  }

  async findUserMappingBySlackUserId(
    slackUserId: string,
    workspaceId: string
  ): Promise<SlackUserMapping | null> {
    const mapping = await prisma.slackUserMapping.findFirst({
      where: { slackUserId, workspaceId },
    });

    return mapping as unknown as SlackUserMapping | null;
  }

  async findUserMappingsByWorkspaceId(workspaceId: string): Promise<SlackUserMapping[]> {
    const mappings = await prisma.slackUserMapping.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    return mappings as unknown as SlackUserMapping[];
  }

  async deleteUserMapping(id: string): Promise<boolean> {
    try {
      await prisma.slackUserMapping.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteUserMappingByUserId(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await prisma.slackUserMapping.deleteMany({
        where: { userId, workspaceId },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const slackRepository = new SlackRepository();
