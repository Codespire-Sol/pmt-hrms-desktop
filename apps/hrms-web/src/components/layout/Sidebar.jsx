import { Link, useLocation } from 'react-router-dom';
import { ENV } from '../../lib/env';
import {
  BarChart3,
  Users,
  Calendar,
  Palmtree,
  CheckSquare,
  Wallet,
  PieChart,
  Building2,
  Settings,
  ShieldCheck,
  GitBranch,
  Fingerprint,
  Mail,
  KeyRound,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
// CheckSquare retained for HR/Manager nav items below
import { useAuth } from '../../hooks/useAuth';
import { themeTokens } from '../../styles/theme';

const SIDEBAR_BG = '#ffffff';
const ACTIVE_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';
const ACTIVE_COLOR = '#ffffff';
const INACTIVE_COLOR = '#6B7280';
const HOVER_BG = 'rgba(19, 104, 255, 0.06)';
const HOVER_COLOR = '#1368FF';

export default function Sidebar({ collapsed, setCollapsed, isMobile, closeMobile }) {
  const location = useLocation();
  const { isAdmin, isHR, isManager } = useAuth();

  const handleMenuClick = () => {
    if (isMobile && closeMobile) {
      closeMobile();
    }
  };

  const getNavItems = () => {
    const items = [];

    items.push({ key: '/dashboard', icon: <BarChart3 size={18} />, label: 'Dashboard', to: '/dashboard' });

    if (isAdmin) {
      items.push(
        { key: '/admin/hr-accounts', icon: <ShieldCheck size={18} />, label: 'HR Accounts', to: '/admin/hr-accounts' },
        { key: '/admin/branches', icon: <GitBranch size={18} />, label: 'Branches', to: '/admin/branches' },
        { key: '/employees', icon: <Users size={18} />, label: 'Users', to: '/employees' },
        { key: '/biometric-mappings', icon: <Fingerprint size={18} />, label: 'Biometric Mappings', to: '/biometric-mappings' },
        { key: '/hr/operations', icon: <CheckSquare size={18} />, label: 'HR Operations', to: '/hr/operations' },
        { key: '/attendance', icon: <Calendar size={18} />, label: 'My Attendance', to: '/attendance' },
        { key: '/leave/approvals', icon: <CheckSquare size={18} />, label: 'Approvals', to: '/leave/approvals' },
        { key: '/payroll/admin', icon: <PieChart size={18} />, label: 'Payroll', to: '/payroll/admin' },
        { key: '/organization', icon: <Building2 size={18} />, label: 'Organization', to: '/organization' },
        { key: '/settings/email-schedule', icon: <Mail size={18} />, label: 'Email Schedule', to: '/settings/email-schedule' },
        { key: '/admin/settings', icon: <KeyRound size={18} />, label: 'Credential Settings', to: '/admin/settings' },
      );
    } else if (isHR) {
      items.push(
        { key: '/employees', icon: <Users size={18} />, label: 'Employees', to: '/employees' },
        { key: '/hr/operations', icon: <CheckSquare size={18} />, label: 'HR Operations', to: '/hr/operations' },
        { key: '/attendance', icon: <Calendar size={18} />, label: 'My Attendance', to: '/attendance' },
        { key: '/leave', icon: <Palmtree size={18} />, label: 'Leave', to: '/leave' },
        { key: '/leave/approvals', icon: <CheckSquare size={18} />, label: 'Approvals', to: '/leave/approvals' },
        { key: '/payroll/admin', icon: <PieChart size={18} />, label: 'Payroll', to: '/payroll/admin' },
        { key: '/organization', icon: <Building2 size={18} />, label: 'Organization', to: '/organization' },
        { key: '/settings/email-schedule', icon: <Mail size={18} />, label: 'Email Schedule', to: '/settings/email-schedule' },
      );
    } else if (isManager) {
      items.push(
        { key: '/employees', icon: <Users size={18} />, label: 'Team', to: '/employees' },
        { key: '/attendance/team', icon: <Calendar size={18} />, label: 'Team Attendance', to: '/attendance/team' },
        { key: '/attendance', icon: <Calendar size={18} />, label: 'My Attendance', to: '/attendance' },
        { key: '/leave/approvals', icon: <CheckSquare size={18} />, label: 'Approvals', to: '/leave/approvals' },
        { key: '/leave', icon: <Palmtree size={18} />, label: 'My Leave', to: '/leave' },
        { key: '/payroll', icon: <Wallet size={18} />, label: 'Payroll', to: '/payroll' },
        { key: '/organization', icon: <Building2 size={18} />, label: 'Organization', to: '/organization' },
      );
    } else {
      items.push(
        { key: '/attendance', icon: <Calendar size={18} />, label: 'My Attendance', to: '/attendance' },
        { key: '/leave', icon: <Palmtree size={18} />, label: 'My Leave', to: '/leave' },
        { key: '/payroll', icon: <Wallet size={18} />, label: 'Payslips', to: '/payroll' },
        { key: '/organization', icon: <Building2 size={18} />, label: 'Organization', to: '/organization' },
      );
    }

    items.push({ key: '/settings', icon: <Settings size={18} />, label: 'Settings', to: '/settings' });

    return items;
  };

  const navItems = getNavItems();
  const currentPath = location.pathname;
  const sidebarWidth = collapsed ? 80 : 260;

  return (
    <div
      className="main-sidebar"
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        height: isMobile ? '100%' : '100vh',
        position: isMobile ? 'relative' : 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        background: SIDEBAR_BG,
        borderRight: `1px solid ${themeTokens.colors.borders}`,
        zIndex: isMobile ? undefined : 890,
        boxShadow: isMobile ? 'none' : '4px 0 10px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{
        padding: collapsed ? '24px 0 20px' : '24px 20px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        flexShrink: 0,
        minHeight: 76,
      }}>
        <img
          src="/Favicon.png"
          alt="Logo"
          style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
        />
        {!collapsed && (
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ color: themeTokens.colors.textPrimary, fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.01em' }}>
              Codespire
            </div>
            <div style={{ color: themeTokens.colors.primary, fontWeight: 800, fontSize: 9.5, letterSpacing: '2.5px', textTransform: 'uppercase' }}>
              {ENV.APP_NAME}
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '4px 10px' : '4px 12px' }}>
        {navItems.map((item, idx) => {
          if (item.type === 'divider') {
            return (
              <div key={`divider-${idx}`} style={{
                height: 1,
                background: themeTokens.colors.borders,
                margin: '8px 0',
              }} />
            );
          }

          const isActive = currentPath === item.key ||
            (currentPath.startsWith(item.key + '/') &&
              !navItems.some(other => other.key !== item.key && currentPath === other.key));

          return (
            <Link
              key={item.key}
              to={item.to}
              onClick={handleMenuClick}
              style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}
            >
              <div
                className="sidebar-nav-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? '10px 0' : '9px 12px',
                  borderRadius: 10,
                  background: isActive ? ACTIVE_GRADIENT : 'transparent',
                  color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  transition: 'background 0.15s, color 0.15s',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = HOVER_BG;
                    e.currentTarget.style.color = HOVER_COLOR;
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = INACTIVE_COLOR;
                  }
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span style={{
                    fontSize: 13.5,
                    fontWeight: isActive ? 600 : 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {item.label}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div style={{
        padding: collapsed ? '12px 10px' : '12px',
        borderTop: `1px solid ${themeTokens.colors.borders}`,
        flexShrink: 0,
      }}>
        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8,
              padding: collapsed ? '8px 0' : '8px 12px',
              borderRadius: 10,
              background: 'transparent',
              border: 'none',
              color: themeTokens.colors.textSecondary,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
              fontWeight: 500,
              marginBottom: 8,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = HOVER_BG;
              e.currentTarget.style.color = HOVER_COLOR;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = themeTokens.colors.textSecondary;
            }}
          >
            {collapsed
              ? <ChevronRight size={18} />
              : <><ChevronLeft size={16} /><span>Collapse</span></>
            }
          </button>
        )}

      </div>
    </div>
  );
}
