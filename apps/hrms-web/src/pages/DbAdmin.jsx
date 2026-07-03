import { useState } from 'react';
import { Card, Button, Typography, Space, Statistic, Row, Col, Alert, Input, message } from 'antd';
import { Database, Trash2, RefreshCw } from 'lucide-react';
import axios from 'axios';
import apiClient from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { ENV } from '../lib/env';

const { Title, Text } = Typography;

const API_BASE = ENV.API_BASE_URL || `${ENV.API_URL}/${ENV.API_VERSION}`;

export default function DbAdmin() {
  const [stats, setStats] = useState(null);
  const [killResult, setKillResult] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingKill, setLoadingKill] = useState(false);
  const [error, setError] = useState(null);

  const token = useAuthStore((s) => s.token);

  // Use apiClient (with token) if logged in, otherwise raw axios (no token)
  const http = token ? apiClient : axios;

  const fetchStats = async () => {
    setLoadingStats(true);
    setError(null);
    try {
      const { data } = await http.get(`${token ? '' : API_BASE}/admin/db/connections`);
      setStats(data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to fetch stats');
    } finally {
      setLoadingStats(false);
    }
  };

  const killIdle = async () => {
    setLoadingKill(true);
    setError(null);
    try {
      const { data } = await http.post(`${token ? '' : API_BASE}/admin/db/kill-idle`);
      setKillResult(data.data);
      setStats(data.data.currentStats);
      message.success(`Terminated ${data.data.terminated} idle connections`);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to kill connections');
    } finally {
      setLoadingKill(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: 40 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <Database size={28} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Database Connection Manager
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          Monitor and manage PostgreSQL database connections.
          {token
            ? <span style={{ color: '#52c41a', marginLeft: 8 }}>Authenticated</span>
            : <span style={{ color: '#faad14', marginLeft: 8 }}>Not logged in — will work after API redeployment</span>
          }
        </Text>

        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        <Space size="large" style={{ marginBottom: 24 }}>
          <Button
            type="primary"
            size="large"
            icon={<RefreshCw size={18} />}
            loading={loadingStats}
            onClick={fetchStats}
          >
            Get Connections
          </Button>
          <Button
            danger
            size="large"
            icon={<Trash2 size={18} />}
            loading={loadingKill}
            onClick={killIdle}
          >
            Kill Idle Connections
          </Button>
        </Space>

        {stats && (
          <Card title="Connection Stats" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={4}>
                <Statistic title="Total" value={stats.total} />
              </Col>
              <Col span={5}>
                <Statistic title="Active" value={stats.active} valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col span={5}>
                <Statistic title="Idle" value={stats.idle} valueStyle={{ color: '#faad14' }} />
              </Col>
              <Col span={5}>
                <Statistic title="Idle in Txn" value={stats.idleInTransaction} valueStyle={{ color: '#ff4d4f' }} />
              </Col>
              <Col span={5}>
                <Statistic title="Max Allowed" value={stats.maxConnections} />
              </Col>
            </Row>
          </Card>
        )}

        {killResult && (
          <Alert
            message={`Terminated ${killResult.terminated} idle connections`}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
      </div>
    </div>
  );
}
