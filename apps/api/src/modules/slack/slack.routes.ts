import { Router } from 'express';
import { slackController } from './slack.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import {
  installSlackSchema,
  getOAuthUrlSchema,
  configureChannelSchema,
  updateChannelConfigSchema,
  removeChannelSchema,
  linkUserSchema,
  sendTestNotificationSchema,
} from './slack.validator';

const router = Router();

// Slack webhook endpoints (no auth - verified via Slack signature)
router.post('/webhooks/command', slackController.handleSlashCommand.bind(slackController));
router.post('/webhooks/interaction', slackController.handleInteraction.bind(slackController));

// All other routes require authentication
router.use(authenticate);

// OAuth / Installation
router.get(
  '/:projectId/oauth-url',
  validate(getOAuthUrlSchema),
  slackController.getOAuthUrl.bind(slackController)
);

router.post(
  '/:projectId/install',
  validate(installSlackSchema),
  slackController.installSlack.bind(slackController)
);

router.delete(
  '/:projectId/disconnect',
  slackController.disconnectSlack.bind(slackController)
);

// Integration Status
router.get(
  '/:projectId/status',
  slackController.getIntegrationStatus.bind(slackController)
);

// Channel Management
router.get(
  '/:projectId/channels',
  slackController.listChannels.bind(slackController)
);

router.get(
  '/:projectId/channel-configs',
  slackController.getChannelConfigs.bind(slackController)
);

router.post(
  '/:projectId/channel-configs',
  validate(configureChannelSchema),
  slackController.configureChannel.bind(slackController)
);

router.put(
  '/:projectId/channel-configs/:channelConfigId',
  validate(updateChannelConfigSchema),
  slackController.updateChannelConfig.bind(slackController)
);

router.delete(
  '/:projectId/channel-configs/:channelConfigId',
  validate(removeChannelSchema),
  slackController.removeChannel.bind(slackController)
);

// User Mapping
router.get(
  '/:projectId/user-mapping',
  slackController.getUserMapping.bind(slackController)
);

router.post(
  '/:projectId/user-mapping',
  validate(linkUserSchema),
  slackController.linkSlackUser.bind(slackController)
);

router.delete(
  '/:projectId/user-mapping',
  slackController.unlinkSlackUser.bind(slackController)
);

// Test Notification
router.post(
  '/:projectId/test-notification',
  validate(sendTestNotificationSchema),
  slackController.sendTestNotification.bind(slackController)
);

export default router;
