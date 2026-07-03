import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';
import { issuesApi } from '../issues/issuesApi';
import { boardsApi } from '../boards/boardsApi';
import { dashboardApi } from '../dashboard/dashboardApi';

export interface SprintProgress {
  totalIssues: number;
  completedIssues: number;
  percentComplete: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
}

export interface SprintIssue {
  id: string;
  issueKey: string;
  title: string;
  storyPoints?: number;
  dueDate?: string;
  epicId?: string;
  sprintId?: string;
  type: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  status: {
    id: string;
    name: string;
    displayName: string;
    color: string;
    category: string;
  };
  priority?: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
  };
  assignee?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  epic?: {
    id: string;
    name: string;
    color?: string;
  };
}

export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  capacityHours?: number;
  sequence: number;
  progress?: SprintProgress;
  daysRemaining?: number | null;
  issues?: SprintIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface BurndownPoint {
  date: string;
  idealRemaining: number;
  actualRemaining: number | null;
  completed: number;
}

export interface BurndownData {
  sprint: {
    name: string;
    startDate: string;
    endDate: string;
  };
  totalPoints: number;
  burndown: BurndownPoint[];
  projectedCompletion?: string;
  isOnTrack: boolean;
}

export interface BurnupPoint {
  date: string;
  totalScope: number;
  completedPoints: number;
  idealProgress: number;
}

export interface BurnupScopeChange {
  date: string;
  added: number;
  removed: number;
}

export interface BurnupData {
  sprint: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  totalPoints: number;
  completedPoints: number;
  burnup: BurnupPoint[];
  scopeChanges: BurnupScopeChange[];
  projectedCompletion?: string;
  isOnTrack: boolean;
}

export interface VelocitySprintData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  committedPoints: number;
  completedPoints: number;
  completionRate: number;
}

export interface VelocityData {
  sprints: VelocitySprintData[];
  averageVelocity: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface BacklogIssue {
  id: string;
  issueKey: string;
  title: string;
  storyPoints?: number;
  position: number;
  dueDate?: string;
  epicId?: string;
  parentId?: string | null;
  sprintId?: string | null;
  type: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  status?: {
    id: string;
    name: string;
    displayName?: string;
    color?: string;
    category?: string;
  };
  priority?: {
    id: string;
    name: string;
    displayName: string;
    icon: string;
    color: string;
  };
  assignee?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  epic?: {
    id: string;
    name: string;
    color?: string;
  };
}

export interface CreateSprintInput {
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  capacityHours?: number;
}

export interface CompleteSprintInput {
  incompleteIssueAction: 'move_to_backlog' | 'move_to_next_sprint';
  nextSprintId?: string;
  retrospectiveNotes?: string;
}

export interface OverCommitmentInfo {
  sprintId: string;
  sprintName: string;
  totalStoryPoints: number;
  averageVelocity: number;
  overCommitmentPercentage: number;
  warningLevel: 'none' | 'moderate' | 'severe';
  message: string;
  recommendation?: string;
}

export interface BacklogQueryParams {
  search?: string;
  statusId?: string;
  priorityId?: string;
  typeId?: string;
  assigneeId?: string;
  epicId?: string;
  minStoryPoints?: number;
  maxStoryPoints?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

type ApiSprint = Partial<Sprint> & {
  id: string;
  name: string;
  status: Sprint['status'];
  sequence: number;
  project_id?: string;
  start_date?: string;
  end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  capacity_hours?: number;
  created_at?: string;
  updated_at?: string;
  days_remaining?: number | null;
};

const mapSprintFromApi = (sprint: ApiSprint): Sprint => ({
  id: sprint.id,
  name: sprint.name,
  goal: sprint.goal,
  status: sprint.status,
  startDate: sprint.startDate ?? sprint.start_date,
  endDate: sprint.endDate ?? sprint.end_date,
  actualStartDate: sprint.actualStartDate ?? sprint.actual_start_date,
  actualEndDate: sprint.actualEndDate ?? sprint.actual_end_date,
  capacityHours: sprint.capacityHours ?? sprint.capacity_hours,
  sequence: sprint.sequence,
  progress: sprint.progress,
  daysRemaining: sprint.daysRemaining ?? sprint.days_remaining ?? null,
  issues: sprint.issues,
  createdAt: sprint.createdAt ?? sprint.created_at ?? '',
  updatedAt: sprint.updatedAt ?? sprint.updated_at ?? '',
});

export const sprintsApi = createApi({
  reducerPath: 'sprintsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Sprint', 'Backlog', 'Velocity', 'Burndown', 'Burnup', 'OverCommitment'],
  endpoints: (builder) => ({
    getSprints: builder.query<
      { sprints: Sprint[]; activeSprint: Sprint | null; pagination: any },
      { projectId: string; status?: string }
    >({
      query: ({ projectId, status }) => ({
        url: `/projects/${projectId}/sprints`,
        params: status ? { status } : undefined,
      }),
      transformResponse: (response: any) => {
        const data = response.data || {};
        return {
          ...data,
          sprints: Array.isArray(data.sprints) ? data.sprints.map(mapSprintFromApi) : [],
          activeSprint: data.activeSprint ? mapSprintFromApi(data.activeSprint) : null,
        };
      },
      providesTags: ['Sprint'],
    }),

    getSprint: builder.query<Sprint, string>({
      query: (sprintId) => `/sprints/${sprintId}`,
      transformResponse: (response: any) => mapSprintFromApi(response.data),
      providesTags: (_result, _error, id) => [{ type: 'Sprint', id }],
    }),

    createSprint: builder.mutation<Sprint, { projectId: string; data: CreateSprintInput }>({
      query: ({ projectId, data }) => ({
        url: `/projects/${projectId}/sprints`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => mapSprintFromApi(response.data),
      invalidatesTags: ['Sprint'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: 'LIST' }]));
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
        } catch { /* ignored */ }
      },
    }),

    updateSprint: builder.mutation<Sprint, { sprintId: string; data: Partial<CreateSprintInput> }>({
      query: ({ sprintId, data }) => ({
        url: `/sprints/${sprintId}`,
        method: 'PATCH',
        body: data,
      }),
      transformResponse: (response: any) => mapSprintFromApi(response.data),
      invalidatesTags: (_result, _error, { sprintId }) => [{ type: 'Sprint', id: sprintId }, 'Sprint', 'Burnup', 'Burndown'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: 'LIST' }]));
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
        } catch { /* ignored */ }
      },
    }),

    updateRetrospective: builder.mutation<Sprint, { sprintId: string; retrospectiveNotes: string }>({
      query: ({ sprintId, retrospectiveNotes }) => ({
        url: `/sprints/${sprintId}/retrospective`,
        method: 'PATCH',
        body: { retrospectiveNotes },
      }),
      transformResponse: (response: any) => mapSprintFromApi(response.data),
      invalidatesTags: (_result, _error, { sprintId }) => [{ type: 'Sprint', id: sprintId }, 'Sprint'],
    }),

    deleteSprint: builder.mutation<void, string>({
      query: (sprintId) => ({
        url: `/sprints/${sprintId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Sprint', 'Backlog'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: 'LIST' }]));
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
        } catch { /* ignored */ }
      },
    }),

    startSprint: builder.mutation<Sprint, string>({
      query: (sprintId) => ({
        url: `/sprints/${sprintId}/start`,
        method: 'POST',
      }),
      transformResponse: (response: any) => mapSprintFromApi(response.data),
      invalidatesTags: ['Sprint'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: 'LIST' }]));
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
        } catch { /* ignored */ }
      },
    }),

    completeSprint: builder.mutation<any, { sprintId: string; data: CompleteSprintInput }>({
      query: ({ sprintId, data }) => ({
        url: `/sprints/${sprintId}/complete`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Sprint', 'Backlog'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: 'LIST' }]));
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
        } catch { /* ignored */ }
      },
    }),

    addIssuesToSprint: builder.mutation<any, { sprintId: string; issueIds: string[] }>({
      query: ({ sprintId, issueIds }) => ({
        url: `/sprints/${sprintId}/issues`,
        method: 'POST',
        body: { issueIds },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Sprint', 'Backlog'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: 'LIST' }]));
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
        } catch { /* ignored */ }
      },
    }),

    removeIssueFromSprint: builder.mutation<void, { sprintId: string; issueId: string }>({
      query: ({ sprintId, issueId }) => ({
        url: `/sprints/${sprintId}/issues/${issueId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Sprint', 'Backlog'],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(issuesApi.util.invalidateTags([{ type: 'Issue', id: 'LIST' }]));
          dispatch(boardsApi.util.invalidateTags(['Board']));
          dispatch(dashboardApi.util.invalidateTags(['Dashboard', 'ProjectDashboard']));
        } catch { /* ignored */ }
      },
    }),

    getBacklog: builder.query<
      { issues: BacklogIssue[]; totalStoryPoints: number; pagination: any },
      string | { projectId: string; params?: BacklogQueryParams }
    >({
      query: (arg) => {
        const projectId = typeof arg === 'string' ? arg : arg.projectId;
        const params = typeof arg === 'string' ? undefined : arg.params;
        return {
          url: `/projects/${projectId}/backlog`,
          params,
        };
      },
      transformResponse: (response: any) => {
        const data = response?.data || {};
        return {
          issues: Array.isArray(data.issues) ? data.issues : [],
          totalStoryPoints: Number(data.totalStoryPoints || 0),
          pagination: data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 },
        };
      },
      providesTags: ['Backlog'],
    }),

    getVelocity: builder.query<VelocityData, { projectId: string; sprints?: number }>({
      query: ({ projectId, sprints }) => ({
        url: `/projects/${projectId}/velocity`,
        params: sprints ? { sprints } : undefined,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Velocity'],
    }),

    getBurndown: builder.query<BurndownData, string>({
      query: (sprintId) => `/sprints/${sprintId}/burndown`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Burndown', id }],
    }),

    getBurnup: builder.query<BurnupData, string>({
      query: (sprintId) => `/sprints/${sprintId}/burnup`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Burnup', id }],
    }),

    checkOverCommitment: builder.query<OverCommitmentInfo, string>({
      query: (sprintId) => `/sprints/${sprintId}/over-commitment`,
      transformResponse: (response: any) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'OverCommitment', id }],
    }),
  }),
});

export const {
  useGetSprintsQuery,
  useGetSprintQuery,
  useCreateSprintMutation,
  useUpdateSprintMutation,
  useUpdateRetrospectiveMutation,
  useDeleteSprintMutation,
  useStartSprintMutation,
  useCompleteSprintMutation,
  useAddIssuesToSprintMutation,
  useRemoveIssueFromSprintMutation,
  useGetBacklogQuery,
  useGetVelocityQuery,
  useGetBurndownQuery,
  useGetBurnupQuery,
  useCheckOverCommitmentQuery,
} = sprintsApi;
