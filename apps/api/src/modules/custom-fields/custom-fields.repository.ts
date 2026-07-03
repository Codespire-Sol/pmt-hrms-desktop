import { prisma } from '../../database/prisma';
import {
  CustomField,
  CustomFieldValue,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
  CustomFieldWithValue,
} from './custom-fields.types';

export const customFieldsRepository = {
  // Custom Field CRUD
  async createField(
    projectId: string,
    input: CreateCustomFieldInput
  ): Promise<CustomField> {
    return prisma.customField.create({
      data: {
        projectId,
        name: input.name,
        fieldKey: input.fieldKey,
        description: input.description,
        fieldType: input.fieldType,
        options: input.options ? { options: input.options } as any : null,
        validation: (input.validation || null) as any,
        defaultValue: input.defaultValue ?? null,
        isRequired: input.isRequired ?? false,
        isFilterable: input.isFilterable ?? true,
        isVisibleInList: input.isVisibleInList ?? false,
        position: input.position ?? 0,
      },
    }) as unknown as Promise<CustomField>;
  },

  async findFieldById(fieldId: string): Promise<CustomField | null> {
    return prisma.customField.findFirst({
      where: {
        id: fieldId,
        deletedAt: null,
      },
    }) as unknown as Promise<CustomField | null>;
  },

  async findFieldsByProject(projectId: string): Promise<CustomField[]> {
    return prisma.customField.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      orderBy: [
        { position: 'asc' },
        { name: 'asc' },
      ],
    }) as unknown as Promise<CustomField[]>;
  },

  async updateField(
    fieldId: string,
    input: UpdateCustomFieldInput
  ): Promise<CustomField | null> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.options !== undefined) updateData.options = { options: input.options };
    if (input.validation !== undefined) updateData.validation = input.validation;
    if (input.defaultValue !== undefined) updateData.defaultValue = input.defaultValue;
    if (input.isRequired !== undefined) updateData.isRequired = input.isRequired;
    if (input.isFilterable !== undefined) updateData.isFilterable = input.isFilterable;
    if (input.isVisibleInList !== undefined) updateData.isVisibleInList = input.isVisibleInList;
    if (input.position !== undefined) updateData.position = input.position;

    const field = await prisma.customField.updateMany({
      where: {
        id: fieldId,
        deletedAt: null,
      },
      data: updateData,
    });

    if (field.count === 0) return null;

    return prisma.customField.findUnique({ where: { id: fieldId } }) as unknown as Promise<CustomField | null>;
  },

  async deleteField(fieldId: string): Promise<void> {
    await prisma.customField.update({
      where: { id: fieldId },
      data: { deletedAt: new Date() },
    });

    // Also delete all values for this field
    await prisma.issueCustomFieldValue.deleteMany({
      where: { customFieldId: fieldId },
    });
  },

  async reorderFields(projectId: string, fieldIds: string[]): Promise<void> {
    await prisma.$transaction(
      fieldIds.map((id, index) =>
        prisma.customField.updateMany({
          where: { id, projectId },
          data: { position: index },
        })
      )
    );
  },

  // Custom Field Values
  async setFieldValue(
    issueId: string,
    customFieldId: string,
    value: any
  ): Promise<CustomFieldValue> {
    const result = await prisma.issueCustomFieldValue.upsert({
      where: {
        issueId_customFieldId: {
          issueId,
          customFieldId,
        },
      },
      update: {
        value: JSON.stringify(value),
        updatedAt: new Date(),
      },
      create: {
        issueId,
        customFieldId,
        value: JSON.stringify(value),
      },
    });

    return {
      id: result.id,
      issueId: result.issueId,
      customFieldId: result.customFieldId,
      value: result.value,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    } as unknown as CustomFieldValue;
  },

  async deleteFieldValue(issueId: string, customFieldId: string): Promise<void> {
    await prisma.issueCustomFieldValue.deleteMany({
      where: { issueId, customFieldId },
    });
  },

  async getFieldValuesByIssue(issueId: string): Promise<CustomFieldWithValue[]> {
    // First get the issue's project
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { projectId: true },
    });

    if (!issue) return [];

    // Get all custom fields for the project
    const fields = await prisma.customField.findMany({
      where: {
        projectId: issue.projectId,
        deletedAt: null,
      },
      orderBy: { position: 'asc' },
    });

    // Get values for this issue
    const values = await prisma.issueCustomFieldValue.findMany({
      where: {
        issueId,
        customFieldId: { in: fields.map((f) => f.id) },
      },
    });

    const valueMap = new Map(values.map((v) => [v.customFieldId, v]));

    return fields.map((field) => {
      const fieldValue = valueMap.get(field.id);
      return {
        ...field,
        value: fieldValue?.value ?? field.defaultValue ?? null,
      };
    }) as unknown as CustomFieldWithValue[];
  },

  async getFieldValuesForIssues(issueIds: string[]): Promise<Map<string, CustomFieldWithValue[]>> {
    if (issueIds.length === 0) {
      return new Map();
    }

    const results = await prisma.issueCustomFieldValue.findMany({
      where: {
        issueId: { in: issueIds },
        customField: { deletedAt: null },
      },
      include: {
        customField: true,
      },
    });

    const map = new Map<string, CustomFieldWithValue[]>();

    for (const row of results) {
      const issueId = row.issueId;
      const existing = map.get(issueId) ?? [];
      if (!map.has(issueId)) {
        map.set(issueId, existing);
      }
      existing.push({
        ...row.customField,
        value: row.value,
      } as unknown as CustomFieldWithValue);
    }

    return map;
  },

  // Check if field key is unique within project
  async isFieldKeyUnique(projectId: string, fieldKey: string, excludeId?: string): Promise<boolean> {
    const count = await prisma.customField.count({
      where: {
        projectId,
        fieldKey,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    return count === 0;
  },
};
