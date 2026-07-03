import { prisma } from '../../database/prisma';
import {
  SearchResult,
  SearchFilters,
  SearchEntityType,
  RecentItem,
  SearchHistoryItem,
  SavedSearch,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
} from './search.types';

export const searchRepository = {
  // Search issues
  async searchIssues(
    query: string,
    userId: string,
    filters: SearchFilters,
    limit: number,
    offset: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    // Get projects user has access to
    const projectMembers = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = projectMembers.map((pm) => pm.projectId);

    if (projectIds.length === 0) {
      return { results: [], total: 0 };
    }

    const searchPattern = `%${query}%`;
    const filterProjectIds = filters.projectIds && filters.projectIds.length > 0
      ? filters.projectIds
      : projectIds;

    // Build WHERE conditions for raw query
    const conditions: string[] = [
      `i.project_id = ANY($1::uuid[])`,
      `(i.title ILIKE $2 OR i.description ILIKE $2 OR CONCAT(p.key, '-', i.issue_number) ILIKE $2)`,
    ];
    const params: any[] = [filterProjectIds, searchPattern];
    let paramIndex = 3;

    if (filters.status && filters.status.length > 0) {
      conditions.push(`s.name = ANY($${paramIndex}::text[])`);
      params.push(filters.status);
      paramIndex++;
    }
    if (filters.priority && filters.priority.length > 0) {
      conditions.push(`i.priority_id = ANY($${paramIndex}::uuid[])`);
      params.push(filters.priority);
      paramIndex++;
    }
    if (filters.assigneeIds && filters.assigneeIds.length > 0) {
      conditions.push(`i.assignee_id = ANY($${paramIndex}::uuid[])`);
      params.push(filters.assigneeIds);
      paramIndex++;
    }
    if (filters.createdAfter) {
      conditions.push(`i.created_at >= $${paramIndex}`);
      params.push(filters.createdAfter);
      paramIndex++;
    }
    if (filters.createdBefore) {
      conditions.push(`i.created_at <= $${paramIndex}`);
      params.push(filters.createdBefore);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(i.id) as count
       FROM issues i
       JOIN projects p ON i.project_id = p.id
       LEFT JOIN statuses s ON i.status_id = s.id
       WHERE ${whereClause}`,
      ...params
    );
    const total = Number(countResult[0].count);

    // Get results with relevance ordering
    const issues = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        i.id,
        i.title,
        i.description,
        s.name as status,
        i.issue_number,
        i.created_at,
        i.updated_at,
        p.id as project_id,
        p.key as project_key,
        p.name as project_name,
        s.color as status_color
       FROM issues i
       JOIN projects p ON i.project_id = p.id
       LEFT JOIN statuses s ON i.status_id = s.id
       WHERE ${whereClause}
       ORDER BY
         CASE
           WHEN CONCAT(p.key, '-', i.issue_number) ILIKE $${paramIndex} THEN 1
           WHEN i.title ILIKE $${paramIndex} THEN 2
           ELSE 3
         END,
         i.updated_at DESC
       LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}`,
      ...params,
      searchPattern,
      limit,
      offset
    );

    const results: SearchResult[] = issues.map((issue: any, index: number) => ({
      id: issue.id,
      type: 'issue' as SearchEntityType,
      title: issue.title,
      subtitle: `${issue.project_key}-${issue.issue_number}`,
      description: issue.description
        ? issue.description.substring(0, 200) + (issue.description.length > 200 ? '...' : '')
        : null,
      url: `/projects/${issue.project_id}/issues/${issue.id}`,
      projectId: issue.project_id,
      projectKey: issue.project_key,
      issueKey: `${issue.project_key}-${issue.issue_number}`,
      avatarUrl: null,
      status: issue.status,
      statusColor: issue.status_color || '#6b7280',
      highlight: null,
      score: 100 - index,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    }));

    return { results, total };
  },

  // Search projects
  async searchProjects(
    query: string,
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const searchPattern = `%${query}%`;

    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(p.id) as count
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ${userId}::uuid
        AND (p.name ILIKE ${searchPattern} OR p.key ILIKE ${searchPattern} OR p.description ILIKE ${searchPattern})
    `;
    const total = Number(countResult[0].count);

    const projects = await prisma.$queryRaw<any[]>`
      SELECT
        p.id,
        p.name,
        p.key,
        p.description,
        p.created_at,
        p.updated_at
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ${userId}::uuid
        AND (p.name ILIKE ${searchPattern} OR p.key ILIKE ${searchPattern} OR p.description ILIKE ${searchPattern})
      ORDER BY
        CASE
          WHEN p.key ILIKE ${searchPattern} THEN 1
          WHEN p.name ILIKE ${searchPattern} THEN 2
          ELSE 3
        END
      LIMIT ${limit} OFFSET ${offset}
    `;

    const results: SearchResult[] = projects.map((project: any, index: number) => ({
      id: project.id,
      type: 'project' as SearchEntityType,
      title: project.name,
      subtitle: project.key,
      description: project.description
        ? project.description.substring(0, 200) + (project.description.length > 200 ? '...' : '')
        : null,
      url: `/projects/${project.id}`,
      projectId: project.id,
      projectKey: project.key,
      issueKey: null,
      avatarUrl: null,
      status: null,
      statusColor: null,
      highlight: null,
      score: 100 - index,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }));

    return { results, total };
  },

  // Search users
  async searchUsers(
    query: string,
    limit: number,
    offset: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const searchPattern = `%${query}%`;

    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(id) as count
      FROM users
      WHERE CONCAT(first_name, ' ', last_name) ILIKE ${searchPattern}
        OR email ILIKE ${searchPattern}
    `;
    const total = Number(countResult[0].count);

    const users = await prisma.$queryRaw<any[]>`
      SELECT id, CONCAT(first_name, ' ', last_name) as display_name, email, avatar_url, created_at, updated_at
      FROM users
      WHERE CONCAT(first_name, ' ', last_name) ILIKE ${searchPattern}
        OR email ILIKE ${searchPattern}
      ORDER BY
        CASE
          WHEN CONCAT(first_name, ' ', last_name) ILIKE ${searchPattern} THEN 1
          WHEN email ILIKE ${searchPattern} THEN 2
          ELSE 3
        END
      LIMIT ${limit} OFFSET ${offset}
    `;

    const results: SearchResult[] = users.map((user: any, index: number) => ({
      id: user.id,
      type: 'user' as SearchEntityType,
      title: user.display_name,
      subtitle: user.email,
      description: null,
      url: `/users/${user.id}`,
      projectId: null,
      projectKey: null,
      issueKey: null,
      avatarUrl: user.avatar_url,
      status: null,
      statusColor: null,
      highlight: null,
      score: 100 - index,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));

    return { results, total };
  },

  // Search comments
  async searchComments(
    query: string,
    userId: string,
    filters: SearchFilters,
    limit: number,
    offset: number
  ): Promise<{ results: SearchResult[]; total: number }> {
    const projectMembers = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = projectMembers.map((pm) => pm.projectId);

    if (projectIds.length === 0) {
      return { results: [], total: 0 };
    }

    const searchPattern = `%${query}%`;
    const filterProjectIds = filters.projectIds && filters.projectIds.length > 0
      ? filters.projectIds
      : projectIds;

    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(c.id) as count
      FROM comments c
      JOIN issues i ON c.issue_id = i.id
      JOIN projects p ON i.project_id = p.id
      JOIN users u ON c.author_id = u.id
      WHERE i.project_id = ANY(${filterProjectIds}::uuid[])
        AND c.content ILIKE ${searchPattern}
    `;
    const total = Number(countResult[0].count);

    const comments = await prisma.$queryRaw<any[]>`
      SELECT
        c.id,
        c.content,
        c.created_at,
        c.updated_at,
        i.id as issue_id,
        i.title as issue_title,
        i.issue_number,
        p.id as project_id,
        p.key as project_key,
        CONCAT(u.first_name, ' ', u.last_name) as author_name,
        u.avatar_url as author_avatar
      FROM comments c
      JOIN issues i ON c.issue_id = i.id
      JOIN projects p ON i.project_id = p.id
      JOIN users u ON c.author_id = u.id
      WHERE i.project_id = ANY(${filterProjectIds}::uuid[])
        AND c.content ILIKE ${searchPattern}
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const results: SearchResult[] = comments.map((comment: any, index: number) => ({
      id: comment.id,
      type: 'comment' as SearchEntityType,
      title: `Comment on ${comment.project_key}-${comment.issue_number}`,
      subtitle: comment.author_name,
      description: comment.content
        ? comment.content.substring(0, 200) + (comment.content.length > 200 ? '...' : '')
        : null,
      url: `/projects/${comment.project_id}/issues/${comment.issue_id}#comment-${comment.id}`,
      projectId: comment.project_id,
      projectKey: comment.project_key,
      issueKey: `${comment.project_key}-${comment.issue_number}`,
      avatarUrl: comment.author_avatar,
      status: null,
      statusColor: null,
      highlight: null,
      score: 100 - index,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    }));

    return { results, total };
  },

  // Quick search (returns top results from each category)
  async quickSearch(
    query: string,
    userId: string,
    limit: number = 5
  ): Promise<{
    issues: SearchResult[];
    projects: SearchResult[];
    users: SearchResult[];
  }> {
    const [issuesResult, projectsResult, usersResult] = await Promise.all([
      this.searchIssues(query, userId, {}, limit, 0),
      this.searchProjects(query, userId, limit, 0),
      this.searchUsers(query, limit, 0),
    ]);

    return {
      issues: issuesResult.results,
      projects: projectsResult.results,
      users: usersResult.results,
    };
  },

  // Filter issue IDs to only those the user has access to
  async filterAccessibleIssues(issueIds: string[], userId: string): Promise<string[]> {
    if (issueIds.length === 0) {
      return [];
    }

    // Get projects user has access to
    const projectMembers = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = projectMembers.map((pm) => pm.projectId);

    if (projectIds.length === 0) {
      return [];
    }

    // Get issue IDs that belong to accessible projects
    const accessibleIssues = await prisma.issue.findMany({
      where: {
        id: { in: issueIds },
        projectId: { in: projectIds },
      },
      select: { id: true },
    });

    return accessibleIssues.map((i) => i.id);
  },

  // ========== Recent Items ==========

  async recordRecentItem(
    userId: string,
    entityType: SearchEntityType,
    entityId: string
  ): Promise<void> {
    // Upsert: insert or update accessed_at
    await prisma.$queryRaw`
      INSERT INTO recent_items (user_id, entity_type, entity_id, accessed_at)
      VALUES (${userId}::uuid, ${entityType}, ${entityId}::uuid, NOW())
      ON CONFLICT (user_id, entity_type, entity_id)
      DO UPDATE SET accessed_at = NOW()
    `;

    // Keep only the last 50 recent items per user
    const oldest = await prisma.recentItem.findMany({
      where: { userId },
      orderBy: { accessedAt: 'desc' },
      skip: 50,
      take: 1,
    });

    if (oldest.length > 0) {
      await prisma.recentItem.deleteMany({
        where: {
          userId,
          accessedAt: { lt: oldest[0].accessedAt },
        },
      });
    }
  },

  async getRecentItems(
    userId: string,
    entityTypes?: SearchEntityType[],
    limit: number = 10
  ): Promise<RecentItem[]> {
    const items = await prisma.recentItem.findMany({
      where: {
        userId,
        ...(entityTypes && entityTypes.length > 0 ? { entityType: { in: entityTypes } } : {}),
      },
      orderBy: { accessedAt: 'desc' },
      take: limit,
    });

    // Populate entity data for each item
    const populatedItems: RecentItem[] = [];

    for (const item of items) {
      const populated = await this.populateRecentItem(item, userId);
      if (populated) {
        populatedItems.push(populated);
      }
    }

    return populatedItems;
  },

  async populateRecentItem(item: any, userId: string): Promise<RecentItem | null> {
    switch (item.entityType) {
      case 'issue': {
        const entityData = await prisma.$queryRaw<any[]>`
          SELECT
            i.id,
            i.title,
            i.issue_number,
            s.name as status,
            p.id as project_id,
            p.key as project_key,
            s.color as status_color
          FROM issues i
          JOIN projects p ON i.project_id = p.id
          JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ${userId}::uuid
          LEFT JOIN statuses s ON i.status_id = s.id
          WHERE i.id = ${item.entityId}::uuid
          LIMIT 1
        `;

        if (entityData.length > 0) {
          const data = entityData[0];
          return {
            id: item.id,
            userId: item.userId,
            entityType: 'issue',
            entityId: item.entityId,
            accessedAt: item.accessedAt,
            title: data.title,
            subtitle: `${data.project_key}-${data.issue_number}`,
            url: `/projects/${data.project_id}/issues/${data.id}`,
            status: data.status,
            statusColor: data.status_color,
          };
        }
        break;
      }

      case 'project': {
        const entityData = await prisma.$queryRaw<any[]>`
          SELECT p.id, p.name, p.key
          FROM projects p
          JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ${userId}::uuid
          WHERE p.id = ${item.entityId}::uuid
          LIMIT 1
        `;

        if (entityData.length > 0) {
          const data = entityData[0];
          return {
            id: item.id,
            userId: item.userId,
            entityType: 'project',
            entityId: item.entityId,
            accessedAt: item.accessedAt,
            title: data.name,
            subtitle: data.key,
            url: `/projects/${data.id}`,
          };
        }
        break;
      }

      case 'user': {
        const entityData = await prisma.$queryRaw<any[]>`
          SELECT id, CONCAT(first_name, ' ', last_name) as display_name, email, avatar_url
          FROM users
          WHERE id = ${item.entityId}::uuid
          LIMIT 1
        `;

        if (entityData.length > 0) {
          const data = entityData[0];
          return {
            id: item.id,
            userId: item.userId,
            entityType: 'user',
            entityId: item.entityId,
            accessedAt: item.accessedAt,
            title: data.display_name,
            subtitle: data.email,
            url: `/users/${data.id}`,
            avatarUrl: data.avatar_url,
          };
        }
        break;
      }
    }

    return null;
  },

  async clearRecentItems(userId: string, entityType?: SearchEntityType): Promise<void> {
    await prisma.recentItem.deleteMany({
      where: {
        userId,
        ...(entityType ? { entityType } : {}),
      },
    });
  },

  // ========== Search History ==========

  async recordSearchQuery(userId: string, query: string, resultCount: number): Promise<void> {
    await prisma.searchHistory.create({
      data: {
        userId,
        query: query.substring(0, 500),
        resultCount,
      },
    });

    // Keep only the last 100 search history entries per user
    const oldest = await prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: 100,
      take: 1,
    });

    if (oldest.length > 0) {
      await prisma.searchHistory.deleteMany({
        where: {
          userId,
          createdAt: { lt: oldest[0].createdAt },
        },
      });
    }
  },

  async getSearchHistory(userId: string, limit: number = 10): Promise<SearchHistoryItem[]> {
    const history = await prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        query: true,
        resultCount: true,
        createdAt: true,
      },
    });

    return history.map((h) => ({
      id: h.id,
      userId: h.userId,
      query: h.query,
      resultCount: h.resultCount,
      searchedAt: h.createdAt.toISOString(),
    }));
  },

  async clearSearchHistory(userId: string): Promise<void> {
    await prisma.searchHistory.deleteMany({
      where: { userId },
    });
  },

  // ========== Saved Searches ==========

  async createSavedSearch(userId: string, input: CreateSavedSearchInput): Promise<SavedSearch> {
    // If setting as default, clear other defaults for this user/project
    if (input.isDefault) {
      await prisma.savedSearch.updateMany({
        where: {
          userId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId,
        name: input.name,
        description: input.description || null,
        query: input.name,
        filters: input.filters as any,
        isDefault: input.isDefault || false,
      },
    });

    return this.mapSavedSearch(savedSearch);
  },

  async getSavedSearches(userId: string, _projectId?: string): Promise<SavedSearch[]> {
    const where: any = { userId };

    const searches = await prisma.savedSearch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return searches.map((s: any) => this.mapSavedSearch(s));
  },

  async getSavedSearchById(id: string, userId: string): Promise<SavedSearch | null> {
    const search = await prisma.savedSearch.findFirst({
      where: { id, userId },
    });

    return search ? this.mapSavedSearch(search) : null;
  },

  async updateSavedSearch(
    id: string,
    userId: string,
    input: UpdateSavedSearchInput
  ): Promise<SavedSearch | null> {
    const existing = await prisma.savedSearch.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return null;
    }

    // If setting as default, clear other defaults
    if (input.isDefault) {
      await prisma.savedSearch.updateMany({
        where: {
          userId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const updateData: any = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.filters !== undefined) updateData.filters = input.filters as any;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

    const updated = await prisma.savedSearch.update({
      where: { id },
      data: updateData,
    });

    return this.mapSavedSearch(updated);
  },

  async deleteSavedSearch(id: string, userId: string): Promise<boolean> {
    const existing = await prisma.savedSearch.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return false;
    }

    await prisma.savedSearch.delete({ where: { id } });
    return true;
  },

  mapSavedSearch(row: any): SavedSearch {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters,
      isDefault: row.isDefault,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as unknown as SavedSearch;
  },
};
