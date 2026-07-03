import { useMemo, useState, useCallback } from 'react';
import { useGetBoardQuery, useUpdateWipLimitMutation } from '../boardsApi';
import { BoardData, BoardColumn, BoardFilterState } from '../types';

interface UseBoardReturn {
  board: BoardData | undefined;
  columns: BoardColumn[];
  isLoading: boolean;
  isError: boolean;
  error: any;
  updateWipLimit: ReturnType<typeof useUpdateWipLimitMutation>[0];
  isUpdatingWipLimit: boolean;
  refetch: () => void;
}

export function useBoard(projectId: string | undefined): UseBoardReturn {
  const {
    data: board,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetBoardQuery({ projectId: projectId! }, {
    skip: !projectId,
  });

  const [updateWipLimit, { isLoading: isUpdatingWipLimit }] = useUpdateWipLimitMutation();

  return useMemo(
    () => ({
      board: board as BoardData | undefined,
      columns: (board?.columns || []) as BoardColumn[],
      isLoading,
      isError,
      error,
      updateWipLimit,
      isUpdatingWipLimit,
      refetch,
    }),
    [board, isLoading, isError, error, updateWipLimit, isUpdatingWipLimit, refetch]
  ) as UseBoardReturn;
}

const DEFAULT_FILTER_STATE: BoardFilterState = {
  assigneeIds: [],
  typeIds: [],
  priorityIds: [],
  labelIds: [],
  searchQuery: '',
};

interface UseBoardFiltersReturn {
  filters: BoardFilterState;
  setFilters: (filters: BoardFilterState) => void;
  updateFilter: <K extends keyof BoardFilterState>(key: K, value: BoardFilterState[K]) => void;
  toggleFilter: (key: 'assigneeIds' | 'typeIds' | 'priorityIds' | 'labelIds', id: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  filterIssues: <T extends { assignee?: { id: string }; type: { id: string }; priority?: { id: string }; labels?: Array<{ id: string }>; title: string }>(issues: T[]) => T[];
}

export function useBoardFilters(initialState?: Partial<BoardFilterState>): UseBoardFiltersReturn {
  const [filters, setFilters] = useState<BoardFilterState>({
    ...DEFAULT_FILTER_STATE,
    ...initialState,
  });

  const updateFilter = useCallback(
    <K extends keyof BoardFilterState>(key: K, value: BoardFilterState[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const toggleFilter = useCallback(
    (key: 'assigneeIds' | 'typeIds' | 'priorityIds' | 'labelIds', id: string) => {
      setFilters((prev) => {
        const currentIds = prev[key];
        const newIds = currentIds.includes(id)
          ? currentIds.filter((i) => i !== id)
          : [...currentIds, id];
        return {
          ...prev,
          [key]: newIds,
        };
      });
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      filters.assigneeIds.length > 0 ||
      filters.typeIds.length > 0 ||
      filters.priorityIds.length > 0 ||
      filters.labelIds.length > 0 ||
      filters.searchQuery.length > 0,
    [filters]
  );

  const filterIssues = useCallback(
    <T extends { assignee?: { id: string }; type: { id: string }; priority?: { id: string }; labels?: Array<{ id: string }>; title: string }>(
      issues: T[]
    ): T[] => {
      return issues.filter((issue) => {
        // Assignee filter
        if (
          filters.assigneeIds.length > 0 &&
          (!issue.assignee || !filters.assigneeIds.includes(issue.assignee.id))
        ) {
          return false;
        }

        // Type filter
        if (filters.typeIds.length > 0 && !filters.typeIds.includes(issue.type.id)) {
          return false;
        }

        // Priority filter
        if (
          filters.priorityIds.length > 0 &&
          (!issue.priority || !filters.priorityIds.includes(issue.priority.id))
        ) {
          return false;
        }

        // Label filter
        if (filters.labelIds.length > 0) {
          const issueLabels = issue.labels?.map((l) => l.id) || [];
          if (!filters.labelIds.some((id) => issueLabels.includes(id))) {
            return false;
          }
        }

        // Search query
        if (
          filters.searchQuery &&
          !issue.title.toLowerCase().includes(filters.searchQuery.toLowerCase())
        ) {
          return false;
        }

        return true;
      });
    },
    [filters]
  );

  return useMemo(
    () => ({
      filters,
      setFilters,
      updateFilter,
      toggleFilter,
      clearFilters,
      hasActiveFilters,
      filterIssues,
    }),
    [filters, updateFilter, toggleFilter, clearFilters, hasActiveFilters, filterIssues]
  );
}
