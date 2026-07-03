import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAnyPermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';
import {
  getNotificationsQuerySchema,
  hrmsBroadcastSchema,
  markAsReadSchema,
  updatePreferenceSchema,
  updatePreferencesSchema,
} from './notifications.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get current user's notifications
router.get('/', notificationsController.getMyNotifications);

// Get unread count
router.get('/unread-count', notificationsController.getUnreadCount);

// Get notification types (for reference)
router.get('/types', notificationsController.getNotificationTypes);

// Mark specific notifications as read
router.post(
  '/mark-read',
  validate(markAsReadSchema),
  notificationsController.markAsRead
);

// Mark all notifications as read
router.post('/mark-all-read', notificationsController.markAllAsRead);

// Get user preferences
router.get('/preferences', notificationsController.getPreferences);

// Update multiple preferences
router.put(
  '/preferences',
  validate(updatePreferencesSchema),
  notificationsController.updatePreferences
);

// Update a single preference
router.put(
  '/preferences/:type',
  validate(updatePreferenceSchema),
  notificationsController.updatePreference
);

// Push notification routes
router.get('/push/vapid-key', notificationsController.getVapidPublicKey);
router.get('/push/subscriptions', notificationsController.getPushSubscriptions);
router.post('/push/subscribe', notificationsController.subscribePush);
router.delete('/push/unsubscribe', notificationsController.unsubscribePush);
router.delete('/push/unsubscribe-all', notificationsController.unsubscribeAllPush);
router.post('/push/test', notificationsController.sendTestPush);

// HRMS-focused notification feed and admin/HR broadcast
router.get('/hrms', validate(getNotificationsQuerySchema), notificationsController.getHrmsNotifications);
router.get('/hrms/unread-count', notificationsController.getHrmsUnreadCount);
router.post(
  '/hrms/broadcast',
  requireAnyPermission(['admin.settings', 'employees.update']),
  validate(hrmsBroadcastSchema),
  notificationsController.broadcastHrmsNotification
);

export default router;
