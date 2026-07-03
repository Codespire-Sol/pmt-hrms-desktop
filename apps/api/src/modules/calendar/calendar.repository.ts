import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import {
  CalendarIntegration,
  CalendarEventMapping,
  CalendarProvider,
  UpdateCalendarSettingsInput,
} from './calendar.types';

class CalendarRepository {
  // Integration Methods
  async createIntegration(
    data: Omit<CalendarIntegration, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CalendarIntegration> {
    const integration = await prisma.calendarIntegration.create({
      data: {
        userId: data.userId,
        provider: data.provider,
        calendarId: data.calendarId,
        calendarName: data.calendarName,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        syncDueDates: data.syncDueDates ?? true,
        syncSprints: data.syncSprints ?? true,
        enabled: data.enabled ?? true,
      },
    });

    return integration as unknown as CalendarIntegration;
  }

  async findIntegrationById(id: string): Promise<CalendarIntegration | null> {
    const integration = await prisma.calendarIntegration.findUnique({ where: { id } });
    return integration as unknown as CalendarIntegration | null;
  }

  async findIntegrationByUserId(userId: string): Promise<CalendarIntegration | null> {
    const integration = await prisma.calendarIntegration.findFirst({
      where: { userId },
    });
    return integration as unknown as CalendarIntegration | null;
  }

  async findIntegrationByUserAndProvider(
    userId: string,
    provider: CalendarProvider
  ): Promise<CalendarIntegration | null> {
    const integration = await prisma.calendarIntegration.findFirst({
      where: { userId, provider },
    });
    return integration as unknown as CalendarIntegration | null;
  }

  async findIntegrationsByProvider(provider: CalendarProvider): Promise<CalendarIntegration[]> {
    const integrations = await prisma.calendarIntegration.findMany({
      where: { provider, enabled: true },
      orderBy: { createdAt: 'asc' },
    });

    return integrations as unknown as CalendarIntegration[];
  }

  async findEnabledIntegrationsForDueDateSync(): Promise<CalendarIntegration[]> {
    const integrations = await prisma.calendarIntegration.findMany({
      where: { enabled: true, syncDueDates: true },
      orderBy: { createdAt: 'asc' },
    });

    return integrations as unknown as CalendarIntegration[];
  }

  async findEnabledIntegrationsForSprintSync(): Promise<CalendarIntegration[]> {
    const integrations = await prisma.calendarIntegration.findMany({
      where: { enabled: true, syncSprints: true },
      orderBy: { createdAt: 'asc' },
    });

    return integrations as unknown as CalendarIntegration[];
  }

  async updateIntegration(
    id: string,
    data: UpdateCalendarSettingsInput & { accessToken?: string; refreshToken?: string; tokenExpiresAt?: string }
  ): Promise<CalendarIntegration | null> {
    const updateData: Prisma.CalendarIntegrationUpdateInput = {};

    if (data.syncDueDates !== undefined) updateData.syncDueDates = data.syncDueDates;
    if (data.syncSprints !== undefined) updateData.syncSprints = data.syncSprints;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.calendarId !== undefined) updateData.calendarId = data.calendarId;
    if (data.calendarName !== undefined) updateData.calendarName = data.calendarName;
    if (data.accessToken !== undefined) updateData.accessToken = data.accessToken;
    if (data.refreshToken !== undefined) updateData.refreshToken = data.refreshToken;
    if (data.tokenExpiresAt !== undefined) updateData.tokenExpiresAt = data.tokenExpiresAt;

    const integration = await prisma.calendarIntegration.update({
      where: { id },
      data: updateData,
    });

    return integration as unknown as CalendarIntegration | null;
  }

  async deleteIntegration(id: string): Promise<boolean> {
    try {
      // Get integration first to delete associated event mappings
      const integration = await prisma.calendarIntegration.findUnique({ where: { id } });

      if (integration) {
        await prisma.calendarEventMapping.deleteMany({
          where: { userId: integration.userId },
        });
      }

      await prisma.calendarIntegration.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteIntegrationByUserId(userId: string): Promise<boolean> {
    try {
      // Delete associated event mappings
      await prisma.calendarEventMapping.deleteMany({
        where: { userId },
      });

      await prisma.calendarIntegration.deleteMany({
        where: { userId },
      });
      return true;
    } catch {
      return false;
    }
  }

  // Event Mapping Methods
  async createEventMapping(
    data: Omit<CalendarEventMapping, 'id' | 'createdAt'>
  ): Promise<CalendarEventMapping> {
    const mapping = await prisma.calendarEventMapping.create({
      data: {
        userId: data.userId,
        issueId: data.issueId || null,
        sprintId: data.sprintId || null,
        externalEventId: data.externalEventId,
        provider: data.provider,
      },
    });

    return mapping as unknown as CalendarEventMapping;
  }

  async findEventMappingByIssue(
    userId: string,
    issueId: string
  ): Promise<CalendarEventMapping | null> {
    const mapping = await prisma.calendarEventMapping.findFirst({
      where: { userId, issueId },
    });

    return mapping as unknown as CalendarEventMapping | null;
  }

  async findEventMappingBySprint(
    userId: string,
    sprintId: string
  ): Promise<CalendarEventMapping | null> {
    const mapping = await prisma.calendarEventMapping.findFirst({
      where: { userId, sprintId },
    });

    return mapping as unknown as CalendarEventMapping | null;
  }

  async findEventMappingByExternalId(
    userId: string,
    externalEventId: string
  ): Promise<CalendarEventMapping | null> {
    const mapping = await prisma.calendarEventMapping.findFirst({
      where: { userId, externalEventId },
    });

    return mapping as unknown as CalendarEventMapping | null;
  }

  async findEventMappingsByUser(userId: string): Promise<CalendarEventMapping[]> {
    const mappings = await prisma.calendarEventMapping.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return mappings as unknown as CalendarEventMapping[];
  }

  async updateEventMapping(
    id: string,
    data: Partial<CalendarEventMapping>
  ): Promise<CalendarEventMapping | null> {
    const updateData: Prisma.CalendarEventMappingUpdateInput = {};

    if (data.externalEventId !== undefined) updateData.externalEventId = data.externalEventId;

    const mapping = await prisma.calendarEventMapping.update({
      where: { id },
      data: updateData,
    });

    return mapping as unknown as CalendarEventMapping | null;
  }

  async deleteEventMapping(id: string): Promise<boolean> {
    try {
      await prisma.calendarEventMapping.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteEventMappingByIssue(userId: string, issueId: string): Promise<boolean> {
    try {
      await prisma.calendarEventMapping.deleteMany({
        where: { userId, issueId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async deleteEventMappingBySprint(userId: string, sprintId: string): Promise<boolean> {
    try {
      await prisma.calendarEventMapping.deleteMany({
        where: { userId, sprintId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async deleteEventMappingsByUser(userId: string): Promise<number> {
    const result = await prisma.calendarEventMapping.deleteMany({
      where: { userId },
    });

    return result.count;
  }
}

export const calendarRepository = new CalendarRepository();
