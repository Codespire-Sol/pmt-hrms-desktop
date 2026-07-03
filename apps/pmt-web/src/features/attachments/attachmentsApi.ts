import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '../../lib/baseQuery';
import { Attachment, UploadConfig, AttachmentVersionHistory } from './types';

export const attachmentsApi = createApi({
  reducerPath: 'attachmentsApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Attachment', 'AttachmentVersion'],
  endpoints: (builder) => ({
    // Get upload configuration
    getUploadConfig: builder.query<{ success: boolean; data: UploadConfig }, void>({
      query: () => '/attachments/config',
    }),

    // Get attachments for an issue
    getAttachmentsByIssue: builder.query<
      { success: boolean; data: Attachment[] },
      string
    >({
      query: (issueId) => `/issues/${issueId}/attachments`,
      providesTags: (result, _error, issueId) =>
        result
          ? [
              ...result.data.map((a) => ({ type: 'Attachment' as const, id: a.id })),
              { type: 'Attachment' as const, id: `ISSUE-${issueId}` },
            ]
          : [{ type: 'Attachment' as const, id: `ISSUE-${issueId}` }],
    }),

    // Get attachments for a comment
    getAttachmentsByComment: builder.query<
      { success: boolean; data: Attachment[] },
      string
    >({
      query: (commentId) => `/comments/${commentId}/attachments`,
      providesTags: (result, _error, commentId) =>
        result
          ? [
              ...result.data.map((a) => ({ type: 'Attachment' as const, id: a.id })),
              { type: 'Attachment' as const, id: `COMMENT-${commentId}` },
            ]
          : [{ type: 'Attachment' as const, id: `COMMENT-${commentId}` }],
    }),

    // Upload attachments to issue
    uploadToIssue: builder.mutation<
      { success: boolean; data: Attachment[] },
      { issueId: string; files: FormData }
    >({
      query: ({ issueId, files }) => ({
        url: `/issues/${issueId}/attachments`,
        method: 'POST',
        body: files,
      }),
      invalidatesTags: (_result, _error, { issueId }) => [
        { type: 'Attachment', id: `ISSUE-${issueId}` },
      ],
    }),

    // Upload attachments to comment
    uploadToComment: builder.mutation<
      { success: boolean; data: Attachment[] },
      { commentId: string; files: FormData }
    >({
      query: ({ commentId, files }) => ({
        url: `/comments/${commentId}/attachments`,
        method: 'POST',
        body: files,
      }),
      invalidatesTags: (_result, _error, { commentId }) => [
        { type: 'Attachment', id: `COMMENT-${commentId}` },
      ],
    }),

    // Get attachment details
    getAttachment: builder.query<{ success: boolean; data: Attachment }, string>({
      query: (attachmentId) => `/attachments/${attachmentId}`,
      providesTags: (_result, _error, id) => [{ type: 'Attachment', id }],
    }),

    // Get download URL
    getDownloadUrl: builder.query<
      { success: boolean; data: { url: string; filename: string; expiresAt: string } },
      string
    >({
      query: (attachmentId) => `/attachments/${attachmentId}/download`,
    }),

    // Delete attachment
    deleteAttachment: builder.mutation<
      { success: boolean; message: string },
      { attachmentId: string; issueId?: string; commentId?: string }
    >({
      query: ({ attachmentId }) => ({
        url: `/attachments/${attachmentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { attachmentId, issueId, commentId }) => {
        const tags: { type: 'Attachment'; id: string }[] = [
          { type: 'Attachment', id: attachmentId },
        ];
        if (issueId) {
          tags.push({ type: 'Attachment', id: `ISSUE-${issueId}` });
        }
        if (commentId) {
          tags.push({ type: 'Attachment', id: `COMMENT-${commentId}` });
        }
        return tags;
      },
    }),

    // Upload a new version of an attachment
    uploadNewVersion: builder.mutation<
      { success: boolean; data: Attachment },
      { attachmentId: string; file: FormData }
    >({
      query: ({ attachmentId, file }) => ({
        url: `/attachments/${attachmentId}/versions`,
        method: 'POST',
        body: file,
      }),
      invalidatesTags: (_result, _error, { attachmentId }) => [
        { type: 'Attachment', id: attachmentId },
        { type: 'AttachmentVersion', id: attachmentId },
      ],
    }),

    // Get version history for an attachment
    getVersionHistory: builder.query<
      { success: boolean; data: AttachmentVersionHistory },
      string
    >({
      query: (attachmentId) => `/attachments/${attachmentId}/versions`,
      providesTags: (_result, _error, attachmentId) => [
        { type: 'AttachmentVersion', id: attachmentId },
      ],
    }),

    // Get the latest version of an attachment
    getLatestVersion: builder.query<
      { success: boolean; data: Attachment },
      string
    >({
      query: (attachmentId) => `/attachments/${attachmentId}/versions/latest`,
      providesTags: (_result, _error, attachmentId) => [
        { type: 'AttachmentVersion', id: attachmentId },
      ],
    }),

    // Revert to a specific version
    revertToVersion: builder.mutation<
      { success: boolean; data: Attachment },
      { attachmentId: string; versionId: string }
    >({
      query: ({ attachmentId, versionId }) => ({
        url: `/attachments/${attachmentId}/versions/${versionId}/revert`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { attachmentId }) => [
        { type: 'Attachment', id: attachmentId },
        { type: 'AttachmentVersion', id: attachmentId },
      ],
    }),
  }),
});

export const {
  useGetUploadConfigQuery,
  useGetAttachmentsByIssueQuery,
  useGetAttachmentsByCommentQuery,
  useUploadToIssueMutation,
  useUploadToCommentMutation,
  useGetAttachmentQuery,
  useLazyGetDownloadUrlQuery,
  useDeleteAttachmentMutation,
  useUploadNewVersionMutation,
  useGetVersionHistoryQuery,
  useGetLatestVersionQuery,
  useRevertToVersionMutation,
} = attachmentsApi;
