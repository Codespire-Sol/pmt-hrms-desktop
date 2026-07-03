import { Router } from 'express';
import { aiController } from './ai.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { aiRateLimiter } from '../../middleware/security';
import {
  issueSuggestionSchema,
  similarIssuesSchema,
  parseNaturalLanguageSchema,
  parseBulkIssuesSchema,
  expandNotesSchema,
  improveTextSchema,
  acceptanceCriteriaSchema,
  summarizeSchema,
  sprintScopeSchema,
  workloadAnalysisSchema,
  issueOrderSchema,
  completionPredictionSchema,
  standupSchema,
  sprintRisksSchema,
  reassignmentsSchema,
  projectRisksSchema,
  issueCompletionSchema,
  atRiskIssuesSchema,
  velocityTrendsSchema,
  workflowBottlenecksSchema,
  riskAlertsSchema,
  recordFeedbackSchema,
  acceptanceRateSchema,
  analyticsUsageSchema,
  analyticsCostSchema,
  updateProjectConfigSchema,
  checkRateLimitSchema,
  parseMeetingNotesSchema,
  parseTranscriptSchema,
  aiProxyBodySchema,
} from './ai.validator';

const router = Router();

// Health check (no auth required)
router.get('/health', aiController.healthCheck);

// All other routes require authentication and AI rate limiting
router.use(authenticate);
router.use(aiRateLimiter);

// Issue Intelligence
router.post(
  '/issues/suggest',
  validate(issueSuggestionSchema),
  aiController.getIssueSuggestions.bind(aiController)
);

router.post(
  '/issues/similar',
  validate(similarIssuesSchema),
  aiController.findSimilarIssues.bind(aiController)
);

router.post(
  '/issues/parse',
  validate(parseNaturalLanguageSchema),
  aiController.parseNaturalLanguage.bind(aiController)
);

router.post(
  '/issues/parse-bulk',
  validate(parseBulkIssuesSchema),
  aiController.parseBulkIssues.bind(aiController)
);

router.post(
  '/issues/estimate-points',
  validate(issueSuggestionSchema),
  aiController.estimateStoryPoints.bind(aiController)
);

router.post(
  '/issues/suggest-assignee',
  validate(issueSuggestionSchema),
  aiController.suggestAssignee.bind(aiController)
);

router.get(
  '/issues/team-expertise/:projectId',
  aiController.getTeamExpertise.bind(aiController)
);

// Writing Assistant
router.post(
  '/writing/improve',
  validate(improveTextSchema),
  aiController.improveText.bind(aiController)
);

router.post(
  '/writing/acceptance-criteria',
  validate(acceptanceCriteriaSchema),
  aiController.generateAcceptanceCriteria.bind(aiController)
);

router.post(
  '/writing/summarize',
  validate(summarizeSchema),
  aiController.summarizeText.bind(aiController)
);

router.post(
  '/writing/expand-notes',
  validate(expandNotesSchema),
  aiController.expandNotes.bind(aiController)
);

// Sprint Planning
router.post(
  '/planning/sprint-scope',
  validate(sprintScopeSchema),
  aiController.recommendSprintScope.bind(aiController)
);

router.post(
  '/planning/workload-analysis',
  validate(workloadAnalysisSchema),
  aiController.analyzeWorkload.bind(aiController)
);

router.post(
  '/planning/suggest-order',
  validate(issueOrderSchema),
  aiController.suggestIssueOrder.bind(aiController)
);

router.post(
  '/planning/predict-completion',
  validate(completionPredictionSchema),
  aiController.predictCompletion.bind(aiController)
);

router.post(
  '/planning/generate-standup',
  validate(standupSchema),
  aiController.generateStandup.bind(aiController)
);

router.post(
  '/planning/analyze-risks',
  validate(sprintRisksSchema),
  aiController.analyzeSprintRisks.bind(aiController)
);

router.post(
  '/planning/suggest-reassignments',
  validate(reassignmentsSchema),
  aiController.suggestReassignments.bind(aiController)
);

// Usage Stats
router.get('/stats', aiController.getUsageStats.bind(aiController));

// Predictive Analytics
router.post(
  '/predictions/project-risks',
  validate(projectRisksSchema),
  aiController.analyzeProjectRisks.bind(aiController)
);

router.post(
  '/predictions/issue-completion',
  validate(issueCompletionSchema),
  aiController.predictIssueCompletion.bind(aiController)
);

router.post(
  '/predictions/at-risk-issues',
  validate(atRiskIssuesSchema),
  aiController.getAtRiskIssues.bind(aiController)
);

router.post(
  '/predictions/velocity-trends',
  validate(velocityTrendsSchema),
  aiController.analyzeVelocityTrends.bind(aiController)
);

router.post(
  '/predictions/workflow-bottlenecks',
  validate(workflowBottlenecksSchema),
  aiController.analyzeWorkflowBottlenecks.bind(aiController)
);

router.post(
  '/predictions/risk-alerts',
  validate(riskAlertsSchema),
  aiController.generateRiskAlerts.bind(aiController)
);

// Feedback Endpoints
router.post(
  '/admin/feedback',
  validate(recordFeedbackSchema),
  aiController.recordFeedback.bind(aiController)
);

router.post(
  '/admin/feedback/acceptance-rate',
  validate(acceptanceRateSchema),
  aiController.getAcceptanceRate.bind(aiController)
);

router.get(
  '/admin/feedback/summary',
  aiController.getFeedbackSummary.bind(aiController)
);

router.get(
  '/admin/feedback/insights',
  aiController.getFeedbackInsights.bind(aiController)
);

// Analytics Endpoints
router.post(
  '/admin/analytics/usage',
  validate(analyticsUsageSchema),
  aiController.getAnalyticsUsage.bind(aiController)
);

router.post(
  '/admin/analytics/cost',
  validate(analyticsCostSchema),
  aiController.getCostEstimate.bind(aiController)
);

router.get(
  '/admin/analytics/trends',
  aiController.getDailyTrends.bind(aiController)
);

router.get(
  '/admin/analytics/top-users',
  aiController.getTopUsers.bind(aiController)
);

router.get(
  '/admin/analytics/endpoints',
  aiController.getEndpointPerformance.bind(aiController)
);

// Config Endpoints
router.get(
  '/admin/config/:projectId',
  aiController.getProjectConfig.bind(aiController)
);

router.put(
  '/admin/config',
  validate(updateProjectConfigSchema),
  aiController.updateProjectConfig.bind(aiController)
);

router.delete(
  '/admin/config/:projectId',
  aiController.resetProjectConfig.bind(aiController)
);

router.post(
  '/admin/config/check-rate-limit',
  validate(checkRateLimitSchema),
  aiController.checkRateLimit.bind(aiController)
);

router.get(
  '/admin/config/:projectId/features',
  aiController.getFeatureAvailability.bind(aiController)
);

// Meeting Notes
router.post(
  '/meeting-notes/parse',
  validate(parseMeetingNotesSchema),
  aiController.parseMeetingNotes.bind(aiController)
);

router.post(
  '/meeting-notes/parse-transcript',
  validate(parseTranscriptSchema),
  aiController.parseTranscript.bind(aiController)
);

router.get(
  '/meeting-notes/types',
  aiController.getMeetingTypes.bind(aiController)
);

// ==================== ENHANCED CONTENT GENERATION ====================

router.post(
  '/content/variants',
  validate(aiProxyBodySchema),
  aiController.generateContentVariants.bind(aiController)
);

router.post(
  '/content/enhance',
  validate(aiProxyBodySchema),
  aiController.enhanceContent.bind(aiController)
);

router.post(
  '/content/suggest-titles',
  validate(aiProxyBodySchema),
  aiController.suggestTitles.bind(aiController)
);

router.post(
  '/content/generate-template',
  validate(aiProxyBodySchema),
  aiController.generateContentTemplate.bind(aiController)
);

router.post(
  '/content/autocomplete',
  validate(aiProxyBodySchema),
  aiController.smartAutocomplete.bind(aiController)
);

router.post(
  '/content/generate-description',
  validate(aiProxyBodySchema),
  aiController.generateDescription.bind(aiController)
);

router.post(
  '/content/improve-with-feedback',
  validate(aiProxyBodySchema),
  aiController.improveWithFeedback.bind(aiController)
);

router.get(
  '/content/tones',
  aiController.getAvailableTones.bind(aiController)
);

router.get(
  '/content/styles',
  aiController.getAvailableStyles.bind(aiController)
);

// ==================== NATURAL LANGUAGE SEARCH ====================

router.post(
  '/nl-search/parse',
  validate(aiProxyBodySchema),
  aiController.parseNLQuery.bind(aiController)
);

router.post(
  '/nl-search/completions',
  validate(aiProxyBodySchema),
  aiController.getQueryCompletions.bind(aiController)
);

router.post(
  '/nl-search/explain',
  validate(aiProxyBodySchema),
  aiController.explainJQL.bind(aiController)
);

router.get(
  '/nl-search/examples',
  aiController.getQueryExamples.bind(aiController)
);

router.post(
  '/nl-search/validate',
  validate(aiProxyBodySchema),
  aiController.validateJQL.bind(aiController)
);

router.get(
  '/nl-search/fields',
  aiController.getSupportedJQLFields.bind(aiController)
);

// ==================== ISSUE TRIAGE ====================

router.post(
  '/triage/triage',
  validate(aiProxyBodySchema),
  aiController.triageIssue.bind(aiController)
);

router.post(
  '/triage/classify',
  validate(aiProxyBodySchema),
  aiController.classifyIssue.bind(aiController)
);

router.post(
  '/triage/suggest-assignees',
  validate(aiProxyBodySchema),
  aiController.suggestAssigneesForTriage.bind(aiController)
);

router.post(
  '/triage/batch',
  validate(aiProxyBodySchema),
  aiController.batchTriage.bind(aiController)
);

router.get(
  '/triage/categories',
  aiController.getTriageCategories.bind(aiController)
);

// ==================== SUMMARIZATION ====================

router.post(
  '/summarize/issue',
  validate(aiProxyBodySchema),
  aiController.summarizeIssue.bind(aiController)
);

router.post(
  '/summarize/thread',
  validate(aiProxyBodySchema),
  aiController.summarizeThread.bind(aiController)
);

router.post(
  '/summarize/bulk',
  validate(aiProxyBodySchema),
  aiController.summarizeBulk.bind(aiController)
);

router.post(
  '/summarize/daily-digest',
  validate(aiProxyBodySchema),
  aiController.generateDailyDigest.bind(aiController)
);

router.get(
  '/summarize/lengths',
  aiController.getSummaryLengths.bind(aiController)
);

router.get(
  '/summarize/formats',
  aiController.getSummaryFormats.bind(aiController)
);

// ==================== RESOLUTION RAG ====================

router.post(
  '/resolution/similar',
  validate(aiProxyBodySchema),
  aiController.findSimilarResolvedIssues.bind(aiController)
);

router.post(
  '/resolution/suggest',
  validate(aiProxyBodySchema),
  aiController.generateResolutionSuggestion.bind(aiController)
);

router.post(
  '/resolution/check-duplicate',
  validate(aiProxyBodySchema),
  aiController.checkForDuplicate.bind(aiController)
);

router.get(
  '/resolution/patterns',
  aiController.analyzeResolutionPatterns.bind(aiController)
);

router.post(
  '/resolution/suggest-assignee',
  validate(aiProxyBodySchema),
  aiController.suggestAssigneeFromHistory.bind(aiController)
);

router.post(
  '/resolution/analyze',
  validate(aiProxyBodySchema),
  aiController.getFullResolutionAnalysis.bind(aiController)
);

router.post(
  '/resolution/learn',
  validate(aiProxyBodySchema),
  aiController.learnFromResolution.bind(aiController)
);

router.get(
  '/resolution/categories',
  aiController.getResolutionCategories.bind(aiController)
);

// ==================== RISK VISUALIZATION ====================

router.post(
  '/risk/graph',
  validate(aiProxyBodySchema),
  aiController.buildRiskGraph.bind(aiController)
);

router.post(
  '/risk/impact',
  validate(aiProxyBodySchema),
  aiController.analyzeNodeImpact.bind(aiController)
);

router.post(
  '/risk/what-if',
  validate(aiProxyBodySchema),
  aiController.runWhatIfAnalysis.bind(aiController)
);

router.get(
  '/risk/summary',
  aiController.getRiskSummary.bind(aiController)
);

router.get(
  '/risk/levels',
  aiController.getRiskLevels.bind(aiController)
);

// ==================== RELEASE PLANNING ====================

router.post(
  '/release/generate',
  validate(aiProxyBodySchema),
  aiController.generateReleasePlan.bind(aiController)
);

router.post(
  '/release/capacity',
  validate(aiProxyBodySchema),
  aiController.analyzeReleaseCapacity.bind(aiController)
);

router.post(
  '/release/suggest-scope',
  validate(aiProxyBodySchema),
  aiController.suggestReleaseScope.bind(aiController)
);

router.post(
  '/release/roadmap',
  validate(aiProxyBodySchema),
  aiController.generateRoadmap.bind(aiController)
);

router.post(
  '/release/estimate-date',
  validate(aiProxyBodySchema),
  aiController.estimateReleaseDate.bind(aiController)
);

router.get(
  '/release/types',
  aiController.getReleaseTypes.bind(aiController)
);

// ==================== TEST GENERATION ====================

router.post(
  '/tests/generate',
  validate(aiProxyBodySchema),
  aiController.generateTestCases.bind(aiController)
);

router.post(
  '/tests/suite',
  validate(aiProxyBodySchema),
  aiController.generateTestSuite.bind(aiController)
);

router.post(
  '/tests/edge-cases',
  validate(aiProxyBodySchema),
  aiController.generateEdgeCases.bind(aiController)
);

router.post(
  '/tests/regression',
  validate(aiProxyBodySchema),
  aiController.generateRegressionTests.bind(aiController)
);

router.post(
  '/tests/coverage',
  validate(aiProxyBodySchema),
  aiController.analyzeTestCoverage.bind(aiController)
);

router.post(
  '/tests/automation-candidates',
  validate(aiProxyBodySchema),
  aiController.suggestAutomationCandidates.bind(aiController)
);

router.get(
  '/tests/types',
  aiController.getTestTypes.bind(aiController)
);

router.get(
  '/tests/priorities',
  aiController.getTestPriorities.bind(aiController)
);

// ==================== RETROSPECTIVE ====================

router.post(
  '/retro/analyze',
  validate(aiProxyBodySchema),
  aiController.analyzeRetroItems.bind(aiController)
);

router.post(
  '/retro/actions',
  validate(aiProxyBodySchema),
  aiController.generateRetroActions.bind(aiController)
);

router.post(
  '/retro/sprint-analysis',
  validate(aiProxyBodySchema),
  aiController.analyzeSprintPerformance.bind(aiController)
);

router.post(
  '/retro/summary',
  validate(aiProxyBodySchema),
  aiController.generateRetroSummary.bind(aiController)
);

router.post(
  '/retro/topics',
  validate(aiProxyBodySchema),
  aiController.suggestRetroTopics.bind(aiController)
);

router.post(
  '/retro/compare',
  validate(aiProxyBodySchema),
  aiController.compareRetrospectives.bind(aiController)
);

router.post(
  '/retro/script',
  validate(aiProxyBodySchema),
  aiController.generateFacilitationScript.bind(aiController)
);

router.get(
  '/retro/formats',
  aiController.getRetroFormats.bind(aiController)
);

router.get(
  '/retro/categories',
  aiController.getInsightCategories.bind(aiController)
);

// ==================== TEMPLATE GENERATION ====================

router.post(
  '/templates/issue',
  validate(aiProxyBodySchema),
  aiController.generateIssueTemplateEnhanced.bind(aiController)
);

router.post(
  '/templates/epic',
  validate(aiProxyBodySchema),
  aiController.generateEpicTemplate.bind(aiController)
);

router.post(
  '/templates/checklist',
  validate(aiProxyBodySchema),
  aiController.generateChecklistTemplate.bind(aiController)
);

router.post(
  '/templates/workflow',
  validate(aiProxyBodySchema),
  aiController.generateWorkflowTemplate.bind(aiController)
);

router.post(
  '/templates/meeting',
  validate(aiProxyBodySchema),
  aiController.generateMeetingTemplate.bind(aiController)
);

router.post(
  '/templates/customize',
  validate(aiProxyBodySchema),
  aiController.customizeTemplate.bind(aiController)
);

router.post(
  '/templates/suggest-fields',
  validate(aiProxyBodySchema),
  aiController.suggestTemplateFields.bind(aiController)
);

router.post(
  '/templates/documentation',
  validate(aiProxyBodySchema),
  aiController.generateDocumentationTemplate.bind(aiController)
);

router.get(
  '/templates/types',
  aiController.getTemplateTypes.bind(aiController)
);

router.get(
  '/templates/field-types',
  aiController.getFieldTypes.bind(aiController)
);

// ==================== CODE REVIEW ====================

router.post(
  '/code-review/analyze-pr',
  validate(aiProxyBodySchema),
  aiController.analyzePR.bind(aiController)
);

router.post(
  '/code-review/review-snippet',
  validate(aiProxyBodySchema),
  aiController.reviewCodeSnippet.bind(aiController)
);

router.post(
  '/code-review/suggest-improvements',
  validate(aiProxyBodySchema),
  aiController.suggestCodeImprovements.bind(aiController)
);

router.post(
  '/code-review/review-summary',
  validate(aiProxyBodySchema),
  aiController.generateReviewSummary.bind(aiController)
);

router.post(
  '/code-review/security-check',
  validate(aiProxyBodySchema),
  aiController.checkCodeSecurity.bind(aiController)
);

router.post(
  '/code-review/suggest-tests',
  validate(aiProxyBodySchema),
  aiController.suggestTestsForCode.bind(aiController)
);

// ==================== AUTOMATION GENERATION ====================

router.post(
  '/automation/generate',
  validate(aiProxyBodySchema),
  aiController.generateAutomation.bind(aiController)
);

router.post(
  '/automation/suggest',
  validate(aiProxyBodySchema),
  aiController.suggestAutomations.bind(aiController)
);

router.post(
  '/automation/validate',
  validate(aiProxyBodySchema),
  aiController.validateAutomationRule.bind(aiController)
);

router.post(
  '/automation/explain',
  validate(aiProxyBodySchema),
  aiController.explainAutomationRule.bind(aiController)
);

router.post(
  '/automation/optimize',
  validate(aiProxyBodySchema),
  aiController.optimizeAutomationRules.bind(aiController)
);

router.post(
  '/automation/from-example',
  validate(aiProxyBodySchema),
  aiController.generateRuleFromExample.bind(aiController)
);

// ==================== TERMINOLOGY ====================

router.post(
  '/terminology/define',
  validate(aiProxyBodySchema),
  aiController.defineTerm.bind(aiController)
);

router.post(
  '/terminology/extract',
  validate(aiProxyBodySchema),
  aiController.extractTerms.bind(aiController)
);

router.post(
  '/terminology/check-consistency',
  validate(aiProxyBodySchema),
  aiController.checkTerminologyConsistency.bind(aiController)
);

router.post(
  '/terminology/simplify',
  validate(aiProxyBodySchema),
  aiController.simplifyDefinition.bind(aiController)
);

router.post(
  '/terminology/find-related',
  validate(aiProxyBodySchema),
  aiController.findRelatedTerms.bind(aiController)
);

router.post(
  '/terminology/generate-glossary',
  validate(aiProxyBodySchema),
  aiController.generateGlossary.bind(aiController)
);

router.post(
  '/terminology/translate-jargon',
  validate(aiProxyBodySchema),
  aiController.translateJargon.bind(aiController)
);

router.post(
  '/terminology/suggest-improvements',
  validate(aiProxyBodySchema),
  aiController.suggestTermImprovements.bind(aiController)
);

// ==================== ONBOARDING ====================

router.post(
  '/onboarding/generate-checklist',
  validate(aiProxyBodySchema),
  aiController.generateOnboardingChecklist.bind(aiController)
);

router.post(
  '/onboarding/next-steps',
  validate(aiProxyBodySchema),
  aiController.getOnboardingNextSteps.bind(aiController)
);

router.post(
  '/onboarding/contextual-tips',
  validate(aiProxyBodySchema),
  aiController.generateContextualTips.bind(aiController)
);

router.post(
  '/onboarding/learning-path',
  validate(aiProxyBodySchema),
  aiController.createLearningPath.bind(aiController)
);

router.post(
  '/onboarding/answer-question',
  validate(aiProxyBodySchema),
  aiController.answerOnboardingQuestion.bind(aiController)
);

router.post(
  '/onboarding/assess-readiness',
  validate(aiProxyBodySchema),
  aiController.assessOnboardingReadiness.bind(aiController)
);

router.post(
  '/onboarding/welcome-message',
  validate(aiProxyBodySchema),
  aiController.generateWelcomeMessage.bind(aiController)
);

router.post(
  '/onboarding/suggest-buddy',
  validate(aiProxyBodySchema),
  aiController.suggestOnboardingBuddy.bind(aiController)
);

// ==================== REPORTS ====================

router.post(
  '/reports/created-resolved',
  validate(aiProxyBodySchema),
  aiController.generateCreatedResolvedReport.bind(aiController)
);

router.post(
  '/reports/summary',
  validate(aiProxyBodySchema),
  aiController.generateReportSummary.bind(aiController)
);

router.post(
  '/reports/compare-periods',
  validate(aiProxyBodySchema),
  aiController.compareReportPeriods.bind(aiController)
);

router.post(
  '/reports/forecast-backlog',
  validate(aiProxyBodySchema),
  aiController.forecastBacklog.bind(aiController)
);

router.post(
  '/reports/identify-bottlenecks',
  validate(aiProxyBodySchema),
  aiController.identifyBottlenecks.bind(aiController)
);

router.post(
  '/reports/team-performance',
  validate(aiProxyBodySchema),
  aiController.generateTeamPerformanceReport.bind(aiController)
);

router.post(
  '/reports/explain-metrics',
  validate(aiProxyBodySchema),
  aiController.explainMetrics.bind(aiController)
);

router.post(
  '/reports/suggest-visualizations',
  validate(aiProxyBodySchema),
  aiController.suggestReportVisualizations.bind(aiController)
);

router.post(
  '/reports/financial-analysis',
  validate(aiProxyBodySchema),
  aiController.explainMetrics.bind(aiController)
);

router.post(
  '/predictions/budget-forecast',
  validate(aiProxyBodySchema),
  aiController.generateReportSummary.bind(aiController)
);

export default router;
