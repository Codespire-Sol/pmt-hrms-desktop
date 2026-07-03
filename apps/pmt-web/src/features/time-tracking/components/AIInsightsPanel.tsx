import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  AlertTriangle,
  TrendingDown,
  Clock,
  RefreshCw,
  Info,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { useExplainMetricsMutation, useGenerateReportSummaryMutation } from '@/features/ai/aiApi';
import type { TimesheetHistoryResponse, TimesheetSummaryResponse } from '../types';

interface Props {
  summary?: TimesheetSummaryResponse;
  history: TimesheetHistoryResponse;
  startDate: string;
  endDate: string;
  canViewAll: boolean;
  loading: boolean;
}

interface InsightCardData {
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  icon: React.ReactNode;
}

const TYPE_STYLES = {
  info: { bg: 'rgba(18,104,255,0.04)', border: '#1268ff30', accent: '#1268ff', badgeBg: 'rgba(18,104,255,0.08)', badgeColor: '#1268ff' },
  success: { bg: '#ecfdf3', border: '#06905530', accent: '#079455', badgeBg: 'rgba(7,148,85,0.08)', badgeColor: '#079455' },
  warning: { bg: '#fffaeb', border: '#dc680330', accent: '#dc6803', badgeBg: 'rgba(220,104,3,0.08)', badgeColor: '#dc6803' },
  danger: { bg: '#fef3f2', border: '#d92d2030', accent: '#d92d20', badgeBg: 'rgba(217,45,32,0.08)', badgeColor: '#d92d20' },
};

function InsightCard({ title, content, type, icon }: InsightCardData) {
  const styles = TYPE_STYLES[type];
  return (
    <div
      className="rounded-[14px] p-4"
      style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: styles.badgeBg, color: styles.accent }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-800 mb-1">{title}</p>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{content}</p>
        </div>
      </div>
    </div>
  );
}

export function AIInsightsPanel({ summary, history, startDate, endDate, canViewAll, loading }: Props) {
  const [hasGenerated, setHasGenerated] = useState(false);
  const [lastFilterKey, setLastFilterKey] = useState('');
  const [isStale, setIsStale] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const currentFilterKey = `${startDate}|${endDate}|${canViewAll}`;

  useEffect(() => {
    if (hasGenerated && currentFilterKey !== lastFilterKey) {
      setIsStale(true);
    }
  }, [currentFilterKey, hasGenerated, lastFilterKey]);

  const [explainMetrics, { data: metricsData, isLoading: loadingMetrics, reset: resetMetrics }] =
    useExplainMetricsMutation();
  const [generateSummary, { data: summaryData, isLoading: loadingSummary, reset: resetSummary }] =
    useGenerateReportSummaryMutation();

  const isGenerating = loadingMetrics || loadingSummary;

  // Local anomaly detection (pure frontend, no AI call needed)
  const anomalies = useMemo(() => {
    const flags: { label: string; type: 'warning' | 'danger' | 'info' }[] = [];
    if (!history?.dayBuckets) return flags;

    const zeroDays = history.dayBuckets.filter((d) => {
      const dt = new Date(d.date + 'T00:00:00');
      const dow = dt.getDay();
      return dow !== 0 && dow !== 6 && d.hoursWorked === 0;
    });
    if (zeroDays.length >= 2) {
      flags.push({ label: `${zeroDays.length} working day${zeroDays.length > 1 ? 's' : ''} with no time logged`, type: 'warning' });
    }

    const overtimeDays = history.dayBuckets.filter((d) => d.hoursWorked > 10);
    if (overtimeDays.length) {
      flags.push({ label: `${overtimeDays.length} day${overtimeDays.length > 1 ? 's' : ''} with 10+ hours logged`, type: 'warning' });
    }

    const accuracy = Number(summary?.kpis.accuracyPercentVsEstimate ?? 0);
    if (accuracy > 120) {
      flags.push({ label: `Logged ${accuracy.toFixed(0)}% of estimates — significantly over-budget`, type: 'danger' });
    } else if (accuracy > 0 && accuracy < 60) {
      flags.push({ label: `Only ${accuracy.toFixed(0)}% of estimated hours logged — under-reporting?`, type: 'info' });
    }

    return flags;
  }, [history, summary]);

  const handleGenerate = async () => {
    if (!summary) return;
    resetMetrics();
    resetSummary();
    setAiError(null);

    const metricsPayload = {
      metrics: {
        totalWorkedHours: summary.kpis.totalWorkedHours,
        expectedHours: summary.kpis.expectedHours,
        utilizationPercent: summary.kpis.utilizationPercentVsExpected,
        accuracyPercent: summary.kpis.accuracyPercentVsEstimate,
        overtimeVsExpected: summary.variance.vsExpected.overtime,
        undertimeVsExpected: summary.variance.vsExpected.underTime,
        overtimeVsEstimated: summary.variance.vsEstimated?.overtime,
        undertimeVsEstimated: summary.variance.vsEstimated?.underTime,
        byProject: summary.breakdowns?.byProject || [],
        byIssue: summary.breakdowns?.byIssue?.slice(0, 10) || [],
        byDay: summary.breakdowns?.byDay || [],
      },
      context: `Timesheet analysis for period ${startDate} to ${endDate}. ${
        canViewAll ? 'This is a team/admin view showing all users.' : 'This is an individual employee view.'
      } Identify patterns, anomalies, and actionable insights.`,
    };

    const summaryPayload = {
      reportData: metricsPayload.metrics as any,
      audience: canViewAll ? 'manager' : 'employee',
    };

    try {
      await Promise.all([
        explainMetrics(metricsPayload),
        generateSummary(summaryPayload),
      ]);
    } catch (err: any) {
      const msg = err?.data?.error?.message || err?.data?.message || err?.error || err?.message || 'AI analysis failed. Check that the AI service is running.';
      setAiError(msg);
    }
    setHasGenerated(true);
    setLastFilterKey(currentFilterKey);
    setIsStale(false);
  };

  // Normalize AI responses — the AI service may return varying shapes
  // depending on the underlying model. Extract displayable text defensively.
  const normalizedSummary = useMemo(() => {
    if (!summaryData) return null;
    const raw = summaryData as any;

    // Shape A: { summary: string, highlights: string[], recommendations: string[] }
    if (typeof raw.summary === 'string') {
      return {
        summary: raw.summary,
        highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
      };
    }
    // Shape B: { summary: { highlights, concerns, actionItems }, ... } (ReportSummaryResponseType)
    if (raw.summary && typeof raw.summary === 'object') {
      const s = raw.summary;
      const parts: string[] = [];
      if (Array.isArray(s.concerns) && s.concerns.length) parts.push(s.concerns.map((c: string) => `• ${c}`).join('\n'));
      const recs: string[] = Array.isArray(s.actionItems) ? s.actionItems : (Array.isArray(raw.recommendations) ? raw.recommendations : []);
      return {
        summary: parts.join('\n\n') || 'Analysis complete.',
        highlights: Array.isArray(s.highlights) ? s.highlights : [],
        recommendations: recs,
      };
    }
    // Shape C: flat object with various string fields
    const text = raw.text || raw.content || raw.analysis || raw.result || raw.message || '';
    return {
      summary: String(text) || 'Analysis complete.',
      highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
      recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
    };
  }, [summaryData]);

  const normalizedMetrics = useMemo(() => {
    if (!metricsData) return null;
    const raw = metricsData as any;

    // Shape A: { explanation: string, breakdown: string }
    if (typeof raw.explanation === 'string') {
      return { explanation: raw.explanation, breakdown: typeof raw.breakdown === 'string' ? raw.breakdown : '' };
    }
    // Shape B: { explanations: Array<{metric, whatItMeans, context}>, overallHealth, keyTakeaway } (ExplainMetricsResponse)
    if (Array.isArray(raw.explanations)) {
      // Only include explanations that have actual human-readable text (not just the raw key name)
      const valid = raw.explanations.filter((e: any) => e.whatItMeans || e.context);
      const lines = valid.map((e: any) => `• ${e.metric}: ${e.whatItMeans || e.context}`).join('\n');
      const health = raw.overallHealth ? `Overall: ${raw.overallHealth}` : '';
      const takeaway = raw.keyTakeaway ? raw.keyTakeaway : '';
      const parts = [lines, health, takeaway].filter(Boolean);
      return { explanation: parts.join('\n\n').trim(), breakdown: '' };
    }
    // Shape C: generic
    const text = raw.text || raw.content || raw.analysis || raw.result || raw.message || '';
    return { explanation: String(text) || 'Analysis complete.', breakdown: '' };
  }, [metricsData]);

  // Build insight cards from AI responses
  const insightCards = useMemo<InsightCardData[]>(() => {
    const cards: InsightCardData[] = [];

    if (normalizedSummary?.summary) {
      cards.push({
        title: 'Key Findings',
        content: normalizedSummary.summary,
        type: 'info',
        icon: <Info className="h-4 w-4" />,
      });
    }

    if (normalizedSummary?.highlights?.length) {
      cards.push({
        title: 'Highlights',
        content: normalizedSummary.highlights.map((h: string) => `• ${h}`).join('\n'),
        type: 'success',
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
    }

    if (normalizedMetrics?.explanation?.trim()) {
      cards.push({
        title: 'Utilization & Performance Analysis',
        content: normalizedMetrics.explanation,
        type:
          Number(summary?.kpis.utilizationPercentVsExpected ?? 100) >= 90
            ? 'success'
            : Number(summary?.kpis.utilizationPercentVsExpected ?? 100) >= 70
              ? 'warning'
              : 'danger',
        icon: <Zap className="h-4 w-4" />,
      });
    }

    if (normalizedMetrics?.breakdown) {
      cards.push({
        title: 'Project Focus Breakdown',
        content: normalizedMetrics.breakdown,
        type: 'info',
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
    }

    if (normalizedSummary?.recommendations?.length) {
      cards.push({
        title: 'Recommendations',
        content: normalizedSummary.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n'),
        type: 'success',
        icon: <Sparkles className="h-4 w-4" />,
      });
    }

    return cards;
  }, [normalizedMetrics, normalizedSummary, summary]);

  const hasNoData = !summary && !loading;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">AI Time Intelligence</h3>
            <p className="text-xs text-gray-500">AI-powered analysis of your timesheet data</p>
          </div>
        </div>
        <div className="flex-1" />
        {isStale && (
          <Badge variant="outline" className="rounded-lg border-orange-200 text-orange-600 bg-orange-50 text-xs font-semibold">
            Filters changed — refresh insights
          </Badge>
        )}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || hasNoData || loading}
          size="sm"
          className="h-9 rounded-xl font-bold gap-2 shadow-lg shadow-violet-500/20"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #1268ff)', color: '#fff' }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Analysing...' : hasGenerated ? 'Refresh Insights' : 'Generate Insights'}
        </Button>
      </div>

      {hasNoData && (
        <Card className="border-dashed border-gray-200 rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
            <Clock className="h-10 w-10 opacity-40" />
            <p className="font-medium text-sm">No timesheet data to analyse yet</p>
            <p className="text-xs">Log time to generate AI insights</p>
          </CardContent>
        </Card>
      )}

      {/* Anomaly flags — shown immediately, no AI needed */}
      {anomalies.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Detected Patterns</p>
          {anomalies.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
              style={{
                background: a.type === 'danger' ? '#fef3f2' : a.type === 'warning' ? '#fffaeb' : 'rgba(18,104,255,0.04)',
                border: `1px solid ${a.type === 'danger' ? '#fca5a530' : a.type === 'warning' ? '#fbbf2430' : '#1268ff30'}`,
              }}
            >
              {a.type === 'danger' ? (
                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
              ) : a.type === 'warning' ? (
                <TrendingDown className="h-4 w-4 text-amber-600 flex-shrink-0" />
              ) : (
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
              )}
              <p
                className="text-sm font-semibold"
                style={{ color: a.type === 'danger' ? '#b91c1c' : a.type === 'warning' ? '#92400e' : '#1e40af' }}
              >
                {a.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* AI error display */}
      {aiError && !isGenerating && (
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3"
          style={{ background: '#fef3f2', border: '1px solid #fca5a530' }}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">AI Analysis Failed</p>
            <p className="text-xs text-red-600 mt-0.5">{aiError}</p>
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {isGenerating && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-gray-50 p-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* AI Insight Cards */}
      {!isGenerating && insightCards.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI Analysis</p>
          {insightCards.map((card, i) => (
            <InsightCard key={i} {...card} />
          ))}
          <p className="text-xs text-gray-400 text-center pt-1">
            Analysis generated {new Date().toLocaleTimeString()} · Data from {startDate} to {endDate}
          </p>
        </div>
      )}

      {/* Empty prompt */}
      {!isGenerating && !hasGenerated && !hasNoData && anomalies.length === 0 && (
        <Card className="border-dashed border-gray-200 rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-violet-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm text-gray-600">Ready for AI Analysis</p>
              <p className="text-xs mt-1">Click "Generate Insights" to get AI-powered analysis of your timesheet</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AIInsightsPanel;
