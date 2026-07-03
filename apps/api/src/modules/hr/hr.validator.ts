import { z } from 'zod';

const employeeRoleSchema = z.enum(['manager', 'employee', 'hr']);
const employeeStatusSchema = z.enum(['onboarding', 'active', 'notice_period', 'exited']);

const baseCreateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().max(100).trim().optional(),
  email: z.string().email().max(255).transform(v => v.toLowerCase()),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().date().nullish(),
  joiningDate: z.string().date(),
  designation: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  workMode: z.enum(['office', 'hybrid', 'remote']).optional(),
  workLocation: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  managerEmployeeId: z.string().uuid().optional(),
  status: employeeStatusSchema.optional(),
  temporaryPassword: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/,
      'Password must contain uppercase, lowercase, number, and special character'
    )
    .optional(),
});

export const createManagerSchema = z.object({
  body: baseCreateEmployeeSchema,
});

export const createEmployeeSchema = z.object({
  body: baseCreateEmployeeSchema,
});

export const listEmployeesQuerySchema = z.object({
  query: z.object({
    role: employeeRoleSchema.optional(),
    status: employeeStatusSchema.optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(100).optional(),
    department: z.string().max(100).optional(),
    branchId: z.string().max(100).optional(),
  }),
});

export const assignManagerSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid(),
  }),
  body: z.object({
    managerEmployeeId: z.string().uuid(),
  }),
});

export const changeEmployeeRoleSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid(),
  }),
  body: z.object({
    role: employeeRoleSchema,
  }),
});

export const employeeIdParamSchema = z.object({
  params: z.object({
    employeeId: z.string().min(1),
  }),
});

export const setWorkEmailSchema = z.object({
  params: z.object({
    employeeId: z.string().min(1),
  }),
  body: z.object({
    workEmail: z.string().email('Invalid email format').max(255).transform(v => v.toLowerCase()),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128).optional(),
  }),
});

export const updateEmployeeSchema = z.object({
  params: z.object({
    employeeId: z.string().min(1),
  }),
  body: z
    .object({
      firstName: z.string().min(1).max(100).optional(),
      lastName: z.string().max(100).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(20).nullable().optional(),
      gender: z.enum(['male', 'female', 'other']).nullable().optional(),
      dateOfBirth: z.string().date().nullable().optional(),
      joiningDate: z.string().date().optional(),
      designation: z.string().max(100).optional(),
      department: z.string().max(100).optional(),
      workMode: z.enum(['office', 'hybrid', 'remote']).nullable().optional(),
      workLocation: z.string().max(200).nullable().optional(),
      country: z.string().max(100).nullable().optional(),
      status: employeeStatusSchema.optional(),
    })
    .passthrough()
    .refine(payload => Object.keys(payload).length > 0, 'At least one field is required'),
});

export const onboardingInitiateSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid(),
  }),
  body: z.object({
    targetCompletionDate: z.string().date().optional(),
  }),
});

export const onboardingListQuerySchema = z.object({
  query: z.object({
    status: z.enum(['in_progress', 'completed']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const onboardingTaskUpdateSchema = z.object({
  params: z.object({
    onboardingId: z.string().uuid(),
    taskId: z.string().uuid(),
  }),
  body: z.object({
    completed: z.boolean(),
    notes: z.string().max(1000).optional(),
  }),
});

export const offboardingInitiateSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid(),
  }),
  body: z.object({
    lastWorkingDay: z.string().date(),
    exitReason: z.enum(['resignation', 'termination', 'end_of_contract', 'other']),
    additionalNotes: z.string().max(1000).optional(),
  }),
});

export const offboardingListQuerySchema = z.object({
  query: z.object({
    status: z.enum(['in_progress', 'completed', 'all']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const offboardingTaskUpdateSchema = z.object({
  params: z.object({
    offboardingId: z.string().uuid(),
    taskId: z.string().uuid(),
  }),
  body: z.object({
    completed: z.boolean(),
    notes: z.string().max(1000).optional(),
  }),
});

export const attendanceListQuerySchema = z.object({
  query: z.object({
    employeeId: z.string().uuid().optional(),
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
    status: z.enum(['checked_in', 'present', 'absent', 'incomplete', 'on_leave', 'holiday']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const attendanceCorrectionSchema = z.object({
  params: z.object({
    attendanceId: z.string().uuid(),
  }),
  body: z.object({
    checkInTime: z.string().datetime().nullable().optional(),
    checkOutTime: z.string().datetime().nullable().optional(),
    reason: z.string().min(3).max(500),
  }),
});

export const attendanceManualSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid(),
    date: z.string().date(),
    checkInTime: z.string().datetime().nullable().optional(),
    checkOutTime: z.string().datetime().nullable().optional(),
    status: z.enum(['present', 'absent', 'incomplete', 'on_leave', 'holiday']),
    reason: z.string().min(3).max(500),
  }),
});

export const attendanceRegularizationListQuerySchema = z.object({
  query: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'escalated']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const attendanceRegularizationApproveSchema = z.object({
  params: z.object({
    requestId: z.string().uuid(),
  }),
  body: z.object({
    note: z.string().max(500).optional(),
  }),
});

export const attendanceRegularizationRejectSchema = z.object({
  params: z.object({
    requestId: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().min(3).max(500),
  }),
});

export const leaveListQuerySchema = z.object({
  query: z.object({
    employeeId: z.string().uuid().optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const leaveDecisionSchema = z.object({
  params: z.object({
    leaveId: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});

export const leaveBalanceAdjustSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid(),
  }),
  body: z.object({
    leaveType: z.string().min(1),
    adjustment: z.number().refine(v => v !== 0, 'Adjustment cannot be zero'),
    reason: z.string().min(3).max(500),
    year: z.number().int().optional(),
  }),
});

export const leaveAccrualConfigUpdateSchema = z.object({
  body: z.object({
    casualPerMonth: z.number().min(0).optional(),
    sickPerMonth: z.number().min(0).optional(),
    earnedPerMonth: z.number().min(0).optional(),
    maxPaidLeavesPerMonth: z.number().min(0).optional(),
    leaveTypes: z.array(z.any()).optional(),
    branchId: z.string().optional(),
  }),
});

export const selfApplyLeaveSchema = z.object({
  body: z.object({
    leaveType: z.string().min(1),
    fromDate: z.string().date(),
    toDate: z.string().date(),
    session: z.enum(['full_day', 'first_half', 'second_half']).optional(),
    reason: z.string().max(1000).optional(),
  }),
});

export const selfLeaveListQuerySchema = z.object({
  query: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
  }),
});

export const selfLeaveBalanceQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2020).max(2100).optional(),
  }),
});

export const selfLeaveIdParamSchema = z.object({
  params: z.object({
    leaveId: z.string().uuid(),
  }),
});

export const leaveEditSchema = z.object({
  params: z.object({
    leaveId: z.string().uuid(),
  }),
  body: z.object({
    leaveType: z.string().min(1).optional(),
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
    days: z.number().min(0.5).max(365).optional(),
    session: z.enum(['full_day', 'first_half', 'second_half']).optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    reason: z.string().max(500).optional(),
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' }),
});

export const leaveSummaryByEmployeeSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid(),
  }),
  query: z.object({
    year: z.coerce.number().int().min(2020).max(2100).optional(),
  }),
});

export const holidaysListQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().optional(),
    type: z.enum(['national', 'regional', 'company', 'optional']).optional(),
    branchId: z.string().uuid().optional(),
  }),
});

export const holidayCreateSchema = z.object({
  body: z.object({
    date: z.string().date(),
    name: z.string().min(1).max(200),
    type: z.enum(['national', 'regional', 'company', 'optional']),
    location: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
  }),
});

export const holidayUpdateSchema = z.object({
  params: z.object({
    holidayId: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    type: z.enum(['national', 'regional', 'company', 'optional']).optional(),
    location: z.string().max(200).nullable().optional(),
    description: z.string().max(1000).nullable().optional(),
  }),
});

export const holidayUploadSchema = z.object({
  body: z.object({
    holidays: z.array(
      z.object({
        date: z.string().date(),
        name: z.string().min(1).max(200),
        type: z.enum(['national', 'regional', 'company', 'optional']),
        location: z.string().max(200).optional(),
        description: z.string().max(1000).optional(),
      })
    ),
  }),
});

export const payrollUploadSchema = z.object({
  body: z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
    rows: z.array(
      z.object({
        employeeId: z.string(),
        gross: z.number().positive(),
        deductions: z.number().min(0),
        net: z.number().positive(),
        earningsBreakdown: z
          .array(
            z.object({
              label: z.string().min(1).max(100),
              amount: z.number().min(0),
            })
          )
          .optional(),
        deductionsBreakdown: z
          .array(
            z.object({
              label: z.string().min(1).max(100),
              amount: z.number().min(0),
            })
          )
          .optional(),
        totalWorkingDays: z.number().int().min(0).max(31).optional(),
        leaves: z.number().int().min(0).max(31).optional(),
        lopDays: z.number().int().min(0).max(31).optional(),
        paidDays: z.number().int().min(0).max(31).optional(),
      })
    ),
  }),
});

export const payrollUploadCsvSchema = z.object({
  body: z
    .object({
      month: z.coerce.number().int().min(1).max(12).optional(),
      year: z.coerce.number().int().min(2020).max(2100).optional(),
    })
    .refine(
      value =>
        (value.month === undefined && value.year === undefined) ||
        (value.month !== undefined && value.year !== undefined),
      {
        message: 'month and year must be provided together',
        path: ['year'],
      }
    ),
});

export const payrollGenerateSchema = z.object({
  body: z.object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2100),
  }),
});

export const payrollStatusQuerySchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2020).max(2100),
  }),
});

export const orgReassignManagerSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid(),
    managerEmployeeId: z.string().uuid().nullable(),
  }),
});

export const reportQuerySchema = z.object({
  query: z.object({
    fromDate: z.string().date().optional(),
    toDate: z.string().date().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    format: z.enum(['json', 'csv', 'pdf']).optional(),
    employeeId: z.string().uuid().optional(),
    branchId: z.string().optional(),
  }),
});

export type CreateManagerInput = z.infer<typeof createManagerSchema>['body'];
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>['body'];

