import { Server, Socket } from 'socket.io';
import { commentsRepository } from '../../modules/comments/comments.repository';
import { logger } from '../../utils/logger';

interface IssueJoinPayload {
  issueId: string;
}

interface CommentCreatePayload {
  issueId: string;
  content: string;
  contentHtml?: string;
  parentId?: string;
  mentions?: string[];
}

interface CommentUpdatePayload {
  commentId: string;
  content: string;
  contentHtml?: string;
}

interface CommentDeletePayload {
  commentId: string;
}

interface ReactionPayload {
  commentId: string;
  emoji: string;
}

interface TypingPayload {
  issueId: string;
  isTyping: boolean;
}

export function commentHandler(io: Server, socket: Socket) {
  // Join issue room for real-time comment updates
  socket.on('issue:subscribe', async (payload: IssueJoinPayload) => {
    const { issueId } = payload;
    const roomName = `issue:${issueId}`;

    socket.join(roomName);

    logger.info(`User ${socket.data.user.id} subscribed to issue ${issueId} comments`);
  });

  // Leave issue room
  socket.on('issue:unsubscribe', (payload: IssueJoinPayload) => {
    const { issueId } = payload;
    const roomName = `issue:${issueId}`;

    socket.leave(roomName);

    logger.info(`User ${socket.data.user.id} unsubscribed from issue ${issueId} comments`);
  });

  // Create comment in real-time
  socket.on('comment:create', async (payload: CommentCreatePayload) => {
    try {
      const { issueId, content, contentHtml, parentId, mentions } = payload;

      // Create comment in database
      const comment = await commentsRepository.create({
        issueId,
        authorId: socket.data.user.id,
        content,
        contentHtml,
        parentId,
      });

      // Create mentions if provided
      if (mentions && mentions.length > 0) {
        await commentsRepository.createMentions(comment.id, mentions);
      }

      // Get comment with author details
      const commentWithAuthor = await commentsRepository.getByIdWithAuthor(
        comment.id,
        socket.data.user.id
      );

      // Get mentions for this comment
      const commentMentions = await commentsRepository.getMentionsByCommentId(comment.id);

      const roomName = `issue:${issueId}`;

      // Broadcast to all clients in room
      io.in(roomName).emit('comment:created', {
        comment: {
          ...commentWithAuthor,
          mentions: commentMentions,
        },
        createdBy: socket.data.user,
        timestamp: new Date().toISOString(),
      });

      // Also emit to project room for activity feed
      const projectRoomName = `project:${issueId}`; // Note: In real impl, get projectId from issue
      io.in(projectRoomName).emit('activity:new', {
        type: 'comment_created',
        issueId,
        commentId: comment.id,
        actorId: socket.data.user.id,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Comment created by ${socket.data.user.id} on issue ${issueId}`);
    } catch (error) {
      logger.error('Failed to create comment:', error);
      socket.emit('error', {
        event: 'comment:create',
        message: 'Failed to create comment',
        error: (error as Error).message,
      });
    }
  });

  // Update comment in real-time
  socket.on('comment:update', async (payload: CommentUpdatePayload) => {
    try {
      const { commentId, content, contentHtml } = payload;

      // Get original comment to check ownership and get issueId
      const originalComment = await commentsRepository.getById(commentId);

      if (!originalComment) {
        socket.emit('error', {
          event: 'comment:update',
          message: 'Comment not found',
        });
        return;
      }

      // Check ownership
      if (originalComment.authorId !== socket.data.user.id) {
        socket.emit('error', {
          event: 'comment:update',
          message: 'Not authorized to edit this comment',
        });
        return;
      }

      // Update comment
      const _updatedComment = await commentsRepository.update(commentId, {
        content,
        contentHtml,
      });

      // Get updated comment with author details
      const commentWithAuthor = await commentsRepository.getByIdWithAuthor(
        commentId,
        socket.data.user.id
      );

      const roomName = `issue:${originalComment.issueId}`;

      // Broadcast update
      io.in(roomName).emit('comment:updated', {
        comment: commentWithAuthor,
        updatedBy: socket.data.user,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Comment ${commentId} updated by ${socket.data.user.id}`);
    } catch (error) {
      logger.error('Failed to update comment:', error);
      socket.emit('error', {
        event: 'comment:update',
        message: 'Failed to update comment',
        error: (error as Error).message,
      });
    }
  });

  // Delete comment in real-time
  socket.on('comment:delete', async (payload: CommentDeletePayload) => {
    try {
      const { commentId } = payload;

      // Get original comment to check ownership and get issueId
      const originalComment = await commentsRepository.getById(commentId);

      if (!originalComment) {
        socket.emit('error', {
          event: 'comment:delete',
          message: 'Comment not found',
        });
        return;
      }

      // Check ownership
      if (originalComment.authorId !== socket.data.user.id) {
        socket.emit('error', {
          event: 'comment:delete',
          message: 'Not authorized to delete this comment',
        });
        return;
      }

      // Soft delete comment
      await commentsRepository.delete(commentId);

      const roomName = `issue:${originalComment.issueId}`;

      // Broadcast deletion
      io.in(roomName).emit('comment:deleted', {
        commentId,
        issueId: originalComment.issueId,
        deletedBy: socket.data.user,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Comment ${commentId} deleted by ${socket.data.user.id}`);
    } catch (error) {
      logger.error('Failed to delete comment:', error);
      socket.emit('error', {
        event: 'comment:delete',
        message: 'Failed to delete comment',
        error: (error as Error).message,
      });
    }
  });

  // Add reaction to comment
  socket.on('comment:react', async (payload: ReactionPayload) => {
    try {
      const { commentId, emoji } = payload;

      // Get comment to get issueId
      const comment = await commentsRepository.getById(commentId);

      if (!comment) {
        socket.emit('error', {
          event: 'comment:react',
          message: 'Comment not found',
        });
        return;
      }

      // Add reaction
      await commentsRepository.addReaction(commentId, socket.data.user.id, emoji);

      // Get updated reaction summary
      const reactions = await commentsRepository.getReactionSummary(commentId, socket.data.user.id);

      const roomName = `issue:${comment.issueId}`;

      // Broadcast reaction update
      io.in(roomName).emit('comment:reactionAdded', {
        commentId,
        emoji,
        reactions,
        addedBy: socket.data.user,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Reaction ${emoji} added to comment ${commentId} by ${socket.data.user.id}`);
    } catch (error) {
      logger.error('Failed to add reaction:', error);
      socket.emit('error', {
        event: 'comment:react',
        message: 'Failed to add reaction',
        error: (error as Error).message,
      });
    }
  });

  // Remove reaction from comment
  socket.on('comment:unreact', async (payload: ReactionPayload) => {
    try {
      const { commentId, emoji } = payload;

      // Get comment to get issueId
      const comment = await commentsRepository.getById(commentId);

      if (!comment) {
        socket.emit('error', {
          event: 'comment:unreact',
          message: 'Comment not found',
        });
        return;
      }

      // Remove reaction
      await commentsRepository.removeReaction(commentId, socket.data.user.id, emoji);

      // Get updated reaction summary
      const reactions = await commentsRepository.getReactionSummary(commentId, socket.data.user.id);

      const roomName = `issue:${comment.issueId}`;

      // Broadcast reaction removal
      io.in(roomName).emit('comment:reactionRemoved', {
        commentId,
        emoji,
        reactions,
        removedBy: socket.data.user,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Reaction ${emoji} removed from comment ${commentId} by ${socket.data.user.id}`);
    } catch (error) {
      logger.error('Failed to remove reaction:', error);
      socket.emit('error', {
        event: 'comment:unreact',
        message: 'Failed to remove reaction',
        error: (error as Error).message,
      });
    }
  });

  // User typing indicator
  socket.on('comment:typing', (payload: TypingPayload) => {
    const { issueId, isTyping } = payload;
    const roomName = `issue:${issueId}`;

    // Broadcast to other users (not sender)
    socket.to(roomName).emit('comment:userTyping', {
      user: socket.data.user,
      issueId,
      isTyping,
      timestamp: new Date().toISOString(),
    });
  });
}

// Helper function to broadcast comment events from outside the handler
export function broadcastCommentCreated(
  io: Server,
  issueId: string,
  comment: any,
  createdBy: any
): void {
  const roomName = `issue:${issueId}`;
  io.in(roomName).emit('comment:created', {
    comment,
    createdBy,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastCommentUpdated(
  io: Server,
  issueId: string,
  comment: any,
  updatedBy: any
): void {
  const roomName = `issue:${issueId}`;
  io.in(roomName).emit('comment:updated', {
    comment,
    updatedBy,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastCommentDeleted(
  io: Server,
  issueId: string,
  commentId: string,
  deletedBy: any
): void {
  const roomName = `issue:${issueId}`;
  io.in(roomName).emit('comment:deleted', {
    commentId,
    issueId,
    deletedBy,
    timestamp: new Date().toISOString(),
  });
}
