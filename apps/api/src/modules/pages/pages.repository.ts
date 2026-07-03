import { prisma } from '../../database/prisma';
import { marked } from 'marked';
import { Page, CreatePageInput, UpdatePageInput, PageFilters, ReorderPageInput } from './pages.types';

export class PagesRepository {
  async create(projectId: string, input: CreatePageInput, userId: string): Promise<Page> {
    const slug = this.generateSlug(input.title);

    // Ensure unique slug within project
    const uniqueSlug = await this.ensureUniqueSlug(projectId, slug);

    // Get max position for sibling pages
    const maxPosition = await prisma.page.aggregate({
      where: {
        projectId,
        parentId: input.parentId || null,
        deletedAt: null,
      },
      _max: { position: true },
    });

    // Render markdown to HTML if content is provided, or use explicit HTML from rich text editor
    let contentHtml: string | undefined;
    if ((input as any).contentHtml !== undefined) {
      contentHtml = (input as any).contentHtml;
    } else if (input.content) {
      contentHtml = await marked(input.content);
    }

    const page = await prisma.page.create({
      data: {
        projectId,
        title: input.title,
        slug: uniqueSlug,
        content: input.content,
        contentHtml,
        parentId: input.parentId || null,
        position: (maxPosition._max.position ?? 0) + 1,
        createdBy: userId,
        isPublished: input.isPublished ?? true,
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    return this.mapToPage(page);
  }

  async findById(id: string): Promise<Page | null> {
    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        children: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          include: {
            creator: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!page || page.deletedAt) return null;

    return this.mapToPage(page);
  }

  async findByProject(projectId: string, filters: PageFilters = {}): Promise<Page[]> {
    const where: any = {
      projectId,
      deletedAt: null,
      parentId: null, // Only top-level pages by default
    };

    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
      delete where.parentId; // Search across all levels
    }

    if (filters.parentId !== undefined) {
      where.parentId = filters.parentId;
    }

    if (filters.isPublished !== undefined) {
      where.isPublished = filters.isPublished;
    }

    const pages = await prisma.page.findMany({
      where,
      orderBy: { position: 'asc' },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        children: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          include: {
            creator: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
            children: {
              where: { deletedAt: null },
              orderBy: { position: 'asc' },
              include: {
                creator: {
                  select: { id: true, firstName: true, lastName: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
    });

    return pages.map((p) => this.mapToPage(p));
  }

  async update(id: string, input: UpdatePageInput): Promise<Page> {
    const updateData: Record<string, any> = {};

    if (input.title !== undefined) {
      updateData.title = input.title;
      updateData.slug = this.generateSlug(input.title);
      // Ensure unique slug
      const page = await prisma.page.findUnique({ where: { id } });
      if (page) {
        updateData.slug = await this.ensureUniqueSlug(page.projectId, updateData.slug, id);
      }
    }

    if (input.content !== undefined) {
      updateData.content = input.content;
      // If explicit HTML is provided (from rich text editor), use it directly
      updateData.contentHtml = (input as any).contentHtml !== undefined
        ? (input as any).contentHtml
        : await marked(input.content || '');
    } else if ((input as any).contentHtml !== undefined) {
      updateData.contentHtml = (input as any).contentHtml;
    }

    if (input.isPublished !== undefined) {
      updateData.isPublished = input.isPublished;
    }

    const page = await prisma.page.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        children: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
      },
    });

    return this.mapToPage(page);
  }

  async softDelete(id: string): Promise<void> {
    await prisma.page.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async reorder(id: string, input: ReorderPageInput): Promise<Page> {
    const page = await prisma.page.update({
      where: { id },
      data: {
        parentId: input.parentId !== undefined ? input.parentId : undefined,
        position: input.position,
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    return this.mapToPage(page);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async ensureUniqueSlug(projectId: string, slug: string, excludeId?: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const where: any = { projectId_slug: { projectId, slug: uniqueSlug } };
      const existing = await prisma.page.findUnique({ where });

      if (!existing || (excludeId && existing.id === excludeId)) {
        return uniqueSlug;
      }

      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
  }

  private mapToPage(row: any): Page {
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      slug: row.slug,
      content: row.content,
      contentHtml: row.contentHtml,
      parentId: row.parentId,
      position: row.position,
      createdBy: row.createdBy,
      isPublished: row.isPublished,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      children: row.children?.map((c: any) => this.mapToPage(c)),
      creator: row.creator
        ? {
            id: row.creator.id,
            firstName: row.creator.firstName,
            lastName: row.creator.lastName,
            avatarUrl: row.creator.avatarUrl,
          }
        : undefined,
    };
  }
}
