import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Select,
  Table,
  Tag,
  Typography,
  Skeleton,
  Empty,
  Statistic,
  Row,
  Col,
  Progress,
  Avatar,
  Divider,
  Descriptions,
  Space,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  AimOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { format } from 'date-fns';
import {
  useGetSprintsQuery,
  Sprint,
  SprintIssue,
} from '../sprints/sprintsApi';
import { normalizeAvatarUrl } from '@/lib/utils';

const { Title, Text } = Typography;

const COLORS = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
};

const statusColorMap: Record<string, string> = {
  planned: 'blue',
  active: 'green',
  completed: 'default',
  cancelled: 'red',
};

// ---------- Issue Table Columns ----------

const issueColumns: ColumnsType<SprintIssue> = [
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
    width: 50,
    render: (type) => (
      <span style={{ fontSize: 16 }} title={type.name}>
        {type.icon}
      </span>
    ),
  },
  {
    title: 'Key',
    dataIndex: 'issueKey',
    key: 'issueKey',
    width: 100,
    render: (key) => (
      <Text style={{ fontFamily: 'monospace', fontSize: 12, color: COLORS.primary }}>
        {key}
      </Text>
    ),
  },
  {
    title: 'Title',
    dataIndex: 'title',
    key: 'title',
    ellipsis: true,
    render: (title) => <Text>{title}</Text>,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 130,
    render: (status) => (
      <Tag
        style={{
          backgroundColor: `${status.color}18`,
          color: status.color,
          border: `1px solid ${status.color}40`,
          borderRadius: 4,
        }}
      >
        {status.displayName || status.name}
      </Tag>
    ),
  },
  {
    title: 'Priority',
    dataIndex: 'priority',
    key: 'priority',
    width: 60,
    align: 'center',
    render: (priority) => priority ? (
      <span title={priority.displayName || priority.name}>{priority.icon}</span>
    ) : (
      <Text type="secondary">-</Text>
    ),
  },
  {
    title: 'Assignee',
    dataIndex: 'assignee',
    key: 'assignee',
    width: 140,
    render: (assignee) =>
      assignee ? (
        <Space size={6}>
          <Avatar
            size={20}
            src={normalizeAvatarUrl(assignee.avatarUrl)}
            icon={<UserOutlined />}
          />
          <Text style={{ fontSize: 12 }}>{assignee.displayName}</Text>
        </Space>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>Unassigned</Text>
      ),
  },
  {
    title: 'SP',
    dataIndex: 'storyPoints',
    key: 'storyPoints',
    width: 60,
    align: 'center',
    render: (sp) =>
      sp != null ? (
        <Tag
          style={{
            borderRadius: '50%',
            width: 26,
            height: 26,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: '#f0f5ff',
            color: COLORS.primary,
            border: `1px solid ${COLORS.primary}30`,
            padding: 0,
          }}
        >
          {sp}
        </Tag>
      ) : (
        <Text type="secondary">-</Text>
      ),
  },
];

// ---------- Member Contribution Row ----------

interface MemberContribution {
  id: string;
  displayName: string;
  avatarUrl?: string;
  completedIssues: number;
  totalIssues: number;
  completedPoints: number;
  totalPoints: number;
}

// ---------- Main Component ----------

export function SprintReportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>(undefined);

  // Fetch all sprints for the project
  const {
    data: sprintsData,
    isLoading: sprintsLoading,
  } = useGetSprintsQuery({ projectId: projectId! });

  const sprints = sprintsData?.sprints || [];

  // Auto-select the first completed or active sprint
  const effectiveSprintId = useMemo(() => {
    if (selectedSprintId) return selectedSprintId;
    const completed = sprints.find((s) => s.status === 'completed');
    if (completed) return completed.id;
    const active = sprints.find((s) => s.status === 'active');
    if (active) return active.id;
    return sprints[0]?.id;
  }, [selectedSprintId, sprints]);

  const selectedSprint = useMemo(
    () => sprints.find((s) => s.id === effectiveSprintId) || null,
    [sprints, effectiveSprintId]
  );

  // Split issues into completed vs incomplete
  const { completedIssues, incompleteIssues } = useMemo(() => {
    if (!selectedSprint?.issues) return { completedIssues: [], incompleteIssues: [] };
    const completed: SprintIssue[] = [];
    const incomplete: SprintIssue[] = [];
    for (const issue of selectedSprint.issues) {
      if (issue.status?.category === 'done') {
        completed.push(issue);
      } else {
        incomplete.push(issue);
      }
    }
    return { completedIssues: completed, incompleteIssues: incomplete };
  }, [selectedSprint]);

  // Per-member contribution
  const memberContributions = useMemo((): MemberContribution[] => {
    if (!selectedSprint?.issues) return [];
    const memberMap = new Map<string, MemberContribution>();

    for (const issue of selectedSprint.issues) {
      const assignee = issue.assignee;
      const key = assignee?.id || '__unassigned__';

      if (!memberMap.has(key)) {
        memberMap.set(key, {
          id: key,
          displayName: assignee?.displayName || 'Unassigned',
          avatarUrl: assignee?.avatarUrl,
          completedIssues: 0,
          totalIssues: 0,
          completedPoints: 0,
          totalPoints: 0,
        });
      }

      const member = memberMap.get(key)!;
      member.totalIssues += 1;
      member.totalPoints += issue.storyPoints || 0;

      if (issue.status?.category === 'done') {
        member.completedIssues += 1;
        member.completedPoints += issue.storyPoints || 0;
      }
    }

    return Array.from(memberMap.values()).sort((a, b) => b.completedPoints - a.completedPoints);
  }, [selectedSprint]);

  const memberColumns: ColumnsType<MemberContribution> = [
    {
      title: 'Team Member',
      key: 'member',
      render: (_, record) => (
        <Space size={8}>
          <Avatar
            size={28}
            src={normalizeAvatarUrl(record.avatarUrl)}
            icon={<UserOutlined />}
          />
          <Text strong style={{ fontSize: 13 }}>{record.displayName}</Text>
        </Space>
      ),
    },
    {
      title: 'Issues Completed',
      key: 'issues',
      align: 'center',
      width: 140,
      render: (_, record) => (
        <Text>
          <Text strong>{record.completedIssues}</Text>
          <Text type="secondary"> / {record.totalIssues}</Text>
        </Text>
      ),
    },
    {
      title: 'Story Points',
      key: 'points',
      align: 'center',
      width: 140,
      render: (_, record) => (
        <Text>
          <Text strong style={{ color: COLORS.primary }}>{record.completedPoints}</Text>
          <Text type="secondary"> / {record.totalPoints}</Text>
        </Text>
      ),
    },
    {
      title: 'Completion',
      key: 'completion',
      width: 200,
      render: (_, record) => {
        const percent = record.totalIssues > 0
          ? Math.round((record.completedIssues / record.totalIssues) * 100)
          : 0;
        return (
          <Progress
            percent={percent}
            size="small"
            strokeColor={percent >= 80 ? COLORS.success : percent >= 50 ? COLORS.warning : COLORS.danger}
          />
        );
      },
    },
  ];

  // ---------- Render ----------

  if (sprintsLoading) {
    return (
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 2 }} />
        <Skeleton active paragraph={{ rows: 8 }} style={{ marginTop: 24 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>
            Sprint Report
          </Title>
          <Text type="secondary">
            Review sprint performance, completion metrics, and team contributions
          </Text>
        </div>
      </div>

      {/* Sprint Selector */}
      <Card
        style={{ marginBottom: 24, borderRadius: 8 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Space>
          <Text strong>Sprint:</Text>
          <Select
            value={effectiveSprintId}
            onChange={(value) => setSelectedSprintId(value)}
            style={{ minWidth: 260 }}
            placeholder="Select a sprint"
            options={sprints.map((s) => ({
              value: s.id,
              label: (
                <Space>
                  <span>{s.name}</span>
                  <Tag
                    color={statusColorMap[s.status] || 'default'}
                    style={{ fontSize: 10 }}
                  >
                    {s.status}
                  </Tag>
                </Space>
              ),
            }))}
          />
        </Space>
      </Card>

      {/* No Sprint Selected / No Sprints */}
      {sprints.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '48px 0' }}>
          <Empty description="No sprints found for this project" />
        </Card>
      )}

      {selectedSprint && (
        <>
          {/* Sprint Summary Card */}
          <Card
            style={{ marginBottom: 24, borderRadius: 8 }}
            title={
              <Space>
                <AimOutlined style={{ color: COLORS.primary }} />
                <span>Sprint Summary</span>
              </Space>
            }
          >
            <Descriptions
              column={{ xs: 1, sm: 2, md: 3 }}
              size="small"
              bordered
            >
              <Descriptions.Item label="Sprint Name">
                <Text strong>{selectedSprint.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColorMap[selectedSprint.status] || 'default'}>
                  {selectedSprint.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Goal">
                {selectedSprint.goal || <Text type="secondary">No goal set</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {selectedSprint.startDate ? (
                  <Space>
                    <CalendarOutlined />
                    {format(new Date(selectedSprint.startDate), 'MMM d, yyyy')}
                  </Space>
                ) : (
                  <Text type="secondary">Not set</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="End Date">
                {selectedSprint.endDate ? (
                  <Space>
                    <CalendarOutlined />
                    {format(new Date(selectedSprint.endDate), 'MMM d, yyyy')}
                  </Space>
                ) : (
                  <Text type="secondary">Not set</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {selectedSprint.startDate && selectedSprint.endDate ? (
                  <Text>
                    {Math.ceil(
                      (new Date(selectedSprint.endDate).getTime() -
                        new Date(selectedSprint.startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )}{' '}
                    days
                  </Text>
                ) : (
                  <Text type="secondary">-</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Key Metrics */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: 16 }}>
                <Statistic
                  title="Total Issues"
                  value={selectedSprint.progress?.totalIssues || 0}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: COLORS.textPrimary }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: 16 }}>
                <Statistic
                  title="Completed"
                  value={selectedSprint.progress?.completedIssues || 0}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: COLORS.success }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: 16 }}>
                <Statistic
                  title="Velocity"
                  value={selectedSprint.progress?.completedStoryPoints || 0}
                  suffix="SP"
                  prefix={<ThunderboltOutlined />}
                  valueStyle={{ color: COLORS.primary }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={{ borderRadius: 8, textAlign: 'center' }} bodyStyle={{ padding: 16 }}>
                <Statistic
                  title="Completion"
                  value={selectedSprint.progress?.percentComplete || 0}
                  suffix="%"
                  prefix={<TrophyOutlined />}
                  valueStyle={{
                    color:
                      (selectedSprint.progress?.percentComplete || 0) >= 80
                        ? COLORS.success
                        : COLORS.warning,
                  }}
                />
              </Card>
            </Col>
          </Row>

          {/* Overall Progress Bar */}
          <Card
            style={{ marginBottom: 24, borderRadius: 8 }}
            bodyStyle={{ padding: '16px 24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <Text strong>Sprint Progress</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedSprint.progress?.completedStoryPoints || 0} / {selectedSprint.progress?.totalStoryPoints || 0} story points
              </Text>
            </div>
            <Progress
              percent={selectedSprint.progress?.percentComplete || 0}
              strokeColor={{
                '0%': COLORS.primary,
                '100%': COLORS.success,
              }}
              strokeWidth={12}
              style={{ marginBottom: 0 }}
            />
          </Card>

          {/* Completed Issues Table */}
          <Card
            style={{ marginBottom: 24, borderRadius: 8 }}
            title={
              <Space>
                <CheckCircleOutlined style={{ color: COLORS.success }} />
                <span>Completed Issues</span>
                <Tag color="green">{completedIssues.length}</Tag>
              </Space>
            }
          >
            {completedIssues.length > 0 ? (
              <Table
                columns={issueColumns}
                dataSource={completedIssues}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="No completed issues" />
            )}
          </Card>

          {/* Incomplete Issues Table */}
          <Card
            style={{ marginBottom: 24, borderRadius: 8 }}
            title={
              <Space>
                <ClockCircleOutlined style={{ color: COLORS.warning }} />
                <span>Incomplete Issues</span>
                <Tag color="orange">{incompleteIssues.length}</Tag>
              </Space>
            }
          >
            {incompleteIssues.length > 0 ? (
              <Table
                columns={issueColumns}
                dataSource={incompleteIssues}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="All issues completed!" />
            )}
          </Card>

          {/* Team Member Contributions */}
          <Card
            style={{ marginBottom: 24, borderRadius: 8 }}
            title={
              <Space>
                <TeamOutlined style={{ color: COLORS.primary }} />
                <span>Team Contributions</span>
                <Tag color="blue">{memberContributions.length} members</Tag>
              </Space>
            }
          >
            {memberContributions.length > 0 ? (
              <Table
                columns={memberColumns}
                dataSource={memberContributions}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="No team member data available" />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
