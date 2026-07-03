import { Router } from 'express';
import { calendarController } from './calendar.controller';

const router = Router();

// OAuth endpoints
router.get('/oauth-url', calendarController.getOAuthUrl.bind(calendarController));
router.post('/connect', calendarController.handleOAuthCallback.bind(calendarController));

// Integration status and management
router.get('/status', calendarController.getStatus.bind(calendarController));
router.put('/settings', calendarController.updateSettings.bind(calendarController));
router.delete('/disconnect', calendarController.disconnect.bind(calendarController));

// Calendar selection
router.get('/calendars', calendarController.listCalendars.bind(calendarController));
router.post('/calendars/select', calendarController.selectCalendar.bind(calendarController));

// Internal sync endpoints (called by other services)
router.post('/sync/issue', calendarController.syncIssueDueDate.bind(calendarController));
router.post('/sync/issue/remove', calendarController.removeIssueDueDate.bind(calendarController));
router.post('/sync/sprint', calendarController.syncSprint.bind(calendarController));

export default router;
