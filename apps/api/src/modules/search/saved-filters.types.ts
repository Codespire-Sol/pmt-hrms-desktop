export type FilterVisibility = 'private' | 'project' | 'global';

export interface SavedFilter {
  id: string;
  projectId?: string;
  ownerId: string;
  name: string;
  description?: string;
  jql: string;
  parsedQuery?: any;
  isFavorite: boolean;
  visibility: FilterVisibility;
  usageCount: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedFilterWithOwner extends SavedFilter {
  owner: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  project?: {
    id: string;
    name: string;
    key: string;
  };
  isSubscribed?: boolean;
  subscriberCount?: number;
}

export interface CreateSavedFilterInput {
  projectId?: string;
  name: string;
  description?: string;
  jql: string;
  visibility?: FilterVisibility;
  isFavorite?: boolean;
}

export interface UpdateSavedFilterInput {
  name?: string;
  description?: string;
  jql?: string;
  visibility?: FilterVisibility;
  isFavorite?: boolean;
}

export interface FilterSubscription {
  id: string;
  filterId: string;
  userId: string;
  isFavorite: boolean;
  subscribedAt: Date;
}
