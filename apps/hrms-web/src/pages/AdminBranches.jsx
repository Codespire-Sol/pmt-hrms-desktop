import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Typography,
  Grid,
  message,
} from 'antd';
import { Plus, Pencil, Trash2, Globe, Building2 } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { adminAPI } from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import { themeTokens } from '../styles/theme';

const { useBreakpoint } = Grid;

const { Title, Text } = Typography;
const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';
const PAGE_SIZE = 10;

export default function AdminBranches() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { isAdmin } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  async function loadBranches() {
    setLoading(true);
    try {
      const res = await adminAPI.getBranches();
      setBranches(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      message.error(err?.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBranches(); }, []);

  function openCreate() {
    setEditingBranch(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(branch) {
    setEditingBranch(branch);
    form.setFieldsValue({ name: branch.name, websiteUrl: branch.websiteUrl || '', address: branch.address || '' });
    setModalOpen(true);
  }

  async function onSubmit(values) {
    setSubmitting(true);
    try {
      if (editingBranch) {
        await adminAPI.updateBranch(editingBranch.id, values);
        message.success('Branch updated');
      } else {
        await adminAPI.createBranch(values);
        message.success('Branch created');
      }
      setModalOpen(false);
      form.resetFields();
      await loadBranches();
    } catch (err) {
      message.error(err?.message || 'Failed to save branch');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id) {
    try {
      await adminAPI.deleteBranch(id);
      message.success('Branch deleted');
      setDeleteConfirmId(null);
      await loadBranches();
    } catch (err) {
      message.error(err?.message || 'Failed to delete branch');
    }
  }

  const paginatedBranches = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return branches.slice(start, start + PAGE_SIZE);
  }, [branches, page]);
  const totalPages = Math.ceil(branches.length / PAGE_SIZE);

  if (!isAdmin) {
    return (
      <Layout>
        <Alert type="warning" showIcon message="Only admin can manage branches." />
      </Layout>
    );
  }

  const colStyle = (align = 'left') => ({
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: themeTokens.colors.textTertiary,
    textAlign: align,
  });

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
              <Link to="/dashboard" style={{ color: themeTokens.colors.primary }}>Dashboard</Link>
              {' / '}
              <span>Admin</span>
            </Text>
            <Title level={isMobile ? 3 : 2} style={{ margin: '6px 0 4px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>
              Organisation Branches
            </Title>
            <Text style={{ color: themeTokens.colors.textTertiary, fontSize: 14 }}>
              Manage branch offices and their website URLs.
            </Text>
          </div>
          <button
            onClick={openCreate}
            style={{
              height: 44, paddingInline: 20, fontWeight: 600, borderRadius: 10,
              background: BTN_GRADIENT, color: '#fff', border: 'none',
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 8px rgba(19,104,255,0.25)',
              width: isMobile ? '100%' : 'auto', justifyContent: 'center',
            }}
          >
            <Plus size={16} />
            Add Branch
          </button>
        </div>

        {/* Table Card */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: `1px solid ${themeTokens.colors.borders}`,
          boxShadow: themeTokens.shadows.standard,
          overflow: 'hidden',
        }}>
          {/* Column headers — desktop only */}
          {!isMobile && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 2fr 2fr 120px',
              padding: '10px 24px',
              borderBottom: `1px solid ${themeTokens.colors.borders}`,
              background: themeTokens.colors.appBackground,
            }}>
              <Text style={colStyle()}>BRANCH NAME</Text>
              <Text style={colStyle()}>WEBSITE</Text>
              <Text style={colStyle()}>ADDRESS</Text>
              <Text style={colStyle('right')}>ACTION</Text>
            </div>
          )}

          {/* Rows */}
          {loading ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Text type="secondary">Loading...</Text>
            </div>
          ) : branches.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Text type="secondary">No branches yet. Add your first branch.</Text>
            </div>
          ) : (
            paginatedBranches.map((branch, idx) => {
              const isLast = idx === paginatedBranches.length - 1;
              return (
                <div
                  key={branch.id}
                  style={{
                    display: isMobile ? 'flex' : 'grid',
                    gridTemplateColumns: isMobile ? undefined : '2fr 2fr 2fr 120px',
                    flexDirection: isMobile ? 'column' : undefined,
                    padding: isMobile ? '16px 20px' : '16px 24px',
                    gap: isMobile ? 10 : 0,
                    borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                    transition: 'background 0.15s',
                    background: 'linear-gradient(180deg, #F8F9FC 0%, #FFFFFF 100%)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = themeTokens.colors.appBackground}
                  onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(180deg, #F8F9FC 0%, #FFFFFF 100%)'}
                >
                  {/* Branch name + actions row on mobile */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: BTN_GRADIENT,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(19,104,255,0.25)',
                      }}>
                        <Building2 size={18} color="#fff" strokeWidth={1.8} />
                      </div>
                      <Text strong style={{ fontSize: 14, color: themeTokens.colors.textPrimary }}>
                        {branch.name}
                      </Text>
                    </div>
                    {/* Actions — inline on mobile (top-right), grid cell on desktop */}
                    {isMobile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {deleteConfirmId === branch.id ? (
                          <>
                            <button onClick={() => onDelete(branch.id)} style={{ height: 30, paddingInline: 10, borderRadius: 7, background: '#ef4444', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Confirm</button>
                            <button onClick={() => setDeleteConfirmId(null)} style={{ height: 30, paddingInline: 10, borderRadius: 7, background: '#fff', color: themeTokens.colors.textSecondary, border: `1px solid ${themeTokens.colors.borders}`, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(branch)} style={{ width: 32, height: 32, borderRadius: 8, padding: 0, border: `1px solid ${themeTokens.colors.borders}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit">
                              <Pencil size={14} color={themeTokens.colors.textSecondary} strokeWidth={1.8} />
                            </button>
                            <button onClick={() => setDeleteConfirmId(branch.id)} style={{ width: 32, height: 32, borderRadius: 8, padding: 0, border: '1px solid #fecaca', background: '#fff5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete">
                              <Trash2 size={14} color="#ef4444" strokeWidth={1.8} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Website */}
                  <div style={{ minWidth: 0 }}>
                    {branch.websiteUrl ? (
                      <a href={branch.websiteUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, color: themeTokens.colors.primary, fontSize: 13 }}
                      >
                        <Globe size={13} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {branch.websiteUrl}
                        </span>
                      </a>
                    ) : (
                      <Text style={{ color: themeTokens.colors.textTertiary, fontSize: 13 }}>
                        {isMobile ? 'No website' : '—'}
                      </Text>
                    )}
                  </div>

                  {/* Address */}
                  <div style={{ minWidth: 0 }}>
                    <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {branch.address || '—'}
                    </Text>
                  </div>

                  {/* Actions — desktop only (grid column) */}
                  {!isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      {deleteConfirmId === branch.id ? (
                        <>
                          <button onClick={() => onDelete(branch.id)} style={{ height: 32, paddingInline: 14, borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Confirm</button>
                          <button onClick={() => setDeleteConfirmId(null)} style={{ height: 32, paddingInline: 14, borderRadius: 8, background: '#fff', color: themeTokens.colors.textSecondary, border: `1px solid ${themeTokens.colors.borders}`, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openEdit(branch)} style={{ width: 32, height: 32, borderRadius: 8, padding: 0, border: `1px solid ${themeTokens.colors.borders}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit">
                            <Pencil size={14} color={themeTokens.colors.textSecondary} strokeWidth={1.8} />
                          </button>
                          <button onClick={() => setDeleteConfirmId(branch.id)} style={{ width: 32, height: 32, borderRadius: 8, padding: 0, border: '1px solid #fecaca', background: '#fff5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete">
                            <Trash2 size={14} color="#ef4444" strokeWidth={1.8} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Footer */}
          {!loading && branches.length > 0 && (
            branches.length > PAGE_SIZE ? (
              <div style={{
                padding: '14px 24px',
                borderTop: `1px solid ${themeTokens.colors.borders}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 8,
              }}>
                <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
                  Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, branches.length)} of {branches.length} entries
                </Text>
                <Space size={4}>
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ height: 32, paddingInline: 14, borderRadius: 8, border: `1px solid ${themeTokens.colors.borders}`, background: page === 1 ? themeTokens.colors.appBackground : '#fff', color: page === 1 ? themeTokens.colors.textTertiary : themeTokens.colors.textPrimary, fontSize: 13, fontWeight: 500, cursor: page === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Previous</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 8, border: p === page ? 'none' : `1px solid ${themeTokens.colors.borders}`, background: p === page ? BTN_GRADIENT : '#fff', color: p === page ? '#fff' : themeTokens.colors.textPrimary, fontSize: 13, fontWeight: p === page ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
                  ))}
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ height: 32, paddingInline: 14, borderRadius: 8, border: `1px solid ${themeTokens.colors.borders}`, background: page >= totalPages ? themeTokens.colors.appBackground : '#fff', color: page >= totalPages ? themeTokens.colors.textTertiary : themeTokens.colors.textPrimary, fontSize: 13, fontWeight: 500, cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Next</button>
                </Space>
              </div>
            ) : (
              <div style={{ padding: '12px 24px', borderTop: `1px solid ${themeTokens.colors.borders}` }}>
                <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
                  {branches.length} {branches.length === 1 ? 'branch' : 'branches'}
                </Text>
              </div>
            )
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        title={editingBranch ? 'Edit Branch' : 'Add Branch'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => form.submit()}
              disabled={submitting}
              loading={submitting}
              style={{
                background: BTN_GRADIENT, color: '#fff', border: 'none',
                fontWeight: 600,
              }}
            >{submitting ? 'Saving…' : editingBranch ? 'Update' : 'Create'}</Button>
          </div>
        }
        destroyOnClose
        centered
        zIndex={1400}
        maskClosable={false}
      >
        <Form layout="vertical" form={form} onFinish={onSubmit} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Branch Name" rules={[{ required: true, message: 'Branch name is required' }]}>
            <Input placeholder="e.g. Mumbai HQ, Bangalore Office" />
          </Form.Item>
          <Form.Item
            name="websiteUrl"
            label="Website URL"
            rules={[{
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                try { new URL(value); return Promise.resolve(); }
                catch { return Promise.reject(new Error('Enter a valid URL (e.g. https://example.com)')); }
              },
            }]}
          >
            <Input placeholder="https://branch.example.com" prefix={<Globe size={14} />} />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} placeholder="Branch address (optional)" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
