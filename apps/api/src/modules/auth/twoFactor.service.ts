/**
 * Two-Factor Authentication Service
 * Implements TOTP (Time-based One-Time Password) using RFC 6238
 */

import crypto from 'crypto';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';

// TOTP Configuration
const TOTP_WINDOW = 1; // Allow 1 step before/after current time
const TOTP_STEP = 30; // 30 second intervals
const TOTP_DIGITS = 6;
const BACKUP_CODES_COUNT = 10;

interface TwoFactorSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

interface TwoFactorStatus {
  enabled: boolean;
  hasBackupCodes: boolean;
  backupCodesRemaining: number;
}

export class TwoFactorService {
  /**
   * Generate a random base32 secret for TOTP
   */
  private generateSecret(): string {
    const buffer = crypto.randomBytes(20);
    return this.base32Encode(buffer);
  }

  /**
   * Base32 encode a buffer
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Base32 decode a string
   */
  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanedInput = encoded.replace(/=+$/, '').toUpperCase();

    let bits = 0;
    let value = 0;
    let index = 0;
    const output = Buffer.alloc(Math.floor((cleanedInput.length * 5) / 8));

    for (let i = 0; i < cleanedInput.length; i++) {
      const idx = alphabet.indexOf(cleanedInput[i]);
      if (idx === -1) continue;

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        output[index++] = (value >>> (bits - 8)) & 255;
        bits -= 8;
      }
    }

    return output.slice(0, index);
  }

  /**
   * Generate TOTP code for a given time
   */
  private generateTOTP(secret: string, time?: number): string {
    const counter = Math.floor((time || Date.now()) / 1000 / TOTP_STEP);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const decodedSecret = this.base32Decode(secret);
    const hmac = crypto.createHmac('sha1', decodedSecret);
    hmac.update(counterBuffer);
    const hmacResult = hmac.digest();

    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const code =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    const otp = code % Math.pow(10, TOTP_DIGITS);
    return otp.toString().padStart(TOTP_DIGITS, '0');
  }

  /**
   * Verify a TOTP code
   */
  verifyTOTP(secret: string, code: string): boolean {
    const now = Date.now();

    // Check current window and adjacent windows
    for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
      const time = now + i * TOTP_STEP * 1000;
      const expectedCode = this.generateTOTP(secret, time);
      if (expectedCode === code) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash a backup code for storage
   */
  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
  }

  /**
   * Generate QR code URL for authenticator apps
   */
  private generateQRCodeUrl(secret: string, email: string, issuer: string): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP}`;
  }

  /**
   * Initialize 2FA setup for a user
   */
  async setupTwoFactor(userId: string, email: string): Promise<TwoFactorSetupResult> {
    // Check if 2FA is already enabled
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.twoFactorEnabled) {
      throw ApiError.badRequest('Two-factor authentication is already enabled', '2FA_ALREADY_ENABLED');
    }

    // Generate secret
    const secret = this.generateSecret();

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Store secret temporarily (not enabled yet)
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        updatedAt: new Date(),
      },
    });

    // Store hashed backup codes
    await prisma.twoFactorBackupCode.deleteMany({
      where: { userId },
    });
    const backupCodeRecords = backupCodes.map((code) => ({
      userId,
      code: this.hashBackupCode(code),
      createdAt: new Date(),
    }));
    await prisma.twoFactorBackupCode.createMany({
      data: backupCodeRecords,
    });

    // Generate QR code URL
    const qrCodeUrl = this.generateQRCodeUrl(secret, email, 'ProjectFlow');

    logger.info(`2FA setup initiated for user: ${userId}`);

    return {
      secret,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Verify and enable 2FA
   */
  async enableTwoFactor(userId: string, code: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.twoFactorEnabled) {
      throw ApiError.badRequest('Two-factor authentication is already enabled', '2FA_ALREADY_ENABLED');
    }

    if (!user.twoFactorSecret) {
      throw ApiError.badRequest('Please initiate 2FA setup first', '2FA_NOT_SETUP');
    }

    // Verify the code
    if (!this.verifyTOTP(user.twoFactorSecret, code)) {
      throw ApiError.badRequest('Invalid verification code', 'INVALID_2FA_CODE');
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        updatedAt: new Date(),
      },
    });

    logger.info(`2FA enabled for user: ${userId}`);
  }

  /**
   * Disable 2FA
   */
  async disableTwoFactor(userId: string, code: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw ApiError.badRequest('Two-factor authentication is not enabled', '2FA_NOT_ENABLED');
    }

    // Verify the code
    if (!this.verifyTOTP(user.twoFactorSecret!, code)) {
      throw ApiError.badRequest('Invalid verification code', 'INVALID_2FA_CODE');
    }

    // Disable 2FA and clear secret
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date(),
      },
    });

    // Delete backup codes
    await prisma.twoFactorBackupCode.deleteMany({
      where: { userId },
    });

    logger.info(`2FA disabled for user: ${userId}`);
  }

  /**
   * Verify 2FA code during login
   */
  async verifyTwoFactorLogin(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    // First try TOTP code
    if (this.verifyTOTP(user.twoFactorSecret, code)) {
      return true;
    }

    // Try backup code
    const codeHash = this.hashBackupCode(code);
    const backupCode = await prisma.twoFactorBackupCode.findFirst({
      where: {
        userId,
        code: codeHash,
        usedAt: null,
      },
    });

    if (backupCode) {
      // Mark backup code as used
      await prisma.twoFactorBackupCode.update({
        where: { id: backupCode.id },
        data: { usedAt: new Date() },
      });

      logger.info(`Backup code used for user: ${userId}`);
      return true;
    }

    return false;
  }

  /**
   * Get 2FA status for a user
   */
  async getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const backupCodesCount = await prisma.twoFactorBackupCode.count({
      where: {
        userId,
        usedAt: null,
      },
    });

    return {
      enabled: user.twoFactorEnabled || false,
      hasBackupCodes: backupCodesCount > 0,
      backupCodesRemaining: backupCodesCount,
    };
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, code: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw ApiError.badRequest('Two-factor authentication is not enabled', '2FA_NOT_ENABLED');
    }

    // Verify the code
    if (!this.verifyTOTP(user.twoFactorSecret!, code)) {
      throw ApiError.badRequest('Invalid verification code', 'INVALID_2FA_CODE');
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodes();

    // Delete old backup codes and insert new ones
    await prisma.twoFactorBackupCode.deleteMany({
      where: { userId },
    });
    const backupCodeRecords = backupCodes.map((backupCode) => ({
      userId,
      code: this.hashBackupCode(backupCode),
      createdAt: new Date(),
    }));
    await prisma.twoFactorBackupCode.createMany({
      data: backupCodeRecords,
    });

    logger.info(`Backup codes regenerated for user: ${userId}`);

    return backupCodes;
  }

  /**
   * Check if user has 2FA enabled
   */
  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return user?.twoFactorEnabled || false;
  }
}

export const twoFactorService = new TwoFactorService();
