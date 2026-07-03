import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { isSystemAdmin } from '../../utils/system-admin';

export class WorkflowSchemesService {
  private projectMembersRepository: ProjectMembersRepository;

  constructor() {
    this.projectMembersRepository = new ProjectMembersRepository();
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

  async createScheme(userId: string, input: { projectId?: string; name: string; description?: string; isDefault?: boolean }) {
    if (input.projectId) {
      await this.checkProjectAccess(input.projectId, userId, ['admin', 'lead']);
    }

    return prisma.workflowScheme.create({
      data: {
        projectId: input.projectId || null,
        name: input.name,
        description: input.description,
        isDefault: input.isDefault ?? false,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  async listSchemes(userId: string, projectId?: string) {
    if (projectId) {
      await this.checkProjectAccess(projectId, userId);
    }
    return prisma.workflowScheme.findMany({
      where: projectId
        ? {
            status: 'active',
            OR: [{ projectId }, { projectId: null as any }],
          }
        : { status: 'active' },
      include: {
        mappings: true,
        assignments: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getScheme(userId: string, schemeId: string) {
    const scheme = await prisma.workflowScheme.findUnique({
      where: { id: schemeId },
      include: { mappings: true, assignments: true },
    });
    if (!scheme) {
      throw ApiError.notFound('Workflow scheme not found');
    }
    if (scheme.projectId) {
      await this.checkProjectAccess(scheme.projectId, userId);
    }
    return scheme;
  }

  async updateScheme(userId: string, schemeId: string, input: { name?: string; description?: string | null; status?: 'active' | 'inactive'; isDefault?: boolean }) {
    const scheme = await this.getScheme(userId, schemeId);
    if (scheme.projectId) {
      await this.checkProjectAccess(scheme.projectId, userId, ['admin', 'lead']);
    }
    return prisma.workflowScheme.update({
      where: { id: schemeId },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        status: input.status,
        isDefault: input.isDefault,
        updatedBy: userId,
      },
    });
  }

  async deleteScheme(userId: string, schemeId: string) {
    const scheme = await this.getScheme(userId, schemeId);
    if (scheme.isDefault) {
      throw ApiError.badRequest('Cannot delete the default workflow scheme');
    }
    if (scheme.projectId) {
      await this.checkProjectAccess(scheme.projectId, userId, ['admin', 'lead']);
    }
    await prisma.workflowScheme.update({
      where: { id: schemeId },
      data: { status: 'inactive', updatedBy: userId },
    });
    return { message: 'Workflow scheme deactivated' };
  }

  async upsertMapping(
    userId: string,
    schemeId: string,
    input: { issueTypeId?: string | null; workflowId: string }
  ) {
    const scheme = await this.getScheme(userId, schemeId);
    if (scheme.projectId) {
      await this.checkProjectAccess(scheme.projectId, userId, ['admin', 'lead']);
    }

    const issueTypeId = input.issueTypeId ?? null;
    const existing = await prisma.workflowSchemeMapping.findFirst({
      where: {
        workflowSchemeId: schemeId,
        issueTypeId,
      },
    });

    if (existing) {
      return prisma.workflowSchemeMapping.update({
        where: { id: existing.id },
        data: {
          workflowId: input.workflowId,
        },
      });
    }

    return prisma.workflowSchemeMapping.create({
      data: {
        workflowSchemeId: schemeId,
        issueTypeId,
        workflowId: input.workflowId,
      },
    });
  }

  async assignProject(userId: string, projectId: string, workflowSchemeId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);
    return prisma.projectWorkflowScheme.upsert({
      where: { projectId },
      create: {
        projectId,
        workflowSchemeId,
        assignedBy: userId,
      },
      update: {
        workflowSchemeId,
        assignedBy: userId,
      },
    });
  }

  async getEffectiveWorkflow(projectId: string, issueTypeId?: string) {
    const assignment = await prisma.projectWorkflowScheme.findUnique({
      where: { projectId },
      include: { workflowScheme: { include: { mappings: true } } },
    });

    if (!assignment?.workflowScheme) {
      const workflow = await prisma.workflow.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      });
      return {
        source: 'legacy',
        workflowId: workflow?.id || null,
      };
    }

    const mappings = assignment.workflowScheme.mappings;
    const typeMatch = issueTypeId
      ? mappings.find((mapping) => mapping.issueTypeId === issueTypeId)
      : null;
    const defaultMapping = mappings.find((mapping) => mapping.issueTypeId === null);
    const resolved = typeMatch || defaultMapping || null;

    return {
      source: 'workflow_scheme',
      workflowSchemeId: assignment.workflowSchemeId,
      workflowId: resolved?.workflowId || null,
      issueTypeId: issueTypeId || null,
    };
  }
}

export const workflowSchemesService = new WorkflowSchemesService();
