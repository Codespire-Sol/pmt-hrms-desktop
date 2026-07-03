import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, Lightbulb, X } from 'lucide-react';
import { useGenerateReportSummaryMutation } from '@/features/ai/aiApi';
import type { AdminDashboardData, ManagerDashboardData } from '../types';

interface DashboardAISummaryProps {
  role: 'admin' | 'manager';
  dashboardData: AdminDashboardData | ManagerDashboardData;
}

const C = {
  primary:   '#1268ff',
  primaryBg: 'rgba(18,104,255,0.07)',
  success:   '#10b981',
  successBg: 'rgba(16,185,129,0.07)',
  text:      '#101828',
  textSub:   '#4a5565',
  textMuted: '#6a7282',
  border:    '#e5e7eb',
  bg:        '#f9fafb',
  card:      '#ffffff',
  shadow:    '0 4px 16px rgba(16,24,40,0.06)',
};

function buildAdminContext(data: AdminDashboardData): Record<string, unknown> {
  return {
    role: 'admin',
    audience: 'executive',
    stats: data.stats,
    projectHealth: data.projectsOverview.map(p => ({
      name: p.name,
      health: p.healthStatus,
      completion: p.completionPercentage,
      openIssues: p.openIssues,
      overdueIssues: p.overdueIssues,
      activeSprint: p.activeSprint,
      sprintDaysRemaining: p.sprintDaysRemaining,
    })),
    overdueByProject: data.overdueByProject,
    topContributors: data.userActivity.slice(0, 5).map(u => ({
      name: u.displayName,
      issuesCompleted: u.issuesCompleted,
      timeLoggedMinutes: u.timeLoggedMinutes,
    })),
    throughputTrend: data.orgThroughput.slice(-4),
    recentSystemEventCount: data.recentSystemEvents.length,
    instruction:
      'Provide an executive-level summary covering: overall portfolio health, project delivery risks, ' +
      'team performance highlights, top blockers, and 3 prioritized recommendations for the leadership team.',
  };
}

function buildManagerContext(data: ManagerDashboardData): Record<string, unknown> {
  return {
    role: 'manager',
    audience: 'team-lead',
    stats: data.stats,
    sprintHealth: data.sprintHealth.map(s => ({
      name: s.sprintName,
      project: s.projectName,
      status: s.healthStatus,
      completion: s.completionPercentage,
      daysRemaining: s.daysRemaining,
      blocked: s.blockedIssues,
    })),
    teamWorkload: data.teamWorkload.map(m => ({
      name: m.displayName,
      capacity: m.capacityStatus,
      assigned: m.assignedCount,
      inProgress: m.inProgressCount,
      completed: m.completedCount,
      overdue: m.overdueCount,
      loggedMinutesThisWeek: m.loggedMinutesThisWeek,
    })),
    riskIssues: data.riskIssues.slice(0, 10).map(r => ({
      key: r.issueKey,
      riskType: r.riskType,
      daysOverdue: r.daysOverdue,
      blockedByCount: r.blockedByCount,
    })),
    velocityTrend: data.velocityData.slice(-3),
    instruction:
      'Provide a team-lead-level summary covering: sprint progress and health, team capacity and workload balance, ' +
      'top at-risk issues, velocity trend, and 3 prioritized actions the manager should take this week.',
  };
}

export function DashboardAISummary({ role, dashboardData }: DashboardAISummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<{
    summary: string;
    highlights: string[];
    recommendations: string[];
    generatedAt: string;
  } | null>(null);

  const [generate, { isLoading }] = useGenerateReportSummaryMutation();

  const title = role === 'admin' ? 'AI Portfolio Summary' : 'AI Team Summary';
  const subtitle =
    role === 'admin'
      ? 'Organisation-wide analysis from projects to delivery'
      : 'Team performance, workload balance and sprint health';

  const handleGenerate = async () => {
    const context =
      role === 'admin'
        ? buildAdminContext(dashboardData as AdminDashboardData)
        : buildManagerContext(dashboardData as ManagerDashboardData);

    try {
      const raw = await generate({ reportData: context as any, audience: role === 'admin' ? 'executive' : 'manager' }).unwrap();
      const r = raw as any;

      // Normalise shape — the API may return different structures depending on the underlying model
      let summary = '';
      let highlights: string[] = [];
      let recommendations: string[] = [];

      if (typeof r.summary === 'string') {
        summary = r.summary;
      } else if (r.summary && typeof r.summary === 'object') {
        const parts: string[] = [];
        if (Array.isArray(r.summary.highlights)) parts.push(...r.summary.highlights.map((h: string) => h));
        summary = parts.join(' ') || 'Analysis complete.';
      }

      highlights = Array.isArray(r.highlights) ? r.highlights : [];
      recommendations = Array.isArray(r.recommendations) ? r.recommendations : [];

      setResult({
        summary: summary || 'Summary generated.',
        highlights,
        recommendations,
        generatedAt: r.generatedAt || new Date().toISOString(),
      });
      setExpanded(true);
    } catch {
      // Error is surfaced via the loading state ending without result; user can retry
    }
  };

  const handleClose = () => {
    setExpanded(false);
  };

  return (
    <div
      style={{
        borderRadius: '14px',
        border: `1.5px solid ${expanded ? C.primary + '40' : C.border}`,
        background: expanded ? `linear-gradient(135deg, rgba(18,104,255,0.03), rgba(16,185,129,0.02))` : C.card,
        boxShadow: expanded ? '0 8px 32px rgba(18,104,255,0.10)' : C.shadow,
        overflow: 'hidden',
        transition: 'all 0.25s ease',
        fontFamily: "'Inter', sans-serif",
        marginBottom: 0,
      }}
    >
      {/* ── Compact header (always visible) ─────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '14px 20px',
          cursor: result ? 'pointer' : 'default',
        }}
        onClick={() => result && setExpanded(e => !e)}
      >
        {/* Icon */}
        <div
          style={{
            width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, #7c3aed22, #1268ff22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Sparkles size={18} color={C.primary} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: C.text }}>{title}</span>
            {result && (
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                background: C.successBg, color: C.success, border: `1px solid ${C.success}30`,
              }}>
                Ready
              </span>
            )}
          </div>
          <span style={{ fontSize: '12px', color: C.textMuted }}>{subtitle}</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
            disabled={isLoading}
            style={{
              height: '34px', padding: '0 14px', borderRadius: '9px', border: 'none',
              background: isLoading ? C.primaryBg : 'linear-gradient(135deg, #7c3aed, #1268ff)',
              color: isLoading ? C.primary : '#fff',
              fontWeight: 700, fontSize: '12px', cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.18s', fontFamily: "'Inter', sans-serif",
              boxShadow: isLoading ? 'none' : '0 4px 12px rgba(18,104,255,0.30)',
            }}
          >
            <RefreshCw size={12} style={isLoading ? { animation: 'aiSummarySpin 1s linear infinite' } : {}} />
            {isLoading ? 'Analysing…' : result ? 'Regenerate' : 'Generate'}
          </button>
          {result && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(ex => !ex); }}
                style={{
                  width: 30, height: 30, borderRadius: '8px', border: `1px solid ${C.border}`,
                  background: C.bg, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {expanded ? <ChevronUp size={14} color={C.textMuted} /> : <ChevronDown size={14} color={C.textMuted} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleClose(); setResult(null); }}
                style={{
                  width: 30, height: 30, borderRadius: '8px', border: `1px solid ${C.border}`,
                  background: C.bg, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={13} color={C.textMuted} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[100, 85, 70].map((w, i) => (
            <div
              key={i}
              style={{
                height: i === 0 ? 14 : 12, borderRadius: '6px',
                width: `${w}%`, background: C.border,
                animation: 'aiSummaryPulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Expanded result ─────────────────────────────────────────────── */}
      {!isLoading && expanded && result && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Divider */}
          <div style={{ height: '1px', background: C.border }} />

          {/* Summary paragraph */}
          {result.summary && (
            <div
              style={{
                padding: '14px 16px', borderRadius: '10px',
                background: C.primaryBg, border: `1px solid ${C.primary}20`,
              }}
            >
              <p style={{ fontSize: '13px', lineHeight: 1.65, color: C.textSub, margin: 0 }}>{result.summary}</p>
            </div>
          )}

          {/* Highlights */}
          {result.highlights.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Key Highlights
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {result.highlights.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <CheckCircle2 size={14} color={C.success} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.5 }}>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Recommendations
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {result.recommendations.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <Lightbulb size={14} color={C.primary} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '13px', color: C.textSub, lineHeight: 1.5 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <p style={{ fontSize: '11px', color: C.textMuted, margin: 0, textAlign: 'right' }}>
            Generated {new Date(result.generatedAt).toLocaleTimeString()} · Powered by OpenAI GPT-4
          </p>
        </div>
      )}

      <style>{`
        @keyframes aiSummarySpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes aiSummaryPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
