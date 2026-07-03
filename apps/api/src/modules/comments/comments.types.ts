export interface Comment {
  id: string;
  issueId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  contentHtml: string | null;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CommentWithAuthor extends Comment {
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  reactions: ReactionSummary[];
  replies?: CommentWithAuthor[];
}

export interface CommentReaction {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export interface CreateCommentInput {
  issueId: string;
  authorId: string;
  parentId?: string;
  content: string;
  contentHtml?: string;
}

export interface UpdateCommentInput {
  content: string;
  contentHtml?: string;
}

export interface ActivityLog {
  id: string;
  issueId: string;
  userId: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  commentId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ActivityLogWithUser extends ActivityLog {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  comment?: {
    id: string;
    content: string;
  };
}

export interface CreateActivityLogInput {
  issueId: string;
  userId: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  commentId?: string;
  metadata?: Record<string, any>;
}

export type ActivityAction =
  | 'created'
  | 'commented'
  | 'status_changed'
  | 'assignee_changed'
  | 'priority_changed'
  | 'type_changed'
  | 'title_changed'
  | 'description_changed'
  | 'sprint_changed'
  | 'due_date_changed'
  | 'estimate_changed'
  | 'labels_changed'
  | 'linked'
  | 'unlinked'
  | 'time_logged';

// Mention types
export interface CommentMention {
  id: string;
  commentId: string;
  mentionedUserId: string;
  createdAt: string;
}

export interface CommentMentionWithUser extends CommentMention {
  mentionedUser: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface CommentWithMentions extends CommentWithAuthor {
  mentions: CommentMentionWithUser[];
}
