import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, Calendar, Zap, ArrowUpRight,
  TrendingUp, Activity, Timer, RefreshCw,
  Layers, BookOpen, ChevronRight, Flame, Star,
} from 'lucide-react';
import { KpiCard, KpiCardProps } from './shared/KpiCard';
import { Row, Col, Card, Typography, Skeleton, Alert, Button, Avatar, Tooltip, Tag, Divider } from 'antd';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RcTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useGetEmployeeDashboardQuery, useGetDashboardPreferencesQuery } from '../dashboardApi';
import { USER_DASHBOARD_WIDGETS } from './DashboardCustomizer';
import type { WidgetType } from '../types';
import {
  EmployeeStats, MyIssue, SprintContextItem, PerformancePoint,
  UpcomingDeadline, SystemEvent,
} from '../types';
import { format, formatDistanceToNow } from 'date-fns';

const C = {
  primary:   '#1268ff', primaryBg: 'rgba(18,104,255,0.08)',
  success:   '#10b981', successBg: 'rgba(16,185,129,0.08)',
  warning:   '#f59e0b', warningBg: 'rgba(245,158,11,0.08)',
  danger:    '#ef4444', dangerBg:  'rgba(239,68,68,0.08)',
  purple:    '#8b5cf6', purpleBg:  'rgba(139,92,246,0.08)',
  orange:    '#f97316', orangeBg:  'rgba(249,115,22,0.08)',
  teal:      '#06b6d4', tealBg:    'rgba(6,182,212,0.08)',
  text:      '#0f172a', textSub:   '#334155', textMuted: '#64748b',
  border:    '#e2e8f0', bg:        '#f8fafc', card:      '#ffffff',
  shadow:    '0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)',
  shadowHover: '0 8px 24px rgba(15,23,42,0.10)',
};

const CARD_STYLE: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 20,
  boxShadow: '0 0 0 1px rgba(15,23,42,0.04), 0 2px 8px rgba(15,23,42,0.04), 0 8px 32px rgba(15,23,42,0.06)',
  overflow: 'hidden',
  background: '#ffffff',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ${min % 60 ? `${min % 60}m` : ''}`.trim() : `${Math.floor(h / 24)}d`;
}

function dueBadge(daysUntilDue: number | null, isOverdue: boolean) {
  if (isOverdue) return { label: `${Math.abs(daysUntilDue ?? 0)}d overdue`, color: C.danger, bg: C.dangerBg };
  if (daysUntilDue === null) return null;
  if (daysUntilDue === 0) return { label: 'Due today', color: C.orange, bg: C.orangeBg };
  if (daysUntilDue === 1) return { label: 'Due tomorrow', color: C.warning, bg: C.warningBg };
  if (daysUntilDue <= 3) return { label: `${daysUntilDue}d left`, color: C.warning, bg: C.warningBg };
  return { label: `${daysUntilDue}d left`, color: C.textMuted, bg: C.bg };
}

const CUSTOM_TOOLTIP = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px',
  boxShadow: C.shadow, padding: '10px 14px', fontSize: '13px',
};

const ACTION_LABELS: Record<string, string> = {
  status_changed: 'changed status', comment_added: 'commented on',
  issue_created: 'created', issue_updated: 'updated',
};

const ACTION_COLORS: Record<string, { color: string; bg: string }> = {
  status_changed:  { color: C.primary, bg: C.primaryBg },
  comment_added:   { color: C.teal,    bg: C.tealBg },
  issue_created:   { color: C.success, bg: C.successBg },
  issue_updated:   { color: C.purple,  bg: C.purpleBg },
};

const STATUS_CATEGORY_COLOR: Record<string, string> = {
  todo:        '#6b7280',
  in_progress: C.primary,
  done:        C.success,
};

// ─── Widget Header ────────────────────────────────────────────────────────────

function WidgetHeader({ icon, iconGrad, title, subtitle, badge, action }: {
  icon: React.ReactNode; iconGrad: string;
  title: string; subtitle?: string; badge?: number | string; action?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: iconGrad,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{title}</div>
          {subtitle && <div style={{ fontSize: '11.5px', color: C.textMuted, marginTop: 1 }}>{subtitle}</div>}
        </div>
        {badge !== undefined && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, background: C.bg, padding: '2px 9px', borderRadius: '10px', border: `1px solid ${C.border}` }}>
            {badge}
          </span>
        )}
      </div>
      {action && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{action}</div>}
    </div>
  );
}

// ─── Widgets ─────────────────────────────────────────────────────────────────

function MyStatsRow({ stats }: { stats: EmployeeStats }) {
  const cards: KpiCardProps[] = [
    { icon: <Layers size={20} color={C.primary} />,       label: 'Assigned',        value: stats.totalAssigned,      accent: C.primary,  accentBg: C.primaryBg, delay: 0 },
    { icon: <Zap size={20} color={C.warning} />,          label: 'In Progress',     value: stats.inProgress,         accent: C.warning,  accentBg: C.warningBg, delay: 0.05 },
    { icon: <AlertTriangle size={20} color={C.danger} />, label: 'Overdue',         value: stats.overdueCount,       accent: C.danger,   accentBg: C.dangerBg,  delay: 0.1 },
    { icon: <Calendar size={20} color={C.orange} />,      label: 'Due Today',       value: stats.dueTodayCount,      accent: C.orange,   accentBg: C.orangeBg,  delay: 0.15 },
    { icon: <CheckCircle2 size={20} color={C.success} />, label: 'Done This Week',  value: stats.completedThisWeek,  accent: C.success,  accentBg: C.successBg, delay: 0.2 },
  ];
  return (
    <>
      <style>{`
        .emp-kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }
        @media (max-width: 1200px) {
          .emp-kpi-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 768px) {
          .emp-kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .emp-kpi-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      <div className="emp-kpi-grid">
        {cards.map(c => (
          <div key={c.label}>
            <KpiCard {...c} />
          </div>
        ))}
      </div>
    </>
  );
}

function MyIssuesWidget({ issues }: { issues: MyIssue[] }) {
  const sorted = [...issues].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999);
  });

  const overdueCount  = sorted.filter(i => i.isOverdue).length;
  const dueSoonCount  = sorted.filter(i => !i.isOverdue && (i.daysUntilDue ?? 999) <= 3).length;

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
      <Card
        title={
          <WidgetHeader
            icon={<BookOpen size={16} color="#fff" />}
            iconGrad="linear-gradient(135deg, #1268ff 0%, #8b5cf6 100%)"
            title="My Issues"
            subtitle="Assigned to you · sorted by urgency"
            badge={issues.length}
            action={
              overdueCount > 0 && (
                <Tag color="error" style={{ borderRadius: '8px', fontWeight: 700, fontSize: '11px' }}>
                  {overdueCount} overdue
                </Tag>
              )
            }
          />
        }
        styles={{ body: { padding: '0 0 4px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        {/* Urgency summary bar */}
        {(overdueCount > 0 || dueSoonCount > 0) && (
          <div style={{ display: 'flex', gap: '8px', padding: '10px 20px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            {overdueCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: C.danger, background: C.dangerBg, padding: '3px 9px', borderRadius: '8px' }}>
                <Flame size={11} /> {overdueCount} overdue
              </span>
            )}
            {dueSoonCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: C.warning, background: C.warningBg, padding: '3px 9px', borderRadius: '8px' }}>
                <AlertTriangle size={11} /> {dueSoonCount} due soon
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sorted.slice(0, 10).map((iss, i) => {
            const badge = dueBadge(iss.daysUntilDue, iss.isOverdue);
            const catColor = STATUS_CATEGORY_COLOR[iss.statusCategory] ?? C.textMuted;
            const isUrgent = iss.isOverdue || (iss.daysUntilDue !== null && iss.daysUntilDue <= 1);
            return (
              <motion.div
                key={iss.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.12 + i * 0.04 }}
                style={{
                  padding: '12px 20px',
                  borderBottom: i < sorted.slice(0, 10).length - 1 ? `1px solid ${C.border}` : 'none',
                  cursor: 'pointer',
                  borderLeft: isUrgent ? `3px solid ${iss.isOverdue ? C.danger : C.warning}` : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  {/* Status indicator */}
                  <div style={{
                    marginTop: '4px', width: 8, height: 8, borderRadius: '50%',
                    background: catColor, flexShrink: 0,
                    boxShadow: `0 0 0 2px ${catColor}28`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', background: C.primaryBg, color: C.primary, padding: '1px 7px', borderRadius: '5px', fontWeight: 700, letterSpacing: '0.01em' }}>{iss.issueKey}</span>
                      <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '5px', fontWeight: 600, color: catColor, background: `${catColor}18` }}>{iss.status}</span>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: iss.priorityColor, display: 'inline-block', flexShrink: 0 }} />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iss.title}</div>
                    <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '3px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{iss.projectName}</span>
                      {iss.sprintName && <><span style={{ color: C.border }}>·</span><span>{iss.sprintName}</span></>}
                      {iss.epicName && <><span style={{ color: C.border }}>·</span><span style={{ color: C.purple, fontWeight: 600 }}>{iss.epicName}</span></>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    {badge && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '8px', color: badge.color, background: badge.bg, whiteSpace: 'nowrap' }}>
                        {badge.label}
                      </span>
                    )}
                    {iss.storyPoints !== null && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: C.textMuted }}>{iss.storyPoints} pts</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {issues.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <CheckCircle2 size={36} color={C.success} strokeWidth={1.5} />
              <div style={{ marginTop: '10px', fontSize: '14px', fontWeight: 600, color: C.text }}>All caught up!</div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: C.textMuted }}>No issues assigned to you right now.</div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function UpcomingDeadlinesWidget({ deadlines }: { deadlines: UpcomingDeadline[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}>
      <Card
        title={
          <WidgetHeader
            icon={<AlertTriangle size={16} color="#fff" />}
            iconGrad="linear-gradient(135deg, #ef4444 0%, #f97316 100%)"
            title="Upcoming Deadlines"
            subtitle="Issues due soon"
            badge={deadlines.length}
          />
        }
        styles={{ body: { padding: '0 0 4px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        {deadlines.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <CheckCircle2 size={36} color={C.success} strokeWidth={1.5} />
            <div style={{ marginTop: '10px', fontSize: '14px', fontWeight: 600, color: C.text }}>No upcoming deadlines</div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: C.textMuted }}>You're on track — great work!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {deadlines.map((d, i) => {
              const isToday    = d.daysUntilDue === 0;
              const isTomorrow = d.daysUntilDue === 1;
              const isNear     = isToday || isTomorrow;

              let label: string; let accent: string; let accentBg: string; let borderColor: string;
              if (isToday)       { label = 'Today';    accent = C.danger;   accentBg = C.dangerBg;  borderColor = C.danger; }
              else if (isTomorrow){ label = 'Tomorrow'; accent = C.orange;   accentBg = C.orangeBg;  borderColor = C.orange; }
              else               { label = `${d.daysUntilDue}d`;  accent = C.textMuted; accentBg = C.bg; borderColor = C.border; }

              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 + i * 0.06 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 20px',
                    borderBottom: i < deadlines.length - 1 ? `1px solid ${C.border}` : 'none',
                    cursor: 'pointer',
                    borderLeft: isNear ? `3px solid ${borderColor}` : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Countdown badge */}
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    border: `2.5px solid ${borderColor}`,
                    background: accentBg,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                  }}>
                    {isNear && (
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                        style={{
                          position: 'absolute', inset: -4, borderRadius: '50%',
                          border: `1.5px solid ${borderColor}`,
                          opacity: 0.35,
                        }}
                      />
                    )}
                    <span style={{ fontSize: isToday || isTomorrow ? '10px' : '13px', fontWeight: 800, color: accent, lineHeight: 1 }}>{label}</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', background: C.primaryBg, color: C.primary, padding: '1px 7px', borderRadius: '5px', fontWeight: 700 }}>{d.issueKey}</span>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: d.statusColor, display: 'inline-block' }} />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                    <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{d.projectName}</span>
                      <span style={{ color: C.border }}>·</span>
                      <span style={{ color: isNear ? accent : C.textMuted, fontWeight: isNear ? 600 : 400 }}>
                        {format(new Date(d.dueDate), 'MMM d')}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function SprintContextWidget({ sprints }: { sprints: SprintContextItem[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
      <Card
        title={
          <WidgetHeader
            icon={<Zap size={16} color="#fff" />}
            iconGrad="linear-gradient(135deg, #8b5cf6 0%, #1268ff 100%)"
            title="My Sprints"
            subtitle="Active sprint progress"
            badge={sprints.length}
          />
        }
        styles={{ body: { padding: '16px 20px 20px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
          {sprints.map((s, i) => {
            const myRate = s.myIssuesInSprint > 0 ? Math.round((s.myCompletedInSprint / s.myIssuesInSprint) * 100) : 0;
            // Normalise: backend may send 0‑1 fraction or 0‑100 integer
            const overallPct = s.completionPercentage > 1
              ? Math.round(s.completionPercentage)
              : Math.round(s.completionPercentage * 100);
            const isAtRisk = s.daysRemaining <= 3 && overallPct < 70;
            const healthColor = isAtRisk ? C.danger : overallPct >= 80 ? C.success : C.warning;
            const healthLabel = isAtRisk ? 'At Risk' : overallPct >= 80 ? 'On Track' : 'In Progress';

            return (
              <motion.div
                key={s.sprintId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.22 + i * 0.08 }}
                style={{
                  padding: '16px',
                  background: C.bg,
                  borderRadius: '10px',
                  border: `1px solid ${C.border}`,
                }}
              >
                {/* Sprint header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{s.sprintName}</div>
                    <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{s.projectName}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', color: healthColor, background: `${healthColor}18` }}>
                      {healthLabel}
                    </span>
                    <span style={{ fontSize: '11px', color: C.textMuted }}>{s.daysRemaining}d left</span>
                  </div>
                </div>

                {/* Stats pills */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '8px', background: C.primaryBg, color: C.primary }}>
                    {overallPct}% done
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '8px', background: C.purpleBg, color: C.purple }}>
                    {s.myCompletedInSprint}/{s.myIssuesInSprint} my tasks
                  </span>
                </div>

                {/* Sprint progress */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.textMuted, marginBottom: '5px' }}>
                    <span>Sprint Progress</span>
                    <span style={{ fontWeight: 600, color: C.textSub }}>{overallPct}%</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: C.border, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${overallPct}%` }}
                      transition={{ duration: 0.9, delay: 0.3 + i * 0.08 }}
                      style={{ height: '100%', borderRadius: '4px', background: `linear-gradient(90deg, ${C.primary} 0%, #60a5fa 100%)` }}
                    />
                  </div>
                </div>

                {/* My contribution */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.textMuted, marginBottom: '5px' }}>
                    <span>My Contribution</span>
                    <span style={{ fontWeight: 600, color: C.textSub }}>{myRate}%</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: C.border, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${myRate}%` }}
                      transition={{ duration: 0.9, delay: 0.4 + i * 0.08 }}
                      style={{ height: '100%', borderRadius: '3px', background: `linear-gradient(90deg, ${C.purple} 0%, #a78bfa 100%)` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
          {sprints.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <Zap size={32} color={C.border} strokeWidth={1.5} />
              <div style={{ marginTop: '10px', fontSize: '14px', fontWeight: 600, color: C.text }}>No active sprints</div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: C.textMuted }}>You're not in any active sprints.</div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function MyTimeWidget({ stats }: { stats: EmployeeStats }) {
  const todayTarget = 8 * 60;
  const weekTarget  = 40 * 60;
  const todayPct    = Math.min(100, Math.round((stats.timeLoggedTodayMinutes / todayTarget) * 100));
  const weekPct     = Math.min(100, Math.round((stats.timeLoggedThisWeekMinutes / weekTarget) * 100));
  const ringColor   = todayPct >= 100 ? C.success : todayPct >= 60 ? C.primary : C.orange;

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }}>
      <Card
        title={
          <WidgetHeader
            icon={<Timer size={16} color="#fff" />}
            iconGrad="linear-gradient(135deg, #f97316 0%, #f59e0b 100%)"
            title="My Time"
            subtitle="Daily & weekly tracking"
          />
        }
        styles={{ body: { padding: '20px 24px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        {/* Today ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ position: 'relative', width: '110px', height: '110px' }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke={C.border} strokeWidth="10" />
              <motion.circle
                cx="55" cy="55" r="46" fill="none"
                stroke={ringColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 46}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 46 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 46 * (1 - todayPct / 100) }}
                transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
                style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: C.text }}>{todayPct}%</span>
              <span style={{ fontSize: '10px', color: C.textMuted, fontWeight: 500 }}>today</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, color: C.text }}>{fmtMin(stats.timeLoggedTodayMinutes)}</div>
            <div style={{ fontSize: '11px', color: C.textMuted }}>of 8h daily target</div>
          </div>
        </div>

        <Divider style={{ margin: '0 0 16px' }} />

        {/* Week bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: C.textSub, marginBottom: '8px' }}>
            <span>This Week</span>
            <span style={{ color: C.text }}>{fmtMin(stats.timeLoggedThisWeekMinutes)} / 40h</span>
          </div>
          <div style={{ height: '10px', borderRadius: '5px', background: C.border, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weekPct}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              style={{ height: '100%', borderRadius: '5px', background: weekPct >= 100 ? `linear-gradient(90deg, ${C.success} 0%, #34d399 100%)` : `linear-gradient(90deg, ${C.primary} 0%, #60a5fa 100%)` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.textMuted, marginTop: '5px' }}>
            <span>{weekPct}% of weekly goal</span>
            <span>{fmtMin(Math.max(0, weekTarget - stats.timeLoggedThisWeekMinutes))} remaining</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function MyPerformanceWidget({ data, stats }: { data: PerformancePoint[]; stats: EmployeeStats }) {
  const chartData = data.map(p => ({
    week: format(new Date(p.week), 'MMM d'),
    completed: p.completed,
    hours: parseFloat((p.timeLoggedMinutes / 60).toFixed(1)),
  }));

  const totalCompleted = data.reduce((sum, p) => sum + p.completed, 0);
  const totalHours     = parseFloat((data.reduce((sum, p) => sum + p.timeLoggedMinutes, 0) / 60).toFixed(1));

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.28 }}>
      <Card
        title={
          <WidgetHeader
            icon={<TrendingUp size={16} color="#fff" />}
            iconGrad="linear-gradient(135deg, #06b6d4 0%, #10b981 100%)"
            title="My Performance"
            subtitle="Last 6 weeks"
          />
        }
        styles={{ body: { padding: '0 24px 24px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        {/* Summary row */}
        <div style={{ display: 'flex', gap: '12px', padding: '16px 0', borderBottom: `1px solid ${C.border}`, marginBottom: '20px' }}>
          <div style={{ flex: 1, padding: '12px 14px', background: C.primaryBg, borderRadius: '12px', textAlign: 'center', border: `1px solid rgba(18,104,255,0.15)` }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: C.primary, lineHeight: 1 }}>{totalCompleted}</div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed</div>
          </div>
          <div style={{ flex: 1, padding: '12px 14px', background: C.tealBg, borderRadius: '12px', textAlign: 'center', border: `1px solid rgba(6,182,212,0.15)` }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: C.teal, lineHeight: 1 }}>{totalHours}h</div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hours Logged</div>
          </div>
          <div style={{ flex: 1, padding: '12px 14px', background: C.successBg, borderRadius: '12px', textAlign: 'center', border: `1px solid rgba(16,185,129,0.15)` }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: C.success, lineHeight: 1 }}>{stats.completedThisWeek}</div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>This Week</div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.primary} stopOpacity={0.18} />
                <stop offset="95%" stopColor={C.primary} stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.teal} stopOpacity={0.18} />
                <stop offset="95%" stopColor={C.teal} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: C.textMuted }} unit="h" axisLine={false} tickLine={false} />
            <RcTooltip
              contentStyle={CUSTOM_TOOLTIP}
              formatter={(v: number, name: string) => [name === 'hours' ? `${v}h` : v, name === 'hours' ? 'Hours' : 'Completed']}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} formatter={v => v === 'hours' ? 'Hours logged' : 'Issues completed'} />
            <Area yAxisId="left"  type="monotone" dataKey="completed" stroke={C.primary} strokeWidth={2.5} fill="url(#completedGrad)" dot={{ r: 3.5, fill: C.primary, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Area yAxisId="right" type="monotone" dataKey="hours"     stroke={C.teal}    strokeWidth={2.5} fill="url(#hoursGrad)"    dot={{ r: 3.5, fill: C.teal,    strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </motion.div>
  );
}

function TeamContextWidget({ events }: { events: SystemEvent[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
      <Card
        title={
          <WidgetHeader
            icon={<Activity size={16} color="#fff" />}
            iconGrad="linear-gradient(135deg, #10b981 0%, #06b6d4 100%)"
            title="Recent Activity"
            subtitle="Team activity feed"
          />
        }
        styles={{ body: { padding: '0 0 4px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        {events.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <Activity size={32} color={C.border} strokeWidth={1.5} />
            <div style={{ marginTop: '10px', fontSize: '13px', color: C.textMuted }}>No recent activity</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.slice(0, 10).map((e, i) => {
              const actionStyle = ACTION_COLORS[e.action] ?? { color: C.textMuted, bg: C.bg };
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.32 + i * 0.04 }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    padding: '11px 20px',
                    borderBottom: i < events.slice(0, 10).length - 1 ? `1px solid ${C.border}` : 'none',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = C.bg)}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                >
                  <Avatar
                    src={e.actorAvatarUrl ?? undefined}
                    size={28}
                    style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.purple})`, fontSize: '10px', fontWeight: 700, flexShrink: 0 }}
                  >
                    {!e.actorAvatarUrl && e.actorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: C.text, lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700 }}>{e.actorName.split(' ')[0]}</span>
                      {' '}<span style={{ color: actionStyle.color, fontWeight: 600, fontSize: '11px', background: actionStyle.bg, padding: '1px 6px', borderRadius: '4px' }}>
                        {ACTION_LABELS[e.action] ?? e.action}
                      </span>
                      {' '}<span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '130px', verticalAlign: 'bottom' }}>{e.entityTitle}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {e.issueKey && (
                        <span style={{ fontSize: '10px', background: C.primaryBg, color: C.primary, padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>{e.issueKey}</span>
                      )}
                      {e.metadata?.from && e.metadata?.to && (
                        <span style={{ fontSize: '10px', color: C.textMuted, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ background: C.bg, padding: '0 4px', borderRadius: '3px', border: `1px solid ${C.border}` }}>{e.metadata.from}</span>
                          <ChevronRight size={9} color={C.textMuted} />
                          <span style={{ background: C.bg, padding: '0 4px', borderRadius: '3px', border: `1px solid ${C.border}` }}>{e.metadata.to}</span>
                        </span>
                      )}
                      <span style={{ fontSize: '10px', color: C.textMuted }}>{formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function WidgetRenderer({ widgetId, data }: { widgetId: WidgetType; data: any }) {
  switch (widgetId) {
    case 'stats':
      return <MyStatsRow stats={data.stats} />;
    case 'assigned_issues':
      return (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={14}><MyIssuesWidget issues={data.myIssues} /></Col>
          <Col xs={24} lg={10}><UpcomingDeadlinesWidget deadlines={data.upcomingDeadlines} /></Col>
        </Row>
      );
    case 'due_soon':
      return <UpcomingDeadlinesWidget deadlines={data.upcomingDeadlines} />;
    case 'sprints_progress':
      return (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}><SprintContextWidget sprints={data.sprintContext} /></Col>
          <Col xs={24} lg={8}><MyTimeWidget stats={data.stats} /></Col>
        </Row>
      );
    case 'recent_activity':
      return (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}><MyPerformanceWidget data={data.performance} stats={data.stats} /></Col>
          <Col xs={24} lg={8}><TeamContextWidget events={data.recentActivity} /></Col>
        </Row>
      );
    case 'project_summaries':
      return null; // Already rendered inside 'recent_activity' compound widget
    default:
      return null;
  }
}

export function EmployeeDashboard() {
  const { data, isLoading, error, refetch } = useGetEmployeeDashboardQuery();
  const { data: preferences } = useGetDashboardPreferencesQuery();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="emp-kpi-grid">
          <style>{`
            .emp-kpi-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 16px;
            }
            @media (max-width: 1200px) { .emp-kpi-grid { grid-template-columns: repeat(3, 1fr); } }
            @media (max-width: 768px) { .emp-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
            @media (max-width: 480px) { .emp-kpi-grid { grid-template-columns: 1fr; } }
          `}</style>
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} styles={{ body: { padding: '20px' } }} style={{ borderRadius: '16px', border: `1px solid ${C.border}` }}>
              <Skeleton active paragraph={{ rows: 1 }} />
            </Card>
          ))}
        </div>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={14}><Card style={{ borderRadius: '16px', border: `1px solid ${C.border}` }}><Skeleton active paragraph={{ rows: 10 }} /></Card></Col>
          <Col xs={24} lg={10}><Card style={{ borderRadius: '16px', border: `1px solid ${C.border}` }}><Skeleton active paragraph={{ rows: 8 }} /></Card></Col>
        </Row>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert
        message="Failed to load your dashboard"
        type="error" showIcon
        action={<Button size="small" type="primary" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  const hiddenWidgets  = preferences?.hiddenWidgets ?? [];
  const savedLayout    = preferences?.layout ?? [];
  const orderedWidgets: WidgetType[] = (() => {
    const layoutOrder = savedLayout
      .filter(l => USER_DASHBOARD_WIDGETS.includes(l.widgetId))
      .sort((a, b) => a.position.y - b.position.y)
      .map(l => l.widgetId);
    const missing = USER_DASHBOARD_WIDGETS.filter(w => !layoutOrder.includes(w));
    return [...layoutOrder, ...missing];
  })();

  const visibleWidgets = orderedWidgets.filter(w => !hiddenWidgets.includes(w));

  const rendered = new Set<WidgetType>();
  const COMPOUND_COVERS: Partial<Record<WidgetType, WidgetType[]>> = {
    assigned_issues: ['due_soon'],
    sprints_progress: [],
    recent_activity: ['project_summaries'],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {visibleWidgets.map((widgetId) => {
        for (const [compound, covered] of Object.entries(COMPOUND_COVERS)) {
          if ((covered as WidgetType[]).includes(widgetId) && rendered.has(compound as WidgetType)) {
            return null;
          }
        }
        rendered.add(widgetId);
        return (
          <div key={widgetId}>
            <WidgetRenderer widgetId={widgetId} data={data} />
          </div>
        );
      })}
    </div>
  );
}
