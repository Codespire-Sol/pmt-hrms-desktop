import { describe, it, expect } from 'vitest';

// Import types to ensure they compile correctly
import type {
  // Phase 5 types
  SimilarResolvedIssue,
  ResolutionSuggestion,
  ResolutionStep,
  RiskNode,
  RiskEdge,
  TestCase,
  TestStep,
  // Phase 6 types
  ReviewSeverity,
  ReviewCategory,
  CodeComment,
  FileSummary,
  CodeSuggestion,
  PRAnalysisResponse,
  AutomationTriggerType,
  AutomationActionType,
  ConditionOperator,
  AutomationCondition,
  AutomationAction,
  AutomationRule,
  AutomationSuggestion,
  TermCategory,
  GlossaryTerm,
  TermSuggestion,
  TermUsage,
  OnboardingTaskType,
  OnboardingTaskPriority,
  OnboardingTask,
  OnboardingChecklist,
  ContextualTip,
  ReportPeriod,
  TrendDirection,
  ReportDataPoint,
  TrendAnalysis,
  CreatedResolvedReport,
  ReportSummary,
  TeamPerformanceResponse,
} from './types';

describe('AI Types - Phase 5', () => {
  describe('Resolution Assistant Types', () => {
    it('SimilarResolvedIssue should have correct structure', () => {
      const issue: SimilarResolvedIssue = {
        issueId: 'issue-1',
        issueKey: 'PROJ-123',
        title: 'Similar issue',
        description: 'A description',
        resolution: 'Fixed by update',
        resolutionCategory: 'configuration',
        similarityScore: 0.85,
        resolvedBy: null,
        resolutionTimeHours: null,
        tags: [],
      };
      expect(issue.issueId).toBe('issue-1');
      expect(issue.similarityScore).toBe(0.85);
    });

    it('ResolutionSuggestion should have correct structure', () => {
      const suggestion: ResolutionSuggestion = {
        summary: 'Update config',
        category: 'configuration',
        confidence: 'high',
        confidenceScore: 0.9,
        steps: [],
        basedOnIssues: [],
        estimatedTimeHours: null,
        potentialRisks: [],
        alternativeApproaches: [],
      };
      expect(suggestion.confidenceScore).toBe(0.9);
    });
  });

  describe('Risk Visualization Types', () => {
    it('RiskNode should have correct structure', () => {
      const node: RiskNode = {
        id: 'node-1',
        label: 'PROJ-1',
        title: 'Issue title',
        type: 'issue',
        riskLevel: 'high',
        riskScore: 0.8,
        status: null,
        assignee: null,
        dueDate: null,
        metadata: {},
      };
      expect(node.riskScore).toBe(0.8);
    });

    it('RiskEdge should have correct structure', () => {
      const edge: RiskEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        relationship: 'blocks',
        weight: 0.9,
        isCriticalPath: false,
      };
      expect(edge.weight).toBe(0.9);
    });
  });

  describe('Test Case Types', () => {
    it('TestCase should have correct structure', () => {
      const testCase: TestCase = {
        id: 'tc-1',
        title: 'Test login',
        description: 'Test login flow',
        testType: 'functional',
        priority: 'high',
        preconditions: ['User exists'],
        steps: [],
        expectedOutcome: 'Login successful',
        tags: [],
        estimatedDurationMinutes: 10,
        automationFeasibility: 'high',
      };
      expect(testCase.testType).toBe('functional');
    });
  });
});

describe('AI Types - Phase 6', () => {
  describe('Code Review Types', () => {
    it('ReviewSeverity values should be valid', () => {
      const severities: ReviewSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
      expect(severities).toHaveLength(5);
    });

    it('CodeComment should have correct structure', () => {
      const comment: CodeComment = {
        id: 'comment-1',
        filePath: 'src/main.ts',
        severity: 'medium',
        category: 'bug',
        message: 'Potential issue',
        lineStart: 10,
        lineEnd: 15,
        suggestion: null,
        codeSnippet: null,
        explanation: null,
      };
      expect(comment.severity).toBe('medium');
    });

    it('FileSummary should have correct structure', () => {
      const summary: FileSummary = {
        filePath: 'src/main.ts',
        changeType: 'modified',
        linesAdded: 10,
        linesRemoved: 5,
        summary: 'Added feature',
        riskLevel: 'low',
        keyChanges: ['New function'],
      };
      expect(summary.linesAdded).toBe(10);
    });
  });

  describe('Automation Types', () => {
    it('AutomationTriggerType values should be valid', () => {
      const triggers: AutomationTriggerType[] = [
        'issue_created',
        'issue_updated',
        'issue_transitioned',
        'comment_added',
        'sprint_started',
        'sprint_completed',
        'scheduled',
      ];
      expect(triggers).toContain('issue_created');
    });

    it('AutomationRule should have correct structure', () => {
      const rule: AutomationRule = {
        id: 'rule-1',
        name: 'Auto-assign',
        description: 'Assigns issues automatically',
        trigger: 'issue_created',
        triggerConfig: {},
        conditions: [],
        actions: [],
        enabled: true,
        priority: 1,
      };
      expect(rule.enabled).toBe(true);
    });
  });

  describe('Terminology Types', () => {
    it('TermCategory values should be valid', () => {
      const categories: TermCategory[] = [
        'technical',
        'business',
        'process',
        'domain',
        'acronym',
        'jargon',
      ];
      expect(categories).toHaveLength(6);
    });

    it('GlossaryTerm should have correct structure', () => {
      const term: GlossaryTerm = {
        id: 'term-1',
        term: 'Sprint',
        definition: 'Time-boxed iteration',
        category: 'process',
        aliases: ['Iteration'],
        examples: [],
        relatedTerms: [],
        context: null,
        source: null,
      };
      expect(term.category).toBe('process');
    });
  });

  describe('Onboarding Types', () => {
    it('OnboardingTask should have correct structure', () => {
      const task: OnboardingTask = {
        id: 'task-1',
        title: 'Complete profile',
        description: 'Add your info',
        type: 'setup',
        priority: 'required',
        estimatedMinutes: 5,
        order: 1,
        dependencies: [],
        resources: [],
        tips: [],
        completed: false,
      };
      expect(task.type).toBe('setup');
    });
  });

  describe('Reports Types', () => {
    it('ReportPeriod values should be valid', () => {
      const periods: ReportPeriod[] = [
        'daily',
        'weekly',
        'biweekly',
        'monthly',
        'quarterly',
        'yearly',
        'custom',
      ];
      expect(periods).toContain('monthly');
    });

    it('CreatedResolvedReport should have correct structure', () => {
      const report: CreatedResolvedReport = {
        id: 'report-1',
        title: 'Created vs Resolved',
        period: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        dataPoints: [],
        totalCreated: 50,
        totalResolved: 45,
        netChange: -5,
        resolutionRate: 0.9,
        createdTrend: { direction: 'up', percentageChange: 10, insight: 'Better', prediction: null },
        resolvedTrend: { direction: 'up', percentageChange: 10, insight: 'Better', prediction: null },
        insights: [],
        recommendations: [],
      };
      expect(report.netChange).toBe(-5);
    });

    it('TeamPerformanceResponse should have correct structure', () => {
      const report: TeamPerformanceResponse = {
        teamSummary: {
          totalResolved: 10,
          avgResolutionTime: '24h',
          collaborationScore: 0.8,
        },
        memberHighlights: [],
        teamStrengths: [],
        improvementAreas: [],
        recommendations: [],
        processingTimeMs: 100,
      };
      expect(report.teamSummary.collaborationScore).toBe(0.8);
    });
  });
});
