import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Collapse,
  Input,
  Modal,
  Select,
  Space,
  Typography,
  message,
  Checkbox,
  Col,
  Row,
  Skeleton,
} from 'antd';
import {
  Briefcase,
  Key,
  Lock,
  Shield,
  UserCog,
  Users,
} from 'lucide-react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { rbacAPI } from '../api/rbac';
import { themeTokens } from '../styles/theme';

const { Title, Text } = Typography;

const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';

const ROLE_ICON_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';

function getRoleColors() {
  return { icon: '#fff', bg: ROLE_ICON_GRADIENT };
}

function normalizeRoleName(role) {
  if (!role) return '-';
  if (typeof role === 'string') return role;
  return role?.displayName || role?.display_name || role?.name || '-';
}

function normalizeUserName(user) {
  return (
    user?.display_name ||
    user?.displayName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.name ||
    '-'
  );
}

export default function AdminAccessControl() {
  const { isAdmin, user } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [assignableRoles, setAssignableRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [activeTab, setActiveTab] = useState('roles');

  // Permissions modal
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);
  const [permissionSearch, setPermissionSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // User role modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserRoleId, setSelectedUserRoleId] = useState(undefined);

  // Pagination
  const [rolesPage, setRolesPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const ROLES_PAGE_SIZE = 8;
  const USERS_PAGE_SIZE = 10;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [manageableRolesRes, usersRes, permsRes] = await Promise.all([
        rbacAPI.getRoles({ scope: 'hrms-manageable' }),
        rbacAPI.getUsers({ page: 1, limit: 100, scope: 'hrms' }),
        rbacAPI.getPermissions({ scope: 'hrms' }),
      ]);
      const manageableRolesData = manageableRolesRes?.data || [];
      const usersPayload = usersRes?.data || [];
      const permsPayload = permsRes?.data || [];
      const scopedRoles =
        manageableRolesData?.roles ||
        manageableRolesData?.items ||
        (Array.isArray(manageableRolesData) ? manageableRolesData : []);
      const usersData =
        usersPayload?.users ||
        usersPayload?.items ||
        usersPayload?.data ||
        (Array.isArray(usersPayload) ? usersPayload : []);
      const permsData =
        permsPayload?.permissions ||
        permsPayload?.items ||
        (Array.isArray(permsPayload) ? permsPayload : []);
      setRoles(Array.isArray(scopedRoles) ? scopedRoles : []);
      setAssignableRoles(Array.isArray(scopedRoles) ? scopedRoles : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setPermissions(Array.isArray(permsData) ? permsData : []);
    } catch (error) {
      message.error(error?.message || 'Failed to load access control data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const permissionsByCategory = useMemo(() => {
    const grouped = {};
    (Array.isArray(permissions) ? permissions : []).forEach((p) => {
      const cat = p?.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    return grouped;
  }, [permissions]);

  const filteredPermissionsByCategory = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase();
    if (!query) return permissionsByCategory;
    const filtered = {};
    Object.entries(permissionsByCategory).forEach(([cat, list]) => {
      const f = list.filter((p) => {
        const name = String(p?.display_name || p?.displayName || p?.name || '').toLowerCase();
        const desc = String(p?.description || '').toLowerCase();
        return name.includes(query) || desc.includes(query) || cat.toLowerCase().includes(query);
      });
      if (f.length) filtered[cat] = f;
    });
    return filtered;
  }, [permissionsByCategory, permissionSearch]);

  const openPermissionsModal = async (role) => {
    setSelectedRole(role);
    setPermissionsModalOpen(true);
    setPermissionSearch('');
    try {
      const response = await rbacAPI.getRolePermissions(role.id, { scope: 'hrms' });
      const rolePermsPayload = response?.data || [];
      const rolePerms =
        rolePermsPayload?.permissions ||
        rolePermsPayload?.items ||
        (Array.isArray(rolePermsPayload) ? rolePermsPayload : []);
      setSelectedPermissionIds(
        (Array.isArray(rolePerms) ? rolePerms : []).map((p) => p.id || p.permissionId).filter(Boolean)
      );
    } catch (error) {
      message.error(error?.message || 'Failed to load role permissions');
      setSelectedPermissionIds([]);
    }
  };

  const saveRolePermissions = async () => {
    if (!selectedRole?.id) return;
    setSaving(true);
    try {
      await rbacAPI.setRolePermissions(selectedRole.id, selectedPermissionIds);
      message.success('Role permissions updated');
      setPermissionsModalOpen(false);
    } catch (error) {
      message.error(error?.message || 'Failed to update role permissions');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategoryPermissions = (categoryPermissionIds, shouldSelectAll) => {
    const validIds = (Array.isArray(categoryPermissionIds) ? categoryPermissionIds : []).filter(Boolean);
    setSelectedPermissionIds((prev) => {
      const next = new Set(Array.isArray(prev) ? prev : []);
      if (shouldSelectAll) validIds.forEach((id) => next.add(id));
      else validIds.forEach((id) => next.delete(id));
      return Array.from(next);
    });
  };

  const openUserRoleModal = async (u) => {
    setSelectedUser(u);
    setRoleModalOpen(true);
    try {
      const response = await rbacAPI.getUserPermissions(u.id);
      const role = response?.data?.role || null;
      const matchedRole = roles.find((r) => r.name === role?.name || r.id === role?.id);
      setSelectedUserRoleId(matchedRole?.id);
    } catch {
      setSelectedUserRoleId(undefined);
    }
  };

  const saveUserRole = async () => {
    if (!selectedUser?.id || !selectedUserRoleId) return;
    if (selectedUser.id === user?.id) {
      message.warning('You cannot change your own role.');
      return;
    }
    setSaving(true);
    try {
      await rbacAPI.assignUserRole(selectedUser.id, selectedUserRoleId);
      message.success('User role updated');
      setRoleModalOpen(false);
      await loadData();
    } catch (error) {
      message.error(error?.message || 'Failed to update user role');
    } finally {
      setSaving(false);
    }
  };


  // Pagination helpers
  const paginatedRoles = useMemo(() => {
    const start = (rolesPage - 1) * ROLES_PAGE_SIZE;
    return roles.slice(start, start + ROLES_PAGE_SIZE);
  }, [roles, rolesPage]);
  const totalRolesPages = Math.ceil(roles.length / ROLES_PAGE_SIZE);

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * USERS_PAGE_SIZE;
    return users.slice(start, start + USERS_PAGE_SIZE);
  }, [users, usersPage]);
  const totalUsersPages = Math.ceil(users.length / USERS_PAGE_SIZE);

  // Count users per role
  const userCountByRole = useMemo(() => {
    const counts = {};
    users.forEach((u) => {
      const roleName = u?.role?.name || u?.roleName || u?.role;
      if (roleName) counts[roleName] = (counts[roleName] || 0) + 1;
    });
    return counts;
  }, [users]);

  if (!isAdmin) {
    return (
      <Layout>
        <Alert type="warning" showIcon message="Only admin can access access-control management." />
      </Layout>
    );
  }

  const statCards = [
    {
      label: 'TOTAL ROLES',
      value: roles.length,
      sub: 'Active roles',
      icon: <Key size={20} color="#fff" strokeWidth={2} />,
    },
    {
      label: 'TOTAL USERS',
      value: users.length,
      sub: 'Assigned users',
      icon: <Users size={20} color="#fff" strokeWidth={2} />,
    },
    {
      label: 'PERMISSIONS',
      value: permissions.length,
      sub: 'Available permissions',
      icon: <Shield size={20} color="#fff" strokeWidth={2} />,
    },
  ];

  // Pagination row component
  function PaginationRow({ page, totalPages, onPrev, onNext, onPage, total, pageSize }) {
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return (
      <div style={{
        padding: '14px 24px',
        borderTop: `1px solid ${themeTokens.colors.borders}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
          Showing {start} to {end} of {total} entries
        </Text>
        <Space size={4}>
          <button
            disabled={page === 1}
            onClick={onPrev}
            style={{
              height: 32, paddingInline: 14, borderRadius: 8,
              border: `1px solid ${themeTokens.colors.borders}`,
              background: page === 1 ? themeTokens.colors.secondaryBackground : '#fff',
              color: page === 1 ? themeTokens.colors.textTertiary : themeTokens.colors.textPrimary,
              fontSize: 13, fontWeight: 500, cursor: page === 1 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >Previous</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => onPage(p)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: p === page ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                background: p === page ? BTN_GRADIENT : '#fff',
                color: p === page ? '#fff' : themeTokens.colors.textPrimary,
                fontSize: 13, fontWeight: p === page ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{p}</button>
          ))}
          <button
            disabled={page >= totalPages}
            onClick={onNext}
            style={{
              height: 32, paddingInline: 14, borderRadius: 8,
              border: `1px solid ${themeTokens.colors.borders}`,
              background: page >= totalPages ? themeTokens.colors.secondaryBackground : '#fff',
              color: page >= totalPages ? themeTokens.colors.textTertiary : themeTokens.colors.textPrimary,
              fontSize: 13, fontWeight: 500, cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >Next</button>
        </Space>
      </div>
    );
  }

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
              <Link to="/dashboard" style={{ color: themeTokens.colors.primary }}>Dashboard</Link>
              {' / '}
              <span style={{ color: themeTokens.colors.textTertiary }}>Admin</span>
            </Text>
            <Title level={2} style={{ margin: '6px 0 4px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>
              Access Control
            </Title>
            <Text style={{ color: themeTokens.colors.textTertiary, fontSize: 14 }}>
              Configure role permissions and assign user roles for HR, Manager and Employee users.
            </Text>
          </div>
        </div>

        {/* Stat Cards */}
        <Row gutter={[16, 16]}>
          {statCards.map(({ label, value, sub, icon }) => (
            <Col xs={24} md={8} key={label}>
              <div style={{
                background: '#fff',
                borderRadius: 14,
                border: `1px solid ${themeTokens.colors.borders}`,
                boxShadow: themeTokens.shadows.standard,
                padding: '18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <Text style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.7px', color: themeTokens.colors.textTertiary, display: 'block',
                    }}>{label}</Text>
                    <Title level={3} style={{
                      margin: '6px 0 4px', fontSize: 30, fontWeight: 700,
                      lineHeight: 1.1, color: themeTokens.colors.heading,
                    }}>
                      {loading ? <Skeleton.Button active size="small" style={{ width: 48 }} /> : value}
                    </Title>
                    <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>{sub}</Text>
                  </div>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: BTN_GRADIENT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(19,104,255,0.3)',
                  }}>
                    {icon}
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        {/* Tab toggle bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: themeTokens.colors.appBackground,
          borderRadius: 14,
          border: `1px solid ${themeTokens.colors.borders}`,
          boxShadow: themeTokens.shadows.standard,
          padding: 4,
          gap: 4,
          overflow: 'hidden',
        }}>
          {[
            { key: 'roles', label: 'Roles & Permissions' },
            { key: 'users', label: 'User Role Assignment' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '10px 20px',
                border: 'none',
                outline: 'none',
                borderRadius: 10,
                background: activeTab === key ? BTN_GRADIENT : '#fff',
                color: activeTab === key ? '#fff' : themeTokens.colors.textSecondary,
                fontSize: 14,
                fontWeight: activeTab === key ? 700 : 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                boxShadow: activeTab === key ? '0 2px 8px rgba(19,104,255,0.3)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Roles & Permissions tab */}
        {activeTab === 'roles' && (
          <div style={{
            background: themeTokens.colors.appGradient,
            borderRadius: 16,
            border: `1px solid ${themeTokens.colors.borders}`,
            boxShadow: themeTokens.shadows.standard,
            overflow: 'hidden',
          }}>
            {/* Column headers — hidden on mobile (card layout used instead) */}
            {!isMobile && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2.5fr 1fr 1.2fr 180px',
                padding: '10px 24px',
                borderBottom: `1px solid ${themeTokens.colors.borders}`,
                background: themeTokens.colors.appBackground,
              }}>
                {['ROLE', 'USERS', 'PERMISSIONS', 'ACTIONS'].map((h, i) => (
                  <Text key={h} style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: themeTokens.colors.textTertiary,
                    textAlign: i === 3 ? 'right' : 'left',
                  }}>{h}</Text>
                ))}
              </div>
            )}

            {/* Rows */}
            {loading ? (
              <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[1, 2, 3].map((n) => <Skeleton key={n} active avatar paragraph={{ rows: 1 }} />)}
              </div>
            ) : roles.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <Text type="secondary">No roles found.</Text>
              </div>
            ) : (
              paginatedRoles.map((role, idx) => {
                const displayName = normalizeRoleName(role);
                const roleName = role?.name || '';
                const userCount = userCountByRole[roleName] || 0;
                const permCount = role?.permissionCount ?? role?.permissions?.length ?? 0;
                const isLast = idx === paginatedRoles.length - 1;

                return (
                  <div
                    key={role.id || role.name}
                    style={{
                      display: isMobile ? 'flex' : 'grid',
                      gridTemplateColumns: isMobile ? undefined : '2.5fr 1fr 1.2fr 180px',
                      flexDirection: isMobile ? 'column' : undefined,
                      alignItems: isMobile ? 'stretch' : 'center',
                      padding: isMobile ? '16px' : '16px 24px',
                      gap: isMobile ? 12 : undefined,
                      borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = themeTokens.colors.appBackground}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Role name + icon */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: ROLE_ICON_GRADIENT,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(19,104,255,0.25)',
                      }}>
                        {roleName.includes('hr')
                          ? <Shield size={19} color="#fff" strokeWidth={1.8} />
                          : roleName.includes('manager')
                          ? <Users size={19} color="#fff" strokeWidth={1.8} />
                          : roleName.includes('employee')
                          ? <Briefcase size={19} color="#fff" strokeWidth={1.8} />
                          : <Shield size={19} color="#fff" strokeWidth={1.8} />
                        }
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <Text strong style={{
                          fontSize: 14, color: themeTokens.colors.textPrimary,
                          display: 'block', lineHeight: 1.3,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {displayName}
                        </Text>
                        <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>
                          {roleName}
                        </Text>
                      </div>
                    </div>

                    {/* Users + Permissions (inline on mobile) */}
                    {isMobile ? (
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Users size={13} color={themeTokens.colors.textTertiary} strokeWidth={1.8} />
                          <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary, fontWeight: 600 }}>{userCount}</Text>
                          <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>users</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Lock size={13} color={themeTokens.colors.textTertiary} strokeWidth={1.8} />
                          <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary, fontWeight: 600 }}>{permCount}</Text>
                          <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>permissions</Text>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Users */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Users size={13} color={themeTokens.colors.textTertiary} strokeWidth={1.8} />
                          <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary, fontWeight: 600 }}>
                            {userCount}
                          </Text>
                          <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>
                            USERS
                          </Text>
                        </div>

                        {/* Permissions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Lock size={13} color={themeTokens.colors.textTertiary} strokeWidth={1.8} />
                          <Text style={{ fontSize: 13, color: themeTokens.colors.textSecondary, fontWeight: 600 }}>
                            {permCount}
                          </Text>
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                      <button
                        onClick={() => openPermissionsModal(role)}
                        style={{
                          borderRadius: 8, fontWeight: 600, fontSize: 13,
                          height: 32, paddingInline: 14,
                          background: BTN_GRADIENT, color: '#fff', border: 'none',
                          cursor: 'pointer', fontFamily: 'inherit',
                          boxShadow: '0 1px 6px rgba(19,104,255,0.2)',
                        }}
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Footer count / pagination */}
            {!loading && roles.length > 0 && (
              roles.length > ROLES_PAGE_SIZE ? (
                <PaginationRow
                  page={rolesPage}
                  totalPages={totalRolesPages}
                  onPrev={() => setRolesPage((p) => p - 1)}
                  onNext={() => setRolesPage((p) => p + 1)}
                  onPage={setRolesPage}
                  total={roles.length}
                  pageSize={ROLES_PAGE_SIZE}
                />
              ) : (
                <div style={{
                  padding: '12px 24px',
                  borderTop: `1px solid ${themeTokens.colors.borders}`,
                }}>
                  <Text style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
                    {roles.length} {roles.length === 1 ? 'role' : 'roles'}
                  </Text>
                </div>
              )
            )}
          </div>
        )}

        {/* User Role Assignment tab */}
        {activeTab === 'users' && (
          <div style={{
            background: themeTokens.colors.appGradient,
            borderRadius: 16,
            border: `1px solid ${themeTokens.colors.borders}`,
            boxShadow: themeTokens.shadows.standard,
            overflow: 'hidden',
          }}>
            {/* Column headers — hidden on mobile */}
            {!isMobile && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2.5fr 1.5fr 130px',
                padding: '10px 24px',
                borderBottom: `1px solid ${themeTokens.colors.borders}`,
                background: themeTokens.colors.appBackground,
              }}>
                {['USER', 'CURRENT ROLE', 'ACTIONS'].map((h, i) => (
                  <Text key={h} style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: themeTokens.colors.textTertiary,
                    textAlign: i === 2 ? 'right' : 'left',
                  }}>{h}</Text>
                ))}
              </div>
            )}

            {/* User rows */}
            {loading ? (
              <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[1, 2, 3].map((n) => <Skeleton key={n} active avatar paragraph={{ rows: 1 }} />)}
              </div>
            ) : users.length === 0 ? (
              <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                <Text type="secondary">No users found.</Text>
              </div>
            ) : (
              paginatedUsers.map((u, idx) => {
                const isSelf = u.id === user?.id;
                const isLast = idx === paginatedUsers.length - 1;
                const fullName = normalizeUserName(u);
                const roleName = String(
                  u?.role?.displayName || u?.role?.display_name || u?.role?.name ||
                  u?.roleName || u?.role || 'Unassigned'
                );
                const roleKey = String(u?.role?.name || u?.roleName || '').toLowerCase();
                const roleStyle = roleKey.includes('hr')
                  ? { color: '#fff', bg: 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)' }
                  : roleKey.includes('manager')
                  ? { color: '#fff', bg: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)' }
                  : roleKey.includes('employee')
                  ? { color: '#fff', bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }
                  : { color: '#fff', bg: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' };

                return (
                  <div
                    key={u.id}
                    style={{
                      display: isMobile ? 'flex' : 'grid',
                      gridTemplateColumns: isMobile ? undefined : '2.5fr 1.5fr 130px',
                      flexDirection: isMobile ? 'column' : undefined,
                      alignItems: isMobile ? 'stretch' : 'center',
                      gap: isMobile ? 10 : undefined,
                      padding: isMobile ? '16px' : '16px 24px',
                      borderBottom: isLast ? 'none' : `1px solid ${themeTokens.colors.borders}`,
                      transition: 'background 0.15s',
                      opacity: isSelf ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = themeTokens.colors.appBackground}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* User info */}
                    <div style={{ minWidth: 0 }}>
                      <Text strong style={{
                        fontSize: 14, color: themeTokens.colors.textPrimary,
                        display: 'block', lineHeight: 1.3,
                      }}>
                        {fullName}{isSelf ? ' (You)' : ''}
                      </Text>
                      <Text style={{ fontSize: 12, color: themeTokens.colors.textTertiary }}>
                        {u.email || '—'}
                      </Text>
                    </div>

                    {/* Role badge */}
                    <div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        height: 26, paddingInline: 12, borderRadius: 20,
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                        background: roleStyle.bg, color: roleStyle.color,
                        textTransform: 'uppercase',
                      }}>
                        {roleName}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                      <button
                        onClick={() => !isSelf && openUserRoleModal(u)}
                        disabled={isSelf}
                        title={isSelf ? 'You cannot change your own role' : undefined}
                        style={{
                          borderRadius: 8, fontWeight: 600, fontSize: 13,
                          height: 32, paddingInline: 14,
                          background: isSelf ? themeTokens.colors.secondaryBackground : BTN_GRADIENT,
                          color: isSelf ? themeTokens.colors.textTertiary : '#fff',
                          border: 'none',
                          cursor: isSelf ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit',
                          boxShadow: isSelf ? 'none' : '0 1px 6px rgba(19,104,255,0.2)',
                        }}
                      >
                        Edit Role
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pagination */}
            {!loading && users.length > USERS_PAGE_SIZE && (
              <PaginationRow
                page={usersPage}
                totalPages={totalUsersPages}
                onPrev={() => setUsersPage((p) => p - 1)}
                onNext={() => setUsersPage((p) => p + 1)}
                onPage={setUsersPage}
                total={users.length}
                pageSize={USERS_PAGE_SIZE}
              />
            )}
          </div>
        )}
      </div>

      {/* Manage Permissions Modal */}
      <Modal
        title={`Manage Permissions — ${normalizeRoleName(selectedRole)}`}
        open={permissionsModalOpen}
        onCancel={() => setPermissionsModalOpen(false)}
        width={isMobile ? '100%' : 860}
        style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', padding: 0 } : {}}
        centered={!isMobile}
        zIndex={1400}
        maskClosable={false}
        destroyOnClose
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setPermissionsModalOpen(false)}>Cancel</Button>
            <Button
              onClick={saveRolePermissions}
              disabled={saving}
              loading={saving}
              style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}
            >{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${themeTokens.colors.borders}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <Text type="secondary">Selected permissions</Text>
            <Text strong style={{ color: themeTokens.colors.primary }}>{selectedPermissionIds.length}</Text>
          </div>
          <Input
            placeholder="Search permission/category..."
            value={permissionSearch}
            onChange={(e) => setPermissionSearch(e.target.value)}
            allowClear
          />
          <div style={{ maxHeight: 480, overflow: 'auto', border: `1px solid ${themeTokens.colors.borders}`, borderRadius: 10, padding: 8 }}>
            <Collapse
              accordion
              items={Object.entries(filteredPermissionsByCategory).map(([category, categoryPermissions]) => {
                const selectedInCategory = categoryPermissions.filter((p) => selectedPermissionIds.includes(p.id)).length;
                const categoryPermissionIds = categoryPermissions.map((p) => p?.id).filter(Boolean);
                const isAllSelected = categoryPermissionIds.length > 0 && categoryPermissionIds.every((id) => selectedPermissionIds.includes(id));
                const isPartial = selectedInCategory > 0 && selectedInCategory < categoryPermissionIds.length;
                return {
                  key: category,
                  label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Text strong style={{ fontSize: 13 }}>{category}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{selectedInCategory}/{categoryPermissions.length}</Text>
                    </div>
                  ),
                  children: (
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <div style={{ paddingBottom: 4, borderBottom: '1px solid #f1f5f9' }}>
                        <Checkbox
                          checked={isAllSelected}
                          indeterminate={isPartial}
                          onChange={(e) => toggleCategoryPermissions(categoryPermissionIds, e.target.checked)}
                        >
                          Select all in this category
                        </Checkbox>
                      </div>
                      <Checkbox.Group
                        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                        value={selectedPermissionIds}
                        onChange={(values) => setSelectedPermissionIds(values)}
                      >
                        {categoryPermissions.map((permission) => (
                          <div key={permission.id} style={{ border: `1px solid ${themeTokens.colors.borders}`, borderRadius: 8, padding: '8px 10px' }}>
                            <Checkbox value={permission.id}>
                              <Space direction="vertical" size={0}>
                                <Text strong style={{ fontSize: 12 }}>
                                  {permission?.display_name || permission?.displayName || permission?.name}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {permission?.description || permission?.name}
                                </Text>
                              </Space>
                            </Checkbox>
                          </div>
                        ))}
                      </Checkbox.Group>
                    </Space>
                  ),
                };
              })}
            />
            {Object.keys(filteredPermissionsByCategory).length === 0 && (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <Text type="secondary">No permissions found.</Text>
              </div>
            )}
          </div>
        </Space>
      </Modal>

      {/* Edit User Role Modal */}
      <Modal
        title="Edit User Role"
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        centered
        zIndex={1400}
        maskClosable={false}
        destroyOnClose
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRoleModalOpen(false)}>Cancel</Button>
            <Button
              onClick={saveUserRole}
              disabled={saving}
              loading={saving}
              style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}
            >{saving ? 'Saving…' : 'Update Role'}</Button>
          </div>
        }
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Text type="secondary">{selectedUser?.email}</Text>
          <Select
            value={selectedUserRoleId}
            onChange={setSelectedUserRoleId}
            placeholder="Select role"
            style={{ width: '100%' }}
            options={assignableRoles
              .filter((role) => ['admin', 'hr', 'manager', 'employee'].includes(role.name?.toLowerCase()))
              .map((role) => ({
                value: role.id,
                label: normalizeRoleName(role),
              }))}
          />
        </Space>
      </Modal>

    </Layout>
  );
}
