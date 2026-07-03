import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Button,
  Col,
  Form,
  Grid,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  message,
} from 'antd';

const { useBreakpoint } = Grid;
import { Mail, MapPin, Pencil, Phone, Shield } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { adminAPI } from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { toTitleCase } from '../utils/name';
import { themeTokens } from '../styles/theme';

const { Title, Text } = Typography;
const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';

function getInitials(user) {
  const first = user.firstName?.[0] || '';
  const last = user.lastName?.[0] || '';
  return (first + last).toUpperCase() || (user.email?.[0] || '?').toUpperCase();
}

const AVATAR_COLORS = [
  '#1268ff', '#5700ff', '#ff6b1a', '#10b981', '#faad14', '#0b3d99',
];
function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function AdminHrAccounts() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [hrUsers, setHrUsers] = useState([]);
  const [maxHrAccounts, setMaxHrAccounts] = useState(5);
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Manage (branch assign) modal
  const [manageForm] = Form.useForm();
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [manageSubmitting, setManageSubmitting] = useState(false);

  // Max limit edit modal
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitForm] = Form.useForm();
  const [limitSubmitting, setLimitSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [hrRes, branchRes] = await Promise.all([
        adminAPI.getHrAccounts(),
        adminAPI.getBranches(),
      ]);
      const data = hrRes?.data || {};
      setHrUsers(Array.isArray(data.items) ? data.items : []);
      setMaxHrAccounts(data.maxHrAccounts ?? 5);
      setBranches(Array.isArray(branchRes?.data) ? branchRes.data : []);
    } catch (error) {
      message.error(error?.message || 'Failed to load HR accounts');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);
  useAutoRefresh(loadData, { enabled: isAdmin, scope: 'employees', intervalMs: 120000 });

  // Branch filter tabs
  const branchTabs = useMemo(() => {
    const names = new Set();
    hrUsers.forEach((u) => {
      if (u.branchId) {
        const b = branches.find((br) => br.id === u.branchId);
        if (b) names.add(b.name);
      }
    });
    return ['all', ...Array.from(names)];
  }, [hrUsers, branches]);

  const filteredUsers = useMemo(() => {
    return hrUsers.filter((u) => {
      if (branchFilter !== 'all') {
        const b = branches.find((br) => br.id === u.branchId);
        if (b?.name !== branchFilter) return false;
      }
      return true;
    });
  }, [hrUsers, branches, branchFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);

  const openManageModal = (user) => {
    setSelectedUser(user);
    manageForm.setFieldsValue({ branchId: user.branchId || undefined });
    setManageModalOpen(true);
  };

  const onManageSubmit = async (values) => {
    if (!selectedUser) return;
    setManageSubmitting(true);
    try {
      await adminAPI.assignHrBranch(selectedUser.id, values.branchId || null);
      message.success('Branch assigned successfully');
      setManageModalOpen(false);
      manageForm.resetFields();
      await loadData();
    } catch (error) {
      message.error(error?.message || 'Failed to assign branch');
    } finally {
      setManageSubmitting(false);
    }
  };

  const onLimitSubmit = async (values) => {
    setLimitSubmitting(true);
    try {
      await adminAPI.updateMaxHrAccounts(values.maxHrAccounts);
      setMaxHrAccounts(values.maxHrAccounts);
      message.success('Account limit updated');
      setLimitModalOpen(false);
    } catch (error) {
      message.error(error?.message || 'Failed to update limit');
    } finally {
      setLimitSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div style={{ padding: 24 }}>
          <Text type="warning">Only admin can access HR account management.</Text>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
              <Link to="/dashboard" style={{ color: themeTokens.colors.primary }}>Dashboard</Link>
              {' / '}
              <span style={{ color: themeTokens.colors.textTertiary }}>Admin</span>
            </Text>
            <Title level={2} style={{ margin: '6px 0 4px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>
              HR Accounts
            </Title>
            <Text style={{ color: themeTokens.colors.textTertiary, fontSize: 14 }}>
              Create and manage HR users with configured account limits.
            </Text>
          </div>
        </div>

        {/* KPI Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div style={{
              background: '#fff',
              borderRadius: 14,
              border: `1px solid ${themeTokens.colors.borders}`,
              boxShadow: themeTokens.shadows.standard,
              padding: '18px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: themeTokens.colors.textTertiary, display: 'block' }}>
                    Current HR Accounts
                  </Text>
                  <Title level={3} style={{ margin: '6px 0 4px', fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: themeTokens.colors.heading }}>
                    {hrUsers.length}
                  </Title>
                  <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>Active accounts</Text>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: BTN_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(19,104,255,0.3)' }}>
                  <Shield size={20} color="#fff" strokeWidth={2} />
                </div>
              </div>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{
              background: '#fff',
              borderRadius: 14,
              border: `1px solid ${themeTokens.colors.borders}`,
              boxShadow: themeTokens.shadows.standard,
              padding: '18px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: themeTokens.colors.textTertiary, display: 'block' }}>
                    Max HR Accounts
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 4px' }}>
                    <Title level={3} style={{ margin: 0, fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: themeTokens.colors.heading }}>
                      {maxHrAccounts}
                    </Title>
                    <button
                      onClick={() => { limitForm.setFieldsValue({ maxHrAccounts }); setLimitModalOpen(true); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: themeTokens.colors.textTertiary }}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                  <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>Configured limit</Text>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: BTN_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(19,104,255,0.3)' }}>
                  <Shield size={20} color="#fff" strokeWidth={2} />
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* Branch Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary, fontWeight: 500 }}>Filter:</Text>
          {branchTabs.map((tab) => {
            const isActive = branchFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => { setBranchFilter(tab); setPage(1); }}
                style={{
                  height: 32, paddingInline: 18, borderRadius: 20,
                  border: isActive ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                  background: isActive ? BTN_GRADIENT : '#fff',
                  color: isActive ? '#fff' : themeTokens.colors.textSecondary,
                  fontSize: 13, fontWeight: isActive ? 600 : 500, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  boxShadow: isActive ? '0 2px 10px rgba(19,104,255,0.30)' : 'none',
                }}
              >
                {tab === 'all' ? 'All' : tab}
              </button>
            );
          })}
        </div>

        {/* HR Accounts List */}
        <div style={{
          borderRadius: 16,
          border: `1px solid ${themeTokens.colors.borders}`,
          boxShadow: themeTokens.shadows.standard,
          background: '#fff',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${themeTokens.colors.borders}` }}>
            <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.heading }}>
              {branchFilter === 'all' ? 'All' : branchFilter} HR Accounts ({filteredUsers.length})
            </Text>
          </div>

          {loading ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Text type="secondary">Loading HR accounts...</Text>
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Text type="secondary">No HR accounts found.</Text>
            </div>
          ) : (
            paginatedUsers.map((user, idx) => {
              const fullName = toTitleCase(
                [user.firstName, user.lastName].filter(Boolean).join(' ') || ''
              ) || user.email || '—';
              const initials = getInitials(user);
              const branch = branches.find((b) => b.id === user.branchId);
              const isLast = idx === paginatedUsers.length - 1;

              return (
                <div
                  key={user.id}
                  style={{
                    display: isMobile ? 'flex' : 'grid',
                    gridTemplateColumns: isMobile ? undefined : '2.2fr 2fr 1.4fr 1.2fr 110px 100px',
                    flexDirection: isMobile ? 'column' : undefined,
                    alignItems: isMobile ? undefined : 'center',
                    padding: isMobile ? '16px 20px' : '14px 24px',
                    gap: isMobile ? 10 : 0,
                    borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                    transition: 'background 0.15s',
                    position: 'relative',
                    background: 'linear-gradient(180deg, #F8F9FC 0%, #FFFFFF 100%)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = themeTokens.colors.appBackground}
                  onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(180deg, #F8F9FC 0%, #FFFFFF 100%)'}
                >
                  {/* Name + avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: `linear-gradient(135deg, #1E2875 0%, #1368FF 100%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0,
                      }}>
                        {initials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <Text strong style={{ fontSize: 14, color: themeTokens.colors.textPrimary, display: 'block', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fullName}
                        </Text>
                        <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>
                          {user.designation || 'HR Manager'}
                        </Text>
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Mail size={13} color="#1368FF" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                    <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email || '—'}
                    </Text>
                  </div>

                  {isMobile ? (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone size={13} color="#1368FF" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                        <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary }}>{user.phone || '—'}</Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={13} color="#1368FF" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                        <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary }}>{branch?.name || '—'}</Text>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Phone */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone size={13} color="#1368FF" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                        <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary }}>{user.phone || '—'}</Text>
                      </div>
                      {/* Branch */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={13} color="#1368FF" strokeWidth={1.8} style={{ flexShrink: 0 }} />
                        <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary }}>{branch?.name || '—'}</Text>
                      </div>
                      {/* Active badge */}
                      <div>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          height: 24, paddingInline: 12, borderRadius: 20,
                          fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                          background: user.isActive ? '#ECFDF5' : '#FEF2F2',
                          color: user.isActive ? '#059669' : '#DC2626',
                        }}>
                          {user.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      {/* Manage button */}
                      <div>
                        <Button
                          size="small"
                          onClick={() => openManageModal(user)}
                          style={{
                            borderRadius: 12, fontWeight: 600, fontSize: 12, height: 30, paddingInline: 16,
                            border: `1.5px solid ${themeTokens.colors.borders}`,
                            color: themeTokens.colors.textSecondary,
                            background: '#fff',
                          }}
                        >
                          Manage
                        </Button>
                      </div>
                    </>
                  )}

                  {/* Mobile action buttons */}
                  {isMobile && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="small" onClick={() => openManageModal(user)} style={{ flex: 1, borderRadius: 10, fontWeight: 600, fontSize: 13, height: 34, border: `1.5px solid ${themeTokens.colors.borders}`, color: themeTokens.colors.textPrimary, background: '#fff' }}>Manage</Button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${themeTokens.colors.borders}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
                Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} entries
              </Text>
              <Space size={4}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ height: 32, paddingInline: 14, borderRadius: 8, border: `1px solid ${themeTokens.colors.borders}`, background: page === 1 ? themeTokens.colors.appBackground : '#fff', color: page === 1 ? themeTokens.colors.textTertiary : themeTokens.colors.textPrimary, fontSize: 13, fontWeight: 500, cursor: page === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Previous</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 8, border: p === page ? 'none' : `1px solid ${themeTokens.colors.borders}`, background: p === page ? themeTokens.colors.primary : '#fff', color: p === page ? '#fff' : themeTokens.colors.textPrimary, fontSize: 13, fontWeight: p === page ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
                ))}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ height: 32, paddingInline: 14, borderRadius: 8, border: `1px solid ${themeTokens.colors.borders}`, background: page >= totalPages ? themeTokens.colors.appBackground : '#fff', color: page >= totalPages ? themeTokens.colors.textTertiary : themeTokens.colors.textPrimary, fontSize: 13, fontWeight: 500, cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Next</button>
              </Space>
            </div>
          )}
        </div>
      </div>

      {/* Manage Modal — branch assignment */}
      <Modal
        title={`Manage — ${toTitleCase([selectedUser?.firstName, selectedUser?.lastName].filter(Boolean).join(' ')) || selectedUser?.email}`}
        open={manageModalOpen}
        onCancel={() => { setManageModalOpen(false); manageForm.resetFields(); }}
        footer={null}
        destroyOnClose
        centered
        zIndex={1400}
        maskClosable={false}
      >
        <Form layout="vertical" form={manageForm} onFinish={onManageSubmit}>
          <Form.Item
            name="branchId"
            label="Assigned Branch"
            tooltip="The branch this HR user will manage. They will only see employees from this branch."
          >
            <Select
              placeholder="Select branch"
              allowClear
              notFoundContent={
                <div style={{ padding: '8px 0', textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>No branches configured.</Text>
                  <br />
                  <Button type="link" size="small" style={{ padding: 0, marginTop: 4 }} onClick={() => { setManageModalOpen(false); navigate('/admin/branches'); }}>
                    + Add Branch
                  </Button>
                </div>
              }
              options={branches.map(b => ({ value: b.id, label: b.name }))}
            />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setManageModalOpen(false); manageForm.resetFields(); }}>Cancel</Button>
            <Button htmlType="submit" loading={manageSubmitting} style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}>
              Save
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* Edit Max Accounts Limit Modal */}
      <Modal
        title="Update HR Account Limit"
        open={limitModalOpen}
        onCancel={() => setLimitModalOpen(false)}
        footer={null}
        destroyOnClose
        centered
        zIndex={1400}
      >
        <Form layout="vertical" form={limitForm} onFinish={onLimitSubmit}>
          <Form.Item name="maxHrAccounts" label="Maximum HR Accounts" rules={[{ required: true, type: 'number', min: 1, message: 'Must be at least 1' }]}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setLimitModalOpen(false)}>Cancel</Button>
            <Button htmlType="submit" loading={limitSubmitting} style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}>
              Update
            </Button>
          </Space>
        </Form>
      </Modal>
    </Layout>
  );
}
