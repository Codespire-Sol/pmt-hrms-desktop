import request from 'supertest';
import app from '../../app';
import { prisma } from '../../database/prisma';
import { v4 as uuidv4 } from 'uuid';
import { generateTestToken } from '../utils/integration-helpers';

describe('Notifications API Integration Tests', () => {
  const testUserId = uuidv4();
  const timestamp = Date.now();
  const testUser = {
    id: testUserId,
    email: `notiftest-${timestamp}@example.com`,
    first_name: 'Notif',
    last_name: 'Test',
    password_hash: '$2b$12$test.hash',
    is_active: true,
    is_verified: true,
  };

  let authToken: string;
  const notificationIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: testUser.email,
        firstName: testUser.first_name,
        lastName: testUser.last_name,
        passwordHash: testUser.password_hash,
        isActive: testUser.is_active,
        isVerified: testUser.is_verified,
      },
    });
    authToken = generateTestToken(testUserId, testUser.email);

    // Create test notifications
    const notifications = [
      {
        id: uuidv4(),
        userId: testUserId,
        type: 'issue_assigned' as any,
        title: 'Test Notification 1',
        message: 'You have been assigned to an issue',
        isRead: false,
      },
      {
        id: uuidv4(),
        userId: testUserId,
        type: 'issue_commented' as any,
        title: 'Test Notification 2',
        message: 'Someone commented on your issue',
        isRead: false,
      },
      {
        id: uuidv4(),
        userId: testUserId,
        type: 'due_date_approaching' as any,
        title: 'Test Notification 3',
        message: 'Issue due date approaching',
        isRead: true,
        readAt: new Date(),
      },
    ];

    for (const notif of notifications) {
      try {
        await prisma.notification.create({ data: notif });
      } catch (e: any) {
        if (e.code !== 'P2002') throw e;
      }
      notificationIds.push(notif.id);
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: testUserId } });
    await prisma.pushSubscription.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  describe('GET /api/v1/notifications', () => {
    it('should return user notifications', async () => {
      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toBeDefined();
      expect(Array.isArray(response.body.data.notifications)).toBe(true);
    });

    it('should filter unread notifications', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.notifications.forEach((notif: any) => {
        expect(notif.isRead).toBe(false);
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/notifications?limit=1&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.limit).toBe(1);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/notifications');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/notifications/unread-count', () => {
    it('should return unread notification count', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.count).toBe('number');
    });
  });

  describe('POST /api/v1/notifications/mark-read', () => {
    it('should mark specific notifications as read', async () => {
      const unreadId = notificationIds[0];

      const response = await request(app)
        .post('/api/v1/notifications/mark-read')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notificationIds: [unreadId] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.markedCount).toBeGreaterThanOrEqual(0);
    });

    it('should validate notification IDs', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/mark-read')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notificationIds: [] });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/notifications/mark-all-read', () => {
    it('should mark all notifications as read', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/mark-all-read')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.markedCount).toBe('number');
    });
  });

  describe('GET /api/v1/notifications/types', () => {
    it('should return notification types', async () => {
      const response = await request(app)
        .get('/api/v1/notifications/types')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.types)).toBe(true);
      expect(response.body.data.types.length).toBeGreaterThan(0);
    });
  });

  describe('Notification Preferences', () => {
    describe('GET /api/v1/notifications/preferences', () => {
      it('should return user notification preferences', async () => {
        const response = await request(app)
          .get('/api/v1/notifications/preferences')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.preferences)).toBe(true);
      });
    });

    describe('PUT /api/v1/notifications/preferences/:type', () => {
      it('should update a single notification preference', async () => {
        const response = await request(app)
          .put('/api/v1/notifications/preferences/issue_assigned')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            inAppEnabled: true,
            emailEnabled: false,
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.preference.notificationType).toBe('issue_assigned');
      });

      it('should reject invalid notification type', async () => {
        const response = await request(app)
          .put('/api/v1/notifications/preferences/invalid_type')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            inAppEnabled: true,
          });

        expect(response.status).toBe(400);
      });
    });

    describe('PUT /api/v1/notifications/preferences', () => {
      it('should update multiple preferences', async () => {
        const response = await request(app)
          .put('/api/v1/notifications/preferences')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            preferences: [
              { notificationType: 'issue_assigned', inAppEnabled: true, emailEnabled: true },
              { notificationType: 'issue_commented', inAppEnabled: false, emailEnabled: true },
            ],
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.preferences)).toBe(true);
      });
    });
  });

  describe('Push Notifications', () => {
    describe('GET /api/v1/notifications/push/vapid-key', () => {
      it('should return VAPID public key', async () => {
        const response = await request(app)
          .get('/api/v1/notifications/push/vapid-key')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('vapidPublicKey');
        expect(response.body.data).toHaveProperty('isConfigured');
      });
    });

    describe('GET /api/v1/notifications/push/subscriptions', () => {
      it('should return user push subscriptions', async () => {
        const response = await request(app)
          .get('/api/v1/notifications/push/subscriptions')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.subscriptions)).toBe(true);
      });
    });

    describe('POST /api/v1/notifications/push/subscribe', () => {
      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/v1/notifications/push/subscribe')
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect(response.status).toBe(400);
      });

      it('should create push subscription with valid data', async () => {
        const response = await request(app)
          .post('/api/v1/notifications/push/subscribe')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            endpoint: 'https://push.example.com/test-subscription',
            keys: {
              p256dh: 'test-p256dh-key',
              auth: 'test-auth-key',
            },
            userAgent: 'Test Browser',
            deviceName: 'Test Device',
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.subscription).toBeDefined();
      });
    });

    describe('DELETE /api/v1/notifications/push/unsubscribe', () => {
      it('should require endpoint', async () => {
        const response = await request(app)
          .delete('/api/v1/notifications/push/unsubscribe')
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect(response.status).toBe(400);
      });

      it('should unsubscribe with valid endpoint', async () => {
        const response = await request(app)
          .delete('/api/v1/notifications/push/unsubscribe')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            endpoint: 'https://push.example.com/test-subscription',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('DELETE /api/v1/notifications/push/unsubscribe-all', () => {
      it('should unsubscribe all devices', async () => {
        const response = await request(app)
          .delete('/api/v1/notifications/push/unsubscribe-all')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(typeof response.body.data.unsubscribedCount).toBe('number');
      });
    });
  });
});
