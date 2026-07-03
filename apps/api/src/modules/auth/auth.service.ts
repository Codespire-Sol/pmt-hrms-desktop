import bcrypt from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import { JwtUtils } from '../../utils/jwt';
import { ApiError } from '../../utils/ApiError';
import { UserResponse } from './auth.types';
import { logger } from '../../utils/logger';
import { normalizeMediaUrl } from '../../utils/media-url';
import { config } from '../../config';
import { prisma } from '../../database/prisma';

export interface LoginResult {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(private usersRepository: UsersRepository) {}

  /**
   * Email/password login — only used when AUTH_MODE=jwt.
   * Verifies the bcrypt password hash, enforces lockout, and issues local JWTs.
   */
  async login(email: string, password: string, rememberMe = false): Promise<LoginResult> {
    const invalid = () => ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

    const user = await this.usersRepository.findByEmail(email);
    // Run a comparison even when the user is missing to reduce timing leakage.
    if (!user || !user.password_hash) {
      await bcrypt.compare(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidin');
      throw invalid();
    }

    // Account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw ApiError.unauthorized('Account temporarily locked. Try again later.', 'ACCOUNT_LOCKED');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      await this.usersRepository.incrementFailedLoginAttempts(user.id);
      if (user.failed_login_attempts + 1 >= config.auth.maxFailedLogins) {
        await this.usersRepository.lockAccount(user.id, config.auth.lockoutMinutes);
        logger.warn(`Account locked after repeated failed logins: ${user.email}`);
      }
      throw invalid();
    }

    if (!user.is_active) {
      throw ApiError.unauthorized('Your account is inactive', 'ACCOUNT_INACTIVE');
    }

    await this.usersRepository.updateLastLogin(user.id);

    const accessToken = JwtUtils.generateAccessToken(user.id, user.email);
    const refreshToken = JwtUtils.generateRefreshToken(user.id, user.email, rememberMe);

    logger.info(`User logged in (jwt mode): ${user.email}`);
    return { user: this.formatUserResponse(user), accessToken, refreshToken };
  }

  /**
   * Exchange a valid refresh token for a new access token (AUTH_MODE=jwt).
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload;
    try {
      payload = JwtUtils.verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const user = await this.usersRepository.findById(payload.userId);
    if (!user || !user.is_active) {
      throw ApiError.unauthorized('User not found or inactive', 'USER_NOT_FOUND');
    }

    return { accessToken: JwtUtils.generateAccessToken(user.id, user.email) };
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return this.formatUserResponse(user);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    input: { firstName?: string; lastName?: string; timezone?: string; locale?: string; phone?: string | null }
  ): Promise<UserResponse> {
    const updateData: any = {};
    if (input.firstName) updateData.first_name = input.firstName;
    if (input.lastName) updateData.last_name = input.lastName;
    if (input.timezone) updateData.timezone = input.timezone;
    if (input.locale) updateData.locale = input.locale;
    if (input.phone !== undefined) updateData.phone = input.phone;

    const user = await this.usersRepository.update(userId, updateData);
    logger.info(`Profile updated for user: ${userId}`);
    return this.formatUserResponse(user);
  }

  /**
   * Logout from all devices — blacklist all access tokens via user-level Redis key
   */
  async logoutAll(userId: string): Promise<void> {
    await JwtUtils.revokeAllAccessTokensForUser(userId);
    logger.info(`All sessions revoked for user: ${userId}`);
  }

  /**
   * Change the current user's own password (AUTH_MODE=jwt).
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw ApiError.badRequest('New password must be at least 8 characters', 'WEAK_PASSWORD');
    }
    const user = await this.usersRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (!user.password_hash) {
      throw ApiError.badRequest('Password login is not enabled for this account', 'NO_PASSWORD');
    }
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) throw ApiError.unauthorized('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.updatePassword(userId, passwordHash);
    await JwtUtils.revokeAllAccessTokensForUser(userId);
    logger.info(`Password changed for user: ${userId}`);
  }

  /**
   * Admin/HR resets another user's password (AUTH_MODE=jwt). No current password
   * required — caller must hold the users.manage_roles / admin permission.
   */
  async adminResetPassword(targetUserId: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw ApiError.badRequest('New password must be at least 8 characters', 'WEAK_PASSWORD');
    }
    const user = await this.usersRepository.findById(targetUserId);
    if (!user) throw ApiError.notFound('User not found');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.updatePassword(targetUserId, passwordHash);
    await JwtUtils.revokeAllAccessTokensForUser(targetUserId);
    logger.info(`Password reset by admin for user: ${targetUserId}`);
  }

  // ---------------------------------------------------------------------------
  // Host-only local admin lifecycle (used by the Electron desktop app via the
  // /auth/local/* routes; gated by verifyLocalAdminToken). These reuse the SAME
  // bcrypt hashing and token-revocation paths as normal login/change-password so
  // any admin created/reset here can log in normally.
  // ---------------------------------------------------------------------------

  /**
   * True when at least one active, non-deleted user holds the `admin` role.
   */
  async hasAdmin(): Promise<boolean> {
    const admin = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        role: { is: { name: 'admin' } },
      },
      select: { id: true },
    });
    return admin !== null;
  }

  /**
   * Create the FIRST admin user (host-only). Fails if an admin already exists.
   * Hashes the password the same way login expects (bcrypt, cost 10) and
   * assigns the `admin` role so the user can log in and pass RBAC checks.
   */
  async createFirstAdmin(input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ email: string }> {
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw ApiError.badRequest('A valid email is required', 'INVALID_EMAIL');
    }
    if (!password || password.length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters', 'WEAK_PASSWORD');
    }

    if (await this.hasAdmin()) {
      throw ApiError.conflict('Admin already exists', 'ADMIN_EXISTS');
    }

    const adminRole = await prisma.role.findFirst({ where: { name: 'admin' } });
    if (!adminRole) {
      throw ApiError.badRequest('Admin role is not initialized', 'ADMIN_ROLE_MISSING');
    }

    // Reuse an existing account with this email if one exists (e.g. a
    // previously-created non-admin user) rather than colliding on the unique
    // email constraint; otherwise create a fresh user.
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await prisma.user.findFirst({ where: { email } });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          firstName: input.firstName?.trim() || existing.firstName,
          lastName: input.lastName?.trim() || existing.lastName,
          isActive: true,
          isVerified: true,
          roleId: adminRole.id,
          deletedAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName?.trim() || 'Admin',
          lastName: input.lastName?.trim() || 'User',
          isActive: true,
          isVerified: true,
          roleId: adminRole.id,
        },
      });
    }

    logger.info(`Host created first admin user: ${email}`);
    return { email };
  }

  /**
   * Reset the admin account password (host-only). Targets the given email if
   * supplied, else the primary/first admin. Hashes + updates the password and
   * revokes existing tokens via the same path as adminResetPassword.
   */
  async resetAdminPassword(newPassword: string, email?: string): Promise<{ email: string }> {
    const password = String(newPassword || '');
    if (!password || password.length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters', 'WEAK_PASSWORD');
    }

    let target;
    if (email) {
      target = await prisma.user.findFirst({
        where: {
          email: String(email).trim().toLowerCase(),
          deletedAt: null,
          role: { is: { name: 'admin' } },
        },
      });
    } else {
      // Primary/first admin — oldest active admin account.
      target = await prisma.user.findFirst({
        where: {
          deletedAt: null,
          isActive: true,
          role: { is: { name: 'admin' } },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!target) {
      throw ApiError.notFound('Admin account not found');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.usersRepository.updatePassword(target.id, passwordHash);
    await JwtUtils.revokeAllAccessTokensForUser(target.id);
    logger.info(`Host reset admin password for: ${target.email}`);
    return { email: target.email };
  }

  private formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: normalizeMediaUrl(user.avatar_url),
      phone: user.phone ?? null,
      isVerified: user.is_verified,
      isActive: user.is_active,
      createdAt: user.created_at,
    };
  }
}
