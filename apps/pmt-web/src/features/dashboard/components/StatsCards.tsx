import {
  Folder,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Timer,
} from 'lucide-react';
import { Card, Row, Col, Typography } from 'antd';
import { DashboardStats } from '../types';

const { Text, Title } = Typography;

interface StatsCardsProps {
  stats: DashboardStats;
}

// Design System Constants from .cursorrules
const COLORS = {
  primary: '#1268ff',
  success: '#10b981',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#1890ff',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Projects',
      value: stats.totalProjects,
      icon: Folder,
      color: COLORS.primary,
      bgColor: 'rgba(18, 104, 255, 0.08)',
    },
    {
      title: 'Open Issues',
      value: stats.openIssues,
      icon: BarChart3,
      color: COLORS.warning,
      bgColor: 'rgba(250, 173, 20, 0.08)',
    },
    {
      title: 'Completed',
      value: stats.completedIssues,
      icon: CheckCircle,
      color: COLORS.success,
      bgColor: 'rgba(16, 185, 129, 0.08)',
    },
    {
      title: 'Overdue',
      value: stats.overdueIssues,
      icon: AlertCircle,
      color: COLORS.danger,
      bgColor: 'rgba(255, 77, 79, 0.08)',
    },
    {
      title: 'Time Logged',
      value: formatTime(stats.totalTimeLogged),
      icon: Timer,
      color: '#8b5cf6', // Purple
      bgColor: 'rgba(139, 92, 246, 0.08)',
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        <Col key={card.title} xs={24} sm={12} md={8} lg={4.8}>
          <Card
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              boxShadow: COLORS.shadow,
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: card.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <card.icon size={24} color={card.color} strokeWidth={2.5} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Title level={4} style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>
                  {card.value}
                </Title>
                <Text style={{ fontSize: '12px', fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {card.title}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
