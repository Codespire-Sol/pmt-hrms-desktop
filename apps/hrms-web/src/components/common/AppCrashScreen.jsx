import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button, Card, Space, Typography } from 'antd';
import keycloak from '../../lib/keycloak';

const { Title, Text } = Typography;

export default function AppCrashScreen({ title, description, errorCode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#f8fafc',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 560,
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
        }}
        styles={{ body: { padding: '28px' } }}
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Space size={10}>
            <AlertTriangle size={20} color="#ef4444" />
            <Title level={4} style={{ margin: 0 }}>
              {title || 'Something went wrong'}
            </Title>
          </Space>

          <Text type="secondary">
            {description || 'The app hit an unexpected issue. Please reload once. If this keeps happening, check backend status and API logs.'}
          </Text>

          {errorCode ? (
            <Text code>{errorCode}</Text>
          ) : null}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <Button
              type="primary"
              icon={<RefreshCcw size={16} />}
              onClick={() => window.location.reload()}
            >
              Reload App
            </Button>
            <Button onClick={() => keycloak.login({ redirectUri: window.location.origin })}>
              Go to Login
            </Button>
          </div>
        </Space>
      </Card>
    </div>
  );
}
