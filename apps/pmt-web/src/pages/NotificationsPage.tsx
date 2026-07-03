import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Settings, CheckCheck, Filter } from 'lucide-react';
import { NotificationList } from '@/features/notifications/components/NotificationList';
import { NotificationPreferences } from '@/features/notifications';
import { useGetUnreadCountQuery } from '@/features/notifications';

const C = {
  primary:   '#1268ff',
  primaryBg: 'rgba(18,104,255,0.08)',
  text:      '#101828',
  textSub:   '#4a5565',
  textMuted: '#6a7282',
  border:    '#e5e7eb',
  bg:        '#f9fafb',
  card:      '#ffffff',
  shadow:    '0 4px 16px rgba(16,24,40,0.06)',
};

type Tab = 'notifications' | 'preferences';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('notifications');
  const { data: unreadCount = 0 } = useGetUnreadCountQuery();

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
    { key: 'preferences',   label: 'Preferences',   icon: <Settings size={14} /> },
  ];

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ marginBottom: '28px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '14px',
            background: 'linear-gradient(135deg, #1268ff 0%, #06b6d4 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(18,104,255,0.28)',
          }}>
            <Bell size={22} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span style={{
                  padding: '3px 10px', borderRadius: '20px',
                  background: 'linear-gradient(135deg, #ff4d4f, #ff7875)',
                  color: '#fff', fontSize: '12px', fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(255,77,79,0.35)',
                }}>
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: C.textSub, marginTop: '2px' }}>
              Stay updated on activity across your projects.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tab switcher */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        style={{
          display: 'flex', gap: '4px', padding: '4px',
          background: C.bg, borderRadius: '12px',
          border: `1px solid ${C.border}`, width: 'fit-content',
          marginBottom: '24px',
        }}
      >
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', borderRadius: '9px', border: 'none',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
              background: activeTab === tab.key ? C.card : 'transparent',
              color: activeTab === tab.key ? C.text : C.textMuted,
              boxShadow: activeTab === tab.key ? '0 1px 6px rgba(16,24,40,0.1)' : 'none',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {activeTab === 'notifications' && (
            <div style={{
              background: C.card, borderRadius: '16px',
              border: `1px solid ${C.border}`, boxShadow: C.shadow,
              overflow: 'hidden',
            }}>
              <NotificationList />
            </div>
          )}
          {activeTab === 'preferences' && (
            <div style={{
              background: C.card, borderRadius: '16px',
              border: `1px solid ${C.border}`, boxShadow: C.shadow,
              overflow: 'hidden', padding: '24px',
            }}>
              <NotificationPreferences />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
