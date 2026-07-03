import { useMemo, useCallback, useState } from 'react';
import {
  useImproveTextMutation,
  useGenerateStandupMutation,
  useRecordFeedbackMutation,
  useParseNaturalLanguageMutation,
  aiApi,
} from '../aiApi';

// Smart Create Hook - uses natural language parsing
export function useSmartCreate() {
  const [parseNaturalLanguage, { isLoading, isError, error, data }] = useParseNaturalLanguageMutation();

  const smartCreate = useCallback(
    (input: { text: string; projectId: string }) => {
      return parseNaturalLanguage(input);
    },
    [parseNaturalLanguage]
  );

  return useMemo(
    () => ({
      smartCreate,
      isLoading,
      isError,
      error,
      result: data,
    }),
    [smartCreate, isLoading, isError, error, data]
  );
}

// Description Enhancement Hook
export function useDescriptionEnhancement() {
  const [improve, { isLoading, isError, error, data }] = useImproveTextMutation();

  const enhance = useCallback(
    (text: string) => {
      return improve({ text, style: 'professional' });
    },
    [improve]
  );

  return useMemo(
    () => ({
      enhance,
      isLoading,
      isError,
      error,
      enhancedDescription: (data as any)?.improved,
      suggestions: (data as any)?.suggestions || [],
    }),
    [enhance, isLoading, isError, error, data]
  );
}

// Assignment Suggestion Hook - uses lazy query
export function useAssignmentSuggestion() {
  const [trigger, result] = aiApi.endpoints.suggestAssignee.useLazyQuery();

  const suggest = useCallback(
    (input: { title: string; description: string; projectId: string }) => {
      return trigger(input);
    },
    [trigger]
  );

  return useMemo(
    () => ({
      suggest,
      isLoading: result.isLoading,
      isError: result.isError,
      error: result.error,
      suggestions: (result.data as any)?.suggestions || [],
    }),
    [suggest, result]
  );
}

// Time Estimation Hook - uses lazy query
export function useTimeEstimation() {
  const [trigger, result] = aiApi.endpoints.estimateStoryPoints.useLazyQuery();

  const estimate = useCallback(
    (input: { title: string; description: string; projectId: string }) => {
      return trigger(input);
    },
    [trigger]
  );

  return useMemo(
    () => ({
      estimate,
      isLoading: result.isLoading,
      isError: result.isError,
      error: result.error,
      estimation: result.data,
    }),
    [estimate, result]
  );
}

// Standup Generation Hook
export function useStandupGeneration() {
  const [generate, { isLoading, isError, error, data }] = useGenerateStandupMutation();

  return useMemo(
    () => ({
      generate,
      isLoading,
      isError,
      error,
      standup: data,
    }),
    [generate, isLoading, isError, error, data]
  );
}

// Risk Analysis Hook - uses lazy query
export function useRiskAnalysis() {
  const [trigger, result] = aiApi.endpoints.analyzeSprintRisks.useLazyQuery();

  const analyze = useCallback(
    (input: { projectId: string; sprintId: string }) => {
      return trigger(input);
    },
    [trigger]
  );

  return useMemo(
    () => ({
      analyze,
      isLoading: result.isLoading,
      isError: result.isError,
      error: result.error,
      risks: (result.data as any)?.risks || [],
      summary: (result.data as any)?.summary,
    }),
    [analyze, result]
  );
}

// Semantic Search Hook - placeholder for now
export function useSemanticSearch() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const performSearch = useCallback(
    async (_projectId: string, searchQuery: string, _filters?: any) => {
      setQuery(searchQuery);
      setIsLoading(false);
      // Semantic search to be implemented when API is available
      return { results: [], total: 0 };
    },
    []
  );

  return useMemo(
    () => ({
      search: performSearch,
      query,
      isLoading,
      isError: false,
      error: null,
      results: [] as any[],
      total: 0,
    }),
    [performSearch, query, isLoading]
  );
}

// Similar Issues Hook - uses lazy query
export function useSimilarIssues() {
  const [trigger, result] = aiApi.endpoints.findSimilarIssues.useLazyQuery();

  const findSimilar = useCallback(
    (input: { title: string; description: string; projectId: string; limit?: number }) => {
      return trigger(input);
    },
    [trigger]
  );

  return useMemo(
    () => ({
      findSimilar,
      isLoading: result.isLoading,
      isError: result.isError,
      error: result.error,
      similarIssues: (result.data as any)?.similarIssues || [],
      hasDuplicates: ((result.data as any)?.similarIssues?.length || 0) > 0,
    }),
    [findSimilar, result]
  );
}

// AI Feedback Hook
export function useAIFeedback() {
  const [submit, { isLoading, isSuccess }] = useRecordFeedbackMutation();

  const submitFeedback = useCallback(
    (featureType: string, rating: 'helpful' | 'not_helpful', context?: Record<string, any>) => {
      return submit({
        suggestionType: featureType,
        suggestionId: 'feedback',
        accepted: rating === 'helpful',
        metadata: context,
      });
    },
    [submit]
  );

  return useMemo(
    () => ({
      submitFeedback,
      isSubmitting: isLoading,
      isSubmitted: isSuccess,
    }),
    [submitFeedback, isLoading, isSuccess]
  );
}

// Combined AI Features Hook
export function useAIFeatures(projectId: string | undefined) {
  const smartCreate = useSmartCreate();
  const descriptionEnhancement = useDescriptionEnhancement();
  const assignmentSuggestion = useAssignmentSuggestion();
  const timeEstimation = useTimeEstimation();
  const standupGeneration = useStandupGeneration();
  const riskAnalysis = useRiskAnalysis();
  const semanticSearch = useSemanticSearch();
  const similarIssues = useSimilarIssues();
  const feedback = useAIFeedback();

  return useMemo(
    () => ({
      projectId,
      smartCreate,
      descriptionEnhancement,
      assignmentSuggestion,
      timeEstimation,
      standupGeneration,
      riskAnalysis,
      semanticSearch,
      similarIssues,
      feedback,
    }),
    [
      projectId,
      smartCreate,
      descriptionEnhancement,
      assignmentSuggestion,
      timeEstimation,
      standupGeneration,
      riskAnalysis,
      semanticSearch,
      similarIssues,
      feedback,
    ]
  );
}
