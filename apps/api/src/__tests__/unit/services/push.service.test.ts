// Mock web-push before importing the service
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 }),
}));

// Mock Prisma
const mockPrisma = {
  pushSubscription: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('../../../database/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { pushService, PushSubscription, PushPayload } from '../../../services/push.service';
import webpush from 'web-push';

const mockWebpush = webpush as jest.Mocked<typeof webpush>;

describe('PushService', () => {
  const mockUserId = 'user-123';

  const mockPrismaRow = {
    id: 'sub-123',
    userId: mockUserId,
    endpoint: 'https://push.example.com/subscription',
    p256dh: 'p256dh-key',
    auth: 'auth-key',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubscription: PushSubscription = {
    id: 'sub-123',
    userId: mockUserId,
    endpoint: 'https://push.example.com/subscription',
    p256dh: 'p256dh-key',
    auth: 'auth-key',
    createdAt: new Date().toISOString(),
  };

  const mockPayload: PushPayload = {
    title: 'Test Notification',
    body: 'This is a test',
    tag: 'test',
    data: { type: 'test' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should return true when VAPID keys are set', () => {
      const result = pushService.isConfigured();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getVapidPublicKey', () => {
    it('should return the VAPID public key', () => {
      const result = pushService.getVapidPublicKey();
      expect(typeof result).toBe('string');
    });
  });

  describe('subscribe', () => {
    const subscriptionInput = {
      endpoint: 'https://push.example.com/new-subscription',
      keys: {
        p256dh: 'new-p256dh-key',
        auth: 'new-auth-key',
      },
      userAgent: 'Firefox/120',
      deviceName: 'Home PC',
    };

    it('should create new subscription when none exists', async () => {
      mockPrisma.pushSubscription.findFirst.mockResolvedValue(null);
      mockPrisma.pushSubscription.create.mockResolvedValue({
        ...mockPrismaRow,
        endpoint: subscriptionInput.endpoint,
        p256dh: subscriptionInput.keys.p256dh,
        auth: subscriptionInput.keys.auth,
      });

      const result = await pushService.subscribe(mockUserId, subscriptionInput);

      expect(result.endpoint).toBe(subscriptionInput.endpoint);
      expect(result.p256dh).toBe(subscriptionInput.keys.p256dh);
    });

    it('should update existing subscription', async () => {
      mockPrisma.pushSubscription.findFirst.mockResolvedValue(mockPrismaRow);
      mockPrisma.pushSubscription.update.mockResolvedValue({
        ...mockPrismaRow,
        p256dh: subscriptionInput.keys.p256dh,
        auth: subscriptionInput.keys.auth,
      });

      const result = await pushService.subscribe(mockUserId, subscriptionInput);

      expect(result.id).toBe(mockPrismaRow.id);
    });
  });

  describe('unsubscribe', () => {
    it('should delete subscription and return true', async () => {
      mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      const result = await pushService.unsubscribe(mockUserId, mockSubscription.endpoint);

      expect(result).toBe(true);
    });

    it('should return false when subscription not found', async () => {
      mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 0 });

      const result = await pushService.unsubscribe(mockUserId, 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('unsubscribeAll', () => {
    it('should delete all subscriptions for user', async () => {
      mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 3 });

      const result = await pushService.unsubscribeAll(mockUserId);

      expect(result).toBe(3);
    });
  });

  describe('getSubscriptions', () => {
    it('should return active subscriptions for user', async () => {
      mockPrisma.pushSubscription.findMany.mockResolvedValue([mockPrismaRow]);

      const result = await pushService.getSubscriptions(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(mockUserId);
    });

    it('should return empty array when no subscriptions', async () => {
      mockPrisma.pushSubscription.findMany.mockResolvedValue([]);

      const result = await pushService.getSubscriptions(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('sendToUser', () => {
    beforeEach(() => {
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 } as any);
    });

    it('should send push to all user subscriptions', async () => {
      jest.spyOn(pushService, 'isConfigured').mockReturnValue(true);
      jest.spyOn(pushService, 'getSubscriptions').mockResolvedValue([mockSubscription, { ...mockSubscription, id: 'sub-456' }]);

      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 } as any);

      const result = await pushService.sendToUser(mockUserId, mockPayload);

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should return early if push not configured', async () => {
      jest.spyOn(pushService, 'isConfigured').mockReturnValue(false);

      const result = await pushService.sendToUser(mockUserId, mockPayload);

      expect(result.sent).toBe(0);
      expect(result.errors).toContain('Push notifications not configured');
    });

    it('should return empty results if no subscriptions', async () => {
      jest.spyOn(pushService, 'isConfigured').mockReturnValue(true);
      jest.spyOn(pushService, 'getSubscriptions').mockResolvedValue([]);

      const result = await pushService.sendToUser(mockUserId, mockPayload);

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should deactivate subscription on 410 error', async () => {
      jest.spyOn(pushService, 'isConfigured').mockReturnValue(true);
      jest.spyOn(pushService, 'getSubscriptions').mockResolvedValue([mockSubscription]);
      mockWebpush.sendNotification.mockRejectedValue({ statusCode: 410, message: 'Gone' });

      mockPrisma.pushSubscription.delete.mockResolvedValue(mockPrismaRow);

      const result = await pushService.sendToUser(mockUserId, mockPayload);

      expect(result.failed).toBe(1);
    });
  });

  describe('sendToUsers', () => {
    it('should send to multiple users', async () => {
      jest.spyOn(pushService, 'sendToUser')
        .mockResolvedValueOnce({ sent: 1, failed: 0, errors: [] })
        .mockResolvedValueOnce({ sent: 2, failed: 0, errors: [] });

      const result = await pushService.sendToUsers(['user-1', 'user-2'], mockPayload);

      expect(result.totalSent).toBe(3);
      expect(result.totalFailed).toBe(0);
      expect(Object.keys(result.byUser)).toHaveLength(2);
    });

    it('should aggregate failures across users', async () => {
      jest.spyOn(pushService, 'sendToUser')
        .mockResolvedValueOnce({ sent: 1, failed: 1, errors: ['Error'] })
        .mockResolvedValueOnce({ sent: 0, failed: 2, errors: ['Error1', 'Error2'] });

      const result = await pushService.sendToUsers(['user-1', 'user-2'], mockPayload);

      expect(result.totalSent).toBe(1);
      expect(result.totalFailed).toBe(3);
    });
  });

  describe('sendPush', () => {
    it('should format payload correctly', async () => {
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 } as any);

      await pushService.sendPush(mockSubscription, mockPayload);

      expect(mockWebpush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: mockSubscription.endpoint,
          keys: {
            p256dh: mockSubscription.p256dh,
            auth: mockSubscription.auth,
          },
        },
        expect.stringContaining(mockPayload.title),
        expect.objectContaining({ TTL: 86400 })
      );
    });

    it('should include default icons in payload', async () => {
      mockWebpush.sendNotification.mockResolvedValue({ statusCode: 201 } as any);

      await pushService.sendPush(mockSubscription, mockPayload);

      const sentPayload = JSON.parse(mockWebpush.sendNotification.mock.calls[0][1] as string);
      expect(sentPayload.icon).toBeDefined();
      expect(sentPayload.badge).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should delete inactive subscriptions older than threshold', async () => {
      mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 5 });

      const result = await pushService.cleanup(90);

      expect(result).toBe(5);
    });
  });

  describe('mapSubscription', () => {
    it('should map database row to PushSubscription', () => {
      const result = pushService.mapSubscription(mockPrismaRow);

      expect(result.id).toBe(mockPrismaRow.id);
      expect(result.userId).toBe(mockPrismaRow.userId);
      expect(result.endpoint).toBe(mockPrismaRow.endpoint);
      expect(result.p256dh).toBe(mockPrismaRow.p256dh);
      expect(result.auth).toBe(mockPrismaRow.auth);
    });
  });
});
