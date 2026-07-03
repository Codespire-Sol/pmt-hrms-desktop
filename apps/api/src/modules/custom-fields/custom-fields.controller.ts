import { Request, Response } from 'express';
import { customFieldsService } from './custom-fields.service';
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  setFieldValueSchema,
  setFieldValuesSchema,
  reorderFieldsSchema,
} from './custom-fields.validator';
import {
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  SetCustomFieldValueInput,
} from './custom-fields.types';

export const customFieldsController = {
  // GET /api/v1/projects/:projectId/custom-fields
  async listFields(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const fields = await customFieldsService.getFieldsByProject(projectId);

      res.json({
        success: true,
        data: fields,
      });
    } catch (error: any) {
      console.error('Error listing custom fields:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Failed to list custom fields',
        },
      });
    }
  },

  // POST /api/v1/projects/:projectId/custom-fields
  async createField(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const input = createCustomFieldSchema.parse(req.body) as CreateCustomFieldInput;

      const field = await customFieldsService.createField(projectId, input);

      res.status(201).json({
        success: true,
        data: field,
      });
    } catch (error: any) {
      console.error('Error creating custom field:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Failed to create custom field',
        },
      });
    }
  },

  // GET /api/v1/custom-fields/:fieldId
  async getField(req: Request, res: Response) {
    try {
      const { fieldId } = req.params;
      const field = await customFieldsService.getFieldById(fieldId);

      res.json({
        success: true,
        data: field,
      });
    } catch (error: any) {
      console.error('Error getting custom field:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Failed to get custom field',
        },
      });
    }
  },

  // PATCH /api/v1/custom-fields/:fieldId
  async updateField(req: Request, res: Response) {
    try {
      const { fieldId } = req.params;
      const input = updateCustomFieldSchema.parse(req.body) as UpdateCustomFieldInput;

      const field = await customFieldsService.updateField(fieldId, input);

      res.json({
        success: true,
        data: field,
      });
    } catch (error: any) {
      console.error('Error updating custom field:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Failed to update custom field',
        },
      });
    }
  },

  // DELETE /api/v1/custom-fields/:fieldId
  async deleteField(req: Request, res: Response) {
    try {
      const { fieldId } = req.params;
      await customFieldsService.deleteField(fieldId);

      res.json({
        success: true,
        message: 'Custom field deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting custom field:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Failed to delete custom field',
        },
      });
    }
  },

  // POST /api/v1/projects/:projectId/custom-fields/reorder
  async reorderFields(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { fieldIds } = reorderFieldsSchema.parse(req.body);

      const fields = await customFieldsService.reorderFields(projectId, fieldIds);

      res.json({
        success: true,
        data: fields,
      });
    } catch (error: any) {
      console.error('Error reordering custom fields:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Failed to reorder custom fields',
        },
      });
    }
  },

  // GET /api/v1/issues/:issueId/custom-fields
  async getIssueFieldValues(req: Request, res: Response) {
    try {
      const { issueId } = req.params;
      const values = await customFieldsService.getFieldValuesByIssue(issueId);

      res.json({
        success: true,
        data: values,
      });
    } catch (error: any) {
      console.error('Error getting issue custom field values:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Failed to get custom field values',
        },
      });
    }
  },

  // PUT /api/v1/issues/:issueId/custom-fields/:fieldId
  async setIssueFieldValue(req: Request, res: Response) {
    try {
      const { issueId, fieldId } = req.params;
      const { value } = setFieldValueSchema.parse(req.body);

      const result = await customFieldsService.setFieldValue(issueId, fieldId, value);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error setting custom field value:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Failed to set custom field value',
        },
      });
    }
  },

  // PUT /api/v1/issues/:issueId/custom-fields
  async setIssueFieldValues(req: Request, res: Response) {
    try {
      const { issueId } = req.params;
      const { values } = setFieldValuesSchema.parse(req.body) as { values: SetCustomFieldValueInput[] };

      const results = await customFieldsService.setFieldValues(issueId, values);

      res.json({
        success: true,
        data: results,
      });
    } catch (error: any) {
      console.error('Error setting custom field values:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Failed to set custom field values',
        },
      });
    }
  },

  // DELETE /api/v1/issues/:issueId/custom-fields/:fieldId
  async deleteIssueFieldValue(req: Request, res: Response) {
    try {
      const { issueId, fieldId } = req.params;
      await customFieldsService.deleteFieldValue(issueId, fieldId);

      res.json({
        success: true,
        message: 'Custom field value deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting custom field value:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'Failed to delete custom field value',
        },
      });
    }
  },
};
