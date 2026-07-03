import { Request, Response } from 'express';
import { z } from 'zod';
import { ScreensService } from './screens.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

const createScreenSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateScreenSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const createTabSchema = z.object({
  name: z.string().min(1).max(100),
  position: z.number().int().min(0).optional(),
});

const updateTabSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.number().int().min(0).optional(),
});

const addFieldSchema = z.object({
  fieldId: z.string().min(1),
  fieldType: z.enum(['system', 'custom']),
  position: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
});

const updateFieldSchema = z.object({
  position: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
});

const reorderFieldsSchema = z.object({
  fieldIds: z.array(z.string().uuid()),
});

const createScreenSchemeSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  items: z.array(z.object({
    screenId: z.string().uuid(),
    operation: z.enum(['create', 'view', 'edit', 'transition']),
  })).optional(),
});

const updateScreenSchemeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const setSchemeItemSchema = z.object({
  operation: z.enum(['create', 'view', 'edit', 'transition']),
  screenId: z.string().uuid(),
});

const createIssueTypeScreenSchemeSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  items: z.array(z.object({
    issueTypeId: z.string().uuid().nullable().optional(),
    screenSchemeId: z.string().uuid(),
  })).optional(),
});

const updateIssueTypeScreenSchemeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const setIssueTypeSchemeItemSchema = z.object({
  issueTypeId: z.string().uuid().nullable(),
  screenSchemeId: z.string().uuid(),
});

export class ScreensController {
  private service: ScreensService;

  constructor() {
    this.service = new ScreensService();
  }

  // === Screen Endpoints ===

  createScreen = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createScreenSchema.parse(req.body);
      const screen = await this.service.createScreen(input as any);

      res.status(201).json({
        success: true,
        message: 'Screen created successfully',
        data: screen,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getScreen = asyncHandler(async (req: Request, res: Response) => {
    const screen = await this.service.getScreen(req.params.screenId);

    res.json({
      success: true,
      data: screen,
    });
  });

  getScreens = asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.query.projectId as string | undefined;
    const screens = await this.service.getScreens(projectId);

    res.json({
      success: true,
      data: screens,
    });
  });

  updateScreen = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateScreenSchema.parse(req.body);
      const screen = await this.service.updateScreen(req.params.screenId, input);

      res.json({
        success: true,
        message: 'Screen updated successfully',
        data: screen,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteScreen = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteScreen(req.params.screenId);

    res.json({
      success: true,
      ...result,
    });
  });

  // === Screen Tab Endpoints ===

  addScreenTab = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createTabSchema.parse(req.body);
      const tab = await this.service.addScreenTab(req.params.screenId, input as any);

      res.status(201).json({
        success: true,
        message: 'Tab added successfully',
        data: tab,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  updateScreenTab = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateTabSchema.parse(req.body);
      const tab = await this.service.updateScreenTab(req.params.tabId, input);

      res.json({
        success: true,
        message: 'Tab updated successfully',
        data: tab,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteScreenTab = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteScreenTab(req.params.tabId);

    res.json({
      success: true,
      ...result,
    });
  });

  // === Tab Field Endpoints ===

  addFieldToTab = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = addFieldSchema.parse(req.body);
      const field = await this.service.addFieldToTab(req.params.tabId, input as any);

      res.status(201).json({
        success: true,
        message: 'Field added to tab',
        data: field,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  updateTabField = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateFieldSchema.parse(req.body);
      const field = await this.service.updateTabField(req.params.fieldId, input);

      res.json({
        success: true,
        message: 'Field updated',
        data: field,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  removeFieldFromTab = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.removeFieldFromTab(req.params.fieldId);

    res.json({
      success: true,
      ...result,
    });
  });

  reorderTabFields = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = reorderFieldsSchema.parse(req.body);
      const result = await this.service.reorderTabFields(req.params.tabId, input.fieldIds);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getSystemFields = asyncHandler(async (_req: Request, res: Response) => {
    const fields = this.service.getSystemFields();

    res.json({
      success: true,
      data: fields,
    });
  });

  // === Screen Scheme Endpoints ===

  createScreenScheme = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createScreenSchemeSchema.parse(req.body);
      const scheme = await this.service.createScreenScheme(input as any);

      res.status(201).json({
        success: true,
        message: 'Screen scheme created successfully',
        data: scheme,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getScreenScheme = asyncHandler(async (req: Request, res: Response) => {
    const scheme = await this.service.getScreenScheme(req.params.schemeId);

    res.json({
      success: true,
      data: scheme,
    });
  });

  getScreenSchemes = asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.query.projectId as string | undefined;
    const schemes = await this.service.getScreenSchemes(projectId);

    res.json({
      success: true,
      data: schemes,
    });
  });

  updateScreenScheme = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateScreenSchemeSchema.parse(req.body);
      const scheme = await this.service.updateScreenScheme(req.params.schemeId, input);

      res.json({
        success: true,
        message: 'Screen scheme updated successfully',
        data: scheme,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteScreenScheme = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteScreenScheme(req.params.schemeId);

    res.json({
      success: true,
      ...result,
    });
  });

  setScreenSchemeItem = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = setSchemeItemSchema.parse(req.body);
      const scheme = await this.service.setScreenSchemeItem(
        req.params.schemeId,
        input.operation,
        input.screenId
      );

      res.json({
        success: true,
        message: 'Screen scheme item updated',
        data: scheme,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  removeScreenSchemeItem = asyncHandler(async (req: Request, res: Response) => {
    const operation = req.params.operation as any;
    const scheme = await this.service.removeScreenSchemeItem(req.params.schemeId, operation);

    res.json({
      success: true,
      message: 'Screen scheme item removed',
      data: scheme,
    });
  });

  // === Issue Type Screen Scheme Endpoints ===

  createIssueTypeScreenScheme = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createIssueTypeScreenSchemeSchema.parse(req.body);
      const scheme = await this.service.createIssueTypeScreenScheme(input as any);

      res.status(201).json({
        success: true,
        message: 'Issue type screen scheme created successfully',
        data: scheme,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getIssueTypeScreenScheme = asyncHandler(async (req: Request, res: Response) => {
    const scheme = await this.service.getIssueTypeScreenScheme(req.params.schemeId);

    res.json({
      success: true,
      data: scheme,
    });
  });

  getIssueTypeScreenSchemes = asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.query.projectId as string | undefined;
    const schemes = await this.service.getIssueTypeScreenSchemes(projectId);

    res.json({
      success: true,
      data: schemes,
    });
  });

  updateIssueTypeScreenScheme = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateIssueTypeScreenSchemeSchema.parse(req.body);
      const scheme = await this.service.updateIssueTypeScreenScheme(req.params.schemeId, input);

      res.json({
        success: true,
        message: 'Issue type screen scheme updated successfully',
        data: scheme,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteIssueTypeScreenScheme = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.deleteIssueTypeScreenScheme(req.params.schemeId);

    res.json({
      success: true,
      ...result,
    });
  });

  setIssueTypeScreenSchemeItem = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = setIssueTypeSchemeItemSchema.parse(req.body);
      const scheme = await this.service.setIssueTypeScreenSchemeItem(
        req.params.schemeId,
        input.issueTypeId,
        input.screenSchemeId
      );

      res.json({
        success: true,
        message: 'Issue type screen scheme item updated',
        data: scheme,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  removeIssueTypeScreenSchemeItem = asyncHandler(async (req: Request, res: Response) => {
    const issueTypeId = req.params.issueTypeId === 'default' ? null : req.params.issueTypeId;
    const scheme = await this.service.removeIssueTypeScreenSchemeItem(req.params.schemeId, issueTypeId);

    res.json({
      success: true,
      message: 'Issue type screen scheme item removed',
      data: scheme,
    });
  });

  // === Get Screen for Issue ===

  getScreenForIssue = asyncHandler(async (req: Request, res: Response) => {
    const { projectId, issueTypeId, operation } = req.query;

    if (!projectId || !issueTypeId || !operation) {
      throw ApiError.badRequest('projectId, issueTypeId, and operation are required');
    }

    const screen = await this.service.getScreenForIssue(
      projectId as string,
      issueTypeId as string,
      operation as any
    );

    res.json({
      success: true,
      data: screen,
    });
  });
}
