import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  Comment,
  CommentWithAuthor,
  CommentReaction,
  ReactionSummary,
  CreateCommentInput,
  UpdateCommentInput,
  ActivityLog,
  ActivityLogWithUser,
  CreateActivityLogInput,
  CommentMention,
  CommentMentionWithUser,
} from './comments.types';

export const commentsRepository = {
  // Create a new comment
  async create(input: CreateCommentInput): Promise<Comment> {
    const comment = await prisma.comment.create({
      data: {
        issueId: input.issueId,
        authorId: input.authorId,
        parentId: input.parentId || null,
        content: input.content,
        contentHtml: input.contentHtml || null,
      },
    });

    return comment as unknown as Comment;
  },

  // Get a comment by ID
  async getById(commentId: string): Promise<Comment | null> {
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });

    return (comment as unknown as Comment) || null;
  },

  // Get a comment with author details
  async getByIdWithAuthor(commentId: string, currentUserId: string): Promise<CommentWithAuthor | null> {
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!comment) return null;

    const reactions = await this.getReactionSummary(commentId, currentUserId);

    return {
      id: comment.id,
      issueId: comment.issueId,
      authorId: comment.authorId,
      parentId: comment.parentId,
      content: comment.content,
      contentHtml: comment.contentHtml,
      isEdited: comment.isEdited,
      editedAt: comment.editedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      author: {
        id: comment.author.id,
        displayName: `${comment.author.firstName} ${comment.author.lastName}`,
        avatarUrl: comment.author.avatarUrl,
      },
      reactions,
    } as unknown as CommentWithAuthor;
  },

  // Get comments for an issue (with threading)
  async getByIssueId(
    issueId: string,
    currentUserId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ comments: CommentWithAuthor[]; total: number }> {
    // Get total count of root comments
    const total = await prisma.comment.count({
      where: { issueId, parentId: null, deletedAt: null },
    });

    // Get root comments
    const rootComments = await prisma.comment.findMany({
      where: { issueId, parentId: null, deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get all replies for these root comments
    const rootIds = rootComments.map((c) => c.id);
    const replies = rootIds.length > 0
      ? await prisma.comment.findMany({
          where: { parentId: { in: rootIds }, deletedAt: null },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    // Get reactions for all comments
    const allCommentIds = [...rootIds, ...replies.map((r) => r.id)];
    const reactionsMap = await this.getReactionSummaryBatch(allCommentIds, currentUserId);

    // Build the threaded structure
    const comments = rootComments.map((comment) => ({
      id: comment.id,
      issueId: comment.issueId,
      authorId: comment.authorId,
      parentId: comment.parentId,
      content: comment.content,
      contentHtml: comment.contentHtml,
      isEdited: comment.isEdited,
      editedAt: comment.editedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      author: {
        id: comment.author.id,
        displayName: `${comment.author.firstName} ${comment.author.lastName}`,
        avatarUrl: comment.author.avatarUrl,
      },
      reactions: reactionsMap.get(comment.id) || [],
      replies: replies
        .filter((r) => r.parentId === comment.id)
        .map((reply) => ({
          id: reply.id,
          issueId: reply.issueId,
          authorId: reply.authorId,
          parentId: reply.parentId,
          content: reply.content,
          contentHtml: reply.contentHtml,
          isEdited: reply.isEdited,
          editedAt: reply.editedAt,
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
          deletedAt: reply.deletedAt,
          author: {
            id: reply.author.id,
            displayName: `${reply.author.firstName} ${reply.author.lastName}`,
            avatarUrl: reply.author.avatarUrl,
          },
          reactions: reactionsMap.get(reply.id) || [],
        })),
    })) as unknown as CommentWithAuthor[];

    return { comments, total };
  },

  // Update a comment
  async update(commentId: string, input: UpdateCommentInput): Promise<Comment> {
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: input.content,
        contentHtml: input.contentHtml,
        isEdited: true,
        editedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return comment as unknown as Comment;
  },

  // Soft delete a comment
  async delete(commentId: string): Promise<void> {
    await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  },

  // Add reaction
  async addReaction(commentId: string, userId: string, emoji: string): Promise<CommentReaction> {
    const reaction = await prisma.commentReaction.upsert({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId,
          emoji,
        },
      },
      update: {},
      create: {
        commentId,
        userId,
        emoji,
      },
    });

    return reaction as unknown as CommentReaction;
  },

  // Remove reaction
  async removeReaction(commentId: string, userId: string, emoji: string): Promise<void> {
    await prisma.commentReaction.deleteMany({
      where: { commentId, userId, emoji },
    });
  },

  // Get reaction summary for a comment
  async getReactionSummary(commentId: string, currentUserId: string): Promise<ReactionSummary[]> {
    const reactions = await prisma.$queryRaw<
      { emoji: string; count: bigint; has_reacted: number }[]
    >(
      Prisma.sql`
        SELECT
          emoji,
          COUNT(id) as count,
          MAX(CASE WHEN user_id = ${currentUserId} THEN 1 ELSE 0 END) as has_reacted
        FROM comment_reactions
        WHERE comment_id = ${commentId}
        GROUP BY emoji
      `
    );

    return reactions.map((r) => ({
      emoji: r.emoji,
      count: Number(r.count),
      hasReacted: r.has_reacted === 1,
    }));
  },

  // Get reaction summary for multiple comments
  async getReactionSummaryBatch(
    commentIds: string[],
    currentUserId: string
  ): Promise<Map<string, ReactionSummary[]>> {
    if (commentIds.length === 0) return new Map();

    const reactions = await prisma.$queryRaw<
      { comment_id: string; emoji: string; count: bigint; has_reacted: number }[]
    >(
      Prisma.sql`
        SELECT
          comment_id,
          emoji,
          COUNT(id) as count,
          MAX(CASE WHEN user_id = ${currentUserId} THEN 1 ELSE 0 END) as has_reacted
        FROM comment_reactions
        WHERE comment_id IN (${Prisma.join(commentIds)})
        GROUP BY comment_id, emoji
      `
    );

    const map = new Map<string, ReactionSummary[]>();
    for (const r of reactions) {
      const cId = r.comment_id;
      if (!map.has(cId)) {
        map.set(cId, []);
      }
      map.get(cId)!.push({
        emoji: r.emoji,
        count: Number(r.count),
        hasReacted: r.has_reacted === 1,
      });
    }
    return map;
  },

  // Get reaction count for a specific emoji
  async getReactionCount(commentId: string, emoji: string): Promise<number> {
    return prisma.commentReaction.count({
      where: { commentId, emoji },
    });
  },

  // Activity Logs
  async createActivityLog(input: CreateActivityLogInput): Promise<ActivityLog> {
    const log = await prisma.activityLog.create({
      data: {
        issueId: input.issueId,
        userId: input.userId,
        action: input.action,
        fieldName: input.fieldName || null,
        oldValue: input.oldValue || null,
        newValue: input.newValue || null,
        commentId: input.commentId || null,
        metadata: input.metadata || {},
      },
    });

    return log as unknown as ActivityLog;
  },

  // Get activity logs for an issue
  async getActivityLogs(
    issueId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ activities: ActivityLogWithUser[]; total: number }> {
    const total = await prisma.activityLog.count({
      where: { issueId },
    });

    const logs = await prisma.activityLog.findMany({
      where: { issueId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        comment: {
          select: {
            id: true,
            content: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const activities = logs.map((log) => ({
      id: log.id,
      issueId: log.issueId,
      userId: log.userId,
      action: log.action,
      fieldName: log.fieldName,
      oldValue: log.oldValue,
      newValue: log.newValue,
      commentId: log.commentId,
      metadata: log.metadata,
      createdAt: log.createdAt,
      user: {
        id: log.user.id,
        displayName: `${log.user.firstName} ${log.user.lastName}`,
        avatarUrl: log.user.avatarUrl,
      },
      comment: log.comment
        ? {
            id: log.comment.id,
            content: log.comment.content,
          }
        : undefined,
    })) as unknown as ActivityLogWithUser[];

    return { activities, total };
  },

  // Mention-related methods

  // Create mentions for a comment
  async createMentions(commentId: string, userIds: string[]): Promise<CommentMention[]> {
    if (userIds.length === 0) return [];

    // Use skipDuplicates to handle conflicts (equivalent to onConflict().ignore())
    await prisma.commentMention.createMany({
      data: userIds.map((uid) => ({
        commentId,
        userId: uid,
      })),
      skipDuplicates: true,
    });

    // Fetch the created mentions
    const mentions = await prisma.commentMention.findMany({
      where: {
        commentId,
        userId: { in: userIds },
      },
    });

    return mentions as unknown as CommentMention[];
  },

  // Get mentions for a comment
  async getMentionsByCommentId(commentId: string): Promise<CommentMentionWithUser[]> {
    const mentions = await prisma.commentMention.findMany({
      where: { commentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return mentions.map((m) => ({
      id: m.id,
      commentId: m.commentId,
      mentionedUserId: m.userId,
      createdAt: m.createdAt,
      mentionedUser: {
        id: m.user.id,
        displayName: `${m.user.firstName} ${m.user.lastName}`,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
      },
    })) as unknown as CommentMentionWithUser[];
  },

  // Get all mentions for multiple comments (batch query)
  async getMentionsByCommentIds(commentIds: string[]): Promise<Map<string, CommentMentionWithUser[]>> {
    if (commentIds.length === 0) return new Map();

    const mentions = await prisma.commentMention.findMany({
      where: { commentId: { in: commentIds } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    const map = new Map<string, CommentMentionWithUser[]>();
    for (const m of mentions) {
      const mention = {
        id: m.id,
        commentId: m.commentId,
        mentionedUserId: m.userId,
        createdAt: m.createdAt,
        mentionedUser: {
          id: m.user.id,
          displayName: `${m.user.firstName} ${m.user.lastName}`,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
        },
      } as unknown as CommentMentionWithUser;
      if (!map.has(m.commentId)) {
        map.set(m.commentId, []);
      }
      map.get(m.commentId)!.push(mention);
    }
    return map;
  },

  // Delete all mentions for a comment
  async deleteMentionsByCommentId(commentId: string): Promise<void> {
    await prisma.commentMention.deleteMany({ where: { commentId } });
  },

  // Get comments where a user is mentioned
  async getCommentsByMentionedUser(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ comments: CommentWithAuthor[]; total: number }> {
    const total = await prisma.commentMention.count({
      where: { userId },
    });

    const mentionRecords = await prisma.commentMention.findMany({
      where: { userId },
      select: { commentId: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (mentionRecords.length === 0) {
      return { comments: [], total };
    }

    const ids = mentionRecords.map((c) => c.commentId);
    const commentRows = await prisma.comment.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Get reactions for all these comments
    const reactionsMap = await this.getReactionSummaryBatch(ids, userId);

    const comments = commentRows.map((comment) => ({
      id: comment.id,
      issueId: comment.issueId,
      authorId: comment.authorId,
      parentId: comment.parentId,
      content: comment.content,
      contentHtml: comment.contentHtml,
      isEdited: comment.isEdited,
      editedAt: comment.editedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      author: {
        id: comment.author.id,
        displayName: `${comment.author.firstName} ${comment.author.lastName}`,
        avatarUrl: comment.author.avatarUrl,
      },
      reactions: reactionsMap.get(comment.id) || [],
    })) as unknown as CommentWithAuthor[];

    return { comments, total };
  },
};
