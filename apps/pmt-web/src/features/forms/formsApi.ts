import { createApi } from "@reduxjs/toolkit/query/react";
import { authBaseQuery } from "@/lib/baseQuery";

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

const unwrap = <T>(response: ApiEnvelope<T> | T): T => {
  if (
    response &&
    typeof response === "object" &&
    "data" in (response as ApiEnvelope<T>)
  ) {
    return (response as ApiEnvelope<T>).data as T;
  }
  return response as T;
};

export const FORM_FIELD_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;
export const FORM_FIELD_KEY_MAX_LENGTH = 100;
export const FORM_NAME_MAX_LENGTH = 200;
export const FORM_DESCRIPTION_MAX_LENGTH = 2000;
export const FORM_TOKEN_MAX_LENGTH = 128;

export type FormStatus = "draft" | "published" | "archived" | string;
export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "select"
  | "multiselect"
  | "checkbox"
  | "radio"
  | "date"
  | "datetime";

export const ALLOWED_FORM_FIELD_TYPES: FormFieldType[] = [
  "text",
  "textarea",
  "number",
  "email",
  "select",
  "multiselect",
  "checkbox",
  "radio",
  "date",
  "datetime",
];

export const isAllowedFormFieldType = (
  fieldType?: string,
): fieldType is FormFieldType =>
  !!fieldType && ALLOWED_FORM_FIELD_TYPES.includes(fieldType as FormFieldType);

export const isValidFormFieldKey = (fieldKey?: string): fieldKey is string =>
  !!fieldKey &&
  fieldKey.length <= FORM_FIELD_KEY_MAX_LENGTH &&
  FORM_FIELD_KEY_REGEX.test(fieldKey);

export const isValidFormName = (name?: string): name is string =>
  !!name &&
  name.trim().length > 0 &&
  name.trim().length <= FORM_NAME_MAX_LENGTH;

export const isValidFormDescription = (description?: string): boolean =>
  (description || "").trim().length <= FORM_DESCRIPTION_MAX_LENGTH;

export const isValidFormToken = (token?: string): boolean =>
  !token || token.length <= FORM_TOKEN_MAX_LENGTH;

export const isIsoDateTimeString = (value?: string): boolean =>
  !value || !Number.isNaN(Date.parse(value));

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id?: string;
  formId?: string;
  fieldKey: string;
  label: string;
  fieldType: FormFieldType;
  isRequired?: boolean;
  position?: number;
  options?: FormFieldOption[];
  placeholder?: string;
  helpText?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface FormIssueTemplate {
  enabled?: boolean;
  typeId?: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string;
  titleFieldKey?: string;
  descriptionFieldKey?: string;
}

export interface FormSettings {
  allowAnonymous?: boolean;
  [key: string]: unknown;
}

export interface ProjectForm {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: FormStatus;
  isPublic: boolean;
  settings?: FormSettings;
  issueTemplate?: FormIssueTemplate;
  fields: FormField[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  publishedAt?: string | null;
  submissionCount?: number;
}

export interface CreateFormInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  settings?: FormSettings;
  issueTemplate?: FormIssueTemplate;
  fields: FormField[];
}

export interface UpdateFormInput {
  name?: string;
  description?: string;
  status?: FormStatus;
  isPublic?: boolean;
  settings?: FormSettings;
  issueTemplate?: FormIssueTemplate;
  fields?: FormField[];
}

export interface FormAccessToken {
  id: string;
  formId: string;
  token: string;
  createdBy?: string;
  expiresAt?: string | null;
  isActive?: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  revokedAt?: string | null;
}

export interface SubmitFormInput {
  formId: string;
  payload: Record<string, unknown>;
  token?: string;
  metadata?: Record<string, unknown>;
  tokenInHeader?: boolean;
}

export interface FormSubmissionFieldValue {
  id: string;
  submissionId: string;
  fieldId: string;
  value: unknown;
  field?: {
    id: string;
    fieldKey: string;
    label: string;
    fieldType: FormFieldType;
  };
}

export interface FormSubmission {
  id: string;
  formId: string;
  submittedBy?: string | null;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdIssueId?: string | null;
  createdAt: string;
  updatedAt?: string;
  values?: FormSubmissionFieldValue[];
}

export interface FormSubmissionsResponse {
  submissions: FormSubmission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const formsApi = createApi({
  reducerPath: "formsApi",
  baseQuery: authBaseQuery,
  tagTypes: ["Form", "FormSubmission"],
  endpoints: (builder) => ({
    getForms: builder.query<ProjectForm[], string>({
      query: (projectId) => `/projects/${projectId}/forms`,
      transformResponse: (
        response:
          | ApiEnvelope<ProjectForm[] | { forms: ProjectForm[] }>
          | ProjectForm[],
      ) => {
        const data = unwrap<any>(response);
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.forms)) return data.forms;
        return [];
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((form) => ({ type: "Form" as const, id: form.id })),
              { type: "Form", id: "LIST" },
            ]
          : [{ type: "Form", id: "LIST" }],
    }),

    getForm: builder.query<ProjectForm, string>({
      query: (formId) => `/forms/${formId}`,
      transformResponse: (response: ApiEnvelope<ProjectForm> | ProjectForm) =>
        unwrap<ProjectForm>(response),
      providesTags: (_result, _error, formId) => [{ type: "Form", id: formId }],
    }),

    createForm: builder.mutation<
      ProjectForm,
      { projectId: string; data: CreateFormInput }
    >({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/forms`,
        method: "POST",
        body: data,
      }),
      transformResponse: (response: ApiEnvelope<ProjectForm> | ProjectForm) =>
        unwrap<ProjectForm>(response),
      invalidatesTags: [{ type: "Form", id: "LIST" }],
    }),

    updateForm: builder.mutation<
      ProjectForm,
      { formId: string; data: UpdateFormInput }
    >({
      query: ({ formId, data }) => ({
        url: `/forms/${formId}`,
        method: "PATCH",
        body: data,
      }),
      transformResponse: (response: ApiEnvelope<ProjectForm> | ProjectForm) =>
        unwrap<ProjectForm>(response),
      invalidatesTags: (_result, _error, { formId }) => [
        { type: "Form", id: formId },
        { type: "Form", id: "LIST" },
      ],
    }),

    deleteForm: builder.mutation<{ message?: string }, string>({
      query: (formId) => ({
        url: `/forms/${formId}`,
        method: "DELETE",
      }),
      transformResponse: (
        response: ApiEnvelope<{ message?: string }> | { message?: string },
      ) => unwrap<{ message?: string }>(response),
      invalidatesTags: (_result, _error, formId) => [
        { type: "Form", id: formId },
        { type: "Form", id: "LIST" },
      ],
    }),

    publishForm: builder.mutation<ProjectForm, string>({
      query: (formId) => ({
        url: `/forms/${formId}/publish`,
        method: "POST",
      }),
      transformResponse: (response: ApiEnvelope<ProjectForm> | ProjectForm) =>
        unwrap<ProjectForm>(response),
      invalidatesTags: (_result, _error, formId) => [
        { type: "Form", id: formId },
        { type: "Form", id: "LIST" },
      ],
    }),

    createAccessToken: builder.mutation<
      FormAccessToken,
      { formId: string; expiresAt?: string }
    >({
      query: ({ formId, expiresAt }) => {
        if (expiresAt && !isIsoDateTimeString(expiresAt)) {
          throw new Error("expiresAt must be an ISO datetime string.");
        }

        return {
          url: `/forms/${formId}/access-tokens`,
          method: "POST",
          body: expiresAt ? { expiresAt } : {},
        };
      },
      transformResponse: (
        response: ApiEnvelope<FormAccessToken> | FormAccessToken,
      ) => unwrap<FormAccessToken>(response),
    }),

    submitForm: builder.mutation<FormSubmission, SubmitFormInput>({
      query: ({ formId, payload, token, metadata, tokenInHeader }) => {
        if (token && !isValidFormToken(token)) {
          throw new Error(
            `token must be ${FORM_TOKEN_MAX_LENGTH} characters or fewer.`,
          );
        }

        const body: {
          payload: Record<string, unknown>;
          metadata?: Record<string, unknown>;
          token?: string;
        } = { payload };

        if (metadata) {
          body.metadata = metadata;
        }

        if (token && !tokenInHeader) {
          body.token = token;
        }

        return {
          url: `/forms/${formId}/submissions`,
          method: "POST",
          body,
          headers:
            tokenInHeader && token ? { "x-form-token": token } : undefined,
        };
      },
      transformResponse: (
        response: ApiEnvelope<FormSubmission> | FormSubmission,
      ) => unwrap<FormSubmission>(response),
      invalidatesTags: (_result, _error, { formId }) => [
        { type: "FormSubmission", id: formId },
        { type: "Form", id: formId },
        { type: "Form", id: "LIST" },
      ],
    }),

    getSubmissions: builder.query<
      FormSubmissionsResponse,
      { formId: string; page?: number; limit?: number }
    >({
      query: ({ formId, page = 1, limit = 20 }) => ({
        url: `/forms/${formId}/submissions`,
        params: { page, limit },
      }),
      transformResponse: (
        response:
          | ApiEnvelope<FormSubmissionsResponse>
          | FormSubmissionsResponse,
      ) => {
        const data = unwrap<any>(response) || {};
        return {
          submissions: Array.isArray(data.submissions) ? data.submissions : [],
          pagination: data.pagination || {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        };
      },
      providesTags: (_result, _error, { formId }) => [
        { type: "FormSubmission", id: formId },
      ],
    }),
  }),
});

export const {
  useGetFormsQuery,
  useGetFormQuery,
  useCreateFormMutation,
  useUpdateFormMutation,
  useDeleteFormMutation,
  usePublishFormMutation,
  useCreateAccessTokenMutation,
  useSubmitFormMutation,
  useGetSubmissionsQuery,
} = formsApi;
