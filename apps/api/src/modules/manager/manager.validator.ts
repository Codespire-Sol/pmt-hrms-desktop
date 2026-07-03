import { z } from 'zod';

export const attendanceQuerySchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    format: z.enum(['json', 'csv']).optional(),
  }),
});

export const teamAttendanceRegularizationQuerySchema = z.object({
  query: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'escalated']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const teamAttendanceRegularizationApproveSchema = z.object({
  params: z.object({
    requestId: z.string().uuid(),
  }),
  body: z.object({
    note: z.string().max(500).optional(),
  }),
});

export const teamAttendanceRegularizationRejectSchema = z.object({
  params: z.object({
    requestId: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().min(3).max(500),
  }),
});

export const rejectLeaveSchema = z.object({
  params: z.object({
    leaveId: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().min(3).max(500),
  }),
});

export const approveLeaveSchema = z.object({
  params: z.object({
    leaveId: z.string().uuid(),
  }),
});

export const applyLeaveSchema = z.object({
  body: z.object({
    leaveType: z.string().min(1),
    fromDate: z.string().date(),
    toDate: z.string().date(),
    session: z.enum(['full_day', 'first_half', 'second_half']).optional(),
    reason: z.string().max(1000).optional(),
  }),
});

export const listMyLeavesQuerySchema = z.object({
  query: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
  }),
});

export const myBalanceQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2020).max(2100).optional(),
  }),
});

export const leaveIdParamSchema = z.object({
  params: z.object({
    leaveId: z.string().uuid(),
  }),
});

