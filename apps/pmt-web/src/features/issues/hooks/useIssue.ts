import { useMemo, useState, useCallback } from 'react';
import {
  useGetIssueQuery,
  useGetIssuesQuery,
  useUpdateIssueMutation,
  useDeleteIssueMutation,
  useGetIssueLinksQuery,
} from '../issuesApi';
import { Issue, IssueLink, IssueListFilters } from '../types';

interface UseIssueOptions {
  skipLinks?: boolean;
}

interface UseIssueReturn {
  issue: Issue | undefined;
  links: IssueLink[];
  isLoading: boolean;
  isError: boolean;
  error: any;
  updateIssue: ReturnType<typeof useUpdateIssueMutation>[0];
  deleteIssue: ReturnType<typeof useDeleteIssueMutation>[0];
  isUpdating: boolean;
  isDeleting: boolean;
  refetch: () => void;
}

export function useIssue(
  issueId: string | undefined,
  options: UseIssueOptions = {}
): UseIssueReturn {
  const { skipLinks = false } = options;

  const {
    data: issue,
    isLoading: isLoadingIssue,
    isError: isIssueError,
    error: issueError,
    refetch: refetchIssue,
  } = useGetIssueQuery(issueId!, {
    skip: !issueId,
  });

  const { data: links = [], isLoading: isLoadingLinks } = useGetIssueLinksQuery(issueId!, {
    skip: !issueId || skipLinks,
  });

  const [updateIssue, { isLoading: isUpdating }] = useUpdateIssueMutation();
  const [deleteIssue, { isLoading: isDeleting }] = useDeleteIssueMutation();

  const isLoading = isLoadingIssue || (!skipLinks && isLoadingLinks);

  return useMemo(
    () => ({
      issue: issue as Issue | undefined,
      links: links as unknown as IssueLink[],
      isLoading,
      isError: isIssueError,
      error: issueError,
      updateIssue,
      deleteIssue,
      isUpdating,
      isDeleting,
      refetch: refetchIssue,
    }),
    [
      issue,
      links,
      isLoading,
      isIssueError,
      issueError,
      updateIssue,
      deleteIssue,
      isUpdating,
      isDeleting,
      refetchIssue,
    ]
  );
}

interface UseIssueListReturn {
  issues: Issue[];
  pagination: any;
  isLoading: boolean;
  isError: boolean;
  error: any;
  filters: IssueListFilters;
  setFilters: (filters: IssueListFilters) => void;
  updateFilter: <K extends keyof IssueListFilters>(key: K, value: IssueListFilters[K]) => void;
  clearFilters: () => void;
  refetch: () => void;
}

const DEFAULT_FILTERS: IssueListFilters = {
  page: 1,
  limit: 20,
};

export function useIssueList(
  projectId: string | undefined,
  initialFilters: IssueListFilters = {}
): UseIssueListReturn {
  const [filters, setFilters] = useState<IssueListFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  const { data, isLoading, isError, error, refetch } = useGetIssuesQuery(
    { projectId: projectId!, filters },
    { skip: !projectId }
  );

  const updateFilter = useCallback(
    <K extends keyof IssueListFilters>(key: K, value: IssueListFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
        // Reset to page 1 when filters change (except for page itself)
        ...(key !== 'page' ? { page: 1 } : {}),
      }));
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return useMemo(
    () => ({
      issues: (data?.issues || []) as Issue[],
      pagination: data?.pagination,
      isLoading,
      isError,
      error,
      filters,
      setFilters,
      updateFilter,
      clearFilters,
      refetch,
    }),
    [data, isLoading, isError, error, filters, updateFilter, clearFilters, refetch]
  );
}
