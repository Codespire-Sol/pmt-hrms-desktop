import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Typography, Space, Button, Skeleton, Tag, Avatar, message, Grid, Select, Tooltip, Tabs, Segmented } from 'antd';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import {
  Users,
  Calendar,
  ShieldCheck,
  UserCog,
  Plane,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Building2,
  ChevronLeft,
  ChevronRight,
  Info,
  UserPlus,
  Lock,
  MapPin,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { dashboardAPI } from '../api/dashboard';
import { adminAPI } from '../api/admin';
import { attendanceAPI } from '../api/attendance';
import { employeeAPI } from '../api/employees';
import { leaveAPI } from '../api/leave';
import { hrAPI } from '../api/hr';
import Layout from '../components/layout/Layout';
import { themeTokens } from '../styles/theme';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;
const defaultTodayAttendance = {
  hasCheckedIn: false,
  hasCheckedOut: false,
  isCurrentlyIn: false,
  checkInTime: null,
  checkOutTime: null,
  status: 'not_checked_in',
  logs: [],
};

const normalizeTodayAttendance = (payload) => {
  const data = payload || {};
  const hasCheckedIn = Boolean(data.hasCheckedIn || data.checkInTime);
  const hasCheckedOut = Boolean(data.hasCheckedOut || data.checkOutTime);
  const logs = Array.isArray(data.logs) ? data.logs : [];
  // isCurrentlyIn: last log is clock_in, or fallback to old logic
  const isCurrentlyIn = data.isCurrentlyIn !== undefined
    ? data.isCurrentlyIn
    : (logs.length > 0 ? logs[logs.length - 1].type === 'clock_in' : (hasCheckedIn && !hasCheckedOut));
  // Prefer pre-formatted display strings from API (already in company timezone)
  // Fall back to deriving from logs[].display which is also pre-formatted
  const firstClockIn = logs.find(l => l.type === 'clock_in');
  const lastClockOut = [...logs].reverse().find(l => l.type === 'clock_out');
  return {
    hasCheckedIn: hasCheckedIn || logs.some(l => l.type === 'clock_in'),
    hasCheckedOut: hasCheckedOut,
    isCurrentlyIn,
    checkInTime: data.checkInTime || null,
    checkOutTime: data.checkOutTime || null,
    checkInTimeDisplay: data.checkInTimeDisplay || firstClockIn?.display || null,
    checkOutTimeDisplay: data.checkOutTimeDisplay || lastClockOut?.display || null,
    status: data.status || (hasCheckedOut ? 'checked_out' : hasCheckedIn ? 'checked_in' : 'not_checked_in'),
    logs,
  };
};

export default function Dashboard() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const navigate = useNavigate();
  const { user, isAdmin, isHR, isManager, isEmployee } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  // Today's attendance items for HR — fetched alongside the dashboard summary
  // and used to recompute KPI cards client-side. Keeps the dashboard counts
  // consistent with HR Operations even when the server's getHrDashboard API
  // returns stale/broken numbers (e.g. work_hours NULL → status flipped to
  // absent by the auto-absent scheduler).
  const [hrTodayItems, setHrTodayItems] = useState([]);
  const [hrEmployeeCount, setHrEmployeeCount] = useState(0);
  const [adminDashboard, setAdminDashboard] = useState(null);
  const [adminBranches, setAdminBranches] = useState([]);
  const [adminBranchFilter, setAdminBranchFilter] = useState('');
  const [selfTodayAttendance, setSelfTodayAttendance] = useState(defaultTodayAttendance);
  const [attendanceActionLoading, setAttendanceActionLoading] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(dayjs());
  const [calendarViewMode, setCalendarViewMode] = useState('month');
  const [loading, setLoading] = useState(true);
  const [monthAttendance, setMonthAttendance] = useState([]);
  const [pendingLeaveApprovals, setPendingLeaveApprovals] = useState([]);
  const [pendingRegularizations, setPendingRegularizations] = useState([]);
  const [pendingRegularizationCount, setPendingRegularizationCount] = useState(0);
  const [calendarHolidays, setCalendarHolidays] = useState([]);
  const [calendarBirthdays, setCalendarBirthdays] = useState([]);
  const [now, setNow] = useState(new Date());
  const [leaveActionLoading, setLeaveActionLoading] = useState({});
  const roleResolved = isAdmin || isHR || isManager || isEmployee;
  const standardCardStyle = {
    borderRadius: '12px',
    boxShadow: themeTokens.shadows.standard,
    border: '1px solid #e5e7eb'
  };

  // Measure calendar container height for holiday panel sync
  useEffect(() => {
    if (!roleResolved) return;
    setLoading(true);
    loadDashboard();
    if (isAdmin || isHR || isManager) loadPendingApprovals();
    if (isAdmin) {
      adminAPI.getBranches().then(res => {
        setAdminBranches(Array.isArray(res?.data) ? res.data : []);
      }).catch(() => {});
    }
  }, [roleResolved, isAdmin, isHR, isManager, isEmployee]);

  useEffect(() => {
    if (!roleResolved) return;
    let cancelled = false;
    const year = calendarViewDate.year();
    const branchId = isAdmin ? adminBranchFilter : (user?.branchId || undefined);
    const params = { year };
    if (branchId) params.branchId = branchId;
    setCalendarHolidays([]);
    setCalendarBirthdays([]);
    hrAPI.listHolidays(params).then(response => {
      if (cancelled) return;
      const rows = response?.data?.data || response?.data || [];
      setCalendarHolidays(Array.isArray(rows) ? rows : []);
      const bdays = response?.data?.birthdays || [];
      setCalendarBirthdays(Array.isArray(bdays) ? bdays : []);
    }).catch(() => {
      if (!cancelled) {
        setCalendarHolidays([]);
        setCalendarBirthdays([]);
      }
    });
    loadMonthAttendance();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleResolved, isAdmin, calendarViewDate.month(), calendarViewDate.year(), adminBranchFilter]);

  // ── Real-time: react to any broadcastDataRefresh() signal from other pages ──
  // Scope '*' catches all broadcasts (leave applied, attendance marked, etc.)
  useAutoRefresh(
    () => { if (roleResolved) loadMonthAttendance(); },
    { enabled: roleResolved, scope: '*', intervalMs: 30000,
      deps: [roleResolved, calendarViewDate.month(), calendarViewDate.year()] }
  );
  useAutoRefresh(
    () => { if (roleResolved) { loadDashboard(); if (isAdmin || isHR || isManager) loadPendingApprovals(); } },
    { enabled: roleResolved, scope: '*', intervalMs: 60000,
      deps: [roleResolved, isAdmin, isHR, isManager] }
  );

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  async function loadAdminDashboard(branchId) {
    try {
      // Use the dedicated admin dashboard API endpoint
      const response = await adminAPI.getDashboard(branchId ? { branchId } : undefined);
      const payload = response?.data || {};
      const data = payload?.data || payload || {};

      setAdminDashboard({
        overview: data.overview || {
          totalEmployees: 0,
          activeEmployees: 0,
          onboardingEmployees: 0,
          exitingEmployees: 0,
          totalHRs: 0,
          totalManagers: 0,
          departmentCount: 0,
          locationCount: 0
        },
        employeeGrowth: data.employeeGrowth || {
          thisMonth: 0,
          lastMonth: 0,
          changePercentage: 0,
          trend: 'neutral',
          monthlyBreakdown: []
        },
        attendance: data.attendance || {
          today: {
            present: 0,
            absent: 0,
            attendanceRate: 0
          }
        },
        leaves: data.leaves || {
          pending: 0,
          approvedThisMonth: 0,
          rejectedThisMonth: 0
        },
        onboarding: data.onboarding || {
          active: 0,
          completedThisMonth: 0
        },
        offboarding: data.offboarding || {
          active: 0,
          completedThisMonth: 0
        },
        systemActivity: data.systemActivity || {
          todayLogins: 0,
          activeUsers: 0,
          systemHealth: 'healthy'
        }
      });
    } catch (error) {
      console.error('Failed to load admin dashboard:', error);
      // Set empty data structure on error
      setAdminDashboard({
        overview: {
          totalEmployees: 0,
          activeEmployees: 0,
          onboardingEmployees: 0,
          exitingEmployees: 0,
          totalHRs: 0,
          totalManagers: 0,
          departmentCount: 0,
          locationCount: 0
        },
        employeeGrowth: {
          thisMonth: 0,
          lastMonth: 0,
          changePercentage: 0,
          trend: 'neutral'
        },
        attendance: {
          today: {
            present: 0,
            absent: 0,
            attendanceRate: 0
          }
        },
        leaves: {
          pending: 0,
          approvedThisMonth: 0,
          rejectedThisMonth: 0
        },
        onboarding: {
          active: 0,
          completedThisMonth: 0
        },
        offboarding: {
          active: 0,
          completedThisMonth: 0
        },
        systemActivity: {
          todayLogins: 0,
          activeUsers: 0,
          systemHealth: 'healthy'
        }
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard(branchId) {
    if (isAdmin) {
      await loadAdminDashboard(branchId !== undefined ? branchId : adminBranchFilter);
      // Also load employee dashboard data for admin's personal section
      try {
        const empResponse = await dashboardAPI.getEmployeeDashboard();
        const empData = empResponse.data?.data || empResponse.data;
        setDashboard(empData);
        await loadSelfTodayAttendance();
      } catch (_) { /* admin may not have employee record yet */ }
      return;
    }

    try {
      let response;
      if (isHR) {
        response = await dashboardAPI.getHRDashboard();
      } else if (isManager) {
        response = await dashboardAPI.getManagerDashboard();
      } else {
        response = await dashboardAPI.getEmployeeDashboard();
      }

      // Handle response structure { success: true, data: { ... } }
      const dashboardData = response.data?.data || response.data;
      setDashboard(dashboardData);
      await loadSelfTodayAttendance();

      // For HR: also fetch today's attendance items + employee master so the
      // KPI cards can be recomputed client-side using the same status
      // derivation as HR Operations. The server's getHrDashboard counts can
      // be stale (admin filter, work_hours NULL flips, etc) — this is the
      // frontend fallback for the same problem.
      if (isHR) {
        try {
          const todayStr = dayjs().format('YYYY-MM-DD');
          const [attRes, empRes] = await Promise.all([
            attendanceAPI.getTeamAttendance(null, { date: todayStr }),
            employeeAPI.getAll({ limit: 200 }),
          ]);
          const itemsRaw = Array.isArray(attRes?.data) ? attRes.data : [];
          const empData = empRes?.data || empRes || {};
          const empListRaw = empData?.items || empData?.employees || (Array.isArray(empData) ? empData : []);
          // Exclude exited / deleted employees — consistent with HR Operations
          // page. Keeps the Dashboard "Total Employees" KPI in sync with
          // what HR sees on /hr/operations.
          const inactiveStatuses = new Set(['exited', 'deleted']);
          const empList = empListRaw.filter(emp => {
            const s = String(emp.status || '').toLowerCase();
            return !inactiveStatuses.has(s);
          });
          // Also drop attendance rows for inactive employees so the Present
          // count doesn't include an exited employee's pre-exit clock-in.
          const activeEmpIds = new Set(empList.map(e => e.id));
          const items = itemsRaw.filter(r => {
            const empId = r.employee?.id || r.employeeId || r['employee.id'];
            return !empId || activeEmpIds.has(empId);
          });
          setHrTodayItems(items);
          setHrEmployeeCount(empList.length);
        } catch (e) {
          // Non-fatal — KPI cards will fall back to the server's counts.
          console.warn('Failed to load HR today attendance for KPI recompute:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setSelfTodayAttendance(defaultTodayAttendance);
    } finally {
      setLoading(false);
    }
  }

  async function loadSelfTodayAttendance() {
    if (!(isAdmin || isHR || isManager || isEmployee)) {
      setSelfTodayAttendance(defaultTodayAttendance);
      return;
    }

    try {
      const todayStatusResponse = await attendanceAPI.getTodayStatus();
      const todayStatusPayload = todayStatusResponse?.data?.data || todayStatusResponse?.data || todayStatusResponse || {};
      setSelfTodayAttendance(normalizeTodayAttendance(todayStatusPayload));
    } catch (todayStatusError) {
      console.error('Failed to load self attendance status:', todayStatusError);
      setSelfTodayAttendance(defaultTodayAttendance);
    }
  }

  async function loadPendingApprovals() {
    if (!isAdmin && !isHR && !isManager) return;
    try {
      const [leaveResponse, regularizationResponse] = await Promise.allSettled([
        leaveAPI.getPendingApprovals(),
        attendanceAPI.getPendingRegularizations({ status: 'pending', page: 1, limit: 10 }),
      ]);
      if (leaveResponse.status === 'fulfilled') {
        setPendingLeaveApprovals(leaveResponse.value?.data || []);
      }
      if (regularizationResponse.status === 'fulfilled') {
        const regData = regularizationResponse.value?.data;
        const items = regData?.items || [];
        const count = regData?.pagination?.total ?? items.length ?? 0;
        setPendingRegularizations(items);
        setPendingRegularizationCount(Number(count));
      }
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
    }
  }

  async function handleLeaveApprove(leaveId) {
    setLeaveActionLoading(prev => ({ ...prev, [leaveId + '_approve']: true }));
    try {
      await leaveAPI.approve(leaveId);
      message.success('Leave approved');
      loadPendingApprovals();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to approve');
    } finally {
      setLeaveActionLoading(prev => ({ ...prev, [leaveId + '_approve']: false }));
    }
  }

  async function handleLeaveReject(leaveId) {
    setLeaveActionLoading(prev => ({ ...prev, [leaveId + '_reject']: true }));
    try {
      await leaveAPI.reject(leaveId, 'Rejected by manager');
      message.success('Leave rejected');
      loadPendingApprovals();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to reject');
    } finally {
      setLeaveActionLoading(prev => ({ ...prev, [leaveId + '_reject']: false }));
    }
  }

  async function loadMonthAttendance() {
    if (!user?.id) return;
    try {
      const response = await attendanceAPI.getEmployeeAttendance(user.id, {
        month: calendarViewDate.month() + 1,
        year: calendarViewDate.year(),
      });
      setMonthAttendance(response.data || []);
    } catch (error) {
      console.error('Failed to load month attendance for calendar:', error);
    }
  }

  async function loadCalendarHolidays(branchId) {
    try {
      const params = { year: calendarViewDate.year() };
      if (branchId) params.branchId = branchId;
      else if (user?.branchId) params.branchId = user.branchId;
      const response = await hrAPI.listHolidays(params);
      const rows = response?.data?.data || response?.data || [];
      setCalendarHolidays(Array.isArray(rows) ? rows : []);
      const bdays = response?.data?.birthdays || [];
      setCalendarBirthdays(Array.isArray(bdays) ? bdays : []);
    } catch (error) {
      console.error('Failed to load calendar holidays:', error);
      setCalendarHolidays([]);
      setCalendarBirthdays([]);
    }
  }

  const formatTime = (dateValue) => {
    if (!dateValue) return '--';
    // Pre-formatted display strings from API are already in company timezone — return as-is
    if (typeof dateValue === 'string' && /^\d{1,2}:\d{2}\s*(am|pm)$/i.test(dateValue.trim())) {
      return dateValue.trim().toUpperCase();
    }
    // UTC ISO strings (with Z) parse correctly to local time in dayjs
    const parsed = dayjs(dateValue);
    return parsed.isValid() ? parsed.format('hh:mm A') : '--';
  };

  const handleAttendanceAction = async () => {
    if (!(isAdmin || isHR || isManager || isEmployee)) return;

    setAttendanceActionLoading(true);
    try {
      // Try to capture location; proceed silently if denied or unavailable
      let coords = null;
      if (navigator.geolocation) {
        coords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            () => resolve(null),
            { timeout: 5000, maximumAge: 0 }
          );
        });
      }

      if (!selfTodayAttendance.isCurrentlyIn) {
        await attendanceAPI.checkIn(coords);
        message.success('Clocked in successfully');
      } else {
        await attendanceAPI.checkOut(coords);
        message.success('Clocked out successfully');
      }
      await loadDashboard();
    } catch (error) {
      message.error(error?.message || 'Failed to update attendance');
    } finally {
      setAttendanceActionLoading(false);
    }
  };

  const ClockHistoryPopover = ({ logs, isMobile: isMob }) => {
    const [open, setOpen] = useState(false);
    const btnRef = useRef(null);
    if (!logs || logs.length === 0) return null;

    const content = (
      <div
        style={{
          width: isMob ? 'calc(100vw - 48px)' : 280,
          maxWidth: 320,
        }}
      >
        <div style={{
          fontWeight: 700, fontSize: 13, color: '#0f172a',
          marginBottom: 8, paddingBottom: 8,
          borderBottom: '1px solid #f1f5f9',
        }}>
          Today&apos;s Clock History
        </div>
        <div style={{
          maxHeight: 220,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 2,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {logs.map((log, i) => {
            const isIn = log.type === 'clock_in';
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                borderBottom: i < logs.length - 1 ? '1px solid #f8fafc' : 'none',
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isIn ? '#dcfce7' : '#fee2e2',
                  color: isIn ? '#16a34a' : '#dc2626',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {isIn ? '↑' : '↓'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isIn ? '#15803d' : '#dc2626' }}>
                    {isIn ? 'Clocked In' : 'Clocked Out'}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {log.display || (log.loggedAt ? dayjs(log.loggedAt).format('hh:mm A') : '--')}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: '#94a3b8',
                  background: '#f8fafc',
                  padding: '2px 6px',
                  borderRadius: 6,
                  border: '1px solid #f1f5f9',
                }}>
                  #{i + 1}
                </span>
              </div>
            );
          })}
        </div>
        {logs.length >= 2 && (() => {
          // Compute total from paired clock_in/clock_out
          let total = 0;
          for (let i = 0; i + 1 < logs.length; i += 2) {
            if (logs[i].type === 'clock_in' && logs[i + 1].type === 'clock_out') {
              total += dayjs(logs[i + 1].loggedAt).diff(dayjs(logs[i].loggedAt), 'minute');
            }
          }
          const h = Math.floor(total / 60);
          const m = total % 60;
          if (total <= 0) return null;
          return (
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: '1px solid #f1f5f9',
              fontSize: 12, fontWeight: 700,
              color: '#475569',
            }}>
              Total logged: {h > 0 ? `${h}h ` : ''}{m}m
            </div>
          );
        })()}
      </div>
    );

    return (
      <Tooltip
        title={content}
        trigger="click"
        open={open}
        onOpenChange={setOpen}
        placement={isMob ? 'bottomLeft' : 'rightTop'}
        overlayInnerStyle={{
          background: '#ffffff',
          color: '#0f172a',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          borderRadius: 12,
          padding: '12px 14px',
          border: '1px solid #e2e8f0',
        }}
        overlayStyle={{ maxWidth: isMob ? 'calc(100vw - 32px)' : 340 }}
        arrow={false}
        fresh
      >
        <button
          ref={btnRef}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            display: 'inline-flex',
            alignItems: 'center',
            color: '#6366f1',
            borderRadius: 6,
            transition: 'background 0.15s',
          }}
          title="View clock history"
          onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        >
          <Info size={15} />
        </button>
      </Tooltip>
    );
  };

  const KPICard = ({ title, value, subtitle, icon: Icon, onClick }) => (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${themeTokens.colors.borders}`,
        boxShadow: themeTokens.shadows.standard,
        padding: '20px 22px',
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = themeTokens.shadows.hover; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = themeTokens.shadows.standard; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Title level={3} style={{
            margin: '0 0 4px', fontSize: 32, fontWeight: 800,
            lineHeight: 1.1, color: themeTokens.colors.heading,
          }}>{value}</Title>
          <Text style={{
            fontSize: 13, fontWeight: 600,
            color: themeTokens.colors.textPrimary, display: 'block', marginBottom: 2,
          }}>{title}</Text>
          {subtitle && (
            <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>{subtitle}</Text>
          )}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: '#E3EAFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={themeTokens.colors.primary} strokeWidth={2} />
        </div>
      </div>
    </div>
  );

  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    return new Date(dateValue).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatLeaveValue = (value) => {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed)) return '0';
    return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2).replace(/\.?0+$/, '');
  };

  const managerPendingLeaves = dashboard?.leaves?.pending || [];
  const managerAttendanceToday = dashboard?.attendance?.today || [];
  const managerOnboarding = dashboard?.onboarding || [];
  const managerOffboarding = dashboard?.offboarding || [];
  const isClockOutAction = selfTodayAttendance.isCurrentlyIn;

  const employeeProfile = dashboard?.profile || {};
  const employeeAttendanceToday = dashboard?.attendance?.today || {};
  const employeeAttendanceMonth = dashboard?.attendance?.thisMonth || {};
  const employeeLeaveCards = dashboard?.leaves?.balance?.cards || {};
  const employeeRecentLeaves = dashboard?.leaves?.recent || [];

  const getLeaveEmployeeName = (leave) => {
    const nestedEmployee = leave?.employee || {};
    const directName = nestedEmployee.name || leave?.employeeName;
    if (directName) return directName;

    const firstName = nestedEmployee.firstName || leave?.['employee.firstName'] || '';
    const lastName = nestedEmployee.lastName || leave?.['employee.lastName'] || '';
    return `${firstName} ${lastName}`.trim() || 'Employee';
  };

  const getLeaveEmployeeCode = (leave) => {
    const nestedEmployee = leave?.employee || {};
    return nestedEmployee.employeeId || leave?.['employee.employeeId'] || leave?.employeeCode || '';
  };

  const pendingApprovals = pendingLeaveApprovals;
  // Use dedicated monthly holidays fetch for the calendar (shows holidays for any month navigated to)
  const holidayDateMap = calendarHolidays.reduce((acc, holiday) => {
    const parsedDate = dayjs(holiday?.date);
    if (!parsedDate.isValid()) return acc;
    acc[parsedDate.format('YYYY-MM-DD')] = holiday;
    return acc;
  }, {});
  // Birthday map keyed by "MM-DD" so the same record matches every year.
  const birthdayDateMap = calendarBirthdays.reduce((acc, b) => {
    if (!b || !b.month || !b.day) return acc;
    const key = `${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`;
    (acc[key] = acc[key] || []).push(b);
    return acc;
  }, {});
  const presentDateSet = new Set();
  const absentDateSet = new Set();
  const halfDayDateSet = new Set();
  const onLeaveDateSet = new Set();

  if (monthAttendance.length > 0) {
    // Build present/absent/half-day sets from the fetched monthly records
    monthAttendance.forEach((record) => {
      const dateStr = String(record.date || '').substring(0, 10);
      if (!dateStr) return;
      const recordDay = dayjs(dateStr);
      if (!recordDay.isValid()) return;
      const isWeekendDay = recordDay.day() === 0 || recordDay.day() === 6;
      const isHolidayDay = Boolean(holidayDateMap[dateStr]);
      const isPastOrToday = !recordDay.isAfter(dayjs(), 'day');
      const statusNorm = (record.status || '').toLowerCase();
      const isPresent =
        Boolean(record.checkIn) ||
        statusNorm === 'present' ||
        statusNorm === 'checked in' ||
        statusNorm === 'checked out' ||
        statusNorm === 'late';
      const isHalfDay = statusNorm === 'half_day' || statusNorm === 'half day';
      const isOnLeave = statusNorm === 'on_leave' || statusNorm === 'on leave';
      if (isPresent) {
        presentDateSet.add(dateStr);
      } else if (isHalfDay) {
        halfDayDateSet.add(dateStr);
      } else if (isOnLeave) {
        onLeaveDateSet.add(dateStr);
      } else if (isPastOrToday && !isWeekendDay && !isHolidayDay) {
        absentDateSet.add(dateStr);
      }
    });
  } else {
    // Fallback: today-only logic (admin or while monthly data is still loading)
    const addPresentDate = (dateValue) => {
      const parsedDate = dayjs(dateValue);
      if (parsedDate.isValid()) presentDateSet.add(parsedDate.format('YYYY-MM-DD'));
    };
    if (isEmployee || isAdmin) {
      addPresentDate(employeeAttendanceToday?.checkInTime || employeeAttendanceToday?.checkInTimeUtc);
    }
    if (isManager) {
      managerAttendanceToday.forEach((entry) => {
        addPresentDate(entry?.checkInTime || entry?.checkInTimeUtc);
      });
    }
    if (isHR && (dashboard?.attendance?.today?.present || 0) > 0) {
      addPresentDate(now);
    }
    if (isAdmin && (adminDashboard?.attendance?.today?.present || 0) > 0) {
      addPresentDate(now);
    }
  }

  const renderCustomCalendar = (compact = false) => {
    const year = calendarViewDate.year();
    const month = calendarViewDate.month();
    const firstDay = dayjs(new Date(year, month, 1));
    const daysInMonth = firstDay.daysInMonth();
    const startDayOfWeek = firstDay.day(); // 0=Sun
    const today = dayjs();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) { days.push(null); }
    for (let d = 1; d <= daysInMonth; d++) { days.push(dayjs(new Date(year, month, d))); }

    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // View-aware navigation
    const goToPrev = () => {
      if (calendarViewMode === 'month') setCalendarViewDate(calendarViewDate.subtract(1, 'month'));
      else if (calendarViewMode === 'week') setCalendarViewDate(calendarViewDate.subtract(1, 'week'));
      else setCalendarViewDate(calendarViewDate.subtract(1, 'day'));
    };
    const goToNext = () => {
      if (calendarViewMode === 'month') setCalendarViewDate(calendarViewDate.add(1, 'month'));
      else if (calendarViewMode === 'week') setCalendarViewDate(calendarViewDate.add(1, 'week'));
      else setCalendarViewDate(calendarViewDate.add(1, 'day'));
    };
    const goToToday = () => setCalendarViewDate(dayjs());

    const currentYear = today.year();
    const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

    // Week view date range
    const weekStart = calendarViewDate.startOf('week'); // Sunday
    const weekEnd = calendarViewDate.endOf('week'); // Saturday

    // ── Reusable helper: get status props for any day ──
    const getDayStatusProps = (day) => {
      const dateKey = day.format('YYYY-MM-DD');
      const isWeekend = day.day() === 0 || day.day() === 6;
      const isDayToday = day.isSame(today, 'day');
      const holiday = holidayDateMap[dateKey];
      const isHoliday = Boolean(holiday);
      const birthdays = birthdayDateMap[day.format('MM-DD')] || [];
      const isBirthday = birthdays.length > 0;
      const isPresent = presentDateSet.has(dateKey);
      const isHalfDay = !isPresent && halfDayDateSet.has(dateKey);
      const isOnLeave = !isPresent && !isHalfDay && onLeaveDateSet.has(dateKey);
      const isAbsent = !isPresent && !isHalfDay && !isOnLeave && absentDateSet.has(dateKey);

      let bg = 'transparent';
      let textColor = isWeekend ? '#818cf8' : '#334155';
      let borderStyle = '1.5px solid transparent';
      let shadow = 'none';

      if (isDayToday) {
        bg = `linear-gradient(135deg, ${themeTokens.colors.primary} 0%, #4f8aff 100%)`;
        textColor = '#ffffff';
        borderStyle = 'none';
        shadow = '0 4px 12px rgba(18,104,255,.35)';
      } else if (isHoliday) {
        bg = 'linear-gradient(135deg,#fef3c7,#fde68a)';
        textColor = '#92400e';
        borderStyle = '1.5px solid #fcd34d';
      } else if (isWeekend) {
        bg = '#f5f3ff';
        borderStyle = '1.5px solid #e0e7ff';
      } else if (isHalfDay) {
        bg = 'linear-gradient(135deg,#fff7ed,#ffedd5)';
        borderStyle = '1.5px solid #fed7aa';
      } else if (isOnLeave) {
        bg = 'linear-gradient(135deg,#eff6ff,#dbeafe)';
        borderStyle = '1.5px solid #93c5fd';
      } else if (isPresent) {
        bg = 'linear-gradient(135deg,#f0fdf4,#dcfce7)';
        borderStyle = '1.5px solid #bbf7d0';
      } else if (isAbsent) {
        bg = 'linear-gradient(135deg,#fff1f2,#ffe4e6)';
        borderStyle = '1.5px solid #fecdd3';
      }

      let statusLabel = null;
      let statusColor = '#94a3b8';
      if (isPresent) { statusLabel = 'Present'; statusColor = '#10b981'; }
      else if (isHalfDay) { statusLabel = 'Half Day'; statusColor = '#f97316'; }
      else if (isOnLeave) { statusLabel = 'On Leave'; statusColor = '#3b82f6'; }
      else if (isAbsent) { statusLabel = 'Absent'; statusColor = '#f43f5e'; }

      return { dateKey, isWeekend, isToday: isDayToday, holiday, isHoliday, birthdays, isBirthday, isPresent, isHalfDay, isOnLeave, isAbsent, bg, textColor, borderStyle, shadow, statusLabel, statusColor };
    };

    // ── Week View ──
    const renderWeekView = () => {
      const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {weekDays.map((day) => {
            const p = getDayStatusProps(day);
            return (
              <div
                key={p.dateKey}
                onClick={() => { setCalendarViewDate(day); setCalendarViewMode('day'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 12,
                  background: p.isToday ? `linear-gradient(135deg, ${themeTokens.colors.primary} 0%, #4f8aff 100%)` : '#fafbfc',
                  border: p.isToday ? 'none' : '1.5px solid #f1f5f9',
                  boxShadow: p.isToday ? '0 4px 12px rgba(18,104,255,.25)' : 'none',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { if (!p.isToday) { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
                onMouseLeave={(e) => { if (!p.isToday) { e.currentTarget.style.background = '#fafbfc'; e.currentTarget.style.borderColor = '#f1f5f9'; } }}
              >
                {/* Date square */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: p.isToday ? 'rgba(255,255,255,0.2)' : p.bg,
                  border: p.isToday ? '1.5px solid rgba(255,255,255,0.3)' : p.borderStyle,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1, color: p.isToday ? '#ffffff' : p.textColor }}>{day.date()}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, lineHeight: 1, marginTop: 2, color: p.isToday ? 'rgba(255,255,255,0.7)' : (p.isWeekend ? '#a5b4fc' : '#94a3b8'), textTransform: 'uppercase', letterSpacing: '0.05em' }}>{day.format('ddd')}</span>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {p.isHoliday && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: p.isToday ? 'rgba(255,255,255,0.9)' : '#92400e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.holiday.name}</div>
                  )}
                  {p.isWeekend && !p.isHoliday && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: p.isToday ? 'rgba(255,255,255,0.7)' : '#818cf8' }}>Weekend</div>
                  )}
                  {!p.isWeekend && !p.isHoliday && !p.statusLabel && (
                    <div style={{ fontSize: 11, color: p.isToday ? 'rgba(255,255,255,0.6)' : '#cbd5e1' }}>—</div>
                  )}
                </div>
                {/* Attendance pill */}
                {p.statusLabel && (
                  <div style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                    background: p.isToday ? 'rgba(255,255,255,0.2)' : `${p.statusColor}12`,
                    color: p.isToday ? '#ffffff' : p.statusColor,
                    border: p.isToday ? '1px solid rgba(255,255,255,0.3)' : `1px solid ${p.statusColor}30`,
                  }}>{p.statusLabel}</div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    // ── Day View ──
    const renderDayView = () => {
      const day = calendarViewDate;
      const p = getDayStatusProps(day);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          {/* Large date display */}
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: p.isToday ? `linear-gradient(135deg, ${themeTokens.colors.primary} 0%, #4f8aff 100%)` : (p.bg !== 'transparent' ? p.bg : '#f8fafc'),
            border: p.isToday ? 'none' : (p.borderStyle !== '1.5px solid transparent' ? p.borderStyle : '1.5px solid #e2e8f0'),
            boxShadow: p.isToday ? '0 8px 24px rgba(18,104,255,.3)' : '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: p.isToday ? '#ffffff' : p.textColor }}>{day.date()}</span>
            <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, marginTop: 4, color: p.isToday ? 'rgba(255,255,255,0.7)' : (p.isWeekend ? '#a5b4fc' : '#94a3b8'), textTransform: 'uppercase', letterSpacing: '0.06em' }}>{day.format('ddd')}</span>
          </div>
          {/* Full date text */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>{day.format('dddd')}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', marginTop: 2 }}>{day.format('MMMM D, YYYY')}</div>
          </div>
          {/* Info cards */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.isHoliday && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1.5px solid #fcd34d' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Holiday</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>{p.holiday.name}</div>
                {p.holiday.type && <div style={{ fontSize: 11, fontWeight: 500, color: '#92400e', marginTop: 2 }}>{p.holiday.type}</div>}
              </div>
            )}
            {p.isWeekend && !p.isHoliday && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: '#f5f3ff', border: '1.5px solid #e0e7ff', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>Weekend</div>
              </div>
            )}
            {p.statusLabel && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: `${p.statusColor}08`, border: `1.5px solid ${p.statusColor}25` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: p.statusColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Attendance</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.isPresent && (
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(16,185,129,.35)' }}>
                      <svg width="11" height="11" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  )}
                  {p.isHalfDay && (
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#fb923c)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(249,115,22,.35)', fontSize: 11, fontWeight: 800, color: '#fff' }}>½</span>
                  )}
                  {p.isAbsent && (
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#f43f5e,#fb7185)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(244,63,94,.35)' }}>
                      <svg width="11" height="11" viewBox="0 0 8 8" fill="none"><path d="M2 2L6 6M6 2L2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </span>
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700, color: p.statusColor }}>{p.statusLabel}</span>
                </div>
              </div>
            )}
            {!p.isWeekend && !p.isHoliday && !p.statusLabel && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: '#f8fafc', border: '1.5px solid #f1f5f9', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#cbd5e1' }}>No attendance data</div>
              </div>
            )}
          </div>
          {/* Back to month link */}
          <button
            onClick={() => setCalendarViewMode('month')}
            style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 8px', textDecoration: 'underline', textUnderlineOffset: 2 }}
          >
            Back to Month View
          </button>
        </div>
      );
    };

    // Legend items definition
    const legendItems = [
      ...[
        {
          key: 'present',
          icon: (
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(16,185,129,.35)', flexShrink: 0 }}>
              <svg width="9" height="9" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
          ),
          label: 'Present', labelColor: '#10b981'
        },
        {
          key: 'halfday',
          icon: (
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#fb923c)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(249,115,22,.35)', flexShrink: 0, fontSize: 9, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
              ½
            </span>
          ),
          label: 'Half Day', labelColor: '#f97316'
        },
        {
          key: 'absent',
          icon: (
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,#f43f5e,#fb7185)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(244,63,94,.35)', flexShrink: 0 }}>
              <svg width="9" height="9" viewBox="0 0 8 8" fill="none"><path d="M2 2L6 6M6 2L2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </span>
          ),
          label: 'Absent', labelColor: '#f43f5e'
        },
      ],
      {
        key: 'holiday',
        icon: (
          <span style={{ width: 18, height: 18, borderRadius: 5, background: '#fef3c7', border: '1.5px solid #fcd34d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'block' }} />
          </span>
        ),
        label: 'Holiday', labelColor: '#92400e'
      },
      {
        key: 'weekend',
        icon: (
          <span style={{ width: 18, height: 18, borderRadius: 5, background: '#eef2ff', border: '1.5px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#6366f1', opacity: 0.45, display: 'block' }} />
          </span>
        ),
        label: 'Weekend', labelColor: '#6366f1'
      },
    ];

    // ── Figma-style calendar return ──
    return (
      <div style={{ fontFamily: 'inherit' }}>
        {/* ── Blue Header Bar ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)',
          borderRadius: '16px 16px 0 0',
          padding: compact ? '10px 14px' : '12px 16px',
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          alignItems: compact ? 'stretch' : 'center',
          justifyContent: compact ? undefined : 'space-between',
          gap: compact ? 8 : 8,
        }}>
          {/* Title: icon + month/year */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <Calendar size={14} color="rgba(255,255,255,0.85)" style={{ flexShrink: 0 }} />
            {calendarViewMode === 'month' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                  {MONTH_NAMES[month]}
                </span>
                <Select
                  value={year}
                  onChange={(val) => setCalendarViewDate(calendarViewDate.year(val))}
                  size="small"
                  variant="borderless"
                  style={{ fontWeight: 700, color: '#ffffff', fontSize: 15, minWidth: 64 }}
                  popupStyle={{ borderRadius: 10, minWidth: 80 }}
                  options={yearOptions.map(y => ({ value: y, label: String(y) }))}
                  suffixIcon={<span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>▾</span>}
                />
              </div>
            )}
            {calendarViewMode === 'week' && (
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap' }}>
                {`${weekStart.format('MMM D')} – ${weekEnd.format('MMM D, YYYY')}`}
              </span>
            )}
            {calendarViewMode === 'day' && (
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap' }}>
                {calendarViewDate.format('ddd, MMM D, YYYY')}
              </span>
            )}
          </div>
          {/* Controls: view tabs + Today + arrows */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'space-between' : 'flex-end', gap: 6, ...(compact ? {} : { flexShrink: 0 }) }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.12)', borderRadius: 7, padding: 2, gap: 1 }}>
              {['month', 'week', 'day'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCalendarViewMode(mode)}
                  style={{
                    padding: '4px 11px', borderRadius: 5, border: 'none',
                    background: calendarViewMode === mode ? 'rgba(255,255,255,0.25)' : 'transparent',
                    color: '#ffffff', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={goToToday}
                style={{
                  padding: '4px 12px', borderRadius: 6,
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  background: 'transparent', color: '#ffffff',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Today
              </button>
              <button onClick={goToPrev} style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.08)', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ChevronLeft size={13} />
              </button>
              <button onClick={goToNext} style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.08)', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Month view ── */}
        {calendarViewMode === 'month' && (() => {
          const monthHolidayCount = days.filter(d => d && holidayDateMap[d.format('YYYY-MM-DD')]).length;
          return (
          <div style={{ padding: isMobile ? '8px 6px 8px' : '12px 16px 12px' }}>
            {/* Day-of-week header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 2 : 4, marginBottom: isMobile ? 4 : 8 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <div key={d} style={{
                  textAlign: 'center',
                  fontSize: isMobile ? 10 : 12,
                  fontWeight: 600,
                  color: i === 0 ? '#1368FF' : i === 6 ? '#1368FF' : '#94a3b8',
                  padding: isMobile ? '4px 0' : '6px 0',
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isMobile ? 2 : 4 }}>
              {days.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} style={{ aspectRatio: '1 / 1' }} />;
                const p = getDayStatusProps(day);
                const isFutureDay = day.isAfter(today, 'day');

                let cellBg = '#f1f3f8';
                let cellColor = '#1E2875';
                let cellBorder = '1px solid #e8eaef';
                let cellShadow = 'none';

                if (p.isToday) {
                  cellBg = 'linear-gradient(160deg, #1368FF 0%, #1E2875 100%)';
                  cellColor = '#ffffff';
                  cellBorder = '1px solid transparent';
                  cellShadow = '0 4px 12px rgba(19,104,255,0.35)';
                } else if (p.isHoliday) {
                  cellBg = 'linear-gradient(160deg, #f59e0b 0%, #fbbf24 100%)';
                  cellColor = '#ffffff';
                  cellBorder = '1px solid transparent';
                } else if (p.isWeekend) {
                  cellBg = '#e8eeff';
                  cellColor = '#1368FF';
                  cellBorder = '1px solid #dde6ff';
                } else if (p.isPresent) {
                  cellBg = '#f0fdf4';
                  cellColor = '#059669';
                  cellBorder = '1px solid #d1fae5';
                } else if (p.isHalfDay) {
                  cellBg = '#fff7ed';
                  cellColor = '#ea580c';
                  cellBorder = '1px solid #fed7aa';
                } else if (p.isAbsent) {
                  cellBg = '#fff1f2';
                  cellColor = '#e11d48';
                  cellBorder = '1px solid #fecdd3';
                } else if (isFutureDay) {
                  cellColor = '#a0a8b8';
                }

                return (
                  <div
                    key={p.dateKey}
                    title={
                      p.isBirthday
                        ? `🎂 ${p.birthdays.map(b => b.name.trim()).join(', ')}${p.isHoliday ? ` — ${p.holiday.name}` : ''}`
                        : (p.isHoliday ? p.holiday.name : p.statusLabel || undefined)
                    }
                    onClick={() => { setCalendarViewDate(day); setCalendarViewMode('day'); }}
                    style={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      borderRadius: isMobile ? 8 : 10,
                      background: cellBg,
                      border: cellBorder,
                      boxShadow: cellShadow,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      if (!p.isToday && !p.isHoliday) {
                        e.currentTarget.style.background = '#e0e7ff';
                        e.currentTarget.style.borderColor = '#c7d2fe';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!p.isToday && !p.isHoliday) {
                        e.currentTarget.style.background = cellBg;
                        e.currentTarget.style.borderColor = cellBorder.includes('transparent') ? 'transparent' : cellBorder.split(' ').pop();
                      }
                    }}
                  >
                    <span style={{
                      fontSize: isMobile ? 12 : 14,
                      fontWeight: p.isToday || p.isHoliday ? 700 : 500,
                      color: cellColor,
                      lineHeight: 1,
                    }}>
                      {day.date()}
                    </span>

                    {p.isHoliday && !p.isToday && (
                      <span style={{
                        fontSize: isMobile ? 5 : 7,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.9)',
                        maxWidth: '88%',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                      }}>
                        {p.holiday.name}
                      </span>
                    )}

                    {p.isToday && p.isHoliday && (
                      <span style={{
                        position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                        width: 4, height: 4, borderRadius: '50%',
                        background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.7)',
                      }} />
                    )}

                    {!p.isToday && !p.isHoliday && p.isPresent && (
                      <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#10b981' }} />
                    )}
                    {!p.isToday && !p.isHoliday && p.isAbsent && (
                      <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#f43f5e' }} />
                    )}
                    {!p.isToday && !p.isHoliday && p.isHalfDay && (
                      <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#f97316' }} />
                    )}
                    {!p.isToday && !p.isHoliday && p.isOnLeave && (
                      <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#3b82f6' }} />
                    )}
                    {p.isBirthday && (() => {
                      const firstName = (p.birthdays[0]?.name || '').trim().split(/\s+/)[0] || '';
                      const extra = p.birthdays.length - 1;
                      const label = extra > 0 ? `🎂 ${firstName} +${extra}` : `🎂 ${firstName}`;
                      return (
                        <span style={{
                          position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                          fontSize: isMobile ? 7 : 9, fontWeight: 600,
                          color: p.isHoliday ? 'rgba(255,255,255,0.95)' : '#be185d',
                          maxWidth: '92%',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          lineHeight: 1, pointerEvents: 'none',
                        }}>{label}</span>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{
              marginTop: 10, paddingTop: 10,
              borderTop: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, background: '#1368FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                    {today.date()}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Today</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fbbf24', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Holiday</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, background: '#e8eeff', border: '1px solid #dde6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#1368FF' }}>
                    8
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Weekend</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 12, lineHeight: 1 }}>🎂</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Birthday</span>
                </div>
              </div>
              {monthHolidayCount > 0 && (
                <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={12} color="#94a3b8" />
                  {monthHolidayCount} {monthHolidayCount === 1 ? 'event' : 'events'} this month
                </span>
              )}
            </div>
          </div>
          );
        })()}

        {calendarViewMode === 'week' && (<div style={{ padding: '10px 12px' }}>{renderWeekView()}</div>)}
        {calendarViewMode === 'day' && (<div style={{ padding: '10px 12px' }}>{renderDayView()}</div>)}
      </div>
    );
  };

  const welcomeSubtitle = isAdmin
    ? 'Overview of workforce and system health'
    : isHR
      ? "Here's what's happening with your team today."
      : isManager
        ? "Here's your team pulse for today."
        : 'Track attendance, leave balance, and upcoming holidays.';

  // ── Admin bar-chart: solid #1368FF bars, responsive ──
  const AdminBarChart = ({ monthlyBreakdown = [] }) => {
    const bars = monthlyBreakdown.length > 0 ? monthlyBreakdown : [];
    const maxVal = Math.max(...bars.map(b => b.count), 1);
    const CHART_H = 180;
    // Y-axis: 5 evenly spaced steps
    const yStepCount = 5;
    const niceMax = Math.ceil(maxVal / yStepCount) * yStepCount || yStepCount;
    const ySteps = Array.from({ length: yStepCount + 1 }, (_, i) => Math.round((niceMax / yStepCount) * i));

    return (
      <div style={{ width: '100%', userSelect: 'none' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {/* Y-axis labels */}
          <div style={{
            display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between',
            paddingRight: 8, height: CHART_H, flexShrink: 0, width: 28,
          }}>
            {ySteps.map((v) => (
              <span key={v} style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, lineHeight: 1, textAlign: 'right' }}>{v}</span>
            ))}
          </div>

          {/* Chart area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', height: CHART_H }}>
              {/* Grid lines */}
              {ySteps.map((v, i) => (
                <div key={v} style={{
                  position: 'absolute', left: 0, right: 0,
                  bottom: Math.round((i / yStepCount) * CHART_H),
                  borderBottom: i === 0 ? '1px solid #e5e7eb' : '1px dashed #f0f0f0',
                  pointerEvents: 'none',
                }} />
              ))}

              {/* Bars */}
              <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', position: 'relative', zIndex: 1, gap: 4, paddingLeft: 4, paddingRight: 4 }}>
                {bars.map((b) => {
                  const hasValue = b.count > 0;
                  const barH = hasValue ? Math.max(4, Math.round((b.count / niceMax) * CHART_H)) : 0;
                  return (
                    <div key={b.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', flex: 1, minWidth: 0 }}>
                      {hasValue && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#1368FF', marginBottom: 2, lineHeight: 1 }}>
                          {b.count}
                        </span>
                      )}
                      <div style={{
                        width: '70%', maxWidth: 28, minWidth: 12,
                        height: barH,
                        background: '#1368FF',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-axis labels */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6, paddingLeft: 4, paddingRight: 4 }}>
              {bars.map((b) => (
                <div key={b.month} style={{ flex: 1, minWidth: 0, textAlign: 'center', overflow: 'hidden' }}>
                  <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Attendance donut: full circle gauge matching Figma ──
  const AttendanceDonut = ({ present, absent }) => {
    const total = present + absent;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    const SIZE = 200;
    const cx = SIZE / 2, cy = SIZE / 2;
    const R = 78, SW = 16;
    const circumference = 2 * Math.PI * R;
    const fillLength = (rate / 100) * circumference;
    const gapLength = circumference - fillLength;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {/* Donut SVG — full circle */}
        <div style={{ width: '100%', maxWidth: 200, position: 'relative' }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ display: 'block', transform: 'rotate(-90deg)' }}>
            <defs>
              <linearGradient id="donutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7eb8ff" />
                <stop offset="100%" stopColor="#1268ff" />
              </linearGradient>
            </defs>
            {/* Track (background ring) */}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e8f0fe" strokeWidth={SW} />
            {/* Fill (progress ring) */}
            {rate > 0 && (
              <circle cx={cx} cy={cy} r={R} fill="none"
                stroke="url(#donutGradient)" strokeWidth={SW}
                strokeDasharray={`${fillLength} ${gapLength}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            )}
          </svg>
          {/* Centered text overlay */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: '-1px',
              background: 'linear-gradient(180deg, #1E2875 0%, #1368FF 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {rate}%
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b8ab8', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 4 }}>
              Present
            </span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 24, marginTop: 16, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: themeTokens.colors.primary, flexShrink: 0 }} />
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{present} Present</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e5e7eb', border: '1.5px solid #d1d5db', flexShrink: 0 }} />
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{absent} Absent</Text>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Layout>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Skeleton active paragraph={{ rows: 2 }} />
          <Row gutter={[16, 16]}>
            {[1, 2, 3, 4].map(i => (
              <Col xs={24} sm={12} md={6} key={i}>
                <Skeleton.Button active style={{ width: '100%', height: '120px', borderRadius: '12px' }} />
              </Col>
            ))}
          </Row>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Space>
      </Layout>
    );
  }

  return (
    <Layout>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* ── Dashboard Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>
              {(isAdmin || isHR || isManager) && (user?.firstName || user?.name)
                ? `Welcome, ${user.firstName || user.name.split(' ')[0]}`
                : 'Dashboard'}
            </Title>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              {welcomeSubtitle}
            </Text>
          </div>
          <div style={{ background: '#ffffff', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: themeTokens.shadows.subtle }}>
            <Space align="start">
              <Calendar size={18} color={themeTokens.colors.primary} style={{ marginTop: '2px' }} />
              <div style={{ lineHeight: 1.2 }}>
                <Text strong style={{ display: 'block' }}>
                  {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                </Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' })} IST
                </Text>
              </div>
            </Space>
          </div>
        </div>

        {/* Admin Global Branch Filter */}
        {isAdmin && adminBranches.length > 0 && (
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: themeTokens.shadows.subtle,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={16} color={themeTokens.colors.textSecondary} />
              <Text type="secondary" style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                Viewing data for:
              </Text>
            </div>
            <Select
              allowClear
              placeholder="All Branches"
              value={adminBranchFilter || undefined}
              onChange={(val) => {
                const newVal = val || '';
                setAdminBranchFilter(newVal);
                setLoading(true);
                loadDashboard(newVal);
              }}
              style={{ minWidth: 220, flex: 1, maxWidth: 320 }}
              options={adminBranches.map(b => ({ value: b.id, label: b.name }))}
            />
            {adminBranchFilter && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Showing filtered data — <span
                  style={{ color: themeTokens.colors.primary, cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => { setAdminBranchFilter(''); setLoading(true); loadDashboard(''); }}
                >
                  Clear filter
                </span>
              </Text>
            )}
          </div>
        )}

        {/* ══ ADMIN DASHBOARD ══ */}
        {isAdmin && adminDashboard && (
          <>
            {/* ── Row 1: 4 KPI Stat Cards ── */}
            <Row gutter={[16, 16]}>
              {[
                {
                  label: 'TOTAL EMPLOYEES',
                  value: adminDashboard.overview?.totalEmployees || 0,
                  trend: `+${adminDashboard.overview?.onboardingEmployees || 0} this month`,
                  trendColor: themeTokens.colors.success,
                  trendBg: '#e6f9f0',
                  icon: Users,
                  iconBg: '#e8f0ff',
                  iconColor: themeTokens.colors.primary,
                  onClick: () => navigate('/employees'),
                },
                {
                  label: 'HR ACCOUNTS',
                  value: adminDashboard.overview?.totalHRs || 0,
                  trend: `↑ ${adminDashboard.overview?.totalHRs || 0} Active`,
                  trendColor: themeTokens.colors.success,
                  trendBg: '#e6f9f0',
                  icon: UserCog,
                  iconBg: '#e6f9f0',
                  iconColor: themeTokens.colors.success,
                  onClick: () => navigate('/admin/hr-accounts'),
                },
                {
                  label: 'DEPARTMENTS',
                  value: adminDashboard.overview?.departmentCount || 0,
                  trend: `↑ ${adminDashboard.overview?.locationCount || 0} locations`,
                  trendColor: '#f59e0b',
                  trendBg: '#fff7e6',
                  icon: Building2,
                  iconBg: '#fff7e6',
                  iconColor: '#f59e0b',
                  onClick: null,
                },
                {
                  label: 'MANAGERS',
                  value: adminDashboard.overview?.totalManagers || 0,
                  trend: `↑ ${adminDashboard.overview?.totalManagers || 0} Active`,
                  trendColor: themeTokens.colors.success,
                  trendBg: '#e6f9f0',
                  icon: ShieldCheck,
                  iconBg: '#eef2ff',
                  iconColor: themeTokens.colors.blue700,
                  onClick: null,
                },
              ].map(({ label, value, trend, trendColor, trendBg, icon: Icon, iconBg, iconColor, onClick }) => (
                <Col xs={24} sm={12} md={6} key={label}>
                  <Card
                    onClick={onClick}
                    style={{
                      borderRadius: 14,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 1px 4px rgba(16,24,40,0.06)',
                      cursor: onClick ? 'pointer' : 'default',
                      height: '100%',
                      transition: 'box-shadow 0.2s',
                    }}
                    styles={{ body: { padding: '20px 20px 20px' } }}
                  >
                    {/* Label row + Icon top-right */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                        {label}
                      </Text>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: iconBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={20} color={iconColor} />
                      </div>
                    </div>
                    {/* Big number + trend pill on same row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 40, fontWeight: 800, color: '#1E2875', lineHeight: 1, letterSpacing: '-0.02em' }}>
                        {value}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: trendColor,
                        background: trendBg,
                        borderRadius: 20, padding: '3px 10px',
                        lineHeight: 1.5, whiteSpace: 'nowrap',
                      }}>
                        {trend}
                      </span>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>

            {/* ── Row 2: Employee Growth (left) + Attendance Today (right) ── */}
            <Row gutter={[16, 16]}>
              {/* Employee Growth card — Figma design */}
              <Col xs={24} md={16}>
                <div style={{
                  background: '#ffffff', borderRadius: 16,
                  border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(16,24,40,0.06)',
                  padding: '20px 16px', height: '100%', boxSizing: 'border-box',
                }}>
                  {/* Header row: icon + title | LAST MONTH box */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Round gradient icon */}
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'linear-gradient(180deg, #1368FF 0%, #0052CC 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <TrendingUp size={20} color="#fff" />
                      </div>
                      <Text style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.6px', lineHeight: '16px', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
                        Employee Growth
                      </Text>
                    </div>
                    {/* LAST MONTH box — top right */}
                    <div style={{
                      background: '#f9fafb', borderRadius: 12, border: '1px solid #f0f0f0',
                      padding: '10px 20px', textAlign: 'center', minWidth: 100,
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
                        Last Month
                      </Text>
                      <div style={{
                        fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em',
                        background: 'linear-gradient(180deg, #1368FF 0%, #0052CC 100%)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                      }}>
                        {adminDashboard.employeeGrowth?.lastMonth || 0}
                      </div>
                    </div>
                  </div>

                  {/* This month label + number + growth badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                    <Text style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>This month</Text>
                    {(() => {
                      const pct = adminDashboard.employeeGrowth?.changePercentage || 0;
                      const trend = adminDashboard.employeeGrowth?.trend;
                      if (pct === 0 && trend !== 'up' && trend !== 'down') return null;
                      const isUp = trend === 'up' || (!trend && pct > 0);
                      return (
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: isUp ? '#059669' : '#dc2626',
                          background: isUp ? '#ecfdf5' : '#fef2f2',
                          padding: '3px 10px', borderRadius: 20,
                        }}>
                          {isUp ? '↑' : '↓'} {Math.abs(pct)}%
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{
                    fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 20,
                    background: 'linear-gradient(180deg, #1E2875 0%, #1368FF 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>
                    {adminDashboard.employeeGrowth?.thisMonth || 0}
                  </div>

                  {/* Bar chart */}
                  <AdminBarChart
                    monthlyBreakdown={adminDashboard.employeeGrowth?.monthlyBreakdown || []}
                  />
                </div>
              </Col>

              {/* Attendance Today card — Figma design */}
              <Col xs={24} md={8}>
                <div style={{
                  background: '#ffffff',
                  borderRadius: 16,
                  border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(16,24,40,0.06)',
                  padding: '24px 24px 24px', height: '100%', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.6px', lineHeight: '16px', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', display: 'block', marginBottom: 16, alignSelf: 'center' }}>
                    Attendance Today
                  </Text>
                  {/* Full-circle donut centered */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    <AttendanceDonut
                      present={adminDashboard.attendance?.today?.present || 0}
                      absent={adminDashboard.attendance?.today?.absent || 0}
                    />
                  </div>
                </div>
              </Col>
            </Row>

            {/* ── Row 3: Operations Status bar ── */}
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 4px rgba(16,24,40,0.06)',
              padding: '18px 24px',
            }}>
              {/* Heading */}
              <Text style={{ fontSize: 15, fontWeight: 700, color: '#101828', display: 'block', marginBottom: 14 }}>
                Operations Status
              </Text>
              {/* Pills row */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                {(() => {
                  const systemHealthValue = adminDashboard.systemActivity?.systemHealth || 'healthy';
                  const isHealthy = systemHealthValue === 'healthy';
                  const items = [
                    { label: 'Onboarding', count: adminDashboard.onboarding?.active || 0, status: 'Active', dotColor: '#1e3a8a' },
                    { label: 'Offboarding', count: adminDashboard.offboarding?.active || 0, status: 'Active', dotColor: '#1e3a8a' },
                    { label: 'Leave Requests', count: adminDashboard.leaves?.pending || 0, status: 'Pending', dotColor: '#1e3a8a' },
                    {
                      label: 'System Status',
                      count: null,
                      status: systemHealthValue.charAt(0).toUpperCase() + systemHealthValue.slice(1),
                      dotColor: '#1e3a8a',
                      isHealthBadge: true,
                      isHealthy,
                    },
                  ];
                  return items.map((item) => (
                    <div key={item.label} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: '#f8faff',
                      border: '1px solid #e8edf8',
                      borderRadius: 100,
                      padding: '6px 14px',
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: item.dotColor }} />
                      <Text style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{item.label}</Text>
                      {/* vertical separator inside pill */}
                      <span style={{ width: 1, height: 14, background: '#d1d5db', flexShrink: 0, display: 'inline-block' }} />
                      {item.isHealthBadge ? (
                        <span style={{
                          background: item.isHealthy ? '#1268ff' : '#ff4d4f',
                          color: '#ffffff',
                          borderRadius: 100,
                          padding: '2px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: '18px',
                          display: 'inline-block',
                        }}>
                          {item.status}
                        </span>
                      ) : (
                        <>
                          <Text style={{ fontSize: 13, fontWeight: 700, color: '#101828' }}>{item.count}</Text>
                          <Text style={{ fontSize: 13, color: '#6b7280', fontWeight: 400 }}>{item.status}</Text>
                        </>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* ── Row 4: Quick Actions bar ── */}
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 4px rgba(16,24,40,0.06)',
              padding: '18px 24px',
            }}>
              <Text style={{ fontSize: 15, fontWeight: 700, color: '#101828', display: 'block', marginBottom: 14 }}>
                Quick Actions
              </Text>
              {/* horizontally scrollable pill row — hides scrollbar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                overflowX: 'auto',
                paddingBottom: 2,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}>
                {[
                  { label: 'Add Employee',       path: '/employees',               icon: UserPlus   },
                  { label: 'Create HR Account',  path: '/admin/hr-accounts',       icon: UserCog    },
                  { label: 'Assign Role',         path: '/admin/access-control',    icon: ShieldCheck},
                  { label: 'Manage Departments', path: '/settings',                icon: Building2  },
                  { label: 'Add Branch',         path: '/admin/branches',          icon: MapPin     },
                  { label: 'Security Settings',  path: '/admin/access-control',    icon: Lock       },
                ].map(({ label, path, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => navigate(path)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '7px 16px', borderRadius: 100,
                      border: '1px solid #d0deff',
                      background: '#f0f5ff',
                      fontSize: 13, fontWeight: 500, color: '#1e3a8a',
                      cursor: 'pointer', transition: 'all 0.18s ease',
                      whiteSpace: 'nowrap', flexShrink: 0,
                      outline: 'none',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#dbeafe';
                      e.currentTarget.style.borderColor = '#1268ff';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(18,104,255,0.14)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#f0f5ff';
                      e.currentTarget.style.borderColor = '#d0deff';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, borderRadius: 6,
                      background: '#dbeafe', flexShrink: 0,
                    }}>
                      <Icon size={13} color="#1268ff" strokeWidth={2.2} />
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {isHR && dashboard && (() => {
          // Client-side recompute from today's attendance items (fetched in
          // loadDashboard). Falls back to the API-provided counts when the
          // attendance list is empty (e.g. early failure). Status derivation
          // mirrors HR Operations: hours < 4 absent, < 9 half day, else present.
          const deriveStatus = (r) => {
            const raw = String(r.status || '').toLowerCase().replace(/\s+/g, '_');
            if (raw === 'on_leave' || raw === 'holiday') return raw;
            if (!r.checkIn || !r.checkOut) return raw;
            let h = (r.workHours != null && r.workHours !== '') ? Number(r.workHours) : NaN;
            if (!Number.isFinite(h) || h <= 0) {
              const sec = dayjs(r.checkOut).diff(dayjs(r.checkIn), 'second');
              if (Number.isFinite(sec) && sec > 0) h = sec / 3600;
            }
            if (!Number.isFinite(h) || h <= 0) return raw;
            if (h < 4) return 'absent';
            if (h < 9) return 'half_day';
            return 'present';
          };
          const isPresentLike = (s) =>
            s === 'present' || s === 'checked_in' || s === 'checked in' ||
            s === 'checked_out' || s === 'checked out' ||
            s === 'half_day' || s === 'half day';
          const derived = hrTodayItems.map(deriveStatus);
          const presentDerived = derived.filter(isPresentLike).length;
          const totalEmp = hrEmployeeCount || dashboard.overview?.activeEmployees || 0;
          const onboarding = dashboard.overview?.onboardingEmployees || 0;
          const presentToday = hrTodayItems.length > 0 ? presentDerived : (dashboard.attendance?.today?.present || 0);
          const absentToday = Math.max(0, totalEmp - presentToday);
          const attendanceRate = totalEmp > 0 ? Math.round((presentToday / totalEmp) * 100) : 0;
          const pendingLeaves = dashboard.leaves?.pending || 0;
          const urgentLeaves = dashboard.leaves?.urgent || 0;
          const hrKpiCards = [
            {
              label: 'TOTAL EMPLOYEES',
              value: totalEmp,
              sub: `${onboarding} in onboarding`,
              icon: Users,
            },
            {
              label: 'PRESENT TODAY',
              value: presentToday,
              sub: `${attendanceRate}% attendance rate`,
              icon: CheckCircle2,
            },
            {
              label: 'ABSENT TODAY',
              value: absentToday,
              sub: 'Employees absent',
              icon: Plane,
            },
            {
              label: 'PENDING LEAVES',
              value: pendingLeaves,
              sub: urgentLeaves > 0 ? `${urgentLeaves} urgent approval` : 'No urgent requests',
              icon: FileCheck,
            },
          ];
          return (
            <Row gutter={[16, 16]}>
              {hrKpiCards.map(({ label, value, sub, icon }) => (
                <Col xs={24} sm={12} md={6} key={label}>
                  <KPICard title={label} value={value} subtitle={sub} icon={icon} />
                </Col>
              ))}
            </Row>
          );
        })()}

        {isManager && dashboard && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <KPICard
                title="Team Size"
                value={dashboard.team?.size || 0}
                subtitle={`${dashboard.team?.newThisMonth || 0} new this month`}
                icon={Users}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <KPICard
                title="Present Today"
                value={dashboard.team?.presentToday || 0}
                subtitle={`${dashboard.team?.size ? Math.round((dashboard.team.presentToday / dashboard.team.size) * 100) : 0}% attendance`}
                icon={CheckCircle2}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <KPICard
                title="On Leave"
                value={dashboard.team?.onLeaveToday || 0}
                subtitle="Away today"
                icon={Plane}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <KPICard
                title="Pending Approvals"
                value={pendingApprovals.length + pendingRegularizationCount}
                subtitle={pendingRegularizationCount > 0
                  ? `${pendingApprovals.length} leave · ${pendingRegularizationCount} regularization`
                  : 'Need review'}
                icon={FileCheck}
                onClick={() => navigate('/leave/approvals')}
              />
            </Col>
          </Row>
        )}

        {/* ══ MANAGER DEDICATED LAYOUT ══ */}
        {isManager && dashboard && (() => {
          // Team Performance chart data
          const perfData = (() => {
            const months = [];
            for (let i = 5; i >= 0; i--) {
              const m = dayjs().subtract(i, 'month');
              months.push({ month: m.format('MMM'), rate: 0 });
            }
            const attendanceHistory = dashboard?.team?.attendanceHistory || [];
            if (attendanceHistory.length > 0) {
              attendanceHistory.slice(-6).forEach((item, idx) => {
                if (months[idx]) months[idx].rate = Math.round(item.rate || item.attendanceRate || 0);
              });
            }
            return months;
          })();
          const latestRate = perfData[perfData.length - 1]?.rate || 0;
          const prevRate = perfData[perfData.length - 2]?.rate || 0;
          const rateChange = latestRate - prevRate;

          // Pending leave card JSX (shared ref)
          const pendingLeaveCard = (scrollHeight) => (
            <div style={{
              background: '#ffffff',
              borderRadius: 14,
              border: `1px solid ${themeTokens.colors.borders}`,
              boxShadow: themeTokens.shadows.standard,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}>
              <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.textPrimary }}>Pending Leave Approvals</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {pendingApprovals.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#EBF4FF', color: '#1368FF', padding: '3px 10px', borderRadius: 20 }}>
                      {pendingApprovals.length} pending
                    </span>
                  )}
                  <Button type="link" size="small" style={{ padding: 0, fontSize: 12, color: themeTokens.colors.primary, fontWeight: 600 }} onClick={() => navigate('/leave/approvals')}>
                    View All
                  </Button>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f3f4f6', flex: 1, overflowY: 'auto', maxHeight: scrollHeight || 'none' }}>
                {pendingApprovals.length > 0 ? (
                  pendingApprovals.map((leave, i) => {
                    const empName = getLeaveEmployeeName(leave);
                    const initials = empName.charAt(0).toUpperCase();
                    const hFrom = leave.fromDate ? dayjs(leave.fromDate) : null;
                    const hTo = leave.toDate ? dayjs(leave.toDate) : null;
                    const dateRange = hFrom && hTo
                      ? `${hFrom.format('MMM D')}–${hTo.format('D, YYYY')}`
                      : hFrom ? hFrom.format('MMM D, YYYY') : '--';
                    const leaveTypeCap = (leave.leaveType || '').charAt(0).toUpperCase() + (leave.leaveType || '').slice(1);
                    const leaveTypeColor = (leave.leaveType || '').toLowerCase().includes('sick') ? '#ef4444'
                      : (leave.leaveType || '').toLowerCase().includes('casual') ? '#3b82f6' : '#8b5cf6';
                    const leaveTypeBg = (leave.leaveType || '').toLowerCase().includes('sick') ? '#fef2f2'
                      : (leave.leaveType || '').toLowerCase().includes('casual') ? '#eff6ff' : '#f5f3ff';
                    const timeAgo = leave.appliedAt ? (() => {
                      const diff = dayjs().diff(dayjs(leave.appliedAt), 'hour');
                      if (diff < 1) return 'Just now';
                      if (diff < 24) return `${diff} hours ago`;
                      const days = Math.floor(diff / 24);
                      return `${days} day${days > 1 ? 's' : ''} ago`;
                    })() : '';
                    return (
                      <div key={leave.id} style={{
                        padding: '14px 16px',
                        borderBottom: i < pendingApprovals.length - 1 ? '1px solid #f3f4f6' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: `linear-gradient(135deg, ${themeTokens.colors.primary} 0%, #0052CC 100%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 14, fontWeight: 700,
                          }}>{initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary }}>{empName}</div>
                            <div style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>{timeAgo}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: leaveTypeColor, background: leaveTypeBg }}>
                            {leaveTypeCap || 'Leave'}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10, marginLeft: 46 }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duration</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: themeTokens.colors.textPrimary }}>{leave.days || 1} day{(leave.days || 1) !== 1 ? 's' : ''}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dates</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: themeTokens.colors.textPrimary }}>{dateRange}</div>
                          </div>
                        </div>
                        {leave.reason && (
                          <div style={{ fontSize: 11, color: themeTokens.colors.textTertiary, marginLeft: 46, marginBottom: 10, fontStyle: 'italic' }}>
                            &ldquo;{leave.reason}&rdquo;
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginLeft: 46 }}>
                          <Button
                            type="primary" size="small"
                            loading={leaveActionLoading[leave.id + '_approve']}
                            onClick={() => handleLeaveApprove(leave.id)}
                            style={{ flex: 1, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#1368FF', border: 'none' }}
                          >Approve</Button>
                          <Button
                            size="small"
                            loading={leaveActionLoading[leave.id + '_reject']}
                            onClick={() => handleLeaveReject(leave.id)}
                            style={{ flex: 1, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#ef4444', border: '1px solid #ef4444', background: '#fff' }}
                          >Reject</Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: themeTokens.colors.textTertiary, fontSize: 13 }}>
                    No pending requests to review.
                  </div>
                )}
              </div>
            </div>
          );

          // My Attendance card JSX
          const myAttendanceCard = (
            <div style={{
              background: '#ffffff',
              borderRadius: 14,
              border: `1px solid ${themeTokens.colors.borders}`,
              boxShadow: themeTokens.shadows.standard,
              padding: isMobile ? '16px 14px 18px' : '20px 24px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 17, fontWeight: 700, color: themeTokens.colors.textPrimary }}>My Attendance</Text>
                  <ClockHistoryPopover logs={selfTodayAttendance.logs} isMobile={isMobile} />
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 20,
                  border: `1.5px solid ${selfTodayAttendance.isCurrentlyIn ? themeTokens.colors.primary : selfTodayAttendance.hasCheckedIn ? '#10b981' : '#e5e7eb'}`,
                  background: '#ffffff',
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: selfTodayAttendance.isCurrentlyIn ? themeTokens.colors.primary : selfTodayAttendance.hasCheckedIn ? '#10b981' : '#9ca3af',
                    boxShadow: selfTodayAttendance.isCurrentlyIn ? '0 0 0 2px rgba(19,104,255,0.25)' : 'none',
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: selfTodayAttendance.isCurrentlyIn ? themeTokens.colors.primary : selfTodayAttendance.hasCheckedIn ? '#10b981' : '#6b7280', letterSpacing: '0.02em' }}>
                    {selfTodayAttendance.isCurrentlyIn ? 'CLOCKED IN' : selfTodayAttendance.hasCheckedIn ? 'CLOCKED OUT' : 'NOT CLOCKED IN'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  {
                    label: 'STATUS',
                    value: selfTodayAttendance.isCurrentlyIn ? 'Clocked In' : selfTodayAttendance.hasCheckedIn ? 'Clocked Out' : 'Not Clocked In',
                    valueColor: selfTodayAttendance.isCurrentlyIn ? themeTokens.colors.primary : selfTodayAttendance.hasCheckedIn ? '#10b981' : '#6b7280',
                    valueBg: selfTodayAttendance.isCurrentlyIn ? '#EBF3FF' : selfTodayAttendance.hasCheckedIn ? '#ECFDF5' : '#F9FAFB',
                    valueBorder: selfTodayAttendance.isCurrentlyIn ? '#BFDBFE' : selfTodayAttendance.hasCheckedIn ? '#A7F3D0' : '#E5E7EB',
                    isTag: true,
                  },
                  { label: 'FIRST CLOCK IN', value: formatTime(selfTodayAttendance.checkInTimeDisplay || selfTodayAttendance.checkInTime) || '--', isTag: false },
                  { label: 'LAST CLOCK OUT', value: formatTime(selfTodayAttendance.checkOutTimeDisplay || selfTodayAttendance.checkOutTime) || '--', isTag: false },
                ].map(({ label, value, valueColor, valueBg, valueBorder, isTag }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF' }}>{label}</div>
                    <div style={{ background: isTag ? valueBg : '#F5F7FA', borderRadius: 14, border: `1px solid ${isTag ? valueBorder : '#E5E7EB'}`, padding: '11px 14px', display: 'flex', alignItems: 'center', minHeight: 46 }}>
                      {isTag
                        ? <span style={{ fontSize: 14, fontWeight: 600, color: valueColor }}>{value}</span>
                        : <span style={{ fontSize: 20, fontWeight: 700, color: '#1E2875', letterSpacing: '-0.01em' }}>{value}</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                {/* BIOMETRIC_MODE: Clock In/Out button hidden — re-enable for WFH or device offline scenarios
                <Button type="primary" loading={attendanceActionLoading} onClick={handleAttendanceAction}
                  style={{ flex: isMobile ? '1 1 auto' : '0 0 60%', height: 46, borderRadius: 28, fontSize: 15, fontWeight: 600, background: '#1368FF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
                  {selfTodayAttendance.isCurrentlyIn ? 'Clock Out' : 'Clock In'}
                </Button>
                */}
                <div style={{ flex: isMobile ? '1 1 auto' : '0 0 60%', height: 46, borderRadius: 28, background: '#F0F7FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#1E40AF' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M12 6v4l2 2"/></svg>
                  Biometric Attendance Active
                </div>
                <Button onClick={() => navigate('/attendance')} style={{ flex: 1, height: 46, borderRadius: 28, fontSize: 14, fontWeight: 600, color: themeTokens.colors.primary, border: `1px solid ${themeTokens.colors.primary}`, background: '#ffffff' }}>
                  View Full Attendance
                </Button>
              </div>
            </div>
          );

          // Today Team Attendance card
          const todayTeamCard = (
            <div style={{ background: '#ffffff', borderRadius: 14, border: `1px solid ${themeTokens.colors.borders}`, boxShadow: themeTokens.shadows.standard, padding: isMobile ? '14px' : '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: 700, color: themeTokens.colors.textPrimary }}>Today Team Attendance</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>
                    {(managerAttendanceToday || []).filter(m => m.checkInTimeDisplay || m.checkInTime).length} of {dashboard?.team?.size || (managerAttendanceToday || []).length} present
                  </span>
                  <Button type="link" size="small" style={{ padding: 0, fontSize: 12, color: themeTokens.colors.primary, fontWeight: 600 }} onClick={() => navigate('/attendance/team')}>View All</Button>
                </div>
              </div>
              {managerAttendanceToday.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {managerAttendanceToday.slice(0, 8).map((member) => {
                    const initials = `${member.firstName || ''}${member.lastName || ''}`.trim().charAt(0).toUpperCase() || '?';
                    const isPresent = Boolean(member.checkInTimeDisplay || member.checkInTime);
                    const isOnLeave = (member.status || '').toLowerCase().includes('leave');
                    const statusLabel = isOnLeave ? 'On Leave' : isPresent ? 'Present' : 'Absent';
                    const statusColor = isOnLeave ? '#f59e0b' : isPresent ? '#10b981' : '#ef4444';
                    const statusBg = isOnLeave ? '#fffbeb' : isPresent ? '#ecfdf5' : '#fef2f2';
                    const checkInDisplay = member.checkInTimeDisplay || (member.checkInTime ? formatTime(member.checkInTime) : '--');
                    return (
                      <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#fafbff', border: '1px solid #f0f3f9' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg, ${themeTokens.colors.primary} 0%, #0052CC 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>{initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.firstName} {member.lastName}</div>
                          <div style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>{member.designation || member.jobTitle || member.employeeId || ''}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: themeTokens.colors.textPrimary }}>{isPresent ? checkInDisplay : '--'}</div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: statusColor, background: statusBg }}>{statusLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: themeTokens.colors.textTertiary, fontSize: 13 }}>No team attendance updates available for today.</div>
              )}
            </div>
          );

          // Onboarding/Offboarding card
          const onboardingCard = (
            <div style={{ background: '#ffffff', borderRadius: 14, border: `1px solid ${themeTokens.colors.borders}`, boxShadow: themeTokens.shadows.standard, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.textPrimary }}>Onboarding / Offboarding</Text>
                <span style={{ fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', padding: '3px 10px', borderRadius: 20 }}>
                  {managerOnboarding.length + managerOffboarding.length} events
                </span>
              </div>
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '4px 0' }}>
                {(() => {
                  const items = [
                    ...managerOnboarding.slice(0, 3).map(item => ({ ...item, _type: 'Onboarding' })),
                    ...managerOffboarding.slice(0, 3).map(item => ({ ...item, _type: 'Offboarding' })),
                  ];
                  if (items.length === 0) return (
                    <div style={{ padding: '20px 16px', textAlign: 'center', color: themeTokens.colors.textTertiary, fontSize: 13 }}>No onboarding or offboarding events.</div>
                  );
                  return items.map((item, i) => {
                    const initials = `${item.firstName || ''}${item.lastName || ''}`.trim().charAt(0).toUpperCase() || '?';
                    const isOnboarding = item._type === 'Onboarding';
                    const typeColor = isOnboarding ? '#10b981' : '#f59e0b';
                    const typeBg = isOnboarding ? '#ecfdf5' : '#fffbeb';
                    const dateVal = item.startDate || item.endDate || item.date || item.joiningDate || item.exitDate;
                    const dateDisplay = dateVal ? dayjs(dateVal).format('MMM D, YYYY') : '';
                    return (
                      <div key={item.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < items.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: typeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: typeColor, fontSize: 13, fontWeight: 700 }}>{initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.firstName} {item.lastName}</div>
                          {item.designation && <div style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>{item.designation}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: typeColor, background: typeBg }}>{item._type}</span>
                          {dateDisplay && <div style={{ fontSize: 10, color: themeTokens.colors.textTertiary, marginTop: 2 }}>{dateDisplay}</div>}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          );

          // Calendar card (for manager bottom-left)
          const calendarCard = (
            <div style={{ background: '#ffffff', borderRadius: 14, border: `1px solid ${themeTokens.colors.borders}`, boxShadow: themeTokens.shadows.standard, overflow: 'hidden' }}>
              {renderCustomCalendar(true)}
            </div>
          );

          return (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {/* ── Row A: Left = My Attendance + Team Performance Chart stacked | Right = Pending Leave (full height of both) ── */}
              <div style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: '1fr 1fr', flexDirection: 'column', gap: 16, alignItems: 'stretch' }}>
                {/* Left: My Attendance + Team Performance stacked */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {myAttendanceCard}
                  {/* Team Performance Chart */}
                  <div style={{ background: '#ffffff', borderRadius: 14, border: `1px solid ${themeTokens.colors.borders}`, boxShadow: themeTokens.shadows.standard, padding: isMobile ? '16px 14px' : '20px 24px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div>
                        <Text style={{ fontSize: 13, fontWeight: 600, color: themeTokens.colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team Performance</Text>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 32, fontWeight: 800, color: themeTokens.colors.heading, lineHeight: 1 }}>{latestRate}%</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: rateChange >= 0 ? '#10b981' : '#ef4444' }}>
                            {rateChange >= 0 ? '▲' : '▼'} {Math.abs(rateChange)}% vs last month
                          </span>
                        </div>
                        <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>Last 6 months</Text>
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: '#E3EAFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp size={18} color={themeTokens.colors.primary} />
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={perfData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
                        <RechartsTooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} formatter={(val) => [`${val}%`, 'Attendance Rate']} />
                        <Line type="monotone" dataKey="rate" stroke="#1368FF" strokeWidth={2.5} dot={{ r: 3, fill: '#1368FF', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* Right: Pending Leave Approvals — height equals left column (scrollable) */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>{pendingLeaveCard(null)}</div>
              </div>

              {/* ── Row 3: Today Team Attendance (right) + Onboarding/Offboarding (right) | Calendar + Upcoming Holidays (left) ── */}
              <div style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: '1fr 1fr', flexDirection: 'column', gap: 16, alignItems: 'stretch' }}>
                {/* Left: Calendar + Upcoming Holidays stacked */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {calendarCard}
                  {/* Upcoming Holidays */}
                  <div style={{ background: '#ffffff', borderRadius: 14, border: `1px solid ${themeTokens.colors.borders}`, boxShadow: themeTokens.shadows.standard, overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Calendar size={15} color="rgba(255,255,255,0.9)" />
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Upcoming Holidays</span>
                      </div>
                      {calendarHolidays.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20 }}>
                          {calendarHolidays.length} Days
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '8px 0', maxHeight: 230, overflowY: 'auto' }}>
                      {(() => {
                        const today = dayjs().startOf('day');
                        const upcoming = [...calendarHolidays]
                          .filter(h => !dayjs(h.date).isBefore(today))
                          .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
                          .slice(0, 5);
                        if (upcoming.length === 0) return (
                          <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 13 }}>No upcoming holidays.</Text>
                          </div>
                        );
                        return upcoming.map((holiday, i) => {
                          const hDay = dayjs(holiday.date);
                          const daysAway = hDay.diff(today, 'day');
                          return (
                            <div key={holiday.id || holiday.date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < upcoming.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                              <div style={{ textAlign: 'center', flexShrink: 0, width: 36 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: themeTokens.colors.primary, letterSpacing: '0.08em' }}>{hDay.format('MMM')}</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{hDay.format('DD')}</div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{holiday.name}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{hDay.format('dddd')}</div>
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: themeTokens.colors.textTertiary, flexShrink: 0, textAlign: 'right' }}>
                                {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway} days away`}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
                {/* Right: Today Team Attendance + Onboarding/Offboarding stacked */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {todayTeamCard}
                  {onboardingCard}
                </div>
              </div>
            </Space>
          );
        })()}

        {(isEmployee) && dashboard && (() => {
          // Build leave cards dynamically from API response
          const CARD_COLORS = [
            { bg: '#EEF2FF', color: '#6366F1' },
            { bg: '#FDF2F8', color: '#EC4899' },
            { bg: '#F0FDF4', color: '#22C55E' },
            { bg: '#FFF7ED', color: '#F59E0B' },
            { bg: '#F0F9FF', color: '#0EA5E9' },
            { bg: '#FAF5FF', color: '#8B5CF6' },
          ];
          const allCards = Object.entries(employeeLeaveCards)
            .filter(([key, card]) => card && key !== 'lop' && key !== 'comp_off')
            .map(([key, card], idx) => {
              const palette = CARD_COLORS[idx % CARD_COLORS.length];
              return {
                key,
                label: card.name || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                value: formatLeaveValue(card.available),
                sub: `of ${formatLeaveValue(card.credited)} available`,
                bg: palette.bg,
                iconColor: palette.color,
              };
            });
          const monthAtt = employeeAttendanceMonth;
          const leaveCards = [
            ...allCards,
            {
              key: 'month_attendance',
              label: 'Month Attendance',
              value: monthAtt.present || 0,
              sub: `${monthAtt.absent || 0} absent this month`,
              bg: '#EEF2FF',
              iconColor: '#6366F1',
              trend: `+${monthAtt.present || 0}`,
            },
          ];
          return (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${Math.min(leaveCards.length, 4)}, 1fr)`, gap: 14 }}>
              {leaveCards.map(card => (
                <div key={card.key} style={{
                  background: '#ffffff',
                  borderRadius: 16,
                  border: `1px solid ${themeTokens.colors.borders}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  position: 'relative',
                }}>
                  {/* Icon circle */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: card.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    fontWeight: 800, fontSize: 14, color: card.iconColor,
                  }}>
                    {card.label.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#1E2875', lineHeight: 1.1 }}>{card.value}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginTop: 1 }}>{card.label}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{card.sub}</div>
                  </div>
                  {/* Trend badge (Month Attendance only) */}
                  {card.trend && (
                    <div style={{
                      position: 'absolute', top: 10, right: 12,
                      display: 'flex', alignItems: 'center', gap: 3,
                      background: '#F0FDF4',
                      borderRadius: 20,
                      padding: '2px 7px',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E' }}>{card.trend}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Quick Actions (Employee only, standalone — no card wrapper) ── */}
        {(isEmployee) && dashboard && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Apply Leave', primary: true, action: () => navigate('/leave?openApply=true') },
                { label: 'Request Regularization', primary: false, action: () => navigate('/attendance?openRegularize=true') },
                { label: 'View Profile', primary: false, action: () => navigate('/settings') },
              ].map(({ label, primary, action }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{
                    padding: '7px 18px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid #E5E7EB',
                    background: '#ffffff',
                    color: '#374151',
                    boxShadow: 'none',
                    transition: 'background 0.18s, color 0.18s, border-color 0.18s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#1368FF';
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.borderColor = '#1368FF';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.color = '#374151';
                    e.currentTarget.style.borderColor = '#E5E7EB';
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Admin Bottom: Calendar (bare) + Holidays side by side ── */}
        {false && isAdmin && (
          <div className="admin-cal-holiday-row" style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.45fr 1fr',
            gridTemplateRows: '1fr',
            gap: 16,
          }}>
            {/* Calendar */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                background: '#ffffff',
                borderRadius: 16,
                overflow: 'hidden',
              }}>
                {renderCustomCalendar()}
              </div>
            </div>

            {/* Holidays card — height constrained to calendar on desktop, auto on mobile */}
            <div className="holiday-card-wrapper" style={{ minWidth: 0, position: isMobile ? 'static' : 'relative' }}>
              <div className="holiday-card-inner" style={{
                background: '#ffffff',
                borderRadius: 16,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                ...(isMobile ? {} : { position: 'absolute', inset: 0 }),
              }}>
                {/* Blue gradient header */}
                <div style={{
                  background: 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)',
                  padding: '12px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Calendar size={16} color="rgba(255,255,255,0.9)" />
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                      Holidays {calendarViewDate.year()}
                    </span>
                  </div>
                  {calendarHolidays.length > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#ffffff',
                      background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 20,
                    }}>
                      {calendarHolidays.length} Days
                    </span>
                  )}
                </div>

                {/* Holiday list — scrolls, footer stays pinned */}
                <div className="holiday-scroll-container" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  {(() => {
                    const todayD = dayjs().startOf('day');
                    const list = [...calendarHolidays].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
                    if (list.length === 0) {
                      return (
                        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                          <Text type="secondary">No holidays configured.</Text>
                        </div>
                      );
                    }
                    const getTypeMeta = (type) => {
                      const t = (type || '').toLowerCase();
                      if (t.includes('national'))  return { color: '#1368FF', bg: '#EFF6FF' };
                      if (t.includes('regional'))  return { color: '#059669', bg: '#ECFDF5' };
                      if (t.includes('company'))   return { color: '#7c3aed', bg: '#F5F3FF' };
                      if (t.includes('optional'))  return { color: '#D97706', bg: '#FFFBEB' };
                      return { color: '#6B7280', bg: '#F9FAFB' };
                    };
                    return list.map((holiday, i) => {
                      const hDay = dayjs(holiday.date);
                      const isPast = hDay.isBefore(todayD);
                      const { color: typeColor, bg: typeBg } = getTypeMeta(holiday.type);
                      return (
                        <div
                          key={holiday.id || holiday.date || holiday.name}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            padding: '20px 20px',
                            borderBottom: i < list.length - 1 ? '1px solid #F3F4F6' : 'none',
                            opacity: isPast ? 0.38 : 1,
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {/* Date column */}
                          <div style={{ width: 40, flexShrink: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <div style={{
                              fontSize: 10, fontWeight: 700,
                              color: themeTokens.colors.primary,
                              textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1,
                            }}>
                              {hDay.format('MMM')}
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.02em' }}>
                              {hDay.format('DD')}
                            </div>
                          </div>

                          {/* Name + weekday */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 14, fontWeight: 700, color: '#0F172A',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              lineHeight: 1.3, marginBottom: 3,
                            }}>
                              {holiday.name}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', lineHeight: 1 }}>
                              {hDay.format('dddd')}
                            </div>
                          </div>

                          {/* Type pill badge */}
                          {holiday.type && (
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              color: typeColor,
                              background: typeBg,
                              padding: '4px 10px',
                              borderRadius: 20,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                              lineHeight: 1.4,
                            }}>
                              {holiday.type}
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Footer — pinned at bottom */}
                <div style={{
                  borderTop: '1px solid #f1f5f9',
                  padding: '10px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexShrink: 0,
                  background: '#fafbfc',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: `${themeTokens.colors.primary}10`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <MapPin size={13} color={themeTokens.colors.primary} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>India</div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8', lineHeight: 1.2 }}>Location</div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: themeTokens.colors.primary,
                    background: `${themeTokens.colors.primary}08`,
                    padding: '4px 12px', borderRadius: 20,
                  }}>
                    {calendarHolidays.filter(h => (h.type || '').toLowerCase().includes('national')).length} National Holidays
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Area (HR / Employee only — Manager has dedicated layout below, Admin hides this) */}
        <Row gutter={[16, 16]} style={isAdmin ? { display: 'none' } : {}}>
          {/* Main Content Column */}
          <Col xs={24} lg={isManager ? 0 : 16} style={isManager ? { display: 'none' } : {}}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {(isHR && !isAdmin) && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: 24,
                  border: `1px solid ${themeTokens.colors.borders}`,
                  boxShadow: themeTokens.shadows.standard,
                  padding: isMobile ? '16px 14px 18px' : '20px 24px 24px',
                }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 17, fontWeight: 700, color: themeTokens.colors.textPrimary }}>My Attendance</Text>
                      <ClockHistoryPopover logs={selfTodayAttendance.logs} isMobile={isMobile} />
                    </div>
                    {/* Clocked In / Not Clocked In badge */}
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '5px 14px',
                      borderRadius: 20,
                      border: `1.5px solid ${selfTodayAttendance.isCurrentlyIn ? themeTokens.colors.primary : selfTodayAttendance.hasCheckedIn ? '#10b981' : '#e5e7eb'}`,
                      background: '#ffffff',
                    }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: selfTodayAttendance.isCurrentlyIn ? themeTokens.colors.primary : selfTodayAttendance.hasCheckedIn ? '#10b981' : '#9ca3af',
                        boxShadow: selfTodayAttendance.isCurrentlyIn ? '0 0 0 2px rgba(19,104,255,0.25)' : 'none',
                      }} />
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: selfTodayAttendance.isCurrentlyIn ? themeTokens.colors.primary : selfTodayAttendance.hasCheckedIn ? '#10b981' : '#6b7280',
                        letterSpacing: '0.02em',
                      }}>
                        {selfTodayAttendance.isCurrentlyIn ? 'CLOCKED IN' : selfTodayAttendance.hasCheckedIn ? 'CLOCKED OUT' : 'NOT CLOCKED IN'}
                      </span>
                    </div>
                  </div>

                  {/* 3-column info row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                    gap: 12,
                    marginBottom: 20,
                  }}>
                    {[
                      {
                        label: 'STATUS',
                        value: selfTodayAttendance.isCurrentlyIn ? 'Clocked In' : selfTodayAttendance.hasCheckedIn ? 'Clocked Out' : 'Not Clocked In',
                        valueColor: selfTodayAttendance.isCurrentlyIn ? themeTokens.colors.primary : selfTodayAttendance.hasCheckedIn ? '#10b981' : '#6b7280',
                        valueBg: selfTodayAttendance.isCurrentlyIn ? '#EBF3FF' : selfTodayAttendance.hasCheckedIn ? '#ECFDF5' : '#F9FAFB',
                        valueBorder: selfTodayAttendance.isCurrentlyIn ? '#BFDBFE' : selfTodayAttendance.hasCheckedIn ? '#A7F3D0' : '#E5E7EB',
                        isTag: true,
                      },
                      {
                        label: 'FIRST CLOCK IN',
                        value: formatTime(selfTodayAttendance.checkInTimeDisplay || selfTodayAttendance.checkInTime) || '--',
                        isTag: false,
                      },
                      {
                        label: 'LAST CLOCK OUT',
                        value: formatTime(selfTodayAttendance.checkOutTimeDisplay || selfTodayAttendance.checkOutTime) || '--',
                        isTag: false,
                      },
                    ].map(({ label, value, valueColor, valueBg, valueBorder, isTag }) => (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF' }}>{label}</div>
                        <div style={{
                          background: isTag ? valueBg : '#F5F7FA',
                          borderRadius: 14,
                          border: `1px solid ${isTag ? valueBorder : '#E5E7EB'}`,
                          padding: '11px 14px',
                          display: 'flex', alignItems: 'center',
                          minHeight: 46,
                        }}>
                          {isTag ? (
                            <span style={{ fontSize: 14, fontWeight: 600, color: valueColor }}>{value}</span>
                          ) : (
                            <span style={{ fontSize: 20, fontWeight: 700, color: '#1E2875', letterSpacing: '-0.01em' }}>{value}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions row — Biometric badge (left) + View Full Attendance (right) */}
                  <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                    {/* BIOMETRIC_MODE: Clock In/Out button hidden — re-enable for WFH or device offline scenarios
                    <Button
                      type="primary"
                      loading={attendanceActionLoading}
                      onClick={handleAttendanceAction}
                      style={{
                        flex: isMobile ? '1 1 auto' : '0 0 60%',
                        height: 46,
                        borderRadius: 28,
                        fontSize: 15,
                        fontWeight: 600,
                        background: '#1368FF',
                        border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
                      {selfTodayAttendance.isCurrentlyIn ? 'Clock Out' : 'Clock In'}
                    </Button>
                    */}
                    <div style={{ flex: isMobile ? '1 1 auto' : '0 0 60%', height: 46, borderRadius: 28, background: '#F0F7FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#1E40AF' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M12 6v4l2 2"/></svg>
                      Biometric Attendance Active
                    </div>
                    <Button
                      onClick={() => navigate('/attendance')}
                      style={{
                        flex: 1,
                        height: 46,
                        borderRadius: 28,
                        fontSize: 14,
                        fontWeight: 600,
                        color: themeTokens.colors.primary,
                        border: `1px solid ${themeTokens.colors.primary}`,
                        background: '#ffffff',
                      }}
                    >
                      View Full Attendance
                    </Button>
                  </div>
                </div>
              )}

              {/* Admin has no inline actions here – they're in the Quick Actions bar above */}

              {/* Pending Approvals — HR only (admin uses HR Operations) */}
              {(isHR && !isAdmin) && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  border: `1px solid ${themeTokens.colors.borders}`,
                  boxShadow: themeTokens.shadows.standard,
                  padding: isMobile ? '16px 14px' : '20px 24px',
                }}>
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={{ fontSize: 17, fontWeight: 700, color: themeTokens.colors.textPrimary }}>
                      Pending Approvals
                    </Text>
                    {(pendingApprovals.length + pendingRegularizations.length) > 0 && (
                      <div style={{
                        background: '#EBF4FF',
                        color: '#1368FF',
                        borderRadius: 12,
                        padding: '5.5px 12px 6.5px',
                        fontSize: 12, fontWeight: 700,
                        minWidth: 28, textAlign: 'center',
                      }}>
                        {pendingApprovals.length + pendingRegularizations.length} Pending
                      </div>
                    )}
                  </div>
                  {(pendingApprovals.length + pendingRegularizations.length) > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Leave approvals */}
                      {pendingApprovals.slice(0, 5).map((leave) => {
                        const empName = getLeaveEmployeeName(leave);
                        const empCode = getLeaveEmployeeCode(leave);
                        const initials = empName.charAt(0).toUpperCase();
                        return (
                          <div
                            key={`leave-${leave.id}`}
                            style={{
                              display: 'flex',
                              alignItems: isMobile ? 'flex-start' : 'center',
                              gap: isMobile ? 10 : 14,
                              padding: isMobile ? '12px 12px' : '14px 16px',
                              border: '1px solid #f0f3f9',
                              borderRadius: 12,
                              background: '#fafbff',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f5ff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#fafbff'; }}
                          >
                            {/* Avatar */}
                            <div style={{
                              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                              background: `linear-gradient(135deg, ${themeTokens.colors.primary} 0%, #0052CC 100%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontSize: 16, fontWeight: 700,
                            }}>
                              {initials}
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: themeTokens.colors.textPrimary, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {empName}{empCode ? ` · ${empCode}` : ''}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                {leave.leaveType && (
                                  <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.colors.textTertiary, whiteSpace: 'nowrap' }}>
                                    {leave.leaveType} · {leave.days} day(s)
                                  </span>
                                )}
                                {leave.fromDate && (
                                  <span style={{
                                    fontSize: 11, fontWeight: 600, color: themeTokens.colors.primary,
                                    background: `${themeTokens.colors.primary}10`,
                                    padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                                  }}>
                                    {formatDate(leave.fromDate)}
                                  </span>
                                )}
                              </div>
                              {leave.reason && (
                                <div style={{ fontSize: 12, color: themeTokens.colors.textTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  Reason: {leave.reason}
                                </div>
                              )}
                            </div>
                            {/* Review button */}
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => navigate('/leave/approvals')}
                              style={{
                                borderRadius: 8,
                                fontWeight: 600,
                                background: themeTokens.colors.primary,
                                border: 'none',
                                flexShrink: 0,
                              }}
                            >
                              Review
                            </Button>
                          </div>
                        );
                      })}
                      {/* Regularization approvals */}
                      {pendingRegularizations.slice(0, 5).map((reg) => {
                        const empName = reg.employeeName || reg.name || 'Employee';
                        const empCode = reg.employeeCode || reg.employee?.employeeCode || '';
                        const initials = empName.charAt(0).toUpperCase();
                        return (
                          <div
                            key={`reg-${reg.id}`}
                            style={{
                              display: 'flex',
                              alignItems: isMobile ? 'flex-start' : 'center',
                              gap: isMobile ? 10 : 14,
                              padding: isMobile ? '12px 12px' : '14px 16px',
                              border: '1px solid #f0f3f9',
                              borderRadius: 12,
                              background: '#fafbff',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f5ff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#fafbff'; }}
                          >
                            {/* Avatar */}
                            <div style={{
                              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                              background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontSize: 16, fontWeight: 700,
                            }}>
                              {initials}
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: themeTokens.colors.textPrimary, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {empName}{empCode ? ` · ${empCode}` : ''}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#F5F3FF', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                  Regularization
                                </span>
                                {reg.date && (
                                  <span style={{
                                    fontSize: 11, fontWeight: 600, color: themeTokens.colors.primary,
                                    background: `${themeTokens.colors.primary}10`,
                                    padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                                  }}>
                                    {formatDate(reg.date)}
                                  </span>
                                )}
                              </div>
                              {reg.reason && (
                                <div style={{ fontSize: 12, color: themeTokens.colors.textTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  Reason: {reg.reason}
                                </div>
                              )}
                            </div>
                            {/* Review button */}
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => navigate('/leave/approvals?tab=regularization')}
                              style={{
                                borderRadius: 8,
                                fontWeight: 600,
                                background: '#7C3AED',
                                border: 'none',
                                flexShrink: 0,
                              }}
                            >
                              Review
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 12px',
                      }}>
                        <AlertCircle size={24} color={themeTokens.colors.textTertiary} />
                      </div>
                      <Text type="secondary" style={{ fontSize: 13 }}>No pending requests to display</Text>
                    </div>
                  )}
                </div>
              )}


              {(isEmployee) && (
                <div style={{ background: '#ffffff', borderRadius: 16, border: `1px solid ${themeTokens.colors.borders}`, boxShadow: themeTokens.shadows.standard, padding: '20px 24px 24px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: 700, color: themeTokens.colors.textPrimary }}>My Attendance</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: selfTodayAttendance.isCurrentlyIn ? '#EBF3FF' : selfTodayAttendance.hasCheckedIn ? '#ECFDF5' : '#F3F4F6', border: `1px solid ${selfTodayAttendance.isCurrentlyIn ? '#BFDBFE' : selfTodayAttendance.hasCheckedIn ? '#A7F3D0' : '#E5E7EB'}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: selfTodayAttendance.isCurrentlyIn ? '#1368FF' : selfTodayAttendance.hasCheckedIn ? '#10B981' : '#9CA3AF', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: selfTodayAttendance.isCurrentlyIn ? '#1368FF' : selfTodayAttendance.hasCheckedIn ? '#10B981' : '#6B7280', letterSpacing: '0.02em' }}>
                        {selfTodayAttendance.isCurrentlyIn ? 'Clocked Out' : selfTodayAttendance.hasCheckedIn ? 'Clocked Out' : 'Not Clocked In'}
                      </span>
                    </div>
                  </div>
                  {/* 3 info boxes */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                    {[
                      { label: 'Status', value: selfTodayAttendance.isCurrentlyIn ? 'Clocked In' : selfTodayAttendance.hasCheckedIn ? 'Clocked Out' : 'Not Clocked In', isStatus: true },
                      { label: 'First Clock In', value: formatTime(selfTodayAttendance.checkInTimeDisplay || selfTodayAttendance.checkInTime || employeeAttendanceToday.checkInTime) || '--', isStatus: false },
                      { label: 'Last Clock Out', value: formatTime(selfTodayAttendance.checkOutTimeDisplay || selfTodayAttendance.checkOutTime || employeeAttendanceToday.checkOutTime) || '--', isStatus: false },
                    ].map(({ label, value, isStatus }) => (
                      <div key={label} style={{ background: '#F8F9FC', borderRadius: 12, border: '1px solid #E5E7EB', padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 6 }}>{label}</div>
                        {isStatus ? (
                          <span style={{ fontSize: 13, fontWeight: 600, color: selfTodayAttendance.isCurrentlyIn ? '#1368FF' : selfTodayAttendance.hasCheckedIn ? '#10B981' : '#6B7280' }}>{value}</span>
                        ) : (
                          <span style={{ fontSize: 18, fontWeight: 700, color: '#1E2875' }}>{value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {/* BIOMETRIC_MODE: Clock In/Out button hidden — re-enable for WFH or device offline scenarios
                    <Button type="primary" loading={attendanceActionLoading} onClick={handleAttendanceAction} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>} style={{ flex: 2, height: 44, borderRadius: 24, fontSize: 14, fontWeight: 600, background: '#1368FF', border: 'none' }}>
                      {selfTodayAttendance.isCurrentlyIn ? 'Clock Out' : 'Clock In Now'}
                    </Button>
                    */}
                    <div style={{ flex: 2, height: 44, borderRadius: 24, background: '#F0F7FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#1E40AF' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M12 6v4l2 2"/></svg>
                      Biometric Active
                    </div>
                    <Button onClick={() => navigate('/attendance')} style={{ flex: 1, height: 44, borderRadius: 24, fontSize: 13, fontWeight: 600, color: '#1368FF', border: '1px solid #1368FF', background: '#fff' }}>View Details</Button>
                  </div>
                </div>
              )}

              {(isEmployee) && (() => {
                const pendingLeaves = employeeRecentLeaves.filter(l => l.status === 'pending');
                const latestPending = pendingLeaves[0];
                const leaveTypeColor = latestPending
                  ? (latestPending.leaveType || '').toLowerCase().includes('casual') ? '#3B82F6'
                    : (latestPending.leaveType || '').toLowerCase().includes('sick') ? '#EF4444'
                    : '#8B5CF6'
                  : '#3B82F6';
                const timeAgo = latestPending?.appliedAt ? (() => {
                  const diff = dayjs().diff(dayjs(latestPending.appliedAt), 'minute');
                  if (diff < 60) return diff <= 1 ? 'Just now' : `${diff} minutes ago`;
                  if (diff < 1440) return `${Math.floor(diff / 60)} hour${Math.floor(diff / 60) !== 1 ? 's' : ''} ago`;
                  return `${Math.floor(diff / 1440)} day${Math.floor(diff / 1440) !== 1 ? 's' : ''} ago`;
                })() : '';
                return (
                  <div style={{ background: '#ffffff', borderRadius: 16, border: `1px solid ${themeTokens.colors.borders}`, boxShadow: themeTokens.shadows.standard, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6' }}>
                      <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.textPrimary }}>Pending Leave Requests</Text>
                      {pendingLeaves.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#D97706', padding: '3px 10px', borderRadius: 20 }}>
                          {pendingLeaves.length} Pending
                        </span>
                      )}
                    </div>

                    {/* Single leave card or empty state */}
                    <div style={{ padding: '14px 20px' }}>
                      {latestPending ? (
                        <div style={{ background: '#F8F9FC', borderRadius: 12, border: '1px solid #E5E7EB', padding: '14px 16px' }}>
                          {/* Leave type + status badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: leaveTypeColor }}>{latestPending.leaveType || 'Leave'}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#D97706', background: '#FEF3C7', padding: '2px 8px', borderRadius: 20 }}>Pending</span>
                          </div>
                          {/* Date range + days */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
                            <Calendar size={12} color="#6B7280" />
                            <span>
                              {dayjs(latestPending.fromDate).format('MMM D')}
                              {latestPending.toDate && latestPending.toDate !== latestPending.fromDate
                                ? `–${dayjs(latestPending.toDate).format('D, YYYY')}`
                                : `, ${dayjs(latestPending.fromDate).format('YYYY')}`}
                            </span>
                            <span style={{ color: '#374151', fontWeight: 600 }}>
                              · {latestPending.days} day{latestPending.days !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {/* Reason */}
                          {latestPending.reason && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{latestPending.reason}</span>
                            </div>
                          )}
                          {/* Applied time */}
                          {timeAgo && (
                            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Applied {timeAgo}</div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: '16px 0', textAlign: 'center' }}>
                          <Text type="secondary" style={{ fontSize: 13 }}>No pending leave requests.</Text>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '12px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Button
                        type="link"
                        style={{ padding: 0, fontSize: 13, fontWeight: 600, color: '#1368FF', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => navigate('/leave')}
                      >
                        View All Leaves
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1368FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* ── Attendance Trend (left column, below Pending Leave) ── */}
              {(isEmployee) && (
                <div style={{ background: '#ffffff', borderRadius: 16, border: `1px solid ${themeTokens.colors.borders}`, boxShadow: themeTokens.shadows.standard, padding: '20px 20px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1E2875' }}>Attendance Trend</span>
                    <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>Last 6 months</span>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart
                      data={dashboard?.attendance?.trend?.length > 0 ? dashboard.attendance.trend : [
                        { month: 'Oct', present: 0 }, { month: 'Nov', present: 0 }, { month: 'Dec', present: 0 },
                        { month: 'Jan', present: 0 }, { month: 'Feb', present: 0 }, { month: 'Mar', present: 0 },
                      ]}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1368FF" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#1368FF" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickCount={5} />
                      <RechartsTooltip
                        contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                        formatter={(val) => [`${val} days`, 'Present']}
                      />
                      <Area
                        type="monotone"
                        dataKey="present"
                        stroke="#1368FF"
                        strokeWidth={2.5}
                        fill="url(#attendGrad)"
                        dot={false}
                        activeDot={{ r: 5, fill: '#1368FF', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Space>
          </Col>

          {/* Sidebar Column — hidden for admin and manager (manager has dedicated layout) */}
          {!isManager && (
          <Col xs={24} lg={8}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {/* Quick Calendar */}
              <div style={{
                background: '#ffffff',
                borderRadius: 14,
                border: `1px solid ${themeTokens.colors.borders}`,
                boxShadow: themeTokens.shadows.standard,
                overflow: 'hidden',
              }}>
                {renderCustomCalendar(true)}
              </div>

              {/* Manager: Pending Leave Approvals — moved to dedicated manager layout */}
              {false && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  border: `1px solid ${themeTokens.colors.borders}`,
                  boxShadow: themeTokens.shadows.standard,
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.textPrimary }}>Pending Leave Approvals</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {pendingApprovals.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: '#EBF4FF', color: '#1368FF', padding: '3px 10px', borderRadius: 20 }}>
                          {pendingApprovals.length} requests awaiting review
                        </span>
                      )}
                      <Button type="link" size="small" style={{ padding: 0, fontSize: 12, color: themeTokens.colors.primary, fontWeight: 600 }} onClick={() => navigate('/leave/approvals')}>
                        View All
                      </Button>
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid #f3f4f6` }}>
                    {pendingApprovals.length > 0 ? (
                      pendingApprovals.slice(0, 4).map((leave, i) => {
                        const empName = getLeaveEmployeeName(leave);
                        const initials = empName.charAt(0).toUpperCase();
                        const hFrom = leave.fromDate ? dayjs(leave.fromDate) : null;
                        const hTo = leave.toDate ? dayjs(leave.toDate) : null;
                        const dateRange = hFrom && hTo
                          ? `${hFrom.format('MMM D')}–${hTo.format('D, YYYY')}`
                          : hFrom ? hFrom.format('MMM D, YYYY') : '--';
                        const leaveTypeCap = (leave.leaveType || '').charAt(0).toUpperCase() + (leave.leaveType || '').slice(1);
                        const leaveTypeColor = (leave.leaveType || '').toLowerCase().includes('sick') ? '#ef4444'
                          : (leave.leaveType || '').toLowerCase().includes('casual') ? '#3b82f6'
                          : '#8b5cf6';
                        const leaveTypeBg = (leave.leaveType || '').toLowerCase().includes('sick') ? '#fef2f2'
                          : (leave.leaveType || '').toLowerCase().includes('casual') ? '#eff6ff'
                          : '#f5f3ff';
                        const timeAgo = leave.appliedAt ? (() => {
                          const diff = dayjs().diff(dayjs(leave.appliedAt), 'hour');
                          if (diff < 1) return 'Just now';
                          if (diff < 24) return `${diff} hours ago`;
                          const days = Math.floor(diff / 24);
                          return `${days} day${days > 1 ? 's' : ''} ago`;
                        })() : '';
                        return (
                          <div key={leave.id} style={{
                            padding: '14px 16px',
                            borderBottom: i < Math.min(pendingApprovals.length, 4) - 1 ? '1px solid #f3f4f6' : 'none',
                          }}>
                            {/* Avatar + name row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: `linear-gradient(135deg, ${themeTokens.colors.primary} 0%, #0052CC 100%)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontSize: 14, fontWeight: 700,
                              }}>
                                {initials}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary }}>{empName}</div>
                                <div style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>{timeAgo}</div>
                              </div>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                color: leaveTypeColor, background: leaveTypeBg,
                              }}>
                                {leaveTypeCap || 'Leave'}
                              </span>
                            </div>
                            {/* Details row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10, marginLeft: 46 }}>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duration</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: themeTokens.colors.textPrimary }}>{leave.days || 1} day{(leave.days || 1) !== 1 ? 's' : ''}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dates</div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: themeTokens.colors.textPrimary }}>{dateRange}</div>
                              </div>
                            </div>
                            {leave.reason && (
                              <div style={{ fontSize: 11, color: themeTokens.colors.textTertiary, marginLeft: 46, marginBottom: 10, fontStyle: 'italic' }}>
                                &ldquo;{leave.reason}&rdquo;
                              </div>
                            )}
                            {/* Approve / Reject buttons */}
                            <div style={{ display: 'flex', gap: 8, marginLeft: 46 }}>
                              <Button
                                type="primary"
                                size="small"
                                loading={leaveActionLoading[leave.id + '_approve']}
                                onClick={() => handleLeaveApprove(leave.id)}
                                style={{
                                  flex: 1, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 600,
                                  background: '#1368FF', border: 'none',
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                loading={leaveActionLoading[leave.id + '_reject']}
                                onClick={() => handleLeaveReject(leave.id)}
                                style={{
                                  flex: 1, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 600,
                                  color: '#ef4444', border: '1px solid #ef4444', background: '#fff',
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: themeTokens.colors.textTertiary, fontSize: 13 }}>
                        No pending requests to review.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Upcoming Holidays (HR & Admin) */}
              {(isHR || isAdmin) && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  border: `1px solid ${themeTokens.colors.borders}`,
                  boxShadow: themeTokens.shadows.standard,
                  overflow: 'hidden',
                }}>
                  {/* Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)',
                    padding: '12px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={15} color="rgba(255,255,255,0.9)" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Upcoming Holidays</span>
                    </div>
                    {calendarHolidays.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20 }}>
                        {calendarHolidays.length} Days
                      </span>
                    )}
                  </div>
                  {/* List */}
                  <div style={{ padding: '8px 0', maxHeight: 230, overflowY: 'auto' }}>
                    {(() => {
                      const today = dayjs().startOf('day');
                      const upcoming = [...calendarHolidays]
                        .filter(h => !dayjs(h.date).isBefore(today))
                        .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))
                        .slice(0, 5);
                      if (upcoming.length === 0) return (
                        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                          <Text type="secondary" style={{ fontSize: 13 }}>No upcoming holidays.</Text>
                        </div>
                      );
                      return upcoming.map((holiday, i) => {
                        const hDay = dayjs(holiday.date);
                        const daysAway = hDay.diff(today, 'day');
                        return (
                          <div key={holiday.id || holiday.date} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 16px',
                            borderBottom: i < upcoming.length - 1 ? '1px solid #f3f4f6' : 'none',
                          }}>
                            <div style={{ textAlign: 'center', flexShrink: 0, width: 36 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: themeTokens.colors.primary, letterSpacing: '0.08em' }}>{hDay.format('MMM')}</div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{hDay.format('DD')}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{holiday.name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{hDay.format('dddd')}</div>
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: themeTokens.colors.textTertiary, flexShrink: 0, textAlign: 'right' }}>
                              {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway} days away`}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* Manager: Onboarding / Offboarding — moved to dedicated manager layout */}
              {false && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  border: `1px solid ${themeTokens.colors.borders}`,
                  boxShadow: themeTokens.shadows.standard,
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.textPrimary }}>Onboarding/Offboarding</Text>
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', padding: '3px 10px', borderRadius: 20 }}>
                      {managerOnboarding.length + managerOffboarding.length} events coming up
                    </span>
                  </div>
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '4px 0' }}>
                    {[
                      ...managerOnboarding.slice(0, 3).map(item => ({ ...item, _type: 'Onboarding' })),
                      ...managerOffboarding.slice(0, 3).map(item => ({ ...item, _type: 'Offboarding' })),
                    ].length > 0 ? [
                      ...managerOnboarding.slice(0, 3).map(item => ({ ...item, _type: 'Onboarding' })),
                      ...managerOffboarding.slice(0, 3).map(item => ({ ...item, _type: 'Offboarding' })),
                    ].map((item, i, arr) => {
                      const initials = `${item.firstName || ''}${item.lastName || ''}`.trim().charAt(0).toUpperCase() || '?';
                      const isOnboarding = item._type === 'Onboarding';
                      const typeColor = isOnboarding ? '#10b981' : '#f59e0b';
                      const typeBg = isOnboarding ? '#ecfdf5' : '#fffbeb';
                      const dateVal = item.startDate || item.endDate || item.date || item.joiningDate || item.exitDate;
                      const dateDisplay = dateVal ? dayjs(dateVal).format('MMM D, YYYY') : '';
                      return (
                        <div key={item.id || i} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 16px',
                          borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
                        }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                            background: typeBg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: typeColor, fontSize: 13, fontWeight: 700,
                          }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.firstName} {item.lastName}
                            </div>
                            {item.designation && (
                              <div style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>{item.designation}</div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: typeColor, background: typeBg }}>
                              {item._type}
                            </span>
                            {dateDisplay && (
                              <div style={{ fontSize: 10, color: themeTokens.colors.textTertiary, marginTop: 2 }}>{dateDisplay}</div>
                            )}
                          </div>
                        </div>
                      );
                    }) : (
                      <div style={{ padding: '20px 16px', textAlign: 'center', color: themeTokens.colors.textTertiary, fontSize: 13 }}>
                        No onboarding or offboarding events.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(isEmployee && !isAdmin && !isHR) && (() => {
                const today = dayjs().startOf('day');
                const upcomingHols = (dashboard?.holidays?.upcoming || calendarHolidays.filter(h => !dayjs(h.date).isBefore(today))).slice(0, 3);
                return (
                  <div style={{ background: '#ffffff', borderRadius: 16, border: `1px solid ${themeTokens.colors.borders}`, boxShadow: themeTokens.shadows.standard, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
                      <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.textPrimary }}>Upcoming Holidays</Text>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                      {upcomingHols.length > 0 ? upcomingHols.map((h, i) => {
                        const hDay = dayjs(h.date);
                        const daysAway = hDay.diff(today, 'day');
                        return (
                          <div key={h.id || h.date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < upcomingHols.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EBF3FF', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Calendar size={16} color="#1368FF" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{h.name}</div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>{hDay.format('MMM D, YYYY')}</div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap' }}>
                              in {daysAway === 0 ? 'Today' : daysAway === 1 ? '1 day' : `${daysAway} days`}
                            </span>
                          </div>
                        );
                      }) : (
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                          <Text type="secondary" style={{ fontSize: 13 }}>No upcoming holidays.</Text>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {(isEmployee) && (() => {
                const managerName = [
                  employeeProfile?.manager?.firstName || employeeProfile?.['manager.firstName'],
                  employeeProfile?.manager?.lastName || employeeProfile?.['manager.lastName'],
                ].filter(Boolean).join(' ') || '--';
                const initials = ((employeeProfile.firstName || '?')[0] + (employeeProfile.lastName || '?')[0]).toUpperCase();
                return (
                  <div style={{ background: '#ffffff', borderRadius: 16, border: `1px solid ${themeTokens.colors.borders}`, boxShadow: themeTokens.shadows.standard, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
                      <Text style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.textPrimary }}>Profile Snapshot</Text>
                    </div>
                    <div style={{ padding: '16px 20px' }}>
                      {/* Avatar + name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        {employeeProfile.avatarUrl ? (
                          <img src={employeeProfile.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #1368FF, #0052CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700 }}>{initials}</div>
                        )}
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{employeeProfile.firstName} {employeeProfile.lastName}</div>
                          <div style={{ fontSize: 12, color: '#6B7280' }}>{employeeProfile.designation || '--'}</div>
                        </div>
                      </div>
                      {/* Details */}
                      {[
                        { label: 'Employee ID', value: employeeProfile.employeeId || '--' },
                        { label: 'Department', value: employeeProfile.department || '--' },
                        { label: 'Reporting Manager', value: managerName },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{value}</div>
                        </div>
                      ))}
                      <Button type="link" style={{ padding: 0, fontSize: 13, fontWeight: 600, color: '#1368FF', marginTop: 4 }} onClick={() => navigate('/settings')}>
                        View Full Profile →
                      </Button>
                    </div>
                  </div>
                );
              })()}



            </Space>
          </Col>
          )}
        </Row>
      </Space>
    </Layout>
  );
}
