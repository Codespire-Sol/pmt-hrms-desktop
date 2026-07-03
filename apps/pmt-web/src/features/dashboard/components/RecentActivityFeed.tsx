import { Link } from 'react-router-dom';
import { useIssueModal } from '../../issues/IssueDetailModal';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Edit,
  Trash2,
  MessageSquare,
  UserPlus,
  PlayCircle,
  CheckCircle,
  Clock,
  GitBranch,
  Inbox,
} from 'lucide-react';
import { Card, Typography, List, Avatar, Space } from 'antd';
import { RecentActivity } from '../types';

const { Text, Title } = Typography;

interface RecentActivityFeedProps {
  activities: RecentActivity[];
}

// Design System Constants from .cursorrules
const COLORS = {
  primary: '#1268ff',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

const actionIcons: Record<string, React.ReactNode> = {
  created: <Plus size={14} />,
  updated: <Edit size={14} />,
  deleted: <Trash2 size={14} />,
  commented: <MessageSquare size={14} />,
  assigned: <UserPlus size={14} />,
  started: <PlayCircle size={14} />,
  completed: <CheckCircle size={14} />,
  status_changed: <Clock size={14} />,
  moved: <GitBranch size={14} />,
};

const actionColors: Record<string, { color: string; bg: string }> = {
  created: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  updated: { color: '#1268ff', bg: 'rgba(18, 104, 255, 0.1)' },
  deleted: { color: '#ff4d4f', bg: 'rgba(255, 77, 79, 0.1)' },
  commented: { color: '#faad14', bg: 'rgba(250, 173, 20, 0.1)' },
  assigned: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  started: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  completed: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  status_changed: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  moved: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
};

function getActionText(activity: RecentActivity): string {
  const { action, entityType, metadata } = activity;

  switch (action) {
    case 'created':
      return `created ${entityType}`;
    case 'updated':
      if (metadata?.field) {
        return `updated ${metadata.field}`;
      }
      return `updated ${entityType}`;
    case 'deleted':
      return `deleted ${entityType}`;
    case 'commented':
      return 'commented on';
    case 'assigned':
      return 'assigned';
    case 'status_changed':
      if (metadata?.newStatus) {
        return `moved to ${metadata.newStatus}`;
      }
      return 'changed status';
    case 'completed':
      return 'completed';
    default:
      return action;
  }
}

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  const { openIssue } = useIssueModal();
  return (
    <Card
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: '12px',
        boxShadow: COLORS.shadow,
        overflow: 'hidden'
      }}
      bodyStyle={{ padding: 0 }}
      title={
        <Title level={5} style={{ margin: 0, padding: '16px 20px', fontSize: '18px', fontWeight: 600 }}>
          Recent Activity
        </Title>
      }
      headStyle={{ border: 'none', display: 'none' }}
    >
      <div style={{ padding: '0px' }}>
        {activities.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Inbox size={48} color={COLORS.border} strokeWidth={1.5} />
            <Text style={{ display: 'block', marginTop: '12px', color: COLORS.textSecondary }}>
              No recent activity
            </Text>
          </div>
        ) : (
          <List
            dataSource={activities}
            style={{ maxHeight: '480px', overflowY: 'auto' }}
            renderItem={(activity) => {
              const actionKey = activity.action.toLowerCase().replace(/ /g, '_');
              const { color, bg } = actionColors[actionKey] || { color: COLORS.textSecondary, bg: '#f2f4f7' };
              const icon = actionIcons[actionKey] || <Edit size={14} />;

              return (
                <List.Item style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: color,
                      flexShrink: 0
                    }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: '14px', lineHeight: '1.5', color: COLORS.textPrimary }}>
                        <Text strong>{activity.actorName}</Text>{' '}
                        <Text style={{ color: COLORS.textSecondary }}>{getActionText(activity)}</Text>{' '}
                        {activity.issueKey ? (
                          <span onClick={() => openIssue(activity.entityId, activity.projectId)} style={{ fontWeight: 600, color: COLORS.primary, cursor: 'pointer' }}>
                            {activity.issueKey}
                          </span>
                        ) : activity.projectId ? (
                          <Link to={`/projects/${activity.projectId}`} style={{ fontWeight: 600, color: COLORS.primary }}>
                            {activity.entityTitle}
                          </Link>
                        ) : (
                          <Text strong>{activity.entityTitle}</Text>
                        )}
                      </Text>
                      <Space size={8} style={{ display: 'flex', marginTop: '4px' }}>
                        <Text style={{ fontSize: '12px', color: COLORS.textSecondary }}>
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </Text>
                        {activity.projectName && (
                          <>
                            <Text style={{ fontSize: '12px', color: COLORS.border }}>•</Text>
                            <Text style={{ fontSize: '12px', color: COLORS.textSecondary }}>{activity.projectName}</Text>
                          </>
                        )}
                      </Space>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </Card>
  );
}
