import { AuthService } from '../../../modules/auth/auth.service';
import { UsersRepository } from '../../../modules/users/users.repository';
import { ApiError } from '../../../utils/ApiError';

// Mock dependencies
jest.mock('../../../utils/jwt', () => ({
  JwtUtils: {
    revokeAllAccessTokensForUser: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../../database/prisma', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockUsersRepository: jest.Mocked<UsersRepository>;

  const mockUser: any = {
    id: 'user-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    avatar_url: null,
    phone: null,
    is_verified: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsersRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      updateLastLogin: jest.fn(),
      incrementFailedLoginAttempts: jest.fn(),
      lockAccount: jest.fn(),
      verifyEmail: jest.fn(),
    } as any;

    authService = new AuthService(mockUsersRepository);
  });

  describe('getCurrentUser', () => {
    it('should return current user profile', async () => {
      mockUsersRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser(mockUser.id);

      expect(mockUsersRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.firstName).toBe(mockUser.first_name);
      expect(result.lastName).toBe(mockUser.last_name);
    });

    it('should throw not found if user does not exist', async () => {
      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(authService.getCurrentUser('non-existent')).rejects.toThrow(ApiError);
      await expect(authService.getCurrentUser('non-existent')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('updateProfile', () => {
    it('should update user profile with first and last name', async () => {
      const updatedUser = { ...mockUser, first_name: 'Updated', last_name: 'Name' };
      mockUsersRepository.update.mockResolvedValue(updatedUser);

      const result = await authService.updateProfile(mockUser.id, {
        firstName: 'Updated',
        lastName: 'Name',
      });

      expect(mockUsersRepository.update).toHaveBeenCalledWith(mockUser.id, {
        first_name: 'Updated',
        last_name: 'Name',
      });
      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
    });

    it('should update user timezone and locale', async () => {
      const updatedUser = { ...mockUser, timezone: 'Asia/Kolkata', locale: 'hi' };
      mockUsersRepository.update.mockResolvedValue(updatedUser);

      await authService.updateProfile(mockUser.id, {
        timezone: 'Asia/Kolkata',
        locale: 'hi',
      });

      expect(mockUsersRepository.update).toHaveBeenCalledWith(mockUser.id, {
        timezone: 'Asia/Kolkata',
        locale: 'hi',
      });
    });

    it('should allow setting phone to null', async () => {
      const updatedUser = { ...mockUser, phone: null };
      mockUsersRepository.update.mockResolvedValue(updatedUser);

      await authService.updateProfile(mockUser.id, { phone: null });

      expect(mockUsersRepository.update).toHaveBeenCalledWith(mockUser.id, { phone: null });
    });
  });

  describe('logoutAll', () => {
    it('should revoke all access tokens for user', async () => {
      const { JwtUtils } = require('../../../utils/jwt');

      await authService.logoutAll('user-123');

      expect(JwtUtils.revokeAllAccessTokensForUser).toHaveBeenCalledWith('user-123');
    });
  });
});
