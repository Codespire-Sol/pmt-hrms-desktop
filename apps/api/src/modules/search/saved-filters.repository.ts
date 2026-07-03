import { prisma } from '../../database/prisma';
import {
  SavedFilter,
  SavedFilterWithOwner,
  CreateSavedFilterInput,
  UpdateSavedFilterInput,
  FilterSubscription,
  FilterVisibility,
} from './saved-filters.types';

export class SavedFiltersRepository {
  async create(ownerId: string, input: CreateSavedFilterInput, parsedQuery?: any): Promise<SavedFilter> {
    const filter = await prisma.savedFilter.create({
      data: {
        userId: ownerId,
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        filters: parsedQuery ? JSON.stringify(parsedQuery) : '{}',
        visibility: (input.visibility || 'private') as any,
        isFavorite: input.isFavorite || false,
      } as any,
    });

    return this.mapToFilter(filter);
  }

  async findById(id: string): Promise<SavedFilter | null> {
    const filter = await prisma.savedFilter.findUnique({ where: { id } });
    return filter ? this.mapToFilter(filter) : null;
  }

  async findByIdWithOwner(id: string, userId?: string): Promise<SavedFilterWithOwner | null> {
    const filter = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        sf.*,
        (u.first_name || ' ' || u.last_name) as owner_display_name,
        u.email as owner_email,
        u.avatar_url as owner_avatar_url,
        p.name as project_name,
        p.key as project_key,
        (SELECT COUNT(*) FROM filter_subscriptions WHERE filter_id = sf.id)::int as subscriber_count
        ${userId ? `, EXISTS(SELECT 1 FROM filter_subscriptions WHERE filter_id = sf.id AND user_id = $2) as is_subscribed` : ''}
      FROM saved_filters sf
      LEFT JOIN users u ON sf.owner_id = u.id
      LEFT JOIN projects p ON sf.project_id = p.id
      WHERE sf.id = $1`,
      ...(userId ? [id, userId] : [id])
    );

    if (filter.length === 0) return null;
    return this.mapToFilterWithOwner(filter[0]);
  }

  async findAccessibleFilters(
    userId: string,
    options: {
      projectId?: string;
      search?: string;
      visibility?: FilterVisibility;
      ownedOnly?: boolean;
      subscribedOnly?: boolean;
      favoritesOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ filters: SavedFilterWithOwner[]; total: number }> {
    // This query is complex with dynamic conditions, so we use raw SQL
    const conditions: string[] = [];
    const params: any[] = [userId];
    let paramIndex = 2;

    // Visibility conditions
    let visibilityClause = `(sf.owner_id = $1 OR sf.visibility = 'global'`;
    if (options.projectId) {
      visibilityClause += ` OR (sf.visibility = 'project' AND sf.project_id = $${paramIndex})`;
      params.push(options.projectId);
      paramIndex++;
    }
    visibilityClause += ')';
    conditions.push(visibilityClause);

    if (options.projectId) {
      conditions.push(`(sf.project_id = $${paramIndex} OR sf.project_id IS NULL)`);
      params.push(options.projectId);
      paramIndex++;
    }

    if (options.search) {
      conditions.push(`(sf.name ILIKE $${paramIndex} OR sf.description ILIKE $${paramIndex} OR sf.jql ILIKE $${paramIndex})`);
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    if (options.visibility) {
      conditions.push(`sf.visibility = $${paramIndex}`);
      params.push(options.visibility);
      paramIndex++;
    }

    if (options.ownedOnly) {
      conditions.push(`sf.owner_id = $1`);
    }

    if (options.subscribedOnly) {
      conditions.push(`fs.id IS NOT NULL`);
    }

    if (options.favoritesOnly) {
      conditions.push(`((sf.is_favorite = true AND sf.owner_id = $1) OR fs.is_favorite = true)`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const limitVal = options.limit || 50;
    const offsetVal = options.offset || 0;

    const baseFrom = `
      FROM saved_filters sf
      LEFT JOIN users u ON sf.owner_id = u.id
      LEFT JOIN projects p ON sf.project_id = p.id
      LEFT JOIN filter_subscriptions fs ON fs.filter_id = sf.id AND fs.user_id = $1
    `;

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(sf.id) as count ${baseFrom} ${whereClause}`,
      ...params
    );
    const total = Number(countResult[0].count);

    // Get filters with pagination
    const filters = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        sf.*,
        (u.first_name || ' ' || u.last_name) as owner_display_name,
        u.email as owner_email,
        u.avatar_url as owner_avatar_url,
        p.name as project_name,
        p.key as project_key,
        fs.id as subscription_id,
        fs.is_favorite as subscription_is_favorite,
        (SELECT COUNT(*) FROM filter_subscriptions WHERE filter_id = sf.id)::int as subscriber_count
      ${baseFrom}
      ${whereClause}
      ORDER BY sf.usage_count DESC, sf.updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      ...params,
      limitVal,
      offsetVal
    );

    return {
      filters: filters.map((f: any) => this.mapToFilterWithOwner(f)),
      total,
    };
  }

  async update(id: string, input: UpdateSavedFilterInput, parsedQuery?: any): Promise<SavedFilter | null> {
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.jql !== undefined) {
      updateData.jql = input.jql;
      updateData.parsedQuery = parsedQuery ? JSON.stringify(parsedQuery) : null;
    }
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;

    const filter = await prisma.savedFilter.update({
      where: { id },
      data: updateData,
    });

    return filter ? this.mapToFilter(filter) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.savedFilter.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async incrementUsage(id: string): Promise<void> {
    await prisma.$queryRaw`
      UPDATE saved_filters
      SET usage_count = usage_count + 1, last_used_at = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  // Subscription methods
  async subscribe(filterId: string, userId: string): Promise<FilterSubscription> {
    // Attempt upsert via raw SQL for ON CONFLICT ... IGNORE behavior
    await prisma.$queryRaw`
      INSERT INTO filter_subscriptions (filter_id, user_id)
      VALUES (${filterId}::uuid, ${userId}::uuid)
      ON CONFLICT (filter_id, user_id) DO NOTHING
    `;

    const existing = await prisma.filterSubscription.findFirst({
      where: { filterId, userId },
    });

    return this.mapToSubscription(existing!);
  }

  async unsubscribe(filterId: string, userId: string): Promise<boolean> {
    const result = await prisma.filterSubscription.deleteMany({
      where: { filterId, userId },
    });
    return result.count > 0;
  }

  async toggleSubscriptionFavorite(filterId: string, userId: string, isFavorite: boolean): Promise<FilterSubscription | null> {
    const existing = await prisma.filterSubscription.findFirst({
      where: { filterId, userId },
    });

    if (!existing) return null;

    const updated = await prisma.filterSubscription.update({
      where: { id: existing.id },
      data: { isFavorite },
    });

    return this.mapToSubscription(updated);
  }

  async getSubscription(filterId: string, userId: string): Promise<FilterSubscription | null> {
    const subscription = await prisma.filterSubscription.findFirst({
      where: { filterId, userId },
    });
    return subscription ? this.mapToSubscription(subscription) : null;
  }

  async getSubscribers(filterId: string): Promise<any[]> {
    const results = await prisma.$queryRaw<any[]>`
      SELECT
        u.id,
        (u.first_name || ' ' || u.last_name) as display_name,
        u.email,
        u.avatar_url,
        fs.is_favorite,
        fs.subscribed_at
      FROM filter_subscriptions fs
      JOIN users u ON fs.user_id = u.id
      WHERE fs.filter_id = ${filterId}::uuid
      ORDER BY fs.subscribed_at DESC
    `;

    return results.map((r: any) => ({
      id: r.id,
      displayName: r.display_name,
      email: r.email,
      avatarUrl: r.avatar_url,
      isFavorite: r.is_favorite,
      subscribedAt: r.subscribed_at,
    }));
  }

  private mapToFilter(row: any): SavedFilter {
    return {
      id: row.id,
      projectId: row.projectId ?? row.project_id,
      ownerId: row.ownerId ?? row.owner_id,
      name: row.name,
      description: row.description,
      jql: row.jql,
      parsedQuery: row.parsedQuery ?? row.parsed_query
        ? JSON.parse(typeof (row.parsedQuery ?? row.parsed_query) === 'string' ? (row.parsedQuery ?? row.parsed_query) : JSON.stringify(row.parsedQuery ?? row.parsed_query))
        : null,
      isFavorite: row.isFavorite ?? row.is_favorite,
      visibility: row.visibility,
      usageCount: row.usageCount ?? row.usage_count,
      lastUsedAt: row.lastUsedAt ?? row.last_used_at,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  }

  private mapToFilterWithOwner(row: any): SavedFilterWithOwner {
    return {
      ...this.mapToFilter(row),
      owner: {
        id: row.ownerId ?? row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        avatarUrl: row.owner_avatar_url,
      },
      project: (row.projectId ?? row.project_id) ? {
        id: row.projectId ?? row.project_id,
        name: row.project_name,
        key: row.project_key,
      } : undefined,
      isSubscribed: row.subscription_id != null || row.is_subscribed === true,
      subscriberCount: row.subscriber_count || 0,
    };
  }

  private mapToSubscription(row: any): FilterSubscription {
    return {
      id: row.id,
      filterId: row.filterId ?? row.filter_id,
      userId: row.userId ?? row.user_id,
      isFavorite: row.isFavorite ?? row.is_favorite,
      subscribedAt: row.subscribedAt ?? row.subscribed_at,
    };
  }
}
