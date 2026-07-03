import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { LeadsService } from './leads.service';

const STATUS_ENUM = ['new', 'follow_up', 'qualified', 'won', 'lost'] as const;

const createLeadSchema = z.object({
  name: z.string().min(1).max(255),
  company: z.string().max(255).optional(),
  source: z.string().max(100).optional(),
  status: z.enum(STATUS_ENUM).optional(),
  remarks: z.string().optional(),
  followUpDate: z.string().datetime().nullable().optional(),
});

const updateLeadSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  company: z.string().max(255).nullable().optional(),
  source: z.string().max(100).nullable().optional(),
  status: z.enum(STATUS_ENUM).optional(),
  remarks: z.string().nullable().optional(),
  followUpDate: z.string().datetime().nullable().optional(),
});

export class LeadsController {
  private leadsService: LeadsService;

  constructor() {
    this.leadsService = new LeadsService();
  }

  createLead = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = createLeadSchema.parse(req.body);
      const lead = await this.leadsService.createLead(
        {
          name: input.name,
          company: input.company,
          source: input.source,
          status: input.status,
          remarks: input.remarks,
          followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
        },
        req.user!.id
      );
      res.status(201).json({ success: true, message: 'Lead created successfully', data: lead });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  getLeads = asyncHandler(async (_req: Request, res: Response) => {
    const leads = await this.leadsService.getLeads();
    res.json({ success: true, data: leads });
  });

  getLead = asyncHandler(async (req: Request, res: Response) => {
    const lead = await this.leadsService.getLead(req.params.leadId);
    res.json({ success: true, data: lead });
  });

  updateLead = asyncHandler(async (req: Request, res: Response) => {
    try {
      const input = updateLeadSchema.parse(req.body);
      const lead = await this.leadsService.updateLead(req.params.leadId, {
        name: input.name,
        company: input.company,
        source: input.source,
        status: input.status,
        remarks: input.remarks,
        followUpDate:
          input.followUpDate === undefined
            ? undefined
            : input.followUpDate
            ? new Date(input.followUpDate)
            : null,
      });
      res.json({ success: true, message: 'Lead updated successfully', data: lead });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw ApiError.badRequest('Validation error', 'VALIDATION_ERROR', error.errors);
      }
      throw error;
    }
  });

  deleteLead = asyncHandler(async (req: Request, res: Response) => {
    await this.leadsService.deleteLead(req.params.leadId);
    res.json({ success: true, message: 'Lead deleted successfully' });
  });
}
