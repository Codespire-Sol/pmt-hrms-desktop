import { prisma } from '../../database/prisma';
import {
  Notification,
  NotificationWithDetails,
  NotificationPreference,
  CreateNotificationInput,
  NotificationType,
  ALL_NOTIFICATION_TYPES,
} from './notifications.types';

export const notificationsRepository = {
  // Create a notification
  async create(input: CreateNotificationInput): Promise<Notification> {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message || null,
        actorId: input.actorId || null,
        issueId: input.issueId || null,
        commentId: input.commentId || null,
        projectId: input.projectId || null,
        metadata: input.metadata || {},
      },
    });

    return notification as unknown as Notification;
  },

  // Create multiple notifications
  async createMany(inputs: CreateNotificationInput[]): Promise<Notification[]> {
    if (inputs.length === 0) return [];

    const notifications = await prisma.notification.createManyAndReturn({
      data: inputs.map((input) => ({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message || null,
        actorId: input.actorId || null,
        issueId: input.issueId || null,
        commentId: input.commentId || null,
        projectId: input.projectId || null,
        metadata: input.metadata || {},
      })),
    });

    return notifications as unknown as Notification[];
  },

  // Get notification by ID
  async getById(notificationId: string): Promise<Notification | null> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    return notification as unknown as Notification | null;
  },

  // Get notifications for user with details
  async getByUserId(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      type?: string;
      module?: 'hrms' | 'toolkit' | 'all';
    } = {}
  ): Promise<{ notifications: NotificationWithDetails[]; total: number }> {
    const { unreadOnly = false, limit = 20, offset = 0, type, module = 'all' } = options;

    // Build where clause
    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }
    if (type) {
      where.type = type;
    } else if (module === 'hrms') {
      where.type = { startsWith: 'hrms_' };
    } else if (module === 'toolkit') {
      where.type = { not: { startsWith: 'hrms_' } };
    }

    // Get total count
    const total = await prisma.notification.count({ where });

    // Get notifications with details
    const notifications = await prisma.notification.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        issue: {
          select: {
            id: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            key: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const result: NotificationWithDetails[] = notifications.map((n) => {
      // Generate issue key if we have issue data
      let issueKey: string | null = null;
      if (n.issue && n.project) {
        const metadata = n.metadata as Record<string, any> | null;
        issueKey = metadata?.issueKey || `${n.project.key}-?`;
      }

      return {
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        actorId: n.actorId,
        issueId: n.issueId,
        commentId: n.commentId,
        projectId: n.projectId,
        metadata: (n.metadata as Record<string, any>) || {},
        isRead: n.isRead,
        readAt: n.readAt,
        createdAt: n.createdAt,
        actor: n.actor
          ? {
              id: n.actor.id,
              displayName: `${n.actor.firstName} ${n.actor.lastName}`,
              avatarUrl: n.actor.avatarUrl,
            }
          : null,
        issue: n.issue
          ? {
              id: n.issue.id,
              issueKey: issueKey || 'Unknown',
              title: n.issue.title,
            }
          : null,
        project: n.project
          ? {
              id: n.project.id,
              name: n.project.name,
              key: n.project.key,
            }
          : null,
      } as unknown as NotificationWithDetails;
    });

    return { notifications: result, total };
  },

  // Mark notifications as read
  async markAsRead(notificationIds: string[], userId: string): Promise<number> {
    const { count } = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return count;
  },

  // Mark all notifications as read for user
  async markAllAsRead(userId: string, module?: 'hrms' | 'toolkit'): Promise<number> {
    const typeFilter = module === 'hrms'
      ? { startsWith: 'hrms_' }
      : module === 'toolkit'
        ? { not: { startsWith: 'hrms_' } }
        : undefined;
    const { count } = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        ...(typeFilter ? { type: typeFilter } : {}),
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return count;
  },

  // Get unread count for user
  async getUnreadCount(userId: string): Promise<number> {
    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return count;
  },

  // Delete old notifications (for cleanup)
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { count } = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });

    return count;
  },

  // Preferences
  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    const preferences = await prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: { notificationType: 'asc' },
    });

    // Return existing preferences merged with defaults
    const existingTypes = new Set(preferences.map((p) => p.notificationType));
    const result: NotificationPreference[] = preferences as unknown as NotificationPreference[];

    // Add defaults for missing types
    for (const type of ALL_NOTIFICATION_TYPES) {
      if (!existingTypes.has(type)) {
        result.push({
          id: null,
          userId,
          notificationType: type,
          inAppEnabled: true,
          emailEnabled:
            type === 'issue_assigned' ||
            type === 'issue_mentioned' ||
            type.startsWith('hrms_'),
          createdAt: null,
          updatedAt: null,
        } as unknown as NotificationPreference);
      }
    }

    return result;
  },

  // Get preference for specific type
  async getPreference(
    userId: string,
    type: NotificationType
  ): Promise<NotificationPreference | null> {
    const preference = await prisma.notificationPreference.findFirst({
      where: {
        userId,
        notificationType: type,
      },
    });

    return preference as unknown as NotificationPreference | null;
  },

  // Get preferences for multiple users for a specific type
  async getPreferencesForUsers(
    userIds: string[],
    type: NotificationType
  ): Promise<Map<string, { inAppEnabled: boolean; emailEnabled: boolean }>> {
    const preferences = await prisma.notificationPreference.findMany({
      where: {
        userId: { in: userIds },
        notificationType: type,
      },
    });

    const map = new Map<string, { inAppEnabled: boolean; emailEnabled: boolean }>();

    // Set defaults for all users
    for (const userId of userIds) {
      map.set(userId, {
        inAppEnabled: true,
        // HRMS notification types default to email-on so employees/HR receive alerts
        // without having to manually configure preferences first.
        emailEnabled:
          type === 'issue_assigned' ||
          type === 'issue_mentioned' ||
          type.startsWith('hrms_'),
      });
    }

    // Override with actual preferences
    for (const pref of preferences) {
      map.set(pref.userId, {
        inAppEnabled: pref.inAppEnabled,
        emailEnabled: pref.emailEnabled,
      });
    }

    return map;
  },

  // Update or create preference
  async upsertPreference(
    userId: string,
    type: NotificationType,
    inAppEnabled: boolean,
    emailEnabled: boolean
  ): Promise<NotificationPreference> {
    const preference = await prisma.notificationPreference.upsert({
      where: {
        userId_notificationType: {
          userId,
          notificationType: type,
        },
      },
      create: {
        userId,
        notificationType: type,
        inAppEnabled,
        emailEnabled,
      },
      update: {
        inAppEnabled,
        emailEnabled,
        updatedAt: new Date(),
      },
    });

    return preference as unknown as NotificationPreference;
  },
};
