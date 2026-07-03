import { Router } from 'express';
import { customFieldsController } from './custom-fields.controller';
import { authenticate } from '../../middleware/auth.middleware';

// Main custom fields router (for /api/v1/custom-fields)
const router = Router();
router.use(authenticate);

// Individual field operations
router.get('/:fieldId', customFieldsController.getField);
router.patch('/:fieldId', customFieldsController.updateField);
router.delete('/:fieldId', customFieldsController.deleteField);

export default router;

// Project custom fields router (for /api/v1/projects/:projectId/custom-fields)
export const projectCustomFieldsRouter = Router({ mergeParams: true });
projectCustomFieldsRouter.use(authenticate);

projectCustomFieldsRouter.get('/', customFieldsController.listFields);
projectCustomFieldsRouter.post('/', customFieldsController.createField);
projectCustomFieldsRouter.post('/reorder', customFieldsController.reorderFields);

// Issue custom fields router (for /api/v1/issues/:issueId/custom-fields)
export const issueCustomFieldsRouter = Router({ mergeParams: true });
issueCustomFieldsRouter.use(authenticate);

issueCustomFieldsRouter.get('/', customFieldsController.getIssueFieldValues);
issueCustomFieldsRouter.put('/', customFieldsController.setIssueFieldValues);
issueCustomFieldsRouter.put('/:fieldId', customFieldsController.setIssueFieldValue);
issueCustomFieldsRouter.delete('/:fieldId', customFieldsController.deleteIssueFieldValue);
