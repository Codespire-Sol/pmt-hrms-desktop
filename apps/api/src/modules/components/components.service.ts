import { ComponentsRepository } from './components.repository';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { ApiError } from '../../utils/ApiError';
import { CreateComponentInput, UpdateComponentInput, ComponentFilters } from './components.types';
import { isSystemAdmin } from '../../utils/system-admin';

export class ComponentsService {
  private componentsRepository: ComponentsRepository;
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.componentsRepository = new ComponentsRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  async createComponent(projectId: string, input: CreateComponentInput, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);

    // Check for duplicate name
    const exists = await this.componentsRepository.exists(projectId, input.name);
    if (exists) {
      throw ApiError.badRequest('A component with this name already exists in the project');
    }

    // Validate lead and default assignee are project members
    if (input.leadId) {
      await this.validateProjectMember(projectId, input.leadId);
    }
    if (input.defaultAssigneeId) {
      await this.validateProjectMember(projectId, input.defaultAssigneeId);
    }

    const component = await this.componentsRepository.create(projectId, input);
    return this.componentsRepository.findById(component.id);
  }

  async getComponent(componentId: string, userId: string) {
    const component = await this.componentsRepository.findById(componentId);
    if (!component) {
      throw ApiError.notFound('Component not found');
    }

    await this.checkProjectAccess(component.projectId, userId);

    return component;
  }

  async getProjectComponents(projectId: string, filters: ComponentFilters, userId: string) {
    await this.checkProjectAccess(projectId, userId);

    return this.componentsRepository.findByProject(projectId, filters);
  }

  async updateComponent(componentId: string, input: UpdateComponentInput, userId: string) {
    const component = await this.componentsRepository.findById(componentId);
    if (!component) {
      throw ApiError.notFound('Component not found');
    }

    await this.checkProjectAccess(component.projectId, userId, ['admin', 'lead']);

    // Check for duplicate name if name is being updated
    if (input.name && input.name !== component.name) {
      const exists = await this.componentsRepository.exists(component.projectId, input.name, componentId);
      if (exists) {
        throw ApiError.badRequest('A component with this name already exists in the project');
      }
    }

    // Validate lead and default assignee are project members
    if (input.leadId) {
      await this.validateProjectMember(component.projectId, input.leadId);
    }
    if (input.defaultAssigneeId) {
      await this.validateProjectMember(component.projectId, input.defaultAssigneeId);
    }

    await this.componentsRepository.update(componentId, input);
    return this.componentsRepository.findById(componentId);
  }

  async deleteComponent(componentId: string, userId: string) {
    const component = await this.componentsRepository.findById(componentId);
    if (!component) {
      throw ApiError.notFound('Component not found');
    }

    await this.checkProjectAccess(component.projectId, userId, ['admin', 'lead']);

    await this.componentsRepository.delete(componentId);

    return { message: 'Component deleted successfully' };
  }

  // Issue-component methods
  async addIssueToComponent(issueId: string, componentId: string, userId: string) {
    const component = await this.componentsRepository.findById(componentId);
    if (!component) {
      throw ApiError.notFound('Component not found');
    }

    await this.checkProjectAccess(component.projectId, userId);

    await this.componentsRepository.addIssueToComponent(issueId, componentId);

    return { message: 'Issue added to component' };
  }

  async removeIssueFromComponent(issueId: string, componentId: string, userId: string) {
    const component = await this.componentsRepository.findById(componentId);
    if (!component) {
      throw ApiError.notFound('Component not found');
    }

    await this.checkProjectAccess(component.projectId, userId);

    await this.componentsRepository.removeIssueFromComponent(issueId, componentId);

    return { message: 'Issue removed from component' };
  }

  async getIssueComponents(issueId: string, _userId: string) {
    // Note: Access check should be done by the caller using issue's project
    return this.componentsRepository.getIssueComponents(issueId);
  }

  async setIssueComponents(issueId: string, componentIds: string[], _userId: string) {
    // Validate all components exist and belong to the same project
    for (const componentId of componentIds) {
      const component = await this.componentsRepository.findById(componentId);
      if (!component) {
        throw ApiError.notFound(`Component ${componentId} not found`);
      }
    }

    await this.componentsRepository.setIssueComponents(issueId, componentIds);

    return this.componentsRepository.getIssueComponents(issueId);
  }

  async getComponentIssues(componentId: string, userId: string, page: number = 1, limit: number = 50) {
    const component = await this.componentsRepository.findById(componentId);
    if (!component) {
      throw ApiError.notFound('Component not found');
    }

    await this.checkProjectAccess(component.projectId, userId);

    const { issues, total } = await this.componentsRepository.getComponentIssues(componentId, page, limit);

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

  private async validateProjectMember(projectId: string, userId: string) {
    const membership = await this.projectMembersRepository.findByProjectAndUser(projectId, userId);
    if (!membership) {
      throw ApiError.badRequest('User is not a member of this project');
    }
  }
}
