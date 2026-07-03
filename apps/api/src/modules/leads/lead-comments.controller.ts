import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { LeadCommentsRepository } from './lead-comments.repository';
import { LeadsRepository } from './leads.repository';
import { prisma } from '../../database/prisma';

const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export class LeadCommentsController {
  private commentsRepo = new LeadCommentsRepository();
  private leadsRepo = new LeadsRepository();

  getComments = asyncHandler(async (req: Request, res: Response) => {
    const lead = await this.leadsRepo.findById(req.params.leadId);
    if (!lead) throw ApiError.notFound('Lead not found');

    const comments = await this.commentsRepo.findByLeadId(req.params.leadId);
    res.json({ success: true, data: comments });
  });

  createComment = asyncHandler(async (req: Request, res: Response) => {
    const lead = await this.leadsRepo.findById(req.params.leadId);
    if (!lead) throw ApiError.notFound('Lead not found');

    try {
      const { content } = createCommentSchema.parse(req.body);
      const user = req.user!;

      // Fetch firstName/lastName from DB since req.user only carries id + email
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { firstName: true, lastName: true, email: true },
      });
      const authorName =
        dbUser
          ? `${dbUser.firstName} ${dbUser.lastName ?? ''}`.trim() || dbUser.email
          : user.email;

      const comment = await this.commentsRepo.create(req.params.leadId, content, authorName, user.id);
      res.status(201).json({ success: true, message: 'Comment added', data: comment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteComment = asyncHandler(async (req: Request, res: Response) => {
    const comment = await this.commentsRepo.findById(req.params.commentId);
    if (!comment) throw ApiError.notFound('Comment not found');
    if (comment.createdBy !== req.user!.id) throw ApiError.forbidden('Not allowed');

    await this.commentsRepo.delete(req.params.commentId);
    res.json({ success: true, message: 'Comment deleted' });
  });
}
