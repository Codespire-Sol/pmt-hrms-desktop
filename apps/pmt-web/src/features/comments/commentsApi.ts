import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';
import { Comment, ActivityLog, CreateCommentInput, UpdateCommentInput } from './types';

export const commentsApi = createApi({
  reducerPath: 'commentsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Comment', 'Activity'],
  endpoints: (builder) => ({
    // Get comments for an issue
    getComments: builder.query<
      {
        success: boolean;
        data: {
          comments: Comment[];
          pagination: { page: number; limit: number; total: number };
        };
      },
      { issueId: string; page?: number; limit?: number }
    >({
      query: ({ issueId, page = 1, limit = 50 }) => ({
        url: `/issues/${issueId}/comments`,
        params: { page, limit },
      }),
      providesTags: (result, _error, { issueId }) =>
        result
          ? [
              ...result.data.comments.map((c) => ({ type: 'Comment' as const, id: c.id })),
              { type: 'Comment' as const, id: `LIST-${issueId}` },
            ]
          : [{ type: 'Comment' as const, id: `LIST-${issueId}` }],
    }),

    // Create a comment
    createComment: builder.mutation<
      { success: boolean; data: Comment },
      { issueId: string; input: CreateCommentInput }
    >({
      query: ({ issueId, input }) => ({
        url: `/issues/${issueId}/comments`,
        method: 'POST',
        body: input,
      }),
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'Comment', id: `LIST-${issueId}` },
        { type: 'Activity', id: `LIST-${issueId}` },
      ],
    }),

    // Update a comment
    updateComment: builder.mutation<
      { success: boolean; data: Comment },
      { commentId: string; issueId: string; input: UpdateCommentInput }
    >({
      query: ({ commentId, input }) => ({
        url: `/comments/${commentId}`,
        method: 'PATCH',
        body: input,
      }),
      invalidatesTags: (_result, _error, { commentId, issueId }) => [
        { type: 'Comment', id: commentId },
        { type: 'Comment', id: `LIST-${issueId}` },
      ],
    }),

    // Delete a comment
    deleteComment: builder.mutation<
      { success: boolean; message: string },
      { commentId: string; issueId: string }
    >({
      query: ({ commentId }) => ({
        url: `/comments/${commentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'Comment', id: `LIST-${issueId}` },
        { type: 'Activity', id: `LIST-${issueId}` },
      ],
    }),

    // Add reaction
    addReaction: builder.mutation<
      { success: boolean; data: { emoji: string; count: number } },
      { commentId: string; issueId: string; emoji: string }
    >({
      query: ({ commentId, emoji }) => ({
        url: `/comments/${commentId}/reactions`,
        method: 'POST',
        body: { emoji },
      }),
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'Comment', id: `LIST-${issueId}` },
      ],
    }),

    // Remove reaction
    removeReaction: builder.mutation<
      { success: boolean; message: string },
      { commentId: string; issueId: string; emoji: string }
    >({
      query: ({ commentId, emoji }) => ({
        url: `/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'Comment', id: `LIST-${issueId}` },
      ],
    }),

    // Get activity feed
    getActivity: builder.query<
      {
        success: boolean;
        data: {
          activities: ActivityLog[];
          pagination: { page: number; limit: number; total: number };
        };
      },
      { issueId: string; page?: number; limit?: number }
    >({
      query: ({ issueId, page = 1, limit = 50 }) => ({
        url: `/issues/${issueId}/activity`,
        params: { page, limit },
      }),
      providesTags: (_result, _error, { issueId }) => [
        { type: 'Activity', id: `LIST-${issueId}` },
      ],
    }),

    // Get allowed emojis
    getAllowedEmojis: builder.query<{ success: boolean; data: string[] }, void>({
      query: () => '/reactions/emojis',
    }),
  }),
});

export const {
  useGetCommentsQuery,
  useCreateCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
  useAddReactionMutation,
  useRemoveReactionMutation,
  useGetActivityQuery,
  useGetAllowedEmojisQuery,
} = commentsApi;
