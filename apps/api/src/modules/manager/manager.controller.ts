import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { workforceService } from '../workforce/workforce.service';
import { hrService } from '../hr/hr.service';
import { prisma } from '../../database/prisma';

class ManagerController {
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getManagerDashboard(req.user!.id);
    res.json({ success: true, data });
  });

  getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getMyProfile(req.user!.id);
    res.json({ success: true, data });
  });

  updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.updateMyProfile(req.user!.id, req.body);
    res.json({ success: true, data, message: 'Profile updated successfully' });
  });

  checkIn = asyncHandler(async (req: Request, res: Response) => {
    const { latitude, longitude, accuracy, clientTime } = req.body || {};
    const location = (latitude != null && longitude != null) ? { latitude: Number(latitude), longitude: Number(longitude), accuracy: accuracy != null ? Number(accuracy) : undefined } : undefined;
    const data = await workforceService.checkIn(req.user!.id, location, clientTime);
    res.status(201).json({ success: true, data, message: 'Checked in successfully' });
  });

  checkOut = asyncHandler(async (req: Request, res: Response) => {
    const { latitude, longitude, accuracy, clientTime } = req.body || {};
    const location = (latitude != null && longitude != null) ? { latitude: Number(latitude), longitude: Number(longitude), accuracy: accuracy != null ? Number(accuracy) : undefined } : undefined;
    const data = await workforceService.checkOut(req.user!.id, location, clientTime);
    res.json({ success: true, data, message: 'Checked out successfully' });
  });

  getMyAttendance = asyncHandler(async (req: Request, res: Response) => {
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const data = await workforceService.getMyAttendance(req.user!.id, month, year, fromDate, toDate);
    res.json({ success: true, data });
  });

  getTeamEmployees = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getManagerTeamEmployees(req.user!.id);
    res.json({ success: true, data });
  });

  getTeamMemberDetail = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getManagerTeamMemberDetail(req.user!.id, req.params.employeeId);
    res.json({ success: true, data });
  });

  getTeamMemberDocuments = asyncHandler(async (req: Request, res: Response) => {
    // Verify the employee is on this manager's team first
    await workforceService.getManagerTeamMemberDetail(req.user!.id, req.params.employeeId);
    const data = await hrService.getEmployeeDocuments(req.params.employeeId);
    res.json({ success: true, data });
  });

  getOrgChart = asyncHandler(async (req: Request, res: Response) => {
    // Resolve manager's branch from their employee record for branch-scoped org chart
    const empRow = await prisma.$queryRawUnsafe<Array<{ branch_id: string | null }>>(
      `SELECT branch_id FROM employees WHERE user_id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
      req.user!.id
    );
    const branchId = empRow[0]?.branch_id ?? null;
    const data = await workforceService.getOrgChartView(branchId);
    res.json({ success: true, data });
  });

  getTeamAttendance = asyncHandler(async (req: Request, res: Response) => {
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const date = req.query.date as string | undefined;
    if ((req.query.format as string) === 'csv') {
      const data = await workforceService.exportManagerTeamAttendance(req.user!.id, month, year);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=manager_team_attendance.csv');
      res.status(200).send(data.csv);
      return;
    }
    const data = await workforceService.getManagerTeamAttendance(req.user!.id, month, year, date);
    res.json({ success: true, data });
  });

  getPendingTeamLeaves = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getManagerPendingLeaves(req.user!.id);
    res.json({ success: true, data });
  });

  listTeamAttendanceRegularizations = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.listManagerAttendanceRegularizations(req.user!.id, {
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    });
    res.json({ success: true, data });
  });

  approveTeamAttendanceRegularization = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.managerApproveAttendanceRegularization(req.user!.id, req.params.requestId, {
      note: req.body.note,
    });
    res.json({ success: true, data, message: 'Attendance regularization approved successfully' });
  });

  rejectTeamAttendanceRegularization = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.managerRejectAttendanceRegularization(req.user!.id, req.params.requestId, {
      reason: req.body.reason,
    });
    res.json({ success: true, data, message: 'Attendance regularization rejected successfully' });
  });

  applyMyLeave = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.applyMyLeaveDirect(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Leave applied successfully' });
  });

  listMyLeaves = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const data = await workforceService.listMyLeaves(req.user!.id, req.query.status as string | undefined, year);
    res.json({ success: true, data });
  });

  cancelMyLeave = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.cancelMyLeave(req.user!.id, req.params.leaveId);
    res.json({ success: true, data, message: 'Leave cancelled successfully' });
  });

  getMyLeaveBalance = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const data = await workforceService.getMyLeaveBalance(req.user!.id, year);
    res.json({ success: true, data });
  });

  getMyLeaveSummary = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const data = await workforceService.getMyLeaveSummary(req.user!.id, year);
    res.json({ success: true, data });
  });

  approveTeamLeave = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.managerApproveLeave(req.user!.id, req.params.leaveId);
    res.json({ success: true, data, message: 'Leave approved successfully' });
  });

  rejectTeamLeave = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.managerRejectLeave(req.user!.id, req.params.leaveId, req.body.reason);
    res.json({ success: true, data, message: 'Leave rejected successfully' });
  });

  getTeamOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getManagerTeamOnboarding(req.user!.id);
    res.json({ success: true, data });
  });

  getTeamOffboarding = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getManagerTeamOffboarding(req.user!.id);
    res.json({ success: true, data });
  });

  getTodayClockLogs = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getTodayClockLogs(req.user!.id);
    res.json({ success: true, data });
  });
}

export const managerController = new ManagerController();

