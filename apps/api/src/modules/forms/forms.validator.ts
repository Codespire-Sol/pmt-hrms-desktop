import { z } from 'zod';

const fieldOptionSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
});

export const formFieldSchema = z.object({
  fieldKey: z.string().min(1).max(100).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(200),
  fieldType: z.enum([
    'text',
    'textarea',
    'number',
    'email',
    'select',
    'multiselect',
    'checkbox',
    'radio',
    'date',
    'datetime',
  ]),
  isRequired: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  placeholder: z.string().max(255).optional(),
  helperText: z.string().max(500).optional(),
  options: z.array(fieldOptionSchema).optional(),
  validation: z.record(z.unknown()).optional(),
  defaultValue: z.unknown().optional(),
});

export const createFormSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
  issueTemplate: z.record(z.unknown()).optional(),
  settings: z.record(z.unknown()).optional(),
  fields: z.array(formFieldSchema).optional(),
});

export const updateFormSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  isPublic: z.boolean().optional(),
  issueTemplate: z.record(z.unknown()).nullable().optional(),
  settings: z.record(z.unknown()).nullable().optional(),
  fields: z.array(formFieldSchema).optional(),
});

export const submitFormSchema = z.object({
  payload: z.record(z.unknown()),
  token: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createFormAccessTokenSchema = z.object({
  expiresAt: z.string().datetime().optional(),
});
