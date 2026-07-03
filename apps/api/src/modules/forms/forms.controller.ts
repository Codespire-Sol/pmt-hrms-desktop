import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { formsService } from './forms.service';
import { CreateFormInput, SubmitFormInput, UpdateFormInput } from './forms.types';
import {
  createFormAccessTokenSchema,
  createFormSchema,
  submitFormSchema,
  updateFormSchema,
} from './forms.validator';

export class FormsController {
  createForm = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createFormSchema.parse(req.body) as CreateFormInput;
      const form = await formsService.createForm(req.params.projectId, input, req.user!.id);

      res.status(201).json({
        success: true,
        message: 'Form created successfully',
        data: form,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  listForms = asyncHandler(async (req: Request, res: Response) => {
    const forms = await formsService.listForms(req.params.projectId, req.user!.id);
    res.json({ success: true, data: forms });
  });

  getForm = asyncHandler(async (req: Request, res: Response) => {
    const form = await formsService.getForm(req.params.formId, req.user!.id);
    res.json({ success: true, data: form });
  });

  updateForm = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateFormSchema.parse(req.body) as UpdateFormInput;
      const form = await formsService.updateForm(req.params.formId, input, req.user!.id);
      res.json({
        success: true,
        message: 'Form updated successfully',
        data: form,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteForm = asyncHandler(async (req: Request, res: Response) => {
    const result = await formsService.deleteForm(req.params.formId, req.user!.id);
    res.json({ success: true, ...result });
  });

  publishForm = asyncHandler(async (req: Request, res: Response) => {
    const form = await formsService.publishForm(req.params.formId, req.user!.id);
    res.json({
      success: true,
      message: 'Form published successfully',
      data: form,
    });
  });

  createAccessToken = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createFormAccessTokenSchema.parse(req.body);
      const token = await formsService.createAccessToken(req.params.formId, req.user!.id, input.expiresAt);
      res.status(201).json({
        success: true,
        message: 'Form access token created',
        data: token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getPublicForm = asyncHandler(async (req: Request, res: Response) => {
    const token = (req.query.token as string) || req.header('x-form-token') || undefined;
    const form = await formsService.getPublicForm(req.params.formId, token);
    res.json({ success: true, data: form });
  });

  submitForm = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = submitFormSchema.parse(req.body) as SubmitFormInput;
      const tokenHeader = req.header('x-form-token') || undefined;
      const submission = await formsService.submitForm(
        req.params.formId,
        input,
        req.user?.id,
        tokenHeader
      );
      res.status(201).json({
        success: true,
        message: 'Form submitted successfully',
        data: submission,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  listSubmissions = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const result = await formsService.listSubmissions(req.params.formId, req.user!.id, page, limit);
    res.json({ success: true, data: result });
  });
}

export const formsController = new FormsController();
