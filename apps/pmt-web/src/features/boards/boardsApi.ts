import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';

export interface BoardColumn {
  id: string;
  name: string;
  displayName: string;
  color: string;
  category: string;
  position: number;
  wipLimit?: number | null;
  isFinal?: boolean;
  isInitial?: boolean;
  statuses?: { id: string; name: string; displayName: string; color: string }[];
  issues: any[];
}

export interface Swimlane {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  avatarUrl?: string;
  issueCount: number;
  columns: BoardColumn[];
}

export type SwimlaneGroupBy = 'none' | 'assignee' | 'priority' | 'type' | 'epic' | 'sprint';
export type BoardViewType = 'kanban' | 'list' | 'timeline';

export interface BoardQueryParams {
  view?: BoardViewType;
  swimlane?: SwimlaneGroupBy;
  assigneeIds?: string[];
  typeIds?: string[];
  priorityIds?: string[];
  labelIds?: string[];
  sprintId?: string;
  epicId?: string;
  search?: string;
}

export interface ActiveSprint {
  id: string;
  name: string;
  goal?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  totalIssues: number;
  completedIssues: number;
}

export interface BoardData {
  project: {
    id: string;
    key: string;
    name: string;
  };
  activeSprint?: ActiveSprint | null;
  columns?: BoardColumn[];
  swimlanes?: Swimlane[];
  swimlaneGroupBy?: SwimlaneGroupBy;
  viewType?: BoardViewType;
  filters: {
    assignees: any[];
    types: any[];
    priorities: any[];
    labels: any[];
    sprints?: any[];
    epics?: any[];
  };
}

export interface CreateBoardColumnInput {
  projectId: string;
  displayName: string;
  name?: string;
  description?: string;
  color?: string;
  category?: string;
  wipLimit?: number | null;
}

export interface ReorderBoardColumnsInput {
  projectId: string;
  statusIds: string[];
}

export interface ReorderedBoardColumn {
  id: string;
  position: number;
}

export const boardsApi = createApi({
  reducerPath: 'boardsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Board'],
  endpoints: (builder) => ({
    getBoard: builder.query<BoardData, { projectId: string; params?: BoardQueryParams }>({
      query: ({ projectId, params }) => ({
        url: `/projects/${projectId}/board`,
        params: params ? {
          view: params.view,
          swimlane: params.swimlane,
          assigneeIds: params.assigneeIds?.join(','),
          typeIds: params.typeIds?.join(','),
          priorityIds: params.priorityIds?.join(','),
          labelIds: params.labelIds?.join(','),
          sprintId: params.sprintId,
          epicId: params.epicId,
          search: params.search,
        } : undefined,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Board'],
    }),
    updateWipLimit: builder.mutation<any, { projectId: string; statusId: string; wipLimit: number | null }>({
      query: ({ projectId, statusId, wipLimit }) => ({
        url: `/projects/${projectId}/board/columns/${statusId}`,
        method: 'PATCH',
        body: { wipLimit },
      }),
      invalidatesTags: ['Board'],
    }),
    createBoardColumn: builder.mutation<BoardColumn, CreateBoardColumnInput>({
      query: ({ projectId, ...body }) => ({
        url: `/projects/${projectId}/board/columns`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Board'],
    }),
    updateBoardColumn: builder.mutation<any, { projectId: string; statusId: string; data: Partial<BoardColumn> }>({
      query: ({ projectId, statusId, data }) => ({
        url: `/projects/${projectId}/board/columns/${statusId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Board'],
    }),
    deleteBoardColumn: builder.mutation<any, { projectId: string; statusId: string }>({
      query: ({ projectId, statusId }) => ({
        url: `/projects/${projectId}/board/columns/${statusId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Board'],
    }),
    reorderBoardColumns: builder.mutation<ReorderedBoardColumn[], ReorderBoardColumnsInput>({
      query: ({ projectId, statusIds }) => ({
        url: `/projects/${projectId}/board/columns/reorder`,
        method: 'POST',
        body: { statusIds },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Board'],
    }),
    checkWipLimit: builder.query<{ canAdd: boolean; wipLimit: number | null; currentCount: number }, { projectId: string; statusId: string }>({
      query: ({ projectId, statusId }) => `/projects/${projectId}/board/columns/${statusId}/wip-check`,
      transformResponse: (response: any) => response.data,
    }),
  }),
});

export const {
  useGetBoardQuery,
  useUpdateWipLimitMutation,
  useCreateBoardColumnMutation,
  useUpdateBoardColumnMutation,
  useDeleteBoardColumnMutation,
  useReorderBoardColumnsMutation,
  useCheckWipLimitQuery,
  useLazyCheckWipLimitQuery,
} = boardsApi;
