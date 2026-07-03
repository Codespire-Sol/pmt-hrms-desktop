import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Settings, Users, Kanban, ListTodo, Calendar, Zap, Link2, Webhook, GitBranch, FileText, LayoutList, CalendarRange, ClipboardList, DollarSign, MoreHorizontal } from 'lucide-react';
import { useGetProjectQuery, useGetProjectMembersQuery } from './projectsApi';
import { Typography, Button, Card, Space, Skeleton, Empty, Tabs, Tag, Avatar, Divider, message, Popover, Dropdown } from 'antd';
import { KanbanBoardPage } from '../boards/KanbanBoardPage';
import { IssueListPage } from '../issues/IssueListPage';
import { SprintPlanningPage } from '../sprints/SprintPlanningPage';
import { ProjectMembersPage } from './ProjectMembersPage';
import { AutomationRulesPage } from '../automation/components/AutomationRulesPage';
import { ProjectSettingsPage } from './ProjectSettingsPage';
import { ProjectIntegrationsPage } from '../integrations/ProjectIntegrationsPage';
import { WebhooksPage } from '../webhooks/components/WebhooksPage';
import { VersionsPage } from '../versions/VersionsPage';
import { PagesPage } from '../pages/PagesPage';
import { BacklogPage } from '../backlog/BacklogPage';
import { ProjectFormsPage } from '../forms/ProjectFormsPage';

import { ProjectTimelinePage } from '../timeline/ProjectTimelinePage';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import { normalizeAvatarUrl } from '@/lib/utils';
import { NavigationCustomizer } from './components/NavigationCustomizer';
import { ProjectSummaryTab } from './components/ProjectSummaryTab';
import { FinancialPage } from '../financial/FinancialPage';
import { User, Tag as TagIcon, Users as UsersIcon, Plus } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

const COLORS = {
  primary: '#1268ff',
  success: '#10b981',
  warning: '#faad14',
  danger: '#ff4d4f',
  info: '#1890ff',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};


// ── Tab label with hover-reveal three-dot menu ────────────────────────────
interface TabLabelWithMenuProps {
  item: { key: string; label: string; icon: React.ReactNode };
  pinnedKeys: string[];
  onRemove: (key: string) => void;
  onMoveLeft: (key: string) => void;
  onMoveRight: (key: string) => void;
}

function TabLabelWithMenu({ item, pinnedKeys, onRemove, onMoveLeft, onMoveRight }: TabLabelWithMenuProps) {
  const [hovering, setHovering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleIdx = pinnedKeys.indexOf(item.key);
  const isFirst = visibleIdx === 0;
  const isLast = visibleIdx === pinnedKeys.length - 1;

  const menuItems = [
    {
      key: 'move-left',
      label: 'Move Left',
      disabled: isFirst,
      onClick: ({ domEvent }: any) => {
        domEvent.stopPropagation();
        onMoveLeft(item.key);
        setMenuOpen(false);
      },
    },
    {
      key: 'move-right',
      label: 'Move Right',
      disabled: isLast,
      onClick: ({ domEvent }: any) => {
        domEvent.stopPropagation();
        onMoveRight(item.key);
        setMenuOpen(false);
      },
    },
    { type: 'divider' as const },
    {
      key: 'remove',
      label: 'Remove',
      danger: true,
      onClick: ({ domEvent }: any) => {
        domEvent.stopPropagation();
        onRemove(item.key);
        setMenuOpen(false);
      },
    },
  ];

  const visible = hovering || menuOpen;

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', position: 'relative', userSelect: 'none' }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { if (!menuOpen) setHovering(false); }}
    >
      {item.icon}
      <span>{item.label}</span>
      {/* Always rendered — visibility toggled so it never causes layout shift */}
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (!open) setHovering(false);
        }}
        placement="bottomRight"
      >
        <span
          onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            background: menuOpen ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.07)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'opacity 0.15s, background 0.15s',
            visibility: visible ? 'visible' : 'hidden',
            opacity: visible ? 1 : 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLSpanElement).style.background = 'rgba(0,0,0,0.14)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLSpanElement).style.background = menuOpen ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.07)'; }}
        >
          <MoreHorizontal size={11} />
        </span>
      </Dropdown>
    </span>
  );
}

// ── Stacked member avatars with hover card ────────────────────────────────────
function MemberAvatarStack({ members, onViewAll }: {
  members: any[];
  onViewAll?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_VISIBLE = 4;
  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - MAX_VISIBLE;

  const open  = () => { if (timerRef.current) clearTimeout(timerRef.current); setHovered(true); };
  const close = () => { timerRef.current = setTimeout(() => setHovered(false), 120); };

  const getInitial = (m: any) =>
    (m.user?.displayName || m.user?.firstName || m.user?.email || 'U')[0].toUpperCase();

  const getName = (m: any) =>
    m.user?.displayName || `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim() || m.user?.email || 'Unknown';

  const getRole = (m: any) => {
    const r = m.role;
    if (!r) return '';
    if (typeof r === 'string') return r.charAt(0).toUpperCase() + r.slice(1);
    return r.name || r.displayName || '';
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={open} onMouseLeave={close}
    >
      {/* Stacked avatars */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {visible.map((m, i) => {
          const avatarUrl = normalizeAvatarUrl(m.user?.avatarUrl);
          const initial   = getInitial(m);
          return (
            <div
              key={m.user?.id || i}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                border: '2.5px solid #ffffff',
                marginLeft: i === 0 ? 0 : -10,
                zIndex: MAX_VISIBLE - i,
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                overflow: 'hidden',
                flexShrink: 0,
                background: `hsl(${(i * 67) % 360}, 60%, 55%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
                transition: 'transform 0.15s',
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt={getName(m)}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initial}
            </div>
          );
        })}
        {overflow > 0 && (
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            border: '2.5px solid #ffffff',
            marginLeft: -10, zIndex: 0,
            background: '#f1f5f9', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
            boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
            flexShrink: 0,
          }}>
            +{overflow}
          </div>
        )}
      </div>

      {/* Hover card */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            onMouseEnter={open} onMouseLeave={close}
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: 0,
              zIndex: 1000,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              boxShadow: '0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)',
              padding: '10px 0',
              minWidth: 220,
              maxWidth: 280,
            }}
          >
            {/* Header */}
            <div style={{ padding: '4px 14px 10px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {members.length} Team Member{members.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Member rows */}
            <div style={{ maxHeight: 240, overflowY: 'auto', padding: '6px 0' }}>
              {members.map((m, i) => {
                const avatarUrl = normalizeAvatarUrl(m.user?.avatarUrl);
                const initial   = getInitial(m);
                const name      = getName(m);
                const role      = getRole(m);
                return (
                  <motion.div
                    key={m.user?.id || i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.14, delay: i * 0.03 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 14px',
                      transition: 'background 0.12s',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: `hsl(${(i * 67) % 360}, 60%, 55%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#fff',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
                    }}>
                      {avatarUrl
                        ? <img src={avatarUrl} alt={name}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {name}
                      </div>
                      {role && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{role}</div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            {onViewAll && (
              <div style={{ padding: '8px 14px 2px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  onClick={onViewAll}
                  style={{
                    width: '100%', padding: '7px 0', borderRadius: 8, border: 'none',
                    background: 'rgba(18,104,255,0.06)', color: '#1268ff',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(18,104,255,0.12)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(18,104,255,0.06)')}
                >
                  View all members →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: project, isLoading: isProjectLoading } = useGetProjectQuery(projectId!);
  const { data: membersData } = useGetProjectMembersQuery(projectId!, { skip: !projectId });
  const membersCount = membersData?.length || project?.statistics?.memberCount || 0;
  const { hasPermission: canUpdateProject } = usePermissionGuard('projects.update');
  const { hasPermission: canManageMembers } = usePermissionGuard('projects.manage_members');
  const { hasPermission: canManageAutomation } = usePermissionGuard('automation.manage');
  const { hasPermission: canManageIntegrations } = usePermissionGuard('projects.update');
  const { hasPermission: canManageProjectTools } = usePermissionGuard('projects.update');
  const { hasPermission: canCreateSprints } = usePermissionGuard('sprints.create');
  const { hasPermission: canManageSprints } = usePermissionGuard('sprints.manage');
  const { hasPermission: canViewIssues } = usePermissionGuard(
    ['issues.read', 'issues.create', 'issues.update', 'issues.update_own', 'issues.delete', 'issues.assign'],
    'any'
  );
  const { user: currentUser, isAdmin } = useAppSelector((state) => state.auth);
  const canViewFinancial = isAdmin || (currentUser?.id === project?.leadId);
  const [pinnedTabKeys, setPinnedTabKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`project_nav_${projectId}`);
      return saved ? JSON.parse(saved) : ['overview', 'board', 'timeline', 'backlog', 'members', 'settings'];
    } catch {
      return ['overview', 'board', 'timeline', 'backlog', 'members', 'settings'];
    }
  });

  const savePinnedTabs = (keys: string[]) => {
    setPinnedTabKeys(keys);
    try {
      localStorage.setItem(`project_nav_${projectId}`, JSON.stringify(keys));
    } catch { /* ignored */ }
  };

  if (isProjectLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <Skeleton active avatar paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <Empty description="Project not found" />
        <Button onClick={() => navigate('/projects')} style={{ marginTop: '16px' }}>Back to Projects</Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return COLORS.success;
      case 'archived': return COLORS.textSecondary;
      case 'on_hold': return COLORS.warning;
      default: return COLORS.primary;
    }
  };

  const path = location.pathname;
  const activeKey = path.endsWith(projectId!) ? 'overview' : path.split('/').pop() || 'overview';

  // End of activeKey logic

  const canViewSprints = canCreateSprints || canManageSprints;

  const tabItems = [
    { key: 'overview', label: 'Summary', icon: <Kanban size={16} />, visible: true, description: 'A high-level overview of project progress, statistics, and recent activity.' },
    { key: 'board', label: 'Board', icon: <Kanban size={16} />, visible: canViewIssues, description: 'Visualize and manage your project tasks on a Kanban board.' },
    { key: 'timeline', label: 'Timeline', icon: <CalendarRange size={16} />, visible: canViewIssues, description: 'Plan and track your project schedule over time.' },
    { key: 'backlog', label: 'Backlog', icon: <LayoutList size={16} />, visible: canViewIssues, description: 'Manage your project backlog and prioritize upcoming work.' },
    // { key: 'issues', label: 'Issues', icon: <ListTodo size={16} />, visible: canViewIssues, description: 'View and search all issues in this project.' },
    // { key: 'sprints', label: 'Sprints', icon: <Calendar size={16} />, visible: canViewSprints, description: 'Plan and manage your project sprints.' },
    // { key: 'forms', label: 'Forms', icon: <ClipboardList size={16} />, visible: canViewIssues, description: 'Manage project forms and data collection.' },

    { key: 'members', label: 'Members', icon: <Users size={16} />, visible: canManageMembers, description: 'Manage project team members and their roles.' },
    { key: 'automation', label: 'Automation', icon: <Zap size={16} />, visible: canManageAutomation, description: 'Create and manage automation rules for your project.' },
    { key: 'integrations', label: 'Integrations', icon: <Link2 size={16} />, visible: canManageIntegrations, description: 'Connect your project with external tools and services.' },
    { key: 'webhooks', label: 'Webhooks', icon: <Webhook size={16} />, visible: canManageProjectTools, description: 'Manage project webhooks for external integrations.' },
    { key: 'versions', label: 'Versions', icon: <GitBranch size={16} />, visible: canManageProjectTools, description: 'Manage project versions and releases.' },
    { key: 'pages', label: 'Pages', icon: <FileText size={16} />, visible: canViewIssues, description: 'Create and manage project documentation and pages.' },
    { key: 'settings', label: 'Settings', icon: <Settings size={16} />, visible: canUpdateProject && canManageMembers, description: 'Manage project details, access, and configuration.' },
    // { key: 'financial', label: 'Financial', icon: <DollarSign size={16} />, visible: canViewFinancial, description: 'Track project budget, resource rates, and burnout chart.' },
  ];

  const primaryTabItems = pinnedTabKeys
    .map((key) => tabItems.find((item) => item.key === key))
    .filter((item): item is (typeof tabItems)[number] => Boolean(item && item.visible));

  const handlePin = (key: string) => {
    if (!pinnedTabKeys.includes(key)) {
      savePinnedTabs([...pinnedTabKeys, key]);
    }
  };

  const handleUnpin = (key: string) => {
    if (pinnedTabKeys.length > 2) {
      savePinnedTabs(pinnedTabKeys.filter(k => k !== key));
    } else {
      message.info('Keep at least two views pinned for easy navigation.');
    }
  };

  const handleMoveLeft = (key: string) => {
    const idx = pinnedTabKeys.indexOf(key);
    if (idx <= 0) return;
    const next = [...pinnedTabKeys];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    savePinnedTabs(next);
  };

  const handleMoveRight = (key: string) => {
    const idx = pinnedTabKeys.indexOf(key);
    if (idx < 0 || idx >= pinnedTabKeys.length - 1) return;
    const next = [...pinnedTabKeys];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    savePinnedTabs(next);
  };

  const handleTabChange = (key: string) => {
    const base = `/projects/${projectId}`;
    const nextPath =
      key === 'overview'
        ? base
        : `${base}/${key}`;
    navigate(nextPath);
  };

  return (
    <div style={{ padding: '0px' }}>
      {/* Project Header Card */}
      <Card
        style={{
          marginBottom: '24px',
          borderRadius: '16px',
          border: `1px solid ${COLORS.border}`,
          boxShadow: COLORS.shadow
        }}
        styles={{ body: { padding: '32px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <Space align="center" style={{ marginBottom: '8px' }}>
              <Tag color="blue" style={{ fontWeight: 700, borderRadius: '4px' }}>{project.key}</Tag>
              <Tag color={getStatusColor(project.status)} style={{ fontWeight: 600, borderRadius: '4px', textTransform: 'capitalize' }}>
                {project.status.replace('_', ' ')}
              </Tag>
              <Text style={{ color: COLORS.textSecondary, fontSize: '14px' }}>• Project ID: {project.id.slice(0, 8)}</Text>
            </Space>
            <Title level={1} style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>
              {project.name}
            </Title>
            <Paragraph style={{ fontSize: '16px', color: COLORS.textSecondary, maxWidth: '800px', margin: '0 0 24px 0' }}>
              {project.description || 'Manage your project tasks, sprints, and team members from one place.'}
            </Paragraph>

            <Space size={32} wrap>
              {project.projectType && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Project Type
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: project.projectType.color + '15',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: project.projectType.color
                    }}>
                      <TagIcon size={14} />
                    </div>
                    <Text strong style={{ fontSize: '14px' }}>{project.projectType.name}</Text>
                  </div>
                </div>
              )}

              {project.lead && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Project Lead
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar
                      size={28}
                      src={normalizeAvatarUrl(project.lead.avatarUrl)}
                      icon={<User size={14} />}
                      style={{ backgroundColor: COLORS.primary }}
                    />
                    <Text strong style={{ fontSize: '14px' }}>{project.lead.displayName}</Text>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Team Members
                </Text>
                {membersData && membersData.length > 0 ? (
                  <MemberAvatarStack
                    members={membersData}
                    onViewAll={() => handleTabChange('members')}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '6px',
                      backgroundColor: '#8b5cf615', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color: '#8b5cf6'
                    }}>
                      <UsersIcon size={14} />
                    </div>
                    <Text strong style={{ fontSize: '14px' }}>{membersCount} Members</Text>
                  </div>
                )}
              </div>
            </Space>
          </div>

          <Space>
            {canUpdateProject && canManageMembers && (
              <Button
                icon={<Settings size={18} />}
                onClick={() => navigate(`/projects/${projectId}/settings`)}
                style={{ height: '44px', borderRadius: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Settings
              </Button>
            )}
            {canViewIssues && (
              <Button
                type="primary"
                style={{ height: '44px', borderRadius: '10px', background: COLORS.primary, fontWeight: 600, display: 'flex', alignItems: 'center', padding: '0 24px' }}
                onClick={() => navigate(`/projects/${projectId}/board`)}
              >
                Open Board
              </Button>
            )}
          </Space>
        </div>

        <Divider style={{ margin: '24px 0' }} />

        <Tabs
          activeKey={activeKey}
          onChange={handleTabChange}
          destroyOnHidden
          tabBarExtraContent={
            <Popover
              content={
                <NavigationCustomizer
                  availableItems={tabItems.filter(i => i.visible)}
                  pinnedItems={pinnedTabKeys}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  onClose={() => { }}
                />
              }
              trigger="click"
              placement="bottomRight"
              overlayInnerStyle={{ padding: 0 }}
              overlayStyle={{ borderRadius: '12px', overflow: 'hidden' }}
            >
              <Button
                icon={<Plus size={18} />}
                className="nav-customizer-btn"
                style={{
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '40px',
                  width: '40px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: COLORS.textSecondary,
                  transition: 'all 0.2s',
                  marginLeft: '8px'
                }}
              />
            </Popover>
          }
          items={primaryTabItems.map((item) => ({
            key: item.key,
            label: (
              <TabLabelWithMenu
                item={item}
                pinnedKeys={pinnedTabKeys}
                onRemove={handleUnpin}
                onMoveLeft={handleMoveLeft}
                onMoveRight={handleMoveRight}
              />
            ),
            children: null,
          }))}
        />
      </Card>

      {/* Tab Content */}
      {activeKey === 'overview' && (
        <ProjectSummaryTab project={project} projectId={projectId!} />
      )}

      {activeKey === 'board' && (canViewIssues ? <KanbanBoardPage /> : <AccessDenied />)}
      {activeKey === 'timeline' && (canViewIssues ? <ProjectTimelinePage /> : <AccessDenied />)}
      {activeKey === 'issues' && (canViewIssues ? <IssueListPage /> : <AccessDenied />)}
      {activeKey === 'sprints' && (canViewSprints ? <SprintPlanningPage /> : <AccessDenied />)}
      {activeKey === 'members' && (canManageMembers ? <ProjectMembersPage /> : <AccessDenied />)}
      {activeKey === 'automation' && (canManageAutomation ? <AutomationRulesPage /> : <AccessDenied />)}
      {activeKey === 'integrations' && (canManageIntegrations ? <ProjectIntegrationsPage /> : <AccessDenied />)}
      {activeKey === 'webhooks' && (canManageProjectTools ? <WebhooksPage /> : <AccessDenied />)}
      {activeKey === 'versions' && (canManageProjectTools ? <VersionsPage /> : <AccessDenied />)}
      {activeKey === 'backlog' && (canViewIssues ? <BacklogPage /> : <AccessDenied />)}
      {activeKey === 'pages' && (canViewIssues ? <PagesPage /> : <AccessDenied />)}
      {activeKey === 'forms' && (canViewIssues ? <ProjectFormsPage /> : <AccessDenied />)}

      {activeKey === 'settings' && (canUpdateProject ? <ProjectSettingsPage /> : <AccessDenied />)}
      {activeKey === 'financial' && (canViewFinancial ? <FinancialPage /> : <AccessDenied />)}

      <style>{`
        .nav-button:hover {
          color: ${COLORS.primary} !important;
          border-color: ${COLORS.primary} !important;
          background-color: ${COLORS.primary}05 !important;
        }
      `}</style>
    </div >
  );
}

function AccessDenied() {
  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ borderRadius: '12px', border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow }}>
        <div style={{ padding: '24px', textAlign: 'center', color: COLORS.textSecondary }}>
          You don't have permission to view this section.
        </div>
      </Card>
    </div>
  );
}
