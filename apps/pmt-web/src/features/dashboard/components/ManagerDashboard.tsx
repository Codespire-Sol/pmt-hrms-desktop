import React from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, Users, AlertTriangle, CheckCircle2, Clock, Zap,
  TrendingUp, Shield, Activity, AlarmClock, Ban, UserX, Star, RefreshCw,
} from 'lucide-react';
import { KpiCard, KpiCardProps } from './shared/KpiCard';
import { Row, Col, Card, Typography, Skeleton, Alert, Button, Avatar, Tooltip, Tag } from 'antd';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip,
  Legend, ResponsiveContainer, LineChart, BarChart,
} from 'recharts';
import { useGetManagerDashboardQuery, useGetDashboardPreferencesQuery } from '../dashboardApi';
import {
  ManagerStats, TeamWorkloadMember, SprintHealthItem, VelocityPoint,
  RiskIssue, ThroughputPoint, SystemEvent, CapacityStatus, SprintHealthStatus, RiskType, WidgetType,
} from '../types';
import { MANAGER_DASHBOARD_WIDGETS } from './DashboardCustomizer';
import { DashboardAISummary } from './DashboardAISummary';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';

const { Text } = Typography;

const C = {
  primary:   '#1268ff', primaryBg: 'rgba(18,104,255,0.08)',
  success:   '#10b981', successBg: 'rgba(16,185,129,0.08)',
  warning:   '#faad14', warningBg: 'rgba(250,173,20,0.08)',
  danger:    '#ff4d4f', dangerBg:  'rgba(255,77,79,0.08)',
  purple:    '#8b5cf6', purpleBg:  'rgba(139,92,246,0.08)',
  orange:    '#ff6b1a', orangeBg:  'rgba(255,107,26,0.08)',
  teal:      '#06b6d4', tealBg:    'rgba(6,182,212,0.08)',
  text:      '#101828', textSub:   '#4a5565', textMuted: '#6a7282',
  border:    '#e5e7eb', bg:        '#f9fafb', card:      '#ffffff',
  shadow:    '0 8px 16px rgba(16,24,40,0.06)',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'MMM d'); } catch { return iso; }
}

const CAPACITY_CONFIG: Record<CapacityStatus, { label: string; color: string; bg: string }> = {
  available:  { label: 'Available',  color: C.success,  bg: C.successBg },
  normal:     { label: 'Normal',     color: C.primary,  bg: C.primaryBg },
  overloaded: { label: 'Overloaded', color: C.danger,   bg: C.dangerBg  },
};

const SPRINT_HEALTH_CONFIG: Record<SprintHealthStatus, { label: string; color: string; bg: string }> = {
  on_track: { label: 'On Track',  color: C.success, bg: C.successBg },
  at_risk:  { label: 'At Risk',   color: C.warning, bg: C.warningBg },
  off_track:{ label: 'Off Track', color: C.danger,  bg: C.dangerBg  },
};

const RISK_CONFIG: Record<RiskType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  overdue:            { label: 'Overdue',       color: C.danger,  bg: C.dangerBg,  icon: <AlarmClock size={11} /> },
  blocked:            { label: 'Blocked',       color: C.orange,  bg: C.orangeBg,  icon: <Ban size={11} /> },
  no_assignee:        { label: 'No Assignee',   color: C.textMuted, bg: C.bg,      icon: <UserX size={11} /> },
  high_priority_stale:{ label: 'Stale',         color: C.purple,  bg: C.purpleBg,  icon: <Star size={11} /> },
};

const CUSTOM_TOOLTIP = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px',
  boxShadow: C.shadow, padding: '10px 14px', fontSize: '13px',
};

const ACTION_LABELS: Record<string, string> = {
  status_changed: 'changed status', comment_added: 'commented',
  issue_created: 'created', issue_updated: 'updated', sprint_started: 'started sprint',
};

// ─── Widgets ─────────────────────────────────────────────────────────────────

function ManagerStatsRow({ stats }: { stats: ManagerStats }) {
  const cards: KpiCardProps[] = [
    { icon: <Briefcase size={20} />, accent: C.primary, accentBg: C.primaryBg, label: 'My Projects', value: stats.managedProjects, delay: 0 },
    { icon: <Users size={20} />, accent: C.teal, accentBg: C.tealBg, label: 'Team Members', value: stats.totalTeamMembers, delay: 0.05 },
    { icon: <AlertTriangle size={20} />, accent: C.warning, accentBg: C.warningBg, label: 'Open Issues', value: stats.openIssues, sub: `${stats.overdueIssues} overdue`, delay: 0.1 },
    { icon: <CheckCircle2 size={20} />, accent: C.success, accentBg: C.successBg, label: 'Completion Rate', value: `${stats.completionRateThisWeek}%`, sub: 'This week', delay: 0.15 },
    { icon: <Zap size={20} />, accent: C.purple, accentBg: C.purpleBg, label: 'Active Sprints', value: stats.activeSprintsCount, delay: 0.2 },
    { icon: <Shield size={20} />, accent: C.danger, accentBg: C.dangerBg, label: 'Blocked', value: stats.blockedIssues, delay: 0.25 },
  ];
  return (
    <Row gutter={[16, 16]}>
      {cards.map(c => (
        <Col key={c.label} xs={24} sm={12} md={8} lg={4}>
          <KpiCard {...c} />
        </Col>
      ))}
    </Row>
  );
}

function SprintHealthWidget({ sprints }: { sprints: SprintHealthItem[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: C.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color={C.primary} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>Sprint Health</span>
          </div>
        }
        styles={{ body: { padding: '8px 0 12px' } }}
        style={{ border: `1px solid ${C.border}`, borderRadius: '12px', boxShadow: C.shadow, height: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {sprints.map((s, i) => {
            const cfg = SPRINT_HEALTH_CONFIG[s.healthStatus];
            // Compute from raw counts; fall back to normalised API value
            const pct = s.totalIssues > 0
              ? Math.round((s.completedIssues / s.totalIssues) * 100)
              : (s.completionPercentage > 1 ? Math.round(s.completionPercentage) : Math.round(s.completionPercentage * 100));
            return (
              <motion.div
                key={s.sprintId}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.07 }}
                style={{ padding: '14px 20px', borderBottom: i < sprints.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{s.sprintName}</div>
                    <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>
                      {s.projectName} · {s.daysRemaining}d remaining
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: cfg.color, background: cfg.bg }}>
                    {cfg.label}
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{ height: '8px', borderRadius: '4px', background: C.border, overflow: 'hidden', marginBottom: '8px' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, delay: 0.2 + i * 0.07 }}
                    style={{ height: '100%', borderRadius: '4px', background: pct >= 70 ? `linear-gradient(90deg, ${C.success} 0%, #34d399 100%)` : `linear-gradient(90deg, ${C.primary} 0%, #40a9ff 100%)` }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span style={{ fontSize: '12px', color: C.textSub }}><span style={{ fontWeight: 700, color: C.text }}>{s.completedIssues}</span>/{s.totalIssues} done</span>
                  <span style={{ fontSize: '12px', color: C.textSub }}><span style={{ fontWeight: 700, color: C.warning }}>{s.inProgressIssues}</span> in progress</span>
                  {s.blockedIssues > 0 && (
                    <span style={{ fontSize: '12px', color: C.danger, fontWeight: 600 }}>{s.blockedIssues} blocked</span>
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginLeft: 'auto' }}>{pct}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}

function RiskIssuesWidget({ issues }: { issues: RiskIssue[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: C.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={16} color={C.danger} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>Risk Issues</span>
          </div>
        }
        styles={{ body: { padding: '0 0 8px' } }}
        style={{ border: `1px solid ${C.border}`, borderRadius: '12px', boxShadow: C.shadow, height: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {issues.slice(0, 8).map((iss, i) => {
            const rCfg = RISK_CONFIG[iss.riskType];
            return (
              <motion.div
                key={iss.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.18 + i * 0.05 }}
                style={{ padding: '12px 20px', borderBottom: i < issues.slice(0, 8).length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', background: C.primaryBg, color: C.primary, padding: '1px 7px', borderRadius: '4px', fontWeight: 600 }}>{iss.issueKey}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', padding: '1px 7px', borderRadius: '4px', fontWeight: 600, color: rCfg.color, background: rCfg.bg }}>
                        {rCfg.icon}{rCfg.label}
                      </span>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: iss.priorityColor, display: 'inline-block', flexShrink: 0 }} />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{iss.title}</div>
                    <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{iss.projectName}</span>
                      {iss.daysOverdue && <span style={{ color: C.danger, fontWeight: 600 }}>{iss.daysOverdue}d overdue</span>}
                      {iss.blockedByCount > 0 && <span style={{ color: C.orange }}>blocked by {iss.blockedByCount}</span>}
                    </div>
                  </div>
                  {iss.assignee ? (
                    <Tooltip title={iss.assignee.name}>
                      <Avatar src={iss.assignee.avatarUrl ?? undefined} size={28} style={{ background: C.primary, fontSize: '10px', flexShrink: 0 }}>
                        {!iss.assignee.avatarUrl && initials(iss.assignee.name)}
                      </Avatar>
                    </Tooltip>
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <UserX size={12} color={C.textMuted} />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}

function TeamWorkloadWidget({ members }: { members: TeamWorkloadMember[] }) {
  const chartData = members.slice(0, 8).map(m => ({
    name: m.displayName.split(' ')[0],
    fullName: m.displayName,
    assigned: m.assignedCount,
    inProgress: m.inProgressCount,
    completed: m.completedCount,
    overdue: m.overdueCount,
    capacity: m.capacityStatus,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: C.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color={C.teal} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>Team Workload</span>
          </div>
        }
        styles={{ body: { padding: '16px 24px 20px' } }}
        style={{ border: `1px solid ${C.border}`, borderRadius: '12px', boxShadow: C.shadow, height: '100%' }}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textMuted }} />
            <YAxis tick={{ fontSize: 11, fill: C.textMuted }} />
            <RcTooltip
              contentStyle={CUSTOM_TOOLTIP}
              formatter={(v: number, name: string, props: any) => [v, name]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="assigned" name="Assigned" fill={C.primary} radius={[2, 2, 0, 0]} />
            <Bar dataKey="inProgress" name="In Progress" fill={C.warning} radius={[2, 2, 0, 0]} />
            <Bar dataKey="completed" name="Completed" fill={C.success} radius={[2, 2, 0, 0]} />
            <Bar dataKey="overdue" name="Overdue" fill={C.danger} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {/* capacity pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
          {members.slice(0, 8).map(m => {
            const cc = CAPACITY_CONFIG[m.capacityStatus];
            return (
              <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 9px', borderRadius: '20px', background: cc.bg, border: `1px solid ${cc.color}22` }}>
                <Avatar src={m.avatarUrl ?? undefined} size={18} style={{ background: C.primary, fontSize: '8px' }}>
                  {!m.avatarUrl && initials(m.displayName)}
                </Avatar>
                <span style={{ fontSize: '11px', fontWeight: 600, color: cc.color }}>{m.displayName.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}

function VelocityWidget({ data }: { data: VelocityPoint[] }) {
  const chartData = data.map(p => ({
    name: p.sprintName.replace(/Sprint /i, 'S'),
    fullName: p.sprintName,
    committed: p.committedIssues,
    completed: p.completedIssues,
    rate: p.completionRate,
    committedPts: p.committedPoints,
    completedPts: p.completedPoints,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: C.purpleBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color={C.purple} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>Team Velocity</span>
          </div>
        }
        styles={{ body: { padding: '16px 24px 20px' } }}
        style={{ border: `1px solid ${C.border}`, borderRadius: '12px', boxShadow: C.shadow, height: '100%' }}
      >
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 24, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textMuted }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: C.textMuted }} />
            <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 11, fill: C.textMuted }} domain={[0, 100]} />
            <RcTooltip
              contentStyle={CUSTOM_TOOLTIP}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
              formatter={(v: number, name: string) => name === 'Rate %' ? [`${v}%`, name] : [v, name]}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar yAxisId="left" dataKey="committed" name="Committed" fill={C.primaryBg.replace('0.08', '0.6')} stroke={C.primary} strokeWidth={1.5} radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="completed" name="Completed" fill={C.primary} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="rate" name="Rate %" stroke={C.success} strokeWidth={2.5} dot={{ r: 4, fill: C.success }} activeDot={{ r: 6 }} strokeDasharray="none" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </motion.div>
  );
}

function ThroughputWidget({ data }: { data: ThroughputPoint[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: C.orangeBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={16} color={C.orange} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>Throughput</span>
          </div>
        }
        styles={{ body: { padding: '16px 24px 20px' } }}
        style={{ border: `1px solid ${C.border}`, borderRadius: '12px', boxShadow: C.shadow, height: '100%' }}
      >
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="bucket" tickFormatter={v => { try { return format(new Date(v), 'MMM d'); } catch { return v; }}} tick={{ fontSize: 11, fill: C.textMuted }} />
            <YAxis tick={{ fontSize: 11, fill: C.textMuted }} />
            <RcTooltip contentStyle={CUSTOM_TOOLTIP} labelFormatter={v => { try { return format(new Date(v), 'MMM d, yyyy'); } catch { return v; }}} formatter={(v: number, n: string) => [v, n === 'created' ? 'Created' : 'Resolved']} />
            <Legend formatter={v => v === 'created' ? 'Created' : 'Resolved'} wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="created" stroke={C.primary} strokeWidth={2.5} dot={{ r: 4, fill: C.primary }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="resolved" stroke={C.success} strokeWidth={2.5} dot={{ r: 4, fill: C.success }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </motion.div>
  );
}

function TeamActivityWidget({ events }: { events: SystemEvent[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.32 }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: C.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={16} color={C.teal} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>Team Activity</span>
          </div>
        }
        styles={{ body: { padding: '0 0 8px' } }}
        style={{ border: `1px solid ${C.border}`, borderRadius: '12px', boxShadow: C.shadow, height: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.slice(0, 8).map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.35 + i * 0.04 }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 20px', borderBottom: i < events.slice(0, 8).length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}
              onMouseEnter={ev => (ev.currentTarget.style.background = C.bg)}
              onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
            >
              <Avatar src={e.actorAvatarUrl ?? undefined} size={26} style={{ background: C.primary, fontSize: '10px', flexShrink: 0 }}>
                {!e.actorAvatarUrl && initials(e.actorName)}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: C.text, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600 }}>{e.actorName.split(' ')[0]}</span>
                  {' '}<span style={{ color: C.textSub }}>{ACTION_LABELS[e.action] ?? e.action}</span>
                  {' '}<span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '140px', verticalAlign: 'bottom' }}>{e.entityTitle}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '3px', alignItems: 'center' }}>
                  {e.issueKey && <span style={{ fontSize: '10px', background: C.primaryBg, color: C.primary, padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>{e.issueKey}</span>}
                  <span style={{ fontSize: '10px', color: C.textMuted }}>{formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ManagerDashboard() {
  const { data, isLoading, error, refetch } = useGetManagerDashboardQuery();
  const { data: preferences } = useGetDashboardPreferencesQuery();

  const hiddenWidgets: WidgetType[] = preferences?.hiddenWidgets ?? [];
  const savedLayout = preferences?.layout ?? [];

  const orderedWidgets: WidgetType[] = (() => {
    const layoutOrder = savedLayout
      .filter(l => MANAGER_DASHBOARD_WIDGETS.includes(l.widgetId as WidgetType))
      .sort((a, b) => a.position.y - b.position.y)
      .map(l => l.widgetId as WidgetType);
    const missing = MANAGER_DASHBOARD_WIDGETS.filter(w => !layoutOrder.includes(w));
    return [...layoutOrder, ...missing];
  })();

  const isHidden = (id: WidgetType) => hiddenWidgets.includes(id);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Row gutter={[16, 16]}>{Array.from({ length: 6 }).map((_, i) => <Col key={i} xs={24} sm={12} md={8} lg={4}><Card styles={{ body: { padding: '20px' } }} style={{ borderRadius: '12px', border: `1px solid ${C.border}` }}><Skeleton active paragraph={{ rows: 1 }} /></Card></Col>)}</Row>
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={14}><Card style={{ borderRadius: '12px', border: `1px solid ${C.border}` }}><Skeleton active paragraph={{ rows: 8 }} /></Card></Col>
          <Col xs={24} lg={10}><Card style={{ borderRadius: '12px', border: `1px solid ${C.border}` }}><Skeleton active paragraph={{ rows: 8 }} /></Card></Col>
        </Row>
      </div>
    );
  }

  if (error || !data) {
    return <Alert message="Failed to load manager dashboard" type="error" showIcon action={<Button size="small" type="primary" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Retry</Button>} />;
  }

  // Widget section map — paired widgets rendered together
  const widgetSections: Record<WidgetType, React.ReactNode> = {
    kpi_cards: !isHidden('kpi_cards') ? (
      <ManagerStatsRow stats={data.stats} />
    ) : null,
    sprint_health: !isHidden('sprint_health') || !isHidden('risk_issues') ? (
      <Row gutter={[24, 24]}>
        {!isHidden('sprint_health') && (
          <Col xs={24} lg={isHidden('risk_issues') ? 24 : 14}>
            <SprintHealthWidget sprints={data.sprintHealth} />
          </Col>
        )}
        {!isHidden('risk_issues') && (
          <Col xs={24} lg={isHidden('sprint_health') ? 24 : 10}>
            <RiskIssuesWidget issues={data.riskIssues} />
          </Col>
        )}
      </Row>
    ) : null,
    risk_issues: null, // rendered in sprint_health's row
    team_workload: !isHidden('team_workload') || !isHidden('team_velocity') ? (
      <Row gutter={[24, 24]}>
        {!isHidden('team_workload') && (
          <Col xs={24} lg={isHidden('team_velocity') ? 24 : 12}>
            <TeamWorkloadWidget members={data.teamWorkload} />
          </Col>
        )}
        {!isHidden('team_velocity') && (
          <Col xs={24} lg={isHidden('team_workload') ? 24 : 12}>
            <VelocityWidget data={data.velocityData} />
          </Col>
        )}
      </Row>
    ) : null,
    team_velocity: null, // rendered in team_workload's row
    throughput_chart: !isHidden('throughput_chart') || !isHidden('team_activity') ? (
      <Row gutter={[24, 24]}>
        {!isHidden('throughput_chart') && (
          <Col xs={24} lg={isHidden('team_activity') ? 24 : 15}>
            <ThroughputWidget data={data.throughput} />
          </Col>
        )}
        {!isHidden('team_activity') && (
          <Col xs={24} lg={isHidden('throughput_chart') ? 24 : 9}>
            <TeamActivityWidget events={data.recentTeamActivity} />
          </Col>
        )}
      </Row>
    ) : null,
    team_activity: null, // rendered in throughput_chart's row
    // Admin / Employee widget types — not rendered in manager
    stats: null, assigned_issues: null, recent_activity: null, project_summaries: null,
    sprints_progress: null, due_soon: null, issues_by_status: null, issues_by_priority: null,
    issues_by_type: null, team_members: null, projects_overview: null, gantt_chart: null,
    issues_by_project: null, overdue_by_project: null, top_contributors: null, system_events: null,
    burndown_burnup: null, burndown: null, burnup: null, velocity_chart: null,
    sprint_health_overview: null, cumulative_flow: null,
  };

  // Grouped widget sets — render the "primary" widget of each pair
  const PAIR_PRIMARY: Partial<Record<WidgetType, WidgetType>> = {
    risk_issues: 'sprint_health',
    team_velocity: 'team_workload',
    team_activity: 'throughput_chart',
  };

  const renderedIds = new Set<WidgetType>();
  const sections: React.ReactNode[] = [];
  for (const widgetId of orderedWidgets) {
    if (renderedIds.has(widgetId)) continue;
    // If this widget is rendered as part of a pair, skip — it'll be rendered when its primary appears
    const primary = PAIR_PRIMARY[widgetId];
    if (primary) {
      renderedIds.add(widgetId);
      continue;
    }
    renderedIds.add(widgetId);
    const section = widgetSections[widgetId];
    if (section) sections.push(<React.Fragment key={widgetId}>{section}</React.Fragment>);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <DashboardAISummary role="manager" dashboardData={data} />
      {sections}
    </div>
  );
}
