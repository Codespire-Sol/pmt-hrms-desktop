import { prisma } from '../../database/prisma';
import {
  Screen,
  ScreenWithTabs,
  ScreenTab,
  ScreenTabWithFields,
  ScreenTabField,
  ScreenScheme,
  ScreenSchemeWithItems,
  ScreenSchemeItem,
  IssueTypeScreenScheme,
  IssueTypeScreenSchemeWithItems,
  IssueTypeScreenSchemeItem,
  ScreenOperation,
  SYSTEM_FIELDS,
} from './screens.types';

export class ScreensRepository {
  // === Screen Methods ===

  async createScreen(data: { projectId?: string; name: string; description?: string }): Promise<Screen> {
    const screen = await prisma.screen.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description,
      },
    });
    return this.mapScreen(screen);
  }

  async findScreenById(id: string): Promise<Screen | null> {
    const screen = await prisma.screen.findUnique({ where: { id } });
    return screen ? this.mapScreen(screen) : null;
  }

  async findScreenWithTabs(id: string): Promise<ScreenWithTabs | null> {
    const screen = await prisma.screen.findUnique({
      where: { id },
      include: {
        tabs: {
          orderBy: { position: 'asc' },
          include: {
            fields: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!screen) return null;

    const tabsWithFields: ScreenTabWithFields[] = screen.tabs.map((tab) => ({
      ...this.mapScreenTab(tab),
      fields: tab.fields.map((f) => this.mapScreenTabField(f)),
    }));

    return {
      ...this.mapScreen(screen),
      tabs: tabsWithFields,
    };
  }

  async findScreensByProject(projectId?: string): Promise<Screen[]> {
    let where: any;

    if (projectId) {
      where = {
        OR: [
          { projectId },
          { projectId: null as any },
        ],
      };
    } else {
      where = { projectId: null as any };
    }

    const screens = await prisma.screen.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return screens.map((s) => this.mapScreen(s));
  }

  async updateScreen(id: string, data: { name?: string; description?: string }): Promise<Screen | null> {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const screen = await prisma.screen.update({
      where: { id },
      data: updateData,
    });
    return screen ? this.mapScreen(screen) : null;
  }

  async deleteScreen(id: string): Promise<boolean> {
    try {
      await prisma.screen.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // === Screen Tab Methods ===

  async createScreenTab(screenId: string, data: { name: string; position?: number }): Promise<ScreenTab> {
    const maxPosition = await prisma.screenTab.aggregate({
      where: { screenId },
      _max: { position: true },
    });

    const tab = await prisma.screenTab.create({
      data: {
        screenId,
        name: data.name,
        position: data.position ?? ((maxPosition._max.position ?? -1) + 1),
      },
    });
    return this.mapScreenTab(tab);
  }

  async findScreenTabById(id: string): Promise<ScreenTab | null> {
    const tab = await prisma.screenTab.findUnique({ where: { id } });
    return tab ? this.mapScreenTab(tab) : null;
  }

  async updateScreenTab(id: string, data: { name?: string; position?: number }): Promise<ScreenTab | null> {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.position !== undefined) updateData.position = data.position;

    const tab = await prisma.screenTab.update({
      where: { id },
      data: updateData,
    });
    return tab ? this.mapScreenTab(tab) : null;
  }

  async deleteScreenTab(id: string): Promise<boolean> {
    try {
      await prisma.screenTab.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // === Screen Tab Field Methods ===

  async addFieldToTab(
    tabId: string,
    data: { fieldId: string; fieldType: 'system' | 'custom'; position?: number; isRequired?: boolean }
  ): Promise<ScreenTabField> {
    const maxPosition = await prisma.screenTabField.aggregate({
      where: { tabId },
      _max: { position: true },
    });

    const field = await prisma.screenTabField.create({
      data: {
        tabId,
        fieldName: data.fieldId,
        fieldType: data.fieldType,
        position: data.position ?? ((maxPosition._max.position ?? -1) + 1),
        isRequired: data.isRequired ?? false,
      },
    });
    return this.mapScreenTabField(field);
  }

  async updateTabField(id: string, data: { position?: number; isRequired?: boolean }): Promise<ScreenTabField | null> {
    const updateData: Record<string, any> = {};
    if (data.position !== undefined) updateData.position = data.position;
    if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;

    const field = await prisma.screenTabField.update({
      where: { id },
      data: updateData,
    });
    return field ? this.mapScreenTabField(field) : null;
  }

  async removeFieldFromTab(id: string): Promise<boolean> {
    try {
      await prisma.screenTabField.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async reorderTabFields(tabId: string, fieldIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < fieldIds.length; i++) {
        await tx.screenTabField.updateMany({
          where: { id: fieldIds[i], tabId },
          data: { position: i },
        });
      }
    });
  }

  // === Screen Scheme Methods ===

  async createScreenScheme(data: {
    projectId?: string;
    name: string;
    description?: string;
    items?: { screenId: string; operation: ScreenOperation }[];
  }): Promise<ScreenScheme> {
    const scheme = await prisma.screenScheme.create({
      data: {
        projectId: data.projectId!,
        name: data.name,
        description: data.description,
      },
    });

    if (data.items && data.items.length > 0) {
      await prisma.screenSchemeItem.createMany({
        data: data.items.map((item) => ({
          screenSchemeId: scheme.id,
          screenId: item.screenId,
          operation: item.operation,
        })),
      });
    }

    return this.mapScreenScheme(scheme);
  }

  async findScreenSchemeById(id: string): Promise<ScreenScheme | null> {
    const scheme = await prisma.screenScheme.findUnique({ where: { id } });
    return scheme ? this.mapScreenScheme(scheme) : null;
  }

  async findScreenSchemeWithItems(id: string): Promise<ScreenSchemeWithItems | null> {
    const scheme = await prisma.screenScheme.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            screen: true,
          },
        },
      },
    });

    if (!scheme) return null;

    return {
      ...this.mapScreenScheme(scheme),
      items: scheme.items.map((item) => ({
        ...this.mapScreenSchemeItem(item),
        screen: {
          id: item.screen.id,
          name: item.screen.name,
          description: item.screen.description,
          isSystem: false,
        } as Screen,
      })),
    };
  }

  async findScreenSchemesByProject(projectId?: string): Promise<ScreenScheme[]> {
    let where: any;

    if (projectId) {
      where = {
        OR: [
          { projectId },
          { projectId: null as any },
        ],
      };
    } else {
      where = { projectId: null as any };
    }

    const schemes = await prisma.screenScheme.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return schemes.map((s) => this.mapScreenScheme(s));
  }

  async updateScreenScheme(id: string, data: { name?: string; description?: string }): Promise<ScreenScheme | null> {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const scheme = await prisma.screenScheme.update({
      where: { id },
      data: updateData,
    });
    return scheme ? this.mapScreenScheme(scheme) : null;
  }

  async deleteScreenScheme(id: string): Promise<boolean> {
    try {
      await prisma.screenScheme.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async setScreenSchemeItem(
    schemeId: string,
    operation: ScreenOperation,
    screenId: string
  ): Promise<ScreenSchemeItem> {
    const existing = await prisma.screenSchemeItem.findFirst({
      where: { screenSchemeId: schemeId, operation },
    });

    if (existing) {
      const item = await prisma.screenSchemeItem.update({
        where: { id: existing.id },
        data: { screenId },
      });
      return this.mapScreenSchemeItem(item);
    }

    const item = await prisma.screenSchemeItem.create({
      data: {
        screenSchemeId: schemeId,
        screenId,
        operation,
      },
    });
    return this.mapScreenSchemeItem(item);
  }

  async removeScreenSchemeItem(schemeId: string, operation: ScreenOperation): Promise<boolean> {
    const result = await prisma.screenSchemeItem.deleteMany({
      where: { screenSchemeId: schemeId, operation },
    });
    return result.count > 0;
  }

  // === Issue Type Screen Scheme Methods ===

  async createIssueTypeScreenScheme(data: {
    projectId?: string;
    name: string;
    description?: string;
    items?: { issueTypeId?: string; screenSchemeId: string }[];
  }): Promise<IssueTypeScreenScheme> {
    const scheme = await prisma.issueTypeScreenScheme.create({
      data: {
        projectId: data.projectId!,
        name: data.name,
        description: data.description,
      },
    });

    if (data.items && data.items.length > 0) {
      await prisma.issueTypeScreenSchemeItem.createMany({
        data: data.items.map((item) => ({
          issueTypeScreenSchemeId: scheme.id,
          issueTypeId: item.issueTypeId,
          screenSchemeId: item.screenSchemeId,
        })),
      });
    }

    return this.mapIssueTypeScreenScheme(scheme);
  }

  async findIssueTypeScreenSchemeById(id: string): Promise<IssueTypeScreenScheme | null> {
    const scheme = await prisma.issueTypeScreenScheme.findUnique({ where: { id } });
    return scheme ? this.mapIssueTypeScreenScheme(scheme) : null;
  }

  async findIssueTypeScreenSchemeWithItems(id: string): Promise<IssueTypeScreenSchemeWithItems | null> {
    const scheme = await prisma.issueTypeScreenScheme.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            issueType: {
              select: { id: true, name: true, displayName: true },
            },
            screenScheme: true,
          },
        },
      },
    });

    if (!scheme) return null;

    return {
      ...this.mapIssueTypeScreenScheme(scheme),
      items: scheme.items.map((item) => ({
        ...this.mapIssueTypeScreenSchemeItem(item),
        issueType: item.issueType ? {
          id: item.issueType.id,
          name: item.issueType.name,
          displayName: item.issueType.displayName,
        } : undefined,
        screenScheme: {
          id: item.screenScheme.id,
          name: item.screenScheme.name,
          description: item.screenScheme.description,
        } as ScreenScheme,
      })),
    };
  }

  async findIssueTypeScreenSchemesByProject(projectId?: string): Promise<IssueTypeScreenScheme[]> {
    let where: any;

    if (projectId) {
      where = {
        OR: [
          { projectId },
          { projectId: null as any },
        ],
      };
    } else {
      where = { projectId: null as any };
    }

    const schemes = await prisma.issueTypeScreenScheme.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return schemes.map((s) => this.mapIssueTypeScreenScheme(s));
  }

  async updateIssueTypeScreenScheme(id: string, data: { name?: string; description?: string }): Promise<IssueTypeScreenScheme | null> {
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const scheme = await prisma.issueTypeScreenScheme.update({
      where: { id },
      data: updateData,
    });
    return scheme ? this.mapIssueTypeScreenScheme(scheme) : null;
  }

  async deleteIssueTypeScreenScheme(id: string): Promise<boolean> {
    try {
      await prisma.issueTypeScreenScheme.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async setIssueTypeScreenSchemeItem(
    schemeId: string,
    issueTypeId: string | null,
    screenSchemeId: string
  ): Promise<IssueTypeScreenSchemeItem> {
    const existing = await prisma.issueTypeScreenSchemeItem.findFirst({
      where: { issueTypeScreenSchemeId: schemeId, issueTypeId },
    });

    if (existing) {
      const item = await prisma.issueTypeScreenSchemeItem.update({
        where: { id: existing.id },
        data: { screenSchemeId },
      });
      return this.mapIssueTypeScreenSchemeItem(item);
    }

    const item = await prisma.issueTypeScreenSchemeItem.create({
      data: {
        issueTypeScreenSchemeId: schemeId,
        issueTypeId,
        screenSchemeId,
      },
    });
    return this.mapIssueTypeScreenSchemeItem(item);
  }

  async removeIssueTypeScreenSchemeItem(schemeId: string, issueTypeId: string | null): Promise<boolean> {
    const result = await prisma.issueTypeScreenSchemeItem.deleteMany({
      where: { issueTypeScreenSchemeId: schemeId, issueTypeId },
    });
    return result.count > 0;
  }

  // === Utility: Get Screen for Issue ===

  async getScreenForIssue(
    projectId: string,
    issueTypeId: string,
    operation: ScreenOperation
  ): Promise<ScreenWithTabs | null> {
    // Get the project's issue type screen scheme
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { issueTypeScreenSchemes: { select: { id: true }, take: 1 } },
    });

    let issueTypeScreenSchemeId = project?.issueTypeScreenSchemes?.[0]?.id;

    // If no specific scheme, use default
    if (!issueTypeScreenSchemeId) {
      const defaultScheme = await prisma.issueTypeScreenScheme.findFirst({
        where: { projectId },
      });
      issueTypeScreenSchemeId = defaultScheme?.id;
    }

    if (!issueTypeScreenSchemeId) return null;

    // Find the screen scheme for this issue type
    let schemeItem = await prisma.issueTypeScreenSchemeItem.findFirst({
      where: { issueTypeScreenSchemeId, issueTypeId },
    });

    // Fallback to default (null issue type)
    if (!schemeItem) {
      schemeItem = await prisma.issueTypeScreenSchemeItem.findFirst({
        where: { issueTypeScreenSchemeId, issueTypeId: null },
      });
    }

    if (!schemeItem) return null;

    // Find the screen for this operation
    const screenItem = await prisma.screenSchemeItem.findFirst({
      where: { screenSchemeId: schemeItem.screenSchemeId, operation },
    });

    if (!screenItem) return null;

    return this.findScreenWithTabs(screenItem.screenId);
  }

  // === Mapping Methods ===

  private mapScreen(row: any): Screen {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      isSystem: row.isSystem ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapScreenTab(row: any): ScreenTab {
    return {
      id: row.id,
      screenId: row.screenId,
      name: row.name,
      position: row.position,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapScreenTabField(row: any): ScreenTabField {
    const fieldId = row.fieldName ?? row.fieldId;
    const systemField = SYSTEM_FIELDS.find(f => f.id === fieldId);
    return {
      id: row.id,
      tabId: row.tabId,
      fieldId: fieldId,
      fieldType: row.fieldType,
      position: row.position,
      isRequired: row.isRequired,
      createdAt: row.createdAt,
      fieldName: fieldId,
      fieldLabel: systemField?.label || fieldId,
    };
  }

  private mapScreenScheme(row: any): ScreenScheme {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      isDefault: row.isDefault ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapScreenSchemeItem(row: any): ScreenSchemeItem {
    return {
      id: row.id,
      screenSchemeId: row.screenSchemeId,
      screenId: row.screenId,
      operation: row.operation,
      createdAt: row.createdAt,
    };
  }

  private mapIssueTypeScreenScheme(row: any): IssueTypeScreenScheme {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description,
      isDefault: row.isDefault ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapIssueTypeScreenSchemeItem(row: any): IssueTypeScreenSchemeItem {
    return {
      id: row.id,
      issueTypeScreenSchemeId: row.issueTypeScreenSchemeId,
      issueTypeId: row.issueTypeId,
      screenSchemeId: row.screenSchemeId,
      createdAt: row.createdAt,
    };
  }
}
