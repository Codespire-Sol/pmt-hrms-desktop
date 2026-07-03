import { SecurityLevelsRepository } from './security-levels.repository';
import {
  SecurityLevelWithRoles,
  CreateSecurityLevelInput,
  UpdateSecurityLevelInput,
} from './security-levels.types';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { ApiError } from '../../utils/ApiError';
import { isSystemAdmin } from '../../utils/system-admin';

export class SecurityLevelsService {
  private securityLevelsRepository: SecurityLevelsRepository;
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.securityLevelsRepository = new SecurityLevelsRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  private async checkProjectAccess(
    projectId: string,
    userId: string,
    requiredRoles?: string[]
  ): Promise<void> {
    if (await isSystemAdmin(userId)) {
      return;
    }

    const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);

    if (!membership) {
      throw ApiError.forbidden('You do not have access to this project');
    }

    if (requiredRoles && !requiredRoles.includes(membership.role)) {
      throw ApiError.forbidden('You do not have permission to manage security levels');
    }
  }

  async getProjectSecurityLevels(
    projectId: string,
    userId: string
  ): Promise<SecurityLevelWithRoles[]> {
    await this.checkProjectAccess(projectId, userId);
    return this.securityLevelsRepository.findByProject(projectId);
  }

  async getSecurityLevel(
    levelId: string,
    userId: string
  ): Promise<SecurityLevelWithRoles> {
    const level = await this.securityLevelsRepository.findById(levelId);

    if (!level) {
      throw ApiError.notFound('Security level not found');
    }

    await this.checkProjectAccess(level.projectId, userId);

    return level;
  }

  async createSecurityLevel(
    projectId: string,
    input: CreateSecurityLevelInput,
    userId: string
  ): Promise<SecurityLevelWithRoles> {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);

    // Check for duplicate name
    const exists = await this.securityLevelsRepository.exists(projectId, input.name);
    if (exists) {
      throw ApiError.badRequest('A security level with this name already exists');
    }

    const level = await this.securityLevelsRepository.create(projectId, input);
    return this.securityLevelsRepository.findById(level.id) as Promise<SecurityLevelWithRoles>;
  }

  async updateSecurityLevel(
    levelId: string,
    input: UpdateSecurityLevelInput,
    userId: string
  ): Promise<SecurityLevelWithRoles> {
    const existing = await this.securityLevelsRepository.findById(levelId);

    if (!existing) {
      throw ApiError.notFound('Security level not found');
    }

    await this.checkProjectAccess(existing.projectId, userId, ['admin', 'lead']);

    // Check for duplicate name if changing
    if (input.name && input.name !== existing.name) {
      const exists = await this.securityLevelsRepository.exists(existing.projectId, input.name, levelId);
      if (exists) {
        throw ApiError.badRequest('A security level with this name already exists');
      }
    }

    await this.securityLevelsRepository.update(levelId, input);
    return this.securityLevelsRepository.findById(levelId) as Promise<SecurityLevelWithRoles>;
  }

  async deleteSecurityLevel(levelId: string, userId: string): Promise<void> {
    const level = await this.securityLevelsRepository.findById(levelId);

    if (!level) {
      throw ApiError.notFound('Security level not found');
    }

    await this.checkProjectAccess(level.projectId, userId, ['admin', 'lead']);

    await this.securityLevelsRepository.delete(levelId);
  }

  async reorderSecurityLevels(
    projectId: string,
    orderedIds: string[],
    userId: string
  ): Promise<void> {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);
    await this.securityLevelsRepository.reorder(projectId, orderedIds);
  }

  async canUserViewIssueWithSecurityLevel(
    securityLevelId: string | null,
    userId: string,
    projectId: string
  ): Promise<boolean> {
    // If no security level, anyone with project access can view
    if (!securityLevelId) return true;

    return this.securityLevelsRepository.canUserViewSecurityLevel(securityLevelId, userId, projectId);
  }

  async getViewableSecurityLevelIds(
    userId: string,
    projectId: string
  ): Promise<string[] | null> {
    // Returns null if user can view all (including issues with no security level)
    // Returns array of IDs if user has restricted access
    const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);

    if (!membership) {
      throw ApiError.forbidden('You do not have access to this project');
    }

    return this.securityLevelsRepository.getViewableSecurityLevelIds(userId, projectId);
  }
}

export const securityLevelsService = new SecurityLevelsService();
