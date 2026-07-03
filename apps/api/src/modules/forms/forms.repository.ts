import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import { CreateFormInput, FormFieldInput, UpdateFormInput } from './forms.types';

export class FormsRepository {
  async createForm(projectId: string, input: CreateFormInput, userId: string) {
    return prisma.$transaction(async (tx) => {
      const form = await tx.form.create({
        data: {
          projectId,
          name: input.name,
          description: input.description,
          isPublic: input.isPublic ?? false,
          issueTemplate: input.issueTemplate
            ? (input.issueTemplate as Prisma.InputJsonValue)
            : undefined,
          settings: input.settings ? (input.settings as Prisma.InputJsonValue) : undefined,
          createdBy: userId,
        },
      });

      if (input.fields && input.fields.length > 0) {
        await tx.formField.createMany({
          data: input.fields.map((field, index) => this.toFieldRecord(form.id, field, index)),
        });
      }

      return tx.form.findUnique({
        where: { id: form.id },
        include: { fields: { orderBy: { position: 'asc' } },
        },
      });
    });
  }

  async listForms(projectId: string) {
    const forms = await prisma.form.findMany({
      where: { projectId, deletedAt: null },
      include: {
        fields: { orderBy: { position: 'asc' } },
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return forms.map((form) => {
      const { _count, ...rest } = form;
      return { ...rest, submissionCount: _count.submissions };
    });
  }

  async getFormById(formId: string) {
    return prisma.form.findFirst({
      where: { id: formId, deletedAt: null },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
  }

  async updateForm(formId: string, input: UpdateFormInput) {
    return prisma.$transaction(async (tx) => {
      await tx.form.update({
        where: { id: formId },
        data: {
          name: input.name,
          description: input.description === undefined ? undefined : input.description,
          status: input.status,
          isPublic: input.isPublic,
          issueTemplate:
            input.issueTemplate === undefined
              ? undefined
              : input.issueTemplate === null
                ? Prisma.JsonNull
                : (input.issueTemplate as Prisma.InputJsonValue),
          settings:
            input.settings === undefined
              ? undefined
              : input.settings === null
                ? Prisma.JsonNull
                : (input.settings as Prisma.InputJsonValue),
        },
      });

      if (input.fields) {
        await tx.formField.deleteMany({ where: { formId } });
        if (input.fields.length > 0) {
          await tx.formField.createMany({
            data: input.fields.map((field, index) => this.toFieldRecord(formId, field, index)),
          });
        }
      }

      return tx.form.findUnique({
        where: { id: formId },
        include: { fields: { orderBy: { position: 'asc' } } },
      });
    });
  }

  async archiveForm(formId: string) {
    await prisma.form.update({
      where: { id: formId },
      data: { deletedAt: new Date() },
    });
  }

  async publishForm(formId: string) {
    return prisma.form.update({
      where: { id: formId },
      data: { status: 'published' },
    });
  }

  async createAccessToken(formId: string, token: string, createdBy: string, expiresAt?: Date) {
    return prisma.formAccessToken.create({
      data: {
        formId,
        token,
        createdBy,
        expiresAt,
      },
    });
  }

  async getValidAccessToken(formId: string, token: string) {
    return prisma.formAccessToken.findFirst({
      where: {
        formId,
        token,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  async touchAccessToken(id: string) {
    await prisma.formAccessToken.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async createSubmission(data: {
    formId: string;
    submittedBy?: string;
    payload: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdIssueId?: string | null;
  }) {
    return prisma.formSubmission.create({
      data: {
        formId: data.formId,
        submittedBy: data.submittedBy || null,
        payload: data.payload as Prisma.InputJsonValue,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        createdIssueId: data.createdIssueId || null,
      },
    });
  }

  async createSubmissionValues(
    submissionId: string,
    values: Array<{ fieldId: string; value: unknown }>
  ): Promise<void> {
    if (values.length === 0) {
      return;
    }
    await prisma.formSubmissionFieldValue.createMany({
      data: values.map((value) => ({
        submissionId,
        fieldId: value.fieldId,
        value: value.value as Prisma.InputJsonValue,
      })),
    });
  }

  async listSubmissions(formId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.formSubmission.findMany({
        where: { formId },
        include: {
          values: {
            include: {
              field: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.formSubmission.count({ where: { formId } }),
    ]);

    return { items, total };
  }

  private toFieldRecord(formId: string, field: FormFieldInput, index: number) {
    return {
      formId,
      fieldKey: field.fieldKey,
      label: field.label,
      fieldType: field.fieldType,
      isRequired: field.isRequired ?? false,
      position: field.position ?? index,
      placeholder: field.placeholder,
      helperText: field.helperText,
      options: field.options ? (field.options as unknown as Prisma.InputJsonValue) : undefined,
      validation: field.validation ? (field.validation as Prisma.InputJsonValue) : undefined,
      defaultValue:
        field.defaultValue === undefined
          ? undefined
          : (field.defaultValue as Prisma.InputJsonValue),
    };
  }
}

export const formsRepository = new FormsRepository();
