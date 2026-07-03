import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import { Project, CreateProjectInput, UpdateProjectInput, ProjectFilters, ProjectStatistics } from './projects.types';
import { normalizeMediaUrl } from '../../utils/media-url';

export class ProjectsRepository {
  async create(input: CreateProjectInput & { id: string; ownerId: string; status: string }): Promise<Project> {
    const project = await prisma.project.create({
      data: {
        id: input.id,
        key: input.key,
        name: input.name,
        description: input.description,
        ownerId: input.ownerId,
        leadId: input.leadId,
        categoryId: input.categoryId,
        category: input.category,
        status: input.status as any,
        visibility: input.visibility as any,
        startDate: input.startDate,
        targetEndDate: input.targetEndDate,
      },
    });
    return project as unknown as Project;
  }

  async findById(id: string): Promise<Project | null> {
    const project = await prisma.project.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        ownerId: true,
        leadId: true,
        categoryId: true,
        category: true,
        status: true,
        visibility: true,
        startDate: true,
        targetEndDate: true,
        actualEndDate: true,
        defaultAssigneeId: true,
        settings: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        lead: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        projectCategory: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            color: true,
            icon: true,
          },
        },
      },
    });
    if (!project) {
      return null;
    }

    const structuredType = project.projectCategory
      ? {
          id: project.projectCategory.id,
          name: project.projectCategory.name,
          slug: project.projectCategory.slug,
          description: project.projectCategory.description,
          color: project.projectCategory.color,
          icon: project.projectCategory.icon,
        }
      : null;

    return {
      ...project,
      owner: project.owner
        ? {
            id: project.owner.id,
            email: project.owner.email,
            displayName: `${project.owner.firstName} ${project.owner.lastName}`,
            avatarUrl: normalizeMediaUrl(project.owner.avatarUrl),
          }
        : null,
      lead: project.lead
        ? {
            id: project.lead.id,
            email: project.lead.email,
            displayName: `${project.lead.firstName} ${project.lead.lastName}`,
            avatarUrl: normalizeMediaUrl(project.lead.avatarUrl),
          }
        : null,
      category: project.projectCategory?.name || project.category || null,
      projectType: structuredType,
      type: structuredType,
    } as unknown as Project;
  }

  async findByKey(key: string): Promise<Project | null> {
    const project = await prisma.project.findFirst({
      where: {
        key,
        deletedAt: null,
      },
    });
    return (project as unknown as Project) || null;
  }

  async findByUser(userId: string, filters: ProjectFilters, isAdmin: boolean = false): Promise<any[]> {
    // Normalize empty strings to undefined (no default — returns all statuses)
    const status = filters.status && filters.status !== '' ? filters.status : undefined;
    const search = filters.search && filters.search !== '' ? filters.search : undefined;
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Use raw query for the complex aggregation with FILTER(WHERE)
    // For admin users, skip the membership filter to show all projects
    const projects = await prisma.$queryRaw<any[]>`
      SELECT
        projects.*,
        COUNT(DISTINCT pm2.id) as member_count,
        COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL) as issue_count,
        COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL AND s.category = 'todo') as open_issues,
        COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL AND s.category = 'in_progress') as in_progress_issues,
        COUNT(DISTINCT i.id) FILTER (WHERE i.deleted_at IS NULL AND s.category = 'done') as completed_issues
      FROM projects
      LEFT JOIN project_members AS pm2 ON projects.id = pm2.project_id
      LEFT JOIN issues AS i ON projects.id = i.project_id
      LEFT JOIN statuses AS s ON i.status_id = s.id
      WHERE projects.deleted_at IS NULL
        ${isAdmin
          ? Prisma.empty
          : Prisma.sql`AND (
              projects.owner_id = ${userId}::uuid
              OR projects.lead_id = ${userId}::uuid
              OR EXISTS (
                SELECT 1
                FROM project_members AS pm
                WHERE pm.project_id = projects.id
                  AND pm.user_id = ${userId}::uuid
              )
            )`}
        ${status ? Prisma.sql`AND projects.status = ${status}::"project_status"` : Prisma.empty}
        ${search ? Prisma.sql`AND (
          projects.name ILIKE ${'%' + search + '%'}
          OR projects.key ILIKE ${'%' + search + '%'}
          OR projects.description ILIKE ${'%' + search + '%'}
        )` : Prisma.empty}
        ${filters.memberId ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM project_members AS pm_filter
          WHERE pm_filter.project_id = projects.id
            AND pm_filter.user_id = ${filters.memberId}::uuid
        )` : Prisma.empty}
      GROUP BY projects.id
      ORDER BY projects.updated_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Get owner and lead info using Prisma includes in a single query
    const projectIds = projects.map((p) => p.id);
    const projectsWithRelations = projectIds.length > 0
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: {
            id: true,
            owner: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
            lead: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        })
      : [];

    const relationsMap = new Map(projectsWithRelations.map((p) => [p.id, p]));

    return projects.map((project) => {
      const relations = relationsMap.get(project.id);
      const owner = relations?.owner;
      const lead = relations?.lead;
      const memberCount = Number(project.member_count);
      const issueCount = Number(project.issue_count);
      const openIssues = Number(project.open_issues);
      const inProgressIssues = Number(project.in_progress_issues);
      const completedIssues = Number(project.completed_issues);

      return {
        ...project,
        member_count: memberCount,
        issue_count: issueCount,
        open_issues: openIssues,
        in_progress_issues: inProgressIssues,
        completed_issues: completedIssues,
        statistics: {
          totalIssues: issueCount,
          openIssues,
          inProgressIssues,
          completedIssues,
        },
        owner: owner
          ? {
              id: owner.id,
              email: owner.email,
              displayName: `${owner.firstName} ${owner.lastName}`,
              avatarUrl: normalizeMediaUrl(owner.avatarUrl),
            }
          : null,
        lead: lead
          ? {
              id: lead.id,
              displayName: `${lead.firstName} ${lead.lastName}`,
              avatarUrl: normalizeMediaUrl(lead.avatarUrl),
            }
          : null,
      };
    });
  }

  async countByUser(userId: string, filters: ProjectFilters, isAdmin: boolean = false): Promise<number> {
    // Normalize empty strings to undefined
    const status = filters.status && filters.status !== '' ? filters.status : undefined;
    const search = filters.search && filters.search !== '' ? filters.search : undefined;

    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
    };

    const andConditions: Prisma.ProjectWhereInput[] = [];

    // For admin users, skip the access filter to show all projects
    if (!isAdmin) {
      andConditions.push({
        OR: [
          { ownerId: userId },
          { leadId: userId },
          {
            members: {
              some: {
                userId,
              },
            },
          },
        ],
      });
    }

    if (status) {
      where.status = status as any;
    }

    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { key: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.memberId) {
      andConditions.push({
        members: {
          some: {
            userId: filters.memberId,
          },
        },
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return prisma.project.count({ where });
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...input,
        updatedAt: new Date(),
      } as any,
    });
    return project as unknown as Project;
  }

  async softDelete(id: string): Promise<void> {
    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async hardDelete(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }

  async getUniqueMemberCount(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM project_members
      WHERE project_id = ANY(${projectIds}::uuid[])
    `;
    return Number(result[0]?.count || 0);
  }

  async getStatistics(projectId: string): Promise<ProjectStatistics> {
    const issueStats = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*) as total_issues,
        COUNT(*) FILTER (WHERE s.category = 'todo') as open_issues,
        COUNT(*) FILTER (WHERE s.category = 'in_progress') as in_progress_issues,
        COUNT(*) FILTER (WHERE s.category = 'done') as completed_issues
      FROM issues AS i
      LEFT JOIN statuses AS s ON i.status_id = s.id
      WHERE i.project_id = ${projectId}::uuid
        AND i.deleted_at IS NULL
    `;

    const i = issueStats[0];

    return {
      totalIssues: Number(i?.total_issues || 0),
      openIssues: Number(i?.open_issues || 0),
      inProgressIssues: Number(i?.in_progress_issues || 0),
      completedIssues: Number(i?.completed_issues || 0),
    };
  }

}
