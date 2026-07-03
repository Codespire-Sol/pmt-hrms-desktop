import { z } from 'zod';

export const issueSuggestionSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(500),
    description: z.string().max(10000).default(''),
    projectId: z.string().uuid(),
  }),
});

export const similarIssuesSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(500),
    description: z.string().max(10000).default(''),
    projectId: z.string().uuid(),
    limit: z.number().int().min(1).max(20).default(5),
  }),
});

export const parseNaturalLanguageSchema = z.object({
  body: z.object({
    text: z.string().min(10).max(2000),
    projectId: z.string().uuid(),
  }),
});

export const parseBulkIssuesSchema = z.object({
  body: z.object({
    text: z.string().min(10).max(10000),
    projectId: z.string().uuid(),
  }),
});

export const expandNotesSchema = z.object({
  body: z.object({
    notes: z.string().min(5).max(2000),
    context: z.string().max(1000).optional(),
  }),
});

export const improveTextSchema = z.object({
  body: z.object({
    text: z.string().min(10).max(10000),
    style: z.enum(['clearer', 'concise', 'detailed', 'professional', 'technical']).default('clearer'),
  }),
});

export const acceptanceCriteriaSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(500),
    description: z.string().max(10000),
  }),
});

export const summarizeSchema = z.object({
  body: z.object({
    text: z.string().min(50).max(20000),
    maxLength: z.number().int().min(50).max(500).default(200),
  }),
});

export const sprintScopeSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    sprintDurationDays: z.number().int().min(7).max(28).default(14),
    targetPoints: z.number().int().min(1).max(200).optional(),
  }),
});

export const workloadAnalysisSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    sprintId: z.string().uuid().optional(),
  }),
});

export const issueOrderSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    sprintId: z.string().uuid(),
  }),
});

export const completionPredictionSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    sprintId: z.string().uuid(),
  }),
});

export const standupSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    sprintId: z.string().uuid(),
    userId: z.string().uuid().optional(),
  }),
});

export const sprintRisksSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    sprintId: z.string().uuid(),
  }),
});

export const reassignmentsSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    sprintId: z.string().uuid(),
  }),
});

// Predictive Analytics Schemas

export const projectRisksSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
  }),
});

export const issueCompletionSchema = z.object({
  body: z.object({
    issueId: z.string().uuid(),
    projectId: z.string().uuid(),
  }),
});

export const atRiskIssuesSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    sprintId: z.string().uuid().optional(),
  }),
});

export const velocityTrendsSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
  }),
});

export const workflowBottlenecksSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    sprintId: z.string().uuid().optional(),
  }),
});

export const riskAlertsSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
  }),
});

// Feedback Schemas

export const recordFeedbackSchema = z.object({
  body: z.object({
    suggestionType: z.string().min(1).max(100),
    suggestionId: z.string().min(1).max(100),
    accepted: z.boolean(),
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(500).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const acceptanceRateSchema = z.object({
  body: z.object({
    suggestionType: z.string().min(1).max(100),
    days: z.number().int().min(1).max(365).default(30),
  }),
});

// Analytics Schemas

export const analyticsUsageSchema = z.object({
  body: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    projectId: z.string().uuid().optional(),
  }),
});

export const analyticsCostSchema = z.object({
  body: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    projectId: z.string().uuid().optional(),
  }),
});

// Config Schemas

export const updateProjectConfigSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    enabled: z.boolean().optional(),
    features: z.object({
      suggestions: z.boolean().optional(),
      nlpParsing: z.boolean().optional(),
      writingAssist: z.boolean().optional(),
      planning: z.boolean().optional(),
      predictions: z.boolean().optional(),
      similarIssues: z.boolean().optional(),
      standupGeneration: z.boolean().optional(),
    }).optional(),
    limits: z.object({
      requestsPerUserPerDay: z.number().int().min(1).max(10000).optional(),
      requestsPerProjectPerDay: z.number().int().min(1).max(100000).optional(),
      maxInputTokens: z.number().int().min(100).max(100000).optional(),
      maxOutputTokens: z.number().int().min(100).max(100000).optional(),
    }).optional(),
  }),
});

export const checkRateLimitSchema = z.object({
  body: z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
  }),
});

// Meeting Notes Schemas

export const parseMeetingNotesSchema = z.object({
  body: z.object({
    notes: z.string().min(20).max(50000),
    projectId: z.string().uuid(),
    meetingType: z.enum(['standup', 'planning', 'retro', 'review', 'general']).optional(),
    attendees: z.array(z.string()).default([]),
  }),
});

export const parseTranscriptSchema = z.object({
  body: z.object({
    transcript: z.string().min(20).max(50000),
    projectId: z.string().uuid(),
    speakerNames: z.array(z.string()).optional(),
  }),
});

// ============================================
// GENERIC PROXY BODY GUARD
// ============================================
// Applied to all AI proxy endpoints that forward req.body wholesale
// to the downstream AI microservice. Enforces:
//   - Body is a plain object (not array, string, null)
//   - No prototype-pollution keys
//   - Max 50 top-level keys (prevents payload bombs)
//   - Serialized size ≤ 100 KB

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_PROXY_BODY_KEYS = 50;
const MAX_PROXY_BODY_BYTES = 100_000; // 100 KB

export const aiProxyBodySchema = z.object({
  body: z.record(z.unknown()).refine(
    (obj) => {
      const keys = Object.keys(obj);
      if (keys.length > MAX_PROXY_BODY_KEYS) return false;
      if (keys.some((k) => FORBIDDEN_KEYS.has(k))) return false;
      try {
        if (JSON.stringify(obj).length > MAX_PROXY_BODY_BYTES) return false;
      } catch {
        return false;
      }
      return true;
    },
    {
      message: `Body must be a plain object with ≤${MAX_PROXY_BODY_KEYS} keys, ≤100KB serialized, and no prototype-pollution keys`,
    }
  ),
});
