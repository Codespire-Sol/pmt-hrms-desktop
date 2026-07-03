import { Router } from 'express';
import multer from 'multer';
import { attachmentsController } from './attachments.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import {
  uploadToIssueSchema,
  uploadToCommentSchema,
  getByIssueSchema,
  getByCommentSchema,
  attachmentIdSchema,
} from './attachments.validator';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 10,
  },
});

// Public file-serving routes — no auth, no file extension in URL so nginx does not
// intercept them with a static-asset rule (mirrors /users/avatars/:userId pattern).
router.get('/attachments/:attachmentId/file', attachmentsController.serveFile);
router.get('/attachments/:attachmentId/thumbnail', attachmentsController.serveThumbnail);

// All routes require authentication
router.use(authenticate);

// Get upload configuration (allowed types, limits)
router.get('/attachments/config', attachmentsController.getUploadConfig);

// Issue attachments
router.post(
  '/issues/:issueId/attachments',
  validate(uploadToIssueSchema),
  upload.array('files', 10),
  attachmentsController.uploadToIssue
);

router.get(
  '/issues/:issueId/attachments',
  validate(getByIssueSchema),
  attachmentsController.getByIssue
);

// Comment attachments
router.post(
  '/comments/:commentId/attachments',
  validate(uploadToCommentSchema),
  upload.array('files', 5),
  attachmentsController.uploadToComment
);

router.get(
  '/comments/:commentId/attachments',
  validate(getByCommentSchema),
  attachmentsController.getByComment
);

// Individual attachment routes
router.get(
  '/attachments/:attachmentId',
  validate(attachmentIdSchema),
  attachmentsController.getById
);

router.get(
  '/attachments/:attachmentId/download',
  validate(attachmentIdSchema),
  attachmentsController.getDownloadUrl
);

router.delete(
  '/attachments/:attachmentId',
  validate(attachmentIdSchema),
  attachmentsController.delete
);

// Versioning routes
router.post(
  '/attachments/:attachmentId/versions',
  validate(attachmentIdSchema),
  upload.single('file'),
  attachmentsController.uploadNewVersion
);

router.get(
  '/attachments/:attachmentId/versions',
  validate(attachmentIdSchema),
  attachmentsController.getVersionHistory
);

router.get(
  '/attachments/:attachmentId/versions/latest',
  validate(attachmentIdSchema),
  attachmentsController.getLatestVersion
);

router.post(
  '/attachments/:attachmentId/versions/:versionId/revert',
  attachmentsController.revertToVersion
);

export default router;
