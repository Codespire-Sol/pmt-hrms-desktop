import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { userGroupsController } from './user-groups.controller';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/:groupId', userGroupsController.get);
router.patch('/:groupId', userGroupsController.update);
router.delete('/:groupId', userGroupsController.delete);
router.post('/:groupId/members', userGroupsController.addMember);
router.delete('/:groupId/members/:userId', userGroupsController.removeMember);
router.post('/:groupId/role-bindings', userGroupsController.bindGlobalRole);
router.post('/:groupId/project-role-bindings', userGroupsController.bindProjectRole);

export default router;

export const projectUserGroupsRouter = Router({ mergeParams: true });
projectUserGroupsRouter.use(authenticate);
projectUserGroupsRouter.post('/', userGroupsController.create);
projectUserGroupsRouter.get('/', userGroupsController.list);
