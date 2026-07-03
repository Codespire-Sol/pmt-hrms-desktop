// Components
export { CommentsList } from './components/CommentsList';
export { CommentItem } from './components/CommentItem';
export { CommentEditor } from './components/CommentEditor';
export { ActivityFeed } from './components/ActivityFeed';

// API
export {
  commentsApi,
  useGetCommentsQuery,
  useCreateCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
  useAddReactionMutation,
  useRemoveReactionMutation,
  useGetActivityQuery,
  useGetAllowedEmojisQuery,
} from './commentsApi';

// Types
export type { Comment, ActivityLog, ReactionSummary } from './types';
