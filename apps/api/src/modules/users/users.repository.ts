import { prisma } from '../../database/prisma';
import { User as PrismaUser } from '@prisma/client';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  phone?: string | null;
  timezone: string;
  locale: string;
  is_active: boolean;
  is_verified: boolean;
  email_verified_at?: Date | null;
  last_login_at?: Date | null;
  failed_login_attempts: number;
  locked_until?: Date | null;
  password_changed_at: Date;
  two_factor_enabled: boolean;
  two_factor_secret?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface CreateUserInput {
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  is_verified?: boolean;
}

export interface UpdateUserInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
  phone?: string | null;
  timezone?: string;
  locale?: string;
  is_active?: boolean;
  is_verified?: boolean;
}

function toSnakeCaseUser(prismaUser: PrismaUser): User {
  return {
    id: prismaUser.id,
    email: prismaUser.email,
    password_hash: prismaUser.passwordHash,
    first_name: prismaUser.firstName,
    last_name: prismaUser.lastName,
    avatar_url: prismaUser.avatarUrl,
    phone: prismaUser.phone,
    timezone: prismaUser.timezone ?? 'UTC',
    locale: prismaUser.locale ?? 'en',
    is_active: prismaUser.isActive,
    is_verified: prismaUser.isVerified,
    email_verified_at: prismaUser.emailVerifiedAt,
    last_login_at: prismaUser.lastLoginAt,
    failed_login_attempts: prismaUser.failedLoginAttempts,
    locked_until: prismaUser.lockedUntil,
    password_changed_at: prismaUser.passwordChangedAt as Date,
    two_factor_enabled: prismaUser.twoFactorEnabled,
    two_factor_secret: prismaUser.twoFactorSecret,
    created_at: prismaUser.createdAt,
    updated_at: prismaUser.updatedAt,
    deleted_at: prismaUser.deletedAt,
  };
}

export class UsersRepository {
  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    return user ? toSnakeCaseUser(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    return user ? toSnakeCaseUser(user) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.password_hash,
        firstName: input.first_name,
        lastName: input.last_name,
        ...(input.avatar_url !== undefined && { avatarUrl: input.avatar_url }),
        ...(input.is_verified !== undefined && { isVerified: input.is_verified }),
      },
    });

    return toSnakeCaseUser(user);
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const existing = await prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new Error('User not found');
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(input.email !== undefined && { email: input.email.toLowerCase() }),
        ...(input.first_name !== undefined && { firstName: input.first_name }),
        ...(input.last_name !== undefined && { lastName: input.last_name }),
        ...(input.avatar_url !== undefined && { avatarUrl: input.avatar_url }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.timezone !== undefined && { timezone: input.timezone }),
        ...(input.locale !== undefined && { locale: input.locale }),
        ...(input.is_active !== undefined && { isActive: input.is_active }),
        ...(input.is_verified !== undefined && { isVerified: input.is_verified }),
      },
    });

    return toSnakeCaseUser(user);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
      },
    });
  }

  async incrementFailedLoginAttempts(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: { increment: 1 },
      },
    });
  }

  async lockAccount(id: string, lockDuration: number = 15): Promise<void> {
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + lockDuration);

    await prisma.user.update({
      where: { id },
      data: { lockedUntil },
    });
  }

  async verifyEmail(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        isVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }
}
