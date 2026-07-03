import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { EmailScheduleController } from './email-schedule.controller';

const router = Router();
const ctrl = new EmailScheduleController();

router.use(authenticate);

router.get('/',              ctrl.getAll);
router.get('/:type',         ctrl.getOne);
router.patch('/:type',       ctrl.update);
router.post('/:type/trigger', ctrl.trigger);

export default router;
