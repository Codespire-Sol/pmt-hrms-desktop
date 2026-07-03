import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Tag,
  Progress,
  Modal,
  Select,
  Space,
  Typography,
  Empty,
  Skeleton,
  Row,
  Col,
  Dropdown,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { format } from 'date-fns';
import {
  useGetProjectEpicsQuery,
  useDeleteEpicMutation,
  useGetEpicIssuesQuery,
  Epic,
  EpicStatus,
} from './epicsApi';
import { EpicFormModal } from './EpicFormModal';

const { Title, Text, Paragraph } = Typography;

const COLORS = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

const statusConfig: Record<EpicStatus, { label: string; color: string }> = {
  to_do: { label: 'To Do', color: 'default' },
  in_progress: { label: 'In Progress', color: 'processing' },
  done: { label: 'Done', color: 'success' },
};

function EpicIssuesList({ epicId }: { epicId: string }) {
  const { data, isLoading } = useGetEpicIssuesQuery({ epicId });

  if (isLoading) {
    return (
      <div style={{ padding: '12px 0' }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
    );
  }

  const issues = data?.issues || [];

  if (issues.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No issues assigned to this epic"
        style={{ padding: '16px 0' }}
      />
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      {issues.map((issue: any) => (
        <div
          key={issue.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            marginBottom: 8,
            backgroundColor: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
              {issue.issueKey}
            </Text>
            <Text ellipsis style={{ fontSize: 14 }}>
              {issue.title}
            </Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {issue.status && (
              <Tag
                color={
                  issue.status.category === 'done'
                    ? 'success'
                    : issue.status.category === 'in_progress'
                      ? 'processing'
                      : 'default'
                }
                style={{ margin: 0 }}
              >
                {issue.status.displayName || issue.status.name}
              </Tag>
            )}
            {issue.priority && (
              <Tag style={{ margin: 0 }}>{issue.priority.displayName || issue.priority.name}</Tag>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EpicsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [statusFilter, setStatusFilter] = useState<EpicStatus | 'all'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [deletingEpic, setDeletingEpic] = useState<Epic | null>(null);
  const [expandedEpicId, setExpandedEpicId] = useState<string | null>(null);

  const navigate = useNavigate();

  const { data: epics, isLoading, error } = useGetProjectEpicsQuery({
    projectId: projectId!,
    filters: {
      status: statusFilter !== 'all' ? statusFilter : undefined,
    },
  });

  const [deleteEpic, { isLoading: isDeleting }] = useDeleteEpicMutation();

  const handleDelete = async () => {
    if (!deletingEpic) return;

    try {
      await deleteEpic(deletingEpic.id).unwrap();
      message.success('Epic deleted successfully');
      setDeletingEpic(null);
    } catch {
      message.error('Failed to delete epic');
    }
  };

  const handleCardClick = (epicId: string) => {
    setExpandedEpicId(expandedEpicId === epicId ? null : epicId);
  };

  const getDropdownItems = (epic: Epic) => ({
    items: [
      {
        key: 'report',
        icon: <BarChartOutlined />,
        label: 'View Report',
        onClick: () => navigate(`/epics/${epic.id}/reports`),
      },
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: 'Edit',
        onClick: () => setEditingEpic(epic),
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: 'Delete',
        danger: true,
        onClick: () => setDeletingEpic(epic),
      },
    ],
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Skeleton.Input active style={{ width: 200 }} />
          <Skeleton.Button active style={{ width: 120 }} />
        </div>
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map((i) => (
            <Col key={i} span={24}>
              <Card>
                <Skeleton active />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <Empty
          description={
            <div>
              <Title level={5} style={{ marginBottom: 4 }}>Failed to load epics</Title>
              <Text type="secondary">Please try again later.</Text>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>
            Epics
          </Title>
          <Text type="secondary">
            Organize and track large bodies of work
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          Create Epic
        </Button>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 20 }}>
        <Space>
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            style={{ width: 180 }}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'to_do', label: 'To Do' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'done', label: 'Done' },
            ]}
          />
        </Space>
      </div>

      {/* Epic Cards */}
      {!epics || epics.length === 0 ? (
        <Card style={{ boxShadow: COLORS.shadow, borderColor: COLORS.border }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Title level={5} style={{ marginBottom: 4 }}>No epics yet</Title>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Create epics to organize related issues into larger bodies of work.
                </Paragraph>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  Create First Epic
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <Row gutter={[0, 16]}>
          {epics.map((epic) => {
            const isExpanded = expandedEpicId === epic.id;

            return (
              <Col key={epic.id} span={24}>
                <Card
                  hoverable
                  style={{
                    boxShadow: COLORS.shadow,
                    borderColor: COLORS.border,
                    borderLeft: `4px solid ${epic.color}`,
                    cursor: 'pointer',
                  }}
                  bodyStyle={{ padding: '16px 20px' }}
                  onClick={() => handleCardClick(epic.id)}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: epic.color,
                            flexShrink: 0,
                          }}
                        />
                        <Title level={5} style={{ margin: 0, color: COLORS.textPrimary }} ellipsis>
                          {epic.name}
                        </Title>
                        <Tag color={statusConfig[epic.status].color} style={{ marginLeft: 4 }}>
                          {statusConfig[epic.status].label}
                        </Tag>
                      </div>
                      {epic.summary && (
                        <Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          style={{ margin: '4px 0 0 20px', fontSize: 13 }}
                        >
                          {epic.summary}
                        </Paragraph>
                      )}
                    </div>

                    <Dropdown menu={getDropdownItems(epic)} trigger={['click']} placement="bottomRight">
                      <Button
                        type="text"
                        icon={<MoreOutlined />}
                        size="small"
                        onClick={(e) => e.stopPropagation()}
                        style={{ flexShrink: 0 }}
                      />
                    </Dropdown>
                  </div>

                  {/* Stats Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 12, marginLeft: 20 }}>
                    <Space size={4}>
                      <UnorderedListOutlined style={{ color: COLORS.textSecondary, fontSize: 13 }} />
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {epic.stats.completedIssues} / {epic.stats.totalIssues} issues
                      </Text>
                    </Space>

                    {epic.stats.totalStoryPoints > 0 && (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {epic.stats.completedStoryPoints} / {epic.stats.totalStoryPoints} points
                      </Text>
                    )}

                    {(epic.startDate || epic.endDate) && (
                      <Space size={4}>
                        <CalendarOutlined style={{ color: COLORS.textSecondary, fontSize: 13 }} />
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {epic.startDate && format(new Date(epic.startDate), 'MMM d, yyyy')}
                          {epic.startDate && epic.endDate && ' - '}
                          {epic.endDate && format(new Date(epic.endDate), 'MMM d, yyyy')}
                        </Text>
                      </Space>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: 12, marginLeft: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Progress</Text>
                      <Text strong style={{ fontSize: 12 }}>{epic.progress}%</Text>
                    </div>
                    <Progress
                      percent={epic.progress}
                      showInfo={false}
                      strokeColor={
                        epic.progress === 100
                          ? COLORS.success
                          : epic.progress > 0
                            ? COLORS.primary
                            : undefined
                      }
                      size="small"
                    />
                  </div>

                  {/* Expanded Issues List */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: `1px solid ${COLORS.border}`,
                        marginLeft: 20,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                        Issues
                      </Text>
                      <EpicIssuesList epicId={epic.id} />
                    </div>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Create / Edit Modal */}
      <EpicFormModal
        projectId={projectId!}
        epic={editingEpic}
        open={isCreateModalOpen || !!editingEpic}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingEpic(null);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete Epic"
        open={!!deletingEpic}
        onCancel={() => setDeletingEpic(null)}
        onOk={handleDelete}
        okText={isDeleting ? 'Deleting...' : 'Delete'}
        okButtonProps={{ danger: true, loading: isDeleting }}
        cancelText="Cancel"
      >
        <Paragraph>
          Are you sure you want to delete &quot;{deletingEpic?.name}&quot;? Issues will be
          unlinked from this epic but not deleted.
        </Paragraph>
      </Modal>
    </div>
  );
}

export default EpicsPage;
