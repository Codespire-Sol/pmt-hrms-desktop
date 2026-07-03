import { Router } from 'express';
import { LabelsController } from './labels.controller';
import { authenticate } from '../../middleware/auth.middleware';

const labelsController = new LabelsController();

// Nested under /projects/:projectId/labels
export const projectLabelsRouter = Router({ mergeParams: true });
projectLabelsRouter.use(authenticate);
projectLabelsRouter.get('/', labelsController.getProjectLabels);
projectLabelsRouter.post('/', labelsController.createLabel);
projectLabelsRouter.patch('/:labelId', labelsController.updateLabel);
projectLabelsRouter.delete('/:labelId', labelsController.deleteLabel);
