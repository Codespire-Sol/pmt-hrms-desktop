import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MoreHorizontal, Reply, Pencil, Trash2, Smile } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { normalizeAvatarUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Comment } from '../types';
import { CommentEditor } from './CommentEditor';
import {
  useUpdateCommentMutation,
  useDeleteCommentMutation,
  useAddReactionMutation,
  useRemoveReactionMutation,
  useCreateCommentMutation,
} from '../commentsApi';
import { useAppSelector } from '@/app/hooks';

const EMOJI_OPTIONS = ['👍', '👎', '😄', '🎉', '😕', '❤️', '🚀', '👀'];

interface CommentItemProps {
  comment: Comment;
  issueId: string;
  isReply?: boolean;
}

export function CommentItem({ comment, issueId, isReply = false }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const currentUserId = useAppSelector((state) => state.auth.user?.id);
  const isOwner = currentUserId === comment.author.id;

  const [updateComment] = useUpdateCommentMutation();
  const [deleteComment, { isLoading: isDeleting }] = useDeleteCommentMutation();
  const [addReaction] = useAddReactionMutation();
  const [removeReaction] = useRemoveReactionMutation();
  const [createComment] = useCreateCommentMutation();

  const handleUpdate = async (content: string) => {
    await updateComment({
      commentId: comment.id,
      issueId,
      input: { content },
    }).unwrap();
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteComment({ commentId: comment.id, issueId }).unwrap();
    setShowDeleteDialog(false);
  };

  const handleReply = async (content: string) => {
    await createComment({
      issueId,
      input: { content, parentId: comment.id },
    }).unwrap();
    setIsReplying(false);
  };

  const handleReaction = async (emoji: string) => {
    const existingReaction = comment.reactions.find(
      (r) => r.emoji === emoji && r.hasReacted
    );

    if (existingReaction) {
      await removeReaction({ commentId: comment.id, issueId, emoji }).unwrap();
    } else {
      await addReaction({ commentId: comment.id, issueId, emoji }).unwrap();
    }
  };

  if (isEditing) {
    return (
      <div className={isReply ? 'ml-12' : ''}>
        <CommentEditor
          initialValue={comment.content}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
          submitLabel="Save"
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className={`group ${isReply ? 'ml-12 mt-3' : ''}`}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={normalizeAvatarUrl(comment.author.avatarUrl)} />
          <AvatarFallback>
            {comment.author.displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{comment.author.displayName}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.isEdited && (
              <Badge variant="outline" className="text-xs">
                edited
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="mt-1 prose prose-sm max-w-none dark:prose-invert">
            {comment.contentHtml ? (
              <div dangerouslySetInnerHTML={{ __html: comment.contentHtml }} />
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {comment.content}
              </ReactMarkdown>
            )}
          </div>

          {/* Reactions */}
          {comment.reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {comment.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReaction(reaction.emoji)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${reaction.hasReacted
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                    }`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Add Reaction */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-1">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Reply (only for root comments) */}
            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setIsReplying(!isReplying)}
              >
                <Reply className="h-4 w-4 mr-1" />
                Reply
              </Button>
            )}

            {/* More options (edit/delete for owner) */}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Reply form */}
      {isReplying && (
        <div className="mt-3 ml-11">
          <CommentEditor
            onSubmit={handleReply}
            onCancel={() => setIsReplying(false)}
            placeholder={`Reply to ${comment.author.displayName}...`}
            submitLabel="Reply"
            autoFocus
          />
        </div>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              issueId={issueId}
              isReply
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your comment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
