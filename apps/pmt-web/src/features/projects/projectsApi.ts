import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string;
  ownerId: string;
  leadId?: string;
  category?: string;
  status: 'active' | 'archived' | 'on_hold' | 'completed';
  visibility: 'private' | 'internal' | 'public';
  startDate?: string;
  targetEndDate?: string;
  actualEndDate?: string;
  createdAt: string;
  updatedAt: string;
  statistics?: {
    totalIssues: number;
    openIssues: number;
    inProgressIssues: number;
    completedIssues: number;
    overdueIssues: number;
    dueSoonIssues: number;
    completionRate: number;
    totalSprints: number;
    activeSprints: number;
    completedSprints: number;
    memberCount: number;
  };
  overviewSummary?: {
    comments: any[];
    links: {
      id: string;
      title: string;
      url: string;
      type: string;
    }[];
  };
  owner?: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  lead?: {
    id: string;
    email?: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  projectType?: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    color: string;
    icon: string;
  };
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
  leadId?: string;
  category?: string;
  categoryId?: string;
  visibility?: 'private' | 'internal' | 'public';
  startDate?: string;
  targetEndDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  leadId?: string;
  category?: string;
  status?: 'active' | 'archived' | 'on_hold' | 'completed';
  visibility?: 'private' | 'internal' | 'public';
  startDate?: string;
  targetEndDate?: string;
  actualEndDate?: string;
  overviewComments?: { content: string }[];
  overviewLinks?: { title: string; url: string; description?: string }[];
}

export interface ProjectCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon: string;
  isActive: boolean;
  position: number;
  projectCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  position?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  position?: number;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'admin' | 'lead' | 'member' | 'viewer';
  joinedAt: string;
  pmtRole: { id: string; displayName: string } | null;
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface ProjectContext {
  members: ProjectMember[];
  labels: Array<{ id: string; name: string; color: string; description?: string }>;
  versions: any[];
  epics: any[];
  workflow: any | null;
}

export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Project', 'ProjectMember', 'ProjectCategory'],
  endpoints: (builder) => ({
    // Categories
    getCategories: builder.query<ProjectCategory[], { includeInactive?: boolean; withProjectCount?: boolean }>({
      query: (params) => ({
        url: '/projects/categories',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['ProjectCategory'],
    }),
    getCategory: builder.query<ProjectCategory, string>({
      query: (id) => `/projects/categories/${id}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'ProjectCategory', id }],
    }),
    createCategory: builder.mutation<ProjectCategory, CreateCategoryInput>({
      query: (body) => ({
        url: '/projects/categories',
        method: 'POST',
        body,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['ProjectCategory'],
    }),
    updateCategory: builder.mutation<ProjectCategory, { id: string; data: UpdateCategoryInput }>({
      query: ({ id, data }) => ({
        url: `/projects/categories/${id}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['ProjectCategory'],
    }),
    deleteCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/projects/categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ProjectCategory'],
    }),
    reorderCategories: builder.mutation<void, string[]>({
      query: (categoryIds) => ({
        url: '/projects/categories/reorder',
        method: 'PUT',
        body: { categoryIds },
      }),
      invalidatesTags: ['ProjectCategory'],
    }),
    toggleCategoryActive: builder.mutation<ProjectCategory, { id: string; isActive: boolean }>({
      query: ({ id, isActive }) => ({
        url: `/projects/categories/${id}/toggle`,
        method: 'PUT',
        body: { isActive },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['ProjectCategory'],
    }),

    // Projects
    getProjects: builder.query<{ projects: Project[]; pagination: any }, { status?: string; search?: string; page?: number; memberId?: string }>({
      query: (params) => ({
        url: '/projects',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Project'],
    }),
    getProject: builder.query<Project, string>({
      query: (projectId) => `/projects/${projectId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Project', id }],
    }),
    createProject: builder.mutation<Project, CreateProjectInput>({
      query: (body) => ({
        url: '/projects',
        method: 'POST',
        body,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Project'],
    }),
    updateProject: builder.mutation<Project, { projectId: string; data: UpdateProjectInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Project', id: projectId }],
    }),
    archiveProject: builder.mutation<{ message: string }, string>({
      query: (projectId) => ({
        url: `/projects/${projectId}/archive`,
        method: 'POST',
      }),
      transformResponse: (response: any) => response,
      invalidatesTags: (_result, _error, projectId) => [{ type: 'Project', id: projectId }],
    }),
    deleteProject: builder.mutation<void, string>({
      query: (projectId) => ({
        url: `/projects/${projectId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Project'],
    }),
    getProjectMembers: builder.query<ProjectMember[], string>({
      query: (projectId) => `/projects/${projectId}/members`,
      transformResponse: (response: any) => response.data.members,
      providesTags: ['ProjectMember'],
    }),
    addProjectMember: builder.mutation<ProjectMember, { projectId: string; userId?: string; email?: string; role: string }>({
      query: ({ projectId, userId, email, role }) => ({
        url: `/projects/${projectId}/members`,
        method: 'POST',
        body: { userId, email, role },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['ProjectMember'],
    }),
    removeProjectMember: builder.mutation<void, { projectId: string; memberId: string }>({
      query: ({ projectId, memberId }) => ({
        url: `/projects/${projectId}/members/${memberId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ProjectMember'],
    }),
    updateMemberRole: builder.mutation<ProjectMember, { projectId: string; memberId: string; role: string }>({
      query: ({ projectId, memberId, role }) => ({
        url: `/projects/${projectId}/members/${memberId}`,
        method: 'PATCH',
        body: { role },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['ProjectMember'],
    }),
    assignWorkflowScheme: builder.mutation<void, { projectId: string; workflowSchemeId: string }>({
      query: ({ projectId, workflowSchemeId }) => ({
        url: `/projects/${projectId}/workflow-schemes/assign`,
        method: 'POST',
        body: { workflowSchemeId },
      }),
      invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Project', id: projectId }],
    }),
    getProjectContext: builder.query<ProjectContext, string>({
      query: (projectId) => `/projects/${projectId}/context`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, projectId) => [
        { type: 'Project', id: projectId },
        'ProjectMember',
      ],
    }),
  }),
});

export const {
  // Categories
  useGetCategoriesQuery,
  useGetCategoryQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useReorderCategoriesMutation,
  useToggleCategoryActiveMutation,
  // Projects
  useGetProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useArchiveProjectMutation,
  useDeleteProjectMutation,
  useGetProjectMembersQuery,
  useAddProjectMemberMutation,
  useRemoveProjectMemberMutation,
  useUpdateMemberRoleMutation,
  useAssignWorkflowSchemeMutation,
  useGetProjectContextQuery,
} = projectsApi;
