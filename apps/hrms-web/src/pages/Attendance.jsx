import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Typography,
  DatePicker,
  Row,
  Col,
  Tag,
  Empty,
  Skeleton,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Alert,
  Dropdown,
  Tooltip,
  Popover,
  Grid,
  message,
  Spin
} from 'antd';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  History,
  TrendingUp,
  EllipsisVertical,
  AlertTriangle,
  Info,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Palmtree,
  Users
} from 'lucide-react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { attendanceAPI } from '../api/attendance';
import Layout from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { themeTokens } from '../styles/theme';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

dayjs.extend(isoWeek);

const { Title, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

// ─── helpers ──────────────────────────────────────────────────────────────────

const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';
const HERO_GRADIENT = 'linear-gradient(90deg, #1368FF 0%, rgba(7,96,253,0.40) 100%)';

function statusConfig(status, record) {
  const s = status || 'Absent';
  if (['Present', 'Checked In'].includes(s)) {
    if (record?.isLate)
      return { color: '#F59E0B', bg: '#FFFBEB', border: '#F59E0B33', label: 'LATE' };
    return { color: '#10B981', bg: '#ECFDF5', border: '#10B98133', label: 'PRESENT' };
  }
  if (s === 'Incomplete')
    return { color: '#F59E0B', bg: '#FFFBEB', border: '#F59E0B33', label: 'INCOMPLETE' };
  if (s === 'Half Day')
    return { color: '#F59E0B', bg: '#FFFBEB', border: '#F59E0B33', label: 'HALF DAY' };
  if (s === 'Holiday')
    return { color: '#8B5CF6', bg: '#EDE9FE', border: '#8B5CF633', label: 'HOLIDAY' };
  if (s === 'Leave')
    return { color: '#3B82F6', bg: '#EBF4FF', border: '#3B82F633', label: 'LEAVE' };
  return { color: '#EF4444', bg: '#FEF3E2', border: '#EF444433', label: 'ABSENT' };
}

// ─── sub-components ───────────────────────────────────────────────────────────

function HeroBanner({ todayCheckIn, todayCheckOut }) {
  const today = dayjs();
  return (
    <div style={{
      background: HERO_GRADIENT,
      borderRadius: 20,
      padding: '28px 32px',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* top row: title + current month pill */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 24,
        position: 'relative',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Title level={2} style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em' }}>
            My Attendance
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
            {today.format('dddd, MMMM D, YYYY')} &bull; View your attendance history and working hours
          </Text>
        </div>

        {/* Current Month pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 12,
          padding: '8px 14px',
          flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(255,255,255,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Calendar size={16} color="#fff" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <Text style={{ color: 'rgba(255,255,255,0.70)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Current Week
            </Text>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
              {today.startOf('isoWeek').format('MMM DD')} — {today.endOf('isoWeek').format('MMM DD')}
            </Text>
          </div>
        </div>
      </div>

      {/* check-in / check-out cards */}
      <Row gutter={[16, 16]} style={{ position: 'relative' }}>
        {/* Check-In */}
        <Col xs={24} sm={12}>
          <div style={{
            background: 'rgba(255,255,255,0.10)',
            borderRadius: 14,
            padding: '14px 18px',
            border: '1px solid rgba(255,255,255,0.20)',
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 12 }}>
              Today&apos;s Check-In
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: '#1368FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Clock size={18} color="#fff" strokeWidth={2} />
              </div>
              <Text style={{ fontSize: 22, fontWeight: 700, color: todayCheckIn ? '#fff' : 'rgba(255,255,255,0.50)', letterSpacing: '-0.01em', lineHeight: 1 }}>
                {todayCheckIn || 'Not clocked in'}
              </Text>
            </div>
          </div>
        </Col>
        {/* Check-Out */}
        <Col xs={24} sm={12}>
          <div style={{
            background: 'rgba(255,255,255,0.10)',
            borderRadius: 14,
            padding: '14px 18px',
            border: '1px solid rgba(255,255,255,0.20)',
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 12 }}>
              Today&apos;s Check-Out
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: '#1368FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Clock size={18} color="#fff" strokeWidth={2} />
              </div>
              <Text style={{ fontSize: 22, fontWeight: 700, color: todayCheckOut ? '#fff' : 'rgba(255,255,255,0.50)', letterSpacing: '-0.01em', lineHeight: 1 }}>
                {todayCheckOut || 'Not clocked out yet'}
              </Text>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, trend, trendLabel, actionNeeded }) {
  return (
    <div style={{
      background: themeTokens.colors.appGradient,
      borderRadius: 16,
      border: `1px solid ${themeTokens.colors.borders}`,
      boxShadow: themeTokens.shadows.standard,
      padding: '20px 20px 18px',
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        {/* icon */}
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: BTN_GRADIENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(19,104,255,0.25)',
          flexShrink: 0,
        }}>
          <Icon size={19} color="#fff" strokeWidth={2.2} />
        </div>

        {/* trend badge or action-needed */}
        {actionNeeded ? (
          <span style={{
            background: '#FEF3E2', color: '#F59E0B',
            border: '1px solid #F59E0B33',
            borderRadius: 6, padding: '2px 8px',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>Action Needed</span>
        ) : trend != null ? (
          <span style={{
            background: trend >= 0 ? '#ECFDF5' : '#FEF2F2',
            color: trend >= 0 ? '#10B981' : '#EF4444',
            border: `1px solid ${trend >= 0 ? '#10B98133' : '#EF444433'}`,
            borderRadius: 6, padding: '2px 8px',
            fontSize: 11, fontWeight: 700,
          }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        ) : null}
      </div>

      <Text style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: themeTokens.colors.textTertiary,
        display: 'block', marginBottom: 4,
      }}>{title}</Text>

      <Title level={3} style={{
        margin: '0 0 2px', fontSize: 32, fontWeight: 800,
        lineHeight: 1.1, color: themeTokens.colors.heading,
        letterSpacing: '-0.02em',
      }}>{value}</Title>

      {subtitle && (
        <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>{subtitle}</Text>
      )}
      {trendLabel && (
        <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary, display: 'block', marginTop: 2 }}>{trendLabel}</Text>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Attendance() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, isEmployee, isAdmin, isManager, isHR } = useAuth();
  const canSelfService = isEmployee || isAdmin || isManager || isHR;
  const location = useLocation();

  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('isoWeek'));
  const weekEnd = weekStart.endOf('isoWeek');
  const [todayStatus, setTodayStatus] = useState(null);

  const [allRegularizations, setAllRegularizations] = useState([]);
  const [regularizationLoading, setRegularizationLoading] = useState(false);
  const [regularizationModalOpen, setRegularizationModalOpen] = useState(false);
  const [regularizationSubmitting, setRegularizationSubmitting] = useState(false);
  const [regularizationStatus, setRegularizationStatus] = useState('');
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [regularizationForm] = Form.useForm();
  const [logPopover, setLogPopover] = useState({ open: false, attendanceId: null, logs: [], loading: false });

  useEffect(() => { loadAttendance(); }, [weekStart]);
  useEffect(() => { if (canSelfService) loadRegularizations(); }, [weekStart, canSelfService]);
  useEffect(() => { loadTodayStatus(); }, []);
  useAutoRefresh(
    () => { loadAttendance(); if (canSelfService) loadRegularizations(); },
    { enabled: true, scope: 'attendance', intervalMs: 60000, deps: [weekStart, canSelfService] }
  );
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openRegularize') === 'true') openRegularizationModal();
  }, [location.search]);

  async function loadTodayStatus() {
    try {
      const res = await attendanceAPI.getTodayStatus();
      setTodayStatus(res?.data || null);
    } catch { /* ignore */ }
  }

  async function loadAttendance() {
    setLoading(true);
    try {
      const response = await attendanceAPI.getEmployeeAttendance(user.id, {
        fromDate: weekStart.format('YYYY-MM-DD'),
        toDate: weekStart.endOf('isoWeek').format('YYYY-MM-DD'),
      });
      setAttendance(Array.isArray(response?.data) ? response.data : []);
      setSummary(response?.summary || null);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRegularizations() {
    setRegularizationLoading(true);
    try {
      const response = await attendanceAPI.getMyRegularizations({
        month: weekStart.month() + 1,
        year: weekStart.year(),
      });
      const items = Array.isArray(response?.data?.items) ? response.data.items : [];
      setAllRegularizations(items);
      setQuotaInfo(response?.data?.quota || null);
    } catch (error) {
      message.error(error?.message || 'Failed to load regularization requests');
    } finally {
      setRegularizationLoading(false);
    }
  }

  const regularizations = useMemo(() => {
    if (!regularizationStatus) return allRegularizations;
    return allRegularizations.filter(
      (item) => String(item?.status || '').toLowerCase() === String(regularizationStatus).toLowerCase()
    );
  }, [allRegularizations, regularizationStatus]);

  const pendingRegularizationDates = useMemo(() => {
    const s = new Set();
    allRegularizations.forEach((item) => {
      if (String(item?.status || '').toLowerCase() !== 'pending') return;
      if (!item?.attendanceDate) return;
      s.add(dayjs(item.attendanceDate).format('YYYY-MM-DD'));
    });
    return s;
  }, [allRegularizations]);

  const regularizationQuota = useMemo(() => {
    const limit = Number(quotaInfo?.limit);
    const used = Number(quotaInfo?.used);
    const remaining = Number(quotaInfo?.remaining);
    if ([limit, used, remaining].every(Number.isFinite)) return { limit, used, remaining };
    const fallbackLimit = 3;
    const fallbackUsed = allRegularizations.length;
    return { limit: fallbackLimit, used: fallbackUsed, remaining: Math.max(fallbackLimit - fallbackUsed, 0) };
  }, [quotaInfo, allRegularizations]);

  const openRegularizationModal = (attendanceRecord = null) => {
    const now = dayjs();
    const inCurrentWeek = !now.isBefore(weekStart, 'day') && !now.isAfter(weekEnd, 'day');
    let baseDate = inCurrentWeek
      ? now
      : weekStart.hour(10).minute(0).second(0);
    if (attendanceRecord?.date) {
      const p = dayjs(attendanceRecord.date);
      if (p.isValid()) baseDate = p.hour(10).minute(0).second(0);
    }
    const requestedCheckInTime = attendanceRecord?.checkIn ? dayjs(attendanceRecord.checkIn) : baseDate;
    const fallbackCheckout = requestedCheckInTime.add(9, 'hour');
    const requestedCheckOutTime = attendanceRecord?.checkOut ? dayjs(attendanceRecord.checkOut) : fallbackCheckout;
    regularizationForm.setFieldsValue({
      attendanceDate: baseDate,
      requestedCheckInTime,
      requestedCheckOutTime: requestedCheckOutTime.isAfter(requestedCheckInTime) ? requestedCheckOutTime : fallbackCheckout,
    });
    setRegularizationModalOpen(true);
  };

  const handleSubmitRegularization = async (values) => {
    // ── Validation: prevent broken regularizations ──────────────────────────
    // Block submission when the picker values would produce nonsense, e.g. a
    // check-out from an earlier calendar day or at-or-before check-in. These
    // cases were previously sent to the server and stored as-is, causing
    // negative work_hours.
    const ci = values.requestedCheckInTime;
    const co = values.requestedCheckOutTime;
    if (ci && co) {
      if (!co.isAfter(ci)) {
        message.error('Check-out time must be after check-in time');
        return;
      }
      if (co.isBefore(ci, 'day')) {
        message.error("Check-out date can't be from the past (earlier than check-in)");
        return;
      }
      const now = dayjs();
      if (ci.isAfter(now)) {
        message.error("Check-in time can't be in the future");
        return;
      }
      if (co.isAfter(now)) {
        message.error("Check-out time can't be in the future");
        return;
      }
    }

    setRegularizationSubmitting(true);
    try {
      const payload = {
        attendanceDate: values.attendanceDate.format('YYYY-MM-DD'),
        requestedCheckInTime: values.requestedCheckInTime.format('YYYY-MM-DDTHH:mm:ssZ'),
        requestedCheckOutTime: values.requestedCheckOutTime.format('YYYY-MM-DDTHH:mm:ssZ'),
        reason: String(values.reason || '').trim(),
      };
      const response = await attendanceAPI.createRegularization(payload);
      const data = response?.data?.data || response?.data || {};
      setQuotaInfo(data?.quota || null);
      message.success(response?.data?.message || 'Attendance regularization request submitted');
      setRegularizationModalOpen(false);
      regularizationForm.resetFields();
      await Promise.all([loadRegularizations(), loadAttendance()]);
    } catch (error) {
      const code = error?.code || error?.response?.data?.error?.code;
      if (code === 'REGULARIZATION_LIMIT_EXCEEDED') {
        message.error(error?.message || error?.response?.data?.error?.message || 'Monthly regularization limit reached');
      } else {
        message.error(error?.message || 'Failed to submit regularization request');
      }
    } finally {
      setRegularizationSubmitting(false);
    }
  };

  async function fetchClockLogs(attendanceId) {
    if (logPopover.attendanceId === attendanceId && logPopover.open) {
      setLogPopover(prev => ({ ...prev, open: false }));
      return;
    }
    setLogPopover({ open: true, attendanceId, logs: [], loading: true });
    try {
      const res = await attendanceAPI.getAttendanceClockLogs(attendanceId);
      const logs = res?.data?.data?.logs || res?.data?.logs || [];
      setLogPopover({ open: true, attendanceId, logs, loading: false });
    } catch {
      setLogPopover({ open: true, attendanceId, logs: [], loading: false });
    }
  }

  // today's display times
  const toIST = (t) => t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null;
  const todayCheckIn = todayStatus?.checkInTimeDisplay || toIST(todayStatus?.checkInTime);
  const todayCheckOut = todayStatus?.checkOutTimeDisplay || toIST(todayStatus?.checkOutTime);

  // Exclude today only if still in-progress (no check-out yet)
  const todayStr = dayjs().format('YYYY-MM-DD');
  const statsAttendance = useMemo(() => attendance.filter(r => {
    const rd = r.date ? String(r.date).slice(0, 10) : '';
    if (rd !== todayStr) return true;
    // Include today if the shift is complete (has a check-out)
    return Boolean(r.checkOut || r.checkOutTime || r.check_out_time);
  }), [attendance, todayStr]);

  // Compute stat card values from frontend data (excluding today)
  const daysPresent = useMemo(() => {
    return statsAttendance.filter(r => {
      const s = String(r.status || '').toLowerCase();
      const isRegularized = r.manualCorrection || String(r.tag || '').toLowerCase() === 'regularized';
      return s === 'present' || s === 'half day' || s === 'half_day' || s === 'regularized' || s === 'late' || isRegularized;
    }).length;
  }, [statsAttendance]);
  const attendanceRate = useMemo(() => {
    if (!statsAttendance.length) return 0;
    return Math.round((daysPresent / statsAttendance.length) * 10000) / 100;
  }, [statsAttendance, daysPresent]);

  const totalHours = useMemo(() => {
    const total = statsAttendance.reduce((acc, r) => acc + (Number(r.workHours) || 0), 0);
    return total > 0 ? `${total.toFixed(0)}h` : '0h';
  }, [statsAttendance]);
  const avgHoursPerDay = useMemo(() => {
    const worked = statsAttendance.filter(r => Number(r.workHours) > 0);
    if (!worked.length) return null;
    const avg = worked.reduce((a, r) => a + Number(r.workHours), 0) / worked.length;
    return `Avg ${avg.toFixed(1)}h per day`;
  }, [statsAttendance]);
  const incompleteCount = useMemo(() => {
    return statsAttendance.filter(r => {
      const s = String(r.status || '').toLowerCase();
      const isRegularized = r.manualCorrection || String(r.tag || '').toLowerCase() === 'regularized';
      if (isRegularized) return false;
      return s === 'incomplete' || s === 'checked in' || s === 'checked_in';
    }).length;
  }, [statsAttendance]);
  const totalWorkingDays = statsAttendance.length;

  // Weekly view — show all records (max 7 per week)
  const recentAttendance = attendance;

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Hero Banner ── */}
        <HeroBanner todayCheckIn={todayCheckIn} todayCheckOut={todayCheckOut} />

        {/* ── Week Navigator + Export ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Week pill navigator */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setWeekStart(w => w.subtract(1, 'week'))}
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: '#FFFFFF', border: '1px solid #E5E7EB',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6B7280', transition: 'background 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
            >
              <ChevronLeft size={15} strokeWidth={2} color="#6B7280" />
            </button>

            <div style={{
              height: 34, paddingInline: 20,
              background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 200,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#00115B', whiteSpace: 'nowrap', userSelect: 'none' }}>
                {weekStart.format('MMM DD')} — {weekEnd.format('MMM DD, YYYY')}
              </span>
            </div>

            <button
              onClick={() => setWeekStart(w => w.add(1, 'week'))}
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: '#FFFFFF', border: '1px solid #E5E7EB',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6B7280', transition: 'background 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
            >
              <ChevronRight size={15} strokeWidth={2} color="#6B7280" />
            </button>
          </div>

        </div>

        {/* ── Stat Cards ── */}
        {loading ? (
          <Row gutter={[16, 16]}>
            {[1, 2, 3, 4].map(i => (
              <Col xs={12} md={6} key={i}>
                <Skeleton.Button active style={{ width: '100%', height: 120, borderRadius: 16 }} block />
              </Col>
            ))}
          </Row>
        ) : (
          <Row gutter={[16, 16]} style={{ alignItems: 'stretch' }}>
            <Col xs={12} md={6} style={{ display: 'flex' }}>
              <StatCard
                title="Days Present"
                value={daysPresent}
                subtitle={`Out of ${totalWorkingDays} days this week`}
                icon={Users}
                trend={12}
              />
            </Col>
            <Col xs={12} md={6} style={{ display: 'flex' }}>
              <StatCard
                title="Attendance Rate"
                value={`${attendanceRate}%`}
                subtitle="Above company average (85%)"
                icon={TrendingUp}
                trend={5}
              />
            </Col>
            <Col xs={12} md={6} style={{ display: 'flex' }}>
              <StatCard
                title="Total Hours"
                value={totalHours}
                subtitle={avgHoursPerDay}
                icon={Clock}
                trend={8}
              />
            </Col>
            <Col xs={12} md={6} style={{ display: 'flex' }}>
              <StatCard
                title="Incomplete"
                value={incompleteCount}
                subtitle="Missing check-out time"
                icon={AlertCircle}
                actionNeeded={incompleteCount > 0}
              />
            </Col>
          </Row>
        )}

        {/* ── Recent Attendance Table ── */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: `1px solid ${themeTokens.colors.borders}`,
          boxShadow: themeTokens.shadows.standard,
          overflow: 'hidden',
        }}>
          {/* card header */}
          <div style={{ padding: isMobile ? '14px 16px' : '16px 24px', borderBottom: `1px solid ${themeTokens.colors.borders}` }}>
            <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.heading }}>
              Weekly Attendance
            </Text>
            <Text style={{ display: 'block', fontSize: 12, color: themeTokens.colors.textTertiary, marginTop: 2 }}>
              {weekStart.format('MMM DD')} — {weekEnd.format('MMM DD, YYYY')}
            </Text>
          </div>

          {/* column headers — desktop only */}
          {!isMobile && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1.2fr 1.2fr 1.2fr 100px',
              padding: '10px 24px',
              background: themeTokens.colors.appBackground,
              borderBottom: `1px solid ${themeTokens.colors.borders}`,
            }}>
              {['DATE', 'CHECK IN', 'CHECK OUT', 'WORKING HOURS', 'STATUS'].map((h) => (
                <Text key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: themeTokens.colors.textTertiary }}>{h}</Text>
              ))}
            </div>
          )}

          {/* rows */}
          {loading ? (
            <div style={{ padding: '32px 24px' }}>
              {[1, 2, 3].map(i => <Skeleton key={i} active paragraph={{ rows: 1 }} style={{ marginBottom: 12 }} />)}
            </div>
          ) : recentAttendance.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <Empty description={`No records found for ${weekStart.format('MMM DD')} — ${weekEnd.format('MMM DD, YYYY')}`} />
            </div>
          ) : (
            recentAttendance.map((record, idx) => {
              const isLast = idx === recentAttendance.length - 1;
              const cfg = statusConfig(record.status, record);
              const checkInDisplay = record.checkInDisplay || toIST(record.checkIn);
              const checkOutDisplay = record.checkOutDisplay || toIST(record.checkOut);

              const rowDateKey = record?.date ? dayjs(record.date).format('YYYY-MM-DD') : null;
              const hasPendingRequest = Boolean(rowDateKey && pendingRegularizationDates.has(rowDateKey));
              const isAlreadyRegularized = Boolean(record?.manualCorrection || String(record?.tag || '').toLowerCase() === 'regularized');
              const quotaExhausted = regularizationQuota.remaining <= 0;
              const canRegularize = canSelfService && !hasPendingRequest && !isAlreadyRegularized && !quotaExhausted;

              const isOpen = logPopover.open && logPopover.attendanceId === record.id;
              const logContent = (
                <div style={{ minWidth: 200, maxWidth: 260 }}>
                  {logPopover.loading ? (
                    <div style={{ textAlign: 'center', padding: '12px 0' }}><Spin size="small" /></div>
                  ) : logPopover.logs.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 13 }}>No clock log entries found.</Text>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                      {logPopover.logs.map((log, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: log.type === 'clock_in' ? '#ECFDF5' : '#F3F4F6', color: log.type === 'clock_in' ? '#10B981' : '#6B7280' }}>
                            {log.type === 'clock_in' ? 'IN' : 'OUT'}
                          </span>
                          <Text style={{ fontSize: 13 }}>{log.display || dayjs(log.loggedAt).format('hh:mm A')}</Text>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );

              const actionsNode = (
                <>
                  <Popover content={logContent} title={<Text strong style={{ fontSize: 13 }}>Clock History</Text>} trigger="click" open={isOpen} onOpenChange={(open) => { if (!open) setLogPopover(prev => ({ ...prev, open: false })); }}>
                    <button onClick={() => fetchClockLogs(record.id)} style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Info size={13} color={themeTokens.colors.primary} />
                    </button>
                  </Popover>
                  {canSelfService && (
                    hasPendingRequest ? (
                      <Tooltip title="Regularization pending approval"><AlertTriangle size={13} color={themeTokens.colors.warning} /></Tooltip>
                    ) : (
                      <Dropdown trigger={['click']} menu={{ items: [{ key: 'regularize', label: 'Regularize', disabled: !canRegularize }], onClick: ({ key }) => { if (key === 'regularize' && canRegularize) openRegularizationModal(record); } }}>
                        <button style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <EllipsisVertical size={13} color={themeTokens.colors.textTertiary} />
                        </button>
                      </Dropdown>
                    )
                  )}
                </>
              );

              if (isMobile) {
                return (
                  <div key={record.id || idx} style={{
                    margin: `${idx === 0 ? 12 : 0}px 12px 10px`,
                    padding: '14px 16px',
                    background: '#fff',
                    border: `1px solid ${themeTokens.colors.borders}`,
                    borderRadius: 14,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    {/* Row 1: date left, status badge + actions right */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: themeTokens.colors.textPrimary, lineHeight: 1.3 }}>
                          {record.date ? dayjs(record.date).format('MMM DD, YYYY') : '-'}
                        </div>
                        <div style={{ fontSize: 12, color: themeTokens.colors.textTertiary, marginTop: 2 }}>
                          {record.date ? dayjs(record.date).format('dddd') : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {cfg.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>{actionsNode}</div>
                      </div>
                    </div>

                    {/* Row 2: check-in / check-out / hours pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Check In pill */}
                      <div style={{
                        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5,
                        background: checkInDisplay ? '#F0FDF4' : themeTokens.colors.appBackground,
                        border: `1px solid ${checkInDisplay ? '#BBF7D0' : themeTokens.colors.borders}`,
                        borderRadius: 10, padding: '7px 8px',
                      }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: checkInDisplay ? '#DCFCE7' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Clock size={10} color={checkInDisplay ? '#10B981' : '#9CA3AF'} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>IN</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: checkInDisplay ? '#111827' : '#9CA3AF', marginTop: 1, whiteSpace: 'nowrap' }}>
                            {checkInDisplay || '—'}
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div style={{ color: '#D1D5DB', fontSize: 12, flexShrink: 0 }}>→</div>

                      {/* Check Out pill */}
                      <div style={{
                        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5,
                        background: checkOutDisplay ? '#F8FAFC' : themeTokens.colors.appBackground,
                        border: `1px solid ${checkOutDisplay ? '#E2E8F0' : themeTokens.colors.borders}`,
                        borderRadius: 10, padding: '7px 8px',
                      }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Clock size={10} color={checkOutDisplay ? '#64748B' : '#9CA3AF'} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>OUT</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: checkOutDisplay ? '#111827' : '#9CA3AF', marginTop: 1, whiteSpace: 'nowrap' }}>
                            {checkOutDisplay || '—'}
                          </div>
                        </div>
                      </div>

                      {/* Hours */}
                      <div style={{
                        background: Number(record.workHours) > 0 ? '#EFF6FF' : themeTokens.colors.appBackground,
                        border: `1px solid ${Number(record.workHours) > 0 ? '#BFDBFE' : themeTokens.colors.borders}`,
                        borderRadius: 10, padding: '7px 8px', textAlign: 'center', minWidth: 44, flexShrink: 0,
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>HRS</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: Number(record.workHours) > 0 ? themeTokens.colors.primary : '#9CA3AF', marginTop: 1, whiteSpace: 'nowrap' }}>
                          {Number(record.workHours) > 0 ? `${Number(record.workHours).toFixed(1)}h` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={record.id || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1.2fr 1.2fr 1.2fr 100px',
                    alignItems: 'center',
                    padding: '14px 24px',
                    borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                    transition: 'background 0.15s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = themeTokens.colors.appBackground}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* DATE */}
                  <div>
                    <Text style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary, display: 'block' }}>
                      {record.date ? dayjs(record.date).format('MMM DD, YYYY') : '-'}
                    </Text>
                    <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>
                      {record.date ? dayjs(record.date).format('dddd') : ''}
                    </Text>
                  </div>
                  {/* CHECK IN */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {checkInDisplay ? (
                      <>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Clock size={11} color="#10B981" />
                        </div>
                        <Text style={{ fontSize: 13, color: themeTokens.colors.textPrimary, fontWeight: 600 }}>{checkInDisplay}</Text>
                      </>
                    ) : <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>—</Text>}
                  </div>
                  {/* CHECK OUT */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {checkOutDisplay ? (
                      <>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Clock size={11} color="#6B7280" />
                        </div>
                        <Text style={{ fontSize: 13, color: themeTokens.colors.textPrimary, fontWeight: 600 }}>{checkOutDisplay}</Text>
                      </>
                    ) : <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>—</Text>}
                  </div>
                  {/* WORKING HOURS */}
                  <Text style={{ fontSize: 13, fontWeight: 600, color: themeTokens.colors.primary }}>
                    {Number(record.workHours) > 0 ? `${Number(record.workHours).toFixed(2)}h` : '—'}
                  </Text>
                  {/* STATUS + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
                      {cfg.label}
                    </span>
                    {actionsNode}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Full Attendance Log ── (collapsible month view) */}
        {attendance.length > 10 && (
          <div style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${themeTokens.colors.borders}`,
            boxShadow: themeTokens.shadows.standard,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${themeTokens.colors.borders}` }}>
              <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.heading }}>
                Attendance Log — {selectedDate.format('MMMM YYYY')}
              </Text>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr 1fr 100px' : '1.4fr 1.2fr 1.2fr 1.2fr 100px',
              padding: '10px 24px',
              background: themeTokens.colors.appBackground,
              borderBottom: `1px solid ${themeTokens.colors.borders}`,
            }}>
              {(isMobile
                ? ['DATE', 'CHECK IN', 'CHECK OUT', 'STATUS']
                : ['DATE', 'CHECK IN', 'CHECK OUT', 'WORKING HOURS', 'STATUS']
              ).map((h) => (
                <Text key={h} style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: themeTokens.colors.textTertiary,
                }}>{h}</Text>
              ))}
            </div>

            {attendance.slice(10).map((record, idx) => {
              const cfg = statusConfig(record.status, record);
              // Raw checkIn/checkOut from API encode IST wall-clock as UTC ISO
              // strings. Format with timeZone:'UTC' to read the wall-clock as-is;
              // dayjs.format() would re-apply browser-local TZ and double-shift.
              const checkInDisplay = record.checkInDisplay || (record.checkIn
                ? new Date(record.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
                : null);
              const checkOutDisplay = record.checkOutDisplay || (record.checkOut
                ? new Date(record.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
                : null);
              const isLast = idx === attendance.length - 11;
              return (
                <div
                  key={record.id || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr 1fr 1fr 100px' : '1.4fr 1.2fr 1.2fr 1.2fr 100px',
                    alignItems: 'center',
                    padding: '14px 24px',
                    borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = themeTokens.colors.appBackground}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <Text style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary, display: 'block' }}>
                      {record.date ? dayjs(record.date).format('MMM DD, YYYY') : '-'}
                    </Text>
                    <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>
                      {record.date ? dayjs(record.date).format('dddd') : ''}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {checkInDisplay ? (
                      <><div style={{ width: 22, height: 22, borderRadius: 6, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={11} color="#10B981" />
                      </div><Text style={{ fontSize: 13, color: themeTokens.colors.textPrimary, fontWeight: 600 }}>{checkInDisplay}</Text></>
                    ) : <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>—</Text>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {checkOutDisplay ? (
                      <><div style={{ width: 22, height: 22, borderRadius: 6, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={11} color="#6B7280" />
                      </div><Text style={{ fontSize: 13, color: themeTokens.colors.textPrimary, fontWeight: 600 }}>{checkOutDisplay}</Text></>
                    ) : <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>—</Text>}
                  </div>
                  {!isMobile && (
                    <Text style={{ fontSize: 13, fontWeight: 600, color: themeTokens.colors.primary }}>
                      {Number(record.workHours) > 0 ? `${Number(record.workHours).toFixed(2)}h` : '—'}
                    </Text>
                  )}
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                    whiteSpace: 'nowrap', display: 'inline-block',
                  }}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}


        {/* ── Regularization Requests (employees only) ── */}
        {canSelfService && (
          <div style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${themeTokens.colors.borders}`,
            boxShadow: themeTokens.shadows.standard,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 24px',
              borderBottom: `1px solid ${themeTokens.colors.borders}`,
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: 12,
            }}>
              <div>
                <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.heading, display: 'block' }}>
                  Regularization Requests
                </Text>
                <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>
                  Quota: {regularizationQuota.used}/{regularizationQuota.limit} used &bull; {regularizationQuota.remaining} remaining
                </Text>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Select
                  value={regularizationStatus}
                  onChange={setRegularizationStatus}
                  style={{ width: isMobile ? '100%' : 160, height: 34 }}
                  options={[
                    { value: '', label: 'All Status' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'rejected', label: 'Rejected' },
                  ]}
                />
                <button
                  onClick={() => openRegularizationModal()}
                  disabled={regularizationQuota.remaining <= 0}
                  style={{
                    padding: '0 14px', height: 34, borderRadius: 8,
                    background: regularizationQuota.remaining <= 0 ? '#F3F4F6' : BTN_GRADIENT,
                    color: regularizationQuota.remaining <= 0 ? '#9CA3AF' : '#fff',
                    border: 'none', cursor: regularizationQuota.remaining <= 0 ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  + New Request
                </button>
              </div>
            </div>

            {/* column headers */}
            {!regularizationLoading && regularizations.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.6fr 1.6fr 2fr 100px 1.5fr',
                padding: '10px 24px',
                background: themeTokens.colors.appBackground,
                borderBottom: `1px solid ${themeTokens.colors.borders}`,
              }}>
                {['DATE', 'REQUESTED IN', 'REQUESTED OUT', 'REASON', 'STATUS', 'DECISION NOTE'].map((h, i) => (
                  <Text key={h} style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: themeTokens.colors.textTertiary,
                    textAlign: i === 4 ? 'center' : 'left',
                  }}>{h}</Text>
                ))}
              </div>
            )}

            {regularizationLoading ? (
              <div style={{ padding: '32px 24px' }}>
                <Skeleton active paragraph={{ rows: 2 }} />
              </div>
            ) : regularizations.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <Empty description="No regularization requests this month" />
              </div>
            ) : (
              regularizations.map((record, idx) => {
                const isLast = idx === regularizations.length - 1;
                const normalized = String(record.status || 'pending').toLowerCase();
                const statusCfg = {
                  pending: { color: '#F59E0B', bg: '#FFFBEB', border: '#F59E0B33' },
                  approved: { color: '#10B981', bg: '#ECFDF5', border: '#10B98133' },
                  rejected: { color: '#EF4444', bg: '#FEF2F2', border: '#EF444433' },
                }[normalized] || { color: '#6B7280', bg: '#F3F4F6', border: '#6B728033' };

                return (
                  <div
                    key={record.requestId || idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.6fr 1.6fr 2fr 100px 1.5fr',
                      alignItems: 'center',
                      padding: '14px 24px',
                      borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = themeTokens.colors.appBackground}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Text style={{ fontSize: 13, color: themeTokens.colors.textPrimary, fontWeight: 600 }}>
                      {record.attendanceDate ? dayjs(record.attendanceDate).format('MMM DD, YYYY') : '-'}
                    </Text>
                    <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary }}>
                      {record.requestedCheckInTime ? dayjs(record.requestedCheckInTime).format('MMM DD, hh:mm A') : '-'}
                    </Text>
                    <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary }}>
                      {record.requestedCheckOutTime ? dayjs(record.requestedCheckOutTime).format('MMM DD, hh:mm A') : '-'}
                    </Text>
                    <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {record.reason || '-'}
                    </Text>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`,
                      }}>{normalized}</span>
                    </div>
                    <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
                      {record.decisionNote || '-'}
                    </Text>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Regularization Modal ── */}
      <Modal
        title="Attendance Regularization Request"
        open={regularizationModalOpen}
        onCancel={() => setRegularizationModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
        maskClosable={false}
        zIndex={1400}
        style={{ maxHeight: '90vh' }}
        styles={{ body: { maxHeight: 'calc(90vh - 110px)', overflowY: 'auto' } }}
      >
        <Alert
          type={regularizationQuota.remaining > 0 ? 'info' : 'warning'}
          showIcon
          message={`Available requests this month: ${regularizationQuota.remaining}/${regularizationQuota.limit}`}
          description={`Used ${regularizationQuota.used} out of ${regularizationQuota.limit} allowed regularization requests.`}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
        <Form form={regularizationForm} layout="vertical" onFinish={handleSubmitRegularization}>
          <Form.Item name="attendanceDate" label="Attendance Date" rules={[{ required: true, message: 'Attendance date is required' }]}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="requestedCheckInTime" label="Requested Check In" rules={[{ required: true, message: 'Requested check-in time is required' }]}>
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
          </Form.Item>
          <Form.Item
            name="requestedCheckOutTime"
            label="Requested Check Out"
            rules={[
              { required: true, message: 'Requested check-out time is required' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const checkIn = getFieldValue('requestedCheckInTime');
                  if (!checkIn || !value || dayjs(value).isAfter(dayjs(checkIn))) return Promise.resolve();
                  return Promise.reject(new Error('Check-out time must be after check-in time'));
                }
              })
            ]}
          >
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason"
            rules={[
              { required: true, message: 'Reason is required' },
              { validator: (_, value) => (!value || String(value).trim().length >= 10) ? Promise.resolve() : Promise.reject(new Error('Reason must be at least 10 characters')) }
            ]}
          >
            <TextArea rows={4} placeholder="Biometric device was down" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRegularizationModalOpen(false)}>Cancel</Button>
            <Button
              htmlType="submit"
              loading={regularizationSubmitting}
              disabled={regularizationQuota.remaining <= 0}
              style={{
                background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600,
                opacity: regularizationQuota.remaining <= 0 ? 0.5 : 1
              }}
            >
              Submit Request
            </Button>
          </div>
        </Form>
      </Modal>
    </Layout>
  );
}
