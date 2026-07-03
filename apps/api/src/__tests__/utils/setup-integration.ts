/**
 * Integration test setup — mocks Keycloak token verification so that
 * locally-signed JWT tokens (from generateTestToken) are accepted by
 * the auth middleware without needing a running Keycloak server.
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Mock the keycloak utility BEFORE any module imports auth.middleware
jest.mock('../../utils/keycloak', () => ({
  verifyKeycloakToken: jest.fn((token: string) => {
    try {
      // Decode the locally-signed token using the same secret
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'projectflow-api',
        audience: 'projectflow-app',
      });
      return Promise.resolve(decoded);
    } catch {
      return Promise.reject(new Error('Invalid or expired token'));
    }
  }),
}));

// Mock cache service to avoid needing Redis
jest.mock('../../services/cache.service', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));
