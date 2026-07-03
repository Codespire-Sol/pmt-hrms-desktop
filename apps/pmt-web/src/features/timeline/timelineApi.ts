import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '@/lib/baseQuery';

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

const unwrap = <T>(response: ApiEnvelope<T> | T): T => {
  if (response && typeof response === 'object' && 'data' in (response as ApiEnvelope<T>)) {
    return (response as ApiEnvelope<T>).data as T;
  }
  return response as T;
};

export interface TimelineDependencyLink {
  sourceIssueId: string;
  targetIssueId: string;
  linkType?: string;
  direction?: string;
}

export interface TimelineItem {
  issueId: string;
  issueKey?: string;
  title?: string;
  startDate?: string | null;
  dueDate?: string | null;
  statusCategory?: string;
  hasDependencyCycle?: boolean;
  blockedBy?: string[];
  dependencies?: string[];
}

export interface ProjectTimelineData {
  items: TimelineItem[];
  dependencyLinks: TimelineDependencyLink[];
  hasDependencyCycle?: boolean;
}

export const timelineApi = createApi({
  reducerPath: 'timelineApi',
  baseQuery: authBaseQuery,
  tagTypes: ['ProjectTimeline'],
  endpoints: (builder) => ({
    getProjectTimeline: builder.query<ProjectTimelineData, { projectId: string; statusCategory?: string }>({
      query: ({ projectId, statusCategory }) => ({
        url: `/projects/${projectId}/board/timeline`,
        params: statusCategory ? { statusCategory } : undefined,
      }),
      transformResponse: (response: ApiEnvelope<ProjectTimelineData> | ProjectTimelineData) => {
        const data = unwrap<any>(response) || {};
        return {
          items: Array.isArray(data.items) ? data.items : [],
          dependencyLinks: Array.isArray(data.dependencyLinks) ? data.dependencyLinks : [],
          hasDependencyCycle: Boolean(data.hasDependencyCycle),
        };
      },
      providesTags: (_result, _error, { projectId }) => [{ type: 'ProjectTimeline', id: projectId }],
    }),
  }),
});

export const { useGetProjectTimelineQuery } = timelineApi;

