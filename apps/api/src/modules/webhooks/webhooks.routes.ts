import { Router } from 'express';
import { WebhooksController } from './webhooks.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireProjectMember } from '../../middleware/rbac.middleware';

const router = Router();
const controller = new WebhooksController();

// All routes require authentication
router.use(authenticate);

// Reference data endpoints
router.get('/events', controller.getAvailableEvents);

// Project-specific routes
router.post(
  '/projects/:projectId/webhooks',
  requireProjectMember('projectId'),
  controller.createWebhook
);

router.get(
  '/projects/:projectId/webhooks',
  requireProjectMember('projectId'),
  controller.getWebhooks
);

// Webhook-specific routes
router.get('/webhooks/:webhookId', controller.getWebhook);
router.patch('/webhooks/:webhookId', controller.updateWebhook);
router.delete('/webhooks/:webhookId', controller.deleteWebhook);
router.post('/webhooks/:webhookId/toggle', controller.toggleWebhook);
router.post('/webhooks/:webhookId/test', controller.testWebhook);
router.get('/webhooks/:webhookId/deliveries', controller.getDeliveries);

// Delivery routes
router.post('/deliveries/:deliveryId/retry', controller.retryDelivery);

export default router;
