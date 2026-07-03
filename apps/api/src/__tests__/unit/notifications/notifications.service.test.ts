import { notificationsService } from '../../../modules/notifications/notifications.service';
import { notificationsRepository } from '../../../modules/notifications/notifications.repository';
import { pushService } from '../../../services/push.service';
import { NotificationType, NotifyParams } from '../../../modules/notifications/notifications.types';

// Mock dependencies
jest.mock('../../../modules/notifications/notifications.repository');
jest.mock('../../../services/push.service');
jest.mock('../../../websocket', () => ({
  pushNotification: jest.fn(),
  pushUnreadCount: jest.fn(),
}));

const mockNotificationsRepository = notificationsRepository as jest.Mocked<typeof notificationsRepository>;
const mockPushService = pushService as jest.Mocked<typeof pushService>;

describe('NotificationsService', () => {
  const mockNotification = {
    id: 'notification-123',
    userId: 'user-123',
    type: 'issue_assigned' as NotificationType,
    title: 'Test notification',
    message: 'Test message',
    actorId: 'actor-123',
    issueId: 'issue-123',
    commentId: null,
    projectId: 'project-123',
    metadata: {},
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  };

  const mockPreference = {
    id: 'pref-123',
    userId: 'user-123',
    notificationType: 'issue_assigned' as NotificationType,
    inAppEnabled: true,
    emailEnabled: false,
    pushEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('notify', () => {
    const notifyParams: NotifyParams = {
      type: 'issue_assigned',
      recipientIds: ['user-1', 'user-2'],
      actorId: 'actor-123',
      issueId: 'issue-123',
      projectId: 'project-123',
      metadata: { issueKey: 'TEST-123', issueTitle: 'Test Issue' },
    };

    it('should create notifications for recipients with enabled preferences', async () => {
      const preferencesMap = new Map([
        ['user-1', { inAppEnabled: true, emailEnabled: false, pushEnabled: true }],
        ['user-2', { inAppEnabled: true, emailEnabled: false, pushEnabled: false }],
      ]);

      mockNotificationsRepository.getPreferencesForUsers.mockResolvedValue(preferencesMap as any);
      mockNotificationsRepository.createMany.mockResolvedValue([
        { ...mockNotification, userId: 'user-1' },
        { ...mockNotification, userId: 'user-2' },
      ] as any);
      mockNotificationsRepository.getUnreadCount.mockResolvedValue(5);
      mockPushService.isConfigured.mockReturnValue(true);
      mockPushService.sendToUsers.mockResolvedValue({ totalSent: 1, totalFailed: 0, byUser: {} });

      const result = await notificationsService.notify(notifyParams, 'Actor Name');

      expect(mockNotificationsRepository.getPreferencesForUsers).toHaveBeenCalledWith(
        ['user-1', 'user-2'],
        'issue_assigned'
      );
      expect(mockNotificationsRepository.createMany).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should not notify the actor themselves', async () => {
      const paramsWithActorAsRecipient: NotifyParams = {
        ...notifyParams,
        recipientIds: ['actor-123', 'user-1'],
      };

      mockNotificationsRepository.getPreferencesForUsers.mockResolvedValue(new Map([
        ['user-1', { inAppEnabled: true }],
      ]) as any);
      mockNotificationsRepository.createMany.mockResolvedValue([mockNotification] as any);
      mockNotificationsRepository.getUnreadCount.mockResolvedValue(1);
      mockPushService.isConfigured.mockReturnValue(false);

      await notificationsService.notify(paramsWithActorAsRecipient, 'Actor Name');

      // Should only call with user-1, not actor-123
      expect(mockNotificationsRepository.getPreferencesForUsers).toHaveBeenCalledWith(
        ['user-1'],
        'issue_assigned'
      );
    });

    it('should return empty array if no recipients after filtering', async () => {
      const paramsOnlyActor: NotifyParams = {
        ...notifyParams,
        recipientIds: ['actor-123'],
      };

      const result = await notificationsService.notify(paramsOnlyActor, 'Actor Name');

      expect(result).toEqual([]);
      expect(mockNotificationsRepository.createMany).not.toHaveBeenCalled();
    });

    it('should skip recipients with inAppEnabled false', async () => {
      mockNotificationsRepository.getPreferencesForUsers.mockResolvedValue(new Map([
        ['user-1', { inAppEnabled: false }],
        ['user-2', { inAppEnabled: true }],
      ]) as any);
      mockNotificationsRepository.createMany.mockResolvedValue([
        { ...mockNotification, userId: 'user-2' },
      ] as any);
      mockNotificationsRepository.getUnreadCount.mockResolvedValue(1);
      mockPushService.isConfigured.mockReturnValue(false);

      const result = await notificationsService.notify(notifyParams, 'Actor Name');

      expect(result).toHaveLength(1);
    });

    it('should send push notifications when configured and enabled', async () => {
      mockNotificationsRepository.getPreferencesForUsers.mockResolvedValue(new Map([
        ['user-1', { inAppEnabled: true, pushEnabled: true }],
      ]) as any);
      mockNotificationsRepository.createMany.mockResolvedValue([mockNotification] as any);
      mockNotificationsRepository.getUnreadCount.mockResolvedValue(1);
      mockPushService.isConfigured.mockReturnValue(true);
      mockPushService.sendToUsers.mockResolvedValue({ totalSent: 1, totalFailed: 0, byUser: {} });

      await notificationsService.notify(notifyParams, 'Actor Name');

      expect(mockPushService.sendToUsers).toHaveBeenCalled();
    });
  });

  describe('getByUserId', () => {
    it('should return paginated notifications', async () => {
      const mockResult = {
        notifications: [mockNotification],
        total: 1,
      };
      mockNotificationsRepository.getByUserId.mockResolvedValue(mockResult as any);

      const result = await notificationsService.getByUserId('user-123', {
        unreadOnly: false,
        limit: 20,
        offset: 0,
      });

      expect(mockNotificationsRepository.getByUserId).toHaveBeenCalledWith('user-123', {
        unreadOnly: false,
        limit: 20,
        offset: 0,
      });
      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by unread only when requested', async () => {
      mockNotificationsRepository.getByUserId.mockResolvedValue({
        notifications: [],
        total: 0,
      } as any);

      await notificationsService.getByUserId('user-123', { unreadOnly: true });

      expect(mockNotificationsRepository.getByUserId).toHaveBeenCalledWith('user-123', {
        unreadOnly: true,
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark specific notifications as read', async () => {
      mockNotificationsRepository.markAsRead.mockResolvedValue(2);

      const result = await notificationsService.markAsRead(['notif-1', 'notif-2'], 'user-123');

      expect(mockNotificationsRepository.markAsRead).toHaveBeenCalledWith(
        ['notif-1', 'notif-2'],
        'user-123'
      );
      expect(result).toBe(2);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationsRepository.markAllAsRead.mockResolvedValue(10);

      const result = await notificationsService.markAllAsRead('user-123');

      expect(mockNotificationsRepository.markAllAsRead).toHaveBeenCalledWith('user-123', undefined);
      expect(result).toBe(10);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockNotificationsRepository.getUnreadCount.mockResolvedValue(5);

      const result = await notificationsService.getUnreadCount('user-123');

      expect(mockNotificationsRepository.getUnreadCount).toHaveBeenCalledWith('user-123');
      expect(result).toBe(5);
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      mockNotificationsRepository.getPreferences.mockResolvedValue([mockPreference] as any);

      const result = await notificationsService.getPreferences('user-123');

      expect(mockNotificationsRepository.getPreferences).toHaveBeenCalledWith('user-123');
      expect(result).toHaveLength(1);
    });
  });

  describe('updatePreference', () => {
    it('should update preference settings', async () => {
      mockNotificationsRepository.getPreference.mockResolvedValue(mockPreference as any);
      mockNotificationsRepository.upsertPreference.mockResolvedValue({
        ...mockPreference,
        inAppEnabled: false,
      } as any);

      const result = await notificationsService.updatePreference('user-123', {
        notificationType: 'issue_assigned',
        inAppEnabled: false,
      });

      expect(result.inAppEnabled).toBe(false);
    });

    it('should use default values when no existing preference', async () => {
      mockNotificationsRepository.getPreference.mockResolvedValue(null);
      mockNotificationsRepository.upsertPreference.mockResolvedValue(mockPreference as any);

      await notificationsService.updatePreference('user-123', {
        notificationType: 'issue_assigned',
      });

      expect(mockNotificationsRepository.upsertPreference).toHaveBeenCalledWith(
        'user-123',
        'issue_assigned',
        true, // default inAppEnabled
        true // default emailEnabled for issue_assigned
      );
    });
  });

  describe('getNotificationUrl', () => {
    it('should return issue URL for issue-related notifications', () => {
      const url = notificationsService.getNotificationUrl('issue_assigned', {
        projectId: 'project-123',
        issueId: 'issue-123',
      });

      expect(url).toBe('/projects/project-123/issues/issue-123');
    });

    it('should return comments section URL for comment notifications', () => {
      const url = notificationsService.getNotificationUrl('issue_commented', {
        projectId: 'project-123',
        issueId: 'issue-123',
      });

      expect(url).toBe('/projects/project-123/issues/issue-123#comments');
    });

    it('should return sprints URL for sprint notifications', () => {
      const url = notificationsService.getNotificationUrl('sprint_started', {
        projectId: 'project-123',
      });

      expect(url).toBe('/projects/project-123/sprints');
    });

    it('should return notifications page for unknown types', () => {
      const url = notificationsService.getNotificationUrl('unknown_type' as any, {});

      expect(url).toBe('/notifications');
    });
  });

  describe('Push notification methods', () => {
    describe('isPushConfigured', () => {
      it('should return push service configuration status', () => {
        mockPushService.isConfigured.mockReturnValue(true);

        const result = notificationsService.isPushConfigured();

        expect(result).toBe(true);
        expect(mockPushService.isConfigured).toHaveBeenCalled();
      });
    });

    describe('getVapidPublicKey', () => {
      it('should return VAPID public key', () => {
        mockPushService.getVapidPublicKey.mockReturnValue('test-vapid-key');

        const result = notificationsService.getVapidPublicKey();

        expect(result).toBe('test-vapid-key');
      });
    });

    describe('subscribePush', () => {
      it('should subscribe user to push notifications', async () => {
        const subscriptionInput = {
          endpoint: 'https://push.example.com/subscription',
          keys: { p256dh: 'key1', auth: 'key2' },
        };
        mockPushService.subscribe.mockResolvedValue({
          id: 'sub-123',
          userId: 'user-123',
          endpoint: subscriptionInput.endpoint,
          p256dhKey: subscriptionInput.keys.p256dh,
          authKey: subscriptionInput.keys.auth,
          userAgent: null,
          deviceName: null,
          isActive: true,
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const result = await notificationsService.subscribePush('user-123', subscriptionInput);

        expect(mockPushService.subscribe).toHaveBeenCalledWith('user-123', subscriptionInput);
        expect(result.endpoint).toBe(subscriptionInput.endpoint);
      });
    });

    describe('unsubscribePush', () => {
      it('should unsubscribe device from push notifications', async () => {
        mockPushService.unsubscribe.mockResolvedValue(true);

        const result = await notificationsService.unsubscribePush(
          'user-123',
          'https://push.example.com/subscription'
        );

        expect(mockPushService.unsubscribe).toHaveBeenCalledWith(
          'user-123',
          'https://push.example.com/subscription'
        );
        expect(result).toBe(true);
      });
    });

    describe('unsubscribeAllPush', () => {
      it('should unsubscribe all devices for user', async () => {
        mockPushService.unsubscribeAll.mockResolvedValue(3);

        const result = await notificationsService.unsubscribeAllPush('user-123');

        expect(mockPushService.unsubscribeAll).toHaveBeenCalledWith('user-123');
        expect(result).toBe(3);
      });
    });

    describe('sendTestPush', () => {
      it('should send test push notification to user', async () => {
        mockPushService.sendToUser.mockResolvedValue({ sent: 1, failed: 0, errors: [] });

        const result = await notificationsService.sendTestPush('user-123');

        expect(mockPushService.sendToUser).toHaveBeenCalledWith('user-123', {
          title: 'Test Notification',
          body: 'This is a test push notification from ProjectFlow AI',
          tag: 'test',
          data: {
            type: 'test',
            url: '/notifications',
          },
        });
        expect(result.sent).toBe(1);
      });
    });
  });

  describe('cleanup', () => {
    it('should delete old notifications', async () => {
      mockNotificationsRepository.deleteOlderThan.mockResolvedValue(50);

      const result = await notificationsService.cleanup(90);

      expect(mockNotificationsRepository.deleteOlderThan).toHaveBeenCalledWith(90);
      expect(result).toBe(50);
    });
  });
});
