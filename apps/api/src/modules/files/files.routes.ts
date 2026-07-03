import { Router, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import mime from 'mime-types';
import { storageService } from '../../services/storage.service';

const router = Router();

/**
 * GET /api/v1/files/:folder/:filename
 *
 * Public file-serving endpoint that works through the /api proxy.
 * Replaces the express.static approach which doesn't work when nginx
 * only proxies /api/* paths to the backend.
 *
 * :folder  – "attachments" | "thumbnails"
 * :filename – UUID-prefixed sanitised filename written by storageService
 */
router.get('/:folder/:filename', async (req: Request, res: Response) => {
  const { folder, filename } = req.params;

  // Only allow known sub-directories to prevent path traversal
  const ALLOWED_FOLDERS = ['attachments', 'thumbnails', 'avatars'];
  if (!ALLOWED_FOLDERS.includes(folder)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PATH', message: 'Invalid file path' } });
    return;
  }

  // Sanitize filename — block path traversal characters
  if (!filename || /[/\\]/.test(filename) || filename.includes('..')) {
    res.status(400).json({ success: false, error: { code: 'INVALID_FILENAME', message: 'Invalid filename' } });
    return;
  }

  const filePath = path.join(storageService.getStorageDir(), folder, filename);

  // Check file exists
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
    return;
  }

  // Set appropriate headers
  const contentType = mime.lookup(filename) || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // files are UUID-named, immutable
  res.sendFile(filePath);
});

export default router;
