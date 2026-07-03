import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIssueModal } from '../../issues/IssueDetailModal';
import { Row, Col, Card, Typography, Avatar, Space, Skeleton, Empty, Button, Tooltip } from 'antd';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import {
  CheckCircle2, RefreshCw, Plus, Clock, Target,
  Users, Activity, TrendingUp, User, MessageSquare,
  Link as LinkIcon, Send, AlertTriangle,
} from 'lucide-react';
import { Input, Form, Modal, List, Divider, message } from 'antd';
import { useState } from 'react';
import { useGetIssuesQuery } from '../../issues/issuesApi';
import { useGetProjectEpicsQuery } from '../../epics/epicsApi';
import { useUpdateProjectMutation } from '../projectsApi';
import type { Project } from '../projectsApi';
import { normalizeAvatarUrl } from '@/lib/utils';

const { Text, Title, Paragraph } = Typography;

const COLORS = {
  primary: '#1268ff',
  success: '#10b981',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#1890ff',
  purple: '#8b5cf6',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  cardBg: '#ffffff',
  appBg: '#f9fafb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

const STATUS_COLORS: Record<string, string> = {
  todo: '#e5e7eb',
  in_progress: COLORS.primary,
  done: COLORS.success,
  blocked: COLORS.danger,
};

const PRIORITY_COLORS: Record<string, string> = {
  highest: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  lowest: '#6b7280',
};

const DONUT_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.purple, '#14b8a6'];

interface Props {
  project: Project;
  projectId: string;
}

export function ProjectSummaryTab({ project, projectId }: Props) {
  const navigate = useNavigate();
  const { openIssue } = useIssueModal();
  const [commentText, setCommentText] = useState('');
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const [linkForm] = Form.useForm();

  const { data: issuesData, isLoading: issuesLoading } = useGetIssuesQuery(
    { projectId, filters: { limit: 200, page: 1 } },
    { skip: !projectId }
  );
  const { data: epicsData, isLoading: epicsLoading } = useGetProjectEpicsQuery(
    { projectId },
    { skip: !projectId }
  );
  const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();

  const issues = issuesData?.issues || [];
  const epics = epicsData || [];
  const stats = project.statistics;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const recentStats = useMemo(() => {
    const completed7d = issues.filter(
      (i) => i.status.category === 'done' && new Date(i.updatedAt) >= sevenDaysAgo
    ).length;
    const updated7d = issues.filter((i) => new Date(i.updatedAt) >= sevenDaysAgo).length;
    const created7d = issues.filter((i) => new Date(i.createdAt) >= sevenDaysAgo).length;
    const dueSoon = issues.filter(
      (i) => i.dueDate && new Date(i.dueDate) >= now && new Date(i.dueDate) <= sevenDaysAhead
    ).length;
    return { completed7d, updated7d, created7d, dueSoon };
  }, [issues]);

  // Status donut chart data
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    issues.forEach((i) => {
      const label = i.status.displayName || i.status.name;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [issues]);

  // Priority bar chart data
  const priorityChartData = useMemo(() => {
    const counts: Record<string, number> = {
      Highest: 0, High: 0, Medium: 0, Low: 0, Lowest: 0, None: 0,
    };
    issues.forEach((i) => {
      const p = i.priority?.name || 'None';
      const key = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
      if (key in counts) counts[key]++;
      else counts['None']++;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0);
  }, [issues]);

  // Types of work
  const typesData = useMemo(() => {
    const counts: Record<string, { count: number; color: string }> = {};
    issues.forEach((i) => {
      const t = i.type.displayName || i.type.name;
      if (!counts[t]) counts[t] = { count: 0, color: i.type.color };
      counts[t].count++;
    });
    const total = issues.length || 1;
    return Object.entries(counts)
      .map(([name, { count, color }]) => ({
        name,
        count,
        color,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [issues]);

  // Team workload
  const teamWorkload = useMemo(() => {
    const counts: Record<string, { count: number; avatarUrl?: string }> = {};
    issues.forEach((i) => {
      const name = i.assignee?.displayName || 'Unassigned';
      if (!counts[name]) counts[name] = { count: 0, avatarUrl: i.assignee?.avatarUrl };
      counts[name].count++;
    });
    const total = issues.length || 1;
    return Object.entries(counts)
      .map(([name, { count, avatarUrl }]) => ({
        name,
        count,
        avatarUrl,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [issues]);

  // Recent activity from latest updated issues
  const recentActivity = useMemo(() => {
    return [...issues]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
  }, [issues]);

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    try {
      const existing = project.overviewSummary?.comments || [];
      await updateProject({
        projectId,
        data: { overviewComments: [...existing, { content: commentText }] },
      }).unwrap();
      setCommentText('');
      message.success('Comment posted');
    } catch {
      message.error('Failed to post comment');
    }
  };

  const handleAddLink = async (values: { title: string; url: string; description?: string }) => {
    try {
      const existing = project.overviewSummary?.links || [];
      await updateProject({
        projectId,
        data: { overviewLinks: [...existing, values] },
      }).unwrap();
      setIsAddLinkModalOpen(false);
      linkForm.resetFields();
      message.success('Link added');
    } catch {
      message.error('Failed to add link');
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `about ${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  const topStatCards = [
    {
      icon: <CheckCircle2 size={20} color="#ffffff" />,
      iconBg: COLORS.success,
      value: issuesLoading ? '—' : recentStats.completed7d,
      label: 'completed',
      sub: 'in the last 7 days',
    },
    {
      icon: <RefreshCw size={20} color="#ffffff" />,
      iconBg: COLORS.primary,
      value: issuesLoading ? '—' : recentStats.updated7d,
      label: 'updated',
      sub: 'in the last 7 days',
    },
    {
      icon: <Plus size={20} color="#ffffff" />,
      iconBg: COLORS.purple,
      value: issuesLoading ? '—' : recentStats.created7d,
      label: 'created',
      sub: 'in the last 7 days',
    },
    {
      icon: <Clock size={20} color="#ffffff" />,
      iconBg: COLORS.warning,
      value: issuesLoading ? '—' : (stats?.dueSoonIssues ?? recentStats.dueSoon),
      label: 'due soon',
      sub: 'in the next 7 days',
    },
  ];

  const cardStyle = {
    border: `1px solid ${COLORS.border}`,
    borderRadius: '12px',
    background: COLORS.cardBg,
    boxShadow: COLORS.shadow,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Row 1: Stat Cards ── */}
      <Row gutter={[16, 16]}>
        {topStatCards.map((card) => (
          <Col key={card.label} xs={24} sm={12} lg={6}>
            <Card style={cardStyle} styles={{ body: { padding: '20px 24px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  backgroundColor: card.iconBg, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <Title level={2} style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1 }}>
                      {card.value}
                    </Title>
                    <Text style={{ fontSize: '14px', color: COLORS.textSecondary, fontWeight: 500 }}>
                      {card.label}
                    </Text>
                  </div>
                  <Text style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', display: 'block' }}>
                    {card.sub}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Row 2: Status Overview + Recent Activity ── */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            style={cardStyle}
            styles={{ body: { padding: '24px' } }}
            title={
              <Space>
                <Activity size={18} color={COLORS.primary} />
                <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>Status overview</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                style={{ color: COLORS.primary, fontWeight: 500, padding: 0 }}
                onClick={() => navigate(`/projects/${projectId}/issues`)}
              >
                View all work items
              </Button>
            }
          >
            {issuesLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : statusChartData.length === 0 ? (
              <Empty description="No issues yet" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0 }}>
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx={95}
                        cy={95}
                        innerRadius={62}
                        outerRadius={92}
                        dataKey="value"
                        strokeWidth={2}
                        stroke="#ffffff"
                      >
                        {statusChartData.map((_, idx) => (
                          <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none',
                  }}>
                    <Text style={{ fontSize: '24px', fontWeight: 700, display: 'block', color: COLORS.textPrimary, lineHeight: 1 }}>
                      {issues.length}
                    </Text>
                    <Text style={{ fontSize: '11px', color: COLORS.textSecondary, lineHeight: 1.3 }}>
                      Total work<br />item{issues.length !== 1 ? 's' : ''}
                    </Text>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '160px' }}>
                  {statusChartData.map((entry, idx) => (
                    <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '12px', height: '12px', borderRadius: '3px',
                        backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length], flexShrink: 0,
                      }} />
                      <Text style={{ flex: 1, fontSize: '13px', color: COLORS.textSecondary }}>{entry.name}</Text>
                      <Text style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary }}>{entry.value}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            style={{ ...cardStyle, height: '100%' }}
            styles={{ body: { padding: '24px', height: 'calc(100% - 57px)', overflowY: 'auto' } }}
            title={
              <Space>
                <Activity size={18} color={COLORS.primary} />
                <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>Recent activity</span>
              </Space>
            }
          >
            {issuesLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : recentActivity.length === 0 ? (
              <Empty description="No activity yet" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {recentActivity.map((issue, idx) => (
                  <div key={issue.id}>
                    <div style={{ display: 'flex', gap: '10px', padding: '10px 0', alignItems: 'flex-start' }}>
                      <Avatar
                        size={28}
                        src={normalizeAvatarUrl(issue.reporter?.avatarUrl)}
                        icon={<User size={14} />}
                        style={{ backgroundColor: COLORS.primary, flexShrink: 0, marginTop: '2px' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: '13px', color: COLORS.textPrimary, display: 'block', lineHeight: '1.4' }}>
                          <span style={{ fontWeight: 600 }}>{issue.reporter?.displayName || 'Someone'}</span>
                          {' updated '}
                          <span
                            style={{ color: COLORS.primary, cursor: 'pointer', fontWeight: 500 }}
                            onClick={() => openIssue(issue.id, projectId)}
                          >
                            {issue.issueKey}
                          </span>
                          {': '}
                          <span style={{ color: COLORS.textSecondary }}
                            title={issue.title}
                          >
                            {issue.title.length > 40 ? issue.title.slice(0, 40) + '…' : issue.title}
                          </span>
                        </Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '1px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: (issue.status.color || COLORS.primary) + '18',
                            color: issue.status.color || COLORS.primary,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {issue.status.displayName || issue.status.name}
                          </span>
                          <Text style={{ fontSize: '11px', color: '#9ca3af' }}>{timeAgo(issue.updatedAt)}</Text>
                        </div>
                      </div>
                    </div>
                    {idx < recentActivity.length - 1 && (
                      <div style={{ height: '1px', background: '#f1f5f9' }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Row 3: Priority Breakdown + Types of Work ── */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card
            style={cardStyle}
            styles={{ body: { padding: '24px' } }}
            title={
              <Space>
                <TrendingUp size={18} color={COLORS.primary} />
                <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>Priority breakdown</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                style={{ color: COLORS.primary, fontWeight: 500, padding: 0 }}
                onClick={() => navigate(`/projects/${projectId}/settings`)}
              >
                How to manage priorities for spaces
              </Button>
            }
          >
            {issuesLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : priorityChartData.length === 0 ? (
              <Empty description="No issues yet" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={priorityChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: COLORS.textSecondary }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: COLORS.textSecondary }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReTooltip
                    cursor={{ fill: 'rgba(18,104,255,0.05)' }}
                    contentStyle={{ borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '12px' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {priorityChartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={PRIORITY_COLORS[entry.name.toLowerCase()] || COLORS.textSecondary}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            style={cardStyle}
            styles={{ body: { padding: '24px' } }}
            title={
              <Space>
                <Target size={18} color={COLORS.primary} />
                <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>Types of work</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                style={{ color: COLORS.primary, fontWeight: 500, padding: 0 }}
                onClick={() => navigate(`/projects/${projectId}/issues`)}
              >
                View all items
              </Button>
            }
          >
            {issuesLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : typesData.length === 0 ? (
              <Empty description="No issues yet" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: '0 16px',
                  marginBottom: '8px',
                  padding: '0 0 6px 0',
                  borderBottom: `1px solid ${COLORS.border}`,
                }}>
                  <Text style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</Text>
                  <Text style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Distribution</Text>
                  <div style={{ width: '40px' }} />
                </div>
                {typesData.map((t) => (
                  <div key={t.name} style={{
                    display: 'grid', gridTemplateColumns: '1fr 160px auto',
                    gap: '0 16px', alignItems: 'center', padding: '10px 0',
                    borderBottom: `1px solid #f8fafc`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        backgroundColor: t.color || COLORS.primary, flexShrink: 0,
                      }} />
                      <Text style={{ fontSize: '13px', color: COLORS.textPrimary, fontWeight: 500 }}>{t.name}</Text>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${t.percent}%`, height: '100%',
                        background: `linear-gradient(90deg, ${COLORS.primary} 0%, #40a9ff 100%)`,
                        borderRadius: '4px', transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <Text style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary, width: '40px', textAlign: 'right' }}>
                      {t.percent}%
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Row 4: Team Workload + Epic Progress ── */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card
            style={cardStyle}
            styles={{ body: { padding: '24px' } }}
            title={
              <Space>
                <Users size={18} color={COLORS.primary} />
                <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>Team workload</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                style={{ color: COLORS.primary, fontWeight: 500, padding: 0 }}
                onClick={() => navigate(`/projects/${projectId}/members`)}
              >
                Reassign work items to get the right balance
              </Button>
            }
          >
            {issuesLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : teamWorkload.length === 0 ? (
              <Empty description="No assignments yet" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 160px',
                  gap: '0 16px', marginBottom: '8px', padding: '0 0 6px 0',
                  borderBottom: `1px solid ${COLORS.border}`,
                }}>
                  <Text style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignee</Text>
                  <Text style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Work distribution</Text>
                </div>
                {teamWorkload.map((member) => (
                  <div key={member.name} style={{
                    display: 'grid', gridTemplateColumns: '1fr 160px',
                    gap: '0 16px', alignItems: 'center', padding: '10px 0',
                    borderBottom: `1px solid #f8fafc`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar
                        size={28}
                        src={normalizeAvatarUrl(member.avatarUrl)}
                        icon={<User size={14} />}
                        style={{ backgroundColor: member.avatarUrl ? 'transparent' : COLORS.primary, flexShrink: 0 }}
                      />
                      <Text style={{ fontSize: '13px', color: COLORS.textPrimary, fontWeight: 500 }}>{member.name}</Text>
                    </div>
                    <Tooltip title={`${member.count} issue${member.count !== 1 ? 's' : ''} (${member.percent}%)`}>
                      <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', cursor: 'default' }}>
                        <div style={{
                          width: `${member.percent}%`, height: '100%',
                          background: `linear-gradient(90deg, ${COLORS.primary} 0%, #40a9ff 100%)`,
                          borderRadius: '4px', transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            style={cardStyle}
            styles={{ body: { padding: '24px' } }}
            title={
              <Space>
                <Target size={18} color={COLORS.primary} />
                <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>Epic progress</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                style={{ color: COLORS.primary, fontWeight: 500, padding: 0 }}
                onClick={() => navigate(`/projects/${projectId}/backlog`)}
              >
                What is an epic?
              </Button>
            }
          >
            {epicsLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : epics.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', width: '48px', height: '48px' }}>
                  {[COLORS.border, COLORS.border, COLORS.border, COLORS.primary].map((c, i) => (
                    <div key={i} style={{
                      borderRadius: '4px',
                      backgroundColor: c,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {i === 3 && <Plus size={14} color="#fff" />}
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Text style={{ display: 'block', fontWeight: 600, color: COLORS.textPrimary, marginBottom: '4px' }}>Epic progress</Text>
                  <Text style={{ fontSize: '13px', color: COLORS.textSecondary }}>
                    Use epics to track larger initiatives in your space.{' '}
                    <span
                      style={{ color: COLORS.primary, cursor: 'pointer', fontWeight: 500 }}
                      onClick={() => navigate(`/projects/${projectId}/backlog`)}
                    >
                      What is an epic?
                    </span>
                  </Text>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {epics.slice(0, 6).map((epic, idx) => (
                  <div key={epic.id} style={{
                    padding: '10px 0',
                    borderBottom: idx < Math.min(epics.length, 6) - 1 ? `1px solid #f8fafc` : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '10px', height: '10px', borderRadius: '3px',
                          backgroundColor: epic.color || COLORS.purple, flexShrink: 0,
                        }} />
                        <Text style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary }}>{epic.name}</Text>
                      </div>
                      <Text style={{ fontSize: '12px', fontWeight: 600, color: COLORS.primary }}>{epic.progress}%</Text>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${epic.progress}%`, height: '100%',
                        backgroundColor: epic.color || COLORS.primary,
                        borderRadius: '3px', transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <Text style={{ fontSize: '11px', color: COLORS.textSecondary, marginTop: '4px', display: 'block' }}>
                      {epic.stats.completedIssues}/{epic.stats.totalIssues} issues done
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Row 5: Discussion + Links ── */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            style={cardStyle}
            styles={{ body: { padding: '24px' } }}
            title={
              <Space>
                <MessageSquare size={18} color={COLORS.primary} />
                <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>Project discussion</span>
              </Space>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Avatar size={36} style={{ backgroundColor: COLORS.primary, flexShrink: 0 }} icon={<User size={18} />} />
                <div style={{ flex: 1 }}>
                  <Input.TextArea
                    placeholder="Write a comment or update about the project..."
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    style={{ borderRadius: '10px', padding: '10px 14px', border: `1px solid ${COLORS.border}`, fontSize: '14px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <Button
                      type="primary"
                      icon={<Send size={14} />}
                      loading={isUpdating}
                      onClick={handlePostComment}
                      style={{ borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: COLORS.primary }}
                    >
                      Post comment
                    </Button>
                  </div>
                </div>
              </div>

              {project.overviewSummary?.comments?.length ? (
                <>
                  <Divider style={{ margin: '4px 0' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[...(project.overviewSummary.comments)].reverse().map((comment: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <Avatar
                          size={32}
                          src={normalizeAvatarUrl(comment.authorAvatar || comment.author?.avatarUrl)}
                          icon={<User size={14} />}
                          style={{ backgroundColor: COLORS.primary, flexShrink: 0, marginTop: '2px' }}
                        />
                        <div style={{
                          flex: 1, backgroundColor: '#f8fafc', padding: '10px 14px',
                          borderRadius: '0 10px 10px 10px', border: '1px solid #f1f5f9',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <Text strong style={{ fontSize: '13px', color: COLORS.textPrimary }}>
                              {comment.authorName || comment.author?.displayName || 'Team Member'}
                            </Text>
                            <Text style={{ fontSize: '11px', color: '#9ca3af' }}>
                              {comment.createdAt ? timeAgo(comment.createdAt) : 'Just now'}
                            </Text>
                          </div>
                          <Paragraph style={{ margin: 0, color: COLORS.textSecondary, fontSize: '13px', lineHeight: '1.5' }}>
                            {comment.content}
                          </Paragraph>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <MessageSquare size={28} color={COLORS.border} style={{ marginBottom: '8px' }} />
                  <Text type="secondary">No discussion yet. Start the conversation!</Text>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            style={cardStyle}
            styles={{ body: { padding: '24px' } }}
            title={
              <Space>
                <LinkIcon size={18} color={COLORS.primary} />
                <span style={{ fontWeight: 600, color: COLORS.textPrimary }}>Useful links</span>
              </Space>
            }
            extra={
              <Button
                type="text"
                icon={<Plus size={16} />}
                style={{ color: COLORS.primary, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setIsAddLinkModalOpen(true)}
              >
                Add
              </Button>
            }
          >
            {!project.overviewSummary?.links?.length ? (
              <div style={{ padding: '16px 0', textAlign: 'center' }}>
                <Text type="secondary" italic>No links added yet.</Text>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {project.overviewSummary.links.map((link: any, idx: number) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '10px',
                      border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary,
                      textDecoration: 'none', transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = COLORS.primary;
                      (e.currentTarget as HTMLElement).style.background = `${COLORS.primary}05`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = COLORS.border;
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      backgroundColor: `${COLORS.primary}12`, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <LinkIcon size={14} color={COLORS.primary} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ display: 'block', fontSize: '13px' }}
                        ellipsis={{ tooltip: link.title }}>{link.title}</Text>
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}
                        ellipsis={{ tooltip: link.url }}>{link.url}</Text>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Add Link Modal */}
      <Modal
        title="Add useful link"
        open={isAddLinkModalOpen}
        onCancel={() => { setIsAddLinkModalOpen(false); linkForm.resetFields(); }}
        footer={null}
        destroyOnClose
        width={520}
      >
        <Form form={linkForm} layout="vertical" onFinish={handleAddLink} style={{ marginTop: '16px' }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter a title' }]}>
            <Input placeholder="e.g. Project Documentation" />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true, message: 'Please enter a URL' }, { type: 'url', message: 'Please enter a valid URL' }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea placeholder="A brief description of the link..." rows={2} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setIsAddLinkModalOpen(false); linkForm.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={isUpdating}>Add link</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
