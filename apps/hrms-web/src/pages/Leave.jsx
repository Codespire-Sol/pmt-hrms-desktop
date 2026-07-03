import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Typography,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Empty,
  Skeleton,
  Segmented,
  Alert,
  Tooltip,
} from 'antd';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Stethoscope,
  Briefcase,
  TrendingUp,
  Coffee,
} from 'lucide-react';
import dayjs from 'dayjs';
import { leaveAPI } from '../api/leave';
import { attendanceAPI } from '../api/attendance';
import Layout from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { themeTokens } from '../styles/theme';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { broadcastDataRefresh } from '../utils/realtime';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;
const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';

// ── Leave type metadata ──────────────────────────────────────────────────────
const LEAVE_META = {
  casual:   { label: 'Casual Leave',  Icon: Briefcase,   color: '#1368FF', bg: '#EBF4FF' },
  sick:     { label: 'Sick Leave',    Icon: Stethoscope, color: '#F59E0B', bg: '#FEF3C7' },
  earned:   { label: 'Earned Leave',  Icon: TrendingUp,  color: '#10B981', bg: '#D1FAE5' },
  comp_off: { label: 'Comp Off',      Icon: Coffee,      color: '#8B5CF6', bg: '#EDE9FE' },
  lop:      { label: 'LOP',           Icon: AlertCircle, color: '#EF4444', bg: '#FEE2E2' },
};

function getLeaveMeta(type) {
  const key = String(type || '').toLowerCase().replace(/\s/g, '_');
  return LEAVE_META[key] || { label: type || 'Leave', Icon: CalendarDays, color: '#6B7280', bg: '#F3F4F6' };
}

// ── Status badge — Figma spec ────────────────────────────────────────────────
// APPROVED: blue bg (#EBF4FF) + blue text (#1368FF) + CheckCircle icon
// PENDING:  gray bg (#F3F4F6) + dark text (#001266) + Clock icon
// REJECTED/CANCELLED: red bg (#FEE2E2) + red text (#DC2626) + XCircle icon
const STATUS_STYLES = {
  approved:       { bg: '#EBF4FF', color: '#1368FF',  label: 'APPROVED'       },
  pending:        { bg: '#F3F4F6', color: '#001266',  label: 'PENDING'        },
  rejected:       { bg: '#FEE2E2', color: '#DC2626',  label: 'REJECTED'       },
  cancelled:      { bg: '#FEE2E2', color: '#DC2626',  label: 'CANCELLED'      },
  credit:         { bg: '#EBF4FF', color: '#1368FF',  label: 'CREDIT'         },
  utilized:       { bg: '#EBF4FF', color: '#1368FF',  label: 'UTILIZED'       },
  auto_deducted:  { bg: '#FFF7ED', color: '#EA580C',  label: 'AUTO-DEDUCTED'  },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[String(status || '').toLowerCase()] || { bg: '#F3F4F6', color: '#6B7280', label: String(status || '').toUpperCase() };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 700,
      background: s.bg, color: s.color,
    }}>
      {s.label === 'APPROVED'      && <CheckCircle2 size={12} />}
      {s.label === 'PENDING'       && <Clock size={12} />}
      {(s.label === 'REJECTED' || s.label === 'CANCELLED') && <XCircle size={12} />}
      {s.label === 'CREDIT'        && <CheckCircle2 size={12} />}
      {s.label === 'UTILIZED'      && <CheckCircle2 size={12} />}
      {s.label === 'AUTO-DEDUCTED' && <CheckCircle2 size={12} />}
      {s.label}
    </span>
  );
}

export default function Leave() {
  const { user } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [historyFilter, setHistoryFilter] = useState('all');
  const [activeLeaveTypes, setActiveLeaveTypes] = useState(null);

  // Apply modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [form] = Form.useForm();
  const [applying, setApplying] = useState(false);
  const [leaveSession, setLeaveSession] = useState('full_day');
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);


  useEffect(() => {
    loadData();
    loadTodayAttendance();
  }, [selectedYear]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openApply') === 'true') setShowApplyModal(true);
  }, [location.search]);
  useAutoRefresh(loadData, { enabled: true, scope: 'leaves', intervalMs: 120000 });

  async function loadTodayAttendance() {
    try {
      const res = await attendanceAPI.getTodayStatus();
      setTodayAttendance(res?.data || null);
    } catch { /* non-critical */ }
  }

  const getAttendanceConflict = (session, date) => {
    if (!todayAttendance || !date) return null;
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    if (dateStr !== dayjs().format('YYYY-MM-DD')) return null;
    const { hasCheckedIn, hasCheckedOut } = todayAttendance;
    if (hasCheckedOut) return 'You have already clocked out for today. Leave cannot be applied for a completed workday.';
    if (hasCheckedIn) {
      if (session === 'first_half') return 'You have already clocked in for today\'s first half. First Half leave cannot be applied after attendance is marked.';
      if (session === 'full_day') return 'You have already clocked in for today. Full Day leave cannot be applied after attendance has been marked. You may apply for Second Half leave instead.';
    }
    return null;
  };

  const formatLabel = (value) => {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return '-';
    return text.replace(/_/g, ' ').replace(/^\w/, (x) => x.toUpperCase());
  };

  const buildHistoryRows = (leaveRows = [], balancePayload = {}) => {
    const historyList = Array.isArray(balancePayload?.history) ? balancePayload.history : [];
    const leaveIdsFromHistory = new Set(historyList.map((item) => item?.leaveId).filter(Boolean));
    const normalizedHistoryRows = historyList.map((item, index) => ({
      id: item.leaveId || `history-${item.type || 'entry'}-${item.leaveType || 'na'}-${item.date || index}-${index}`,
      rowType: 'history',
      historyType: item.type || null,
      leaveType: item.leaveType || null,
      leaveTypeName: item.leaveTypeName || null,
      fromDate: item.fromDate || null,
      toDate: item.toDate || null,
      days: item.days ?? item.amount ?? null,
      reason: item.reason || item.note || '-',
      isAutoLop: item.isAutoLop ?? false,
      status: item.isAutoLop && item.status === 'approved' ? 'auto_deducted' : (item.status || item.type || 'processed'),
      historyDate: item.date || item.appliedAt || item.createdAt || null,
      approvedBy: item.approvedBy || null,
      originalHistory: item,
    }));
    const additionalLeaveRows = (Array.isArray(leaveRows) ? leaveRows : [])
      .filter((item) => !leaveIdsFromHistory.has(item?.id))
      .map((item) => ({
        ...item,
        id: item?.id || `leave-${item?.fromDate || ''}-${item?.toDate || ''}-${Math.random()}`,
        rowType: 'leave',
        historyDate: item?.appliedAt || item?.createdAt || item?.fromDate || null,
      }));
    return [...normalizedHistoryRows, ...additionalLeaveRows]
      .sort((a, b) => dayjs(b?.historyDate || 0).valueOf() - dayjs(a?.historyDate || 0).valueOf());
  };

  async function loadData() {
    setLoading(true);
    try {
      const [leavesRes, summaryRes, configRes] = await Promise.all([
        leaveAPI.getEmployeeLeaves(user?.id, { year: selectedYear }),
        leaveAPI.getSummary(user?.id, { year: selectedYear }),
        leaveAPI.getAccrualConfig().catch(() => null),
      ]);
      const leaveRows = Array.isArray(leavesRes?.data) ? leavesRes.data : [];
      const summaryPayload = summaryRes?.data || null;
      setLeaves(buildHistoryRows(leaveRows, summaryPayload || {}));
      setBalance(summaryPayload);
      const configData = configRes?.data || {};
      const leaveTypesSource = (Array.isArray(configData.leaveTypes) && configData.leaveTypes.length > 0)
        ? configData.leaveTypes
        : (Array.isArray(summaryPayload?.config?.leaveTypes) && summaryPayload.config.leaveTypes.length > 0)
          ? summaryPayload.config.leaveTypes
          : null;
      if (leaveTypesSource) {
        setActiveLeaveTypes(leaveTypesSource.filter(lt => lt.active));
      }
    } catch (error) {
      console.error('Failed to load leave data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleApplyLeave = async (values) => {
    const { leaveType, date, dates, reason } = values;
    const isHalfDay = leaveSession === 'first_half' || leaveSession === 'second_half';
    const fromDate = isHalfDay ? date.format('YYYY-MM-DD') : dates[0].format('YYYY-MM-DD');
    const toDate = isHalfDay ? date.format('YYYY-MM-DD') : dates[1].format('YYYY-MM-DD');
    const checkDate = isHalfDay ? date : (dates && dates[0] && dayjs().isSame(dates[0], 'day') ? dates[0] : null);
    const conflict = getAttendanceConflict(leaveSession, checkDate);
    if (conflict) { message.error(conflict); return; }
    setApplying(true);
    try {
      await leaveAPI.apply({ leaveType, fromDate, toDate, session: leaveSession, reason });
      message.success('Leave application submitted successfully!');
      setShowApplyModal(false);
      form.resetFields();
      setLeaveSession('full_day');
      setSelectedDate(null);
      broadcastDataRefresh();
      loadData();
    } catch (error) {
      message.error(error.message || 'Failed to apply leave');
    } finally {
      setApplying(false);
    }
  };

  const handleCancelLeave = async (leaveId) => {
    try {
      await leaveAPI.cancel(leaveId);
      message.success('Leave cancelled successfully!');
      broadcastDataRefresh();
      loadData();
    } catch (error) {
      message.error(error.message || 'Failed to cancel leave');
    }
  };


  // ── Computed stats ───────────────────────────────────────────────────────────
  const totalLeaves = (() => {
    const cards = balance?.cards || {};
    return Object.values(cards).reduce((sum, c) => sum + (Number(c?.credited) || 0), 0) ||
      (balance?.balance ? Object.values(balance.balance).reduce((sum, c) => sum + (Number(c?.total) || 0), 0) : 0);
  })();
  const usedLeaves = (() => {
    const cards = balance?.cards || {};
    return Object.values(cards).reduce((sum, c) => sum + (Number(c?.used) || 0), 0) ||
      (balance?.balance ? Object.values(balance.balance).reduce((sum, c) => sum + (Number(c?.used) || 0), 0) : 0);
  })();
  const availableLeaves = totalLeaves - usedLeaves;

  // ── Balance card data ────────────────────────────────────────────────────────
  // Default leave types to show when no config is loaded yet
  const DEFAULT_BALANCE_KEYS = ['casual', 'sick', 'earned', 'comp_off'];
  // Use card keys from the API response (already gender-filtered) when available,
  // otherwise fall back to activeLeaveTypes or defaults.
  const responseCardKeys = balance?.cards ? Object.keys(balance.cards) : null;
  const cardKeys = responseCardKeys
    ? responseCardKeys.filter(k => k !== 'lop' && k !== 'comp_off')
    : activeLeaveTypes
      ? activeLeaveTypes.map(lt => lt.id)
      : DEFAULT_BALANCE_KEYS;

  const balanceCards = cardKeys.map(key => {
    const meta = getLeaveMeta(key);
    const configType = activeLeaveTypes?.find(lt => lt.id === key);
    const cardData = balance?.cards?.[key];
    return {
      key,
      title: cardData?.name || configType?.name || meta.label,
      Icon: meta.Icon,
      color: configType?.color || meta.color,
      available: cardData?.available ?? balance?.balance?.[key]?.remaining ?? 0,
      total: cardData?.maxBalance ?? cardData?.credited ?? balance?.balance?.[key]?.total ?? 0,
      used: cardData?.used ?? balance?.balance?.[key]?.used ?? 0,
    };
  });

  // ── Filtered history ─────────────────────────────────────────────────────────
  const filteredLeaves = historyFilter === 'all'
    ? leaves
    : leaves.filter(r => String(r.status || '').toLowerCase() === historyFilter);

  return (
    <Layout>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={2} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em', color: '#001266', fontSize: 24, lineHeight: '32px' }}>
              Leave &amp; Time Off
            </Title>
            <Text style={{ color: themeTokens.colors.textTertiary, fontSize: 14 }}>
              Manage your leave balances and track leave requests
            </Text>
          </div>

          {/* Apply for Leave button */}
          <button
            onClick={() => setShowApplyModal(true)}
            style={{
              height: 40, paddingInline: 20, fontWeight: 700, borderRadius: 12,
              background: themeTokens.colors.primary, color: '#fff', border: 'none',
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Plus size={16} />
            Apply for Leave
          </button>
        </div>

        {user?.role === 'admin' && (
          <Alert type="info" showIcon message="Your leave balance is calculated using the Global Default leave configuration." style={{ borderRadius: 12, fontSize: 13 }} />
        )}

        {/* ── Stats bar: year nav + totals ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 8 }}>
          {/* Year selector — single bordered pill with prev/next */}
          <div style={{
            display: 'flex', alignItems: 'center',
            border: `1px solid ${themeTokens.colors.borders}`, borderRadius: 12,
            background: '#fff', userSelect: 'none', overflow: 'hidden',
            height: 38,
          }}>
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                padding: '0 10px', color: themeTokens.colors.textTertiary,
                display: 'flex', alignItems: 'center', height: '100%',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <Text style={{ fontSize: 14, fontWeight: 600, color: '#001266', padding: '0 4px' }}>
              Year {selectedYear}
            </Text>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                padding: '0 10px', color: themeTokens.colors.textTertiary,
                display: 'flex', alignItems: 'center', height: '100%',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Stats pills */}
          {!loading && balance && (
            <>
              {[
                { label: 'Total',     value: totalLeaves,     icon: <CalendarDays size={14} /> },
                { label: 'Used',      value: usedLeaves,      icon: <Clock size={14} /> },
                { label: 'Available', value: availableLeaves, icon: <CheckCircle2 size={14} /> },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  height: 38, padding: '0 14px', borderRadius: 12,
                  border: `1px solid ${themeTokens.colors.borders}`,
                  background: '#fff', fontSize: 12,
                }}>
                  <span style={{ color: themeTokens.colors.primary }}>{icon}</span>
                  <span style={{ fontWeight: 600, color: '#001266' }}>{label}:</span>
                  <span style={{ fontWeight: 700, color: '#001266' }}>{value}</span>
                </div>
              ))}
            </>
          )}

        </div>

        {/* ── Balance Cards ── */}
        {/* Section label */}
        <div>
          <Text style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Leave Balance
          </Text>
        </div>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ background: '#fff', border: `1px solid ${themeTokens.colors.borders}`, borderRadius: 12, padding: 20 }}>
                <Skeleton active paragraph={{ rows: 2 }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${Math.min(balanceCards.length, 4)}, 1fr)`, gap: 16 }}>
            {balanceCards.map(({ key, title, Icon, color, available, total, used }) => {
              const safeTotal = Number(total || 0);
              const safeAvail = Number(available || 0);
              const safeUsed = Number(used || 0);
              const pct = safeTotal > 0 ? Math.round((safeAvail / safeTotal) * 100) : 100;
              const cardColor = color || themeTokens.colors.primary;
              const cardBg = `${cardColor}18`;
              return (
                <div key={key} style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: `1px solid ${themeTokens.colors.borders}`,
                  boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
                  padding: '16px 16px 14px',
                }}>
                  {/* Top row: icon box + percent badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: cardBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={18} color={cardColor} />
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: cardColor,
                      background: cardBg,
                      padding: '3px 8px', borderRadius: 4,
                    }}>
                      {pct}%
                    </span>
                  </div>

                  {/* Leave type label */}
                  <Text style={{ fontSize: 13, fontWeight: 600, color: themeTokens.colors.textTertiary, display: 'block', marginBottom: 4 }}>
                    {title}
                  </Text>

                  {/* Count: "11 / 12" */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 10 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: '#001266', lineHeight: 1 }}>
                      {safeAvail}
                    </span>
                    <span style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
                      / {safeTotal}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 5, borderRadius: 3, background: themeTokens.colors.borders, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${pct}%`,
                      background: cardColor,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>

                  {/* Footer */}
                  <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>
                    {safeUsed} used • {safeAvail} available
                  </Text>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Leave History ── */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: `1px solid ${themeTokens.colors.borders}`,
          boxShadow: themeTokens.shadows.standard,
          overflow: 'hidden',
        }}>
          {/* Section header */}
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
            gap: isMobile ? 12 : 0,
            padding: isMobile ? '14px 16px' : '18px 24px',
            borderBottom: `1px solid ${themeTokens.colors.borders}`,
          }}>
            <div>
              <Text style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }}>
                Leave History
              </Text>
              <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
                Track all your leave requests and their status
              </Text>
            </div>
            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'approved', 'pending', 'rejected'].map(tab => {
                const isActive = historyFilter === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setHistoryFilter(tab)}
                    style={{
                      height: 30, padding: '0 12px', borderRadius: 12,
                      border: `1px solid ${isActive ? themeTokens.colors.primary : themeTokens.colors.borders}`,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: isActive ? '#EBF4FF' : '#fff',
                      color: isActive ? themeTokens.colors.primary : themeTokens.colors.textTertiary,
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding: '24px' }}>
              {[1,2,3].map(i => <Skeleton key={i} active avatar paragraph={{ rows: 1 }} style={{ marginBottom: 16 }} />)}
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Empty description="No leave records found." />
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px' }}>
              {filteredLeaves.map((record, idx) => {
                const normalizedStatus = String(record.status || 'pending').toLowerCase();
                const meta = getLeaveMeta(record.leaveType);
                const { Icon: LeaveIcon } = meta;
                const canCancel = normalizedStatus === 'pending' && record.id && !record.id.startsWith('history-');
                const leaveLabel = record.leaveTypeName || formatLabel(record.leaveType);
                const displayTitle = record.rowType === 'history'
                  ? `${formatLabel(record.historyType)} • ${leaveLabel}`
                  : `${leaveLabel} Leave`;
                const daysText = record.days != null && record.days !== ''
                  ? `${record.days} ${record.days === 1 ? 'day' : 'days'}` : null;
                const dateRangeText = record.fromDate && record.toDate
                  ? (record.fromDate === record.toDate
                    ? dayjs(record.fromDate).format('MMM DD, YYYY')
                    : `${dayjs(record.fromDate).format('MMM DD')} – ${dayjs(record.toDate).format('MMM DD')}`)
                  : record.historyDate ? dayjs(record.historyDate).format('MMM DD, YYYY') : '-';
                const statusColors = {
                  approved: { bg: '#DCFCE7', color: '#16a34a' },
                  pending:  { bg: '#FEF9C3', color: '#ca8a04' },
                  rejected: { bg: '#FEE2E2', color: '#dc2626' },
                  cancelled:{ bg: '#F3F4F6', color: '#6b7280' },
                };
                const sc = statusColors[normalizedStatus] || statusColors.pending;
                return (
                  <div key={record.id || idx} style={{
                    background: '#fff', border: `1px solid ${themeTokens.colors.borders}`,
                    borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    {/* Icon */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <LeaveIcon size={16} color={meta.color} />
                    </div>
                    {/* Middle: title + date */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>{dateRangeText}</span>
                        {daysText && <span style={{ fontSize: 10, fontWeight: 600, color: meta.color, background: meta.bg, padding: '1px 6px', borderRadius: 4 }}>{daysText}</span>}
                      </div>
                    </div>
                    {/* Right: status + cancel */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: sc.bg, color: sc.color, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                        {normalizedStatus}
                      </span>
                      {canCancel && (
                        <button onClick={() => handleCancelLeave(record.id)} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, border: '1px solid #FECACA', background: '#FFF5F5', color: '#DC2626', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            filteredLeaves.map((record, idx) => {
              const isLast = idx === filteredLeaves.length - 1;
              const normalizedStatus = String(record.status || 'pending').toLowerCase();
              const meta = getLeaveMeta(record.leaveType);
              const { Icon: LeaveIcon } = meta;
              const sessionLabel = record.session === 'first_half' ? ' · First Half'
                : record.session === 'second_half' ? ' · Second Half' : '';
              const canCancel = normalizedStatus === 'pending' && record.id && !record.id.startsWith('history-');

              const leaveLabel = record.leaveTypeName || formatLabel(record.leaveType);
              const displayTitle = record.rowType === 'history'
                ? `${formatLabel(record.historyType)} • ${leaveLabel}`
                : `${leaveLabel} Leave${sessionLabel}`;

              const daysText = record.days != null && record.days !== ''
                ? `${record.days} ${record.days === 1 ? 'day' : 'days'}`
                : null;

              const dateRangeText = record.fromDate && record.toDate
                ? (record.fromDate === record.toDate
                  ? dayjs(record.fromDate).format('MMM DD, YYYY')
                  : `${dayjs(record.fromDate).format('MMM DD')} - ${dayjs(record.toDate).format('MMM DD, YYYY')}`)
                : record.historyDate ? dayjs(record.historyDate).format('MMM DD, YYYY') : '-';

              const appliedText = record.historyDate
                ? `Applied on ${dayjs(record.historyDate).format('MMM DD, YYYY')}`
                : '';

              const approvedBy = record.approvedBy || record.approvedByName || record.originalHistory?.approvedByName || null;

              return (
                <div
                  key={record.id || idx}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 24px',
                    borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = themeTokens.colors.appBackground}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <LeaveIcon size={18} color={meta.color} />
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text strong style={{ fontSize: 14, color: themeTokens.colors.textPrimary }}>
                        {displayTitle}
                      </Text>
                      {daysText && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: meta.bg, color: meta.color,
                        }}>
                          {daysText}
                        </span>
                      )}
                    </div>
                    <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary, display: 'block', marginTop: 2 }}>
                      {record.reason && record.reason !== '-' ? record.reason : '—'}
                    </Text>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: themeTokens.colors.textTertiary, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <CalendarDays size={11} /> {dateRangeText}
                      </span>
                      {appliedText && (
                        <span style={{ fontSize: 11, color: themeTokens.colors.textTertiary, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={11} /> {appliedText}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: approved by + status + action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {approvedBy && normalizedStatus === 'approved' && (
                      <div style={{ textAlign: 'right' }}>
                        <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary, display: 'block' }}>Approved by</Text>
                        <Text style={{ fontSize: 12, fontWeight: 600, color: themeTokens.colors.textSecondary }}>{approvedBy}</Text>
                      </div>
                    )}
                    <StatusBadge status={normalizedStatus} />
                    {canCancel && (
                      <Tooltip title="Cancel this leave request">
                        <button
                          onClick={() => handleCancelLeave(record.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            height: 28, paddingInline: 10, borderRadius: 6,
                            border: '1px solid #FECACA', background: '#FFF5F5',
                            color: '#DC2626', fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          <RotateCcw size={12} /> Cancel
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Space>

      {/* ── Apply for Leave Modal ── */}

      <Modal
        title={
          <div style={{ paddingBottom: 16, borderBottom: `1px solid #F0F0F0` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1E2875' }}>Apply for Leave</div>
            <Text type="secondary" style={{ fontSize: 13 }}>Please fill in the details below to submit your request.</Text>
          </div>
        }
        open={showApplyModal}
        onCancel={() => { setShowApplyModal(false); form.resetFields(); setLeaveSession('full_day'); setSelectedDate(null); }}
        footer={null}
        width={isMobile ? '100%' : 520}
        style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', padding: 0 } : {}}
        centered={!isMobile}
        destroyOnClose
        maskClosable={false}
        zIndex={1400}
        afterClose={() => {
          document.body.style.overflow = '';
          document.body.style.paddingRight = '';
          document.body.classList.remove('ant-scrolling-effect', 'ant-overflow-hidden');
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleApplyLeave} style={{ marginTop: 24 }} initialValues={{ leaveType: 'casual' }}>
          <Form.Item name="leaveType" label="Leave Type" rules={[{ required: true, message: 'Please select leave type' }]}>
            <Select size="large" style={{ borderRadius: 8 }}>
              {activeLeaveTypes
                ? activeLeaveTypes.map(lt => (
                    <Select.Option key={lt.id} value={lt.id}>{lt.name}</Select.Option>
                  ))
                : (
                  <>
                    <Select.Option value="casual">Casual Leave</Select.Option>
                    <Select.Option value="sick">Sick Leave</Select.Option>
                    <Select.Option value="earned">Earned Leave</Select.Option>
                    <Select.Option value="maternity">Maternity Leave</Select.Option>
                    <Select.Option value="paternity">Paternity Leave</Select.Option>
                    <Select.Option value="lop">LOP (Loss of Pay)</Select.Option>
                  </>
                )
              }
            </Select>
          </Form.Item>

          <Form.Item label="Leave Duration">
            <Segmented
              block value={leaveSession}
              onChange={(val) => { setLeaveSession(val); setSelectedDate(null); form.setFieldsValue({ date: undefined, dates: undefined }); }}
              options={[
                { label: 'Full Day', value: 'full_day' },
                { label: 'First Half', value: 'first_half' },
                { label: 'Second Half', value: 'second_half' },
              ]}
              style={{ borderRadius: 8 }}
            />
            {(leaveSession === 'first_half' || leaveSession === 'second_half') && (
              <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: '#F0F9FF', border: '1px solid #BAE6FD', fontSize: 12, color: '#0369A1' }}>
                {leaveSession === 'first_half' ? '🌅 First Half: Morning session (typically until lunch)' : '🌇 Second Half: Afternoon session (after lunch)'}
                {' '}— counts as 0.5 days.
              </div>
            )}
          </Form.Item>

          {leaveSession === 'full_day' ? (
            <Form.Item name="dates" label="Date Range" rules={[{ required: true, message: 'Please select date range' }]}>
              <RangePicker size="large" style={{ width: '100%', borderRadius: 8 }}
                disabledDate={(current) => {
                  if (!current) return false;
                  if (current < dayjs().startOf('day')) return true;
                  if (todayAttendance?.hasCheckedOut && current.isSame(dayjs(), 'day')) return true;
                  return false;
                }}
                onChange={(dates) => setSelectedDate(dates ? dates[0] : null)}
              />
            </Form.Item>
          ) : (
            <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Please select date' }]}>
              <DatePicker size="large" style={{ width: '100%', borderRadius: 8 }}
                disabledDate={(current) => {
                  if (!current) return false;
                  if (current < dayjs().startOf('day')) return true;
                  if (leaveSession === 'first_half' && todayAttendance?.hasCheckedIn && current.isSame(dayjs(), 'day')) return true;
                  if (todayAttendance?.hasCheckedOut && current.isSame(dayjs(), 'day')) return true;
                  return false;
                }}
                onChange={(date) => setSelectedDate(date)}
              />
            </Form.Item>
          )}

          {(() => {
            const conflictMsg = getAttendanceConflict(leaveSession, selectedDate);
            return conflictMsg ? <Alert type="warning" showIcon message={conflictMsg} style={{ marginBottom: 16, borderRadius: 8, fontSize: 13 }} /> : null;
          })()}

          <Form.Item name="reason" label="Reason for Leave" rules={[
            { required: true, message: 'Reason is required' },
            { validator: (_, value) => (!value || String(value).trim().length >= 5) ? Promise.resolve() : Promise.reject(new Error('Reason must be at least 5 characters')) }
          ]}>
            <TextArea rows={3} placeholder="Provide a brief reason for your leave request..." style={{ borderRadius: 8 }} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Button size="large" block onClick={() => { setShowApplyModal(false); form.resetFields(); setLeaveSession('full_day'); setSelectedDate(null); }} style={{ height: 48, borderRadius: 10 }}>
              Cancel
            </Button>
            <Button size="large" block htmlType="submit" loading={applying}
              disabled={Boolean(getAttendanceConflict(leaveSession, selectedDate))}
              style={{ height: 48, borderRadius: 10, background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}>
              Submit Request
            </Button>
          </div>
        </Form>
      </Modal>

    </Layout>
  );
}
