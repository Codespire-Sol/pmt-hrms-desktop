export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'user';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

export interface FieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface CustomField {
  id: string;
  projectId: string;
  name: string;
  fieldKey: string;
  description: string | null;
  fieldType: CustomFieldType;
  options: { options: SelectOption[] } | null;
  validation: FieldValidation | null;
  defaultValue: any;
  isRequired: boolean;
  isFilterable: boolean;
  isVisibleInList: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldValue {
  id: string;
  issueId: string;
  customFieldId: string;
  value: any;
  createdAt: string;
  updatedAt: string;
  field?: CustomField;
}

export interface CreateCustomFieldInput {
  name: string;
  fieldKey: string;
  description?: string;
  fieldType: CustomFieldType;
  options?: SelectOption[];
  validation?: FieldValidation;
  defaultValue?: any;
  isRequired?: boolean;
  isFilterable?: boolean;
  isVisibleInList?: boolean;
  position?: number;
}

export interface UpdateCustomFieldInput {
  name?: string;
  description?: string;
  options?: SelectOption[];
  validation?: FieldValidation;
  defaultValue?: any;
  isRequired?: boolean;
  isFilterable?: boolean;
  isVisibleInList?: boolean;
  position?: number;
}

export interface SetCustomFieldValueInput {
  customFieldId: string;
  value: any;
}

export interface CustomFieldWithValue extends CustomField {
  value: any;
}
