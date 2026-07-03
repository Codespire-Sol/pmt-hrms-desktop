import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Filter, X, RefreshCw, ChevronLeft, ChevronRight,
  Eye, Calendar, User, Activity, Server,
} from 'lucide-react';
import {
  Select, Table, Avatar, Modal, Skeleton, Alert, Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useGetAuditLogsQuery,
  useGetAuditLogFiltersQuery,
  useGetPermissionsQuery,
} from '../../features/rbac/rbacApi';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import { AuditLog } from '../../features/rbac/types';

const C = {
  primary:   '#1268ff',
  primaryBg: 'rgba(18,104,255,0.08)',
  success:   '#10b981', successBg: 'rgba(16,185,129,0.08)',
  warning:   '#faad14', warningBg: 'rgba(250,173,20,0.08)',
  danger:    '#ff4d4f', dangerBg:  'rgba(255,77,79,0.08)',
  purple:    '#8b5cf6', purpleBg:  'rgba(139,92,246,0.08)',
  orange:    '#ff6b1a', orangeBg:  'rgba(255,107,26,0.08)',
  text:      '#101828', textSub:   '#4a5565', textMuted: '#6a7282',
  border:    '#e5e7eb', bg:        '#f9fafb', card:      '#ffffff',
  shadow:    '0 4px 16px rgba(16,24,40,0.06)',
};

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(d: string) {
  try { return format(new Date(d), 'MMM d, yyyy HH:mm'); } catch { return d; }
}

function formatActionName(action: string) {
  return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getActionConfig(action: string): { color: string; bg: string } {
  if (action.includes('delete') || action.includes('remove'))
    return { color: C.danger, bg: C.dangerBg };
  if (action.includes('create') || action.includes('assign'))
    return { color: C.success, bg: C.successBg };
  if (action.includes('update') || action.includes('change'))
    return { color: C.primary, bg: C.primaryBg };
  return { color: C.textMuted, bg: C.bg };
}

function ActionBadge({ action }: { action: string }) {
  const { color, bg } = getActionConfig(action);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: '20px',
      fontSize: '11px', fontWeight: 700,
      color, background: bg, border: `1px solid ${color}20`,
      whiteSpace: 'nowrap',
    }}>
      {formatActionName(action)}
    </span>
  );
}

export function AuditLogPage() {
  const { hasPermission: canViewAudit } = usePermissionGuard('admin.audit');
  const [actionFilter,     setActionFilter]     = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [startDate,        setStartDate]        = useState('');
  const [endDate,          setEndDate]          = useState('');
  const [page,             setPage]             = useState(1);
  const [selectedLog,      setSelectedLog]      = useState<AuditLog | null>(null);

  const { data: filtersData  } = useGetAuditLogFiltersQuery({ app: 'pmt' });
  const { data: permissionsData } = useGetPermissionsQuery();
  const { data: logsData, isLoading, isFetching, refetch } = useGetAuditLogsQuery({
    action:     actionFilter     || undefined,
    entityType: entityTypeFilter || undefined,
    startDate:  startDate        || undefined,
    endDate:    endDate          || undefined,
    page,
    limit: 20,
    app: 'pmt',
  });

  const filters    = filtersData?.data;
  const logs       = logsData?.data?.logs || [];
  const pagination = logsData?.data?.pagination;
  const permissions = permissionsData?.data || [];
  const permissionMap = new Map(permissions.map(p => [p.id, p.displayName || p.name]));

  const formatAuditValues = (values?: Record<string, any> | null) => {
    if (!values) return values;
    const f = { ...values };
    if (Array.isArray(f.permissionIds)) {
      f.permissionIds = f.permissionIds.map((id: string) => permissionMap.get(id) || id);
    }
    return f;
  };

  const clearFilters = () => {
    setActionFilter(''); setEntityTypeFilter('');
    setStartDate(''); setEndDate(''); setPage(1);
  };

  const hasFilters = !!(actionFilter || entityTypeFilter || startDate || endDate);

  if (!canViewAudit) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '18px', background: C.dangerBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Shield size={28} color={C.danger} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: C.text }}>Access Denied</div>
          <div style={{ fontSize: '14px', color: C.textMuted, marginTop: '8px', marginBottom: '20px' }}>
            You don't have permission to view audit logs.
          </div>
          <Link to="/dashboard" style={{
            padding: '10px 24px', borderRadius: '10px',
            background: C.primary, color: '#fff', fontSize: '14px', fontWeight: 600,
            textDecoration: 'none',
          }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const columns: ColumnsType<AuditLog> = [
    {
      title: 'Timestamp',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{formatDate(v)}</div>
          <div style={{ fontSize: '11px', color: C.textMuted }}>
            {formatDistanceToNow(new Date(v), { addSuffix: true })}
          </div>
        </div>
      ),
    },
    {
      title: 'User',
      dataIndex: 'user',
      width: 180,
      render: (_: any, row: AuditLog) => row.user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <Avatar
            size={30}
            style={{ background: `linear-gradient(135deg, ${C.primary}, #06b6d4)`, fontSize: '11px', fontWeight: 700, flexShrink: 0 }}
          >
            {initials(row.user.displayName)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.user.displayName}
            </div>
            <div style={{ fontSize: '11px', color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.user.email}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Server size={13} color={C.textMuted} />
          </div>
          <span style={{ fontSize: '13px', color: C.textMuted }}>System</span>
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 160,
      render: (v: string) => <ActionBadge action={v} />,
    },
    {
      title: 'Entity',
      dataIndex: 'entityType',
      width: 140,
      render: (_: any, row: AuditLog) => (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>
            {row.entityType}
          </div>
          {row.entityId && (
            <div style={{ fontSize: '11px', color: C.textMuted, fontFamily: 'monospace' }}>
              {row.entityId.substring(0, 8)}…
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      width: 130,
      render: (v: string) => (
        <span style={{
          fontSize: '12px', fontFamily: 'monospace', padding: '3px 8px',
          borderRadius: '6px', background: C.bg, border: `1px solid ${C.border}`,
          color: C.textSub,
        }}>
          {v || 'N/A'}
        </span>
      ),
    },
    {
      title: 'Details',
      key: 'action_col',
      width: 80,
      align: 'center',
      render: (_: any, row: AuditLog) => (
        <button
          onClick={() => setSelectedLog(row)}
          style={{
            width: 32, height: 32, borderRadius: '8px',
            border: `1px solid ${C.border}`, background: C.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.18s',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = C.primary;
            el.style.background = C.primaryBg;
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = C.border;
            el.style.background = C.bg;
          }}
        >
          <Eye size={14} color={C.textSub} />
        </button>
      ),
    },
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '14px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #1268ff 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(139,92,246,0.28)',
          }}>
            <Activity size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
              Audit Logs
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: C.textSub, marginTop: '2px' }}>
              Track all system activities and changes.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px', borderRadius: '10px', border: `1.5px solid ${C.border}`,
              background: C.card, cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              color: C.textSub, fontFamily: 'Inter, sans-serif', transition: 'all 0.18s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = C.primary;
              el.style.color = C.primary;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = C.border;
              el.style.color = C.textSub;
            }}
          >
            <RefreshCw size={14} style={isFetching ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Filters card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        style={{
          background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`,
          boxShadow: C.shadow, padding: '20px 24px', marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <div style={{ width: 28, height: 28, borderRadius: '8px', background: C.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Filter size={14} color={C.primary} />
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>Filters</span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 10px', borderRadius: '7px', border: `1px solid ${C.border}`,
                background: C.dangerBg, cursor: 'pointer', fontSize: '12px',
                fontWeight: 600, color: C.danger, fontFamily: 'Inter, sans-serif',
                marginLeft: 'auto',
              }}
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <Select
            style={{ width: 200 }}
            placeholder="Action type"
            value={actionFilter || undefined}
            onChange={v => { setActionFilter(v || ''); setPage(1); }}
            allowClear
            options={[
              ...(filters?.actions || []).map(a => ({ value: a, label: formatActionName(a) })),
            ]}
          />
          <Select
            style={{ width: 180 }}
            placeholder="Entity type"
            value={entityTypeFilter || undefined}
            onChange={v => { setEntityTypeFilter(v || ''); setPage(1); }}
            allowClear
            options={[
              ...(filters?.entityTypes || []).map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
            ]}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>From</span>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: `1.5px solid ${C.border}`,
                fontSize: '13px', color: C.text, background: C.bg,
                fontFamily: 'Inter, sans-serif', outline: 'none', cursor: 'pointer',
              }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = C.primary; }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = C.border; }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>To</span>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: `1.5px solid ${C.border}`,
                fontSize: '13px', color: C.text, background: C.bg,
                fontFamily: 'Inter, sans-serif', outline: 'none', cursor: 'pointer',
              }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = C.primary; }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = C.border; }}
            />
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`,
          boxShadow: C.shadow, overflow: 'hidden',
        }}
      >
        <Table<AuditLog>
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          scroll={{ x: 860 }}
          style={{ fontFamily: 'Inter, sans-serif' }}
          rowClassName={() => 'audit-log-row'}
          locale={{
            emptyText: (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '14px', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Activity size={22} color={C.textMuted} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>No audit logs found</div>
                <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '4px' }}>
                  {hasFilters ? 'Try adjusting your filters.' : 'No activity recorded yet.'}
                </div>
              </div>
            ),
          }}
        />

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px', borderTop: `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: '13px', color: C.textMuted }}>
              {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', borderRadius: '8px', border: `1px solid ${C.border}`,
                  background: C.card, cursor: page === 1 ? 'default' : 'pointer',
                  fontSize: '13px', fontWeight: 600, color: page === 1 ? C.textMuted : C.textSub,
                  fontFamily: 'Inter, sans-serif', opacity: page === 1 ? 0.5 : 1, transition: 'all 0.18s',
                }}
                onMouseEnter={e => {
                  if (page === 1) return;
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = C.primary;
                  el.style.color = C.primary;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = C.border;
                  el.style.color = page === 1 ? C.textMuted : C.textSub;
                }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <div style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', borderRadius: '8px', background: C.primaryBg, border: `1px solid ${C.primary}20` }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: C.primary }}>
                  {page} / {pagination.totalPages}
                </span>
              </div>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page === pagination.totalPages}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', borderRadius: '8px', border: `1px solid ${C.border}`,
                  background: C.card, cursor: page === pagination.totalPages ? 'default' : 'pointer',
                  fontSize: '13px', fontWeight: 600, color: page === pagination.totalPages ? C.textMuted : C.textSub,
                  fontFamily: 'Inter, sans-serif', opacity: page === pagination.totalPages ? 0.5 : 1, transition: 'all 0.18s',
                }}
                onMouseEnter={e => {
                  if (page === pagination.totalPages) return;
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = C.primary;
                  el.style.color = C.primary;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = C.border;
                  el.style.color = page === pagination.totalPages ? C.textMuted : C.textSub;
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Detail Modal */}
      <Modal
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        width={640}
        style={{ borderRadius: '16px', padding: 0, overflow: 'hidden' }}
        title={null}
      >
        {selectedLog && (
          <div>
            {/* Modal header */}
            <div style={{
              padding: '24px 28px 20px',
              borderBottom: `1px solid ${C.border}`,
              background: `linear-gradient(135deg, ${C.primaryBg} 0%, transparent 60%)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '12px',
                  background: getActionConfig(selectedLog.action).bg,
                  border: `1px solid ${getActionConfig(selectedLog.action).color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Activity size={18} color={getActionConfig(selectedLog.action).color} />
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: C.text }}>Audit Log Details</div>
                  <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{formatDate(selectedLog.createdAt)}</div>
                </div>
                <ActionBadge action={selectedLog.action} />
              </div>
            </div>

            {/* Modal body */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Grid info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { label: 'User', value: selectedLog.user ? `${selectedLog.user.displayName} (${selectedLog.user.email})` : 'System' },
                  { label: 'IP Address', value: selectedLog.ipAddress || 'N/A', mono: true },
                  { label: 'Entity Type', value: selectedLog.entityType, capitalize: true },
                  { label: 'Entity ID', value: selectedLog.entityId || 'N/A', mono: true, truncate: true },
                ].map(field => (
                  <div key={field.label} style={{ padding: '14px', background: C.bg, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                      {field.label}
                    </div>
                    <div style={{
                      fontSize: '13px', fontWeight: 600, color: C.text,
                      fontFamily: field.mono ? 'monospace' : 'inherit',
                      textTransform: field.capitalize ? 'capitalize' : undefined,
                      whiteSpace: field.truncate ? 'nowrap' : undefined,
                      overflow: field.truncate ? 'hidden' : undefined,
                      textOverflow: field.truncate ? 'ellipsis' : undefined,
                    }}>
                      {field.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Old values */}
              {selectedLog.oldValues && Object.keys(selectedLog.oldValues).length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                    Previous Values
                  </div>
                  <pre style={{
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px',
                    padding: '14px', fontSize: '12px', color: C.text,
                    fontFamily: 'monospace', overflowX: 'auto', margin: 0, lineHeight: 1.6,
                  }}>
                    {JSON.stringify(formatAuditValues(selectedLog.oldValues), null, 2)}
                  </pre>
                </div>
              )}

              {/* New values */}
              {selectedLog.newValues && Object.keys(selectedLog.newValues).length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                    New Values
                  </div>
                  <pre style={{
                    background: 'rgba(16,185,129,0.04)', border: `1px solid ${C.success}20`, borderRadius: '10px',
                    padding: '14px', fontSize: '12px', color: C.text,
                    fontFamily: 'monospace', overflowX: 'auto', margin: 0, lineHeight: 1.6,
                  }}>
                    {JSON.stringify(formatAuditValues(selectedLog.newValues), null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                    Additional Metadata
                  </div>
                  <pre style={{
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px',
                    padding: '14px', fontSize: '12px', color: C.text,
                    fontFamily: 'monospace', overflowX: 'auto', margin: 0, lineHeight: 1.6,
                  }}>
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        .audit-log-row:hover td { background: ${C.bg} !important; }
        .ant-table-thead > tr > th {
          background: ${C.bg} !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          color: ${C.textMuted} !important;
          text-transform: uppercase !important;
          letter-spacing: 0.06em !important;
          border-bottom: 1px solid ${C.border} !important;
        }
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${C.border} !important;
          padding: 14px 16px !important;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default AuditLogPage;
