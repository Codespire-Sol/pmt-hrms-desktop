import { ScreensRepository } from './screens.repository';
import { ApiError } from '../../utils/ApiError';
import {
  Screen,
  ScreenWithTabs,
  ScreenTab,
  ScreenTabField,
  ScreenScheme,
  ScreenSchemeWithItems,
  IssueTypeScreenScheme,
  IssueTypeScreenSchemeWithItems,
  CreateScreenInput,
  UpdateScreenInput,
  CreateScreenTabInput,
  UpdateScreenTabInput,
  AddFieldToTabInput,
  UpdateTabFieldInput,
  CreateScreenSchemeInput,
  UpdateScreenSchemeInput,
  CreateIssueTypeScreenSchemeInput,
  UpdateIssueTypeScreenSchemeInput,
  ScreenOperation,
  SYSTEM_FIELDS,
} from './screens.types';

export class ScreensService {
  private repository: ScreensRepository;

  constructor() {
    this.repository = new ScreensRepository();
  }

  // === Screen Methods ===

  async createScreen(input: CreateScreenInput): Promise<ScreenWithTabs> {
    const screen = await this.repository.createScreen(input);

    // Create default "Details" tab
    await this.repository.createScreenTab(screen.id, { name: 'Details', position: 0 });

    return (await this.repository.findScreenWithTabs(screen.id))!;
  }

  async getScreen(screenId: string): Promise<ScreenWithTabs> {
    const screen = await this.repository.findScreenWithTabs(screenId);
    if (!screen) {
      throw ApiError.notFound('Screen not found');
    }
    return screen;
  }

  async getScreens(projectId?: string): Promise<Screen[]> {
    return this.repository.findScreensByProject(projectId);
  }

  async updateScreen(screenId: string, input: UpdateScreenInput): Promise<Screen> {
    const screen = await this.repository.findScreenById(screenId);
    if (!screen) {
      throw ApiError.notFound('Screen not found');
    }

    if (screen.isSystem) {
      throw ApiError.forbidden('Cannot modify system screens');
    }

    const updated = await this.repository.updateScreen(screenId, input);
    if (!updated) {
      throw ApiError.internal('Failed to update screen');
    }

    return updated;
  }

  async deleteScreen(screenId: string): Promise<{ message: string }> {
    const screen = await this.repository.findScreenById(screenId);
    if (!screen) {
      throw ApiError.notFound('Screen not found');
    }

    if (screen.isSystem) {
      throw ApiError.forbidden('Cannot delete system screens');
    }

    const deleted = await this.repository.deleteScreen(screenId);
    if (!deleted) {
      throw ApiError.internal('Failed to delete screen');
    }

    return { message: 'Screen deleted successfully' };
  }

  // === Screen Tab Methods ===

  async addScreenTab(screenId: string, input: CreateScreenTabInput): Promise<ScreenTab> {
    const screen = await this.repository.findScreenById(screenId);
    if (!screen) {
      throw ApiError.notFound('Screen not found');
    }

    return this.repository.createScreenTab(screenId, input);
  }

  async updateScreenTab(tabId: string, input: UpdateScreenTabInput): Promise<ScreenTab> {
    const tab = await this.repository.findScreenTabById(tabId);
    if (!tab) {
      throw ApiError.notFound('Tab not found');
    }

    const updated = await this.repository.updateScreenTab(tabId, input);
    if (!updated) {
      throw ApiError.internal('Failed to update tab');
    }

    return updated;
  }

  async deleteScreenTab(tabId: string): Promise<{ message: string }> {
    const tab = await this.repository.findScreenTabById(tabId);
    if (!tab) {
      throw ApiError.notFound('Tab not found');
    }

    const deleted = await this.repository.deleteScreenTab(tabId);
    if (!deleted) {
      throw ApiError.internal('Failed to delete tab');
    }

    return { message: 'Tab deleted successfully' };
  }

  // === Screen Tab Field Methods ===

  async addFieldToTab(tabId: string, input: AddFieldToTabInput): Promise<ScreenTabField> {
    const tab = await this.repository.findScreenTabById(tabId);
    if (!tab) {
      throw ApiError.notFound('Tab not found');
    }

    // Validate system field
    if (input.fieldType === 'system') {
      const validField = SYSTEM_FIELDS.find(f => f.id === input.fieldId);
      if (!validField) {
        throw ApiError.badRequest(`Invalid system field: ${input.fieldId}`);
      }
    }

    return this.repository.addFieldToTab(tabId, input);
  }

  async updateTabField(fieldId: string, input: UpdateTabFieldInput): Promise<ScreenTabField> {
    const updated = await this.repository.updateTabField(fieldId, input);
    if (!updated) {
      throw ApiError.notFound('Field not found');
    }

    return updated;
  }

  async removeFieldFromTab(fieldId: string): Promise<{ message: string }> {
    const deleted = await this.repository.removeFieldFromTab(fieldId);
    if (!deleted) {
      throw ApiError.notFound('Field not found');
    }

    return { message: 'Field removed from tab' };
  }

  async reorderTabFields(tabId: string, fieldIds: string[]): Promise<{ message: string }> {
    await this.repository.reorderTabFields(tabId, fieldIds);
    return { message: 'Fields reordered successfully' };
  }

  getSystemFields() {
    return SYSTEM_FIELDS;
  }

  // === Screen Scheme Methods ===

  async createScreenScheme(input: CreateScreenSchemeInput): Promise<ScreenSchemeWithItems> {
    const scheme = await this.repository.createScreenScheme(input);
    return (await this.repository.findScreenSchemeWithItems(scheme.id))!;
  }

  async getScreenScheme(schemeId: string): Promise<ScreenSchemeWithItems> {
    const scheme = await this.repository.findScreenSchemeWithItems(schemeId);
    if (!scheme) {
      throw ApiError.notFound('Screen scheme not found');
    }
    return scheme;
  }

  async getScreenSchemes(projectId?: string): Promise<ScreenScheme[]> {
    return this.repository.findScreenSchemesByProject(projectId);
  }

  async updateScreenScheme(schemeId: string, input: UpdateScreenSchemeInput): Promise<ScreenScheme> {
    const scheme = await this.repository.findScreenSchemeById(schemeId);
    if (!scheme) {
      throw ApiError.notFound('Screen scheme not found');
    }

    const updated = await this.repository.updateScreenScheme(schemeId, input);
    if (!updated) {
      throw ApiError.internal('Failed to update screen scheme');
    }

    return updated;
  }

  async deleteScreenScheme(schemeId: string): Promise<{ message: string }> {
    const scheme = await this.repository.findScreenSchemeById(schemeId);
    if (!scheme) {
      throw ApiError.notFound('Screen scheme not found');
    }

    if (scheme.isDefault) {
      throw ApiError.forbidden('Cannot delete default screen scheme');
    }

    const deleted = await this.repository.deleteScreenScheme(schemeId);
    if (!deleted) {
      throw ApiError.internal('Failed to delete screen scheme');
    }

    return { message: 'Screen scheme deleted successfully' };
  }

  async setScreenSchemeItem(
    schemeId: string,
    operation: ScreenOperation,
    screenId: string
  ): Promise<ScreenSchemeWithItems> {
    const scheme = await this.repository.findScreenSchemeById(schemeId);
    if (!scheme) {
      throw ApiError.notFound('Screen scheme not found');
    }

    const screen = await this.repository.findScreenById(screenId);
    if (!screen) {
      throw ApiError.notFound('Screen not found');
    }

    await this.repository.setScreenSchemeItem(schemeId, operation, screenId);
    return (await this.repository.findScreenSchemeWithItems(schemeId))!;
  }

  async removeScreenSchemeItem(schemeId: string, operation: ScreenOperation): Promise<ScreenSchemeWithItems> {
    await this.repository.removeScreenSchemeItem(schemeId, operation);
    return (await this.repository.findScreenSchemeWithItems(schemeId))!;
  }

  // === Issue Type Screen Scheme Methods ===

  async createIssueTypeScreenScheme(input: CreateIssueTypeScreenSchemeInput): Promise<IssueTypeScreenSchemeWithItems> {
    const scheme = await this.repository.createIssueTypeScreenScheme(input);
    return (await this.repository.findIssueTypeScreenSchemeWithItems(scheme.id))!;
  }

  async getIssueTypeScreenScheme(schemeId: string): Promise<IssueTypeScreenSchemeWithItems> {
    const scheme = await this.repository.findIssueTypeScreenSchemeWithItems(schemeId);
    if (!scheme) {
      throw ApiError.notFound('Issue type screen scheme not found');
    }
    return scheme;
  }

  async getIssueTypeScreenSchemes(projectId?: string): Promise<IssueTypeScreenScheme[]> {
    return this.repository.findIssueTypeScreenSchemesByProject(projectId);
  }

  async updateIssueTypeScreenScheme(schemeId: string, input: UpdateIssueTypeScreenSchemeInput): Promise<IssueTypeScreenScheme> {
    const scheme = await this.repository.findIssueTypeScreenSchemeById(schemeId);
    if (!scheme) {
      throw ApiError.notFound('Issue type screen scheme not found');
    }

    const updated = await this.repository.updateIssueTypeScreenScheme(schemeId, input);
    if (!updated) {
      throw ApiError.internal('Failed to update issue type screen scheme');
    }

    return updated;
  }

  async deleteIssueTypeScreenScheme(schemeId: string): Promise<{ message: string }> {
    const scheme = await this.repository.findIssueTypeScreenSchemeById(schemeId);
    if (!scheme) {
      throw ApiError.notFound('Issue type screen scheme not found');
    }

    if (scheme.isDefault) {
      throw ApiError.forbidden('Cannot delete default issue type screen scheme');
    }

    const deleted = await this.repository.deleteIssueTypeScreenScheme(schemeId);
    if (!deleted) {
      throw ApiError.internal('Failed to delete issue type screen scheme');
    }

    return { message: 'Issue type screen scheme deleted successfully' };
  }

  async setIssueTypeScreenSchemeItem(
    schemeId: string,
    issueTypeId: string | null,
    screenSchemeId: string
  ): Promise<IssueTypeScreenSchemeWithItems> {
    const scheme = await this.repository.findIssueTypeScreenSchemeById(schemeId);
    if (!scheme) {
      throw ApiError.notFound('Issue type screen scheme not found');
    }

    const screenScheme = await this.repository.findScreenSchemeById(screenSchemeId);
    if (!screenScheme) {
      throw ApiError.notFound('Screen scheme not found');
    }

    await this.repository.setIssueTypeScreenSchemeItem(schemeId, issueTypeId, screenSchemeId);
    return (await this.repository.findIssueTypeScreenSchemeWithItems(schemeId))!;
  }

  async removeIssueTypeScreenSchemeItem(
    schemeId: string,
    issueTypeId: string | null
  ): Promise<IssueTypeScreenSchemeWithItems> {
    await this.repository.removeIssueTypeScreenSchemeItem(schemeId, issueTypeId);
    return (await this.repository.findIssueTypeScreenSchemeWithItems(schemeId))!;
  }

  // === Get Screen for Issue Creation/Edit/View ===

  async getScreenForIssue(
    projectId: string,
    issueTypeId: string,
    operation: ScreenOperation
  ): Promise<ScreenWithTabs | null> {
    return this.repository.getScreenForIssue(projectId, issueTypeId, operation);
  }
}
