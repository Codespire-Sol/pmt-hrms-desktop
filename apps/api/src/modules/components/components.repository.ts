import { prisma } from '../../database/prisma';
import { Component, ComponentWithDetails, CreateComponentInput, UpdateComponentInput, ComponentFilters } from './components.types';

export class ComponentsRepository {
  async create(projectId: string, input: CreateComponentInput): Promise<Component> {
    const component = await prisma.component.create({
      data: {
        projectId,
        name: input.name,
        description: input.description,
        leadId: input.leadId,
        defaultAssigneeId: input.defaultAssigneeId,
        color: input.color || '#6366f1',
      },
    });

    return this.mapToComponent(component);
  }

  async findById(id: string): Promise<ComponentWithDetails | null> {
    const component = await prisma.component.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true },
        },
        issueComponents: {
          select: { id: true },
        },
      },
    });

    if (!component) return null;

    // Fetch lead user if leadId exists
    let lead: { id: string; displayName: string; email: string; avatarUrl: string | null } | undefined;
    if (component.leadId) {
      const leadUser = await prisma.user.findUnique({
        where: { id: component.leadId },
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      });
      if (leadUser) {
        lead = {
          id: leadUser.id,
          displayName: `${leadUser.firstName} ${leadUser.lastName}`,
          email: leadUser.email,
          avatarUrl: leadUser.avatarUrl,
        };
      }
    }

    // Fetch default assignee user if defaultAssigneeId exists
    let defaultAssignee: { id: string; displayName: string; email: string; avatarUrl: string | null } | undefined;
    if (component.defaultAssigneeId) {
      const assigneeUser = await prisma.user.findUnique({
        where: { id: component.defaultAssigneeId },
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      });
      if (assigneeUser) {
        defaultAssignee = {
          id: assigneeUser.id,
          displayName: `${assigneeUser.firstName} ${assigneeUser.lastName}`,
          email: assigneeUser.email,
          avatarUrl: assigneeUser.avatarUrl,
        };
      }
    }

    const issueCount = component.issueComponents.length;

    return {
      ...this.mapToComponent(component),
      lead,
      defaultAssignee,
      issueCount,
    };
  }

  async findByProject(projectId: string, filters: ComponentFilters = {}): Promise<ComponentWithDetails[]> {
    const where: any = { projectId };

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.leadId) {
      where.leadId = filters.leadId;
    }

    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const components = await prisma.component.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        issueComponents: {
          select: { id: true },
        },
      },
    });

    // Batch fetch lead and default assignee users
    const leadIds = [...new Set(components.map(c => c.leadId).filter(Boolean))] as string[];
    const assigneeIds = [...new Set(components.map(c => c.defaultAssigneeId).filter(Boolean))] as string[];
    const allUserIds = [...new Set([...leadIds, ...assigneeIds])];

    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    return components.map((c) => {
      const leadUser = c.leadId ? userMap.get(c.leadId) : undefined;
      const assigneeUser = c.defaultAssigneeId ? userMap.get(c.defaultAssigneeId) : undefined;

      return {
        ...this.mapToComponent(c),
        lead: leadUser ? {
          id: leadUser.id,
          displayName: `${leadUser.firstName} ${leadUser.lastName}`,
          email: leadUser.email,
          avatarUrl: leadUser.avatarUrl,
        } : undefined,
        defaultAssignee: assigneeUser ? {
          id: assigneeUser.id,
          displayName: `${assigneeUser.firstName} ${assigneeUser.lastName}`,
          email: assigneeUser.email,
          avatarUrl: assigneeUser.avatarUrl,
        } : undefined,
        issueCount: c.issueComponents.length,
      };
    });
  }

  async update(id: string, input: UpdateComponentInput): Promise<Component> {
    const updateData: Record<string, any> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.leadId !== undefined) updateData.leadId = input.leadId;
    if (input.defaultAssigneeId !== undefined) updateData.defaultAssigneeId = input.defaultAssigneeId;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const component = await prisma.component.update({
      where: { id },
      data: updateData,
    });

    return this.mapToComponent(component);
  }

  async delete(id: string): Promise<void> {
    await prisma.component.delete({ where: { id } });
  }

  async exists(projectId: string, name: string, excludeId?: string): Promise<boolean> {
    const where: any = { projectId, name };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const result = await prisma.component.findFirst({ where });
    return !!result;
  }

  // Issue-component relationship methods
  async addIssueToComponent(issueId: string, componentId: string): Promise<void> {
    await prisma.issueComponent.upsert({
      where: {
        issueId_componentId: { issueId, componentId },
      },
      update: {},
      create: { issueId, componentId },
    });
  }

  async removeIssueFromComponent(issueId: string, componentId: string): Promise<void> {
    await prisma.issueComponent.deleteMany({
      where: { issueId, componentId },
    });
  }

  async getIssueComponents(issueId: string): Promise<Component[]> {
    const issueComponents = await prisma.issueComponent.findMany({
      where: { issueId },
      include: {
        component: true,
      },
      orderBy: {
        component: { name: 'asc' },
      },
    });

    return issueComponents.map((ic) => this.mapToComponent(ic.component));
  }

  async setIssueComponents(issueId: string, componentIds: string[]): Promise<void> {
    // Remove all existing components
    await prisma.issueComponent.deleteMany({
      where: { issueId },
    });

    // Add new components
    if (componentIds.length > 0) {
      await prisma.issueComponent.createMany({
        data: componentIds.map((componentId) => ({
          issueId,
          componentId,
        })),
      });
    }
  }

  async getComponentIssues(componentId: string, page: number = 1, limit: number = 50): Promise<{ issues: any[]; total: number }> {
    const offset = (page - 1) * limit;

    const issueComponents = await prisma.issueComponent.findMany({
      where: { componentId },
      include: {
        issue: {
          include: {
            project: { select: { id: true, key: true } },
            status: { select: { id: true, name: true, displayName: true, color: true } },
            priority: { select: { id: true, name: true, displayName: true, color: true } },
            assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    // Filter out soft-deleted issues
    const validIssueComponents = issueComponents.filter(ic => ic.issue.deletedAt === null);

    const total = validIssueComponents.length;

    // Sort by createdAt desc, then paginate
    const sortedIssues = validIssueComponents
      .sort((a, b) => b.issue.createdAt.getTime() - a.issue.createdAt.getTime())
      .slice(offset, offset + limit);

    const issues = sortedIssues.map((ic) => {
      const i = ic.issue;
      return {
        id: i.id,
        issue_key: `${i.project.key}-${i.issueNumber}`,
        title: i.title,
        status: i.status ? {
          id: i.status.id,
          name: i.status.name,
          displayName: i.status.displayName,
          color: i.status.color,
        } : null,
        priority: i.priority ? {
          id: i.priority.id,
          name: i.priority.name,
          displayName: i.priority.displayName,
          color: i.priority.color,
        } : null,
        assignee: i.assignee ? {
          id: i.assignee.id,
          displayName: `${i.assignee.firstName} ${i.assignee.lastName}`,
          avatarUrl: i.assignee.avatarUrl,
        } : null,
      };
    });

    return {
      issues,
      total,
    };
  }

  private mapToComponent(row: any): Component {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      leadId: row.leadId,
      defaultAssigneeId: row.defaultAssigneeId,
      color: row.color,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
