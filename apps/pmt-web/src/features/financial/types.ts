export interface ProjectBudget {
  id: string;
  projectId: string;
  totalBudget: number;
  currency: string;
  alertThreshold: number;
  warningThreshold: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceRate {
  id: string;
  projectId: string;
  userId: string | null;
  role: string;
  hourlyRate: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  } | null;
}

export interface BudgetAlert {
  id: string;
  projectId: string;
  alertType: 'warning' | 'critical' | 'exceeded' | 'resource_overrun';
  thresholdPercent: number;
  currentSpend: number;
  totalBudget: number;
  triggeredAt: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
}

export interface BurnoutChartPoint {
  date: string;
  planned: number;
  actual: number;
  percentUsed: number;
}

export type BudgetStatus = 'on_track' | 'warning' | 'critical' | 'exceeded' | 'no_budget';

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  percentUsed: number;
  status: BudgetStatus;
  currency: string;
  burnRatePerWeek: number;
  projectedTotalCost: number;
  weeksRemaining: number | null;
}

export interface CostBreakdown {
  userId: string | null;
  userName: string;
  role: string;
  hoursLogged: number;
  hourlyRate: number;
  totalCost: number;
  percentOfTotal: number;
  currency: string;
}

export interface BudgetVsActual {
  resource: string;
  userId: string | null;
  estimatedHours: number;
  actualHours: number;
  estimatedCost: number;
  actualCost: number;
  variance: number;
  variancePercent: number;
}

export interface UpsertBudgetInput {
  totalBudget: number;
  currency?: string;
  alertThreshold?: number;
  warningThreshold?: number;
  notes?: string;
}

export interface CreateResourceRateInput {
  userId?: string;
  role: string;
  hourlyRate: number;
  currency?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface UpdateResourceRateInput {
  userId?: string;
  role?: string;
  hourlyRate?: number;
  currency?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface AIFinancialInsight {
  summary?: string;
  highlights?: string[];
  concerns?: string[];
  actionItems?: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  projectedOverrunDate?: string | null;
  recommendations?: string[];
}
