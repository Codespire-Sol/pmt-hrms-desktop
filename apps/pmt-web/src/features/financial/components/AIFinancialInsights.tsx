import { useState } from 'react';
import { Button, Card, Skeleton, Alert, Tag } from 'antd';
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { BudgetSummary, CostBreakdown, AIFinancialInsight } from '../types';
import { useGetAIFinancialAnalysisMutation, useGetBudgetForecastMutation } from '../financialApi';

interface Props {
  projectId: string;
  summary: BudgetSummary | undefined;
  costBreakdown: CostBreakdown[];
}

type InsightType = 'info' | 'success' | 'warning' | 'danger';

interface InsightCardProps {
  type: InsightType;
  title: string;
  items: string[];
}

const CARD_CONFIG = {
  info: { color: '#1268ff', bg: '#eff6ff', border: '#1268ff30', Icon: Info },
  success: { color: '#10b981', bg: '#ecfdf5', border: '#10b98130', Icon: CheckCircle },
  warning: { color: '#f59e0b', bg: '#fffbeb', border: '#f59e0b30', Icon: AlertTriangle },
  danger: { color: '#ef4444', bg: '#fef2f2', border: '#ef444430', Icon: AlertTriangle },
};

function InsightCard({ type, title, items }: InsightCardProps) {
  if (!items.length) return null;
  const { color, bg, border, Icon } = CARD_CONFIG[type];
  return (
    <div
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: '14px 16px',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={16} color={color} />
        <span style={{ fontWeight: 700, color, fontSize: 14 }}>{title}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {items.map((item, idx) => (
          <li key={idx} style={{ fontSize: 13, color: '#374151', marginBottom: 4, lineHeight: 1.5 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function normalizeInsight(raw: any): AIFinancialInsight {
  if (!raw) return {};
  if (typeof raw === 'string') return { summary: raw };

  const insight: AIFinancialInsight = {};
  insight.summary = raw.summary ?? raw.text ?? raw.content ?? '';
  insight.highlights = Array.isArray(raw.highlights) ? raw.highlights : [];
  insight.concerns = Array.isArray(raw.concerns) ? raw.concerns : [];
  insight.actionItems = Array.isArray(raw.actionItems) ? raw.actionItems : Array.isArray(raw.action_items) ? raw.action_items : [];
  insight.recommendations = Array.isArray(raw.recommendations) ? raw.recommendations : [];
  insight.riskLevel = raw.riskLevel ?? raw.risk_level;
  insight.projectedOverrunDate = raw.projectedOverrunDate ?? raw.projected_overrun_date ?? null;

  // Merge single explanation field
  if (!insight.highlights?.length && raw.explanation) {
    insight.highlights = [raw.explanation];
  }

  return insight;
}

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
};

export function AIFinancialInsights({ projectId, summary, costBreakdown }: Props) {
  const [insight, setInsight] = useState<AIFinancialInsight | null>(null);
  const [generated, setGenerated] = useState(false);

  const [analyzeFinancials, { isLoading: loadingAnalysis }] = useGetAIFinancialAnalysisMutation();
  const [forecastBudget, { isLoading: loadingForecast }] = useGetBudgetForecastMutation();

  const isLoading = loadingAnalysis || loadingForecast;

  const handleGenerate = async () => {
    if (!summary) return;
    try {
      const metrics = {
        totalBudget: summary.totalBudget,
        totalSpent: summary.totalSpent,
        remaining: summary.remaining,
        percentUsed: summary.percentUsed,
        status: summary.status,
        burnRatePerWeek: summary.burnRatePerWeek,
        projectedTotalCost: summary.projectedTotalCost,
        weeksRemaining: summary.weeksRemaining,
        topResources: costBreakdown.slice(0, 5).map((r) => ({
          name: r.userName,
          role: r.role,
          totalCost: r.totalCost,
          percentOfTotal: r.percentOfTotal,
        })),
      };

      const [analysisResult, forecastResult] = await Promise.all([
        analyzeFinancials({ metrics, context: 'project_financial_health' }).unwrap(),
        forecastBudget({ reportData: metrics, audience: 'manager' }).unwrap(),
      ]);

      const combined = normalizeInsight(analysisResult);
      const forecastNorm = normalizeInsight(forecastResult);

      // Merge forecast into combined
      if (forecastNorm.recommendations?.length) {
        combined.recommendations = [
          ...(combined.recommendations ?? []),
          ...forecastNorm.recommendations,
        ];
      }
      if (forecastNorm.concerns?.length) {
        combined.concerns = [
          ...(combined.concerns ?? []),
          ...forecastNorm.concerns,
        ];
      }
      if (!combined.riskLevel && forecastNorm.riskLevel) {
        combined.riskLevel = forecastNorm.riskLevel;
      }

      setInsight(combined);
      setGenerated(true);
    } catch {
      // AI service unavailable — show a graceful fallback
      setInsight(buildFallbackInsight(summary));
      setGenerated(true);
    }
  };

  return (
    <Card
      style={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
      styles={{ body: { padding: 24 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color="#1268ff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#101828' }}>AI Financial Insights</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Powered by AI — burn rate analysis &amp; recommendations</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {insight?.riskLevel && (
            <Tag
              style={{
                backgroundColor: RISK_COLORS[insight.riskLevel] + '15',
                color: RISK_COLORS[insight.riskLevel],
                border: `1px solid ${RISK_COLORS[insight.riskLevel]}30`,
                borderRadius: 6,
                fontWeight: 700,
                textTransform: 'capitalize',
              }}
            >
              {insight.riskLevel} risk
            </Tag>
          )}
          <Button
            type={generated ? 'default' : 'primary'}
            icon={generated ? <RefreshCw size={15} /> : <Sparkles size={15} />}
            onClick={handleGenerate}
            loading={isLoading}
            disabled={!summary || summary.totalBudget === 0}
            style={{ borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {generated ? 'Refresh Insights' : 'Generate Insights'}
          </Button>
        </div>
      </div>

      {!summary || summary.totalBudget === 0 ? (
        <Alert
          type="warning"
          showIcon
          message="Set a project budget first to enable AI financial analysis."
          style={{ borderRadius: 8 }}
        />
      ) : !generated ? (
        <div
          style={{
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: 14,
          }}
        >
          Click "Generate Insights" to get AI-powered financial analysis and recommendations.
        </div>
      ) : isLoading ? (
        <div>
          <Skeleton active paragraph={{ rows: 3 }} />
          <Skeleton active paragraph={{ rows: 2 }} style={{ marginTop: 12 }} />
        </div>
      ) : (
        <div>
          {insight?.summary && (
            <div style={{ fontSize: 14, color: '#374151', marginBottom: 16, lineHeight: 1.6, padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: 8 }}>
              {insight.summary}
            </div>
          )}
          <InsightCard type="success" title="Highlights" items={insight?.highlights ?? []} />
          <InsightCard type="warning" title="Concerns" items={insight?.concerns ?? []} />
          <InsightCard type="info" title="Recommendations" items={insight?.recommendations ?? []} />
          <InsightCard type="danger" title="Action Items" items={insight?.actionItems ?? []} />
          {insight?.projectedOverrunDate && (
            <Alert
              type="error"
              showIcon
              message={`Projected budget overrun: ${insight.projectedOverrunDate}`}
              style={{ borderRadius: 8, marginTop: 8 }}
            />
          )}
        </div>
      )}
    </Card>
  );
}

function buildFallbackInsight(summary: BudgetSummary): AIFinancialInsight {
  const highlights: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  if (summary.percentUsed < 50) {
    highlights.push(`Budget utilization is healthy at ${summary.percentUsed.toFixed(1)}%.`);
  }
  if (summary.percentUsed >= 80) {
    concerns.push(`${summary.percentUsed.toFixed(1)}% of budget has been consumed.`);
  }
  if (summary.burnRatePerWeek > 0 && summary.weeksRemaining !== null) {
    if (summary.weeksRemaining < 4) {
      concerns.push(`At current burn rate of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: summary.currency, maximumFractionDigits: 0 }).format(summary.burnRatePerWeek)}/week, budget will run out in approximately ${summary.weeksRemaining} weeks.`);
      recommendations.push('Consider reviewing resource allocation or requesting additional budget.');
    } else {
      highlights.push(`Current burn rate is sustainable — approximately ${summary.weeksRemaining} weeks of budget remaining.`);
    }
  }
  if (summary.projectedTotalCost > summary.totalBudget) {
    concerns.push(`Projected total cost (${new Intl.NumberFormat('en-US', { style: 'currency', currency: summary.currency, maximumFractionDigits: 0 }).format(summary.projectedTotalCost)}) exceeds budget.`);
    recommendations.push('Review resource rates and reduce scope or request budget increase.');
  }

  const riskLevel: AIFinancialInsight['riskLevel'] =
    summary.status === 'exceeded' ? 'critical'
    : summary.status === 'critical' ? 'high'
    : summary.status === 'warning' ? 'medium'
    : 'low';

  return {
    summary: `Budget is currently ${summary.status.replace('_', ' ')}. ${summary.totalSpent.toLocaleString()} of ${summary.totalBudget.toLocaleString()} ${summary.currency} spent.`,
    highlights,
    concerns,
    recommendations,
    riskLevel,
  };
}
