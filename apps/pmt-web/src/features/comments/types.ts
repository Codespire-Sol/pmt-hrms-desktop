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
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  reactions: ReactionSummary[];
  replies?: Comment[];
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export interface CreateCommentInput {
  content: string;
  parentId?: string;
}

export interface UpdateCommentInput {
  content: string;
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
