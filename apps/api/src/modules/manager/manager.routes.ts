import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';
import { managerController } from './manager.controller';
import {
  applyLeaveSchema,
  approveLeaveSchema,
  attendanceQuerySchema,
  leaveIdParamSchema,
  listMyLeavesQuerySchema,
  myBalanceQuerySchema,
  rejectLeaveSchema,
  teamAttendanceRegularizationApproveSchema,
  teamAttendanceRegularizationQuerySchema,
  teamAttendanceRegularizationRejectSchema,
} from './manager.validator';

const router = Router();

router.use(authenticate);

// Manager Dashboard & Self-Service (No Permissions Needed)
router.get('/dashboard', managerController.getDashboard);
router.get('/me/profile', managerController.getMyProfile);
router.patch('/me/profile', managerController.updateMyProfile);

// Manager Self-Attendance (No Permissions Needed)
router.post('/attendance/check-in', managerController.checkIn);
router.post('/attendance/check-out', managerController.checkOut);
router.get('/attendance/today-logs', managerController.getTodayClockLogs);
router.get('/attendance', validate(attendanceQuerySchema), managerController.getMyAttendance);
router.post('/leaves', validate(applyLeaveSchema), managerController.applyMyLeave);
router.get('/leaves', validate(listMyLeavesQuerySchema), managerController.listMyLeaves);
router.get('/leaves/summary', validate(myBalanceQuerySchema), managerController.getMyLeaveSummary);
router.delete('/leaves/:leaveId', validate(leaveIdParamSchema), managerController.cancelMyLeave);
router.get('/leave-balance', validate(myBalanceQuerySchema), managerController.getMyLeaveBalance);

// Team Management (Role-based - managers can only see their team)
router.get('/team/employees', managerController.getTeamEmployees);
router.get('/team/employees/:employeeId', managerController.getTeamMemberDetail);
router.get('/team/employees/:employeeId/documents', managerController.getTeamMemberDocuments);
router.get('/org-hierarchy', requirePermission('org.read'), managerController.getOrgChart);
router.get('/team/attendance', validate(attendanceQuerySchema), managerController.getTeamAttendance);
router.get('/team/leaves/pending', managerController.getPendingTeamLeaves);
router.get(
  '/team/attendance/regularizations',
  validate(teamAttendanceRegularizationQuerySchema),
  managerController.listTeamAttendanceRegularizations
);

// Leave Approval (Keep permission - this is privileged action)
router.patch('/team/leaves/:leaveId/approve', requirePermission('leave.approve_team'), validate(approveLeaveSchema), managerController.approveTeamLeave);
router.patch('/team/leaves/:leaveId/reject', requirePermission('leave.reject'), validate(rejectLeaveSchema), managerController.rejectTeamLeave);
router.patch(
  '/team/attendance/regularizations/:requestId/approve',
  requirePermission('leave.approve_team'),
  validate(teamAttendanceRegularizationApproveSchema),
  managerController.approveTeamAttendanceRegularization
);
router.patch(
  '/team/attendance/regularizations/:requestId/reject',
  requirePermission('leave.reject'),
  validate(teamAttendanceRegularizationRejectSchema),
  managerController.rejectTeamAttendanceRegularization
);

// Team Onboarding/Offboarding (View only - no permissions needed)
router.get('/team/onboarding', managerController.getTeamOnboarding);
router.get('/team/offboarding', managerController.getTeamOffboarding);

export default router;

