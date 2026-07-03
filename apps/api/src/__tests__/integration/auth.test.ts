import request from 'supertest';
import app from '../../app';
import { prisma } from '../../database/prisma';
import { v4 as uuidv4 } from 'uuid';
import { generateTestToken } from '../utils/integration-helpers';

/**
 * Auth API Integration Tests
 *
 * Since Keycloak now handles registration, login, refresh, and password changes,
 * we only test the endpoints that still exist:
 *   GET  /api/v1/auth/me          — get current user profile
 *   PUT  /api/v1/auth/profile     — update profile
 *   POST /api/v1/auth/logout      — logout (blacklist token)
 *   POST /api/v1/auth/logout-all  — revoke all tokens
 */
describe('Auth API Integration Tests', () => {
  const testUserId = uuidv4();
  const timestamp = Date.now();
  const testUser = {
    id: testUserId,
    email: `authtest-${timestamp}@example.com`,
    firstName: 'Auth',
    lastName: 'Test',
  };

  let authToken: string;

  beforeAll(async () => {
    // Create a test user directly in the database
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        passwordHash: '$2b$12$placeholder.hash',
        isActive: true,
        isVerified: true,
      },
    });

    // Generate a locally-signed JWT (verified by the mocked verifyKeycloakToken)
    authToken = generateTestToken(testUserId, testUser.email);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user profile', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.firstName).toBe(testUser.firstName);
      expect(response.body.data.user.lastName).toBe(testUser.lastName);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/auth/profile', () => {
    it('should update user profile', async () => {
      const response = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe('Updated');
      expect(response.body.data.user.lastName).toBe('Name');
    });

    it('should update partial profile fields', async () => {
      const response = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Auth',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe('Auth');
    });

    it('should reject profile update without token', async () => {
      const response = await request(app)
        .put('/api/v1/auth/profile')
        .send({ firstName: 'Hacker' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      // Generate a fresh token for logout test
      const logoutToken = generateTestToken(testUserId, testUser.email);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${logoutToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle logout without token gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');

      // Logout without token should still succeed (nothing to blacklist)
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it('should revoke all tokens for user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout-all');

      expect(response.status).toBe(401);
    });
  });
});
