import axios, { AxiosInstance } from 'axios';
import OpenAI from 'openai';
import {
  IssueSuggestions,
  IssueSuggestionResponse,
  SimilarIssuesResponse,
  NaturalLanguageResponse,
  BulkNaturalLanguageResponse,
  ImproveTextResponse,
  AcceptanceCriteriaResponse,
  SummarizeResponse,
  SprintScopeResponse,
  WorkloadAnalysisResponse,
  AIUsageStats,
  StoryPointEstimate,
  AssigneeSuggestionResponse,
  TeamExpertiseResponse,
  ExpandNotesResponse,
  IssueOrderResponse,
  CompletionPredictionResponse,
  StandupResponse,
  SprintRiskResponse,
  ReassignmentResponse,
  ProjectRiskResponse,
  IssueCompletionResponse,
  AtRiskIssuesResponse,
  VelocityTrendResponse,
  WorkflowBottleneckResponse,
  RiskAlertsResponse,
  FeedbackResponse,
  AcceptanceRateResponse,
  FeedbackSummaryResponse,
  FeedbackInsightsResponse,
  UsageStatsResponse,
  CostEstimateResponse,
  DailyTrendsResponse,
  TopUsersResponse,
  EndpointPerformanceResponse,
  ProjectConfigResponse,
  RateLimitCheckResponse,
  FeatureAvailabilityResponse,
  MeetingNotesResponse,
  MeetingTypesResponse,
} from './ai.types';

import crypto from 'crypto';
import { cacheService } from '../../services/cache.service';
import { prisma } from '../../database/prisma';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_SECRET = process.env.AI_SERVICE_SECRET || '';

// ============================================
// DIRECT OPENAI CLIENT (for native endpoints)
// ============================================
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';
const OPENAI_SANDBOX_MODE = process.env.OPENAI_SANDBOX_MODE === 'true';

// ============================================
// IN-FLIGHT REQUEST DEDUPLICATION
// ============================================

/** Tracks in-flight AI requests so concurrent identical calls share one response. */
const inflightRequests = new Map<string, Promise<any>>();

function buildDedupeKey(method: string, path: string, body?: unknown): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${method}:${path}:${JSON.stringify(body ?? '')}`);
  return `ai:dedup:${hash.digest('hex')}`;
}

// ============================================
// RESPONSE CACHE CONFIG
// ============================================

/** TTLs (seconds) for cacheable AI endpoints. Only deterministic/idempotent endpoints are cached. */
const AI_CACHE_TTLS: Record<string, number> = {
  '/api/ai/issues/similar': 120,           // 2 min — similar issues rarely change
  '/api/ai/issues/suggest': 120,           // 2 min — suggestions for same input are stable
  '/api/ai/issues/estimate-points': 300,   // 5 min — story point estimates
  '/api/ai/writing/improve': 180,          // 3 min — text improvements
  '/api/ai/writing/acceptance-criteria': 180,
  '/api/ai/writing/summarize': 180,
  '/api/ai/meeting-notes/meeting-types': 600, // 10 min — static list
};

function getCacheTTL(path: string): number | null {
  return AI_CACHE_TTLS[path] ?? null;
}

function buildCacheKey(path: string, body?: unknown, authHeader?: string): string {
  const hash = crypto.createHash('sha256');
  // Include auth in the key so different users don't share cached results
  hash.update(`${path}:${JSON.stringify(body ?? '')}:${authHeader ?? ''}`);
  return `ai:cache:${hash.digest('hex')}`;
}

// ============================================
// CIRCUIT BREAKER
// ============================================
type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(failureThreshold = 5, resetTimeoutMs = 30_000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      // Check if enough time has passed to try again
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    // half-open: allow one request through
    return true;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

class AIService {
  private client: AxiosInstance;
  private breaker: CircuitBreaker;

  constructor() {
    this.client = axios.create({
      baseURL: AI_SERVICE_URL,
      timeout: 30000, // 30 seconds for AI operations
      headers: {
        'Content-Type': 'application/json',
        ...(AI_SERVICE_SECRET ? { 'X-Service-Auth': AI_SERVICE_SECRET } : {}),
      },
    });
    this.breaker = new CircuitBreaker(5, 30_000);

    // Circuit breaker: block requests when circuit is open
    this.client.interceptors.request.use((cfg) => {
      if (!this.breaker.canExecute()) {
        throw new Error('AI service is temporarily unavailable (circuit open). Please try again later.');
      }
      return cfg;
    });

    // Circuit breaker: record success/failure + single retry for transient errors
    this.client.interceptors.response.use(
      (response) => {
        this.breaker.recordSuccess();
        return response;
      },
      async (error: any) => {
        const status = error?.response?.status;
        const isRetryable = !status || status >= 500;

        if (isRetryable && !error.config?._retried) {
          error.config._retried = true;
          try {
            const result = await this.client(error.config);
            // Success interceptor will record success on the retry
            return result;
          } catch (retryError) {
            this.breaker.recordFailure();
            throw retryError;
          }
        }

        if (isRetryable) {
          this.breaker.recordFailure();
        }
        // 4xx errors are not retryable and don't trip the breaker
        throw error;
      }
    );
  }

  private forwardAuthHeader(authHeader?: string): Record<string, string> {
    return authHeader ? { Authorization: authHeader } : {};
  }

  // Issue Suggestions — OpenAI direct (no external microservice)
  async getIssueSuggestions(
    title: string,
    description: string,
    _projectId: string,
    _authHeader?: string
  ): Promise<IssueSuggestionResponse> {
    const startTime = Date.now();

    if (OPENAI_SANDBOX_MODE) {
      return { suggestions: { labels: [] }, processingTimeMs: 0 } as IssueSuggestionResponse;
    }

    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 512,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are a project management assistant. Suggest labels, issue type, priority, and story points for the given issue. ' +
            'Respond ONLY with a valid JSON object (no markdown) with this shape: ' +
            '{ "suggestions": { "labels": [{"name": string, "confidence": number}], ' +
            '"issueType": {"value": string, "confidence": number}, ' +
            '"priority": {"value": string, "confidence": number}, ' +
            '"storyPoints": {"value": number, "confidence": number} } }. ' +
            'Confidence values are between 0 and 1. issueType options: bug, task, story, feature. ' +
            'Priority options: low, medium, high, critical. Story points: 1, 2, 3, 5, 8, or 13.',
        },
        {
          role: 'user',
          content: `Issue title: "${title}"\nDescription: "${description || '(none)'}"\n\nSuggest appropriate labels, type, priority, and story points.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = this.extractJSON(raw) as { suggestions?: IssueSuggestions };
    return {
      suggestions: parsed.suggestions ?? { labels: [] },
      processingTimeMs: Date.now() - startTime,
    } as IssueSuggestionResponse;
  }

  // Similar Issues — database text search (no external microservice)
  async findSimilarIssues(
    title: string,
    description: string,
    projectId: string,
    limit: number = 5,
    _authHeader?: string
  ): Promise<SimilarIssuesResponse> {
    const startTime = Date.now();

    if (OPENAI_SANDBOX_MODE) {
      return { similarIssues: [], processingTimeMs: 0 } as SimilarIssuesResponse;
    }

    // Extract meaningful keywords (>3 chars) from title + description
    const text = `${title} ${description ?? ''}`;
    const keywords = [...new Set(
      text.split(/\s+/).map(w => w.replace(/[^a-z0-9]/gi, '')).filter(w => w.length > 3)
    )];

    if (keywords.length === 0) {
      return { similarIssues: [], processingTimeMs: Date.now() - startTime };
    }

    const issues = await prisma.issue.findMany({
      where: {
        projectId,
        OR: keywords.map(kw => ({ title: { contains: kw, mode: 'insensitive' as const } })),
      },
      include: { project: { select: { key: true } } },
      take: limit * 3,
    });

    const scored = issues
      .map(issue => {
        const titleLower = issue.title.toLowerCase();
        const matchCount = keywords.filter(kw => titleLower.includes(kw.toLowerCase())).length;
        const similarity = Math.round((matchCount / keywords.length) * 100) / 100;
        return {
          issueId: issue.id,
          issueKey: `${issue.project.key}-${issue.issueNumber}`,
          title: issue.title,
          similarity,
          reason: `Shares ${matchCount} keyword${matchCount !== 1 ? 's' : ''} with your issue title`,
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return { similarIssues: scored, processingTimeMs: Date.now() - startTime };
  }

  // Natural Language Parsing
  async parseNaturalLanguage(
    text: string,
    projectId: string,
    authHeader?: string
  ): Promise<NaturalLanguageResponse> {
    const response = await this.client.post(
      '/api/ai/issues/parse',
      {
        text,
        project_id: projectId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Bulk Natural Language Parsing
  async parseBulkIssues(
    text: string,
    projectId: string,
    authHeader?: string
  ): Promise<BulkNaturalLanguageResponse> {
    const response = await this.client.post(
      '/api/ai/issues/parse-bulk',
      {
        text,
        project_id: projectId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Expand Notes
  async expandNotes(
    notes: string,
    context?: string,
    authHeader?: string
  ): Promise<ExpandNotesResponse> {
    const response = await this.client.post(
      '/api/ai/writing/expand-notes',
      {
        notes,
        context,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Improve Text
  async improveText(
    text: string,
    style: 'clearer' | 'concise' | 'detailed' | 'professional' | 'technical',
    authHeader?: string
  ): Promise<ImproveTextResponse> {
    const response = await this.client.post(
      '/api/ai/writing/improve',
      {
        text,
        style,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Generate Acceptance Criteria
  async generateAcceptanceCriteria(
    title: string,
    description: string,
    authHeader?: string
  ): Promise<AcceptanceCriteriaResponse> {
    const response = await this.client.post(
      '/api/ai/writing/acceptance-criteria',
      {
        title,
        description,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Summarize Text
  async summarizeText(
    text: string,
    maxLength: number = 200,
    authHeader?: string
  ): Promise<SummarizeResponse> {
    const response = await this.client.post(
      '/api/ai/writing/summarize',
      {
        text,
        max_length: maxLength,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Sprint Scope Recommendation
  async recommendSprintScope(
    projectId: string,
    sprintDurationDays: number = 14,
    targetPoints?: number,
    authHeader?: string
  ): Promise<SprintScopeResponse> {
    const response = await this.client.post(
      '/api/ai/planning/sprint-scope',
      {
        project_id: projectId,
        sprint_duration_days: sprintDurationDays,
        target_points: targetPoints,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Workload Analysis
  async analyzeWorkload(
    projectId: string,
    sprintId?: string,
    authHeader?: string
  ): Promise<WorkloadAnalysisResponse> {
    const response = await this.client.post(
      '/api/ai/planning/workload-analysis',
      {
        project_id: projectId,
        sprint_id: sprintId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Estimate Story Points (cached + deduplicated via proxyRequest)
  async estimateStoryPoints(
    title: string,
    description: string,
    projectId: string,
    authHeader?: string
  ): Promise<StoryPointEstimate> {
    return this.proxyRequest(
      '/api/ai/issues/estimate-points',
      'POST',
      { title, description, project_id: projectId },
      authHeader
    ) as Promise<StoryPointEstimate>;
  }

  // Suggest Assignee
  async suggestAssignee(
    title: string,
    description: string,
    projectId: string,
    authHeader?: string
  ): Promise<AssigneeSuggestionResponse> {
    const response = await this.client.post(
      '/api/ai/issues/suggest-assignee',
      {
        title,
        description,
        project_id: projectId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get Team Expertise
  async getTeamExpertise(
    projectId: string,
    authHeader?: string
  ): Promise<TeamExpertiseResponse> {
    const response = await this.client.get(
      `/api/ai/issues/team-expertise/${projectId}`,
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Suggest Issue Ordering
  async suggestIssueOrder(
    projectId: string,
    sprintId: string,
    authHeader?: string
  ): Promise<IssueOrderResponse> {
    const response = await this.client.post(
      '/api/ai/planning/suggest-order',
      {
        project_id: projectId,
        sprint_id: sprintId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Predict Completion
  async predictCompletion(
    projectId: string,
    sprintId: string,
    authHeader?: string
  ): Promise<CompletionPredictionResponse> {
    const response = await this.client.post(
      '/api/ai/planning/predict-completion',
      {
        project_id: projectId,
        sprint_id: sprintId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Generate Standup
  async generateStandup(
    projectId: string,
    sprintId: string,
    userId?: string,
    authHeader?: string
  ): Promise<StandupResponse> {
    const response = await this.client.post(
      '/api/ai/planning/generate-standup',
      {
        project_id: projectId,
        sprint_id: sprintId,
        user_id: userId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Analyze Sprint Risks
  async analyzeSprintRisks(
    projectId: string,
    sprintId: string,
    authHeader?: string
  ): Promise<SprintRiskResponse> {
    const response = await this.client.post(
      '/api/ai/planning/analyze-risks',
      {
        project_id: projectId,
        sprint_id: sprintId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Suggest Reassignments
  async suggestReassignments(
    projectId: string,
    sprintId: string,
    authHeader?: string
  ): Promise<ReassignmentResponse> {
    const response = await this.client.post(
      '/api/ai/planning/suggest-reassignments',
      {
        project_id: projectId,
        sprint_id: sprintId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get Usage Stats
  async getUsageStats(): Promise<AIUsageStats> {
    const response = await this.client.get('/api/ai/stats');
    return this.transformResponse(response.data);
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; version: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Analyze Project Risks
  async analyzeProjectRisks(
    projectId: string,
    authHeader?: string
  ): Promise<ProjectRiskResponse> {
    const response = await this.client.post(
      '/api/ai/predictions/project-risks',
      {
        project_id: projectId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Predict Issue Completion
  async predictIssueCompletion(
    issueId: string,
    projectId: string,
    authHeader?: string
  ): Promise<IssueCompletionResponse> {
    const response = await this.client.post(
      '/api/ai/predictions/issue-completion',
      {
        issue_id: issueId,
        project_id: projectId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get At-Risk Issues
  async getAtRiskIssues(
    projectId: string,
    sprintId?: string,
    authHeader?: string
  ): Promise<AtRiskIssuesResponse> {
    const response = await this.client.post(
      '/api/ai/predictions/at-risk-issues',
      {
        project_id: projectId,
        sprint_id: sprintId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Analyze Velocity Trends
  async analyzeVelocityTrends(
    projectId: string,
    authHeader?: string
  ): Promise<VelocityTrendResponse> {
    const response = await this.client.post(
      '/api/ai/predictions/velocity-trends',
      {
        project_id: projectId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Analyze Workflow Bottlenecks
  async analyzeWorkflowBottlenecks(
    projectId: string,
    sprintId?: string,
    authHeader?: string
  ): Promise<WorkflowBottleneckResponse> {
    const response = await this.client.post(
      '/api/ai/predictions/workflow-bottlenecks',
      {
        project_id: projectId,
        sprint_id: sprintId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Generate Risk Alerts
  async generateRiskAlerts(
    projectId: string,
    authHeader?: string
  ): Promise<RiskAlertsResponse> {
    const response = await this.client.post(
      '/api/ai/predictions/risk-alerts',
      {
        project_id: projectId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // ==================== FEEDBACK ====================

  // Record Feedback
  async recordFeedback(
    userId: string,
    suggestionType: string,
    suggestionId: string,
    accepted: boolean,
    rating?: number,
    comment?: string,
    metadata?: Record<string, unknown>,
    authHeader?: string
  ): Promise<FeedbackResponse> {
    const response = await this.client.post(
      '/api/ai/admin/feedback',
      {
        user_id: userId,
        suggestion_type: suggestionType,
        suggestion_id: suggestionId,
        accepted,
        rating,
        comment,
        metadata,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get Acceptance Rate
  async getAcceptanceRate(
    suggestionType: string,
    days: number = 30,
    authHeader?: string
  ): Promise<AcceptanceRateResponse> {
    const response = await this.client.post(
      '/api/ai/admin/feedback/acceptance-rate',
      {
        suggestion_type: suggestionType,
        days,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get Feedback Summary
  async getFeedbackSummary(
    days: number = 30,
    authHeader?: string
  ): Promise<FeedbackSummaryResponse> {
    const response = await this.client.get(
      '/api/ai/admin/feedback/summary',
      {
        params: { days },
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get Feedback Insights
  async getFeedbackInsights(
    authHeader?: string
  ): Promise<FeedbackInsightsResponse> {
    const response = await this.client.get('/api/ai/admin/feedback/insights', {
      headers: this.forwardAuthHeader(authHeader),
    });

    return this.transformResponse(response.data);
  }

  // ==================== ANALYTICS ====================

  // Get Usage Statistics
  async getAnalyticsUsage(
    startDate?: string,
    endDate?: string,
    projectId?: string,
    authHeader?: string
  ): Promise<UsageStatsResponse> {
    const response = await this.client.post(
      '/api/ai/admin/analytics/usage',
      {
        start_date: startDate,
        end_date: endDate,
        project_id: projectId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get Cost Estimate
  async getCostEstimate(
    startDate?: string,
    endDate?: string,
    projectId?: string,
    authHeader?: string
  ): Promise<CostEstimateResponse> {
    const response = await this.client.post(
      '/api/ai/admin/analytics/cost',
      {
        start_date: startDate,
        end_date: endDate,
        project_id: projectId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get Daily Trends
  async getDailyTrends(
    days: number = 14,
    projectId?: string,
    authHeader?: string
  ): Promise<DailyTrendsResponse> {
    const queryParams: Record<string, string | number> = { days };
    if (projectId) queryParams.project_id = projectId;

    const response = await this.client.get(
      '/api/ai/admin/analytics/trends',
      {
        params: queryParams,
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get Top Users
  async getTopUsers(
    days: number = 30,
    limit: number = 10,
    authHeader?: string
  ): Promise<TopUsersResponse> {
    const response = await this.client.get(
      '/api/ai/admin/analytics/top-users',
      {
        params: { days, limit },
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get Endpoint Performance
  async getEndpointPerformance(
    authHeader?: string
  ): Promise<EndpointPerformanceResponse> {
    const response = await this.client.get('/api/ai/admin/analytics/endpoints', {
      headers: this.forwardAuthHeader(authHeader),
    });

    return this.transformResponse(response.data);
  }

  // ==================== CONFIG ====================

  // Get Project Config
  async getProjectConfig(
    projectId: string,
    authHeader?: string
  ): Promise<ProjectConfigResponse> {
    const response = await this.client.get(
      `/api/ai/admin/config/${projectId}`,
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Update Project Config
  async updateProjectConfig(
    projectId: string,
    enabled?: boolean,
    features?: Record<string, boolean>,
    limits?: Record<string, number>,
    authHeader?: string
  ): Promise<ProjectConfigResponse> {
    const response = await this.client.put(
      '/api/ai/admin/config',
      {
        project_id: projectId,
        enabled,
        features,
        limits,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Reset Project Config
  async resetProjectConfig(
    projectId: string,
    authHeader?: string
  ): Promise<ProjectConfigResponse> {
    const response = await this.client.delete(
      `/api/ai/admin/config/${projectId}`,
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Check Rate Limit
  async checkRateLimit(
    projectId: string,
    userId: string,
    authHeader?: string
  ): Promise<RateLimitCheckResponse> {
    const response = await this.client.post(
      '/api/ai/admin/config/check-rate-limit',
      {
        project_id: projectId,
        user_id: userId,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // Get Feature Availability
  async getFeatureAvailability(
    projectId: string,
    authHeader?: string
  ): Promise<FeatureAvailabilityResponse> {
    const response = await this.client.get(
      `/api/ai/admin/config/${projectId}/features`,
      {
        headers: this.forwardAuthHeader(authHeader),
      }
    );

    return this.transformResponse(response.data);
  }

  // ==================== MEETING NOTES ====================

  async parseMeetingNotes(
    notes: string,
    projectId: string,
    meetingType?: string,
    attendees?: string[],
    authHeader?: string
  ): Promise<MeetingNotesResponse> {
    const response = await this.client.post(
      '/api/ai/meeting-notes/parse',
      {
        notes,
        project_id: projectId,
        meeting_type: meetingType,
        attendees: attendees || [],
      },
      {
        headers: this.forwardAuthHeader(authHeader),
        timeout: 60000, // 60 seconds for parsing long notes
      }
    );

    return this.transformResponse(response.data);
  }

  async parseTranscript(
    transcript: string,
    projectId: string,
    speakerNames?: string[],
    authHeader?: string
  ): Promise<MeetingNotesResponse> {
    const response = await this.client.post(
      '/api/ai/meeting-notes/parse-transcript',
      {
        transcript,
        project_id: projectId,
        speaker_names: speakerNames,
      },
      {
        headers: this.forwardAuthHeader(authHeader),
        timeout: 60000, // 60 seconds for parsing long transcripts
      }
    );

    return this.transformResponse(response.data);
  }

  async getMeetingTypes(authHeader?: string): Promise<MeetingTypesResponse> {
    const response = await this.client.get('/api/ai/meeting-notes/meeting-types', {
      headers: this.forwardAuthHeader(authHeader),
    });

    return this.transformResponse(response.data);
  }

  // ==================== NATIVE OPENAI REPORT ENDPOINTS ====================
  // These run directly via OpenAI SDK — no external service required.

  private extractJSON(text: string): Record<string, unknown> {
    // Strip markdown code fences if present (```json ... ```)
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenceMatch ? fenceMatch[1].trim() : text.trim();
    return JSON.parse(raw) as Record<string, unknown>;
  }

  async generateReportSummary(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (OPENAI_SANDBOX_MODE) {
      return {
        summary: 'AI is running in sandbox mode. Connect a live OpenAI API key to get real insights.',
        highlights: [],
        recommendations: [],
        generatedAt: new Date().toISOString(),
      };
    }

    const dataContext = JSON.stringify(body, null, 2);
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 1024,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            'You are a project analytics assistant. Analyze the provided report data and return a concise summary. ' +
            'Respond ONLY with a valid JSON object (no markdown, no extra text) with these keys: ' +
            'summary (string), highlights (array of strings), recommendations (array of strings), generatedAt (ISO timestamp).',
        },
        {
          role: 'user',
          content: `Analyze this report data and provide a structured summary:\n\n${dataContext}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = this.extractJSON(raw);
    parsed.generatedAt = parsed.generatedAt ?? new Date().toISOString();
    return parsed;
  }

  async explainMetrics(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (OPENAI_SANDBOX_MODE) {
      return {
        explanations: [
          { metric: 'AI Insights', explanation: 'AI is running in sandbox mode. Connect a live OpenAI API key to get real metric explanations.' },
        ],
        overallInsight: 'Sandbox mode active.',
        generatedAt: new Date().toISOString(),
      };
    }

    const dataContext = JSON.stringify(body, null, 2);
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 1024,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            'You are a project analytics assistant. Explain the provided metrics in plain language for non-technical stakeholders. ' +
            'Respond ONLY with a valid JSON object (no markdown, no extra text) with these keys: ' +
            'explanations (array of objects with metric and explanation string fields), overallInsight (string), generatedAt (ISO timestamp).',
        },
        {
          role: 'user',
          content: `Explain these metrics in plain, actionable language:\n\n${dataContext}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = this.extractJSON(raw);
    parsed.generatedAt = parsed.generatedAt ?? new Date().toISOString();
    return parsed;
  }

  async generateDescription(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const startTime = Date.now();

    if (OPENAI_SANDBOX_MODE) {
      return {
        description: 'AI is running in sandbox mode. Connect a live OpenAI API key to generate real descriptions.',
        suggestedAcceptanceCriteria: [],
        suggestedLabels: [],
        questions: [],
        relatedTopics: [],
        processingTimeMs: Date.now() - startTime,
      };
    }

    const { title, issueType, projectContext } = body as {
      title: string;
      issueType: string;
      projectContext?: Record<string, unknown>;
    };

    const contextBlock = projectContext
      ? `\nProject context: ${JSON.stringify(projectContext)}`
      : '';

    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 1024,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content:
            'You are a project management assistant. Generate a concise, clear issue description based on a title and issue type. ' +
            'Respond ONLY with a valid JSON object (no markdown, no extra text) with these keys: ' +
            'description (string), suggestedAcceptanceCriteria (array of strings), ' +
            'suggestedLabels (array of strings), questions (array of clarifying questions), ' +
            'relatedTopics (array of strings).',
        },
        {
          role: 'user',
          content: `Generate a description for this ${issueType} issue titled: "${title}"${contextBlock}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = this.extractJSON(raw);
    parsed.processingTimeMs = Date.now() - startTime;
    return parsed;
  }

  // Generic proxy method for forwarding requests to AI service
  // Includes request deduplication and response caching for eligible endpoints
  async proxyRequest(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: unknown,
    authHeader?: string
  ): Promise<unknown> {
    // --- Response cache check (read-through) ---
    const cacheTTL = (method === 'GET' || method === 'POST') ? getCacheTTL(path) : null;
    if (cacheTTL) {
      const ck = buildCacheKey(path, body, authHeader);
      const cached = await cacheService.get<unknown>(ck);
      if (cached !== null) {
        return cached;
      }
    }

    // --- In-flight deduplication ---
    const dedupeKey = buildDedupeKey(method, path, body);
    const existing = inflightRequests.get(dedupeKey);
    if (existing) {
      return existing;
    }

    const promise = this.executeProxyRequest(path, method, body, authHeader, cacheTTL);

    // Only deduplicate non-mutating semantics
    if (method === 'GET' || method === 'POST') {
      inflightRequests.set(dedupeKey, promise);
      promise.finally(() => inflightRequests.delete(dedupeKey));
    }

    return promise;
  }

  private async executeProxyRequest(
    path: string,
    method: string,
    body: unknown | undefined,
    authHeader: string | undefined,
    cacheTTL: number | null,
  ): Promise<unknown> {
    const cfg = {
      headers: this.forwardAuthHeader(authHeader),
      timeout: 60000, // 60 seconds for AI operations
    };

    let response;
    switch (method) {
      case 'GET':
        response = await this.client.get(path, cfg);
        break;
      case 'POST':
        response = await this.client.post(path, body, cfg);
        break;
      case 'PUT':
        response = await this.client.put(path, body, cfg);
        break;
      case 'DELETE':
        response = await this.client.delete(path, cfg);
        break;
    }

    const result = this.transformResponse(response!.data);

    // --- Write to cache if eligible ---
    if (cacheTTL) {
      const ck = buildCacheKey(path, body, authHeader);
      await cacheService.set(ck, result, { ttl: cacheTTL, tags: ['ai-cache'] });
    }

    return result;
  }

  // Keys that should NOT be transformed from snake_case (they are user data, not API fields)
  private static readonly SNAKE_CASE_EXCLUDE_KEYS = new Set([
    'metadata', 'featureFlags', 'feature_flags', 'customPrompts', 'custom_prompts',
    'factors', 'recommendationData', 'recommendation_data',
    'originalSuggestion', 'original_suggestion', 'finalValue', 'final_value',
  ]);

  // Transform snake_case response to camelCase with runtime validation
  private transformResponse<T>(data: unknown): T {
    // Guard: ensure the AI service returned a valid response object
    if (data === null || data === undefined) {
      throw new Error('AI service returned an empty response');
    }
    if (typeof data === 'string') {
      // Attempt to parse string responses as JSON
      try {
        data = JSON.parse(data);
      } catch {
        throw new Error('AI service returned a non-JSON string response');
      }
    }
    if (typeof data !== 'object') {
      throw new Error(`AI service returned unexpected response type: ${typeof data}`);
    }
    return this.snakeToCamel(data) as T;
  }

  private snakeToCamel(obj: unknown, parentKey?: string): unknown {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.snakeToCamel(item, parentKey));
    }

    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).reduce(
        (result, key) => {
          const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
            letter.toUpperCase()
          );
          // Skip recursive transformation for data-payload keys (user content, not API fields)
          if (AIService.SNAKE_CASE_EXCLUDE_KEYS.has(key) || AIService.SNAKE_CASE_EXCLUDE_KEYS.has(camelKey)) {
            result[camelKey] = (obj as Record<string, unknown>)[key];
          } else {
            result[camelKey] = this.snakeToCamel(
              (obj as Record<string, unknown>)[key],
              camelKey
            );
          }
          return result;
        },
        {} as Record<string, unknown>
      );
    }

    return obj;
  }
}

export const aiService = new AIService();
