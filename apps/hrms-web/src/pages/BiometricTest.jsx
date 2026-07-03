import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Alert,
  Typography,
  Space,
  Divider,
  Badge,
  Select,
  DatePicker,
  Form,
  Tabs,
  Input,
  Popconfirm,
  message,
} from 'antd';
import {
  RefreshCw,
  Activity,
  Play,
  Link2,
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import apiClient from '../api/axios';
import dayjs from 'dayjs';
import { ENV } from '../lib/env';

const { Title, Text } = Typography;

// Use VITE_API_BASE_URL if set (e.g. "http://localhost:4000/api/v1"),
// otherwise fall back to constructing from API_URL + API_VERSION.
// Avoids double-versioning when VITE_API_URL already includes "/v1".
const API_BASE = ENV.API_BASE_URL
  || (ENV.API_URL
    ? ENV.API_URL.replace(/\/v\d+\/?$/, '') + `/${ENV.API_VERSION || 'v1'}`
    : `/api/${ENV.API_VERSION || 'v1'}`
  );

const DEVICE_USER_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  label: `Device ID ${i + 1}`,
  value: String(i + 1),
}));

export default function BiometricTest() {
  const [simForm] = Form.useForm();
  const [pushLogs, setPushLogs] = useState([]);
  const [punchLogs, setPunchLogs] = useState([]);
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState({
    pushLogs: false,
    punchLogs: false,
    simulate: false,
    mappings: false,
    reboot: false,
  });
  const [lastRefresh, setLastRefresh] = useState(null);
  const pollRef = useRef(null);

  // Date filter for log tables — defaults to today
  const [filterDate, setFilterDate] = useState(dayjs());


  // Mapping state
  const [employees, setEmployees] = useState([]);
  const [mapEmployeeId, setMapEmployeeId] = useState(null);
  const [mapDeviceId, setMapDeviceId] = useState('');
  const [savingMap, setSavingMap] = useState(false);

  // Import state
  const [importData, setImportData] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Auto-poll every 10 seconds for TODAY's data only
  useEffect(() => {
    fetchPushLogs(filterDate);
    fetchPunchLogs(filterDate);
    fetchMappings();
    pollRef.current = setInterval(() => {
      fetchPushLogs(filterDate);
      fetchPunchLogs(filterDate);
    }, 10000);
    return () => clearInterval(pollRef.current);
  }, []);

  // Re-fetch when the date filter changes
  useEffect(() => {
    fetchPushLogs(filterDate);
    fetchPunchLogs(filterDate);
  }, [filterDate]);

  async function fetchPushLogs(date) {
    try {
      const dateStr = date ? date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      const { data } = await apiClient.get(`/biometric/push-logs?date=${dateStr}`);
      setPushLogs(data.data ?? []);
      setLastRefresh(new Date());
    } catch {
      // silently fail on poll
    }
  }

  async function fetchPunchLogs(date) {
    try {
      const dateStr = date ? date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      const { data } = await apiClient.get(`/biometric/punch-logs?date=${dateStr}`);
      setPunchLogs(data.data ?? []);
    } catch {
      // silently fail
    }
  }

  async function fetchMappings() {
    setLoading((l) => ({ ...l, mappings: true }));
    try {
      const { data } = await apiClient.get(`/biometric/mappings`);
      setEmployees(data.data ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading((l) => ({ ...l, mappings: false }));
    }
  }

  async function handleRefresh() {
    setLoading((l) => ({ ...l, pushLogs: true, punchLogs: true }));
    await Promise.all([fetchPushLogs(filterDate), fetchPunchLogs(filterDate)]);
    setLoading((l) => ({ ...l, pushLogs: false, punchLogs: false }));
  }

  async function handleReboot() {
    setLoading((l) => ({ ...l, reboot: true }));
    try {
      const { data } = await apiClient.post(`/biometric/reboot`);
      message.success(data.message);
    } catch (err) {
      message.error(err.response?.data?.message || err.message);
    } finally {
      setLoading((l) => ({ ...l, reboot: false }));
    }
  }

  async function handleImport() {
    if (!importData.trim()) {
      message.error('Paste punch data first');
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    try {
      const { data } = await apiClient.post(`/biometric/import`, { data: importData });
      setImportResult(data);
      message.success(`Imported ${data.imported} punches (${data.skipped} skipped)`);
      fetchPushLogs();
      fetchPunchLogs();
    } catch (err) {
      message.error(err.response?.data?.message || err.message);
    } finally {
      setImportLoading(false);
    }
  }

  async function handleSimulate() {
    const values = simForm.getFieldsValue();
    if (!values.deviceUserId) {
      message.error('Select a device user ID');
      return;
    }
    setLoading((l) => ({ ...l, simulate: true }));
    setSimResult(null);
    try {
      const payload = {
        deviceUserId: values.deviceUserId,
        isoTime: values.isoTime ? values.isoTime.toISOString() : undefined,
      };
      const { data } = await apiClient.post(`/biometric/simulate`, payload);
      setSimResult(data);
      message.success(`Punch injected for ${data.employee?.name} on ${data.date}`);
      // Auto-jump the date filter to the injected date so the user sees it immediately
      if (data.date) {
        const injectedDate = dayjs(data.date);
        setFilterDate(injectedDate);
        await Promise.all([fetchPushLogs(injectedDate), fetchPunchLogs(injectedDate)]);
      } else {
        await Promise.all([fetchPushLogs(filterDate), fetchPunchLogs(filterDate)]);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      message.error(msg);
      setSimResult({ success: false, message: msg });
    } finally {
      setLoading((l) => ({ ...l, simulate: false }));
    }
  }

  async function handleSaveMapping() {
    if (!mapEmployeeId || !mapDeviceId.trim()) {
      message.error('Select an employee and enter a device ID');
      return;
    }
    setSavingMap(true);
    try {
      await apiClient.post(`/biometric/mappings`, {
        employeeId: mapEmployeeId,
        deviceId: mapDeviceId.trim(),
      });
      message.success('Mapping saved');
      setMapEmployeeId(null);
      setMapDeviceId('');
      fetchMappings();
    } catch (err) {
      message.error(err.response?.data?.message || err.message);
    } finally {
      setSavingMap(false);
    }
  }

  async function handleDeleteMapping(employeeId) {
    try {
      await apiClient.delete(`/biometric/mappings/${employeeId}`);
      message.success('Mapping removed');
      fetchMappings();
    } catch (err) {
      message.error(err.response?.data?.message || err.message);
    }
  }

  const refreshExtra = (
    <Space wrap>
      <Text type="secondary" style={{ fontSize: 12 }}>Viewing:</Text>
      <DatePicker
        value={filterDate}
        onChange={(d) => d && setFilterDate(d)}
        format="DD MMM YYYY"
        allowClear={false}
        size="small"
        style={{ width: 130 }}
        disabledDate={(d) => d && d.isAfter(dayjs(), 'day')}
      />
      <Button
        size="small"
        onClick={() => setFilterDate(dayjs())}
        disabled={filterDate.isSame(dayjs(), 'day')}
      >
        Today
      </Button>
      {lastRefresh && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Updated: {lastRefresh.toLocaleTimeString()}
        </Text>
      )}
      <Button
        icon={<RefreshCw size={14} />}
        loading={loading.pushLogs || loading.punchLogs}
        onClick={handleRefresh}
        size="small"
      >
        Refresh
      </Button>
    </Space>
  );

  const mapped = employees.filter((e) => e.deviceId);
  const unmappedOptions = employees
    .filter((e) => !e.deviceId)
    .map((e) => ({ label: `${e.employeeName?.trim()} (${e.employeeCode})`, value: e.id }));

  // ─── Column definitions ───────────────────────────────────────────────────

  const pushLogColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (d) => d ? String(d).slice(0, 10) : '—',
      defaultSortOrder: 'descend',
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
    },
    {
      title: 'Employee',
      key: 'employee',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.employeeName?.trim() || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.employeeCode} · Device ID: {r.deviceUserId ?? '—'}</Text>
        </Space>
      ),
    },
    {
      title: 'Clock-In',
      dataIndex: 'firstPunch',
      key: 'firstPunch',
      render: (t) => t ? <Tag color="green">{dayjs(t).format('hh:mm:ss A')}</Tag> : '—',
    },
    {
      title: 'Clock-Out',
      dataIndex: 'lastPunch',
      key: 'lastPunch',
      render: (t) => t
        ? <Tag color="blue">{dayjs(t).format('hh:mm:ss A')}</Tag>
        : <Tag color="orange">Still In</Tag>,
    },
    {
      title: 'Hours',
      dataIndex: 'workHours',
      key: 'workHours',
      width: 80,
      render: (h) => h != null ? `${h}h` : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => {
        const colors = { present: 'green', checked_in: 'blue', incomplete: 'orange', absent: 'red' };
        return <Tag color={colors[s] ?? 'default'}>{s?.replace('_', ' ') ?? '—'}</Tag>;
      },
    },
  ];

  const punchLogColumns = [
    {
      title: 'Timestamp (IST)',
      dataIndex: 'loggedAt',
      key: 'loggedAt',
      width: 180,
      defaultSortOrder: 'descend',
      sorter: (a, b) => (a.loggedAt > b.loggedAt ? -1 : 1),
      render: (t) => t ? dayjs(t).format('DD MMM, hh:mm:ss A') : '—',
    },
    {
      title: 'Employee',
      key: 'employee',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.employeeName?.trim() || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.employeeCode} · Device: {r.deviceUserId ?? '—'}</Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'punchType',
      key: 'punchType',
      width: 120,
      render: (t) => (
        <Tag color={t === 'clock_in' ? 'green' : 'blue'} style={{ fontWeight: 600 }}>
          {t === 'clock_in' ? '▶ Clock In' : '◼ Clock Out'}
        </Tag>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 130,
      render: (s) => {
        const colorMap = { biometric: 'purple', simulate: 'cyan', biometric_cron: 'geekblue' };
        return <Tag color={colorMap[s] ?? 'default'}>{s}</Tag>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (d) => d ? String(d).slice(0, 10) : '—',
    },
  ];

  const mappingColumns = [
    {
      title: 'Device ID',
      dataIndex: 'deviceId',
      key: 'deviceId',
      width: 100,
      render: (d) => <Tag color="blue" style={{ fontWeight: 600 }}>{d}</Tag>,
    },
    {
      title: 'Employee',
      key: 'employee',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.employeeName?.trim()}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.employeeCode} · {r.email}</Text>
        </Space>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, r) => (
        <Popconfirm
          title="Remove this mapping?"
          description={`${r.employeeName?.trim()} will no longer be tracked by device ID ${r.deviceId}`}
          onConfirm={() => handleDeleteMapping(r.id)}
          okText="Remove"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<Trash2 size={14} />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Biometric Device Manager</Title>
      <Text type="secondary">
        Realtime punch tracking via iClock/ADMS protocol · Polls every 5s
      </Text>

      <Divider />

      {/* ── Force Device Reconnect ─────────────────────────────────── */}
      <Card
        title={<Space><RotateCcw size={16} />Force Device Reconnect</Space>}
        style={{ marginBottom: 24 }}
      >
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message="Use when: punches aren't arriving in realtime, or after an API config change. The device will reboot and re-handshake within ~30 seconds."
        />
        <Button
          type="primary"
          icon={<RotateCcw size={14} />}
          loading={loading.reboot}
          onClick={handleReboot}
        >
          Reboot Device
        </Button>
      </Card>

      {/* ── Device-Employee Mapping ────────────────────────────────── */}
      <Card
        title={<Space><Link2 size={16} />Device-Employee Mapping</Space>}
        style={{ marginBottom: 24 }}
        extra={
          <Button icon={<RefreshCw size={14} />} size="small" loading={loading.mappings} onClick={fetchMappings}>
            Refresh
          </Button>
        }
      >
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          message="Map each employee's biometric device ID (their finger/card number) to their HRMS profile. Punches from the device are matched using this mapping."
        />
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            style={{ width: 280 }}
            placeholder="Select employee to map"
            showSearch
            optionFilterProp="label"
            options={unmappedOptions}
            value={mapEmployeeId}
            onChange={setMapEmployeeId}
            allowClear
          />
          <Input
            style={{ width: 160 }}
            placeholder="Device ID (e.g. 3)"
            value={mapDeviceId}
            onChange={(e) => setMapDeviceId(e.target.value)}
            onPressEnter={handleSaveMapping}
          />
          <Button type="primary" icon={<Plus size={14} />} loading={savingMap} onClick={handleSaveMapping}>
            Map
          </Button>
        </div>
        <Table
          dataSource={mapped}
          columns={mappingColumns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'No employees mapped yet — add a mapping above to start tracking punches' }}
        />
      </Card>

      {/* ── Simulate Punch ─────────────────────────────────────────── */}
      <Card
        title={<Space><Play size={16} />Simulate Punch (Test without device)</Space>}
        style={{ marginBottom: 24 }}
      >
        <Form form={simForm} layout="inline">
          <Form.Item name="deviceUserId" label="Device User ID" rules={[{ required: true }]}>
            <Select style={{ width: 160 }} options={DEVICE_USER_OPTIONS} placeholder="Select ID 1-12" />
          </Form.Item>
          <Form.Item name="isoTime" label="Time (optional)">
            <DatePicker showTime style={{ width: 200 }} format="YYYY-MM-DD HH:mm:ss" placeholder="Now" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<Play size={14} />} loading={loading.simulate} onClick={handleSimulate}>
              Inject Punch
            </Button>
          </Form.Item>
        </Form>
        {simResult && (
          <div style={{ marginTop: 12 }}>
            {simResult.success ? (
              <Alert
                type="success"
                showIcon
                message={`Clock In recorded for ${simResult.employee?.name} (${simResult.employee?.code}) at ${simResult.istTime}`}
              />
            ) : (
              <Alert type="error" showIcon message={simResult.message} />
            )}
          </div>
        )}
      </Card>

      {/* ── Live Punch Feed ─────────────────────────────────────────── */}
      <Card
        title={
          <Space>
            <Activity size={16} />
            Live Punch Feed
            <Badge
              status="processing"
              text={<Text type="secondary" style={{ fontSize: 12 }}>auto-refresh every 5s</Text>}
            />
          </Space>
        }
        extra={refreshExtra}
      >
        <Tabs
          defaultActiveKey="summary"
          items={[
            {
              key: 'summary',
              label: `Daily Summary (${pushLogs.length})`,
              children: (
                <Table
                  dataSource={pushLogs}
                  columns={pushLogColumns}
                  rowKey={(r) => `${r.employeeCode}-${r.date}`}
                  size="small"
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: 'No punches yet — scan a fingerprint or use Simulate above' }}
                />
              ),
            },
            {
              key: 'raw',
              label: `Raw Punch Logs (${punchLogs.length})`,
              children: (
                <Table
                  dataSource={punchLogs}
                  columns={punchLogColumns}
                  rowKey={(r) => r.id}
                  size="small"
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: 'No individual punch logs yet' }}
                />
              ),
            },
            {
              key: 'import',
              label: 'Import Data',
              children: (
                <div>
                  <Alert
                    type="info"
                    showIcon
                    message="Paste tab-separated punch data from AttendanceTracker desktop software"
                    description="Format: Sno → DeviceID → Date (YYYY-MM-DD) → Time (HH:mm:ss). Use Data Transfer → Download All Data in the desktop app, then copy the data here."
                    style={{ marginBottom: 16 }}
                  />
                  <Input.TextArea
                    rows={10}
                    placeholder={`1\t00000001\t2026-03-11\t08:32:21\n2\t00000008\t2026-03-11\t08:47:53\n...`}
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    style={{ fontFamily: 'monospace', marginBottom: 12 }}
                  />
                  <Button
                    type="primary"
                    loading={importLoading}
                    onClick={handleImport}
                    disabled={!importData.trim()}
                  >
                    Import Punches
                  </Button>
                  {importResult && (
                    <Alert
                      type={importResult.imported > 0 ? 'success' : 'warning'}
                      showIcon
                      style={{ marginTop: 12 }}
                      message={`Imported: ${importResult.imported} | Skipped: ${importResult.skipped} | Total: ${importResult.total}`}
                      description={
                        <>
                          {importResult.unmappedDeviceIds?.length > 0 && (
                            <div>Unmapped device IDs: {importResult.unmappedDeviceIds.join(', ')}</div>
                          )}
                          {importResult.errors?.length > 0 && (
                            <div style={{ color: 'red' }}>Errors: {importResult.errors.join('; ')}</div>
                          )}
                        </>
                      }
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
