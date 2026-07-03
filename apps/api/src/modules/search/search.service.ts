import { searchRepository } from './search.repository';
import {
  SearchResult,
  SearchResponse,
  SearchFilters,
  SearchEntityType,
  QuickSearchResult,
  NLSearchResponse,
  SemanticSearchResult,
  RecentItem,
  SearchHistoryItem,
  SavedSearch,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  ParsedQuery,
  QueryIntent,
  QueryUnderstandingResponse,
  RankedSearchResult,
  AIRankedSearchResponse,
} from './search.types';
import { aiService } from '../ai/ai.service';
import { logger } from '../../utils/logger';

export const searchService = {
  // Full search with pagination and filters
  async search(
    query: string,
    userId: string,
    filters: SearchFilters = {},
    limit: number = 20,
    offset: number = 0
  ): Promise<SearchResponse> {
    if (!query || query.trim().length < 2) {
      return {
        results: [],
        total: 0,
        query,
        filters,
        pagination: { limit, offset, hasMore: false },
      };
    }

    const trimmedQuery = query.trim();
    const types = filters.types || ['issue', 'project', 'user', 'comment'];
    let allResults: SearchResult[] = [];
    let totalCount = 0;

    // Search each entity type
    const searchPromises: Promise<{ results: SearchResult[]; total: number }>[] = [];

    if (types.includes('issue')) {
      searchPromises.push(
        searchRepository.searchIssues(trimmedQuery, userId, filters, limit, offset)
      );
    }
    if (types.includes('project')) {
      searchPromises.push(
        searchRepository.searchProjects(trimmedQuery, userId, limit, offset)
      );
    }
    if (types.includes('user')) {
      searchPromises.push(searchRepository.searchUsers(trimmedQuery, limit, offset));
    }
    if (types.includes('comment')) {
      searchPromises.push(
        searchRepository.searchComments(trimmedQuery, userId, filters, limit, offset)
      );
    }

    const results = await Promise.all(searchPromises);

    // Combine and sort results
    for (const result of results) {
      allResults = allResults.concat(result.results);
      totalCount += result.total;
    }

    // Sort by score (relevance)
    allResults.sort((a, b) => b.score - a.score);

    // Apply pagination to combined results
    const paginatedResults = allResults.slice(0, limit);

    return {
      results: paginatedResults,
      total: totalCount,
      query: trimmedQuery,
      filters,
      pagination: {
        limit,
        offset,
        hasMore: offset + paginatedResults.length < totalCount,
      },
    };
  },

  // Quick search for command palette / autocomplete
  async quickSearch(query: string, userId: string): Promise<QuickSearchResult> {
    if (!query || query.trim().length < 2) {
      return {
        issues: [],
        projects: [],
        users: [],
      };
    }

    return searchRepository.quickSearch(query.trim(), userId, 5);
  },

  // Search only issues
  async searchIssues(
    query: string,
    userId: string,
    filters: SearchFilters = {},
    limit: number = 20,
    offset: number = 0
  ): Promise<{ results: SearchResult[]; total: number }> {
    if (!query || query.trim().length < 2) {
      return { results: [], total: 0 };
    }

    return searchRepository.searchIssues(query.trim(), userId, filters, limit, offset);
  },

  // Search only projects
  async searchProjects(
    query: string,
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ results: SearchResult[]; total: number }> {
    if (!query || query.trim().length < 2) {
      return { results: [], total: 0 };
    }

    return searchRepository.searchProjects(query.trim(), userId, limit, offset);
  },

  // Search only users
  async searchUsers(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ results: SearchResult[]; total: number }> {
    if (!query || query.trim().length < 2) {
      return { results: [], total: 0 };
    }

    return searchRepository.searchUsers(query.trim(), limit, offset);
  },

  // Natural Language Search
  async naturalLanguageSearch(
    query: string,
    projectId: string,
    userId: string,
    limit: number = 20,
    offset: number = 0,
    authHeader?: string
  ): Promise<NLSearchResponse> {
    if (!query || query.trim().length < 3) {
      return {
        results: [],
        total: 0,
        query,
        parsedQuery: {
          title: '',
          confidence: 0,
        },
        appliedFilters: {},
        pagination: {
          limit,
          offset,
          hasMore: false,
        },
      };
    }

    try {
      // Parse natural language query using AI service
      const parsed = await aiService.parseNaturalLanguage(query.trim(), projectId, authHeader);

      // Build search filters from parsed result
      const filters: SearchFilters = {
        projectIds: [projectId],
        types: ['issue'],
      };

      // Apply parsed filters
      if (parsed.parsedIssue.priority) {
        filters.priority = [parsed.parsedIssue.priority.toLowerCase()];
      }

      // Search with extracted title/keywords
      const searchQuery = parsed.parsedIssue.title || query.trim();
      const { results, total } = await searchRepository.searchIssues(
        searchQuery,
        userId,
        filters,
        limit,
        offset
      );

      return {
        results,
        total,
        query: query.trim(),
        parsedQuery: {
          title: parsed.parsedIssue.title,
          issueType: parsed.parsedIssue.issueType,
          priority: parsed.parsedIssue.priority,
          assigneeHint: parsed.parsedIssue.assigneeHint,
          dueDateHint: parsed.parsedIssue.dueDateHint,
          labels: parsed.parsedIssue.labels,
          confidence: parsed.confidence,
        },
        appliedFilters: {
          issueType: parsed.parsedIssue.issueType,
          priority: parsed.parsedIssue.priority,
          assigneeHint: parsed.parsedIssue.assigneeHint,
          dueDateHint: parsed.parsedIssue.dueDateHint,
          labels: parsed.parsedIssue.labels,
        },
        pagination: {
          limit,
          offset,
          hasMore: offset + results.length < total,
        },
      };
    } catch (error) {
      logger.error('Natural language search failed:', error);

      // Fallback to regular search if NL parsing fails
      const { results, total } = await searchRepository.searchIssues(
        query.trim(),
        userId,
        { projectIds: [projectId], types: ['issue'] },
        limit,
        offset
      );

      return {
        results,
        total,
        query: query.trim(),
        parsedQuery: {
          title: query.trim(),
          confidence: 0,
        },
        appliedFilters: {},
        pagination: {
          limit,
          offset,
          hasMore: offset + results.length < total,
        },
      };
    }
  },

  // Semantic Search using embeddings
  async semanticSearch(
    query: string,
    projectId: string,
    userId: string,
    limit: number = 10,
    authHeader?: string
  ): Promise<SemanticSearchResult[]> {
    if (!query || query.trim().length < 3) {
      return [];
    }

    try {
      // Find similar issues using AI service
      const similar = await aiService.findSimilarIssues(
        query.trim(),
        '', // No description needed for query
        projectId,
        limit,
        authHeader
      );

      // Verify user has access to the returned issues
      const accessibleIssues = await this.filterByAccess(
        similar.similarIssues.map((issue) => issue.issueId),
        userId
      );

      // Return only accessible issues with their similarity info
      return similar.similarIssues
        .filter((issue) => accessibleIssues.has(issue.issueId))
        .map((issue) => ({
          issueId: issue.issueId,
          issueKey: issue.issueKey,
          title: issue.title,
          description: null, // We don't have this from the AI response
          similarity: issue.similarity,
          reason: issue.reason,
          projectId: projectId,
          projectKey: '', // Would need to fetch from DB
          status: '',
          statusColor: null,
        }));
    } catch (error) {
      logger.error('Semantic search failed:', error);
      return [];
    }
  },

  // Helper: Filter issue IDs by user access
  async filterByAccess(issueIds: string[], userId: string): Promise<Set<string>> {
    if (issueIds.length === 0) {
      return new Set();
    }

    const accessible = await searchRepository.filterAccessibleIssues(issueIds, userId);
    return new Set(accessible);
  },

  // ========== Recent Items ==========

  async recordRecentItem(
    userId: string,
    entityType: SearchEntityType,
    entityId: string
  ): Promise<void> {
    try {
      await searchRepository.recordRecentItem(userId, entityType, entityId);
    } catch (error) {
      logger.error('Failed to record recent item:', error);
      // Don't throw - this is a non-critical operation
    }
  },

  async getRecentItems(
    userId: string,
    entityTypes?: SearchEntityType[],
    limit: number = 10
  ): Promise<RecentItem[]> {
    return searchRepository.getRecentItems(userId, entityTypes, limit);
  },

  async clearRecentItems(userId: string, entityType?: SearchEntityType): Promise<void> {
    await searchRepository.clearRecentItems(userId, entityType);
  },

  // ========== Search History ==========

  async recordSearchQuery(userId: string, query: string, resultCount: number): Promise<void> {
    try {
      // Only record non-trivial searches
      if (query && query.trim().length >= 2) {
        await searchRepository.recordSearchQuery(userId, query.trim(), resultCount);
      }
    } catch (error) {
      logger.error('Failed to record search query:', error);
      // Don't throw - this is a non-critical operation
    }
  },

  async getSearchHistory(userId: string, limit: number = 10): Promise<SearchHistoryItem[]> {
    return searchRepository.getSearchHistory(userId, limit);
  },

  async clearSearchHistory(userId: string): Promise<void> {
    await searchRepository.clearSearchHistory(userId);
  },

  // ========== Saved Searches ==========

  async createSavedSearch(userId: string, input: CreateSavedSearchInput): Promise<SavedSearch> {
    return searchRepository.createSavedSearch(userId, input);
  },

  async getSavedSearches(userId: string, projectId?: string): Promise<SavedSearch[]> {
    return searchRepository.getSavedSearches(userId, projectId);
  },

  async getSavedSearchById(id: string, userId: string): Promise<SavedSearch | null> {
    return searchRepository.getSavedSearchById(id, userId);
  },

  async updateSavedSearch(
    id: string,
    userId: string,
    input: UpdateSavedSearchInput
  ): Promise<SavedSearch | null> {
    return searchRepository.updateSavedSearch(id, userId, input);
  },

  async deleteSavedSearch(id: string, userId: string): Promise<boolean> {
    return searchRepository.deleteSavedSearch(id, userId);
  },

  // Execute a saved search
  async executeSavedSearch(
    savedSearchId: string,
    userId: string,
    query?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<SearchResponse> {
    const savedSearch = await searchRepository.getSavedSearchById(savedSearchId, userId);

    if (!savedSearch) {
      return {
        results: [],
        total: 0,
        query: query || '',
        filters: {},
        pagination: { limit, offset, hasMore: false },
      };
    }

    // Use the saved filters, optionally with a query
    return this.search(query || '', userId, savedSearch.filters, limit, offset);
  },

  // ========== Query Understanding (GAP-015) ==========

  parseQueryLocally(query: string): ParsedQuery {
    const lowerQuery = query.toLowerCase().trim();
    const originalQuery = query.trim();

    // Detect intent from query patterns
    let intent: QueryIntent = 'search';
    let confidence = 0.5;

    if (/^(show|list|get|display)\s/i.test(lowerQuery)) {
      intent = 'list';
      confidence = 0.8;
    } else if (/^(find|search|look for)\s/i.test(lowerQuery)) {
      intent = 'find';
      confidence = 0.8;
    } else if (/^(how many|count|number of)\s/i.test(lowerQuery)) {
      intent = 'count';
      confidence = 0.9;
    } else if (/^(go to|open|navigate to)\s/i.test(lowerQuery)) {
      intent = 'navigate';
      confidence = 0.9;
    } else if (/(compare|vs|versus)/i.test(lowerQuery)) {
      intent = 'compare';
      confidence = 0.7;
    } else if (/(blocking|blocker|stuck|status)/i.test(lowerQuery)) {
      intent = 'status';
      confidence = 0.6;
    }

    // Extract filters from query
    const extractedFilters: ParsedQuery['extractedFilters'] = {};

    // Priority extraction
    if (/(high\s*priority|urgent|critical)/i.test(lowerQuery)) {
      extractedFilters.priority = 'high';
    } else if (/(medium\s*priority|moderate)/i.test(lowerQuery)) {
      extractedFilters.priority = 'medium';
    } else if (/(low\s*priority|minor)/i.test(lowerQuery)) {
      extractedFilters.priority = 'low';
    }

    // Issue type extraction
    if (/(bug|bugs|defect|defects)/i.test(lowerQuery)) {
      extractedFilters.issueType = 'bug';
    } else if (/(task|tasks)/i.test(lowerQuery)) {
      extractedFilters.issueType = 'task';
    } else if (/(story|stories|user\s*story)/i.test(lowerQuery)) {
      extractedFilters.issueType = 'story';
    } else if (/(epic|epics)/i.test(lowerQuery)) {
      extractedFilters.issueType = 'epic';
    } else if (/(feature|features)/i.test(lowerQuery)) {
      extractedFilters.issueType = 'feature';
    }

    // Status extraction
    if (/(open|opened|todo|to\s*do)/i.test(lowerQuery)) {
      extractedFilters.status = ['open', 'todo', 'backlog'];
    } else if (/(in\s*progress|working\s*on|in\s*review)/i.test(lowerQuery)) {
      extractedFilters.status = ['in_progress', 'in_review'];
    } else if (/(done|completed|closed|resolved)/i.test(lowerQuery)) {
      extractedFilters.status = ['done', 'closed'];
    } else if (/(blocked|blocking)/i.test(lowerQuery)) {
      extractedFilters.status = ['blocked'];
    }

    // Assignee extraction
    const assignedToMatch = lowerQuery.match(/assigned\s*to\s*(\w+)/i);
    if (assignedToMatch) {
      extractedFilters.assignee = assignedToMatch[1];
    } else if (/(assigned\s*to\s*me|my\s*(issues|tasks|bugs))/i.test(lowerQuery)) {
      extractedFilters.assignee = 'me';
    } else if (/(unassigned)/i.test(lowerQuery)) {
      extractedFilters.assignee = 'unassigned';
    }

    // Due date extraction
    if (/(overdue|past\s*due|late)/i.test(lowerQuery)) {
      extractedFilters.dueDate = { operator: 'overdue' };
    } else if (/(due\s*today|today)/i.test(lowerQuery)) {
      extractedFilters.dueDate = { operator: 'on', value: new Date().toISOString().split('T')[0] };
    } else if (/(due\s*this\s*week|this\s*week)/i.test(lowerQuery)) {
      extractedFilters.dueDate = { operator: 'upcoming' };
    } else if (/(due\s*soon|upcoming)/i.test(lowerQuery)) {
      extractedFilters.dueDate = { operator: 'upcoming' };
    }

    // Issue key extraction (e.g., PROJ-123)
    const issueKeyMatch = query.match(/([A-Z]{2,10}-\d+)/);
    const issueKey = issueKeyMatch ? issueKeyMatch[1] : undefined;
    if (issueKey) {
      intent = 'navigate';
      confidence = 0.95;
    }

    // Extract remaining search terms (remove filter keywords)
    const searchTerms = query
      .replace(/\b(show|list|find|search|get|display|high|medium|low|priority|bug|bugs|task|tasks|story|stories|epic|feature|open|closed|done|in progress|assigned to|my|due|overdue|today|this week|upcoming)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter((term) => term.length > 2);

    return {
      intent,
      confidence,
      extractedFilters,
      searchTerms,
      issueKey,
      originalQuery,
    };
  },

  async understandQuery(
    query: string,
    projectId?: string,
    authHeader?: string
  ): Promise<QueryUnderstandingResponse> {
    const startTime = Date.now();

    // Start with local parsing
    const localParsed = this.parseQueryLocally(query);

    // If we have a projectId and the query is complex, try AI parsing
    let finalParsed = localParsed;

    if (projectId && query.length > 10 && localParsed.confidence < 0.8) {
      try {
        const aiParsed = await aiService.parseNaturalLanguage(query, projectId, authHeader);

        // Merge AI parsing results with local parsing
        if (aiParsed.confidence > localParsed.confidence) {
          finalParsed = {
            ...localParsed,
            confidence: aiParsed.confidence,
            extractedFilters: {
              ...localParsed.extractedFilters,
              issueType: aiParsed.parsedIssue.issueType || localParsed.extractedFilters.issueType,
              priority: aiParsed.parsedIssue.priority || localParsed.extractedFilters.priority,
              assignee: aiParsed.parsedIssue.assigneeHint || localParsed.extractedFilters.assignee,
              labels: aiParsed.parsedIssue.labels || localParsed.extractedFilters.labels,
            },
            searchTerms: aiParsed.parsedIssue.title
              ? aiParsed.parsedIssue.title.split(' ')
              : localParsed.searchTerms,
          };
        }
      } catch (error) {
        logger.warn('AI query parsing failed, using local parsing:', error);
      }
    }

    // Build suggested filters from parsed query
    const suggestedFilters: SearchFilters = {};
    if (finalParsed.extractedFilters.issueType) {
      suggestedFilters.types = ['issue'];
    }
    if (finalParsed.extractedFilters.priority) {
      suggestedFilters.priority = [finalParsed.extractedFilters.priority];
    }
    if (finalParsed.extractedFilters.status) {
      suggestedFilters.status = finalParsed.extractedFilters.status;
    }
    if (projectId) {
      suggestedFilters.projectIds = [projectId];
    }

    return {
      parsedQuery: finalParsed,
      suggestedFilters,
      processingTimeMs: Date.now() - startTime,
    };
  },

  // ========== AI Search Ranking (GAP-016) ==========

  async aiRankedSearch(
    query: string,
    userId: string,
    projectId?: string,
    limit: number = 20,
    offset: number = 0,
    authHeader?: string
  ): Promise<AIRankedSearchResponse> {
    const startTime = Date.now();

    // First, understand the query
    const queryUnderstanding = await this.understandQuery(query, projectId, authHeader);
    const { parsedQuery, suggestedFilters } = queryUnderstanding;

    // Combine suggested filters with project filter
    const searchFilters: SearchFilters = {
      ...suggestedFilters,
      types: ['issue'],
    };
    if (projectId) {
      searchFilters.projectIds = [projectId];
    }

    // If it's a navigate intent with an issue key, do direct lookup
    if (parsedQuery.intent === 'navigate' && parsedQuery.issueKey) {
      const directResults = await searchRepository.searchIssues(
        parsedQuery.issueKey,
        userId,
        searchFilters,
        1,
        0
      );

      if (directResults.results.length > 0) {
        const rankedResults: RankedSearchResult[] = directResults.results.map((r) => ({
          ...r,
          relevanceScore: 1.0,
          rankingFactors: {
            textMatch: 1.0,
            recency: 0.5,
            popularity: 0.5,
            userAffinity: 0.5,
            contextRelevance: 1.0,
          },
        }));

        return {
          results: rankedResults,
          total: 1,
          query,
          parsedQuery,
          appliedFilters: searchFilters,
          pagination: { limit, offset, hasMore: false },
          processingTimeMs: Date.now() - startTime,
        };
      }
    }

    // Build the search query from parsed terms
    const searchQuery = parsedQuery.searchTerms.length > 0
      ? parsedQuery.searchTerms.join(' ')
      : query;

    // Perform the search
    const searchResults = await searchRepository.searchIssues(
      searchQuery,
      userId,
      searchFilters,
      limit * 2, // Fetch more for re-ranking
      0
    );

    // Get user's recent items for affinity calculation
    let recentItemIds: Set<string> = new Set();
    try {
      const recentItems = await searchRepository.getRecentItems(userId, ['issue'], 50);
      recentItemIds = new Set(recentItems.map((r) => r.entityId));
    } catch (error) {
      logger.warn('Failed to get recent items for ranking:', error);
    }

    // Calculate relevance scores and rank results
    const now = new Date();
    const rankedResults: RankedSearchResult[] = searchResults.results.map((result, index) => {
      // Text match score (based on original search score)
      const textMatch = Math.max(0, Math.min(1, (result.score - 50) / 50));

      // Recency score (newer = higher)
      const updatedAt = new Date(result.updatedAt);
      const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      const recency = Math.max(0, 1 - daysSinceUpdate / 365);

      // Popularity score (simple heuristic based on position - could be enhanced with view counts)
      const popularity = Math.max(0, 1 - index / searchResults.results.length);

      // User affinity (whether user has recently viewed this item)
      const userAffinity = recentItemIds.has(result.id) ? 1.0 : 0.0;

      // Context relevance (based on filters matching)
      let contextRelevance = 0.5;
      if (parsedQuery.extractedFilters.priority && result.status === parsedQuery.extractedFilters.priority) {
        contextRelevance += 0.2;
      }
      if (parsedQuery.extractedFilters.issueType) {
        contextRelevance += 0.1;
      }

      // Calculate final relevance score (weighted combination)
      const relevanceScore =
        textMatch * 0.35 +
        recency * 0.2 +
        popularity * 0.1 +
        userAffinity * 0.2 +
        contextRelevance * 0.15;

      return {
        ...result,
        relevanceScore,
        rankingFactors: {
          textMatch,
          recency,
          popularity,
          userAffinity,
          contextRelevance,
        },
      };
    });

    // Sort by relevance score
    rankedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply pagination
    const paginatedResults = rankedResults.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total: searchResults.total,
      query,
      parsedQuery,
      appliedFilters: searchFilters,
      pagination: {
        limit,
        offset,
        hasMore: offset + paginatedResults.length < searchResults.total,
      },
      processingTimeMs: Date.now() - startTime,
    };
  },
};
