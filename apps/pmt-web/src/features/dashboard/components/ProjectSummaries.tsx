import { Link } from 'react-router-dom';
import { Folder, ChevronRight, Inbox } from 'lucide-react';
import { Card, Typography, Badge, List } from 'antd';
import { ProjectSummary } from '../types';

const { Text, Title } = Typography;

interface ProjectSummariesProps {
  projects: ProjectSummary[];
}

// Design System Constants from .cursorrules
const COLORS = {
  primary: '#1268ff',
  primaryGradient: 'linear-gradient(135deg, #1268ff 0%, #40a9ff 100%)',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

export function ProjectSummaries({ projects }: ProjectSummariesProps) {
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
            My Projects
          </Title>
          <Link to="/projects" style={{ color: COLORS.primary, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, marginLeft: 'auto' }}>
            View all <ChevronRight size={14} />
          </Link>
        </div>
      }
      headStyle={{ border: 'none', display: 'none' }}
    >
      <div style={{ padding: '0px' }}>
        {projects.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Inbox size={48} color={COLORS.border} strokeWidth={1.5} />
            <Text style={{ display: 'block', marginTop: '12px', color: COLORS.textSecondary }}>
              No projects found
            </Text>
          </div>
        ) : (
          <List
            dataSource={projects}
            renderItem={(project) => (
              <List.Item style={{ padding: 0, borderBottom: `1px solid ${COLORS.border}` }}>
                <Link
                  to={`/projects/${project.id}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '16px 20px',
                    color: 'inherit',
                  }}
                  className="project-summary-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(18, 104, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: COLORS.primary
                      }}>
                        <Folder size={18} />
                      </div>
                      <div>
                        <Text strong style={{ fontSize: '15px', color: COLORS.textPrimary }}>{project.name}</Text>
                        <Text style={{ fontSize: '12px', color: COLORS.textSecondary, display: 'block' }}>{project.key}</Text>
                      </div>
                    </div>
                    <Badge
                      count={`${project.openIssues} open`}
                      style={{
                        backgroundColor: '#f2f4f7',
                        color: COLORS.textSecondary,
                        fontSize: '11px',
                        fontWeight: 600,
                        boxShadow: 'none',
                        padding: '0 8px',
                        height: '24px',
                        lineHeight: '24px'
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <Text style={{ fontSize: '12px', color: COLORS.textSecondary }}>Progress</Text>
                      <Text strong style={{ fontSize: '12px', color: COLORS.textPrimary }}>{project.completedPercentage}%</Text>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '6px',
                      backgroundColor: '#f2f4f7',
                      borderRadius: '100px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${project.completedPercentage}%`,
                        height: '100%',
                        background: COLORS.primaryGradient,
                        borderRadius: '100px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                </Link>
              </List.Item>
            )}
          />
        )}
      </div>
      <style>{`
        .project-summary-item:hover {
          background-color: #f9fafb;
        }
      `}</style>
    </Card>
  );
}
