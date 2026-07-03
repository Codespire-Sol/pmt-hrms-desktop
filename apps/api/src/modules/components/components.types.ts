export interface Component {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  leadId?: string;
  defaultAssigneeId?: string;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentWithDetails extends Component {
  lead?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  defaultAssignee?: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  issueCount: number;
}

export interface CreateComponentInput {
  name: string;
  description?: string;
  leadId?: string;
  defaultAssigneeId?: string;
  color?: string;
}

export interface UpdateComponentInput {
  name?: string;
  description?: string;
  leadId?: string | null;
  defaultAssigneeId?: string | null;
  color?: string;
  isActive?: boolean;
}

export interface ComponentFilters {
  isActive?: boolean;
  leadId?: string;
  search?: string;
}
