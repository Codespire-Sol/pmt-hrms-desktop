import { attachmentsRepository } from './attachments.repository';
import { storageService, MulterFile } from '../../services/storage.service';
import { AttachmentWithUrls, AttachmentVersionHistory } from './attachments.types';
import { commentsService } from '../comments/comments.service';
import { prisma } from '../../database/prisma';
import { webhooksService } from '../webhooks/webhooks.service';
import { usersService } from '../users/users.service';
import { logger } from '../../utils/logger';
import { normalizeMediaUrl } from '../../utils/media-url';
import { config } from '../../config';

const API_PREFIX = `/api/${config.apiVersion}`;

/** Build an ID-based file URL with no extension — nginx won't intercept it. */
function buildAttachmentFileUrl(attachmentId: string): string {
  return `${API_PREFIX}/attachments/${attachmentId}/file`;
}

/** Build an ID-based thumbnail URL with no extension. */
function buildAttachmentThumbnailUrl(attachmentId: string): string {
  return `${API_PREFIX}/attachments/${attachmentId}/thumbnail`;
}

const MAX_FILES_PER_UPLOAD = 10;

export const attachmentsService = {
  // Upload attachments to an issue
  async uploadToIssue(
    issueId: string,
    files: MulterFile[],
    userId: string
  ): Promise<AttachmentWithUrls[]> {
    if (files.length === 0) {
      throw new Error('No files provided');
    }

    if (files.length > MAX_FILES_PER_UPLOAD) {
      throw new Error(`Maximum ${MAX_FILES_PER_UPLOAD} files allowed per upload`);
    }

    // Upload files to storage
    const uploadResults = await storageService.uploadFiles(files, userId);

    // Create attachment records
    const inputs = uploadResults.map((result) => ({
      issueId,
      uploadedBy: userId,
      ...result,
    }));

    const attachments = await attachmentsRepository.createMany(inputs);

    // Log activity
    await commentsService.logActivity({
      issueId,
      userId,
      action: 'attachment_added',
      metadata: {
        count: attachments.length,
        filenames: attachments.map((a) => a.originalFilename),
      },
    });

    const withUrls = this.addUrlsToAttachments(attachments);

    try {
      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: { projectId: true },
      });

      if (issue?.projectId) {
        const actor = await usersService.getUserById(userId);
        const actorInfo = actor
          ? { id: actor.id, displayName: actor.displayName, email: actor.email }
          : undefined;

        await webhooksService.triggerWebhook(
          issue.projectId,
          'attachment.created',
          { issueId, attachments: withUrls },
          actorInfo
        );
      }
    } catch (error) {
      logger.warn('Failed to trigger attachment.created webhook', { error });
    }

    return withUrls;
  },

  // Upload attachments to a comment
  async uploadToComment(
    commentId: string,
    files: MulterFile[],
    userId: string
  ): Promise<AttachmentWithUrls[]> {
    if (files.length === 0) {
      throw new Error('No files provided');
    }

    if (files.length > 5) {
      throw new Error('Maximum 5 files allowed per comment');
    }

    // Upload files to storage
    const uploadResults = await storageService.uploadFiles(files, userId);

    // Create attachment records
    const inputs = uploadResults.map((result) => ({
      commentId,
      uploadedBy: userId,
      ...result,
    }));

    const attachments = await attachmentsRepository.createMany(inputs);

    const withUrls = this.addUrlsToAttachments(attachments);

    try {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { issueId: true },
      });
      const issue = comment?.issueId
        ? await prisma.issue.findUnique({
            where: { id: comment.issueId },
            select: { projectId: true },
          })
        : null;

      if (issue?.projectId) {
        const actor = await usersService.getUserById(userId);
        const actorInfo = actor
          ? { id: actor.id, displayName: actor.displayName, email: actor.email }
          : undefined;

        await webhooksService.triggerWebhook(
          issue.projectId,
          'attachment.created',
          { commentId, attachments: withUrls },
          actorInfo
        );
      }
    } catch (error) {
      logger.warn('Failed to trigger attachment.created webhook', { error });
    }

    return withUrls;
  },

  // Get attachments for an issue
  async getByIssue(issueId: string): Promise<AttachmentWithUrls[]> {
    const attachments = await attachmentsRepository.getByIssueId(issueId);
    return this.addUrlsToAttachments(attachments);
  },

  // Get attachments for a comment
  async getByComment(commentId: string): Promise<AttachmentWithUrls[]> {
    const attachments = await attachmentsRepository.getByCommentId(commentId);
    return this.addUrlsToAttachments(attachments);
  },

  // Get attachment by ID with URLs
  async getById(attachmentId: string): Promise<AttachmentWithUrls | null> {
    const attachment = await attachmentsRepository.getByIdWithUploader(attachmentId);
    if (!attachment) return null;

    const [withUrls] = this.addUrlsToAttachments([attachment]);
    return withUrls;
  },

  // Get download URL for an attachment
  async getDownloadUrl(attachmentId: string): Promise<{ url: string; filename: string }> {
    const attachment = await attachmentsRepository.getById(attachmentId);

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    return {
      url: buildAttachmentFileUrl(attachmentId),
      filename: attachment.originalFilename,
    };
  },

  // Delete an attachment
  async delete(attachmentId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    const attachment = await attachmentsRepository.getById(attachmentId);

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Check ownership or admin
    if (attachment.uploadedBy !== userId && !isAdmin) {
      throw new Error('You can only delete your own attachments');
    }

    // Soft delete in database
    await attachmentsRepository.delete(attachmentId);

    // Delete from storage
    await storageService.deleteFileWithThumbnail(
      attachment.storagePath,
      attachment.thumbnailPath
    );

    // Log activity if attached to issue
    if (attachment.issueId) {
      await commentsService.logActivity({
        issueId: attachment.issueId,
        userId,
        action: 'attachment_removed',
        metadata: {
          filename: attachment.originalFilename,
        },
      });
    }

    try {
      const issue = attachment.issueId
        ? await prisma.issue.findUnique({
            where: { id: attachment.issueId },
            select: { projectId: true },
          })
        : attachment.commentId
        ? await prisma.comment
            .findUnique({
              where: { id: attachment.commentId },
              select: { issueId: true },
            })
            .then((comment) =>
              comment?.issueId
                ? prisma.issue.findUnique({
                    where: { id: comment.issueId },
                    select: { projectId: true },
                  })
                : null
            )
        : null;

      if (issue?.projectId) {
        const actor = await usersService.getUserById(userId);
        const actorInfo = actor
          ? { id: actor.id, displayName: actor.displayName, email: actor.email }
          : undefined;

        await webhooksService.triggerWebhook(
          issue.projectId,
          'attachment.deleted',
          attachment,
          actorInfo
        );
      }
    } catch (error) {
      logger.warn('Failed to trigger attachment.deleted webhook', { error });
    }
  },

  // Helper: Add URLs to attachments
  addUrlsToAttachments(attachments: any[]): AttachmentWithUrls[] {
    return attachments.map((attachment) => ({
      ...attachment,
      // ID-based URLs: no file extension in path so nginx does not intercept
      // them with a static-asset rule (same pattern as /users/avatars/:userId).
      downloadUrl: buildAttachmentFileUrl(attachment.id),
      thumbnailUrl: attachment.thumbnailPath
        ? buildAttachmentThumbnailUrl(attachment.id)
        : null,
      // Normalize uploader avatar so it routes through /api proxy
      ...(attachment.uploader
        ? {
            uploader: {
              ...attachment.uploader,
              avatarUrl: normalizeMediaUrl(attachment.uploader.avatarUrl),
            },
          }
        : {}),
    }));
  },

  // Get allowed file types
  getAllowedTypes(): string[] {
    return storageService.getAllowedMimeTypes();
  },

  // Get max file size
  getMaxFileSize(): number {
    return storageService.getMaxFileSize();
  },

  // Upload a new version of an existing attachment
  async uploadNewVersion(
    attachmentId: string,
    file: MulterFile,
    userId: string,
    versionNotes?: string
  ): Promise<AttachmentWithUrls> {
    // Get the existing attachment
    const existingAttachment = await attachmentsRepository.getById(attachmentId);
    if (!existingAttachment) {
      throw new Error('Attachment not found');
    }

    // Upload the new file to storage
    const [uploadResult] = await storageService.uploadFiles([file], userId);

    // Create the new version
    const newVersion = await attachmentsRepository.createVersion(attachmentId, {
      issueId: existingAttachment.issueId,
      commentId: existingAttachment.commentId,
      uploadedBy: userId,
      filename: uploadResult.filename,
      originalFilename: uploadResult.originalFilename,
      mimeType: uploadResult.mimeType,
      fileSize: uploadResult.fileSize,
      storagePath: uploadResult.storagePath,
      thumbnailPath: uploadResult.thumbnailPath,
      metadata: uploadResult.metadata,
      versionNotes,
    });

    // Log activity if attached to issue
    if (existingAttachment.issueId) {
      await commentsService.logActivity({
        issueId: existingAttachment.issueId,
        userId,
        action: 'attachment_version_added',
        metadata: {
          filename: existingAttachment.originalFilename,
          version: newVersion.versionNumber,
          versionNotes,
        },
      });
    }

    const [withUrls] = this.addUrlsToAttachments([newVersion]);
    return withUrls;
  },

  // Get version history for an attachment
  async getVersionHistory(attachmentId: string): Promise<AttachmentVersionHistory> {
    const versions = await attachmentsRepository.getVersionHistory(attachmentId);

    if (versions.length === 0) {
      throw new Error('Attachment not found');
    }

    const firstVersion = versions[versions.length - 1]; // Oldest version
    const latestVersion = versions[0]; // Newest version

    return {
      attachmentId: firstVersion.id,
      originalFilename: firstVersion.original_filename,
      totalVersions: versions.length,
      latestVersion: latestVersion.version_number,
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.version_number,
        versionNotes: v.version_notes,
        fileSize: v.file_size,
        uploadedBy: v.uploaded_by,
        uploaderDisplayName: v.uploader_display_name,
        uploaderAvatarUrl: normalizeMediaUrl(v.uploader_avatar_url),
        createdAt: v.created_at,
        downloadUrl: buildAttachmentFileUrl(v.id),
        isLatestVersion: v.is_latest_version,
      })),
    };
  },

  // Get the latest version of an attachment
  async getLatestVersion(attachmentId: string): Promise<AttachmentWithUrls | null> {
    const latest = await attachmentsRepository.getLatestVersion(attachmentId);
    if (!latest) return null;

    const [withUrls] = this.addUrlsToAttachments([latest]);
    return withUrls;
  },

  // Revert to a specific version (creates a new version from the old one)
  async revertToVersion(
    attachmentId: string,
    targetVersionId: string,
    userId: string
  ): Promise<AttachmentWithUrls> {
    // Get the target version
    const targetVersion = await attachmentsRepository.getById(targetVersionId);
    if (!targetVersion) {
      throw new Error('Target version not found');
    }

    // Create a new version based on the target
    const revertedVersion = await attachmentsRepository.createVersion(attachmentId, {
      issueId: targetVersion.issueId,
      commentId: targetVersion.commentId,
      uploadedBy: userId,
      filename: targetVersion.filename,
      originalFilename: targetVersion.originalFilename,
      mimeType: targetVersion.mimeType,
      fileSize: targetVersion.fileSize,
      storagePath: targetVersion.storagePath,
      thumbnailPath: targetVersion.thumbnailPath,
      metadata: targetVersion.metadata,
      versionNotes: `Reverted to version ${targetVersion.versionNumber}`,
    });

    // Log activity if attached to issue
    if (targetVersion.issueId) {
      await commentsService.logActivity({
        issueId: targetVersion.issueId,
        userId,
        action: 'attachment_version_reverted',
        metadata: {
          filename: targetVersion.originalFilename,
          revertedToVersion: targetVersion.versionNumber,
          newVersion: revertedVersion.versionNumber,
        },
      });
    }

    const [withUrls] = this.addUrlsToAttachments([revertedVersion]);
    return withUrls;
  },
};
