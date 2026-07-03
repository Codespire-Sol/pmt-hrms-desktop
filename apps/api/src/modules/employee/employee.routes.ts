import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';
import { employeeController } from './employee.controller';

const selfDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF and image files are allowed'));
  },
});
import {
  applyLeaveSchema,
  leaveIdParamSchema,
  listAttendanceRegularizationsQuerySchema,
  listMyLeavesQuerySchema,
  myAttendanceQuerySchema,
  myBalanceQuerySchema,
  myPayrollQuerySchema,
  submitAttendanceRegularizationSchema,
  updateMyProfileSchema,
} from './employee.validator';

const router = Router();

router.use(authenticate);

// Most routes below are self-service and rely on authentication only.
// Org hierarchy is explicitly permission-gated so UI/API can check org-tree access.

router.get('/dashboard', employeeController.getDashboard);

router.get('/me/profile', employeeController.getMyProfile);
router.patch('/me/profile', validate(updateMyProfileSchema), employeeController.updateMyProfile);

router.post('/attendance/check-in', employeeController.checkIn);
router.post('/attendance/check-out', employeeController.checkOut);
router.get('/attendance/today-logs', employeeController.getTodayClockLogs);
router.get('/attendance/:attendanceId/logs', employeeController.getAttendanceClockLogs);
router.get('/attendance', validate(myAttendanceQuerySchema), employeeController.getMyAttendance);
router.post(
  '/attendance/regularizations',
  validate(submitAttendanceRegularizationSchema),
  employeeController.submitAttendanceRegularization
);
router.get(
  '/attendance/regularizations',
  validate(listAttendanceRegularizationsQuerySchema),
  employeeController.listMyAttendanceRegularizations
);

router.post('/leaves', validate(applyLeaveSchema), employeeController.applyLeave);
router.get('/leaves', validate(listMyLeavesQuerySchema), employeeController.listMyLeaves);
router.get('/leaves/summary', validate(myBalanceQuerySchema), employeeController.getMyLeaveSummary);
router.delete('/leaves/:leaveId', validate(leaveIdParamSchema), employeeController.cancelMyLeave);
router.get('/leave-balance', validate(myBalanceQuerySchema), employeeController.getMyLeaveBalance);

router.get('/payroll', validate(myPayrollQuerySchema), employeeController.getMyPayroll);
router.get('/org-hierarchy', requirePermission('org.read'), employeeController.getOrgChart);

router.get('/me/documents', employeeController.getMyDocuments);
router.post('/me/documents', selfDocUpload.single('file'), employeeController.uploadMyDocument);

export default router;

