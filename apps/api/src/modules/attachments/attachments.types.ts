export interface Attachment {
  id: string;
  issueId: string | null;
  commentId: string | null;
  uploadedBy: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  thumbnailPath: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  deletedAt: string | null;
  // Versioning fields
  parentId: string | null;
  versionNumber: number;
  versionNotes: string | null;
  isLatestVersion: boolean;
}

export interface AttachmentWithUrls extends Attachment {
  downloadUrl: string;
  thumbnailUrl: string | null;
  uploader: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface CreateAttachmentInput {
  issueId?: string;
  commentId?: string;
  uploadedBy: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  thumbnailPath?: string | null;
  metadata?: Record<string, any>;
  // Versioning fields
  parentId?: string | null;
  versionNumber?: number;
  versionNotes?: string | null;
  isLatestVersion?: boolean;
}

export interface AttachmentVersion {
  id: string;
  versionNumber: number;
  versionNotes: string | null;
  fileSize: number;
  uploadedBy: string;
  uploaderDisplayName: string;
  uploaderAvatarUrl: string | null;
  createdAt: string;
  downloadUrl: string;
  isLatestVersion: boolean;
}

export interface AttachmentVersionHistory {
  attachmentId: string;
  originalFilename: string;
  totalVersions: number;
  latestVersion: number;
  versions: AttachmentVersion[];
}
