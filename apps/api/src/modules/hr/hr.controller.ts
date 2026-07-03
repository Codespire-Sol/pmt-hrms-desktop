import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { hrService } from './hr.service';
import { workforceService } from '../workforce/workforce.service';
import { ApiError } from '../../utils/ApiError';
import { attendanceAutoAbsentScheduler } from '../../services/attendanceAutoAbsentScheduler';
import { adminService } from '../admin/admin.service';

class HrController {
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr ? (req.user!.branchId ?? null) : null;
    const data = await hrService.getHrDashboard(branchId);
    res.json({ success: true, data });
  });

  createManager = asyncHandler(async (req: Request, res: Response) => {
    // HR users can only create employees for their own branch
    const branchId = req.user!.roleName === 'hr' ? (req.user!.branchId ?? null) : (req.body.branchId ?? null);
    const data = await hrService.createManager(req.body, req.user!.id, branchId);
    res.status(201).json({
      success: true,
      data,
      message: 'Manager account created successfully',
    });
  });

  createEmployee = asyncHandler(async (req: Request, res: Response) => {
    // HR users can only create employees for their own branch
    const branchId = req.user!.roleName === 'hr' ? (req.user!.branchId ?? null) : (req.body.branchId ?? null);
    const data = await hrService.createEmployee(req.body, req.user!.id, branchId);
    res.status(201).json({
      success: true,
      data,
      message: 'Employee account created successfully',
    });
  });

  listBranches = asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.listBranches();
    res.json({ success: true, data });
  });

  listEmployees = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';

    // HR: forced to their own branch; if no branch assigned, show all employees
    const branchId = isHr
      ? (req.user!.branchId ?? null)
      : ((req.query.branchId as string) || null);

    const data = await hrService.listEmployees({
      role: req.query.role as 'manager' | 'employee' | 'hr' | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      search: req.query.search as string | undefined,
      department: req.query.department as string | undefined,
      branchId,
    });
    res.json({ success: true, data });
  });

  listActiveManagers = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.roleName === 'admin';
    const branchId = isAdmin ? ((req.query.branchId as string) || null) : (req.user!.branchId ?? null);
    const data = await hrService.listActiveManagers(branchId);
    res.json({ success: true, data });
  });

  assignManager = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.assignManager(
      req.params.employeeId,
      req.body.managerEmployeeId,
      req.user!.id
    );
    res.json({
      success: true,
      data,
      message: 'Manager assigned successfully',
    });
  });

  changeEmployeeRole = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.changeEmployeeRole(
      req.params.employeeId,
      req.body.role,
      req.user!.id
    );
    res.json({
      success: true,
      data,
      message: 'Employee role updated successfully',
    });
  });

  getEmployeeById = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getEmployeeByIdDetailed(req.params.employeeId);
    res.json({ success: true, data });
  });

  updateEmployee = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.updateEmployee(req.params.employeeId, req.body, req.user!.id);
    res.json({
      success: true,
      data,
      message: 'Employee updated successfully',
    });
  });

  deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.softDeleteEmployee(req.params.employeeId, req.user!.id);
    res.json({
      success: true,
      data,
      message: 'Employee deleted successfully',
    });
  });

  hardDeleteEmployee = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.hardDeleteEmployee(req.params.employeeId);
    res.json({
      success: true,
      data,
      message: 'Employee permanently deleted from database',
    });
  });

  purgeAllEmployees = asyncHandler(async (req: Request, res: Response) => {
    const excludeEmails: string[] = Array.isArray(req.body.excludeEmails)
      ? req.body.excludeEmails
      : [];
    const data = await hrService.purgeAllEmployees(excludeEmails);
    res.json({
      success: true,
      data,
      message: `${data.deleted} employee(s) permanently deleted from database`,
    });
  });

  initiateOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.initiateOnboarding(req.params.employeeId, req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Onboarding initiated successfully' });
  });

  listOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';

    // HR with no branch assignment: return empty list to prevent data leak
    if (isHr && !req.user!.branchId) {
      return res.json({
        success: true,
        data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
        warning: 'Your HR account has no branch assignment. Please contact an administrator.',
      });
    }

    const branchId = isHr
      ? req.user!.branchId!
      : ((req.query.branchId as string) || null);
    const data = await hrService.listOnboarding({
      status: req.query.status as string | undefined,
      branchId: branchId || undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    });
    res.json({ success: true, data });
  });

  getOnboardingByEmployee = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getOnboardingByEmployee(req.params.employeeId);
    res.json({ success: true, data });
  });

  updateOnboardingTask = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.updateOnboardingTask(
      req.params.onboardingId,
      req.params.taskId,
      req.body,
      req.user!.id
    );
    res.json({ success: true, data, message: 'Onboarding task updated successfully' });
  });

  completeOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.completeOnboarding(req.params.employeeId, req.user!.id);
    res.json({ success: true, data, message: 'Onboarding completed successfully' });
  });

  setWorkEmail = asyncHandler(async (req: Request, res: Response) => {
    const { workEmail, password } = req.body as { workEmail: string; password: string };
    const data = await hrService.setWorkEmail(req.params.employeeId, workEmail, req.user!.id, password);
    res.json({ success: true, data, message: 'Work email set successfully. Keycloak account updated.' });
  });

  initiateOffboarding = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.initiateOffboarding(req.params.employeeId, req.body, req.user!.id);
    res.status(201).json({ success: true, data, message: 'Offboarding initiated successfully' });
  });

  listOffboarding = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr
      ? (req.user!.branchId ?? null)
      : ((req.query.branchId as string) || null);
    const data = await hrService.listOffboarding({
      status: req.query.status as string | undefined,
      branchId: branchId || undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    });
    res.json({ success: true, data });
  });

  getOffboardingByEmployee = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getOffboardingByEmployee(req.params.employeeId);
    res.json({ success: true, data });
  });

  updateOffboardingTask = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.updateOffboardingTask(
      req.params.offboardingId,
      req.params.taskId,
      req.body,
      req.user!.id
    );
    res.json({ success: true, data, message: 'Offboarding task updated successfully' });
  });

  completeOffboarding = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.completeOffboarding(req.params.employeeId, req.user!.id);
    res.json({ success: true, data, message: 'Offboarding completed successfully' });
  });

  exportOffboarding = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.roleName === 'admin';
    const branchId = isAdmin ? ((req.query.branchId as string) || null) : (req.user!.branchId ?? null);
    const csv = await hrService.exportOffboardingCsv(branchId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=offboarding-report.csv');
    res.status(200).send(csv);
  });

  listAttendance = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr
      ? (req.user!.branchId ?? null)
      : ((req.query.branchId as string) || null);
    const data = await hrService.listAttendance({
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      branchId: branchId || undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    });
    res.json({ success: true, data });
  });

  correctAttendance = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.correctAttendance(req.params.attendanceId, req.body, req.user!.id);
    res.json({ success: true, data, message: 'Attendance corrected successfully' });
  });

  addManualAttendance = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.addManualAttendance(req.body, req.user!.id);
    res.status(201).json({ success: true, data, message: 'Attendance added successfully' });
  });

  exportAttendance = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.roleName === 'admin';
    const branchId = isAdmin ? ((req.query.branchId as string) || null) : (req.user!.branchId ?? null);
    const data = await hrService.exportAttendance({
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      branchId,
    });
    if ((req.query.format as string) === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance_export.csv');
      res.status(200).send(data.csv);
      return;
    }
    res.json({ success: true, data });
  });

  listAttendanceRegularizations = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr
      ? (req.user!.branchId ?? null)
      : ((req.query.branchId as string) || null);
    const data = await workforceService.listHrAttendanceRegularizations(req.user!.id, {
      status: req.query.status as string | undefined,
      branchId: branchId || undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    });
    res.json({ success: true, data });
  });

  approveAttendanceRegularization = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.hrApproveAttendanceRegularization(req.user!.id, req.params.requestId, {
      note: req.body.note,
    });
    res.json({ success: true, data, message: 'Attendance regularization approved successfully' });
  });

  rejectAttendanceRegularization = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.hrRejectAttendanceRegularization(req.user!.id, req.params.requestId, {
      reason: req.body.reason,
    });
    res.json({ success: true, data, message: 'Attendance regularization rejected successfully' });
  });

  listLeaves = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr
      ? (req.user!.branchId ?? null)
      : ((req.query.branchId as string) || null);
    const data = await hrService.listLeaves({
      employeeId: req.query.employeeId as string | undefined,
      status: req.query.status as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
      branchId: branchId || undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    });
    res.json({ success: true, data });
  });

  approveLeave = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.roleName === 'admin';
    const branchId = isAdmin ? null : (req.user!.branchId ?? null);
    const data = await hrService.approveLeave(req.params.leaveId, req.user!.id, branchId);
    res.json({ success: true, data, message: 'Leave approved successfully' });
  });

  rejectLeave = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.roleName === 'admin';
    const branchId = isAdmin ? null : (req.user!.branchId ?? null);
    const data = await hrService.rejectLeave(req.params.leaveId, req.body.reason, req.user!.id, branchId);
    res.json({ success: true, data, message: 'Leave rejected successfully' });
  });

  cancelLeave = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.roleName === 'admin';
    const branchId = isAdmin ? null : (req.user!.branchId ?? null);
    const data = await hrService.cancelLeave(req.params.leaveId, req.body.reason, req.user!.id, branchId);
    res.json({ success: true, data, message: 'Leave cancelled successfully' });
  });

  editLeave = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.roleName === 'admin';
    const branchId = isAdmin ? null : (req.user!.branchId ?? null);
    const data = await hrService.editLeave(req.params.leaveId, req.body, req.user!.id, branchId);
    res.json({ success: true, data, message: 'Leave updated successfully' });
  });

  adjustLeaveBalance = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.adjustLeaveBalance(req.params.employeeId, req.body, req.user!.id);
    res.json({ success: true, data, message: 'Leave balance adjusted successfully' });
  });

  getLeaveBalance = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getLeaveBalance(req.params.employeeId, req.query.year as string | undefined);
    res.json({ success: true, data });
  });

  getLeaveSummaryByEmployee = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const data = await hrService.getLeaveSummaryByEmployee(req.params.employeeId, year);
    res.json({ success: true, data });
  });

  getLeaveAccrualConfig = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr
      ? (req.user!.branchId ?? null)
      : ((req.query.branchId as string) || null);
    const data = await hrService.getLeaveAccrualConfig(branchId);
    res.json({ success: true, data });
  });

  updateLeaveAccrualConfig = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr
      ? (req.user!.branchId ?? null)
      : ((req.body.branchId as string) || (req.query.branchId as string) || null);
    const { branchId: _branchId, ...payload } = req.body;
    const data = await hrService.updateLeaveAccrualConfig(payload, req.user!.id, branchId);
    res.json({ success: true, data, message: 'Leave accrual configuration updated successfully' });
  });

  applyMyLeave = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.applyMyLeave(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Leave applied successfully' });
  });

  listMyLeaves = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const data = await hrService.listMyLeaves(req.user!.id, req.query.status as string | undefined, year);
    res.json({ success: true, data });
  });

  cancelMyLeave = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.cancelMyLeave(req.user!.id, req.params.leaveId);
    res.json({ success: true, data, message: 'Leave cancelled successfully' });
  });

  getMyLeaveBalance = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const data = await hrService.getMyLeaveBalance(req.user!.id, year);
    res.json({ success: true, data });
  });

  getMyLeaveSummary = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const data = await hrService.getMyLeaveSummary(req.user!.id, year);
    res.json({ success: true, data });
  });

  listHolidays = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.roleName === 'admin';
    const branchId = isAdmin
      ? ((req.query.branchId as string) || null)
      : (req.user!.branchId ?? null);
    const [data, birthdays] = await Promise.all([
      hrService.listHolidays({
        year: req.query.year as string | undefined,
        type: req.query.type as string | undefined,
        branchId,
      }),
      hrService.listBirthdays(),
    ]);
    res.json({ success: true, data, birthdays });
  });

  createHoliday = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr ? (req.user!.branchId ?? null) : (req.body.branchId || null);
    const data = await hrService.createHoliday({ ...req.body, branchId }, req.user!.id);
    res.status(201).json({ success: true, data, message: 'Holiday created successfully' });
  });

  updateHoliday = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.updateHoliday(req.params.holidayId, req.body, req.user!.id);
    res.json({ success: true, data, message: 'Holiday updated successfully' });
  });

  deleteHoliday = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.deleteHoliday(req.params.holidayId, req.user!.id);
    res.json({ success: true, data, message: 'Holiday deleted successfully' });
  });

  uploadHolidays = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.uploadHolidays(req.body.holidays, req.user!.id);
    res.json({ success: true, data, message: 'Holidays uploaded successfully' });
  });

  exportHolidays = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr
      ? (req.user!.branchId ?? null)
      : ((req.query.branchId as string) || null);
    const data = await hrService.exportHolidays({
      year: req.query.year as string | undefined,
      type: req.query.type as string | undefined,
      branchId,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=holidays_export.csv');
    res.status(200).send(data.csv);
  });

  uploadPayroll = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.uploadPayroll(req.body, req.user!.id);
    res.status(201).json({ success: true, data, message: 'Payroll uploaded successfully' });
  });

  uploadPayrollCsv = asyncHandler(async (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ success: false, error: { message: 'CSV file is required' } });
      return;
    }

    const month =
      req.body.month !== undefined && req.body.month !== ''
        ? parseInt(String(req.body.month), 10)
        : undefined;
    const year =
      req.body.year !== undefined && req.body.year !== ''
        ? parseInt(String(req.body.year), 10)
        : undefined;

    const data = await hrService.uploadPayrollCsv(file, { month, year }, req.user!.id);
    res.status(201).json({ success: true, data, message: 'Payroll CSV uploaded successfully' });
  });

  generatePayroll = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.generatePayroll(req.body.month, req.body.year, req.user!.id);
    res.json({ success: true, data, message: 'Payslips generated successfully' });
  });

  finalizePayroll = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.finalizePayroll(req.body.month, req.body.year, req.user!.id);
    res.json({ success: true, data, message: 'Payroll finalized successfully' });
  });

  getPayrollStatus = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getPayrollStatus(
      parseInt(req.query.month as string, 10),
      parseInt(req.query.year as string, 10)
    );
    res.json({ success: true, data });
  });

  exportPayroll = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.exportPayroll(
      parseInt(req.query.month as string, 10),
      parseInt(req.query.year as string, 10)
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=payroll_export.csv');
    res.status(200).send(data.csv);
  });

  getEmployeePayrollHistory = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getEmployeePayrollHistory(req.params.employeeId);
    res.json({ success: true, data });
  });

  getOrgChart = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr
      ? (req.user!.branchId ?? null)
      : ((req.query.branchId as string) || null);
    const data = await hrService.getOrgChart(branchId);
    res.json({ success: true, data });
  });

  getTeamHierarchy = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getTeamHierarchy(req.params.managerEmployeeId);
    res.json({ success: true, data });
  });

  reassignManager = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.reassignManager(req.body.employeeId, req.body.managerEmployeeId, req.user!.id);
    res.json({ success: true, data, message: 'Manager reassigned successfully' });
  });

  exportOrgChart = asyncHandler(async (req: Request, res: Response) => {
    const isHr = req.user!.roleName === 'hr';
    const branchId = isHr
      ? (req.user!.branchId ?? null)
      : ((req.query.branchId as string) || null);
    const data = await hrService.exportOrgChart(branchId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=org_chart_export.csv');
    res.status(200).send(data.csv);
  });

  private static readonly HEADER_LABELS: Record<string, string> = {
    employeeId: 'Employee ID',
    employeeName: 'Employee Name',
    employeeCode: 'Employee ID',
    department: 'Department',
    designation: 'Designation',
    date: 'Date',
    checkInTime: 'Check In',
    checkOutTime: 'Check Out',
    workHours: 'Work Hours',
    status: 'Status',
    lateArrival: 'Late Arrival',
    leaveType: 'Leave Type',
    fromDate: 'From Date',
    toDate: 'To Date',
    days: 'Days',
    reason: 'Reason',
    appliedAt: 'Applied At',
    approvedBy: 'Approved By',
    approvedAt: 'Approved At',
    rejectedBy: 'Rejected By',
    rejectedAt: 'Rejected At',
    rejectionReason: 'Rejection Reason',
    month: 'Month',
    year: 'Year',
    gross: 'Gross Pay',
    deductions: 'Deductions',
    net: 'Net Pay',
    generatedAt: 'Generated At',
    finalizedAt: 'Finalized At',
    lastWorkingDay: 'Last Working Day',
    exitReason: 'Exit Reason',
    additionalNotes: 'Notes',
    offboardingStatus: 'Status',
    tasksProgress: 'Progress',
    completedAt: 'Completed At',
  };

  private csvToPdfBuffer(csv: string, title: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').fillColor('#666').text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, { align: 'center' });
      doc.moveDown(1);

      // Parse CSV
      const lines = csv.trim().split('\n');
      if (lines.length === 0) { doc.text('No data'); doc.end(); return; }
      const rawHeaders = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const headers = rawHeaders.map(h => (this.constructor as typeof HrController).HEADER_LABELS[h] || h.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim());
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.replace(/"/g, '').trim()));

      // Table
      const pageW = doc.page.width - 80;
      const colW = Math.min(pageW / headers.length, 120);
      const startX = 40;
      let y = doc.y;

      // Header row
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff');
      doc.rect(startX, y, colW * headers.length, 18).fill('#1368FF');
      headers.forEach((h, i) => {
        doc.fillColor('#fff').text(h, startX + i * colW + 4, y + 4, { width: colW - 8, lineBreak: false });
      });
      y += 20;

      // Data rows
      doc.font('Helvetica').fontSize(7).fillColor('#333');
      for (const row of rows) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
        const bg = rows.indexOf(row) % 2 === 0 ? '#f9fafb' : '#ffffff';
        doc.rect(startX, y, colW * headers.length, 16).fill(bg);
        row.forEach((cell, i) => {
          doc.fillColor('#333').text(cell || '-', startX + i * colW + 4, y + 3, { width: colW - 8, lineBreak: false });
        });
        y += 16;
      }

      doc.end();
    });
  }

  attendanceReport = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.roleName === 'admin';
    // When a specific employee is selected, skip branch restriction so HR can
    // pull any employee's records regardless of which branch they belong to.
    const specificEmployee = (req.query.employeeId as string) || null;
    const branchId = specificEmployee
      ? null
      : (isAdmin ? ((req.query.branchId as string) || null) : (req.user!.branchId ?? null));
    const data = await hrService.attendanceReport(req.query, branchId);
    if ((req.query.format as string) === 'pdf') {
      const pdf = await this.csvToPdfBuffer(data.csv, 'Attendance Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.pdf');
      res.status(200).send(pdf);
      return;
    }
    if ((req.query.format as string) === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.csv');
      res.status(200).send(data.csv);
      return;
    }
    res.json({ success: true, data: data.json });
  });

  leaveReport = asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = req.user!.roleName === 'admin';
    const branchId = isAdmin ? ((req.query.branchId as string) || null) : (req.user!.branchId ?? null);
    const data = await hrService.leaveReport(req.query, branchId);
    if ((req.query.format as string) === 'pdf') {
      const pdf = await this.csvToPdfBuffer(data.csv, 'Leave Summary Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=leave_report.pdf');
      res.status(200).send(pdf);
      return;
    }
    if ((req.query.format as string) === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=leave_report.csv');
      res.status(200).send(data.csv);
      return;
    }
    res.json({ success: true, data: data.json });
  });

  payrollReport = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.payrollReport(req.query);
    if ((req.query.format as string) === 'pdf') {
      const pdf = await this.csvToPdfBuffer(data.csv, 'Payroll Summary Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=payroll_report.pdf');
      res.status(200).send(pdf);
      return;
    }
    if ((req.query.format as string) === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=payroll_report.csv');
      res.status(200).send(data.csv);
      return;
    }
    res.json({ success: true, data: data.json });
  });

  // ── Onboarding Invite ──────────────────────────────────────────────────────

  sendOnboardingInvite = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.sendOnboardingInvite(req.params.employeeId, req.user!.id);
    res.json({ success: true, data, message: 'Invite sent successfully' });
  });

  releaseOfferLetter = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.releaseOfferLetter(req.params.employeeId, req.user!.id);
    res.json({ success: true, data, message: data.message });
  });

  resetOnboardingTasks = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.resetOnboardingTasks(req.params.employeeId);
    res.json({ success: true, data, message: data.message });
  });

  getEmployeeDocuments = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getEmployeeDocuments(req.params.employeeId);
    res.json({ success: true, data });
  });

  uploadEmployeeDocument = asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw ApiError.badRequest('No file provided');
    const documentType = (req.body.documentType as string) || 'other';
    const data = await hrService.saveEmployeeDocument(
      req.params.employeeId,
      file,
      documentType,
      req.user!.id
    );
    res.status(201).json({ success: true, data });
  });

  reviewEmployeeDocument = asyncHandler(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const { status, reviewNote } = req.body as { status: string; reviewNote?: string };
    const data = await hrService.reviewEmployeeDocument(documentId, req.user!.id, status, reviewNote);
    res.json({ success: true, data });
  });

  seedTaskTemplates = asyncHandler(async (_req: Request, res: Response) => {
    const data = await hrService.seedDefaultTaskTemplates();
    res.json({ success: true, data });
  });

  // ── Task Templates ─────────────────────────────────────────────────────────

  listOnboardingTaskTemplates = asyncHandler(async (_req: Request, res: Response) => {
    const data = await hrService.listOnboardingTaskTemplates();
    res.json({ success: true, data });
  });

  createOnboardingTaskTemplate = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.createOnboardingTaskTemplate(req.body);
    res.status(201).json({ success: true, data, message: 'Task template created' });
  });

  updateOnboardingTaskTemplate = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.updateOnboardingTaskTemplate(req.params.templateId, req.body);
    res.json({ success: true, data, message: 'Task template updated' });
  });

  deleteOnboardingTaskTemplate = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.deleteOnboardingTaskTemplate(req.params.templateId);
    res.json({ success: true, data, message: 'Task template deleted' });
  });

  listOffboardingTaskTemplates = asyncHandler(async (_req: Request, res: Response) => {
    const data = await hrService.listOffboardingTaskTemplates();
    res.json({ success: true, data });
  });

  createOffboardingTaskTemplate = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.createOffboardingTaskTemplate(req.body);
    res.status(201).json({ success: true, data, message: 'Task template created' });
  });

  updateOffboardingTaskTemplate = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.updateOffboardingTaskTemplate(req.params.templateId, req.body);
    res.json({ success: true, data, message: 'Task template updated' });
  });

  deleteOffboardingTaskTemplate = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.deleteOffboardingTaskTemplate(req.params.templateId);
    res.json({ success: true, data, message: 'Task template deleted' });
  });

  runAttendanceScheduler = asyncHandler(async (req: Request, res: Response) => {
    const { targetDate } = req.body as { targetDate?: string };
    if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      throw ApiError.badRequest('targetDate (YYYY-MM-DD) is required', 'INVALID_DATE');
    }
    const result = await attendanceAutoAbsentScheduler.processForDate(targetDate);
    res.json({ success: true, data: result });
  });
}

export const hrController = new HrController();

