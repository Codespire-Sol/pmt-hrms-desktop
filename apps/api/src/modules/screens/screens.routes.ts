import { Router } from 'express';
import { ScreensController } from './screens.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const controller = new ScreensController();

router.use(authenticate);

// System fields reference
router.get('/fields/system', controller.getSystemFields);

// Screen for issue (used by issue forms)
router.get('/for-issue', controller.getScreenForIssue);

// Screen CRUD
router.post('/', controller.createScreen);
router.get('/', controller.getScreens);
router.get('/:screenId', controller.getScreen);
router.patch('/:screenId', controller.updateScreen);
router.delete('/:screenId', controller.deleteScreen);

// Screen tabs
router.post('/:screenId/tabs', controller.addScreenTab);
router.patch('/tabs/:tabId', controller.updateScreenTab);
router.delete('/tabs/:tabId', controller.deleteScreenTab);

// Tab fields
router.post('/tabs/:tabId/fields', controller.addFieldToTab);
router.patch('/fields/:fieldId', controller.updateTabField);
router.delete('/fields/:fieldId', controller.removeFieldFromTab);
router.post('/tabs/:tabId/fields/reorder', controller.reorderTabFields);

// Screen schemes
router.post('/schemes', controller.createScreenScheme);
router.get('/schemes', controller.getScreenSchemes);
router.get('/schemes/:schemeId', controller.getScreenScheme);
router.patch('/schemes/:schemeId', controller.updateScreenScheme);
router.delete('/schemes/:schemeId', controller.deleteScreenScheme);
router.post('/schemes/:schemeId/items', controller.setScreenSchemeItem);
router.delete('/schemes/:schemeId/items/:operation', controller.removeScreenSchemeItem);

// Issue type screen schemes
router.post('/issue-type-schemes', controller.createIssueTypeScreenScheme);
router.get('/issue-type-schemes', controller.getIssueTypeScreenSchemes);
router.get('/issue-type-schemes/:schemeId', controller.getIssueTypeScreenScheme);
router.patch('/issue-type-schemes/:schemeId', controller.updateIssueTypeScreenScheme);
router.delete('/issue-type-schemes/:schemeId', controller.deleteIssueTypeScreenScheme);
router.post('/issue-type-schemes/:schemeId/items', controller.setIssueTypeScreenSchemeItem);
router.delete('/issue-type-schemes/:schemeId/items/:issueTypeId', controller.removeIssueTypeScreenSchemeItem);

export default router;
