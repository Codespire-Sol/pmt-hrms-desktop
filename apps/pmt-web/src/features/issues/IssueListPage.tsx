import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIssueModal } from './IssueDetailModal';
import {
  Plus,
  Search,
  MoreHorizontal,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Flag,
} from 'lucide-react';
import { useGetProjectIssuesQuery } from './issuesApi';
import { useGetProjectMembersQuery } from '../projects/projectsApi';
import { useGetBoardQuery } from '../boards/boardsApi';
import { CreateIssueModal } from './components/CreateIssueModal';
import { AdvancedFilters, type IssueFilters } from './components/AdvancedFilters';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import {
  Typography,
  Button,
  Input,
  Card,
  Table,
  Badge,
  Avatar,
  Space,
  Skeleton,
  Empty,
  Dropdown,
  Tag,
  Tooltip,
  Divider,
  type MenuProps
} from 'antd';

const { Title, Text } = Typography;

// Design System Constants from .cursorrules
const COLORS = {
  primary: '#1268ff',
  success: '#10b981',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#1890ff',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

const statusColors: Record<string, string> = {
  todo: '#6b7280',
  'in-progress': '#1268ff',
  'in-review': '#faad14',
  done: '#10b981',
};

const priorityIcons: Record<string, React.ElementType> = {
  highest: ArrowUp,
  high: ArrowUp,
  medium: Minus,
  low: ArrowDown,
  lowest: ArrowDown,
};

const priorityColors: Record<string, string> = {
  highest: '#ff4d4f',
  high: '#f97316',
  medium: '#faad14',
  low: '#1268ff',
  lowest: '#9ca3af',
};

export function IssueListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { openIssue } = useIssueModal();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<IssueFilters>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const queryParams = useMemo(() => {
    const filterParams: Record<string, string> = {};
    if (searchQuery) filterParams.search = searchQuery;
    if (filters.status?.length) filterParams.status = filters.status.join(',');
    if (filters.priority?.length) filterParams.priority = filters.priority.join(',');
    if (filters.type?.length) filterParams.type = filters.type.join(',');
    if (filters.assigneeId) filterParams.assigneeId = filters.assigneeId;
    if (filters.createdAfter) filterParams.createdAfter = filters.createdAfter;
    if (filters.createdBefore) filterParams.createdBefore = filters.createdBefore;
    if (filters.dueDateAfter) filterParams.dueDateAfter = filters.dueDateAfter;
    if (filters.dueDateBefore) filterParams.dueDateBefore = filters.dueDateBefore;
    return { projectId: projectId!, filters: filterParams };
  }, [projectId, searchQuery, filters]);

  const { data, isLoading, error } = useGetProjectIssuesQuery(queryParams);
  const { data: membersData } = useGetProjectMembersQuery(projectId!);
  const { data: boardData } = useGetBoardQuery({ projectId: projectId! });
  const { hasPermission: canCreateIssue } = usePermissionGuard('issues.create');
  const { hasPermission: canViewIssues } = usePermissionGuard(
    ['issues.read', 'issues.create', 'issues.update', 'issues.update_own', 'issues.delete', 'issues.assign'],
    'any'
  );

  const rawIssues = data?.issues || [];

  const issues = useMemo(() => {
    return rawIssues.filter((issue: any) => {
      if (filters.createdAfter && issue.createdAt) {
        if (isBefore(parseISO(issue.createdAt), parseISO(filters.createdAfter))) return false;
      }
      if (filters.createdBefore && issue.createdAt) {
        if (isAfter(parseISO(issue.createdAt), parseISO(filters.createdBefore))) return false;
      }
      if (filters.dueDateAfter && issue.dueDate) {
        if (isBefore(parseISO(issue.dueDate), parseISO(filters.dueDateAfter))) return false;
      }
      if (filters.dueDateBefore && issue.dueDate) {
        if (isAfter(parseISO(issue.dueDate), parseISO(filters.dueDateBefore))) return false;
      }
      return true;
    });
  }, [rawIssues, filters]);

  const columns = [
    {
      title: 'Key',
      dataIndex: 'issueKey',
      key: 'issueKey',
      width: 100,
      render: (text: string, record: any) => (
        <Text style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'monospace', color: COLORS.textSecondary }}>
          {text || `#${record.issueNumber}`}
        </Text>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Text strong style={{ fontSize: '14px', color: COLORS.textPrimary }}>{text}</Text>
          {record.labels && record.labels.length > 0 && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {record.labels.slice(0, 3).map((label: any) => (
                <Tag
                  key={label.id}
                  color={label.color}
                  style={{ borderRadius: '4px', fontSize: '10px', fontWeight: 600, lineHeight: '18px', height: '18px' }}
                >
                  {label.name}
                </Tag>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: any) => {
        const color = statusColors[status?.name?.toLowerCase()] || '#6b7280';
        return (
          <Tag color={color} style={{ borderRadius: '6px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>
            {status?.displayName || status?.name || 'Unknown'}
          </Tag>
        );
      },
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 120,
      render: (priority: any) => {
        const color = priorityColors[priority?.name?.toLowerCase()] || COLORS.textSecondary;
        return (
          <Space align="center" size={6}>
            <Flag size={14} color={color} fill={color} />
            <Text style={{ fontSize: '13px', fontWeight: 600 }}>{priority?.name || 'None'}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Assignee',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 180,
      render: (assignee: any) => (
        assignee ? (
          <Space size={8}>
            <Avatar size={24} src={assignee.avatarUrl} style={{ backgroundColor: COLORS.primary }}>
              {assignee.displayName?.charAt(0) || assignee.firstName?.charAt(0)}
            </Avatar>
            <Text style={{ fontSize: '13px', fontWeight: 500 }}>
              {assignee.displayName || `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim()}
            </Text>
          </Space>
        ) : (
          <Text style={{ fontSize: '13px', color: COLORS.textSecondary, fontStyle: 'italic' }}>Unassigned</Text>
        )
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date: string) => (
        date ? (
          <Space size={4} align="center">
            <Calendar size={14} color={COLORS.textSecondary} />
            <Text style={{ fontSize: '13px' }}>{format(parseISO(date), 'MMM d')}</Text>
          </Space>
        ) : <Text style={{ color: COLORS.border }}>-</Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: any, record: any) => {
        const items: MenuProps['items'] = [
          { key: 'view', label: 'View Details' },
        ];

        const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
          domEvent.stopPropagation();
          if (key === 'view') {
            openIssue(record.id, projectId);
          }
        };

        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']}>
            <Button type="text" icon={<MoreHorizontal size={18} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        );
      },
    },
  ];

  if (!canViewIssues) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '32px', textAlign: 'center', color: COLORS.textSecondary }}>
          You don't have permission to view issues.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <Empty
          image={<AlertCircle size={64} color={COLORS.danger} strokeWidth={1} style={{ margin: '0 auto' }} />}
          description={
            <Space direction="vertical">
              <Text strong style={{ fontSize: '18px' }}>Failed to load issues</Text>
              <Text style={{ color: COLORS.textSecondary }}>There was an error connecting to the project database.</Text>
              <Button onClick={() => window.location.reload()} style={{ marginTop: '16px' }}>Retry Connection</Button>
            </Space>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '0px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <Title level={2} style={{ fontSize: '30px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Issues</Title>
          <Text style={{ fontSize: '15px', color: COLORS.textSecondary }}>Manage and track all issues for this project.</Text>
        </div>
        {canCreateIssue && (
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setCreateModalOpen(true)}
            style={{ height: '40px', borderRadius: '8px', backgroundColor: COLORS.primary, fontWeight: 600, padding: '0 20px' }}
          >
            Create Issue
          </Button>
        )}
      </div>

      {/* Filters Card */}
      <Card
        style={{ marginBottom: '24px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)' }}
        bodyStyle={{ padding: '16px' }}
      >
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Input
            placeholder="Search issues by title or key..."
            prefix={<Search size={16} color={COLORS.textSecondary} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: '400px', flex: 1, height: '40px', borderRadius: '8px' }}
          />
          <AdvancedFilters
            filters={filters}
            onFiltersChange={setFilters}
            projectId={projectId!}
          />
        </div>
      </Card>

      {/* Issues Table Card */}
      <Card
        style={{ borderRadius: '16px', border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow, overflow: 'hidden' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={issues}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          onRow={(record) => ({
            onClick: () => openIssue(record.id, projectId),
            style: { cursor: 'pointer' }
          })}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            style: { padding: '16px 24px' }
          }}
          locale={{
            emptyText: (
              <div style={{ padding: '48px 0' }}>
                <Empty
                  description={
                    <Space direction="vertical">
                      <Text strong>{searchQuery || Object.keys(filters).length > 0 ? 'No matching issues found' : 'No issues found in this project'}</Text>
                      {canCreateIssue && (
                        <Button onClick={() => setCreateModalOpen(true)} type="link" icon={<Plus size={14} />}>
                          Create your first issue
                        </Button>
                      )}
                    </Space>
                  }
                />
              </div>
            )
          }}
        />
      </Card>

      {/* Create Issue Modal */}
      {canCreateIssue && (
        <CreateIssueModal
          projectId={projectId!}
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          issueTypes={boardData?.filters?.types?.map((type: any) => ({
            id: type.id,
            name: type.name,
          })) || []}
          priorities={boardData?.filters?.priorities?.map((priority: any) => ({
            id: priority.id,
            name: priority.name,
          })) || []}
          members={membersData?.map((member) => ({
            id: member.user.id,
            displayName: member.user.displayName,
          })) || []}
        />
      )}

      <style>{`
        .ant-table-thead > tr > th {
          background-color: #f9fafb !important;
          font-weight: 700 !important;
          color: ${COLORS.textSecondary} !important;
          text-transform: uppercase !important;
          font-size: 11px !important;
          letter-spacing: 0.05em !important;
        }
        .ant-table-row:hover {
          background-color: #f2f4f780 !important;
        }
        .dropdown-item:hover {
          background-color: #f9fafb;
        }
      `}</style>
    </div>
  );
}

export default IssueListPage;
