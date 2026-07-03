import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '../../lib/baseQuery';
import { ENV } from '../../lib/env';

const API_VERSION = ENV.API_VERSION;

export type ScreenOperation = 'create' | 'view' | 'edit' | 'transition';
export type FieldType = 'system' | 'custom';

export interface Screen {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenTab {
  id: string;
  screenId: string;
  name: string;
  position: number;
  fields?: ScreenTabField[];
}

export interface ScreenTabField {
  id: string;
  tabId: string;
  fieldId: string;
  fieldType: FieldType;
  position: number;
  isRequired: boolean;
  fieldName?: string;
  fieldLabel?: string;
}

export interface ScreenWithTabs extends Screen {
  tabs: (ScreenTab & { fields: ScreenTabField[] })[];
}

export interface ScreenScheme {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenSchemeItem {
  id: string;
  screenSchemeId: string;
  screenId: string;
  operation: ScreenOperation;
  screen?: Screen;
}

export interface ScreenSchemeWithItems extends ScreenScheme {
  items: ScreenSchemeItem[];
}

export interface IssueTypeScreenScheme {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IssueTypeScreenSchemeItem {
  id: string;
  issueTypeScreenSchemeId: string;
  issueTypeId?: string;
  screenSchemeId: string;
  issueType?: {
    id: string;
    name: string;
    displayName: string;
  };
  screenScheme?: ScreenScheme;
}

export interface IssueTypeScreenSchemeWithItems extends IssueTypeScreenScheme {
  items: IssueTypeScreenSchemeItem[];
}

export interface SystemField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
}

export interface CreateScreenInput {
  projectId?: string;
  name: string;
  description?: string;
}

export interface UpdateScreenInput {
  name?: string;
  description?: string;
}

export interface CreateTabInput {
  name: string;
  position?: number;
}

export interface AddFieldInput {
  fieldId: string;
  fieldType: FieldType;
  position?: number;
  isRequired?: boolean;
}

export interface CreateScreenSchemeInput {
  projectId?: string;
  name: string;
  description?: string;
  items?: { screenId: string; operation: ScreenOperation }[];
}

export interface CreateIssueTypeScreenSchemeInput {
  projectId?: string;
  name: string;
  description?: string;
  items?: { issueTypeId?: string; screenSchemeId: string }[];
}

export const screensApi = createApi({
  reducerPath: 'screensApi',
  baseQuery: createAuthBaseQuery(`/api/${API_VERSION}/screens`),
  tagTypes: ['Screen', 'ScreenScheme', 'IssueTypeScreenScheme', 'SystemField'],
  endpoints: (builder) => ({
    // System Fields
    getSystemFields: builder.query<SystemField[], void>({
      query: () => '/fields/system',
      transformResponse: (response: any) => response.data,
      providesTags: ['SystemField'],
    }),

    // Get screen for issue form
    getScreenForIssue: builder.query<ScreenWithTabs | null, { projectId: string; issueTypeId: string; operation: ScreenOperation }>({
      query: ({ projectId, issueTypeId, operation }) => ({
        url: '/for-issue',
        params: { projectId, issueTypeId, operation },
      }),
      transformResponse: (response: any) => response.data,
    }),

    // Screens
    getScreens: builder.query<Screen[], { projectId?: string }>({
      query: ({ projectId }) => ({
        url: '/',
        params: projectId ? { projectId } : undefined,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Screen'],
    }),

    getScreen: builder.query<ScreenWithTabs, string>({
      query: (screenId) => `/${screenId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Screen', id }],
    }),

    createScreen: builder.mutation<ScreenWithTabs, CreateScreenInput>({
      query: (data) => ({
        url: '/',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Screen'],
    }),

    updateScreen: builder.mutation<Screen, { screenId: string; data: UpdateScreenInput }>({
      query: ({ screenId, data }) => ({
        url: `/${screenId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { screenId }) => [{ type: 'Screen', id: screenId }, 'Screen'],
    }),

    deleteScreen: builder.mutation<void, string>({
      query: (screenId) => ({
        url: `/${screenId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Screen'],
    }),

    // Screen Tabs
    addScreenTab: builder.mutation<ScreenTab, { screenId: string; data: CreateTabInput }>({
      query: ({ screenId, data }) => ({
        url: `/${screenId}/tabs`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { screenId }) => [{ type: 'Screen', id: screenId }],
    }),

    updateScreenTab: builder.mutation<ScreenTab, { tabId: string; data: { name?: string; position?: number } }>({
      query: ({ tabId, data }) => ({
        url: `/tabs/${tabId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Screen'],
    }),

    deleteScreenTab: builder.mutation<void, string>({
      query: (tabId) => ({
        url: `/tabs/${tabId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Screen'],
    }),

    // Tab Fields
    addFieldToTab: builder.mutation<ScreenTabField, { tabId: string; data: AddFieldInput }>({
      query: ({ tabId, data }) => ({
        url: `/tabs/${tabId}/fields`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Screen'],
    }),

    updateTabField: builder.mutation<ScreenTabField, { fieldId: string; data: { position?: number; isRequired?: boolean } }>({
      query: ({ fieldId, data }) => ({
        url: `/fields/${fieldId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Screen'],
    }),

    removeFieldFromTab: builder.mutation<void, string>({
      query: (fieldId) => ({
        url: `/fields/${fieldId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Screen'],
    }),

    reorderTabFields: builder.mutation<void, { tabId: string; fieldIds: string[] }>({
      query: ({ tabId, fieldIds }) => ({
        url: `/tabs/${tabId}/fields/reorder`,
        method: 'POST',
        body: { fieldIds },
      }),
      invalidatesTags: ['Screen'],
    }),

    // Screen Schemes
    getScreenSchemes: builder.query<ScreenScheme[], { projectId?: string }>({
      query: ({ projectId }) => ({
        url: '/schemes',
        params: projectId ? { projectId } : undefined,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['ScreenScheme'],
    }),

    getScreenScheme: builder.query<ScreenSchemeWithItems, string>({
      query: (schemeId) => `/schemes/${schemeId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'ScreenScheme', id }],
    }),

    createScreenScheme: builder.mutation<ScreenSchemeWithItems, CreateScreenSchemeInput>({
      query: (data) => ({
        url: '/schemes',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['ScreenScheme'],
    }),

    updateScreenScheme: builder.mutation<ScreenScheme, { schemeId: string; data: { name?: string; description?: string } }>({
      query: ({ schemeId, data }) => ({
        url: `/schemes/${schemeId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { schemeId }) => [{ type: 'ScreenScheme', id: schemeId }, 'ScreenScheme'],
    }),

    deleteScreenScheme: builder.mutation<void, string>({
      query: (schemeId) => ({
        url: `/schemes/${schemeId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ScreenScheme'],
    }),

    setScreenSchemeItem: builder.mutation<ScreenSchemeWithItems, { schemeId: string; operation: ScreenOperation; screenId: string }>({
      query: ({ schemeId, operation, screenId }) => ({
        url: `/schemes/${schemeId}/items`,
        method: 'POST',
        body: { operation, screenId },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { schemeId }) => [{ type: 'ScreenScheme', id: schemeId }],
    }),

    // Issue Type Screen Schemes
    getIssueTypeScreenSchemes: builder.query<IssueTypeScreenScheme[], { projectId?: string }>({
      query: ({ projectId }) => ({
        url: '/issue-type-schemes',
        params: projectId ? { projectId } : undefined,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['IssueTypeScreenScheme'],
    }),

    getIssueTypeScreenScheme: builder.query<IssueTypeScreenSchemeWithItems, string>({
      query: (schemeId) => `/issue-type-schemes/${schemeId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'IssueTypeScreenScheme', id }],
    }),

    createIssueTypeScreenScheme: builder.mutation<IssueTypeScreenSchemeWithItems, CreateIssueTypeScreenSchemeInput>({
      query: (data) => ({
        url: '/issue-type-schemes',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['IssueTypeScreenScheme'],
    }),

    updateIssueTypeScreenScheme: builder.mutation<IssueTypeScreenScheme, { schemeId: string; data: { name?: string; description?: string } }>({
      query: ({ schemeId, data }) => ({
        url: `/issue-type-schemes/${schemeId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { schemeId }) => [{ type: 'IssueTypeScreenScheme', id: schemeId }, 'IssueTypeScreenScheme'],
    }),

    deleteIssueTypeScreenScheme: builder.mutation<void, string>({
      query: (schemeId) => ({
        url: `/issue-type-schemes/${schemeId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['IssueTypeScreenScheme'],
    }),

    setIssueTypeScreenSchemeItem: builder.mutation<IssueTypeScreenSchemeWithItems, { schemeId: string; issueTypeId: string | null; screenSchemeId: string }>({
      query: ({ schemeId, issueTypeId, screenSchemeId }) => ({
        url: `/issue-type-schemes/${schemeId}/items`,
        method: 'POST',
        body: { issueTypeId, screenSchemeId },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { schemeId }) => [{ type: 'IssueTypeScreenScheme', id: schemeId }],
    }),
  }),
});

export const {
  useGetSystemFieldsQuery,
  useGetScreenForIssueQuery,
  useLazyGetScreenForIssueQuery,
  // Screens
  useGetScreensQuery,
  useGetScreenQuery,
  useCreateScreenMutation,
  useUpdateScreenMutation,
  useDeleteScreenMutation,
  // Tabs
  useAddScreenTabMutation,
  useUpdateScreenTabMutation,
  useDeleteScreenTabMutation,
  // Fields
  useAddFieldToTabMutation,
  useUpdateTabFieldMutation,
  useRemoveFieldFromTabMutation,
  useReorderTabFieldsMutation,
  // Screen Schemes
  useGetScreenSchemesQuery,
  useGetScreenSchemeQuery,
  useCreateScreenSchemeMutation,
  useUpdateScreenSchemeMutation,
  useDeleteScreenSchemeMutation,
  useSetScreenSchemeItemMutation,
  // Issue Type Screen Schemes
  useGetIssueTypeScreenSchemesQuery,
  useGetIssueTypeScreenSchemeQuery,
  useCreateIssueTypeScreenSchemeMutation,
  useUpdateIssueTypeScreenSchemeMutation,
  useDeleteIssueTypeScreenSchemeMutation,
  useSetIssueTypeScreenSchemeItemMutation,
} = screensApi;
