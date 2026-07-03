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

export interface SearchSuggestion {
  type: 'recent' | 'suggestion';
  text: string;
  entityType?: SearchEntityType;
  entityId?: string;
}

// Natural Language Search types
export interface NLSearchFilters {
  issueType?: string;
  priority?: string;
  status?: string[];
  assigneeHint?: string;
  dueDateHint?: string;
  labels?: string[];
}

export interface NLSearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  parsedQuery: {
    title: string;
    issueType?: string;
    priority?: string;
    assigneeHint?: string;
    dueDateHint?: string;
    labels?: string[];
    confidence: number;
  };
  appliedFilters: NLSearchFilters;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Semantic Search types
export interface SemanticSearchResult {
  issueId: string;
  issueKey: string;
  title: string;
  description: string | null;
  similarity: number;
  reason: string;
  projectId: string;
  projectKey: string;
  status: string;
  statusColor: string | null;
}

// Recent Items types
export interface RecentItem {
  id: string;
  userId: string;
  entityType: SearchEntityType;
  entityId: string;
  accessedAt: string;
  // Populated entity data
  title?: string;
  subtitle?: string;
  url?: string;
  avatarUrl?: string | null;
  status?: string | null;
  statusColor?: string | null;
}

// Search History types
export interface SearchHistoryItem {
  id: string;
  userId: string;
  query: string;
  resultCount: number;
  searchedAt: string;
}

// Saved Search types
export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  filters: SearchFilters;
  isDefault: boolean;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedSearchInput {
  name: string;
  description?: string;
  filters: SearchFilters;
  isDefault?: boolean;
  projectId?: string;
}

export interface UpdateSavedSearchInput {
  name?: string;
  description?: string;
  filters?: SearchFilters;
  isDefault?: boolean;
}

// Query Understanding types (GAP-015)
export type QueryIntent =
  | 'search' // General search
  | 'list' // List items (e.g., "show me all bugs")
  | 'find' // Find specific item (e.g., "find the login issue")
  | 'filter' // Apply filters (e.g., "high priority tasks")
  | 'count' // Count items (e.g., "how many open issues")
  | 'compare' // Compare items (e.g., "issues assigned to me vs john")
  | 'status' // Status check (e.g., "what's blocking the release")
  | 'navigate'; // Navigate to item (e.g., "go to PROJ-123")

export interface ParsedQuery {
  intent: QueryIntent;
  confidence: number;
  extractedFilters: {
    issueType?: string;
    priority?: string;
    status?: string[];
    assignee?: string;
    dueDate?: {
      operator: 'before' | 'after' | 'on' | 'between' | 'overdue' | 'upcoming';
      value?: string;
      endValue?: string;
    };
    labels?: string[];
    sprint?: string;
    epic?: string;
    project?: string;
  };
  searchTerms: string[];
  issueKey?: string; // If query contains a direct issue key reference
  originalQuery: string;
}

export interface QueryUnderstandingResponse {
  parsedQuery: ParsedQuery;
  suggestedFilters: SearchFilters;
  processingTimeMs: number;
}

// AI Search Ranking types (GAP-016)
export interface RankedSearchResult extends SearchResult {
  relevanceScore: number;
  rankingFactors: {
    textMatch: number;
    recency: number;
    popularity: number;
    userAffinity: number;
    contextRelevance: number;
  };
}

export interface AIRankedSearchResponse {
  results: RankedSearchResult[];
  total: number;
  query: string;
  parsedQuery?: ParsedQuery;
  appliedFilters: SearchFilters;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  processingTimeMs: number;
}
