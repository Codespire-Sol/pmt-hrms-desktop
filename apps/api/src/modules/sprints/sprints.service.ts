import { v4 as uuidv4 } from 'uuid';
import { SprintsRepository, sprintsRepository } from './sprints.repository';
import { SprintMetricsRepository, sprintMetricsRepository } from './sprintMetrics.repository';
import { IssuesRepository } from '../issues/issues.repository';
import { ApiError } from '../../utils/ApiError';
import { webhooksService } from '../webhooks/webhooks.service';
import { usersService } from '../users/users.service';
import { logger } from '../../utils/logger';
import { calendarService } from '../calendar/calendar.service';
import {
  Sprint,
  CreateSprintInput,
  UpdateSprintInput,
  CompleteSprintInput,
  SprintFilters,
  SprintProgress,
  SprintStatistics,
  BurndownPoint,
  BurnupPoint,
  SprintBurnupData,
  VelocityData,
  OverCommitmentInfo,
} from './sprints.types';

const issuesRepository = new IssuesRepository();

export class SprintsService {
  constructor(
    private sprintsRepo: SprintsRepository = sprintsRepository,
    private metricsRepo: SprintMetricsRepository = sprintMetricsRepository,
    private issuesRepo: IssuesRepository = issuesRepository
  ) {}

  private parseDateOrThrow(label: string, value?: string | null): string | undefined {
    if (value === undefined || value === null) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw ApiError.badRequest(`Invalid ${label} date. Use ISO format like 2026-02-04.`, 'VALIDATION_ERROR');
    }
    return date.toISOString();
  }

  async createSprint(projectId: string, input: CreateSprintInput, userId: string) {
    const sequence = await this.sprintsRepo.getNextSequence(projectId);

    const sprint = await this.sprintsRepo.create({
      id: uuidv4(),
      project_id: projectId,
      name: input.name,
      goal: input.goal,
      start_date: this.parseDateOrThrow('startDate', input.startDate),
      end_date: this.parseDateOrThrow('endDate', input.endDate),
      capacity_hours: input.capacityHours,
      sequence,
      status: 'planned',
      created_by: userId,
    });

    const createdSprint = await this.getSprintById(sprint.id);

    try {
      const actor = await usersService.getUserById(userId);
      const actorInfo = actor
        ? { id: actor.id, displayName: actor.displayName, email: actor.email }
        : undefined;
      await webhooksService.triggerWebhook(projectId, 'sprint.created', createdSprint, actorInfo);
    } catch (error) {
      logger.warn('Failed to trigger sprint.created webhook', { error });
    }

    return createdSprint;
  }

  async getSprints(projectId: string, filters: SprintFilters) {
    const sprints = await this.sprintsRepo.findByProject(projectId, filters);
    const activeSprint = await this.sprintsRepo.findActive(projectId);
    const total = await this.sprintsRepo.countByProject(projectId, filters);

    const sprintsWithProgress = await Promise.all(
      sprints.map(async (sprint) => {
        const progress = await this.calculateSprintProgress(sprint.id);
        const daysRemaining = this.calculateDaysRemaining(sprint);
        const issues = await this.issuesRepo.findBySprint(sprint.id);
        return { ...sprint, progress, daysRemaining, issues };
      })
    );

    return {
      sprints: sprintsWithProgress,
      activeSprint,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total,
        totalPages: Math.ceil(total / (filters.limit || 20)),
      },
    };
  }

  async getSprintById(sprintId: string) {
    const sprint = await this.sprintsRepo.findById(sprintId);

    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    const [statistics, burndown, issues] = await Promise.all([
      this.calculateSprintStatistics(sprintId),
      this.getBurndownData(sprintId),
      this.issuesRepo.findBySprint(sprintId),
    ]);

    return {
      ...sprint,
      statistics,
      burndown,
      issues,
    };
  }

  async updateSprint(sprintId: string, input: UpdateSprintInput, _userId: string) {
    const sprint = await this.sprintsRepo.findById(sprintId);

    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    const updateData: Partial<Sprint> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.goal !== undefined) updateData.goal = input.goal;
    if (input.startDate !== undefined) {
      updateData.start_date = this.parseDateOrThrow('startDate', input.startDate);
    }
    if (input.endDate !== undefined) {
      updateData.end_date = this.parseDateOrThrow('endDate', input.endDate);
    }
    if (input.capacityHours !== undefined) updateData.capacity_hours = input.capacityHours;

    await this.sprintsRepo.update(sprintId, updateData);
    return this.getSprintById(sprintId);
  }

  async updateRetrospective(sprintId: string, retrospectiveNotes: string) {
    const sprint = await this.sprintsRepo.findById(sprintId);

    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    await this.sprintsRepo.update(sprintId, { retrospective_notes: retrospectiveNotes });
    return this.getSprintById(sprintId);
  }

  async deleteSprint(sprintId: string, _userId: string) {
    const sprint = await this.sprintsRepo.findById(sprintId);

    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    if (sprint.status === 'active') {
      throw ApiError.badRequest('Cannot delete an active sprint', 'INVALID_STATUS');
    }

    // Move all issues back to backlog
    const issues = await this.issuesRepo.findBySprint(sprintId);
    if (issues.length > 0) {
      await this.issuesRepo.moveToBacklog(issues.map((i: any) => i.id));
    }

    await this.metricsRepo.deleteBySprintId(sprintId);
    await this.sprintsRepo.delete(sprintId);

    try {
      const actor = await usersService.getUserById(_userId);
      const actorInfo = actor
        ? { id: actor.id, displayName: actor.displayName, email: actor.email }
        : undefined;
      await webhooksService.triggerWebhook(
        sprint.project_id,
        'sprint.deleted',
        sprint,
        actorInfo
      );
    } catch (error) {
      logger.warn('Failed to trigger sprint.deleted webhook', { error });
    }

    return { message: 'Sprint deleted successfully' };
  }

  async startSprint(sprintId: string, _userId: string) {
    const sprint = await this.sprintsRepo.findById(sprintId);

    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    if (sprint.status !== 'planned') {
      throw ApiError.badRequest('Sprint cannot be started', 'INVALID_STATUS');
    }

    // Check if another sprint is active
    const activeSprint = await this.sprintsRepo.findActive(sprint.project_id);
    if (activeSprint) {
      throw ApiError.badRequest(
        'Another sprint is already active. Complete it first.',
        'SPRINT_ACTIVE'
      );
    }

    const updatedSprint = await this.sprintsRepo.update(sprintId, {
      status: 'active',
      actual_start_date: new Date().toISOString(),
    });

    // Record initial metrics
    await this.recordDailyMetrics(sprintId);

    try {
      const actor = await usersService.getUserById(_userId);
      const actorInfo = actor
        ? { id: actor.id, displayName: actor.displayName, email: actor.email }
        : undefined;
      await webhooksService.triggerWebhook(
        sprint.project_id,
        'sprint.started',
        updatedSprint,
        actorInfo
      );
    } catch (error) {
      logger.warn('Failed to trigger sprint.started webhook', { error });
    }

    // Calendar sync: sync sprint dates to all assignees in this sprint (fire-and-forget)
    if (sprint.start_date && sprint.end_date) {
      try {
        const sprintIssues = await this.issuesRepo.findBySprint(sprintId);
        const uniqueAssigneeIds = [...new Set(
          sprintIssues
            .filter((i: any) => i.assigneeId || i.assignee_id)
            .map((i: any) => i.assigneeId || i.assignee_id)
        )] as string[];

        if (uniqueAssigneeIds.length > 0) {
          calendarService.syncSprintToUsers(
            sprintId,
            sprint.name,
            sprint.goal || '',
            new Date(sprint.start_date).toISOString().split('T')[0],
            new Date(sprint.end_date).toISOString().split('T')[0],
            uniqueAssigneeIds
          ).catch(err => logger.warn('Calendar sync failed for sprint start', { error: err }));
        }
      } catch (error) {
        logger.warn('Failed to sync sprint to calendars', { error });
      }
    }

    return updatedSprint;
  }

  async completeSprint(sprintId: string, input: CompleteSprintInput, userId: string) {
    const sprint = await this.sprintsRepo.findById(sprintId);

    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    if (sprint.status !== 'active') {
      throw ApiError.badRequest('Sprint is not active', 'INVALID_STATUS');
    }

    // Get incomplete issues
    const incompleteIssues = await this.issuesRepo.findIncompleteInSprint(sprintId);

    // Handle incomplete issues
    if (incompleteIssues.length > 0) {
      if (input.incompleteIssueAction === 'move_to_next_sprint') {
        if (!input.nextSprintId) {
          throw ApiError.badRequest('Next sprint ID required', 'VALIDATION_ERROR');
        }
        await this.issuesRepo.moveToSprint(
          incompleteIssues.map((i: any) => i.id),
          input.nextSprintId
        );
      } else {
        await this.issuesRepo.moveToBacklog(incompleteIssues.map((i: any) => i.id));
      }
    }

    // Calculate final velocity
    const completedPoints = await this.issuesRepo.sumCompletedStoryPointsInSprint(sprintId);
    const completedIssues = await this.issuesRepo.countCompletedInSprint(sprintId);

    // Update sprint
    const updatedSprint = await this.sprintsRepo.update(sprintId, {
      status: 'completed',
      actual_end_date: new Date().toISOString(),
      completed_by: userId,
      retrospective_notes: input.retrospectiveNotes,
    });

    const completedPayload = {
      ...updatedSprint,
      summary: {
        completedIssues,
        incompleteIssues: incompleteIssues.length,
        movedIssues: incompleteIssues.length,
        velocity: completedPoints,
      },
    };

    try {
      const actor = await usersService.getUserById(userId);
      const actorInfo = actor
        ? { id: actor.id, displayName: actor.displayName, email: actor.email }
        : undefined;
      await webhooksService.triggerWebhook(
        sprint.project_id,
        'sprint.completed',
        completedPayload,
        actorInfo
      );
    } catch (error) {
      logger.warn('Failed to trigger sprint.completed webhook', { error });
    }

    return completedPayload;
  }

  async addIssuesToSprint(sprintId: string, issueIds: string[], _userId: string) {
    const sprint = await this.sprintsRepo.findById(sprintId);

    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    if (sprint.status === 'completed' || sprint.status === 'cancelled') {
      throw ApiError.badRequest('Cannot add issues to completed sprint', 'INVALID_STATUS');
    }

    await this.issuesRepo.assignToSprint(issueIds, sprintId);

    // Record scope change if sprint is active
    if (sprint.status === 'active') {
      await this.recordScopeChange(sprintId, issueIds.length, 0);
    }

    return this.getSprintById(sprintId);
  }

  async removeIssueFromSprint(sprintId: string, issueId: string, _userId: string) {
    const sprint = await this.sprintsRepo.findById(sprintId);

    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    await this.issuesRepo.removeFromSprint(issueId);

    // Record scope change if sprint is active
    if (sprint.status === 'active') {
      await this.recordScopeChange(sprintId, 0, 1);
    }

    return { message: 'Issue removed from sprint' };
  }

  async getBacklog(projectId: string, filters: any) {
    const issues = await this.issuesRepo.findBacklog(projectId, filters);
    const total = await this.issuesRepo.countBacklog(projectId, filters);
    const totalStoryPoints = await this.issuesRepo.sumBacklogStoryPoints(projectId, filters);

    return {
      issues,
      totalStoryPoints,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 50,
        total,
        totalPages: Math.ceil(total / (filters.limit || 50)),
      },
    };
  }

  async searchBacklog(projectId: string, filters: any) {
    return this.getBacklog(projectId, filters);
  }

  async getSprintEstimateTotals(sprintId: string) {
    const sprint = await this.sprintsRepo.findById(sprintId);
    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    const [
      totalIssues,
      completedIssues,
      totalStoryPoints,
      completedStoryPoints,
      originalEstimateHours,
      remainingEstimateHours,
      loggedHours,
    ] = await Promise.all([
      this.issuesRepo.countInSprint(sprintId),
      this.issuesRepo.countCompletedInSprint(sprintId),
      this.issuesRepo.sumStoryPointsInSprint(sprintId),
      this.issuesRepo.sumCompletedStoryPointsInSprint(sprintId),
      this.issuesRepo.sumEstimateHoursInSprint(sprintId),
      this.issuesRepo.sumRemainingEstimateHoursInSprint(sprintId),
      this.issuesRepo.sumLoggedHoursInSprint(sprintId),
    ]);

    return {
      sprintId,
      sprintName: sprint.name,
      totals: {
        totalIssues,
        completedIssues,
        totalStoryPoints,
        completedStoryPoints,
        originalEstimateHours,
        remainingEstimateHours,
        loggedHours,
      },
    };
  }

  async getVelocityData(projectId: string, sprintCount: number = 5) {
    const completedSprints = await this.sprintsRepo.findCompleted(projectId, sprintCount);

    const sprintsWithVelocity: VelocityData[] = await Promise.all(
      completedSprints.map(async (sprint) => {
        const committedPoints = await this.issuesRepo.sumStoryPointsInSprint(sprint.id);
        const completedPoints = await this.issuesRepo.sumCompletedStoryPointsInSprint(sprint.id);

        return {
          id: sprint.id,
          name: sprint.name,
          startDate: sprint.start_date || '',
          endDate: sprint.end_date || '',
          committedPoints,
          completedPoints,
          completionRate: committedPoints > 0
            ? Math.round((completedPoints / committedPoints) * 100)
            : 0,
        };
      })
    );

    const velocities = sprintsWithVelocity.map((s) => s.completedPoints);
    const averageVelocity = velocities.length > 0
      ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length)
      : 0;

    // Calculate trend
    let trend = 'stable';
    if (velocities.length >= 3) {
      const recent = velocities.slice(-3);
      const older = velocities.slice(0, -3);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.length > 0
        ? older.reduce((a, b) => a + b, 0) / older.length
        : recentAvg;

      if (recentAvg > olderAvg * 1.1) trend = 'increasing';
      else if (recentAvg < olderAvg * 0.9) trend = 'decreasing';
    }

    return {
      sprints: sprintsWithVelocity,
      averageVelocity,
      trend,
    };
  }

  async getBurndownData(sprintId: string) {
    const sprint = await this.sprintsRepo.findById(sprintId);
    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    const metrics = await this.metricsRepo.findBySprint(sprintId);
    const totalPoints = await this.issuesRepo.sumStoryPointsInSprint(sprintId);
    const liveCompletedPoints = await this.issuesRepo.sumCompletedStoryPointsInSprint(sprintId);

    const startDate = new Date(sprint.actual_start_date || sprint.start_date || new Date());
    const endDate = new Date(sprint.end_date || new Date());
    const _today = new Date();
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) || 1;
    const pointsPerDay = totalPoints / totalDays;

    const burndown: BurndownPoint[] = [];
    const currentDate = new Date(startDate);
    const todayStr = new Date().toISOString().split('T')[0];
    let dayIndex = 0;
    let lastKnownCompleted = 0;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const metric = metrics.find((m) => m.date === dateStr);
      const idealRemaining = Math.max(0, totalPoints - (pointsPerDay * dayIndex));
      const isPast = dateStr <= todayStr;

      let actualCompleted: number | null = null;
      if (metric) {
        actualCompleted = metric.completed_story_points;
        lastKnownCompleted = actualCompleted;
      } else if (dateStr === todayStr) {
        actualCompleted = liveCompletedPoints;
        lastKnownCompleted = actualCompleted;
      } else if (isPast) {
        actualCompleted = lastKnownCompleted; // carry forward
      }
      // Future: stays null

      burndown.push({
        date: dateStr,
        idealRemaining: Math.round(idealRemaining * 10) / 10,
        actualRemaining: actualCompleted !== null ? totalPoints - actualCompleted : null,
        completed: actualCompleted ?? 0,
      });

      currentDate.setDate(currentDate.getDate() + 1);
      dayIndex++;
    }

    // Calculate projected completion
    const actualMetrics = metrics.filter((m) => m.completed_story_points > 0);
    let projectedCompletion = null;
    let isOnTrack = true;

    if (actualMetrics.length >= 2) {
      const latestMetric = actualMetrics[actualMetrics.length - 1];
      const elapsedDays = Math.max(1, Math.ceil(
        (new Date(latestMetric.date).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ));
      const velocityPerDay = latestMetric.completed_story_points / elapsedDays;
      const remainingPoints = totalPoints - latestMetric.completed_story_points;
      const daysNeeded = velocityPerDay > 0 ? remainingPoints / velocityPerDay : 999;
      const projectedDate = new Date();
      projectedDate.setDate(projectedDate.getDate() + daysNeeded);
      projectedCompletion = projectedDate.toISOString().split('T')[0];
      isOnTrack = projectedDate <= endDate;
    }

    return {
      sprint: {
        name: sprint.name,
        startDate: sprint.start_date,
        endDate: sprint.end_date,
      },
      totalPoints,
      burndown,
      projectedCompletion,
      isOnTrack,
    };
  }

  async getBurnupData(sprintId: string): Promise<SprintBurnupData> {
    const sprint = await this.sprintsRepo.findById(sprintId);
    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    const metrics = await this.metricsRepo.findBySprint(sprintId);
    const totalPoints = await this.issuesRepo.sumStoryPointsInSprint(sprintId);
    const completedPoints = await this.issuesRepo.sumCompletedStoryPointsInSprint(sprintId);

    const startDate = new Date(sprint.actual_start_date || sprint.start_date || new Date());
    const endDate = new Date(sprint.end_date || new Date());
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) || 1;
    const pointsPerDay = totalPoints / totalDays;

    const burnup: BurnupPoint[] = [];
    const scopeChanges: { date: string; added: number; removed: number }[] = [];
    const currentDate = new Date(startDate);
    const todayStr = new Date().toISOString().split('T')[0];
    let dayIndex = 0;
    let lastKnownCompleted = 0;
    let lastKnownScope = totalPoints;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const metric = metrics.find((m) => m.date === dateStr);
      const isPast = dateStr <= todayStr;

      // Track scope changes
      if (metric && (metric.added_issues > 0 || metric.removed_issues > 0)) {
        scopeChanges.push({
          date: dateStr,
          added: metric.added_issues,
          removed: metric.removed_issues,
        });
      }

      // Calculate ideal progress (linear from 0 to totalPoints)
      const idealProgress = Math.min(totalPoints, pointsPerDay * dayIndex);

      let actualCompleted: number | null = null;
      let scope = totalPoints;

      if (metric) {
        actualCompleted = metric.completed_story_points;
        scope = metric.total_story_points || totalPoints;
        lastKnownCompleted = actualCompleted;
        lastKnownScope = scope;
      } else if (dateStr === todayStr) {
        actualCompleted = completedPoints;
        scope = totalPoints;
        lastKnownCompleted = actualCompleted;
        lastKnownScope = scope;
      } else if (isPast) {
        actualCompleted = lastKnownCompleted; // carry forward
        scope = lastKnownScope;
      }
      // Future: stays null

      burnup.push({
        date: dateStr,
        totalScope: isPast ? scope : totalPoints,
        completedPoints: actualCompleted as any,
        idealProgress: Math.round(idealProgress * 10) / 10,
      });

      currentDate.setDate(currentDate.getDate() + 1);
      dayIndex++;
    }

    // Calculate projected completion
    const actualMetrics = metrics.filter((m) => m.completed_story_points > 0);
    let projectedCompletion: string | null = null;
    let isOnTrack = true;

    if (actualMetrics.length >= 2) {
      const latestMetric = actualMetrics[actualMetrics.length - 1];
      const velocityPerDay = latestMetric.completed_story_points / actualMetrics.length;
      const remainingPoints = totalPoints - latestMetric.completed_story_points;
      const daysNeeded = velocityPerDay > 0 ? remainingPoints / velocityPerDay : 999;
      const projectedDate = new Date();
      projectedDate.setDate(projectedDate.getDate() + daysNeeded);
      projectedCompletion = projectedDate.toISOString().split('T')[0];
      isOnTrack = projectedDate <= endDate;
    }

    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.start_date || null,
        endDate: sprint.end_date || null,
      },
      totalPoints,
      completedPoints,
      burnup,
      scopeChanges,
      projectedCompletion,
      isOnTrack,
    };
  }

  async checkOverCommitment(sprintId: string): Promise<OverCommitmentInfo> {
    const sprint = await this.sprintsRepo.findById(sprintId);
    if (!sprint) {
      throw ApiError.notFound('Sprint not found');
    }

    // Get total story points in the sprint
    const totalStoryPoints = await this.issuesRepo.sumStoryPointsInSprint(sprintId);

    // Get velocity data from past completed sprints
    const velocityData = await this.getVelocityData(sprint.project_id, 5);
    const averageVelocity = velocityData.averageVelocity;

    // Calculate over-commitment percentage
    let overCommitmentPercentage = 0;
    let warningLevel: 'none' | 'moderate' | 'severe' = 'none';
    let message = '';
    let recommendation: string | undefined;

    if (averageVelocity > 0) {
      overCommitmentPercentage = Math.round(
        ((totalStoryPoints - averageVelocity) / averageVelocity) * 100
      );

      if (overCommitmentPercentage > 30) {
        warningLevel = 'severe';
        message = `Sprint is severely over-committed by ${overCommitmentPercentage}%. ` +
          `Current load: ${totalStoryPoints} points vs average velocity: ${averageVelocity} points.`;
        recommendation = `Consider removing ${totalStoryPoints - averageVelocity} story points ` +
          `to align with team velocity. Review priorities and defer lower-priority items.`;
      } else if (overCommitmentPercentage > 10) {
        warningLevel = 'moderate';
        message = `Sprint is moderately over-committed by ${overCommitmentPercentage}%. ` +
          `Current load: ${totalStoryPoints} points vs average velocity: ${averageVelocity} points.`;
        recommendation = `The team may be able to handle this load, but consider having ` +
          `backup items ready to deprioritize if velocity decreases.`;
      } else if (overCommitmentPercentage >= 0) {
        message = `Sprint commitment (${totalStoryPoints} points) is within normal range ` +
          `of team velocity (${averageVelocity} points).`;
      } else {
        message = `Sprint has capacity available. ` +
          `Current load: ${totalStoryPoints} points vs average velocity: ${averageVelocity} points.`;
      }
    } else {
      message = 'No historical velocity data available. This appears to be the first sprint.';
      recommendation = 'Establish a baseline by completing this sprint before comparing commitments.';
    }

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      totalStoryPoints,
      averageVelocity,
      overCommitmentPercentage: Math.max(0, overCommitmentPercentage),
      warningLevel,
      message,
      recommendation,
    };
  }

  // Helper methods
  private async calculateSprintProgress(sprintId: string): Promise<SprintProgress> {
    const totalIssues = await this.issuesRepo.countInSprint(sprintId);
    const completedIssues = await this.issuesRepo.countCompletedInSprint(sprintId);
    const totalStoryPoints = await this.issuesRepo.sumStoryPointsInSprint(sprintId);
    const completedStoryPoints = await this.issuesRepo.sumCompletedStoryPointsInSprint(sprintId);

    return {
      totalIssues,
      completedIssues,
      percentComplete: totalIssues > 0
        ? Math.round((completedIssues / totalIssues) * 100)
        : 0,
      totalStoryPoints,
      completedStoryPoints,
    };
  }

  private async calculateSprintStatistics(sprintId: string): Promise<SprintStatistics> {
    const counts = await this.issuesRepo.countByStatusInSprint(sprintId);
    const totalStoryPoints = await this.issuesRepo.sumStoryPointsInSprint(sprintId);
    const completedStoryPoints = await this.issuesRepo.sumCompletedStoryPointsInSprint(sprintId);
    const totalHours = await this.issuesRepo.sumEstimateHoursInSprint(sprintId);
    const loggedHours = await this.issuesRepo.sumLoggedHoursInSprint(sprintId);

    return {
      totalIssues: counts.total,
      completedIssues: counts.completed,
      percentComplete: counts.total > 0
        ? Math.round((counts.completed / counts.total) * 100)
        : 0,
      inProgressIssues: counts.inProgress,
      todoIssues: counts.todo,
      totalStoryPoints,
      completedStoryPoints,
      totalHours,
      loggedHours,
      remainingHours: totalHours - loggedHours,
    };
  }

  private calculateDaysRemaining(sprint: Sprint): number | null {
    if (sprint.status !== 'active') return null;
    if (!sprint.end_date) return null;
    const endDate = new Date(sprint.end_date);
    const today = new Date();
    const diff = endDate.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  async recordDailyMetrics(sprintId: string) {
    const stats = await this.calculateSprintStatistics(sprintId);

    await this.metricsRepo.upsert({
      sprint_id: sprintId,
      date: new Date().toISOString(),
      total_issues: stats.totalIssues,
      completed_issues: stats.completedIssues,
      total_story_points: stats.totalStoryPoints,
      completed_story_points: stats.completedStoryPoints,
      total_hours: stats.totalHours,
      completed_hours: stats.loggedHours,
    });
  }

  private async recordScopeChange(sprintId: string, added: number, removed: number) {
    const today = new Date().toISOString();
    await this.metricsRepo.incrementScopeChange(sprintId, today, added, removed);
  }
}

export const sprintsService = new SprintsService();
