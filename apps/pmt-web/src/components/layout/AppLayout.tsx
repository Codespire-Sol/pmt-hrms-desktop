import { Outlet, useLocation, useParams, Link, useNavigate } from 'react-router-dom';
import { Bell, Search, Menu as MenuIcon, Command, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sidebar, SIDEBAR_W, COLLAPSED_W } from './Sidebar';
import { Breadcrumb, Badge, Drawer, Avatar, Tooltip } from 'antd';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useGetNotificationsQuery } from '@/features/notifications/notificationsApi';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/authSlice';
import { useGetProjectQuery } from '@/features/projects/projectsApi';
import keycloak from '@/lib/keycloak';
import { ENV } from '@/lib/env';
import { normalizeAvatarUrl } from '@/lib/utils';
import ShareLink from '@/components/ShareLink';
import api from '@/lib/api';

const C = {
  header:    '#ffffff',
  border:    '#e5e7eb',
  bg:        '#f9fafb',
  textSub:   '#4a5565',
  textMuted: '#9ca3af',
  primary:   '#1268ff',
  textMain:  '#101828',
};

interface BreadcrumbItem { label: string; href?: string; }

function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const params   = useParams();
  const { data: breadcrumbProject } = useGetProjectQuery(params.projectId!, {
    skip: !params.projectId,
  });
  const [leadName, setLeadName] = useState<string | null>(null);
  useEffect(() => {
    if (!params.leadId) { setLeadName(null); return; }
    api.get(`/leads/${params.leadId}`)
      .then(r => setLeadName(r.data?.data?.name ?? null))
      .catch(() => setLeadName(null));
  }, [params.leadId]);

  const segs     = location.pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];
  let path = '';

  for (let i = 0; i < segs.length; i++) {
    const seg  = segs[i];
    path += `/${seg}`;
    const prev = i > 0 ? segs[i - 1] : undefined;
    const next = i < segs.length - 1 ? segs[i + 1] : undefined;

    if (seg === 'projects' && segs[i + 1])                      { crumbs.push({ label: 'Projects', href: '/projects' }); continue; }
    if (seg === 'admin')                                         { crumbs.push({ label: 'Admin' }); continue; }
    if (seg === 'users' && prev === 'admin' && next === 'roles') { crumbs.push({ label: 'Users', href: '/admin/roles' }); continue; }
    if (params.projectId && seg === params.projectId)            {
      crumbs.push({ label: breadcrumbProject?.name || 'Project', href: `/projects/${params.projectId}` });
      continue;
    }
    if (params.issueId   && seg === params.issueId)              { crumbs.push({ label: `Issue #${seg.slice(0, 8)}` }); continue; }
    if (params.leadId    && seg === params.leadId)               { crumbs.push({ label: leadName || 'Lead Details' }); continue; }
    if (seg === 'versions' && segs[i + 1])                       { crumbs.push({ label: 'Versions' }); continue; }
    if (prev === 'versions')                                     { crumbs.push({ label: 'Version', href: i === segs.length - 1 ? undefined : path }); continue; }

    const map: Record<string, string> = {
      dashboard: 'Dashboard', projects: 'Projects', new: 'New Project', board: 'Board',
      issues: 'Issues', sprints: 'Sprints', members: 'Members', settings: 'Settings',
      timesheet: 'Timesheet', notifications: 'Notifications', search: 'Search',
      reports: 'Reports', roles: 'Role Management', 'audit-logs': 'Audit Logs',
      profile: 'Profile', integrations: 'Integrations', forms: 'Forms',
      code: 'Code', timeline: 'Timeline', workflows: 'Workflows',
      'lead-tracker': 'Lead Tracker',
    };

    crumbs.push({ label: map[seg] || seg, href: i === segs.length - 1 ? undefined : path });
  }
  return crumbs;
}

export function AppLayout() {
  const isMobile  = useIsMobile();
  const navigate  = useNavigate();
  const location  = useLocation();
  const dispatch  = useAppDispatch();
  const { user, isAdmin }  = useAppSelector(s => s.auth);

  const handleLogout = () => {
    dispatch(logout());
    if (ENV.AUTH_MODE === 'jwt') {
      window.location.assign('/login');
    } else {
      keycloak.logout({ redirectUri: window.location.origin });
    }
  };
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const breadcrumbs = useBreadcrumbs();
  const isFullPageIssue = /\/projects\/[^/]+\/issues\/[^/]+/.test(location.pathname);

  // Close mobile drawer whenever the route changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const { data: notificationsData } = useGetNotificationsQuery({ limit: 10 });
  const unreadCount = notificationsData?.notifications?.filter(n => !n.isRead).length || 0;

  const sideW = sidebarCollapsed ? COLLAPSED_W : SIDEBAR_W;

  const displayName   = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User';
  const avatarInitial = (user?.firstName || user?.email || 'U').charAt(0).toUpperCase();
  const pageName = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : 'Dashboard';

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>
      {/* Sidebar — desktop */}
      {!isMobile && (
        <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      )}

      {/* Sidebar — mobile drawer */}
      {isMobile && (
        <Drawer placement="left" onClose={() => setDrawerOpen(false)} open={drawerOpen} styles={{ body: { padding: 0 } }} width={264}>
          <Sidebar collapsed={false} onCollapsedChange={() => setDrawerOpen(false)} />
        </Drawer>
      )}

      {/* Main content */}
      <motion.div
        animate={{ marginLeft: isMobile ? 0 : sideW }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
      >
        {/* ── Premium Header ─────────────────────────────────────────── */}
        <div style={{
          background: C.header,
          borderBottom: `1px solid ${C.border}`,
          position: 'sticky', top: 0, zIndex: 900,
          boxShadow: '0 2px 12px rgba(16,24,40,0.05)',
        }}>
          {/* Rainbow accent bar */}
          <div style={{
            height: '3px',
            background: 'linear-gradient(90deg, #1268ff 0%, #06b6d4 50%, #8b5cf6 100%)',
          }} />

          {/* Main row */}
          <div style={{
            height: 60,
            padding: isMobile ? '0 16px' : '0 28px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '16px',
          }}>
            {/* Left */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
              {isMobile && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  style={{
                    width: 36, height: 36, borderRadius: '9px', border: `1px solid ${C.border}`,
                    background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <MenuIcon size={18} color={C.textSub} />
                </button>
              )}

              {breadcrumbs.length > 1 ? (
                <Breadcrumb
                  items={breadcrumbs.map(c => ({
                    title: c.href
                      ? <Link to={c.href} style={{ color: C.textMuted, fontWeight: 500, fontSize: '12px' }}>{c.label}</Link>
                      : <span style={{ color: C.textMain, fontWeight: 600, fontSize: '12px' }}>{c.label}</span>,
                  }))}
                  separator={<span style={{ color: C.textMuted, fontSize: '11px' }}>/</span>}
                />
              ) : (
                <div style={{ fontSize: '15px', fontWeight: 700, color: C.textMain }}>{pageName}</div>
              )}
            </div>

            {/* Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* Search pill */}
              <button
                onClick={() => navigate('/search')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '0 12px', height: 36, borderRadius: '10px',
                  border: `1.5px solid ${C.border}`, background: C.bg,
                  cursor: 'pointer', transition: 'all 0.18s',
                  color: C.textMuted, fontFamily: 'Inter, sans-serif',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = C.primary;
                  el.style.background = '#fff';
                  el.style.boxShadow = '0 0 0 3px rgba(18,104,255,0.08)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = C.border;
                  el.style.background = C.bg;
                  el.style.boxShadow = 'none';
                }}
              >
                <Search size={14} color={C.textMuted} />
                {!isMobile && <span style={{ fontSize: '13px', color: C.textMuted }}>Search…</span>}
                {!isMobile && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '2px',
                    padding: '2px 5px', borderRadius: '5px',
                    background: '#f0f1f4', border: `1px solid ${C.border}`,
                    fontSize: '10px', color: C.textMuted, marginLeft: '2px',
                  }}>
                    <Command size={9} />K
                  </span>
                )}
              </button>

              <ShareLink />

              {/* Notification bell */}
              <Tooltip title="Notifications" placement="bottom">
                <button
                  onClick={() => navigate('/notifications')}
                  style={{
                    position: 'relative', width: 38, height: 38, borderRadius: '10px',
                    border: `1.5px solid ${C.border}`, background: C.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = C.primary;
                    el.style.background = '#fff';
                    el.style.boxShadow = '0 0 0 3px rgba(18,104,255,0.08)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = C.border;
                    el.style.background = C.bg;
                    el.style.boxShadow = 'none';
                  }}
                >
                  <Bell size={17} color={C.textSub} />
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -5,
                      minWidth: 18, height: 18, borderRadius: '9px',
                      background: 'linear-gradient(135deg, #ff4d4f, #ff7875)',
                      border: '2px solid #fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 800, color: '#fff', padding: '0 4px',
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </Tooltip>

              {/* User card — avatar + name/role + logout (matches HRMS header style) */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 10px', borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.bg, cursor: 'pointer',
                }}
                onClick={() => navigate('/settings')}
              >
                <Avatar
                  size={32}
                  src={normalizeAvatarUrl(user?.avatarUrl || user?.id)}
                  style={{
                    background: 'linear-gradient(135deg, #1E2875 0%, #1368ff 100%)',
                    fontSize: '13px', fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {avatarInitial}
                </Avatar>
                {!isMobile && (
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.25' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.textMain, whiteSpace: 'nowrap' }}>
                      {displayName.split(' ')[0]}
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                      {isAdmin ? 'Admin' : 'Member'}
                    </span>
                  </div>
                )}
                {/* Inner divider */}
                <div style={{ width: 1, height: 24, background: C.border, flexShrink: 0, margin: '0 2px' }} />
                {/* Logout icon inside the card */}
                <button
                  onClick={e => { e.stopPropagation(); handleLogout(); }}
                  title="Log out"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 6,
                    border: 'none', background: 'transparent',
                    cursor: 'pointer', padding: 0, flexShrink: 0,
                    color: C.textMuted,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; }}
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        {isFullPageIssue ? (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff' }}>
            <Outlet />
          </div>
        ) : (
          <div style={{ flex: 1, padding: isMobile ? '16px' : '28px', background: C.bg, overflowY: 'auto' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              <Outlet />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default AppLayout;
