import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';
import {
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
  ImproveTextStyle,
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
  // Enhanced Content Generation
  ContentTone,
  ContentStyleEnhanced,
  GenerateVariantsResponse,
  EnhanceContentResponse,
  SuggestTitlesResponse,
  GenerateTemplateResponse,
  SmartAutocompleteResponse,
  GenerateDescriptionResponse,
  ImproveWithFeedbackResponse,
  AvailableTonesResponse,
  AvailableStylesResponse,
  // Natural Language Search
  ParseQueryResponse,
  QueryCompletionResponse,
  ExplainJQLResponse,
  QueryExamplesResponse,
  ValidateJQLResponse,
  SupportedJQLFieldsResponse,
  // Issue Triage
  TriageResultResponse,
  ClassifyResultResponse,
  SuggestAssigneesResponse,
  BatchTriageResponse,
  TriageCategoriesResponse,
  // Summarization
  SummaryLength,
  SummaryFormat,
  IssueSummaryResponse,
  ThreadSummaryResponse,
  BulkSummaryResponse,
  DailyDigestResponse,
  SummaryLengthsResponse,
  SummaryFormatsResponse,
  // Phase 5: Resolution RAG
  FindSimilarResolvedResponse,
  GenerateSuggestionResponse,
  CheckDuplicateResponse,
  AnalyzePatternsResponse,
  SuggestAssigneeFromHistoryResponse,
  FullResolutionAnalysisResponse,
  ResolutionCategoriesResponse,
  // Phase 5: Risk Visualization
  RiskGraphResponse,
  ImpactAnalysisResponse,
  WhatIfAnalysisResponse,
  RiskSummaryResponse,
  RiskLevelsResponse,
  // Phase 5: Release Planning
  ReleasePlanResponse,
  CapacityAnalysisResponse,
  ScopeSuggestionResponse,
  RoadmapResponse,
  DateEstimateResponse,
  ReleaseTypesResponse,
  // Phase 5: Test Generation
  GenerateTestsResponse,
  TestSuiteResponse,
  TestCoverageResponse,
  AutomationCandidatesResponse,
  TestTypesResponse,
  TestPrioritiesResponse,
  // Phase 5: Retrospective
  AnalyzeRetroItemsResponse,
  GenerateRetroActionsResponse,
  RetroSummaryResponse,
  SuggestTopicsResponse,
  CompareRetrosResponse,
  FacilitationScriptResponse,
  RetroFormatsResponse,
  InsightCategoriesResponse,
  SprintAnalysis,
  // Phase 5: Template Generation
  TemplateResponse,
  WorkflowTemplateResponse,
  ChecklistTemplateResponse,
  MeetingTemplateResponse,
  SuggestFieldsResponse,
  DocumentationTemplateResponse,
  TemplateTypesResponse,
  FieldTypesResponse,
  // Phase 6: Code Review
  PRAnalysisResponse,
  ReviewSnippetResponse,
  SuggestCodeImprovementsResponse,
  ReviewSummaryResponse,
  SecurityCheckResponse,
  SuggestTestsForCodeResponse,
  // Phase 6: Automation Generation
  AutomationRule,
  GenerateAutomationResponse,
  SuggestAutomationsResponse,
  ValidateRuleResponse,
  ExplainRuleResponse,
  OptimizeRulesResponse,
  GenerateFromExampleResponse,
  // Phase 6: Terminology
  DefineTermResponse,
  ExtractTermsResponse,
  CheckConsistencyResponse,
  SimplifyDefinitionResponse,
  FindRelatedTermsResponse,
  GenerateGlossaryResponse,
  TranslateJargonResponse,
  SuggestTermImprovementsResponse,
  // Phase 6: Onboarding
  GenerateChecklistResponse,
  GetNextStepsResponse,
  GenerateContextualTipsResponse,
  LearningPathResponse,
  AnswerQuestionResponse,
  AssessReadinessResponse,
  WelcomeMessageResponse,
  SuggestBuddyResponse,
  // Phase 6: Reports
  CreatedResolvedReport,
  ReportDataPoint,
  GenerateCreatedResolvedReportResponse,
  ReportSummaryResponseType,
  ComparePeriodsResponse,
  ForecastBacklogResponse,
  IdentifyBottlenecksResponse,
  TeamPerformanceResponse,
  ExplainMetricsResponse,
  SuggestVisualizationsResponse,
} from './types';


export const aiApi = createApi({
  reducerPath: 'aiApi',
  baseQuery: createAuthBaseQuery('/api/v1/ai'),
  tagTypes: ['AISuggestions', 'AIStats', 'AIFeedback', 'AIAnalytics', 'AIConfig'],
  endpoints: (builder) => ({
    // Issue Suggestions
    getIssueSuggestions: builder.query<
      IssueSuggestionResponse,
      { title: string; description: string; projectId: string }
    >({
      query: (body) => ({
        url: '/issues/suggest',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: IssueSuggestionResponse }) => response.data,
      providesTags: ['AISuggestions'],
    }),

    // Similar Issues
    findSimilarIssues: builder.query<
      SimilarIssuesResponse,
      { title: string; description: string; projectId: string; limit?: number }
    >({
      query: (body) => ({
        url: '/issues/similar',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SimilarIssuesResponse }) => response.data,
    }),

    // Natural Language Parsing
    parseNaturalLanguage: builder.mutation<
      NaturalLanguageResponse,
      { text: string; projectId: string }
    >({
      query: (body) => ({
        url: '/issues/parse',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: NaturalLanguageResponse }) => response.data,
    }),

    // Bulk Natural Language Parsing
    parseBulkIssues: builder.mutation<
      BulkNaturalLanguageResponse,
      { text: string; projectId: string }
    >({
      query: (body) => ({
        url: '/issues/parse-bulk',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: BulkNaturalLanguageResponse }) => response.data,
    }),

    // Writing Assistant - Expand Notes
    expandNotes: builder.mutation<
      ExpandNotesResponse,
      { notes: string; context?: string }
    >({
      query: (body) => ({
        url: '/writing/expand-notes',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ExpandNotesResponse }) => response.data,
    }),

    // Writing Assistant - Improve Text
    improveText: builder.mutation<
      ImproveTextResponse,
      { text: string; style: ImproveTextStyle }
    >({
      query: (body) => ({
        url: '/writing/improve',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ImproveTextResponse }) => response.data,
    }),

    // Writing Assistant - Acceptance Criteria
    generateAcceptanceCriteria: builder.mutation<
      AcceptanceCriteriaResponse,
      { title: string; description: string }
    >({
      query: (body) => ({
        url: '/writing/acceptance-criteria',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: AcceptanceCriteriaResponse }) => response.data,
    }),

    // Writing Assistant - Summarize
    summarizeText: builder.mutation<
      SummarizeResponse,
      { text: string; maxLength?: number }
    >({
      query: (body) => ({
        url: '/writing/summarize',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SummarizeResponse }) => response.data,
    }),

    // Sprint Planning - Scope Recommendation
    recommendSprintScope: builder.query<
      SprintScopeResponse,
      { projectId: string; sprintDurationDays?: number; targetPoints?: number }
    >({
      query: (body) => ({
        url: '/planning/sprint-scope',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SprintScopeResponse }) => response.data,
    }),

    // Sprint Planning - Workload Analysis
    analyzeWorkload: builder.query<
      WorkloadAnalysisResponse,
      { projectId: string; sprintId?: string }
    >({
      query: (body) => ({
        url: '/planning/workload-analysis',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: WorkloadAnalysisResponse }) => response.data,
    }),

    // AI Usage Stats
    getAIStats: builder.query<AIUsageStats, void>({
      query: () => '/stats',
      transformResponse: (response: { data: AIUsageStats }) => response.data,
      providesTags: ['AIStats'],
    }),

    // Health Check
    checkAIHealth: builder.query<{ status: string; version: string }, void>({
      query: () => '/health',
      transformResponse: (response: { data: { status: string; version: string } }) =>
        response.data,
    }),

    // Story Point Estimation
    estimateStoryPoints: builder.query<
      StoryPointEstimate,
      { title: string; description: string; projectId: string }
    >({
      query: (body) => ({
        url: '/issues/estimate-points',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: StoryPointEstimate }) => response.data,
    }),

    // Assignee Suggestion
    suggestAssignee: builder.query<
      AssigneeSuggestionResponse,
      { title: string; description: string; projectId: string }
    >({
      query: (body) => ({
        url: '/issues/suggest-assignee',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: AssigneeSuggestionResponse }) => response.data,
    }),

    // Team Expertise
    getTeamExpertise: builder.query<TeamExpertiseResponse, string>({
      query: (projectId) => `/issues/team-expertise/${projectId}`,
      transformResponse: (response: { data: TeamExpertiseResponse }) => response.data,
    }),

    // Suggest Issue Order
    suggestIssueOrder: builder.query<
      IssueOrderResponse,
      { projectId: string; sprintId: string }
    >({
      query: (body) => ({
        url: '/planning/suggest-order',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: IssueOrderResponse }) => response.data,
    }),

    // Predict Completion
    predictCompletion: builder.query<
      CompletionPredictionResponse,
      { projectId: string; sprintId: string }
    >({
      query: (body) => ({
        url: '/planning/predict-completion',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: CompletionPredictionResponse }) => response.data,
    }),

    // Generate Standup
    generateStandup: builder.mutation<
      StandupResponse,
      { projectId: string; sprintId: string; userId?: string }
    >({
      query: (body) => ({
        url: '/planning/generate-standup',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: StandupResponse }) => response.data,
    }),

    // Analyze Sprint Risks
    analyzeSprintRisks: builder.query<
      SprintRiskResponse,
      { projectId: string; sprintId: string }
    >({
      query: (body) => ({
        url: '/planning/analyze-risks',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SprintRiskResponse }) => response.data,
    }),

    // Suggest Reassignments
    suggestReassignments: builder.query<
      ReassignmentResponse,
      { projectId: string; sprintId: string }
    >({
      query: (body) => ({
        url: '/planning/suggest-reassignments',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ReassignmentResponse }) => response.data,
    }),

    // Predictive Analytics - Project Risks
    getProjectRisks: builder.query<
      ProjectRiskResponse,
      { projectId: string }
    >({
      query: (body) => ({
        url: '/predictions/project-risks',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ProjectRiskResponse }) => response.data,
    }),

    // Predictive Analytics - Issue Completion
    predictIssueCompletion: builder.query<
      IssueCompletionResponse,
      { issueId: string; projectId: string }
    >({
      query: (body) => ({
        url: '/predictions/issue-completion',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: IssueCompletionResponse }) => response.data,
    }),

    // Predictive Analytics - At-Risk Issues
    getAtRiskIssues: builder.query<
      AtRiskIssuesResponse,
      { projectId: string; sprintId?: string }
    >({
      query: (body) => ({
        url: '/predictions/at-risk-issues',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: AtRiskIssuesResponse }) => response.data,
    }),

    // Predictive Analytics - Velocity Trends
    getVelocityTrends: builder.query<
      VelocityTrendResponse,
      { projectId: string }
    >({
      query: (body) => ({
        url: '/predictions/velocity-trends',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: VelocityTrendResponse }) => response.data,
    }),

    // Predictive Analytics - Workflow Bottlenecks
    getWorkflowBottlenecks: builder.query<
      WorkflowBottleneckResponse,
      { projectId: string; sprintId?: string }
    >({
      query: (body) => ({
        url: '/predictions/workflow-bottlenecks',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: WorkflowBottleneckResponse }) => response.data,
    }),

    // Predictive Analytics - Risk Alerts
    getRiskAlerts: builder.query<
      RiskAlertsResponse,
      { projectId: string }
    >({
      query: (body) => ({
        url: '/predictions/risk-alerts',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: RiskAlertsResponse }) => response.data,
    }),

    // ==================== FEEDBACK ====================

    // Record Feedback
    recordFeedback: builder.mutation<
      FeedbackResponse,
      {
        suggestionType: string;
        suggestionId: string;
        accepted: boolean;
        rating?: number;
        comment?: string;
        metadata?: Record<string, unknown>;
      }
    >({
      query: (body) => ({
        url: '/admin/feedback',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: FeedbackResponse }) => response.data,
      invalidatesTags: ['AIFeedback'],
    }),

    // Get Acceptance Rate
    getAcceptanceRate: builder.query<
      AcceptanceRateResponse,
      { suggestionType: string; days?: number }
    >({
      query: (body) => ({
        url: '/admin/feedback/acceptance-rate',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: AcceptanceRateResponse }) => response.data,
      providesTags: ['AIFeedback'],
    }),

    // Get Feedback Summary
    getFeedbackSummary: builder.query<FeedbackSummaryResponse, { days?: number }>({
      query: ({ days = 30 }) => `/admin/feedback/summary?days=${days}`,
      transformResponse: (response: { data: FeedbackSummaryResponse }) => response.data,
      providesTags: ['AIFeedback'],
    }),

    // Get Feedback Insights
    getFeedbackInsights: builder.query<FeedbackInsightsResponse, void>({
      query: () => '/admin/feedback/insights',
      transformResponse: (response: { data: FeedbackInsightsResponse }) => response.data,
      providesTags: ['AIFeedback'],
    }),

    // ==================== ANALYTICS ====================

    // Get Usage Statistics
    getAnalyticsUsage: builder.query<
      UsageStatsResponse,
      { startDate?: string; endDate?: string; projectId?: string }
    >({
      query: (body) => ({
        url: '/admin/analytics/usage',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: UsageStatsResponse }) => response.data,
      providesTags: ['AIAnalytics'],
    }),

    // Get Cost Estimate
    getCostEstimate: builder.query<
      CostEstimateResponse,
      { startDate?: string; endDate?: string; projectId?: string }
    >({
      query: (body) => ({
        url: '/admin/analytics/cost',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: CostEstimateResponse }) => response.data,
      providesTags: ['AIAnalytics'],
    }),

    // Get Daily Trends
    getDailyTrends: builder.query<
      DailyTrendsResponse,
      { days?: number; projectId?: string }
    >({
      query: ({ days = 14, projectId }) => {
        const params = new URLSearchParams({ days: String(days) });
        if (projectId) params.append('projectId', projectId);
        return `/admin/analytics/trends?${params.toString()}`;
      },
      transformResponse: (response: { data: DailyTrendsResponse }) => response.data,
      providesTags: ['AIAnalytics'],
    }),

    // Get Top Users
    getTopUsers: builder.query<TopUsersResponse, { days?: number; limit?: number }>({
      query: ({ days = 30, limit = 10 }) =>
        `/admin/analytics/top-users?days=${days}&limit=${limit}`,
      transformResponse: (response: { data: TopUsersResponse }) => response.data,
      providesTags: ['AIAnalytics'],
    }),

    // Get Endpoint Performance
    getEndpointPerformance: builder.query<EndpointPerformanceResponse, void>({
      query: () => '/admin/analytics/endpoints',
      transformResponse: (response: { data: EndpointPerformanceResponse }) => response.data,
      providesTags: ['AIAnalytics'],
    }),

    // ==================== CONFIG ====================

    // Get Project Config
    getProjectConfig: builder.query<ProjectConfigResponse, string>({
      query: (projectId) => `/admin/config/${projectId}`,
      transformResponse: (response: { data: ProjectConfigResponse }) => response.data,
      providesTags: ['AIConfig'],
    }),

    // Update Project Config
    updateProjectConfig: builder.mutation<
      ProjectConfigResponse,
      {
        projectId: string;
        enabled?: boolean;
        features?: Partial<{
          suggestions: boolean;
          nlpParsing: boolean;
          writingAssist: boolean;
          planning: boolean;
          predictions: boolean;
          similarIssues: boolean;
          standupGeneration: boolean;
        }>;
        limits?: Partial<{
          requestsPerUserPerDay: number;
          requestsPerProjectPerDay: number;
          maxInputTokens: number;
          maxOutputTokens: number;
        }>;
      }
    >({
      query: (body) => ({
        url: '/admin/config',
        method: 'PUT',
        body,
      }),
      transformResponse: (response: { data: ProjectConfigResponse }) => response.data,
      invalidatesTags: ['AIConfig'],
    }),

    // Reset Project Config
    resetProjectConfig: builder.mutation<ProjectConfigResponse, string>({
      query: (projectId) => ({
        url: `/admin/config/${projectId}`,
        method: 'DELETE',
      }),
      transformResponse: (response: { data: ProjectConfigResponse }) => response.data,
      invalidatesTags: ['AIConfig'],
    }),

    // Check Rate Limit
    checkRateLimit: builder.query<
      RateLimitCheckResponse,
      { projectId: string; userId: string }
    >({
      query: (body) => ({
        url: '/admin/config/check-rate-limit',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: RateLimitCheckResponse }) => response.data,
    }),

    // Get Feature Availability
    getFeatureAvailability: builder.query<FeatureAvailabilityResponse, string>({
      query: (projectId) => `/admin/config/${projectId}/features`,
      transformResponse: (response: { data: FeatureAvailabilityResponse }) => response.data,
      providesTags: ['AIConfig'],
    }),

    // ==================== ENHANCED CONTENT GENERATION ====================

    // Generate Content Variants
    generateContentVariants: builder.mutation<
      GenerateVariantsResponse,
      { text: string; tones?: ContentTone[]; context?: string }
    >({
      query: (body) => ({
        url: '/content/variants',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateVariantsResponse }) => response.data,
    }),

    // Enhance Content with Tone and Style
    enhanceContent: builder.mutation<
      EnhanceContentResponse,
      {
        text: string;
        tone?: ContentTone;
        style?: ContentStyleEnhanced;
        context?: string;
        preserveStructure?: boolean;
      }
    >({
      query: (body) => ({
        url: '/content/enhance',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: EnhanceContentResponse }) => response.data,
    }),

    // Suggest Titles from Description
    suggestTitles: builder.mutation<
      SuggestTitlesResponse,
      {
        description: string;
        issueType?: string;
        existingTitles?: string[];
        count?: number;
      }
    >({
      query: (body) => ({
        url: '/content/suggest-titles',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestTitlesResponse }) => response.data,
    }),

    // Generate Issue Template
    generateIssueTemplate: builder.mutation<
      GenerateTemplateResponse,
      { issueType: string; projectContext?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/content/generate-template',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateTemplateResponse }) => response.data,
    }),

    // Smart Autocomplete
    smartAutocomplete: builder.mutation<
      SmartAutocompleteResponse,
      { partialText: string; fieldType?: string; context?: string }
    >({
      query: (body) => ({
        url: '/content/autocomplete',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SmartAutocompleteResponse }) => response.data,
    }),

    // Generate Description from Title
    generateDescription: builder.mutation<
      GenerateDescriptionResponse,
      { title: string; issueType: string; projectContext?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/content/generate-description',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateDescriptionResponse }) => response.data,
    }),

    // Improve Content with Feedback
    improveWithFeedback: builder.mutation<
      ImproveWithFeedbackResponse,
      { text: string; feedback: string; previousVersions?: string[] }
    >({
      query: (body) => ({
        url: '/content/improve-with-feedback',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ImproveWithFeedbackResponse }) => response.data,
    }),

    // Get Available Tones
    getAvailableTones: builder.query<AvailableTonesResponse, void>({
      query: () => '/content/tones',
    }),

    // Get Available Styles
    getAvailableStyles: builder.query<AvailableStylesResponse, void>({
      query: () => '/content/styles',
    }),

    // ==================== NATURAL LANGUAGE SEARCH ====================

    // Parse Natural Language Query to JQL
    parseNLQuery: builder.mutation<
      ParseQueryResponse,
      { query: string; projectId?: string; projectContext?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/nl-search/parse',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ParseQueryResponse }) => response.data,
    }),

    // Get Query Completions
    getQueryCompletions: builder.mutation<
      QueryCompletionResponse,
      { partialQuery: string; projectContext?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/nl-search/completions',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: QueryCompletionResponse }) => response.data,
    }),

    // Explain JQL Query
    explainJQL: builder.mutation<ExplainJQLResponse, { jql: string }>({
      query: (body) => ({
        url: '/nl-search/explain',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ExplainJQLResponse }) => response.data,
    }),

    // Get Query Examples
    getQueryExamples: builder.query<QueryExamplesResponse, string | void>({
      query: (category) => `/nl-search/examples${category ? `?category=${category}` : ''}`,
    }),

    // Validate JQL
    validateJQL: builder.mutation<ValidateJQLResponse, { jql: string }>({
      query: (body) => ({
        url: '/nl-search/validate',
        method: 'POST',
        body,
      }),
    }),

    // Get Supported JQL Fields
    getSupportedJQLFields: builder.query<SupportedJQLFieldsResponse, void>({
      query: () => '/nl-search/fields',
    }),

    // ==================== ISSUE TRIAGE ====================

    // Full Triage (classification + assignment)
    triageIssue: builder.mutation<
      TriageResultResponse,
      {
        title: string;
        description?: string;
        projectId?: string;
        projectContext?: Record<string, unknown>;
        includeAssignment?: boolean;
      }
    >({
      query: (body) => ({
        url: '/triage/triage',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: TriageResultResponse }) => response.data,
    }),

    // Classify Issue (without assignment)
    classifyIssue: builder.mutation<
      ClassifyResultResponse,
      { title: string; description?: string; projectContext?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/triage/classify',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ClassifyResultResponse }) => response.data,
    }),

    // Suggest Assignees
    suggestAssigneesForTriage: builder.mutation<
      SuggestAssigneesResponse,
      {
        title: string;
        description?: string;
        category?: string;
        complexity?: string;
        requiredSkills?: string[];
        affectedComponents?: string[];
        teamMembers: Array<{ id: string; name: string; skills?: string[] }>;
        workloads?: Record<string, { currentTasks: number; level: string }>;
      }
    >({
      query: (body) => ({
        url: '/triage/suggest-assignees',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestAssigneesResponse }) => response.data,
    }),

    // Batch Triage
    batchTriage: builder.mutation<
      BatchTriageResponse,
      { issues: Array<{ title: string; description?: string }>; projectContext: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/triage/batch',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: BatchTriageResponse }) => response.data,
    }),

    // Get Triage Categories
    getTriageCategories: builder.query<TriageCategoriesResponse, void>({
      query: () => '/triage/categories',
    }),

    // ==================== SUMMARIZATION ====================

    // Summarize Issue
    summarizeIssue: builder.mutation<
      IssueSummaryResponse,
      {
        title: string;
        description?: string;
        comments?: Array<{ author: string; content: string; createdAt?: string }>;
        status?: string;
        metadata?: Record<string, unknown>;
        length?: SummaryLength;
        format?: SummaryFormat;
      }
    >({
      query: (body) => ({
        url: '/summarize/issue',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: IssueSummaryResponse }) => response.data,
    }),

    // Summarize Thread
    summarizeThread: builder.mutation<
      ThreadSummaryResponse,
      {
        comments: Array<{ author: string; content: string; createdAt?: string }>;
        issueContext?: { title: string; status: string };
        length?: SummaryLength;
      }
    >({
      query: (body) => ({
        url: '/summarize/thread',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ThreadSummaryResponse }) => response.data,
    }),

    // Summarize Bulk Issues
    summarizeBulk: builder.mutation<
      BulkSummaryResponse,
      {
        issues: Array<{ key?: string; title: string; status: string; priority?: string }>;
        context?: string;
        groupBy?: 'status' | 'priority' | 'assignee' | 'type';
      }
    >({
      query: (body) => ({
        url: '/summarize/bulk',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: BulkSummaryResponse }) => response.data,
    }),

    // Generate Daily Digest
    generateDailyDigest: builder.mutation<
      DailyDigestResponse,
      {
        projectName: string;
        issuesUpdated?: Array<{ key: string; title: string }>;
        issuesCreated?: Array<{ key: string; title: string }>;
        issuesCompleted?: Array<{ key: string; title: string }>;
      }
    >({
      query: (body) => ({
        url: '/summarize/daily-digest',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: DailyDigestResponse }) => response.data,
    }),

    // Get Summary Length Options
    getSummaryLengths: builder.query<SummaryLengthsResponse, void>({
      query: () => '/summarize/lengths',
    }),

    // Get Summary Format Options
    getSummaryFormats: builder.query<SummaryFormatsResponse, void>({
      query: () => '/summarize/formats',
    }),

    // ==================== PHASE 5: RESOLUTION RAG ====================

    // Find Similar Resolved Issues
    findSimilarResolvedIssues: builder.mutation<
      FindSimilarResolvedResponse,
      {
        title: string;
        description?: string;
        projectId?: string;
        limit?: number;
        minSimilarity?: number;
      }
    >({
      query: (body) => ({
        url: '/resolution/similar',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: FindSimilarResolvedResponse }) => response.data,
    }),

    // Generate Resolution Suggestion
    generateResolutionSuggestion: builder.mutation<
      GenerateSuggestionResponse,
      {
        issueId: string;
        title: string;
        description?: string;
        similarIssues?: Array<{ id: string; title: string; resolution?: string }>;
      }
    >({
      query: (body) => ({
        url: '/resolution/suggest',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateSuggestionResponse }) => response.data,
    }),

    // Check for Duplicate
    checkForDuplicate: builder.mutation<
      CheckDuplicateResponse,
      { title: string; description?: string; projectId?: string }
    >({
      query: (body) => ({
        url: '/resolution/check-duplicate',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: CheckDuplicateResponse }) => response.data,
    }),

    // Analyze Resolution Patterns
    analyzeResolutionPatterns: builder.query<
      AnalyzePatternsResponse,
      { projectId: string; category?: string; limit?: number }
    >({
      query: ({ projectId, category, limit }) => {
        const params = new URLSearchParams({ projectId });
        if (category) params.append('category', category);
        if (limit) params.append('limit', String(limit));
        return `/resolution/patterns?${params.toString()}`;
      },
      transformResponse: (response: { data: AnalyzePatternsResponse }) => response.data,
    }),

    // Suggest Assignee from History
    suggestAssigneeFromHistory: builder.mutation<
      SuggestAssigneeFromHistoryResponse,
      {
        title: string;
        description?: string;
        category?: string;
        projectId?: string;
      }
    >({
      query: (body) => ({
        url: '/resolution/suggest-assignee',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestAssigneeFromHistoryResponse }) => response.data,
    }),

    // Get Full Resolution Analysis
    getFullResolutionAnalysis: builder.mutation<
      FullResolutionAnalysisResponse,
      {
        issueId: string;
        title: string;
        description?: string;
        projectId?: string;
      }
    >({
      query: (body) => ({
        url: '/resolution/analyze',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: FullResolutionAnalysisResponse }) => response.data,
    }),

    // Learn from Resolution
    learnFromResolution: builder.mutation<
      { success: boolean },
      {
        issueId: string;
        resolution: string;
        category?: string;
        timeToResolve?: number;
      }
    >({
      query: (body) => ({
        url: '/resolution/learn',
        method: 'POST',
        body,
      }),
    }),

    // Get Resolution Categories
    getResolutionCategories: builder.query<ResolutionCategoriesResponse, void>({
      query: () => '/resolution/categories',
    }),

    // ==================== PHASE 5: RISK VISUALIZATION ====================

    // Build Risk Graph
    buildRiskGraph: builder.mutation<
      RiskGraphResponse,
      {
        projectId: string;
        sprintId?: string;
        includeResolved?: boolean;
        maxDepth?: number;
      }
    >({
      query: (body) => ({
        url: '/risk/graph',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: RiskGraphResponse }) => response.data,
    }),

    // Analyze Node Impact
    analyzeNodeImpact: builder.mutation<
      ImpactAnalysisResponse,
      { nodeId: string; projectId: string }
    >({
      query: (body) => ({
        url: '/risk/impact',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ImpactAnalysisResponse }) => response.data,
    }),

    // Run What-If Analysis
    runWhatIfAnalysis: builder.mutation<
      WhatIfAnalysisResponse,
      {
        projectId: string;
        scenario: string;
        changes: Array<{ nodeId: string; field: string; newValue: unknown }>;
      }
    >({
      query: (body) => ({
        url: '/risk/what-if',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: WhatIfAnalysisResponse }) => response.data,
    }),

    // Get Risk Summary
    getRiskSummary: builder.query<RiskSummaryResponse, string>({
      query: (projectId) => `/risk/summary?projectId=${projectId}`,
      transformResponse: (response: { data: RiskSummaryResponse }) => response.data,
    }),

    // Get Risk Levels
    getRiskLevels: builder.query<RiskLevelsResponse, void>({
      query: () => '/risk/levels',
    }),

    // ==================== PHASE 5: RELEASE PLANNING ====================

    // Generate Release Plan
    generateReleasePlan: builder.mutation<
      ReleasePlanResponse,
      {
        projectId: string;
        releaseName: string;
        targetDate?: string;
        issueIds?: string[];
        constraints?: Record<string, unknown>;
      }
    >({
      query: (body) => ({
        url: '/release/generate',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ReleasePlanResponse }) => response.data,
    }),

    // Analyze Capacity
    analyzeReleaseCapacity: builder.mutation<
      CapacityAnalysisResponse,
      {
        projectId: string;
        startDate: string;
        endDate: string;
        teamMembers?: Array<{ id: string; name: string; availability?: number }>;
      }
    >({
      query: (body) => ({
        url: '/release/capacity',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: CapacityAnalysisResponse }) => response.data,
    }),

    // Suggest Release Scope
    suggestReleaseScope: builder.mutation<
      ScopeSuggestionResponse,
      {
        projectId: string;
        targetPoints: number;
        priorities?: string[];
        excludeIds?: string[];
      }
    >({
      query: (body) => ({
        url: '/release/suggest-scope',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ScopeSuggestionResponse }) => response.data,
    }),

    // Generate Roadmap
    generateRoadmap: builder.mutation<
      RoadmapResponse,
      {
        projectId: string;
        quarters: number;
        themes?: string[];
      }
    >({
      query: (body) => ({
        url: '/release/roadmap',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: RoadmapResponse }) => response.data,
    }),

    // Estimate Release Date
    estimateReleaseDate: builder.mutation<
      DateEstimateResponse,
      {
        projectId: string;
        issueIds: string[];
        teamCapacity?: number;
      }
    >({
      query: (body) => ({
        url: '/release/estimate-date',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: DateEstimateResponse }) => response.data,
    }),

    // Get Release Types
    getReleaseTypes: builder.query<ReleaseTypesResponse, void>({
      query: () => '/release/types',
    }),

    // ==================== PHASE 5: TEST GENERATION ====================

    // Generate Test Cases
    generateTestCases: builder.mutation<
      GenerateTestsResponse,
      {
        issueId: string;
        title: string;
        description?: string;
        acceptanceCriteria?: string[];
        testType?: string;
      }
    >({
      query: (body) => ({
        url: '/tests/generate',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateTestsResponse }) => response.data,
    }),

    // Generate Test Suite
    generateTestSuite: builder.mutation<
      TestSuiteResponse,
      {
        featureName: string;
        issues: Array<{ id: string; title: string; description?: string }>;
        testTypes?: string[];
      }
    >({
      query: (body) => ({
        url: '/tests/suite',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: TestSuiteResponse }) => response.data,
    }),

    // Generate Edge Cases
    generateEdgeCases: builder.mutation<
      GenerateTestsResponse,
      {
        issueId: string;
        title: string;
        description?: string;
        existingTests?: string[];
      }
    >({
      query: (body) => ({
        url: '/tests/edge-cases',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateTestsResponse }) => response.data,
    }),

    // Generate Regression Tests
    generateRegressionTests: builder.mutation<
      GenerateTestsResponse,
      {
        issueId: string;
        changeDescription: string;
        affectedAreas?: string[];
      }
    >({
      query: (body) => ({
        url: '/tests/regression',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateTestsResponse }) => response.data,
    }),

    // Analyze Test Coverage
    analyzeTestCoverage: builder.mutation<
      TestCoverageResponse,
      {
        projectId: string;
        existingTests: Array<{ name: string; type: string; coveredAreas?: string[] }>;
        issues: Array<{ id: string; title: string }>;
      }
    >({
      query: (body) => ({
        url: '/tests/coverage',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: TestCoverageResponse }) => response.data,
    }),

    // Suggest Automation Candidates
    suggestAutomationCandidates: builder.mutation<
      AutomationCandidatesResponse,
      {
        tests: Array<{ name: string; type: string; steps?: string[] }>;
        projectContext?: Record<string, unknown>;
      }
    >({
      query: (body) => ({
        url: '/tests/automation-candidates',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: AutomationCandidatesResponse }) => response.data,
    }),

    // Get Test Types
    getTestTypes: builder.query<TestTypesResponse, void>({
      query: () => '/tests/types',
    }),

    // Get Test Priorities
    getTestPriorities: builder.query<TestPrioritiesResponse, void>({
      query: () => '/tests/priorities',
    }),

    // ==================== PHASE 5: RETROSPECTIVE ====================

    // Analyze Retro Items
    analyzeRetroItems: builder.mutation<
      AnalyzeRetroItemsResponse,
      {
        items: Array<{ id: string; category: string; content: string; votes?: number; author?: string }>;
        sprintContext?: Record<string, unknown>;
      }
    >({
      query: (body) => ({
        url: '/retro/analyze',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: AnalyzeRetroItemsResponse }) => response.data,
    }),

    // Generate Action Items
    generateRetroActions: builder.mutation<
      GenerateRetroActionsResponse,
      {
        insights: Array<{ title: string; description: string; category: string; importance: string }>;
        teamMembers?: Array<{ id: string; name: string }>;
        existingActions?: string[];
      }
    >({
      query: (body) => ({
        url: '/retro/actions',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateRetroActionsResponse }) => response.data,
    }),

    // Analyze Sprint Performance
    analyzeSprintPerformance: builder.mutation<
      SprintAnalysis,
      {
        sprintData: Record<string, unknown>;
        previousSprints?: Array<Record<string, unknown>>;
      }
    >({
      query: (body) => ({
        url: '/retro/sprint-analysis',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SprintAnalysis }) => response.data,
    }),

    // Generate Retro Summary
    generateRetroSummary: builder.mutation<
      RetroSummaryResponse,
      {
        sprintName: string;
        items: Array<{ id: string; category: string; content: string; votes?: number }>;
        sprintData: Record<string, unknown>;
        teamMembers?: Array<{ id: string; name: string }>;
      }
    >({
      query: (body) => ({
        url: '/retro/summary',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: RetroSummaryResponse }) => response.data,
    }),

    // Suggest Discussion Topics
    suggestRetroTopics: builder.mutation<
      SuggestTopicsResponse,
      {
        items: Array<{ id: string; category: string; content: string; votes?: number }>;
        timeAvailableMinutes?: number;
      }
    >({
      query: (body) => ({
        url: '/retro/topics',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestTopicsResponse }) => response.data,
    }),

    // Compare Retrospectives
    compareRetrospectives: builder.mutation<
      CompareRetrosResponse,
      {
        currentRetro: Record<string, unknown>;
        previousRetros: Array<Record<string, unknown>>;
      }
    >({
      query: (body) => ({
        url: '/retro/compare',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: CompareRetrosResponse }) => response.data,
    }),

    // Generate Facilitation Script
    generateFacilitationScript: builder.mutation<
      FacilitationScriptResponse,
      {
        sprintName: string;
        teamSize: number;
        timeMinutes?: number;
        formatType?: string;
      }
    >({
      query: (body) => ({
        url: '/retro/script',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: FacilitationScriptResponse }) => response.data,
    }),

    // Get Retro Formats
    getRetroFormats: builder.query<RetroFormatsResponse, void>({
      query: () => '/retro/formats',
    }),

    // Get Insight Categories
    getInsightCategories: builder.query<InsightCategoriesResponse, void>({
      query: () => '/retro/categories',
    }),

    // ==================== PHASE 5: TEMPLATE GENERATION ====================

    // Generate Issue Template
    generateIssueTemplateEnhanced: builder.mutation<
      TemplateResponse,
      {
        issueType: string;
        projectContext?: Record<string, unknown>;
        similarIssues?: Array<Record<string, unknown>>;
        requirements?: string[];
      }
    >({
      query: (body) => ({
        url: '/templates/issue',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: TemplateResponse }) => response.data,
    }),

    // Generate Epic Template
    generateEpicTemplate: builder.mutation<
      TemplateResponse,
      { epicType?: string; projectContext?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/templates/epic',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: TemplateResponse }) => response.data,
    }),

    // Generate Checklist Template
    generateChecklistTemplate: builder.mutation<
      ChecklistTemplateResponse,
      { checklistType: string; context?: string }
    >({
      query: (body) => ({
        url: '/templates/checklist',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ChecklistTemplateResponse }) => response.data,
    }),

    // Generate Workflow Template
    generateWorkflowTemplate: builder.mutation<
      WorkflowTemplateResponse,
      {
        workflowType: string;
        issueTypes: string[];
        projectContext?: Record<string, unknown>;
      }
    >({
      query: (body) => ({
        url: '/templates/workflow',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: WorkflowTemplateResponse }) => response.data,
    }),

    // Generate Meeting Template
    generateMeetingTemplate: builder.mutation<
      MeetingTemplateResponse,
      {
        meetingType: string;
        durationMinutes?: number;
        participants?: string[];
      }
    >({
      query: (body) => ({
        url: '/templates/meeting',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: MeetingTemplateResponse }) => response.data,
    }),

    // Customize Template
    customizeTemplate: builder.mutation<
      TemplateResponse,
      { template: TemplateResponse | Record<string, unknown>; customizations: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/templates/customize',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: TemplateResponse }) => response.data,
    }),

    // Suggest Template Fields
    suggestTemplateFields: builder.mutation<
      SuggestFieldsResponse,
      { description: string; existingFields?: string[] }
    >({
      query: (body) => ({
        url: '/templates/suggest-fields',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestFieldsResponse }) => response.data,
    }),

    // Generate Documentation Template
    generateDocumentationTemplate: builder.mutation<
      DocumentationTemplateResponse,
      { docType: string; projectContext?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/templates/documentation',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: DocumentationTemplateResponse }) => response.data,
    }),

    // Get Template Types
    getTemplateTypes: builder.query<TemplateTypesResponse, void>({
      query: () => '/templates/types',
    }),

    // Get Field Types
    getFieldTypes: builder.query<FieldTypesResponse, void>({
      query: () => '/templates/field-types',
    }),

    // ==================== Phase 6: Code Review ====================

    // Analyze PR
    analyzePR: builder.mutation<
      PRAnalysisResponse,
      {
        prId: string;
        title: string;
        description?: string;
        files: Array<{ path: string; changeType?: string; language?: string; diff?: string; content?: string }>;
        baseBranch?: string;
        projectContext?: Record<string, unknown>;
      }
    >({
      query: (body) => ({
        url: '/code-review/analyze-pr',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: PRAnalysisResponse }) => response.data,
    }),

    // Review Code Snippet
    reviewCodeSnippet: builder.mutation<
      ReviewSnippetResponse,
      { code: string; language: string; context?: string; focusAreas?: string[] }
    >({
      query: (body) => ({
        url: '/code-review/review-snippet',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ReviewSnippetResponse }) => response.data,
    }),

    // Suggest Code Improvements
    suggestCodeImprovements: builder.mutation<
      SuggestCodeImprovementsResponse,
      { code: string; language: string; improvementType?: string }
    >({
      query: (body) => ({
        url: '/code-review/suggest-improvements',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestCodeImprovementsResponse }) => response.data,
    }),

    // Generate Review Summary
    generateReviewSummary: builder.mutation<
      ReviewSummaryResponse,
      { prId: string; comments: Array<Record<string, unknown>>; discussions?: Array<Record<string, unknown>> }
    >({
      query: (body) => ({
        url: '/code-review/review-summary',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ReviewSummaryResponse }) => response.data,
    }),

    // Security Check
    checkCodeSecurity: builder.mutation<
      SecurityCheckResponse,
      { code: string; language: string; securityContext?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/code-review/security-check',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SecurityCheckResponse }) => response.data,
    }),

    // Suggest Tests for Code
    suggestTestsForCode: builder.mutation<
      SuggestTestsForCodeResponse,
      { code: string; language: string; existingTests?: string[] }
    >({
      query: (body) => ({
        url: '/code-review/suggest-tests',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestTestsForCodeResponse }) => response.data,
    }),

    // ==================== Phase 6: Automation Generation ====================

    // Generate Automation from Natural Language
    generateAutomation: builder.mutation<
      GenerateAutomationResponse,
      {
        description: string;
        projectContext?: Record<string, unknown>;
        availableFields?: string[];
        availableStatuses?: string[];
      }
    >({
      query: (body) => ({
        url: '/automation/generate',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateAutomationResponse }) => response.data,
    }),

    // Suggest Automations
    suggestAutomations: builder.mutation<
      SuggestAutomationsResponse,
      {
        projectContext: Record<string, unknown>;
        existingRules?: Array<Record<string, unknown>>;
        workflowPatterns?: Array<Record<string, unknown>>;
      }
    >({
      query: (body) => ({
        url: '/automation/suggest',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestAutomationsResponse }) => response.data,
    }),

    // Validate Automation Rule
    validateAutomationRule: builder.mutation<
      ValidateRuleResponse,
      { rule: AutomationRule; projectContext?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/automation/validate',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ValidateRuleResponse }) => response.data,
    }),

    // Explain Automation Rule
    explainAutomationRule: builder.mutation<
      ExplainRuleResponse,
      { rule: AutomationRule }
    >({
      query: (body) => ({
        url: '/automation/explain',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ExplainRuleResponse }) => response.data,
    }),

    // Optimize Automation Rules
    optimizeAutomationRules: builder.mutation<
      OptimizeRulesResponse,
      { rules: AutomationRule[] }
    >({
      query: (body) => ({
        url: '/automation/optimize',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: OptimizeRulesResponse }) => response.data,
    }),

    // Generate Rule from Example
    generateRuleFromExample: builder.mutation<
      GenerateFromExampleResponse,
      { beforeState: Record<string, unknown>; afterState: Record<string, unknown>; actionDescription?: string }
    >({
      query: (body) => ({
        url: '/automation/from-example',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateFromExampleResponse }) => response.data,
    }),

    // ==================== Phase 6: Terminology ====================

    // Define Term
    defineTerm: builder.mutation<
      DefineTermResponse,
      { term: string; context?: string; projectDomain?: string }
    >({
      query: (body) => ({
        url: '/terminology/define',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: DefineTermResponse }) => response.data,
    }),

    // Extract Terms
    extractTerms: builder.mutation<
      ExtractTermsResponse,
      { content: string; existingTerms?: string[]; domain?: string }
    >({
      query: (body) => ({
        url: '/terminology/extract',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ExtractTermsResponse }) => response.data,
    }),

    // Check Terminology Consistency
    checkTerminologyConsistency: builder.mutation<
      CheckConsistencyResponse,
      { content: string; glossary: Array<Record<string, unknown>> }
    >({
      query: (body) => ({
        url: '/terminology/check-consistency',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: CheckConsistencyResponse }) => response.data,
    }),

    // Simplify Definition
    simplifyDefinition: builder.mutation<
      SimplifyDefinitionResponse,
      { term: string; definition: string; targetAudience?: string }
    >({
      query: (body) => ({
        url: '/terminology/simplify',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SimplifyDefinitionResponse }) => response.data,
    }),

    // Find Related Terms
    findRelatedTerms: builder.mutation<
      FindRelatedTermsResponse,
      { term: string; glossary: Array<Record<string, unknown>> }
    >({
      query: (body) => ({
        url: '/terminology/find-related',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: FindRelatedTermsResponse }) => response.data,
    }),

    // Generate Glossary from Documents
    generateGlossary: builder.mutation<
      GenerateGlossaryResponse,
      { documents: Array<{ title?: string; content: string }>; domain?: string }
    >({
      query: (body) => ({
        url: '/terminology/generate-glossary',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateGlossaryResponse }) => response.data,
    }),

    // Translate Jargon
    translateJargon: builder.mutation<
      TranslateJargonResponse,
      { text: string; glossary: Array<Record<string, unknown>>; targetLevel?: string }
    >({
      query: (body) => ({
        url: '/terminology/translate-jargon',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: TranslateJargonResponse }) => response.data,
    }),

    // Suggest Term Improvements
    suggestTermImprovements: builder.mutation<
      SuggestTermImprovementsResponse,
      { glossary: Array<Record<string, unknown>> }
    >({
      query: (body) => ({
        url: '/terminology/suggest-improvements',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestTermImprovementsResponse }) => response.data,
    }),

    // ==================== Phase 6: Onboarding ====================

    // Generate Onboarding Checklist
    generateOnboardingChecklist: builder.mutation<
      GenerateChecklistResponse,
      {
        userRole: string;
        userExperience?: string;
        projectContext?: Record<string, unknown>;
        teamContext?: Record<string, unknown>;
        existingSkills?: string[];
      }
    >({
      query: (body) => ({
        url: '/onboarding/generate-checklist',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateChecklistResponse }) => response.data,
    }),

    // Get Next Onboarding Steps
    getOnboardingNextSteps: builder.mutation<
      GetNextStepsResponse,
      { completedTasks: string[]; userRole: string; recentActivity?: Array<Record<string, unknown>> }
    >({
      query: (body) => ({
        url: '/onboarding/next-steps',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GetNextStepsResponse }) => response.data,
    }),

    // Generate Contextual Tips
    generateContextualTips: builder.mutation<
      GenerateContextualTipsResponse,
      { currentPage: string; userRole: string; userExperience?: string; completedTasks?: string[] }
    >({
      query: (body) => ({
        url: '/onboarding/contextual-tips',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateContextualTipsResponse }) => response.data,
    }),

    // Create Learning Path
    createLearningPath: builder.mutation<
      LearningPathResponse,
      { userRole: string; goal: string; currentSkills?: string[]; timeAvailable?: number }
    >({
      query: (body) => ({
        url: '/onboarding/learning-path',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: LearningPathResponse }) => response.data,
    }),

    // Answer Onboarding Question
    answerOnboardingQuestion: builder.mutation<
      AnswerQuestionResponse,
      { question: string; userRole: string; projectContext?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/onboarding/answer-question',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: AnswerQuestionResponse }) => response.data,
    }),

    // Assess Onboarding Readiness
    assessOnboardingReadiness: builder.mutation<
      AssessReadinessResponse,
      { userRole: string; completedTasks: string[]; timeSpent: number; quizScores?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/onboarding/assess-readiness',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: AssessReadinessResponse }) => response.data,
    }),

    // Generate Welcome Message
    generateWelcomeMessage: builder.mutation<
      WelcomeMessageResponse,
      { userName: string; userRole: string; teamName?: string; projectName?: string }
    >({
      query: (body) => ({
        url: '/onboarding/welcome-message',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: WelcomeMessageResponse }) => response.data,
    }),

    // Suggest Onboarding Buddy
    suggestOnboardingBuddy: builder.mutation<
      SuggestBuddyResponse,
      { newUserRole: string; newUserSkills?: string[]; teamMembers?: Array<Record<string, unknown>> }
    >({
      query: (body) => ({
        url: '/onboarding/suggest-buddy',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestBuddyResponse }) => response.data,
    }),

    // ==================== Phase 6: Reports ====================

    // Generate Created vs Resolved Report
    generateCreatedResolvedReport: builder.mutation<
      GenerateCreatedResolvedReportResponse,
      {
        projectId: string;
        period: string;
        startDate: string;
        endDate: string;
        issueData: Array<Record<string, unknown>>;
        grouping?: string;
      }
    >({
      query: (body) => ({
        url: '/reports/created-resolved',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: GenerateCreatedResolvedReportResponse }) => response.data,
    }),

    // Generate Report Summary
    generateReportSummary: builder.mutation<
      ReportSummaryResponseType,
      { reportData: CreatedResolvedReport; audience?: string }
    >({
      query: (body) => ({
        url: '/reports/summary',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ReportSummaryResponseType }) => response.data,
    }),

    // Compare Report Periods
    compareReportPeriods: builder.mutation<
      ComparePeriodsResponse,
      { currentPeriod: Record<string, unknown>; previousPeriod: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/reports/compare-periods',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ComparePeriodsResponse }) => response.data,
    }),

    // Forecast Backlog
    forecastBacklog: builder.mutation<
      ForecastBacklogResponse,
      { historicalData: ReportDataPoint[]; forecastDays?: number }
    >({
      query: (body) => ({
        url: '/reports/forecast-backlog',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ForecastBacklogResponse }) => response.data,
    }),

    // Identify Bottlenecks
    identifyBottlenecks: builder.mutation<
      IdentifyBottlenecksResponse,
      { workflowData: Array<{ stage: string; avgDays: number }>; resolutionTimes: Array<{ issueId: string; days: number }> }
    >({
      query: (body) => ({
        url: '/reports/identify-bottlenecks',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: IdentifyBottlenecksResponse }) => response.data,
    }),

    // Generate Team Performance Report
    generateTeamPerformanceReport: builder.mutation<
      TeamPerformanceResponse,
      { teamData: Array<{ userId: string; name: string; resolved: number; avgDays: number }>; period: string }
    >({
      query: (body) => ({
        url: '/reports/team-performance',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: TeamPerformanceResponse }) => response.data,
    }),

    // Explain Metrics
    explainMetrics: builder.mutation<
      ExplainMetricsResponse,
      { metrics: Record<string, unknown>; context?: string }
    >({
      query: (body) => ({
        url: '/reports/explain-metrics',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: ExplainMetricsResponse }) => response.data,
    }),

    // Suggest Report Visualizations
    suggestReportVisualizations: builder.mutation<
      SuggestVisualizationsResponse,
      { dataStructure: Record<string, unknown>; reportPurpose: string }
    >({
      query: (body) => ({
        url: '/reports/suggest-visualizations',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: SuggestVisualizationsResponse }) => response.data,
    }),
  }),
});

export const {
  useGetIssueSuggestionsQuery,
  useFindSimilarIssuesQuery,
  useParseNaturalLanguageMutation,
  useParseBulkIssuesMutation,
  useExpandNotesMutation,
  useImproveTextMutation,
  useGenerateAcceptanceCriteriaMutation,
  useSummarizeTextMutation,
  useRecommendSprintScopeQuery,
  useAnalyzeWorkloadQuery,
  useGetAIStatsQuery,
  useCheckAIHealthQuery,
  useEstimateStoryPointsQuery,
  useSuggestAssigneeQuery,
  useGetTeamExpertiseQuery,
  useSuggestIssueOrderQuery,
  usePredictCompletionQuery,
  useGenerateStandupMutation,
  useAnalyzeSprintRisksQuery,
  useSuggestReassignmentsQuery,
  useGetProjectRisksQuery,
  usePredictIssueCompletionQuery,
  useGetAtRiskIssuesQuery,
  useGetVelocityTrendsQuery,
  useGetWorkflowBottlenecksQuery,
  useGetRiskAlertsQuery,
  // Feedback
  useRecordFeedbackMutation,
  useGetAcceptanceRateQuery,
  useGetFeedbackSummaryQuery,
  useGetFeedbackInsightsQuery,
  // Analytics
  useGetAnalyticsUsageQuery,
  useGetCostEstimateQuery,
  useGetDailyTrendsQuery,
  useGetTopUsersQuery,
  useGetEndpointPerformanceQuery,
  // Config
  useGetProjectConfigQuery,
  useUpdateProjectConfigMutation,
  useResetProjectConfigMutation,
  useCheckRateLimitQuery,
  useGetFeatureAvailabilityQuery,
  // Enhanced Content Generation
  useGenerateContentVariantsMutation,
  useEnhanceContentMutation,
  useSuggestTitlesMutation,
  useGenerateIssueTemplateMutation,
  useSmartAutocompleteMutation,
  useGenerateDescriptionMutation,
  useImproveWithFeedbackMutation,
  useGetAvailableTonesQuery,
  useGetAvailableStylesQuery,
  // Natural Language Search
  useParseNLQueryMutation,
  useGetQueryCompletionsMutation,
  useExplainJQLMutation,
  useGetQueryExamplesQuery,
  useValidateJQLMutation,
  useGetSupportedJQLFieldsQuery,
  // Issue Triage
  useTriageIssueMutation,
  useClassifyIssueMutation,
  useSuggestAssigneesForTriageMutation,
  useBatchTriageMutation,
  useGetTriageCategoriesQuery,
  // Summarization
  useSummarizeIssueMutation,
  useSummarizeThreadMutation,
  useSummarizeBulkMutation,
  useGenerateDailyDigestMutation,
  useGetSummaryLengthsQuery,
  useGetSummaryFormatsQuery,
  // Phase 5: Resolution RAG
  useFindSimilarResolvedIssuesMutation,
  useGenerateResolutionSuggestionMutation,
  useCheckForDuplicateMutation,
  useAnalyzeResolutionPatternsQuery,
  useSuggestAssigneeFromHistoryMutation,
  useGetFullResolutionAnalysisMutation,
  useLearnFromResolutionMutation,
  useGetResolutionCategoriesQuery,
  // Phase 5: Risk Visualization
  useBuildRiskGraphMutation,
  useAnalyzeNodeImpactMutation,
  useRunWhatIfAnalysisMutation,
  useGetRiskSummaryQuery,
  useGetRiskLevelsQuery,
  // Phase 5: Release Planning
  useGenerateReleasePlanMutation,
  useAnalyzeReleaseCapacityMutation,
  useSuggestReleaseScopeMutation,
  useGenerateRoadmapMutation,
  useEstimateReleaseDateMutation,
  useGetReleaseTypesQuery,
  // Phase 5: Test Generation
  useGenerateTestCasesMutation,
  useGenerateTestSuiteMutation,
  useGenerateEdgeCasesMutation,
  useGenerateRegressionTestsMutation,
  useAnalyzeTestCoverageMutation,
  useSuggestAutomationCandidatesMutation,
  useGetTestTypesQuery,
  useGetTestPrioritiesQuery,
  // Phase 5: Retrospective
  useAnalyzeRetroItemsMutation,
  useGenerateRetroActionsMutation,
  useAnalyzeSprintPerformanceMutation,
  useGenerateRetroSummaryMutation,
  useSuggestRetroTopicsMutation,
  useCompareRetrospectivesMutation,
  useGenerateFacilitationScriptMutation,
  useGetRetroFormatsQuery,
  useGetInsightCategoriesQuery,
  // Phase 5: Template Generation
  useGenerateIssueTemplateEnhancedMutation,
  useGenerateEpicTemplateMutation,
  useGenerateChecklistTemplateMutation,
  useGenerateWorkflowTemplateMutation,
  useGenerateMeetingTemplateMutation,
  useCustomizeTemplateMutation,
  useSuggestTemplateFieldsMutation,
  useGenerateDocumentationTemplateMutation,
  useGetTemplateTypesQuery,
  useGetFieldTypesQuery,
  // Phase 6: Code Review
  useAnalyzePRMutation,
  useReviewCodeSnippetMutation,
  useSuggestCodeImprovementsMutation,
  useGenerateReviewSummaryMutation,
  useCheckCodeSecurityMutation,
  useSuggestTestsForCodeMutation,
  // Phase 6: Automation Generation
  useGenerateAutomationMutation,
  useSuggestAutomationsMutation,
  useValidateAutomationRuleMutation,
  useExplainAutomationRuleMutation,
  useOptimizeAutomationRulesMutation,
  useGenerateRuleFromExampleMutation,
  // Phase 6: Terminology
  useDefineTermMutation,
  useExtractTermsMutation,
  useCheckTerminologyConsistencyMutation,
  useSimplifyDefinitionMutation,
  useFindRelatedTermsMutation,
  useGenerateGlossaryMutation,
  useTranslateJargonMutation,
  useSuggestTermImprovementsMutation,
  // Phase 6: Onboarding
  useGenerateOnboardingChecklistMutation,
  useGetOnboardingNextStepsMutation,
  useGenerateContextualTipsMutation,
  useCreateLearningPathMutation,
  useAnswerOnboardingQuestionMutation,
  useAssessOnboardingReadinessMutation,
  useGenerateWelcomeMessageMutation,
  useSuggestOnboardingBuddyMutation,
  // Phase 6: Reports
  useGenerateCreatedResolvedReportMutation,
  useGenerateReportSummaryMutation,
  useCompareReportPeriodsMutation,
  useForecastBacklogMutation,
  useIdentifyBottlenecksMutation,
  useGenerateTeamPerformanceReportMutation,
  useExplainMetricsMutation,
  useSuggestReportVisualizationsMutation,
} = aiApi;
