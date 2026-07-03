import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/auth.middleware';
import { formsController } from './forms.controller';

const formsRouter = Router({ mergeParams: true });

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many submissions. Try again later.' },
  },
});

// Public form details endpoint (no auth required, token validated in service)
formsRouter.get('/:formId/public', submissionLimiter, formsController.getPublicForm);

// Public/auth submission endpoint
formsRouter.post('/:formId/submissions', submissionLimiter, optionalAuthenticate, formsController.submitForm);

// Authenticated endpoints
formsRouter.use(authenticate);
formsRouter.get('/:formId', formsController.getForm);
formsRouter.patch('/:formId', formsController.updateForm);
formsRouter.delete('/:formId', formsController.deleteForm);
formsRouter.post('/:formId/publish', formsController.publishForm);
formsRouter.post('/:formId/access-tokens', formsController.createAccessToken);
formsRouter.get('/:formId/submissions', formsController.listSubmissions);

export default formsRouter;

export const projectFormsRouter = Router({ mergeParams: true });
projectFormsRouter.use(authenticate);
projectFormsRouter.post('/', formsController.createForm);
projectFormsRouter.get('/', formsController.listForms);
