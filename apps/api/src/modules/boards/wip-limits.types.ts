export type WipLimitType = 'soft' | 'hard';
export type ViolationAction = 'override' | 'blocked';

export interface ColumnWipLimit {
  columnId: string;
  wipLimit: number | null;
  wipLimitEnabled: boolean;
  wipLimitType: WipLimitType;
}

export interface BoardSettings {
  id: string;
  boardId: string;
  wipLimitsEnabled: boolean;
  defaultWipType: WipLimitType;
  showWipWarnings: boolean;
  trackWipViolations: boolean;
  swimlaneWipLimits: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WipLimitViolation {
  id: string;
  boardId: string;
  columnId: string;
  issueId: string;
  userId: string;
  action: ViolationAction;
  limitAtTime: number;
  countAtTime: number;
  reason?: string;
  createdAt: Date;
}

export interface WipLimitStatus {
  columnId: string;
  columnName: string;
  wipLimit: number | null;
  wipLimitType: WipLimitType;
  currentCount: number;
  isOverLimit: boolean;
  canAdd: boolean; // false if hard limit reached
  warningMessage?: string;
}

export interface BoardWipStatus {
  boardId: string;
  wipLimitsEnabled: boolean;
  columns: WipLimitStatus[];
  hasViolations: boolean;
}

// Input Types
export interface UpdateColumnWipLimitInput {
  wipLimit?: number | null;
  wipLimitEnabled?: boolean;
  wipLimitType?: WipLimitType;
}

export interface UpdateBoardSettingsInput {
  wipLimitsEnabled?: boolean;
  defaultWipType?: WipLimitType;
  showWipWarnings?: boolean;
  trackWipViolations?: boolean;
  swimlaneWipLimits?: Record<string, number>;
}

export interface MoveIssueInput {
  issueId: string;
  fromColumnId: string;
  toColumnId: string;
  overrideLimit?: boolean;
  overrideReason?: string;
}
