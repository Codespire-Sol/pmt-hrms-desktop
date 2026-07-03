import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { LeadsController } from './leads.controller';
import { LeadCommentsController } from './lead-comments.controller';

const router = Router();
const leadsController = new LeadsController();
const commentsController = new LeadCommentsController();

router.use(authenticate);

// Lead CRUD
router.get('/', leadsController.getLeads);
router.post('/', leadsController.createLead);
router.get('/:leadId', leadsController.getLead);
router.patch('/:leadId', leadsController.updateLead);
router.delete('/:leadId', leadsController.deleteLead);

// Lead Comments
router.get('/:leadId/comments', commentsController.getComments);
router.post('/:leadId/comments', commentsController.createComment);
router.delete('/:leadId/comments/:commentId', commentsController.deleteComment);

export default router;
