export type SearchEntityType = 'issue' | 'project' | 'user' | 'comment';

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle: string | null;
  description: string | null;
  url: string;
  projectId: string | null;
  projectKey: string | null;
  issueKey: string | null;
  avatarUrl: string | null;
  status: string | null;
  statusColor: string | null;
  highlight: string | null;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  filters: SearchFilters;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface SearchFilters {
  types?: SearchEntityType[];
  projectIds?: string[];
  status?: string[];
  priority?: string[];
  assigneeIds?: string[];
  createdAfter?: string;
  createdBefore?: string;
}

export interface QuickSearchResult {
  issues: SearchResult[];
  projects: SearchResult[];
  users: SearchResult[];
}

// JQL Types
export type FilterVisibility = 'private' | 'project' | 'global';

export interface SavedFilter {
  id: string;
  projectId?: string;
  ownerId: string;
  name: string;
  description?: string;
  jql: string;
  parsedQuery?: any;
  isFavorite: boolean;
  visibility: FilterVisibility;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  project?: {
    id: string;
    name: string;
    key: string;
  };
  isSubscribed?: boolean;
  subscriberCount?: number;
}

export interface CreateFilterInput {
  projectId?: string;
  name: string;
  description?: string;
  jql: string;
  visibility?: FilterVisibility;
  isFavorite?: boolean;
}

export interface UpdateFilterInput {
  name?: string;
  description?: string;
  jql?: string;
  visibility?: FilterVisibility;
  isFavorite?: boolean;
}

export interface JQLValidationResult {
  valid: boolean;
  error?: string;
  errorPosition?: number;
}

export interface JQLExecutionResult {
  issues: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FilterSubscription {
  id: string;
  filterId: string;
  userId: string;
  isFavorite: boolean;
  subscribedAt: string;
}

export interface FilterSubscriber {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  isFavorite: boolean;
  subscribedAt: string;
}

// JQL field definitions for autocomplete
export const JQL_FIELDS = [
  { name: 'project', type: 'uuid', description: 'Project the issue belongs to' },
  { name: 'type', type: 'uuid', description: 'Issue type (Bug, Story, Task, etc.)' },
  { name: 'issuetype', type: 'uuid', description: 'Alias for type' },
  { name: 'status', type: 'uuid', description: 'Issue status' },
  { name: 'priority', type: 'uuid', description: 'Issue priority' },
  { name: 'assignee', type: 'uuid', description: 'User assigned to the issue' },
  { name: 'reporter', type: 'uuid', description: 'User who reported the issue' },
  { name: 'sprint', type: 'uuid', description: 'Sprint the issue is in' },
  { name: 'parent', type: 'uuid', description: 'Parent issue (for sub-tasks)' },
  { name: 'summary', type: 'string', description: 'Issue title/summary' },
  { name: 'title', type: 'string', description: 'Alias for summary' },
  { name: 'description', type: 'string', description: 'Issue description' },
  { name: 'created', type: 'date', description: 'Creation date' },
  { name: 'updated', type: 'date', description: 'Last update date' },
  { name: 'duedate', type: 'date', description: 'Due date' },
  { name: 'due', type: 'date', description: 'Alias for duedate' },
  { name: 'startdate', type: 'date', description: 'Start date' },
  { name: 'resolution', type: 'string', description: 'Issue resolution' },
  { name: 'resolutiondate', type: 'date', description: 'Resolution date' },
  { name: 'resolved', type: 'date', description: 'Alias for resolutiondate' },
  { name: 'storypoints', type: 'number', description: 'Story points estimate' },
  { name: 'story_points', type: 'number', description: 'Alias for storypoints' },
  { name: 'originalestimate', type: 'number', description: 'Original time estimate (hours)' },
  { name: 'remainingestimate', type: 'number', description: 'Remaining time estimate (hours)' },
  { name: 'timespent', type: 'number', description: 'Time spent (hours)' },
  { name: 'fixversion', type: 'uuid', description: 'Fix version' },
  { name: 'affectedversion', type: 'uuid', description: 'Affected version' },
  { name: 'component', type: 'uuid', description: 'Component' },
  { name: 'label', type: 'uuid', description: 'Label' },
  { name: 'watcher', type: 'uuid', description: 'Issue watcher' },
  { name: 'voter', type: 'uuid', description: 'Issue voter' },
  { name: 'securitylevel', type: 'uuid', description: 'Security level' },
  { name: 'text', type: 'string', description: 'Full-text search across all text fields' },
] as const;

export const JQL_OPERATORS = [
  { name: '=', description: 'Equals' },
  { name: '!=', description: 'Not equals' },
  { name: '>', description: 'Greater than' },
  { name: '<', description: 'Less than' },
  { name: '>=', description: 'Greater than or equal' },
  { name: '<=', description: 'Less than or equal' },
  { name: '~', description: 'Contains' },
  { name: '!~', description: 'Does not contain' },
  { name: 'IN', description: 'In list' },
  { name: 'NOT IN', description: 'Not in list' },
  { name: 'IS', description: 'Is (for null checks)' },
  { name: 'IS NOT', description: 'Is not (for null checks)' },
] as const;

export const JQL_FUNCTIONS = [
  { name: 'currentUser()', description: 'The currently logged in user' },
  { name: 'now()', description: 'Current date and time' },
  { name: 'today()', description: 'Start of today' },
  { name: 'startOfDay()', description: 'Start of day with optional offset' },
  { name: 'endOfDay()', description: 'End of day with optional offset' },
  { name: 'startOfWeek()', description: 'Start of week with optional offset' },
  { name: 'endOfWeek()', description: 'End of week with optional offset' },
  { name: 'startOfMonth()', description: 'Start of month with optional offset' },
  { name: 'endOfMonth()', description: 'End of month with optional offset' },
  { name: 'membersOf()', description: 'Members of a project' },
] as const;

export const JQL_KEYWORDS = ['AND', 'OR', 'NOT', 'ORDER BY', 'ASC', 'DESC', 'EMPTY', 'NULL'] as const;
