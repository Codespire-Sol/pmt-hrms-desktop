import { SavedFiltersRepository } from './saved-filters.repository';
import { JQLParser } from './jql/jql.parser';
import { JQLExecutor } from './jql/jql.executor';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import {
  SavedFilterWithOwner,
  CreateSavedFilterInput,
  UpdateSavedFilterInput,
  FilterVisibility,
  FilterSubscription,
} from './saved-filters.types';
import { JQLContext, JQLQuery } from './jql/jql.types';

export class SavedFiltersService {
  private repository: SavedFiltersRepository;
  private parser: JQLParser;

  constructor() {
    this.repository = new SavedFiltersRepository();
    this.parser = new JQLParser();
  }

  async createFilter(userId: string, input: CreateSavedFilterInput): Promise<SavedFilterWithOwner> {
    // Parse and validate JQL
    const parseResult = this.parser.parse(input.jql);
    if (!parseResult.success) {
      throw ApiError.badRequest('Invalid JQL syntax', 'JQL_PARSE_ERROR', {
        error: parseResult.error,
        position: parseResult.errorPosition,
      });
    }

    const filter = await this.repository.create(userId, input, parseResult.query);
    const filterWithOwner = await this.repository.findByIdWithOwner(filter.id, userId);

    if (!filterWithOwner) {
      throw ApiError.internal('Failed to retrieve created filter');
    }

    return filterWithOwner;
  }

  async getFilter(filterId: string, userId: string): Promise<SavedFilterWithOwner> {
    const filter = await this.repository.findByIdWithOwner(filterId, userId);
    if (!filter) {
      throw ApiError.notFound('Filter not found');
    }

    // Check access
    await this.checkFilterAccess(filter, userId);

    return filter;
  }

  async getFilters(
    userId: string,
    options: {
      projectId?: string;
      search?: string;
      visibility?: FilterVisibility;
      ownedOnly?: boolean;
      subscribedOnly?: boolean;
      favoritesOnly?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ filters: SavedFilterWithOwner[]; pagination: any }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    const { filters, total } = await this.repository.findAccessibleFilters(userId, {
      ...options,
      limit,
      offset,
    });

    return {
      filters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateFilter(filterId: string, userId: string, input: UpdateSavedFilterInput): Promise<SavedFilterWithOwner> {
    const filter = await this.repository.findById(filterId);
    if (!filter) {
      throw ApiError.notFound('Filter not found');
    }

    // Only owner can update
    if (filter.ownerId !== userId) {
      throw ApiError.forbidden('You can only update your own filters');
    }

    // If JQL is being updated, validate it
    let parsedQuery: JQLQuery | undefined;
    if (input.jql) {
      const parseResult = this.parser.parse(input.jql);
      if (!parseResult.success) {
        throw ApiError.badRequest('Invalid JQL syntax', 'JQL_PARSE_ERROR', {
          error: parseResult.error,
          position: parseResult.errorPosition,
        });
      }
      parsedQuery = parseResult.query;
    }

    await this.repository.update(filterId, input, parsedQuery);
    const updatedFilter = await this.repository.findByIdWithOwner(filterId, userId);

    if (!updatedFilter) {
      throw ApiError.internal('Failed to retrieve updated filter');
    }

    return updatedFilter;
  }

  async deleteFilter(filterId: string, userId: string): Promise<{ message: string }> {
    const filter = await this.repository.findById(filterId);
    if (!filter) {
      throw ApiError.notFound('Filter not found');
    }

    // Only owner can delete
    if (filter.ownerId !== userId) {
      throw ApiError.forbidden('You can only delete your own filters');
    }

    await this.repository.delete(filterId);
    return { message: 'Filter deleted successfully' };
  }

  async executeFilter(
    filterId: string,
    userId: string,
    options: {
      projectId?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ issues: any[]; pagination: any }> {
    const filter = await this.repository.findById(filterId);
    if (!filter) {
      throw ApiError.notFound('Filter not found');
    }

    // Check access
    const filterWithOwner = await this.repository.findByIdWithOwner(filterId, userId);
    if (filterWithOwner) {
      await this.checkFilterAccess(filterWithOwner, userId);
    }

    // Increment usage count
    await this.repository.incrementUsage(filterId);

    // Execute the JQL
    return this.executeJQL(filter.jql, userId, options);
  }

  async executeJQL(
    jql: string,
    userId: string,
    options: {
      projectId?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ issues: any[]; pagination: any }> {
    // Parse JQL
    const parseResult = this.parser.parse(jql);
    if (!parseResult.success) {
      throw ApiError.badRequest('Invalid JQL syntax', 'JQL_PARSE_ERROR', {
        error: parseResult.error,
        position: parseResult.errorPosition,
      });
    }

    const context: JQLContext = {
      currentUserId: userId,
      projectId: options.projectId,
    };

    const executor = new JQLExecutor(prisma, context);
    const { issues, total } = await executor.execute(parseResult.query!, options.projectId);

    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);

    // Apply pagination (simple slice for now - could be optimized with LIMIT/OFFSET in executor)
    const startIndex = (page - 1) * limit;
    const paginatedIssues = issues.slice(startIndex, startIndex + limit);

    return {
      issues: paginatedIssues,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async validateJQL(jql: string): Promise<{ valid: boolean; error?: string; errorPosition?: number }> {
    const parseResult = this.parser.parse(jql);
    return {
      valid: parseResult.success,
      error: parseResult.error,
      errorPosition: parseResult.errorPosition,
    };
  }

  // Subscription methods
  async subscribeToFilter(filterId: string, userId: string): Promise<FilterSubscription> {
    const filter = await this.repository.findByIdWithOwner(filterId, userId);
    if (!filter) {
      throw ApiError.notFound('Filter not found');
    }

    // Check access
    await this.checkFilterAccess(filter, userId);

    // Can't subscribe to your own filter
    if (filter.ownerId === userId) {
      throw ApiError.badRequest('You cannot subscribe to your own filter');
    }

    return this.repository.subscribe(filterId, userId);
  }

  async unsubscribeFromFilter(filterId: string, userId: string): Promise<{ message: string }> {
    const subscription = await this.repository.getSubscription(filterId, userId);
    if (!subscription) {
      throw ApiError.notFound('Subscription not found');
    }

    await this.repository.unsubscribe(filterId, userId);
    return { message: 'Unsubscribed successfully' };
  }

  async toggleSubscriptionFavorite(filterId: string, userId: string, isFavorite: boolean): Promise<FilterSubscription> {
    const subscription = await this.repository.getSubscription(filterId, userId);
    if (!subscription) {
      throw ApiError.notFound('You are not subscribed to this filter');
    }

    const updated = await this.repository.toggleSubscriptionFavorite(filterId, userId, isFavorite);
    if (!updated) {
      throw ApiError.internal('Failed to update subscription');
    }

    return updated;
  }

  async getFilterSubscribers(filterId: string, userId: string): Promise<any[]> {
    const filter = await this.repository.findById(filterId);
    if (!filter) {
      throw ApiError.notFound('Filter not found');
    }

    // Only owner can see subscribers
    if (filter.ownerId !== userId) {
      throw ApiError.forbidden('Only the filter owner can view subscribers');
    }

    return this.repository.getSubscribers(filterId);
  }

  private async checkFilterAccess(filter: SavedFilterWithOwner, userId: string): Promise<void> {
    // Owner always has access
    if (filter.ownerId === userId) {
      return;
    }

    // Global filters are accessible to everyone
    if (filter.visibility === 'global') {
      return;
    }

    // Project filters require project membership
    if (filter.visibility === 'project' && filter.projectId) {
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: filter.projectId,
            userId,
          },
        },
      });

      if (membership) {
        return;
      }
    }

    // Private filter - no access
    throw ApiError.forbidden('You do not have access to this filter');
  }
}
