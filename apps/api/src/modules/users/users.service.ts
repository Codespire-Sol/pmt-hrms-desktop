import { UsersRepository } from './users.repository';
import { prisma } from '../../database/prisma';
import {
  UserProfile,
  UserListItem,
  UserListResponse,
  UpdateProfileInput,
  UserSearchParams,
  UserPreferences,
  UpdatePreferencesInput,
  UpdateUserStatusInput,
  UpdateUserInput,
} from './users.types';
import { AppError } from '../../middleware/errorHandler.middleware';
import { Prisma } from '@prisma/client';
import { normalizeMediaUrl } from '../../utils/media-url';

const usersRepository = new UsersRepository();

/** Append an ?v= cache-buster derived from the user's updated_at timestamp so browsers
 *  re-fetch the avatar image whenever it changes, without requiring a hard reload. */
function versionedAvatarUrl(rawUrl: string | null | undefined, updatedAt: Date | null | undefined): string | null {
  const normalized = normalizeMediaUrl(rawUrl);
  if (!normalized) return null;
  if (!updatedAt) return normalized;
  const v = new Date(updatedAt).getTime();
  // Only append version to avatar paths (not to external URLs)
  if (normalized.startsWith('/api/') || normalized.includes('/avatars/')) {
    const base = normalized.split('?')[0];
    return `${base}?v=${v}`;
  }
  return normalized;
}

class UsersService {
  async getProfile(userId: string): Promise<UserProfile> {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: `${user.first_name} ${user.last_name}`,
      avatarUrl: versionedAvatarUrl(user.avatar_url, user.updated_at),
      phone: user.phone,
      timezone: user.timezone,
      locale: user.locale,
      isVerified: user.is_verified,
      twoFactorEnabled: user.two_factor_enabled,
      createdAt: user.created_at,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const existingUser = await usersRepository.findById(userId);

    if (!existingUser) {
      throw new AppError(404, 'User not found');
    }

    const updateData: Record<string, unknown> = {};
    if (input.firstName !== undefined) updateData.first_name = input.firstName;
    if (input.lastName !== undefined) updateData.last_name = input.lastName;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.timezone !== undefined) updateData.timezone = input.timezone;
    if (input.locale !== undefined) updateData.locale = input.locale;

    const user = await usersRepository.update(userId, updateData as any);

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: `${user.first_name} ${user.last_name}`,
      avatarUrl: versionedAvatarUrl(user.avatar_url, user.updated_at),
      phone: user.phone,
      timezone: user.timezone,
      locale: user.locale,
      isVerified: user.is_verified,
      twoFactorEnabled: user.two_factor_enabled,
      createdAt: user.created_at,
    };
  }

  async updateAvatar(userId: string, avatarUrl: string | null): Promise<UserProfile> {
    const existingUser = await usersRepository.findById(userId);

    if (!existingUser) {
      throw new AppError(404, 'User not found');
    }

    const normalizedAvatarUrl = normalizeMediaUrl(avatarUrl);
    const user = await usersRepository.update(userId, { avatar_url: normalizedAvatarUrl } as any);

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: `${user.first_name} ${user.last_name}`,
      avatarUrl: versionedAvatarUrl(user.avatar_url, user.updated_at),
      phone: user.phone,
      timezone: user.timezone,
      locale: user.locale,
      isVerified: user.is_verified,
      twoFactorEnabled: user.two_factor_enabled,
      createdAt: user.created_at,
    };
  }

  async getUserById(userId: string): Promise<UserListItem | null> {
    const user = await usersRepository.findById(userId);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: `${user.first_name} ${user.last_name}`,
      avatarUrl: normalizeMediaUrl(user.avatar_url),
      isActive: user.is_active,
      isVerified: user.is_verified,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
    };
  }

  async listUsers(params: UserSearchParams): Promise<UserListResponse> {
    const {
      search,
      scope: _scope,
      isActive,
      isVerified,
      page = 1,
      limit = 20,
      sortBy = 'firstName',
      sortOrder = 'asc',
    } = params;

    // Build where conditions
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    // Apply filters
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isVerified !== undefined) {
      where.isVerified = isVerified;
    }

    // Count total
    const total = await prisma.user.count({ where });

    // Apply sorting
    const sortColumnMap: Record<string, string> = {
      firstName: 'firstName',
      lastName: 'lastName',
      email: 'email',
      createdAt: 'createdAt',
      lastLoginAt: 'lastLoginAt',
    };
    const sortColumn = sortColumnMap[sortBy] || 'firstName';

    // Apply pagination
    const offset = (page - 1) * limit;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { name: true } },
      },
      orderBy: { [sortColumn]: sortOrder },
      skip: offset,
      take: limit,
    });

    // Employee details are stored in HRMS table. Join by user_id for list response enrichment.
    const userIds = users.map((user) => user.id);
    const employeeRows = userIds.length > 0
      ? await prisma.$queryRaw<Array<{
          user_id: string;
          designation: string;
          department: string;
          deleted_at: Date | null;
        }>>`
        SELECT user_id, designation, department, deleted_at
        FROM employees
        WHERE user_id IN (${Prisma.join(userIds.map((id) => Prisma.sql`${id}::uuid`))})
      `
      : [];
    const employeeByUserId = new Map(
      employeeRows
        .filter((row) => row.deleted_at === null)
        .map((row) => [row.user_id, row])
    );

    // Enrich with PMT-scoped roles from system_settings
    const pmtRoleByUserId = new Map<string, { id: string; displayName: string }>();
    if (userIds.length > 0) {
      const settingKeys = userIds.map((uid) => `user_role:pmt:${uid}`);
      const scopedRows = await prisma.$queryRawUnsafe<Array<{ setting_key: string; setting_value: any }>>(
        `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${settingKeys.map((_, i) => `$${i + 1}`).join(', ')})`,
        ...settingKeys,
      );
      if (scopedRows.length > 0) {
        const roleIds = scopedRows
          .map((r) => {
            const val = typeof r.setting_value === 'string' ? JSON.parse(r.setting_value) : r.setting_value;
            return typeof val?.roleId === 'string' ? val.roleId : null;
          })
          .filter((id): id is string => Boolean(id));
        const roles = roleIds.length
          ? await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, displayName: true } })
          : [];
        const roleMap = new Map(roles.map((r) => [r.id, r]));
        for (const row of scopedRows) {
          const val = typeof row.setting_value === 'string' ? JSON.parse(row.setting_value) : row.setting_value;
          const roleId = typeof val?.roleId === 'string' ? val.roleId : null;
          if (!roleId) continue;
          const role = roleMap.get(roleId);
          if (!role) continue;
          const uid = row.setting_key.replace('user_role:pmt:', '');
          pmtRoleByUserId.set(uid, { id: role.id, displayName: role.displayName });
        }
      }
    }

    const userList: UserListItem[] = users.map((user) => {
      const employee = employeeByUserId.get(user.id);
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: `${user.firstName} ${user.lastName}`,
        avatarUrl: normalizeMediaUrl(user.avatarUrl),
        designation: employee?.designation ?? null,
        department: employee?.department ?? null,
        pmtRole: pmtRoleByUserId.get(user.id) ?? null,
        roleName: user.role?.name ?? null,
        isActive: user.isActive,
        isVerified: user.isVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      };
    });

    return {
      users: userList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const prefs = await prisma.dashboardPreference.findFirst({
      where: { userId },
    });

    // Return defaults if no preferences exist
    if (!prefs) {
      return {
        theme: 'system',
        emailNotifications: true,
        pushNotifications: true,
        weeklyDigest: false,
        mentionNotifications: true,
        issueAssignedNotifications: true,
        issueUpdatedNotifications: true,
        sprintNotifications: true,
      };
    }

    const settings = (prefs.settings as Record<string, unknown>) || {};

    return {
      theme: (settings.theme as UserPreferences['theme']) || 'system',
      emailNotifications: Boolean(settings.emailNotifications ?? true),
      pushNotifications: Boolean(settings.pushNotifications ?? true),
      weeklyDigest: Boolean(settings.weeklyDigest ?? false),
      mentionNotifications: Boolean(settings.mentionNotifications ?? true),
      issueAssignedNotifications: Boolean(settings.issueAssignedNotifications ?? true),
      issueUpdatedNotifications: Boolean(settings.issueUpdatedNotifications ?? true),
      sprintNotifications: Boolean(settings.sprintNotifications ?? true),
    };
  }

  async updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<UserPreferences> {
    const existingPrefs = await prisma.dashboardPreference.findFirst({
      where: { userId },
    });

    const currentSettings = (existingPrefs?.settings as Record<string, unknown>) || {};
    const updatedSettings = { ...currentSettings, ...input };

    if (existingPrefs) {
      await prisma.dashboardPreference.update({
        where: { id: existingPrefs.id },
        data: {
          settings: updatedSettings,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.dashboardPreference.create({
        data: {
          userId,
          settings: updatedSettings,
        },
      });
    }

    return this.getPreferences(userId);
  }

  async updateUserStatus(userId: string, input: UpdateUserStatusInput): Promise<UserListItem> {
    const existingUser = await usersRepository.findById(userId);

    if (!existingUser) {
      throw new AppError(404, 'User not found');
    }

    const user = await usersRepository.update(userId, { is_active: input.isActive } as any);

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: `${user.first_name} ${user.last_name}`,
      avatarUrl: normalizeMediaUrl(user.avatar_url),
      isActive: user.is_active,
      isVerified: user.is_verified,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
    };
  }

  async updateUser(userId: string, input: UpdateUserInput): Promise<UserListItem> {
    const existingUser = await usersRepository.findById(userId);

    if (!existingUser) {
      throw new AppError(404, 'User not found');
    }

    if (input.email) {
      const userByEmail = await usersRepository.findByEmail(input.email);
      if (userByEmail && userByEmail.id !== userId) {
        throw new AppError(409, 'Email already in use');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (input.email !== undefined) updateData.email = input.email;
    if (input.firstName !== undefined) updateData.first_name = input.firstName;
    if (input.lastName !== undefined) updateData.last_name = input.lastName;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;
    if (input.isVerified !== undefined) updateData.is_verified = input.isVerified;

    const user = await usersRepository.update(userId, updateData as any);

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: `${user.first_name} ${user.last_name}`,
      avatarUrl: normalizeMediaUrl(user.avatar_url),
      isActive: user.is_active,
      isVerified: user.is_verified,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
    };
  }

  async deactivateAccount(userId: string): Promise<void> {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    await usersRepository.softDelete(userId);
  }

  async searchUsersForMention(search: string, projectId?: string, limit: number = 10): Promise<UserListItem[]> {
    // Build where conditions
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      isActive: true,
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // If projectId is provided, filter to project members only
    if (projectId) {
      where.projectMemberships = {
        some: {
          projectId,
        },
      };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { firstName: 'asc' },
      take: limit,
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: `${user.firstName} ${user.lastName}`,
      avatarUrl: normalizeMediaUrl(user.avatarUrl),
      isActive: user.isActive,
      isVerified: user.isVerified,
      lastLoginAt: null,
      createdAt: user.createdAt,
    }));
  }
}

export const usersService = new UsersService();
