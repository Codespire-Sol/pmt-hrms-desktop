export type FormStatus = 'draft' | 'published' | 'archived';
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'datetime';

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldInput {
  fieldKey: string;
  label: string;
  fieldType: FormFieldType;
  isRequired?: boolean;
  position?: number;
  placeholder?: string;
  helperText?: string;
  options?: FormFieldOption[];
  validation?: Record<string, unknown>;
  defaultValue?: unknown;
}

export interface CreateFormInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  issueTemplate?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  fields?: FormFieldInput[];
}

export interface UpdateFormInput {
  name?: string;
  description?: string | null;
  status?: FormStatus;
  isPublic?: boolean;
  issueTemplate?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  fields?: FormFieldInput[];
}

export interface SubmitFormInput {
  payload: Record<string, unknown>;
  token?: string;
  metadata?: Record<string, unknown>;
}
