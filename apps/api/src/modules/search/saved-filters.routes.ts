import { Router } from 'express';
import { SavedFiltersController } from './saved-filters.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const controller = new SavedFiltersController();

router.use(authenticate);

// JQL operations (before :filterId routes)
router.post('/jql/execute', controller.executeJQL);
router.get('/jql/validate', controller.validateJQL);
router.post('/jql/validate', controller.validateJQL);

// Saved filter CRUD
router.post('/', controller.createFilter);
router.get('/', controller.getFilters);
router.get('/:filterId', controller.getFilter);
router.patch('/:filterId', controller.updateFilter);
router.delete('/:filterId', controller.deleteFilter);

// Execute a saved filter
router.get('/:filterId/execute', controller.executeFilter);

// Subscriptions
router.post('/:filterId/subscribe', controller.subscribeToFilter);
router.delete('/:filterId/subscribe', controller.unsubscribeFromFilter);
router.patch('/:filterId/subscribe', controller.toggleSubscriptionFavorite);
router.get('/:filterId/subscribers', controller.getFilterSubscribers);

export default router;
