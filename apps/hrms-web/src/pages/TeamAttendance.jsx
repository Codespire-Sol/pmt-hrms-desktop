import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography,
  Space,
  DatePicker,
  Row,
  Col,
  Breadcrumb,
  Empty,
  Grid,
  Input,
  Select,
} from 'antd';

const { useBreakpoint } = Grid;
import {
  Users,
  UserCheck,
  UserX,
  Plane,
  TrendingUp,
  Clock,
  Download,
  Search,
  Filter,
} from 'lucide-react';
import dayjs from 'dayjs';
import { message } from 'antd';
import { attendanceAPI } from '../api/attendance';
import Layout from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { themeTokens } from '../styles/theme';

const { Title, Text } = Typography;

// Figma avatar gradient palette — cycles through for each employee
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)',
  'linear-gradient(135deg, #374151 0%, #6B7280 100%)',
  'linear-gradient(135deg, #1368FF 0%, #00B4D8 100%)',
  'linear-gradient(135deg, #064E3B 0%, #10b981 100%)',
  'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)',
  'linear-gradient(135deg, #6D28D9 0%, #A78BFA 100%)',
  'linear-gradient(135deg, #DC2626 0%, #F87171 100%)',
  'linear-gradient(135deg, #B45309 0%, #F59E0B 100%)',
];

function getAvatarGradient(index) {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
}

function getInitials(name = '') {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

// Status config matching Figma exactly
const STATUS_CONFIG = {
  Present:    { label: 'Present',   bg: '#EBF5FF', color: '#1368FF', border: '#1368FF' },
  'Checked In': { label: 'Present', bg: '#EBF5FF', color: '#1368FF', border: '#1368FF' },
  Late:       { label: 'Late',      bg: '#FFF4E0', color: '#F59E0B', border: '#F59E0B' },
  Absent:     { label: 'Absent',    bg: '#1E293B', color: '#FFFFFF', border: '#1E293B' },
  'On Leave': { label: 'On Leave',  bg: 'transparent', color: '#374151', border: 'transparent' },
  'Half Day': { label: 'Half Day',  bg: 'transparent', color: '#374151', border: 'transparent' },
  Incomplete: { label: 'Incomplete',bg: '#FFF4E0', color: '#F59E0B', border: '#F59E0B' },
};

function getStatusConfig(status) {
  return STATUS_CONFIG[status] || { label: status, bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' };
}

function formatWorkingHours(checkIn, checkOut, hoursDisplay) {
  if (hoursDisplay) return hoursDisplay;
  if (!checkIn || !checkOut) return null;
  const diffMin = dayjs(checkOut).diff(dayjs(checkIn), 'minute');
  if (diffMin <= 0) return null;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `${h}h ${m}m`;
}

const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';

export default function TeamAttendance() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user } = useAuth();

  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  const loadTeamAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const response = await attendanceAPI.getTeamAttendance(user.id, {
        date: selectedDate.format('YYYY-MM-DD'),
      });
      setAttendance(Array.isArray(response?.data) ? response.data : []);
      setSummary(response?.summary || null);
    } catch (error) {
      console.error('Failed to load team attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, user.id]);

  useEffect(() => {
    loadTeamAttendance();
  }, [loadTeamAttendance]);

  // Derived stats
  const stats = {
    total:          summary?.total          ?? attendance.length,
    present:        summary?.present        ?? attendance.filter(a => ['Present', 'Checked In'].includes(a.status)).length,
    absent:         summary?.absent         ?? attendance.filter(a => a.status === 'Absent').length,
    onLeave:        summary?.onLeave ?? summary?.on_leave ?? attendance.filter(a => {
                      const s = String(a?.status || '').toLowerCase();
                      return s === 'on leave' || s === 'leave' || Boolean(a?.isOnLeave);
                    }).length,
    attendanceRate: summary?.attendanceRate
                      ?? (attendance.length > 0
                          ? Math.round((attendance.filter(a => ['Present', 'Checked In', 'Late', 'Half Day'].includes(a.status)).length / attendance.length) * 100)
                          : 0),
  };

  // Derived department options for filter
  const departments = [...new Set(attendance.map(a => a.employee?.department).filter(Boolean))];

  // Filtered records
  const filtered = attendance.filter(record => {
    const name = record.employee?.name || '';
    const code = record.employee?.employeeCode || '';
    const dept = record.employee?.department || '';
    const matchSearch = !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase()) || code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDept = !deptFilter || dept === deptFilter;
    const matchStatus = !statusFilter || record.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  async function handleExport() {
    setExportLoading(true);
    try {
      const response = await attendanceAPI.export({ date: selectedDate.format('YYYY-MM-DD') });
      const blob = response?.data instanceof Blob ? response.data : new Blob([response?.data || ''], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team_attendance_${selectedDate.format('YYYY-MM-DD')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      message.success('Export downloaded successfully');
    } catch (e) {
      console.error('Export failed:', e);
      message.error('Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  }

  const STAT_CARDS = [
    { label: 'Total Team',      value: stats.total,          icon: Users,      iconBg: 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)', iconShadow: '0 4px 12px rgba(19,104,255,0.25)' },
    { label: 'Present',         value: stats.present,        icon: UserCheck,  iconBg: 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)', iconShadow: '0 4px 12px rgba(19,104,255,0.25)' },
    { label: 'Absent',          value: stats.absent,         icon: UserX,      iconBg: 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)', iconShadow: '0 4px 12px rgba(19,104,255,0.25)' },
    { label: 'On Leave',        value: stats.onLeave,        icon: Plane,      iconBg: 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)', iconShadow: '0 4px 12px rgba(19,104,255,0.25)' },
    { label: 'Attendance Rate', value: `${stats.attendanceRate}%`, icon: TrendingUp, iconBg: 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)', iconShadow: '0 4px 12px rgba(19,104,255,0.25)' },
  ];

  const TABLE_COLUMNS = ['EMPLOYEE', 'DEPARTMENT', 'TIME IN', 'TIME OUT', 'WORKING HOURS', 'STATUS'];
  const GRID_COLS = '2.2fr 1.1fr 1fr 1fr 1.2fr 0.8fr';

  return (
    <Layout>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>

        {/* ── Breadcrumb ── */}
        <Breadcrumb
          items={[
            { title: <Link to="/dashboard">Dashboard</Link> },
            { title: 'Team Attendance' },
          ]}
        />

        {/* ── Page Header ── */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          gap: 12,
        }}>
          <div>
            <Title
              level={isMobile ? 3 : 2}
              style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}
            >
              Team Attendance
            </Title>
            <Text style={{ color: themeTokens.colors.textTertiary, fontSize: 14, marginTop: 2, display: 'block' }}>
              Track and manage your team&apos;s attendance records
            </Text>
          </div>

          {/* Export Report button */}
          <button
            onClick={handleExport}
            disabled={exportLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              background: exportLoading ? '#93b4f7' : BTN_GRADIENT,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              cursor: exportLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(19,104,255,0.30)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Download size={16} strokeWidth={2.2} />
            {exportLoading ? 'Exporting...' : 'Export Report'}
          </button>
        </div>

        {/* ── Stat Cards ── */}
        <Row gutter={[16, 16]}>
          {STAT_CARDS.map(({ label, value, icon: Icon, iconBg, iconShadow }) => (
            <Col xs={12} sm={12} md={isMobile ? 12 : 24 / STAT_CARDS.length} key={label} style={{ flex: '1 1 0' }}>
              <div style={{
                background: '#fff',
                borderRadius: 14,
                border: `1px solid ${themeTokens.colors.borders}`,
                boxShadow: themeTokens.shadows.standard,
                padding: '18px 20px',
                height: '100%',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: themeTokens.colors.textTertiary,
                      display: 'block',
                      marginBottom: 6,
                    }}>
                      {label}
                    </Text>
                    <Title level={3} style={{
                      margin: 0,
                      fontSize: 30,
                      fontWeight: 700,
                      lineHeight: 1.1,
                      color: themeTokens.colors.heading,
                    }}>
                      {value}
                    </Title>
                  </div>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: iconShadow,
                  }}>
                    <Icon size={20} color="#fff" strokeWidth={2} />
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        {/* ── Search & Filter Bar (separate card) ── */}
        <div style={{
          background: '#fff',
          borderRadius: 14,
          border: `1px solid ${themeTokens.colors.borders}`,
          boxShadow: themeTokens.shadows.standard,
          padding: isMobile ? '14px 16px' : '16px 24px',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            {/* Date picker */}
            <DatePicker
              value={selectedDate}
              onChange={v => v && setSelectedDate(v)}
              allowClear={false}
              style={{ borderRadius: 8, width: isMobile ? '100%' : 148, flexShrink: 0 }}
              suffixIcon={<Clock size={14} color={themeTokens.colors.textTertiary} />}
            />

            {/* Search — takes remaining space */}
            <Input
              placeholder="Search by name or employee ID..."
              prefix={<Search size={15} color={themeTokens.colors.textTertiary} />}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ borderRadius: 8, flex: isMobile ? undefined : 1, minWidth: 200 }}
              allowClear
            />

            {/* Department filter */}
            <Select
              placeholder="Department"
              value={deptFilter}
              onChange={setDeptFilter}
              allowClear
              style={{ borderRadius: 8, width: isMobile ? '100%' : 170 }}
              options={departments.map(d => ({ label: d, value: d }))}
              suffixIcon={<Filter size={13} color={themeTokens.colors.textTertiary} />}
              notFoundContent={<span style={{ fontSize: 12, color: '#9ca3af' }}>No departments</span>}
            />

            {/* Status filter */}
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ borderRadius: 8, width: isMobile ? '100%' : 130 }}
              options={Object.keys(STATUS_CONFIG).map(s => ({ label: STATUS_CONFIG[s].label, value: s }))}
            />
          </div>
        </div>

        {/* ── Table Card ── */}
        <div style={{
          background: themeTokens.colors.appGradient,
          borderRadius: 16,
          border: `1px solid ${themeTokens.colors.borders}`,
          boxShadow: themeTokens.shadows.standard,
          overflow: 'hidden',
        }}>

          {/* Record count */}
          <div style={{
            padding: '12px 24px 10px',
            borderBottom: loading || filtered.length === 0 ? undefined : `1px solid ${themeTokens.colors.borders}`,
          }}>
            <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
              {!loading && (
                <>
                  Showing{' '}
                  <span style={{ color: themeTokens.colors.textSecondary, fontWeight: 600 }}>{filtered.length}</span>
                  {' '}of{' '}
                  <span style={{ color: themeTokens.colors.textSecondary, fontWeight: 600 }}>{attendance.length}</span>
                  {' '}records for{' '}
                  <span style={{ color: themeTokens.colors.textSecondary, fontWeight: 600 }}>
                    {selectedDate.format('MMMM D, YYYY')}
                  </span>
                </>
              )}
            </Text>
          </div>

          {/* Column headers — desktop */}
          {!loading && filtered.length > 0 && !isMobile && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: GRID_COLS,
              padding: '10px 24px',
              borderBottom: `1px solid ${themeTokens.colors.borders}`,
              background: themeTokens.colors.appBackground,
            }}>
              {TABLE_COLUMNS.map(h => (
                <Text key={h} style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: themeTokens.colors.textTertiary,
                }}>
                  {h}
                </Text>
              ))}
            </div>
          )}

          {/* Rows */}
          {loading ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: `3px solid ${themeTokens.colors.borders}`,
                borderTopColor: themeTokens.colors.primary,
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 12px',
              }} />
              <Text style={{ color: themeTokens.colors.textTertiary }}>Loading attendance…</Text>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <Empty description="No attendance records found." />
            </div>
          ) : (
            filtered.map((record, idx) => {
              const isLast = idx === filtered.length - 1;
              const name = record.employee?.name || 'Unknown';
              const empCode = record.employee?.employeeCode || '';
              const dept = record.employee?.department || '—';
              const normalizedStatus = record.status || 'Absent';
              const sc = getStatusConfig(normalizedStatus);

              // Raw checkIn/checkOut from API encode IST wall-clock as UTC ISO
              // strings. Format with timeZone:'UTC' to read the wall-clock as-is;
              // dayjs.format() would re-apply browser-local TZ and double-shift.
              const checkInDisplay  = record.checkInDisplay  || (record.checkIn
                ? new Date(record.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
                : null);
              const checkOutDisplay = record.checkOutDisplay || (record.checkOut
                ? new Date(record.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' })
                : null);
              const workingHours = formatWorkingHours(record.checkIn, record.checkOut, record.workingHoursDisplay);

              return (
                <div
                  key={record.id || idx}
                  style={{
                    display: isMobile ? 'flex' : 'grid',
                    gridTemplateColumns: isMobile ? undefined : GRID_COLS,
                    flexDirection: isMobile ? 'column' : undefined,
                    alignItems: isMobile ? undefined : 'center',
                    padding: isMobile ? '14px 20px' : '14px 24px',
                    gap: isMobile ? 8 : 0,
                    borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                    background: 'linear-gradient(180deg, #F8F9FC 0%, #FFFFFF 100%)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F0F4FF'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(180deg, #F8F9FC 0%, #FFFFFF 100%)'; }}
                >
                  {/* Employee cell */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: getAvatarGradient(idx),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13, color: '#fff',
                    }}>
                      {getInitials(name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <Text strong style={{ fontSize: 14, display: 'block', color: themeTokens.colors.textPrimary, lineHeight: 1.3 }}>
                        {name}
                      </Text>
                      <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary, display: 'block' }}>
                        {empCode}
                      </Text>
                    </div>
                  </div>

                  {isMobile ? (
                    /* ── Mobile layout ── */
                    <>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>{dept}</Text>
                        <StatusBadge sc={sc} label={sc.label} />
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <TimeCell label="IN" value={checkInDisplay} />
                        <TimeCell label="OUT" value={checkOutDisplay} />
                        {workingHours && (
                          <Text style={{ fontSize: 13, fontWeight: 600, color: themeTokens.colors.textPrimary }}>{workingHours}</Text>
                        )}
                      </div>
                    </>
                  ) : (
                    /* ── Desktop grid cells ── */
                    <>
                      {/* Department */}
                      <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary }}>{dept}</Text>

                      {/* Time In */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {checkInDisplay
                          ? <><Clock size={13} color={themeTokens.colors.textTertiary} strokeWidth={2} /><Text style={{ fontSize: 13 }}>{checkInDisplay}</Text></>
                          : <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>–</Text>
                        }
                      </div>

                      {/* Time Out */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {checkOutDisplay
                          ? <><Clock size={13} color={themeTokens.colors.textTertiary} strokeWidth={2} /><Text style={{ fontSize: 13 }}>{checkOutDisplay}</Text></>
                          : <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>–</Text>
                        }
                      </div>

                      {/* Working Hours */}
                      <div>
                        {workingHours
                          ? <Text style={{ fontSize: 13, fontWeight: 600, color: themeTokens.colors.textPrimary }}>{workingHours}</Text>
                          : <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>–</Text>
                        }
                      </div>

                      {/* Status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StatusBadge sc={sc} label={sc.label} />
                        {(record?.manualCorrection || String(record?.tag || '').toLowerCase() === 'regularized') && (
                          <span style={{
                            display: 'inline-block', padding: '2px 7px', borderRadius: 4,
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            background: '#EBF5FF', color: '#1368FF', border: '1px solid #1368FF40',
                          }}>REG</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

      </Space>
    </Layout>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ sc, label }) {
  const isGhost = sc.bg === 'transparent';
  return (
    <span style={{
      display: 'inline-block',
      padding: isGhost ? '0' : '3px 10px',
      borderRadius: isGhost ? 0 : 6,
      fontSize: 12,
      fontWeight: 600,
      background: sc.bg,
      color: sc.color,
      border: isGhost ? 'none' : `1px solid ${sc.border}`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function TimeCell({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary, fontWeight: 600 }}>{label}:</Text>
      {value
        ? <Text style={{ fontSize: 13 }}>{value}</Text>
        : <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>–</Text>
      }
    </div>
  );
}
