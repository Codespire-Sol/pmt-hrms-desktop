import { Request, Response, NextFunction } from 'express';
import { twoFactorService } from './twoFactor.service';
import { twoFactorVerifySchema } from './auth.validator';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { ZodError } from 'zod';

export class TwoFactorController {
  /**
   * POST /api/v1/auth/2fa/setup
   * Initialize 2FA setup - returns secret and QR code
   */
  setup = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const result = await twoFactorService.setupTwoFactor(req.user.id, req.user.email);

    return ApiResponse.success(
      res,
      {
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes,
      },
      'Two-factor authentication setup initiated. Scan the QR code with your authenticator app.'
    );
  });

  /**
   * POST /api/v1/auth/2fa/enable
   * Verify code and enable 2FA
   */
  enable = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    try {
      const input = twoFactorVerifySchema.parse(req.body);
      await twoFactorService.enableTwoFactor(req.user.id, input.code);

      return ApiResponse.success(res, null, 'Two-factor authentication enabled successfully');
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw ApiError.badRequest('Validation failed', 'VALIDATION_ERROR', details);
      }
      throw error;
    }
  });

  /**
   * POST /api/v1/auth/2fa/disable
   * Disable 2FA (requires verification code)
   */
  disable = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    try {
      const input = twoFactorVerifySchema.parse(req.body);
      await twoFactorService.disableTwoFactor(req.user.id, input.code);

      return ApiResponse.success(res, null, 'Two-factor authentication disabled successfully');
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw ApiError.badRequest('Validation failed', 'VALIDATION_ERROR', details);
      }
      throw error;
    }
  });

  /**
   * POST /api/v1/auth/2fa/verify
   * Verify 2FA code (for login flow)
   */
  verify = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { userId, code } = req.body;

    if (!userId || !code) {
      throw ApiError.badRequest('User ID and code are required');
    }

    const isValid = await twoFactorService.verifyTwoFactorLogin(userId, code);

    if (!isValid) {
      throw ApiError.unauthorized('Invalid verification code', 'INVALID_2FA_CODE');
    }

    return ApiResponse.success(res, { verified: true }, 'Two-factor authentication verified');
  });

  /**
   * GET /api/v1/auth/2fa/status
   * Get 2FA status for current user
   */
  status = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const status = await twoFactorService.getTwoFactorStatus(req.user.id);

    return ApiResponse.success(res, status, 'Two-factor authentication status retrieved');
  });

  /**
   * POST /api/v1/auth/2fa/backup-codes
   * Regenerate backup codes (requires verification code)
   */
  regenerateBackupCodes = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    try {
      const input = twoFactorVerifySchema.parse(req.body);
      const backupCodes = await twoFactorService.regenerateBackupCodes(req.user.id, input.code);

      return ApiResponse.success(
        res,
        { backupCodes },
        'Backup codes regenerated successfully. Store them safely.'
      );
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw ApiError.badRequest('Validation failed', 'VALIDATION_ERROR', details);
      }
      throw error;
    }
  });
}

export const twoFactorController = new TwoFactorController();
