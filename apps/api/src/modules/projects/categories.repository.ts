import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';

export interface ProjectCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon: string;
  isActive: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  position?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  position?: number;
}

export class CategoriesRepository {
  async findAll(includeInactive = false): Promise<ProjectCategory[]> {
    const where: Prisma.ProjectCategoryWhereInput = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    const rows = await prisma.projectCategory.findMany({
      where,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    return rows as unknown as ProjectCategory[];
  }

  async findById(id: string): Promise<ProjectCategory | null> {
    const row = await prisma.projectCategory.findUnique({
      where: { id },
    });
    return (row as unknown as ProjectCategory) || null;
  }

  async findBySlug(slug: string): Promise<ProjectCategory | null> {
    const row = await prisma.projectCategory.findUnique({
      where: { slug },
    });
    return (row as unknown as ProjectCategory) || null;
  }

  async create(input: CreateCategoryInput): Promise<ProjectCategory> {
    // Generate slug from name
    const slug = this.generateSlug(input.name);

    // Get max position if not provided
    let position = input.position;
    if (position === undefined) {
      const maxPos = await prisma.projectCategory.aggregate({
        _max: { position: true },
      });
      position = (maxPos._max.position || 0) + 1;
    }

    const row = await prisma.projectCategory.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        color: input.color || '#6B7280',
        icon: input.icon || 'folder',
        position,
      },
    });

    return row as unknown as ProjectCategory;
  }

  async update(id: string, input: UpdateCategoryInput): Promise<ProjectCategory> {
    const updateData: Prisma.ProjectCategoryUpdateInput = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
      updateData.slug = this.generateSlug(input.name);
    }
    if (input.description !== undefined) updateData.description = input.description;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.position !== undefined) updateData.position = input.position;

    const row = await prisma.projectCategory.update({
      where: { id },
      data: updateData,
    });

    return row as unknown as ProjectCategory;
  }

  async delete(id: string): Promise<boolean> {
    // Check if category is in use
    const projectCount = await prisma.project.count({
      where: { categoryId: id },
    });

    if (projectCount > 0) {
      throw new Error('Cannot delete category that is in use by projects');
    }

    await prisma.projectCategory.delete({
      where: { id },
    });
    return true;
  }

  async reorder(categoryIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < categoryIds.length; i++) {
        await tx.projectCategory.update({
          where: { id: categoryIds[i] },
          data: { position: i, updatedAt: new Date() },
        });
      }
    });
  }

  async getProjectCountByCategory(categoryId: string): Promise<number> {
    return prisma.project.count({
      where: {
        categoryId,
        deletedAt: null,
      },
    });
  }

  async getCategoriesWithProjectCount(): Promise<(ProjectCategory & { projectCount: number })[]> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        c.*,
        COALESCE(COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL), 0) as project_count
      FROM project_categories AS c
      LEFT JOIN projects AS p ON c.id = p.category_id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.position, c.name
    `;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      color: row.color,
      icon: row.icon,
      isActive: row.is_active,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      projectCount: Number(row.project_count),
    }));
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/(?:^-|-$)/g, '');
  }
}

export const categoriesRepository = new CategoriesRepository();
