import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Select,
  Table,
  Modal,
  Form,
  DatePicker,
  message,
  Popconfirm,
  Tag,
} from 'antd';
import {
  Plus,
  Trash2,
  Search,
  TrendingUp,
  Users,
  Star,
  Trophy,
  XCircle,
  Filter,
  Building2,
  CalendarDays,
} from 'lucide-react';
import dayjs from 'dayjs';
import api from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = 'new' | 'follow_up' | 'qualified' | 'won' | 'lost';

interface Lead {
  id: string;
  leadKey: string;
  name: string;
  company?: string | null;
  source?: string | null;
  status: LeadStatus;
  remarks?: string | null;
  followUpDate?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'New', value: 'new' },
  { label: 'Follow-up', value: 'follow_up' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Won', value: 'won' },
  { label: 'Lost', value: 'lost' },
];

const SOURCE_OPTIONS = ['LinkedIn', 'Referral', 'Cold call', 'Email', 'Website', 'Other'];

const STATUS_CONFIG: Record<LeadStatus, { bg: string; text: string; border: string; antColor: string; label: string }> = {
  new:       { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', antColor: 'blue',    label: 'New' },
  follow_up: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', antColor: 'orange',  label: 'Follow-up' },
  qualified: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', antColor: 'green',   label: 'Qualified' },
  won:       { bg: '#f0fdf4', text: '#166534', border: '#86efac', antColor: 'success', label: 'Won' },
  lost:      { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', antColor: 'red',     label: 'Lost' },
};

const STAT_CARDS = [
  { key: 'total',     label: 'Total Leads', icon: Users,    color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  { key: 'new',       label: 'New',         icon: TrendingUp, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'follow_up', label: 'Follow-up',   icon: Star,     color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { key: 'qualified', label: 'Qualified',   icon: Filter,   color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'won',       label: 'Won',         icon: Trophy,   color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  { key: 'lost',      label: 'Lost',        icon: XCircle,  color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
] as const;

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, count, icon: Icon, color, bg, border,
}: { label: string; count: number; icon: React.ElementType; color: string; bg: string; border: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 110,
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 14,
      padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', letterSpacing: 0.3 }}>{label}</span>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#111', lineHeight: 1 }}>{count}</div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LeadStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Tag
      color={cfg.antColor}
      style={{
        borderRadius: 20,
        fontWeight: 600,
        fontSize: 12,
        padding: '2px 12px',
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.label}
    </Tag>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string | null | undefined }) {
  if (!source) return <span style={{ color: '#d1d5db' }}>—</span>;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 6,
      background: '#f3f4f6',
      color: '#374151',
      fontSize: 12,
      fontWeight: 500,
      border: '1px solid #e5e7eb',
    }}>
      {source}
    </span>
  );
}

// ─── Add Lead Modal ───────────────────────────────────────────────────────────

interface AddLeadModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: Lead) => void;
}

function AddLeadModal({ open, onClose, onCreated }: AddLeadModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  async function onFinish(values: any) {
    try {
      setSubmitting(true);
      const response = await api.post('/leads', {
        name: values.name,
        company: values.company,
        source: values.source,
        status: values.status,
        remarks: values.remarks,
        followUpDate: values.followUpDate.toISOString(),
      });
      const created = response.data?.data as Lead;
      message.success('Lead created successfully');
      form.resetFields();
      onCreated(created);
    } catch {
      message.error('Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Plus size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>New Lead</div>
            <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>Fill in the details below</div>
          </div>
        </div>
      }
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={() => form.submit()}
      okText="Create Lead"
      okButtonProps={{ style: { background: '#6366f1', borderColor: '#6366f1', borderRadius: 8, fontWeight: 600 } }}
      cancelButtonProps={{ style: { borderRadius: 8 } }}
      confirmLoading={submitting}
      width={520}
      styles={{ body: { paddingTop: 8 } }}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]} style={{ marginBottom: 14 }}>
            <Input placeholder="e.g. Rahul Sharma" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="company" label="Company" rules={[{ required: true, message: 'Company is required' }]} style={{ marginBottom: 14 }}>
            <Input placeholder="e.g. Infosys" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item name="source" label="Source" rules={[{ required: true, message: 'Source is required' }]} style={{ marginBottom: 14 }}>
            <Select
              placeholder="Select source"
              size="large"
              style={{ borderRadius: 8 }}
              options={SOURCE_OPTIONS.map((s) => ({ label: s, value: s }))}
            />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="new" rules={[{ required: true, message: 'Status is required' }]} style={{ marginBottom: 14 }}>
            <Select size="large" style={{ borderRadius: 8 }} options={STATUS_OPTIONS} />
          </Form.Item>
        </div>
        <Form.Item name="followUpDate" label="Follow-up Date" rules={[{ required: true, message: 'Follow-up date is required' }]} style={{ marginBottom: 14 }}>
          <DatePicker size="large" style={{ width: '100%', borderRadius: 8 }} />
        </Form.Item>
        <Form.Item name="remarks" label="Remarks" rules={[{ required: true, message: 'Remarks is required' }]} style={{ marginBottom: 4 }}>
          <Input.TextArea rows={3} placeholder="Add notes, context, or next steps..." style={{ borderRadius: 8, resize: 'none' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Edit Lead Modal ──────────────────────────────────────────────────────────

interface EditLeadModalProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdated: (lead: Lead) => void;
}

function EditLeadModal({ lead, onClose, onUpdated }: EditLeadModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      form.setFieldsValue({
        name: lead.name,
        company: lead.company ?? '',
        source: lead.source ?? undefined,
        status: lead.status,
        remarks: lead.remarks ?? '',
        followUpDate: lead.followUpDate ? dayjs(lead.followUpDate) : null,
      });
    }
  }, [lead, form]);

  async function onFinish(values: any) {
    if (!lead) return;
    try {
      setSubmitting(true);
      const response = await api.patch(`/leads/${lead.id}`, {
        name: values.name,
        company: values.company || null,
        source: values.source || null,
        status: values.status,
        remarks: values.remarks || null,
        followUpDate: values.followUpDate ? values.followUpDate.toISOString() : null,
      });
      const updated = response.data?.data as Lead;
      message.success('Lead updated');
      onUpdated(updated);
    } catch {
      message.error('Failed to update lead');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Edit Lead — ${lead?.leadKey}`}
      open={!!lead}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Save Changes"
      okButtonProps={{ style: { background: '#6366f1', borderColor: '#6366f1', borderRadius: 8, fontWeight: 600 } }}
      cancelButtonProps={{ style: { borderRadius: 8 } }}
      confirmLoading={submitting}
      width={520}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]} style={{ marginBottom: 14 }}>
            <Input size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="company" label="Company" style={{ marginBottom: 14 }}>
            <Input size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Form.Item name="source" label="Source" style={{ marginBottom: 14 }}>
            <Select placeholder="Select source" allowClear size="large" style={{ borderRadius: 8 }} options={SOURCE_OPTIONS.map((s) => ({ label: s, value: s }))} />
          </Form.Item>
          <Form.Item name="status" label="Status" style={{ marginBottom: 14 }}>
            <Select size="large" style={{ borderRadius: 8 }} options={STATUS_OPTIONS} />
          </Form.Item>
        </div>
        <Form.Item name="followUpDate" label="Follow-up Date" style={{ marginBottom: 14 }}>
          <DatePicker size="large" style={{ width: '100%', borderRadius: 8 }} />
        </Form.Item>
        <Form.Item name="remarks" label="Remarks" style={{ marginBottom: 4 }}>
          <Input.TextArea rows={3} style={{ borderRadius: 8, resize: 'none' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function LeadTrackerPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => { void loadLeads(); }, []);

  async function loadLeads() {
    try {
      setLoading(true);
      const response = await api.get('/leads');
      setLeads(response.data?.data ?? []);
    } catch {
      message.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/leads/${id}`);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      message.success('Lead deleted');
    } catch {
      message.error('Failed to delete lead');
    }
  }

  const stats = useMemo(() => ({
    total:     leads.length,
    new:       leads.filter((l) => l.status === 'new').length,
    follow_up: leads.filter((l) => l.status === 'follow_up').length,
    qualified: leads.filter((l) => l.status === 'qualified').length,
    won:       leads.filter((l) => l.status === 'won').length,
    lost:      leads.filter((l) => l.status === 'lost').length,
  }), [leads]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      const matchesSearch = !q || l.name.toLowerCase().includes(q) || (l.company ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Lead) => (
        <div>
          <div style={{ fontWeight: 700, color: '#111', fontSize: 14 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{record.leadKey}</div>
        </div>
      ),
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
      render: (v: string | null) => v
        ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Building2 size={13} color="#9ca3af" />
            <span style={{ fontSize: 13, color: '#374151' }}>{v}</span>
          </div>
        )
        : <span style={{ color: '#d1d5db' }}>—</span>,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (v: string | null) => <SourceBadge source={v} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: LeadStatus) => <StatusBadge status={status} />,
    },
    {
      title: 'Follow-up',
      dataIndex: 'followUpDate',
      key: 'followUpDate',
      render: (v: string | null) => v
        ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarDays size={13} color="#9ca3af" />
            <span style={{ fontSize: 13, color: '#374151' }}>{dayjs(v).format('DD MMM YYYY')}</span>
          </div>
        )
        : <span style={{ color: '#d1d5db' }}>—</span>,
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (v: string | null) => v
        ? <span style={{ fontSize: 13, color: '#6b7280', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
        : <span style={{ color: '#d1d5db' }}>—</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: any, record: Lead) => (
        <Popconfirm
          title="Delete this lead?"
          description="This action cannot be undone."
          onConfirm={() => handleDelete(record.id)}
          okText="Delete"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
        >
          <Button
            size="small"
            danger
            icon={<Trash2 size={13} />}
            style={{ borderRadius: 8, opacity: 0.7 }}
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24, background: '#f8f9fb', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111', lineHeight: 1.2 }}>Lead Tracker</h1>
              <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>Track and manage your sales pipeline</p>
            </div>
          </div>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<Plus size={16} />}
          onClick={() => setAddOpen(true)}
          style={{ borderRadius: 10, background: '#6366f1', borderColor: '#6366f1', fontWeight: 600, paddingInline: 22, height: 42 }}
        >
          Add Lead
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {STAT_CARDS.map(({ key, label, icon, color, bg, border }) => (
          <StatCard
            key={key}
            label={label}
            count={stats[key]}
            icon={icon}
            color={color}
            bg={bg}
            border={border}
          />
        ))}
      </div>

      {/* ── Search & Filter ── */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        background: '#fff', padding: '14px 18px', borderRadius: 14,
        border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ flex: 2, minWidth: 200, position: 'relative' }}>
          <Input
            size="large"
            placeholder="Search by name or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<Search size={15} color="#9ca3af" />}
            style={{ borderRadius: 10 }}
            allowClear
          />
        </div>
        <Select
          size="large"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          style={{ flex: 1, minWidth: 160 }}
          options={[{ label: 'All Statuses', value: 'all' }, ...STATUS_OPTIONS]}
        />
        {(search || statusFilter !== 'all') && (
          <Button
            size="large"
            style={{ borderRadius: 10 }}
            onClick={() => { setSearch(''); setStatusFilter('all'); }}
          >
            Clear
          </Button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af', whiteSpace: 'nowrap' }}>
          {filtered.length} of {leads.length} leads
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <style>{`
          .lead-table-row:hover td { background: #fafafa !important; }
          .ant-table-thead > tr > th {
            background: #f8f9fb !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            color: #9ca3af !important;
            letter-spacing: 0.6px !important;
            text-transform: uppercase !important;
            border-bottom: 1px solid #e5e7eb !important;
          }
          .ant-table-tbody > tr > td { border-bottom: 1px solid #f3f4f6 !important; padding: 14px 16px !important; }
        `}</style>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={filtered.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
          rowClassName={() => 'lead-table-row'}
          locale={{ emptyText: (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <TrendingUp size={36} color="#d1d5db" style={{ marginBottom: 12 }} />
              <div style={{ color: '#6b7280', fontWeight: 600, fontSize: 15 }}>No leads found</div>
              <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>Add your first lead to get started</div>
            </div>
          )}}
          onRow={(record) => ({
            onClick: (e) => {
              if ((e.target as HTMLElement).closest('.ant-btn, .ant-popover, .ant-popconfirm')) return;
              navigate(`/lead-tracker/${record.id}`);
            },
            style: { cursor: 'pointer', transition: 'background 0.15s' },
          })}
        />
      </div>

      {/* ── Modals ── */}
      <AddLeadModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(lead) => {
          setLeads((prev) => [lead, ...prev]);
          setAddOpen(false);
          navigate(`/lead-tracker/${lead.id}`);
        }}
      />
    </div>
  );
}
