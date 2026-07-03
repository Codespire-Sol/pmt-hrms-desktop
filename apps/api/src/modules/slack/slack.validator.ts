import { z } from 'zod';
import { ALL_SLACK_EVENTS } from './slack.types';

export const installSlackSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    redirectUri: z.string().url(),
  }),
  params: z.object({
    projectId: z.string().uuid(),
  }),
});

export const getOAuthUrlSchema = z.object({
  params: z.object({
    projectId: z.string().uuid(),
  }),
  query: z.object({
    redirectUri: z.string().url(),
  }),
});

export const configureChannelSchema = z.object({
  body: z.object({
    channelId: z.string().min(1),
    channelName: z.string().min(1),
    events: z.array(z.enum(ALL_SLACK_EVENTS as [string, ...string[]])).min(1),
  }),
  params: z.object({
    projectId: z.string().uuid(),
  }),
});

export const updateChannelConfigSchema = z.object({
  body: z.object({
    events: z.array(z.enum(ALL_SLACK_EVENTS as [string, ...string[]])).min(1),
  }),
  params: z.object({
    projectId: z.string().uuid(),
    channelConfigId: z.string().uuid(),
  }),
});

export const removeChannelSchema = z.object({
  params: z.object({
    projectId: z.string().uuid(),
    channelConfigId: z.string().uuid(),
  }),
});

export const linkUserSchema = z.object({
  body: z.object({
    slackUserId: z.string().min(1),
    slackUsername: z.string().min(1),
  }),
  params: z.object({
    projectId: z.string().uuid(),
  }),
});

export const sendTestNotificationSchema = z.object({
  body: z.object({
    channelId: z.string().min(1),
    event: z.enum(ALL_SLACK_EVENTS as [string, ...string[]]),
  }),
  params: z.object({
    projectId: z.string().uuid(),
  }),
});
