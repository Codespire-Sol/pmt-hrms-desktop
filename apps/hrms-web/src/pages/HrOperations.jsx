import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Avatar,
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CalendarDays,
  ClipboardList,
  Download,
  Plus,
  Clock,
  Users,
  SlidersHorizontal,
  Gift,
  Search,
  LogOut,
  Pencil,
  Trash2,
  CheckCircle2,
  FileText,
  Send,
  KeyRound,
  Mail,
  ArrowRight,
  DollarSign,
  CheckSquare,
  LayoutGrid,
  List,
  UserCheck,
  UserX,
  Timer,
  X,
  Check,
} from 'lucide-react';
import dayjs from 'dayjs';
import Layout from '../components/layout/Layout';
import { hrAPI } from '../api/hr';
import { attendanceAPI } from '../api/attendance';
import { leaveAPI } from '../api/leave';
import { employeeAPI } from '../api/employees';
import { adminAPI } from '../api/admin';
import { useAuth } from '../hooks/useAuth';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { broadcastDataRefresh } from '../utils/realtime';
import { themeTokens } from '../styles/theme';
import OnboardingChecklist from '../components/modules/onboarding/OnboardingChecklist';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;
const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';


function downloadBlob(blob, fileName) {
  if (!(blob instanceof Blob)) {
    throw new Error('Invalid report file received from server');
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function parseFileNameFromContentDisposition(contentDisposition) {
  if (!contentDisposition || typeof contentDisposition !== 'string') return null;

  const utf8FileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8FileNameMatch?.[1]) {
    return decodeURIComponent(utf8FileNameMatch[1].trim().replace(/["']/g, ''));
  }

  const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (fileNameMatch?.[1]) return fileNameMatch[1].trim();
  return null;
}

function resolveCsvReportResponse(response, fallbackFileName) {
  if (response instanceof Blob) {
    return { blob: response, fileName: fallbackFileName };
  }

  const blob = response?.data instanceof Blob ? response.data : null;
  const contentDisposition = response?.headers?.['content-disposition'] || response?.headers?.['Content-Disposition'];
  const fileName = parseFileNameFromContentDisposition(contentDisposition) || fallbackFileName;

  if (!(blob instanceof Blob)) {
    throw new Error('Failed to download report file');
  }

  return { blob, fileName };
}

function extractListFromResponse(response, keys = ['items']) {
  const body = response?.data || {};
  const data = body?.data || body || {};
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(body?.[key])) return body[key];
  }
  if (Array.isArray(data)) return data;
  if (Array.isArray(body)) return body;
  return [];
}

function extractPaginationFromResponse(response) {
  const body = response?.data || {};
  const data = body?.data || body || {};
  return data?.pagination || body?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };
}

const DEFAULT_LEAVE_TYPES = [
  { id: 'casual', name: 'Casual Leave', code: 'CL', accrualType: 'monthly', accrualValue: 1, maxBalance: 12, applicableTo: 'all', active: true, carryForward: false, encashment: false, color: '#1368FF' },
  { id: 'sick', name: 'Sick Leave', code: 'SL', accrualType: 'monthly', accrualValue: 0.5, maxBalance: 6, applicableTo: 'all', active: true, carryForward: false, encashment: false, color: '#F59E0B' },
  { id: 'earned', name: 'Earned Leave', code: 'EL', accrualType: 'monthly', accrualValue: 1.25, maxBalance: 15, applicableTo: 'all', active: true, carryForward: true, encashment: false, color: '#10B981' },
  { id: 'paternity', name: 'Paternity Leave', code: 'PL', accrualType: 'fixed', accrualValue: 15, maxBalance: 15, applicableTo: 'male', active: true, carryForward: false, encashment: false, color: '#8B5CF6' },
  { id: 'maternity', name: 'Maternity Leave', code: 'ML', accrualType: 'fixed', accrualValue: 180, maxBalance: 180, applicableTo: 'female', active: true, carryForward: false, encashment: true, color: '#EC4899' },
];

const STATUS_CONFIG = {
  in_progress: { label: 'IN PROGRESS', color: '#F59E0B', bg: '#FEF3C7', border: '#FCD34D' },
  pending: { label: 'PENDING', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
  completed: { label: 'COMPLETED', color: '#10B981', bg: '#D1FAE5', border: '#6EE7B7' },
};


// Single offboarding employee card — fully inline, no modal
function OffboardingCard({ item, onInitiateProcess, onRefresh }) {
  const _screens = useBreakpoint();
  const _isMobile = !_screens.md;
  const name = item.employeeName || item.employee?.name
    || (item.employeeFirstName ? `${item.employeeFirstName} ${item.employeeLastName || ''}`.trim() : null)
    || (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : null)
    || item.employeeCode || 'Unknown';
  const code = item.employeeCode || item.employee?.employeeCode || '';
  const dept = item.department || item.employee?.department || '';
  const lastDay = item.lastWorkingDay ? dayjs(item.lastWorkingDay).format('MMM D, YYYY') : '-';
  const exitReason = String(item.exitReason || '').replace(/_/g, ' ');

  const itemStatus = item.status || 'pending';
  const cfg = STATUS_CONFIG[itemStatus] || STATUS_CONFIG.pending;
  const isCompleted = itemStatus === 'completed';

  // Avatar — single brand blue per Figma design
  const avatarColor = '#1368FF';

  // Per-task local state: { [taskId]: { completed, notes, notesOpen, notesDraft, saving } }
  const [taskStates, setTaskStates] = useState({});
  // Full task list fetched from detail endpoint
  const [tasks, setTasks] = useState([]);
  const [offboardingId, setOffboardingId] = useState(item.id || null);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Fetch task details on mount so real task IDs are always available
  useEffect(() => {
    const empId = item.employeeId || item.employee?.id;
    if (!empId) return;
    setLoadingDetail(true);
    hrAPI.getOffboardingDetail(empId)
      .then(response => {
        const body = response?.data || {};
        const data = body?.data || body || {};
        const fetchedTasks = Array.isArray(data?.tasks) ? data.tasks : [];
        setTasks(fetchedTasks);
        setOffboardingId(data.id || item.id || null);
        setDetailLoaded(true);
      })
      .catch(() => {/* silent — fallback to progress string from list */})
      .finally(() => setLoadingDetail(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialise taskStates from tasks
  useEffect(() => {
    if (tasks.length > 0) {
      setTaskStates(prev => {
        const next = { ...prev };
        tasks.forEach(t => {
          if (!next[t.id]) {
            next[t.id] = { completed: Boolean(t.completed), notes: t.notes || '', notesOpen: false, notesDraft: t.notes || '', saving: false };
          }
        });
        return next;
      });
    }
  }, [tasks]);

  // Returns the current offboardingId (detail always loaded on mount)
  const ensureDetailLoaded = async () => offboardingId;

  const patchTask = (taskId, patch) => {
    setTaskStates(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], ...patch },
    }));
  };

  const handleToggle = async (taskId, checked, resolvedOboardingId) => {
    const obId = resolvedOboardingId || offboardingId;
    patchTask(taskId, { completed: checked });
    if (!obId) return;
    patchTask(taskId, { saving: true });
    try {
      const notes = taskStates[taskId]?.notes || '';
      await hrAPI.updateOffboardingTask(obId, taskId, { completed: checked, notes });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: checked } : t));
      onRefresh && onRefresh();
    } catch {
      patchTask(taskId, { completed: !checked });
      message.error('Failed to update task');
    } finally {
      patchTask(taskId, { saving: false });
    }
  };

  const handlePencilClick = async (taskId) => {
    await ensureDetailLoaded();
    patchTask(taskId, { notesOpen: true });
  };

  const handleSaveNotes = async (taskId) => {
    const obId = offboardingId || await ensureDetailLoaded();
    if (!obId) return;
    const draft = taskStates[taskId]?.notesDraft ?? '';
    patchTask(taskId, { saving: true });
    try {
      const completed = taskStates[taskId]?.completed ?? false;
      await hrAPI.updateOffboardingTask(obId, taskId, { completed, notes: draft.trim() });
      patchTask(taskId, { notes: draft.trim(), notesOpen: false, saving: false });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes: draft.trim() } : t));
    } catch {
      patchTask(taskId, { saving: false });
      message.error('Failed to save notes');
    }
  };

  // Progress derived from local tasks state
  const doneCount = tasks.filter(t => taskStates[t.id]?.completed ?? Boolean(t.completed)).length;
  const totalCount = tasks.length;
  // Fallback to item.progress if tasks not yet loaded
  const progressStr = totalCount > 0
    ? `${doneCount}/${totalCount}`
    : (item.progress || '0/0');
  const [pd, pt] = progressStr.split('/').map(Number);
  const percent = pt > 0 ? Math.round((pd / pt) * 100) : 0;
  const allDone = pt > 0 && pd === pt;

  const handleComplete = async () => {
    const empId = item.employeeId || item.employee?.id;
    if (!empId) return;
    if (!allDone) {
      message.warning(`Complete all tasks before finalizing (${pd}/${pt})`);
      return;
    }
    setCompleting(true);
    try {
      await hrAPI.completeOffboarding(empId);
      message.success('Offboarding completed successfully');
      onRefresh && onRefresh();
    } catch (err) {
      message.error(err?.message || 'Failed to complete offboarding');
    } finally {
      setCompleting(false);
    }
  };

  const displayTasks = tasks;

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: 16,
      padding: '18px 20px',
      marginBottom: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: avatarColor, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 17, flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', lineHeight: 1.3 }}>{name}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
              {[code, dept].filter(Boolean).join(' • ')}
              {lastDay !== '-' && <> &nbsp;• Last Day: {lastDay}</>}
            </div>
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
          color: cfg.color, background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 999, padding: '4px 12px',
          whiteSpace: 'nowrap',
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Exit reason chip */}
      {exitReason && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, margin: '4px 0 12px',
          background: '#FEF3E2', border: '1px solid #F59E0B',
          borderRadius: 6, padding: '4px 10px',
        }}>
          <span style={{ fontSize: 13, color: '#F59E0B', lineHeight: 1 }}>⚠</span>
          <span style={{ fontSize: 12, color: '#92400E', textTransform: 'capitalize', fontWeight: 500 }}>{exitReason}</span>
        </div>
      )}

      {/* Progress */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Clearance Progress</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{progressStr} ({percent}%)</span>
        </div>
        <Progress
          percent={percent}
          showInfo={false}
          strokeColor={allDone ? '#10B981' : '#F59E0B'}
          trailColor="#E5E7EB"
          size={['100%', 7]}
          style={{ margin: 0 }}
        />
      </div>

      {/* Inline task grid */}
      {loadingDetail ? (
        <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 10, marginBottom: 8, padding: '8px 0' }}>Loading tasks…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: _isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8, marginTop: 12, marginBottom: 4 }}>
          {displayTasks.map(task => {
            const ts = taskStates[task.id] || { completed: Boolean(task.completed), notes: task.notes || '', notesOpen: false, notesDraft: task.notes || '', saving: false };
            const isTaskDone = ts.completed;
            const notesOpen = ts.notesOpen;
            return (
              <div key={task.id} style={{
                background: isTaskDone ? '#F0FDF4' : '#FFFFFF',
                border: `1px solid ${isTaskDone ? '#A7F3D0' : '#E5E7EB'}`,
                borderRadius: 8,
                padding: '8px 10px',
                transition: 'all 0.2s',
              }}>
                {/* Task row: pencil | label | switch */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!isCompleted && (
                    <button
                      onClick={() => handlePencilClick(task.id)}
                      style={{ background: 'none', border: 'none', padding: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      title="Add/edit notes"
                    >
                      <Pencil size={11} color={notesOpen ? '#1368FF' : '#9CA3AF'} />
                    </button>
                  )}
                  <span style={{
                    fontSize: 12,
                    color: isTaskDone ? '#059669' : '#374151',
                    fontWeight: 500,
                    flex: 1,
                    minWidth: 0,
                    lineHeight: 1.35,
                  }}>
                    {task.taskName}
                  </span>
                  <Switch
                    size="small"
                    checked={isTaskDone}
                    disabled={isCompleted || ts.saving}
                    style={{
                      minWidth: 28, flexShrink: 0,
                      background: isTaskDone ? '#10B981' : '#D1D5DB',
                    }}
                    onChange={async (checked) => {
                      const resolvedId = await ensureDetailLoaded();
                      handleToggle(task.id, checked, resolvedId);
                    }}
                  />
                </div>
                {/* Inline notes editor */}
                {notesOpen && (
                  <div style={{ marginTop: 8 }}>
                    <Input.TextArea
                      autoFocus
                      rows={2}
                      value={ts.notesDraft}
                      onChange={e => patchTask(task.id, { notesDraft: e.target.value })}
                      placeholder="Add notes..."
                      style={{ borderRadius: 6, fontSize: 12, resize: 'none', borderColor: '#1368FF' }}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 5, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => patchTask(task.id, { notesOpen: false, notesDraft: ts.notes })}
                        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 5, padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: '#6B7280', fontWeight: 500 }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveNotes(task.id)}
                        disabled={ts.saving}
                        style={{ background: '#1368FF', border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: 11, cursor: ts.saving ? 'default' : 'pointer', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, opacity: ts.saving ? 0.7 : 1 }}
                      >
                        <Check size={10} /> Save
                      </button>
                    </div>
                  </div>
                )}
                {/* Saved notes display */}
                {!notesOpen && ts.notes && (
                  <div style={{
                    fontSize: 11, color: '#374151', marginTop: 6,
                    padding: '5px 8px',
                    background: '#F3F4F6',
                    border: '1px solid #E5E7EB',
                    borderRadius: 6,
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}>
                    {ts.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 16 }}>
        {itemStatus === 'in_progress' && (
          <Button
            block
            loading={completing}
            style={{ background: '#1368FF', color: '#fff', border: 'none', fontWeight: 600, borderRadius: 8, height: 40, fontSize: 14, letterSpacing: '0.01em' }}
            onClick={handleComplete}
          >
            Complete off-boarding
          </Button>
        )}
        {itemStatus === 'pending' && (
          <Button
            block
            style={{ background: '#1368FF', color: '#fff', border: 'none', fontWeight: 600, borderRadius: 8, height: 40, fontSize: 14 }}
            onClick={() => onInitiateProcess && onInitiateProcess(item)}
          >
            Start Process
          </Button>
        )}
      </div>
    </div>
  );
}

export default function HrOperations() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { isAdmin, isHR } = useAuth();
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('hrops_tab') || 'attendance');
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [onboardingItems, setOnboardingItems] = useState([]);
  const [offboardingItems, setOffboardingItems] = useState([]);
  const [offboardingStatus, setOffboardingStatus] = useState('all');
  const [offboardingSearch, setOffboardingSearch] = useState('');
  const [offboardingPagination, setOffboardingPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [offboardingModalOpen, setOffboardingModalOpen] = useState(false);
  const [submittingOffboarding, setSubmittingOffboarding] = useState(false);
  const [offboardingForm] = Form.useForm();
  const [offboardingEmployeeOptions, setOffboardingEmployeeOptions] = useState([]);
  const [searchingOffboardingEmployees, setSearchingOffboardingEmployees] = useState(false);

  const [offboardingDetailOpen, setOffboardingDetailOpen] = useState(false);
  const [offboardingDetailLoading, setOffboardingDetailLoading] = useState(false);
  const [offboardingDetail, setOffboardingDetail] = useState(null);
  const [taskDrafts, setTaskDrafts] = useState({});
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [completingOffboarding, setCompletingOffboarding] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(dayjs());
  const [attendanceItems, setAttendanceItems] = useState([]);
  const [totalEmployeeCount, setTotalEmployeeCount] = useState(0);
  const [attSearch, setAttSearch] = useState('');
  const [attStatusFilter, setAttStatusFilter] = useState('all');
  const [attSmartFilterOpen, setAttSmartFilterOpen] = useState(false);
  const [attDeptFilter, setAttDeptFilter] = useState('');
  const [attViewMode, setAttViewMode] = useState('list'); // 'list' | 'grid'
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [correctingRecord, setCorrectingRecord] = useState(null);
  const [correctSubmitting, setCorrectSubmitting] = useState(false);
  const [correctForm] = Form.useForm();

  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [submittingHoliday, setSubmittingHoliday] = useState(false);
  const [holidayForm] = Form.useForm();
  const [holidaySearch, setHolidaySearch] = useState('');
  const [holidayTypeFilter, setHolidayTypeFilter] = useState('all');
  const [editHolidayModalOpen, setEditHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [submittingEditHoliday, setSubmittingEditHoliday] = useState(false);
  const [editHolidayForm] = Form.useForm();

  const [leaveConfig, setLeaveConfig] = useState(null);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [leaveConfigForm] = Form.useForm();
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [addLeaveTypeOpen, setAddLeaveTypeOpen] = useState(false);
  const [editLeaveTypeOpen, setEditLeaveTypeOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState(null);
  const [leaveTypeForm] = Form.useForm();
  const [savingLeaveType, setSavingLeaveType] = useState(false);
  const [togglingLeaveTypeId, setTogglingLeaveTypeId] = useState(null);
  const [deletingLeaveTypeId, setDeletingLeaveTypeId] = useState(null);

  const [manualLeaveModalOpen, setManualLeaveModalOpen] = useState(false);
  const [submittingManualLeave, setSubmittingManualLeave] = useState(false);
  const [manualLeaveForm] = Form.useForm();
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [searchingEmployees, setSearchingEmployees] = useState(false);

  // Onboarding detail modal
  const [onboardingDetailOpen, setOnboardingDetailOpen] = useState(false);
  const [onboardingDetailEmployee, setOnboardingDetailEmployee] = useState(null);
  const [sendingInvite, setSendingInvite] = useState(null); // employeeId being sent
  const [workEmailModalOpen, setWorkEmailModalOpen] = useState(false);
  const [workEmailEmployee, setWorkEmailEmployee] = useState(null);
  const [settingWorkEmail, setSettingWorkEmail] = useState(false);
  const [workEmailForm] = Form.useForm();
  const [onboardingSearch, setOnboardingSearch] = useState('');
  const [onboardingExpanded, setOnboardingExpanded] = useState({});

  // Report States
  const [reportEmployee, setReportEmployee] = useState(null);
  const [reportEmployeeOptions, setReportEmployeeOptions] = useState([]);
  const [reportEmployeeSearching, setReportEmployeeSearching] = useState(false);
  const [reportDatePreset, setReportDatePreset] = useState('this_month');
  const [reportDateRange, setReportDateRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);

  const applyDatePreset = (preset) => {
    setReportDatePreset(preset);
    const today = dayjs();
    switch (preset) {
      case 'today':
        setReportDateRange([today, today]); break;
      case 'yesterday':
        setReportDateRange([today.subtract(1, 'day'), today.subtract(1, 'day')]); break;
      case 'this_week':
        setReportDateRange([today.startOf('week'), today.endOf('week')]); break;
      case 'last_week':
        setReportDateRange([today.subtract(1, 'week').startOf('week'), today.subtract(1, 'week').endOf('week')]); break;
      case 'this_month':
        setReportDateRange([today.startOf('month'), today.endOf('month')]); break;
      case 'last_month':
        setReportDateRange([today.subtract(1, 'month').startOf('month'), today.subtract(1, 'month').endOf('month')]); break;
      case 'custom':
        break; // keep current range, user picks manually
    }
  };
  const [payrollReportMonth, setPayrollReportMonth] = useState(dayjs());
  const [exportingReport, setExportingReport] = useState({ attendance: false, leaves: false, payroll: false });
  const [selectedReport, setSelectedReport] = useState('attendance');
  const [reportExportFormat, setReportExportFormat] = useState('csv');

  const offboardingTaskStats = useMemo(() => {
    const tasks = Array.isArray(offboardingDetail?.tasks) ? offboardingDetail.tasks : [];
    const total = tasks.length;
    const completed = tasks.filter((task) => Boolean(task.completed)).length;
    const remaining = Math.max(total - completed, 0);
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const allCompleted = total > 0 && completed === total;

    return {
      tasks,
      total,
      completed,
      remaining,
      progressPercent,
      allCompleted,
    };
  }, [offboardingDetail]);

  const updateTaskDraft = useCallback((taskId, payload) => {
    setTaskDrafts((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        ...payload,
      }
    }));
  }, []);

  // Attendance KPI stats
  const attKpiStats = useMemo(() => {
    const items = Array.isArray(attendanceItems) ? attendanceItems : [];
    const total = Math.max(totalEmployeeCount, items.length);
    // Treat 'half_day' as present too — a half-day employee did show up
    // for work, so they count toward the "Present Today" card. Absent still
    // only means "no attendance row" or explicit 'absent' status.
    const isPresentLike = (s) =>
      s === 'present' || s === 'checked in' || s === 'checked out' ||
      s === 'half_day' || s === 'half day';
    // Frontend fallback: when the row has check-in + check-out, derive the
    // status from hours. Fixes rows the server's auto-absent scheduler
    // flipped to 'absent' because work_hours was NULL (Bug 1 production).
    const derivedStatus = (r) => {
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
    const present = items.filter(r => isPresentLike(derivedStatus(r))).length;
    const onTime = items.filter(r => {
      const s = derivedStatus(r);
      return isPresentLike(s) && !r.isLate && String(r.tag || '').toLowerCase() !== 'late';
    }).length;
    const late = items.filter(r => {
      const s = derivedStatus(r);
      if (s === 'absent') return false;
      return s === 'late' || r.isLate === true || String(r.tag || '').toLowerCase() === 'late';
    }).length;
    const recordedAbsent = items.filter(r => derivedStatus(r) === 'absent').length;
    // Absent = employees who haven't checked in (no attendance record) + explicitly marked absent
    const absent = Math.max(recordedAbsent, total - present - late);
    return { total, present, onTime, late, absent };
  }, [attendanceItems, totalEmployeeCount]);

  // Filtered attendance items
  const filteredAttendanceItems = useMemo(() => {
    let items = Array.isArray(attendanceItems) ? attendanceItems : [];
    if (attSearch.trim()) {
      const q = attSearch.trim().toLowerCase();
      items = items.filter(r => {
        const name = String(r.employee?.name || '').toLowerCase();
        const code = String(r.employee?.employeeCode || '').toLowerCase();
        const dept = String(r.employee?.department || r.department || '').toLowerCase();
        return name.includes(q) || code.includes(q) || dept.includes(q);
      });
    }
    if (attStatusFilter !== 'all') {
      items = items.filter(r => {
        const s = String(r.status || '').toLowerCase();
        if (attStatusFilter === 'present') return s === 'present' || s === 'checked in' || s === 'checked out';
        if (attStatusFilter === 'late') return s !== 'absent' && s !== 'half_day' && s !== 'half day' && (s === 'late' || r.isLate === true || String(r.tag || '').toLowerCase() === 'late');
        if (attStatusFilter === 'absent') return s === 'absent';
        if (attStatusFilter === 'on_leave') return s === 'on leave';
        return true;
      });
    }
    if (attDeptFilter.trim()) {
      const q = attDeptFilter.trim().toLowerCase();
      items = items.filter(r => String(r.employee?.department || r.department || '').toLowerCase().includes(q));
    }
    return items;
  }, [attendanceItems, attSearch, attStatusFilter, attDeptFilter]);

  const loadAttendance = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params = { date: attendanceDate.format('YYYY-MM-DD') };
      if (branchFilter) params.branchId = branchFilter;
      const [attendanceRes, empRes] = await Promise.all([
        attendanceAPI.getTeamAttendance(null, params),
        employeeAPI.getAll({ limit: 200, ...(branchFilter ? { branchId: branchFilter } : {}) }),
      ]);
      const attendanceBody = attendanceRes?.data || [];
      const attendanceListRaw = Array.isArray(attendanceBody) ? attendanceBody : [];
      const empData = empRes?.data || empRes || {};
      const empListRaw = empData?.items || empData?.employees || (Array.isArray(empData) ? empData : []);
      // Exclude exited / deleted employees — they shouldn't appear on the
      // daily attendance roster even though they may still come back in the
      // /employees list (which HR's "Employees" page uses to show them as
      // exited). Keeps the daily view consistent with the API filter.
      const inactiveStatuses = new Set(['exited', 'deleted']);
      const empList = empListRaw.filter(emp => {
        const s = String(emp.status || '').toLowerCase();
        return !inactiveStatuses.has(s);
      });
      setTotalEmployeeCount(empList.length);

      // Drop real attendance rows belonging to exited employees too, so that
      // server-returned rows for them don't sneak in (the server's API still
      // returns them until the backend filter is deployed).
      const activeEmpIds = new Set(empList.map(e => e.id));
      const attendanceList = attendanceListRaw.filter(r => {
        const empId = r.employee?.id || r.employeeId || r['employee.id'];
        // If we can't tell the employee id, keep the row (defensive).
        return !empId || activeEmpIds.has(empId);
      });

      // Find employees with no attendance record and add them as absent
      const attendedEmpIds = new Set(
        attendanceList.map(r => r.employee?.id || r.employeeId || r['employee.id']).filter(Boolean)
      );
      const absentPlaceholders = empList
        .filter(emp => !attendedEmpIds.has(emp.id))
        .map(emp => ({
          id: `absent-${emp.id}`,
          employeeId: emp.id,
          date: attendanceDate.format('YYYY-MM-DD'),
          status: 'absent',
          checkIn: null,
          checkOut: null,
          checkInDisplay: null,
          checkOutDisplay: null,
          workHours: 0,
          isLate: false,
          isPlaceholder: true,
          employee: {
            id: emp.id,
            name: emp.name || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || 'Unknown',
            employeeCode: emp.employeeCode || emp.employeeId || 'N/A',
            designation: emp.designation || '',
            department: emp.department || '',
            avatarUrl: emp.avatarUrl || null,
          },
        }));
      setAttendanceItems([...attendanceList, ...absentPlaceholders]);
    } catch (error) {
      message.error(error?.message || 'Failed to load attendance data');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [attendanceDate, branchFilter]);

  // Populate correction form AFTER the modal mounts (destroyOnClose re-creates the Form)
  useEffect(() => {
    if (correctModalOpen && correctingRecord) {
      // Use setTimeout to ensure the Form fields have registered after mount
      const timer = setTimeout(() => {
        correctForm.setFieldsValue({
          checkInTime: correctingRecord.checkIn ? dayjs(correctingRecord.checkIn) : null,
          checkOutTime: correctingRecord.checkOut ? dayjs(correctingRecord.checkOut) : null,
          reason: '',
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [correctModalOpen, correctingRecord, correctForm]);

  const handleCorrectAttendance = async (values) => {
    if (!correctingRecord) return;

    // ── Validation: prevent broken regularizations ──────────────────────────
    // Block save when the picker values would produce nonsense, e.g. a
    // check-out from the past (different/earlier day than check-in) or a
    // check-out that is at-or-before the check-in. These cases were
    // previously stored as-is and caused negative work_hours + status flips.
    const checkInDayjs = values.checkInTime || null;
    const checkOutDayjs = values.checkOutTime || null;

    if (checkInDayjs && checkOutDayjs) {
      // Compare absolute timestamps (not just time-of-day)
      if (!checkOutDayjs.isAfter(checkInDayjs)) {
        message.error('Check-out time must be after check-in time');
        return;
      }
      // Reject "check-out is on an earlier calendar day than check-in"
      if (checkOutDayjs.isBefore(checkInDayjs, 'day')) {
        message.error("Check-out date can't be from the past (earlier than check-in)");
        return;
      }
      // Reject either time being in the future
      const now = dayjs();
      if (checkInDayjs.isAfter(now)) {
        message.error("Check-in time can't be in the future");
        return;
      }
      if (checkOutDayjs.isAfter(now)) {
        message.error("Check-out time can't be in the future");
        return;
      }
    }

    setCorrectSubmitting(true);
    try {
      const checkInISO = checkInDayjs ? checkInDayjs.toISOString() : null;
      const checkOutISO = checkOutDayjs ? checkOutDayjs.toISOString() : null;
      const reason = String(values.reason || '').trim();

      if (correctingRecord.isPlaceholder) {
        // No attendance record exists yet — create one via manual attendance
        let status = 'absent';
        if (checkInISO && checkOutISO) {
          const diffMs = new Date(checkOutISO).getTime() - new Date(checkInISO).getTime();
          const workHours = diffMs / 3_600_000;
          const fullDayHours = 9;
          const halfDayHours = 4;
          if (workHours < halfDayHours) status = 'absent';
          else if (workHours < fullDayHours) status = 'half_day';
          else status = 'present';
        } else if (checkInISO) {
          status = 'incomplete';
        }
        await hrAPI.addManualAttendance({
          employeeId: correctingRecord.employeeId,
          date: correctingRecord.date,
          checkInTime: checkInISO,
          checkOutTime: checkOutISO,
          status,
          reason,
        });
      } else {
        await hrAPI.correctAttendance(correctingRecord.id, {
          checkInTime: checkInISO,
          checkOutTime: checkOutISO,
          reason,
        });
      }
      message.success('Attendance corrected successfully');
      setCorrectModalOpen(false);
      correctForm.resetFields();
      setCorrectingRecord(null);
      loadAttendance(false);
    } catch (error) {
      message.error(error?.message || 'Failed to correct attendance');
    } finally {
      setCorrectSubmitting(false);
    }
  };

  const loadOnboarding = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params = { page: 1, limit: 20 };
      if (branchFilter) params.branchId = branchFilter;
      const onboardingRes = await hrAPI.listOnboarding(params);
      const onboardingData = extractListFromResponse(onboardingRes, ['items', 'onboarding']);
      setOnboardingItems(Array.isArray(onboardingData) ? onboardingData : []);
    } catch (error) {
      message.error(error?.message || 'Failed to load onboarding data');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [branchFilter]);

  const loadOffboarding = useCallback(async (showLoader = true, overrides = {}) => {
    if (showLoader) setLoading(true);
    try {
      const page = Number(overrides.page || offboardingPagination.page || 1);
      const limit = Number(overrides.limit || offboardingPagination.limit || 20);
      const status = Object.prototype.hasOwnProperty.call(overrides, 'status')
        ? overrides.status
        : offboardingStatus;

      const offboardingRes = await hrAPI.listOffboarding({
        page,
        limit,
        ...(status && status !== 'all' ? { status } : {}),
        ...(branchFilter ? { branchId: branchFilter } : {}),
      });
      const offboardingData = extractListFromResponse(offboardingRes, ['items', 'offboarding']);
      const pagination = extractPaginationFromResponse(offboardingRes);
      setOffboardingItems(Array.isArray(offboardingData) ? offboardingData : []);
      setOffboardingPagination({
        page: Number(pagination?.page ?? page),
        limit: Number(pagination?.limit ?? limit),
        total: Number(pagination?.total ?? 0),
        totalPages: Number(pagination?.totalPages ?? 1),
      });
    } catch (error) {
      message.error(error?.message || 'Failed to load offboarding data');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [offboardingPagination.page, offboardingPagination.limit, offboardingStatus, branchFilter]);

  const loadHolidays = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params = { year: dayjs().year() };
      if (branchFilter) params.branchId = branchFilter;
      const holidaysRes = await hrAPI.listHolidays(params);
      const holidaysData = extractListFromResponse(holidaysRes, ['items', 'holidays']);
      setHolidays(Array.isArray(holidaysData) ? holidaysData : []);
    } catch (error) {
      message.error(error?.message || 'Failed to load holidays');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [branchFilter]);

  const loadLeaveConfig = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params = branchFilter ? { branchId: branchFilter } : {};
      const response = await leaveAPI.getAccrualConfig(params);
      const config = response?.data || {};
      const normalizedConfig = {
        casualPerMonth: Number(config?.casualPerMonth ?? 1),
        sickPerMonth: Number(config?.sickPerMonth ?? 1),
        earnedPerMonth: Number(config?.earnedPerMonth ?? 1.25),
        maxPaidLeavesPerMonth: config?.maxPaidLeavesPerMonth != null ? Number(config.maxPaidLeavesPerMonth) : 3,
        updatedAt: config?.updatedAt || null,
        leaveTypes: Array.isArray(config?.leaveTypes) ? config.leaveTypes : null,
      };
      setLeaveConfig(normalizedConfig);
      leaveConfigForm.setFieldsValue({
        casualPerMonth: normalizedConfig.casualPerMonth,
        sickPerMonth: normalizedConfig.sickPerMonth,
        earnedPerMonth: normalizedConfig.earnedPerMonth,
        maxPaidLeavesPerMonth: normalizedConfig.maxPaidLeavesPerMonth,
      });
      // Merge accrual rates into leave types
      const storedTypes = normalizedConfig.leaveTypes || DEFAULT_LEAVE_TYPES;
      const merged = storedTypes.map(lt => {
        if (lt.id === 'casual') return { ...lt, accrualValue: normalizedConfig.casualPerMonth };
        if (lt.id === 'sick') return { ...lt, accrualValue: normalizedConfig.sickPerMonth };
        if (lt.id === 'earned') return { ...lt, accrualValue: normalizedConfig.earnedPerMonth };
        return lt;
      });
      setLeaveTypes(merged);
    } catch (error) {
      message.error(error?.message || 'Failed to load leave configuration');
    } finally {
      if (showLoader) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveConfigForm, branchFilter]);

  const loadTabData = useCallback(async (tab, showLoader = true) => {
    if (tab === 'attendance') return loadAttendance(showLoader);
    if (tab === 'onboarding') return loadOnboarding(showLoader);
    if (tab === 'offboarding') return loadOffboarding(showLoader);
    if (tab === 'holidays') return loadHolidays(showLoader);
    if (tab === 'leave-customization' && isHR) return loadLeaveConfig(showLoader);
    if (showLoader) setLoading(false);
  }, [loadAttendance, loadHolidays, loadLeaveConfig, loadOffboarding, loadOnboarding]);

  useEffect(() => {
    if (isAdmin) {
      adminAPI.getBranches().then(res => {
        setBranches(Array.isArray(res?.data) ? res.data : []);
      }).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    loadTabData(activeTab, true);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadAttendance(true);
    }
  }, [attendanceDate, branchFilter]);

  useEffect(() => {
    loadTabData(activeTab, true);
  }, [branchFilter]);

  useAutoRefresh(
    () => loadTabData(activeTab, false),
    {
      enabled: activeTab !== 'reports',
      scope: `hr-operations-${activeTab}`,
      intervalMs: 120000,
      deps: [activeTab, attendanceDate, offboardingStatus, offboardingPagination.page, offboardingPagination.limit, branchFilter],
    }
  );

  const completeOnboarding = async (employeeId) => {
    try {
      await hrAPI.completeOnboarding(employeeId);
      message.success('Onboarding completed');
      broadcastDataRefresh('employees');
      loadOnboarding(false);
    } catch (error) {
      message.error(error?.message || 'Failed to complete onboarding');
    }
  };

  const sendOnboardingInvite = async (employeeId) => {
    setSendingInvite(employeeId);
    try {
      await hrAPI.sendOnboardingInvite(employeeId);
      message.success('Invitation email sent successfully!');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to send invite.');
    } finally {
      setSendingInvite(null);
    }
  };

  const handleSetWorkEmail = async ({ workEmail, password }) => {
    if (!workEmailEmployee?.id) return;
    setSettingWorkEmail(true);
    try {
      await hrAPI.setWorkEmail(workEmailEmployee.id, workEmail, password);
      message.success(`Work email assigned! Credentials sent to ${workEmail}.`);
      setWorkEmailModalOpen(false);
      workEmailForm.resetFields();
      setWorkEmailEmployee(null);
      broadcastDataRefresh('employees');
      loadOnboarding(false);
    } catch (err) {
      message.error(err?.message || err?.response?.data?.error?.message || 'Failed to set work email.');
    } finally {
      setSettingWorkEmail(false);
    }
  };

  const openOnboardingDetail = (item) => {
    const empId = item.employeeId || item.employee?.id;
    if (!empId) return;
    setOnboardingDetailEmployee({ id: empId, name: item.employeeName || item.employee?.name || 'Employee' });
    setOnboardingDetailOpen(true);
  };

  const onCreateHoliday = async (values) => {
    setSubmittingHoliday(true);
    try {
      await hrAPI.createHoliday({
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        branchId: values.branchId || null,
      });
      message.success('Holiday created');
      setHolidayModalOpen(false);
      holidayForm.resetFields();
      broadcastDataRefresh('attendance');
      loadHolidays(false);
    } catch (error) {
      message.error(error?.message || 'Failed to create holiday');
    } finally {
      setSubmittingHoliday(false);
    }
  };

  const onDeleteHoliday = async (holidayId) => {
    try {
      await hrAPI.deleteHoliday(holidayId);
      message.success('Holiday deleted');
      loadHolidays(false);
    } catch (error) {
      message.error(error?.message || 'Failed to delete holiday');
    }
  };

  const onOpenEditHoliday = (holiday) => {
    setEditingHoliday(holiday);
    editHolidayForm.setFieldsValue({
      date: holiday.date ? dayjs(holiday.date) : undefined,
      name: holiday.name,
      type: holiday.type,
      location: holiday.location,
      description: holiday.description,
      branchId: holiday.branchId,
    });
    setEditHolidayModalOpen(true);
  };

  const onUpdateHoliday = async (values) => {
    setSubmittingEditHoliday(true);
    try {
      await hrAPI.updateHoliday(editingHoliday.id, {
        ...values,
        date: values.date ? values.date.format('YYYY-MM-DD') : undefined,
      });
      message.success('Holiday updated');
      setEditHolidayModalOpen(false);
      setEditingHoliday(null);
      editHolidayForm.resetFields();
      loadHolidays(false);
    } catch (error) {
      message.error(error?.message || 'Failed to update holiday');
    } finally {
      setSubmittingEditHoliday(false);
    }
  };

  const onSaveLeaveConfig = async (values) => {
    setUpdatingConfig(true);
    try {
      // Sync the new accrual rates into the current leaveTypes so both
      // the legacy flat fields and the leaveTypes array stay consistent.
      const updatedTypes = leaveTypes.map(lt => {
        if (lt.id === 'casual') return { ...lt, accrualValue: Number(values.casualPerMonth) };
        if (lt.id === 'sick') return { ...lt, accrualValue: Number(values.sickPerMonth) };
        if (lt.id === 'earned') return { ...lt, accrualValue: Number(values.earnedPerMonth) };
        return lt;
      });
      setLeaveTypes(updatedTypes);
      await leaveAPI.updateAccrualConfig({
        casualPerMonth: Number(values.casualPerMonth),
        sickPerMonth: Number(values.sickPerMonth),
        earnedPerMonth: Number(values.earnedPerMonth),
        maxPaidLeavesPerMonth: Number(values.maxPaidLeavesPerMonth ?? 3),
        leaveTypes: updatedTypes,
        ...(branchFilter ? { branchId: branchFilter } : {}),
      });
      message.success('Leave configuration updated');
      broadcastDataRefresh('leaves');
      loadLeaveConfig(false);
    } catch (error) {
      message.error(error?.message || 'Failed to update leave configuration');
    } finally {
      setUpdatingConfig(false);
    }
  };

  // Map well-known leave codes to stable IDs so leave records stay consistent
  const STABLE_CODE_TO_ID = { CL: 'casual', SL: 'sick', EL: 'earned', ML: 'maternity', PL: 'paternity' };
  const getStableLeaveTypeId = (code) => {
    const stableId = STABLE_CODE_TO_ID[code];
    // Only use stable ID if no existing leave type already uses it
    if (stableId && !leaveTypes.some(lt => lt.id === stableId)) return stableId;
    return `custom_${Date.now()}`;
  };

  const onSaveLeaveType = async (values) => {
    setSavingLeaveType(true);
    try {
      const newType = {
        id: editingLeaveType?.id || getStableLeaveTypeId(values.code?.toUpperCase()),
        name: values.name,
        code: values.code?.toUpperCase(),
        accrualType: values.accrualType,
        accrualValue: Number(values.accrualValue),
        maxBalance: Number(values.maxBalance),
        applicableTo: values.applicableTo || 'all',
        active: true,
        carryForward: Boolean(values.carryForward),
        encashment: Boolean(values.encashment),
        color: values.color || '#1368FF',
      };
      let updated;
      if (editingLeaveType) {
        updated = leaveTypes.map(lt => lt.id === editingLeaveType.id ? { ...lt, ...newType } : lt);
      } else {
        updated = [...leaveTypes, newType];
      }
      setLeaveTypes(updated);
      // Always save the full leave types list along with accrual rates
      const casual = updated.find(lt => lt.id === 'casual');
      const sick = updated.find(lt => lt.id === 'sick');
      const earned = updated.find(lt => lt.id === 'earned');
      await leaveAPI.updateAccrualConfig({
        casualPerMonth: (!casual || casual.accrualType === 'none') ? 0 : (casual.accrualValue ?? 0),
        sickPerMonth: (!sick || sick.accrualType === 'none') ? 0 : (sick.accrualValue ?? 0),
        earnedPerMonth: (!earned || earned.accrualType === 'none') ? 0 : (earned.accrualValue ?? 0),
        maxPaidLeavesPerMonth: leaveConfig?.maxPaidLeavesPerMonth ?? 3,
        leaveTypes: updated,
        ...(branchFilter ? { branchId: branchFilter } : {}),
      });
      message.success(editingLeaveType ? 'Leave type updated' : 'Leave type added');
      setAddLeaveTypeOpen(false);
      setEditLeaveTypeOpen(false);
      setEditingLeaveType(null);
      leaveTypeForm.resetFields();
    } catch (error) {
      message.error(error?.message || 'Failed to save leave type');
    } finally {
      setSavingLeaveType(false);
    }
  };

  const onToggleLeaveType = async (ltId, checked) => {
    setTogglingLeaveTypeId(ltId);
    try {
      const updated = leaveTypes.map(lt => lt.id === ltId ? { ...lt, active: checked } : lt);
      setLeaveTypes(updated);
      const casual = updated.find(lt => lt.id === 'casual');
      const sick = updated.find(lt => lt.id === 'sick');
      const earned = updated.find(lt => lt.id === 'earned');
      await leaveAPI.updateAccrualConfig({
        casualPerMonth: (!casual || casual.accrualType === 'none') ? 0 : (casual.accrualValue ?? 0),
        sickPerMonth: (!sick || sick.accrualType === 'none') ? 0 : (sick.accrualValue ?? 0),
        earnedPerMonth: (!earned || earned.accrualType === 'none') ? 0 : (earned.accrualValue ?? 0),
        maxPaidLeavesPerMonth: leaveConfig?.maxPaidLeavesPerMonth ?? 3,
        leaveTypes: updated,
        ...(branchFilter ? { branchId: branchFilter } : {}),
      });
    } catch {
      // revert on error
      setLeaveTypes(prev => prev.map(lt => lt.id === ltId ? { ...lt, active: !checked } : lt));
      message.error('Failed to update leave type status');
    } finally {
      setTogglingLeaveTypeId(null);
    }
  };

  const onDeleteLeaveType = (ltId) => {
    Modal.confirm({
      title: 'Delete Leave Type',
      content: 'Are you sure you want to delete this leave type?',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeletingLeaveTypeId(ltId);
        try {
          const updated = leaveTypes.filter(lt => lt.id !== ltId);
          setLeaveTypes(updated);
          const casual = updated.find(lt => lt.id === 'casual');
          const sick = updated.find(lt => lt.id === 'sick');
          const earned = updated.find(lt => lt.id === 'earned');
          await leaveAPI.updateAccrualConfig({
            casualPerMonth: (!casual || casual.accrualType === 'none') ? 0 : (casual.accrualValue ?? 0),
            sickPerMonth: (!sick || sick.accrualType === 'none') ? 0 : (sick.accrualValue ?? 0),
            earnedPerMonth: (!earned || earned.accrualType === 'none') ? 0 : (earned.accrualValue ?? 0),
            maxPaidLeavesPerMonth: leaveConfig?.maxPaidLeavesPerMonth ?? 3,
            leaveTypes: updated,
            ...(branchFilter ? { branchId: branchFilter } : {}),
          });
          message.success('Leave type deleted');
        } catch {
          message.error('Failed to delete leave type');
          loadLeaveConfig(false);
        } finally {
          setDeletingLeaveTypeId(null);
        }
      },
    });
  };

  const searchEmployees = async (searchText) => {
    const query = String(searchText || '').trim();
    if (query.length < 2) {
      setEmployeeOptions([]);
      return;
    }
    setSearchingEmployees(true);
    try {
      const response = await employeeAPI.getAll({
        search: query,
        page: 1,
        limit: 20,
      });
      const list = Array.isArray(response?.data) ? response.data : [];
      const options = list
        .map((employee) => ({
          value: employee?.id,
          label: `${employee?.name || 'Unknown'}${employee?.employeeCode ? ` (${employee.employeeCode})` : ''}`,
        }))
        .filter((option) => option.value);
      setEmployeeOptions(options);
    } catch (error) {
      setEmployeeOptions([]);
      message.error(error?.message || 'Failed to search employees');
    } finally {
      setSearchingEmployees(false);
    }
  };

  const searchOffboardingEmployees = async (searchText) => {
    const query = String(searchText || '').trim();
    if (query.length < 2) {
      setOffboardingEmployeeOptions([]);
      return;
    }
    setSearchingOffboardingEmployees(true);
    try {
      const response = await employeeAPI.getAll({
        search: query,
        page: 1,
        limit: 20,
        status: 'active',
      });
      const list = Array.isArray(response?.data) ? response.data : [];
      const options = list
        .map((employee) => ({
          value: employee?.id,
          label: `${employee?.name || 'Unknown'}${employee?.employeeCode ? ` (${employee.employeeCode})` : ''}`,
        }))
        .filter((option) => option.value);
      setOffboardingEmployeeOptions(options);
    } catch (error) {
      setOffboardingEmployeeOptions([]);
      message.error(error?.message || 'Failed to search employees');
    } finally {
      setSearchingOffboardingEmployees(false);
    }
  };

  const onInitiateOffboarding = async (values) => {
    setSubmittingOffboarding(true);
    try {
      await hrAPI.initiateOffboarding(values.employeeId, {
        lastWorkingDay: values.lastWorkingDay.format('YYYY-MM-DD'),
        exitReason: values.exitReason,
        additionalNotes: values.additionalNotes?.trim() || undefined,
      });
      message.success('Offboarding initiated successfully');
      setOffboardingModalOpen(false);
      offboardingForm.resetFields();
      setOffboardingEmployeeOptions([]);
      setOffboardingStatus('all');
      await loadOffboarding(false, { page: 1, status: 'all' });
      broadcastDataRefresh('employees');
    } catch (error) {
      message.error(error?.message || 'Failed to initiate offboarding');
    } finally {
      setSubmittingOffboarding(false);
    }
  };

  const openOffboardingDetail = async (employeeId) => {
    if (!employeeId) return;
    setOffboardingDetailOpen(true);
    setOffboardingDetailLoading(true);
    try {
      const response = await hrAPI.getOffboardingDetail(employeeId);
      const body = response?.data || {};
      const data = body?.data || body || {};
      setOffboardingDetail(data);
      const drafts = {};
      const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
      tasks.forEach((task) => {
        drafts[task.id] = {
          completed: Boolean(task.completed),
          notes: task.notes || '',
        };
      });
      setTaskDrafts(drafts);
    } catch (error) {
      message.error(error?.message || 'Failed to load offboarding details');
      setOffboardingDetailOpen(false);
      setOffboardingDetail(null);
      setTaskDrafts({});
    } finally {
      setOffboardingDetailLoading(false);
    }
  };

  const updateOffboardingTask = async (taskId) => {
    if (!offboardingDetail?.id || !taskId) return;
    const draft = taskDrafts[taskId] || {};
    setSavingTaskId(taskId);
    try {
      await hrAPI.updateOffboardingTask(offboardingDetail.id, taskId, {
        completed: Boolean(draft.completed),
        notes: String(draft.notes || '').trim(),
      });
      message.success('Offboarding task updated');
      await openOffboardingDetail(offboardingDetail.employeeId);
      await loadOffboarding(false);
    } catch (error) {
      message.error(error?.message || 'Failed to update task');
    } finally {
      setSavingTaskId(null);
    }
  };

  const completeOffboardingFromDetail = async () => {
    if (!offboardingDetail?.employeeId) return;
    if (!offboardingTaskStats.total) {
      message.warning('No offboarding tasks found for this employee');
      return;
    }
    if (!offboardingTaskStats.allCompleted) {
      message.warning(`Complete all tasks before finalizing offboarding (${offboardingTaskStats.completed}/${offboardingTaskStats.total})`);
      return;
    }
    setCompletingOffboarding(true);
    try {
      await hrAPI.completeOffboarding(offboardingDetail.employeeId);
      message.success('Offboarding completed successfully');
      setOffboardingDetailOpen(false);
      setOffboardingDetail(null);
      setTaskDrafts({});
      await loadOffboarding(false);
      broadcastDataRefresh('employees');
    } catch (error) {
      message.error(error?.message || 'Failed to complete offboarding');
    } finally {
      setCompletingOffboarding(false);
    }
  };

  // Map well-known leave type IDs/codes to the backend column names expected by adjustLeaveBalance
  const LEAVE_TYPE_TO_COLUMN = { casual: 'casual', CL: 'casual', sick: 'sick', SL: 'sick', earned: 'earned', EL: 'earned', maternity: 'maternity', ML: 'maternity', paternity: 'paternity', PL: 'paternity', comp_off: 'comp_off', lop: 'lop' };
  const resolveLeaveTypeColumn = (leaveTypeId) => {
    if (LEAVE_TYPE_TO_COLUMN[leaveTypeId]) return LEAVE_TYPE_TO_COLUMN[leaveTypeId];
    // Try matching via leaveTypes config code
    const lt = leaveTypes.find(t => t.id === leaveTypeId);
    if (lt?.code && LEAVE_TYPE_TO_COLUMN[lt.code]) return LEAVE_TYPE_TO_COLUMN[lt.code];
    // Fallback: use the id as-is (backend will reject unsupported types)
    return leaveTypeId;
  };

  const onManualLeaveGrant = async (values) => {
    setSubmittingManualLeave(true);
    try {
      await leaveAPI.adjustBalance(values.employeeId, {
        leaveType: resolveLeaveTypeColumn(values.leaveType),
        adjustment: Number(values.adjustment),
        reason: String(values.reason || '').trim(),
        year: Number(values.year || dayjs().year()),
      });
      message.success('Manual leave granted successfully');
      setManualLeaveModalOpen(false);
      manualLeaveForm.resetFields();
      setEmployeeOptions([]);
      broadcastDataRefresh('leaves');
    } catch (error) {
      message.error(error?.message || 'Failed to grant manual leave');
    } finally {
      setSubmittingManualLeave(false);
    }
  };

  const loadReportEmployees = async () => {
    if (reportEmployeeOptions.length > 0) return; // already loaded
    setReportEmployeeSearching(true);
    try {
      const res = await employeeAPI.getAll({ limit: 200 });
      const data = res?.data || res || {};
      const list = data?.items || data?.employees || (Array.isArray(data) ? data : []);
      setReportEmployeeOptions(list.map(e => ({
        value: e.id,
        label: `${e.name || [e.firstName, e.lastName].filter(Boolean).join(' ')} (${e.employeeCode || e.employeeId || ''})`,
      })));
    } catch { setReportEmployeeOptions([]); }
    finally { setReportEmployeeSearching(false); }
  };

  const resolveReportResponse = (response, defaultName) => {
    const fmt = reportExportFormat || 'csv';
    const ext = fmt === 'pdf' ? '.pdf' : '.csv';
    const mimeType = fmt === 'pdf' ? 'application/pdf' : 'text/csv';
    const raw = response?.data ?? response;
    const blob = raw instanceof Blob ? raw : new Blob([raw], { type: mimeType });
    const baseName = defaultName.replace(/\.\w+$/, '');
    return { blob, fileName: `${baseName}${ext}` };
  };

  const exportAttendanceReport = async () => {
    setExportingReport(prev => ({ ...prev, attendance: true }));
    try {
      const fromDate = reportDateRange?.[0] ? reportDateRange[0].format('YYYY-MM-DD') : dayjs().startOf('month').format('YYYY-MM-DD');
      const toDate = reportDateRange?.[1] ? reportDateRange[1].format('YYYY-MM-DD') : dayjs().endOf('month').format('YYYY-MM-DD');

      const response = await hrAPI.getAttendanceReport({
        fromDate,
        toDate,
        format: reportExportFormat || 'csv',
        ...(reportEmployee ? { employeeId: reportEmployee } : {}),
      });
      const { blob, fileName } = resolveReportResponse(response, 'attendance_report');
      downloadBlob(blob, fileName);
    } catch (error) {
      message.error(error?.message || 'Attendance report export failed');
    } finally {
      setExportingReport(prev => ({ ...prev, attendance: false }));
    }
  };

  const exportLeaveReport = async () => {
    setExportingReport(prev => ({ ...prev, leaves: true }));
    try {
      const fromDate = reportDateRange?.[0] ? reportDateRange[0].format('YYYY-MM-DD') : dayjs().startOf('month').format('YYYY-MM-DD');
      const toDate = reportDateRange?.[1] ? reportDateRange[1].format('YYYY-MM-DD') : dayjs().endOf('month').format('YYYY-MM-DD');

      const response = await hrAPI.getLeaveReport({
        fromDate,
        toDate,
        format: reportExportFormat || 'csv',
        ...(reportEmployee ? { employeeId: reportEmployee } : {}),
      });
      const { blob, fileName } = resolveReportResponse(response, 'leave_report');
      downloadBlob(blob, fileName);
    } catch (error) {
      message.error(error?.message || 'Leave report export failed');
    } finally {
      setExportingReport(prev => ({ ...prev, leaves: false }));
    }
  };

  const exportPayrollReport = async () => {
    setExportingReport(prev => ({ ...prev, payroll: true }));
    try {
      const selected = payrollReportMonth || dayjs();
      const month = selected.month() + 1;
      const year = selected.year();

      const response = await hrAPI.getPayrollReport({
        month,
        year,
        format: reportExportFormat || 'csv',
      });
      const { blob, fileName } = resolveReportResponse(response, 'payroll_report');
      downloadBlob(blob, fileName);
    } catch (error) {
      message.error(error?.message || 'Payroll report export failed');
    } finally {
      setExportingReport(prev => ({ ...prev, payroll: false }));
    }
  };

  const generateSelectedReport = async () => {
    if (selectedReport === 'attendance') await exportAttendanceReport();
    else if (selectedReport === 'leave') await exportLeaveReport();
    else if (selectedReport === 'payroll') await exportPayrollReport();
  };

  // Filtered offboarding items
  const filteredOffboardingItems = useMemo(() => {
    let items = offboardingItems;
    if (offboardingStatus && offboardingStatus !== 'all') {
      items = items.filter(i => i.status === offboardingStatus);
    }
    if (offboardingSearch.trim()) {
      const q = offboardingSearch.trim().toLowerCase();
      items = items.filter(i => {
        const name = (i.employeeName || i.employee?.name || (i.employeeFirstName ? `${i.employeeFirstName} ${i.employeeLastName || ''}` : '') || i.firstName || '').toLowerCase();
        const code = (i.employeeCode || i.employee?.employeeCode || '').toLowerCase();
        return name.includes(q) || code.includes(q);
      });
    }
    return items;
  }, [offboardingItems, offboardingStatus, offboardingSearch]);

  // Filtered onboarding items
  const filteredOnboardingItems = useMemo(() => {
    if (!onboardingSearch.trim()) return onboardingItems;
    const q = onboardingSearch.trim().toLowerCase();
    return onboardingItems.filter(i => {
      const name = (i.employeeName || i.employee?.name || i.employeeFirstName || '').toLowerCase();
      const code = (i.employeeCode || i.employee?.employeeCode || '').toLowerCase();
      const dept = (i.department || i.employee?.department || '').toLowerCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    });
  }, [onboardingItems, onboardingSearch]);

  const holidayColumns = [
    { title: 'Date', dataIndex: 'date', render: (v) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
    { title: 'Holiday', dataIndex: 'name', render: (v) => v || '-' },
    { title: 'Type', dataIndex: 'type', render: (v) => <Tag>{String(v || '-').toUpperCase()}</Tag> },
    ...(isAdmin ? [{ title: 'Branch', dataIndex: 'branchId', render: (v) => v ? <Tag>{v}</Tag> : <Tag color="default">All Branches</Tag> }] : []),
    {
      title: 'Action',
      align: 'right',
      render: (_, item) => (
        <Button danger type="text" onClick={() => onDeleteHoliday(item.id)}>
          Delete
        </Button>
      ),
    },
  ];

  // Attendance status config matching Figma design
  const ATT_STATUS_CONFIG = {
    present:      { label: 'Present',     bg: '#EFF6FF', color: '#1368FF', border: '#BFDBFE' },
    'checked in': { label: 'Present',     bg: '#EFF6FF', color: '#1368FF', border: '#BFDBFE' },
    late:         { label: 'Late',        bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
    incomplete:   { label: 'Incomplete',  bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
    absent:       { label: 'Absent',      bg: '#1E2875', color: '#fff',    border: '#1E2875' },
    'on leave':   { label: 'On Leave',    bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' },
    'half day':   { label: 'Half Day',    bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' },
  };

  function getAttStatusCfg(status, record) {
    const key = String(status || 'absent').toLowerCase();
    // Absent & half_day take priority over late flag
    if (key === 'absent' || key === 'half day' || key === 'half_day') return ATT_STATUS_CONFIG[key === 'half_day' ? 'half day' : key] || ATT_STATUS_CONFIG['absent'];
    if (record?.isLate === true) return ATT_STATUS_CONFIG['late'];
    return ATT_STATUS_CONFIG[key] || ATT_STATUS_CONFIG['absent'];
  }

  // Format the backend-computed `workHours` (decimal hours, e.g. 7.25 = 7h 15m)
  // into a "Xh Ym" string. Falls back to recomputing from check-in/out only if
  // workHours is missing. Using the backend value avoids two problems:
  //   1. dayjs.diff(..., 'minute') floors to whole minutes, so any session
  //      < 60 seconds renders as '-' even though hours were actually worked.
  //   2. dayjs interprets ISO strings in browser-local TZ; the backend already
  //      computed the right value in IST.
  function calcWorkingHours(checkIn, checkOut, workHours) {
    const hours = workHours != null && workHours !== ''
      ? Number(workHours)
      : (checkIn && checkOut
          ? dayjs(checkOut).diff(dayjs(checkIn), 'second') / 3600
          : NaN);
    if (!Number.isFinite(hours) || hours < 0) return '-';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }

  // Returns hours as a number (or NaN). Prefers backend-computed workHours;
  // falls back to a fresh diff so rows where the server forgot to store
  // work_hours (Bug 1 on production) still show real hours.
  function hoursForRecord(record) {
    if (record?.workHours != null && record.workHours !== '') {
      const n = Number(record.workHours);
      if (Number.isFinite(n) && n > 0) return n;
    }
    if (record?.checkIn && record?.checkOut) {
      const seconds = dayjs(record.checkOut).diff(dayjs(record.checkIn), 'second');
      if (Number.isFinite(seconds) && seconds > 0) return seconds / 3600;
    }
    return NaN;
  }

  // Frontend fallback: if the row has both check-in and check-out times AND
  // the stored status disagrees with the work-hour thresholds (because the
  // server's auto-absent scheduler flipped it to 'absent' when work_hours
  // was NULL, or work_hours was never computed), recompute the status here
  // for display purposes. The DB row stays as-is — this only fixes what HR
  // sees on the page.
  function deriveDisplayStatus(record) {
    const raw = String(record?.status || '').toLowerCase().replace(/\s+/g, '_');
    // Terminal statuses we should never override
    if (raw === 'on_leave' || raw === 'holiday') return raw;
    // No times yet → keep raw (covers 'checked_in', 'incomplete', absent placeholders)
    if (!record?.checkIn || !record?.checkOut) return raw;
    const h = hoursForRecord(record);
    if (!Number.isFinite(h) || h <= 0) return raw;
    if (h < 4) return 'absent';
    if (h < 9) return 'half_day';
    return 'present';
  }

  function getInitialsAtt(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  const ATT_GRID = isMobile ? '1fr' : '2.2fr 1.4fr 1.2fr 1.2fr 1.2fr 1fr 0.5fr';
  const ATT_HEADERS = ['Employee', 'Department', 'Time In', 'Time Out', 'Working Hours', 'Status', 'Action'];

  const AttendanceTable = ({ items, isLoading }) => (
    <div style={{
      background: '#fff',
      border: `1px solid ${themeTokens.colors.borders}`,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(16,24,40,0.06)',
    }}>
      {/* Header row */}
      {!isMobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: ATT_GRID,
          padding: '12px 24px',
          borderBottom: `1px solid ${themeTokens.colors.borders}`,
          background: themeTokens.colors.appBackground,
        }}>
          {ATT_HEADERS.map(h => (
            <Text key={h} style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.07em', color: themeTokens.colors.textTertiary,
            }}>
              {h}
            </Text>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ color: themeTokens.colors.textTertiary, fontSize: 13 }}>Loading...</div>
        </div>
      )}

      {/* Empty */}
      {!isLoading && items.length === 0 && (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ color: themeTokens.colors.textTertiary, fontSize: 13 }}>No attendance records for this date</div>
        </div>
      )}

      {/* Rows */}
      {!isLoading && items.map((record, idx) => {
        const isLast = idx === items.length - 1;
        const name = record.employee?.name || 'Unknown';
        const code = record.employee?.employeeCode || '';
        const dept = record.employee?.department || record.department || '-';
        // Use the derived status so rows whose work_hours is NULL on the
        // server (and got flipped to 'absent' by the auto-absent scheduler)
        // still show the correct badge based on the times they have.
        const displayStatus = deriveDisplayStatus(record);
        const sc = getAttStatusCfg(displayStatus, record);
        const isRegularized = record?.manualCorrection || String(record?.tag || '').toLowerCase() === 'regularized';

        return (
          <div
            key={record.id || record.employeeId || idx}
            style={{
              display: isMobile ? 'flex' : 'grid',
              gridTemplateColumns: isMobile ? undefined : ATT_GRID,
              flexDirection: isMobile ? 'column' : undefined,
              alignItems: isMobile ? undefined : 'center',
              padding: isMobile ? '16px 20px' : '14px 24px',
              borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
              gap: isMobile ? 8 : 0,
              background: '#fff',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = themeTokens.colors.appBackground}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            {/* Employee */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>
                  {getInitialsAtt(name)}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <Text strong style={{
                  fontSize: 14, display: 'block', color: themeTokens.colors.textPrimary,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3',
                }}>
                  {name}
                </Text>
                <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>
                  {code}
                </Text>
              </div>
            </div>

            {/* Department */}
            <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary }}>
              {dept}
            </Text>

            {/* Time In */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} color="#9CA3AF" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <Text style={{ fontSize: 13, color: (record.checkInDisplay || record.checkIn) ? themeTokens.colors.textPrimary : themeTokens.colors.textTertiary }}>
                {record.checkInDisplay || (record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '-')}
              </Text>
            </div>

            {/* Time Out */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} color="#9CA3AF" strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <Text style={{ fontSize: 13, color: (record.checkOutDisplay || record.checkOut) ? themeTokens.colors.textPrimary : themeTokens.colors.textTertiary }}>
                {record.checkOutDisplay || (record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '-')}
              </Text>
            </div>

            {/* Working Hours */}
            <Text style={{ fontSize: 13, fontWeight: 600, color: themeTokens.colors.textPrimary }}>
              {calcWorkingHours(record.checkIn, record.checkOut, record.workHours)}
            </Text>

            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12, fontWeight: 600,
                background: sc.bg, color: sc.color,
                border: `1px solid ${sc.border}`,
                whiteSpace: 'nowrap',
              }}>
                {sc.label}
              </span>
              {isRegularized && (
                <span style={{
                  display: 'inline-block',
                  padding: '4px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 600,
                  background: '#EFF6FF', color: '#1368FF',
                  border: '1px solid #BFDBFE',
                  whiteSpace: 'nowrap',
                }}>
                  Regularized
                </span>
              )}
            </div>

            {/* Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tooltip title="Regularize attendance">
                <button
                  onClick={() => {
                    setCorrectingRecord(record);
                    setCorrectModalOpen(true);
                  }}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    border: `1px solid ${themeTokens.colors.borders}`,
                    background: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = themeTokens.colors.appBackground}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <Pencil size={13} color={themeTokens.colors.textTertiary} />
                </button>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );

  const offboardingTaskColumns = [
    {
      title: 'Task',
      dataIndex: 'taskName',
      key: 'taskName',
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Space size={8}>
            <Text strong>{record.taskOrder}. {value}</Text>
            <Tag color={Boolean(taskDrafts[record.id]?.completed) ? 'success' : 'default'} style={{ margin: 0 }}>
              {Boolean(taskDrafts[record.id]?.completed) ? 'Done' : 'Pending'}
            </Tag>
          </Space>
          {record.completedAt && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Completed at {dayjs(record.completedAt).format('DD MMM YYYY, hh:mm A')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Completed',
      key: 'completed',
      width: 140,
      render: (_, record) => (
        <Space size={8}>
          <Switch
            checked={Boolean(taskDrafts[record.id]?.completed)}
            disabled={offboardingDetail?.status === 'completed'}
            onChange={(checked) => {
              updateTaskDraft(record.id, { completed: checked });
            }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {Boolean(taskDrafts[record.id]?.completed) ? 'Yes' : 'No'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Notes',
      key: 'notes',
      render: (_, record) => (
        <Input.TextArea
          value={taskDrafts[record.id]?.notes || ''}
          onChange={(event) => {
            updateTaskDraft(record.id, { notes: event.target.value });
          }}
          disabled={offboardingDetail?.status === 'completed'}
          rows={2}
          placeholder={Boolean(taskDrafts[record.id]?.completed) ? 'Optional completion note' : 'Add notes'}
        />
      ),
    },
    {
      title: 'Action',
      align: 'right',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          ghost
          size="small"
          loading={savingTaskId === record.id}
          disabled={offboardingDetail?.status === 'completed'}
          onClick={() => updateOffboardingTask(record.id)}
        >
          Save
        </Button>
      ),
    },
  ];

  // Tab definitions — Leave Customization is HR-only (admin cannot change leave settings)
  const tabs = [
    { key: 'attendance', label: 'Attendance', icon: <Users size={15} /> },
    { key: 'onboarding', label: 'Onboarding', icon: <ClipboardList size={15} /> },
    { key: 'offboarding', label: 'Off-boarding', icon: <LogOut size={15} /> },
    { key: 'holidays', label: 'Holidays', icon: <CalendarDays size={15} /> },
    ...(isHR ? [{ key: 'leave-customization', label: 'Leave Customization', icon: <SlidersHorizontal size={15} /> }] : []),
    { key: 'reports', label: 'Reports', icon: <FileText size={15} /> },
  ];

  return (
    <Layout>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Breadcrumb items={[{ title: <Link to="/dashboard">Dashboard</Link> }, { title: 'HR Operations' }]} />
            <Title level={2} style={{ margin: '8px 0 2px 0', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>
              HR Operations Center
            </Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {dayjs().format('dddd, MMMM D, YYYY')}
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {dayjs().format('hh:mm A')}
              </Text>
            </div>
          </div>
          <Space wrap>
            {isAdmin && branches.length > 0 && (
              <Select
                allowClear
                placeholder="All Branches"
                value={branchFilter || undefined}
                onChange={(val) => setBranchFilter(val || '')}
                style={{ minWidth: 180 }}
                options={branches.map(b => ({ value: b.id, label: b.name }))}
              />
            )}
          </Space>
        </div>

        {/* Tab Navigation — full-width white bar */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 1px 4px rgba(16,24,40,0.06)',
          border: `1px solid ${themeTokens.colors.borders}`,
          width: '100%',
        }}>
          <div style={{
            display: 'flex',
            gap: 4,
            padding: '8px 12px',
            overflowX: 'auto',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            {tabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => { sessionStorage.setItem('hrops_tab', tab.key); setActiveTab(tab.key); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 18px',
                    background: isActive ? '#1368FF' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    borderRadius: 8,
                    fontSize: 14, fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#fff' : '#6B7280',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.15s, color 0.15s',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#EBF4FF'; e.currentTarget.style.color = '#1368FF'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280'; } }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content — no container, sections render on page bg */}
        <div style={{ marginTop: 20 }}>

            {/* ── ATTENDANCE ── */}
            {activeTab === 'attendance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* ── KPI Cards ── */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                  gap: 16,
                  marginBottom: 24,
                }}>
                  {[
                    {
                      value: attKpiStats.present,
                      suffix: `/${attKpiStats.total}`,
                      label: 'Present Today',
                      iconBg: '#EFF6FF',
                      icon: <Users size={22} color={themeTokens.colors.primary} strokeWidth={1.8} />,
                    },
                    {
                      value: attKpiStats.onTime,
                      suffix: null,
                      label: 'On Time',
                      iconBg: '#EFF6FF',
                      icon: <UserCheck size={22} color={themeTokens.colors.primary} strokeWidth={1.8} />,
                    },
                    {
                      value: attKpiStats.late,
                      suffix: null,
                      label: 'Late Arrivals',
                      iconBg: '#EFF6FF',
                      icon: <Timer size={22} color={themeTokens.colors.primary} strokeWidth={1.8} />,
                    },
                    {
                      value: attKpiStats.absent,
                      suffix: null,
                      label: 'Absent',
                      iconBg: '#EFF6FF',
                      icon: <UserX size={22} color={themeTokens.colors.primary} strokeWidth={1.8} />,
                    },
                  ].map(({ value, suffix, label, iconBg, icon }) => (
                    <div key={label} style={{
                      background: '#fff',
                      border: `1px solid ${themeTokens.colors.borders}`,
                      borderRadius: 16,
                      padding: '20px 22px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 1px 3px rgba(16,24,40,0.05)',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, lineHeight: 1 }}>
                          <span style={{ fontSize: 32, fontWeight: 800, color: themeTokens.colors.textPrimary, letterSpacing: '-0.01em' }}>
                            {value}
                          </span>
                          {suffix && (
                            <span style={{ fontSize: 20, fontWeight: 600, color: themeTokens.colors.textTertiary }}>
                              {suffix}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: themeTokens.colors.textTertiary, marginTop: 8, fontWeight: 400 }}>
                          {label}
                        </div>
                      </div>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: iconBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {icon}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Search + Filter Bar — own white card ── */}
                <div style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 14,
                  padding: '10px 16px',
                  marginBottom: attSmartFilterOpen ? 12 : 24,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}>
                  {/* Search input — grows to fill available space */}
                  <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
                    <Search
                      size={15}
                      color="#9CA3AF"
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                    />
                    <input
                      placeholder="Search employees..."
                      value={attSearch}
                      onChange={e => setAttSearch(e.target.value)}
                      style={{
                        width: '100%', height: 38, paddingLeft: 36, paddingRight: attSearch ? 32 : 12,
                        border: '1px solid #E5E7EB', borderRadius: 8,
                        fontSize: 13, outline: 'none', background: '#FFFFFF',
                        color: '#111827', boxSizing: 'border-box',
                        fontFamily: 'inherit',
                      }}
                    />
                    {attSearch && (
                      <button
                        onClick={() => setAttSearch('')}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                      >
                        <X size={13} color="#9CA3AF" />
                      </button>
                    )}
                  </div>

                  {/* Status filter pills */}
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'present', label: 'Present' },
                    { key: 'late', label: 'Late' },
                    { key: 'absent', label: 'Absent' },
                    { key: 'on_leave', label: 'On Leave' },
                  ].map(({ key, label }) => {
                    const active = attStatusFilter === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setAttStatusFilter(key)}
                        style={{
                          height: 38, paddingInline: 16, borderRadius: 8,
                          fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
                          border: active ? 'none' : '1px solid #E5E7EB',
                          background: active ? '#00115B' : '#FFFFFF',
                          color: active ? '#FFFFFF' : '#6B7280',
                          whiteSpace: 'nowrap', fontFamily: 'inherit',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}

                  {/* Smart Filter button — always blue */}
                  <button
                    onClick={() => setAttSmartFilterOpen(v => !v)}
                    style={{
                      height: 38, paddingInline: 14, borderRadius: 8, cursor: 'pointer',
                      border: 'none',
                      background: '#1368FF',
                      color: '#FFFFFF',
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    <SlidersHorizontal size={15} color="#FFFFFF" strokeWidth={2} />
                    Smart Filter
                  </button>

                  {/* Month navigator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => setAttendanceDate(d => d.subtract(1, 'month'))}
                      style={{
                        width: 34, height: 34, border: '1px solid #E5E7EB', borderRadius: 8,
                        background: '#FFFFFF', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                      onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                    >
                      <svg width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M5.5 1L1 5.5l4.5 4.5" stroke="#6B7280" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <div style={{
                      height: 34, paddingInline: 16,
                      background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#00115B',
                      whiteSpace: 'nowrap', userSelect: 'none', minWidth: 120,
                    }}>
                      {attendanceDate.format('MMMM YYYY')}
                    </div>
                    <button
                      onClick={() => setAttendanceDate(d => d.add(1, 'month'))}
                      style={{
                        width: 34, height: 34, border: '1px solid #E5E7EB', borderRadius: 8,
                        background: '#FFFFFF', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                      onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                    >
                      <svg width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M1.5 1L6 5.5 1.5 10" stroke="#6B7280" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>

                  {/* List / Grid toggle */}
                  <div style={{
                    display: 'flex',
                    border: '1px solid #E5E7EB',
                    borderRadius: 8, overflow: 'hidden',
                    flexShrink: 0,
                  }}>
                    <button
                      onClick={() => setAttViewMode('list')}
                      style={{
                        width: 38, height: 38, border: 'none', cursor: 'pointer',
                        background: attViewMode === 'list' ? '#00115B' : '#F3F4F6',
                        color: attViewMode === 'list' ? '#FFFFFF' : '#9CA3AF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      <List size={16} strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => setAttViewMode('grid')}
                      style={{
                        width: 38, height: 38, border: 'none',
                        borderLeft: '1px solid #E5E7EB', cursor: 'pointer',
                        background: attViewMode === 'grid' ? '#00115B' : '#F3F4F6',
                        color: attViewMode === 'grid' ? '#FFFFFF' : '#9CA3AF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      <LayoutGrid size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* ── Advanced Filters panel ── */}
                {attSmartFilterOpen && (
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: 14,
                    padding: '18px 20px',
                    marginBottom: 24,
                  }}>
                    {/* Panel title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <SlidersHorizontal size={15} color="#1368FF" strokeWidth={2} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#00115B' }}>Advanced Filters</span>
                    </div>
                    {/* Filter fields row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr auto',
                      gap: 12,
                      alignItems: 'end',
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 6 }}>Department</div>
                        <input
                          placeholder=""
                          value={attDeptFilter}
                          onChange={e => setAttDeptFilter(e.target.value)}
                          style={{
                            width: '100%', height: 36, paddingInline: 10,
                            border: '1px solid #E5E7EB', borderRadius: 8,
                            fontSize: 13, outline: 'none', background: '#FFFFFF',
                            color: '#111827', boxSizing: 'border-box', fontFamily: 'inherit',
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 6 }}>Specific Date</div>
                        <DatePicker
                          value={attendanceDate}
                          onChange={(d) => setAttendanceDate(d || dayjs())}
                          allowClear={false}
                          style={{ width: '100%', height: 36, borderRadius: 8, border: '1px solid #E5E7EB' }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 6 }}>Shift Time</div>
                        <input
                          placeholder=""
                          disabled
                          style={{
                            width: '100%', height: 36, paddingInline: 10,
                            border: '1px solid #E5E7EB', borderRadius: 8,
                            fontSize: 13, background: '#FFFFFF',
                            color: '#9CA3AF', boxSizing: 'border-box', fontFamily: 'inherit',
                          }}
                        />
                      </div>
                      <button
                        onClick={() => { setAttDeptFilter(''); setAttSearch(''); setAttStatusFilter('all'); }}
                        style={{
                          height: 36, paddingInline: 20, borderRadius: 8, cursor: 'pointer',
                          border: '1px solid #E5E7EB', background: '#F3F4F6',
                          color: '#6B7280', fontSize: 13, fontWeight: 500,
                          whiteSpace: 'nowrap', fontFamily: 'inherit',
                        }}
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </div>
                )}

                {/* List view */}
                {attViewMode === 'list' && (
                  <AttendanceTable
                    items={filteredAttendanceItems}
                    isLoading={loading}
                  />
                )}

                {/* Grid view */}
                {attViewMode === 'grid' && (
                  loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
                  ) : filteredAttendanceItems.length === 0 ? (
                    <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                      No attendance records for this date
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                      gap: 16,
                    }}>
                      {filteredAttendanceItems.map((record, idx) => {
                        const name = record.employee?.name || 'Unknown';
                        const code = record.employee?.employeeCode || '';
                        const dept = record.employee?.department || record.department || '';
                        // Apply the same status-derivation fallback used in the
                        // table view: if the row has check-in/out, classify by
                        // hours so rows the server's auto-absent scheduler
                        // wrongly flipped to 'absent' show the correct label.
                        const rawStatus = String(deriveDisplayStatus(record) || '').toLowerCase();
                        const isAbsent = rawStatus === 'absent';
                        const isHalfDay = rawStatus === 'half_day' || rawStatus === 'half day';
                        const isLate = !isAbsent && !isHalfDay && (rawStatus === 'late' || record.isLate === true || String(record.tag || '').toLowerCase() === 'late');
                        const isOnTime = (rawStatus === 'present' || rawStatus === 'checked in' || rawStatus === 'checked out') && !isLate;
                        const isCheckedOut = rawStatus === 'checked out';
                        const isRegularized = record?.manualCorrection || String(record?.tag || '').toLowerCase() === 'regularized';
                        const initials = getInitialsAtt(name);

                        // Status badge config — dot + label, no pill bg
                        const statusDot = isAbsent
                          ? '#EF4444'
                          : isHalfDay
                            ? '#F59E0B'
                            : isLate
                              ? '#F59E0B'
                              : isCheckedOut
                                ? '#10B981'
                                : (rawStatus === 'present' || rawStatus === 'checked in')
                                  ? '#1368FF'
                                  : '#9CA3AF';
                        const statusLabel = isAbsent
                          ? 'Absent'
                          : isHalfDay
                            ? 'Half Day'
                            : isLate
                              ? 'Late'
                              : isCheckedOut
                                ? 'Checked Out'
                                : (rawStatus === 'present' || rawStatus === 'checked in')
                                  ? 'Checked In'
                                  : 'On Leave';

                        // Avatar — rounded square, alternating dark navy / blue
                        const avatarBg = idx % 2 === 0 ? '#1368FF' : '#00115B';

                        // Timing status label below check-in time
                        const timingLabel = isLate ? { text: 'Late', color: '#F59E0B' }
                          : isOnTime ? { text: 'On time', color: '#10B981' }
                          : null;

                        return (
                          <div
                            key={record.id || record.employeeId || idx}
                            style={{
                              background: '#FFFFFF',
                              border: '1px solid #E5E7EB',
                              borderRadius: 16,
                              padding: '18px 20px 16px',
                            }}
                          >
                            {/* ── Top row: avatar + name + status ── */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {/* Rounded-square avatar */}
                                <div style={{
                                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                                  background: avatarBg, color: '#FFFFFF',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 700, fontSize: 16, letterSpacing: '0.01em',
                                }}>
                                  {initials}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 15, color: '#00115B', lineHeight: 1.3 }}>
                                    {name}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                                    {code}{code && dept ? <span style={{ margin: '0 4px' }}>•</span> : ''}{dept}
                                  </div>
                                </div>
                              </div>
                              {/* Status — dot + label, no pill */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{
                                    width: 7, height: 7, borderRadius: '50%',
                                    background: statusDot, display: 'inline-block', flexShrink: 0,
                                  }} />
                                  <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', whiteSpace: 'nowrap' }}>
                                    {statusLabel}
                                  </span>
                                </div>
                                {isRegularized && (
                                  <span style={{
                                    fontSize: 11, fontWeight: 600,
                                    color: '#1368FF', whiteSpace: 'nowrap',
                                  }}>
                                    Regularized
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* ── Divider ── */}
                            <div style={{ height: 1, background: '#E5E7EB', marginBottom: 14 }} />

                            {/* ── Stats row: Check In · Check Out · Hours ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                              {/* Check In */}
                              <div>
                                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, fontWeight: 400 }}>Check In</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                                  {record.checkInDisplay || (record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '--:--')}
                                </div>
                                {timingLabel && (
                                  <div style={{ fontSize: 11, fontWeight: 500, color: timingLabel.color, marginTop: 3 }}>
                                    {timingLabel.text}
                                  </div>
                                )}
                              </div>
                              {/* Check Out */}
                              <div>
                                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, fontWeight: 400 }}>Check Out</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                                  {record.checkOutDisplay || (record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '--:--')}
                                </div>
                              </div>
                              {/* Hours */}
                              <div>
                                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, fontWeight: 400 }}>Hours</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                                  {calcWorkingHours(record.checkIn, record.checkOut, record.workHours)}
                                </div>
                              </div>
                            </div>

                            {/* ── Regularize action ── */}
                            <div style={{ marginTop: 14, borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
                              <button
                                onClick={() => {
                                  setCorrectingRecord(record);
                                  setCorrectModalOpen(true);
                                }}
                                style={{
                                  width: '100%', height: 32, borderRadius: 8,
                                  border: `1px solid ${themeTokens.colors.borders}`,
                                  background: '#fff', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                  fontSize: 12, fontWeight: 500, color: themeTokens.colors.textSecondary,
                                  fontFamily: 'inherit', transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = themeTokens.colors.appBackground}
                                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                              >
                                <Pencil size={12} strokeWidth={2} />
                                Regularize
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            )}

            {/* ── ONBOARDING ── */}
            {activeTab === 'onboarding' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1E2875', lineHeight: 1.3 }}>Employee Onboarding</div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Track onboarding progress and manage employee activation</div>
                  </div>
                  <div style={{ position: 'relative', width: isMobile ? '100%' : 280 }}>
                    <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      placeholder="Search employees..."
                      value={onboardingSearch}
                      onChange={e => setOnboardingSearch(e.target.value)}
                      style={{
                        width: '100%', height: 38, paddingLeft: 36, paddingRight: 12,
                        border: '1px solid #E5E7EB', borderRadius: 10,
                        fontSize: 13, outline: 'none', background: '#fff',
                        color: '#111827', boxSizing: 'border-box', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
                ) : filteredOnboardingItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '56px 0' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <ClipboardList size={22} color="#1368FF" />
                    </div>
                    <div style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>No onboarding records found</div>
                    <div style={{ fontSize: 13, color: '#9CA3AF' }}>
                      {onboardingSearch ? 'Try a different search term' : 'New employees will appear here once added'}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredOnboardingItems.map(item => {
                      const empId = item.employeeId || item.employee?.id;
                      const name = item.employeeName || item.employee?.name
                        || (item.employeeFirstName ? `${item.employeeFirstName} ${item.employeeLastName || ''}`.trim() : null)
                        || empId || 'Unknown';
                      const code = item.employeeCode || item.employee?.employeeCode || '';
                      const dept = item.department || item.employee?.department || '';
                      const joiningDate = item.joiningDate || item.employee?.joiningDate || null;
                      const isCompleted = item.status === 'completed';
                      const cardKey = item.id || empId;
                      const isExpanded = !!onboardingExpanded[cardKey];

                      let percent = 0;
                      const progressRaw = String(item.progress || '0');
                      if (progressRaw.includes('/')) {
                        const [d, t] = progressRaw.split('/').map(Number);
                        percent = t > 0 ? Math.round((d / t) * 100) : 0;
                      } else if (progressRaw.includes('%')) {
                        percent = parseInt(progressRaw, 10) || 0;
                      } else {
                        percent = Number(progressRaw) || 0;
                      }

                      const statusCfg = isCompleted
                        ? { label: 'Completed', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', bar: 'linear-gradient(90deg,#10B981,#34D399)' }
                        : percent > 0
                          ? { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', bar: 'linear-gradient(90deg,#1368FF,#60A5FA)' }
                          : { label: 'Pending', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', bar: '#E5E7EB' };

                      const PHASE_ORDER = ['pre_boarding', 'day_1', 'week_1', 'month_1'];
                      const PHASE_SHORT = { pre_boarding: 'Pre-boarding', day_1: 'Day 1', week_1: 'Week 1', month_1: 'Month 1' };
                      const phases = item.phases || {};
                      const phaseKeys = PHASE_ORDER.filter(k => k in phases);

                      return (
                        <div
                          key={cardKey}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #E5E7EB',
                            borderRadius: 16,
                            overflow: 'hidden',
                            boxShadow: isExpanded ? '0 4px 20px rgba(19,104,255,0.10)' : '0 1px 4px rgba(16,24,40,0.05)',
                            transition: 'box-shadow 0.25s ease',
                          }}
                        >
                          {/* ── Accordion Header (always visible, clickable) ── */}
                          <div
                            onClick={() => setOnboardingExpanded(prev => ({ ...prev, [cardKey]: !isExpanded }))}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '16px 20px', cursor: 'pointer',
                              background: isExpanded
                                ? 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)'
                                : '#FFFFFF',
                              transition: 'background 0.25s ease',
                              userSelect: 'none',
                            }}
                          >
                            {/* Left: avatar + name + meta */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                              <div style={{
                                width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                                background: isExpanded
                                  ? 'rgba(255,255,255,0.18)'
                                  : 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)',
                                border: isExpanded ? '1.5px solid rgba(255,255,255,0.30)' : 'none',
                                color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: 18, letterSpacing: '0.01em',
                                transition: 'background 0.25s ease',
                              }}>
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{
                                  fontWeight: 700, fontSize: 15,
                                  color: isExpanded ? '#FFFFFF' : '#1E2875',
                                  lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  transition: 'color 0.25s',
                                }}>
                                  {name}
                                </div>
                                <div style={{ fontSize: 12, marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '2px 6px', alignItems: 'center', color: isExpanded ? 'rgba(255,255,255,0.70)' : '#9CA3AF', transition: 'color 0.25s' }}>
                                  {code && <span>{code}</span>}
                                  {code && dept && <span>·</span>}
                                  {dept && <span>{dept}</span>}
                                  {joiningDate && (
                                    <>
                                      <span>·</span>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <CalendarDays size={10} />
                                        {dayjs(joiningDate).format('MMM D, YYYY')}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: status + progress % + chevron */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                              {/* Progress % pill */}
                              <div style={{ textAlign: 'right' }}>
                                <div style={{
                                  fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                                  color: isExpanded ? 'rgba(255,255,255,0.8)' : statusCfg.color,
                                  background: isExpanded ? 'rgba(255,255,255,0.12)' : statusCfg.bg,
                                  border: isExpanded ? '1px solid rgba(255,255,255,0.20)' : `1px solid ${statusCfg.border}`,
                                  borderRadius: 6, padding: '3px 10px',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.25s',
                                }}>
                                  {statusCfg.label}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, color: isExpanded ? 'rgba(255,255,255,0.9)' : '#1368FF', transition: 'color 0.25s' }}>
                                  {progressRaw.includes('/') ? `${progressRaw} · ${percent}%` : `${percent}%`}
                                </div>
                              </div>

                              {/* Chevron */}
                              <div style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: isExpanded ? 'rgba(255,255,255,0.15)' : '#F3F4F6',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'background 0.25s, transform 0.25s',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              }}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                  <path d="M3 5L7 9L11 5" stroke={isExpanded ? '#fff' : '#6B7280'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          {/* ── Progress bar (always visible, below header) ── */}
                          <div style={{
                            padding: isExpanded ? '0 20px' : '0 20px',
                            background: isExpanded ? 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)' : '#fff',
                            paddingBottom: isExpanded ? 16 : 0,
                            transition: 'background 0.25s',
                          }}>
                            <div style={{
                              background: isExpanded ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
                              borderRadius: 999, height: 5, overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%', borderRadius: 999,
                                width: `${percent}%`,
                                background: isExpanded ? '#fff' : statusCfg.bar,
                                minWidth: percent > 0 ? 6 : 0,
                                transition: 'width 0.5s ease',
                              }} />
                            </div>
                          </div>

                          {/* ── Expandable body ── */}
                          {/* ── Expandable body — inline checklist ── */}
                          <div style={{
                            overflow: 'hidden',
                            maxHeight: isExpanded ? 2400 : 0,
                            opacity: isExpanded ? 1 : 0,
                            transition: 'max-height 0.4s ease, opacity 0.3s ease',
                          }}>
                            <div style={{ borderTop: '1px solid #E5E7EB' }}>
                              {/* Quick actions row */}
                              {!isCompleted && (
                                <div style={{ display: 'flex', gap: 8, padding: '14px 20px 0', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={e => { e.stopPropagation(); sendOnboardingInvite(empId); }}
                                    style={{
                                      height: 34, paddingInline: 14, borderRadius: 8, cursor: 'pointer',
                                      border: '1px solid #E5E7EB', background: '#fff',
                                      display: 'flex', alignItems: 'center', gap: 6,
                                      fontSize: 12, fontWeight: 500, color: '#6B7280',
                                      fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#1368FF'; e.currentTarget.style.color = '#1368FF'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280'; }}
                                  >
                                    <Send size={13} strokeWidth={2} /> Send Invite
                                  </button>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      workEmailForm.setFieldsValue({ workEmail: item.workEmail || item.employee?.workEmail || '' });
                                      setWorkEmailEmployee({ id: empId, name });
                                      setWorkEmailModalOpen(true);
                                    }}
                                    style={{
                                      height: 34, paddingInline: 14, borderRadius: 8, cursor: 'pointer',
                                      border: '1px solid #BFDBFE', background: '#EFF6FF',
                                      display: 'flex', alignItems: 'center', gap: 6,
                                      fontSize: 12, fontWeight: 500, color: '#1368FF',
                                      fontFamily: 'inherit', transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#DBEAFE'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#EFF6FF'}
                                  >
                                    <KeyRound size={13} strokeWidth={2} /> Set Work Email
                                  </button>
                                </div>
                              )}
                              {/* Inline checklist — only mount when open */}
                              {isExpanded && (
                                <div onClick={e => e.stopPropagation()}>
                                  <OnboardingChecklist
                                    employeeId={empId}
                                    onComplete={() => loadOnboarding(false)}
                                    onActivated={() => loadOnboarding(false)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── OFFBOARDING ── */}
            {activeTab === 'offboarding' && (
              <Space direction="vertical" style={{ width: '100%' }} size={20}>
                {/* Section header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: themeTokens.colors.textPrimary, lineHeight: 1.3 }}>Employee Off-boarding</div>
                    <div style={{ fontSize: 13, color: themeTokens.colors.textTertiary, marginTop: 2 }}>Track and manage employee exit process and clearance</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button
                      icon={<Download size={14} />}
                      style={{ border: `1px solid ${themeTokens.colors.borders}`, fontWeight: 600, borderRadius: 8, height: 38, paddingInline: 16 }}
                      onClick={async () => {
                        try {
                          const params = isAdmin && branchFilter ? { branchId: branchFilter } : {};
                          const response = await hrAPI.exportOffboarding(params);
                          const raw = response?.data ?? response;
                          const blob = raw instanceof Blob ? raw : new Blob([raw], { type: 'text/csv' });
                          downloadBlob(blob, 'offboarding-report.csv');
                        } catch {
                          message.error('Failed to download offboarding report');
                        }
                      }}
                    >
                      Download Report
                    </Button>
                    <Button
                      icon={<LogOut size={14} />}
                      style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600, borderRadius: 8, height: 38, paddingInline: 16 }}
                      onClick={() => {
                        setOffboardingEmployeeOptions([]);
                        offboardingForm.setFieldsValue({
                          exitReason: 'resignation',
                          lastWorkingDay: dayjs().add(30, 'day'),
                        });
                        setOffboardingModalOpen(true);
                      }}
                    >
                      Initiate Off-boarding
                    </Button>
                  </div>
                </div>

                {/* Search + filter pills */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <Search
                      size={14}
                      color={themeTokens.colors.textTertiary}
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}
                    />
                    <input
                      placeholder="Search exiting employees..."
                      value={offboardingSearch}
                      onChange={e => setOffboardingSearch(e.target.value)}
                      style={{
                        width: '100%', height: 38, paddingLeft: 36, paddingRight: 12,
                        border: `1px solid ${themeTokens.colors.borders}`,
                        borderRadius: 8, fontSize: 14, outline: 'none',
                        color: themeTokens.colors.textPrimary,
                        background: themeTokens.colors.appBackground,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'in_progress', label: 'In Progress' },
                      { key: 'pending', label: 'Pending' },
                      { key: 'completed', label: 'Completed' },
                    ].map(opt => {
                      const isActive = offboardingStatus === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setOffboardingStatus(opt.key);
                            setOffboardingPagination(prev => ({ ...prev, page: 1 }));
                            loadOffboarding(false, { page: 1, status: opt.key });
                          }}
                          style={{
                            padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                            border: isActive ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                            cursor: 'pointer', outline: 'none',
                            background: isActive ? themeTokens.colors.primary : '#fff',
                            color: isActive ? '#fff' : themeTokens.colors.textSecondary,
                            transition: 'all 0.15s',
                            boxShadow: isActive ? '0 2px 6px rgba(19,104,255,0.25)' : 'none',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Card list */}
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Text type="secondary">Loading...</Text>
                  </div>
                ) : filteredOffboardingItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Text type="secondary">No offboarding records found.</Text>
                  </div>
                ) : (
                  filteredOffboardingItems.map(item => (
                    <OffboardingCard
                      key={item.id || item.employeeId}
                      item={item}
                      onInitiateProcess={(it) => openOffboardingDetail(it.employeeId || it.employee?.id)}
                      onRefresh={() => loadOffboarding(false)}
                    />
                  ))
                )}

                {/* Pagination */}
                {offboardingPagination.total > offboardingPagination.limit && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Space>
                      <Button
                        size="small"
                        disabled={offboardingPagination.page <= 1}
                        onClick={() => loadOffboarding(false, { page: offboardingPagination.page - 1 })}
                      >
                        Previous
                      </Button>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Page {offboardingPagination.page} of {offboardingPagination.totalPages}
                      </Text>
                      <Button
                        size="small"
                        disabled={offboardingPagination.page >= offboardingPagination.totalPages}
                        onClick={() => loadOffboarding(false, { page: offboardingPagination.page + 1 })}
                      >
                        Next
                      </Button>
                    </Space>
                  </div>
                )}
              </Space>
            )}

            {/* ── HOLIDAYS ── */}
            {activeTab === 'holidays' && (() => {
              // Per Figma card design — date badge bg/colors change per type
              const typeConfig = {
                national: { dateBg: '#EBF4FF', monthColor: '#1368FF', dayColor: '#00115B', badgeBg: '#EBF4FF', badgeColor: '#1368FF', icon: '🌐', label: 'NATIONAL' },
                regional: { dateBg: '#FEF3E2', monthColor: '#D97706', dayColor: '#D97706', badgeBg: '#FEF3E2', badgeColor: '#D97706', icon: '📍', label: 'REGIONAL' },
                company:  { dateBg: '#F0FDF4', monthColor: '#059669', dayColor: '#059669', badgeBg: '#F0FDF4', badgeColor: '#059669', icon: '⭐', label: 'COMPANY' },
                optional: { dateBg: '#F3F4F6', monthColor: '#6B7280', dayColor: '#374151', badgeBg: '#F3F4F6', badgeColor: '#6B7280', icon: '•',  label: 'OPTIONAL' },
              };

              const allHols = Array.isArray(holidays) ? holidays : [];
              const filteredHolidays = allHols.filter((h) => {
                const matchSearch = !holidaySearch || h.name?.toLowerCase().includes(holidaySearch.toLowerCase());
                const matchType = holidayTypeFilter === 'all' || h.type?.toLowerCase() === holidayTypeFilter;
                return matchSearch && matchType;
              });

              const totalCount = allHols.length;
              const nationalCount = allHols.filter(h => h.type?.toLowerCase() === 'national').length;
              const regionalCount = allHols.filter(h => h.type?.toLowerCase() === 'regional').length;
              const otherCount = allHols.filter(h => !['national', 'regional'].includes(h.type?.toLowerCase())).length;

              const grouped = {};
              filteredHolidays.forEach((h) => {
                const monthKey = h.date ? dayjs(h.date).format('MMMM YYYY') : 'Unknown';
                if (!grouped[monthKey]) grouped[monthKey] = [];
                grouped[monthKey].push(h);
              });
              Object.values(grouped).forEach(arr => arr.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()));
              const sortedMonths = Object.keys(grouped).sort((a, b) => dayjs(a, 'MMMM YYYY').valueOf() - dayjs(b, 'MMMM YYYY').valueOf());

              // stat icons using Lucide-style SVG inline or emoji matching screenshot
              const statItems = [
                { label: 'Total Holidays', count: totalCount, iconEl: <CalendarDays size={18} color="#1368FF" />, iconBg: '#EBF4FF' },
                { label: 'National',       count: nationalCount, iconEl: <span style={{ fontSize: 16 }}>🏛</span>, iconBg: '#EBF4FF' },
                { label: 'Regional',       count: regionalCount, iconEl: <span style={{ fontSize: 16 }}>⭐</span>, iconBg: '#FEF3E2' },
                { label: 'Other',          count: otherCount,    iconEl: <span style={{ fontSize: 16 }}>🌿</span>, iconBg: '#F0FDF4' },
              ];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* ── Header row ── */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 20, color: '#1E2875', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Holiday Calendar</div>
                      <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Manage company holidays and observances</div>
                    </div>
                    <Button
                      icon={<Plus size={14} />}
                      style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600, borderRadius: 8, height: 38, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                      onClick={() => {
                        holidayForm.setFieldsValue({ branchId: branchFilter || undefined });
                        setHolidayModalOpen(true);
                      }}
                    >
                      Add Holiday
                    </Button>
                  </div>

                  {/* ── Stats row ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                    {statItems.map((s) => (
                      <div key={s.label} style={{
                        background: '#fff',
                        border: `1px solid ${themeTokens.colors.borders}`,
                        borderRadius: 12,
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}>
                        <div style={{
                          background: s.iconBg, borderRadius: 8,
                          width: 36, height: 36,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {s.iconEl}
                        </div>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{s.count}</div>
                          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>{s.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── Search + filter ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Search */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: '#fff', border: `1px solid ${themeTokens.colors.borders}`,
                      borderRadius: 10, padding: '8px 12px',
                    }}>
                      <Search size={15} color="#9CA3AF" style={{ flexShrink: 0 }} />
                      <input
                        placeholder="Search holidays..."
                        value={holidaySearch}
                        onChange={(e) => setHolidaySearch(e.target.value)}
                        style={{
                          border: 'none', outline: 'none', background: 'transparent',
                          fontSize: 13, color: '#374151', width: '100%',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                    {/* Filter pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#fff', border: `1px solid ${themeTokens.colors.borders}`, borderRadius: 10, padding: '4px 6px' }}>
                      {[
                        { key: 'all', label: 'All' },
                        { key: 'national', label: 'National' },
                        { key: 'regional', label: 'Regional' },
                        { key: 'company', label: 'Company' },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setHolidayTypeFilter(key)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 8,
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: holidayTypeFilter === key ? 700 : 500,
                            fontSize: 13,
                            background: holidayTypeFilter === key ? '#1368FF' : 'transparent',
                            color: holidayTypeFilter === key ? '#fff' : '#6B7280',
                            transition: 'all 0.15s',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Month groups ── */}
                  {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>Loading holidays...</div>
                  ) : sortedMonths.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No holidays found.</div>
                  ) : sortedMonths.map((monthLabel) => (
                    <div key={monthLabel}>
                      {/* Month header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{monthLabel}</span>
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                          {grouped[monthLabel].length} holiday{grouped[monthLabel].length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Card grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                        {grouped[monthLabel].map((h) => {
                          const hDay = h.date ? dayjs(h.date) : null;
                          const typeKey = (h.type || 'optional').toLowerCase();
                          const tc = typeConfig[typeKey] || typeConfig.optional;

                          return (
                            <div key={h.id} style={{
                              background: '#fff',
                              border: `1px solid ${themeTokens.colors.borders}`,
                              borderRadius: 12,
                              padding: '14px 16px',
                              display: 'flex',
                              gap: 14,
                              alignItems: 'flex-start',
                            }}>
                              {/* Date badge — colored bg per type, per Figma */}
                              <div style={{
                                width: 52, minWidth: 52, height: 64,
                                borderRadius: 10,
                                background: tc.dateBg,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: tc.monthColor, textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1.4 }}>
                                  {hDay ? hDay.format('MMM') : '—'}
                                </span>
                                <span style={{ fontSize: 26, fontWeight: 800, color: tc.dayColor, lineHeight: 1.1 }}>
                                  {hDay ? hDay.format('D') : '—'}
                                </span>
                              </div>

                              {/* Content */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Name + day-of-week */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                                  <span style={{ fontWeight: 700, fontSize: 14, color: '#111827', lineHeight: 1.3 }}>{h.name || '—'}</span>
                                  <span style={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0, marginTop: 1 }}>{hDay ? hDay.format('ddd') : ''}</span>
                                </div>

                                {/* Description */}
                                {h.description && (
                                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 1.4 }}>{h.description}</div>
                                )}

                                {/* Type badge */}
                                <div style={{ marginTop: 8 }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    padding: '3px 10px', borderRadius: 20,
                                    background: tc.badgeBg,
                                    fontSize: 11, fontWeight: 700, color: tc.badgeColor,
                                    letterSpacing: '0.04em',
                                  }}>
                                    <span style={{ fontSize: 12, lineHeight: 1 }}>{tc.icon}</span>
                                    {tc.label}
                                  </span>
                                </div>

                                {/* Location pill — own row, amber bg like Figma */}
                                {h.location && (
                                  <div style={{ marginTop: 6 }}>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 5,
                                      padding: '4px 10px', borderRadius: 6,
                                      background: '#FEF3E2',
                                      fontSize: 12, color: '#D97706', fontWeight: 500,
                                    }}>
                                      📍 {h.location}
                                    </span>
                                  </div>
                                )}

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                  <button
                                    onClick={() => onOpenEditHoliday(h)}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 5,
                                      padding: '6px 16px', borderRadius: 6,
                                      border: `1px solid ${themeTokens.colors.borderLight}`,
                                      background: '#fff', color: '#374151',
                                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                      fontFamily: 'inherit',
                                    }}
                                  >
                                    <Pencil size={12} color="#374151" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => onDeleteHoliday(h.id)}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 5,
                                      padding: '6px 16px', borderRadius: 6,
                                      border: '1px solid #FECACA',
                                      background: '#FEF2F2', color: '#DC2626',
                                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                      fontFamily: 'inherit',
                                    }}
                                  >
                                    <Trash2 size={12} color="#DC2626" />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── LEAVE CUSTOMIZATION (HR only) ── */}
            {activeTab === 'leave-customization' && isHR && (() => {
              const activeCount = leaveTypes.filter(lt => lt.active).length;
              const accrualCount = leaveTypes.filter(lt => lt.accrualType === 'monthly').length;
              const carryCount = leaveTypes.filter(lt => lt.carryForward).length;
              const encashCount = leaveTypes.filter(lt => lt.encashment).length;

              const APPLICABLE_LABELS = { all: 'All Employees', male: 'Male Employees', female: 'Female Employees' };
              const TYPE_COLORS = ['#1368FF','#F59E0B','#10B981','#8B5CF6','#EC4899','#EF4444','#06B6D4','#F97316'];

              const getAbbrevBadgeStyle = (color) => ({
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: color ? `${color}18` : '#EBF4FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 10, color: color || '#1368FF',
                letterSpacing: '0.03em',
              });

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 20, color: '#1E2875', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Leave Configuration</div>
                      <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Manage leave types, accrual rates, and policies</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
                      <Button
                        icon={<Gift size={14} />}
                        style={{ border: `1px solid ${themeTokens.colors.borders}`, background: '#fff', color: '#374151', fontWeight: 600, borderRadius: 8, height: 38, display: 'flex', alignItems: 'center', gap: 4, flex: isMobile ? 1 : 'none' }}
                        onClick={() => {
                          setEmployeeOptions([]);
                          setManualLeaveModalOpen(true);
                        }}
                      >
                        Manual Grant
                      </Button>
                      <Button
                        icon={<Plus size={14} />}
                        style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600, borderRadius: 8, height: 38, display: 'flex', alignItems: 'center', gap: 4, flex: isMobile ? 1 : 'none' }}
                        onClick={() => {
                          leaveTypeForm.resetFields();
                          leaveTypeForm.setFieldsValue({ accrualType: 'monthly', applicableTo: 'all', accrualValue: 1, maxBalance: 12, carryForward: false, encashment: false, color: '#1368FF' });
                          setEditingLeaveType(null);
                          setAddLeaveTypeOpen(true);
                        }}
                      >
                        Add Leave Type
                      </Button>
                    </div>
                  </div>

                  {/* Policy Settings */}
                  <div style={{ background: '#fff', border: `1px solid ${themeTokens.colors.borders}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2875' }}>Max Paid Leaves Per Month</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Limit how many paid leave days an employee can take in a single month</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <InputNumber
                        min={0}
                        max={31}
                        value={leaveConfig?.maxPaidLeavesPerMonth ?? 3}
                        onChange={async (val) => {
                          try {
                            await leaveAPI.updateAccrualConfig({
                              ...leaveConfig,
                              leaveTypes,
                              maxPaidLeavesPerMonth: val,
                              ...(branchFilter ? { branchId: branchFilter } : {}),
                            });
                            setLeaveConfig(prev => ({ ...prev, maxPaidLeavesPerMonth: val }));
                            message.success(`Max paid leaves per month updated to ${val}`);
                          } catch (e) { message.error(e?.message || 'Failed to update'); }
                        }}
                        style={{ width: 80 }}
                      />
                      <span style={{ fontSize: 12, color: '#6B7280' }}>days</span>
                    </div>
                  </div>

                  {/* Table card */}
                  <div style={{ background: '#fff', border: `1px solid ${themeTokens.colors.borders}`, borderRadius: 12, overflow: 'hidden' }}>

                    {loading ? (
                      <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>Loading leave types...</div>
                    ) : leaveTypes.length === 0 ? (
                      <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>No leave types configured.</div>
                    ) : isMobile ? (
                      /* ── Mobile: card-per-leave-type ── */
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {leaveTypes.map((lt, idx) => (
                          <div key={lt.id} style={{
                            padding: '14px 16px',
                            borderBottom: idx < leaveTypes.length - 1 ? `1px solid ${themeTokens.colors.borders}` : 'none',
                          }}>
                            {/* Top row: badge + name + actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={getAbbrevBadgeStyle(lt.color)}>
                                {lt.code || lt.name?.substring(0, 2).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{lt.name}</div>
                                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{lt.code}</div>
                              </div>
                              {/* Actions inline */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                                <button
                                  onClick={() => {
                                    setEditingLeaveType(lt);
                                    leaveTypeForm.setFieldsValue({ name: lt.name, code: lt.code, accrualType: lt.accrualType, accrualValue: lt.accrualValue, maxBalance: lt.maxBalance, applicableTo: lt.applicableTo, carryForward: lt.carryForward, encashment: lt.encashment, color: lt.color || '#1368FF' });
                                    setEditLeaveTypeOpen(true);
                                  }}
                                  style={{ background: '#F3F4F6', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                                <button
                                  onClick={() => onDeleteLeaveType(lt.id)}
                                  disabled={deletingLeaveTypeId === lt.id}
                                  style={{ background: '#FEF2F2', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            </div>
                            {/* Detail grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 12px', marginTop: 12 }}>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Accrual</div>
                                <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                                  {lt.accrualType === 'monthly' ? `${lt.accrualValue}/month` : lt.accrualType === 'fixed' ? 'Fixed' : lt.accrualType || '—'}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Max Balance</div>
                                <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{lt.maxBalance ? `${lt.maxBalance} days` : '—'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Applicable To</div>
                                <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{APPLICABLE_LABELS[lt.applicableTo] || lt.applicableTo || 'All Employees'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Status</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Switch size="small" checked={lt.active} loading={togglingLeaveTypeId === lt.id} onChange={(checked) => onToggleLeaveType(lt.id, checked)} style={{ background: lt.active ? '#10B981' : undefined }} />
                                  <span style={{ fontSize: 12, color: lt.active ? '#10B981' : '#9CA3AF', fontWeight: 600 }}>{lt.active ? 'Active' : 'Inactive'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* ── Desktop: grid table ── */
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1fr 100px', padding: '10px 20px', background: themeTokens.colors.appBackground, borderBottom: `1px solid ${themeTokens.colors.borders}`, gap: 12 }}>
                          {['LEAVE TYPE', 'ACCRUAL', 'MAX BALANCE', 'APPLICABLE TO', 'STATUS', 'ACTIONS'].map((col) => (
                            <div key={col} style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{col}</div>
                          ))}
                        </div>
                        {leaveTypes.map((lt, idx) => (
                          <div key={lt.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1fr 100px', padding: '14px 20px', gap: 12, alignItems: 'center', borderBottom: idx < leaveTypes.length - 1 ? `1px solid ${themeTokens.colors.borders}` : 'none', background: '#fff', transition: 'background 0.15s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={getAbbrevBadgeStyle(lt.color)}>{lt.code || lt.name?.substring(0, 2).toUpperCase()}</div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{lt.name}</div>
                                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{lt.code}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, color: '#374151' }}>{lt.accrualType === 'monthly' ? `${lt.accrualValue}/month` : lt.accrualType === 'fixed' ? 'Fixed' : lt.accrualType || '—'}</div>
                            <div style={{ fontSize: 13, color: '#374151' }}>{lt.maxBalance ? `${lt.maxBalance} days` : '—'}</div>
                            <div style={{ fontSize: 13, color: '#374151' }}>{APPLICABLE_LABELS[lt.applicableTo] || lt.applicableTo || 'All Employees'}</div>
                            <div>
                              <Switch size="small" checked={lt.active} loading={togglingLeaveTypeId === lt.id} onChange={(checked) => onToggleLeaveType(lt.id, checked)} style={{ background: lt.active ? '#10B981' : undefined }} />
                              <span style={{ fontSize: 12, color: lt.active ? '#10B981' : '#9CA3AF', marginLeft: 6, fontWeight: 500 }}>{lt.active ? 'Active' : 'Inactive'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Tooltip title="Edit">
                                <button onClick={() => { setEditingLeaveType(lt); leaveTypeForm.setFieldsValue({ name: lt.name, code: lt.code, accrualType: lt.accrualType, accrualValue: lt.accrualValue, maxBalance: lt.maxBalance, applicableTo: lt.applicableTo, carryForward: lt.carryForward, encashment: lt.encashment, color: lt.color || '#1368FF' }); setEditLeaveTypeOpen(true); }} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                                  <Pencil size={14} />
                                </button>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <button onClick={() => onDeleteLeaveType(lt.id)} disabled={deletingLeaveTypeId === lt.id} style={{ background: 'none', border: 'none', padding: '4px 6px', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                                  <Trash2 size={14} />
                                </button>
                              </Tooltip>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Footer stats */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                      gap: isMobile ? '8px' : 0,
                      padding: isMobile ? '12px 16px' : '10px 20px',
                      borderTop: `1px solid ${themeTokens.colors.borders}`,
                      background: themeTokens.colors.appBackground,
                    }}>
                      {[
                        { dot: '#10B981', label: `${activeCount} Active Type${activeCount !== 1 ? 's' : ''}` },
                        { dot: '#1368FF', label: `${accrualCount} Accrual Based` },
                        { dot: '#F59E0B', label: `${carryCount} Carry Forward Enabled` },
                        { dot: '#8B5CF6', label: `${encashCount} Encashment Allowed` },
                      ].map((s) => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0, display: 'inline-block' }} />
                          {s.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Add / Edit Leave Type Modal */}
            {(addLeaveTypeOpen || editLeaveTypeOpen) && (
              <Modal
                title={
                  <span style={{ color: '#1E2875', fontWeight: 700 }}>
                    {editLeaveTypeOpen ? 'Edit Leave Type' : '+ Add Leave Type'}
                  </span>
                }
                open={addLeaveTypeOpen || editLeaveTypeOpen}
                onCancel={() => { setAddLeaveTypeOpen(false); setEditLeaveTypeOpen(false); setEditingLeaveType(null); leaveTypeForm.resetFields(); }}
                footer={null}
                width={isMobile ? '100%' : 520}
                style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', padding: 0 } : {}}
                centered={!isMobile}
              >
                <Form
                  form={leaveTypeForm}
                  layout="vertical"
                  onFinish={onSaveLeaveType}
                  style={{ marginTop: 16 }}
                  onValuesChange={(changed) => {
                    if (changed.accrualType === 'none') {
                      leaveTypeForm.setFieldsValue({ accrualValue: 0 });
                    }
                  }}
                >
                  {!editLeaveTypeOpen && (
                    <Form.Item label="Quick Select (Optional)">
                      <Select
                        placeholder="Choose a preset leave type..."
                        allowClear
                        onChange={(val) => {
                          const PRESETS = {
                            casual:    { name: 'Casual Leave',    code: 'CL',  accrualType: 'monthly', accrualValue: 1,    maxBalance: 12,  applicableTo: 'all',    carryForward: false, encashment: false, color: '#1368FF' },
                            sick:      { name: 'Sick Leave',      code: 'SL',  accrualType: 'monthly', accrualValue: 0.5,  maxBalance: 6,   applicableTo: 'all',    carryForward: false, encashment: false, color: '#F59E0B' },
                            earned:    { name: 'Earned Leave',    code: 'EL',  accrualType: 'monthly', accrualValue: 1.25, maxBalance: 15,  applicableTo: 'all',    carryForward: true,  encashment: false, color: '#10B981' },
                            maternity: { name: 'Maternity Leave', code: 'ML',  accrualType: 'fixed',   accrualValue: 180,  maxBalance: 180, applicableTo: 'female', carryForward: false, encashment: true,  color: '#EC4899' },
                            paternity: { name: 'Paternity Leave', code: 'PL',  accrualType: 'fixed',   accrualValue: 15,   maxBalance: 15,  applicableTo: 'male',   carryForward: false, encashment: false, color: '#8B5CF6' },
                          };
                          if (val && PRESETS[val]) leaveTypeForm.setFieldsValue(PRESETS[val]);
                        }}
                        options={[
                          { value: 'casual',    label: 'Casual Leave' },
                          { value: 'sick',      label: 'Sick Leave' },
                          { value: 'earned',    label: 'Earned Leave' },
                          { value: 'maternity', label: 'Maternity Leave' },
                          { value: 'paternity', label: 'Paternity Leave' },
                        ]}
                      />
                    </Form.Item>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                    <Form.Item name="name" label="Leave Type Name" rules={[{ required: true, message: 'Name is required' }]}>
                      <Input placeholder="e.g. Casual Leave" />
                    </Form.Item>
                    <Form.Item name="code" label="Short Code" rules={[{ required: true, message: 'Code is required' }, { max: 4, message: 'Max 4 characters' }]}>
                      <Input placeholder="e.g. CL" maxLength={4} style={{ textTransform: 'uppercase' }} />
                    </Form.Item>
                    <Form.Item name="accrualType" label="Accrual Type" rules={[{ required: true }]}>
                      <Select>
                        <Select.Option value="monthly">Monthly</Select.Option>
                        <Select.Option value="fixed">Fixed (one-time)</Select.Option>
                        <Select.Option value="none">No Accrual</Select.Option>
                      </Select>
                    </Form.Item>
                    <Form.Item name="accrualValue" label="Accrual Value (days)" rules={[{ required: true, message: 'Value is required' }]}>
                      <InputNumber min={0} step={0.25} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="maxBalance" label="Max Balance (days)" rules={[{ required: true, message: 'Max balance is required' }]}>
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="applicableTo" label="Applicable To">
                      <Select>
                        <Select.Option value="all">All Employees</Select.Option>
                        <Select.Option value="male">Male Employees</Select.Option>
                        <Select.Option value="female">Female Employees</Select.Option>
                      </Select>
                    </Form.Item>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                    <Form.Item name="carryForward" label="Carry Forward" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </div>
                  <Form.Item name="color" label="Color">
                    <Select>
                      {['#1368FF','#F59E0B','#10B981','#8B5CF6','#EC4899','#EF4444','#06B6D4','#F97316'].map(c => (
                        <Select.Option key={c} value={c}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 14, height: 14, borderRadius: '50%', background: c, display: 'inline-block' }} />
                            {c}
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <Button onClick={() => { setAddLeaveTypeOpen(false); setEditLeaveTypeOpen(false); setEditingLeaveType(null); leaveTypeForm.resetFields(); }}>
                      Cancel
                    </Button>
                    <Button
                      htmlType="submit"
                      loading={savingLeaveType}
                      style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600, borderRadius: 8 }}
                    >
                      {editLeaveTypeOpen ? 'Save Changes' : 'Add Leave Type'}
                    </Button>
                  </div>
                </Form>
              </Modal>
            )}

            {/* ── REPORTS ── */}
            {activeTab === 'reports' && (() => {
              const REPORT_TYPES = [
                {
                  key: 'attendance',
                  title: 'Attendance Report',
                  description: 'Daily attendance with check-in/check-out times',
                  icon: CalendarDays,
                  color: '#1368FF',
                  bg: '#EBF3FF',
                },
                {
                  key: 'leave',
                  title: 'Leave Summary',
                  description: 'Leave applications, approvals, and balances',
                  icon: CheckSquare,
                  color: '#10B981',
                  bg: '#D1FAE5',
                },
                {
                  key: 'payroll',
                  title: 'Payroll Summary',
                  description: 'Salaries, deductions, and net pay',
                  icon: DollarSign,
                  color: '#F59E0B',
                  bg: '#FEF3C7',
                },
              ];

              const activeReportDef = REPORT_TYPES.find(r => r.key === selectedReport);
              const isGenerating =
                selectedReport === 'attendance' ? exportingReport.attendance
                  : selectedReport === 'leave' ? exportingReport.leaves
                    : exportingReport.payroll;
              const isDateRange = selectedReport === 'attendance' || selectedReport === 'leave';

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Header */}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 20, color: '#1E2875', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                      Generate Reports
                    </div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                      Select a report type and download in your preferred format
                    </div>
                  </div>

                  {/* Report Type Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
                    gap: 16,
                  }}>
                    {REPORT_TYPES.map((rt) => {
                      const IconComp = rt.icon;
                      const isSelected = selectedReport === rt.key;
                      return (
                        <div
                          key={rt.key}
                          onClick={() => setSelectedReport(rt.key)}
                          style={{
                            position: 'relative',
                            border: isSelected ? `2px solid ${rt.color}` : `1.5px solid ${themeTokens.colors.borders}`,
                            borderRadius: 14,
                            padding: '20px 16px',
                            cursor: 'pointer',
                            background: '#fff',
                            transition: 'all 0.18s ease',
                            boxShadow: isSelected ? `0 0 0 3px ${rt.color}20` : '0 1px 4px rgba(0,0,0,0.05)',
                          }}
                        >
                          {isSelected && (
                            <div style={{
                              position: 'absolute', top: 10, right: 10,
                              width: 20, height: 20, borderRadius: '50%',
                              background: rt.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <CheckCircle2 size={13} color="#fff" strokeWidth={3} />
                            </div>
                          )}
                          <div style={{
                            width: 44, height: 44, borderRadius: 11,
                            background: rt.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 12,
                          }}>
                            <IconComp size={22} color={rt.color} />
                          </div>
                          <div style={{
                            fontWeight: 700,
                            fontSize: isMobile ? 12 : 13,
                            color: '#111827',
                            marginBottom: 4,
                            lineHeight: 1.3,
                          }}>
                            {rt.title}
                          </div>
                          <div style={{
                            fontSize: isMobile ? 11 : 12,
                            color: '#6B7280',
                            lineHeight: 1.4,
                          }}>
                            {rt.description}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Configuration Panel */}
                  <div style={{
                    border: `1.5px solid ${themeTokens.colors.borders}`,
                    borderRadius: 14,
                    padding: isMobile ? 20 : 24,
                    background: '#fff',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                      {activeReportDef && (
                        <div style={{
                          width: 34, height: 34, borderRadius: 9,
                          background: activeReportDef.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {(() => { const I = activeReportDef.icon; return <I size={17} color={activeReportDef.color} />; })()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                          {activeReportDef?.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>
                          Configure your report parameters
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : isDateRange
                        ? (reportDatePreset === 'custom' ? 'repeat(5, 1fr)' : 'repeat(3, 1fr)')
                        : 'repeat(3, 1fr)',
                      gap: 16,
                      alignItems: 'end',
                    }}>
                      {isDateRange ? (
                        <>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Date Range</div>
                            <Select
                              value={reportDatePreset}
                              onChange={applyDatePreset}
                              style={{ width: '100%' }}
                              options={[
                                { value: 'today', label: 'Today' },
                                { value: 'yesterday', label: 'Yesterday' },
                                { value: 'this_week', label: 'This Week' },
                                { value: 'last_week', label: 'Last Week' },
                                { value: 'this_month', label: 'This Month' },
                                { value: 'last_month', label: 'Last Month' },
                                { value: 'custom', label: 'Custom' },
                              ]}
                            />
                          </div>
                          {reportDatePreset === 'custom' && (
                            <>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>From Date</div>
                                <DatePicker
                                  value={reportDateRange?.[0]}
                                  onChange={(date) => setReportDateRange(prev => [date, prev?.[1]])}
                                  style={{ width: '100%' }}
                                  placeholder="Start date"
                                />
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>To Date</div>
                                <DatePicker
                                  value={reportDateRange?.[1]}
                                  onChange={(date) => setReportDateRange(prev => [prev?.[0], date])}
                                  style={{ width: '100%' }}
                                  placeholder="End date"
                                />
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Month</div>
                          <DatePicker
                            picker="month"
                            value={payrollReportMonth}
                            onChange={(date) => setPayrollReportMonth(date)}
                            style={{ width: '100%' }}
                          />
                        </div>
                      )}

                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Employee (Optional)</div>
                        <Select
                          value={reportEmployee}
                          onChange={setReportEmployee}
                          onFocus={loadReportEmployees}
                          showSearch
                          allowClear
                          optionFilterProp="label"
                          loading={reportEmployeeSearching}
                          placeholder="All Employees"
                          style={{ width: '100%' }}
                          options={reportEmployeeOptions}
                          notFoundContent={reportEmployeeSearching ? 'Loading...' : 'No employees found'}
                        />
                      </div>

                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Export Format</div>
                        <Select
                          value={reportExportFormat}
                          onChange={setReportExportFormat}
                          style={{ width: '100%' }}
                          options={[
                            { value: 'csv', label: 'CSV' },
                            { value: 'pdf', label: 'PDF' },
                          ]}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{
                      display: 'flex',
                      gap: 12,
                      marginTop: 24,
                      flexWrap: 'wrap',
                    }}>
                      <button
                        onClick={generateSelectedReport}
                        disabled={isGenerating}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          padding: '10px 22px',
                          borderRadius: 9,
                          border: 'none',
                          background: isGenerating ? '#93C5FD' : BTN_GRADIENT,
                          color: '#fff',
                          fontWeight: 700, fontSize: 13,
                          cursor: isGenerating ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit',
                          transition: 'opacity 0.15s',
                        }}
                      >
                        {isGenerating
                          ? <><span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #fff3', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Generating...</>
                          : <><Download size={14} /> Generate &amp; Download</>
                        }
                      </button>
                    </div>
                  </div>

                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              );
            })()}

        </div>
      </Space>

      {/* ── ONBOARDING DETAIL MODAL ── */}
      <Modal
        title={
          <Space>
            <ClipboardList size={18} color={themeTokens.colors.primary} />
            <span style={{ color: '#1E2875' }}>
              Onboarding Checklist — {onboardingDetailEmployee?.name || 'Employee'}
            </span>
          </Space>
        }
        open={onboardingDetailOpen}
        onCancel={() => { setOnboardingDetailOpen(false); setOnboardingDetailEmployee(null); }}
        footer={null}
        width={isMobile ? 'calc(100vw - 16px)' : 780}
        style={isMobile ? { top: 8 } : undefined}
        centered
        destroyOnClose
        maskClosable={false}
        zIndex={1400}
      >
        {onboardingDetailEmployee?.id && (
          <OnboardingChecklist
            employeeId={onboardingDetailEmployee.id}
            onComplete={() => {
              setOnboardingDetailOpen(false);
              setOnboardingDetailEmployee(null);
              loadOnboarding(false);
              broadcastDataRefresh('employees');
            }}
            onActivated={() => {
              loadOnboarding(false);
              broadcastDataRefresh('employees');
              workEmailForm.setFieldsValue({ workEmail: '' });
              setWorkEmailEmployee(onboardingDetailEmployee);
              setWorkEmailModalOpen(true);
            }}
          />
        )}
      </Modal>

      {/* ── SET WORK EMAIL MODAL ── */}
      <Modal
        title={
          <Space>
            <KeyRound size={18} color={themeTokens.colors.primary} />
            <span style={{ color: '#1E2875' }}>
              Assign Work Email{workEmailEmployee?.name ? ` — ${workEmailEmployee.name}` : ''}
            </span>
          </Space>
        }
        open={workEmailModalOpen}
        onCancel={() => { setWorkEmailModalOpen(false); workEmailForm.resetFields(); setWorkEmailEmployee(null); }}
        footer={null}
        width={isMobile ? '100%' : 480}
        style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', padding: 0 } : {}}
        centered={!isMobile}
        destroyOnClose
        maskClosable={false}
        zIndex={1500}
      >
        <div style={{ padding: '8px 0 4px' }}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 20, borderRadius: 8 }}
            message="Assign a work email to enable login"
            description="Set the work email and password. Login credentials will be sent to the work email address."
          />
          <Form form={workEmailForm} layout="vertical" onFinish={handleSetWorkEmail}>
            <Form.Item
              name="workEmail"
              label="Work Email Address"
              rules={[
                { required: true, message: 'Please enter the work email' },
                { type: 'email', message: 'Enter a valid email address' },
              ]}
            >
              <Input
                prefix={<Mail size={14} />}
                placeholder="employee@company.com"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Please enter a password' },
                { min: 8, message: 'Password must be at least 8 characters' },
              ]}
            >
              <Input.Password
                placeholder="Set login password"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => { setWorkEmailModalOpen(false); workEmailForm.resetFields(); setWorkEmailEmployee(null); }}>
                  Skip for Now
                </Button>
                <Button
                  htmlType="submit"
                  loading={settingWorkEmail}
                  style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}
                >
                  Assign Work Email
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* ── INITIATE OFFBOARDING MODAL ── */}
      <Modal
        title="Initiate Offboarding"
        open={offboardingModalOpen}
        onCancel={() => setOffboardingModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
        maskClosable={false}
        zIndex={1400}
      >
        <Form layout="vertical" form={offboardingForm} onFinish={onInitiateOffboarding}>
          <Form.Item
            name="employeeId"
            label="Employee"
            rules={[{ required: true, message: 'Employee is required' }]}
          >
            <Select
              showSearch
              filterOption={false}
              onSearch={searchOffboardingEmployees}
              options={offboardingEmployeeOptions}
              loading={searchingOffboardingEmployees}
              placeholder="Search active employee by name"
              notFoundContent={searchingOffboardingEmployees ? 'Searching...' : 'Type at least 2 characters'}
            />
          </Form.Item>
          <Form.Item
            name="lastWorkingDay"
            label="Last Working Day"
            rules={[{ required: true, message: 'Last working day is required' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="exitReason"
            label="Exit Reason"
            rules={[{ required: true, message: 'Exit reason is required' }]}
          >
            <Select
              options={[
                { value: 'resignation', label: 'Resignation' },
                { value: 'termination', label: 'Termination' },
                { value: 'retirement', label: 'Retirement' },
                { value: 'absconding', label: 'Absconding' },
                { value: 'better_opportunity', label: 'Better Opportunity' },
                { value: 'relocation', label: 'Relocation' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </Form.Item>
          <Form.Item name="additionalNotes" label="Additional Notes">
            <Input.TextArea rows={3} placeholder="Handover details, notes, etc." />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setOffboardingModalOpen(false)}>Cancel</Button>
            <Button
              htmlType="submit"
              loading={submittingOffboarding}
              style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}
            >
              Initiate
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* ── OFFBOARDING DETAIL MODAL ── */}
      <Modal
        title="Offboarding Details"
        open={offboardingDetailOpen}
        onCancel={() => {
          setOffboardingDetailOpen(false);
          setOffboardingDetail(null);
          setTaskDrafts({});
        }}
        footer={null}
        width={isMobile ? 'calc(100vw - 16px)' : 1080}
        style={isMobile ? { top: 8, paddingBottom: 0 } : undefined}
        styles={isMobile ? { body: { padding: 12, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' } } : undefined}
        centered
        destroyOnClose
        maskClosable={false}
        zIndex={1400}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card
            loading={offboardingDetailLoading}
            style={{ borderRadius: 14, border: '1px solid #e5eaf3', boxShadow: '0 6px 18px rgba(18, 38, 63, 0.06)' }}
            styles={{ body: { padding: 16 } }}
          >
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} lg={15}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space size={8} wrap>
                    <Tag color={offboardingDetail?.status === 'completed' ? 'success' : 'processing'} style={{ borderRadius: 999, padding: '2px 10px', fontWeight: 600 }}>
                      {String(offboardingDetail?.status || 'in_progress').toUpperCase()}
                    </Tag>
                    <Text type="secondary">
                      {offboardingTaskStats.completed}/{offboardingTaskStats.total || 0} tasks completed
                    </Text>
                  </Space>
                  <Progress
                    percent={offboardingTaskStats.progressPercent}
                    size={['100%', 12]}
                    strokeColor={offboardingTaskStats.allCompleted ? '#16a34a' : '#2563eb'}
                    status={offboardingTaskStats.allCompleted ? 'success' : 'active'}
                    showInfo
                  />
                </Space>
              </Col>
              <Col xs={24} lg={9}>
                <Row gutter={[10, 10]}>
                  <Col xs={24} sm={12}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Last Working Day</Text>
                    <Text strong>{offboardingDetail?.lastWorkingDay ? dayjs(offboardingDetail.lastWorkingDay).format('DD MMM YYYY') : '-'}</Text>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Exit Reason</Text>
                    <Text strong>{String(offboardingDetail?.exitReason || '-').replace(/_/g, ' ')}</Text>
                  </Col>
                </Row>
              </Col>
              <Col span={24}>
                <div style={{ background: '#f8fbff', borderRadius: 10, border: '1px solid #e8eef7', padding: '10px 12px' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Additional Notes</Text>
                  <Text>{offboardingDetail?.additionalNotes || 'No additional notes.'}</Text>
                </div>
              </Col>
            </Row>
          </Card>

          <Card
            title={<Text strong style={{ fontSize: 15 }}>Task Checklist</Text>}
            style={{ borderRadius: 14, border: '1px solid #e5eaf3' }}
            styles={{ body: { padding: isMobile ? 12 : 0 } }}
          >
            {isMobile ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {!offboardingTaskStats.tasks.length ? (
                  <Text type="secondary">No offboarding tasks found</Text>
                ) : offboardingTaskStats.tasks.map((task) => (
                  <Card
                    key={task.id}
                    size="small"
                    style={{ borderRadius: 10, border: '1px solid #edf1f7' }}
                    styles={{ body: { padding: 12 } }}
                  >
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Space wrap size={8} style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text strong style={{ maxWidth: '80%' }}>
                          {task.taskOrder}. {task.taskName}
                        </Text>
                        <Tag color={Boolean(taskDrafts[task.id]?.completed) ? 'success' : 'default'} style={{ margin: 0 }}>
                          {Boolean(taskDrafts[task.id]?.completed) ? 'Done' : 'Pending'}
                        </Tag>
                      </Space>
                      {task.completedAt ? (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Completed at {dayjs(task.completedAt).format('DD MMM YYYY, hh:mm A')}
                        </Text>
                      ) : null}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Completed</Text>
                        <Switch
                          checked={Boolean(taskDrafts[task.id]?.completed)}
                          disabled={offboardingDetail?.status === 'completed'}
                          onChange={(checked) => updateTaskDraft(task.id, { completed: checked })}
                        />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Notes</Text>
                        <Input.TextArea
                          value={taskDrafts[task.id]?.notes || ''}
                          onChange={(event) => updateTaskDraft(task.id, { notes: event.target.value })}
                          disabled={offboardingDetail?.status === 'completed'}
                          rows={2}
                          placeholder={Boolean(taskDrafts[task.id]?.completed) ? 'Optional completion note' : 'Add notes'}
                        />
                      </div>
                      <Button
                        type="primary"
                        ghost
                        block
                        loading={savingTaskId === task.id}
                        disabled={offboardingDetail?.status === 'completed'}
                        onClick={() => updateOffboardingTask(task.id)}
                      >
                        Save Task
                      </Button>
                    </Space>
                  </Card>
                ))}
              </Space>
            ) : (
              <Table
                rowKey="id"
                loading={offboardingDetailLoading}
                columns={offboardingTaskColumns}
                dataSource={offboardingTaskStats.tasks}
                pagination={false}
                size="middle"
                scroll={{ y: 360 }}
                locale={{ emptyText: 'No offboarding tasks found' }}
              />
            )}
          </Card>

          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: 10,
          }}>
            <Text type={offboardingTaskStats.allCompleted ? 'success' : 'warning'} style={{ fontSize: '12px' }}>
              {offboardingTaskStats.allCompleted
                ? 'All tasks are completed. You can finalize offboarding now.'
                : `${offboardingTaskStats.remaining} task(s) remaining. Complete and save all tasks before finalizing.`}
            </Text>
            <Button
              type="primary"
              danger
              block={isMobile}
              disabled={offboardingDetail?.status === 'completed' || !offboardingTaskStats.allCompleted}
              loading={completingOffboarding}
              onClick={completeOffboardingFromDetail}
            >
              Complete Offboarding
            </Button>
          </div>
        </Space>
      </Modal>

      {/* ── CREATE HOLIDAY MODAL ── */}
      <Modal
        title="Create Holiday"
        open={holidayModalOpen}
        onCancel={() => setHolidayModalOpen(false)}
        footer={null}
        centered
        destroyOnClose
        maskClosable={false}
        zIndex={1400}
      >
        <Form layout="vertical" form={holidayForm} onFinish={onCreateHoliday}>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="name" label="Holiday Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]} initialValue="national">
            <Select
              options={[
                { value: 'national', label: 'National' },
                { value: 'regional', label: 'Regional' },
                { value: 'company', label: 'Company' },
                { value: 'optional', label: 'Optional' },
              ]}
            />
          </Form.Item>
          <Form.Item name="location" label="Location">
            <Input placeholder="India" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          {isAdmin && branches.length > 0 && (
            <Form.Item name="branchId" label="Branch" extra="Leave blank to apply to all branches (org-wide)">
              <Select
                allowClear
                placeholder="All Branches (org-wide)"
                options={branches.map(b => ({ value: b.id, label: b.name }))}
              />
            </Form.Item>
          )}
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setHolidayModalOpen(false)}>Cancel</Button>
            <Button
              htmlType="submit"
              loading={submittingHoliday}
              style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}
            >
              Create
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* ── EDIT HOLIDAY MODAL ── */}
      <Modal
        title="Edit Holiday"
        open={editHolidayModalOpen}
        onCancel={() => { setEditHolidayModalOpen(false); setEditingHoliday(null); editHolidayForm.resetFields(); }}
        footer={null}
        centered
        destroyOnClose
        maskClosable={false}
        zIndex={1400}
      >
        <Form layout="vertical" form={editHolidayForm} onFinish={onUpdateHoliday}>
          <Form.Item name="date" label="Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="name" label="Holiday Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'national', label: 'National' },
                { value: 'regional', label: 'Regional' },
                { value: 'company', label: 'Company' },
                { value: 'optional', label: 'Optional' },
              ]}
            />
          </Form.Item>
          <Form.Item name="location" label="Location">
            <Input placeholder="India" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          {isAdmin && branches.length > 0 && (
            <Form.Item name="branchId" label="Branch" extra="Leave blank to apply to all branches (org-wide)">
              <Select
                allowClear
                placeholder="All Branches (org-wide)"
                options={branches.map(b => ({ value: b.id, label: b.name }))}
              />
            </Form.Item>
          )}
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setEditHolidayModalOpen(false); setEditingHoliday(null); editHolidayForm.resetFields(); }}>Cancel</Button>
            <Button
              htmlType="submit"
              loading={submittingEditHoliday}
              style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}
            >
              Save Changes
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* ── MANUAL LEAVE MODAL ── */}
      <Modal
        title="Add Leave Manually"
        open={manualLeaveModalOpen}
        onCancel={() => setManualLeaveModalOpen(false)}
        footer={null}
        centered
        forceRender
        maskClosable={false}
        zIndex={1400}
        afterOpenChange={(open) => {
          if (open) {
            manualLeaveForm.resetFields();
            manualLeaveForm.setFieldsValue({ year: dayjs().year(), leaveType: 'casual' });
          }
        }}
      >
        <Form layout="vertical" form={manualLeaveForm} onFinish={onManualLeaveGrant}>
          <Form.Item
            name="employeeId"
            label="Employee"
            rules={[{ required: true, message: 'Employee is required' }]}
          >
            <Select
              showSearch
              filterOption={false}
              onSearch={searchEmployees}
              options={employeeOptions}
              loading={searchingEmployees}
              placeholder="Search employee by name"
              notFoundContent={searchingEmployees ? 'Searching...' : 'Type at least 2 characters'}
            />
          </Form.Item>
          <Form.Item
            name="leaveType"
            label="Leave Type"
            rules={[{ required: true, message: 'Leave type is required' }]}
          >
            <Select
              options={[
                ...(() => {
                  const base = leaveTypes.length > 0
                    ? leaveTypes.filter(lt => lt.active).map(lt => ({ value: lt.id, label: lt.name }))
                    : [
                        { value: 'casual', label: 'Casual Leave' },
                        { value: 'sick', label: 'Sick Leave' },
                        { value: 'earned', label: 'Earned Leave' },
                        { value: 'maternity', label: 'Maternity Leave' },
                        { value: 'paternity', label: 'Paternity Leave' },
                      ];
                  const ids = new Set(base.map(o => o.value));
                  const extras = [
                    { value: 'comp_off', label: 'Comp Off' },
                    { value: 'lop', label: 'LOP' },
                  ].filter(o => !ids.has(o.value));
                  return [...base, ...extras];
                })(),
              ]}
            />
          </Form.Item>
          <Form.Item
            name="adjustment"
            label="Extra Leave To Grant"
            rules={[{ required: true, message: 'Adjustment amount is required' }]}
          >
            <InputNumber min={0.25} step={0.25} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="year"
            label="Year"
            rules={[{ required: true, message: 'Year is required' }]}
          >
            <InputNumber min={2000} max={2100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason"
            rules={[
              { required: true, message: 'Reason is mandatory' },
              {
                validator: (_, value) => {
                  if (!value || String(value).trim().length >= 3) return Promise.resolve();
                  return Promise.reject(new Error('Reason must be at least 3 characters'));
                }
              }
            ]}
          >
            <Input.TextArea rows={3} placeholder="Manual credit" />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setManualLeaveModalOpen(false)}>Cancel</Button>
            <Button
              htmlType="submit"
              loading={submittingManualLeave}
              style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}
            >
              Grant Leave
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* ── Attendance Correction Modal ── */}
      <Modal
        title={
          <div>
            <Text style={{ fontSize: 16, fontWeight: 700, color: themeTokens.colors.heading }}>
              Regularize Attendance
            </Text>
            {correctingRecord && (
              <Text style={{ display: 'block', fontSize: 12, color: themeTokens.colors.textTertiary, marginTop: 4 }}>
                {correctingRecord.employee?.name || 'Employee'} &mdash; {correctingRecord.date ? dayjs(correctingRecord.date).format('DD MMM YYYY') : ''}
              </Text>
            )}
          </div>
        }
        open={correctModalOpen}
        onCancel={() => { setCorrectModalOpen(false); correctForm.resetFields(); setCorrectingRecord(null); }}
        footer={null}
        destroyOnClose
        centered
      >
        <Form form={correctForm} layout="vertical" onFinish={handleCorrectAttendance} style={{ marginTop: 16 }}>
          <Form.Item name="checkInTime" label="Check-In Time">
            <DatePicker showTime={{ use12Hours: true }} format="YYYY-MM-DD hh:mm A" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="checkOutTime" label="Check-Out Time">
            <DatePicker showTime={{ use12Hours: true }} format="YYYY-MM-DD hh:mm A" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Please provide a reason' }]}>
            <Input.TextArea rows={3} placeholder="Reason for correction..." />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button onClick={() => { setCorrectModalOpen(false); correctForm.resetFields(); setCorrectingRecord(null); }}>
              Cancel
            </Button>
            <Button htmlType="submit" loading={correctSubmitting}
              style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}>
              Save Correction
            </Button>
          </div>
        </Form>
      </Modal>
    </Layout>
  );
}
