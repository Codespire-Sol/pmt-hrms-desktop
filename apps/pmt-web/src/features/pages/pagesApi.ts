import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';

export interface PageCreator {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface Page {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  content?: string | null;
  contentHtml?: string | null;
  parentId?: string | null;
  position: number;
  createdBy: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  children?: Page[];
  creator?: PageCreator;
}

export interface CreatePageInput {
  title: string;
  content?: string;
  parentId?: string;
  isPublished?: boolean;
}

export interface UpdatePageInput {
  title?: string;
  content?: string;
  contentHtml?: string;
  isPublished?: boolean;
}

export interface ReorderPageInput {
  parentId?: string | null;
  position: number;
}

export interface PageFilters {
  search?: string;
  isPublished?: boolean;
}

export const pagesApi = createApi({
  reducerPath: 'pagesApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Page'],
  endpoints: (builder) => ({
    getProjectPages: builder.query<Page[], { projectId: string; filters?: PageFilters }>({
      query: ({ projectId, filters }) => ({
        url: `/projects/${projectId}/pages`,
        params: filters,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Page'],
    }),
    getPage: builder.query<Page, string>({
      query: (pageId) => `/pages/${pageId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Page', id }],
    }),
    createPage: builder.mutation<Page, { projectId: string; data: CreatePageInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/pages`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Page'],
    }),
    updatePage: builder.mutation<Page, { pageId: string; data: UpdatePageInput }>({
      query: ({ pageId, data }) => ({
        url: `/pages/${pageId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { pageId }) => [
        { type: 'Page', id: pageId },
        'Page',
      ],
    }),
    deletePage: builder.mutation<void, string>({
      query: (pageId) => ({
        url: `/pages/${pageId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Page'],
    }),
    reorderPage: builder.mutation<Page, { pageId: string; data: ReorderPageInput }>({
      query: ({ pageId, data }) => ({
        url: `/pages/${pageId}/reorder`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Page'],
    }),
  }),
});

export const {
  useGetProjectPagesQuery,
  useGetPageQuery,
  useCreatePageMutation,
  useUpdatePageMutation,
  useDeletePageMutation,
  useReorderPageMutation,
} = pagesApi;
