import jwt from 'jsonwebtoken';
import { config } from '../config';
import crypto from 'crypto';
import { cacheService } from '../services/cache.service';

export interface JwtPayload {
  userId: string;
  email: string;
  jti?: string;
  exp?: number;
  iat?: number;
}

const TOKEN_BLACKLIST_PREFIX = 'token:bl';

export class JwtUtils {
  static generateAccessToken(userId: string, email: string): string {
    const jti = crypto.randomBytes(16).toString('hex');
    const payload: JwtPayload = { userId, email, jti };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      issuer: 'projectflow-api',
      audience: 'projectflow-app',
    } as jwt.SignOptions);
  }

  static generateRefreshToken(userId: string, email: string, rememberMe?: boolean): string {
    const payload: JwtPayload = { userId, email };

    // Extended expiry (30 days) for "Remember Me", standard (7 days) otherwise
    const expiresIn = rememberMe ? '30d' : config.jwt.refreshExpiresIn;

    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn,
      issuer: 'projectflow-api',
      audience: 'projectflow-app',
    } as jwt.SignOptions);
  }

  static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.jwt.secret, {
        issuer: 'projectflow-api',
        audience: 'projectflow-app',
      }) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  static verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.jwt.refreshSecret, {
        issuer: 'projectflow-api',
        audience: 'projectflow-app',
      }) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Blacklist an access token by JTI. TTL is set to the token's remaining lifetime
   * so the blacklist entry auto-expires when the token would have expired anyway.
   */
  static async revokeAccessToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as JwtPayload | null;
      if (!decoded?.jti || !decoded?.exp) return;
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await cacheService.set(`${TOKEN_BLACKLIST_PREFIX}:${decoded.jti}`, 1, { ttl });
      }
    } catch {
      // Best effort
    }
  }

  /**
   * Revoke all access tokens for a user by storing a "revoked-before" timestamp.
   * Any token issued before this timestamp is considered invalid.
   */
  /** Parse a duration string like '15m', '1h', '7d' to seconds */
  private static parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // default 1 hour
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600;
    }
  }

  static async revokeAllAccessTokensForUser(userId: string): Promise<void> {
    // Store the current epoch; tokens issued before this are invalid
    const revokedAt = Math.floor(Date.now() / 1000);
    // TTL matches the max access token lifetime so the entry auto-expires
    const ttl = JwtUtils.parseDurationToSeconds(config.jwt.expiresIn);
    await cacheService.set(`${TOKEN_BLACKLIST_PREFIX}:user:${userId}`, revokedAt, { ttl });
  }

  /**
   * Check if a token's JTI has been blacklisted.
   */
  static async isTokenRevoked(payload: JwtPayload): Promise<boolean> {
    if (payload.jti) {
      const revoked = await cacheService.get(`${TOKEN_BLACKLIST_PREFIX}:${payload.jti}`);
      if (revoked) return true;
    }
    // Check user-level revocation
    const userRevokedAt = await cacheService.get<number>(`${TOKEN_BLACKLIST_PREFIX}:user:${payload.userId}`);
    if (userRevokedAt) {
      const iat = payload.iat || 0;
      if (iat < userRevokedAt) return true;
    }
    return false;
  }

  /**
   * Generate a short-lived JWT for an employee who has verified their email OTP.
   * Used to authenticate the public onboarding registration endpoints.
   */
  static generateOnboardingSessionToken(employeeId: string, inviteToken: string): string {
    return jwt.sign(
      { employeeId, inviteToken },
      config.jwt.secret,
      {
        expiresIn: '2h',
        issuer: 'projectflow-api',
        audience: 'onboarding-session',
      } as jwt.SignOptions
    );
  }

  static verifyOnboardingSessionToken(token: string): { employeeId: string; inviteToken: string } {
    try {
      return jwt.verify(token, config.jwt.secret, {
        issuer: 'projectflow-api',
        audience: 'onboarding-session',
      }) as { employeeId: string; inviteToken: string };
    } catch {
      throw new Error('Invalid or expired onboarding session token');
    }
  }

  static generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static generateEmailVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
