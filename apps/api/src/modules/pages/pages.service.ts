import { PagesRepository } from './pages.repository';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { ApiError } from '../../utils/ApiError';
import { CreatePageInput, UpdatePageInput, PageFilters, ReorderPageInput } from './pages.types';
import { isSystemAdmin } from '../../utils/system-admin';

export class PagesService {
  private pagesRepository: PagesRepository;
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.pagesRepository = new PagesRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  async createPage(projectId: string, input: CreatePageInput, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead', 'member']);

    const page = await this.pagesRepository.create(projectId, input, userId);
    return this.pagesRepository.findById(page.id);
  }

  async getPage(pageId: string, userId: string) {
    const page = await this.pagesRepository.findById(pageId);
    if (!page) {
      throw ApiError.notFound('Page not found');
    }

    await this.checkProjectAccess(page.projectId, userId);

    return page;
  }

  async getProjectPages(projectId: string, filters: PageFilters, userId: string) {
    await this.checkProjectAccess(projectId, userId);

    return this.pagesRepository.findByProject(projectId, filters);
  }

  async updatePage(pageId: string, input: UpdatePageInput, userId: string) {
    const page = await this.pagesRepository.findById(pageId);
    if (!page) {
      throw ApiError.notFound('Page not found');
    }

    await this.checkProjectAccess(page.projectId, userId, ['admin', 'lead', 'member']);

    await this.pagesRepository.update(pageId, input);
    return this.pagesRepository.findById(pageId);
  }

  async deletePage(pageId: string, userId: string) {
    const page = await this.pagesRepository.findById(pageId);
    if (!page) {
      throw ApiError.notFound('Page not found');
    }

    await this.checkProjectAccess(page.projectId, userId, ['admin', 'lead']);

    await this.pagesRepository.softDelete(pageId);

    return { message: 'Page deleted successfully' };
  }

  async reorderPage(pageId: string, input: ReorderPageInput, userId: string) {
    const page = await this.pagesRepository.findById(pageId);
    if (!page) {
      throw ApiError.notFound('Page not found');
    }

    await this.checkProjectAccess(page.projectId, userId, ['admin', 'lead', 'member']);

    await this.pagesRepository.reorder(pageId, input);
    return this.pagesRepository.findById(pageId);
  }

  private async checkProjectAccess(projectId: string, userId: string, requiredRoles?: string[]) {
    if (await isSystemAdmin(userId)) {
      return;
    }

    const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);

    if (!membership) {
      throw ApiError.forbidden('Access denied');
    }

    if (requiredRoles && !requiredRoles.includes(membership.role)) {
      throw ApiError.forbidden('Insufficient permissions');
    }
  }
}
