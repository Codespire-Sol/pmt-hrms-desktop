import { Request, Response } from 'express';
import { searchService } from './search.service';
import {
  SearchEntityType,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
} from './search.types';

export const searchController = {
  // GET /api/v1/search
  async search(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const {
        q: query,
        types,
        projectIds,
        status,
        priority,
        assigneeIds,
        createdAfter,
        createdBefore,
        limit = '20',
        offset = '0',
      } = req.query as Record<string, string | undefined>;

      if (!query || query.trim().length < 2) {
        return res.json({
          success: true,
          data: {
            results: [],
            total: 0,
            query: query || '',
            filters: {},
            pagination: {
              limit: parseInt(limit, 10),
              offset: parseInt(offset, 10),
              hasMore: false,
            },
          },
        });
      }

      const filters = {
        types: types ? (types.split(',') as SearchEntityType[]) : undefined,
        projectIds: projectIds ? projectIds.split(',') : undefined,
        status: status ? status.split(',') : undefined,
        priority: priority ? priority.split(',') : undefined,
        assigneeIds: assigneeIds ? assigneeIds.split(',') : undefined,
        createdAfter,
        createdBefore,
      };

      const result = await searchService.search(
        query,
        userId,
        filters,
        Math.min(parseInt(limit, 10) || 20, 100),
        parseInt(offset, 10) || 0
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error performing search:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to perform search',
        },
      });
    }
  },

  // GET /api/v1/search/quick
  async quickSearch(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { q: query } = req.query as { q?: string };

      if (!query || query.trim().length < 2) {
        return res.json({
          success: true,
          data: {
            issues: [],
            projects: [],
            users: [],
          },
        });
      }

      const result = await searchService.quickSearch(query, userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error performing quick search:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to perform search',
        },
      });
    }
  },

  // GET /api/v1/search/issues
  async searchIssues(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const {
        q: query,
        projectIds,
        status,
        priority,
        assigneeIds,
        limit = '20',
        offset = '0',
      } = req.query as Record<string, string | undefined>;

      if (!query || query.trim().length < 2) {
        return res.json({
          success: true,
          data: { results: [], total: 0 },
        });
      }

      const filters = {
        projectIds: projectIds ? projectIds.split(',') : undefined,
        status: status ? status.split(',') : undefined,
        priority: priority ? priority.split(',') : undefined,
        assigneeIds: assigneeIds ? assigneeIds.split(',') : undefined,
      };

      const result = await searchService.searchIssues(
        query,
        userId,
        filters,
        Math.min(parseInt(limit, 10) || 20, 100),
        parseInt(offset, 10) || 0
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error searching issues:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to search issues',
        },
      });
    }
  },

  // GET /api/v1/search/projects
  async searchProjects(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { q: query, limit = '20', offset = '0' } = req.query as Record<string, string>;

      if (!query || query.trim().length < 2) {
        return res.json({
          success: true,
          data: { results: [], total: 0 },
        });
      }

      const result = await searchService.searchProjects(
        query,
        userId,
        Math.min(parseInt(limit, 10) || 20, 100),
        parseInt(offset, 10) || 0
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error searching projects:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to search projects',
        },
      });
    }
  },

  // GET /api/v1/search/users
  async searchUsers(req: Request, res: Response) {
    try {
      const { q: query, limit = '20', offset = '0' } = req.query as Record<string, string>;

      if (!query || query.trim().length < 2) {
        return res.json({
          success: true,
          data: { results: [], total: 0 },
        });
      }

      const result = await searchService.searchUsers(
        query,
        Math.min(parseInt(limit, 10) || 20, 100),
        parseInt(offset, 10) || 0
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to search users',
        },
      });
    }
  },

  // POST /api/v1/search/natural
  // Natural language search using AI parsing
  async naturalLanguageSearch(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { query, projectId, limit = 20, offset = 0 } = req.body as {
        query: string;
        projectId: string;
        limit?: number;
        offset?: number;
      };

      if (!query || query.trim().length < 3) {
        return res.json({
          success: true,
          data: {
            results: [],
            total: 0,
            query: query || '',
            parsedQuery: { title: '', confidence: 0 },
            appliedFilters: {},
            pagination: { limit, offset, hasMore: false },
          },
        });
      }

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'projectId is required for natural language search',
          },
        });
      }

      const authHeader = req.headers.authorization;
      const result = await searchService.naturalLanguageSearch(
        query,
        projectId,
        userId,
        Math.min(limit || 20, 100),
        offset || 0,
        authHeader
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error performing natural language search:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to perform natural language search',
        },
      });
    }
  },

  // POST /api/v1/search/semantic
  // Semantic search using embeddings similarity
  async semanticSearch(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { query, projectId, limit = 10 } = req.body as {
        query: string;
        projectId: string;
        limit?: number;
      };

      if (!query || query.trim().length < 3) {
        return res.json({
          success: true,
          data: { results: [] },
        });
      }

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'projectId is required for semantic search',
          },
        });
      }

      const authHeader = req.headers.authorization;
      const results = await searchService.semanticSearch(
        query,
        projectId,
        userId,
        Math.min(limit || 10, 50),
        authHeader
      );

      res.json({
        success: true,
        data: { results },
      });
    } catch (error) {
      console.error('Error performing semantic search:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to perform semantic search',
        },
      });
    }
  },

  // ========== Recent Items ==========

  // GET /api/v1/search/recent
  async getRecentItems(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { types, limit = '10' } = req.query as { types?: string; limit?: string };

      const entityTypes = types ? (types.split(',') as SearchEntityType[]) : undefined;
      const items = await searchService.getRecentItems(
        userId,
        entityTypes,
        Math.min(parseInt(limit, 10) || 10, 50)
      );

      res.json({
        success: true,
        data: { items },
      });
    } catch (error) {
      console.error('Error getting recent items:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get recent items',
        },
      });
    }
  },

  // POST /api/v1/search/recent
  async recordRecentItem(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { entityType, entityId } = req.body as {
        entityType: SearchEntityType;
        entityId: string;
      };

      if (!entityType || !entityId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'entityType and entityId are required',
          },
        });
      }

      await searchService.recordRecentItem(userId, entityType, entityId);

      res.json({
        success: true,
        message: 'Recent item recorded',
      });
    } catch (error) {
      console.error('Error recording recent item:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to record recent item',
        },
      });
    }
  },

  // DELETE /api/v1/search/recent
  async clearRecentItems(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { type } = req.query as { type?: SearchEntityType };

      await searchService.clearRecentItems(userId, type);

      res.json({
        success: true,
        message: 'Recent items cleared',
      });
    } catch (error) {
      console.error('Error clearing recent items:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to clear recent items',
        },
      });
    }
  },

  // ========== Search History ==========

  // GET /api/v1/search/history
  async getSearchHistory(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { limit = '10' } = req.query as { limit?: string };

      const history = await searchService.getSearchHistory(
        userId,
        Math.min(parseInt(limit, 10) || 10, 100)
      );

      res.json({
        success: true,
        data: { history },
      });
    } catch (error) {
      console.error('Error getting search history:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get search history',
        },
      });
    }
  },

  // DELETE /api/v1/search/history
  async clearSearchHistory(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      await searchService.clearSearchHistory(userId);

      res.json({
        success: true,
        message: 'Search history cleared',
      });
    } catch (error) {
      console.error('Error clearing search history:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to clear search history',
        },
      });
    }
  },

  // ========== Saved Searches ==========

  // GET /api/v1/search/saved
  async getSavedSearches(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { projectId } = req.query as { projectId?: string };

      const searches = await searchService.getSavedSearches(userId, projectId);

      res.json({
        success: true,
        data: { searches },
      });
    } catch (error) {
      console.error('Error getting saved searches:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get saved searches',
        },
      });
    }
  },

  // POST /api/v1/search/saved
  async createSavedSearch(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const input = req.body as CreateSavedSearchInput;

      if (!input.name || !input.filters) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'name and filters are required',
          },
        });
      }

      const savedSearch = await searchService.createSavedSearch(userId, input);

      res.status(201).json({
        success: true,
        data: savedSearch,
      });
    } catch (error) {
      console.error('Error creating saved search:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create saved search',
        },
      });
    }
  },

  // GET /api/v1/search/saved/:id
  async getSavedSearch(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const savedSearch = await searchService.getSavedSearchById(id, userId);

      if (!savedSearch) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Saved search not found',
          },
        });
      }

      res.json({
        success: true,
        data: savedSearch,
      });
    } catch (error) {
      console.error('Error getting saved search:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get saved search',
        },
      });
    }
  },

  // PATCH /api/v1/search/saved/:id
  async updateSavedSearch(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const input = req.body as UpdateSavedSearchInput;

      const savedSearch = await searchService.updateSavedSearch(id, userId, input);

      if (!savedSearch) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Saved search not found',
          },
        });
      }

      res.json({
        success: true,
        data: savedSearch,
      });
    } catch (error) {
      console.error('Error updating saved search:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update saved search',
        },
      });
    }
  },

  // DELETE /api/v1/search/saved/:id
  async deleteSavedSearch(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const deleted = await searchService.deleteSavedSearch(id, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Saved search not found',
          },
        });
      }

      res.json({
        success: true,
        message: 'Saved search deleted',
      });
    } catch (error) {
      console.error('Error deleting saved search:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete saved search',
        },
      });
    }
  },

  // POST /api/v1/search/saved/:id/execute
  async executeSavedSearch(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { query, limit = 20, offset = 0 } = req.body as {
        query?: string;
        limit?: number;
        offset?: number;
      };

      const result = await searchService.executeSavedSearch(
        id,
        userId,
        query,
        Math.min(limit || 20, 100),
        offset || 0
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error executing saved search:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to execute saved search',
        },
      });
    }
  },

  // ========== Query Understanding (GAP-015) ==========

  // POST /api/v1/search/understand
  async understandQuery(req: Request, res: Response) {
    try {
      const { query, projectId } = req.body as {
        query: string;
        projectId?: string;
      };

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query must be at least 2 characters',
          },
        });
      }

      const authHeader = req.headers.authorization;
      const result = await searchService.understandQuery(query, projectId, authHeader);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error understanding query:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to understand query',
        },
      });
    }
  },

  // POST /api/v1/search/parse
  // Quick local query parsing without AI
  async parseQuery(req: Request, res: Response) {
    try {
      const { query } = req.body as { query: string };

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query must be at least 2 characters',
          },
        });
      }

      const parsedQuery = searchService.parseQueryLocally(query);

      res.json({
        success: true,
        data: { parsedQuery },
      });
    } catch (error) {
      console.error('Error parsing query:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to parse query',
        },
      });
    }
  },

  // ========== AI Search Ranking (GAP-016) ==========

  // POST /api/v1/search/ai-ranked
  async aiRankedSearch(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { query, projectId, limit = 20, offset = 0 } = req.body as {
        query: string;
        projectId?: string;
        limit?: number;
        offset?: number;
      };

      if (!query || query.trim().length < 2) {
        return res.json({
          success: true,
          data: {
            results: [],
            total: 0,
            query: query || '',
            appliedFilters: {},
            pagination: { limit, offset, hasMore: false },
            processingTimeMs: 0,
          },
        });
      }

      const authHeader = req.headers.authorization;
      const result = await searchService.aiRankedSearch(
        query,
        userId,
        projectId,
        Math.min(limit || 20, 100),
        offset || 0,
        authHeader
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error performing AI-ranked search:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to perform AI-ranked search',
        },
      });
    }
  },
};
