import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { ArrowRight, CheckCircle2, Code2, ExternalLink, GitBranch, Github, GitPullRequest, Link2, XCircle } from 'lucide-react';
import { useGetRepositoryStatusQuery } from './github/githubApi';

const { Title, Text, Paragraph } = Typography;

const COLORS = {
  primary: '#1268ff',
  success: '#10b981',
  warning: '#faad14',
  danger: '#ff4d4f',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  cardBg: '#ffffff',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

export function ProjectCodePage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: githubStatus, isLoading, isError } = useGetRepositoryStatusQuery(projectId!, {
    skip: !projectId,
  });

  const providerCards = useMemo(
    () => [
      {
        key: 'github',
        title: 'GitHub',
        icon: <Github size={18} />,
        status: githubStatus?.connected ? 'Connected' : 'Not connected',
        statusColor: githubStatus?.connected ? COLORS.success : COLORS.textSecondary,
        description: githubStatus?.connected
          ? `Repository linked: ${githubStatus.repository?.fullName || 'Unknown'}`
          : 'Connect repository, branches, commits, and pull requests.',
        ctaLabel: githubStatus?.connected ? 'Manage integration' : 'Connect GitHub',
        onClick: () => navigate(`/projects/${projectId}/integrations`),
      },
      {
        key: 'gitlab',
        title: 'GitLab',
        icon: <Code2 size={18} />,
        status: 'Planned',
        statusColor: COLORS.warning,
        description: 'Provider support is planned. API and webhook setup will be added next.',
        ctaLabel: 'Track in roadmap',
        onClick: () => navigate('/reports'),
      },
      {
        key: 'bitbucket',
        title: 'Bitbucket',
        icon: <GitBranch size={18} />,
        status: 'Planned',
        statusColor: COLORS.warning,
        description: 'Provider support is planned. API and webhook setup will be added next.',
        ctaLabel: 'Track in roadmap',
        onClick: () => navigate('/reports'),
      },
    ],
    [githubStatus, navigate, projectId]
  );

  if (!projectId) {
    return (
      <Card style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12 }}>
        <Empty description="Project not found" />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          boxShadow: COLORS.shadow,
          backgroundColor: COLORS.cardBg,
        }}
        styles={{ body: { padding: 24 } }}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space align="center" size={10}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: COLORS.primary,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Code2 size={18} />
            </div>
            <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>
              Code
            </Title>
          </Space>
          <Text style={{ color: COLORS.textSecondary }}>
            Centralized development visibility for repositories, branches, commits, and pull requests linked to project issues.
          </Text>
        </Space>
      </Card>

      {isError && (
        <Alert
          type="warning"
          showIcon
          message="Could not fetch repository status"
          description="The code view is still available, but live integration status failed to load."
          style={{ borderRadius: 12 }}
        />
      )}

      <Row gutter={[16, 16]}>
        {providerCards.map((provider) => (
          <Col key={provider.key} xs={24} md={8}>
            <Card
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                boxShadow: COLORS.shadow,
                height: '100%',
              }}
              styles={{ body: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 } }}
            >
              <Space align="center" size={10}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    backgroundColor: `${COLORS.primary}15`,
                    color: COLORS.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {provider.icon}
                </div>
                <Text strong style={{ color: COLORS.textPrimary, fontSize: 15 }}>
                  {provider.title}
                </Text>
              </Space>

              <Tag
                style={{
                  width: 'fit-content',
                  margin: 0,
                  borderRadius: 999,
                  border: `1px solid ${provider.statusColor}40`,
                  background: `${provider.statusColor}15`,
                  color: provider.statusColor,
                  fontWeight: 600,
                }}
              >
                {provider.status}
              </Tag>

              <Text style={{ color: COLORS.textSecondary }}>{provider.description}</Text>

              <Button
                type="default"
                onClick={provider.onClick}
                style={{
                  marginTop: 'auto',
                  borderColor: COLORS.border,
                  borderRadius: 8,
                  color: COLORS.textPrimary,
                  fontWeight: 600,
                }}
              >
                <Space size={6}>
                  {provider.ctaLabel}
                  <ArrowRight size={14} />
                </Space>
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          boxShadow: COLORS.shadow,
        }}
        styles={{ body: { padding: 20 } }}
      >
        <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          Development Signals
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div style={{ padding: 16, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}>
              <Space align="center" size={8}>
                <Link2 size={16} color={COLORS.primary} />
                <Text strong>Smart Linking</Text>
              </Space>
              <Paragraph style={{ margin: '8px 0 0', color: COLORS.textSecondary }}>
                Issue keys in commits and PRs auto-link development activity.
              </Paragraph>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ padding: 16, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}>
              <Space align="center" size={8}>
                <GitPullRequest size={16} color={COLORS.primary} />
                <Text strong>PR Transitioning</Text>
              </Space>
              <Paragraph style={{ margin: '8px 0 0', color: COLORS.textSecondary }}>
                Auto-transition issues when pull requests merge.
              </Paragraph>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ padding: 16, border: `1px solid ${COLORS.border}`, borderRadius: 10 }}>
              <Space align="center" size={8}>
                <GitBranch size={16} color={COLORS.primary} />
                <Text strong>Branch Creation</Text>
              </Space>
              <Paragraph style={{ margin: '8px 0 0', color: COLORS.textSecondary }}>
                Create branches directly from issue context in linked repositories.
              </Paragraph>
            </div>
          </Col>
        </Row>
      </Card>

      <Card
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          boxShadow: COLORS.shadow,
        }}
        styles={{ body: { padding: 20 } }}
      >
        <Space direction="vertical" size={8}>
          <Text strong style={{ color: COLORS.textPrimary }}>
            Current Provider Coverage
          </Text>
          <Space wrap>
            <Tag color="success" style={{ margin: 0 }}>
              <CheckCircle2 size={13} style={{ marginRight: 6 }} />
              GitHub ready
            </Tag>
            <Tag color="warning" style={{ margin: 0 }}>
              <XCircle size={13} style={{ marginRight: 6 }} />
              GitLab pending
            </Tag>
            <Tag color="warning" style={{ margin: 0 }}>
              <XCircle size={13} style={{ marginRight: 6 }} />
              Bitbucket pending
            </Tag>
          </Space>
          <Button
            type="link"
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: 0, color: COLORS.primary, width: 'fit-content' }}
          >
            <Space size={6}>
              Open GitHub
              <ExternalLink size={14} />
            </Space>
          </Button>
        </Space>
      </Card>
    </div>
  );
}

