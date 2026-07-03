import { Router } from 'express';
import { ReferenceController } from './reference.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireSystemAdmin } from '../../middleware/rbac.middleware';

const router = Router();
const referenceController = new ReferenceController();

router.use(authenticate);

// GET routes - All authenticated users
router.get('/issue-types', referenceController.getIssueTypes);
router.get('/priorities', referenceController.getPriorities);
router.get('/statuses', referenceController.getStatuses);
router.get('/labels', referenceController.getLabels);

// POST routes - Admin only
router.post('/issue-types', requireSystemAdmin(), referenceController.createIssueType);
router.post('/priorities', requireSystemAdmin(), referenceController.createPriority);

// PATCH / DELETE / PUT routes - Admin only
router.put('/issue-types/reorder', requireSystemAdmin(), referenceController.reorderIssueTypes);
router.patch('/issue-types/:id', requireSystemAdmin(), referenceController.updateIssueType);
router.delete('/issue-types/:id', requireSystemAdmin(), referenceController.deleteIssueType);

router.patch('/priorities/:id', requireSystemAdmin(), referenceController.updatePriority);
router.delete('/priorities/:id', requireSystemAdmin(), referenceController.deletePriority);

export default router;
