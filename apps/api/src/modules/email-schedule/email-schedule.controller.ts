import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';

const VALID_TYPES = ['daily_pmt', 'daily_attendance', 'weekly_report', 'monthly_summary'] as const;

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  recipients: z.array(z.string().email('Invalid email address')).optional(),
});

export class EmailScheduleController {

  // GET /email-schedule — return all 4 configs
  getAll = asyncHandler(async (_req: Request, res: Response) => {
    const configs = await prisma.emailScheduleConfig.findMany({
      orderBy: { scheduleType: 'asc' },
    });
    res.json({ success: true, data: configs });
  });

  // GET /email-schedule/:type
  getOne = asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type as any)) throw ApiError.badRequest('Invalid schedule type');

    const config = await prisma.emailScheduleConfig.findUnique({ where: { scheduleType: type } });
    if (!config) throw ApiError.notFound('Schedule config not found');

    res.json({ success: true, data: config });
  });

  // PATCH /email-schedule/:type — update enabled flag and/or recipients
  update = asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type as any)) throw ApiError.badRequest('Invalid schedule type');

    const input = updateSchema.parse(req.body);

    const config = await prisma.emailScheduleConfig.upsert({
      where: { scheduleType: type },
      update: {
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.recipients !== undefined && { recipients: input.recipients }),
      },
      create: {
        scheduleType: type,
        enabled: input.enabled ?? true,
        recipients: input.recipients ?? [],
      },
    });

    res.json({ success: true, message: 'Schedule config updated', data: config });
  });

  // POST /email-schedule/:type/trigger — manually fire an email for testing
  trigger = asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type as any)) throw ApiError.badRequest('Invalid schedule type');

    // Check config exists and has recipients before attempting to send
    const config = await prisma.emailScheduleConfig.findUnique({ where: { scheduleType: type } });
    if (!config) {
      throw ApiError.badRequest(`No config found for "${type}". Save at least one recipient first.`);
    }
    if (!config.recipients || config.recipients.length === 0) {
      throw ApiError.badRequest(`No recipients configured for "${type}". Add at least one recipient and save before triggering.`);
    }

    const { emailSchedulerService } = await import('../../services/emailSchedulerService');

    // Access private method via cast for test trigger
    const svc = emailSchedulerService as any;

    // Use IST date (UTC+5:30) so the data fetched matches what the scheduler would fetch
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + IST_OFFSET_MS);
    const today = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(istNow.getUTCDate()).padStart(2, '0')}`;

    switch (type) {
      case 'daily_pmt':        await svc.sendDailyPMT(today);        break;
      case 'daily_attendance': await svc.sendDailyAttendance(today);  break;
      case 'weekly_report':    await svc.sendWeeklyReport(today);     break;
      case 'monthly_summary':  await svc.sendMonthlySummary(today);   break;
    }

    res.json({ success: true, message: `Test email triggered for: ${type}`, recipients: config.recipients });
  });
}
