import { Router } from 'express';
import { TransitionConditionsController } from './transition-conditions.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const controller = new TransitionConditionsController();

// All routes require authentication
router.use(authenticate);

// Reference data
router.get('/condition-types', controller.getConditionTypes);
router.get('/validator-types', controller.getValidatorTypes);
router.get('/postfunction-types', controller.getPostFunctionTypes);

// Conditions
router.post('/transitions/:transitionId/conditions', controller.createCondition);
router.get('/transitions/:transitionId/conditions', controller.getConditions);
router.patch('/conditions/:conditionId', controller.updateCondition);
router.delete('/conditions/:conditionId', controller.deleteCondition);

// Validators
router.post('/transitions/:transitionId/validators', controller.createValidator);
router.get('/transitions/:transitionId/validators', controller.getValidators);
router.patch('/validators/:validatorId', controller.updateValidator);
router.delete('/validators/:validatorId', controller.deleteValidator);

// Post Functions
router.post('/transitions/:transitionId/postfunctions', controller.createPostFunction);
router.get('/transitions/:transitionId/postfunctions', controller.getPostFunctions);
router.patch('/postfunctions/:postFunctionId', controller.updatePostFunction);
router.delete('/postfunctions/:postFunctionId', controller.deletePostFunction);

// Approval Config
router.post('/transitions/:transitionId/approval', controller.setApprovalConfig);
router.get('/transitions/:transitionId/approval', controller.getApprovalConfig);
router.delete('/transitions/:transitionId/approval', controller.removeApprovalConfig);

// Approval Handling
router.post('/issues/:issueId/transitions/:transitionId/request-approval', controller.requestApproval);
router.post('/approvals/:approvalId/respond', controller.respondToApproval);

export default router;
