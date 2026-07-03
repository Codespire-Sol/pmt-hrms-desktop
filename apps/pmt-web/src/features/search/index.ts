// Components
export { GlobalSearch } from './components/GlobalSearch';
export { JQLEditor } from './components/JQLEditor';
export { QueryBuilder } from './components/QueryBuilder';
export { SavedFiltersPage } from './components/SavedFiltersPage';
export { FilterFormDialog } from './components/FilterFormDialog';

// API
export {
  searchApi,
  useSearchQuery,
  useLazySearchQuery,
  useQuickSearchQuery,
  useLazyQuickSearchQuery,
  useSearchIssuesQuery,
  useLazySearchIssuesQuery,
  useSearchProjectsQuery,
  useSearchUsersQuery,
  // JQL hooks
  useExecuteJQLMutation,
  useValidateJQLQuery,
  useLazyValidateJQLQuery,
  // Saved Filter hooks
  useGetFiltersQuery,
  useGetFilterQuery,
  useCreateFilterMutation,
  useUpdateFilterMutation,
  useDeleteFilterMutation,
  useExecuteFilterQuery,
  useLazyExecuteFilterQuery,
  // Subscription hooks
  useSubscribeToFilterMutation,
  useUnsubscribeFromFilterMutation,
  useToggleSubscriptionFavoriteMutation,
  useGetFilterSubscribersQuery,
} from './searchApi';

// Types
export type {
  SearchResult,
  SearchResponse,
  SearchFilters,
  SearchEntityType,
  QuickSearchResult,
  // JQL types
  SavedFilter,
  FilterVisibility,
  JQLValidationResult,
  JQLExecutionResult,
  FilterSubscription,
  FilterSubscriber,
  CreateFilterInput,
  UpdateFilterInput,
} from './types';

// JQL Constants
export { JQL_FIELDS, JQL_OPERATORS, JQL_FUNCTIONS, JQL_KEYWORDS } from './types';
