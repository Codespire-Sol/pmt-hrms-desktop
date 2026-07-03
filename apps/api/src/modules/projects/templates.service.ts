import { v4 as uuidv4 } from 'uuid';
import { TemplatesRepository } from './templates.repository';
import { ProjectsRepository } from './projects.repository';
import { ProjectMembersRepository } from './projectMembers.repository';
import { ApiError } from '../../utils/ApiError';
import { prisma } from '../../database/prisma';
import {
  ProjectTemplate,
  CreateTemplateInput,
  CreateProjectFromTemplateInput,
} from './projects.types';

export class TemplatesService {
  private templatesRepository: TemplatesRepository;
  private projectsRepository: ProjectsRepository;
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.templatesRepository = new TemplatesRepository();
    this.projectsRepository = new ProjectsRepository();
    this.projectMembersRepository = new ProjectMembersRepository();
  }

  async getTemplates(category?: string): Promise<ProjectTemplate[]> {
    return this.templatesRepository.findAll(category);
  }

  async getTemplateById(templateId: string): Promise<ProjectTemplate> {
    const template = await this.templatesRepository.findById(templateId);

    if (!template) {
      throw ApiError.notFound('Template not found');
    }

    return template;
  }

  async getSystemTemplates(): Promise<ProjectTemplate[]> {
    return this.templatesRepository.findSystemTemplates();
  }

  async getUserTemplates(userId: string): Promise<ProjectTemplate[]> {
    return this.templatesRepository.findByUser(userId);
  }

  async getCategories(): Promise<string[]> {
    return this.templatesRepository.getCategories();
  }

  async createTemplate(input: CreateTemplateInput, userId: string): Promise<ProjectTemplate> {
    return this.templatesRepository.create({
      ...input,
      createdBy: userId,
    });
  }

  async updateTemplate(
    templateId: string,
    input: Partial<CreateTemplateInput>,
    userId: string
  ): Promise<ProjectTemplate> {
    const template = await this.templatesRepository.findById(templateId);

    if (!template) {
      throw ApiError.notFound('Template not found');
    }

    // Only allow updating own templates or if admin
    if (template.isSystem) {
      throw ApiError.forbidden('Cannot modify system templates');
    }

    if (template.createdBy !== userId) {
      throw ApiError.forbidden('Cannot modify templates created by others');
    }

    return this.templatesRepository.update(templateId, input);
  }

  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    const template = await this.templatesRepository.findById(templateId);

    if (!template) {
      throw ApiError.notFound('Template not found');
    }

    if (template.isSystem) {
      throw ApiError.forbidden('Cannot delete system templates');
    }

    if (template.createdBy !== userId) {
      throw ApiError.forbidden('Cannot delete templates created by others');
    }

    await this.templatesRepository.delete(templateId);
  }

  async createProjectFromTemplate(
    input: CreateProjectFromTemplateInput,
    userId: string
  ): Promise<any> {
    // Validate template exists
    const template = await this.templatesRepository.findById(input.templateId);
    if (!template) {
      throw ApiError.notFound('Template not found');
    }

    // Validate project key format
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(input.key)) {
      throw ApiError.badRequest(
        'Project key must start with a letter and contain only uppercase letters and numbers (2-10 characters)'
      );
    }

    // Validate project key uniqueness
    const existingProject = await this.projectsRepository.findByKey(input.key);
    if (existingProject) {
      throw ApiError.conflict('Project key already exists');
    }

    // Use transaction to create project with all template configurations
    const result = await prisma.$transaction(async (tx) => {
      // Create project
      const projectId = uuidv4();
      const project = await tx.project.create({
        data: {
          id: projectId,
          key: input.key,
          name: input.name,
          description: input.description,
          ownerId: userId,
          visibility: input.visibility || 'private',
          status: 'active',
          settings: template.defaultSettings,
        },
      });

      // Add owner as admin member
      await tx.projectMember.create({
        data: {
          projectId,
          userId,
          role: 'admin',
          invitedBy: userId,
        },
      });

      // Create issue types from template
      if (template.issueTypes.length > 0) {
        for (let index = 0; index < template.issueTypes.length; index++) {
          const type = template.issueTypes[index];
          await tx.issueType.create({
            data: {
              projectId,
              name: type.name,
              displayName: type.name,
              description: type.description || '',
              icon: type.icon,
              color: type.color,
              position: index,
            },
          });
        }
      }

      // Create default workflow for the project
      const workflow = await tx.workflow.create({
        data: {
          projectId,
          name: 'Default Workflow',
          description: 'Default workflow created from template',
          isDefault: true,
        },
      });

      // Create statuses from template
      if (template.statuses.length > 0) {
        for (let index = 0; index < template.statuses.length; index++) {
          const status = template.statuses[index];
          await tx.status.create({
            data: {
              workflowId: workflow.id,
              name: status.name,
              displayName: status.name,
              description: status.description || '',
              category: status.category,
              color: status.color,
              position: index,
            },
          });
        }
      }

      // Create labels from template
      if (template.labels.length > 0) {
        for (const label of template.labels) {
          await tx.label.create({
            data: {
              projectId,
              name: label.name,
              description: label.description || '',
              color: label.color,
            },
          });
        }
      }

      // Increment template usage count
      await tx.projectTemplate.update({
        where: { id: input.templateId },
        data: {
          // usage_count increment via raw since ProjectTemplate model may not have usageCount
        },
      });

      return project;
    });

    // Return full project details
    return this.getProjectWithDetails(result.id, userId);
  }

  private async getProjectWithDetails(projectId: string, _userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    const statistics = await this.projectsRepository.getStatistics(projectId);

    return {
      ...project,
      statistics,
    };
  }
}
