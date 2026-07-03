import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAppDispatch } from '../app/hooks';
import { useLoginMutation } from '../features/auth/authApi';
import { setLocalTokens } from '../features/auth/authSlice';
import { ENV } from '../lib/env';

const { Title, Text } = Typography;

/**
 * Local email/password login (AUTH_MODE=jwt). On success the tokens are stored
 * (and persisted), then we reload into the app which routes to the dashboard.
 */
export default function LoginPage() {
  const dispatch = useAppDispatch();
  const [login] = useLoginMutation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: { email: string; password: string; rememberMe?: boolean }) => {
    setError(null);
    setLoading(true);
    try {
      const res = await login({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      }).unwrap();
      const { accessToken, refreshToken } = res.data;
      dispatch(setLocalTokens({ accessToken, refreshToken }));
      window.location.assign('/dashboard');
    } catch (err: any) {
      setError(err?.data?.error?.message || err?.data?.message || 'Login failed. Check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #eef2ff 0%, #f9fafb 100%)',
        padding: 16,
      }}
    >
      <Card style={{ width: 400, maxWidth: '100%', boxShadow: '0 10px 30px rgba(16,24,40,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>{ENV.APP_NAME || 'ProjectFlow'}</Title>
          <Text type="secondary">Sign in to your account</Text>
        </div>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={{ rememberMe: true }}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: 'Please enter your email' }, { type: 'email', message: 'Enter a valid email' }]}
          >
            <Input size="large" prefix={<UserOutlined />} placeholder="you@company.com" autoComplete="username" autoFocus />
          </Form.Item>

          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter your password' }]}>
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="Password" autoComplete="current-password" />
          </Form.Item>

          <Form.Item name="rememberMe" valuePropName="checked" style={{ marginBottom: 12 }}>
            <Checkbox>Keep me signed in</Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              Sign in
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
