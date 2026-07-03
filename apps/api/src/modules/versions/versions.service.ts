import { VersionsRepository } from './versions.repository';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { ApiError } from '../../utils/ApiError';
import { CreateVersionInput, UpdateVersionInput, VersionFilters } from './versions.types';
import { isSystemAdmin } from '../../utils/system-admin';

export class VersionsService {
  private versionsRepository: VersionsRepository;
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.versionsRepository = new VersionsRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  async createVersion(projectId: string, input: CreateVersionInput, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);

    // Check for duplicate name
    const exists = await this.versionsRepository.exists(projectId, input.name);
    if (exists) {
      throw ApiError.badRequest('A version with this name already exists in the project');
    }

    const version = await this.versionsRepository.create(projectId, input);
    return this.versionsRepository.findById(version.id);
  }

  async getVersion(versionId: string, userId: string) {
    const version = await this.versionsRepository.findById(versionId);
    if (!version) {
      throw ApiError.notFound('Version not found');
    }

    await this.checkProjectAccess(version.projectId, userId);

    return version;
  }

  async getProjectVersions(projectId: string, filters: VersionFilters, userId: string) {
    await this.checkProjectAccess(projectId, userId);

    return this.versionsRepository.findByProject(projectId, filters);
  }

  async updateVersion(versionId: string, input: UpdateVersionInput, userId: string) {
    const version = await this.versionsRepository.findById(versionId);
    if (!version) {
      throw ApiError.notFound('Version not found');
    }

    await this.checkProjectAccess(version.projectId, userId, ['admin', 'lead']);

    // Check for duplicate name if name is being updated
    if (input.name && input.name !== version.name) {
      const exists = await this.versionsRepository.exists(version.projectId, input.name, versionId);
      if (exists) {
        throw ApiError.badRequest('A version with this name already exists in the project');
      }
    }

    // Cannot update status directly - use release/archive methods
    if (input.status && input.status !== version.status) {
      throw ApiError.badRequest('Use release or archive endpoints to change version status');
    }

    await this.versionsRepository.update(versionId, input);
    return this.versionsRepository.findById(versionId);
  }

  async releaseVersion(versionId: string, userId: string) {
    const version = await this.versionsRepository.findById(versionId);
    if (!version) {
      throw ApiError.notFound('Version not found');
    }

    await this.checkProjectAccess(version.projectId, userId, ['admin', 'lead']);

    if (version.status === 'released') {
      throw ApiError.badRequest('Version is already released');
    }

    if (version.status === 'archived') {
      throw ApiError.badRequest('Cannot release an archived version');
    }

    await this.versionsRepository.release(versionId, userId);
    return this.versionsRepository.findById(versionId);
  }

  async archiveVersion(versionId: string, userId: string) {
    const version = await this.versionsRepository.findById(versionId);
    if (!version) {
      throw ApiError.notFound('Version not found');
    }

    await this.checkProjectAccess(version.projectId, userId, ['admin', 'lead']);

    if (version.status === 'archived') {
      throw ApiError.badRequest('Version is already archived');
    }

    await this.versionsRepository.archive(versionId);
    return this.versionsRepository.findById(versionId);
  }

  async unarchiveVersion(versionId: string, userId: string) {
    const version = await this.versionsRepository.findById(versionId);
    if (!version) {
      throw ApiError.notFound('Version not found');
    }

    await this.checkProjectAccess(version.projectId, userId, ['admin', 'lead']);

    if (version.status !== 'archived') {
      throw ApiError.badRequest('Version is not archived');
    }

    await this.versionsRepository.unarchive(versionId);
    return this.versionsRepository.findById(versionId);
  }

  async deleteVersion(versionId: string, userId: string) {
    const version = await this.versionsRepository.findById(versionId);
    if (!version) {
      throw ApiError.notFound('Version not found');
    }

    await this.checkProjectAccess(version.projectId, userId, ['admin', 'lead']);

    // Cannot delete released versions with issues
    if (version.status === 'released' && version.stats.totalIssues > 0) {
      throw ApiError.badRequest('Cannot delete a released version with issues. Archive it instead.');
    }

    await this.versionsRepository.delete(versionId);

    return { message: 'Version deleted successfully' };
  }

  async reorderVersions(projectId: string, orderedIds: string[], userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);

    await this.versionsRepository.reorder(projectId, orderedIds);

    return { message: 'Versions reordered successfully' };
  }

  async getVersionIssues(versionId: string, userId: string, type: 'fix' | 'affected' = 'fix', page: number = 1, limit: number = 50) {
    const version = await this.versionsRepository.findById(versionId);
    if (!version) {
      throw ApiError.notFound('Version not found');
    }

    await this.checkProjectAccess(version.projectId, userId);

    const { issues, total } = await this.versionsRepository.getVersionIssues(versionId, type, page, limit);

    return {
      issues,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
