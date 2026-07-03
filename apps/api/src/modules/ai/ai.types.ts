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

// Meeting Notes
export interface ExtractedActionItem {
  title: string;
  description: string;
  issueType: string;
  priority?: string;
  assigneeHint?: string;
  dueDateHint?: string;
  labels: string[];
  storyPoints?: number;
  sourceQuote: string;
  confidence: number;
}

export interface MeetingNotesSummary {
  meetingDateHint?: string;
  meetingType?: string;
  keyDecisions: string[];
  discussionPoints: string[];
  followUps: string[];
  blockersMentioned: string[];
}

export interface MeetingNotesResponse {
  actionItems: ExtractedActionItem[];
  summary: MeetingNotesSummary;
  originalTextLength: number;
  issuesExtracted: number;
  processingTimeMs: number;
}

export interface MeetingTypeInfo {
  id: string;
  name: string;
  description: string;
}

export interface MeetingTypesResponse {
  meetingTypes: MeetingTypeInfo[];
}
