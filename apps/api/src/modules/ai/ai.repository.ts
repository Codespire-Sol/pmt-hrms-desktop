import { prisma } from '../../database/prisma';
import { logger } from '../../utils/logger';

// Types for repository
export interface AIRequestLog {
  id: string;
  projectId: string | null;
  userId: string | null;
  feature: string;
  endpoint: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  responseTimeMs: number;
  success: boolean;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AIFeedback {
  id: string;
  projectId: string | null;
  userId: string | null;
  issueId: string | null;
  feature: string;
  feedbackType: string;
  rating: number | null;
  originalSuggestion: Record<string, unknown>;
  finalValue: Record<string, unknown>;
  userComment: string | null;
  createdAt: Date;
}

export interface AIProjectConfig {
  id: string;
  projectId: string;
  aiEnabled: boolean;
  smartSuggestionsEnabled: boolean;
  autoAssignmentEnabled: boolean;
  timeEstimationEnabled: boolean;
  riskAnalysisEnabled: boolean;
  standupGenerationEnabled: boolean;
  duplicateDetectionEnabled: boolean;
  confidenceThreshold: number;
  preferredModel: string;
  featureFlags: Record<string, unknown>;
  customPrompts: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSkill {
  id: string;
  userId: string;
  skillName: string;
  proficiencyLevel: number;
  issuesCompleted: number;
  avgCompletionTimeHours: number | null;
  successRate: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimePrediction {
  id: string;
  issueId: string;
  predictedByUser: string | null;
  predictedHours: number;
  confidenceScore: number;
  modelVersion: string | null;
  factors: Record<string, unknown>;
  actualHours: number | null;
  accuracyScore: number | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface AIRecommendation {
  id: string;
  projectId: string | null;
  sprintId: string | null;
  issueId: string | null;
  recommendationType: string;
  recommendationData: Record<string, unknown>;
  confidenceScore: number | null;
  status: string;
  actedOnBy: string | null;
  actedOnAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

class AIRepository {
  // ===============================
  // Request Logs
  // ===============================

  async logRequest(data: {
    projectId?: string;
    userId?: string;
    feature: string;
    endpoint: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    responseTimeMs: number;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AIRequestLog> {
    const log = await prisma.aiRequestLog.create({
      data: {
        projectId: data.projectId || null,
        userId: data.userId || null,
        feature: data.feature,
        endpoint: data.endpoint,
        model: data.model || null,
        inputTokens: data.inputTokens || 0,
        outputTokens: data.outputTokens || 0,
        responseTimeMs: data.responseTimeMs,
        success: data.success,
        errorMessage: data.errorMessage || null,
        metadata: (data.metadata || {}) as any,
      },
    });

    return log as unknown as AIRequestLog;
  }

  async getRequestStats(params: {
    projectId?: string;
    userId?: string;
    feature?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    totalRequests: number;
    successfulRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    avgResponseTimeMs: number;
  }> {
    const conditions: string[] = [
      `created_at BETWEEN $1 AND $2`,
    ];
    const queryParams: any[] = [params.startDate, params.endDate];
    let paramIndex = 3;

    if (params.projectId) {
      conditions.push(`project_id = $${paramIndex}::uuid`);
      queryParams.push(params.projectId);
      paramIndex++;
    }
    if (params.userId) {
      conditions.push(`user_id = $${paramIndex}::uuid`);
      queryParams.push(params.userId);
      paramIndex++;
    }
    if (params.feature) {
      conditions.push(`feature = $${paramIndex}`);
      queryParams.push(params.feature);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    try {
      const [stats] = await prisma.$queryRawUnsafe<[any]>(
        `SELECT
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE success = true) as successful_requests,
          COALESCE(SUM(input_tokens), 0) as total_input_tokens,
          COALESCE(SUM(output_tokens), 0) as total_output_tokens,
          COALESCE(AVG(response_time_ms), 0) as avg_response_time_ms
        FROM ai_request_logs
        WHERE ${whereClause}`,
        ...queryParams
      );

      return {
        totalRequests: parseInt(stats.total_requests, 10),
        successfulRequests: parseInt(stats.successful_requests, 10),
        totalInputTokens: parseInt(stats.total_input_tokens, 10),
        totalOutputTokens: parseInt(stats.total_output_tokens, 10),
        avgResponseTimeMs: parseFloat(stats.avg_response_time_ms),
      };
    } catch (error) {
      logger.error('AI repository: getRequestStats failed', error);
      return { totalRequests: 0, successfulRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, avgResponseTimeMs: 0 };
    }
  }

  async getRequestsByEndpoint(params: {
    startDate: Date;
    endDate: Date;
    projectId?: string;
  }): Promise<Array<{
    endpoint: string;
    count: number;
    avgResponseTimeMs: number;
    errorCount: number;
  }>> {
    const conditions: string[] = [
      `created_at BETWEEN $1 AND $2`,
    ];
    const queryParams: any[] = [params.startDate, params.endDate];
    let paramIndex = 3;

    if (params.projectId) {
      conditions.push(`project_id = $${paramIndex}::uuid`);
      queryParams.push(params.projectId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    try {
      const results = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
          endpoint,
          COUNT(*) as count,
          AVG(response_time_ms) as avg_response_time_ms,
          COUNT(*) FILTER (WHERE success = false) as error_count
        FROM ai_request_logs
        WHERE ${whereClause}
        GROUP BY endpoint
        ORDER BY count DESC`,
        ...queryParams
      );

      return results.map((r: any) => ({
        endpoint: r.endpoint as string,
        count: parseInt(r.count as string, 10),
        avgResponseTimeMs: parseFloat(r.avg_response_time_ms as string),
        errorCount: parseInt(r.error_count as string, 10),
      }));
    } catch (error) {
      logger.error('AI repository: getRequestsByEndpoint failed', error);
      return [];
    }
  }

  // ===============================
  // Feedback
  // ===============================

  async saveFeedback(data: {
    projectId?: string;
    userId?: string;
    issueId?: string;
    feature: string;
    feedbackType: string;
    rating?: number;
    originalSuggestion?: Record<string, unknown>;
    finalValue?: Record<string, unknown>;
    userComment?: string;
  }): Promise<AIFeedback> {
    const feedback = await prisma.aiFeedback.create({
      data: {
        projectId: data.projectId || null,
        userId: data.userId || null,
        issueId: data.issueId || null,
        feature: data.feature,
        feedbackType: data.feedbackType,
        rating: data.rating || null,
        originalSuggestion: (data.originalSuggestion || {}) as any,
        finalValue: (data.finalValue || {}) as any,
        userComment: data.userComment || null,
      },
    });

    return feedback as unknown as AIFeedback;
  }

  async getFeedbackStats(params: {
    feature?: string;
    projectId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    total: number;
    accepted: number;
    rejected: number;
    modified: number;
    avgRating: number | null;
  }> {
    const conditions: string[] = [
      `created_at BETWEEN $1 AND $2`,
    ];
    const queryParams: any[] = [params.startDate, params.endDate];
    let paramIndex = 3;

    if (params.feature) {
      conditions.push(`feature = $${paramIndex}`);
      queryParams.push(params.feature);
      paramIndex++;
    }
    if (params.projectId) {
      conditions.push(`project_id = $${paramIndex}::uuid`);
      queryParams.push(params.projectId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    try {
      const [stats] = await prisma.$queryRawUnsafe<[any]>(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE feedback_type = 'accepted') as accepted,
          COUNT(*) FILTER (WHERE feedback_type = 'rejected') as rejected,
          COUNT(*) FILTER (WHERE feedback_type = 'modified') as modified,
          AVG(rating) as avg_rating
        FROM ai_feedback
        WHERE ${whereClause}`,
        ...queryParams
      );

      return {
        total: parseInt(stats.total, 10),
        accepted: parseInt(stats.accepted, 10),
        rejected: parseInt(stats.rejected, 10),
        modified: parseInt(stats.modified, 10),
        avgRating: stats.avg_rating ? parseFloat(stats.avg_rating) : null,
      };
    } catch (error) {
      logger.error('AI repository: getFeedbackStats failed', error);
      return { total: 0, accepted: 0, rejected: 0, modified: 0, avgRating: null };
    }
  }

  async getFeedbackByFeature(params: {
    startDate: Date;
    endDate: Date;
    projectId?: string;
  }): Promise<Array<{
    feature: string;
    total: number;
    accepted: number;
    acceptanceRate: number;
    avgRating: number | null;
  }>> {
    const conditions: string[] = [
      `created_at BETWEEN $1 AND $2`,
    ];
    const queryParams: any[] = [params.startDate, params.endDate];
    let paramIndex = 3;

    if (params.projectId) {
      conditions.push(`project_id = $${paramIndex}::uuid`);
      queryParams.push(params.projectId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    try {
      const results = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
          feature,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE feedback_type = 'accepted') as accepted,
          AVG(rating) as avg_rating
        FROM ai_feedback
        WHERE ${whereClause}
        GROUP BY feature
        ORDER BY total DESC`,
        ...queryParams
      );

      return results.map((r: any) => {
        const total = parseInt(r.total as string, 10);
        const accepted = parseInt(r.accepted as string, 10);
        return {
          feature: r.feature as string,
          total,
          accepted,
          acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
          avgRating: r.avg_rating ? parseFloat(r.avg_rating as string) : null,
        };
      });
    } catch (error) {
      logger.error('AI repository: getFeedbackByFeature failed', error);
      return [];
    }
  }

  // ===============================
  // Project Config
  // ===============================

  async getProjectConfig(projectId: string): Promise<AIProjectConfig | null> {
    const config = await prisma.aiProjectConfig.findUnique({
      where: { projectId },
    });

    return config as unknown as AIProjectConfig | null;
  }

  async upsertProjectConfig(projectId: string, data: Partial<{
    aiEnabled: boolean;
    smartSuggestionsEnabled: boolean;
    autoAssignmentEnabled: boolean;
    timeEstimationEnabled: boolean;
    riskAnalysisEnabled: boolean;
    standupGenerationEnabled: boolean;
    duplicateDetectionEnabled: boolean;
    confidenceThreshold: number;
    preferredModel: string;
    featureFlags: Record<string, unknown>;
    customPrompts: Record<string, unknown>;
  }>): Promise<AIProjectConfig> {
    const updateData: Record<string, unknown> = {};

    if (data.aiEnabled !== undefined) updateData.aiEnabled = data.aiEnabled;
    if (data.smartSuggestionsEnabled !== undefined) updateData.smartSuggestionsEnabled = data.smartSuggestionsEnabled;
    if (data.autoAssignmentEnabled !== undefined) updateData.autoAssignmentEnabled = data.autoAssignmentEnabled;
    if (data.timeEstimationEnabled !== undefined) updateData.timeEstimationEnabled = data.timeEstimationEnabled;
    if (data.riskAnalysisEnabled !== undefined) updateData.riskAnalysisEnabled = data.riskAnalysisEnabled;
    if (data.standupGenerationEnabled !== undefined) updateData.standupGenerationEnabled = data.standupGenerationEnabled;
    if (data.duplicateDetectionEnabled !== undefined) updateData.duplicateDetectionEnabled = data.duplicateDetectionEnabled;
    if (data.confidenceThreshold !== undefined) updateData.confidenceThreshold = data.confidenceThreshold;
    if (data.preferredModel !== undefined) updateData.preferredModel = data.preferredModel;
    if (data.featureFlags !== undefined) updateData.featureFlags = data.featureFlags;
    if (data.customPrompts !== undefined) updateData.customPrompts = data.customPrompts;

    const config = await prisma.aiProjectConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        ...updateData,
      } as any,
      update: updateData as any,
    });

    return config as unknown as AIProjectConfig;
  }

  // ===============================
  // User Skills
  // ===============================

  async getUserSkills(userId: string): Promise<UserSkill[]> {
    const skills = await prisma.userSkill.findMany({
      where: { userId },
      orderBy: { proficiencyLevel: 'desc' },
    });

    return skills as unknown as UserSkill[];
  }

  async upsertUserSkill(data: {
    userId: string;
    skillName: string;
    proficiencyLevel?: number;
    issuesCompleted?: number;
    avgCompletionTimeHours?: number;
    successRate?: number;
  }): Promise<UserSkill> {
    const updateData: Record<string, unknown> = {
      lastUsedAt: new Date(),
    };

    if (data.proficiencyLevel !== undefined) updateData.proficiencyLevel = data.proficiencyLevel;
    if (data.issuesCompleted !== undefined) updateData.issuesCompleted = data.issuesCompleted;
    if (data.avgCompletionTimeHours !== undefined) updateData.avgCompletionTimeHours = data.avgCompletionTimeHours;
    if (data.successRate !== undefined) updateData.successRate = data.successRate;

    const skill = await prisma.userSkill.upsert({
      where: {
        userId_skillName: {
          userId: data.userId,
          skillName: data.skillName,
        },
      },
      create: {
        userId: data.userId,
        skillName: data.skillName,
        ...updateData,
      } as any,
      update: updateData as any,
    });

    return skill as unknown as UserSkill;
  }

  async incrementUserSkillIssues(userId: string, skillName: string): Promise<void> {
    await prisma.$queryRaw`
      UPDATE user_skills
      SET issues_completed = issues_completed + 1, last_used_at = NOW()
      WHERE user_id = ${userId}::uuid AND skill_name = ${skillName}
    `;
  }

  // ===============================
  // Time Predictions
  // ===============================

  async saveTimePrediction(data: {
    issueId: string;
    predictedByUser?: string;
    predictedHours: number;
    confidenceScore: number;
    modelVersion?: string;
    factors?: Record<string, unknown>;
  }): Promise<TimePrediction> {
    const prediction = await prisma.timePrediction.create({
      data: {
        issueId: data.issueId,
        predictedByUser: data.predictedByUser || null,
        predictedHours: data.predictedHours,
        confidenceScore: data.confidenceScore,
        modelVersion: data.modelVersion || null,
        factors: (data.factors || {}) as any,
      },
    });

    return prediction as unknown as TimePrediction;
  }

  async getTimePrediction(issueId: string): Promise<TimePrediction | null> {
    const prediction = await prisma.timePrediction.findFirst({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
    });

    return prediction as unknown as TimePrediction | null;
  }

  async updateTimePredictionActual(issueId: string, actualHours: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const prediction = await tx.timePrediction.findFirst({
        where: { issueId },
        orderBy: { createdAt: 'desc' },
      });

      if (prediction) {
        const accuracyScore = prediction.predictedHours > 0
          ? Math.max(0, 100 - Math.abs((actualHours - prediction.predictedHours) / prediction.predictedHours) * 100)
          : 0;

        await tx.timePrediction.update({
          where: { id: prediction.id },
          data: {
            actualHours,
            accuracyScore,
            completedAt: new Date(),
          },
        });
      }
    });
  }

  // ===============================
  // AI Recommendations
  // ===============================

  async saveRecommendation(data: {
    projectId?: string;
    sprintId?: string;
    issueId?: string;
    recommendationType: string;
    recommendationData: Record<string, unknown>;
    confidenceScore?: number;
    expiresAt?: Date;
  }): Promise<AIRecommendation> {
    const recommendation = await prisma.aiRecommendation.create({
      data: {
        projectId: data.projectId || null,
        sprintId: data.sprintId || null,
        issueId: data.issueId || null,
        recommendationType: data.recommendationType,
        recommendationData: data.recommendationData as any,
        confidenceScore: data.confidenceScore || null,
        status: 'pending',
        expiresAt: data.expiresAt || null,
      },
    });

    return recommendation as unknown as AIRecommendation;
  }

  async getPendingRecommendations(params: {
    projectId?: string;
    sprintId?: string;
    issueId?: string;
    recommendationType?: string;
    limit?: number;
  }): Promise<AIRecommendation[]> {
    const where: any = {
      status: 'pending',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    if (params.projectId) where.projectId = params.projectId;
    if (params.sprintId) where.sprintId = params.sprintId;
    if (params.issueId) where.issueId = params.issueId;
    if (params.recommendationType) where.recommendationType = params.recommendationType;

    const recommendations = await prisma.aiRecommendation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 50,
    });

    return recommendations as unknown as AIRecommendation[];
  }

  async updateRecommendationStatus(
    recommendationId: string,
    status: 'accepted' | 'rejected' | 'expired',
    actedOnBy?: string
  ): Promise<void> {
    const updateData: any = { status };

    if (actedOnBy) {
      updateData.actedOnBy = actedOnBy;
      updateData.actedOnAt = new Date();
    }

    await prisma.aiRecommendation.update({
      where: { id: recommendationId },
      data: updateData,
    });
  }

  async expireOldRecommendations(): Promise<number> {
    const result = await prisma.aiRecommendation.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    });

    return result.count;
  }
}

export const aiRepository = new AIRepository();
