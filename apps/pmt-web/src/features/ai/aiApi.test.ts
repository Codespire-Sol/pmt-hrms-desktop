import { describe, it, expect } from 'vitest';
import { aiApi } from './aiApi';

// Test the API configuration
describe('aiApi', () => {
  describe('API Configuration', () => {
    it('should have correct reducerPath', () => {
      expect(aiApi.reducerPath).toBe('aiApi');
    });

    it('should export reducer', () => {
      expect(aiApi.reducer).toBeDefined();
      expect(typeof aiApi.reducer).toBe('function');
    });

    it('should export middleware', () => {
      expect(aiApi.middleware).toBeDefined();
    });

    it('should have endpoints object', () => {
      expect(aiApi.endpoints).toBeDefined();
      expect(typeof aiApi.endpoints).toBe('object');
    });
  });

  describe('Core Endpoints', () => {
    it('should have getIssueSuggestions endpoint', () => {
      expect(aiApi.endpoints.getIssueSuggestions).toBeDefined();
    });

    it('should have findSimilarIssues endpoint', () => {
      expect(aiApi.endpoints.findSimilarIssues).toBeDefined();
    });

    it('should have parseNaturalLanguage endpoint', () => {
      expect(aiApi.endpoints.parseNaturalLanguage).toBeDefined();
    });

    it('should have expandNotes endpoint', () => {
      expect(aiApi.endpoints.expandNotes).toBeDefined();
    });

    it('should have improveText endpoint', () => {
      expect(aiApi.endpoints.improveText).toBeDefined();
    });

    it('should have generateAcceptanceCriteria endpoint', () => {
      expect(aiApi.endpoints.generateAcceptanceCriteria).toBeDefined();
    });

    it('should have summarizeText endpoint', () => {
      expect(aiApi.endpoints.summarizeText).toBeDefined();
    });
  });

  describe('Planning Endpoints', () => {
    it('should have recommendSprintScope endpoint', () => {
      expect(aiApi.endpoints.recommendSprintScope).toBeDefined();
    });

    it('should have analyzeWorkload endpoint', () => {
      expect(aiApi.endpoints.analyzeWorkload).toBeDefined();
    });
  });

  describe('Estimation Endpoints', () => {
    it('should have estimateStoryPoints endpoint', () => {
      expect(aiApi.endpoints.estimateStoryPoints).toBeDefined();
    });

    it('should have suggestAssignee endpoint', () => {
      expect(aiApi.endpoints.suggestAssignee).toBeDefined();
    });

    it('should have predictCompletion endpoint', () => {
      expect(aiApi.endpoints.predictCompletion).toBeDefined();
    });
  });

  describe('Risk Endpoints', () => {
    it('should have analyzeSprintRisks endpoint', () => {
      expect(aiApi.endpoints.analyzeSprintRisks).toBeDefined();
    });

    it('should have getProjectRisks endpoint', () => {
      expect(aiApi.endpoints.getProjectRisks).toBeDefined();
    });

    it('should have getRiskAlerts endpoint', () => {
      expect(aiApi.endpoints.getRiskAlerts).toBeDefined();
    });
  });

  describe('Feedback Endpoints', () => {
    it('should have recordFeedback endpoint', () => {
      expect(aiApi.endpoints.recordFeedback).toBeDefined();
    });

    it('should have getAcceptanceRate endpoint', () => {
      expect(aiApi.endpoints.getAcceptanceRate).toBeDefined();
    });

    it('should have getFeedbackSummary endpoint', () => {
      expect(aiApi.endpoints.getFeedbackSummary).toBeDefined();
    });
  });
});
