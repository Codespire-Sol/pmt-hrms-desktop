import webpush from 'web-push';
import { prisma } from '../database/prisma';
import { logger } from '../utils/logger';

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:noreply@projectflow.ai';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export const pushService = {
  // Check if push is configured
  isConfigured(): boolean {
    return Boolean(vapidPublicKey && vapidPrivateKey);
  },

  // Get VAPID public key for client
  getVapidPublicKey(): string {
    return vapidPublicKey;
  },

  // Subscribe a user's device for push notifications
  async subscribe(userId: string, input: PushSubscriptionInput): Promise<PushSubscription> {
    const existing = await prisma.pushSubscription.findFirst({
      where: {
        userId,
        endpoint: input.endpoint,
      },
    });

    if (existing) {
      // Update existing subscription
      const updated = await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
        },
      });

      return this.mapSubscription(updated);
    }

    // Create new subscription
    const created = await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
    });

    return this.mapSubscription(created);
  },

  // Unsubscribe a device
  async unsubscribe(userId: string, endpoint: string): Promise<boolean> {
    const result = await prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint,
      },
    });

    return result.count > 0;
  },

  // Unsubscribe all devices for a user
  async unsubscribeAll(userId: string): Promise<number> {
    const result = await prisma.pushSubscription.deleteMany({
      where: { userId },
    });
    return result.count;
  },

  // Get all subscriptions for a user
  async getSubscriptions(userId: string): Promise<PushSubscription[]> {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((s: any) => this.mapSubscription(s));
  },

  // Send push notification to a specific user
  async sendToUser(userId: string, payload: PushPayload): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.isConfigured()) {
      logger.warn('Push notifications not configured, skipping');
      return { sent: 0, failed: 0, errors: ['Push notifications not configured'] };
    }

    const subscriptions = await this.getSubscriptions(userId);

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0, errors: [] };
    }

    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const subscription of subscriptions) {
      try {
        await this.sendPush(subscription, payload);
        results.sent++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(error.message);

        // Handle expired/invalid subscriptions
        if (error.statusCode === 404 || error.statusCode === 410) {
          await prisma.pushSubscription.delete({
            where: { id: subscription.id },
          });
          logger.info(`Deleted expired push subscription: ${subscription.id}`);
        } else {
          logger.error(`Failed to send push to subscription ${subscription.id}:`, error);
        }
      }
    }

    return results;
  },

  // Send push notification to multiple users
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<{
    totalSent: number;
    totalFailed: number;
    byUser: Record<string, { sent: number; failed: number }>;
  }> {
    const results = {
      totalSent: 0,
      totalFailed: 0,
      byUser: {} as Record<string, { sent: number; failed: number }>,
    };

    for (const userId of userIds) {
      const userResult = await this.sendToUser(userId, payload);
      results.totalSent += userResult.sent;
      results.totalFailed += userResult.failed;
      results.byUser[userId] = { sent: userResult.sent, failed: userResult.failed };
    }

    return results;
  },

  // Send a push notification to a specific subscription
  async sendPush(subscription: PushSubscription, payload: PushPayload): Promise<void> {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/notification-icon.png',
      badge: payload.badge || '/icons/badge-icon.png',
      tag: payload.tag,
      data: payload.data,
      actions: payload.actions,
      timestamp: Date.now(),
    });

    await webpush.sendNotification(pushSubscription, notificationPayload, {
      TTL: 60 * 60 * 24, // 24 hours
      urgency: 'normal',
    });
  },

  // Cleanup inactive subscriptions older than N days
  async cleanup(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.pushSubscription.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    logger.info(`Cleaned up ${result.count} old push subscriptions`);
    return result.count;
  },

  mapSubscription(row: any): PushSubscription {
    return {
      id: row.id,
      userId: row.userId,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      createdAt: row.createdAt,
    };
  },
};
