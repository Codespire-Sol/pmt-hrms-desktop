import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.object({
    content: z
      .string()
      .min(1, 'Comment cannot be empty')
      .max(10000, 'Comment is too long (max 10,000 characters)'),
    parentId: z.string().uuid().optional(),
  }),
  params: z.object({
    issueId: z.string().uuid('Invalid issue ID'),
  }),
});

export const updateCommentSchema = z.object({
  body: z.object({
    content: z
      .string()
      .min(1, 'Comment cannot be empty')
      .max(10000, 'Comment is too long (max 10,000 characters)'),
  }),
  params: z.object({
    commentId: z.string().uuid('Invalid comment ID'),
  }),
});

export const deleteCommentSchema = z.object({
  params: z.object({
    commentId: z.string().uuid('Invalid comment ID'),
  }),
});

export const getCommentsSchema = z.object({
  params: z.object({
    issueId: z.string().uuid('Invalid issue ID'),
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

export const addReactionSchema = z.object({
  body: z.object({
    emoji: z.string().min(1).max(50),
  }),
  params: z.object({
    commentId: z.string().uuid('Invalid comment ID'),
  }),
});

export const removeReactionSchema = z.object({
  params: z.object({
    commentId: z.string().uuid('Invalid comment ID'),
    emoji: z.string().min(1).max(50),
  }),
});

export const getActivitySchema = z.object({
  params: z.object({
    issueId: z.string().uuid('Invalid issue ID'),
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});
