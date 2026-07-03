import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card, Form, Input, InputNumber, Switch, Button, Tabs, Typography, message, Space, Alert, Divider,
} from 'antd';
import {
  MailOutlined, BankOutlined, ClockCircleOutlined, SendOutlined,
  ScanOutlined, CopyOutlined, LinkOutlined,
} from '@ant-design/icons';
import apiClient from '../api/axios';
import { ENV } from '../lib/env';

const { Title, Text } = Typography;

/**
 * Admin Settings — configure SMTP (email) and company info from the UI instead
 * of editing .env. (Attendance rules are set via .env.) Backend: /api/v1/admin/app-settings
 */
export default function AdminSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [pushTokenSet, setPushTokenSet] = useState(false);

  // Build the device push URL from the injected LAN host (same source as the
  // Share button), falling back to the browser's hostname for local dev.
  const deviceHost = ENV.PUBLIC_HOST || window.location.hostname;
  const pushUrl = `http://${deviceHost}:4000/api/v1/biometric/realtime-push`;

  const copyPushUrl = async () => {
    try {
      await navigator.clipboard.writeText(pushUrl);
      message.success('Push URL copied');
    } catch {
      message.error('Could not copy — select and copy manually');
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/admin/app-settings');
      const s = data?.data || {};
      setPasswordSet(!!s.smtp?.passwordSet);
      setPushTokenSet(!!s.biometric?.pushTokenSet);
      form.setFieldsValue({
        smtpHost: s.smtp?.host, smtpPort: s.smtp?.port, smtpSecure: s.smtp?.secure,
        smtpUser: s.smtp?.user, smtpPassword: '', smtpFromName: s.smtp?.fromName, smtpFromEmail: s.smtp?.fromEmail,
        companyName: s.company?.name,
        fullDayHours: s.attendance?.fullDayHours, halfDayHours: s.attendance?.halfDayHours,
        officeStartTime: s.attendance?.officeStartTime, timezone: s.attendance?.timezone,
        biometricPushToken: '',
      });
    } catch (e) {
      message.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSave = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const smtp = {
        host: v.smtpHost, port: v.smtpPort, secure: v.smtpSecure,
        user: v.smtpUser, fromName: v.smtpFromName, fromEmail: v.smtpFromEmail,
      };
      // Only send the password when the admin typed a new one (blank = keep existing).
      if (v.smtpPassword) smtp.password = v.smtpPassword;

      const payload = {
        smtp,
        company: { name: v.companyName },
      };
      // Only send the device token when the admin typed a new one (blank = keep
      // existing). Clearing is done via the explicit "Clear token" button.
      if (v.biometricPushToken) payload.biometricPushToken = v.biometricPushToken;

      const { data } = await apiClient.put('/admin/app-settings', payload);
      message.success('Settings saved');
      setPasswordSet(!!data?.data?.smtp?.passwordSet);
      setPushTokenSet(!!data?.data?.biometric?.pushTokenSet);
      form.setFieldValue('smtpPassword', '');
      form.setFieldValue('biometricPushToken', '');
    } catch (e) {
      message.error(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const onTestEmail = async () => {
    const to = form.getFieldValue('testTo');
    if (!to) { message.warning('Enter a recipient email to test'); return; }
    setTesting(true);
    try {
      await apiClient.post('/admin/app-settings/test-email', { to });
      message.success(`Test email sent to ${to}`);
    } catch (e) {
      message.error(e?.message || 'Test email failed — check the SMTP settings');
    } finally {
      setTesting(false);
    }
  };

  const onClearToken = async () => {
    setSaving(true);
    try {
      const { data } = await apiClient.put('/admin/app-settings', { biometricPushToken: '' });
      setPushTokenSet(!!data?.data?.biometric?.pushTokenSet);
      form.setFieldValue('biometricPushToken', '');
      message.success('Device token cleared — the push endpoint is now open on your LAN');
    } catch (e) {
      message.error(e?.message || 'Failed to clear token');
    } finally {
      setSaving(false);
    }
  };

  const items = [
    {
      key: 'email',
      label: <span><MailOutlined /> Email (SMTP)</span>,
      children: (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            message="Email is used for onboarding invites, OTPs, and notifications. Leave blank to disable email." />
          <Form.Item name="smtpHost" label="SMTP host"><Input placeholder="smtp.gmail.com" /></Form.Item>
          <Space size="large">
            <Form.Item name="smtpPort" label="Port"><InputNumber min={1} max={65535} placeholder="587" /></Form.Item>
            <Form.Item name="smtpSecure" label="Use SSL (port 465)" valuePropName="checked"><Switch /></Form.Item>
          </Space>
          <Form.Item name="smtpUser" label="Username"><Input placeholder="you@company.com" autoComplete="off" /></Form.Item>
          <Form.Item name="smtpPassword" label="Password / App password"
            extra={passwordSet ? 'A password is already saved — leave blank to keep it.' : null}>
            <Input.Password placeholder={passwordSet ? '•••••••• (unchanged)' : 'App password'} autoComplete="new-password" />
          </Form.Item>
          <Space size="large">
            <Form.Item name="smtpFromName" label="From name"><Input placeholder="HRMS" /></Form.Item>
            <Form.Item name="smtpFromEmail" label="From email"><Input placeholder="noreply@company.com" /></Form.Item>
          </Space>
          <Divider />
          <Text strong>Send a test email</Text>
          <Space style={{ display: 'flex', marginTop: 8 }}>
            <Form.Item name="testTo" noStyle><Input placeholder="your@email.com" style={{ width: 260 }} /></Form.Item>
            <Button icon={<SendOutlined />} loading={testing} onClick={onTestEmail}>Send test</Button>
          </Space>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Save your settings first, then send a test.
          </Text>
        </>
      ),
    },
    {
      key: 'company',
      label: <span><BankOutlined /> Company</span>,
      children: (
        <Form.Item name="companyName" label="Company name"
          extra="Shown in onboarding emails, offer letters, and generated documents.">
          <Input placeholder="Your Company" style={{ maxWidth: 360 }} />
        </Form.Item>
      ),
    },
    {
      key: 'device',
      label: <span><ScanOutlined /> Attendance Device</span>,
      children: (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            message="Connect a fingerprint / biometric attendance device so punches flow into HRMS automatically." />

          <Form.Item label="Device Push URL"
            extra="Give this URL to your fingerprint device vendor (RealTime Cloud → Parallel Data Export).">
            <Space.Compact style={{ display: 'flex', maxWidth: 520 }}>
              <Input readOnly value={pushUrl} onFocus={(e) => e.target.select()} />
              <Button icon={<CopyOutlined />} onClick={copyPushUrl}>Copy</Button>
            </Space.Compact>
          </Form.Item>

          <Divider />

          <Form.Item name="biometricPushToken" label="Device security token (optional)"
            extra={pushTokenSet
              ? 'A token is set — the device must send it as the x-device-token header. Leave blank to keep it, or clear it to reopen on your LAN.'
              : 'Leave blank to keep the endpoint open on your LAN. Set a token to require the device to send it as the x-device-token header.'}>
            <Input.Password
              placeholder={pushTokenSet ? '•••••••• (set — leave blank to keep)' : 'e.g. a long random string'}
              autoComplete="new-password"
              style={{ maxWidth: 360 }}
            />
          </Form.Item>
          {pushTokenSet && (
            <Button danger size="small" onClick={onClearToken} loading={saving} style={{ marginBottom: 16 }}>
              Clear token
            </Button>
          )}

          <Divider />

          <Link to="/biometric-mappings">
            <Button icon={<LinkOutlined />}>Manage employee mappings</Button>
          </Link>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Map each device employee code to an HRMS employee so punches are attributed correctly.
          </Text>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <Title level={3}>Admin Settings</Title>
      <Text type="secondary">Configure email (SMTP) and company details — no file editing needed. (Attendance rules are set in the .env file.)</Text>
      <Card style={{ marginTop: 16 }} loading={loading}>
        <Form form={form} layout="vertical">
          <Tabs items={items} />
          <Divider />
          <Button type="primary" onClick={onSave} loading={saving}>Save settings</Button>
        </Form>
      </Card>
    </div>
  );
}
