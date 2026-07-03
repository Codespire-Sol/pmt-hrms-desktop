import { prisma } from '../database/prisma';

export const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = {
  'features.forms': false,
  'features.workflowSchemes': false,
  'features.permissionSchemes': false,
  'features.notificationSchemes': false,
  'features.bulkAsync': false,
};

const FLAG_CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

export class FeatureFlagsService {
  private cache = new Map<string, CacheEntry>();

  private getProjectOverrideKey(projectId: string, key: string): string {
    return `features.project.${projectId}.${key}`;
  }

  private getCacheKey(key: string, projectId?: string): string {
    return projectId ? `${projectId}:${key}` : key;
  }

  private parseBooleanSetting(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if (typeof obj.enabled === 'boolean') {
        return obj.enabled;
      }
      if (typeof obj.value === 'boolean') {
        return obj.value;
      }
    }

    return null;
  }

  async isEnabled(key: string, projectId?: string): Promise<boolean> {
    // Check in-memory cache first
    const ck = this.getCacheKey(key, projectId);
    const cached = this.cache.get(ck);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const result = await this.resolveFlag(key, projectId);
    this.cache.set(ck, { value: result, expiresAt: Date.now() + FLAG_CACHE_TTL_MS });
    return result;
  }

  private async resolveFlag(key: string, projectId?: string): Promise<boolean> {
    if (projectId) {
      const override = await prisma.systemSetting.findUnique({
        where: { settingKey: this.getProjectOverrideKey(projectId, key) },
        select: { settingValue: true },
      });

      const overrideValue = this.parseBooleanSetting(override?.settingValue);
      if (overrideValue !== null) {
        return overrideValue;
      }
    }

    const global = await prisma.systemSetting.findUnique({
      where: { settingKey: key },
      select: { settingValue: true },
    });
    const globalValue = this.parseBooleanSetting(global?.settingValue);
    if (globalValue !== null) {
      return globalValue;
    }

    return DEFAULT_FEATURE_FLAGS[key] ?? false;
  }

  async setGlobalFlag(key: string, enabled: boolean, updatedBy?: string): Promise<void> {
    await prisma.systemSetting.upsert({
      where: { settingKey: key },
      create: {
        settingKey: key,
        settingValue: { enabled },
        description: `Feature flag: ${key}`,
        updatedBy: updatedBy || null,
      },
      update: {
        settingValue: { enabled },
        description: `Feature flag: ${key}`,
        updatedBy: updatedBy || null,
      },
    });

    // Invalidate all cache entries for this key (global + any project overrides)
    for (const [ck] of this.cache) {
      if (ck === key || ck.endsWith(`:${key}`)) {
        this.cache.delete(ck);
      }
    }
  }

  async setProjectFlag(projectId: string, key: string, enabled: boolean, updatedBy?: string): Promise<void> {
    const settingKey = this.getProjectOverrideKey(projectId, key);

    await prisma.systemSetting.upsert({
      where: { settingKey },
      create: {
        settingKey,
        settingValue: { enabled },
        description: `Project feature override: ${projectId} -> ${key}`,
        updatedBy: updatedBy || null,
      },
      update: {
        settingValue: { enabled },
        description: `Project feature override: ${projectId} -> ${key}`,
        updatedBy: updatedBy || null,
      },
    });

    // Invalidate the cached project+key entry
    this.cache.delete(this.getCacheKey(key, projectId));
  }

  async bootstrapDefaults(updatedBy?: string): Promise<void> {
    for (const [key, enabled] of Object.entries(DEFAULT_FEATURE_FLAGS)) {
      const existing = await prisma.systemSetting.findUnique({
        where: { settingKey: key },
        select: { id: true },
      });
      if (existing) {
        continue;
      }
      await this.setGlobalFlag(key, enabled, updatedBy);
    }
  }
}

export const featureFlagsService = new FeatureFlagsService();
