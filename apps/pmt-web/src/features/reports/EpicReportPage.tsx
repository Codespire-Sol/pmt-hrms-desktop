import { useParams, Link } from 'react-router-dom';
import {
  Card, Skeleton, Empty, Statistic, Row, Col, Typography, Tag, Table, Progress,
} from 'antd';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetEpicReportQuery } from './reportsApi';
import type { EpicReportIssue } from './reportsApi';

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
    title: 'Status',
    dataIndex: 'statusCategory',
    key: 'status',
    width: 120,
    render: (cat: string | null, row: EpicReportIssue) => (
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
  {
    title: 'Completed',
    dataIndex: 'completedAt',
    key: 'completedAt',
    width: 120,
    render: (d: string | null) => d
      ? <Text style={{ fontSize: 12 }}>{dayjs(d).format('MMM D, YYYY')}</Text>
      : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
  },
];

export function EpicReportPage() {
  const { epicId } = useParams<{ epicId: string }>();
  const { data, isLoading } = useGetEpicReportQuery(epicId!, { skip: !epicId });

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
        <Empty description="Epic report not available" />
      </div>
    );
  }

  const { epic, stats, burndown, issues } = data;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Back link */}
      <Link
        to=".."
        relative="path"
        style={{ fontSize: 13, color: COLORS.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}
      >
        <ArrowLeftOutlined /> Back to Epics
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Title level={4} style={{ margin: 0, color: COLORS.textPrimary }}>{epic.name}</Title>
          <Tag color={epic.color} style={{ margin: 0 }}>{epic.status.replace('_', ' ')}</Tag>
        </div>
        {(epic.startDate || epic.endDate) && (
          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
            {epic.startDate ? dayjs(epic.startDate).format('MMM D, YYYY') : '—'}
            {' → '}
            {epic.endDate ? dayjs(epic.endDate).format('MMM D, YYYY') : '—'}
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

      {/* Burndown Chart */}
      {burndown.length > 0 && (
        <Card style={{ borderColor: COLORS.border, marginBottom: 24 }}>
          <Title level={5} style={{ marginTop: 0 }}>Epic Burndown</Title>
          <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
            Issues remaining vs. completed over the epic duration.
          </Text>
          <ResponsiveContainer width="100%" height={320} style={{ marginTop: 16 }}>
            <LineChart data={burndown} margin={{ top: 8, right: 20, bottom: 40, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => dayjs(v).format('MMM D')}
                tick={{ fontSize: 11 }}
                label={{ value: 'Date', position: 'insideBottom', offset: -10, fontSize: 12 }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                label={{ value: 'Issues', angle: -90, position: 'insideLeft', fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                labelFormatter={(l) => dayjs(l).format('MMM D, YYYY')}
              />
              <Legend verticalAlign="top" />
              <ReferenceLine
                y={0}
                stroke={COLORS.border}
              />
              <Line
                type="monotone"
                dataKey="remaining"
                name="Remaining"
                stroke={COLORS.danger}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke={COLORS.success}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="Total"
                stroke={COLORS.textMuted}
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Issues Table */}
      <Card style={{ borderColor: COLORS.border }}>
        <Title level={5} style={{ marginTop: 0 }}>Issues ({issues.length})</Title>
        <Table
          dataSource={issues}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'No issues in this epic' }}
        />
      </Card>
    </div>
  );
}

export default EpicReportPage;
