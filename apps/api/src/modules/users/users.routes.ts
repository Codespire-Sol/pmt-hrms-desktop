import { Router } from 'express';
import multer from 'multer';
import { usersController } from './users.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import {
  updateProfileSchema,
  updateAvatarSchema,
  updatePreferencesSchema,
  updateUserStatusSchema,
  updateUserSchema,
} from './users.validator';

const router = Router();

// Configure multer for avatar uploads (memory storage for processing)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed'));
    }
  },
});

// Public avatar route (for image tags / CDN / nginx allowlist)
router.get('/avatars/:userId', usersController.getAvatar.bind(usersController));

// All routes require authentication
router.use(authenticate);

// Current user profile routes
router.get('/me', usersController.getProfile.bind(usersController));
router.patch('/me', validate(updateProfileSchema), usersController.updateProfile.bind(usersController));
router.patch('/me/avatar', validate(updateAvatarSchema), usersController.updateAvatar.bind(usersController));
router.get('/me/avatar/upload', usersController.getMyAvatar.bind(usersController));
router.post('/me/avatar/upload', avatarUpload.single('avatar'), usersController.uploadAvatar.bind(usersController));
router.delete('/me/avatar', usersController.deleteAvatar.bind(usersController));

// User preferences routes
router.get('/me/preferences', usersController.getPreferences.bind(usersController));
router.patch('/me/preferences', validate(updatePreferencesSchema), usersController.updatePreferences.bind(usersController));

// Account management
router.delete('/me', usersController.deactivateAccount.bind(usersController));

// Search users for mentions
router.get('/search', usersController.searchForMention.bind(usersController));

// List users (for admins or team views)
router.get('/', usersController.listUsers.bind(usersController));

// Get specific user by ID
router.get('/:userId', usersController.getUserById.bind(usersController));

// Update user details (admin only)
router.patch(
  '/:userId',
  requirePermission('users.manage_roles'),
  validate(updateUserSchema),
  usersController.updateUser.bind(usersController)
);

// Update user active status (admin only)
router.patch(
  '/:userId/status',
  requirePermission('users.manage_roles'),
  validate(updateUserStatusSchema),
  usersController.updateUserStatus.bind(usersController)
);

export default router;
