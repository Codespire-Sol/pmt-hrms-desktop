import { randomBytes } from 'crypto';
import { formsRepository } from './forms.repository';
import { CreateFormInput, SubmitFormInput, UpdateFormInput } from './forms.types';
import { ApiError } from '../../utils/ApiError';
import { ProjectMembersRepository } from '../projects/projectMembers.repository';
import { isSystemAdmin } from '../../utils/system-admin';
import { IssuesService } from '../issues/issues.service';

export class FormsService {
  private projectMembersRepository: ProjectMembersRepository;
  private issuesService: IssuesService;

  constructor() {
    this.projectMembersRepository = new ProjectMembersRepository();
    this.issuesService = new IssuesService();
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

  async createForm(projectId: string, input: CreateFormInput, userId: string) {
    await this.checkProjectAccess(projectId, userId, ['admin', 'lead']);
    return formsRepository.createForm(projectId, input, userId);
  }

  async listForms(projectId: string, userId: string) {
    await this.checkProjectAccess(projectId, userId);
    return formsRepository.listForms(projectId);
  }

  async getForm(formId: string, userId: string) {
    const form = await formsRepository.getFormById(formId);
    if (!form) {
      throw ApiError.notFound('Form not found');
    }
    await this.checkProjectAccess(form.projectId, userId);
    return form;
  }

  async updateForm(formId: string, input: UpdateFormInput, userId: string) {
    const form = await formsRepository.getFormById(formId);
    if (!form) {
      throw ApiError.notFound('Form not found');
    }

    await this.checkProjectAccess(form.projectId, userId, ['admin', 'lead']);
    return formsRepository.updateForm(formId, input);
  }

  async deleteForm(formId: string, userId: string) {
    const form = await formsRepository.getFormById(formId);
    if (!form) {
      throw ApiError.notFound('Form not found');
    }

    await this.checkProjectAccess(form.projectId, userId, ['admin', 'lead']);
    await formsRepository.archiveForm(formId);
    return { message: 'Form deleted successfully' };
  }

  async publishForm(formId: string, userId: string) {
    const form = await formsRepository.getFormById(formId);
    if (!form) {
      throw ApiError.notFound('Form not found');
    }
    await this.checkProjectAccess(form.projectId, userId, ['admin', 'lead']);
    return formsRepository.publishForm(formId);
  }

  async createAccessToken(formId: string, userId: string, expiresAt?: string) {
    const form = await formsRepository.getFormById(formId);
    if (!form) {
      throw ApiError.notFound('Form not found');
    }
    await this.checkProjectAccess(form.projectId, userId, ['admin', 'lead']);

    const token = randomBytes(24).toString('hex');
    return formsRepository.createAccessToken(
      formId,
      token,
      userId,
      expiresAt ? new Date(expiresAt) : undefined
    );
  }

  private validateFormPayload(form: any, payload: Record<string, unknown>): string[] {
    const errors: string[] = [];

    for (const field of form.fields || []) {
      const value = payload[field.fieldKey];
      const hasValue =
        value !== undefined &&
        value !== null &&
        !(typeof value === 'string' && value.trim().length === 0);

      if (field.isRequired && !hasValue) {
        errors.push(`${field.label} is required`);
        continue;
      }

      if (!hasValue) {
        continue;
      }

      switch (field.fieldType) {
        case 'number':
          if (typeof value !== 'number') {
            errors.push(`${field.label} must be a number`);
          }
          break;
        case 'email':
          if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${field.label} must be a valid email`);
          }
          break;
        case 'checkbox':
          if (typeof value !== 'boolean') {
            errors.push(`${field.label} must be true/false`);
          }
          break;
        case 'multiselect':
          if (!Array.isArray(value)) {
            errors.push(`${field.label} must be an array`);
          }
          break;
        case 'select':
        case 'radio': {
          const options = Array.isArray(field.options) ? field.options.map((o: any) => o.value) : [];
          if (options.length > 0 && !options.includes(String(value))) {
            errors.push(`${field.label} has an invalid option`);
          }
          break;
        }
        default:
          break;
      }
    }

    return errors;
  }

  private async tryCreateIssueFromSubmission(
    form: any,
    payload: Record<string, unknown>
  ): Promise<string | null> {
    const template = (form.issueTemplate || {}) as Record<string, any>;
    if (!template || template.enabled !== true) {
      return null;
    }

    if (!template.typeId || !form.projectId || !form.createdBy) {
      return null;
    }

    const titleFieldKey = String(template.titleFieldKey || '').trim();
    const descriptionFieldKey = String(template.descriptionFieldKey || '').trim();
    const titleFromPayload = titleFieldKey ? payload[titleFieldKey] : null;
    const descriptionFromPayload = descriptionFieldKey ? payload[descriptionFieldKey] : null;

    const title =
      (typeof titleFromPayload === 'string' && titleFromPayload.trim()) ||
      `Form submission: ${form.name}`;

    const description =
      (typeof descriptionFromPayload === 'string' && descriptionFromPayload.trim()) ||
      `Submitted via form "${form.name}"\n\nPayload:\n${JSON.stringify(payload, null, 2)}`;

    const issue = await this.issuesService.createIssue(
      form.projectId,
      {
        title,
        description,
        typeId: template.typeId,
        statusId: template.statusId,
        priorityId: template.priorityId,
        assigneeId: template.assigneeId,
      } as any,
      form.createdBy
    );

    return issue.id;
  }

  async getPublicForm(formId: string, token?: string) {
    const form = await formsRepository.getFormById(formId);
    if (!form) {
      throw ApiError.notFound('Form not found');
    }

    if (form.status !== 'published') {
      throw ApiError.notFound('Form not found');
    }

    // If form is not public, validate the access token
    if (!form.isPublic) {
      if (!token) {
        throw ApiError.forbidden('Access token is required');
      }
      const validToken = await formsRepository.getValidAccessToken(formId, token);
      if (!validToken) {
        throw ApiError.forbidden('Invalid or expired token');
      }
    }

    // Return only public-safe fields (no issueTemplate, settings, or internal data)
    return {
      id: form.id,
      name: form.name,
      description: form.description,
      status: form.status,
      fields: (form.fields || []).map((field: any) => ({
        id: field.id,
        fieldKey: field.fieldKey,
        label: field.label,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        position: field.position,
        placeholder: field.placeholder,
        helperText: field.helperText,
        options: field.options,
      })),
    };
  }

  async submitForm(formId: string, input: SubmitFormInput, userId?: string, requestToken?: string) {
    const form = await formsRepository.getFormById(formId);
    if (!form) {
      throw ApiError.notFound('Form not found');
    }

    if (form.status !== 'published') {
      throw ApiError.badRequest('Form is not published');
    }

    if (!form.isPublic && !userId) {
      const token = input.token || requestToken;
      if (!token) {
        throw ApiError.forbidden('Form submission token is required');
      }

      const validToken = await formsRepository.getValidAccessToken(formId, token);
      if (!validToken) {
        throw ApiError.forbidden('Invalid or expired form token');
      }
      await formsRepository.touchAccessToken(validToken.id);
    }

    if (userId) {
      await this.checkProjectAccess(form.projectId, userId);
    }

    const validationErrors = this.validateFormPayload(form, input.payload);
    if (validationErrors.length > 0) {
      throw ApiError.badRequest('Invalid submission payload', 'VALIDATION_ERROR', validationErrors);
    }

    let createdIssueId: string | null = null;
    let issueCreationError: string | null = null;

    try {
      createdIssueId = await this.tryCreateIssueFromSubmission(form, input.payload);
    } catch (error: any) {
      issueCreationError = error?.message || 'Failed to create linked issue';
    }

    const submission = await formsRepository.createSubmission({
      formId,
      submittedBy: userId,
      payload: input.payload,
      metadata: {
        ...(input.metadata || {}),
        issueCreationError,
      },
      createdIssueId,
    });

    const values = (form.fields || []).map((field: any) => ({
      fieldId: field.id,
      value: input.payload[field.fieldKey] ?? null,
    }));

    await formsRepository.createSubmissionValues(submission.id, values);
    return submission;
  }

  async listSubmissions(formId: string, userId: string, page = 1, limit = 20) {
    const form = await formsRepository.getFormById(formId);
    if (!form) {
      throw ApiError.notFound('Form not found');
    }

    await this.checkProjectAccess(form.projectId, userId, ['admin', 'lead']);
    const result = await formsRepository.listSubmissions(formId, page, limit);

    return {
      submissions: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }
}

export const formsService = new FormsService();
