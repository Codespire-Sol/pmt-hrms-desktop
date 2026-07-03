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
  downloadUrl: string;
  thumbnailUrl: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  uploader: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  // Versioning fields
  parentId?: string | null;
  versionNumber?: number;
  versionNotes?: string | null;
  isLatestVersion?: boolean;
}

export interface UploadConfig {
  allowedTypes: string[];
  maxFileSize: number;
  maxFilesPerUpload: number;
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
