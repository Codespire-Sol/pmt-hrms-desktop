import { commentsRepository } from './comments.repository';
import {
  CommentWithAuthor,
  CreateCommentInput,
  UpdateCommentInput,
  ActivityLogWithUser,
  CreateActivityLogInput,
  CommentMentionWithUser,
} from './comments.types';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { extractMentions, resolveUsernames, convertMentionsToHtml } from './mentions.util';
import { notificationsService } from '../notifications/notifications.service';
import { prisma } from '../../database/prisma';
import { webhooksService } from '../webhooks/webhooks.service';
import { automationEngine } from '../automation/automation.engine';
import { usersService } from '../users/users.service';
import { logger } from '../../utils/logger';
import { pushCommentCreated, pushCommentUpdated, pushCommentDeleted } from '../../websocket';

// Configure marked for security
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Common emojis allowed for reactions
const ALLOWED_EMOJIS = [
  '👍', '👎', '😄', '🎉', '😕', '❤️', '🚀', '👀',
  '💯', '✅', '❌', '🔥', '💡', '🤔', '👏', '🙌',
];

export const commentsService = {
  // Create a comment
  async createComment(input: CreateCommentInput): Promise<CommentWithAuthor> {
    // Validate parent comment exists if provided
    if (input.parentId) {
      const parent = await commentsRepository.getById(input.parentId);
      if (!parent) {
        throw new Error('Parent comment not found');
      }
      // Ensure parent is for the same issue
      if (parent.issueId !== input.issueId) {
        throw new Error('Parent comment belongs to a different issue');
      }
      // Prevent deeply nested replies (only one level)
      if (parent.parentId) {
        throw new Error('Cannot reply to a reply');
      }
    }

    // Extract mentions from content
    const mentionUsernames = extractMentions(input.content);

    // Get project ID for the issue to resolve mentions within project members
    const issue = await prisma.issue.findUnique({
      where: { id: input.issueId },
      select: {
        projectId: true,
        title: true,
        issueNumber: true,
        project: {
          select: { key: true },
        },
      },
    });
    const projectId = issue?.projectId;

    // Resolve usernames to user IDs
    const resolvedMentions = await resolveUsernames(mentionUsernames, projectId);

    // Convert markdown to HTML with mention links
    let contentHtml = this.convertMarkdownToHtml(input.content);
    if (resolvedMentions.length > 0) {
      contentHtml = convertMentionsToHtml(contentHtml, resolvedMentions);
    }

    const comment = await commentsRepository.create({
      ...input,
      contentHtml,
    });

    // Store mentions in the database
    if (resolvedMentions.length > 0) {
      const mentionedUserIds = resolvedMentions.map((m) => m.userId);
      await commentsRepository.createMentions(comment.id, mentionedUserIds);

      // Send notifications to mentioned users
      await this.notifyMentionedUsers(
        mentionedUserIds,
        input.authorId,
        input.issueId,
        comment.id,
        input.content,
        issue
          ? {
              projectId: issue.projectId,
              title: issue.title,
              key: `${issue.project.key}-${issue.issueNumber}`,
            }
          : undefined
      );
    }

    // Create activity log
    await this.logActivity({
      issueId: input.issueId,
      userId: input.authorId,
      action: 'commented',
      commentId: comment.id,
    });

    const commentWithAuthor = (await commentsRepository.getByIdWithAuthor(
      comment.id,
      input.authorId
    ))!;

    try {
      if (projectId) {
        const actor = await usersService.getUserById(input.authorId);
        const actorInfo = actor
          ? { id: actor.id, displayName: actor.displayName, email: actor.email }
          : undefined;

        await webhooksService.triggerWebhook(projectId, 'comment.created', commentWithAuthor, actorInfo);
        await webhooksService.triggerWebhook(projectId, 'issue.commented', commentWithAuthor, actorInfo);
      }
    } catch (error) {
      logger.warn('Failed to trigger comment.created webhook', { error });
    }

    // Broadcast real-time comment creation via WebSocket
    pushCommentCreated(input.issueId, commentWithAuthor, { id: input.authorId });

    // Fire automation event for issue_commented (fire-and-forget)
    if (projectId) {
      try {
        const issueData = issue ? {
          id: input.issueId,
          key: `${issue.project.key}-${issue.issueNumber}`,
          typeId: '',
          statusId: '',
          reporterId: '',
          title: issue.title,
        } : undefined;

        automationEngine.processEvent({
          type: 'issue_commented',
          projectId,
          userId: input.authorId,
          issue: issueData,
          comment: {
            id: comment.id,
            content: input.content,
            authorId: input.authorId,
          },
        }).catch(err => logger.warn('Automation issue_commented event failed', { error: err }));
      } catch (error) {
        logger.warn('Failed to fire automation event for comment', { error });
      }
    }

    return commentWithAuthor;
  },

  // Get comments for an issue
  async getComments(
    issueId: string,
    currentUserId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ comments: CommentWithAuthor[]; pagination: { page: number; limit: number; total: number } }> {
    const { comments, total } = await commentsRepository.getByIssueId(
      issueId,
      currentUserId,
      page,
      limit
    );

    return {
      comments,
      pagination: {
        page,
        limit,
        total,
      },
    };
  },

  // Update a comment
  async updateComment(
    commentId: string,
    userId: string,
    input: UpdateCommentInput
  ): Promise<CommentWithAuthor> {
    const comment = await commentsRepository.getById(commentId);

    if (!comment) {
      throw new Error('Comment not found');
    }

    // Check ownership
    if (comment.authorId !== userId) {
      throw new Error('You can only edit your own comments');
    }

    // Extract mentions from new content
    const mentionUsernames = extractMentions(input.content);

    // Get project ID for the issue to resolve mentions within project members
    const issue = await prisma.issue.findUnique({
      where: { id: comment.issueId },
      select: {
        projectId: true,
        title: true,
        issueNumber: true,
        project: {
          select: { key: true },
        },
      },
    });
    const projectId = issue?.projectId;

    // Resolve usernames to user IDs
    const resolvedMentions = await resolveUsernames(mentionUsernames, projectId);

    // Convert markdown to HTML with mention links
    let contentHtml = this.convertMarkdownToHtml(input.content);
    if (resolvedMentions.length > 0) {
      contentHtml = convertMentionsToHtml(contentHtml, resolvedMentions);
    }

    // Get existing mentions to find new ones
    const existingMentions = await commentsRepository.getMentionsByCommentId(commentId);
    const existingMentionedUserIds = new Set(existingMentions.map((m) => m.mentionedUserId));
    const newMentionedUserIds = resolvedMentions
      .map((m) => m.userId)
      .filter((id) => !existingMentionedUserIds.has(id));

    await commentsRepository.update(commentId, {
      ...input,
      contentHtml,
    });

    // Update mentions: delete old ones and create new ones
    await commentsRepository.deleteMentionsByCommentId(commentId);
    if (resolvedMentions.length > 0) {
      await commentsRepository.createMentions(
        commentId,
        resolvedMentions.map((m) => m.userId)
      );
    }

    // Notify only newly mentioned users
    if (newMentionedUserIds.length > 0) {
      await this.notifyMentionedUsers(
        newMentionedUserIds,
        userId,
        comment.issueId,
        commentId,
        input.content,
        issue
          ? {
              projectId: issue.projectId,
              title: issue.title,
              key: `${issue.project.key}-${issue.issueNumber}`,
            }
          : undefined
      );
    }

    const updatedComment = (await commentsRepository.getByIdWithAuthor(commentId, userId))!;

    // Broadcast real-time comment update via WebSocket
    pushCommentUpdated(comment.issueId, updatedComment, { id: userId });

    try {
      if (projectId) {
        const actor = await usersService.getUserById(userId);
        const actorInfo = actor
          ? { id: actor.id, displayName: actor.displayName, email: actor.email }
          : undefined;

        await webhooksService.triggerWebhook(projectId, 'comment.updated', updatedComment, actorInfo);
      }
    } catch (error) {
      logger.warn('Failed to trigger comment.updated webhook', { error });
    }

    return updatedComment;
  },

  // Delete a comment
  async deleteComment(commentId: string, userId: string, isAdmin: boolean = false): Promise<void> {
    const comment = await commentsRepository.getById(commentId);

    if (!comment) {
      throw new Error('Comment not found');
    }

    // Check ownership or admin
    if (comment.authorId !== userId && !isAdmin) {
      throw new Error('You can only delete your own comments');
    }

    await commentsRepository.delete(commentId);

    // Broadcast real-time comment deletion via WebSocket
    pushCommentDeleted(comment.issueId, commentId, { id: userId });

    try {
      const issue = await prisma.issue.findUnique({
        where: { id: comment.issueId },
        select: { projectId: true },
      });

      if (issue?.projectId) {
        const actor = await usersService.getUserById(userId);
        const actorInfo = actor
          ? { id: actor.id, displayName: actor.displayName, email: actor.email }
          : undefined;

        await webhooksService.triggerWebhook(issue.projectId, 'comment.deleted', comment, actorInfo);
      }
    } catch (error) {
      logger.warn('Failed to trigger comment.deleted webhook', { error });
    }
  },

  // Add reaction
  async addReaction(
    commentId: string,
    userId: string,
    emoji: string
  ): Promise<{ emoji: string; count: number }> {
    const comment = await commentsRepository.getById(commentId);

    if (!comment) {
      throw new Error('Comment not found');
    }

    // Validate emoji
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      throw new Error('Invalid emoji');
    }

    await commentsRepository.addReaction(commentId, userId, emoji);
    const count = await commentsRepository.getReactionCount(commentId, emoji);

    return { emoji, count };
  },

  // Remove reaction
  async removeReaction(commentId: string, userId: string, emoji: string): Promise<void> {
    const comment = await commentsRepository.getById(commentId);

    if (!comment) {
      throw new Error('Comment not found');
    }

    await commentsRepository.removeReaction(commentId, userId, emoji);
  },

  // Get activity feed
  async getActivity(
    issueId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ activities: ActivityLogWithUser[]; pagination: { page: number; limit: number; total: number } }> {
    const { activities, total } = await commentsRepository.getActivityLogs(issueId, page, limit);

    return {
      activities,
      pagination: {
        page,
        limit,
        total,
      },
    };
  },

  // Log activity
  async logActivity(input: CreateActivityLogInput): Promise<void> {
    await commentsRepository.createActivityLog(input);
  },

  // Helper: Convert markdown to sanitized HTML
  convertMarkdownToHtml(markdown: string): string {
    const rawHtml = marked.parse(markdown) as string;
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
        'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'hr', 'del', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  },

  // Get allowed emojis for reactions
  getAllowedEmojis(): string[] {
    return [...ALLOWED_EMOJIS];
  },

  // Get mentions for a comment
  async getMentions(commentId: string): Promise<CommentMentionWithUser[]> {
    return commentsRepository.getMentionsByCommentId(commentId);
  },

  // Get comments where a user is mentioned
  async getMentionedComments(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ comments: CommentWithAuthor[]; pagination: { page: number; limit: number; total: number } }> {
    const { comments, total } = await commentsRepository.getCommentsByMentionedUser(userId, page, limit);
    return {
      comments,
      pagination: {
        page,
        limit,
        total,
      },
    };
  },

  // Helper: Notify mentioned users
  async notifyMentionedUsers(
    mentionedUserIds: string[],
    authorId: string,
    issueId: string,
    commentId: string,
    content: string,
    issue?: { key: string; title: string; projectId?: string }
  ): Promise<void> {
    if (mentionedUserIds.length === 0) return;

    // Get author info for notification
    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { firstName: true, lastName: true },
    });
    const actorName = author ? `${author.firstName} ${author.lastName}`.trim() : 'Someone';

    // Create a preview of the comment (first 100 characters)
    const commentPreview = content.length > 100 ? content.substring(0, 100) + '...' : content;

    await notificationsService.notify(
      {
        type: 'issue_mentioned',
        recipientIds: mentionedUserIds,
        actorId: authorId,
        issueId,
        commentId,
        projectId: issue?.projectId,
        metadata: {
          issueKey: issue?.key,
          issueTitle: issue?.title,
          commentPreview,
        },
      },
      actorName
    );
  },
};
