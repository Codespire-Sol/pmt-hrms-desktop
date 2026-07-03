import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Input, Button, Tag, message, Modal, Form, Spin, Empty,
  Typography, Breadcrumb, Space,
} from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Fingerprint } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { biometricAPI } from '../api/biometric';
import { themeTokens } from '../styles/theme';

const { Title, Text } = Typography;
const { Search } = Input;

const C = themeTokens.colors;
const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';

export default function BiometricMappings() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await biometricAPI.getMappings();
      setEmployees(res.data || []);
    } catch {
      message.error('Failed to load biometric mappings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (emp) => {
    setEditEmployee(emp);
    form.setFieldsValue({ deviceId: emp.deviceId || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await biometricAPI.setMapping(editEmployee.id, values.deviceId.trim());
      message.success(`PIN ${values.deviceId.trim()} mapped to ${editEmployee.employeeName}`);
      setModalOpen(false);
      await load();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (emp) => {
    Modal.confirm({
      title: 'Remove Biometric Mapping',
      content: `Remove device mapping for ${emp.employeeName} (PIN: ${emp.deviceId})?`,
      okText: 'Remove',
      okType: 'danger',
      onOk: async () => {
        try {
          await biometricAPI.removeMapping(emp.id);
          message.success('Mapping removed');
          await load();
        } catch {
          message.error('Failed to remove mapping');
        }
      },
    });
  };

  const filtered = employees.filter((emp) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      emp.employeeName.toLowerCase().includes(q) ||
      (emp.employeeCode || '').toLowerCase().includes(q) ||
      (emp.deviceId || '').includes(q);
    const matchFilter =
      filter === 'all' ||
      (filter === 'mapped' && emp.deviceId) ||
      (filter === 'unmapped' && !emp.deviceId);
    return matchSearch && matchFilter;
  });

  const mappedCount = employees.filter(e => e.deviceId).length;
  const unmappedCount = employees.length - mappedCount;

  const FILTERS = [
    { key: 'all', label: 'All', count: employees.length },
    { key: 'mapped', label: 'Mapped', count: mappedCount },
    { key: 'unmapped', label: 'Not Mapped', count: unmappedCount },
  ];

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Breadcrumb
              style={{ marginBottom: 8 }}
              items={[
                { title: <Link to="/dashboard">Dashboard</Link> },
                { title: 'Biometric Mappings' },
              ]}
            />
            <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: C.heading }}>
              Biometric Device Mappings
            </Title>
            <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
              Assign each employee's fingerprint device PIN. Once mapped, attendance is tracked automatically.
            </Text>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignSelf: 'flex-start', marginTop: 4 }}>
            {/* Mapped — blue accent */}
            <div style={{
              background: C.accent, border: `1px solid ${C.blue100}`,
              borderRadius: 12, padding: '10px 18px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.primary, lineHeight: 1 }}>{mappedCount}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>Mapped</div>
            </div>
            {/* Not Mapped — grey */}
            <div style={{
              background: C.secondaryBackground, border: `1px solid ${C.borders}`,
              borderRadius: 12, padding: '10px 18px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.textSecondary, lineHeight: 1 }}>{unmappedCount}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>Not Mapped</div>
            </div>
            {/* Total — dark */}
            <div style={{
              background: C.heading, border: `1px solid ${C.heading}`,
              borderRadius: 12, padding: '10px 18px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{employees.length}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>Total</div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          background: '#fff', border: `1px solid ${C.borders}`,
          borderRadius: 14, padding: '14px 18px',
        }}>
          <Search
            placeholder="Search by name, employee code or device PIN…"
            allowClear
            style={{ maxWidth: 320, flex: '1 1 200px' }}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            {FILTERS.map(f => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: `1.5px solid ${active ? C.primary : C.borders}`,
                    background: active ? BTN_GRADIENT : '#fff',
                    color: active ? '#fff' : C.textSecondary,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {f.label}
                  <span style={{
                    background: active ? 'rgba(255,255,255,0.22)' : C.secondaryBackground,
                    color: active ? '#fff' : C.textTertiary,
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 7px',
                    minWidth: 22,
                    textAlign: 'center',
                    transition: 'all 0.18s ease',
                  }}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
        ) : filtered.length === 0 ? (
          <Empty description="No employees found" style={{ marginTop: 60 }} />
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            borderRadius: 14, border: `1px solid ${C.borders}`, overflow: 'hidden',
          }}>
            {/* Column header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 200px 150px 130px',
              gap: 12,
              padding: '10px 20px',
              background: C.secondaryBackground,
              borderBottom: `1px solid ${C.borders}`,
              fontSize: 11, fontWeight: 700,
              color: C.textTertiary,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}>
              <span>Employee</span>
              <span>Code</span>
              <span>Email</span>
              <span>Device PIN</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>

            {filtered.map((emp, idx) => (
              <div
                key={emp.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 200px 150px 130px',
                  gap: 12,
                  padding: '14px 20px',
                  background: idx % 2 === 0 ? '#fff' : C.appBackground,
                  borderBottom: idx < filtered.length - 1 ? `1px solid ${C.borders}` : 'none',
                  alignItems: 'center',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.accent}
                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : C.appBackground}
              >
                {/* Name + icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: emp.deviceId ? C.accent : C.secondaryBackground,
                    border: `1px solid ${emp.deviceId ? C.blue100 : C.borders}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Fingerprint size={16} color={emp.deviceId ? C.primary : C.textTertiary} />
                  </div>
                  <span style={{ fontWeight: 600, color: C.textPrimary, fontSize: 14 }}>
                    {emp.employeeName}
                  </span>
                </div>

                {/* Code */}
                <span style={{ fontSize: 12, color: C.textTertiary, fontFamily: 'monospace', fontWeight: 600 }}>
                  {emp.employeeCode || '—'}
                </span>

                {/* Email */}
                <span style={{ fontSize: 12, color: C.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {emp.email || '—'}
                </span>

                {/* Device PIN */}
                {emp.deviceId ? (
                  <Tag style={{
                    fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
                    padding: '4px 12px', borderRadius: 8,
                    background: C.accent, color: C.primaryDark, border: `1px solid ${C.blue100}`,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    PIN: {emp.deviceId}
                  </Tag>
                ) : (
                  <Tag style={{
                    fontWeight: 600, fontSize: 12,
                    padding: '4px 12px', borderRadius: 8,
                    background: C.secondaryBackground, color: C.textTertiary, border: `1px solid ${C.borders}`,
                  }}>
                    Not Mapped
                  </Tag>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    icon={emp.deviceId ? <EditOutlined /> : <PlusOutlined />}
                    onClick={() => openEdit(emp)}
                    style={{
                      borderRadius: 8, fontWeight: 600, fontSize: 12,
                      color: C.primary, borderColor: C.primary,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {emp.deviceId ? 'Edit' : 'Assign'}
                  </Button>
                  {emp.deviceId && (
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemove(emp)}
                      style={{ borderRadius: 8, fontSize: 12, transition: 'all 0.15s ease' }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        title={
          <Space>
            <Fingerprint size={16} color={C.primary} />
            <span style={{ fontWeight: 700 }}>
              {editEmployee?.deviceId ? 'Edit Device PIN' : 'Assign Device PIN'} — {editEmployee?.employeeName}
            </span>
          </Space>
        }
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={handleSave}
        okText="Save Mapping"
        okButtonProps={{ style: { background: BTN_GRADIENT, border: 'none', fontWeight: 600 } }}
        confirmLoading={saving}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          Enter the numeric PIN from the device user list for this employee.
        </Text>
        <Form form={form} layout="vertical">
          <Form.Item
            label="Device PIN"
            name="deviceId"
            rules={[
              { required: true, message: 'Please enter the device PIN' },
              { pattern: /^\d+$/, message: 'PIN must be numeric digits only' },
            ]}
          >
            <Input
              placeholder="e.g. 1, 42, 123"
              style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: '0.1em' }}
              autoFocus
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
