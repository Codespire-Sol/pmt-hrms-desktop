import { useParams, Link } from 'react-router-dom';
import {
  Card, Skeleton, Empty, Statistic, Row, Col, Typography, Tag, Table, Progress,
} from 'antd';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetVersionReportQuery } from './reportsApi';
import type { VersionReportIssue } from './reportsApi';
import { useGetVersionQuery } from '../versions/versionsApi';

const { Title, Text } = Typography;

const COLORS = {
  primary:     '#1268ff',
  success:     '#52c41a',
  warning:     '#faad14',
  danger:      '#ff4d4f',
  border:      '#e5e7eb',
  textPrimary: '#101828',
  textMuted:   '#6a7282',
};

const STATUS_COLOR: Record<string, string> = {
  done:        'success',
  in_progress: 'processing',
  to_do:       'default',
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'red',
  high:     'orange',
  medium:   'gold',
  low:      'blue',
  lowest:   'default',
};

const TYPE_COLOR: Record<string, string> = {
  bug:         '#ff4d4f',
  story:       '#1890ff',
  task:        '#52c41a',
  epic:        '#722ed1',
  improvement: '#13c2c2',
};

const PIE_COLORS = [COLORS.success, COLORS.primary, COLORS.textMuted];

interface PieLabelProps {
  cx: number; cy: number; midAngle: number; innerRadius: number;
  outerRadius: number; percent: number; name: string;
}

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: PieLabelProps) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

const columns = [
  {
    title: 'Key',
    dataIndex: 'issueKey',
    key: 'issueKey',
    width: 110,
    render: (key: string) => <Text code style={{ fontSize: 12 }}>{key}</Text>,
  },
  {
    title: 'Title',
    dataIndex: 'title',
    key: 'title',
    ellipsis: true,
  },
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    render: (t: string | null) => t ? (
      <Tag color={TYPE_COLOR[t.toLowerCase()] ?? 'default'} style={{ margin: 0 }}>{t}</Tag>
    ) : <Text type="secondary">—</Text>,
  },
  {
    title: 'Status',
    dataIndex: 'statusCategory',
    key: 'status',
    width: 120,
    render: (cat: string | null, row: VersionReportIssue) => (
      <Tag color={STATUS_COLOR[cat ?? ''] ?? 'default'} style={{ margin: 0 }}>
        {row.status ?? cat ?? '—'}
      </Tag>
    ),
  },
  {
    title: 'Priority',
    dataIndex: 'priority',
    key: 'priority',
    width: 100,
    render: (p: string | null) => p
      ? <Tag color={PRIORITY_COLOR[p.toLowerCase()] ?? 'default'} style={{ margin: 0 }}>{p}</Tag>
      : <Text type="secondary">—</Text>,
  },
  {
    title: 'Assignee',
    dataIndex: 'assignee',
    key: 'assignee',
    width: 130,
    render: (a: string | null) => <Text style={{ fontSize: 13 }}>{a ?? '—'}</Text>,
  },
  {
    title: 'Points',
    dataIndex: 'storyPoints',
    key: 'storyPoints',
    width: 80,
    align: 'right' as const,
    render: (sp: number | null) => <Text style={{ fontSize: 13 }}>{sp ?? '—'}</Text>,
  },
];

const VERSION_STATUS_TAG: Record<string, string> = {
  unreleased: 'warning',
  released:   'success',
  archived:   'default',
};

export function VersionReportPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const { data, isLoading } = useGetVersionReportQuery(versionId!, { skip: !versionId });
  const { data: versionData } = useGetVersionQuery(versionId!, { skip: !versionId });

  if (isLoading) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <Empty description="Version report not available" />
      </div>
    );
  }

  const { version, stats, scopeTimeline, issues } = data;

  const pieData = [
    { name: 'Completed', value: stats.completedIssues },
    { name: 'In Progress', value: stats.inProgressIssues },
    { name: 'To Do', value: stats.todoIssues },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Back link */}
      <Link
        to={versionData?.projectId ? `/projects/${versionData.projectId}/versions` : '/projects'}
        style={{ fontSize: 13, color: COLORS.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}
      >
        <ArrowLeftOutlined /> Back to Versions
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Title level={4} style={{ margin: 0, color: COLORS.textPrimary }}>
            Version: {version.name}
          </Title>
          <Tag color={VERSION_STATUS_TAG[version.status] ?? 'default'} style={{ margin: 0 }}>
            {version.status.charAt(0).toUpperCase() + version.status.slice(1)}
          </Tag>
        </div>
        {(version.startDate || version.releaseDate) && (
          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
            {version.startDate ? dayjs(version.startDate).format('MMM D, YYYY') : '—'}
            {' → '}
            {version.releaseDate ? dayjs(version.releaseDate).format('MMM D, YYYY') : 'No release date'}
          </Text>
        )}
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ borderColor: COLORS.border, textAlign: 'center' }}>
            <Statistic title="Total Issues" value={stats.totalIssues} valueStyle={{ color: COLORS.primary }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderColor: COLORS.border, textAlign: 'center' }}>
            <Statistic title="Completed" value={stats.completedIssues} valueStyle={{ color: COLORS.success }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderColor: COLORS.border, textAlign: 'center' }}>
            <Statistic
              title="Story Points"
              value={stats.completedStoryPoints}
              suffix={`/ ${stats.totalStoryPoints}`}
              valueStyle={{ color: COLORS.warning }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderColor: COLORS.border, textAlign: 'center' }}>
            <Statistic
              title="Progress"
              value={stats.progress}
              suffix="%"
              valueStyle={{ color: stats.progress === 100 ? COLORS.success : COLORS.primary }}
            />
            <Progress
              percent={stats.progress}
              showInfo={false}
              strokeColor={stats.progress === 100 ? COLORS.success : COLORS.primary}
              size="small"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* Scope Timeline */}
        {scopeTimeline.length > 0 && (
          <Col span={16}>
            <Card style={{ borderColor: COLORS.border }}>
              <Title level={5} style={{ marginTop: 0 }}>Scope Timeline</Title>
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                Total vs. completed issues over time (last 30 days of activity).
              </Text>
              <ResponsiveContainer width="100%" height={280} style={{ marginTop: 12 }}>
                <AreaChart data={scopeTimeline} margin={{ top: 8, right: 16, bottom: 40, left: 10 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => dayjs(v).format('MMM D')}
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Date', position: 'insideBottom', offset: -10, fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    labelFormatter={(l) => dayjs(l).format('MMM D, YYYY')}
                  />
                  <Legend verticalAlign="top" />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke={COLORS.primary}
                    fill="url(#colorTotal)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke={COLORS.success}
                    fill="url(#colorCompleted)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}

        {/* Pie Chart */}
        {pieData.length > 0 && (
          <Col span={scopeTimeline.length > 0 ? 8 : 24}>
            <Card style={{ borderColor: COLORS.border }}>
              <Title level={5} style={{ marginTop: 0 }}>Issue Breakdown</Title>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomLabel as any}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}
      </Row>

      {/* Issues Table */}
      <Card style={{ borderColor: COLORS.border }}>
        <Title level={5} style={{ marginTop: 0 }}>Issues ({issues.length})</Title>
        <Table
          dataSource={issues}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'No issues in this version' }}
        />
      </Card>
    </div>
  );
}

export default VersionReportPage;
