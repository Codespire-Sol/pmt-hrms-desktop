import { useMemo } from 'react';
import {
  useGetProjectQuery,
  useGetProjectMembersQuery,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} from '../projectsApi';
import { Project, ProjectMember } from '../types';

interface UseProjectOptions {
  skipMembers?: boolean;
}

interface UseProjectReturn {
  project: Project | undefined;
  members: ProjectMember[];
  isLoading: boolean;
  isError: boolean;
  error: any;
  updateProject: ReturnType<typeof useUpdateProjectMutation>[0];
  deleteProject: ReturnType<typeof useDeleteProjectMutation>[0];
  isUpdating: boolean;
  isDeleting: boolean;
  refetch: () => void;
}

export function useProject(
  projectId: string | undefined,
  options: UseProjectOptions = {}
): UseProjectReturn {
  const { skipMembers = false } = options;

  const {
    data: project,
    isLoading: isLoadingProject,
    isError: isProjectError,
    error: projectError,
    refetch: refetchProject,
  } = useGetProjectQuery(projectId!, {
    skip: !projectId,
  });

  const {
    data: members = [],
    isLoading: isLoadingMembers,
  } = useGetProjectMembersQuery(projectId!, {
    skip: !projectId || skipMembers,
  });

  const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();
  const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation();

  const isLoading = isLoadingProject || (!skipMembers && isLoadingMembers);

  return useMemo(
    () => ({
      project: project as Project | undefined,
      members,
      isLoading,
      isError: isProjectError,
      error: projectError,
      updateProject,
      deleteProject,
      isUpdating,
      isDeleting,
      refetch: refetchProject,
    }),
    [
      project,
      members,
      isLoading,
      isProjectError,
      projectError,
      updateProject,
      deleteProject,
      isUpdating,
      isDeleting,
      refetchProject,
    ]
  );
}

export function useProjectList(filters?: { status?: string; search?: string; page?: number }) {
  const { data, isLoading, isError, error, refetch } = useGetProjectsQuery(filters || {});

  return useMemo(
    () => ({
      projects: data?.projects || [],
      pagination: data?.pagination,
      isLoading,
      isError,
      error,
      refetch,
    }),
    [data, isLoading, isError, error, refetch]
  );
}

// Need to import this separately to avoid circular dependency
import { useGetProjectsQuery } from '../projectsApi';
