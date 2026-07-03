import { MessageSquare } from 'lucide-react';
import { useGetCommentsQuery, useCreateCommentMutation } from '../commentsApi';
import { CommentEditor } from './CommentEditor';
import { CommentItem } from './CommentItem';

interface CommentsListProps {
  issueId: string;
}

export function CommentsList({ issueId }: CommentsListProps) {
  const { data, isLoading, error } = useGetCommentsQuery({ issueId });
  const [createComment] = useCreateCommentMutation();

  const handleSubmit = async (content: string) => {
    await createComment({ issueId, input: { content } }).unwrap();
  };

  const comments = data?.data?.comments || [];
  const total = data?.data?.pagination?.total || 0;

  if (error) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Failed to load comments. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">Comments</h3>
        <span className="text-sm text-muted-foreground">({total})</span>
      </div>

      {/* Comment editor */}
      <CommentEditor onSubmit={handleSubmit} placeholder="Add a comment..." />

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-16 w-full bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} issueId={issueId} />
          ))}
        </div>
      )}
    </div>
  );
}
