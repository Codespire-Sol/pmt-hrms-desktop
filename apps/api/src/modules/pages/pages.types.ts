export interface Page {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  content?: string | null;
  contentHtml?: string | null;
  parentId?: string | null;
  position: number;
  createdBy: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  children?: Page[];
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
}

export interface CreatePageInput {
  title: string;
  content?: string;
  parentId?: string;
  isPublished?: boolean;
}

export interface UpdatePageInput {
  title?: string;
  content?: string;
  isPublished?: boolean;
}

export interface PageFilters {
  search?: string;
  parentId?: string | null;
  isPublished?: boolean;
}

export interface ReorderPageInput {
  parentId?: string | null;
  position: number;
}
