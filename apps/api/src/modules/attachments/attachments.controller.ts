import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { attachmentsService } from './attachments.service';
import { MulterFile, storageService } from '../../services/storage.service';
import { attachmentsRepository } from './attachments.repository';

export const attachmentsController = {
  // Upload attachments to issue
  async uploadToIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { issueId } = req.params;
      const files = req.files as MulterFile[];
      const userId = req.user!.id;

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: { message: 'No files provided' },
        });
        return;
      }

      const attachments = await attachmentsService.uploadToIssue(issueId, files, userId);

      res.status(201).json({
        success: true,
        data: attachments,
      });
    } catch (error: any) {
      if (error.message.includes('not allowed') || error.message.includes('exceeds')) {
        res.status(400).json({
          success: false,
          error: { message: error.message },
        });
        return;
      }
      next(error);
    }
  },

  // Upload attachments to comment
  async uploadToComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const files = req.files as MulterFile[];
      const userId = req.user!.id;

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: { message: 'No files provided' },
        });
        return;
      }

      const attachments = await attachmentsService.uploadToComment(commentId, files, userId);

      res.status(201).json({
        success: true,
        data: attachments,
      });
    } catch (error: any) {
      if (error.message.includes('not allowed') || error.message.includes('exceeds')) {
        res.status(400).json({
          success: false,
          error: { message: error.message },
        });
        return;
      }
      next(error);
    }
  },

  // Get attachments for issue
  async getByIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { issueId } = req.params;

      const attachments = await attachmentsService.getByIssue(issueId);

      res.json({
        success: true,
        data: attachments,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get attachments for comment
  async getByComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;

      const attachments = await attachmentsService.getByComment(commentId);

      res.json({
        success: true,
        data: attachments,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get download URL
  async getDownloadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;

      const result = await attachmentsService.getDownloadUrl(attachmentId);

      res.json({
        success: true,
        data: {
          url: result.url,
          filename: result.filename,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
      });
    } catch (error: any) {
      if (error.message === 'Attachment not found') {
        res.status(404).json({
          success: false,
          error: { message: 'Attachment not found' },
        });
        return;
      }
      next(error);
    }
  },

  // Get attachment details
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;

      const attachment = await attachmentsService.getById(attachmentId);

      if (!attachment) {
        res.status(404).json({
          success: false,
          error: { message: 'Attachment not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: attachment,
      });
    } catch (error) {
      next(error);
    }
  },

  // Delete attachment
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;
      const userId = req.user!.id;
      const isAdmin = req.user!.role?.name === 'admin';

      await attachmentsService.delete(attachmentId, userId, isAdmin);

      res.json({
        success: true,
        message: 'Attachment deleted',
      });
    } catch (error: any) {
      if (error.message === 'Attachment not found') {
        res.status(404).json({
          success: false,
          error: { message: 'Attachment not found' },
        });
        return;
      }
      if (error.message.includes('only delete your own')) {
        res.status(403).json({
          success: false,
          error: { message: error.message },
        });
        return;
      }
      next(error);
    }
  },

  // Get allowed file types and limits
  async getUploadConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          allowedTypes: attachmentsService.getAllowedTypes(),
          maxFileSize: attachmentsService.getMaxFileSize(),
          maxFilesPerUpload: 10,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Upload a new version of an attachment
  async uploadNewVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;
      const file = req.file as MulterFile;
      const userId = req.user!.id;
      const { versionNotes } = req.body;

      if (!file) {
        res.status(400).json({
          success: false,
          error: { message: 'No file provided' },
        });
        return;
      }

      const newVersion = await attachmentsService.uploadNewVersion(
        attachmentId,
        file,
        userId,
        versionNotes
      );

      res.status(201).json({
        success: true,
        data: newVersion,
      });
    } catch (error: any) {
      if (error.message === 'Attachment not found') {
        res.status(404).json({
          success: false,
          error: { message: 'Attachment not found' },
        });
        return;
      }
      if (error.message.includes('not allowed') || error.message.includes('exceeds')) {
        res.status(400).json({
          success: false,
          error: { message: error.message },
        });
        return;
      }
      next(error);
    }
  },

  // Get version history for an attachment
  async getVersionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;

      const history = await attachmentsService.getVersionHistory(attachmentId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      if (error.message === 'Attachment not found') {
        res.status(404).json({
          success: false,
          error: { message: 'Attachment not found' },
        });
        return;
      }
      next(error);
    }
  },

  // Get the latest version of an attachment
  async getLatestVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;

      const latest = await attachmentsService.getLatestVersion(attachmentId);

      if (!latest) {
        res.status(404).json({
          success: false,
          error: { message: 'Attachment not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: latest,
      });
    } catch (error) {
      next(error);
    }
  },

  // Serve attachment file directly by ID — no file extension in URL so nginx does
  // not intercept it with a static-asset rule (mirrors the /users/avatars/:userId pattern).
  async serveFile(req: Request, res: Response): Promise<void> {
    const { attachmentId } = req.params;

    const attachment = await attachmentsRepository.getById(attachmentId);
    if (!attachment || attachment.deletedAt) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Attachment not found' } });
      return;
    }

    const filePath = path.join(storageService.getStorageDir(), attachment.storagePath);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found on disk' } });
      return;
    }

    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(filePath);
  },

  // Serve thumbnail by attachment ID — same pattern, no extension in URL.
  async serveThumbnail(req: Request, res: Response): Promise<void> {
    const { attachmentId } = req.params;

    const attachment = await attachmentsRepository.getById(attachmentId);
    if (!attachment || attachment.deletedAt || !attachment.thumbnailPath) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Thumbnail not found' } });
      return;
    }

    const thumbPath = path.join(storageService.getStorageDir(), attachment.thumbnailPath);
    if (!fs.existsSync(thumbPath)) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Thumbnail not found on disk' } });
      return;
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(thumbPath);
  },

  // Revert to a specific version
  async revertToVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId, versionId } = req.params;
      const userId = req.user!.id;

      const revertedVersion = await attachmentsService.revertToVersion(
        attachmentId,
        versionId,
        userId
      );

      res.json({
        success: true,
        data: revertedVersion,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: { message: error.message },
        });
        return;
      }
      next(error);
    }
  },
};
