export type ScreenOperation = 'create' | 'view' | 'edit' | 'transition';
export type FieldType = 'system' | 'custom';

export interface Screen {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScreenWithTabs extends Screen {
  tabs: ScreenTab[];
}

export interface ScreenTab {
  id: string;
  screenId: string;
  name: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScreenTabWithFields extends ScreenTab {
  fields: ScreenTabField[];
}

export interface ScreenTabField {
  id: string;
  tabId: string;
  fieldId: string;
  fieldType: FieldType;
  position: number;
  isRequired: boolean;
  createdAt: Date;
  // Resolved field info (for display)
  fieldName?: string;
  fieldLabel?: string;
}

export interface ScreenScheme {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScreenSchemeWithItems extends ScreenScheme {
  items: ScreenSchemeItem[];
}

export interface ScreenSchemeItem {
  id: string;
  screenSchemeId: string;
  screenId: string;
  operation: ScreenOperation;
  createdAt: Date;
  // Resolved screen info
  screen?: Screen;
}

export interface IssueTypeScreenScheme {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueTypeScreenSchemeWithItems extends IssueTypeScreenScheme {
  items: IssueTypeScreenSchemeItem[];
}

export interface IssueTypeScreenSchemeItem {
  id: string;
  issueTypeScreenSchemeId: string;
  issueTypeId?: string; // null means default for all issue types
  screenSchemeId: string;
  createdAt: Date;
  // Resolved info
  issueType?: {
    id: string;
    name: string;
    displayName: string;
  };
  screenScheme?: ScreenScheme;
}

// Input types
export interface CreateScreenInput {
  projectId?: string;
  name: string;
  description?: string;
}

export interface UpdateScreenInput {
  name?: string;
  description?: string;
}

export interface CreateScreenTabInput {
  name: string;
  position?: number;
}

export interface UpdateScreenTabInput {
  name?: string;
  position?: number;
}

export interface AddFieldToTabInput {
  fieldId: string;
  fieldType: FieldType;
  position?: number;
  isRequired?: boolean;
}

export interface UpdateTabFieldInput {
  position?: number;
  isRequired?: boolean;
}

export interface CreateScreenSchemeInput {
  projectId?: string;
  name: string;
  description?: string;
  items?: {
    screenId: string;
    operation: ScreenOperation;
  }[];
}

export interface UpdateScreenSchemeInput {
  name?: string;
  description?: string;
}

export interface CreateIssueTypeScreenSchemeInput {
  projectId?: string;
  name: string;
  description?: string;
  items?: {
    issueTypeId?: string;
    screenSchemeId: string;
  }[];
}

export interface UpdateIssueTypeScreenSchemeInput {
  name?: string;
  description?: string;
}

// System fields definition
export const SYSTEM_FIELDS = [
  { id: 'summary', label: 'Summary', type: 'text', required: true },
  { id: 'description', label: 'Description', type: 'richtext' },
  { id: 'type', label: 'Issue Type', type: 'select', required: true },
  { id: 'status', label: 'Status', type: 'select' },
  { id: 'priority', label: 'Priority', type: 'select' },
  { id: 'assignee', label: 'Assignee', type: 'user' },
  { id: 'reporter', label: 'Reporter', type: 'user' },
  { id: 'labels', label: 'Labels', type: 'multiselect' },
  { id: 'components', label: 'Components', type: 'multiselect' },
  { id: 'fixVersion', label: 'Fix Version', type: 'select' },
  { id: 'affectedVersion', label: 'Affected Version', type: 'select' },
  { id: 'sprint', label: 'Sprint', type: 'select' },
  { id: 'storyPoints', label: 'Story Points', type: 'number' },
  { id: 'dueDate', label: 'Due Date', type: 'date' },
  { id: 'startDate', label: 'Start Date', type: 'date' },
  { id: 'originalEstimate', label: 'Original Estimate', type: 'duration' },
  { id: 'remainingEstimate', label: 'Remaining Estimate', type: 'duration' },
  { id: 'timeSpent', label: 'Time Spent', type: 'duration' },
  { id: 'parent', label: 'Parent Issue', type: 'issue' },
  { id: 'linkedIssues', label: 'Linked Issues', type: 'issues' },
  { id: 'attachments', label: 'Attachments', type: 'attachments' },
  { id: 'securityLevel', label: 'Security Level', type: 'select' },
] as const;
