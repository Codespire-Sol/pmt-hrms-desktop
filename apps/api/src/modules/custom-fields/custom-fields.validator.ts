import { z } from 'zod';

const selectOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  color: z.string().optional(),
});

const fieldValidationSchema = z.object({
  required: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
});

export const createCustomFieldSchema = z.object({
  name: z.string().min(1).max(100),
  fieldKey: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, {
      message:
        'Field key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores',
    }),
  description: z.string().max(500).optional(),
  fieldType: z.enum([
    'text',
    'number',
    'date',
    'datetime',
    'select',
    'multiselect',
    'checkbox',
    'url',
    'email',
    'user',
  ]),
  options: z.array(selectOptionSchema).optional(),
  validation: fieldValidationSchema.optional(),
  defaultValue: z.any().optional(),
  isRequired: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isVisibleInList: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const updateCustomFieldSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  options: z.array(selectOptionSchema).optional(),
  validation: fieldValidationSchema.optional().nullable(),
  defaultValue: z.any().optional(),
  isRequired: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isVisibleInList: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const setFieldValueSchema = z.object({
  value: z.any(),
});

export const setFieldValuesSchema = z.object({
  values: z.array(
    z.object({
      customFieldId: z.string().uuid(),
      value: z.any(),
    })
  ),
});

export const reorderFieldsSchema = z.object({
  fieldIds: z.array(z.string().uuid()),
});
