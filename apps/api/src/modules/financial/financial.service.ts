import { financialRepository } from './financial.repository';
import { notificationsService } from '../notifications/notifications.service';
import { logger } from '../../utils/logger';
import {
  BudgetStatus,
  BudgetSummary,
  BurnoutChartPoint,
  BurnoutChartQuery,
  CostBreakdown,
  CostBreakdownQuery,
  BudgetVsActual,
  CreateResourceRateInput,
  UpsertBudgetInput,
  UpdateResourceRateInput,
} from './financial.types';

function toNum(value: any): number {
  return Number(value) || 0;
}

function resolveStatus(percentUsed: number, alertThreshold: number, warningThreshold: number): BudgetStatus {
  if (percentUsed >= 100) return 'exceeded';
  if (percentUsed >= warningThreshold * 100) return 'critical';
  if (percentUsed >= alertThreshold * 100) return 'warning';
  return 'on_track';
}

function groupByPeriod(
  logs: Array<{ workDate: Date; cost: number }>,
  granularity: 'weekly' | 'monthly',
): Map<string, number> {
  const map = new Map<string, number>();
  for (const log of logs) {
    const d = new Date(log.workDate);
    let key: string;
    if (granularity === 'monthly') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // ISO week: Monday-based week number
      const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - dayOfWeek);
      key = weekStart.toISOString().slice(0, 10);
    }
    map.set(key, (map.get(key) ?? 0) + log.cost);
  }
  return map;
}

export const financialService = {
  async getProjectBudget(projectId: string) {
    return financialRepository.getProjectBudget(projectId);
  },

  async upsertProjectBudget(projectId: string, data: UpsertBudgetInput) {
    return financialRepository.upsertProjectBudget(projectId, data);
  },

  async getResourceRates(projectId: string) {
    return financialRepository.getResourceRates(projectId);
  },

  async createResourceRate(projectId: string, data: CreateResourceRateInput) {
    const budget = await financialRepository.getProjectBudget(projectId);
    const currency = budget?.currency ?? data.currency ?? 'USD';
    return financialRepository.createResourceRate(projectId, { ...data, currency });
  },

  async updateResourceRate(rateId: string, projectId: string, data: UpdateResourceRateInput) {
    const existing = await financialRepository.getResourceRateById(rateId);
    if (!existing || existing.projectId !== projectId) {
      return null;
    }
    return financialRepository.updateResourceRate(rateId, data);
  },

  async deleteResourceRate(rateId: string, projectId: string): Promise<boolean> {
    const existing = await financialRepository.getResourceRateById(rateId);
    if (!existing || existing.projectId !== projectId) {
      return false;
    }
    await financialRepository.deleteResourceRate(rateId);
    return true;
  },

  async calculateBudgetSummary(projectId: string): Promise<BudgetSummary> {
    const budget = await financialRepository.getProjectBudget(projectId);
    const rates = await financialRepository.getResourceRates(projectId);
    const timeLogs = await financialRepository.getTimeLogsWithCosts(projectId);

    const rateMap = buildRateMap(rates);
    let totalSpent = 0;
    const _weeklySpend: number[] = [];
    const weekMap = new Map<string, number>();

    for (const log of timeLogs) {
      const cost = computeLogCost(log, rateMap);
      totalSpent += cost;
      const d = new Date(log.workDate);
      const weekStart = getWeekStart(d);
      weekMap.set(weekStart, (weekMap.get(weekStart) ?? 0) + cost);
    }

    // Burn rate from the last 4 weeks
    const recentWeeks = [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-4)
      .map(([, cost]) => cost);
    const burnRatePerWeek =
      recentWeeks.length > 0
        ? recentWeeks.reduce((s, v) => s + v, 0) / recentWeeks.length
        : 0;

    const totalBudget = budget ? toNum(budget.totalBudget) : 0;
    const remaining = Math.max(totalBudget - totalSpent, 0);
    const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    let weeksRemaining: number | null = null;
    if (burnRatePerWeek > 0 && remaining > 0) {
      weeksRemaining = Math.ceil(remaining / burnRatePerWeek);
    }

    const projectedTotalCost = totalSpent + (burnRatePerWeek > 0 ? burnRatePerWeek * (weeksRemaining ?? 0) : 0);

    const status: BudgetStatus = budget
      ? resolveStatus(percentUsed, toNum(budget.alertThreshold), toNum(budget.warningThreshold))
      : 'no_budget';

    return {
      totalBudget,
      totalSpent: Math.round(totalSpent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentUsed: Math.round(percentUsed * 100) / 100,
      status,
      currency: budget?.currency ?? 'USD',
      burnRatePerWeek: Math.round(burnRatePerWeek * 100) / 100,
      projectedTotalCost: Math.round(projectedTotalCost * 100) / 100,
      weeksRemaining,
    };
  },

  async getBurnoutChartData(projectId: string, query: BurnoutChartQuery): Promise<BurnoutChartPoint[]> {
    const granularity = query.granularity ?? 'weekly';
    const budget = await financialRepository.getProjectBudget(projectId);
    const rates = await financialRepository.getResourceRates(projectId);
    const timeLogs = await financialRepository.getTimeLogsWithCosts(
      projectId,
      query.startDate,
      query.endDate,
    );

    const rateMap = buildRateMap(rates);
    const costLogs = timeLogs.map((log) => ({
      workDate: log.workDate,
      cost: computeLogCost(log, rateMap),
    }));

    const periodMap = groupByPeriod(costLogs, granularity);
    const sortedPeriods = [...periodMap.keys()].sort();

    const totalBudget = budget ? toNum(budget.totalBudget) : 0;
    const numPeriods = sortedPeriods.length || 1;
    const plannedPerPeriod = totalBudget / numPeriods;

    let cumActual = 0;
    let cumPlanned = 0;
    return sortedPeriods.map((period) => {
      cumActual += periodMap.get(period) ?? 0;
      cumPlanned = Math.min(cumPlanned + plannedPerPeriod, totalBudget);
      const percentUsed = totalBudget > 0 ? (cumActual / totalBudget) * 100 : 0;
      return {
        date: period,
        planned: Math.round(cumPlanned * 100) / 100,
        actual: Math.round(cumActual * 100) / 100,
        percentUsed: Math.round(percentUsed * 100) / 100,
      };
    });
  },

  async getCostBreakdown(projectId: string, query: CostBreakdownQuery): Promise<CostBreakdown[]> {
    const budget = await financialRepository.getProjectBudget(projectId);
    const currency = budget?.currency ?? 'USD';
    const rates = await financialRepository.getResourceRates(projectId);
    const timeLogs = await financialRepository.getTimeLogsWithCosts(
      projectId,
      query.startDate,
      query.endDate,
      query.userId,
    );

    const rateMap = buildRateMap(rates);
    const breakdownMap = new Map<
      string,
      { userId: string | null; userName: string; role: string; hourlyRate: number; hoursLogged: number; totalCost: number; currency: string }
    >();

    for (const log of timeLogs) {
      const { rate, role } = resolveRate(log, rateMap);
      const cost = toNum(log.hours) * rate;
      const key = `${log.userId}::${role}`;
      const existing = breakdownMap.get(key);
      const userName = log.user
        ? `${log.user.firstName} ${log.user.lastName}`
        : 'Unknown';
      if (existing) {
        existing.hoursLogged += toNum(log.hours);
        existing.totalCost += cost;
      } else {
        breakdownMap.set(key, {
          userId: log.userId,
          userName,
          role,
          hourlyRate: rate,
          hoursLogged: toNum(log.hours),
          totalCost: cost,
          currency,
        });
      }
    }

    const entries = [...breakdownMap.values()];
    const grandTotal = entries.reduce((s, e) => s + e.totalCost, 0);

    // Filter by role if requested
    const filtered = query.role
      ? entries.filter((e) => e.role.toLowerCase() === query.role!.toLowerCase())
      : entries;

    return filtered.map((e) => ({
      ...e,
      hoursLogged: Math.round(e.hoursLogged * 100) / 100,
      totalCost: Math.round(e.totalCost * 100) / 100,
      percentOfTotal: grandTotal > 0 ? Math.round((e.totalCost / grandTotal) * 10000) / 100 : 0,
    }));
  },

  async getBudgetVsActual(projectId: string): Promise<BudgetVsActual[]> {
    const budget = await financialRepository.getProjectBudget(projectId);
    const currency = budget?.currency ?? 'USD';
    const rates = await financialRepository.getResourceRates(projectId);
    const timeLogs = await financialRepository.getTimeLogsWithCosts(projectId);
    const rateMap = buildRateMap(rates);

    const userMap = new Map<
      string,
      { resource: string; userId: string | null; actualHours: number; actualCost: number }
    >();

    for (const log of timeLogs) {
      const { rate, role } = resolveRate(log, rateMap);
      const actualHours = toNum(log.hours);
      const key = log.userId ?? role;
      const userName = log.user
        ? `${log.user.firstName} ${log.user.lastName}`
        : role;
      const existing = userMap.get(key);
      if (existing) {
        existing.actualHours += actualHours;
        existing.actualCost += actualHours * rate;
      } else {
        userMap.set(key, {
          resource: userName,
          userId: log.userId,
          actualHours,
          actualCost: actualHours * rate,
        });
      }
    }

    return [...userMap.values()].map((e) => ({
      resource: e.resource,
      userId: e.userId,
      estimatedHours: 0,
      actualHours: Math.round(e.actualHours * 100) / 100,
      estimatedCost: 0,
      actualCost: Math.round(e.actualCost * 100) / 100,
      variance: Math.round(e.actualCost * 100) / 100,
      variancePercent: 0,
      currency,
    }));
  },

  async getAlerts(projectId: string) {
    return financialRepository.getAlerts(projectId);
  },

  async markAlertsRead(projectId: string) {
    return financialRepository.markAlertsRead(projectId);
  },

  async checkAndTriggerAlerts(projectId: string): Promise<void> {
    try {
      const budget = await financialRepository.getProjectBudget(projectId);
      if (!budget) return;

      const summary = await financialService.calculateBudgetSummary(projectId);
      const alertThresholdPct = toNum(budget.alertThreshold) * 100;
      const warningThresholdPct = toNum(budget.warningThreshold) * 100;

      const checks: Array<{ type: string; threshold: number; condition: boolean }> = [
        { type: 'warning', threshold: alertThresholdPct, condition: summary.percentUsed >= alertThresholdPct },
        { type: 'critical', threshold: warningThresholdPct, condition: summary.percentUsed >= warningThresholdPct },
        { type: 'exceeded', threshold: 100, condition: summary.percentUsed >= 100 },
      ];

      for (const check of checks) {
        if (!check.condition) continue;
        // Avoid duplicate alerts within 24h
        const recent = await financialRepository.getRecentAlertForType(projectId, check.type, 24);
        if (recent) continue;

        await financialRepository.createBudgetAlert({
          projectId,
          alertType: check.type,
          thresholdPercent: check.threshold,
          currentSpend: summary.totalSpent,
          totalBudget: summary.totalBudget,
        });

        // Notify project lead/members via existing notification system
        try {
          const project = await financialRepository.getProject(projectId);
          if (project?.leadId) {
            const title =
              check.type === 'exceeded'
                ? `Budget exceeded for ${project.name}`
                : `Budget ${check.type} for ${project.name}`;
            const message = `Project "${project.name}" has used ${summary.percentUsed.toFixed(1)}% of its budget (${summary.currency} ${summary.totalSpent.toLocaleString()} of ${summary.totalBudget.toLocaleString()}).`;
            const notifType =
              check.type === 'exceeded' ? 'budget_alert_exceeded'
              : check.type === 'critical' ? 'budget_alert_critical'
              : 'budget_alert_warning';
            await notificationsService.createNotification(
              project.leadId,
              notifType as any,
              title,
              { message, projectId, metadata: { alertType: check.type, percentUsed: summary.percentUsed } },
            );
          }
        } catch (notifError) {
          logger.warn('Failed to send budget alert notification', { notifError });
        }
      }
    } catch (err) {
      logger.warn('Budget alert check failed', { projectId, err });
    }
  },
};

// ---- Helpers ----

type RateEntry = { userId: string | null; role: string; hourlyRate: any; currency: string };

function buildRateMap(rates: RateEntry[]): Map<string, RateEntry> {
  const map = new Map<string, RateEntry>();
  for (const r of rates) {
    if (r.userId) map.set(`user::${r.userId}`, r);
    map.set(`role::${r.role.toLowerCase()}`, r);
  }
  return map;
}

function resolveRate(
  log: { userId: string; pmtRoleDisplayName?: string | null },
  rateMap: Map<string, RateEntry>,
): { rate: number; role: string } {
  // 1. User-specific rate takes highest priority
  const byUser = rateMap.get(`user::${log.userId}`);
  if (byUser) return { rate: toNum(byUser.hourlyRate), role: byUser.role };

  // 2. Match by the user's PMT-scoped role displayName (e.g. "Full Stack Developer")
  if (log.pmtRoleDisplayName) {
    const byRole = rateMap.get(`role::${log.pmtRoleDisplayName.toLowerCase()}`);
    if (byRole) return { rate: toNum(byRole.hourlyRate), role: byRole.role };
  }

  // 3. No matching rate — return 0 to avoid incorrect cost attribution
  return { rate: 0, role: 'Unassigned' };
}

function computeLogCost(
  log: { hours: any; userId: string; pmtRoleDisplayName?: string | null },
  rateMap: Map<string, RateEntry>,
): number {
  const { rate } = resolveRate(log, rateMap);
  return toNum(log.hours) * rate;
}

function getWeekStart(d: Date): string {
  const dayOfWeek = (d.getDay() + 6) % 7;
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - dayOfWeek);
  return weekStart.toISOString().slice(0, 10);
}
