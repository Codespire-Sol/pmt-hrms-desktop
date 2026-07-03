import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Breadcrumb,
  Empty,
  Skeleton,
  message,
} from 'antd';
import {
  ShieldAlert,
  Calendar,
  Clock,
  FileText,
  XCircle,
  CheckCircle,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';
import dayjs from 'dayjs';
import { leaveAPI } from '../api/leave';
import { attendanceAPI } from '../api/attendance';
import { adminAPI } from '../api/admin';
import Layout from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { themeTokens } from '../styles/theme';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { broadcastDataRefresh } from '../utils/realtime';

const { Title, Text } = Typography;
const { TextArea } = Input;

const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';

/* ─── avatar helpers ─────────────────────────────────────── */
const AVATAR_COLORS = [
  'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)',
  'linear-gradient(135deg, #1E2875 0%, #00115B 100%)',
  'linear-gradient(135deg, #9333EA 0%, #7C3AED 100%)',
  'linear-gradient(135deg, #059669 0%, #047857 100%)',
  'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
  'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
];

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function getAvatarBg(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getLeaveTypePill(type = '') {
  const t = type.toLowerCase();
  if (t.includes('sick'))    return { bg: '#FFF4E5', color: '#F59E0B', border: '#FDE68A' };
  if (t.includes('casual'))  return { bg: '#EBF4FF', color: '#1368FF', border: '#BFDBFE' };
  if (t.includes('earn') || t.includes('annual')) return { bg: '#F3E8FF', color: '#9333EA', border: '#E9D5FF' };
  if (t.includes('vacation')) return { bg: '#F3E8FF', color: '#9333EA', border: '#E9D5FF' };
  if (t.includes('maternity') || t.includes('paternity')) return { bg: '#FCE7F3', color: '#DB2777', border: '#FBCFE8' };
  return { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' };
}

/* ─── EmployeeAvatar ─────────────────────────────────────── */
function EmployeeAvatar({ name, src, size = 44 }) {
  if (src) {
    return (
      <img src={src} alt={name}
        style={{ width: size, height: size, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: getAvatarBg(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: Math.round(size * 0.36),
      flexShrink: 0, letterSpacing: '0.02em',
    }}>
      {getInitials(name) || '?'}
    </div>
  );
}

/* ─── ActionButtons ──────────────────────────────────────── */
function ActionButtons({ onApprove, onReject, loading, fullWidth }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, width: fullWidth ? '100%' : 'auto' }}>
      <button
        onClick={onApprove}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          height: 36, paddingInline: 16, borderRadius: 8, flex: fullWidth ? 1 : 'none',
          background: BTN_GRADIENT, color: '#fff', border: 'none',
          fontSize: 13, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(19,104,255,0.25)',
          transition: 'all 0.15s',
        }}
      >
        <CheckCircle size={14} strokeWidth={2.5} />
        Approve
      </button>
      <button
        onClick={onReject}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          height: 36, paddingInline: 16, borderRadius: 8, flex: fullWidth ? 1 : 'none',
          border: '1px solid #E5E7EB', background: '#FFFFFF',
          color: '#374151', fontSize: 13, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#F3F4F6'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
      >
        <XCircle size={14} strokeWidth={2} />
        Reject
      </button>
    </div>
  );
}

/* ─── DataField ── label above value ─────────────────────── */
function DataField({ label, value, icon, valueColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        {icon && <span style={{ marginTop: 2, flexShrink: 0 }}>{icon}</span>}
        <span style={{ fontSize: 13, fontWeight: 600, color: valueColor || '#111827', wordBreak: 'break-word' }}>
          {value}
        </span>
      </div>
    </div>
  );
}

/* ─── LeaveRequestCard ───────────────────────────────────── */
function LeaveRequestCard({ leave, onApprove, onReject, loading, isMobile }) {
  const name = (() => {
    const e = leave?.employee || {};
    return e.name || e.fullName || leave?.employeeName || leave?.name ||
      [e.firstName, e.lastName].filter(Boolean).join(' ') ||
      [leave?.employeeFirstName, leave?.employeeLastName].filter(Boolean).join(' ') || 'Unknown';
  })();
  const code = leave?.employee?.employeeCode || leave?.employeeCode || '';
  const src  = leave?.employee?.avatarUrl || leave?.avatarUrl;
  const leaveType = leave?.leaveType || leave?.type || 'Leave';
  const pill = getLeaveTypePill(leaveType);
  const isUrgent = String(leave?.priority || leave?.urgency || '').toUpperCase() === 'URGENT';

  const fromDate = leave.fromDate ? dayjs(leave.fromDate).format('MMM DD, YYYY') : '–';
  const toDate   = leave.toDate   ? dayjs(leave.toDate).format('MMM DD, YYYY')   : '–';
  const durationStr = fromDate === toDate ? fromDate : `${fromDate} - ${toDate}`;
  const days = leave.days != null ? `${leave.days}` : '–';
  const reason = leave.reason || '–';

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
      padding: isMobile ? '12px 14px' : '16px 20px',
      transition: 'box-shadow 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,24,40,0.08)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Top row: avatar + name + actions */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <EmployeeAvatar name={name} src={src} size={isMobile ? 36 : 42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#111827' }}>{name}</span>
            {code && <span style={{ fontSize: 12, color: '#6B7280' }}>{code}</span>}
            {isUrgent && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                background: '#FFF4E5', color: '#F59E0B', border: '1px solid #FDE68A',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                <AlertCircle size={9} /> URGENT
              </span>
            )}
          </div>
        </div>
        {!isMobile && <ActionButtons onApprove={onApprove} onReject={onReject} loading={loading} />}
      </div>
      {isMobile && <div style={{ marginBottom: 12 }}><ActionButtons onApprove={onApprove} onReject={onReject} loading={loading} fullWidth /></div>}

      {/* Bottom row: data fields */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? 10 : 16,
        paddingTop: 12,
        borderTop: '1px solid #F3F4F6',
      }}>
        <DataField
          label="Type"
          value={
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
              background: pill.bg, color: pill.color, border: `1px solid ${pill.border}`,
            }}>
              {leaveType}
            </span>
          }
        />
        <DataField label="Days" value={days} />
        <div style={{ gridColumn: isMobile ? 'span 2' : 'auto' }}>
          <DataField
            label="Duration"
            value={durationStr}
            icon={<Calendar size={12} color="#9CA3AF" />}
          />
        </div>
        <div style={{ gridColumn: isMobile ? 'span 2' : 'auto' }}>
          <DataField
            label="Reason"
            value={<span style={{ whiteSpace: 'normal', lineHeight: 1.4, color: '#6B7280', fontWeight: 400, fontSize: 13 }}>{reason}</span>}
            icon={<FileText size={12} color="#9CA3AF" />}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── RegularizationCard ─────────────────────────────────── */
function RegularizationCard({ item, onApprove, onReject, loading, isMobile }) {
  const name = item.employeeName || item.name || item.employee?.name || 'Employee';
  const code = item.employeeCode || item.employee?.employeeCode || '';
  const src  = item.employeeAvatarUrl || item.employee?.avatarUrl;

  const requestedCheckIn  = item.requestedCheckInTime  || item.requestedCheckIn  || null;
  const requestedCheckOut = item.requestedCheckOutTime || item.requestedCheckOut || null;
  const isMissingIn       = !requestedCheckIn;

  const formatTime = (t) => {
    if (!t) return null;
    if (String(t).toLowerCase().includes('no check')) return t;
    const parsed = dayjs(t, ['HH:mm', 'HH:mm:ss', 'h:mm A', 'HH:mm:ss.SSSZ'], true);
    if (parsed.isValid()) return parsed.format('h:mm A');
    const iso = dayjs(t);
    if (iso.isValid()) return iso.format('h:mm A');
    return t;
  };

  const checkInDisplay  = isMissingIn ? 'No Check-in' : (formatTime(requestedCheckIn) || '–');
  const checkOutDisplay = formatTime(requestedCheckOut) || '–';
  const attendDate  = item.attendanceDate ? dayjs(item.attendanceDate).format('MMM DD, YYYY') : '–';
  const reason      = item.reason || '–';

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
      padding: isMobile ? '12px 14px' : '16px 20px',
      transition: 'box-shadow 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,24,40,0.08)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <EmployeeAvatar name={name} src={src} size={isMobile ? 36 : 42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#111827' }}>{name}</span>
            {code && <span style={{ fontSize: 12, color: '#6B7280' }}>{code}</span>}
          </div>
        </div>
        {!isMobile && <ActionButtons onApprove={onApprove} onReject={onReject} loading={loading} />}
      </div>
      {isMobile && <div style={{ marginBottom: 12 }}><ActionButtons onApprove={onApprove} onReject={onReject} loading={loading} fullWidth /></div>}

      {/* Data fields row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? 10 : 16,
        paddingTop: 12,
        borderTop: '1px solid #F3F4F6',
      }}>
        <DataField
          label="Date"
          value={attendDate}
          icon={<Calendar size={12} color="#9CA3AF" />}
        />
        <DataField
          label="Requested Check-In"
          value={checkInDisplay}
          icon={<Clock size={12} color="#059669" />}
          valueColor="#059669"
        />
        <DataField
          label="Requested Check-Out"
          value={checkOutDisplay}
          icon={<Clock size={12} color="#059669" />}
          valueColor="#059669"
        />
        <div style={{ gridColumn: isMobile ? 'span 2' : 'auto' }}>
          <DataField
            label="Reason"
            value={<span style={{ whiteSpace: 'normal', lineHeight: 1.4, color: '#6B7280', fontWeight: 400, fontSize: 13 }}>{reason}</span>}
            icon={<FileText size={12} color="#9CA3AF" />}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── RejectModal ────────────────────────────────────────── */
function RejectModal({ open, title, subtitle, onCancel, onFinish, formInstance, loading, isMobile }) {
  return (
    <Modal
      open={open} onCancel={onCancel} footer={null} width={isMobile ? '100%' : 480}
      style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', padding: 0 } : {}}
      centered={!isMobile} maskClosable={false} zIndex={1400} destroyOnClose
      styles={{ body: { padding: 0 }, content: { borderRadius: 16, overflow: 'hidden', padding: 0 } }}
      closable={false}
    >
      {/* Gradient header */}
      <div style={{ background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)', padding: '20px 24px', position: 'relative' }}>
        <button
          onClick={onCancel}
          style={{
            position: 'absolute', top: 14, right: 14, width: 28, height: 28,
            borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldAlert size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '20px 24px 24px' }}>
        <Form form={formInstance} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="reason"
            label={<span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Rejection Reason</span>}
            rules={[
              { required: true, message: 'Please provide a reason' },
              { validator: (_, v) => (!v || String(v).trim().length >= 5) ? Promise.resolve() : Promise.reject(new Error('Must be at least 5 characters')) },
            ]}
            style={{ marginBottom: 20 }}
          >
            <TextArea rows={4} placeholder="Explain why you're rejecting this request…" style={{ borderRadius: 8 }} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button" onClick={onCancel}
              style={{
                flex: 1, height: 40, borderRadius: 8, border: '1px solid #E5E7EB',
                background: '#F3F4F6', color: '#374151', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Cancel</button>
            <button
              type="button"
              disabled={loading}
              onClick={() => formInstance.submit()}
              style={{
                flex: 1, height: 40, borderRadius: 8, border: 'none',
                background: loading ? '#fca5a5' : '#DC2626', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >{loading ? 'Rejecting…' : 'Yes, Reject'}</button>
          </div>
        </Form>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function LeaveApprovals() {
  const { user, isManager, isHR, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const initialTab = new URLSearchParams(location.search).get('tab') === 'regularization' ? 'regularization' : 'leave';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingRegularizations, setPendingRegularizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [approvedToday, setApprovedToday] = useState(0);

  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRegularization, setSelectedRegularization] = useState(null);
  const [showRegularizationRejectModal, setShowRegularizationRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [regularizationActionLoading, setRegularizationActionLoading] = useState(false);
  const [regularizationPagination, setRegularizationPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  const [form] = Form.useForm();
  const [regularizationRejectForm] = Form.useForm();
  const canViewRegularizationApprovals = isManager || isHR || isAdmin;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      adminAPI.getBranches().then(res => setBranches(Array.isArray(res?.data) ? res.data : [])).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!canViewRegularizationApprovals && activeTab === 'regularization') { setActiveTab('leave'); return; }
    setSearchQuery('');
    if (activeTab === 'leave') { loadPendingLeaves(); return; }
    loadPendingRegularizations(1, regularizationPagination.limit);
  }, [activeTab, canViewRegularizationApprovals, branchFilter]);

  useAutoRefresh(
    () => activeTab === 'leave'
      ? loadPendingLeaves()
      : loadPendingRegularizations(regularizationPagination.page, regularizationPagination.limit, false),
    { enabled: true, scope: `approvals-${activeTab}`, intervalMs: 120000, deps: [activeTab, regularizationPagination.page, regularizationPagination.limit, branchFilter] }
  );

  async function loadPendingLeaves() {
    setLoading(true);
    try {
      const params = branchFilter ? { branchId: branchFilter } : {};
      const response = await leaveAPI.getPendingApprovals(params);
      setPendingLeaves(Array.isArray(response?.data) ? response.data : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function loadPendingRegularizations(page = 1, limit = 20, setLoader = true) {
    if (setLoader) setLoading(true);
    try {
      const response = await attendanceAPI.getPendingRegularizations({
        status: 'pending', page, limit, ...(branchFilter ? { branchId: branchFilter } : {}),
      });
      const payload = response?.data || {};
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const pag = payload?.pagination || {};
      setPendingRegularizations(items);
      setRegularizationPagination({
        page: Number(pag?.page ?? page), limit: Number(pag?.limit ?? limit),
        total: Number(pag?.total ?? items.length), totalPages: Number(pag?.totalPages ?? 1),
      });
    } catch { /* ignore */ } finally { if (setLoader) setLoading(false); }
  }

  const handleApprove = (leaveId) => {
    Modal.confirm({
      title: 'Approve Leave Request?',
      content: 'Are you sure you want to approve this request?',
      okText: 'Yes, Approve', okType: 'primary', cancelText: 'Cancel',
      onOk: async () => {
        setActionLoading(true);
        try {
          await leaveAPI.approve(leaveId);
          message.success('Leave approved successfully!');
          setApprovedToday(n => n + 1);
          broadcastDataRefresh('leaves'); loadPendingLeaves();
        } catch (e) { message.error(e.message || 'Failed to approve leave'); }
        finally { setActionLoading(false); }
      }
    });
  };

  const handleReject = async (values) => {
    setActionLoading(true);
    try {
      await leaveAPI.reject(selectedLeave.id, values.reason);
      message.success('Leave rejected successfully!');
      setShowRejectModal(false); form.resetFields(); setSelectedLeave(null);
      broadcastDataRefresh('leaves'); loadPendingLeaves();
    } catch (e) { message.error(e.message || 'Failed to reject leave'); }
    finally { setActionLoading(false); }
  };

  const handleApproveRegularization = (requestId) => {
    Modal.confirm({
      title: 'Approve Regularization Request?',
      content: 'This will update attendance as regularized for the requested date.',
      okText: 'Yes, Approve', okType: 'primary', cancelText: 'Cancel',
      onOk: async () => {
        setRegularizationActionLoading(true);
        try {
          await attendanceAPI.approveRegularization(requestId, { decisionNote: 'Approved' });
          message.success('Regularization approved successfully');
          setApprovedToday(n => n + 1);
          broadcastDataRefresh('attendance');
          loadPendingRegularizations(regularizationPagination.page, regularizationPagination.limit);
        } catch (e) { message.error(e?.message || 'Failed to approve regularization'); }
        finally { setRegularizationActionLoading(false); }
      }
    });
  };

  const handleRejectRegularization = async (values) => {
    setRegularizationActionLoading(true);
    try {
      await attendanceAPI.rejectRegularization(selectedRegularization.requestId, { reason: String(values.reason || '').trim() });
      message.success('Regularization rejected successfully');
      setShowRegularizationRejectModal(false); regularizationRejectForm.resetFields(); setSelectedRegularization(null);
      broadcastDataRefresh('attendance');
      loadPendingRegularizations(regularizationPagination.page, regularizationPagination.limit);
    } catch (e) { message.error(e?.message || 'Failed to reject regularization'); }
    finally { setRegularizationActionLoading(false); }
  };

  const filteredLeaves = useMemo(() => {
    // Filter out current user's own leaves to prevent self-approval
    const currentUserId = user?.id;
    const nonSelfLeaves = currentUserId
      ? pendingLeaves.filter(l => {
          const employeeUserId = l?.employee?.userId || l?.employeeUserId || l?.employee_user_id;
          return employeeUserId !== currentUserId;
        })
      : pendingLeaves;
    if (!searchQuery.trim()) return nonSelfLeaves;
    const q = searchQuery.toLowerCase();
    return nonSelfLeaves.filter(l => {
      const e = l?.employee || {};
      const name = e.name || e.fullName || l.employeeName || l.name ||
        [e.firstName, e.lastName].filter(Boolean).join(' ') || '';
      const code = e.employeeCode || l.employeeCode || '';
      return name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
    });
  }, [pendingLeaves, searchQuery, user?.id]);

  const filteredRegularizations = useMemo(() => {
    if (!searchQuery.trim()) return pendingRegularizations;
    const q = searchQuery.toLowerCase();
    return pendingRegularizations.filter(item => {
      const name = item.employeeName || item.name || item.employee?.name || '';
      const code = item.employeeCode || item.employee?.employeeCode || '';
      return name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
    });
  }, [pendingRegularizations, searchQuery]);

  const leaveCount = pendingLeaves.length;
  const regCount   = regularizationPagination.total || pendingRegularizations.length;

  const PaginationBar = () => {
    const { page, limit, total, totalPages } = regularizationPagination;
    if (totalPages <= 1) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>
          Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { label: '←', disabled: page === 1, onClick: () => loadPendingRegularizations(page - 1, limit) },
            ...Array.from({ length: totalPages }, (_, i) => ({ label: i + 1, active: i + 1 === page, onClick: () => loadPendingRegularizations(i + 1, limit) })),
            { label: '→', disabled: page >= totalPages, onClick: () => loadPendingRegularizations(page + 1, limit) },
          ].map((btn, i) => (
            <button key={i} onClick={btn.onClick} disabled={btn.disabled} style={{
              height: 32, minWidth: 32, paddingInline: String(btn.label).length > 2 ? 12 : 0,
              borderRadius: 8, border: btn.active ? 'none' : '1px solid #E5E7EB',
              background: btn.active ? BTN_GRADIENT : (btn.disabled ? '#F9FAFB' : '#fff'),
              color: btn.active ? '#fff' : (btn.disabled ? '#9CA3AF' : '#111827'),
              fontSize: 13, fontWeight: btn.active ? 700 : 500,
              cursor: btn.disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>{btn.label}</button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Breadcrumb
              items={[{ title: <Link to="/dashboard">Dashboard</Link> }, { title: 'Approvals' }]}
              style={{ marginBottom: 6 }}
            />
            <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>Approvals</Title>
            <Text style={{ color: themeTokens.colors.textTertiary, fontSize: 13 }}>
              Review leave and attendance regularization requests from your team
            </Text>
          </div>
          {isAdmin && branches.length > 0 && (
            <Select
              allowClear placeholder="All Branches"
              value={branchFilter || undefined}
              onChange={val => setBranchFilter(val || '')}
              style={{ minWidth: 200 }}
              options={branches.map(b => ({ value: b.id, label: b.name }))}
            />
          )}
        </div>

        {/* ── Main container ── */}
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB',
          boxShadow: '0 1px 4px rgba(16,24,40,0.05)', overflow: 'hidden',
        }}>
          {/* Tab bar */}
          <div style={{
            borderBottom: '1px solid #E5E7EB', display: 'flex',
            paddingInline: isMobile ? 12 : 20, gap: 4, paddingTop: 4,
            overflowX: 'auto', overflowY: 'hidden',
            msOverflowStyle: 'none', scrollbarWidth: 'none',
          }}>
            {[
              { key: 'leave', label: 'Leave Requests', count: leaveCount, icon: <ClipboardList size={14} strokeWidth={2} /> },
              ...(canViewRegularizationApprovals ? [{ key: 'regularization', label: 'Attendance Regularization', count: regCount, icon: <Clock size={14} strokeWidth={2} /> }] : []),
            ].map(tab => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: isMobile ? '10px 4px' : '12px 4px',
                    marginRight: isMobile ? 12 : 16,
                    border: 'none', background: 'none', flexShrink: 0,
                    fontSize: isMobile ? 13 : 14, fontWeight: active ? 700 : 500,
                    color: active ? '#1368FF' : '#6B7280',
                    borderBottom: active ? '2px solid #1368FF' : '2px solid transparent',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s', whiteSpace: 'nowrap', marginBottom: -1,
                  }}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, minWidth: 20, height: 20,
                      borderRadius: 10, paddingInline: 6,
                      background: active ? '#EFF6FF' : '#F3F4F6',
                      color: active ? '#1368FF' : '#6B7280',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Cards list */}
          <div style={{ padding: isMobile ? '12px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #E5E7EB' }}>
                  <Skeleton active avatar={{ shape: 'square', size: 42 }} paragraph={{ rows: 2 }} />
                </div>
              ))
            ) : activeTab === 'leave' ? (
              filteredLeaves.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={
                    <Text style={{ color: themeTokens.colors.textTertiary, fontSize: 14 }}>
                      All caught up! No pending leave requests.
                    </Text>
                  } />
                </div>
              ) : filteredLeaves.map(leave => (
                <LeaveRequestCard
                  key={leave.id} leave={leave}
                  loading={actionLoading}
                  isMobile={isMobile}
                  onApprove={() => handleApprove(leave.id)}
                  onReject={() => { setSelectedLeave(leave); setShowRejectModal(true); }}
                />
              ))
            ) : (
              filteredRegularizations.length === 0 ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={
                    <Text style={{ color: themeTokens.colors.textTertiary, fontSize: 14 }}>
                      No pending regularization requests.
                    </Text>
                  } />
                </div>
              ) : (
                <>
                  {filteredRegularizations.map((item, idx) => (
                    <RegularizationCard
                      key={item.requestId || idx} item={item}
                      loading={regularizationActionLoading}
                      isMobile={isMobile}
                      onApprove={() => handleApproveRegularization(item.requestId)}
                      onReject={() => { setSelectedRegularization(item); setShowRegularizationRejectModal(true); }}
                    />
                  ))}
                  <PaginationBar />
                </>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <RejectModal
        open={showRejectModal}
        title="Reject Leave Request"
        subtitle="Explain why you're rejecting this application."
        onCancel={() => { setShowRejectModal(false); setSelectedLeave(null); form.resetFields(); }}
        onFinish={handleReject}
        formInstance={form}
        loading={actionLoading}
        isMobile={isMobile}
      />
      <RejectModal
        open={showRegularizationRejectModal}
        title="Reject Regularization Request"
        subtitle="Provide a reason for rejection."
        onCancel={() => { setShowRegularizationRejectModal(false); setSelectedRegularization(null); regularizationRejectForm.resetFields(); }}
        onFinish={handleRejectRegularization}
        formInstance={regularizationRejectForm}
        loading={regularizationActionLoading}
        isMobile={isMobile}
      />

    </Layout>
  );
}
