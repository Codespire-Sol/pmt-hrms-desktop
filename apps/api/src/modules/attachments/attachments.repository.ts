import { prisma } from '../../database/prisma';
import { Attachment, CreateAttachmentInput } from './attachments.types';

export const attachmentsRepository = {
  // Create a new attachment
  async create(input: CreateAttachmentInput): Promise<Attachment> {
    const attachment = await prisma.attachment.create({
      data: {
        issueId: input.issueId || null,
        commentId: input.commentId || null,
        uploadedBy: input.uploadedBy,
        filename: input.filename,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storagePath: input.storagePath,
        thumbnailPath: input.thumbnailPath || null,
        metadata: input.metadata || {},
      },
    });

    return attachment as unknown as Attachment;
  },

  // Create multiple attachments
  async createMany(inputs: CreateAttachmentInput[]): Promise<Attachment[]> {
    const results: Attachment[] = [];
    for (const input of inputs) {
      const attachment = await prisma.attachment.create({
        data: {
          issueId: input.issueId || null,
          commentId: input.commentId || null,
          uploadedBy: input.uploadedBy,
          filename: input.filename,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          storagePath: input.storagePath,
          thumbnailPath: input.thumbnailPath || null,
          metadata: input.metadata || {},
        },
      });
      results.push(attachment as unknown as Attachment);
    }
    return results;
  },

  // Get attachment by ID
  async getById(attachmentId: string): Promise<Attachment | null> {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        deletedAt: null,
      },
    });

    return (attachment as unknown as Attachment) || null;
  },

  // Get attachment with uploader info
  async getByIdWithUploader(attachmentId: string): Promise<any | null> {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        deletedAt: null,
      },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!attachment) return null;

    const { uploader, ...rest } = attachment;
    return {
      ...rest,
      uploader: {
        id: uploader.id,
        displayName: `${uploader.firstName} ${uploader.lastName}`,
        avatarUrl: uploader.avatarUrl,
      },
    };
  },

  // Get attachments for an issue
  async getByIssueId(issueId: string): Promise<any[]> {
    const attachments = await prisma.attachment.findMany({
      where: {
        issueId,
        deletedAt: null,
      },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return attachments.map(({ uploader, ...rest }) => ({
      ...rest,
      uploader: {
        id: uploader.id,
        displayName: `${uploader.firstName} ${uploader.lastName}`,
        avatarUrl: uploader.avatarUrl,
      },
    }));
  },

  // Get attachments for a comment
  async getByCommentId(commentId: string): Promise<any[]> {
    const attachments = await prisma.attachment.findMany({
      where: {
        commentId,
        deletedAt: null,
      },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return attachments.map(({ uploader, ...rest }) => ({
      ...rest,
      uploader: {
        id: uploader.id,
        displayName: `${uploader.firstName} ${uploader.lastName}`,
        avatarUrl: uploader.avatarUrl,
      },
    }));
  },

  // Soft delete attachment
  async delete(attachmentId: string): Promise<Attachment | null> {
    const attachment = await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        deletedAt: new Date(),
      },
    });

    return (attachment as unknown as Attachment) || null;
  },

  // Get total storage used by user
  async getUserStorageUsed(userId: string): Promise<number> {
    const result = await prisma.attachment.aggregate({
      _sum: { fileSize: true },
      where: {
        uploadedBy: userId,
        deletedAt: null,
      },
    });

    return result._sum.fileSize || 0;
  },

  // Get attachment count for issue
  async getCountByIssueId(issueId: string): Promise<number> {
    return prisma.attachment.count({
      where: {
        issueId,
        deletedAt: null,
      },
    });
  },

  // Get the root attachment ID (first version) in a version chain
  async getRootAttachmentId(attachmentId: string): Promise<string> {
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        deletedAt: null,
      },
    });

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // If this attachment has no parent, it's the root
    if (!attachment.parentId) {
      return attachment.id;
    }

    // Recursively find the root
    return this.getRootAttachmentId(attachment.parentId);
  },

  // Get version history for an attachment (finds all versions in the chain)
  async getVersionHistory(attachmentId: string): Promise<any[]> {
    // First, find the root attachment
    const rootId = await this.getRootAttachmentId(attachmentId);

    // Get all versions including the root
    const versions = await prisma.attachment.findMany({
      where: {
        deletedAt: null,
        OR: [{ id: rootId }, { parentId: rootId }],
      },
      select: {
        id: true,
        versionNumber: true,
        fileSize: true,
        storagePath: true,
        uploadedBy: true,
        createdAt: true,
        isLatestVersion: true,
        originalFilename: true,
        uploader: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        versionNumber: 'desc',
      },
    });

    return versions.map(({ uploader, ...rest }) => ({
      ...rest,
      uploader_display_name: `${uploader.firstName} ${uploader.lastName}`,
      uploader_avatar_url: uploader.avatarUrl,
    }));
  },

  // Get the latest version of an attachment chain
  async getLatestVersion(attachmentId: string): Promise<any | null> {
    const rootId = await this.getRootAttachmentId(attachmentId);

    const latest = await prisma.attachment.findFirst({
      where: {
        deletedAt: null,
        isLatestVersion: true,
        OR: [{ id: rootId }, { parentId: rootId }],
      },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!latest) return null;

    const { uploader, ...rest } = latest;
    return {
      ...rest,
      uploader: {
        id: uploader.id,
        displayName: `${uploader.firstName} ${uploader.lastName}`,
        avatarUrl: uploader.avatarUrl,
      },
    };
  },

  // Mark all versions in a chain as not latest
  async markAllVersionsAsNotLatest(rootId: string): Promise<void> {
    await prisma.attachment.updateMany({
      where: {
        deletedAt: null,
        OR: [{ id: rootId }, { parentId: rootId }],
      },
      data: { isLatestVersion: false },
    });
  },

  // Get the next version number for an attachment chain
  async getNextVersionNumber(attachmentId: string): Promise<number> {
    const rootId = await this.getRootAttachmentId(attachmentId);

    const result = await prisma.attachment.aggregate({
      _max: { versionNumber: true },
      where: {
        deletedAt: null,
        OR: [{ id: rootId }, { parentId: rootId }],
      },
    });

    return (result._max.versionNumber || 0) + 1;
  },

  // Create a new version of an attachment
  async createVersion(
    parentId: string,
    input: Omit<any, 'parentId' | 'versionNumber' | 'isLatestVersion'>
  ): Promise<any> {
    const rootId = await this.getRootAttachmentId(parentId);
    const nextVersion = await this.getNextVersionNumber(parentId);

    // Mark all existing versions as not latest
    await this.markAllVersionsAsNotLatest(rootId);

    // Create the new version
    const attachment = await prisma.attachment.create({
      data: {
        issueId: input.issueId || null,
        commentId: input.commentId || null,
        uploadedBy: input.uploadedBy,
        filename: input.filename,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storagePath: input.storagePath,
        thumbnailPath: input.thumbnailPath || null,
        metadata: input.metadata || {},
        parentId: rootId, // Always point to root
        versionNumber: nextVersion,
        isLatestVersion: true,
      },
    });

    return attachment;
  },
};
