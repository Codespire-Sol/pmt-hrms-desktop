import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { workforceService } from '../workforce/workforce.service';
import { hrService } from '../hr/hr.service';
import { ApiError } from '../../utils/ApiError';
import { prisma } from '../../database/prisma';

class EmployeeController {
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getEmployeeDashboard(req.user!.id);
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

  submitAttendanceRegularization = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.submitAttendanceRegularization(req.user!.id, req.body);
    res.status(201).json({ success: true, data, message: 'Attendance regularization request submitted successfully' });
  });

  listMyAttendanceRegularizations = asyncHandler(async (req: Request, res: Response) => {
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const status = req.query.status as string | undefined;
    const data = await workforceService.listMyAttendanceRegularizations(req.user!.id, { month, year, status });
    res.json({ success: true, data });
  });

  applyLeave = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.applyMyLeave(req.user!.id, req.body);
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

  getMyPayroll = asyncHandler(async (req: Request, res: Response) => {
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const data = await workforceService.getMyPayroll(req.user!.id, month, year);
    res.json({ success: true, data });
  });

  getOrgChart = asyncHandler(async (req: Request, res: Response) => {
    // Resolve employee's branch for branch-scoped org chart view
    const empRow = await prisma.$queryRawUnsafe<Array<{ branch_id: string | null }>>(
      `SELECT branch_id FROM employees WHERE user_id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
      req.user!.id
    );
    const branchId = empRow[0]?.branch_id ?? null;
    const data = await workforceService.getOrgChartView(branchId);
    res.json({ success: true, data });
  });

  getTodayClockLogs = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getTodayClockLogs(req.user!.id);
    res.json({ success: true, data });
  });

  getAttendanceClockLogs = asyncHandler(async (req: Request, res: Response) => {
    const data = await workforceService.getAttendanceClockLogs(req.user!.id, req.params.attendanceId);
    res.json({ success: true, data });
  });

  getMyDocuments = asyncHandler(async (req: Request, res: Response) => {
    const data = await hrService.getMyDocuments(req.user!.id);
    res.json({ success: true, data });
  });

  uploadMyDocument = asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw ApiError.badRequest('No file provided');
    const documentType = (req.body.documentType as string) || 'other';
    const data = await hrService.saveMyDocument(req.user!.id, file, documentType);
    res.status(201).json({ success: true, data });
  });
}

export const employeeController = new EmployeeController();

