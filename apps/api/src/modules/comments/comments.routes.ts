import { Router } from 'express';
import { commentsController } from './comments.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import {
  createCommentSchema,
  updateCommentSchema,
  deleteCommentSchema,
  getCommentsSchema,
  addReactionSchema,
  removeReactionSchema,
  getActivitySchema,
} from './comments.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Issue comments routes
router.post(
  '/issues/:issueId/comments',
  validate(createCommentSchema),
  commentsController.createComment
);

router.get(
  '/issues/:issueId/comments',
  validate(getCommentsSchema),
  commentsController.getComments
);

// Activity feed route
router.get(
  '/issues/:issueId/activity',
  validate(getActivitySchema),
  commentsController.getActivity
);

// Individual comment routes
router.patch(
  '/comments/:commentId',
  validate(updateCommentSchema),
  commentsController.updateComment
);

router.delete(
  '/comments/:commentId',
  validate(deleteCommentSchema),
  commentsController.deleteComment
);

// Reaction routes
router.post(
  '/comments/:commentId/reactions',
  validate(addReactionSchema),
  commentsController.addReaction
);

router.delete(
  '/comments/:commentId/reactions/:emoji',
  validate(removeReactionSchema),
  commentsController.removeReaction
);

// Utility routes
router.get('/reactions/emojis', commentsController.getAllowedEmojis);

export default router;
