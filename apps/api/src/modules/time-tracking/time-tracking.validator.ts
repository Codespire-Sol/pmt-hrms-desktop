import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
};

const parseBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return value;
};

const hasValidDateRange = (data: { startDate: string; endDate: string }) =>
  new Date(data.startDate) <= new Date(data.endDate);

export const logTimeSchema = z.object({
  hours: z
    .number()
    .min(0.25, 'Minimum time log is 15 minutes (0.25 hours)')
    .max(24, 'Maximum time log is 24 hours'),
  description: z.string().max(2000).optional(),
  workDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  isBillable: z.boolean().optional().default(true),
});

export const updateTimeLogSchema = z.object({
  hours: z
    .number()
    .min(0.25, 'Minimum time log is 15 minutes (0.25 hours)')
    .max(24, 'Maximum time log is 24 hours')
    .optional(),
  description: z.string().max(2000).optional(),
  workDate: z
    .string()
    .regex(dateRegex, 'Invalid date format (YYYY-MM-DD)')
    .optional(),
  isBillable: z.boolean().optional(),
});

export const startTimerSchema = z.object({
  issueId: z.string().uuid('Invalid issue ID'),
  description: z.string().max(500).optional(),
});

export const stopTimerSchema = z.object({
  description: z.string().max(500).optional(),
});

export const timesheetQuerySchema = z.object({
  startDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  userId: z.string().uuid().optional(),
});

export const timeReportQuerySchema = z.object({
  startDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
});

export const exportQuerySchema = z.object({
  format: z.enum(['csv']).default('csv'),
  startDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  projectId: z.string().uuid().optional(),
});

export const timesheetLogSchema = z.object({
  issueId: z.string().uuid('Invalid issue ID'),
  workDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
  hoursWorked: z.preprocess(
    parseNumber,
    z
      .number()
      .min(0.25, 'Minimum time log is 15 minutes (0.25 hours)')
      .max(24, 'Maximum time log is 24 hours')
  ),
  notes: z.string().max(2000).optional(),
  isBillable: z.preprocess(parseBoolean, z.boolean()).optional().default(true),
});

export const timesheetUpdateLogSchema = z
  .object({
    hoursWorked: z.preprocess(
      parseNumber,
      z
        .number()
        .min(0.25, 'Minimum time log is 15 minutes (0.25 hours)')
        .max(24, 'Maximum time log is 24 hours')
    ).optional(),
    notes: z.string().max(2000).optional(),
    workDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)').optional(),
    isBillable: z.preprocess(parseBoolean, z.boolean()).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'At least one field is required',
  });

export const timesheetHistoryQuerySchema = z
  .object({
    startDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
    endDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
    issueId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    viewAll: z.preprocess(parseBoolean, z.boolean()).optional(),
    isBillable: z.preprocess(parseBoolean, z.boolean()).optional(),
    groupBy: z.enum(['day', 'none']).optional().default('day'),
    page: z.preprocess(parseNumber, z.number().int().min(1)).optional().default(1),
    limit: z.preprocess(parseNumber, z.number().int().min(1).max(1000)).optional().default(50),
  })
  .refine(hasValidDateRange, {
    message: 'startDate must be less than or equal to endDate',
  });

export const timesheetSummaryQuerySchema = z
  .object({
    startDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
    endDate: z.string().regex(dateRegex, 'Invalid date format (YYYY-MM-DD)'),
    issueId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    viewAll: z.preprocess(parseBoolean, z.boolean()).optional(),
    includeBreakdowns: z.preprocess(parseBoolean, z.boolean()).optional().default(true),
  })
  .refine(hasValidDateRange, {
    message: 'startDate must be less than or equal to endDate',
  });
