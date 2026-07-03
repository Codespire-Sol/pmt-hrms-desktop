import { useMemo } from 'react';
import {
  useGetSprintsQuery,
  useGetSprintQuery,
  useGetBacklogQuery,
  useGetBurndownQuery,
  useGetVelocityQuery,
  useCreateSprintMutation,
  useUpdateSprintMutation,
  useDeleteSprintMutation,
  useStartSprintMutation,
  useCompleteSprintMutation,
  useAddIssuesToSprintMutation,
  useRemoveIssueFromSprintMutation,
} from '../sprintsApi';
import {
  Sprint,
  BacklogIssue,
  BurndownData,
  VelocityData,
} from '../types';

interface UseSprintReturn {
  sprint: Sprint | undefined;
  isLoading: boolean;
  isError: boolean;
  error: any;
  updateSprint: ReturnType<typeof useUpdateSprintMutation>[0];
  deleteSprint: ReturnType<typeof useDeleteSprintMutation>[0];
  startSprint: ReturnType<typeof useStartSprintMutation>[0];
  completeSprint: ReturnType<typeof useCompleteSprintMutation>[0];
  addIssues: ReturnType<typeof useAddIssuesToSprintMutation>[0];
  removeIssue: ReturnType<typeof useRemoveIssueFromSprintMutation>[0];
  isUpdating: boolean;
  refetch: () => void;
}

export function useSprint(sprintId: string | undefined): UseSprintReturn {
  const {
    data: sprint,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetSprintQuery(sprintId!, {
    skip: !sprintId,
  });

  const [updateSprint, { isLoading: isUpdatingSprint }] = useUpdateSprintMutation();
  const [deleteSprint, { isLoading: isDeleting }] = useDeleteSprintMutation();
  const [startSprint, { isLoading: isStarting }] = useStartSprintMutation();
  const [completeSprint, { isLoading: isCompleting }] = useCompleteSprintMutation();
  const [addIssues, { isLoading: isAddingIssues }] = useAddIssuesToSprintMutation();
  const [removeIssue, { isLoading: isRemovingIssue }] = useRemoveIssueFromSprintMutation();

  const isUpdating =
    isUpdatingSprint || isDeleting || isStarting || isCompleting || isAddingIssues || isRemovingIssue;

  return useMemo(
    () => ({
      sprint: sprint as Sprint | undefined,
      isLoading,
      isError,
      error,
      updateSprint,
      deleteSprint,
      startSprint,
      completeSprint,
      addIssues,
      removeIssue,
      isUpdating,
      refetch,
    }),
    [
      sprint,
      isLoading,
      isError,
      error,
      updateSprint,
      deleteSprint,
      startSprint,
      completeSprint,
      addIssues,
      removeIssue,
      isUpdating,
      refetch,
    ]
  );
}

interface UseSprintListReturn {
  sprints: Sprint[];
  activeSprint: Sprint | null;
  pagination: any;
  isLoading: boolean;
  isError: boolean;
  error: any;
  createSprint: ReturnType<typeof useCreateSprintMutation>[0];
  isCreating: boolean;
  refetch: () => void;
}

export function useSprintList(
  projectId: string | undefined,
  status?: string
): UseSprintListReturn {
  const { data, isLoading, isError, error, refetch } = useGetSprintsQuery(
    { projectId: projectId!, status },
    { skip: !projectId }
  );

  const [createSprint, { isLoading: isCreating }] = useCreateSprintMutation();

  return useMemo(
    () => ({
      sprints: (data?.sprints || []) as Sprint[],
      activeSprint: (data?.activeSprint || null) as Sprint | null,
      pagination: data?.pagination,
      isLoading,
      isError,
      error,
      createSprint,
      isCreating,
      refetch,
    }),
    [data, isLoading, isError, error, createSprint, isCreating, refetch]
  );
}

interface UseBacklogReturn {
  issues: BacklogIssue[];
  totalStoryPoints: number;
  pagination: any;
  isLoading: boolean;
  isError: boolean;
  error: any;
  refetch: () => void;
}

export function useBacklog(projectId: string | undefined): UseBacklogReturn {
  const { data, isLoading, isError, error, refetch } = useGetBacklogQuery(projectId!, {
    skip: !projectId,
  });

  return useMemo(
    () => ({
      issues: data?.issues || [],
      totalStoryPoints: data?.totalStoryPoints || 0,
      pagination: data?.pagination,
      isLoading,
      isError,
      error,
      refetch,
    }),
    [data, isLoading, isError, error, refetch]
  );
}

interface UseSprintMetricsReturn {
  burndown: BurndownData | undefined;
  velocity: VelocityData | undefined;
  isLoadingBurndown: boolean;
  isLoadingVelocity: boolean;
  isError: boolean;
}

export function useSprintMetrics(
  sprintId: string | undefined,
  projectId: string | undefined,
  options?: { sprintCount?: number }
): UseSprintMetricsReturn {
  const {
    data: burndown,
    isLoading: isLoadingBurndown,
    isError: isBurndownError,
  } = useGetBurndownQuery(sprintId!, {
    skip: !sprintId,
  });

  const {
    data: velocity,
    isLoading: isLoadingVelocity,
    isError: isVelocityError,
  } = useGetVelocityQuery(
    { projectId: projectId!, sprints: options?.sprintCount },
    { skip: !projectId }
  );

  return useMemo(
    () => ({
      burndown,
      velocity,
      isLoadingBurndown,
      isLoadingVelocity,
      isError: isBurndownError || isVelocityError,
    }),
    [burndown, velocity, isLoadingBurndown, isLoadingVelocity, isBurndownError, isVelocityError]
  );
}
