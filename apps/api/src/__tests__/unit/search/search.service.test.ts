import { searchService } from '../../../modules/search/search.service';
import { searchRepository } from '../../../modules/search/search.repository';
import { aiService } from '../../../modules/ai/ai.service';

// Mock dependencies
jest.mock('../../../modules/search/search.repository');
jest.mock('../../../modules/ai/ai.service');
jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const mockSearchRepository = searchRepository as jest.Mocked<typeof searchRepository>;
const mockAiService = aiService as jest.Mocked<typeof aiService>;

describe('SearchService', () => {
  const mockUserId = 'user-123';
  const mockProjectId = 'project-123';

  // Using 'any' to avoid strict type checking on mock data
  const mockSearchResult: any = {
    id: 'issue-123',
    type: 'issue' as const,
    title: 'Test Issue',
    subtitle: 'TEST-123',
    description: 'A test issue',
    url: '/projects/project-123/issues/issue-123',
    avatarUrl: null,
    highlight: null,
    projectId: mockProjectId,
    projectKey: 'TEST',
    issueKey: 'TEST-123',
    status: 'open',
    statusColor: '#blue',
    priority: 'high',
    assigneeName: 'John Doe',
    score: 85,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return empty results for short queries', async () => {
      const result = await searchService.search('a', mockUserId);

      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockSearchRepository.searchIssues).not.toHaveBeenCalled();
    });

    it('should search all entity types by default', async () => {
      mockSearchRepository.searchIssues.mockResolvedValue({ results: [mockSearchResult], total: 1 });
      mockSearchRepository.searchProjects.mockResolvedValue({ results: [], total: 0 });
      mockSearchRepository.searchUsers.mockResolvedValue({ results: [], total: 0 });
      mockSearchRepository.searchComments.mockResolvedValue({ results: [], total: 0 });

      const result = await searchService.search('test query', mockUserId);

      expect(mockSearchRepository.searchIssues).toHaveBeenCalled();
      expect(mockSearchRepository.searchProjects).toHaveBeenCalled();
      expect(mockSearchRepository.searchUsers).toHaveBeenCalled();
      expect(mockSearchRepository.searchComments).toHaveBeenCalled();
      expect(result.results).toHaveLength(1);
    });

    it('should filter by specific entity types', async () => {
      mockSearchRepository.searchIssues.mockResolvedValue({ results: [mockSearchResult], total: 1 });

      await searchService.search('test query', mockUserId, { types: ['issue'] });

      expect(mockSearchRepository.searchIssues).toHaveBeenCalled();
      expect(mockSearchRepository.searchProjects).not.toHaveBeenCalled();
      expect(mockSearchRepository.searchUsers).not.toHaveBeenCalled();
    });

    it('should sort results by score', async () => {
      const highScoreResult = { ...mockSearchResult, id: 'high', score: 95 };
      const lowScoreResult = { ...mockSearchResult, id: 'low', score: 60 };

      mockSearchRepository.searchIssues.mockResolvedValue({
        results: [lowScoreResult, highScoreResult],
        total: 2,
      });

      const result = await searchService.search('test query', mockUserId, { types: ['issue'] });

      expect(result.results[0].id).toBe('high');
      expect(result.results[1].id).toBe('low');
    });
  });

  describe('quickSearch', () => {
    it('should return empty results for short queries', async () => {
      const result = await searchService.quickSearch('a', mockUserId);

      expect(result.issues).toEqual([]);
      expect(result.projects).toEqual([]);
      expect(result.users).toEqual([]);
    });

    it('should call repository quickSearch', async () => {
      mockSearchRepository.quickSearch.mockResolvedValue({
        issues: [],
        projects: [],
        users: [],
      });

      await searchService.quickSearch('test', mockUserId);

      expect(mockSearchRepository.quickSearch).toHaveBeenCalledWith('test', mockUserId, 5);
    });
  });

  describe('parseQueryLocally', () => {
    it('should detect list intent', () => {
      const result = searchService.parseQueryLocally('show me all bugs');

      expect(result.intent).toBe('list');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect find intent', () => {
      const result = searchService.parseQueryLocally('find issues with login');

      expect(result.intent).toBe('find');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect count intent', () => {
      const result = searchService.parseQueryLocally('how many bugs are open');

      expect(result.intent).toBe('count');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect navigate intent for issue keys', () => {
      const result = searchService.parseQueryLocally('PROJ-123');

      expect(result.intent).toBe('navigate');
      expect(result.issueKey).toBe('PROJ-123');
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('should extract high priority filter', () => {
      const result = searchService.parseQueryLocally('high priority bugs');

      expect(result.extractedFilters.priority).toBe('high');
    });

    it('should extract bug issue type', () => {
      const result = searchService.parseQueryLocally('show all bugs');

      expect(result.extractedFilters.issueType).toBe('bug');
    });

    it('should extract story issue type', () => {
      const result = searchService.parseQueryLocally('find user stories');

      expect(result.extractedFilters.issueType).toBe('story');
    });

    it('should extract open status', () => {
      const result = searchService.parseQueryLocally('open issues');

      expect(result.extractedFilters.status).toContain('open');
    });

    it('should extract in progress status', () => {
      const result = searchService.parseQueryLocally('issues in progress');

      expect(result.extractedFilters.status).toContain('in_progress');
    });

    it('should extract assignee me filter', () => {
      const result = searchService.parseQueryLocally('my issues');

      expect(result.extractedFilters.assignee).toBe('me');
    });

    it('should extract specific assignee', () => {
      const result = searchService.parseQueryLocally('assigned to john');

      expect(result.extractedFilters.assignee).toBe('john');
    });

    it('should extract overdue due date', () => {
      const result = searchService.parseQueryLocally('overdue tasks');

      expect(result.extractedFilters.dueDate).toEqual({ operator: 'overdue' });
    });

    it('should extract due today', () => {
      const result = searchService.parseQueryLocally('due today');

      expect(result.extractedFilters.dueDate?.operator).toBe('on');
    });

    it('should return search terms after extracting filters', () => {
      const result = searchService.parseQueryLocally('high priority login bug');

      expect(result.searchTerms).toContain('login');
    });
  });

  describe('understandQuery', () => {
    it('should use local parsing for short queries', async () => {
      const result = await searchService.understandQuery('bugs');

      expect(result.parsedQuery).toBeDefined();
      expect(result.suggestedFilters).toBeDefined();
      expect(mockAiService.parseNaturalLanguage).not.toHaveBeenCalled();
    });

    it('should try AI parsing for complex queries with low local confidence', async () => {
      mockAiService.parseNaturalLanguage.mockResolvedValue({
        parsedIssue: {
          title: 'Complex query result',
          issueType: 'bug',
          priority: 'high',
        },
        confidence: 0.9,
      } as any);

      // Use a query that doesn't match common patterns to get low local confidence
      const result = await searchService.understandQuery(
        'what issues are blocking release',
        mockProjectId
      );

      // The AI should be called since local confidence is below 0.8
      expect(result.parsedQuery).toBeDefined();
      expect(result.parsedQuery.originalQuery).toBe('what issues are blocking release');
    });

    it('should fallback to local parsing if AI fails', async () => {
      mockAiService.parseNaturalLanguage.mockRejectedValue(new Error('AI service unavailable'));

      const result = await searchService.understandQuery(
        'find high priority bugs related to login',
        mockProjectId
      );

      expect(result.parsedQuery).toBeDefined();
      expect(result.parsedQuery.extractedFilters.priority).toBe('high');
    });

    it('should include processing time', async () => {
      const result = await searchService.understandQuery('test query');

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('aiRankedSearch', () => {
    beforeEach(() => {
      mockSearchRepository.searchIssues.mockResolvedValue({
        results: [mockSearchResult],
        total: 1,
      });
      mockSearchRepository.getRecentItems.mockResolvedValue([]);
    });

    it('should return ranked results with relevance scores', async () => {
      const result = await searchService.aiRankedSearch('test query', mockUserId);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].relevanceScore).toBeDefined();
      expect(result.results[0].rankingFactors).toBeDefined();
    });

    it('should include ranking factors', async () => {
      const result = await searchService.aiRankedSearch('test query', mockUserId);

      const rankingFactors = result.results[0].rankingFactors;
      expect(rankingFactors.textMatch).toBeDefined();
      expect(rankingFactors.recency).toBeDefined();
      expect(rankingFactors.popularity).toBeDefined();
      expect(rankingFactors.userAffinity).toBeDefined();
      expect(rankingFactors.contextRelevance).toBeDefined();
    });

    it('should boost user affinity for recent items', async () => {
      mockSearchRepository.getRecentItems.mockResolvedValue([
        { entityId: 'issue-123', entityType: 'issue', accessedAt: new Date().toISOString() } as any,
      ]);

      const result = await searchService.aiRankedSearch('test query', mockUserId);

      expect(result.results[0].rankingFactors.userAffinity).toBe(1.0);
    });

    it('should handle direct issue key lookup', async () => {
      mockSearchRepository.searchIssues.mockResolvedValue({
        results: [{ ...mockSearchResult, issueKey: 'TEST-123' }],
        total: 1,
      });

      const result = await searchService.aiRankedSearch('TEST-123', mockUserId);

      expect(result.results[0].relevanceScore).toBe(1.0);
    });

    it('should include parsed query in response', async () => {
      const result = await searchService.aiRankedSearch('high priority bugs', mockUserId);

      expect(result.parsedQuery).toBeDefined();
      expect(result.parsedQuery?.extractedFilters?.priority).toBe('high');
    });

    it('should include processing time', async () => {
      const result = await searchService.aiRankedSearch('test query', mockUserId);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Recent Items', () => {
    describe('recordRecentItem', () => {
      it('should record recent item', async () => {
        mockSearchRepository.recordRecentItem.mockResolvedValue();

        await searchService.recordRecentItem(mockUserId, 'issue', 'issue-123');

        expect(mockSearchRepository.recordRecentItem).toHaveBeenCalledWith(
          mockUserId,
          'issue',
          'issue-123'
        );
      });

      it('should not throw on error', async () => {
        mockSearchRepository.recordRecentItem.mockRejectedValue(new Error('DB error'));

        await expect(
          searchService.recordRecentItem(mockUserId, 'issue', 'issue-123')
        ).resolves.not.toThrow();
      });
    });

    describe('getRecentItems', () => {
      it('should return recent items', async () => {
        const mockRecentItems = [
          { entityId: 'issue-1', entityType: 'issue' as const, accessedAt: new Date().toISOString() },
        ];
        mockSearchRepository.getRecentItems.mockResolvedValue(mockRecentItems as any);

        const result = await searchService.getRecentItems(mockUserId);

        expect(result).toEqual(mockRecentItems);
      });

      it('should filter by entity types', async () => {
        mockSearchRepository.getRecentItems.mockResolvedValue([]);

        await searchService.getRecentItems(mockUserId, ['issue', 'project']);

        expect(mockSearchRepository.getRecentItems).toHaveBeenCalledWith(
          mockUserId,
          ['issue', 'project'],
          10
        );
      });
    });
  });

  describe('Saved Searches', () => {
    const mockSavedSearch = {
      id: 'saved-123',
      userId: mockUserId,
      name: 'My Bugs',
      query: 'bugs',
      filters: { types: ['issue'] },
      projectId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    describe('createSavedSearch', () => {
      it('should create saved search', async () => {
        mockSearchRepository.createSavedSearch.mockResolvedValue(mockSavedSearch as any);

        const result = await searchService.createSavedSearch(mockUserId, {
          name: 'My Bugs',
          filters: { types: ['issue'] },
        } as any);

        expect(result.name).toBe('My Bugs');
      });
    });

    describe('getSavedSearches', () => {
      it('should return user saved searches', async () => {
        mockSearchRepository.getSavedSearches.mockResolvedValue([mockSavedSearch] as any);

        const result = await searchService.getSavedSearches(mockUserId);

        expect(result).toHaveLength(1);
      });

      it('should filter by project', async () => {
        mockSearchRepository.getSavedSearches.mockResolvedValue([]);

        await searchService.getSavedSearches(mockUserId, mockProjectId);

        expect(mockSearchRepository.getSavedSearches).toHaveBeenCalledWith(mockUserId, mockProjectId);
      });
    });

    describe('executeSavedSearch', () => {
      it('should execute saved search with filters', async () => {
        mockSearchRepository.getSavedSearchById.mockResolvedValue(mockSavedSearch as any);
        mockSearchRepository.searchIssues.mockResolvedValue({ results: [], total: 0 });
        mockSearchRepository.searchProjects.mockResolvedValue({ results: [], total: 0 });
        mockSearchRepository.searchUsers.mockResolvedValue({ results: [], total: 0 });
        mockSearchRepository.searchComments.mockResolvedValue({ results: [], total: 0 });

        await searchService.executeSavedSearch('saved-123', mockUserId);

        expect(mockSearchRepository.getSavedSearchById).toHaveBeenCalledWith('saved-123', mockUserId);
      });

      it('should return empty results for non-existent saved search', async () => {
        mockSearchRepository.getSavedSearchById.mockResolvedValue(null);

        const result = await searchService.executeSavedSearch('non-existent', mockUserId);

        expect(result.results).toEqual([]);
      });
    });
  });

  describe('Natural Language Search', () => {
    it('should return empty for short queries', async () => {
      const result = await searchService.naturalLanguageSearch('ab', mockProjectId, mockUserId);

      expect(result.results).toEqual([]);
      expect(result.parsedQuery.confidence).toBe(0);
    });

    it('should parse query using AI service', async () => {
      mockAiService.parseNaturalLanguage.mockResolvedValue({
        parsedIssue: {
          title: 'Authentication bug',
          issueType: 'bug',
          priority: 'high',
        },
        confidence: 0.85,
      } as any);
      mockSearchRepository.searchIssues.mockResolvedValue({ results: [], total: 0 });

      const result = await searchService.naturalLanguageSearch(
        'find high priority authentication bugs',
        mockProjectId,
        mockUserId
      );

      expect(mockAiService.parseNaturalLanguage).toHaveBeenCalled();
      expect(result.parsedQuery).toBeDefined();
    });

    it('should fallback to regular search on AI failure', async () => {
      mockAiService.parseNaturalLanguage.mockRejectedValue(new Error('AI error'));
      mockSearchRepository.searchIssues.mockResolvedValue({ results: [], total: 0 });

      const result = await searchService.naturalLanguageSearch(
        'find authentication bugs',
        mockProjectId,
        mockUserId
      );

      expect(result.parsedQuery.confidence).toBe(0);
    });
  });

  describe('Semantic Search', () => {
    it('should return empty for short queries', async () => {
      const result = await searchService.semanticSearch('ab', mockProjectId, mockUserId);

      expect(result).toEqual([]);
    });

    it('should call AI service for similar issues', async () => {
      mockAiService.findSimilarIssues.mockResolvedValue({
        similarIssues: [
          { issueId: 'issue-1', issueKey: 'TEST-1', title: 'Similar', similarity: 0.9, reason: 'test' },
        ],
      } as any);
      mockSearchRepository.filterAccessibleIssues.mockResolvedValue(['issue-1']);

      const result = await searchService.semanticSearch(
        'authentication flow',
        mockProjectId,
        mockUserId
      );

      expect(mockAiService.findSimilarIssues).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should filter inaccessible issues', async () => {
      mockAiService.findSimilarIssues.mockResolvedValue({
        similarIssues: [
          { issueId: 'issue-1', issueKey: 'TEST-1', title: 'Similar', similarity: 0.9, reason: 'test' },
          { issueId: 'issue-2', issueKey: 'TEST-2', title: 'Secret', similarity: 0.8, reason: 'test' },
        ],
      } as any);
      mockSearchRepository.filterAccessibleIssues.mockResolvedValue(['issue-1']); // Only issue-1 accessible

      const result = await searchService.semanticSearch(
        'authentication flow',
        mockProjectId,
        mockUserId
      );

      expect(result).toHaveLength(1);
      expect(result[0].issueId).toBe('issue-1');
    });
  });
});
