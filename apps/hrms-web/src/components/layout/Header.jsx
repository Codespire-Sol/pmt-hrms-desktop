import { useState, useEffect, useCallback } from 'react';
import { ENV } from '../../lib/env';
import { useNavigate } from 'react-router-dom';
import { Layout, Button, Space, Typography, Avatar, Badge, Spin, Dropdown } from 'antd';
import { Bell, Menu as MenuIcon, LogOut } from 'lucide-react';
import { notificationsAPI } from '../../api/notifications';
import { useAuth } from '../../hooks/useAuth';
import { themeTokens } from '../../styles/theme';
import { getInitials, toTitleCase } from '../../utils/name';
import ShareLink from '../common/ShareLink';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const [feedRes, countRes] = await Promise.all([
        notificationsAPI.getAll({ module: 'hrms', limit: 10 }),
        notificationsAPI.getHrmsUnreadCount(),
      ]);
      const list = feedRes?.data?.notifications || feedRes?.data?.data?.notifications || [];
      setNotifications(Array.isArray(list) ? list : []);
      const countData = countRes?.data || {};
      setUnreadCount(Number(countData?.count ?? countData?.unreadCount ?? 0));
    } catch {
      // silently ignore fetch errors
    }
  }, []);

  // Poll every 60 seconds
  useEffect(() => {
    fetchNotifications();
    const timerId = window.setInterval(fetchNotifications, 60000);
    return () => window.clearInterval(timerId);
  }, [fetchNotifications]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [open, fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markRead([id]);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* no-op */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* no-op */ }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const isMobileView = window.innerWidth < 640;

  const notificationPanel = (
    <div
      style={{
        width: isMobileView ? 'calc(100vw - 16px)' : 360,
        maxWidth: 360,
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
        border: `1px solid ${themeTokens.colors.borders}`,
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: `1px solid ${themeTokens.colors.borders}`,
          background: themeTokens.colors.secondaryBackground,
        }}
      >
        <Typography.Text strong style={{ fontSize: 14 }}>
          Notifications {unreadCount > 0 && <Badge count={unreadCount} size="small" style={{ marginLeft: 6 }} />}
        </Typography.Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" onClick={handleMarkAllRead} style={{ padding: 0, fontSize: 12 }}>
            Mark all read
          </Button>
        )}
      </div>

      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spin size="small" />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: themeTokens.colors.textTertiary }}>
            <Bell size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div style={{ fontSize: 13 }}>No notifications</div>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.isRead && handleMarkRead(n.id)}
              style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${themeTokens.colors.borders}`,
                background: n.isRead ? '#fff' : '#f0f7ff',
                cursor: n.isRead ? 'default' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <Typography.Text
                  strong={!n.isRead}
                  style={{ fontSize: 13, flex: 1, lineHeight: '1.4', color: themeTokens.colors.text }}
                >
                  {n.title}
                </Typography.Text>
                {!n.isRead && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: themeTokens.colors.primary, marginTop: 4, flexShrink: 0 }} />
                )}
              </div>
              {n.message && (
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
                  {n.message}
                </Typography.Text>
              )}
              <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 3 }}>
                {formatTime(n.createdAt)}
              </Typography.Text>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => notificationPanel}
      trigger={['click']}
      placement="bottomRight"
      overlayStyle={isMobileView ? { position: 'fixed', left: 8, right: 8, width: 'auto' } : {}}
    >
      <Button
        type="text"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
      >
        <Badge count={unreadCount} size="small" offset={[2, -2]} overflowCount={9}>
          <Bell size={20} color={unreadCount > 0 ? '#ff4d4f' : themeTokens.colors.textSecondary} fill={unreadCount > 0 ? '#ff4d4f' : 'none'} />
        </Badge>
      </Button>
    </Dropdown>
  );
}

export default function Header({ collapsed, setCollapsed, isMobile, onShowMobile }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  return (
    <AntHeader
      className="main-header"
      style={{
      background: '#ffffff',
      padding: isMobile ? '0 16px' : '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 880,
      height: '70px',
      flexShrink: 0,
      borderBottom: `1px solid ${themeTokens.colors.borders}`,
      width: '100%'
    }}>
      <Space size={isMobile ? "small" : "middle"}>
        {isMobile && (
          <Button
            type="text"
            icon={<MenuIcon size={20} />}
            onClick={() => onShowMobile()}
            style={{
              fontSize: '16px',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        )}

        {isMobile && (
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer', lineHeight: 1 }}
            onClick={() => navigate('/dashboard')}
          >
            <img
              src="/Logo.png"
              alt="CodeSpire Logo"
              style={{ height: '24px', width: 'auto' }}
            />
            <Text style={{ fontSize: '9px', fontWeight: 800, color: themeTokens.colors.primary, letterSpacing: '1px', marginTop: '2px' }}>
              {ENV.APP_NAME}
            </Text>
          </div>
        )}
      </Space>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
        {!isMobile && <ShareLink />}
        <NotificationBell />

        {/* Vertical divider */}
        <div style={{ width: 1, height: 28, background: themeTokens.colors.borders, flexShrink: 0 }} />

        {/* User card with inline logout */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px', borderRadius: 10,
            border: `1px solid ${themeTokens.colors.borders}`,
            background: themeTokens.colors.appBackground,
          }}
        >
          <Avatar
            size={isMobile ? 28 : 32}
            src={user?.avatarUrl}
            style={{
              background: 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)',
              fontWeight: 700, fontSize: 12, flexShrink: 0,
            }}
          >
            {!user?.avatarUrl && getInitials(user?.name)}
          </Avatar>
          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.25' }}>
              <Text strong style={{ fontSize: 13, color: themeTokens.colors.textPrimary }}>
                {toTitleCase(user?.name?.split(' ')?.[0] || '')}
              </Text>
              <Text style={{ fontSize: 11, color: themeTokens.colors.textTertiary, textTransform: 'capitalize' }}>
                {user?.role}
              </Text>
            </div>
          )}
          {/* Divider */}
          <div style={{ width: 1, height: 24, background: themeTokens.colors.borders, flexShrink: 0, margin: '0 2px' }} />
          {/* Logout icon */}
          <button
            onClick={logout}
            title="Log out"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6,
              border: 'none', background: 'transparent',
              color: themeTokens.colors.textTertiary,
              cursor: 'pointer', transition: 'color 0.18s',
              flexShrink: 0, padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.color = themeTokens.colors.textTertiary; }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </AntHeader>
  );
}
