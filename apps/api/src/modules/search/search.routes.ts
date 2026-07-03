import { Router } from 'express';
import { searchController } from './search.controller';
import { SavedFiltersController } from './saved-filters.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
const savedFiltersController = new SavedFiltersController();

// All routes require authentication
router.use(authenticate);

// JQL operations
router.post('/jql/execute', savedFiltersController.executeJQL);
router.get('/jql/validate', savedFiltersController.validateJQL);
router.post('/jql/validate', savedFiltersController.validateJQL);

// Saved filters (JQL-based)
router.post('/filters', savedFiltersController.createFilter);
router.get('/filters', savedFiltersController.getFilters);
router.get('/filters/:filterId', savedFiltersController.getFilter);
router.patch('/filters/:filterId', savedFiltersController.updateFilter);
router.delete('/filters/:filterId', savedFiltersController.deleteFilter);
router.get('/filters/:filterId/execute', savedFiltersController.executeFilter);
router.post('/filters/:filterId/subscribe', savedFiltersController.subscribeToFilter);
router.delete('/filters/:filterId/subscribe', savedFiltersController.unsubscribeFromFilter);
router.patch('/filters/:filterId/subscribe', savedFiltersController.toggleSubscriptionFavorite);
router.get('/filters/:filterId/subscribers', savedFiltersController.getFilterSubscribers);

// Full search
router.get('/', searchController.search);

// Quick search (for command palette / autocomplete)
router.get('/quick', searchController.quickSearch);

// Search by entity type
router.get('/issues', searchController.searchIssues);
router.get('/projects', searchController.searchProjects);
router.get('/users', searchController.searchUsers);

// AI-powered search
router.post('/natural', searchController.naturalLanguageSearch);
router.post('/semantic', searchController.semanticSearch);
router.post('/understand', searchController.understandQuery);
router.post('/parse', searchController.parseQuery);
router.post('/ai-ranked', searchController.aiRankedSearch);

// Recent items
router.get('/recent', searchController.getRecentItems);
router.post('/recent', searchController.recordRecentItem);
router.delete('/recent', searchController.clearRecentItems);

// Search history
router.get('/history', searchController.getSearchHistory);
router.delete('/history', searchController.clearSearchHistory);

// Saved searches
router.get('/saved', searchController.getSavedSearches);
router.post('/saved', searchController.createSavedSearch);
router.get('/saved/:id', searchController.getSavedSearch);
router.patch('/saved/:id', searchController.updateSavedSearch);
router.delete('/saved/:id', searchController.deleteSavedSearch);
router.post('/saved/:id/execute', searchController.executeSavedSearch);

export default router;
