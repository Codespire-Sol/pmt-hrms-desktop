import { prisma } from '../../database/prisma';
import crypto from 'crypto';

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  device_info?: any;
  ip_address?: string | null;
  expires_at: Date;
  revoked_at?: Date | null;
  created_at: Date;
}

export interface CreateRefreshTokenInput {
  userId: string;
  token: string;
  deviceInfo?: any;
  ipAddress?: string;
  expiresAt: Date;
}

export class RefreshTokensRepository {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async create(input: CreateRefreshTokenInput): Promise<RefreshToken> {
    const tokenHash = this.hashToken(input.token);
    const deviceInfo = input.deviceInfo ? JSON.stringify(input.deviceInfo) : null;
    const ipAddress = input.ipAddress ?? null;
    const expiresAt = input.expiresAt;
    const userId = input.userId;

    const result = await prisma.$queryRaw<RefreshToken[]>`
      INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
      VALUES (${userId}::uuid, ${tokenHash}, ${deviceInfo}::jsonb, ${ipAddress}, ${expiresAt})
      RETURNING *
    `;

    return result[0];
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    const tokenHash = this.hashToken(token);
    const now = new Date();

    const result = await prisma.$queryRaw<RefreshToken[]>`
      SELECT * FROM refresh_tokens
      WHERE token_hash = ${tokenHash}
        AND revoked_at IS NULL
        AND expires_at > ${now}
      LIMIT 1
    `;

    return result[0] || null;
  }

  async revoke(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const now = new Date();

    await prisma.$executeRaw`
      UPDATE refresh_tokens
      SET revoked_at = ${now}
      WHERE token_hash = ${tokenHash}
    `;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const now = new Date();

    await prisma.$executeRaw`
      UPDATE refresh_tokens
      SET revoked_at = ${now}
      WHERE user_id = ${userId}::uuid
        AND revoked_at IS NULL
    `;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();

    const deleted = await prisma.$executeRaw`
      DELETE FROM refresh_tokens
      WHERE expires_at < ${now}
        OR revoked_at IS NOT NULL
    `;

    return deleted;
  }
}
