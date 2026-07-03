import { Router, Request, Response, NextFunction } from 'express';
import {
  realtimeCloudPush,
  getPushLogs,
  getPunchLogs,
  simulatePunch,
  bulkImportPunches,
  getMappings,
  upsertMapping,
  deleteMapping,
} from './biometric.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { getBiometricPushToken } from '../../services/appSettings.service';

const router = Router();

// ── Device push (no user login — the biometric device/cloud posts here) ──────
// Optionally protected by a shared secret. The token is read from app-settings
// (Admin → Credential Settings → Attendance Device) first, falling back to the
// BIOMETRIC_PUSH_TOKEN env var. Configure the device to send it as the
// `x-device-token` header (or `?token=` query). When neither is set the
// endpoint stays open for backward compatibility.
function verifyDeviceToken(req: Request, res: Response, next: NextFunction) {
  const expected = getBiometricPushToken() || process.env.BIOMETRIC_PUSH_TOKEN;
  if (!expected) return next();
  const provided = req.headers['x-device-token'] || req.query.token;
  if (provided && String(provided) === expected) return next();
  res.status(401).json({ success: false, message: 'Invalid or missing device token' });
}

router.post('/realtime-push', verifyDeviceToken, realtimeCloudPush);

// ── Everything below requires an authenticated admin ─────────────────────────
router.use(authenticate, requirePermission('admin.settings'));

router.get('/push-logs', getPushLogs);
router.get('/punch-logs', getPunchLogs);
router.post('/simulate', simulatePunch);
router.post('/import', bulkImportPunches);
router.get('/mappings', getMappings);
router.post('/mappings', upsertMapping);
router.delete('/mappings/:employeeId', deleteMapping);

export default router;
