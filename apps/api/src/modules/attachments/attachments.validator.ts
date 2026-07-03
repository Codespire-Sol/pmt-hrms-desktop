import { z } from 'zod';

export const uploadToIssueSchema = z.object({
  params: z.object({
    issueId: z.string().uuid('Invalid issue ID'),
  }),
});

export const uploadToCommentSchema = z.object({
  params: z.object({
    commentId: z.string().uuid('Invalid comment ID'),
  }),
});

export const getByIssueSchema = z.object({
  params: z.object({
    issueId: z.string().uuid('Invalid issue ID'),
  }),
});

export const getByCommentSchema = z.object({
  params: z.object({
    commentId: z.string().uuid('Invalid comment ID'),
  }),
});

export const attachmentIdSchema = z.object({
  params: z.object({
    attachmentId: z.string().uuid('Invalid attachment ID'),
  }),
});
