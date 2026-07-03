import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Typography,
  Space,
  Input,
  Select,
  Empty,
  Grid,
  Spin,
  Breadcrumb,
  Modal,
  message,
} from 'antd';
import {
  UserPlus,
  Search,
  RotateCcw,
  Mail,
  MapPin,
  Building2,
  Users,
  UserCheck,
  UserMinus,
  LayoutGrid,
  List,
  ListFilter,
  ChevronDown,
  X as XIcon,
  MoreHorizontal,
  GitBranch,
} from 'lucide-react';
import { employeeAPI } from '../api/employees';
import { useAuth } from '../hooks/useAuth';
import { normalizeAvatarUrl } from '../utils/auth';
import Layout from '../components/layout/Layout';
import { themeTokens } from '../styles/theme';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { getInitials, toTitleCase } from '../utils/name';
import AddEmployeeModal from '../components/employees/AddEmployeeModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

const UNSET_VALUES = new Set(['pending', 'unassigned', '']);
const isUnset = (val) => !val || UNSET_VALUES.has(String(val).toLowerCase().trim());
const displayField = (val) => isUnset(val) ? '—' : val;

const BTN_GRADIENT     = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';
const BLUE_GRADIENT    = 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)';
const MANAGER_GRADIENT = 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)';

const STATUS_CONFIG = {
  active:          { label: 'Active',        bg: '#F0FDF4', color: '#16a34a', dot: '#16a34a' },
  onboarding:      { label: 'Onboarding',    bg: '#FFF7ED', color: '#EA580C', dot: '#EA580C' },
  'notice period': { label: 'Notice Period', bg: '#FEFCE8', color: '#D97706', dot: '#D97706' },
  exited:          { label: 'Exited',        bg: '#FFF1F2', color: '#E11D48', dot: '#E11D48' },
  inactive:        { label: 'Inactive',      bg: '#FFF1F2', color: '#E11D48', dot: '#E11D48' },
};

const ROLE_CONFIG = {
  manager:  { bg: MANAGER_GRADIENT, color: '#fff',    label: 'Manager'  },
  hr:       { bg: MANAGER_GRADIENT, color: '#fff',    label: 'HR'       },
  employee: { bg: '#EFF6FF',        color: '#1368FF', label: 'Employee' },
};


export default function Employees() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const navigate = useNavigate();
  const { isHR, isAdmin } = useAuth();
  const [employees, setEmployees]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [branches, setBranches]     = useState([]);
  const [viewMode, setViewMode]     = useState('list'); // 'list' | 'grid'
  const [showFilters, setShowFilters] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    department: '',
    status: '',
    branchId: '',
  });
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef(null);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [openFilterCol, setOpenFilterCol] = useState(null);
  const [branchModalEmployee, setBranchModalEmployee] = useState(null); // { id, name, branchId }
  const [branchModalValue, setBranchModalValue] = useState(null);
  const [branchModalLoading, setBranchModalLoading] = useState(false);
  const [openRowMenu, setOpenRowMenu] = useState(null); // employeeId with open menu

  useEffect(() => {
    loadDepartments();
    if (isAdmin || isHR) {
      employeeAPI.getBranches().then(res => {
        setBranches(Array.isArray(res?.data) ? res.data : []);
      }).catch(() => {});
    }
  }, [isAdmin, isHR]);

  useEffect(() => {
    loadEmployees();
  }, [filters, pagination.current]);

  async function loadEmployees() {
    setLoading(true);
    try {
      const response = await employeeAPI.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search,
        role: filters.role,
        department: filters.department,
        status: filters.status,
        branchId: filters.branchId || undefined,
      });
      setEmployees(response.data);
      setPagination(prev => ({
        ...prev,
        total: response?.pagination?.total || response?.data?.length || 0,
      }));
    } catch (error) {
      console.error('Failed to load employees:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartments() {
    try {
      const response = await employeeAPI.getDepartments();
      setDepartments(response.data);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  }

  async function handleAssignBranch() {
    if (!branchModalEmployee) return;
    setBranchModalLoading(true);
    try {
      await employeeAPI.update(branchModalEmployee.id, { branchId: branchModalValue || null });
      message.success('Branch assigned successfully');
      setBranchModalEmployee(null);
      loadEmployees();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to assign branch');
    } finally {
      setBranchModalLoading(false);
    }
  }

  // Close column filter dropdown when clicking outside
  useEffect(() => {
    if (!openFilterCol) return;
    const handler = () => setOpenFilterCol(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openFilterCol]);

  // Close row action menu when clicking outside
  useEffect(() => {
    if (!openRowMenu) return;
    const handler = () => setOpenRowMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openRowMenu]);

  useAutoRefresh(loadEmployees, {
    enabled: true,
    scope: 'employees',
    intervalMs: 120000,
    deps: [filters, pagination.current],
  });

  const handleFilterChange = (key, value) => {
    if (key === 'search') {
      setSearchInput(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        setFilters(prev => ({ ...prev, search: value }));
        setPagination(prev => ({ ...prev, current: 1 }));
      }, 400);
    } else {
      setFilters(prev => ({ ...prev, [key]: value }));
      setPagination(prev => ({ ...prev, current: 1 }));
    }
  };

  const clearFilters = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSearchInput('');
    setFilters({ search: '', role: '', department: '', status: '', branchId: '' });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  // Compute stats from loaded employees (approximate — server total for active/inactive)
  const activeCount   = employees.filter(e => String(e.status).toLowerCase() === 'active').length;
  const inactiveCount = employees.filter(e => ['exited', 'inactive'].includes(String(e.status).toLowerCase())).length;
  const deptSet       = new Set(employees.map(e => e.department).filter(d => d && !isUnset(d)));

  const stats = [
    {
      label: 'Total Employees',
      value: pagination.total || employees.length,
      icon: <Users size={20} color="#fff" strokeWidth={2} />,
    },
    {
      label: 'Departments',
      value: deptSet.size,
      icon: <Building2 size={20} color="#fff" strokeWidth={2} />,
    },
    {
      label: 'Active',
      value: activeCount,
      icon: <UserCheck size={20} color="#fff" strokeWidth={2} />,
    },
    {
      label: 'Inactive',
      value: inactiveCount,
      icon: <UserMinus size={20} color="#fff" strokeWidth={2} />,
    },
  ];

  const gridCols = isAdmin ? '2.2fr 2fr 1.6fr 1.5fr 1.3fr 44px' : '2.4fr 2fr 1.6fr 1.5fr 1.1fr';

  // filterKey = the filters state key to set when clicking the column filter icon
  // filterOptions = dropdown options for inline filter popover
  const HEADER_COLS = [
    { key: 'name',       label: 'Employee',   filterKey: null },
    { key: 'email',      label: 'Contact',    filterKey: null },
    { key: 'department', label: 'Department', filterKey: 'department',
      filterOptions: departments.map(d => ({ value: d.department, label: d.department })) },
    { key: 'role',       label: 'Role Type',  filterKey: 'role',
      filterOptions: [
        { value: 'manager', label: 'Manager' },
        { value: 'employee', label: 'Employee' },
        { value: 'hr', label: 'HR' },
      ]},
    { key: 'status',     label: 'Status',     filterKey: 'status',
      filterOptions: [
        { value: 'active', label: 'Active' },
        { value: 'onboarding', label: 'Onboarding' },
        { value: 'notice_period', label: 'Notice Period' },
        { value: 'exited', label: 'Exited' },
      ]},
    ...(isAdmin ? [{ key: 'actions', label: '', filterKey: null }] : []),
  ];

  const hasActiveFilters = filters.search || filters.role || filters.department || filters.status || filters.branchId;

  return (
    <Layout>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>

        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { title: <Link to="/dashboard" style={{ color: '#1368FF' }}>Dashboard</Link> },
            { title: 'Employees' },
          ]}
        />

        {/* Header row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 16,
        }}>
          <div>
            <Title
              level={isMobile ? 3 : 2}
              style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}
            >
              Employee Directory
            </Title>
            <Text style={{ color: themeTokens.colors.textTertiary, fontSize: 14 }}>
              Manage your workforce, roles and department structures
            </Text>
          </div>

          {(isAdmin || isHR) && (
            <button
              onClick={() => setAddModalOpen(true)}
              style={{
                height: 44, paddingInline: 22, fontWeight: 600, borderRadius: 10,
                background: BTN_GRADIENT, color: '#fff', border: 'none',
                fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 2px 8px rgba(19,104,255,0.25)',
                width: isMobile ? '100%' : 'auto', justifyContent: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              <UserPlus size={17} strokeWidth={2.2} />
              + Add Employee
            </button>
          )}
        </div>

        {/* Stats cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 16,
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              background: '#fff',
              border: `1px solid ${themeTokens.colors.borders}`,
              borderRadius: 14,
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: themeTokens.shadows.subtle,
            }}>
              <div>
                <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  {s.label}
                </Text>
                <Text style={{ fontSize: 26, fontWeight: 800, color: themeTokens.colors.textPrimary, lineHeight: 1 }}>
                  {s.value}
                </Text>
              </div>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: BTN_GRADIENT,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(19,104,255,0.25)',
                flexShrink: 0,
              }}>
                {s.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Search + toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff',
              border: `1.5px solid ${themeTokens.colors.borders}`,
              borderRadius: 12, padding: '0 16px', height: 44,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'border-color 0.15s',
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor = '#1368FF'}
              onBlurCapture={e => e.currentTarget.style.borderColor = themeTokens.colors.borders}
            >
              <Search size={16} color="#9CA3AF" strokeWidth={2} style={{ flexShrink: 0 }} />
              <input
                value={searchInput}
                onChange={e => handleFilterChange('search', e.target.value)}
                placeholder="Search by name, email or employee ID..."
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  outline: 'none', fontSize: 14, color: themeTokens.colors.textPrimary,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* Filter toggle — filled blue pill */}
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              height: 44, paddingInline: 20, borderRadius: 12,
              border: 'none',
              background: showFilters ? '#0052CC' : '#1368FF',
              color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 8px rgba(19,104,255,0.30)',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <ListFilter size={15} strokeWidth={2.2} />
            Filters
            {hasActiveFilters && (
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'rgba(255,255,255,0.7)', display: 'inline-block',
              }} />
            )}
          </button>

          {/* View toggle — hidden on mobile (always grid), List + Grid on desktop */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {/* List button */}
              <button
                onClick={() => setViewMode('list')}
                style={{
                  height: 44, paddingInline: 18, borderRadius: 12,
                  border: viewMode === 'list' ? 'none' : `1.5px solid ${themeTokens.colors.borders}`,
                  background: viewMode === 'list' ? '#1368FF' : '#fff',
                  color: viewMode === 'list' ? '#fff' : themeTokens.colors.textSecondary,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 7,
                  boxShadow: viewMode === 'list' ? '0 2px 8px rgba(19,104,255,0.25)' : 'none',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                <List size={15} strokeWidth={2} />
                List
              </button>
              {/* Grid button */}
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  height: 44, paddingInline: 18, borderRadius: 12,
                  border: viewMode === 'grid' ? 'none' : `1.5px solid ${themeTokens.colors.borders}`,
                  background: viewMode === 'grid' ? '#1368FF' : '#fff',
                  color: viewMode === 'grid' ? '#fff' : themeTokens.colors.textSecondary,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 7,
                  boxShadow: viewMode === 'grid' ? '0 2px 8px rgba(19,104,255,0.25)' : 'none',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                <LayoutGrid size={15} strokeWidth={2} />
                Grid
              </button>
            </div>
          )}
        </div>

        {/* Filter row (expandable) */}
        {showFilters && (
          <div style={{
            background: '#fff',
            border: `1px solid ${themeTokens.colors.borders}`,
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
            boxShadow: themeTokens.shadows.subtle,
          }}>
            <Select
              placeholder="Department" size="middle" style={{ width: 180 }}
              value={filters.department || undefined}
              onChange={v => handleFilterChange('department', v)}
              allowClear
            >
              {departments.map(dept => (
                <Option key={dept.department} value={dept.department}>{dept.department}</Option>
              ))}
            </Select>
            <Select
              placeholder="Role Type" size="middle" style={{ width: 160 }}
              value={filters.role || undefined}
              onChange={v => handleFilterChange('role', v)}
              allowClear
            >
              <Option value="manager">Manager</Option>
              <Option value="employee">Employee</Option>
              <Option value="hr">HR</Option>
            </Select>
            <Select
              placeholder="Status" size="middle" style={{ width: 160 }}
              value={filters.status || undefined}
              onChange={v => handleFilterChange('status', v)}
              allowClear
            >
              <Option value="active">Active</Option>
              <Option value="onboarding">Onboarding</Option>
              <Option value="notice_period">Notice Period</Option>
              <Option value="exited">Exited</Option>
            </Select>
            {(isAdmin || isHR) && (
              <Select
                placeholder="Branch / Location" size="middle" style={{ width: 180 }}
                value={filters.branchId || undefined}
                onChange={v => handleFilterChange('branchId', v || '')}
                allowClear
                options={branches.map(b => ({ value: b.id, label: b.name }))}
              />
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  height: 32, paddingInline: 14, borderRadius: 8,
                  border: `1px solid ${themeTokens.colors.borders}`,
                  background: '#fff', color: themeTokens.colors.textSecondary,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <RotateCcw size={13} />
                Clear
              </button>
            )}
            <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary, marginLeft: 'auto' }}>
              Showing {employees.length} of {pagination.total} employees
            </Text>
          </div>
        )}

        {/* Table */}
        {(isMobile || viewMode === 'list') ? (
          <div style={{
            background: '#fff',
            borderRadius: 16,
            border: `1px solid ${themeTokens.colors.borders}`,
            boxShadow: themeTokens.shadows.standard,
            overflow: 'hidden',
          }}>
            {/* Column Headers */}
            {!isMobile && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                padding: '13px 28px',
                borderBottom: `1px solid ${themeTokens.colors.borders}`,
                background: themeTokens.colors.appBackground,
                position: 'relative',
              }}>
                {HEADER_COLS.map(h => {
                  const isFiltered = h.filterKey && filters[h.filterKey];
                  const isOpen = openFilterCol === h.key;
                  return (
                    <div key={h.key} style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Text style={{
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.07em', color: themeTokens.colors.textTertiary,
                        }}>
                          {h.label}
                        </Text>
                        {h.filterKey && (
                          <button
                            onClick={e => { e.stopPropagation(); setOpenFilterCol(isOpen ? null : h.key); }}
                            style={{
                              border: 'none', background: 'none', padding: 0, cursor: 'pointer',
                              display: 'flex', alignItems: 'center',
                              color: isFiltered || isOpen ? '#1368FF' : themeTokens.colors.textTertiary,
                            }}
                          >
                            <ListFilter size={13} strokeWidth={2.2} />
                            {isFiltered && (
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: '#1368FF', marginLeft: 2, display: 'inline-block',
                              }} />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Inline filter dropdown */}
                      {isOpen && h.filterOptions && (
                        <div
                          style={{
                            position: 'absolute', top: '100%', left: 0, zIndex: 100,
                            background: '#fff', borderRadius: 10,
                            border: `1px solid ${themeTokens.colors.borders}`,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                            minWidth: 180, padding: '6px 0', marginTop: 6,
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          {/* Clear option */}
                          {filters[h.filterKey] && (
                            <button
                              onClick={() => { handleFilterChange(h.filterKey, ''); setOpenFilterCol(null); }}
                              style={{
                                width: '100%', padding: '7px 14px', border: 'none',
                                background: 'none', cursor: 'pointer', textAlign: 'left',
                                fontSize: 12, fontWeight: 600, color: '#E11D48',
                                display: 'flex', alignItems: 'center', gap: 6,
                              }}
                            >
                              <XIcon size={12} /> Clear filter
                            </button>
                          )}
                          {h.filterOptions.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => { handleFilterChange(h.filterKey, opt.value); setOpenFilterCol(null); }}
                              style={{
                                width: '100%', padding: '7px 14px', border: 'none',
                                background: filters[h.filterKey] === opt.value ? '#EFF6FF' : 'none',
                                cursor: 'pointer', textAlign: 'left',
                                fontSize: 13, fontWeight: filters[h.filterKey] === opt.value ? 600 : 400,
                                color: filters[h.filterKey] === opt.value ? '#1368FF' : themeTokens.colors.textPrimary,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              }}
                            >
                              {opt.label}
                              {filters[h.filterKey] === opt.value && (
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1368FF' }} />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <Spin size="default" />
              </div>
            )}

            {/* Empty */}
            {!loading && employees.length === 0 && (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <Empty description="No employees found matching your filters" />
              </div>
            )}

            {/* Rows */}
            {!loading && (
              isMobile ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                  padding: '12px',
                }}>
                  {employees.map((record, idx) => {
                    const rawStatus = String(record.status || '').toLowerCase().replace('_', ' ');
                    const sc = STATUS_CONFIG[rawStatus] || { label: (rawStatus || 'Active'), bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' };
                    const roleVal = String(record.role || record.userRole || 'employee').toLowerCase();
                    const rc = ROLE_CONFIG[roleVal] || ROLE_CONFIG.employee;
                    const avatarSrc = normalizeAvatarUrl(record.avatarUrl);
                    return (
                      <div
                        key={record.id || idx}
                        onClick={() => navigate(`/employees/${record.employeeCode || record.id}`)}
                        style={{
                          background: '#fff',
                          border: `1px solid ${themeTokens.colors.borders}`,
                          borderRadius: 12,
                          padding: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          transition: 'box-shadow 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(19,104,255,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                      >
                        {/* Avatar + Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                            background: avatarSrc ? undefined : BLUE_GRADIENT,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                          }}>
                            {avatarSrc
                              ? <img src={avatarSrc} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: '50%' }} />
                              : <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{getInitials(record.name)}</span>
                            }
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: themeTokens.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {toTitleCase(record.name || '')}
                            </div>
                            <div style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>{record.employeeCode || '—'}</div>
                          </div>
                        </div>
                        {/* Designation */}
                        <div style={{ fontSize: 12, fontWeight: 500, color: themeTokens.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isUnset(record.designation) ? (isUnset(record.department) ? '—' : record.department) : toTitleCase(record.designation)}
                        </div>
                        {/* Branch */}
                        {record.branchName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Building2 size={11} color={themeTokens.colors.textTertiary} style={{ flexShrink: 0 }} />
                            <div style={{ fontSize: 11, color: themeTokens.colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {record.branchName}
                            </div>
                          </div>
                        )}
                        {/* Role + Status */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: rc.bg, color: rc.color }}>
                            {rc.label}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: sc.bg, color: sc.color }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                            {sc.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                employees.map((record, idx) => {
                  const isLast = idx === employees.length - 1;
                  const rawStatus = String(record.status || '').toLowerCase().replace('_', ' ');
                  const sc = STATUS_CONFIG[rawStatus] || { label: (rawStatus || 'Active'), bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' };
                  const roleVal = String(record.role || record.userRole || 'employee').toLowerCase();
                  const rc = ROLE_CONFIG[roleVal] || ROLE_CONFIG.employee;
                  const avatarSrc = normalizeAvatarUrl(record.avatarUrl);
                  return (
                    <div
                      key={record.id || idx}
                      onClick={() => navigate(`/employees/${record.employeeCode || record.id}`)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: gridCols,
                        alignItems: 'center',
                        padding: '15px 28px',
                        borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        background: '#fff',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = themeTokens.colors.appBackground}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      {/* EMPLOYEE */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: avatarSrc ? undefined : BLUE_GRADIENT,
                          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        }}>
                          {avatarSrc
                            ? <img src={avatarSrc} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '50%' }} />
                            : <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>{getInitials(record.name)}</span>
                          }
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <Text strong style={{ fontSize: 14, display: 'block', color: themeTokens.colors.textPrimary, lineHeight: '1.3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {toTitleCase(record.name || '')}
                          </Text>
                          <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>{record.employeeCode || '—'}</Text>
                        </div>
                      </div>
                      {/* CONTACT */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                          <Mail size={12} color={themeTokens.colors.textTertiary} style={{ flexShrink: 0 }} />
                          <Text style={{ fontSize: 12, color: themeTokens.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.email}</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={12} color={themeTokens.colors.textTertiary} style={{ flexShrink: 0 }} />
                          <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>{record.country || record.workLocation || '—'}</Text>
                        </div>
                      </div>
                      {/* DEPARTMENT */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: '#F3F4F6', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <LayoutGrid size={14} color="#9CA3AF" strokeWidth={1.8} />
                        </div>
                        <Text style={{ fontSize: 13, fontWeight: 600, color: themeTokens.colors.textPrimary, lineHeight: '1.2' }}>{displayField(record.department)}</Text>
                      </div>
                      {/* ROLE */}
                      <div>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: rc.bg, color: rc.color }}>{rc.label}</span>
                      </div>
                      {/* STATUS + BRANCH */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                          {sc.label}
                        </span>
                        {record.branchName ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: '#EFF6FF', color: '#1368FF', whiteSpace: 'nowrap' }}>
                            <GitBranch size={10} />
                            {record.branchName}
                          </span>
                        ) : isAdmin ? (
                          <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>No branch</span>
                        ) : null}
                      </div>
                      {/* ACTIONS (admin only) */}
                      {isAdmin && (
                        <div
                          style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setOpenRowMenu(openRowMenu === (record.id || idx) ? null : (record.id || idx))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: themeTokens.colors.textTertiary, display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#374151'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = themeTokens.colors.textTertiary; }}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          {openRowMenu === (record.id || idx) && (
                            <div
                              style={{ position: 'absolute', right: 0, top: '100%', zIndex: 200, background: '#fff', border: `1px solid ${themeTokens.colors.borders}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, padding: '4px 0' }}
                            >
                              <button
                                onClick={() => {
                                  setOpenRowMenu(null);
                                  setBranchModalEmployee({ id: record.id, name: record.name, branchId: record.branchId });
                                  setBranchModalValue(record.branchId || null);
                                }}
                                style={{ width: '100%', padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: themeTokens.colors.textPrimary, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              >
                                <GitBranch size={14} color="#1368FF" />
                                Assign Branch
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )
            )}

            {/* Pagination */}
            {!loading && employees.length > 0 && (
              <div style={{
                padding: '14px 28px',
                borderTop: `1px solid ${themeTokens.colors.borders}`,
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 8,
                background: themeTokens.colors.appBackground,
              }}>
                <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
                  Showing {employees.length} of {pagination.total} employees
                </Text>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    disabled={pagination.current === 1}
                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                    style={{
                      height: 32, paddingInline: 14, borderRadius: 8,
                      border: `1px solid ${themeTokens.colors.borders}`,
                      background: pagination.current === 1 ? themeTokens.colors.appBackground : '#fff',
                      color: pagination.current === 1 ? themeTokens.colors.textTertiary : themeTokens.colors.textPrimary,
                      fontSize: 13, fontWeight: 500,
                      cursor: pagination.current === 1 ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPagination(prev => ({ ...prev, current: p }))}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: p === pagination.current ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                        background: p === pagination.current ? BTN_GRADIENT : '#fff',
                        color: p === pagination.current ? '#fff' : themeTokens.colors.textPrimary,
                        fontSize: 13, fontWeight: p === pagination.current ? 700 : 500,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={pagination.current >= totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                    style={{
                      height: 32, paddingInline: 14, borderRadius: 8,
                      border: `1px solid ${themeTokens.colors.borders}`,
                      background: pagination.current >= totalPages ? themeTokens.colors.appBackground : '#fff',
                      color: pagination.current >= totalPages ? themeTokens.colors.textTertiary : themeTokens.colors.textPrimary,
                      fontSize: 13, fontWeight: 500,
                      cursor: pagination.current >= totalPages ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Grid view */
          <div>
            {loading && (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <Spin size="default" />
              </div>
            )}
            {!loading && employees.length === 0 && (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <Empty description="No employees found" />
              </div>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}>
              {!loading && employees.map((record, idx) => {
                const rawStatus = String(record.status || '').toLowerCase().replace('_', ' ');
                const sc = STATUS_CONFIG[rawStatus] || { label: (rawStatus || 'Active'), bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' };
                const roleVal = String(record.role || record.userRole || 'employee').toLowerCase();
                const rc = ROLE_CONFIG[roleVal] || ROLE_CONFIG.employee;
                const avatarSrc = normalizeAvatarUrl(record.avatarUrl);
  
                return (
                  <div
                    key={record.id || idx}
                    onClick={() => navigate(`/employees/${record.employeeCode || record.id}`)}
                    style={{
                      background: '#fff',
                      border: `1px solid ${themeTokens.colors.borders}`,
                      borderRadius: 16,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'box-shadow 0.18s, transform 0.18s',
                      boxShadow: '0 1px 4px rgba(16,24,40,0.06)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(19,104,255,0.13)';
                      e.currentTarget.style.transform = 'translateY(-3px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(16,24,40,0.06)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Card header band */}
                    <div style={{
                      background: 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)',
                      height: 54,
                      position: 'relative',
                    }}>
                      {/* Role badge top-right */}
                      <span style={{
                        position: 'absolute', top: 10, right: 12,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20,
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.03em',
                        background: 'rgba(255,255,255,0.18)',
                        color: '#fff',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.25)',
                      }}>
                        {rc.label}
                      </span>
                    </div>

                    {/* Avatar overlapping header */}
                    <div style={{ padding: '0 18px 16px', position: 'relative' }}>
                      {/* Avatar */}
                      <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        background: avatarSrc ? undefined : BLUE_GRADIENT,
                        border: '3px solid #fff',
                        boxShadow: '0 2px 8px rgba(19,104,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                        marginTop: -26,
                        marginBottom: 10,
                      }}>
                        {avatarSrc ? (
                          <img src={avatarSrc} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: 17, lineHeight: 1 }}>
                            {getInitials(record.name)}
                          </span>
                        )}
                      </div>

                      {/* Name + ID + status */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <div style={{ minWidth: 0 }}>
                          <Text strong style={{
                            fontSize: 14, display: 'block', color: themeTokens.colors.textPrimary,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            lineHeight: '1.3',
                          }}>
                            {toTitleCase(record.name || '')}
                          </Text>
                          <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary, fontWeight: 500 }}>
                            {record.employeeCode || '—'}
                          </Text>
                        </div>
                        <span style={{
                          flexShrink: 0,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 20,
                          fontSize: 10, fontWeight: 600,
                          background: sc.bg, color: sc.color,
                          marginTop: 2,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                          {sc.label}
                        </span>
                      </div>

                      {/* Designation */}
                      {!isUnset(record.designation) && (
                        <Text style={{
                          fontSize: 12, color: '#1368FF', fontWeight: 600,
                          display: 'block', marginBottom: 12,
                        }}>
                          {toTitleCase(record.designation)}
                        </Text>
                      )}

                      {/* Divider */}
                      <div style={{ height: 1, background: themeTokens.colors.borders, marginBottom: 12 }} />

                      {/* Info rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Email */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                            background: '#EFF6FF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Mail size={12} color="#1368FF" strokeWidth={2} />
                          </div>
                          <Text style={{
                            fontSize: 12, color: themeTokens.colors.textSecondary,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                          }}>
                            {record.email || '—'}
                          </Text>
                        </div>

                        {/* Department */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                            background: '#F3F4F6',
                            border: '1px solid #E5E7EB',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <LayoutGrid size={12} color="#9CA3AF" strokeWidth={1.8} />
                          </div>
                          <Text style={{ fontSize: 12, color: themeTokens.colors.textSecondary, fontWeight: 500 }}>
                            {displayField(record.department)}
                          </Text>
                        </div>

                        {/* Location */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                            background: '#F0FDF4',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <MapPin size={12} color="#16a34a" strokeWidth={2} />
                          </div>
                          <Text style={{ fontSize: 12, color: themeTokens.colors.textSecondary, fontWeight: 500 }}>
                            {record.workLocation || '—'}
                          </Text>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grid pagination */}
            {!loading && employees.length > 0 && (
              <div style={{
                marginTop: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 8,
              }}>
                <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
                  Showing {employees.length} of {pagination.total} employees
                </Text>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    disabled={pagination.current === 1}
                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                    style={{
                      height: 32, paddingInline: 14, borderRadius: 8,
                      border: `1px solid ${themeTokens.colors.borders}`,
                      background: pagination.current === 1 ? themeTokens.colors.appBackground : '#fff',
                      color: pagination.current === 1 ? themeTokens.colors.textTertiary : themeTokens.colors.textPrimary,
                      fontSize: 13, fontWeight: 500,
                      cursor: pagination.current === 1 ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPagination(prev => ({ ...prev, current: p }))}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        border: p === pagination.current ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                        background: p === pagination.current ? BTN_GRADIENT : '#fff',
                        color: p === pagination.current ? '#fff' : themeTokens.colors.textPrimary,
                        fontSize: 13, fontWeight: p === pagination.current ? 700 : 500,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={pagination.current >= totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                    style={{
                      height: 32, paddingInline: 14, borderRadius: 8,
                      border: `1px solid ${themeTokens.colors.borders}`,
                      background: pagination.current >= totalPages ? themeTokens.colors.appBackground : '#fff',
                      color: pagination.current >= totalPages ? themeTokens.colors.textTertiary : themeTokens.colors.textPrimary,
                      fontSize: 13, fontWeight: 500,
                      cursor: pagination.current >= totalPages ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </Space>

      <AddEmployeeModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={loadEmployees}
      />

      {/* Branch Assignment Modal */}
      <Modal
        open={!!branchModalEmployee}
        onCancel={() => setBranchModalEmployee(null)}
        onOk={handleAssignBranch}
        okText="Save"
        confirmLoading={branchModalLoading}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch size={16} color="#1368FF" />
            <span>Assign Branch</span>
          </div>
        }
        width={400}
      >
        <div style={{ marginBottom: 8, color: themeTokens.colors.textSecondary, fontSize: 13 }}>
          Employee: <strong>{branchModalEmployee?.name}</strong>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="Select branch"
          allowClear
          value={branchModalValue}
          onChange={val => setBranchModalValue(val || null)}
          options={branches.map(b => ({ value: b.id, label: b.name }))}
          size="large"
        />
      </Modal>
    </Layout>
  );
}
