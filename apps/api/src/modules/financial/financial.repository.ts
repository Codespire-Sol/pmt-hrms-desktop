import { prisma } from '../../database/prisma';
import { CreateResourceRateInput, UpdateResourceRateInput, UpsertBudgetInput } from './financial.types';

export const financialRepository = {
  async getProjectBudget(projectId: string) {
    return prisma.projectBudget.findUnique({
      where: { projectId },
    });
  },

  async upsertProjectBudget(projectId: string, data: UpsertBudgetInput) {
    return prisma.projectBudget.upsert({
      where: { projectId },
      create: {
        projectId,
        totalBudget: data.totalBudget,
        currency: data.currency ?? 'USD',
        alertThreshold: data.alertThreshold ?? 0.80,
        warningThreshold: data.warningThreshold ?? 0.90,
        notes: data.notes,
      },
      update: {
        totalBudget: data.totalBudget,
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.alertThreshold !== undefined && { alertThreshold: data.alertThreshold }),
        ...(data.warningThreshold !== undefined && { warningThreshold: data.warningThreshold }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  },

  async getResourceRates(projectId: string) {
    return prisma.resourceRate.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getResourceRateById(rateId: string) {
    return prisma.resourceRate.findUnique({
      where: { id: rateId },
    });
  },

  async createResourceRate(projectId: string, data: CreateResourceRateInput) {
    return prisma.resourceRate.create({
      data: {
        projectId,
        userId: data.userId ?? null,
        role: data.role,
        hourlyRate: data.hourlyRate,
        currency: data.currency ?? 'USD',
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });
  },

  async updateResourceRate(rateId: string, data: UpdateResourceRateInput) {
    return prisma.resourceRate.update({
      where: { id: rateId },
      data: {
        ...(data.userId !== undefined && { userId: data.userId ?? null }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.effectiveFrom !== undefined && { effectiveFrom: new Date(data.effectiveFrom) }),
        ...(data.effectiveTo !== undefined && { effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null }),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });
  },

  async deleteResourceRate(rateId: string) {
    return prisma.resourceRate.delete({ where: { id: rateId } });
  },

  async getTimeLogsWithCosts(
    projectId: string,
    startDate?: string,
    endDate?: string,
    userId?: string,
  ) {
    const where: Record<string, unknown> = {
      issue: { projectId },
    };
    if (startDate) {
      (where as any).workDate = { ...(where as any).workDate, gte: new Date(startDate) };
    }
    if (endDate) {
      (where as any).workDate = { ...(where as any).workDate, lte: new Date(endDate) };
    }
    if (userId) {
      (where as any).userId = userId;
    }

    const logs = await prisma.timeLog.findMany({
      where: where as any,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        issue: {
          select: {
            id: true,
            title: true,
            originalEstimateHours: true,
            projectId: true,
          },
        },
      },
      orderBy: { workDate: 'asc' },
    });

    // Fetch PMT-scoped roles for all unique users from system_settings
    const uniqueUserIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
    const pmtRoleByUserId = new Map<string, string>();

    if (uniqueUserIds.length > 0) {
      const settingKeys = uniqueUserIds.map((uid) => `user_role:pmt:${uid}`);
      const rows = await prisma.$queryRawUnsafe<Array<{ setting_key: string; setting_value: any }>>(
        `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${settingKeys.map((_, i) => `$${i + 1}`).join(', ')})`,
        ...settingKeys,
      );

      if (rows.length > 0) {
        const roleIds = rows
          .map((r) => {
            const val = typeof r.setting_value === 'string' ? JSON.parse(r.setting_value) : r.setting_value;
            return typeof val?.roleId === 'string' ? val.roleId : null;
          })
          .filter((id): id is string => Boolean(id));

        const roles = roleIds.length
          ? await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, displayName: true } })
          : [];
        const roleMap = new Map(roles.map((r) => [r.id, r.displayName]));

        for (const row of rows) {
          const val = typeof row.setting_value === 'string' ? JSON.parse(row.setting_value) : row.setting_value;
          const roleId = typeof val?.roleId === 'string' ? val.roleId : null;
          if (!roleId) continue;
          const displayName = roleMap.get(roleId);
          if (!displayName) continue;
          const uid = row.setting_key.replace('user_role:pmt:', '');
          pmtRoleByUserId.set(uid, displayName);
        }
      }
    }

    return logs.map((log) => ({
      ...log,
      pmtRoleDisplayName: pmtRoleByUserId.get(log.userId ?? '') ?? null,
    }));
  },

  async createBudgetAlert(data: {
    projectId: string;
    alertType: string;
    thresholdPercent: number;
    currentSpend: number;
    totalBudget: number;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.budgetAlert.create({
      data: {
        projectId: data.projectId,
        alertType: data.alertType,
        thresholdPercent: data.thresholdPercent,
        currentSpend: data.currentSpend,
        totalBudget: data.totalBudget,
        metadata: (data.metadata ?? {}) as any,
      },
    });
  },

  async getAlerts(projectId: string) {
    return prisma.budgetAlert.findMany({
      where: { projectId },
      orderBy: { triggeredAt: 'desc' },
      take: 50,
    });
  },

  async getUnreadAlertCount(projectId: string) {
    return prisma.budgetAlert.count({
      where: { projectId, isRead: false },
    });
  },

  async markAlertsRead(projectId: string) {
    return prisma.budgetAlert.updateMany({
      where: { projectId, isRead: false },
      data: { isRead: true },
    });
  },

  async getProjectMembers(projectId: string) {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  },

  async getProject(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, leadId: true, startDate: true, targetEndDate: true },
    });
  },

  async getRecentAlertForType(projectId: string, alertType: string, sinceHours = 24) {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    return prisma.budgetAlert.findFirst({
      where: { projectId, alertType, triggeredAt: { gte: since } },
    });
  },
};
