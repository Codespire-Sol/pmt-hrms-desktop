import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { usersService } from './users.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { storageService, MulterFile } from '../../services/storage.service';
import { prisma } from '../../database/prisma';

class UsersController {
  private getAvatarPlaceholderSvg(firstName: string | null, lastName: string | null): string {
    const a = (firstName || '').trim().charAt(0).toUpperCase();
    const b = (lastName || '').trim().charAt(0).toUpperCase();
    const initials = (a + b) || 'U';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="Avatar">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#g)"/>
  <circle cx="128" cy="104" r="44" fill="#DBEAFE" opacity="0.95"/>
  <rect x="60" y="158" width="136" height="56" rx="28" fill="#DBEAFE" opacity="0.95"/>
  <text x="128" y="146" text-anchor="middle" fill="#1E3A8A" font-size="44" font-family="Arial, sans-serif" font-weight="700">${initials}</text>
</svg>`;
  }

  // Public avatar fetch endpoint
  async getAvatar(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    if (!/^[0-9a-fA-F-]{8,}$/.test(userId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid avatar user id',
        },
      });
      return;
    }

    const base = path.join(storageService.getStorageDir(), 'avatars');
    const candidateFiles = new Set<string>([
      `${userId}.jpg`,
      `${userId}.jpeg`,
      `${userId}.png`,
      `${userId}.webp`,
    ]);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, avatarUrl: true },
    });

    if (user?.avatarUrl) {
      let avatarPath = user.avatarUrl;
      if (/^https?:\/\//i.test(avatarPath)) {
        try {
          avatarPath = new URL(avatarPath).pathname;
        } catch {
          avatarPath = user.avatarUrl;
        }
      }

      const match = avatarPath.match(/\/avatars\/([^/?#]+)/i);
      if (match?.[1]) {
        candidateFiles.add(decodeURIComponent(match[1]));
      }
    }

    for (const filename of candidateFiles) {
      const avatarPath = path.join(base, filename);
      if (fs.existsSync(avatarPath)) {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        res.sendFile(avatarPath);
        return;
      }
    }

    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.type('image/svg+xml').status(200).send(
      this.getAvatarPlaceholderSvg(user?.firstName || null, user?.lastName || null)
    );
  }

  // Current user's avatar on same path family used for upload
  async getMyAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    req.params.userId = userId;
    await this.getAvatar(req as unknown as Request, res);
  }

  // Get current user's profile
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const profile = await usersService.getProfile(userId);

    res.json({
      success: true,
      data: profile,
    });
  }

  // Update current user's profile
  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const profile = await usersService.updateProfile(userId, req.body);

    res.json({
      success: true,
      data: profile,
    });
  }

  // Update current user's avatar (via URL)
  async updateAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { avatarUrl } = req.body;
    const profile = await usersService.updateAvatar(userId, avatarUrl);

    res.json({
      success: true,
      data: profile,
    });
  }

  // Upload and update current user's avatar (file upload)
  async uploadAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const file = req.file as MulterFile | undefined;

    if (!file) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded',
        },
      });
      return;
    }

    try {
      // Upload and process avatar
      const { avatarUrl } = await storageService.uploadAvatar(file, userId);

      // Update user's avatar URL in database
      const profile = await usersService.updateAvatar(userId, avatarUrl);

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: error.message || 'Failed to upload avatar',
        },
      });
    }
  }

  // Delete current user's avatar
  async deleteAvatar(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;

    try {
      // Delete avatar file
      await storageService.deleteAvatar(userId);

      // Clear avatar URL in database
      const profile = await usersService.updateAvatar(userId, null);

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: error.message || 'Failed to delete avatar',
        },
      });
    }
  }

  // Get a specific user by ID (admin or for viewing profiles)
  async getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.params;
    const user = await usersService.getUserById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  }

  // List users with search and pagination
  async listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    const params = {
      search: req.query.search as string | undefined,
      scope: req.query.scope as 'pmt' | 'hrms' | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      isVerified: req.query.isVerified === 'true' ? true : req.query.isVerified === 'false' ? false : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      sortBy: req.query.sortBy as 'firstName' | 'lastName' | 'email' | 'createdAt' | 'lastLoginAt' | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };

    const result = await usersService.listUsers(params);

    res.json({
      success: true,
      data: result,
    });
  }

  // Get current user's preferences
  async getPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const preferences = await usersService.getPreferences(userId);

    res.json({
      success: true,
      data: preferences,
    });
  }

  // Update another user's active status (admin only)
  async updateUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await usersService.updateUserStatus(userId, { isActive });

    res.json({
      success: true,
      data: user,
    });
  }

  // Update user details (admin only)
  async updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.params;
    const user = await usersService.updateUser(userId, req.body);

    res.json({
      success: true,
      data: user,
    });
  }

  // Update current user's preferences
  async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const preferences = await usersService.updatePreferences(userId, req.body);

    res.json({
      success: true,
      data: preferences,
    });
  }

  // Deactivate current user's account
  async deactivateAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    await usersService.deactivateAccount(userId);

    res.json({
      success: true,
      message: 'Account deactivated successfully',
    });
  }

  // Search users for mentions
  async searchForMention(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { search, projectId } = req.query;
    const users = await usersService.searchUsersForMention(
      search as string || '',
      projectId as string | undefined,
      10
    );

    res.json({
      success: true,
      data: users,
    });
  }
}

export const usersController = new UsersController();
