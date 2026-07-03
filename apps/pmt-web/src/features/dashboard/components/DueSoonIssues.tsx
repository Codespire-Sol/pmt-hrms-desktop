import { useIssueModal } from '../../issues/IssueDetailModal';
import { format } from 'date-fns';
import { Calendar, AlertTriangle, Inbox } from 'lucide-react';
import { Card, Typography, Badge, List, Space } from 'antd';
import { DueSoonIssue } from '../types';

const { Text, Title } = Typography;

interface DueSoonIssuesProps {
  issues: DueSoonIssue[];
}

// Design System Constants from .cursorrules
const COLORS = {
  primary: '#1268ff',
  success: '#10b981',
  warning: '#faad14',
  danger: '#ff4d4f',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

export function DueSoonIssues({ issues }: DueSoonIssuesProps) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
          <Calendar size={18} color={COLORS.primary} strokeWidth={2.5} />
          <Title level={5} style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            Due Soon
          </Title>
        </div>
      }
      headStyle={{ border: 'none', display: 'none' }}
    >
      <div style={{ padding: '0px' }}>
        {issues.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Inbox size={48} color={COLORS.border} strokeWidth={1.5} />
            <Text style={{ display: 'block', marginTop: '12px', color: COLORS.textSecondary }}>
              No upcoming deadlines
            </Text>
          </div>
        ) : (
          <List
            dataSource={issues}
            renderItem={(issue) => {
              const date = new Date(issue.dueDate);
              const isToday = issue.daysUntilDue === 0;
              const isWarning = issue.daysUntilDue <= 2 && !isToday;
              const statusColor = isToday ? COLORS.danger : isWarning ? COLORS.warning : COLORS.primary;
              const statusBg = isToday ? 'rgba(255, 77, 79, 0.1)' : isWarning ? 'rgba(250, 173, 20, 0.1)' : 'rgba(18, 104, 255, 0.1)';

              return (
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
                    className="due-soon-item"
                  >
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: statusBg,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: statusColor,
                      flexShrink: 0
                    }}>
                      <Text strong style={{ fontSize: '18px', color: statusColor, lineHeight: 1 }}>{format(date, 'd')}</Text>
                      <Text style={{ fontSize: '10px', color: statusColor, textTransform: 'uppercase', fontWeight: 700 }}>{format(date, 'MMM')}</Text>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <Text style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textSecondary }}>{issue.issueKey}</Text>
                        <Badge
                          count={issue.status}
                          style={{
                            backgroundColor: 'transparent',
                            color: issue.statusColor,
                            borderColor: issue.statusColor,
                            fontSize: '10px',
                            fontWeight: 600,
                            lineHeight: '16px',
                            height: '18px'
                          }}
                        />
                      </div>
                      <Text strong style={{ fontSize: '14px', display: 'block', color: COLORS.textPrimary }}>{issue.title}</Text>
                      <Text style={{ fontSize: '12px', color: COLORS.textSecondary, display: 'block' }}>{issue.projectName}</Text>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: statusColor,
                      fontSize: '12px',
                      fontWeight: 700
                    }}>
                      {isToday && <AlertTriangle size={12} strokeWidth={2.5} />}
                      {isToday ? 'Today' : issue.daysUntilDue === 1 ? 'Tomorrow' : `${issue.daysUntilDue} days`}
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </div>
      <style>{`
        .due-soon-item:hover {
          background-color: #f9fafb;
        }
      `}</style>
    </Card>
  );
}
