import { customFieldsRepository } from './custom-fields.repository';
import { ApiError } from '../../utils/ApiError';
import {
  CustomField,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  SetCustomFieldValueInput,
  CustomFieldWithValue,
} from './custom-fields.types';

export const customFieldsService = {
  // Custom Field CRUD
  async createField(
    projectId: string,
    input: CreateCustomFieldInput
  ): Promise<CustomField> {
    // Validate field key format (alphanumeric with underscores)
    if (!/^[a-z][a-z0-9_]*$/.test(input.fieldKey)) {
      throw ApiError.badRequest(
        'Field key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores'
      );
    }

    // Check uniqueness
    const isUnique = await customFieldsRepository.isFieldKeyUnique(projectId, input.fieldKey);
    if (!isUnique) {
      throw ApiError.conflict('A custom field with this key already exists in this project');
    }

    // Validate options for select/multiselect types
    if (['select', 'multiselect'].includes(input.fieldType)) {
      if (!input.options || input.options.length === 0) {
        throw ApiError.badRequest('Select and multiselect fields require at least one option');
      }
    }

    return customFieldsRepository.createField(projectId, input);
  },

  async getFieldById(fieldId: string): Promise<CustomField> {
    const field = await customFieldsRepository.findFieldById(fieldId);
    if (!field) {
      throw ApiError.notFound('Custom field not found');
    }
    return field;
  },

  async getFieldsByProject(projectId: string): Promise<CustomField[]> {
    return customFieldsRepository.findFieldsByProject(projectId);
  },

  async updateField(
    fieldId: string,
    input: UpdateCustomFieldInput
  ): Promise<CustomField> {
    const existingField = await customFieldsRepository.findFieldById(fieldId);
    if (!existingField) {
      throw ApiError.notFound('Custom field not found');
    }

    // Validate options for select/multiselect types
    if (
      ['select', 'multiselect'].includes(existingField.fieldType) &&
      input.options !== undefined &&
      input.options.length === 0
    ) {
      throw ApiError.badRequest('Select and multiselect fields require at least one option');
    }

    const updated = await customFieldsRepository.updateField(fieldId, input);
    if (!updated) {
      throw ApiError.notFound('Custom field not found');
    }

    return updated;
  },

  async deleteField(fieldId: string): Promise<void> {
    const field = await customFieldsRepository.findFieldById(fieldId);
    if (!field) {
      throw ApiError.notFound('Custom field not found');
    }

    await customFieldsRepository.deleteField(fieldId);
  },

  async reorderFields(projectId: string, fieldIds: string[]): Promise<CustomField[]> {
    await customFieldsRepository.reorderFields(projectId, fieldIds);
    return customFieldsRepository.findFieldsByProject(projectId);
  },

  // Custom Field Values
  async setFieldValue(
    issueId: string,
    customFieldId: string,
    value: any
  ): Promise<CustomFieldWithValue> {
    const field = await customFieldsRepository.findFieldById(customFieldId);
    if (!field) {
      throw ApiError.notFound('Custom field not found');
    }

    // Validate value based on field type
    const validatedValue = this.validateFieldValue(field, value);

    await customFieldsRepository.setFieldValue(issueId, customFieldId, validatedValue);

    return {
      ...field,
      value: validatedValue,
    };
  },

  async setFieldValues(
    issueId: string,
    values: SetCustomFieldValueInput[]
  ): Promise<CustomFieldWithValue[]> {
    const results: CustomFieldWithValue[] = [];

    for (const { customFieldId, value } of values) {
      const result = await this.setFieldValue(issueId, customFieldId, value);
      results.push(result);
    }

    return results;
  },

  async deleteFieldValue(issueId: string, customFieldId: string): Promise<void> {
    await customFieldsRepository.deleteFieldValue(issueId, customFieldId);
  },

  async getFieldValuesByIssue(issueId: string): Promise<CustomFieldWithValue[]> {
    return customFieldsRepository.getFieldValuesByIssue(issueId);
  },

  async getFieldValuesForIssues(
    issueIds: string[]
  ): Promise<Map<string, CustomFieldWithValue[]>> {
    return customFieldsRepository.getFieldValuesForIssues(issueIds);
  },

  // Value validation
  validateFieldValue(field: CustomField, value: any): any {
    // Null/undefined check for required fields
    if (field.isRequired && (value === null || value === undefined || value === '')) {
      throw ApiError.badRequest(`Field "${field.name}" is required`);
    }

    // Allow null for non-required fields
    if (value === null || value === undefined) {
      return null;
    }

    switch (field.fieldType) {
      case 'text':
        if (typeof value !== 'string') {
          throw ApiError.badRequest(`Field "${field.name}" must be a string`);
        }
        if (field.validation?.maxLength && value.length > field.validation.maxLength) {
          throw ApiError.badRequest(
            `Field "${field.name}" exceeds maximum length of ${field.validation.maxLength}`
          );
        }
        if (field.validation?.minLength && value.length < field.validation.minLength) {
          throw ApiError.badRequest(
            `Field "${field.name}" must be at least ${field.validation.minLength} characters`
          );
        }
        if (field.validation?.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            throw ApiError.badRequest(`Field "${field.name}" does not match required pattern`);
          }
        }
        return value;

      case 'number': {
        const num = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(num)) {
          throw ApiError.badRequest(`Field "${field.name}" must be a number`);
        }
        if (field.validation?.min !== undefined && num < field.validation.min) {
          throw ApiError.badRequest(
            `Field "${field.name}" must be at least ${field.validation.min}`
          );
        }
        if (field.validation?.max !== undefined && num > field.validation.max) {
          throw ApiError.badRequest(
            `Field "${field.name}" must be at most ${field.validation.max}`
          );
        }
        return num;
      }

      case 'date':
      case 'datetime': {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw ApiError.badRequest(`Field "${field.name}" must be a valid date`);
        }
        return value;
      }

      case 'select':
        if (!field.options?.options?.some((opt) => opt.value === value)) {
          throw ApiError.badRequest(`Invalid option for field "${field.name}"`);
        }
        return value;

      case 'multiselect':
        if (!Array.isArray(value)) {
          throw ApiError.badRequest(`Field "${field.name}" must be an array`);
        }
        for (const v of value) {
          if (!field.options?.options?.some((opt) => opt.value === v)) {
            throw ApiError.badRequest(`Invalid option "${v}" for field "${field.name}"`);
          }
        }
        return value;

      case 'checkbox':
        return Boolean(value);

      case 'url':
        if (typeof value !== 'string') {
          throw ApiError.badRequest(`Field "${field.name}" must be a string`);
        }
        try {
          new URL(value);
        } catch {
          throw ApiError.badRequest(`Field "${field.name}" must be a valid URL`);
        }
        return value;

      case 'email': {
        if (typeof value !== 'string') {
          throw ApiError.badRequest(`Field "${field.name}" must be a string`);
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw ApiError.badRequest(`Field "${field.name}" must be a valid email`);
        }
        return value;
      }

      case 'user':
        // Just validate it's a string (UUID)
        if (typeof value !== 'string') {
          throw ApiError.badRequest(`Field "${field.name}" must be a user ID`);
        }
        return value;

      default:
        return value;
    }
  },
};
