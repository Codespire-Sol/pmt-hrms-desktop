import { Request, Response, NextFunction } from 'express';
import { commentsService } from './comments.service';

export const commentsController = {
  // Create a comment
  async createComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { issueId } = req.params;
      const { content, parentId } = req.body;
      const userId = req.user!.id;

      const comment = await commentsService.createComment({
        issueId,
        authorId: userId,
        content,
        parentId,
      });

      res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get comments for an issue
  async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { issueId } = req.params;
      const { page = '1', limit = '50' } = req.query;
      const userId = req.user!.id;

      const result = await commentsService.getComments(
        issueId,
        userId,
        parseInt(page as string, 10),
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // Update a comment
  async updateComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const userId = req.user!.id;

      const comment = await commentsService.updateComment(commentId, userId, { content });

      res.json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  },

  // Delete a comment
  async deleteComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const userId = req.user!.id;
      const isAdmin = req.user!.role?.name === 'admin';

      await commentsService.deleteComment(commentId, userId, isAdmin);

      res.json({
        success: true,
        message: 'Comment deleted',
      });
    } catch (error) {
      next(error);
    }
  },

  // Add reaction
  async addReaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId } = req.params;
      const { emoji } = req.body;
      const userId = req.user!.id;

      const result = await commentsService.addReaction(commentId, userId, emoji);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // Remove reaction
  async removeReaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commentId, emoji } = req.params;
      const userId = req.user!.id;

      await commentsService.removeReaction(commentId, userId, decodeURIComponent(emoji));

      res.json({
        success: true,
        message: 'Reaction removed',
      });
    } catch (error) {
      next(error);
    }
  },

  // Get activity feed
  async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { issueId } = req.params;
      const { page = '1', limit = '50' } = req.query;

      const result = await commentsService.getActivity(
        issueId,
        parseInt(page as string, 10),
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get allowed emojis
  async getAllowedEmojis(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const emojis = commentsService.getAllowedEmojis();

      res.json({
        success: true,
        data: emojis,
      });
    } catch (error) {
      next(error);
    }
  },
};
