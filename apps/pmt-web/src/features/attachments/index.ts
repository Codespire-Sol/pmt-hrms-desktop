// Components
export { FileUpload } from './components/FileUpload';
export { AttachmentList } from './components/AttachmentList';

// Hooks
export { useClipboardPaste } from './hooks/useClipboardPaste';

// API
export {
  attachmentsApi,
  useGetUploadConfigQuery,
  useGetAttachmentsByIssueQuery,
  useGetAttachmentsByCommentQuery,
  useUploadToIssueMutation,
  useUploadToCommentMutation,
  useGetAttachmentQuery,
  useLazyGetDownloadUrlQuery,
  useDeleteAttachmentMutation,
} from './attachmentsApi';

// Types
export type { Attachment, UploadConfig } from './types';
