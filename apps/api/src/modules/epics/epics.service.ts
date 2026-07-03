import { EpicsRepository } from './epics.repository';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { ApiError } from '../../utils/ApiError';
import { CreateEpicInput, UpdateEpicInput, EpicFilters } from './epics.types';
import { isSystemAdmin } from '../../utils/system-admin';

export class EpicsService {
  private epicsRepository: EpicsRepository;
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.epicsRepository = new EpicsRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  async createEpic(projectId: string, input: CreateEpicInput, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);

    // Check for duplicate name
    const exists = await this.epicsRepository.exists(projectId, input.name);
    if (exists) {
      throw ApiError.badRequest('An epic with this name already exists in the project');
    }

    const epic = await this.epicsRepository.create(projectId, input, userId);
    return this.epicsRepository.findById(epic.id);
  }

  async getEpic(epicId: string, userId: string) {
    const epic = await this.epicsRepository.findById(epicId);
    if (!epic) {
      throw ApiError.notFound('Epic not found');
    }

    await this.checkProjectAccess(epic.projectId, userId);

    return epic;
  }

  async getProjectEpics(projectId: string, filters: EpicFilters, userId: string) {
    await this.checkProjectAccess(projectId, userId);

    return this.epicsRepository.findByProject(projectId, filters);
  }

  async updateEpic(epicId: string, input: UpdateEpicInput, userId: string) {
    const epic = await this.epicsRepository.findById(epicId);
    if (!epic) {
      throw ApiError.notFound('Epic not found');
    }

    await this.checkProjectAccess(epic.projectId, userId, ['admin', 'lead']);

    // Check for duplicate name if name is being updated
    if (input.name && input.name !== epic.name) {
      const exists = await this.epicsRepository.exists(epic.projectId, input.name, epicId);
      if (exists) {
        throw ApiError.badRequest('An epic with this name already exists in the project');
      }
    }

    await this.epicsRepository.update(epicId, input);
    return this.epicsRepository.findById(epicId);
  }

  async deleteEpic(epicId: string, userId: string) {
    const epic = await this.epicsRepository.findById(epicId);
    if (!epic) {
      throw ApiError.notFound('Epic not found');
    }

    await this.checkProjectAccess(epic.projectId, userId, ['admin', 'lead']);

    await this.epicsRepository.delete(epicId);

    return { message: 'Epic deleted successfully' };
  }

  async assignIssues(epicId: string, issueIds: string[], userId: string) {
    const epic = await this.epicsRepository.findById(epicId);
    if (!epic) {
      throw ApiError.notFound('Epic not found');
    }

    await this.checkProjectAccess(epic.projectId, userId, ['admin', 'lead', 'member']);

    if (!issueIds || issueIds.length === 0) {
      throw ApiError.badRequest('At least one issue ID is required');
    }

    await this.epicsRepository.assignIssues(epicId, issueIds);

    return { message: `${issueIds.length} issue(s) assigned to epic` };
  }

  async removeIssues(epicId: string, issueIds: string[], userId: string) {
    const epic = await this.epicsRepository.findById(epicId);
    if (!epic) {
      throw ApiError.notFound('Epic not found');
    }

    await this.checkProjectAccess(epic.projectId, userId, ['admin', 'lead', 'member']);

    if (!issueIds || issueIds.length === 0) {
      throw ApiError.badRequest('At least one issue ID is required');
    }

    await this.epicsRepository.removeIssues(epicId, issueIds);

    return { message: `${issueIds.length} issue(s) removed from epic` };
  }

  async getEpicIssues(epicId: string, userId: string, page: number = 1, limit: number = 50) {
    const epic = await this.epicsRepository.findById(epicId);
    if (!epic) {
      throw ApiError.notFound('Epic not found');
    }

    await this.checkProjectAccess(epic.projectId, userId);

    const { issues, total } = await this.epicsRepository.getEpicIssues(epicId, page, limit);

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
