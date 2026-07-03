import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, UserCheck, Briefcase, Activity, AlertTriangle, CheckCircle2,
  TrendingUp, Zap, BarChart3, RefreshCw, ChevronRight, GitBranch,
  Calendar, ChevronDown, ChevronUp, Flame, TrendingDown, Target,
  Award, Layers, ArrowUpRight, Minus, ArrowDownRight,
} from 'lucide-react';
import { KpiCard, KpiCardProps } from './shared/KpiCard';
import { Row, Col, Card, Skeleton, Alert, Button, Avatar, Tooltip, Select, Empty, Tag } from 'antd';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart, LabelList,
} from 'recharts';
import {
  useGetAdminDashboardQuery, useGetGanttDataQuery, useGetDashboardPreferencesQuery,
  useGetVelocityChartQuery, useGetBurndownChartQuery, useGetCumulativeFlowQuery,
} from '../dashboardApi';
import {
  AdminStats, ProjectOverview, HealthStatus, UserActivityItem,
  IssuesByProjectItem, OverdueByProject, SystemEvent,
  GanttItem, GanttView, WidgetType, VelocityPoint,
} from '../types';
import { ADMIN_DASHBOARD_WIDGETS } from './DashboardCustomizer';
import { DashboardAISummary } from './DashboardAISummary';
import { format, formatDistanceToNow, startOfISOWeek, addDays } from 'date-fns';
import { useGetSprintsQuery, useGetBurnupQuery } from '../../sprints/sprintsApi';
import { getProjectColor, isMilestone, calculateSummaryBar, generateWeekHeaders } from '@/lib/ganttUtils';

const C = {
  primary:    '#1268ff',
  primaryBg:  'rgba(18,104,255,0.08)',
  success:    '#10b981',
  successBg:  'rgba(16,185,129,0.08)',
  warning:    '#f59e0b',
  warningBg:  'rgba(245,158,11,0.08)',
  danger:     '#ef4444',
  dangerBg:   'rgba(239,68,68,0.08)',
  purple:     '#8b5cf6',
  purpleBg:   'rgba(139,92,246,0.08)',
  orange:     '#f97316',
  orangeBg:   'rgba(249,115,22,0.08)',
  teal:       '#06b6d4',
  tealBg:     'rgba(6,182,212,0.08)',
  text:       '#0f172a',
  textSub:    '#334155',
  textMuted:  '#64748b',
  border:     '#e2e8f0',
  bg:         '#f8fafc',
  card:       '#ffffff',
  shadow:     '0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)',
  shadowLg:   '0 4px 24px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.04)',
  shadowCard: '0 0 0 1px rgba(15,23,42,0.04), 0 2px 8px rgba(15,23,42,0.04), 0 8px 32px rgba(15,23,42,0.06)',
};

// ─── Shared card header ───────────────────────────────────────────────────────

function WCardTitle({
  icon, iconGrad, title, subtitle, badge, extra,
}: {
  icon: React.ReactNode;
  iconGrad: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>{subtitle}</div>}
        </div>
        {badge}
      </div>
      {extra && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{extra}</div>}
    </div>
  );
}

const CARD_STYLE: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 20,
  boxShadow: '0 0 0 1px rgba(15,23,42,0.04), 0 2px 8px rgba(15,23,42,0.04), 0 8px 32px rgba(15,23,42,0.06)',
  overflow: 'hidden',
  background: '#ffffff',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'MMM d'); } catch { return iso; }
}

function fmtDateFull(iso: string) {
  try { return format(new Date(iso), 'MMM d, yyyy'); } catch { return iso; }
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const HEALTH_CONFIG: Record<HealthStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  healthy:  { label: 'Healthy',   color: C.success,  bg: C.successBg,  icon: <CheckCircle2 size={12} /> },
  at_risk:  { label: 'At Risk',   color: C.warning,  bg: C.warningBg,  icon: <AlertTriangle size={12} /> },
  critical: { label: 'Critical',  color: C.danger,   bg: C.dangerBg,   icon: <AlertTriangle size={12} /> },
};

const ACTION_LABELS: Record<string, string> = {
  status_changed: 'changed status of',
  comment_added: 'commented on',
  issue_created: 'created',
  issue_updated: 'updated',
  sprint_started: 'started sprint',
  sprint_completed: 'completed sprint',
  member_added: 'added member to',
};

const GANTT_VIEWS: { key: GanttView; label: string }[] = [
  { key: 'weekly',     label: 'Weekly'      },
  { key: 'quarterly',  label: 'Quarterly'   },
  { key: 'halfYearly', label: 'Half-Yearly' },
  { key: 'annually',   label: 'Annually'    },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: HealthStatus }) {
  const cfg = HEALTH_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', borderRadius: '20px',
      fontSize: '11px', fontWeight: 700,
      color: cfg.color, backgroundColor: cfg.bg,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function AvatarCell({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return avatarUrl ? (
    <Avatar src={avatarUrl} size={28} />
  ) : (
    <Avatar size={28} style={{ backgroundColor: C.primary, fontSize: '11px', fontWeight: 700 }}>
      {initials(name)}
    </Avatar>
  );
}

// ─── Widgets ─────────────────────────────────────────────────────────────────

function AdminStatsRow({ stats }: { stats: AdminStats }) {
  const cards: KpiCardProps[] = [
    { icon: <Users size={20} />,        label: 'Total Users',    value: stats.totalUsers,         sub: `${stats.activeUsers} active`,              accent: C.primary,  accentBg: C.primaryBg, delay: 0    },
    { icon: <Briefcase size={20} />,    label: 'Projects',       value: stats.totalProjects,      sub: `${stats.activeProjects} active`,            accent: C.teal,     accentBg: C.tealBg,    delay: 0.05 },
    { icon: <BarChart3 size={20} />,    label: 'Open Issues',    value: stats.openIssues,         sub: `${stats.totalIssues} total`,                accent: C.warning,  accentBg: C.warningBg, delay: 0.1  },
    { icon: <CheckCircle2 size={20} />, label: 'Completed',      value: stats.completedIssues,    sub: `${stats.issuesCompletedThisWeek} this wk`, accent: C.success,  accentBg: C.successBg, delay: 0.15 },
    { icon: <AlertTriangle size={20} />,label: 'Overdue',        value: stats.overdueIssues,      sub: `${stats.overdueIssues > 0 ? 'needs attention' : 'all clear'}`, accent: C.danger,  accentBg: C.dangerBg,  delay: 0.2  },
    { icon: <Zap size={20} />,          label: 'Active Sprints', value: stats.activeSprintsCount, sub: `across ${stats.activeProjects} projects`,   accent: C.purple,   accentBg: C.purpleBg,  delay: 0.25 },
  ];
  return (
    <>
      <div className="admin-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
        {cards.map(c => (
          <KpiCard key={c.label} {...c} />
        ))}
      </div>
      <style>{`
        @media (max-width: 1200px) { .admin-kpi-grid { grid-template-columns: repeat(3, 1fr) !important; } }
        @media (max-width: 768px) { .admin-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
    </>
  );
}

function ProjectsOverviewWidget({ projects, onProjectClick }: { projects: ProjectOverview[]; onProjectClick: (p: ProjectOverview) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
      <Card
        title={
          <WCardTitle
            icon={<Briefcase size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #1268ff 0%, #06b6d4 100%)"
            title="Projects Overview"
            subtitle="Click any row to open the project"
          />
        }
        styles={{ body: { padding: '0 0 4px 0' } }}
        style={CARD_STYLE}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Project', 'Health', 'Progress', 'Open', 'Overdue', 'Lead'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.05 }}
                  onClick={() => onProjectClick(p)}
                  style={{ borderBottom: i < projects.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '8px', background: C.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: C.primary }}>
                        {p.key.slice(0, 3)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: C.primary, textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.textDecorationColor = C.primary; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.textDecorationColor = 'transparent'; }}
                        >{p.name}</div>
                        <div style={{ fontSize: '11px', color: C.textMuted }}>{p.memberCount} members</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}><HealthBadge status={p.healthStatus} /></td>
                  <td style={{ padding: '12px 16px', minWidth: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: C.border, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${p.completionPercentage}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                          style={{ height: '100%', borderRadius: '3px', background: `linear-gradient(90deg, ${C.primary} 0%, #40a9ff 100%)` }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: C.textSub, minWidth: '32px' }}>{p.completionPercentage}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: C.text }}>{p.openIssues}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {p.overdueIssues > 0
                      ? <span style={{ fontSize: '13px', fontWeight: 700, color: C.danger }}>{p.overdueIssues}</span>
                      : <span style={{ fontSize: '13px', color: C.textMuted }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Avatar size={24} style={{ backgroundColor: C.primary, fontSize: '10px' }}>{initials(p.leadName)}</Avatar>
                      <span style={{ fontSize: '12px', color: C.textSub }}>{p.leadName.split(' ')[0]}</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}

const CUSTOM_TOOLTIP_STYLE = {
  background: '#fff', border: `1px solid ${C.border}`, borderRadius: '8px',
  boxShadow: C.shadow, padding: '10px 14px', fontSize: '13px',
};

// ─── Shared sprint selector hook ─────────────────────────────────────────────

function useSprintSelector(projectsOverview: ProjectOverview[]) {
  const defaultProjectId = projectsOverview.find(p => p.activeSprint)?.id ?? projectsOverview[0]?.id ?? '';
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId);
  const { data: sprintsData } = useGetSprintsQuery(
    { projectId: selectedProjectId, status: 'active' },
    { skip: !selectedProjectId }
  );
  const activeSprint = sprintsData?.activeSprint ?? sprintsData?.sprints?.[0] ?? null;
  const sprintId = activeSprint?.id ?? '';
  return { selectedProjectId, setSelectedProjectId, activeSprint, sprintId };
}

// ─── Burndown Widget ──────────────────────────────────────────────────────────

function BurndownWidget({ projectsOverview }: { projectsOverview: ProjectOverview[] }) {
  const { selectedProjectId, setSelectedProjectId, activeSprint, sprintId } = useSprintSelector(projectsOverview);
  const { data: burndownData, isLoading } = useGetBurndownChartQuery(sprintId, { skip: !sprintId });
  const chartData = useMemo(() => {
    if (!burndownData?.points?.length) return [];
    return burndownData.points.map(p => ({
      date: fmtDate(p.date),
      Ideal: p.idealRemaining,
      Actual: p.remainingPoints ?? p.remainingIssues,
    }));
  }, [burndownData]);

  const remaining = burndownData ? burndownData.totalIssues - burndownData.completedIssues : 0;
  const pctDone   = burndownData?.totalIssues ? Math.round((burndownData.completedIssues / burndownData.totalIssues) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
      <Card
        title={
          <WCardTitle
            icon={<TrendingDown size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #ef4444 0%, #f97316 100%)"
            title="Burndown Chart"
            subtitle={burndownData ? `${activeSprint?.name} · ${fmtDateFull(burndownData.startDate)} → ${fmtDateFull(burndownData.endDate)}` : activeSprint?.name}
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {burndownData && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ textAlign: 'center', padding: '4px 12px', borderRadius: 10, background: C.dangerBg, border: `1px solid rgba(239,68,68,0.2)` }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.danger }}>{remaining}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Left</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '4px 12px', borderRadius: 10, background: C.successBg, border: `1px solid rgba(16,185,129,0.2)` }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.success }}>{pctDone}%</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Done</div>
                    </div>
                  </div>
                )}
                <Select
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  size="small"
                  style={{ minWidth: 180, fontSize: 12 }}
                  options={projectsOverview.map(p => ({ value: p.id, label: `${p.key} — ${p.name}`, disabled: !p.activeSprint }))}
                  placeholder="Select project"
                />
              </div>
            }
          />
        }
        styles={{ header: { padding: '16px 24px', minHeight: 'unset' }, body: { padding: '24px 28px 28px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : !sprintId ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: C.textMuted, fontSize: 13 }}>No active sprint for this project</span>} />
        ) : chartData.length === 0 ? (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 13 }}>No burndown data yet — check back once work begins</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { color: '#3b82f6', label: 'Ideal Remaining' },
                { color: '#ef4444', label: 'Actual Remaining' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSub, fontWeight: 600 }}>
                  <div style={{ width: 22, height: 3, background: l.color, borderRadius: 2 }} />
                  {l.label}
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: C.textMuted }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 7) - 1)}
                  angle={-30}
                  textAnchor="end"
                  height={40}
                />
                <YAxis tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={45} label={{ value: 'Story Points', angle: -90, position: 'insideLeft', fill: C.textMuted, fontSize: 10, dx: 4 }} />
                <RechartsTooltip contentStyle={CUSTOM_TOOLTIP_STYLE} cursor={{ stroke: C.border, strokeWidth: 1 }} />
                {/* Ideal — blue straight line from total → 0 */}
                <Line type="linear" dataKey="Ideal" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} name="Ideal Remaining" />
                {/* Actual — red line showing real remaining (stops at today) */}
                <Line type="monotone" dataKey="Actual" stroke="#ef4444" strokeWidth={2.5} dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null || payload.Actual == null) return <g key={props.key} />;
                  return <circle key={props.key} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
                }} activeDot={{ r: 6, fill: '#ef4444' }} name="Actual Remaining" />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Burnup Widget ────────────────────────────────────────────────────────────

function BurnupWidget({ projectsOverview }: { projectsOverview: ProjectOverview[] }) {
  const { selectedProjectId, setSelectedProjectId, activeSprint, sprintId } = useSprintSelector(projectsOverview);
  const { data: burnupData, isLoading } = useGetBurnupQuery(sprintId, { skip: !sprintId });

  const chartData = useMemo(() => {
    if (!burnupData?.burnup) return [];
    return burnupData.burnup.map((p: any) => ({
      date: fmtDate(p.date),
      Total: p.totalScope,
      Completed: p.completedPoints,
    }));
  }, [burnupData]);

  const completedPts = burnupData?.completedPoints ?? 0;
  const totalScope   = burnupData?.totalPoints ?? 0;
  const pctDone      = totalScope ? Math.round((completedPts / totalScope) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
      <Card
        title={
          <WCardTitle
            icon={<TrendingUp size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #10b981 0%, #06b6d4 100%)"
            title="Burnup Chart"
            subtitle={activeSprint?.name}
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {burnupData && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ textAlign: 'center', padding: '4px 12px', borderRadius: 10, background: C.successBg, border: `1px solid rgba(16,185,129,0.2)` }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.success }}>{completedPts}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '4px 12px', borderRadius: 10, background: C.primaryBg, border: `1px solid rgba(18,104,255,0.2)` }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>{pctDone}%</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Progress</div>
                    </div>
                    {burnupData && (
                      <span style={{ display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 10, background: burnupData.isOnTrack ? C.successBg : C.dangerBg, color: burnupData.isOnTrack ? C.success : C.danger, border: `1px solid ${burnupData.isOnTrack ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                        {burnupData.isOnTrack ? '✓ On Track' : '⚠ At Risk'}
                      </span>
                    )}
                  </div>
                )}
                <Select
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  size="small"
                  style={{ minWidth: 180, fontSize: 12 }}
                  options={projectsOverview.map(p => ({ value: p.id, label: `${p.key} — ${p.name}`, disabled: !p.activeSprint }))}
                  placeholder="Select project"
                />
              </div>
            }
          />
        }
        styles={{ header: { padding: '16px 24px', minHeight: 'unset' }, body: { padding: '24px 28px 28px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : !sprintId ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: C.textMuted, fontSize: 13 }}>No active sprint for this project</span>} />
        ) : chartData.length === 0 ? (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 13 }}>No burnup data yet</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { color: '#3b82f6', label: 'Total Work' },
                { color: '#ef4444', label: 'Completed Work' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSub, fontWeight: 600 }}>
                  <div style={{ width: 22, height: 3, background: l.color, borderRadius: 2 }} />
                  {l.label}
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: C.textMuted }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 7) - 1)}
                  angle={-30}
                  textAnchor="end"
                  height={40}
                />
                <YAxis tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} width={45} label={{ value: 'Story Points', angle: -90, position: 'insideLeft', fill: C.textMuted, fontSize: 10, dx: 4 }} />
                <RechartsTooltip contentStyle={CUSTOM_TOOLTIP_STYLE} cursor={{ stroke: C.border, strokeWidth: 1 }} />
                {/* Total Work — blue line showing total scope */}
                <Line type="monotone" dataKey="Total" stroke="#3b82f6" strokeWidth={2} dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null || payload.Total == null) return <g key={props.key} />;
                  return <circle key={props.key} cx={cx} cy={cy} r={3} fill="#3b82f6" stroke="#fff" strokeWidth={1.5} />;
                }} activeDot={{ r: 5, fill: '#3b82f6' }} name="Total Work" />
                {/* Completed — red line rising from zero (stops at today) */}
                <Line type="monotone" dataKey="Completed" stroke="#ef4444" strokeWidth={2.5} dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null || payload.Completed == null) return <g key={props.key} />;
                  return <circle key={props.key} cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />;
                }} activeDot={{ r: 6, fill: '#ef4444' }} name="Completed Work" />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Team Velocity Widget ─────────────────────────────────────────────────────

const TREND_CONFIG = {
  improving: { label: 'Improving', color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: <ArrowUpRight size={12} /> },
  declining:  { label: 'Declining', color: '#ff4d4f', bg: 'rgba(255,77,79,0.08)',   icon: <ArrowDownRight size={12} /> },
  stable:     { label: 'Stable',    color: '#faad14', bg: 'rgba(250,173,20,0.08)',  icon: <Minus size={12} /> },
};

function TeamVelocityWidget({ projectsOverview }: { projectsOverview: ProjectOverview[] }) {
  const defaultProjectId = projectsOverview[0]?.id ?? '';
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId);
  const { data: velocityData, isLoading } = useGetVelocityChartQuery(
    { projectId: selectedProjectId, limit: 8 },
    { skip: !selectedProjectId }
  );

  const chartData = useMemo(() => {
    if (!velocityData?.points) return [];
    return velocityData.points.map((p: VelocityPoint) => ({
      name: p.sprintName.length > 14 ? p.sprintName.slice(0, 14) + '…' : p.sprintName,
      Committed: p.committedPoints ?? p.committedIssues,
      Completed: p.completedPoints ?? p.completedIssues,
      Rate:      Math.round(p.completionRate),
    }));
  }, [velocityData]);

  const trendCfg = velocityData?.trend ? TREND_CONFIG[velocityData.trend] : null;

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
      <Card
        title={
          <WCardTitle
            icon={<Zap size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)"
            title="Team Velocity"
            subtitle="Committed vs completed story points per sprint"
            badge={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {trendCfg && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: trendCfg.bg, color: trendCfg.color }}>
                    {trendCfg.icon} {trendCfg.label}
                  </span>
                )}
                {velocityData && (
                  <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, background: C.bg, padding: '3px 9px', borderRadius: 20, border: `1px solid ${C.border}` }}>
                    Avg {Math.round(velocityData.avgCompletionRate)}% completion
                  </span>
                )}
              </div>
            }
            extra={
              <Select
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                size="small"
                style={{ minWidth: 180, fontSize: 12 }}
                options={projectsOverview.map(p => ({ value: p.id, label: `${p.key} — ${p.name}` }))}
                placeholder="Select project"
              />
            }
          />
        }
        styles={{ body: { padding: '20px 24px 28px' } }}
        style={CARD_STYLE}
      >
        {isLoading ? <Skeleton active paragraph={{ rows: 7 }} /> : chartData.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: C.textMuted, fontSize: 13 }}>No velocity data yet — complete a sprint to see trends</span>} />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSub }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: '#93c5fd' }} />Committed
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSub }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: '#34d399' }} />Done
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSub }}>
                <div style={{ width: 24, height: 3, background: '#ef4444', borderRadius: 1 }} />Velocity
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 24, right: 24, left: -12, bottom: 0 }} barCategoryGap="28%" barGap={3}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textMuted }} axisLine={false} tickLine={false} />
                {/* Hide Y axis — numbers shown on bars */}
                <YAxis yAxisId="left" hide domain={[0, (max: number) => Math.ceil(max * 1.3)]} />
                <RechartsTooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(val: any, name: string) => [name === 'Rate' ? `${val}%` : `${val} pts`, name === 'Rate' ? 'Completion %' : name]} />
                {/* Committed bars — blue */}
                <Bar yAxisId="left" dataKey="Committed" fill="#93c5fd" radius={[4, 4, 0, 0]} name="Committed">
                  <LabelList dataKey="Committed" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#3b82f6' }} />
                </Bar>
                {/* Done bars — green */}
                <Bar yAxisId="left" dataKey="Completed" fill="#34d399" radius={[4, 4, 0, 0]} name="Done">
                  <LabelList dataKey="Completed" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#059669' }} />
                </Bar>
                {/* Velocity trend line — red connecting completed points */}
                <Line yAxisId="left" type="monotone" dataKey="Completed" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 5, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7 }} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Sprint Health Overview Widget ────────────────────────────────────────────

const SPRINT_HEALTH_CFG = {
  healthy:  { label: 'On Track',  color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)',  icon: <CheckCircle2 size={14} /> },
  at_risk:  { label: 'At Risk',   color: '#faad14', bg: 'rgba(250,173,20,0.08)', border: 'rgba(250,173,20,0.25)', icon: <AlertTriangle size={14} /> },
  critical: { label: 'Critical',  color: '#ff4d4f', bg: 'rgba(255,77,79,0.08)',  border: 'rgba(255,77,79,0.25)', icon: <Flame size={14} /> },
};

// Fixed card height for the sprint-health + top-contributors paired row
const HEALTH_CONTRIB_H = 480;

function SprintHealthOverviewWidget({ projectsOverview }: { projectsOverview: ProjectOverview[] }) {
  const activeProjects = projectsOverview.filter(p => p.activeSprint);

  const counts = useMemo(() => ({
    healthy:  activeProjects.filter(p => p.healthStatus === 'healthy').length,
    at_risk:  activeProjects.filter(p => p.healthStatus === 'at_risk').length,
    critical: activeProjects.filter(p => p.healthStatus === 'critical').length,
  }), [activeProjects]);

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} style={{ height: '100%' }}>
      <Card
        title={
          <WCardTitle
            icon={<Target size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #06b6d4 0%, #1268ff 100%)"
            title="Sprint Health Overview"
            subtitle={`${activeProjects.length} active sprint${activeProjects.length !== 1 ? 's' : ''} across ${projectsOverview.length} projects`}
          />
        }
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: HEALTH_CONTRIB_H - 65 } }}
        style={{ ...CARD_STYLE, height: HEALTH_CONTRIB_H }}
      >
        {/* Summary strip — fixed, never scrolls */}
        <div style={{ display: 'flex', gap: 10, borderBottom: `1px solid ${C.border}`, padding: '14px 20px', flexShrink: 0 }}>
          {(['healthy', 'at_risk', 'critical'] as HealthStatus[]).map(s => {
            const cfg = SPRINT_HEALTH_CFG[s];
            return (
              <div key={s} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', borderRadius: 12, background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: cfg.color, lineHeight: 1, letterSpacing: '-0.04em' }}>{counts[s]}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, color: cfg.color, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {cfg.icon}{cfg.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Per-project rows — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {activeProjects.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>No active sprints</div>
          ) : (
            activeProjects.map((p, i) => {
              const cfg = SPRINT_HEALTH_CFG[p.healthStatus];
              const daysLeft = p.sprintDaysRemaining;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < activeProjects.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background 0.15s', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: C.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.primary, flexShrink: 0 }}>
                    {p.key.slice(0, 3)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{p.activeSprint}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {daysLeft !== null && (
                      <span style={{ fontSize: 11, color: daysLeft <= 2 ? C.danger : C.textMuted, fontWeight: 600 }}>
                        {daysLeft}d left
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>
                      {cfg.icon}{cfg.label}
                    </span>
                  </div>
                  <div style={{ minWidth: 84, flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: C.textMuted }}>Progress</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{p.completionPercentage}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${p.completionPercentage}%` }}
                        transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                        style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${cfg.color} 0%, ${cfg.color}88 100%)` }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Cumulative Flow Diagram Widget ───────────────────────────────────────────

const CFD_SERIES = [
  { key: 'Done',        color: '#22c55e', stroke: '#16a34a' },
  { key: 'In Progress', color: '#f59e0b', stroke: '#d97706' },
  { key: 'In Review',   color: '#a855f7', stroke: '#7c3aed' },
  { key: 'Todo',        color: '#3b82f6', stroke: '#2563eb', label: 'To Do' },
] as const;

const CFD_DAYS_OPTIONS = [
  { value: 14, short: '14d' },
  { value: 30, short: '30d' },
  { value: 60, short: '60d' },
  { value: 90, short: '90d' },
];

function CfdTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.96)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 12,
      padding: '14px 18px', fontSize: 12, color: '#e2e8f0', minWidth: 180,
      boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 10, color: '#f8fafc', fontSize: 13 }}>{label}</div>
      {[...payload].reverse().map((p: any) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '3px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.stroke, boxShadow: `0 0 6px ${p.color || p.stroke}60`, flexShrink: 0 }} />
            <span style={{ color: '#cbd5e1' }}>{p.name}</span>
          </div>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.value}</span>
        </div>
      ))}
      <div style={{ color: '#94a3b8', marginTop: 10, borderTop: '1px solid rgba(148, 163, 184, 0.15)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
        <span>Total</span><span style={{ color: '#f1f5f9' }}>{total}</span>
      </div>
    </div>
  );
}

function CumulativeFlowWidget({ projectsOverview }: { projectsOverview: ProjectOverview[] }) {
  const defaultProjectId = projectsOverview[0]?.id ?? '';
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId);
  const [days, setDays] = useState<number>(30);
  const { data: cfdData, isLoading } = useGetCumulativeFlowQuery(
    { projectId: selectedProjectId, days },
    { skip: !selectedProjectId }
  );

  const chartData = useMemo(() => {
    if (!Array.isArray(cfdData)) return [];
    const all = cfdData.map((p: any) => ({
      date:          fmtDate(p.date),
      Todo:          p.todo,
      'In Progress': p.inProgress,
      'In Review':   p.inReview,
      Done:          p.done,
    }));
    // Trim leading all-zero days, keeping 1 zero day before first data for area baseline
    const firstNonZero = all.findIndex(
      (d) => d.Todo + d['In Progress'] + d['In Review'] + d.Done > 0
    );
    if (firstNonZero < 0) return all;
    return all.slice(Math.max(0, firstNonZero - 1));
  }, [cfdData]);

  // Compute latest totals for stat pills
  const latest = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}>
      <Card
        title={
          <WCardTitle
            icon={<Layers size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #f97316 0%, #facc15 100%)"
            title="Cumulative Flow Diagram"
            subtitle="Work item distribution across statuses over time"
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Pill date range selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#f8fafc', borderRadius: 8, padding: 3, border: `1px solid ${C.border}` }}>
                  <Calendar size={12} color="#94a3b8" style={{ marginLeft: 6 }} />
                  {CFD_DAYS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDays(opt.value)}
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: days === opt.value ? 600 : 500,
                        color: days === opt.value ? '#fff' : '#64748b',
                        background: days === opt.value ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                        border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s ease',
                        boxShadow: days === opt.value ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none',
                      }}
                    >
                      {opt.short}
                    </button>
                  ))}
                </div>
                <Select
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  size="small"
                  style={{ minWidth: 180, fontSize: 12 }}
                  options={projectsOverview.map(p => ({ value: p.id, label: `${p.key} — ${p.name}` }))}
                  placeholder="Select project"
                />
              </div>
            }
          />
        }
        styles={{ body: { padding: '20px 24px 28px' } }}
        style={CARD_STYLE}
      >
        {isLoading ? <Skeleton active paragraph={{ rows: 7 }} /> : chartData.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: C.textMuted, fontSize: 13 }}>No flow data for this period</span>} />
        ) : (
          <>
            {/* Status summary pills */}
            {latest && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {CFD_SERIES.map((s) => {
                  const val = (latest as any)[s.key] ?? 0;
                  return (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: `${s.color}0a`, border: `1px solid ${s.color}20` }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}40`, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>{'label' in s ? s.label : s.key}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                <defs>
                  {CFD_SERIES.map((s) => (
                    <linearGradient key={s.key} id={`cfd_${s.key.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0.65} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.textMuted, fontWeight: 500 }} axisLine={false} tickLine={false} interval="preserveStartEnd" dy={4} />
                <YAxis tick={{ fontSize: 11, fill: C.textMuted, fontWeight: 500 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <RechartsTooltip content={<CfdTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
                {CFD_SERIES.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stackId="cfd"
                    stroke={s.stroke}
                    fill={`url(#cfd_${s.key.replace(/\s/g, '')})`}
                    name={'label' in s ? s.label : s.key}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: '#fff', stroke: s.stroke, strokeWidth: 2.5, style: { filter: `drop-shadow(0 0 4px ${s.stroke}80)` } }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>

            {/* Custom legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, paddingTop: 14, borderTop: '1px solid #f1f5f9', marginTop: 8 }}>
              {[...CFD_SERIES].reverse().map((s) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 4, borderRadius: 2, background: s.color }} />
                  <span style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{'label' in s ? s.label : s.key}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </motion.div>
  );
}

function IssuesByProjectChart({ data }: { data: IssuesByProjectItem[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
      <Card
        title={
          <WCardTitle
            icon={<BarChart3 size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #f97316 0%, #f59e0b 100%)"
            title="Issues by Project"
            subtitle="Open · In Progress · Done · Overdue"
          />
        }
        styles={{ body: { padding: '16px 24px 24px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="projectKey" tick={{ fontSize: 11, fill: C.textMuted }} />
            <YAxis tick={{ fontSize: 11, fill: C.textMuted }} />
            <RechartsTooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="open"       name="Open"        stackId="a" fill={C.primary} />
            <Bar dataKey="inProgress" name="In Progress" stackId="a" fill={C.warning} />
            <Bar dataKey="done"       name="Done"        stackId="a" fill={C.success} />
            <Bar dataKey="overdue"    name="Overdue"     stackId="a" fill={C.danger}  radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </motion.div>
  );
}

function UserActivityWidget({ data }: { data: UserActivityItem[] }) {
  const sorted = [...data].sort((a, b) => b.issuesCompleted - a.issuesCompleted);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }} style={{ height: '100%' }}>
      <Card
        title={
          <WCardTitle
            icon={<UserCheck size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)"
            title="Top Contributors"
            subtitle="Ranked by issues completed"
          />
        }
        styles={{ body: { padding: 0, overflowY: 'auto', height: HEALTH_CONTRIB_H - 65 } }}
        style={{ ...CARD_STYLE, height: HEALTH_CONTRIB_H }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sorted.map((u, i) => (
            <motion.div
              key={u.userId}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.2 + i * 0.05 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 20px',
                borderBottom: i < sorted.length - 1 ? `1px solid ${C.border}` : 'none',
                transition: 'background 0.18s', flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800,
                background: i === 0 ? '#faad14' : i === 1 ? '#b0b8c8' : i === 2 ? '#cd7f32' : C.bg,
                color: i < 3 ? '#fff' : C.textMuted,
                border: i >= 3 ? `1px solid ${C.border}` : 'none',
              }}>
                {i + 1}
              </span>
              <AvatarCell name={u.displayName} avatarUrl={u.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.displayName}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{fmtMin(u.timeLoggedMinutes)} logged</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.purple }}>{u.issuesCompleted}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>done</div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function OverdueByProjectWidget({ data }: { data: OverdueByProject[] }) {
  const max = Math.max(...data.map(d => d.overdueCount), 1);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
      <Card
        title={
          <WCardTitle
            icon={<AlertTriangle size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #ef4444 0%, #f97316 100%)"
            title="Overdue by Project"
            subtitle="Issues past their due date"
          />
        }
        styles={{ body: { padding: '16px 24px 20px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
          {data.map((d, i) => (
            <motion.div key={d.projectId} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.3 + i * 0.06 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{d.projectName}</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: C.danger }}>{d.overdueCount}</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', background: C.border, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(d.overdueCount / max) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.4 + i * 0.06 }}
                  style={{ height: '100%', borderRadius: '4px', background: `linear-gradient(90deg, ${C.danger} 0%, #ff7875 100%)` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function SystemEventsWidget({ events }: { events: SystemEvent[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
      <Card
        title={
          <WCardTitle
            icon={<Activity size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #06b6d4 0%, #1268ff 100%)"
            title="System Events"
            subtitle="Recent team activity"
          />
        }
        styles={{ body: { padding: '0 0 8px' } }}
        style={{ ...CARD_STYLE, height: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.slice(0, 10).map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.35 + i * 0.04 }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '12px 20px',
                borderBottom: i < events.slice(0, 10).length - 1 ? `1px solid ${C.border}` : 'none',
              }}
              onMouseEnter={ev => (ev.currentTarget.style.background = C.bg)}
              onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
            >
              <AvatarCell name={e.actorName} avatarUrl={e.actorAvatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: C.text, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600 }}>{e.actorName}</span>
                  {' '}<span style={{ color: C.textSub }}>{ACTION_LABELS[e.action] ?? e.action}</span>
                  {' '}<span style={{ fontWeight: 600 }}>{e.entityTitle}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                  {e.issueKey && (
                    <span style={{ fontSize: '11px', background: C.primaryBg, color: C.primary, padding: '1px 7px', borderRadius: '4px', fontWeight: 600 }}>{e.issueKey}</span>
                  )}
                  <span style={{ fontSize: '11px', color: C.textMuted }}>
                    {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
              {e.metadata?.from && e.metadata?.to && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: C.textMuted, flexShrink: 0 }}>
                  <span style={{ background: C.bg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${C.border}` }}>{e.metadata.from}</span>
                  <ChevronRight size={10} />
                  <span style={{ background: C.primaryBg, padding: '2px 6px', borderRadius: '4px', color: C.primary, fontWeight: 600 }}>{e.metadata.to}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Gantt Chart Widget ───────────────────────────────────────────────────────

const ROW_H   = 44;
const LEFT_W  = 280;
const DAY_COL_W = 50;
const COL_W_BY_VIEW: Record<GanttView, number> = {
  weekly:     DAY_COL_W,
  quarterly:  180,
  halfYearly: 160,
  annually:   130,
};

function GanttBar({ item, rangeStartMs, totalMs, projectColor }: { item: GanttItem; rangeStartMs: number; totalMs: number; projectColor?: string }) {
  const [hovered, setHovered] = useState(false);

  const startMs  = new Date(item.startDate).getTime();
  const endMs    = new Date(item.endDate).getTime();
  const clampedS = Math.max(startMs, rangeStartMs);
  const clampedE = Math.min(endMs, rangeStartMs + totalMs);
  if (clampedS >= clampedE) return null;

  const left      = ((clampedS - rangeStartMs) / totalMs) * 100;
  const width     = Math.max(((clampedE - clampedS) / totalMs) * 100, 0.8);
  const barColor  = item.isOverdue ? C.danger : (projectColor || C.primary);
  const progressW = Math.min(Math.max(item.progress, 0), 100);

  return (
    <div
      style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: `${left}%`, width: `${width}%`, height: 26, zIndex: 2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Bar track */}
      <div style={{
        width: '100%', height: '100%', borderRadius: '6px',
        background: `${barColor}18`,
        border: `1.5px solid ${barColor}50`,
        overflow: 'hidden', position: 'relative',
        boxShadow: `0 1px 4px ${barColor}20`,
      }}>
        {/* Filled progress */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${progressW}%`,
          background: `linear-gradient(90deg, ${barColor}ee 0%, ${barColor}99 100%)`,
          borderRadius: '5px 0 0 5px',
          transition: 'width 0.5s ease',
        }} />
        {/* Label inside bar: issueKey + title */}
        <span style={{
          position: 'absolute', left: '6px', right: '4px', top: '50%', transform: 'translateY(-50%)',
          fontSize: '10px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em', userSelect: 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}>
          {item.issueKey} {item.title}
        </span>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
          background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px',
          boxShadow: C.shadowLg, padding: '12px 16px', zIndex: 200,
          whiteSpace: 'nowrap', pointerEvents: 'none',
          fontSize: '12px', color: C.text, minWidth: 220,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
              background: item.isOverdue ? C.dangerBg : `${barColor}15`,
              color: item.isOverdue ? C.danger : barColor,
            }}>{item.issueKey}</span>
            <span style={{ fontWeight: 700, color: C.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
          </div>
          <div style={{ color: C.textSub, fontSize: '11px' }}>
            {fmtDateFull(item.startDate)} → {fmtDateFull(item.endDate)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
              <div style={{ width: `${progressW}%`, height: '100%', background: barColor, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: barColor }}>{progressW}%</span>
            {item.isOverdue && <span style={{ fontSize: '11px', fontWeight: 700, color: C.danger }}>Overdue</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function MilestoneDiamond({ item, rangeStartMs, totalMs, projectColor }: { item: GanttItem; rangeStartMs: number; totalMs: number; projectColor?: string }) {
  const [hovered, setHovered] = useState(false);
  const dateMs = new Date(item.startDate || item.endDate).getTime();
  const clampedMs = Math.max(dateMs, rangeStartMs);
  if (clampedMs > rangeStartMs + totalMs) return null;
  const left = ((clampedMs - rangeStartMs) / totalMs) * 100;
  const color = projectColor || C.warning;

  return (
    <div
      style={{ position: 'absolute', top: '50%', left: `${left}%`, transform: 'translate(-50%, -50%)', zIndex: 3 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 16, height: 16, transform: 'rotate(45deg)',
        backgroundColor: color, border: `2px solid ${color}dd`,
        borderRadius: 2, boxShadow: `0 2px 6px ${color}40`,
      }} />
      {hovered && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 14px)', left: '50%', transform: 'translateX(-50%)',
          background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
          boxShadow: C.shadowLg, padding: '10px 14px', zIndex: 200,
          whiteSpace: 'nowrap', pointerEvents: 'none', fontSize: '12px', color: C.text, minWidth: 180,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: color, flexShrink: 0 }} />
            <span style={{ fontWeight: 700 }}>{item.issueKey}</span>
            <span style={{ color: C.textSub }}>{item.title}</span>
          </div>
          <div style={{ fontSize: '11px', color: C.textMuted }}>
            Milestone · {fmtDateFull(item.startDate || item.endDate)}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBar({ startMs, endMs, rangeStartMs, totalMs, color, label }: {
  startMs: number; endMs: number; rangeStartMs: number; totalMs: number; color: string; label: string;
}) {
  const clampedS = Math.max(startMs, rangeStartMs);
  const clampedE = Math.min(endMs, rangeStartMs + totalMs);
  if (clampedS >= clampedE) return null;

  const left  = ((clampedS - rangeStartMs) / totalMs) * 100;
  const width = Math.max(((clampedE - clampedS) / totalMs) * 100, 1);

  return (
    <div style={{
      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
      left: `${left}%`, width: `${width}%`,
      height: 22, borderRadius: 11, zIndex: 2,
      background: `linear-gradient(90deg, ${color}dd 0%, ${color}88 100%)`,
      border: `1.5px solid ${color}`,
      display: 'flex', alignItems: 'center', paddingLeft: 10, paddingRight: 10,
      boxShadow: `0 2px 8px ${color}30`,
    }}>
      <span style={{
        fontSize: 10, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }}>
        {label}
      </span>
    </div>
  );
}

function GanttChartWidget({ projectsOverview }: { projectsOverview?: ProjectOverview[] }) {
  const [view, setView] = useState<GanttView>('quarterly');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const { data, isLoading, error, refetch, isFetching } = useGetGanttDataQuery({
    view,
    projectId: selectedProjectId,
  });

  const colW = view === 'weekly' ? DAY_COL_W : COL_W_BY_VIEW[view];

  // Group items by project with summary metrics
  const projectGroups = useMemo(() => {
    if (!data?.items) return [];
    const map = new Map<string, {
      projectId: string; projectName: string; projectKey: string; items: GanttItem[];
      summaryStart: number; summaryEnd: number; avgProgress: number; overdueCount: number;
    }>();
    for (const item of data.items) {
      if (!map.has(item.projectId)) {
        map.set(item.projectId, {
          projectId: item.projectId, projectName: item.projectName, projectKey: item.projectKey, items: [],
          summaryStart: Infinity, summaryEnd: -Infinity, avgProgress: 0, overdueCount: 0,
        });
      }
      const group = map.get(item.projectId)!;
      group.items.push(item);
      const s = new Date(item.startDate).getTime();
      const e = new Date(item.endDate).getTime();
      if (s < group.summaryStart) group.summaryStart = s;
      if (e > group.summaryEnd) group.summaryEnd = e;
    }
    const groups = Array.from(map.values());
    // Compute averages
    for (const g of groups) {
      g.avgProgress = Math.round(g.items.reduce((sum, i) => sum + i.progress, 0) / g.items.length);
      g.overdueCount = g.items.filter(i => i.isOverdue).length;
    }
    // Auto-expand the first project
    if (groups.length > 0 && expandedProjects.size === 0) {
      setExpandedProjects(new Set([groups[0].projectId]));
    }
    return groups;
  }, [data?.items]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  // Display range is view-driven
  const displayRange = useMemo(() => {
    const now = new Date();
    if (view === 'weekly') {
      const weekStart = startOfISOWeek(now);
      const end = addDays(weekStart, 27); // 4 weeks
      return { start: weekStart, end };
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const months = view === 'quarterly' ? 3 : view === 'halfYearly' ? 6 : 12;
    const end = new Date(start.getFullYear(), start.getMonth() + months, 0, 23, 59, 59);
    return { start, end };
  }, [view]);

  const rangeStartMs = displayRange.start.getTime();
  const rangeEndMs   = displayRange.end.getTime();
  const totalMs      = rangeEndMs - rangeStartMs;

  // Week headers for weekly view (two-tier)
  const weekHeaders = useMemo(() => {
    if (view !== 'weekly') return null;
    return generateWeekHeaders(displayRange.start, displayRange.end);
  }, [view, displayRange]);

  // Month columns for non-weekly views
  const timeColumns = useMemo(() => {
    if (view === 'weekly') return [];
    const cols: { label: string; start: string; end: string; isCurrentMonth: boolean }[] = [];
    const cur = new Date(displayRange.start);
    const nowY = new Date().getFullYear();
    const nowM = new Date().getMonth();
    while (cur <= displayRange.end) {
      const monthStart = new Date(cur);
      const monthEnd   = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59);
      cols.push({
        label: format(monthStart, 'MMM yyyy'),
        start: monthStart.toISOString(),
        end:   monthEnd.toISOString(),
        isCurrentMonth: cur.getFullYear() === nowY && cur.getMonth() === nowM,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return cols;
  }, [view, displayRange]);

  // Total day count for weekly view
  const totalDayCols = weekHeaders ? weekHeaders.reduce((sum, w) => sum + w.days.length, 0) : 0;

  // "Today" marker position as % of total range width
  const todayPct = useMemo(() => {
    const now = Date.now();
    if (now < rangeStartMs || now > rangeEndMs) return null;
    return ((now - rangeStartMs) / totalMs) * 100;
  }, [rangeStartMs, rangeEndMs, totalMs]);

  const timelineRightWidth = view === 'weekly'
    ? DAY_COL_W * totalDayCols
    : colW * timeColumns.length;
  const timelineWidth = LEFT_W + timelineRightWidth;

  // Project dropdown options
  const projectOptions = useMemo(() => {
    if (!projectsOverview) return [];
    return projectsOverview.map(p => ({ value: p.id, label: `${p.key} — ${p.name}` }));
  }, [projectsOverview]);

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
      <Card
        title={
          <WCardTitle
            icon={<GitBranch size={17} color="#fff" />}
            iconGrad="linear-gradient(135deg, #8b5cf6 0%, #1268ff 100%)"
            title="Issue Timeline"
            subtitle={data ? `${data.items.length} issues · ${fmtDateFull(displayRange.start.toISOString())} – ${fmtDateFull(displayRange.end.toISOString())}` : undefined}
            extra={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {projectOptions.length > 0 && (
                  <Select
                    value={selectedProjectId}
                    onChange={(val) => setSelectedProjectId(val || undefined)}
                    allowClear
                    placeholder="All Projects"
                    size="small"
                    style={{ minWidth: 180, fontSize: 12 }}
                    options={projectOptions}
                  />
                )}
                <div style={{ display: 'flex', gap: '3px', padding: '3px', background: C.bg, borderRadius: '9px', border: `1px solid ${C.border}` }}>
                  {GANTT_VIEWS.map(v => (
                    <button
                      key={v.key}
                      onClick={() => setView(v.key)}
                      style={{
                        padding: '5px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 600, transition: 'all 0.18s',
                        background: view === v.key ? C.card : 'transparent',
                        color: view === v.key ? C.text : C.textMuted,
                        boxShadow: view === v.key ? '0 1px 4px rgba(16,24,40,0.08)' : 'none',
                      }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  style={{
                    width: 32, height: 32, borderRadius: '8px', border: `1px solid ${C.border}`,
                    background: C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <RefreshCw size={13} color={C.textMuted} style={isFetching ? { animation: 'spin 1s linear infinite' } : {}} />
                </button>
              </div>
            }
          />
        }
        styles={{ body: { padding: 0 } }}
        style={CARD_STYLE}
      >
        {isLoading ? (
          <div style={{ padding: '24px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <Skeleton.Button active style={{ width: 320, height: 28 }} />
                <Skeleton.Button active style={{ flex: 1, height: 22 }} />
              </div>
            ))}
          </div>
        ) : error || !data ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Calendar size={32} color={C.textMuted} style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: C.text }}>No timeline data available</div>
            <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '4px' }}>Try a different view or check back later.</div>
          </div>
        ) : projectGroups.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <GitBranch size={32} color={C.textMuted} style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: C.text }}>No issues in this period</div>
            <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '4px' }}>No issues with dates in this {view === 'weekly' ? 'period' : view === 'quarterly' ? 'quarter' : view === 'halfYearly' ? 'half-year' : 'year'}.</div>
          </div>
        ) : (
          <div className="gantt-outer" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: timelineWidth }}>
              {/* Column headers — sticky top */}
              {view === 'weekly' && weekHeaders ? (
                /* Two-tier header: Week row + Day row */
                <div style={{ borderBottom: `2px solid ${C.border}`, background: C.bg, position: 'sticky', top: 0, zIndex: 10 }}>
                  {/* Week-level header row */}
                  <div style={{ display: 'flex' }}>
                    <div style={{
                      width: LEFT_W, minWidth: LEFT_W, flexShrink: 0,
                      display: 'flex', alignItems: 'center',
                      padding: '8px 16px', borderRight: `1px solid ${C.border}`,
                      background: C.bg, position: 'sticky', left: 0, zIndex: 11,
                    }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Project / Issue</span>
                    </div>
                    <div style={{ display: 'flex' }}>
                      {weekHeaders.map((wh, wi) => (
                        <div key={wi} style={{
                          width: DAY_COL_W * wh.days.length, minWidth: DAY_COL_W * wh.days.length, flexShrink: 0,
                          padding: '6px 8px', textAlign: 'center',
                          fontSize: '11px', fontWeight: wh.isCurrentWeek ? 800 : 600,
                          color: wh.isCurrentWeek ? C.primary : C.textSub,
                          borderRight: `1px solid ${C.border}`,
                          background: wh.isCurrentWeek ? C.primaryBg : (wi % 2 === 0 ? C.bg : '#f2f4f7'),
                          borderBottom: `1px solid ${C.border}`,
                        }}>
                          {wh.shortLabel}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Day-level sub-header row */}
                  <div style={{ display: 'flex' }}>
                    <div style={{
                      width: LEFT_W, minWidth: LEFT_W, flexShrink: 0,
                      borderRight: `1px solid ${C.border}`, background: C.bg,
                      position: 'sticky', left: 0, zIndex: 11, height: 28,
                    }} />
                    <div style={{ display: 'flex' }}>
                      {weekHeaders.flatMap(wh => wh.days).map((day, di) => (
                        <div key={di} style={{
                          width: DAY_COL_W, minWidth: DAY_COL_W, flexShrink: 0, height: 28,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: day.isToday ? 800 : 500,
                          color: day.isToday ? C.primary : day.isWeekend ? C.textMuted : C.textSub,
                          borderRight: `1px solid ${C.border}`,
                          background: day.isToday ? C.primaryBg : day.isWeekend ? 'rgba(0,0,0,0.02)' : 'transparent',
                        }}>
                          <span>{day.dayLabel.charAt(0)}</span>
                          <span style={{ fontSize: '8px' }}>{day.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Single-tier month header */
                <div style={{ display: 'flex', borderBottom: `2px solid ${C.border}`, background: C.bg, position: 'sticky', top: 0, zIndex: 10 }}>
                  <div style={{
                    width: LEFT_W, minWidth: LEFT_W, flexShrink: 0,
                    display: 'flex', alignItems: 'center',
                    padding: '12px 20px', borderRight: `1px solid ${C.border}`,
                    gap: '20px', background: C.bg,
                    position: 'sticky', left: 0, zIndex: 11,
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Project / Issue</span>
                  </div>
                  <div style={{ display: 'flex' }}>
                    {timeColumns.map((col, i) => (
                      <div key={i} style={{
                        width: colW, minWidth: colW, flexShrink: 0,
                        padding: '12px 8px', textAlign: 'center',
                        fontSize: '12px', fontWeight: col.isCurrentMonth ? 800 : 600,
                        color: col.isCurrentMonth ? C.primary : C.textSub,
                        borderRight: i < timeColumns.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: col.isCurrentMonth ? C.primaryBg : (i % 2 === 0 ? C.bg : '#f2f4f7'),
                        borderBottom: col.isCurrentMonth ? `2px solid ${C.primary}` : 'none',
                      }}>
                        {col.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accordion Rows */}
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {projectGroups.map((group, groupIndex) => {
                  const isExpanded = expandedProjects.has(group.projectId);
                  const pColor = getProjectColor(groupIndex);
                  return (
                    <React.Fragment key={group.projectId}>
                      {/* Project header row */}
                      <div
                        onClick={() => toggleProject(group.projectId)}
                        style={{
                          display: 'flex', alignItems: 'center', height: 48,
                          borderBottom: `1px solid ${C.border}`,
                          background: isExpanded ? `${pColor}08` : C.bg,
                          cursor: 'pointer', transition: 'background 0.15s',
                          position: 'sticky', top: 0, zIndex: 4,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = `${pColor}10`)}
                        onMouseLeave={e => (e.currentTarget.style.background = isExpanded ? `${pColor}08` : C.bg)}
                      >
                        {/* Left sticky panel */}
                        <div style={{
                          width: LEFT_W, minWidth: LEFT_W, flexShrink: 0,
                          display: 'flex', alignItems: 'center', padding: '0 16px',
                          borderRight: `1px solid ${C.border}`, height: '100%', gap: 10,
                          background: 'inherit', position: 'sticky', left: 0, zIndex: 5,
                        }}>
                          <div style={{ color: isExpanded ? pColor : C.textMuted, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </div>
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                            background: pColor,
                          }} />
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            background: `${pColor}15`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, color: pColor,
                          }}>
                            {group.projectKey.slice(0, 3)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {group.projectName}
                            </div>
                            {!isExpanded && (
                              <div style={{ fontSize: 10, color: C.textMuted }}>
                                {fmtDate(new Date(group.summaryStart).toISOString())} - {fmtDate(new Date(group.summaryEnd).toISOString())}
                              </div>
                            )}
                          </div>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                            background: `${pColor}15`, color: pColor, flexShrink: 0,
                          }}>
                            {group.items.length}
                          </span>
                        </div>
                        {/* Right: summary bar when collapsed, grid cells when expanded */}
                        <div style={{ display: 'flex', width: timelineRightWidth, flexShrink: 0, position: 'relative', height: '100%' }}>
                          {view === 'weekly' && weekHeaders ? (
                            weekHeaders.flatMap(wh => wh.days).map((day, di) => (
                              <div key={di} style={{
                                width: DAY_COL_W, minWidth: DAY_COL_W, flexShrink: 0, height: '100%',
                                background: day.isToday ? `${pColor}08` : day.isWeekend ? 'rgba(0,0,0,0.015)' : 'transparent',
                                borderRight: `1px solid ${C.border}`,
                              }} />
                            ))
                          ) : (
                            timeColumns.map((col, ci) => (
                              <div key={ci} style={{
                                width: colW, minWidth: colW, flexShrink: 0, height: '100%',
                                background: col.isCurrentMonth ? `${pColor}08` : 'transparent',
                                borderRight: ci < timeColumns.length - 1 ? `1px solid ${C.border}` : 'none',
                              }} />
                            ))
                          )}
                          {/* Summary bar when collapsed */}
                          {!isExpanded && group.summaryStart !== Infinity && (
                            <SummaryBar
                              startMs={group.summaryStart}
                              endMs={group.summaryEnd}
                              rangeStartMs={rangeStartMs}
                              totalMs={totalMs}
                              color={pColor}
                              label={`${group.items.length} issues · ${group.avgProgress}%${group.overdueCount > 0 ? ` · ${group.overdueCount} overdue` : ''}`}
                            />
                          )}
                          {todayPct !== null && (
                            <div style={{
                              position: 'absolute', top: 0, bottom: 0, left: `${todayPct}%`,
                              width: '2px', background: 'rgba(250,173,20,0.6)', pointerEvents: 'none',
                            }} />
                          )}
                        </div>
                      </div>

                      {/* Issue rows (expanded) */}
                      {isExpanded && group.items.map((item, idx) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: ROW_H }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          style={{
                            display: 'flex', alignItems: 'center',
                            borderBottom: `1px solid ${C.border}`,
                            overflow: 'hidden',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = `${pColor}05`)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Left: row info — sticky + indented */}
                          <div style={{
                            width: LEFT_W, minWidth: LEFT_W, flexShrink: 0,
                            display: 'flex', alignItems: 'center', padding: '0 16px 0 36px',
                            borderRight: `1px solid ${C.border}`, height: '100%', gap: 8,
                            background: '#fff', position: 'sticky', left: 0, zIndex: 5,
                          }}>
                            <span style={{ fontSize: '10px', color: C.textMuted, width: 18, textAlign: 'center', flexShrink: 0, fontWeight: 600 }}>{idx + 1}</span>
                            <span style={{
                              fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '5px',
                              background: item.isOverdue ? C.dangerBg : `${pColor}15`,
                              color: item.isOverdue ? C.danger : pColor, flexShrink: 0,
                              border: `1px solid ${item.isOverdue ? C.danger + '30' : pColor + '30'}`,
                            }}>
                              {item.issueKey}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: '10px', color: C.textMuted }}>
                                {fmtDate(item.startDate)} - {fmtDate(item.endDate)}
                              </div>
                            </div>
                            {item.assignee && (
                              <Tooltip title={item.assignee.name} placement="right">
                                <Avatar size={20} src={item.assignee.avatarUrl ?? undefined} style={{ background: `linear-gradient(135deg, ${pColor}, ${pColor}88)`, fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>
                                  {initials(item.assignee.name)}
                                </Avatar>
                              </Tooltip>
                            )}
                          </div>

                          {/* Right: bar area */}
                          <div style={{ display: 'flex', width: timelineRightWidth, flexShrink: 0, position: 'relative', height: '100%' }}>
                            {view === 'weekly' && weekHeaders ? (
                              weekHeaders.flatMap(wh => wh.days).map((day, di) => (
                                <div key={di} style={{
                                  width: DAY_COL_W, minWidth: DAY_COL_W, flexShrink: 0, height: '100%',
                                  background: day.isToday ? 'rgba(18,104,255,0.04)' : day.isWeekend ? 'rgba(0,0,0,0.012)' : (di % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.008)'),
                                  borderRight: `1px solid ${C.border}`,
                                }} />
                              ))
                            ) : (
                              timeColumns.map((col, ci) => (
                                <div key={ci} style={{
                                  width: colW, minWidth: colW, flexShrink: 0, height: '100%',
                                  background: col.isCurrentMonth ? 'rgba(18,104,255,0.03)' : (ci % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)'),
                                  borderRight: ci < timeColumns.length - 1 ? `1px solid ${C.border}` : 'none',
                                }} />
                              ))
                            )}
                            <div style={{ position: 'absolute', inset: 0 }}>
                              {isMilestone(item.issueTypeName)
                                ? <MilestoneDiamond item={item} rangeStartMs={rangeStartMs} totalMs={totalMs} projectColor={pColor} />
                                : <GanttBar item={item} rangeStartMs={rangeStartMs} totalMs={totalMs} projectColor={pColor} />
                              }
                              {todayPct !== null && (
                                <div style={{
                                  position: 'absolute', top: 0, bottom: 0, left: `${todayPct}%`,
                                  width: '2px', background: 'rgba(250,173,20,0.6)', pointerEvents: 'none',
                                }} />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
                padding: '10px 20px', borderTop: `1px solid ${C.border}`, background: C.bg,
              }}>
                {[
                  { color: C.primary, label: 'On Track' },
                  { color: C.danger,  label: 'Overdue' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: 20, height: 8, borderRadius: '4px', background: l.color, opacity: 0.8 }} />
                    <span style={{ fontSize: '11px', color: C.textSub, fontWeight: 600 }}>{l.label}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 20, height: 8, borderRadius: '4px', background: `linear-gradient(90deg, ${C.primary} 0%, ${C.primary}20 100%)` }} />
                  <span style={{ fontSize: '11px', color: C.textSub, fontWeight: 600 }}>Progress</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 10, height: 10, transform: 'rotate(45deg)', background: C.warning, border: '1.5px solid #d97706', borderRadius: 1 }} />
                  <span style={{ fontSize: '11px', color: C.textSub, fontWeight: 600 }}>Milestone</span>
                </div>
                {todayPct !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: 2, height: 14, borderRadius: '1px', background: C.warning }} />
                    <span style={{ fontSize: '11px', color: C.textSub, fontWeight: 600 }}>Today</span>
                  </div>
                )}
                {/* Project color indicators */}
                {projectGroups.length > 1 && (
                  <>
                    <div style={{ width: 1, height: 16, background: C.border, margin: '0 4px' }} />
                    {projectGroups.slice(0, 5).map((g, i) => (
                      <div key={g.projectId} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: getProjectColor(i) }} />
                        <span style={{ fontSize: '10px', color: C.textSub, fontWeight: 600 }}>{g.projectKey}</span>
                      </div>
                    ))}
                    {projectGroups.length > 5 && (
                      <span style={{ fontSize: '10px', color: C.textMuted }}>+{projectGroups.length - 5} more</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useGetAdminDashboardQuery();
  const { data: preferences } = useGetDashboardPreferencesQuery();

  const hiddenWidgets: WidgetType[] = preferences?.hiddenWidgets ?? [];
  const savedLayout = preferences?.layout ?? [];

  // Derive render order from saved preferences
  const orderedWidgets: WidgetType[] = (() => {
    const layoutOrder = savedLayout
      .filter(l => ADMIN_DASHBOARD_WIDGETS.includes(l.widgetId as WidgetType))
      .sort((a, b) => a.position.y - b.position.y)
      .map(l => l.widgetId as WidgetType);
    const missing = ADMIN_DASHBOARD_WIDGETS.filter(w => !layoutOrder.includes(w));
    return [...layoutOrder, ...missing];
  })();

  const isHidden = (id: WidgetType) => hiddenWidgets.includes(id);

  const handleProjectClick = (p: ProjectOverview) => {
    navigate(`/projects/${p.id}`);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Row gutter={[16, 16]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Col key={i} xs={12} sm={8} md={6} lg={4}>
              <Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: '16px', border: `1px solid ${C.border}` }}>
                <Skeleton active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[24, 24]}>
          <Col xs={24}><Card style={{ borderRadius: '16px', border: `1px solid ${C.border}` }}><Skeleton active paragraph={{ rows: 8 }} /></Card></Col>
        </Row>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert
        message="Failed to load admin dashboard"
        description="Check your connection or permissions and try again."
        type="error" showIcon
        action={<Button size="small" type="primary" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Retry</Button>}
      />
    );
  }

  // Hide data-dependent widgets when there's no project data
  const hasProjects = data.projectsOverview.length > 0;
  const hasIssues = data.stats.totalIssues > 0;
  const hasActivity = data.userActivity.length > 0;

  // Widget render map — each entry returns a full-width section or null if hidden
  const widgetSections: Record<WidgetType, React.ReactNode> = {
    kpi_cards: !isHidden('kpi_cards') ? (
      <AdminStatsRow stats={data.stats} />
    ) : null,

    projects_overview: !isHidden('projects_overview') && hasProjects ? (
      <ProjectsOverviewWidget projects={data.projectsOverview} onProjectClick={handleProjectClick} />
    ) : null,

    gantt_chart: !isHidden('gantt_chart') && hasIssues ? <GanttChartWidget projectsOverview={data.projectsOverview} /> : null,

    burndown: null,

    burnup: null,

    velocity_chart: null,

    sprint_health_overview: null,

    cumulative_flow: !isHidden('cumulative_flow') && hasIssues ? (
      <CumulativeFlowWidget projectsOverview={data.projectsOverview} />
    ) : null,

    // issues_by_project paired with overdue_by_project
    issues_by_project: hasIssues && (!isHidden('issues_by_project') || !isHidden('overdue_by_project')) ? (
      <Row gutter={[24, 24]}>
        {!isHidden('issues_by_project') && (
          <Col xs={24} lg={isHidden('overdue_by_project') ? 24 : 14}>
            <IssuesByProjectChart data={data.issuesByProject} />
          </Col>
        )}
        {!isHidden('overdue_by_project') && (
          <Col xs={24} lg={isHidden('issues_by_project') ? 24 : 10}>
            <OverdueByProjectWidget data={data.overdueByProject} />
          </Col>
        )}
      </Row>
    ) : null,

    overdue_by_project: null, // rendered inside issues_by_project row above

    top_contributors: null, // rendered inside sprint_health_overview row above

    system_events: !isHidden('system_events') && data.recentSystemEvents.length > 0 ? (
      <SystemEventsWidget events={data.recentSystemEvents} />
    ) : null,

    // Legacy / unused
    throughput_chart: null,
    burndown_burnup: null, // replaced by separate burndown + burnup

    // Employee / Manager widget types — not rendered in admin
    stats: null, assigned_issues: null, recent_activity: null, project_summaries: null,
    sprints_progress: null, due_soon: null, issues_by_status: null, issues_by_priority: null,
    issues_by_type: null, team_members: null, sprint_health: null, risk_issues: null,
    team_workload: null, team_velocity: null, team_activity: null,
  };

  // Groups where the first widget in the group triggers rendering the whole row
  const CHARTS_GROUP: WidgetType[]  = ['burndown', 'burnup'];
  const ISSUES_GROUP: WidgetType[]  = ['issues_by_project', 'overdue_by_project'];
  const HEALTH_GROUP: WidgetType[]  = ['sprint_health_overview', 'top_contributors'];

  // system_events always renders last regardless of saved order
  const orderedWithoutEvents = orderedWidgets.filter(w => w !== 'system_events');

  // Pre-seed removed widgets so they're skipped in the render loop
  const renderedIds = new Set<WidgetType>(['burndown', 'burnup', 'velocity_chart', 'sprint_health_overview', 'top_contributors']);
  const sections: React.ReactNode[] = [];
  for (const widgetId of orderedWithoutEvents) {
    if (renderedIds.has(widgetId)) continue;

    if (CHARTS_GROUP.includes(widgetId)) {
      CHARTS_GROUP.forEach(id => renderedIds.add(id));
      const section = widgetSections['burndown'];
      if (section) sections.push(<React.Fragment key="charts_group">{section}</React.Fragment>);
      continue;
    }

    if (ISSUES_GROUP.includes(widgetId)) {
      ISSUES_GROUP.forEach(id => renderedIds.add(id));
      const section = widgetSections['issues_by_project'];
      if (section) sections.push(<React.Fragment key="issues_group">{section}</React.Fragment>);
      continue;
    }

    if (HEALTH_GROUP.includes(widgetId)) {
      HEALTH_GROUP.forEach(id => renderedIds.add(id));
      const section = widgetSections['sprint_health_overview'];
      if (section) sections.push(<React.Fragment key="health_group">{section}</React.Fragment>);
      continue;
    }

    renderedIds.add(widgetId);
    const section = widgetSections[widgetId];
    if (section) sections.push(<React.Fragment key={widgetId}>{section}</React.Fragment>);
  }

  // Always append system_events last
  if (!isHidden('system_events')) {
    const eventsSection = widgetSections['system_events'];
    if (eventsSection) sections.push(<React.Fragment key="system_events">{eventsSection}</React.Fragment>);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <DashboardAISummary role="admin" dashboardData={data} />
      {sections}

      {/* Getting Started card when no projects exist */}
      {!hasProjects && (
        <Card style={CARD_STYLE}>
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #1268ff 0%, #06b6d4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Briefcase size={28} color="#fff" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>
              Welcome to ProjectFlow AI
            </div>
            <div style={{ fontSize: 14, color: C.textMuted, maxWidth: 460, margin: '0 auto 24px' }}>
              Create your first project to start tracking issues, sprints, and team progress. All dashboard widgets will populate automatically with real data.
            </div>
            <Button
              type="primary"
              size="large"
              icon={<Briefcase size={16} />}
              onClick={() => navigate('/projects')}
              style={{ borderRadius: 10, fontWeight: 600, height: 44, paddingInline: 28 }}
            >
              Create Your First Project
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
