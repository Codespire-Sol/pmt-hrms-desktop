import { CategoriesRepository, CreateCategoryInput, UpdateCategoryInput, ProjectCategory } from './categories.repository';
import { ApiError } from '../../utils/ApiError';

export class CategoriesService {
  private repository: CategoriesRepository;

  constructor() {
    this.repository = new CategoriesRepository();
  }

  async getAll(includeInactive = false): Promise<ProjectCategory[]> {
    return this.repository.findAll(includeInactive);
  }

  async getAllWithProjectCount(): Promise<(ProjectCategory & { projectCount: number })[]> {
    return this.repository.getCategoriesWithProjectCount();
  }

  async getById(id: string): Promise<ProjectCategory> {
    const category = await this.repository.findById(id);
    if (!category) {
      throw ApiError.notFound('Category not found');
    }
    return category;
  }

  async getBySlug(slug: string): Promise<ProjectCategory> {
    const category = await this.repository.findBySlug(slug);
    if (!category) {
      throw ApiError.notFound('Category not found');
    }
    return category;
  }

  async create(input: CreateCategoryInput): Promise<ProjectCategory> {
    // Check for duplicate name
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existing = await this.repository.findBySlug(slug);
    if (existing) {
      throw ApiError.conflict('A category with this name already exists', 'CATEGORY_EXISTS');
    }

    return this.repository.create(input);
  }

  async update(id: string, input: UpdateCategoryInput): Promise<ProjectCategory> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw ApiError.notFound('Category not found');
    }

    // Check for duplicate name if name is being changed
    if (input.name && input.name !== existing.name) {
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const duplicate = await this.repository.findBySlug(slug);
      if (duplicate && duplicate.id !== id) {
        throw ApiError.conflict('A category with this name already exists', 'CATEGORY_EXISTS');
      }
    }

    return this.repository.update(id, input);
  }

  async delete(id: string): Promise<void> {
    const category = await this.repository.findById(id);
    if (!category) {
      throw ApiError.notFound('Category not found');
    }

    const projectCount = await this.repository.getProjectCountByCategory(id);
    if (projectCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete category. ${projectCount} project(s) are using this category.`,
        'CATEGORY_IN_USE'
      );
    }

    await this.repository.delete(id);
  }

  async reorder(categoryIds: string[]): Promise<void> {
    // Validate all IDs exist
    for (const id of categoryIds) {
      const category = await this.repository.findById(id);
      if (!category) {
        throw ApiError.badRequest(`Category not found: ${id}`);
      }
    }

    await this.repository.reorder(categoryIds);
  }

  async toggleActive(id: string, isActive: boolean): Promise<ProjectCategory> {
    const category = await this.repository.findById(id);
    if (!category) {
      throw ApiError.notFound('Category not found');
    }

    return this.repository.update(id, { isActive });
  }
}

export const categoriesService = new CategoriesService();
