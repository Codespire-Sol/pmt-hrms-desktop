import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';

// Types
export type WipLimitType = 'soft' | 'hard';

export interface ColumnWipLimit {
  columnId: string;
  wipLimit: number | null;
  wipLimitEnabled: boolean;
  wipLimitType: WipLimitType;
}

export interface BoardSettings {
  id: string;
  boardId: string;
  wipLimitsEnabled: boolean;
  defaultWipType: WipLimitType;
  showWipWarnings: boolean;
  trackWipViolations: boolean;
  swimlaneWipLimits: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface WipLimitStatus {
  columnId: string;
  columnName: string;
  wipLimit: number | null;
  wipLimitType: WipLimitType;
  currentCount: number;
  isOverLimit: boolean;
  canAdd: boolean;
  warningMessage?: string;
}

export interface BoardWipStatus {
  boardId: string;
  wipLimitsEnabled: boolean;
  columns: WipLimitStatus[];
  hasViolations: boolean;
}

export interface WipLimitViolation {
  id: string;
  boardId: string;
  columnId: string;
  issueId: string;
  userId: string;
  action: 'override' | 'blocked';
  limitAtTime: number;
  countAtTime: number;
  reason?: string;
  createdAt: string;
}

export interface CanMoveResult {
  canMove: boolean;
  warningMessage?: string;
  requiresOverride: boolean;
}

// Input types
export interface UpdateBoardSettingsInput {
  wipLimitsEnabled?: boolean;
  defaultWipType?: WipLimitType;
  showWipWarnings?: boolean;
  trackWipViolations?: boolean;
  swimlaneWipLimits?: Record<string, number>;
}

export interface UpdateColumnWipLimitInput {
  wipLimit?: number | null;
  wipLimitEnabled?: boolean;
  wipLimitType?: WipLimitType;
}

interface SingleResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: {
    violations: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export const wipLimitsApi = createApi({
  reducerPath: 'wipLimitsApi',
  baseQuery: createAuthBaseQuery('/api/v1/wip'),
  tagTypes: ['BoardSettings', 'ColumnWipLimits', 'WipStatus', 'WipViolations'],
  endpoints: (builder) => ({
    // Board Settings
    getBoardSettings: builder.query<BoardSettings | null, string>({
      query: (boardId) => `/boards/${boardId}/wip-settings`,
      transformResponse: (response: SingleResponse<BoardSettings | null>) => response.data,
      providesTags: (_, __, boardId) => [{ type: 'BoardSettings', id: boardId }],
    }),

    updateBoardSettings: builder.mutation<
      BoardSettings,
      { boardId: string; input: UpdateBoardSettingsInput }
    >({
      query: ({ boardId, input }) => ({
        url: `/boards/${boardId}/wip-settings`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (response: SingleResponse<BoardSettings>) => response.data,
      invalidatesTags: (_, __, { boardId }) => [
        { type: 'BoardSettings', id: boardId },
        { type: 'WipStatus', id: boardId },
      ],
    }),

    // Column WIP Limits
    getColumnWipLimits: builder.query<ColumnWipLimit[], string>({
      query: (boardId) => `/boards/${boardId}/wip-limits`,
      transformResponse: (response: SingleResponse<ColumnWipLimit[]>) => response.data,
      providesTags: (_, __, boardId) => [{ type: 'ColumnWipLimits', id: boardId }],
    }),

    updateColumnWipLimit: builder.mutation<
      ColumnWipLimit,
      { columnId: string; boardId: string; input: UpdateColumnWipLimitInput }
    >({
      query: ({ columnId, input }) => ({
        url: `/columns/${columnId}/wip-limit`,
        method: 'PATCH',
        body: input,
      }),
      transformResponse: (response: SingleResponse<ColumnWipLimit>) => response.data,
      invalidatesTags: (_, __, { boardId }) => [
        { type: 'ColumnWipLimits', id: boardId },
        { type: 'WipStatus', id: boardId },
      ],
    }),

    // WIP Status
    getBoardWipStatus: builder.query<BoardWipStatus, string>({
      query: (boardId) => `/boards/${boardId}/wip-status`,
      transformResponse: (response: SingleResponse<BoardWipStatus>) => response.data,
      providesTags: (_, __, boardId) => [{ type: 'WipStatus', id: boardId }],
    }),

    checkCanMoveIssue: builder.query<
      CanMoveResult,
      { boardId: string; toColumnId: string; fromColumnId?: string }
    >({
      query: ({ boardId, toColumnId, fromColumnId }) => ({
        url: `/boards/${boardId}/can-move`,
        params: { toColumnId, fromColumnId },
      }),
      transformResponse: (response: SingleResponse<CanMoveResult>) => response.data,
    }),

    // Violations
    getViolations: builder.query<
      { violations: WipLimitViolation[]; pagination: any },
      { boardId: string; columnId?: string; page?: number; limit?: number }
    >({
      query: ({ boardId, ...params }) => ({
        url: `/boards/${boardId}/wip-violations`,
        params,
      }),
      transformResponse: (response: PaginatedResponse<WipLimitViolation>) => ({
        violations: response.data.violations,
        pagination: response.data.pagination,
      }),
      providesTags: (_, __, { boardId }) => [{ type: 'WipViolations', id: boardId }],
    }),
  }),
});

export const {
  useGetBoardSettingsQuery,
  useUpdateBoardSettingsMutation,
  useGetColumnWipLimitsQuery,
  useUpdateColumnWipLimitMutation,
  useGetBoardWipStatusQuery,
  useCheckCanMoveIssueQuery,
  useLazyCheckCanMoveIssueQuery,
  useGetViolationsQuery,
} = wipLimitsApi;
