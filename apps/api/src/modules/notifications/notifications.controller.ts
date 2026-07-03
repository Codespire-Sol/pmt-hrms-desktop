import { Request, Response } from 'express';
import { notificationsService } from './notifications.service';
import { NOTIFICATION_TYPE_LABELS, ALL_NOTIFICATION_TYPES } from './notifications.types';
import { prisma } from '../../database/prisma';

export const notificationsController = {
  // GET /api/v1/notifications
  async getMyNotifications(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const {
        unreadOnly = 'false',
        limit = '20',
        offset = '0',
        type,
        module = 'all',
      } = req.query as Record<string, string>;

      const result = await notificationsService.getByUserId(userId, {
        unreadOnly: unreadOnly === 'true',
        limit: Math.min(parseInt(limit, 10) || 20, 100),
        offset: parseInt(offset, 10) || 0,
        type,
        module: module as 'hrms' | 'toolkit' | 'all',
      });

      res.json({
        success: true,
        data: {
          notifications: result.notifications,
          pagination: {
            total: result.total,
            limit: parseInt(limit, 10) || 20,
            offset: parseInt(offset, 10) || 0,
            hasMore: (parseInt(offset, 10) || 0) + result.notifications.length < result.total,
          },
        },
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get notifications',
        },
      });
    }
  },

  // GET /api/v1/notifications/hrms
  async getHrmsNotifications(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { unreadOnly = 'false', limit = '20', offset = '0', type } = req.query as Record<
        string,
        string
      >;
      const result = await notificationsService.getByUserId(userId, {
        unreadOnly: unreadOnly === 'true',
        limit: Math.min(parseInt(limit, 10) || 20, 100),
        offset: parseInt(offset, 10) || 0,
        type,
        module: 'hrms',
      });
      res.json({
        success: true,
        data: {
          notifications: result.notifications,
          pagination: {
            total: result.total,
            limit: parseInt(limit, 10) || 20,
            offset: parseInt(offset, 10) || 0,
            hasMore: (parseInt(offset, 10) || 0) + result.notifications.length < result.total,
          },
        },
      });
    } catch (error) {
      console.error('Error getting HRMS notifications:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get HRMS notifications',
        },
      });
    }
  },

  // GET /api/v1/notifications/hrms/unread-count
  async getHrmsUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await notificationsService.getByUserId(userId, {
        unreadOnly: true,
        limit: 1,
        offset: 0,
        module: 'hrms',
      });
      res.json({
        success: true,
        data: { count: result.total },
      });
    } catch (error) {
      console.error('Error getting HRMS unread count:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get HRMS unread count',
        },
      });
    }
  },

  // POST /api/v1/notifications/hrms/broadcast
  async broadcastHrmsNotification(req: Request, res: Response) {
    try {
      const actorId = req.user!.id;
      const {
        title,
        message,
        type = 'hrms_announcement',
        recipientUserIds = [],
        recipientRoleNames = [],
        metadata = {},
      } = req.body;

      let resolvedRecipientIds = [...recipientUserIds];
      if (recipientRoleNames.length > 0) {
        const users = await prisma.user.findMany({
          where: {
            role: {
              name: { in: recipientRoleNames },
            },
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });
        resolvedRecipientIds.push(...users.map((u) => u.id));
      }

      resolvedRecipientIds = Array.from(new Set(resolvedRecipientIds));
      const notifications = await notificationsService.hrmsBroadcast({
        actorId,
        title,
        message,
        type,
        recipientUserIds: resolvedRecipientIds,
        metadata,
      });

      res.status(201).json({
        success: true,
        data: {
          createdCount: notifications.length,
          recipientCount: resolvedRecipientIds.length,
        },
      });
    } catch (error) {
      console.error('Error broadcasting HRMS notification:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to broadcast HRMS notification',
        },
      });
    }
  },

  // GET /api/v1/notifications/unread-count
  async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { module = 'all' } = req.query as Record<string, string>;

      // If module filter is specified, use getByUserId with unreadOnly to get filtered count
      if (module && module !== 'all') {
        const result = await notificationsService.getByUserId(userId, {
          unreadOnly: true,
          limit: 1,
          offset: 0,
          module: module as 'hrms' | 'toolkit' | 'all',
        });
        return res.json({
          success: true,
          data: { count: result.total },
        });
      }

      const count = await notificationsService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get unread count',
        },
      });
    }
  },

  // POST /api/v1/notifications/mark-read
  async markAsRead(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { notificationIds } = req.body;

      const count = await notificationsService.markAsRead(notificationIds, userId);

      res.json({
        success: true,
        data: { markedCount: count },
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to mark notifications as read',
        },
      });
    }
  },

  // POST /api/v1/notifications/mark-all-read
  async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const module = (req.body?.module || req.query?.module) as 'hrms' | 'toolkit' | undefined;
      const count = await notificationsService.markAllAsRead(userId, module);

      res.json({
        success: true,
        data: { markedCount: count },
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to mark all notifications as read',
        },
      });
    }
  },

  // GET /api/v1/notifications/preferences
  async getPreferences(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const preferences = await notificationsService.getPreferences(userId);

      // Enrich with labels
      const enrichedPreferences = preferences.map((pref) => ({
        ...pref,
        label: NOTIFICATION_TYPE_LABELS[pref.notificationType]?.title || pref.notificationType,
        description:
          NOTIFICATION_TYPE_LABELS[pref.notificationType]?.description || '',
      }));

      res.json({
        success: true,
        data: { preferences: enrichedPreferences },
      });
    } catch (error) {
      console.error('Error getting preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get notification preferences',
        },
      });
    }
  },

  // PUT /api/v1/notifications/preferences/:type
  async updatePreference(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { type } = req.params;
      const { inAppEnabled, emailEnabled } = req.body;

      // Validate notification type
      if (!ALL_NOTIFICATION_TYPES.includes(type as any)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TYPE',
            message: 'Invalid notification type',
          },
        });
      }

      const preference = await notificationsService.updatePreference(userId, {
        notificationType: type as any,
        inAppEnabled,
        emailEnabled,
      });

      res.json({
        success: true,
        data: {
          preference: {
            ...preference,
            label: NOTIFICATION_TYPE_LABELS[preference.notificationType]?.title || preference.notificationType,
            description:
              NOTIFICATION_TYPE_LABELS[preference.notificationType]?.description || '',
          },
        },
      });
    } catch (error) {
      console.error('Error updating preference:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update notification preference',
        },
      });
    }
  },

  // PUT /api/v1/notifications/preferences
  async updatePreferences(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { preferences } = req.body;

      // Validate all notification types
      for (const pref of preferences) {
        if (!ALL_NOTIFICATION_TYPES.includes(pref.notificationType)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_TYPE',
              message: `Invalid notification type: ${pref.notificationType}`,
            },
          });
        }
      }

      const updated = await notificationsService.updatePreferences(userId, preferences);

      // Enrich with labels
      const enrichedPreferences = updated.map((pref) => ({
        ...pref,
        label: NOTIFICATION_TYPE_LABELS[pref.notificationType]?.title || pref.notificationType,
        description:
          NOTIFICATION_TYPE_LABELS[pref.notificationType]?.description || '',
      }));

      res.json({
        success: true,
        data: { preferences: enrichedPreferences },
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update notification preferences',
        },
      });
    }
  },

  // GET /api/v1/notifications/types
  async getNotificationTypes(req: Request, res: Response) {
    try {
      const types = ALL_NOTIFICATION_TYPES.map((type) => ({
        type,
        ...NOTIFICATION_TYPE_LABELS[type],
      }));

      res.json({
        success: true,
        data: { types },
      });
    } catch (error) {
      console.error('Error getting notification types:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get notification types',
        },
      });
    }
  },

  // ========== Push Notification Endpoints ==========

  // GET /api/v1/notifications/push/vapid-key
  async getVapidPublicKey(req: Request, res: Response) {
    try {
      const vapidPublicKey = notificationsService.getVapidPublicKey();
      const isConfigured = notificationsService.isPushConfigured();

      res.json({
        success: true,
        data: {
          vapidPublicKey,
          isConfigured,
        },
      });
    } catch (error) {
      console.error('Error getting VAPID public key:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get VAPID public key',
        },
      });
    }
  },

  // GET /api/v1/notifications/push/subscriptions
  async getPushSubscriptions(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const subscriptions = await notificationsService.getPushSubscriptions(userId);

      res.json({
        success: true,
        data: { subscriptions },
      });
    } catch (error) {
      console.error('Error getting push subscriptions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get push subscriptions',
        },
      });
    }
  },

  // POST /api/v1/notifications/push/subscribe
  async subscribePush(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { endpoint, keys, userAgent: _userAgent, deviceName: _deviceName } = req.body;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'endpoint and keys (p256dh, auth) are required',
          },
        });
      }

      const subscription = await notificationsService.subscribePush(userId, {
        endpoint,
        keys,
      } as any);

      res.status(201).json({
        success: true,
        data: { subscription },
      });
    } catch (error) {
      console.error('Error subscribing to push:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to subscribe to push notifications',
        },
      });
    }
  },

  // DELETE /api/v1/notifications/push/unsubscribe
  async unsubscribePush(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'endpoint is required',
          },
        });
      }

      const success = await notificationsService.unsubscribePush(userId, endpoint);

      res.json({
        success: true,
        data: { unsubscribed: success },
      });
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to unsubscribe from push notifications',
        },
      });
    }
  },

  // DELETE /api/v1/notifications/push/unsubscribe-all
  async unsubscribeAllPush(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const count = await notificationsService.unsubscribeAllPush(userId);

      res.json({
        success: true,
        data: { unsubscribedCount: count },
      });
    } catch (error) {
      console.error('Error unsubscribing all push:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to unsubscribe all push notifications',
        },
      });
    }
  },

  // POST /api/v1/notifications/push/test
  async sendTestPush(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      if (!notificationsService.isPushConfigured()) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Push notifications are not configured',
          },
        });
      }

      const result = await notificationsService.sendTestPush(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error sending test push:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send test push notification',
        },
      });
    }
  },
};
