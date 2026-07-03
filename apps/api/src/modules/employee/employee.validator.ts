import { z } from 'zod';

export const myAttendanceQuerySchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});

export const submitAttendanceRegularizationSchema = z.object({
  body: z
    .object({
      attendanceDate: z.string().date(),
      requestedCheckInTime: z.string().datetime({ offset: true }).optional(),
      requestedCheckOutTime: z.string().datetime({ offset: true }).optional(),
      reason: z.string().min(3).max(500),
    })
    .refine(
      payload => Boolean(payload.requestedCheckInTime || payload.requestedCheckOutTime),
      'At least one of requestedCheckInTime or requestedCheckOutTime is required'
    ),
});

export const listAttendanceRegularizationsQuerySchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'escalated']).optional(),
  }),
});

export const updateMyProfileSchema = z.object({
  body: z
    .object({
      firstName: z.string().max(100).optional(),
      lastName: z.string().max(100).optional(),
      phone: z.string().max(20).optional(),
      dateOfBirth: z.string().date().optional(),
      maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
      workLocation: z.string().max(200).optional(),
      personalEmail: z.string().email().optional(),
      currentAddress: z.string().max(500).optional(),
      permanentAddress: z.string().max(500).optional(),
      emergencyContactName: z.string().max(200).optional(),
      emergencyContactPhone: z.string().max(20).optional(),
      emergencyContactRelation: z.string().max(100).optional(),
    })
    .refine(value => Object.keys(value).length > 0, 'At least one field is required'),
});

export const applyLeaveSchema = z.object({
  body: z.object({
    leaveType: z.string().min(1),
    fromDate: z.string().date(),
    toDate: z.string().date(),
    reason: z.string().max(1000).optional(),
  }),
});

export const listMyLeavesQuerySchema = z.object({
  query: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
  }),
});

export const leaveIdParamSchema = z.object({
  params: z.object({
    leaveId: z.string().uuid(),
  }),
});

export const myBalanceQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2020).max(2100).optional(),
  }),
});

export const myPayrollQuerySchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
  }),
});

