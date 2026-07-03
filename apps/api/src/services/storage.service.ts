import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { config } from '../config';
import { buildAvatarApiUrl, buildUploadsUrl, normalizeMediaUrl } from '../utils/media-url';

export interface UploadResult {
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  thumbnailPath: string | null;
  metadata?: Record<string, any>;
}

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // SVG removed – can contain embedded scripts leading to XSS
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain',
  'text/csv',
  'text/markdown',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// Storage directory - configurable via UPLOAD_DIR env var
const STORAGE_DIR = config.storage.uploadDir;
const ATTACHMENTS_DIR = path.join(STORAGE_DIR, 'attachments');
const THUMBNAILS_DIR = path.join(STORAGE_DIR, 'thumbnails');
const AVATARS_DIR = path.join(STORAGE_DIR, 'avatars');

// Avatar-specific settings
const AVATAR_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_DIMENSIONS = { width: 256, height: 256 };

// Ensure directories exist
function ensureDirectories(): void {
  [STORAGE_DIR, ATTACHMENTS_DIR, THUMBNAILS_DIR, AVATARS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Sanitize filename
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

// Generate thumbnail for images
async function generateThumbnail(
  buffer: Buffer,
  filename: string
): Promise<string | null> {
  try {
    const thumbnail = await sharp(buffer)
      .resize(200, 200, {
        fit: 'cover',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbFilename = `thumb_${filename.replace(/\.[^/.]+$/, '.jpg')}`;
    const thumbPath = path.join(THUMBNAILS_DIR, thumbFilename);

    await fs.promises.writeFile(thumbPath, thumbnail);

    return `thumbnails/${thumbFilename}`;
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    return null;
  }
}

export const storageService = {
  // Upload a file
  async uploadFile(file: MulterFile, _userId: string): Promise<UploadResult> {
    ensureDirectories();

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} not allowed`);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 25MB limit');
    }

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const sanitizedName = sanitizeFilename(path.basename(file.originalname, ext));
    const filename = `${uuidv4()}-${sanitizedName}${ext}`;
    const storagePath = `attachments/${filename}`;
    const fullPath = path.join(ATTACHMENTS_DIR, filename);

    // Save file
    await fs.promises.writeFile(fullPath, file.buffer);

    // Generate thumbnail for images
    let thumbnailPath: string | null = null;
    if (file.mimetype.startsWith('image/') && !file.mimetype.includes('svg')) {
      thumbnailPath = await generateThumbnail(file.buffer, filename);
    }

    return {
      filename,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      storagePath,
      thumbnailPath,
    };
  },

  // Upload multiple files
  async uploadFiles(files: MulterFile[], userId: string): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await this.uploadFile(file, userId);
      results.push(result);
    }

    return results;
  },

  getFileUrl(storagePath: string): string {
    return buildUploadsUrl(storagePath);
  },

  // Get file buffer (for serving files)
  async getFileBuffer(storagePath: string): Promise<Buffer | null> {
    try {
      const fullPath = path.join(STORAGE_DIR, storagePath);
      return await fs.promises.readFile(fullPath);
    } catch {
      return null;
    }
  },

  // Check if file exists
  async fileExists(storagePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(STORAGE_DIR, storagePath);
      await fs.promises.access(fullPath);
      return true;
    } catch {
      return false;
    }
  },

  // Delete file
  async deleteFile(storagePath: string): Promise<void> {
    try {
      const fullPath = path.join(STORAGE_DIR, storagePath);
      await fs.promises.unlink(fullPath);
    } catch (error) {
      console.error(`Failed to delete file: ${storagePath}`, error);
    }
  },

  // Delete file with thumbnail
  async deleteFileWithThumbnail(
    storagePath: string,
    thumbnailPath?: string | null
  ): Promise<void> {
    await this.deleteFile(storagePath);
    if (thumbnailPath) {
      await this.deleteFile(thumbnailPath);
    }
  },

  // Get allowed mime types
  getAllowedMimeTypes(): string[] {
    return [...ALLOWED_MIME_TYPES];
  },

  // Get max file size
  getMaxFileSize(): number {
    return MAX_FILE_SIZE;
  },

  // Get storage directory path (for serving static files)
  getStorageDir(): string {
    ensureDirectories();
    return STORAGE_DIR;
  },

  // Upload avatar image with processing
  async uploadAvatar(file: MulterFile, userId: string): Promise<{ avatarUrl: string; storagePath: string }> {
    ensureDirectories();

    // Validate file type
    if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error('Avatar must be a JPG, PNG, or WebP image');
    }

    // Validate file size
    if (file.size > MAX_AVATAR_SIZE) {
      throw new Error('Avatar file size exceeds 5MB limit');
    }

    // Generate filename using userId for easy replacement
    const filename = `${userId}.jpg`;
    const storagePath = `avatars/${filename}`;
    const fullPath = path.join(AVATARS_DIR, filename);

    // Delete old avatar if exists
    try {
      await fs.promises.unlink(fullPath);
    } catch {
      // File doesn't exist, ignore
    }

    // Process and resize image
    const processedImage = await sharp(file.buffer)
      .resize(AVATAR_DIMENSIONS.width, AVATAR_DIMENSIONS.height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Save processed image
    await fs.promises.writeFile(fullPath, processedImage);

    // Use API avatar endpoint so deployments can allow a single API route in nginx.
    const avatarUrl = buildAvatarApiUrl(userId);

    return {
      avatarUrl,
      storagePath,
    };
  },

  // Delete avatar
  async deleteAvatar(userId: string): Promise<void> {
    const filename = `${userId}.jpg`;
    const storagePath = `avatars/${filename}`;
    await this.deleteFile(storagePath);
  },

  normalizePublicUrl(url: string | null | undefined): string | null {
    return normalizeMediaUrl(url);
  },
};
