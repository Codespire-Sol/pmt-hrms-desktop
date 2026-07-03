import { Request, Response, NextFunction } from 'express';
import { aiService } from './ai.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class AIController {
  // Issue Suggestions
  async getIssueSuggestions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { title, description, projectId } = req.body;
      const result = await aiService.getIssueSuggestions(title, description, projectId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Find Similar Issues
  async findSimilarIssues(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { title, description, projectId, limit } = req.body;
      const result = await aiService.findSimilarIssues(title, description, projectId, limit || 5);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Parse Natural Language
  async parseNaturalLanguage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { text, projectId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.parseNaturalLanguage(
        text,
        projectId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Parse Bulk Issues
  async parseBulkIssues(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { text, projectId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.parseBulkIssues(
        text,
        projectId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Expand Notes
  async expandNotes(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { notes, context } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.expandNotes(notes, context, authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Improve Text
  async improveText(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { text, style } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.improveText(text, style, authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Generate Acceptance Criteria
  async generateAcceptanceCriteria(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { title, description } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.generateAcceptanceCriteria(
        title,
        description,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Summarize Text
  async summarizeText(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { text, maxLength } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.summarizeText(
        text,
        maxLength || 200,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Sprint Scope Recommendation
  async recommendSprintScope(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, sprintDurationDays, targetPoints } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.recommendSprintScope(
        projectId,
        sprintDurationDays || 14,
        targetPoints,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Workload Analysis
  async analyzeWorkload(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, sprintId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.analyzeWorkload(
        projectId,
        sprintId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Usage Stats
  async getUsageStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await aiService.getUsageStats();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Estimate Story Points
  async estimateStoryPoints(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { title, description, projectId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.estimateStoryPoints(
        title,
        description,
        projectId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Suggest Assignee
  async suggestAssignee(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { title, description, projectId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.suggestAssignee(
        title,
        description,
        projectId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Team Expertise
  async getTeamExpertise(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const authHeader = req.headers.authorization;

      const result = await aiService.getTeamExpertise(projectId, authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Health Check
  async healthCheck(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    try {
      const result = await aiService.healthCheck();
      res.json({ success: true, data: result });
    } catch (error) {
      // AI service might be down
      res.status(503).json({
        success: false,
        error: {
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'AI service is not available',
        },
      });
    }
  }

  // Suggest Issue Order
  async suggestIssueOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, sprintId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.suggestIssueOrder(
        projectId,
        sprintId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Predict Completion
  async predictCompletion(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, sprintId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.predictCompletion(
        projectId,
        sprintId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Generate Standup
  async generateStandup(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, sprintId, userId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.generateStandup(
        projectId,
        sprintId,
        userId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Analyze Sprint Risks
  async analyzeSprintRisks(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, sprintId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.analyzeSprintRisks(
        projectId,
        sprintId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Suggest Reassignments
  async suggestReassignments(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, sprintId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.suggestReassignments(
        projectId,
        sprintId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Analyze Project Risks
  async analyzeProjectRisks(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.analyzeProjectRisks(projectId, authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Predict Issue Completion
  async predictIssueCompletion(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { issueId, projectId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.predictIssueCompletion(
        issueId,
        projectId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get At-Risk Issues
  async getAtRiskIssues(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, sprintId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.getAtRiskIssues(
        projectId,
        sprintId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Analyze Velocity Trends
  async analyzeVelocityTrends(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.analyzeVelocityTrends(
        projectId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Analyze Workflow Bottlenecks
  async analyzeWorkflowBottlenecks(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, sprintId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.analyzeWorkflowBottlenecks(
        projectId,
        sprintId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Generate Risk Alerts
  async generateRiskAlerts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.generateRiskAlerts(projectId, authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== FEEDBACK ====================

  // Record Feedback
  async recordFeedback(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { suggestionType, suggestionId, accepted, rating, comment, metadata } =
        req.body;
      const userId = req.user!.id;
      const authHeader = req.headers.authorization;

      const result = await aiService.recordFeedback(
        userId,
        suggestionType,
        suggestionId,
        accepted,
        rating,
        comment,
        metadata,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Acceptance Rate
  async getAcceptanceRate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { suggestionType, days } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.getAcceptanceRate(
        suggestionType,
        days || 30,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Feedback Summary
  async getFeedbackSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const authHeader = req.headers.authorization;

      const result = await aiService.getFeedbackSummary(days, authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Feedback Insights
  async getFeedbackInsights(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      const result = await aiService.getFeedbackInsights(authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ANALYTICS ====================

  // Get Analytics Usage
  async getAnalyticsUsage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { startDate, endDate, projectId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.getAnalyticsUsage(
        startDate,
        endDate,
        projectId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Cost Estimate
  async getCostEstimate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { startDate, endDate, projectId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.getCostEstimate(
        startDate,
        endDate,
        projectId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Daily Trends
  async getDailyTrends(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 14;
      const projectId = req.query.projectId as string | undefined;
      const authHeader = req.headers.authorization;

      const result = await aiService.getDailyTrends(days, projectId, authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Top Users
  async getTopUsers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const limit = parseInt(req.query.limit as string) || 10;
      const authHeader = req.headers.authorization;

      const result = await aiService.getTopUsers(days, limit, authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Endpoint Performance
  async getEndpointPerformance(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      const result = await aiService.getEndpointPerformance(authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CONFIG ====================

  // Get Project Config
  async getProjectConfig(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const authHeader = req.headers.authorization;

      const result = await aiService.getProjectConfig(projectId, authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Update Project Config
  async updateProjectConfig(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, enabled, features, limits } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.updateProjectConfig(
        projectId,
        enabled,
        features,
        limits,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Reset Project Config
  async resetProjectConfig(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const authHeader = req.headers.authorization;

      const result = await aiService.resetProjectConfig(projectId, authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Check Rate Limit
  async checkRateLimit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId, userId } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.checkRateLimit(
        projectId,
        userId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Feature Availability
  async getFeatureAvailability(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { projectId } = req.params;
      const authHeader = req.headers.authorization;

      const result = await aiService.getFeatureAvailability(
        projectId,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== MEETING NOTES ====================

  // Parse Meeting Notes
  async parseMeetingNotes(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { notes, projectId, meetingType, attendees } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.parseMeetingNotes(
        notes,
        projectId,
        meetingType,
        attendees,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Parse Transcript
  async parseTranscript(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { transcript, projectId, speakerNames } = req.body;
      const authHeader = req.headers.authorization;

      const result = await aiService.parseTranscript(
        transcript,
        projectId,
        speakerNames,
        authHeader
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // Get Meeting Types
  async getMeetingTypes(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.getMeetingTypes(authHeader);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ENHANCED CONTENT GENERATION ====================

  async generateContentVariants(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/content/variants', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async enhanceContent(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/content/enhance', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestTitles(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/content/suggest-titles', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateContentTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/content/generate-template', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async smartAutocomplete(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/content/autocomplete', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateDescription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await aiService.generateDescription(req.body as Record<string, unknown>);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async improveWithFeedback(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/content/improve-with-feedback', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableTones(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/content/tones', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableStyles(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/content/styles', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== NATURAL LANGUAGE SEARCH ====================

  async parseNLQuery(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/nl-search/parse', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getQueryCompletions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/nl-search/completions', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async explainJQL(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/nl-search/explain', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getQueryExamples(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const category = req.query.category as string | undefined;
      const url = category ? `/api/ai/nl-search/examples?category=${category}` : '/api/ai/nl-search/examples';
      const result = await aiService.proxyRequest(url, 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async validateJQL(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/nl-search/validate', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getSupportedJQLFields(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/nl-search/fields', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ISSUE TRIAGE ====================

  async triageIssue(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/triage/triage', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async classifyIssue(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/triage/classify', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestAssigneesForTriage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/triage/suggest-assignees', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async batchTriage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/triage/batch', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getTriageCategories(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/triage/categories', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== SUMMARIZATION ====================

  async summarizeIssue(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/summarize/issue', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async summarizeThread(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/summarize/thread', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async summarizeBulk(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/summarize/bulk', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateDailyDigest(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/summarize/daily-digest', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getSummaryLengths(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/summarize/lengths', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getSummaryFormats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/summarize/formats', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== RESOLUTION RAG ====================

  async findSimilarResolvedIssues(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/resolution/similar', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateResolutionSuggestion(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/resolution/suggest', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async checkForDuplicate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/resolution/check-duplicate', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async analyzeResolutionPatterns(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const { projectId, category, limit } = req.query;
      const params = new URLSearchParams();
      if (projectId) params.append('projectId', projectId as string);
      if (category) params.append('category', category as string);
      if (limit) params.append('limit', limit as string);
      const url = `/api/ai/resolution/patterns?${params.toString()}`;
      const result = await aiService.proxyRequest(url, 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestAssigneeFromHistory(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/resolution/suggest-assignee', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getFullResolutionAnalysis(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/resolution/analyze', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async learnFromResolution(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/resolution/learn', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getResolutionCategories(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/resolution/categories', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== RISK VISUALIZATION ====================

  async buildRiskGraph(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/risk/graph', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async analyzeNodeImpact(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/risk/impact', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async runWhatIfAnalysis(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/risk/what-if', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getRiskSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const projectId = req.query.projectId as string;
      const url = `/api/ai/risk/summary?projectId=${projectId}`;
      const result = await aiService.proxyRequest(url, 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getRiskLevels(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/risk/levels', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== RELEASE PLANNING ====================

  async generateReleasePlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/release/generate', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async analyzeReleaseCapacity(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/release/capacity', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestReleaseScope(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/release/suggest-scope', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateRoadmap(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/release/roadmap', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async estimateReleaseDate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/release/estimate-date', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getReleaseTypes(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/release/types', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== TEST GENERATION ====================

  async generateTestCases(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/tests/generate', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateTestSuite(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/tests/suite', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateEdgeCases(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/tests/edge-cases', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateRegressionTests(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/tests/regression', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async analyzeTestCoverage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/tests/coverage', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestAutomationCandidates(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/tests/automation-candidates', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getTestTypes(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/tests/types', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getTestPriorities(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/tests/priorities', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== RETROSPECTIVE ====================

  async analyzeRetroItems(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/retro/analyze', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateRetroActions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/retro/actions', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async analyzeSprintPerformance(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/retro/sprint-analysis', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateRetroSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/retro/summary', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestRetroTopics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/retro/topics', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async compareRetrospectives(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/retro/compare', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateFacilitationScript(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/retro/script', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getRetroFormats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/retro/formats', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getInsightCategories(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/retro/categories', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== TEMPLATE GENERATION ====================

  async generateIssueTemplateEnhanced(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/templates/issue', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateEpicTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/templates/epic', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateChecklistTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/templates/checklist', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateWorkflowTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/templates/workflow', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateMeetingTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/templates/meeting', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async customizeTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/templates/customize', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestTemplateFields(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/templates/suggest-fields', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateDocumentationTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/templates/documentation', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getTemplateTypes(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/templates/types', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getFieldTypes(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/templates/field-types', 'GET', null, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CODE REVIEW ====================

  async analyzePR(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/code-review/analyze-pr', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async reviewCodeSnippet(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/code-review/review-snippet', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestCodeImprovements(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/code-review/suggest-improvements', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateReviewSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/code-review/review-summary', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async checkCodeSecurity(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/code-review/security-check', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestTestsForCode(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/code-review/suggest-tests', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== AUTOMATION GENERATION ====================

  async generateAutomation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/automation/generate', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestAutomations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/automation/suggest', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async validateAutomationRule(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/automation/validate', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async explainAutomationRule(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/automation/explain', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async optimizeAutomationRules(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/automation/optimize', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateRuleFromExample(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/automation/from-example', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== TERMINOLOGY ====================

  async defineTerm(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/terminology/define', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async extractTerms(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/terminology/extract', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async checkTerminologyConsistency(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/terminology/check-consistency', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async simplifyDefinition(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/terminology/simplify', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findRelatedTerms(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/terminology/find-related', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateGlossary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/terminology/generate-glossary', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async translateJargon(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/terminology/translate-jargon', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestTermImprovements(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/terminology/suggest-improvements', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ONBOARDING ====================

  async generateOnboardingChecklist(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/onboarding/generate-checklist', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getOnboardingNextSteps(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/onboarding/next-steps', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateContextualTips(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/onboarding/contextual-tips', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async createLearningPath(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/onboarding/learning-path', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async answerOnboardingQuestion(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/onboarding/answer-question', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async assessOnboardingReadiness(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/onboarding/assess-readiness', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateWelcomeMessage(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/onboarding/welcome-message', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestOnboardingBuddy(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/onboarding/suggest-buddy', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== REPORTS ====================

  async generateCreatedResolvedReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/reports/created-resolved', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateReportSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await aiService.generateReportSummary(req.body as Record<string, unknown>);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async compareReportPeriods(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/reports/compare-periods', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async forecastBacklog(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/reports/forecast-backlog', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async identifyBottlenecks(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/reports/identify-bottlenecks', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateTeamPerformanceReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/reports/team-performance', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async explainMetrics(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await aiService.explainMetrics(req.body as Record<string, unknown>);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async suggestReportVisualizations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const result = await aiService.proxyRequest('/api/ai/reports/suggest-visualizations', 'POST', req.body, authHeader);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AIController();
