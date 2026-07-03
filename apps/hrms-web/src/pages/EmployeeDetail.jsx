import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Tabs,
  Statistic,
  Row,
  Col,
  Card,
  Typography,
  Space,
  Button,
  Avatar,
  Tag,
  Breadcrumb,
  Divider,
  Empty,
  Skeleton,
  Modal,
  Table,
  DatePicker,
  Select,
  Input,
  Upload,
  Tooltip,
  message,
  Grid,
  Form,
  Alert,
  Popconfirm,
} from 'antd';

const { useBreakpoint } = Grid;
import {
  Mail,
  Phone,
  Briefcase,
  Building2,
  Edit2,
  ChevronRight,
  Fingerprint,
  User,
  Calendar,
  Users,
  MapPin,
  Globe,
  Heart,
  Smartphone,
  ShieldCheck,
  FileText,
  UploadCloud,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ThumbsUp,
  Save,
  Trash2,
} from 'lucide-react';
import { employeeAPI } from '../api/employees';
import { hrAPI } from '../api/hr';
import { managerAPI } from '../api/manager';
import Layout from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { themeTokens } from '../styles/theme';
import { normalizeAvatarUrl, normalizeFileUrl } from '../utils/auth';
import PhoneInput, { getPhoneValidator } from '../components/common/PhoneInput';
import { toTitleCase } from '../utils/name';
import { broadcastDataRefresh } from '../utils/realtime';

import dayjs from 'dayjs';

const COUNTRIES = [
  { value: 'India', flag: '🇮🇳' }, { value: 'United States', flag: '🇺🇸' },
  { value: 'United Kingdom', flag: '🇬🇧' }, { value: 'United Arab Emirates', flag: '🇦🇪' },
  { value: 'Canada', flag: '🇨🇦' }, { value: 'Australia', flag: '🇦🇺' },
  { value: 'Singapore', flag: '🇸🇬' }, { value: 'Germany', flag: '🇩🇪' },
  { value: 'France', flag: '🇫🇷' }, { value: 'Netherlands', flag: '🇳🇱' },
  { value: 'Saudi Arabia', flag: '🇸🇦' }, { value: 'Qatar', flag: '🇶🇦' },
  { value: 'Bahrain', flag: '🇧🇭' }, { value: 'Kuwait', flag: '🇰🇼' },
  { value: 'Oman', flag: '🇴🇲' }, { value: 'Pakistan', flag: '🇵🇰' },
  { value: 'Bangladesh', flag: '🇧🇩' }, { value: 'Sri Lanka', flag: '🇱🇰' },
  { value: 'Nepal', flag: '🇳🇵' }, { value: 'Philippines', flag: '🇵🇭' },
  { value: 'Malaysia', flag: '🇲🇾' }, { value: 'Indonesia', flag: '🇮🇩' },
  { value: 'South Africa', flag: '🇿🇦' }, { value: 'Ireland', flag: '🇮🇪' },
  { value: 'New Zealand', flag: '🇳🇿' }, { value: 'Sweden', flag: '🇸🇪' },
];

const { Title, Text } = Typography;
const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';
const UNSET_VALUES = new Set(['pending', 'unassigned', '']);
const isUnset = (val) => !val || UNSET_VALUES.has(String(val).toLowerCase().trim());

export default function EmployeeDetail() {
  const { RangePicker } = DatePicker;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { id } = useParams();
  const navigate = useNavigate();
  const { isHR, isAdmin, isManager } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timesheetOpen, setTimesheetOpen] = useState(false);
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [timesheetItems, setTimesheetItems] = useState([]);
  const [timesheetCards, setTimesheetCards] = useState({
    totalDays: 0,
    daysPresent: 0,
    incomplete: 0,
    attendanceRate: 0
  });
  const [timesheetPagination, setTimesheetPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });
  const [timesheetFilters, setTimesheetFilters] = useState({
    fromDate: dayjs().startOf('month'),
    toDate: dayjs().endOf('month'),
    status: ''
  });
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('other');
  const [reviewingDocId, setReviewingDocId] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // Leave Management state
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [leaveEditForm] = Form.useForm();
  const [leaveEditSaving, setLeaveEditSaving] = useState(false);
  const [adjustingBalance, setAdjustingBalance] = useState(null);
  const [balanceAdjustForm] = Form.useForm();
  const [balanceAdjustSaving, setBalanceAdjustSaving] = useState(false);


  // Attendance Calendar state
  const [attCalMonth, setAttCalMonth] = useState(dayjs());
  const [attCalData, setAttCalData] = useState([]);
  const [attCalHolidays, setAttCalHolidays] = useState({});
  const [attCalLoading, setAttCalLoading] = useState(false);

  // Edit Profile modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);
  const [editManagers, setEditManagers] = useState([]);

  useEffect(() => {
    loadEmployee();
    loadDocuments();
  }, [id]);

  useEffect(() => {
    if (employee?.employeeCode && id !== employee.employeeCode) {
      navigate(`/employees/${employee.employeeCode}`, { replace: true });
    }
  }, [employee]);

  useEffect(() => {
    if (employee?.id && (isHR || isAdmin)) loadLeaveSummary();
  }, [employee?.id]);


  async function loadDocuments() {
    setDocsLoading(true);
    try {
      const res = isManager
        ? await managerAPI.getTeamMemberDocuments(id)
        : await hrAPI.getEmployeeDocuments(id);
      setDocuments(res?.data?.data || res?.data || []);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }

  async function handleUploadDocument({ file }) {
    if (!file) return;
    setUploadingDoc(true);
    try {
      await hrAPI.uploadEmployeeDocument(id, file, uploadDocType);
      message.success('Document uploaded successfully.');
      loadDocuments();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Failed to upload document.');
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleReviewDocument(docId, status) {
    setReviewLoading(true);
    try {
      await hrAPI.reviewEmployeeDocument(id, docId, status, reviewNote || undefined);
      message.success(`Document marked as ${status.replace('_', ' ')}`);
      setReviewingDocId(null);
      setReviewNote('');
      loadDocuments();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Failed to update document status.');
    } finally {
      setReviewLoading(false);
    }
  }

  async function loadLeaveSummary() {
    if (!employee?.id) return;
    setLeaveLoading(true);
    try {
      const res = await hrAPI.getLeaveSummary(employee.id, { year: dayjs().year() });
      setLeaveSummary(res?.data?.data || res?.data || null);
    } catch {
      setLeaveSummary(null);
    } finally {
      setLeaveLoading(false);
    }
  }


  async function loadAttendanceCalendar(month) {
    if (!employee?.id) return;
    setAttCalLoading(true);
    try {
      const m = month || attCalMonth;
      const fromDate = m.startOf('month').format('YYYY-MM-DD');
      const toDate = m.endOf('month').format('YYYY-MM-DD');
      const [attRes, holRes] = await Promise.all([
        hrAPI.getAttendanceList({ employeeId: employee.id, fromDate, toDate, limit: 50 }),
        hrAPI.listHolidays({ year: m.year() }),
      ]);
      const items = attRes?.data?.data?.items || attRes?.data?.items || [];
      setAttCalData(items);
      const holidays = holRes?.data?.data || holRes?.data || [];
      const hMap = {};
      (Array.isArray(holidays) ? holidays : []).forEach(h => {
        const d = dayjs(h.date).format('YYYY-MM-DD');
        hMap[d] = h.name || 'Holiday';
      });
      setAttCalHolidays(hMap);
    } catch { /* ignore */ } finally {
      setAttCalLoading(false);
    }
  }

  async function handleEditLeave(values) {
    if (!editingLeave) return;
    setLeaveEditSaving(true);
    try {
      const payload = {};
      if (values.leaveType && values.leaveType !== editingLeave.leaveType) payload.leaveType = values.leaveType;
      if (values.fromDate) payload.fromDate = values.fromDate.format('YYYY-MM-DD');
      if (values.toDate) payload.toDate = values.toDate.format('YYYY-MM-DD');
      if (values.days !== undefined && Number(values.days) !== editingLeave.amount) payload.days = Number(values.days);
      if (values.session && values.session !== editingLeave.session) payload.session = values.session;
      if (values.status && values.status !== editingLeave.status) payload.status = values.status;
      if (values.reason !== undefined && values.reason !== editingLeave.reason) payload.reason = values.reason;
      if (Object.keys(payload).length === 0) {
        message.info('No changes to save.');
        setEditingLeave(null);
        return;
      }
      await hrAPI.editLeave(editingLeave.leaveId, payload);
      message.success('Leave updated successfully');
      setEditingLeave(null);
      loadLeaveSummary();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Failed to update leave');
    } finally {
      setLeaveEditSaving(false);
    }
  }

  async function handleAdjustBalance(values) {
    if (!adjustingBalance || !employee?.id) return;
    setBalanceAdjustSaving(true);
    try {
      await hrAPI.adjustLeaveBalance(employee.id, {
        leaveType: adjustingBalance.leaveTypeId,
        adjustment: Number(values.adjustment),
        reason: values.reason,
        year: dayjs().year(),
      });
      message.success('Leave balance adjusted successfully');
      setAdjustingBalance(null);
      balanceAdjustForm.resetFields();
      loadLeaveSummary();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Failed to adjust balance');
    } finally {
      setBalanceAdjustSaving(false);
    }
  }

  async function loadEmployee() {
    try {
      const response = await employeeAPI.getById(id);
      setEmployee(response.data);
    } catch (error) {
      console.error('Failed to load employee:', error);
      navigate('/employees');
    } finally {
      setLoading(false);
    }
  }

  async function openEditModal() {
    try {
      const [empRes, mgrRes] = await Promise.all([
        employeeAPI.getById(id),
        employeeAPI.getActiveManagers(),
      ]);
      const emp = empRes.data;
      setEmployee(emp);
      setEditManagers(mgrRes.data.filter(m => m.id !== id));
      editForm.setFieldsValue({
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        gender: emp.gender || undefined,
        dateOfBirth: emp.dateOfBirth ? dayjs(emp.dateOfBirth) : null,
        joiningDate: emp.joiningDate ? dayjs(emp.joiningDate) : null,
        designation: emp.designation,
        department: emp.department,
        workMode: (emp.workMode || 'office').toLowerCase(),
        country: emp.country || undefined,
        managerId: emp.managerId || 'none',
        userRole: toTitleCase(emp.userRole || emp.role || 'Employee'),
        status: (emp.status || 'active').toLowerCase(),
      });
      setEditOpen(true);
    } catch {
      message.error('Failed to load employee data');
    }
  }

  async function handleEditSave() {
    setEditSaving(true);
    try {
      const values = await editForm.validateFields();
      const payload = {
        ...values,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
        joiningDate: values.joiningDate ? values.joiningDate.format('YYYY-MM-DD') : undefined,
        managerId: values.managerId === 'none' ? null : values.managerId,
        role: values.userRole,
        gender: values.gender || null,
      };
      await employeeAPI.update(id, payload);
      message.success('Employee profile updated successfully!');
      broadcastDataRefresh('employees');
      setEditOpen(false);
      loadEmployee();
    } catch (err) {
      if (!err?.errorFields) message.error(err?.message || 'Failed to update employee');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleEditDelete() {
    setEditDeleting(true);
    try {
      await employeeAPI.hardDelete(id);
      message.success('Employee record deleted successfully.');
      broadcastDataRefresh('employees');
      navigate('/employees');
    } catch (err) {
      message.error(err?.message || 'Failed to delete employee');
    } finally {
      setEditDeleting(false);
    }
  }

  async function loadTimesheet({ page = 1, limit = timesheetPagination.limit, fromDate, toDate, status } = {}) {
    if (!employee?.id) return;
    const appliedFromDate = fromDate || timesheetFilters.fromDate;
    const appliedToDate = toDate || timesheetFilters.toDate;
    const appliedStatus = status !== undefined ? status : timesheetFilters.status;

    setTimesheetLoading(true);
    try {
      const response = await hrAPI.getAttendanceList({
        employeeId: employee.id,
        fromDate: dayjs(appliedFromDate).format('YYYY-MM-DD'),
        toDate: dayjs(appliedToDate).format('YYYY-MM-DD'),
        ...(appliedStatus ? { status: appliedStatus } : {}),
        page,
        limit
      });

      const body = response?.data || {};
      const data = body?.data || body || {};
      const items = Array.isArray(data?.items) ? data.items : [];
      const cards = data?.cards || {};
      const pagination = data?.pagination || {};

      setTimesheetItems(items);
      setTimesheetCards({
        totalDays: Number(cards?.totalDays ?? 0),
        daysPresent: Number(cards?.daysPresent ?? 0),
        incomplete: Number(cards?.incomplete ?? 0),
        attendanceRate: Number(cards?.attendanceRate ?? 0)
      });
      setTimesheetPagination({
        page: Number(pagination?.page ?? page),
        limit: Number(pagination?.limit ?? limit),
        total: Number(pagination?.total ?? items.length),
        totalPages: Number(pagination?.totalPages ?? 1)
      });
    } catch (error) {
      message.error(error?.message || 'Failed to load timesheet');
    } finally {
      setTimesheetLoading(false);
    }
  }

  const openTimesheetModal = () => {
    const month = Number(employee?.currentMonthAttendance?.month);
    const year = Number(employee?.currentMonthAttendance?.year);
    const monthBase = Number.isFinite(month) && Number.isFinite(year)
      ? dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
      : dayjs();

    const nextFilters = {
      fromDate: monthBase.startOf('month'),
      toDate: monthBase.endOf('month'),
      status: ''
    };
    setTimesheetFilters(nextFilters);
    setTimesheetOpen(true);
    loadTimesheet({
      page: 1,
      limit: timesheetPagination.limit,
      fromDate: nextFilters.fromDate,
      toDate: nextFilters.toDate,
      status: nextFilters.status
    });
  };

  const statusColors = {
    'active': 'success',
    'onboarding': 'processing',
    'notice period': 'warning',
    'notice_period': 'warning',
    'exited': 'error'
  };

  if (loading) {
    return (
      <Layout>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <Skeleton active avatar paragraph={{ rows: 2 }} />
          <Row gutter={[24, 24]}>
            <Col span={16}><Skeleton active paragraph={{ rows: 10 }} /></Col>
            <Col span={8}><Skeleton active paragraph={{ rows: 10 }} /></Col>
          </Row>
        </Space>
      </Layout>
    );
  }

  if (!employee) return null;

  const managerName = employee?.manager?.name
    || [employee?.['manager.firstName'], employee?.['manager.lastName']].filter(Boolean).join(' ')
    || '-';
  const managerEmployeeId = employee?.manager?.employeeId || employee?.['manager.employeeId'] || '-';
  const attendance = employee?.currentMonthAttendance || {};
  const leaveBalance = employee?.leaveBalance || {};
  const presentDays = Number(attendance?.presentDays ?? 0);
  const workingDays = Number(attendance?.workingDays ?? 0);
  const leaveAvailable = Number(leaveBalance?.totalAvailable ?? 0);
  const timesheetColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (value) => value ? dayjs(value).format('DD MMM YYYY') : '-'
    },
    {
      title: 'Check In',
      dataIndex: 'checkInTime',
      key: 'checkInTime',
      render: (value, record) => {
        const display = record.checkInTimeDisplay || record.checkInDisplay || (value ? dayjs(value).format('hh:mm A') : null);
        return display || '-';
      }
    },
    {
      title: 'Check Out',
      dataIndex: 'checkOutTime',
      key: 'checkOutTime',
      render: (value, record) => {
        const display = record.checkOutTimeDisplay || record.checkOutDisplay || (value ? dayjs(value).format('hh:mm A') : null);
        return display || '-';
      }
    },
    {
      title: 'Work Hours',
      dataIndex: 'workHours',
      key: 'workHours',
      render: (value) => (value ?? value === 0) ? Number(value).toFixed(2) : '-'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value) => {
        const status = String(value || '-');
        const statusColorMap = {
          present: 'success',
          checked_in: 'processing',
          incomplete: 'warning',
          absent: 'error',
          on_leave: 'purple',
          holiday: 'blue'
        };
        return (
          <Tag color={statusColorMap[status.toLowerCase()] || 'default'} style={{ borderRadius: 6, fontWeight: 600 }}>
            {status.replace('_', ' ').toUpperCase()}
          </Tag>
        );
      }
    }
  ];

  // Figma-style flat field: icon + uppercase label on top, bold value below
  const FieldCell = ({ icon: Icon, label, value }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <Icon size={13} color={themeTokens.colors.primary} strokeWidth={2} />
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: themeTokens.colors.primary,
        }}>
          {label}
        </span>
      </div>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#0f172a', wordBreak: 'break-word' }}>
        {value || '-'}
      </span>
    </div>
  );

  // Section header: icon + bold title
  const SectionHeader = ({ icon: Icon, title, color = themeTokens.colors.primary }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <Icon size={17} color={color} strokeWidth={2.2} />
      <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</span>
    </div>
  );

  // Horizontal field grid with dividers between columns
  const FieldGrid = ({ fields }) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(fields.length, 6)}, 1fr)`,
      borderTop: '1px solid #e5e7eb',
      borderLeft: '1px solid #e5e7eb',
    }}>
      {fields.map(({ icon, label, value }, i) => (
        <div
          key={i}
          style={{
            padding: '16px 20px',
            borderRight: '1px solid #e5e7eb',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <FieldCell icon={icon} label={label} value={value} />
        </div>
      ))}
    </div>
  );

  const DetailItem = ({ icon: Icon, label, value, color = themeTokens.colors.primary }) => (
    <div style={{ display: 'flex', gap: '12px', padding: '16px 0' }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        backgroundColor: `${color}08`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '2px' }}>
          {label}
        </Text>
        <Text strong style={{ fontSize: '14px', wordBreak: 'break-word' }}>{value || '-'}</Text>
      </div>
    </div>
  );

  const items = [
    {
      key: '1',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <User size={15} strokeWidth={2} />
          <span>{isMobile ? 'Overview' : 'Overview'}</span>
        </div>
      ),
      children: (() => {
        const InfoField = ({ icon: Icon, label, value, accent = false }) => (
          <div style={{
            background: '#ffffff',
            border: `1px solid ${themeTokens.colors.borders}`,
            borderRadius: 12,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minWidth: 0,
          }}>
            {/* Label row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: accent ? '#FFF0F0' : `${themeTokens.colors.primary}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={13} color={accent ? '#ef4444' : themeTokens.colors.primary} strokeWidth={2.2} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: accent ? '#ef4444' : themeTokens.colors.primary,
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </div>
            {/* Value */}
            <span style={{
              fontSize: 14, fontWeight: 600,
              color: value && value !== '-' ? '#111827' : '#9ca3af',
              lineHeight: 1.4,
              paddingLeft: 2,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}>
              {value || '—'}
            </span>
          </div>
        );

        const SectionTitle = ({ icon: Icon, title, accent = false }) => (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: accent ? '#FFF0F0' : `${themeTokens.colors.primary}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={16} color={accent ? '#ef4444' : themeTokens.colors.primary} strokeWidth={2.2} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</span>
          </div>
        );

        return (
          <div style={{ padding: '24px 0 8px' }}>

            {/* ── Personal Details ── */}
            <SectionTitle icon={User} title="Personal Details" />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 32,
            }}
              className="personal-detail-grid"
            >
              <InfoField icon={User}        label="Full Name"          value={employee.name} />
              <InfoField icon={Fingerprint} label="Employee ID"        value={employee.employeeCode || employee.employeeId} />
              <InfoField icon={Mail}        label="Work Email"         value={employee.workEmail || '—'} />
              <InfoField icon={Phone}       label="Phone Number"       value={employee.phone} />
              <InfoField icon={Calendar}    label="Date of Birth"      value={employee.dateOfBirth ? dayjs(employee.dateOfBirth).format('DD MMM YYYY') : '—'} />
              <InfoField icon={User}        label="Gender"             value={employee.gender ? (employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1)) : '—'} />
              <InfoField icon={MapPin}      label="Current Address"    value={employee.currentAddress} />
              <InfoField icon={MapPin}      label="Permanent Address"  value={employee.permanentAddress} />
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#e5e7eb', marginBottom: 28 }} />

            {/* ── Emergency Contact ── */}
            <SectionTitle icon={Heart} title="Emergency Contact" accent />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}
              className="emergency-contact-grid"
            >
              <InfoField icon={User}  label="Contact Person Name"     value={employee.emergencyContactName || employee.personal?.emergencyContactName} accent />
              <InfoField icon={Phone} label="Contact Person Number"   value={employee.emergencyContactPhone || employee.emergencyContactNumber || employee.personal?.emergencyContactPhone || employee.personal?.emergencyContactNumber} accent />
              <InfoField icon={User}  label="Relation"               value={employee.emergencyContactRelation || employee.personal?.emergencyContactRelation} accent />
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#e5e7eb', marginBottom: 28, marginTop: 28 }} />

            {/* ── Work Information ── */}
            <SectionTitle icon={Briefcase} title="Work Information" />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 24,
            }}
              className="personal-detail-grid"
            >
              <InfoField icon={ShieldCheck} label="Designation" value={employee.designation || '—'} />
              <InfoField icon={Building2} label="Department" value={employee.department || '—'} />
              <InfoField icon={MapPin} label="Work Mode" value={employee.workMode ? employee.workMode.charAt(0).toUpperCase() + employee.workMode.slice(1) : '—'} />
              <InfoField icon={Building2} label="Office Location" value={employee.workLocation || '—'} />
              <InfoField icon={Globe} label="Country" value={employee.country || '—'} />
              <InfoField icon={Building2} label="Branch" value={employee.branchName || '—'} />
              <InfoField icon={Calendar} label="Joining Date" value={employee.joiningDate ? dayjs(employee.joiningDate).format('DD MMM YYYY') : '—'} />
              <InfoField icon={Calendar} label="Exit Date" value={employee.exitDate ? dayjs(employee.exitDate).format('DD MMM YYYY') : '—'} />
              <InfoField icon={ShieldCheck} label="Employee Status" value={String(employee.status || '—').replace('_', ' ').toUpperCase()} />
            </div>

            {managerName !== '-' && (
              <>
                <div style={{ height: 1, background: '#e5e7eb', marginBottom: 28 }} />
                <SectionTitle icon={Users} title="Reporting Manager" />
                <Card hoverable style={{
                  borderRadius: '12px',
                  border: '1px solid #f0f0f0',
                  background: '#fafbfc',
                  maxWidth: 400,
                }} styles={{ body: { padding: '16px' } }}>
                  <Space size="middle">
                    <Avatar size={54} style={{
                      backgroundColor: themeTokens.colors.primary,
                      borderRadius: '12px',
                      fontWeight: 700
                    }} src={normalizeAvatarUrl(employee?.manager?.avatarUrl || employee?.['manager.avatarUrl'])}>
                      {managerName.charAt(0)}
                    </Avatar>
                    <div>
                      <Text strong style={{ fontSize: '16px', display: 'block' }}>{managerName}</Text>
                      <Text type="secondary" style={{ fontSize: '13px' }}>
                        {employee?.manager?.designation || (managerEmployeeId !== '-' ? `Employee ID: ${managerEmployeeId}` : '-')}
                      </Text>
                    </div>
                  </Space>
                </Card>
              </>
            )}

            {/* Responsive grid styles */}
            <style>{`
              @media (max-width: 480px) {
                .personal-detail-grid { grid-template-columns: 1fr !important; }
                .emergency-contact-grid { grid-template-columns: 1fr !important; }
              }
              @media (min-width: 481px) and (max-width: 900px) {
                .personal-detail-grid { grid-template-columns: repeat(2, 1fr) !important; }
                .emergency-contact-grid { grid-template-columns: repeat(2, 1fr) !important; }
              }
              .ant-tabs-nav-wrap { overflow: visible !important; }
              .ant-tabs-nav-list { flex-wrap: nowrap !important; }
              .ant-tabs-tab { white-space: nowrap !important; }
              ::-webkit-scrollbar { display: none; }
            `}</style>
          </div>
        );
      })(),
    },
    {
      key: '2',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Briefcase size={15} strokeWidth={2} />
          <span>Employment</span>
        </div>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          <Title level={5} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={18} color={themeTokens.colors.primary} /> Work Information
          </Title>
          <Row gutter={[24, 0]}>
            <Col xs={24} sm={12} md={8}>
              <DetailItem icon={ShieldCheck} label="Designation" value={isUnset(employee.designation) ? '-' : employee.designation} />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <DetailItem icon={Building2} label="Department" value={isUnset(employee.department) ? '-' : employee.department} />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <DetailItem icon={MapPin} label="Work Mode" value={employee.workMode ? employee.workMode.charAt(0).toUpperCase() + employee.workMode.slice(1) : '-'} />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <DetailItem icon={Building2} label="Office Location" value={employee.workLocation || '-'} />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <DetailItem icon={Globe} label="Country" value={employee.country || '-'} />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <DetailItem icon={Building2} label="Branch" value={employee.branchName || '-'} />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <DetailItem icon={Calendar} label="Joining Date" value={employee.joiningDate ? dayjs(employee.joiningDate).format('DD MMM YYYY') : '-'} />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <DetailItem icon={Calendar} label="Exit Date" value={employee.exitDate ? dayjs(employee.exitDate).format('DD MMM YYYY') : '-'} />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <DetailItem icon={ShieldCheck} label="Employee Status" value={String(employee.status || '-').replace('_', ' ').toUpperCase()} />
            </Col>
          </Row>

          {managerName !== '-' && (
            <>
              <Divider style={{ margin: '24px 0' }} />
              <Title level={5} style={{ marginBottom: '20px' }}>Reporting Manager</Title>
              <Card hoverable style={{
                borderRadius: '12px',
                border: '1px solid #f0f0f0',
                background: '#fafbfc'
              }} styles={{ body: { padding: '16px' } }}>
                <Space size="middle">
                  <Avatar size={54} style={{
                    backgroundColor: themeTokens.colors.primary,
                    borderRadius: '12px',
                    fontWeight: 700
                  }} src={normalizeAvatarUrl(employee?.manager?.avatarUrl || employee?.['manager.avatarUrl'])}>
                    {managerName.charAt(0)}
                  </Avatar>
                  <div>
                    <Text strong style={{ fontSize: '16px', display: 'block' }}>{managerName}</Text>
                    <Text type="secondary" style={{ fontSize: '13px' }}>
                      {employee?.manager?.designation || (managerEmployeeId !== '-' ? `Employee ID: ${managerEmployeeId}` : '-')}
                    </Text>
                  </div>
                </Space>
              </Card>
            </>
          )}
        </div>
      ),
    },
    {
      key: '3',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Users size={15} strokeWidth={2} />
          <span>{isMobile ? 'Team' : 'Team & Reports'}</span>
        </div>
      ),
      children: (
        <div style={{ padding: '24px 0' }}>
          {(employee.directReports && employee.directReports.length > 0) || (employee.teamMembers && employee.teamMembers.length > 0) ? (
            <Row gutter={[16, 16]}>
              {(employee.directReports || employee.teamMembers || []).map(report => (
                <Col xs={24} sm={12} key={report.id}>
                  <Card style={{
                    borderRadius: '12px',
                    border: '1px solid #f0f0f0',
                  }} styles={{ body: { padding: '16px' } }}>
                    <Space size="middle" style={{ width: '100%' }}>
                      <Avatar size={44} style={{
                        backgroundColor: '#f0f3ff',
                        color: themeTokens.colors.primary,
                        borderRadius: '10px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }} src={normalizeAvatarUrl(report.avatarUrl)}>
                        {report.name.charAt(0)}
                      </Avatar>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>{report.name}</Text>
                        {!isUnset(report.designation) && <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>{report.designation}</Text>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          {report.employeeCode && (
                            <Text style={{ fontSize: '11px', color: themeTokens.colors.textTertiary }}>#{report.employeeCode}</Text>
                          )}
                          {!isUnset(report.department) && (
                            <Tag style={{ margin: 0, fontSize: '11px' }}>{report.department}</Tag>
                          )}
                        </div>
                      </div>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary" style={{ fontSize: '15px' }}>No team members found</Text>}
              />
            </div>
          )}
        </div>
      )
    },
    {
      key: '4',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <FileText size={15} strokeWidth={2} />
          <span>{isMobile ? 'Docs' : 'Documents'}</span>
        </div>
      ),
      children: (() => {
        const DOC_TYPE_LABELS = {
          aadhar_card: 'Aadhar Card', pan_card: 'PAN Card',
          class_10_marksheet: '10th Marksheet', class_12_marksheet: '12th Marksheet',
          graduation_certificate: 'Graduation Certificate', offer_letter: 'Offer Letter',
          bank_details: 'Bank Details', id_proof: 'ID Proof',
          educational_certificate: 'Educational Certificate',
          relieving_letter: 'Relieving Letter', salary_slip_1: 'Salary Slip (M1)',
          salary_slip_2: 'Salary Slip (M2)', salary_slip_3: 'Salary Slip (M3)', other: 'Other',
        };
        const STATUS_CONFIG = {
          verified:           { label: 'VERIFIED',          bg: '#16a34a', color: '#fff' },
          approved:           { label: 'APPROVED',          bg: '#1368FF', color: '#fff' },
          rejected:           { label: 'REJECTED',          bg: '#ef4444', color: '#fff' },
          reupload_requested: { label: 'RE-UPLOAD REQ.',    bg: '#f59e0b', color: '#fff' },
          pending:            { label: 'PENDING REVIEW',    bg: '#9CA3AF', color: '#fff' },
        };
        return (
          <div style={{ padding: isMobile ? '16px 12px' : '24px 28px' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 0, marginBottom: 20 }}>
              <Text strong style={{ fontSize: 15, color: themeTokens.colors.textPrimary }}>Documents</Text>
              {(isHR || isAdmin) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : 'auto' }}>
                  <Select
                    value={uploadDocType}
                    onChange={setUploadDocType}
                    size="middle"
                    style={{ width: isMobile ? 'calc(100% - 100px)' : 180 }}
                    options={Object.entries(DOC_TYPE_LABELS).map(([v, l]) => ({ label: l, value: v }))}
                  />
                  <Upload showUploadList={false} accept=".pdf" beforeUpload={(file) => { handleUploadDocument({ file }); return false; }}>
                    <Button
                      type="primary"
                      icon={<UploadCloud size={14} />}
                      loading={uploadingDoc}
                      style={{ background: BTN_GRADIENT, border: 'none', borderRadius: 8, fontWeight: 600, height: 36 }}
                    >
                      Upload
                    </Button>
                  </Upload>
                </div>
              )}
            </div>

            {/* Document list */}
            {docsLoading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : documents.length > 0 ? (
              <div>
                {documents.map((doc, idx) => {
                  const sc = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
                  const isExpanded = reviewingDocId === doc.id;
                  return (
                    <div key={doc.id}>
                      {idx > 0 && <Divider style={{ margin: 0, borderColor: themeTokens.colors.borders }} />}
                      <div style={{ padding: '14px 0' }}>
                        {/* Main row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {/* Icon */}
                          <div style={{
                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                            background: `${themeTokens.colors.primary}12`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <FileText size={18} color={themeTokens.colors.primary} strokeWidth={1.8} />
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text strong style={{ display: 'block', fontSize: 13, color: themeTokens.colors.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.documentName || doc.fileName || 'Document'}
                            </Text>
                            <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>
                              {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
                              {doc.uploadedAt ? ` · ${dayjs(doc.uploadedAt).format('DD MMM YYYY')}` : ''}
                            </Text>
                            {doc.reviewNote && (
                              <Text style={{ fontSize: 11, color: '#6B7280', display: 'block', fontStyle: 'italic', marginTop: 2 }}>
                                Note: {doc.reviewNote}
                              </Text>
                            )}
                          </div>

                          {/* Status badge */}
                          <div style={{
                            background: sc.bg, color: sc.color,
                            fontSize: 10, fontWeight: 700, borderRadius: 20,
                            padding: '3px 10px', letterSpacing: '0.04em', flexShrink: 0,
                          }}>
                            {sc.label}
                          </div>

                          {/* Action icons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                            <Tooltip title="Download">
                              <Button type="text" size="small" icon={<Download size={14} color={themeTokens.colors.textTertiary} />}
                                href={normalizeFileUrl(doc.fileUrl)} download target="_blank" rel="noopener noreferrer"
                                style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                            </Tooltip>
                            <Tooltip title="View">
                              <Button type="text" size="small" icon={<Eye size={14} color={themeTokens.colors.textTertiary} />}
                                href={normalizeFileUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer"
                                style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                            </Tooltip>
                            {(isHR || isAdmin) && (
                              <Tooltip title="Review">
                                <Button
                                  type="text" size="small"
                                  icon={<CheckCircle2 size={14} color={isExpanded ? themeTokens.colors.primary : themeTokens.colors.textTertiary} />}
                                  onClick={() => { setReviewingDocId(isExpanded ? null : doc.id); setReviewNote(doc.reviewNote || ''); }}
                                  style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                />
                              </Tooltip>
                            )}
                          </div>
                        </div>

                        {/* Review panel — expands inline */}
                        {(isHR || isAdmin) && isExpanded && (
                          <div style={{
                            marginTop: 12, marginLeft: 52,
                            background: '#F8F9FC', borderRadius: 10,
                            padding: '14px 16px', border: `1px solid ${themeTokens.colors.borders}`,
                          }}>
                            <Text style={{ fontSize: 12, fontWeight: 600, color: themeTokens.colors.textSecondary, display: 'block', marginBottom: 8 }}>
                              Review Document
                            </Text>
                            <Input.TextArea
                              rows={2}
                              placeholder="Add a note (optional) — e.g. 'Document is clear' or 'Name mismatch on page 1'"
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                              style={{ borderRadius: 8, borderColor: themeTokens.colors.borders, fontSize: 13, marginBottom: 10 }}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              <Button size="small" loading={reviewLoading} icon={<CheckCircle2 size={13} />}
                                onClick={() => handleReviewDocument(doc.id, 'verified')}
                                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, height: 30 }}>
                                Verify
                              </Button>
                              <Button size="small" loading={reviewLoading} icon={<ThumbsUp size={13} />}
                                onClick={() => handleReviewDocument(doc.id, 'approved')}
                                style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, height: 30 }}>
                                Approve
                              </Button>
                              <Button size="small" loading={reviewLoading} icon={<XCircle size={13} />}
                                onClick={() => handleReviewDocument(doc.id, 'rejected')}
                                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, height: 30 }}>
                                Reject
                              </Button>
                              <Button size="small" loading={reviewLoading} icon={<RefreshCw size={13} />}
                                onClick={() => handleReviewDocument(doc.id, 'reupload_requested')}
                                style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, height: 30 }}>
                                Request Re-upload
                              </Button>
                              <Button size="small" onClick={() => { setReviewingDocId(null); setReviewNote(''); }}
                                style={{ borderRadius: 6, height: 30 }}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<Text type="secondary" style={{ fontSize: '15px' }}>No documents uploaded yet</Text>} />
              </div>
            )}
          </div>
        );
      })()
    },
    ...((isHR || isAdmin) ? [{
      key: '5',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Calendar size={15} strokeWidth={2} />
          <span>{isMobile ? 'Leave' : 'Leave Management'}</span>
        </div>
      ),
      children: (() => {
        const STATUS_STYLES = {
          approved: { bg: '#EFF6FF', color: '#1D4ED8', label: 'APPROVED' },
          pending: { bg: '#FFF7ED', color: '#C2410C', label: 'PENDING' },
          rejected: { bg: '#FEF2F2', color: '#DC2626', label: 'REJECTED' },
          cancelled: { bg: '#F3F4F6', color: '#6B7280', label: 'CANCELLED' },
          auto_deducted: { bg: '#FFF7ED', color: '#EA580C', label: 'AUTO-DEDUCTED' },
        };
        const SESSION_LABELS = { full_day: 'Full Day', first_half: 'First Half', second_half: 'Second Half' };
        const cards = leaveSummary?.cards || {};
        const history = (leaveSummary?.history || []).filter(h => h.leaveId);

        return (
          <div style={{ padding: isMobile ? '16px 12px' : '24px 28px' }}>
            {leaveLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : !leaveSummary ? (
              <Empty description="No leave data" />
            ) : (
              <>
                {/* Balance Cards */}
                <Text strong style={{ fontSize: 14, color: themeTokens.colors.textPrimary, display: 'block', marginBottom: 12 }}>Leave Balance</Text>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {Object.entries(cards).filter(([k]) => k !== 'lop' && k !== 'comp_off').map(([key, card]) => (
                    <div key={key} style={{
                      background: '#ffffff', border: `1px solid ${themeTokens.colors.borders}`, borderRadius: 12, padding: '16px',
                    }}>
                      <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.name}</Text>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: themeTokens.colors.primary }}>{card.available}</span>
                        <span style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>/ {card.maxBalance ?? card.credited}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                        <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>{card.utilized} used &bull; {card.pending} pending</Text>
                        <Button size="small" type="link" style={{ fontSize: 11, padding: 0, height: 'auto', fontWeight: 600 }} onClick={() => {
                          setAdjustingBalance({ leaveTypeId: key, leaveTypeName: card.name });
                          balanceAdjustForm.resetFields();
                        }}>Adjust</Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Leave History */}
                <Text strong style={{ fontSize: 14, color: themeTokens.colors.textPrimary, display: 'block', marginBottom: 12 }}>Leave History</Text>
                {history.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No leave records" />
                ) : (
                  <div>
                    {history.map((item, idx) => {
                      const displayStatus = (item.isAutoLop && item.status === 'approved') ? 'auto_deducted' : item.status;
                      const ss = STATUS_STYLES[displayStatus] || STATUS_STYLES.pending;
                      return (
                        <div key={item.leaveId || idx}>
                          {idx > 0 && <Divider style={{ margin: 0, borderColor: themeTokens.colors.borders }} />}
                          <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text strong style={{ fontSize: 13 }}>{item.leaveTypeName}</Text>
                                <Tag style={{ background: ss.bg, color: ss.color, border: 'none', fontWeight: 700, fontSize: 10, borderRadius: 6 }}>{ss.label}</Tag>
                                <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>{item.amount} {item.amount === 1 ? 'day' : 'days'}</Text>
                              </div>
                              {item.reason && <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary, display: 'block', marginTop: 2 }}>{item.reason}</Text>}
                              <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, display: 'block' }}>
                                {item.fromDate && dayjs(item.fromDate).format('DD MMM YYYY')}
                                {item.toDate && item.toDate !== item.fromDate && ` — ${dayjs(item.toDate).format('DD MMM YYYY')}`}
                              </Text>
                            </div>
                            <Button size="small" icon={<Edit2 size={13} />} onClick={() => {
                              setEditingLeave(item);
                              leaveEditForm.setFieldsValue({
                                leaveType: item.leaveType,
                                fromDate: item.fromDate ? dayjs(item.fromDate) : null,
                                toDate: item.toDate ? dayjs(item.toDate) : null,
                                days: item.amount,
                                session: item.session || 'full_day',
                                status: item.isAutoLop && item.status === 'approved' ? 'approved' : item.status,
                                reason: item.reason || '',
                              });
                            }} style={{ borderRadius: 8, fontWeight: 600 }}>
                              Edit
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()
    }] : []),

    // ── Tab 6: Attendance Calendar (HR & Admin) ──
    ...((isHR || isAdmin) ? [{
      key: '6',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Calendar size={15} strokeWidth={2} />
          <span>Attendance</span>
        </div>
      ),
      children: (() => {
        const today = dayjs();
        const joiningDate = employee.joiningDate ? dayjs(employee.joiningDate) : null;
        const monthStart = attCalMonth.startOf('month');
        const daysInMonth = attCalMonth.daysInMonth();
        const startDayOfWeek = monthStart.day(); // 0=Sun

        // Build attendance lookup by date
        const attMap = {};
        attCalData.forEach(r => {
          const d = dayjs(r.date).format('YYYY-MM-DD');
          const s = String(r.status || '').toLowerCase();
          const isLate = r.isLate === true || s === 'late' || String(r.tag || '').toLowerCase() === 'late';
          attMap[d] = {
            status: s,
            isLate,
            checkIn: r.checkInTimeDisplay || r.checkInDisplay || (r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null),
            checkOut: r.checkOutTimeDisplay || r.checkOutDisplay || (r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null),
            workHours: r.workHours != null ? Number(r.workHours) : null,
          };
        });

        // Build day cells
        const days = [];
        let totalWorking = 0, presentCount = 0, absentCount = 0, lateCount = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const date = attCalMonth.date(d);
          const dateStr = date.format('YYYY-MM-DD');
          const isWeekend = date.day() === 0 || date.day() === 6;
          const isHoliday = !!attCalHolidays[dateStr];
          const isFuture = date.isAfter(today, 'day');
          const isBeforeJoin = joiningDate && date.isBefore(joiningDate, 'day');
          const isToday = date.isSame(today, 'day');
          const record = attMap[dateStr];

          let status, color, bg, tooltip;

          if (isFuture || isBeforeJoin) {
            status = '—'; color = '#d1d5db'; bg = '#f9fafb'; tooltip = isFuture ? 'Future' : 'Before joining';
          } else if (isWeekend) {
            status = 'Weekend'; color = '#6b7280'; bg = '#f3f4f6'; tooltip = 'Weekend';
          } else if (isHoliday) {
            status = 'Holiday'; color = '#3b82f6'; bg = '#eff6ff'; tooltip = attCalHolidays[dateStr];
          } else if (record) {
            const s = record.status;
            totalWorking++;
            if (s === 'present' || s === 'checked in' || s === 'checked out' || s === 'checked_in') {
              if (record.isLate) {
                status = 'Late'; color = '#f59e0b'; bg = '#fffbeb'; lateCount++; presentCount++;
              } else {
                status = 'Present'; color = '#10b981'; bg = '#ecfdf5'; presentCount++;
              }
            } else if (s === 'half_day' || s === 'half day') {
              status = 'Half Day'; color = '#f59e0b'; bg = '#fffbeb'; presentCount += 0.5;
            } else if (s === 'incomplete') {
              status = 'Incomplete'; color = '#f59e0b'; bg = '#fffbeb';
            } else if (s === 'on_leave' || s === 'on leave') {
              status = 'On Leave'; color = '#8b5cf6'; bg = '#f5f3ff';
            } else {
              status = 'Absent'; color = '#ef4444'; bg = '#fef2f2'; absentCount++;
            }
            tooltip = [record.checkIn && `In: ${record.checkIn}`, record.checkOut && `Out: ${record.checkOut}`, record.workHours != null && `${record.workHours.toFixed(1)}h`].filter(Boolean).join(' | ');
          } else {
            // No record, past day, not weekend/holiday → Absent
            totalWorking++;
            status = 'Absent'; color = '#ef4444'; bg = '#fef2f2'; absentCount++;
            tooltip = 'No check-in recorded';
          }

          days.push({ d, dateStr, status, color, bg, tooltip, isToday });
        }

        return (
          <div>
            {/* Month navigation + summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button size="small" onClick={() => { const m = attCalMonth.subtract(1, 'month'); setAttCalMonth(m); loadAttendanceCalendar(m); }}>←</Button>
                <span style={{ fontSize: 16, fontWeight: 700, minWidth: 140, textAlign: 'center' }}>{attCalMonth.format('MMMM YYYY')}</span>
                <Button size="small" onClick={() => { const m = attCalMonth.add(1, 'month'); setAttCalMonth(m); loadAttendanceCalendar(m); }} disabled={attCalMonth.isSame(today, 'month')}>→</Button>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Working Days', value: totalWorking, color: '#1f2937' },
                  { label: 'Present', value: presentCount, color: '#10b981' },
                  { label: 'Absent', value: absentCount, color: '#ef4444' },
                  { label: 'Late', value: lateCount, color: '#f59e0b' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {attCalLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : (
              <>
                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9ca3af', padding: '6px 0' }}>{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {/* Empty cells for offset */}
                  {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}

                  {/* Day cells */}
                  {days.map(({ d, status, color, bg, tooltip, isToday }) => (
                    <Tooltip key={d} title={tooltip || status}>
                      <div style={{
                        border: isToday ? '2px solid #1368FF' : '1px solid #e5e7eb',
                        borderRadius: 10,
                        padding: '8px 4px',
                        textAlign: 'center',
                        background: bg,
                        minHeight: 70,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: 'default',
                      }}>
                        <div style={{ fontSize: 14, fontWeight: isToday ? 800 : 600, color: isToday ? '#1368FF' : '#374151' }}>{d}</div>
                        <div style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color,
                          background: status === '—' ? 'transparent' : `${color}15`,
                          padding: '2px 6px',
                          borderRadius: 4,
                          letterSpacing: '0.03em',
                        }}>
                          {status}
                        </div>
                      </div>
                    </Tooltip>
                  ))}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16, justifyContent: 'center' }}>
                  {[
                    { label: 'Present', color: '#10b981' },
                    { label: 'Late', color: '#f59e0b' },
                    { label: 'Absent', color: '#ef4444' },
                    { label: 'Holiday', color: '#3b82f6' },
                    { label: 'Weekend', color: '#6b7280' },
                    { label: 'On Leave', color: '#8b5cf6' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()
    }] : []),
  ];

  return (
    <Layout>
      <Space direction="vertical" size={isMobile ? 16 : 24} style={{ width: '100%' }}>
        {/* Breadcrumb */}
        <Breadcrumb items={[
          { title: <Link to="/dashboard">Dashboard</Link> },
          { title: <Link to="/employees">Employees</Link> },
          { title: employee.name }
        ]} />

        {/* Profile Header Card — Figma design */}
        {(() => {
          const statusNorm = String(employee.status || '').toLowerCase();
          const isOnboarding = statusNorm === 'onboarding';
          const statusLabel = String(employee.status || '-').replace(/_/g, ' ');
          const statusBadgeStyle = {
            active: { bg: '#22c55e', color: '#fff' },
            onboarding: { bg: '#f97316', color: '#fff' },
            notice_period: { bg: '#f59e0b', color: '#fff' },
            'notice period': { bg: '#f59e0b', color: '#fff' },
            exited: { bg: '#ef4444', color: '#fff' },
          };
          const badge = statusBadgeStyle[statusNorm] || { bg: 'rgba(255,255,255,0.25)', color: '#fff' };

          return (
            <div style={{
              background: 'linear-gradient(135deg, #1368FF 0%, #0C4FC2 100%)',
              borderRadius: 16,
              padding: isMobile ? '24px 20px' : '36px 32px',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: isMobile ? 16 : 24,
              flexWrap: 'wrap',
              boxShadow: '0 4px 24px rgba(19,104,255,0.25)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Subtle decorative circles */}
              <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -30, right: 120, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

              {/* Avatar */}
              <Avatar
                size={80}
                src={normalizeAvatarUrl(employee.avatarUrl)}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  border: '3px solid rgba(255,255,255,0.55)',
                  borderRadius: 18,
                  fontSize: 32,
                  fontWeight: 800,
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                {employee.name.charAt(0)}
              </Avatar>

              {/* Info block */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + status badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    {employee.name}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: badge.bg, color: badge.color,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {statusLabel}
                  </span>
                </div>

                {/* Designation + Department */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
                  {!isUnset(employee.designation) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>
                      <Briefcase size={13} color="rgba(255,255,255,0.7)" />
                      {employee.designation}
                    </span>
                  )}
                  {!isUnset(employee.department) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>#</span>
                      {employee.department}
                    </span>
                  )}
                </div>

                {/* Joining date */}
                {employee.joiningDate && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
                    <Calendar size={12} color="rgba(255,255,255,0.6)" />
                    Joining: {dayjs(employee.joiningDate).format('DD MMM YYYY')}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              {(isHR || isAdmin) && (
                <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 10, flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
                  {isOnboarding && (
                    <Button
                      icon={<span style={{ display: 'inline-flex', alignItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></span>}
                      onClick={async () => {
                        try {
                          await hrAPI.sendOnboardingInvite(employee.id);
                          message.success('Invite link sent successfully');
                        } catch (err) {
                          message.error(err?.response?.data?.message || 'Failed to send invite');
                        }
                      }}
                      style={{
                        height: 36, borderRadius: 10, fontSize: 13, fontWeight: 600,
                        background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.5)',
                        color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6,
                        backdropFilter: 'blur(4px)',
                        flex: isMobile ? 1 : 'none',
                      }}
                    >
                      Send Invite Link
                    </Button>
                  )}
                  <Button
                    icon={<Edit2 size={14} />}
                    onClick={openEditModal}
                    style={{
                      height: 36, borderRadius: 10, fontSize: 13, fontWeight: 600,
                      background: '#0f172a', border: 'none',
                      color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6,
                      flex: isMobile ? 1 : 'none',
                    }}
                  >
                    Edit Profile
                  </Button>
                </div>
              )}
            </div>
          );
        })()}

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card
              style={{ borderRadius: '16px', boxShadow: themeTokens.shadows.standard }}
              styles={{ body: { padding: isMobile ? '12px 16px' : '24px' } }}
            >
              <Tabs
                defaultActiveKey="1"
                items={isManager ? items.filter(t => t.key !== '4') : items}
                size="middle"
                tabBarGutter={isMobile ? 12 : 20}
                onChange={(key) => {
                  if (key === '6' && attCalData.length === 0) loadAttendanceCalendar();
                }}
                tabBarStyle={{
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  flexWrap: 'nowrap',
                  whiteSpace: 'nowrap',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  paddingRight: 16,
                }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Card title="Time & Attendance" style={{ borderRadius: '16px', boxShadow: themeTokens.shadows.standard }} styles={{ body: { padding: isMobile ? '12px 16px' : '24px' } }}>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Statistic
                      title="Present Days"
                      value={presentDays}
                      suffix={`/ ${workingDays}`}
                      valueStyle={{ fontSize: '20px', fontWeight: 700 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Leave Balance"
                      value={leaveAvailable}
                      valueStyle={{ color: themeTokens.colors.success, fontSize: '20px', fontWeight: 700 }}
                    />
                  </Col>
                  <Col span={24}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Attendance Rate: {attendance?.attendanceRate ?? 0}% ({attendance?.display || `${presentDays}/${workingDays}`})
                    </Text>
                  </Col>
                  <Col span={24} />
                </Row>
              </Card>

              <Card title="Contact Info" style={{ borderRadius: '16px', boxShadow: themeTokens.shadows.standard }} styles={{ body: { padding: isMobile ? '12px 16px' : '24px' } }}>
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{ background: '#f0fff4', padding: '8px', borderRadius: '8px', color: '#52c41a', flexShrink: 0 }}><Mail size={18} /></div>
                    <div style={{ minWidth: 0 }}>
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Personal Email</Text>
                      <Text strong style={{ display: 'block', wordBreak: 'break-all', fontSize: '13px' }}>
                        {employee.personalEmail || '—'}
                      </Text>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{ background: '#fff7e6', padding: '8px', borderRadius: '8px', color: '#fa8c16', flexShrink: 0 }}><Phone size={18} /></div>
                    <div style={{ minWidth: 0 }}>
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Mobile</Text>
                      <Text strong>{employee.phone || 'Not provided'}</Text>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{ background: '#f2f4f7', padding: '8px', borderRadius: '8px', color: themeTokens.colors.textSecondary, flexShrink: 0 }}><MapPin size={18} /></div>
                    <div style={{ minWidth: 0 }}>
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Address</Text>
                      <Text strong style={{ wordBreak: 'break-word' }}>{employee.currentAddress || 'Not provided'}</Text>
                    </div>
                  </div>
                </Space>
              </Card>
            </Space>
          </Col>
        </Row>
      </Space>

      {/* ── Edit Profile Modal ── */}
      <Modal
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        width={isMobile ? '100%' : 760}
        centered={!isMobile}
        destroyOnClose
        title={null}
        styles={{
          content: { padding: 0, borderRadius: isMobile ? '20px 20px 0 0' : 16, overflow: 'hidden' },
          body: { padding: 0 },
          wrapper: isMobile ? { padding: 0 } : {},
        }}
        style={isMobile ? { top: 'auto', bottom: 0, margin: 0, maxWidth: '100vw', paddingBottom: 0 } : {}}
        closeIcon={false}
      >
        {/* Modal Header */}
        <div style={{
          background: BTN_GRADIENT,
          padding: isMobile ? '20px 16px' : '24px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
              Employee Profile
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Edit Profile</div>
          </div>
          <button
            onClick={() => setEditOpen(false)}
            style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', cursor: 'pointer',
            }}
          >
            <XCircle size={17} strokeWidth={2} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: isMobile ? '16px' : '24px 28px', maxHeight: isMobile ? 'calc(95vh - 140px)' : 'calc(85vh - 120px)', overflowY: 'auto' }}>
          <Form form={editForm} layout="vertical" requiredMark="optional">
            {/* Personal Details */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={14} color="#1368FF" strokeWidth={2} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personal Details</span>
              </div>
              <Row gutter={[12, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item label="First Name" name="firstName" rules={[{ required: true, message: 'Required' }]}>
                    <Input prefix={<User size={14} color="#94a3b8" />} size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Last Name" name="lastName" rules={[{ required: true, message: 'Required' }]}>
                    <Input prefix={<User size={14} color="#94a3b8" />} size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Personal Email" name="email" rules={[{ required: true, type: 'email', message: 'Enter valid email' }]}>
                    <Input prefix={<Mail size={14} color="#94a3b8" />} size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Phone Number" name="phone" rules={[{ required: true, message: 'Required' }, { validator: getPhoneValidator(true) }]}>
                    <PhoneInput />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Gender" name="gender">
                    <Select placeholder="Select gender" size="large" style={{ borderRadius: 8 }} allowClear>
                      <Select.Option value="male">Male</Select.Option>
                      <Select.Option value="female">Female</Select.Option>
                      <Select.Option value="other">Other</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Date of Birth" name="dateOfBirth">
                    <DatePicker style={{ width: '100%', borderRadius: 8 }} size="large" format="DD MMM YYYY" disabledDate={c => c && c > dayjs().subtract(18, 'years')} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <Divider style={{ margin: '4px 0 20px' }} />

            {/* Employment Details */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Briefcase size={14} color="#1368FF" strokeWidth={2} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Employment & Role</span>
              </div>
              <Row gutter={[12, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item label="Designation" name="designation" rules={[{ required: true, message: 'Required' }]}>
                    <Select showSearch placeholder="Select designation" size="large" style={{ borderRadius: 8 }} optionFilterProp="label" options={[
                      { label: 'Executive', options: [{ value: 'CEO', label: 'CEO' }, { value: 'CTO', label: 'CTO' }, { value: 'COO', label: 'COO' }, { value: 'CFO', label: 'CFO' }, { value: 'CHRO', label: 'CHRO' }] },
                      { label: 'Director / VP', options: [{ value: 'VP of Engineering', label: 'VP of Engineering' }, { value: 'VP of Product', label: 'VP of Product' }, { value: 'Director of Engineering', label: 'Director of Engineering' }, { value: 'Director of HR', label: 'Director of HR' }] },
                      { label: 'Manager / Lead', options: [{ value: 'Engineering Manager', label: 'Engineering Manager' }, { value: 'Tech Lead', label: 'Tech Lead' }, { value: 'Project Manager', label: 'Project Manager' }, { value: 'HR Manager', label: 'HR Manager' }] },
                      { label: 'Senior', options: [{ value: 'Senior Software Engineer', label: 'Senior Software Engineer' }, { value: 'Senior Frontend Engineer', label: 'Senior Frontend Engineer' }, { value: 'Senior Backend Engineer', label: 'Senior Backend Engineer' }, { value: 'Senior QA Engineer', label: 'Senior QA Engineer' }] },
                      { label: 'Engineer / Specialist', options: [{ value: 'Software Engineer', label: 'Software Engineer' }, { value: 'Frontend Engineer', label: 'Frontend Engineer' }, { value: 'Backend Engineer', label: 'Backend Engineer' }, { value: 'Full Stack Engineer', label: 'Full Stack Engineer' }, { value: 'QA Engineer', label: 'QA Engineer' }, { value: 'DevOps Engineer', label: 'DevOps Engineer' }, { value: 'Data Analyst', label: 'Data Analyst' }, { value: 'UI/UX Designer', label: 'UI/UX Designer' }, { value: 'HR Executive', label: 'HR Executive' }] },
                      { label: 'Junior / Trainee', options: [{ value: 'Junior Software Engineer', label: 'Junior Software Engineer' }, { value: 'Junior Frontend Engineer', label: 'Junior Frontend Engineer' }, { value: 'Trainee Engineer', label: 'Trainee Engineer' }, { value: 'Intern', label: 'Intern' }] },
                    ]} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Department" name="department" rules={[{ required: true, message: 'Required' }]}>
                    <Select showSearch placeholder="Select department" size="large" style={{ borderRadius: 8 }} optionFilterProp="children">
                      {['Administration', 'Business Development', 'Customer Support', 'Data & Analytics', 'Design', 'DevOps / Infrastructure', 'Engineering', 'Finance', 'Human Resources', 'IT', 'Legal & Compliance', 'Marketing', 'Operations', 'Product Management', 'Quality Assurance', 'Sales', 'Security'].map(d => (
                        <Select.Option key={d} value={d}>{d}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Joining Date" name="joiningDate" rules={[{ required: true, message: 'Required' }]}>
                    <DatePicker style={{ width: '100%', borderRadius: 8 }} size="large" format="DD MMM YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Work Mode" name="workMode" rules={[{ required: true, message: 'Required' }]}>
                    <Select size="large" style={{ borderRadius: 8 }}>
                      <Select.Option value="office">Office</Select.Option>
                      <Select.Option value="remote">Remote</Select.Option>
                      <Select.Option value="hybrid">Hybrid</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Country" name="country" rules={[{ required: true, message: 'Country is required' }]}>
                    <Select
                      showSearch
                      size="large"
                      style={{ borderRadius: 8 }}
                      placeholder="Select country"
                      optionFilterProp="label"
                      options={COUNTRIES.map(c => ({ value: c.value, label: `${c.flag} ${c.value}` }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Reporting Manager" name="managerId" rules={[{ required: true, message: 'Required' }]}>
                    <Select showSearch optionFilterProp="children" size="large" style={{ borderRadius: 8 }}>
                      <Select.Option value="none">No Manager (Top Level)</Select.Option>
                      {editManagers.map(mgr => (
                        <Select.Option key={mgr.id} value={mgr.id}>{mgr.name} ({mgr.employeeCode}) — {mgr.roleDisplayName || mgr.roleName || mgr.designation || 'Staff'}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Employee Status" name="status" rules={[{ required: true, message: 'Required' }]}>
                    <Select size="large" style={{ borderRadius: 8 }}>
                      <Select.Option value="active">Active</Select.Option>
                      <Select.Option value="onboarding">Onboarding</Select.Option>
                      <Select.Option value="notice period">Notice Period</Select.Option>
                      <Select.Option value="exited">Exited</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="System Access Role" name="userRole" rules={[{ required: true, message: 'Required' }]}>
                    <Select size="large" style={{ borderRadius: 8 }}>
                      <Select.Option value="Employee">Employee</Select.Option>
                      <Select.Option value="Manager">Manager</Select.Option>
                      {isAdmin && <Select.Option value="HR">HR Executive</Select.Option>}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* Delete zone — only during onboarding */}
            {employee?.status === 'onboarding' && (
              <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 16px', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Trash2 size={14} color="#dc2626" />
                  <span style={{ fontWeight: 700, color: '#dc2626', fontSize: 13 }}>Delete Employee</span>
                </div>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>Permanently removes this employee record. Only available during onboarding.</p>
                <Popconfirm
                  title="Delete Employee"
                  description={`Permanently delete ${employee?.name}? This cannot be undone.`}
                  onConfirm={handleEditDelete}
                  okText="Yes, Delete"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                >
                  <Button block danger type="primary" icon={<Trash2 size={14} />} loading={editDeleting} style={{ borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    Delete Employee
                  </Button>
                </Popconfirm>
              </div>
            )}
          </Form>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: isMobile ? '12px 16px' : '16px 28px',
          borderTop: `1px solid ${themeTokens.colors.borders}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fff',
        }}>
          <Button onClick={() => setEditOpen(false)} style={{ borderRadius: 8 }} size="large">Cancel</Button>
          <Button
            type="primary"
            icon={<Save size={16} />}
            loading={editSaving}
            onClick={handleEditSave}
            style={{ borderRadius: 8, fontWeight: 600, background: BTN_GRADIENT, border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            size="large"
          >
            Save Changes
          </Button>
        </div>
      </Modal>

      <Modal
        open={timesheetOpen}
        onCancel={() => setTimesheetOpen(false)}
        footer={null}
        width={isMobile ? '100%' : 900}
        centered
        destroyOnClose
        maskClosable={false}
        zIndex={1400}
        title={null}
        styles={{
          content: { padding: 0, borderRadius: isMobile ? 0 : 16, overflow: 'hidden' },
          body: { padding: 0 },
          wrapper: isMobile ? { padding: 0 } : {},
        }}
        style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', paddingBottom: 0 } : {}}
        closeIcon={false}
      >
        {/* ── Gradient Header ── */}
        <div style={{
          background: 'linear-gradient(90deg, #1368FF 0%, rgba(7,96,253,0.40) 100%)',
          padding: '20px 24px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <Calendar size={16} color="rgba(255,255,255,0.8)" />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Attendance Timesheet
                </span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                {employee?.name || '—'}
              </span>
            </div>
            {/* Close button — inside header so it sits on the gradient */}
            <button
              onClick={() => setTimesheetOpen(false)}
              style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'rgba(255,255,255,0.15)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              <XCircle size={17} strokeWidth={2} />
            </button>
          </div>

          {/* ── Filters row inside header ── */}
          <div style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr auto',
            gap: 10,
          }}>
            <RangePicker
              value={[timesheetFilters.fromDate, timesheetFilters.toDate]}
              onChange={(dates) => {
                if (!dates || !dates[0] || !dates[1]) return;
                setTimesheetFilters(prev => ({
                  ...prev,
                  fromDate: dates[0].startOf('day'),
                  toDate: dates[1].endOf('day'),
                }));
              }}
              allowClear={false}
              style={{
                borderRadius: 8, background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
              }}
            />
            <Select
              value={timesheetFilters.status}
              onChange={(value) => setTimesheetFilters(prev => ({ ...prev, status: value }))}
              options={[
                { value: '', label: 'All Status' },
                { value: 'checked_in', label: 'Checked In' },
                { value: 'present', label: 'Present' },
                { value: 'late', label: 'Late' },
                { value: 'absent', label: 'Absent' },
                { value: 'incomplete', label: 'Incomplete' },
                { value: 'on_leave', label: 'On Leave' },
                { value: 'holiday', label: 'Holiday' },
              ]}
              style={{ borderRadius: 8 }}
            />
            <Button
              type="primary"
              loading={timesheetLoading}
              onClick={() => loadTimesheet({
                page: 1,
                limit: timesheetPagination.limit,
                fromDate: timesheetFilters.fromDate,
                toDate: timesheetFilters.toDate,
                status: timesheetFilters.status,
              })}
              style={{
                height: 32, borderRadius: 8, fontWeight: 700, fontSize: 13,
                background: '#fff', color: themeTokens.colors.primary,
                border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              Apply
            </Button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: isMobile ? '14px 14px' : '20px 24px', background: themeTokens.colors.appBackground || '#F8F9FC' }}>

          {/* ── Stat Cards ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}>
            {[
              {
                label: 'Total Days',
                value: timesheetCards.totalDays,
                valueColor: themeTokens.colors.heading || '#1E2875',
                icon: Calendar,
                iconBg: `${themeTokens.colors.primary}12`,
                iconColor: themeTokens.colors.primary,
              },
              {
                label: 'Present',
                value: timesheetCards.daysPresent,
                valueColor: '#16a34a',
                icon: CheckCircle2,
                iconBg: '#dcfce7',
                iconColor: '#16a34a',
              },
              {
                label: 'Incomplete',
                value: timesheetCards.incomplete,
                valueColor: '#d97706',
                icon: RefreshCw,
                iconBg: '#fef3c7',
                iconColor: '#d97706',
              },
              {
                label: 'Attendance %',
                value: `${Number(timesheetCards.attendanceRate || 0).toFixed(1)}%`,
                valueColor: themeTokens.colors.primary,
                icon: ShieldCheck,
                iconBg: `${themeTokens.colors.primary}12`,
                iconColor: themeTokens.colors.primary,
              },
            ].map(({ label, value, valueColor, icon: Icon, iconBg, iconColor }) => (
              <div key={label} style={{
                background: '#ffffff',
                border: `1px solid ${themeTokens.colors.borders}`,
                borderRadius: 12,
                padding: isMobile ? '12px' : '14px 16px',
                display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 6 : 12,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: isMobile ? 30 : 38, height: isMobile ? 30 : 38, borderRadius: 8, flexShrink: 0,
                  background: iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={isMobile ? 14 : 18} color={iconColor} strokeWidth={2} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 9 : 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: valueColor, lineHeight: 1 }}>
                    {value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Custom Table ── */}
          <div style={{
            background: '#ffffff',
            border: `1px solid ${themeTokens.colors.borders}`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            {/* Table header — desktop only */}
            {!isMobile && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.2fr',
                padding: '11px 20px',
                background: '#F8F9FC',
                borderBottom: `1px solid ${themeTokens.colors.borders}`,
              }}>
                {['Date', 'Check In', 'Check Out', 'Work Hours', 'Status'].map(col => (
                  <span key={col} style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.07em', color: '#6b7280',
                  }}>
                    {col}
                  </span>
                ))}
              </div>
            )}

            {/* Rows */}
            {timesheetLoading ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <div style={{ color: themeTokens.colors.textTertiary, fontSize: 13 }}>Loading…</div>
              </div>
            ) : timesheetItems.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No records found for the selected period.
              </div>
            ) : (
              timesheetItems.map((record, i) => {
                const statusKey = String(record.status || '').toLowerCase();
                const isLate = record.isLate === true;
                const statusMeta = isLate
                  ? { label: 'Late', color: '#F59E0B', bg: '#FFFBEB' }
                  : ({
                  present:    { label: 'Present',    color: '#16a34a', bg: '#dcfce7' },
                  checked_in: { label: 'Checked In', color: themeTokens.colors.primary, bg: `${themeTokens.colors.primary}15` },
                  incomplete: { label: 'Incomplete', color: '#d97706', bg: '#fef3c7' },
                  absent:     { label: 'Absent',     color: '#dc2626', bg: '#fee2e2' },
                  on_leave:   { label: 'On Leave',   color: '#7c3aed', bg: '#ede9fe' },
                  holiday:    { label: 'Holiday',    color: '#0891b2', bg: '#cffafe' },
                }[statusKey] || { label: statusKey.replace(/_/g, ' ').toUpperCase() || '—', color: '#6b7280', bg: '#f3f4f6' });

                const toIST = (t) => t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null;
                const checkIn = record.checkInTimeDisplay || record.checkInDisplay || toIST(record.checkInTime);
                const checkOut = record.checkOutTimeDisplay || record.checkOutDisplay || toIST(record.checkOutTime);
                const workHours = (record.workHours ?? record.workHours === 0)
                  ? Number(record.workHours).toFixed(2) : null;

                if (isMobile) {
                  return (
                    <div
                      key={record.id || `${record.date}-${i}`}
                      style={{
                        padding: '14px 16px',
                        borderBottom: i < timesheetItems.length - 1 ? `1px solid #f3f4f6` : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                          {record.date ? dayjs(record.date).format('DD MMM YYYY') : '—'}
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          fontSize: 11, fontWeight: 700,
                          padding: '3px 10px', borderRadius: 20,
                          color: statusMeta.color, background: statusMeta.bg,
                          letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        {[
                          { label: 'Check In', value: checkIn },
                          { label: 'Check Out', value: checkOut },
                          { label: 'Hours', value: workHours },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                            <div style={{ fontSize: 13, color: value ? '#374151' : '#9ca3af', fontWeight: 500 }}>{value || '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={record.id || `${record.date}-${i}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.2fr',
                      padding: '14px 20px',
                      borderBottom: i < timesheetItems.length - 1 ? `1px solid #f3f4f6` : 'none',
                      alignItems: 'center',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f8faff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                      {record.date ? dayjs(record.date).format('DD MMM YYYY') : '—'}
                    </span>
                    <span style={{ fontSize: 13, color: checkIn ? '#374151' : '#9ca3af' }}>
                      {checkIn || '—'}
                    </span>
                    <span style={{ fontSize: 13, color: checkOut ? '#374151' : '#9ca3af' }}>
                      {checkOut || '—'}
                    </span>
                    <span style={{ fontSize: 13, color: workHours ? '#374151' : '#9ca3af' }}>
                      {workHours || '—'}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontSize: 11, fontWeight: 700,
                      padding: '4px 10px', borderRadius: 20,
                      color: statusMeta.color, background: statusMeta.bg,
                      width: 'fit-content', letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}>
                      {statusMeta.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Pagination ── */}
          {timesheetPagination.total > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 16, flexWrap: 'wrap', gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                Showing {((timesheetPagination.page - 1) * timesheetPagination.limit) + 1}–
                {Math.min(timesheetPagination.page * timesheetPagination.limit, timesheetPagination.total)} of {timesheetPagination.total} records
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  disabled={timesheetPagination.page <= 1}
                  onClick={() => loadTimesheet({ page: timesheetPagination.page - 1 })}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: `1px solid ${themeTokens.colors.borders}`,
                    background: '#fff', cursor: timesheetPagination.page <= 1 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: timesheetPagination.page <= 1 ? 0.4 : 1,
                    color: themeTokens.colors.textPrimary,
                  }}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(timesheetPagination.totalPages, 5) }, (_, idx) => {
                  const pg = idx + 1;
                  const active = pg === timesheetPagination.page;
                  return (
                    <button
                      key={pg}
                      onClick={() => loadTimesheet({ page: pg })}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: active ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                        background: active ? themeTokens.colors.primary : '#fff',
                        color: active ? '#fff' : themeTokens.colors.textPrimary,
                        fontWeight: active ? 700 : 500, fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  disabled={timesheetPagination.page >= timesheetPagination.totalPages}
                  onClick={() => loadTimesheet({ page: timesheetPagination.page + 1 })}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: `1px solid ${themeTokens.colors.borders}`,
                    background: '#fff', cursor: timesheetPagination.page >= timesheetPagination.totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: timesheetPagination.page >= timesheetPagination.totalPages ? 0.4 : 1,
                    color: themeTokens.colors.textPrimary,
                  }}
                >
                  ›
                </button>
                <Select
                  size="small"
                  value={timesheetPagination.limit}
                  onChange={(val) => loadTimesheet({ page: 1, limit: val })}
                  options={[10, 20, 50].map(n => ({ value: n, label: `${n} / page` }))}
                  style={{ width: 100 }}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Leave Modal */}
      <Modal
        title="Edit Leave"
        open={!!editingLeave}
        onCancel={() => setEditingLeave(null)}
        onOk={() => leaveEditForm.submit()}
        centered
        okText="Save Changes"
        confirmLoading={leaveEditSaving}
        destroyOnHidden
      >
        <Form form={leaveEditForm} layout="vertical" onFinish={handleEditLeave}>
          <Form.Item name="leaveType" label="Leave Type">
            <Select options={
              Object.entries(leaveSummary?.cards || {}).map(([k, v]) => ({ label: v.name, value: k }))
            } />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="fromDate" label="From Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="toDate" label="To Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="days" label="Days">
                <Input type="number" min={0.5} step={0.5} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="session" label="Session">
                <Select options={[
                  { label: 'Full Day', value: 'full_day' },
                  { label: 'First Half', value: 'first_half' },
                  { label: 'Second Half', value: 'second_half' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="Status">
            <Select options={[
              { label: 'Pending', value: 'pending' },
              { label: 'Approved', value: 'approved' },
              { label: 'Rejected', value: 'rejected' },
              { label: 'Cancelled', value: 'cancelled' },
            ]} />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Adjust Balance Modal */}
      <Modal
        title={`Adjust Balance — ${adjustingBalance?.leaveTypeName || ''}`}
        open={!!adjustingBalance}
        onCancel={() => setAdjustingBalance(null)}
        onOk={() => balanceAdjustForm.submit()}
        centered
        okText="Apply Adjustment"
        confirmLoading={balanceAdjustSaving}
        destroyOnHidden
      >
        <Form form={balanceAdjustForm} layout="vertical" onFinish={handleAdjustBalance}>
          <Form.Item name="adjustment" label="Adjustment (positive to add, negative to deduct)" rules={[{ required: true, message: 'Enter adjustment value' }, { validator: (_, v) => v && Number(v) !== 0 ? Promise.resolve() : Promise.reject('Adjustment cannot be zero') }]}>
            <Input type="number" step={0.5} placeholder="e.g. 2 or -1" />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Enter a reason' }, { min: 3, message: 'At least 3 characters' }]}>
            <Input.TextArea rows={2} placeholder="Reason for adjustment" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
