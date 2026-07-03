// Issue Suggestions
export interface SuggestionWithConfidence {
  value: string | number;
  confidence: number;
  reason?: string;
}

export interface LabelSuggestion {
  name: string;
  confidence: number;
}

export interface AssigneeSuggestion {
  userId: string;
  displayName: string;
  confidence: number;
  reason: string;
}

export interface IssueSuggestions {
  issueType?: SuggestionWithConfidence;
  priority?: SuggestionWithConfidence;
  storyPoints?: SuggestionWithConfidence;
  labels: LabelSuggestion[];
  assignee?: AssigneeSuggestion;
}

export interface IssueSuggestionResponse {
  suggestions: IssueSuggestions;
  processingTimeMs: number;
}

// Similar Issues
export interface SimilarIssue {
  issueId: string;
  issueKey: string;
  title: string;
  similarity: number;
  reason: string;
}

export interface SimilarIssuesResponse {
  similarIssues: SimilarIssue[];
  processingTimeMs: number;
}

// Natural Language Parsing
export interface ParsedIssue {
  title: string;
  description: string;
  issueType: string;
  priority?: string;
  assigneeHint?: string;
  dueDateHint?: string;
  labels: string[];
  storyPoints?: number;
}

export interface NaturalLanguageResponse {
  parsedIssue: ParsedIssue;
  originalText: string;
  confidence: number;
  processingTimeMs: number;
}

// Bulk Natural Language Parsing
export interface BulkParsedIssue {
  title: string;
  description: string;
  issueType: string;
  priority?: string;
  assigneeHint?: string;
  dueDateHint?: string;
  labels: string[];
  storyPoints?: number;
  confidence: number;
}

export interface BulkNaturalLanguageResponse {
  parsedIssues: BulkParsedIssue[];
  originalText: string;
  detectedFormat: string;
  issueCount: number;
  processingTimeMs: number;
}

// Note Expansion
export interface ExpandNotesResponse {
  expandedDescription: string;
  suggestedTitle: string;
  inferredType: string;
  keyPoints: string[];
  questions: string[];
  processingTimeMs: number;
}

// Text Improvement Styles
export type ImproveTextStyle = 'clearer' | 'concise' | 'detailed' | 'professional' | 'technical';

// Writing Assistant
export interface ImproveTextResponse {
  originalText: string;
  improvedText: string;
  changesMade: string[];
  processingTimeMs: number;
}

export interface AcceptanceCriteriaResponse {
  criteria: string[];
  processingTimeMs: number;
}

export interface SummarizeResponse {
  summary: string;
  originalLength: number;
  summaryLength: number;
  processingTimeMs: number;
}

// Sprint Planning
export interface SprintIssueRecommendation {
  issueId: string;
  issueKey: string;
  title: string;
  storyPoints: number;
  priority: string;
  reason: string;
}

export interface SprintScopeResponse {
  recommendedPoints: number;
  recommendedIssues: SprintIssueRecommendation[];
  reasoning: string;
  warnings: string[];
  processingTimeMs: number;
}

export interface TeamMemberWorkload {
  userId: string;
  displayName: string;
  assignedPoints: number;
  capacityPoints: number;
  utilizationPercent: number;
  isOverloaded: boolean;
  recommendations: string[];
}

export interface WorkloadAnalysisResponse {
  teamWorkload: TeamMemberWorkload[];
  overallBalanceScore: number;
  recommendations: string[];
  processingTimeMs: number;
}

// AI Usage Stats
export interface AIUsageStats {
  totalRequests: number;
  requestsToday: number;
  avgResponseTimeMs: number;
  cacheHitRate: number;
  tokensUsedToday: number;
}

// Story Point Estimation
export interface StoryPointBreakdown {
  complexity: 'low' | 'medium' | 'high';
  uncertainty: 'low' | 'medium' | 'high';
  effort: 'low' | 'moderate' | 'high';
}

export interface StoryPointEstimate {
  estimate: number;
  confidence: number;
  reasoning: string;
  breakdown: StoryPointBreakdown;
  processingTimeMs: number;
}

// Assignee Suggestion
export interface SuggestedAssignee {
  id: string;
  name: string;
  matchScore: number;
}

export interface AlternativeAssignee {
  id: string;
  name: string;
  matchScore: number;
  reason: string;
}

export interface AssigneeSuggestionResponse {
  suggestedAssignee: SuggestedAssignee | null;
  confidence: number;
  reason: string;
  alternatives: AlternativeAssignee[];
  processingTimeMs: number;
}

// Team Expertise
export interface TeamMemberExpertise {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  totalIssues: number;
  completedIssues: number;
  completedPoints: number;
  issueTypes: string[];
  labels: string[];
  currentWorkload: number;
}

export interface TeamExpertiseResponse {
  teamExpertise: TeamMemberExpertise[];
}

// Issue Ordering
export interface IssueOrderItem {
  issueId: string;
  issueKey: string;
  position: number;
  reason: string;
}

export interface IssueOrderResponse {
  suggestedOrder: IssueOrderItem[];
  reasoning: string;
  processingTimeMs: number;
}

// Completion Prediction
export interface CompletionPredictionResponse {
  completionProbability: number;
  predictedStatus: 'on_track' | 'at_risk' | 'likely_incomplete';
  predictedEndDate?: string;
  riskFactors: string[];
  recommendations: string[];
  analysis: string;
  processingTimeMs: number;
}

// Standup Generation
export interface StandupResponse {
  summary: string;
  completedYesterday: string[];
  inProgress: string[];
  plannedToday: string[];
  blockers: string[];
  highlights: string[];
  processingTimeMs: number;
}

// Sprint Risk Analysis
export interface SprintRisk {
  type: 'scope' | 'resource' | 'dependency' | 'technical';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export interface SprintRiskResponse {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  risks: SprintRisk[];
  bottlenecks: string[];
  recommendations: string[];
  processingTimeMs: number;
}

// Reassignment Suggestions
export interface ReassignmentSuggestion {
  issueId: string;
  issueKey: string;
  fromMember: string;
  toMember: string;
  reason: string;
}

export interface ReassignmentResponse {
  suggestions: ReassignmentSuggestion[];
  reasoning: string;
  processingTimeMs: number;
}

// Project Risk Analysis
export interface ProjectRisk {
  type: 'timeline' | 'resource' | 'technical' | 'scope';
  description: string;
  probability: number;
  impact: 'low' | 'medium' | 'high';
  affectedAreas: string[];
  recommendation: string;
}

export interface Bottleneck {
  type: 'person' | 'status' | 'dependency';
  description: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface ProjectRiskResponse {
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  risks: ProjectRisk[];
  bottlenecks: Bottleneck[];
  summary: string;
  processingTimeMs: number;
}

// Issue Completion Prediction
export interface CompletionRange {
  optimistic: number;
  pessimistic: number;
}

export interface IssueCompletionResponse {
  predictedDays: number;
  confidence: number;
  predictedDate: string;
  factors: string[];
  range: CompletionRange;
  reasoning: string;
  processingTimeMs: number;
}

// At-Risk Issues
export interface IssueRiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  reasons: string[];
  recommendation: string;
}

export interface AtRiskIssue {
  id: string;
  issueKey: string;
  title: string;
  dueDate?: string;
  assigneeName?: string;
  status: string;
  riskAssessment: IssueRiskAssessment;
}

export interface AtRiskIssuesResponse {
  atRiskIssues: AtRiskIssue[];
  totalCount: number;
  processingTimeMs: number;
}

// Velocity Trends
export interface VelocityTrendResponse {
  averageVelocity: number;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile' | 'insufficient_data';
  trendPercentage?: number;
  forecastNextSprint?: number;
  reliabilityScore: number;
  analysis: string;
  recommendations: string[];
  processingTimeMs: number;
}

// Workflow Bottlenecks
export interface WorkflowAnalysis {
  congestedStatuses: string[];
  flowEfficiency: number;
  estimatedCycleTime: number;
}

export interface WorkflowBottleneckResponse {
  bottleneckStatus?: string;
  bottleneckSeverity: 'low' | 'medium' | 'high' | 'critical';
  analysis: WorkflowAnalysis;
  recommendations: string[];
  summary: string;
  processingTimeMs: number;
}

// Risk Alerts
export interface RiskAlert {
  type: string;
  severity: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
}

export interface RiskAlertSummary {
  overallRiskLevel: string;
  riskScore: number;
  atRiskIssueCount: number;
  alertCount: number;
  bottleneckCount: number;
}

export interface RiskAlertsResponse {
  alerts: RiskAlert[];
  summary: RiskAlertSummary;
  processingTimeMs: number;
}

// AI Feedback
export interface FeedbackResponse {
  id: string;
  suggestionType: string;
  accepted: boolean;
  createdAt: string;
  processingTimeMs: number;
}

export interface AcceptanceRateResponse {
  suggestionType: string;
  total: number;
  acceptedCount: number;
  acceptanceRate: number;
  avgRating?: number;
  period: string;
  processingTimeMs: number;
}

export interface FeedbackTypeStat {
  type: string;
  total: number;
  acceptedCount: number;
  acceptanceRate: number;
  avgRating?: number;
}

export interface FeedbackSummaryResponse {
  period: string;
  total: number;
  totalAccepted: number;
  overallAcceptanceRate: number;
  overallAvgRating?: number;
  byType: FeedbackTypeStat[];
  processingTimeMs: number;
}

export interface FeedbackInsight {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface FeedbackInsightsResponse {
  overallHealth: 'good' | 'needs_improvement';
  insights: FeedbackInsight[];
  recommendations: string[];
  summary: FeedbackSummaryResponse;
  processingTimeMs: number;
}

// AI Analytics
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface EndpointStats {
  count: number;
  inputTokens: number;
  outputTokens: number;
  avgResponseTimeMs: number;
  errorCount: number;
}

export interface UsageStatsResponse {
  period: { start: string; end: string };
  totalRequests: number;
  byEndpoint: Record<string, EndpointStats>;
  tokenUsage: TokenUsage;
  avgResponseTimeMs: number;
  errorRate: number;
  cacheHitRate: number;
  processingTimeMs: number;
}

export interface CostEstimateResponse {
  period: { start: string; end: string };
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  cacheSavings: number;
  effectiveCost: number;
  processingTimeMs: number;
}

export interface DailyTrend {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
  cacheHits: number;
}

export interface DailyTrendsResponse {
  trends: DailyTrend[];
  processingTimeMs: number;
}

export interface TopUser {
  userId: string;
  requests: number;
  tokens: number;
}

export interface TopUsersResponse {
  users: TopUser[];
  processingTimeMs: number;
}

export interface EndpointPerformance {
  endpoint: string;
  totalRequests: number;
  avgResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  errorRate: number;
  totalTokens: number;
}

export interface EndpointPerformanceResponse {
  endpoints: EndpointPerformance[];
  processingTimeMs: number;
}

// AI Configuration
export interface AIFeatures {
  suggestions: boolean;
  nlpParsing: boolean;
  writingAssist: boolean;
  planning: boolean;
  predictions: boolean;
  similarIssues: boolean;
  standupGeneration: boolean;
}

export interface AILimits {
  requestsPerUserPerDay: number;
  requestsPerProjectPerDay: number;
  maxInputTokens: number;
  maxOutputTokens: number;
}

export interface ProjectConfigResponse {
  projectId: string;
  enabled: boolean;
  features: AIFeatures;
  limits: AILimits;
  processingTimeMs: number;
}

export interface RateLimitStatus {
  used: number;
  limit: number;
  remaining: number;
}

export interface RateLimitCheckResponse {
  allowed: boolean;
  user: RateLimitStatus;
  project: RateLimitStatus;
  resetTime: string;
  processingTimeMs: number;
}

export interface FeatureStatus {
  enabled: boolean;
  reason?: string;
}

export interface FeatureAvailabilityResponse {
  projectId: string;
  aiEnabled: boolean;
  features: Record<string, FeatureStatus>;
  processingTimeMs: number;
}

// ==================== Enhanced Content Generation ====================

// Available tones for content generation
export type ContentTone =
  | 'professional'
  | 'friendly'
  | 'technical'
  | 'concise'
  | 'detailed'
  | 'assertive'
  | 'empathetic'
  | 'formal'
  | 'casual';

// Available styles for content enhancement
export type ContentStyleEnhanced =
  | 'clearer'
  | 'concise'
  | 'detailed'
  | 'professional'
  | 'technical'
  | 'actionable'
  | 'persuasive';

// Content variant with metadata
export interface ContentVariant {
  text: string;
  tone: string;
  wordCount: number;
  keyChanges: string[];
}

// Generate variants response
export interface GenerateVariantsResponse {
  originalText: string;
  variants: ContentVariant[];
  processingTimeMs: number;
}

// Enhanced content response
export interface EnhanceContentResponse {
  originalText: string;
  enhancedText: string;
  toneApplied: string;
  styleApplied: string;
  improvements: string[];
  suggestions: string[];
  readabilityScore: 'high' | 'medium' | 'low';
  wordCount: {
    original: number;
    enhanced: number;
  };
  processingTimeMs: number;
}

// Title suggestion
export interface TitleSuggestion {
  title: string;
  confidence: number;
  reasoning: string;
}

// Suggest titles response
export interface SuggestTitlesResponse {
  suggestions: TitleSuggestion[];
  processingTimeMs: number;
}

// Template field
export interface TemplateField {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
  helpText?: string;
}

// Generate template response
export interface GenerateTemplateResponse {
  issueType: string;
  titleTemplate: string;
  descriptionTemplate: string;
  fields: TemplateField[];
  acceptanceCriteriaTemplate: string[];
  processingTimeMs: number;
}

// Smart autocomplete response
export interface SmartAutocompleteResponse {
  suggestions: string[];
  processingTimeMs: number;
}

// Generate description response
export interface GenerateDescriptionResponse {
  description: string;
  suggestedAcceptanceCriteria: string[];
  suggestedLabels: string[];
  questions: string[];
  relatedTopics: string[];
  processingTimeMs: number;
}

// Improve with feedback response
export interface ImproveWithFeedbackResponse {
  improvedText: string;
  changesMade: string[];
  feedbackAddressed: string[];
  additionalSuggestions: string[];
  processingTimeMs: number;
}

// Tone/style options response
export interface ToneOption {
  value: string;
  description: string;
}

export interface StyleOption {
  value: string;
  description: string;
}

export interface AvailableTonesResponse {
  tones: ToneOption[];
}

export interface AvailableStylesResponse {
  styles: StyleOption[];
}

// ==================== Natural Language Search ====================

// Query clause in parsed query
export interface QueryClause {
  field: string;
  operator: string;
  value: string | string[] | null;
  isFunction: boolean;
}

// Parsed query response
export interface ParseQueryResponse {
  originalQuery: string;
  jql: string;
  clauses: QueryClause[];
  orderBy: string | null;
  orderDirection: string;
  textSearch: string | null;
  confidence: number;
  interpretation: string;
  suggestions: string[];
  processingTimeMs: number;
}

// Query completion response
export interface QueryCompletionResponse {
  partialQuery: string;
  completions: string[];
  processingTimeMs: number;
}

// Explain JQL response
export interface ExplainJQLResponse {
  jql: string;
  explanation: string;
  processingTimeMs: number;
}

// Query example
export interface QueryExample {
  naturalLanguage: string;
  jql: string;
}

// Query examples response
export interface QueryExamplesResponse {
  category: string | null;
  examples: QueryExample[];
}

// Validate JQL response
export interface ValidateJQLResponse {
  jql: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// JQL field info
export interface JQLFieldInfo {
  name: string;
  description: string;
}

// JQL operator info
export interface JQLOperatorInfo {
  symbol: string;
  name: string;
  description: string;
}

// JQL function info
export interface JQLFunctionInfo {
  name: string;
  description: string;
}

// Relative date info
export interface RelativeDateInfo {
  syntax: string;
  description: string;
}

// Supported JQL fields response
export interface SupportedJQLFieldsResponse {
  fields: JQLFieldInfo[];
  operators: JQLOperatorInfo[];
  functions: JQLFunctionInfo[];
  relativeDates: RelativeDateInfo[];
}

// ==================== Issue Triage & Auto-Assignment ====================

// Issue category
export type IssueCategory =
  | 'bug'
  | 'feature'
  | 'enhancement'
  | 'documentation'
  | 'refactoring'
  | 'security'
  | 'performance'
  | 'infrastructure'
  | 'testing'
  | 'support';

// Urgency level
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

// Complexity level
export type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';

// Triage classification
export interface TriageClassification {
  category: string;
  subCategory: string | null;
  urgency: string;
  complexity: string;
  estimatedEffort: string;
  requiredSkills: string[];
  affectedComponents: string[];
  confidence: number;
  reasoning: string;
}

// Assignee candidate
export interface AssigneeCandidate {
  userId: string;
  displayName: string;
  matchScore: number;
  expertiseMatch: string[];
  currentWorkload: string;
  availability: string;
  reasoning: string;
}

// Full triage result
export interface TriageResultResponse {
  classification: TriageClassification;
  suggestedAssignees: AssigneeCandidate[];
  suggestedLabels: string[];
  suggestedPriority: string;
  routingSuggestion: string | null;
  autoAssignmentConfidence: number;
  warnings: string[];
  processingTimeMs: number;
}

// Classification-only result
export interface ClassifyResultResponse {
  classification: TriageClassification;
  suggestedLabels: string[];
  suggestedPriority: string;
  processingTimeMs: number;
}

// Suggest assignees result
export interface SuggestAssigneesResponse {
  suggestedAssignees: AssigneeCandidate[];
  autoAssignmentConfidence: number;
  processingTimeMs: number;
}

// Batch triage item
export interface BatchTriageResultItem {
  issueIndex: number;
  classification: TriageClassification;
  suggestedAssignees: AssigneeCandidate[];
  suggestedLabels: string[];
  suggestedPriority: string;
  autoAssignmentConfidence: number;
}

// Batch triage result
export interface BatchTriageResponse {
  results: BatchTriageResultItem[];
  totalProcessed: number;
  processingTimeMs: number;
}

// Category info
export interface CategoryInfo {
  value: string;
  label: string;
  description: string;
}

// Triage categories response
export interface TriageCategoriesResponse {
  categories: CategoryInfo[];
  urgencyLevels: CategoryInfo[];
  complexityLevels: CategoryInfo[];
}

// ==================== AI Summarization ====================

// Summary length
export type SummaryLength = 'brief' | 'standard' | 'detailed';

// Summary format
export type SummaryFormat = 'prose' | 'bullets' | 'executive';

// Issue summary response
export interface IssueSummaryResponse {
  summary: string;
  keyPoints: string[];
  currentStatus: string;
  blockers: string[];
  nextSteps: string[];
  timeInStatus: string | null;
  confidence: number;
  processingTimeMs: number;
}

// Thread summary response
export interface ThreadSummaryResponse {
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
  unresolvedQuestions: string[];
  participants: string[];
  sentiment: string;
  confidence: number;
  processingTimeMs: number;
}

// Bulk summary response
export interface BulkSummaryResponse {
  overallSummary: string;
  byStatus: Record<string, string>;
  byPriority: Record<string, string>;
  keyThemes: string[];
  blockers: string[];
  highlights: string[];
  statistics: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  };
  confidence: number;
  processingTimeMs: number;
}

// Daily digest response
export interface DailyDigestResponse {
  headline: string;
  summary: string;
  completedHighlights: string[];
  newItems: string[];
  activeWork: string[];
  needsAttention: string[];
  metrics: {
    updatedCount: number;
    createdCount: number;
    completedCount: number;
  };
  processingTimeMs: number;
}

// Summary options
export interface SummaryLengthOption {
  value: string;
  label: string;
  description: string;
}

export interface SummaryLengthsResponse {
  lengths: SummaryLengthOption[];
}

export interface SummaryFormatsResponse {
  formats: SummaryLengthOption[];
}

// ==================== Phase 5: RAG-Powered Issue Resolution ====================

// Resolution confidence level
export type ResolutionConfidence = 'high' | 'medium' | 'low';

// Resolution category
export type ResolutionCategory =
  | 'code_fix'
  | 'configuration'
  | 'documentation'
  | 'workaround'
  | 'duplicate'
  | 'wont_fix'
  | 'cannot_reproduce'
  | 'external_dependency';

// Similar resolved issue
export interface SimilarResolvedIssue {
  issueId: string;
  issueKey: string;
  title: string;
  description: string;
  resolution: string;
  resolutionCategory: string;
  similarityScore: number;
  resolvedBy: string | null;
  resolutionTimeHours: number | null;
  tags: string[];
}

// Resolution step
export interface ResolutionStep {
  order: number;
  action: string;
  details: string;
  estimatedTimeMinutes: number | null;
  requiresReview: boolean;
}

// Resolution suggestion
export interface ResolutionSuggestion {
  summary: string;
  category: string;
  steps: ResolutionStep[];
  basedOnIssues: string[];
  confidence: string;
  confidenceScore: number;
  estimatedTimeHours: number | null;
  potentialRisks: string[];
  alternativeApproaches: string[];
}

// Find similar issues response
export interface FindSimilarResolvedResponse {
  similarIssues: SimilarResolvedIssue[];
  count: number;
  processingTimeMs: number;
}

// Generate suggestion response
export interface GenerateSuggestionResponse {
  suggestion: ResolutionSuggestion | null;
  hasSuggestion: boolean;
  processingTimeMs: number;
}

// Check duplicate response
export interface CheckDuplicateResponse {
  isDuplicate: boolean;
  duplicateOf: string | null;
  similarityScore: number;
  processingTimeMs: number;
}

// Analyze patterns response
export interface AnalyzePatternsResponse {
  patterns: string[];
  count: number;
  processingTimeMs: number;
}

// Suggest assignee from history response
export interface SuggestAssigneeFromHistoryResponse {
  recommendedAssignee: string | null;
  hasRecommendation: boolean;
  processingTimeMs: number;
}

// Full resolution analysis response
export interface FullResolutionAnalysisResponse {
  similarIssues: SimilarResolvedIssue[];
  suggestedResolution: ResolutionSuggestion | null;
  isPotentialDuplicate: boolean;
  duplicateOf: string | null;
  commonPatterns: string[];
  recommendedAssignee: string | null;
  processingTimeMs: number;
}

// Resolution categories response
export interface ResolutionCategoriesResponse {
  categories: CategoryInfo[];
}

// ==================== Phase 5: AI Risk Visualization ====================

// Risk level
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

// Risk type
export type RiskType =
  | 'schedule'
  | 'dependency'
  | 'resource'
  | 'technical'
  | 'scope'
  | 'external';

// Risk node
export interface RiskNode {
  id: string;
  label: string;
  title: string;
  type: string;
  riskLevel: string;
  riskScore: number;
  status: string | null;
  assignee: string | null;
  dueDate: string | null;
  isOnCriticalPath?: boolean;
  blockedBy?: string[];
  metadata: Record<string, unknown>;
}

// Risk edge
export interface RiskEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  type?: string;
  weight: number;
  isCriticalPath: boolean;
}

// Risk cluster
export interface RiskCluster {
  id: string;
  name: string;
  description: string;
  riskLevel: string;
  nodeIds: string[];
  totalRiskScore: number;
  primaryRiskType: string;
}

// Risk graph response
export interface RiskGraphResponse {
  nodes: RiskNode[];
  edges: RiskEdge[];
  clusters: RiskCluster[];
  criticalPath: string[];
  overallRiskScore: number;
  riskDistribution: Record<string, number>;
  processingTimeMs: number;
}

// Impact analysis response
export interface ImpactAnalysisResponse {
  nodeId: string;
  directImpacts: string[];
  indirectImpacts: string[];
  totalImpactScore: number;
  impactScore: number;
  affectedNodes: string[];
  affectedMilestones: string[];
  delayEstimateDays: number | null;
  cascadeEffects: string[];
  recommendations: string[];
  mitigationSuggestions: string[];
  processingTimeMs: number;
}

// What-if analysis response
export interface WhatIfAnalysisResponse {
  scenario: string;
  originalRiskScore: number;
  newRiskScore: number;
  riskChange: number;
  originalRisk: string;
  projectedRisk: string;
  riskDelta: number;
  affectedNodes: string[];
  recommendations: string[];
  processingTimeMs: number;
}

// Risk summary response
export interface RiskSummaryResponse {
  overallRiskScore: number;
  riskDistribution: Record<string, number>;
  criticalPathLength: number;
  clusterCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  topRisks: string[];
  aiSummary: string | null;
  keyConcerns: string[];
  immediateActions: string[];
  riskTrend: string;
  confidence: number;
  processingTimeMs: number;
}

// Risk levels response
export interface RiskLevelsResponse {
  levels: Array<{
    value: string;
    label: string;
    color: string;
    threshold: number;
  }>;
}

// ==================== Phase 5: AI-Powered Release Planning ====================

// Release type
export type ReleaseType = 'major' | 'minor' | 'patch' | 'hotfix';

// Release item
export interface ReleaseItem {
  id?: string;
  issueId: string;
  issueKey: string;
  title: string;
  priority: string;
  points?: number;
  storyPoints: number | null;
  status: string;
  recommendedOrder: number;
}

// Release phase
export interface ReleasePhase {
  id?: string;
  name: string;
  description: string;
  priority?: string;
  duration?: string;
  startDate: string | null;
  endDate: string | null;
  items: ReleaseItem[];
  totalPoints: number;
  completionPercentage: number;
}

// Release plan response
export interface ReleasePlanResponse {
  name?: string;
  releaseName: string;
  releaseType: string;
  targetDate: string;
  phases: ReleasePhase[];
  totalItems: number;
  totalPoints: number;
  overallRisk?: string;
  riskAssessment: string;
  confidence?: number;
  successProbability: number;
  keyMilestones: Array<{ name: string; targetDate: string; description: string }>;
  recommendations: string[];
  risks?: string[];
  potentialBlockers: string[];
  processingTimeMs: number;
}

// Capacity analysis team member
export interface CapacityTeamMember {
  name: string;
  capacityPoints: number;
  skills: string[];
  availability: number;
  utilization?: number;
}

// Capacity analysis response
export interface CapacityAnalysisResponse {
  totalCapacity?: number;
  totalCapacityPoints: number;
  allocatedCapacity?: number;
  allocatedPoints: number;
  availableCapacity?: number;
  availablePoints: number;
  utilizationRate?: number;
  utilizationPercentage: number;
  teamBreakdown: CapacityTeamMember[] | Record<string, CapacityTeamMember>;
  recommendations: string[];
  processingTimeMs: number;
}

// Scope suggestion response
export interface ScopeSuggestionResponse {
  includedItems: ReleaseItem[];
  recommendedItems: ReleaseItem[];
  optionalItems?: ReleaseItem[];
  totalPoints: number;
  themes: string[];
  excludedItems: string[];
  exclusionReasons: Record<string, string>;
  confidence: number;
  reasoning?: string;
  notes: string;
  availableCapacity: number;
  utilization: number;
  processingTimeMs: number;
}

// Roadmap quarter release
export interface RoadmapRelease {
  name: string;
  type: string;
  targetDate?: string;
  highlights?: string[];
  keyThemes?: string[];
  riskLevel?: string;
  dependencies?: string[];
}

// Roadmap quarter
export interface RoadmapQuarter {
  name: string;
  releases: RoadmapRelease[];
  themes?: string[];
}

// Roadmap response
export interface RoadmapResponse {
  name?: string;
  releases: RoadmapRelease[];
  quarters?: RoadmapQuarter[];
  milestones?: string[];
  timelineMonths: number;
  totalItems: number;
  criticalDependencies: Array<{ from: string; to: string; reason: string }>;
  riskSummary: string;
  processingTimeMs: number;
}

// Date estimate response
export interface DateEstimateResponse {
  estimatedDate: string | null;
  totalPoints: number;
  sprintsNeeded: number;
  sprintsWithBuffer: number;
  teamVelocity: number;
  confidence: number;
  assumptions: string[];
  processingTimeMs: number;
}

// Release types response
export interface ReleaseTypesResponse {
  types: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

// ==================== Phase 5: AI Test Case Generation ====================

// Test type
export type TestType =
  | 'unit'
  | 'integration'
  | 'e2e'
  | 'acceptance'
  | 'regression'
  | 'performance'
  | 'security';

// Test priority
export type TestPriority = 'critical' | 'high' | 'medium' | 'low';

// Test step
export interface TestStep {
  id?: string;
  order: number;
  action: string;
  expectedResult: string;
  testData: string | null;
}

// Test case
export interface TestCase {
  id: string;
  title: string;
  description: string;
  testType: string;
  priority: string;
  preconditions: string[];
  steps: TestStep[];
  expectedOutcome: string;
  tags: string[];
  coveredAreas?: string[];
  estimatedDurationMinutes: number;
  automationFeasibility: string;
}

// Generate tests response
export interface GenerateTestsResponse {
  testCases: TestCase[];
  count: number;
  processingTimeMs: number;
}

// Test suite response
export interface TestSuiteResponse {
  name: string;
  description: string;
  testCases: TestCase[];
  totalCases: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  estimatedDurationMinutes: number;
  coverageAreas: string[];
  processingTimeMs: number;
}

// Test coverage response
export interface TestCoverageResponse {
  totalRequirements: number;
  coveredRequirements: number;
  coveragePercentage: number;
  overallCoverage: number;
  coveredAreas: number;
  gaps: string[];
  uncoveredAreas: string[];
  recommendations: string[];
  byType: Record<string, number>;
  processingTimeMs: number;
}

// Automation candidates response
export interface AutomationCandidatesResponse {
  automationCandidates: Array<{
    testId: string;
    title: string;
    automationScore: number;
    reasons: string[];
    estimatedEffort: string;
  }>;
  highPriority: Array<{ testId: string; title: string; reason: string }>;
  mediumPriority?: Array<{ testId: string; title: string; reason: string }>;
  reasoning?: string;
  manualOnly: Array<{
    testId: string;
    title: string;
    reason: string;
  }>;
  totalAutomatable: number;
  automationPercentage: number;
  recommendation: string;
  processingTimeMs: number;
}

// Test types/priorities response
export interface TestTypesResponse {
  types: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

export interface TestPrioritiesResponse {
  priorities: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

// ==================== Phase 5: AI Retrospective Assistant ====================

// Sentiment type
export type SentimentType = 'positive' | 'negative' | 'neutral' | 'mixed';

// Insight category
export type InsightCategory =
  | 'process'
  | 'communication'
  | 'technical'
  | 'team'
  | 'tooling'
  | 'planning'
  | 'delivery';

// Retro insight
export interface RetroInsight {
  title: string;
  description: string;
  category: string;
  importance: string;
  evidence: string[];
  suggestedActions: string[];
}

// Action item
export interface RetroActionItem {
  title: string;
  description: string;
  owner: string | null;
  priority: string;
  category: string;
  successCriteria: string;
  estimatedEffort: string;
}

// Sprint analysis
export interface SprintAnalysis {
  velocityTrend: string;
  completionRate: number;
  scopeChangePercentage: number;
  keyAchievements: string[];
  challenges: string[];
  teamSentiment: string;
  focusAreas: string[];
}

// Analyze items response
export interface AnalyzeRetroItemsResponse {
  insights: RetroInsight[];
  count: number;
  processingTimeMs: number;
}

// Generate actions response
export interface GenerateRetroActionsResponse {
  actionItems: RetroActionItem[];
  count: number;
  processingTimeMs: number;
}

// Retro summary response
export interface RetroSummaryResponse {
  sprintName: string;
  insights: RetroInsight[];
  actionItems: RetroActionItem[];
  sprintAnalysis: SprintAnalysis;
  themes: string[];
  sentimentBreakdown: Record<string, number>;
  participationRate: number;
  recommendations: string[];
  processingTimeMs: number;
}

// Suggest topics response
export interface SuggestTopicsResponse {
  topics: Array<{
    title: string;
    description: string;
    timeMinutes: number;
    relatedItems: string[];
    facilitationTips: string[];
  }>;
  timeAllocation: Record<string, number>;
  totalTime: number;
  processingTimeMs: number;
}

// Compare retros response
export interface CompareRetrosResponse {
  trends: string[];
  improvements: string[];
  regressions: string[];
  recurringThemes: string[];
  actionEffectiveness: string;
  processingTimeMs: number;
}

// Facilitation script response
export interface FacilitationScriptResponse {
  sprintName: string;
  format: string;
  totalTime: number;
  sections: Record<string, {
    durationMinutes: number;
    script: string;
    activities?: string[];
    prompts?: string[];
    techniques?: string[];
    guidelines?: string[];
  }>;
  processingTimeMs: number;
}

// Retro formats response
export interface RetroFormatsResponse {
  formats: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

// Insight categories response
export interface InsightCategoriesResponse {
  categories: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

// ==================== Phase 5: AI Template Generation Enhanced ====================

// Template type
export type TemplateType =
  | 'issue'
  | 'epic'
  | 'project'
  | 'workflow'
  | 'checklist'
  | 'meeting'
  | 'documentation';

// Field type
export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'number'
  | 'user'
  | 'checkbox'
  | 'url';

// Template field (enhanced)
export interface TemplateFieldEnhanced {
  name: string;
  label: string;
  fieldType: string;
  required: boolean;
  defaultValue: string | null;
  placeholder: string | null;
  options: Array<{ value: string; label: string }> | null;
  helpText: string | null;
  order: number;
}

// Template section
export interface TemplateSection {
  name: string;
  title: string;
  description: string | null;
  fields: TemplateFieldEnhanced[];
  collapsible: boolean;
  order: number;
}

// Template response
export interface TemplateResponse {
  id: string;
  name: string;
  description: string;
  templateType: string;
  sections: TemplateSection[];
  tags: string[];
  processingTimeMs: number;
}

// Workflow template response
export interface WorkflowTemplateResponse {
  id: string;
  name: string;
  description: string;
  statuses: Array<{
    id: string;
    name: string;
    category: string;
    color?: string;
    description?: string;
  }>;
  transitions: Array<{
    id: string;
    name: string;
    fromStatus: string;
    toStatus: string;
    conditions?: string[];
    validators?: string[];
    postFunctions?: string[];
  }>;
  automationRules: Array<{
    name: string;
    description?: string;
    trigger: string;
    condition: string;
    action: string;
  }>;
  processingTimeMs: number;
}

// Checklist template response
export interface ChecklistTemplateResponse {
  name: string;
  description: string;
  categories: Array<{
    name: string;
    items: Array<{
      text: string;
      required: boolean;
      help: string | null;
    }>;
  }>;
  estimatedTimeMinutes: number;
  processingTimeMs: number;
}

// Meeting template response
export interface MeetingTemplateResponse {
  name: string;
  description: string;
  durationMinutes: number;
  agenda: Array<{
    title: string;
    durationMinutes: number;
    description: string;
    owner: string;
    notesTemplate: string;
  }>;
  preparation: string[];
  followUpTemplate: string;
  processingTimeMs: number;
}

// Suggest fields response
export interface SuggestFieldsResponse {
  suggestedFields: Array<{
    name: string;
    label: string;
    type: string;
    description: string;
    reason: string;
    required: boolean;
  }>;
  processingTimeMs: number;
}

// Documentation template response
export interface DocumentationTemplateResponse {
  name: string;
  description: string;
  sections: Array<{
    title: string;
    description: string;
    templateContent: string;
    required: boolean;
  }>;
  metadataFields: Array<{
    name: string;
    label: string;
    required: boolean;
  }>;
  processingTimeMs: number;
}

// Template types response
export interface TemplateTypesResponse {
  types: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

// Field types response
export interface FieldTypesResponse {
  fieldTypes: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

// ==================== Phase 6: AI Code Review Integration ====================

// Review severity
export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Review category
export type ReviewCategory =
  | 'bug'
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'style'
  | 'documentation'
  | 'testing'
  | 'best_practice';

// Code comment
export interface CodeComment {
  id: string;
  filePath: string;
  lineStart: number;
  lineEnd: number | null;
  severity: ReviewSeverity;
  category: ReviewCategory;
  message: string;
  suggestion: string | null;
  codeSnippet: string | null;
  explanation: string | null;
}

// File summary
export interface FileSummary {
  filePath: string;
  changeType: string;
  linesAdded: number;
  linesRemoved: number;
  summary: string;
  riskLevel: string;
  keyChanges: string[];
}

// PR analysis response
export interface PRAnalysisResponse {
  prId: string;
  title: string;
  overallAssessment: string;
  riskLevel: string;
  comments: CodeComment[];
  fileSummaries: FileSummary[];
  suggestedReviewers: Array<{ area: string; reason: string }>;
  testCoverageAssessment: string;
  documentationAssessment: string;
  breakingChanges: string[];
  recommendations: string[];
  approvalRecommendation: string;
  confidence: number;
  processingTimeMs: number;
}

// Review snippet response
export interface ReviewSnippetResponse {
  comments: CodeComment[];
  processingTimeMs: number;
}

// Code suggestion
export interface CodeSuggestion {
  originalCode: string;
  suggestedCode: string;
  explanation: string;
  category: ReviewCategory;
  impact: string;
  filePath: string | null;
  lineNumber: number | null;
}

// Suggest improvements response
export interface SuggestCodeImprovementsResponse {
  suggestions: CodeSuggestion[];
  processingTimeMs: number;
}

// Review summary response
export interface ReviewSummaryResponse {
  executiveSummary: string;
  keyIssues: string[];
  resolvedCount: number;
  pendingCount: number;
  blockers: string[];
  positiveAspects: string[];
  nextSteps: string[];
  estimatedEffortToResolve: string;
  processingTimeMs: number;
}

// Security check response
export interface SecurityCheckResponse {
  findings: CodeComment[];
  securityScore: number;
  summary: string;
  processingTimeMs: number;
}

// Suggest tests response
export interface SuggestTestsForCodeResponse {
  unitTests: Array<{
    name: string;
    description: string;
    testCode: string;
    priority: string;
  }>;
  edgeCases: string[];
  integrationTests: Array<{
    name: string;
    description: string;
  }>;
  coverageGaps: string[];
  processingTimeMs: number;
}

// ==================== Phase 6: AI Workflow Automation Generation ====================

// Trigger type
export type AutomationTriggerType =
  | 'issue_created'
  | 'issue_updated'
  | 'issue_transitioned'
  | 'issue_assigned'
  | 'comment_added'
  | 'sprint_started'
  | 'sprint_completed'
  | 'scheduled'
  | 'manual'
  | 'webhook';

// Action type
export type AutomationActionType =
  | 'assign_issue'
  | 'transition_issue'
  | 'add_label'
  | 'remove_label'
  | 'set_priority'
  | 'set_due_date'
  | 'add_comment'
  | 'send_notification'
  | 'send_email'
  | 'call_webhook'
  | 'create_issue'
  | 'link_issues'
  | 'update_field';

// Condition operator
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty';

// Automation condition
export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
  logicalOperator: string;
}

// Automation action
export interface AutomationAction {
  type: AutomationActionType;
  config: Record<string, unknown>;
  delayMinutes: number | null;
}

// Automation rule
export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTriggerType;
  triggerConfig: Record<string, unknown>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  priority: number;
}

// Generate automation response
export interface GenerateAutomationResponse {
  rule: AutomationRule;
  processingTimeMs: number;
}

// Automation suggestion
export interface AutomationSuggestion {
  name: string;
  description: string;
  rule: AutomationRule;
  confidence: number;
  benefit: string;
  estimatedTimeSaved: string;
}

// Suggest automations response
export interface SuggestAutomationsResponse {
  suggestions: AutomationSuggestion[];
  processingTimeMs: number;
}

// Validate rule response
export interface ValidateRuleResponse {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  riskAssessment: string;
  potentialIssues: string[];
  processingTimeMs: number;
}

// Explain rule response
export interface ExplainRuleResponse {
  summary: string;
  triggerExplanation: string;
  conditionsExplanation: string;
  actionsExplanation: string;
  exampleScenario: string;
  potentialImpact: string;
  processingTimeMs: number;
}

// Optimize rules response
export interface OptimizeRulesResponse {
  redundantRules: Array<{ ruleIds: string[]; reason: string }>;
  mergeSuggestions: Array<{ ruleIds: string[]; mergedRule: AutomationRule; benefit: string }>;
  performanceImprovements: string[];
  reorderSuggestions: string[];
  overallAssessment: string;
  processingTimeMs: number;
}

// Generate from example response
export interface GenerateFromExampleResponse {
  rule: AutomationRule;
  processingTimeMs: number;
}

// ==================== Phase 6: AI Terminology Helper ====================

// Term category
export type TermCategory =
  | 'technical'
  | 'business'
  | 'process'
  | 'domain'
  | 'acronym'
  | 'jargon';

// Glossary term
export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category: TermCategory;
  aliases: string[];
  relatedTerms: string[];
  examples: string[];
  context: string | null;
  source: string | null;
}

// Define term response
export interface DefineTermResponse {
  term: GlossaryTerm;
  processingTimeMs: number;
}

// Term suggestion
export interface TermSuggestion {
  term: string;
  suggestedDefinition: string;
  category: TermCategory;
  occurrences: number;
  contexts: string[];
  confidence: number;
}

// Extract terms response
export interface ExtractTermsResponse {
  terms: TermSuggestion[];
  processingTimeMs: number;
}

// Term usage
export interface TermUsage {
  term: string;
  location: string;
  context: string;
  isConsistent: boolean;
  suggestedReplacement: string | null;
}

// Check consistency response
export interface CheckConsistencyResponse {
  usages: TermUsage[];
  consistencyScore: number;
  recommendations: string[];
  processingTimeMs: number;
}

// Simplify definition response
export interface SimplifyDefinitionResponse {
  simplifiedDefinition: string;
  processingTimeMs: number;
}

// Find related terms response
export interface FindRelatedTermsResponse {
  relatedTerms: Array<{
    term: string;
    relationship: string;
    explanation: string;
  }>;
  processingTimeMs: number;
}

// Generate glossary response
export interface GenerateGlossaryResponse {
  terms: GlossaryTerm[];
  processingTimeMs: number;
}

// Translate jargon response
export interface TranslateJargonResponse {
  translatedText: string;
  changesMade: Array<{ original: string; replacement: string }>;
  termsExplained: string[];
  processingTimeMs: number;
}

// Suggest term improvements response
export interface SuggestTermImprovementsResponse {
  improvements: Array<{
    term: string;
    issue: string;
    suggestion: string;
  }>;
  missingTerms: string[];
  qualityScore: number;
  overallFeedback: string;
  processingTimeMs: number;
}

// ==================== Phase 6: AI-Powered Onboarding ====================

// Onboarding task type
export type OnboardingTaskType =
  | 'setup'
  | 'learning'
  | 'exploration'
  | 'integration'
  | 'social'
  | 'project'
  | 'tool';

// Task priority
export type OnboardingTaskPriority = 'required' | 'recommended' | 'optional';

// User role
export type OnboardingUserRole =
  | 'developer'
  | 'designer'
  | 'product_manager'
  | 'qa'
  | 'team_lead'
  | 'admin'
  | 'stakeholder';

// Onboarding task
export interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  type: OnboardingTaskType;
  priority: OnboardingTaskPriority;
  estimatedMinutes: number;
  order: number;
  dependencies: string[];
  resources: Array<{ type: string; title: string; url: string }>;
  tips: string[];
  completed: boolean;
}

// Onboarding checklist
export interface OnboardingChecklist {
  id: string;
  userRole: OnboardingUserRole;
  title: string;
  description: string;
  tasks: OnboardingTask[];
  estimatedTotalMinutes: number;
  personalizationNotes: string[];
}

// Generate checklist response
export interface GenerateChecklistResponse {
  checklist: OnboardingChecklist;
  processingTimeMs: number;
}

// Get next steps response
export interface GetNextStepsResponse {
  nextSteps: OnboardingTask[];
  processingTimeMs: number;
}

// Contextual tip
export interface ContextualTip {
  id: string;
  trigger: string;
  title: string;
  content: string;
  action: { type: string; label: string; url: string } | null;
  dismissed: boolean;
}

// Generate tips response
export interface GenerateContextualTipsResponse {
  tips: ContextualTip[];
  processingTimeMs: number;
}

// Learning path response
export interface LearningPathResponse {
  learningPath: {
    title: string;
    description: string;
    estimatedDuration: string;
    milestones: Array<{
      title: string;
      description: string;
      tasks: Array<{
        title: string;
        type: string;
        durationMinutes: number;
        resource: { type: string; url: string };
      }>;
    }>;
    skillsGained: string[];
    successCriteria: string[];
  };
  processingTimeMs: number;
}

// Answer question response
export interface AnswerQuestionResponse {
  answer: string;
  relatedResources: Array<{ title: string; url: string; type: string }>;
  relatedTasks: string[];
  followUpSuggestions: string[];
  processingTimeMs: number;
}

// Assess readiness response
export interface AssessReadinessResponse {
  isReady: boolean;
  readinessScore: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  certificationEligible: boolean;
  nextMilestone: string;
  processingTimeMs: number;
}

// Welcome message response
export interface WelcomeMessageResponse {
  greeting: string;
  introduction: string;
  firstStep: string;
  helpfulContacts: Array<{ role: string; description: string }>;
  funFact: string;
  processingTimeMs: number;
}

// Suggest buddy response
export interface SuggestBuddyResponse {
  suggestedBuddies: Array<{
    userId: string;
    name: string;
    reason: string;
    matchScore: number;
    complementarySkills: string[];
  }>;
  pairingTips: string[];
  processingTimeMs: number;
}

// ==================== Phase 6: Created vs Resolved Reports ====================

// Report period
export type ReportPeriod =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom';

// Trend direction
export type TrendDirection = 'up' | 'down' | 'stable';

// Data point
export interface ReportDataPoint {
  date: string;
  created: number;
  resolved: number;
  net: number;
  cumulativeBacklog: number;
}

// Trend analysis
export interface TrendAnalysis {
  direction: TrendDirection;
  percentageChange: number;
  insight: string;
  prediction: string | null;
}

// Created vs Resolved report
export interface CreatedResolvedReport {
  id: string;
  title: string;
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  dataPoints: ReportDataPoint[];
  totalCreated: number;
  totalResolved: number;
  netChange: number;
  resolutionRate: number;
  createdTrend: TrendAnalysis;
  resolvedTrend: TrendAnalysis;
  insights: string[];
  recommendations: string[];
}

// Generate report response
export interface GenerateCreatedResolvedReportResponse {
  report: CreatedResolvedReport;
  processingTimeMs: number;
}

// Report summary
export interface ReportSummary {
  keyMetrics: Record<string, unknown>;
  highlights: string[];
  concerns: string[];
  actionItems: string[];
}

// Report summary response
export interface ReportSummaryResponseType {
  summary: ReportSummary;
  processingTimeMs: number;
}

// Compare periods response
export interface ComparePeriodsResponse {
  comparison: {
    createdChange: { absolute: number; percentage: number };
    resolvedChange: { absolute: number; percentage: number };
    resolutionRateChange: number;
  };
  improvements: string[];
  regressions: string[];
  notableChanges: string[];
  recommendations: string[];
  processingTimeMs: number;
}

// Forecast backlog response
export interface ForecastBacklogResponse {
  forecast: Array<{
    date: string;
    predictedBacklog: number;
    lowerBound: number;
    upperBound: number;
  }>;
  methodology: string;
  confidence: number;
  assumptions: string[];
  risksToForecast: string[];
  processingTimeMs: number;
}

// Identify bottlenecks response
export interface IdentifyBottlenecksResponse {
  bottlenecks: Array<{
    stage: string;
    avgTimeStuck: string;
    impact: string;
    rootCause: string;
    recommendation: string;
  }>;
  flowEfficiency: number;
  improvementPotential: string;
  processingTimeMs: number;
}

// Team performance response
export interface TeamPerformanceResponse {
  teamSummary: {
    totalResolved: number;
    avgResolutionTime: string;
    collaborationScore: number;
  };
  memberHighlights: Array<{
    member: string;
    achievement: string;
    areaForGrowth: string;
  }>;
  teamStrengths: string[];
  improvementAreas: string[];
  recommendations: string[];
  processingTimeMs: number;
}

// Explain metrics response
export interface ExplainMetricsResponse {
  explanations: Array<{
    metric: string;
    value: string;
    whatItMeans: string;
    isGood: boolean;
    context: string;
  }>;
  overallHealth: string;
  keyTakeaway: string;
  processingTimeMs: number;
}

// Suggest visualizations response
export interface SuggestVisualizationsResponse {
  primaryVisualization: {
    type: string;
    title: string;
    xAxis: string;
    yAxis: string;
    reason: string;
  };
  secondaryVisualizations: Array<{
    type: string;
    title: string;
    purpose: string;
  }>;
  dashboardLayout: string;
  colorRecommendations: string[];
  processingTimeMs: number;
}
