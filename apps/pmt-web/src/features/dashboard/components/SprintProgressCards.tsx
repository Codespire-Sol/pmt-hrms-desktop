import { Link } from 'react-router-dom';
import { Calendar, Inbox } from 'lucide-react';
import { Card, Typography, List, Space } from 'antd';
import { SprintProgress } from '../types';

const { Text, Title } = Typography;

interface SprintProgressCardsProps {
  sprints: SprintProgress[];
}

// Design System Constants from .cursorrules
const COLORS = {
  primary: '#1268ff',
  primaryGradient: 'linear-gradient(135deg, #1268ff 0%, #40a9ff 100%)',
  success: '#10b981',
  warning: '#faad14',
  danger: '#ff4d4f',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

export function SprintProgressCards({ sprints }: SprintProgressCardsProps) {
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
          Active Sprints
        </Title>
      }
      headStyle={{ border: 'none', display: 'none' }}
    >
      <div style={{ padding: '0px' }}>
        {sprints.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Inbox size={48} color={COLORS.border} strokeWidth={1.5} />
            <Text style={{ display: 'block', marginTop: '12px', color: COLORS.textSecondary }}>
              No active sprints
            </Text>
          </div>
        ) : (
          <List
            dataSource={sprints}
            style={{ padding: '8px 20px 20px' }}
            renderItem={(sprint) => (
              <List.Item style={{ padding: 0, border: 'none', marginBottom: '16px' }}>
                <Link
                  to={`/projects/${sprint.projectId}/sprints`}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '16px',
                    color: 'inherit',
                    borderRadius: '12px',
                    border: `1px solid ${COLORS.border}`,
                    transition: 'all 0.2s ease',
                  }}
                  className="sprint-progress-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                      <Text strong style={{ fontSize: '15px', color: COLORS.textPrimary }}>{sprint.name}</Text>
                      <Text style={{ fontSize: '12px', color: COLORS.textSecondary, display: 'block' }}>
                        {sprint.projectName} ({sprint.projectKey})
                      </Text>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: sprint.daysRemaining <= 2 ? 'rgba(255, 77, 79, 0.1)' : sprint.daysRemaining <= 5 ? 'rgba(250, 173, 20, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: sprint.daysRemaining <= 2 ? COLORS.danger : sprint.daysRemaining <= 5 ? COLORS.warning : COLORS.success,
                      fontSize: '12px',
                      fontWeight: 700
                    }}>
                      <Calendar size={14} strokeWidth={2.5} />
                      {sprint.daysRemaining} days left
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Text style={{ fontSize: '12px', color: COLORS.textSecondary, fontWeight: 600 }}>Completion</Text>
                      <Text strong style={{ fontSize: '14px', color: COLORS.textPrimary }}>
                        {sprint.totalIssues > 0
                          ? Math.round((sprint.completedIssues / sprint.totalIssues) * 100)
                          : 0}%
                      </Text>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#f2f4f7',
                      borderRadius: '100px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${sprint.totalIssues > 0 ? Math.round((sprint.completedIssues / sprint.totalIssues) * 100) : 0}%`,
                        height: '100%',
                        background: COLORS.primaryGradient,
                        borderRadius: '100px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  <Space size={20} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                      <Text style={{ fontSize: '12px', color: COLORS.textSecondary, fontWeight: 600 }}>To Do: <Text strong style={{ fontSize: '12px' }}>{sprint.todoIssues}</Text></Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.primary }} />
                      <Text style={{ fontSize: '12px', color: COLORS.primary, fontWeight: 600 }}>In Progress: <Text strong style={{ fontSize: '12px' }}>{sprint.inProgressIssues}</Text></Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.success }} />
                      <Text style={{ fontSize: '12px', color: COLORS.success, fontWeight: 600 }}>Done: <Text strong style={{ fontSize: '12px' }}>{sprint.completedIssues}</Text></Text>
                    </div>
                  </Space>
                </Link>
              </List.Item>
            )}
          />
        )}
      </div>
      <style>{`
        .sprint-progress-item:hover {
          border-color: ${COLORS.primary} !important;
          background-color: ${COLORS.primary}05;
          box-shadow: 0 4px 12px rgba(16, 24, 40, 0.04);
        }
      `}</style>
    </Card>
  );
}
