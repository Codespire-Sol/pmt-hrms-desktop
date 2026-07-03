import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';
import { hrController } from './hr.controller';
import {
  attendanceCorrectionSchema,
  attendanceListQuerySchema,
  attendanceManualSchema,
  attendanceRegularizationApproveSchema,
  attendanceRegularizationListQuerySchema,
  attendanceRegularizationRejectSchema,
  assignManagerSchema,
  changeEmployeeRoleSchema,
  createEmployeeSchema,
  createManagerSchema,
  employeeIdParamSchema,
  holidayCreateSchema,
  holidayUpdateSchema,
  holidayUploadSchema,
  holidaysListQuerySchema,
  leaveAccrualConfigUpdateSchema,
  leaveBalanceAdjustSchema,
  leaveDecisionSchema,
  leaveEditSchema,
  leaveListQuerySchema,
  leaveSummaryByEmployeeSchema,
  listEmployeesQuerySchema,
  offboardingInitiateSchema,
  offboardingListQuerySchema,
  offboardingTaskUpdateSchema,
  onboardingInitiateSchema,
  onboardingListQuerySchema,
  onboardingTaskUpdateSchema,
  orgReassignManagerSchema,
  payrollGenerateSchema,
  payrollStatusQuerySchema,
  payrollUploadCsvSchema,
  payrollUploadSchema,
  reportQuerySchema,
  selfApplyLeaveSchema,
  selfLeaveBalanceQuerySchema,
  selfLeaveIdParamSchema,
  selfLeaveListQuerySchema,
  setWorkEmailSchema,
  updateEmployeeSchema,
} from './hr.validator';

const router = Router();
const payrollCsvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

const employeeDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

router.use(authenticate);

// HR self leave flow (no explicit permission checks)
router.post('/my/leaves', validate(selfApplyLeaveSchema), hrController.applyMyLeave);
router.get('/my/leaves', validate(selfLeaveListQuerySchema), hrController.listMyLeaves);
router.get('/my/leaves/summary', validate(selfLeaveBalanceQuerySchema), hrController.getMyLeaveSummary);
router.delete('/my/leaves/:leaveId', validate(selfLeaveIdParamSchema), hrController.cancelMyLeave);
router.get('/my/leave-balance', validate(selfLeaveBalanceQuerySchema), hrController.getMyLeaveBalance);

router.get('/dashboard', requirePermission('employees.read_all'), hrController.getDashboard);

// Branch listing (read-only, for filter dropdowns — available to any HR / admin user)
router.get('/branches', requirePermission('employees.read_all'), hrController.listBranches);

router.get(
  '/employees',
  requirePermission('employees.read_all'),
  validate(listEmployeesQuerySchema),
  hrController.listEmployees
);

router.get(
  '/managers/active',
  requirePermission('employees.read_all'),
  hrController.listActiveManagers
);

router.post(
  '/employees/managers',
  requirePermission('employees.create_manager'),
  validate(createManagerSchema),
  hrController.createManager
);

router.post(
  '/employees',
  requirePermission('employees.create_employee'),
  validate(createEmployeeSchema),
  hrController.createEmployee
);

router.patch(
  '/employees/:employeeId/manager',
  requirePermission('employees.assign_manager'),
  validate(assignManagerSchema),
  hrController.assignManager
);

router.patch(
  '/employees/:employeeId/role',
  requirePermission('employees.change_role'),
  validate(changeEmployeeRoleSchema),
  hrController.changeEmployeeRole
);

router.get(
  '/employees/:employeeId/payroll',
  requirePermission('payroll.read_status'),
  validate(employeeIdParamSchema),
  hrController.getEmployeePayrollHistory
);

router.get(
  '/employees/:employeeId',
  requirePermission('employees.read_all'),
  validate(employeeIdParamSchema),
  hrController.getEmployeeById
);

router.patch(
  '/employees/:employeeId',
  requirePermission('employees.update'),
  validate(updateEmployeeSchema),
  hrController.updateEmployee
);

router.delete(
  '/employees/purge-all',
  requirePermission('admin.settings'),
  hrController.purgeAllEmployees
);

router.delete(
  '/employees/:employeeId',
  requirePermission('employees.soft_delete'),
  validate(employeeIdParamSchema),
  hrController.deleteEmployee
);

router.delete(
  '/employees/:employeeId/purge',
  requirePermission('admin.settings'),
  validate(employeeIdParamSchema),
  hrController.hardDeleteEmployee
);

router.post(
  '/onboarding/:employeeId/initiate',
  requirePermission('onboarding.initiate'),
  validate(onboardingInitiateSchema),
  hrController.initiateOnboarding
);

router.get(
  '/onboarding',
  requirePermission('onboarding.read_all'),
  validate(onboardingListQuerySchema),
  hrController.listOnboarding
);

router.get(
  '/onboarding/:employeeId',
  requirePermission('onboarding.read_all'),
  validate(employeeIdParamSchema),
  hrController.getOnboardingByEmployee
);

router.patch(
  '/onboarding/:onboardingId/tasks/:taskId',
  requirePermission('onboarding.update_tasks'),
  validate(onboardingTaskUpdateSchema),
  hrController.updateOnboardingTask
);

router.post(
  '/onboarding/:employeeId/complete',
  requirePermission('onboarding.complete'),
  validate(employeeIdParamSchema),
  hrController.completeOnboarding
);

router.patch(
  '/employees/:employeeId/work-email',
  requirePermission('employees.update'),
  validate(setWorkEmailSchema),
  hrController.setWorkEmail
);

router.post(
  '/offboarding/:employeeId/initiate',
  requirePermission('offboarding.initiate'),
  validate(offboardingInitiateSchema),
  hrController.initiateOffboarding
);

router.get(
  '/offboarding',
  requirePermission('offboarding.read_all'),
  validate(offboardingListQuerySchema),
  hrController.listOffboarding
);

router.get(
  '/offboarding/export',
  requirePermission('offboarding.read_all'),
  hrController.exportOffboarding
);

router.get(
  '/offboarding/:employeeId',
  requirePermission('offboarding.read_all'),
  validate(employeeIdParamSchema),
  hrController.getOffboardingByEmployee
);

router.patch(
  '/offboarding/:offboardingId/tasks/:taskId',
  requirePermission('offboarding.update_tasks'),
  validate(offboardingTaskUpdateSchema),
  hrController.updateOffboardingTask
);

router.post(
  '/offboarding/:employeeId/complete',
  requirePermission('offboarding.complete'),
  validate(employeeIdParamSchema),
  hrController.completeOffboarding
);

router.get(
  '/attendance',
  requirePermission('attendance.read_all'),
  validate(attendanceListQuerySchema),
  hrController.listAttendance
);

router.patch(
  '/attendance/:attendanceId/correct',
  requirePermission('attendance.correct'),
  validate(attendanceCorrectionSchema),
  hrController.correctAttendance
);

router.post(
  '/attendance/manual',
  requirePermission('attendance.add_manual'),
  validate(attendanceManualSchema),
  hrController.addManualAttendance
);

router.get(
  '/attendance/export',
  requirePermission('attendance.export'),
  validate(attendanceListQuerySchema),
  hrController.exportAttendance
);

router.post(
  '/attendance/scheduler/run',
  requirePermission('attendance.correct'),
  hrController.runAttendanceScheduler
);

router.get(
  '/attendance/regularizations',
  requirePermission('attendance.correct'),
  validate(attendanceRegularizationListQuerySchema),
  hrController.listAttendanceRegularizations
);

router.patch(
  '/attendance/regularizations/:requestId/approve',
  requirePermission('attendance.correct'),
  validate(attendanceRegularizationApproveSchema),
  hrController.approveAttendanceRegularization
);

router.patch(
  '/attendance/regularizations/:requestId/reject',
  requirePermission('attendance.correct'),
  validate(attendanceRegularizationRejectSchema),
  hrController.rejectAttendanceRegularization
);

router.get(
  '/leaves',
  requirePermission('leave.read_all'),
  validate(leaveListQuerySchema),
  hrController.listLeaves
);

router.patch(
  '/leaves/:leaveId/approve',
  requirePermission('leave.approve_all'),
  validate(leaveDecisionSchema),
  hrController.approveLeave
);

router.patch(
  '/leaves/:leaveId/reject',
  requirePermission('leave.reject'),
  validate(leaveDecisionSchema),
  hrController.rejectLeave
);

router.delete(
  '/leaves/:leaveId',
  requirePermission('leave.cancel_all'),
  validate(leaveDecisionSchema),
  hrController.cancelLeave
);

router.patch(
  '/leaves/:leaveId/edit',
  requirePermission('leave.approve_all'),
  validate(leaveEditSchema),
  hrController.editLeave
);

router.patch(
  '/leaves/:employeeId/balance',
  requirePermission('leave.adjust_balance'),
  validate(leaveBalanceAdjustSchema),
  hrController.adjustLeaveBalance
);

router.get(
  '/leaves/config',
  requirePermission('leave.read_all'),
  hrController.getLeaveAccrualConfig
);

router.put(
  '/leaves/config',
  requirePermission('leave.adjust_balance'),
  validate(leaveAccrualConfigUpdateSchema),
  hrController.updateLeaveAccrualConfig
);

router.get(
  '/leaves/:employeeId/balance',
  requirePermission('leave.read_all'),
  validate(employeeIdParamSchema),
  hrController.getLeaveBalance
);

router.get(
  '/leaves/:employeeId/summary',
  requirePermission('leave.read_all'),
  validate(leaveSummaryByEmployeeSchema),
  hrController.getLeaveSummaryByEmployee
);

router.get(
  '/holidays',
  validate(holidaysListQuerySchema),
  hrController.listHolidays
);

router.post(
  '/holidays',
  requirePermission('holidays.create'),
  validate(holidayCreateSchema),
  hrController.createHoliday
);

router.patch(
  '/holidays/:holidayId',
  requirePermission('holidays.update'),
  validate(holidayUpdateSchema),
  hrController.updateHoliday
);

router.delete(
  '/holidays/:holidayId',
  requirePermission('holidays.delete'),
  validate(holidayUpdateSchema.pick({ params: true })),
  hrController.deleteHoliday
);

router.post(
  '/holidays/upload',
  requirePermission('holidays.upload'),
  validate(holidayUploadSchema),
  hrController.uploadHolidays
);

router.get(
  '/holidays/export',
  requirePermission('holidays.export'),
  validate(holidaysListQuerySchema),
  hrController.exportHolidays
);

router.post(
  '/payroll/upload',
  requirePermission('payroll.upload'),
  validate(payrollUploadSchema),
  hrController.uploadPayroll
);

router.post(
  '/payroll/upload-csv',
  requirePermission('payroll.upload'),
  payrollCsvUpload.single('file'),
  validate(payrollUploadCsvSchema),
  hrController.uploadPayrollCsv
);

router.post(
  '/payroll/generate',
  requirePermission('payroll.generate'),
  validate(payrollGenerateSchema),
  hrController.generatePayroll
);

router.post(
  '/payroll/finalize',
  requirePermission('payroll.finalize'),
  validate(payrollGenerateSchema),
  hrController.finalizePayroll
);

router.get(
  '/payroll/status',
  requirePermission('payroll.read_status'),
  validate(payrollStatusQuerySchema),
  hrController.getPayrollStatus
);

router.get(
  '/payroll/export',
  requirePermission('payroll.export'),
  validate(payrollStatusQuerySchema),
  hrController.exportPayroll
);

router.get(
  '/org-hierarchy',
  requirePermission('employees.read_all'),
  hrController.getOrgChart
);

router.get(
  '/org-hierarchy/team/:managerEmployeeId',
  requirePermission('employees.read_all'),
  validate(z.object({ params: z.object({ managerEmployeeId: z.string().uuid() }) })),
  hrController.getTeamHierarchy
);

router.patch(
  '/org-hierarchy/reassign-manager',
  requirePermission('org.reassign_manager'),
  validate(orgReassignManagerSchema),
  hrController.reassignManager
);

router.get(
  '/org-hierarchy/export',
  requirePermission('org.export'),
  hrController.exportOrgChart
);

router.get(
  '/reports/attendance',
  requirePermission('reports.view'),
  validate(reportQuerySchema),
  hrController.attendanceReport
);

router.get(
  '/reports/leaves',
  requirePermission('reports.view'),
  validate(reportQuerySchema),
  hrController.leaveReport
);

router.get(
  '/reports/payroll',
  requirePermission('reports.view'),
  validate(reportQuerySchema),
  hrController.payrollReport
);

// ── Onboarding Invite ────────────────────────────────────────────────────────
router.post(
  '/onboarding/:employeeId/send-invite',
  requirePermission('onboarding.initiate'),
  validate(employeeIdParamSchema),
  hrController.sendOnboardingInvite
);

router.post(
  '/onboarding/:employeeId/release-offer-letter',
  requirePermission('onboarding.initiate'),
  validate(employeeIdParamSchema),
  hrController.releaseOfferLetter
);

router.post(
  '/onboarding/:employeeId/reset-tasks',
  requirePermission('onboarding.update_tasks'),
  validate(employeeIdParamSchema),
  hrController.resetOnboardingTasks
);

router.get(
  '/employees/:employeeId/documents',
  requirePermission('employees.read_all'),
  validate(employeeIdParamSchema),
  hrController.getEmployeeDocuments
);

router.post(
  '/employees/:employeeId/documents',
  requirePermission('employees.update'),
  employeeDocUpload.single('file'),
  validate(employeeIdParamSchema),
  hrController.uploadEmployeeDocument
);

router.patch(
  '/employees/:employeeId/documents/:documentId/review',
  requirePermission('employees.update'),
  hrController.reviewEmployeeDocument
);

// ── Task Templates ───────────────────────────────────────────────────────────
router.get('/onboarding/task-templates', requirePermission('onboarding.read_all'), hrController.listOnboardingTaskTemplates);
router.post('/onboarding/task-templates', requirePermission('onboarding.update_tasks'), hrController.createOnboardingTaskTemplate);
router.put('/onboarding/task-templates/:templateId', requirePermission('onboarding.update_tasks'), hrController.updateOnboardingTaskTemplate);
router.delete('/onboarding/task-templates/:templateId', requirePermission('onboarding.update_tasks'), hrController.deleteOnboardingTaskTemplate);

router.get('/offboarding/task-templates', requirePermission('offboarding.read_all'), hrController.listOffboardingTaskTemplates);
router.post('/offboarding/task-templates', requirePermission('offboarding.update_tasks'), hrController.createOffboardingTaskTemplate);
router.put('/offboarding/task-templates/:templateId', requirePermission('offboarding.update_tasks'), hrController.updateOffboardingTaskTemplate);
router.delete('/offboarding/task-templates/:templateId', requirePermission('offboarding.update_tasks'), hrController.deleteOffboardingTaskTemplate);

// Seed default task templates (admin only, one-time setup)
router.post('/task-templates/seed', requirePermission('admin.settings'), hrController.seedTaskTemplates);

export default router;

