import { useIssueModal } from '../../issues/IssueDetailModal';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ChevronRight, Inbox } from 'lucide-react';
import { Card, Typography, Badge, List, Space } from 'antd';
import { Link } from 'react-router-dom';
import { AssignedIssue } from '../types';

const { Text, Title } = Typography;

interface AssignedIssuesListProps {
  issues: AssignedIssue[];
  showViewAll?: boolean;
}

// Design System Constants from .cursorrules
const COLORS = {
  primary: '#1268ff',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

export function AssignedIssuesList({ issues, showViewAll = true }: AssignedIssuesListProps) {
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
          <Title level={5} style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            Assigned to Me
          </Title>
          {showViewAll && (
            <Link to="/issues?assignee=me" style={{ color: COLORS.primary, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
              View all <ChevronRight size={14} />
            </Link>
          )}
        </div>
      }
      headStyle={{ border: 'none', display: 'none' }} // We handle title in bodyStyle for better control
    >
      <div style={{ padding: '0px' }}>
        {issues.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Inbox size={48} color={COLORS.border} strokeWidth={1.5} />
            <Text style={{ display: 'block', marginTop: '12px', color: COLORS.textSecondary }}>
              No issues assigned to you
            </Text>
          </div>
        ) : (
          <List
            dataSource={issues}
            renderItem={(issue) => (
              <List.Item style={{ padding: 0, borderBottom: `1px solid ${COLORS.border}` }}>
                <div
                  onClick={() => openIssue(issue.id, issue.projectId)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    padding: '16px 20px',
                    alignItems: 'center',
                    gap: '16px',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                  className="issue-list-item"
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Text style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase' }}>
                        {issue.issueKey}
                      </Text>
                      <Badge
                        count={issue.status}
                        style={{
                          backgroundColor: 'transparent',
                          color: issue.statusColor,
                          borderColor: issue.statusColor,
                          fontSize: '10px',
                          fontWeight: 600,
                          lineHeight: '18px',
                          height: '20px'
                        }}
                      />
                    </div>
                    <Text strong style={{ fontSize: '15px', display: 'block', color: COLORS.textPrimary }}>
                      {issue.title}
                    </Text>
                    <Space size={12} style={{ marginTop: '4px' }}>
                      <Text style={{ fontSize: '12px', color: COLORS.textSecondary }}>
                        {issue.projectName}
                      </Text>
                      {issue.dueDate && (
                        <Text style={{
                          fontSize: '12px',
                          color: issue.isOverdue ? '#ff4d4f' : COLORS.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {issue.isOverdue && <AlertTriangle size={12} />}
                          Due {formatDistanceToNow(new Date(issue.dueDate), { addSuffix: true })}
                        </Text>
                      )}
                    </Space>
                  </div>
                  <Badge
                    count={issue.priority}
                    style={{
                      backgroundColor: `${issue.priorityColor}15`,
                      color: issue.priorityColor,
                      fontSize: '11px',
                      fontWeight: 600,
                      boxShadow: 'none',
                    }}
                  />
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
      <style>{`
        .issue-list-item:hover {
          background-color: #f9fafb;
        }
      `}</style>
    </Card>
  );
}
