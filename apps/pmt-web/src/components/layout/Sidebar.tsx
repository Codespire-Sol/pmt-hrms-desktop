import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FolderKanban, FolderOpen, Clock, Settings, FileText,
  ChevronRight, GitBranch, Users,
} from 'lucide-react';
import { Tooltip } from 'antd';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

const T = {
  bg:             '#ffffff',
  bgHover:        '#f0f5ff',
  bgActive:       '#1268ff',
  text:           '#101828',
  textSub:        '#4a5565',
  textMuted:      '#6a7282',
  textActive:     '#ffffff',
  border:         '#e5e7eb',
  collapseBtn:    '#ffffff',
  collapseBorder: '#e5e7eb',
  collapseIcon:   '#4a5565',
  bottomBg:       '#f9fafb',
  sectionLabel:   '#6a7282',
};

export const SIDEBAR_W    = 264;
export const COLLAPSED_W  = 72;

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

interface NavItem { key: string; href: string; icon: React.ReactNode; label: string; }
interface NavSection { key: string; label: string; items: NavItem[]; }

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const location  = useLocation();

  const { hasPermission: canReadProjects }    = usePermissionGuard('projects.read');
  const { hasPermission: canViewTimesheet }   = usePermissionGuard(['time.log', 'time.view_all'], 'any');
  const { hasPermission: canAdminSettings }   = usePermissionGuard('admin.settings');
  const { hasPermission: canAdminAudit }      = usePermissionGuard('admin.audit');
  const { hasPermission: canManageWorkflows } = usePermissionGuard(['workflows.manage', 'admin.settings'], 'any');

  const isActive = (href: string) =>
    href === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(href);

  const mainItems: NavItem[] = [
    { key: '/dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    ...(canReadProjects  ? [{ key: '/projects',  href: '/projects',  icon: <FolderKanban size={18} />, label: 'Projects'  }] : []),
    ...(canReadProjects  ? [{ key: '/hub',       href: '/hub',       icon: <FolderOpen size={18} />,   label: 'Project Hub' }] : []),
    ...(canReadProjects  ? [{ key: '/lead-tracker', href: '/lead-tracker', icon: <FolderOpen size={18} />, label: 'Lead Tracker' }] : []),
    ...(canViewTimesheet ? [{ key: '/timesheet', href: '/timesheet', icon: <Clock size={18} />,        label: 'Timesheet' }] : []),
  ];

  const adminItems: NavItem[] = [
    // Hidden from sidebar (code kept, not removed):
    // ...(canAdminSettings   ? [{ key: '/admin/users',      href: '/admin/users',      icon: <Users size={18} />,     label: 'Users & Permissions' }] : []),
    // ...(canManageWorkflows ? [{ key: '/admin/workflows',  href: '/admin/workflows',  icon: <GitBranch size={18} />, label: 'Workflows'  }] : []),
    ...(canAdminAudit      ? [{ key: '/admin/audit-logs', href: '/admin/audit-logs', icon: <FileText size={18} />,  label: 'Audit Logs' }] : []),
  ];

  const settingsItems: NavItem[] = [
    { key: '/settings', href: '/settings', icon: <Settings size={18} />, label: 'Settings' },
  ];

  const sections: NavSection[] = [
    { key: 'overview', label: 'Overview', items: mainItems },
    ...(adminItems.length > 0 ? [{ key: 'admin', label: 'Admin', items: adminItems }] : []),
    { key: 'account', label: 'Account', items: settingsItems },
  ];

  return (
    <motion.div
      animate={{ width: collapsed ? COLLAPSED_W : SIDEBAR_W }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, height: '100vh',
        background: T.bg,
        borderRight: `1px solid ${T.border}`,
        boxShadow: '4px 0 24px rgba(16,24,40,0.07)',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: collapsed ? '20px 0' : '20px 20px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: `1px solid ${T.border}`,
        minHeight: '68px', flexShrink: 0,
      }}>
        {collapsed ? (
          <img
            src="/Favicon.png"
            alt="codeSpire"
            style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
          />
        ) : (
          <AnimatePresence initial={false}>
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}
            >
              <img
                src="/Logo.png"
                alt="codeSpire"
                style={{ height: 24, width: 'auto', maxWidth: 150, objectFit: 'contain', display: 'block' }}
              />
              <span style={{
                fontSize: '10px', fontWeight: 600, color: T.textMuted,
                whiteSpace: 'nowrap', letterSpacing: '0.03em', lineHeight: 1.2,
              }}>
                Project Management Toolkit
              </span>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 10px' }}>
        {sections.map((section, si) => (
          <div key={section.key} style={{ marginBottom: '6px' }}>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    fontSize: '10px', fontWeight: 700, color: T.sectionLabel,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    padding: si === 0 ? '8px 10px 6px' : '18px 10px 6px',
                  }}
                >
                  {section.label}
                </motion.div>
              )}
            </AnimatePresence>
            {collapsed && si > 0 && (
              <div style={{ height: '1px', background: T.border, margin: '10px 6px' }} />
            )}

            {section.items.map(item => {
              const active = isActive(item.href);
              const navEl = (
                <Link to={item.href} style={{ textDecoration: 'none', display: 'block' }}>
                  <motion.div
                    whileHover={{ x: collapsed ? 0 : 3 }}
                    transition={{ duration: 0.15 }}
                    className={active ? 'cs-nav-active' : 'cs-nav-item'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '11px',
                      padding: collapsed ? '11px 0' : '10px 12px',
                      borderRadius: '10px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      cursor: 'pointer', marginBottom: '2px',
                      background: active
                        ? 'linear-gradient(135deg, #1268ff 0%, #0a50d6 100%)'
                        : 'transparent',
                      boxShadow: active ? '0 4px 14px rgba(18,104,255,0.28)' : 'none',
                      transition: 'background 0.18s, box-shadow 0.18s',
                      position: 'relative',
                    }}
                  >
                    <span style={{
                      color: active ? '#fff' : T.textSub,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 20, height: 20, flexShrink: 0,
                    }}>
                      {item.icon}
                    </span>
                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{
                            fontSize: '13.5px', fontWeight: active ? 600 : 500,
                            color: active ? '#ffffff' : T.text,
                            whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1,
                          }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </Link>
              );
              return collapsed
                ? <Tooltip key={item.key} title={item.label} placement="right">{navEl}</Tooltip>
                : <React.Fragment key={item.key}>{navEl}</React.Fragment>;
            })}
          </div>
        ))}
      </div>

      {/* ── Collapse toggle ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end',
        padding: '8px 14px', borderTop: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
          <motion.button
            onClick={() => onCollapsedChange(!collapsed)}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: `1.5px solid ${T.collapseBorder}`,
              background: T.collapseBtn,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(16,24,40,0.1)',
            }}
          >
            <motion.span
              animate={{ rotate: collapsed ? 0 : 180 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={13} color={T.collapseIcon} strokeWidth={2.5} />
            </motion.span>
          </motion.button>
        </Tooltip>
      </div>

      <style>{`
        .cs-nav-item:hover { background: ${T.bgHover} !important; }
        .cs-nav-item:hover span { color: #1268ff !important; }
      `}</style>
    </motion.div>
  );
}
