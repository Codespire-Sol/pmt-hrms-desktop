import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Bell, Check, CheckCheck, MessageSquare, UserPlus,
  AlertCircle, Calendar, PlayCircle, Clock, GitPullRequest,
  AtSign, Filter, RefreshCw,
} from 'lucide-react';
import { Avatar, Skeleton } from 'antd';
import {
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} from '../notificationsApi';
import { NotificationWithDetails, NotificationType } from '../types';

const C = {
  primary:   '#1268ff',
  primaryBg: 'rgba(18,104,255,0.08)',
  success:   '#10b981', successBg: 'rgba(16,185,129,0.08)',
  warning:   '#faad14', warningBg: 'rgba(250,173,20,0.08)',
  danger:    '#ff4d4f', dangerBg:  'rgba(255,77,79,0.08)',
  purple:    '#8b5cf6', purpleBg:  'rgba(139,92,246,0.08)',
  orange:    '#ff6b1a', orangeBg:  'rgba(255,107,26,0.08)',
  teal:      '#06b6d4', tealBg:    'rgba(6,182,212,0.08)',
  pink:      '#ec4899', pinkBg:    'rgba(236,72,153,0.08)',
  indigo:    '#6366f1', indigoBg:  'rgba(99,102,241,0.08)',
  text:      '#101828', textSub:   '#4a5565', textMuted: '#6a7282',
  border:    '#e5e7eb', bg:        '#f9fafb', card:      '#ffffff',
};

const TYPE_CONFIG: Record<NotificationType, { icon: React.ReactNode; color: string; bg: string }> = {
  issue_created:        { icon: <GitPullRequest size={15} />, color: C.success,  bg: C.successBg  },
  issue_updated:        { icon: <GitPullRequest size={15} />, color: C.primary,  bg: C.primaryBg  },
  issue_assigned:       { icon: <UserPlus size={15} />,       color: C.purple,   bg: C.purpleBg   },
  issue_commented:      { icon: <MessageSquare size={15} />,  color: C.warning,  bg: C.warningBg  },
  issue_mentioned:      { icon: <AtSign size={15} />,         color: C.pink,     bg: C.pinkBg     },
  sprint_started:       { icon: <PlayCircle size={15} />,     color: C.teal,     bg: C.tealBg     },
  sprint_ending:        { icon: <AlertCircle size={15} />,    color: C.orange,   bg: C.orangeBg   },
  due_date_approaching: { icon: <Calendar size={15} />,       color: C.danger,   bg: C.dangerBg   },
  issue_status_changed: { icon: <Clock size={15} />,          color: C.indigo,   bg: C.indigoBg   },
};

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function NotifCard({
  notification,
  onMarkRead,
  isMarking,
  index,
}: {
  notification: NotificationWithDetails;
  onMarkRead: (id: string) => void;
  isMarking: boolean;
  index: number;
}) {
  const cfg = TYPE_CONFIG[notification.type] ?? { icon: <Bell size={15} />, color: C.primary, bg: C.primaryBg };
  const issueUrl = notification.issueId
    ? `/projects/${notification.projectId}/issues/${notification.issueId}`
    : notification.projectId ? `/projects/${notification.projectId}` : '#';

  const isUnread = !notification.isRead;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '14px',
        padding: '16px 24px',
        background: isUnread ? 'rgba(18,104,255,0.025)' : 'transparent',
        borderBottom: `1px solid ${C.border}`,
        transition: 'background 0.18s',
        position: 'relative',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = isUnread ? 'rgba(18,104,255,0.04)' : C.bg; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isUnread ? 'rgba(18,104,255,0.025)' : 'transparent'; }}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 4, height: '60%', borderRadius: '0 4px 4px 0',
          background: `linear-gradient(180deg, ${C.primary}, #06b6d4)`,
        }} />
      )}

      {/* Type icon */}
      <div style={{
        width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
        background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${cfg.color}20`,
      }}>
        <span style={{ color: cfg.color, display: 'flex' }}>{cfg.icon}</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link
              to={issueUrl}
              style={{
                fontSize: '14px', fontWeight: isUnread ? 700 : 600,
                color: C.text, textDecoration: 'none', lineHeight: 1.4,
                display: 'block',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = C.primary; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = C.text; }}
            >
              {notification.title}
            </Link>
            {notification.message && (
              <div style={{ fontSize: '13px', color: C.textSub, marginTop: '3px', lineHeight: 1.5 }}>
                {notification.message}
              </div>
            )}
          </div>

          {isUnread && (
            <button
              onClick={() => onMarkRead(notification.id)}
              disabled={isMarking}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '8px', border: `1px solid ${C.border}`,
                background: C.card, cursor: 'pointer', flexShrink: 0,
                fontSize: '12px', fontWeight: 600, color: C.textSub,
                fontFamily: 'Inter, sans-serif', transition: 'all 0.18s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = C.primary;
                el.style.color = C.primary;
                el.style.background = C.primaryBg;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = C.border;
                el.style.color = C.textSub;
                el.style.background = C.card;
              }}
            >
              <Check size={12} />
              Mark read
            </button>
          )}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
          {notification.actor && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Avatar
                size={18}
                src={notification.actor.avatarUrl || undefined}
                style={{
                  background: notification.actor.avatarUrl ? undefined : `linear-gradient(135deg, ${C.primary}, #06b6d4)`,
                  fontSize: '9px', fontWeight: 700, flexShrink: 0,
                }}
              >
                {initials(notification.actor.displayName)}
              </Avatar>
              <span style={{ fontSize: '12px', color: C.textSub, fontWeight: 500 }}>
                {notification.actor.displayName}
              </span>
            </div>
          )}
          {notification.project && (
            <span style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '5px',
              background: C.primaryBg, color: C.primary, fontWeight: 600,
            }}>
              {notification.project.name}
            </span>
          )}
          <span style={{ fontSize: '12px', color: C.textMuted, marginLeft: 'auto' }}>
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

interface NotificationListProps {
  showFilters?: boolean;
}

export function NotificationList({ showFilters = true }: NotificationListProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage]     = useState(0);
  const limit = 20;

  const { data, isLoading, isFetching } = useGetNotificationsQuery({
    unreadOnly: filter === 'unread',
    limit,
    offset: page * limit,
  });

  const [markAsRead,   { isLoading: isMarking    }] = useMarkAsReadMutation();
  const [markAllAsRead, { isLoading: isMarkingAll }] = useMarkAllAsReadMutation();

  const notifications = data?.notifications || [];
  const pagination    = data?.pagination;
  const totalPages    = pagination ? Math.ceil(pagination.total / limit) : 0;
  const hasUnread     = notifications.some(n => !n.isRead);

  const handleMarkRead = async (id: string) => {
    try { await markAsRead([id]).unwrap(); } catch { /* ignored */ }
  };
  const handleMarkAllRead = async () => {
    try { await markAllAsRead().unwrap(); } catch { /* ignored */ }
  };

  return (
    <div>
      {/* Toolbar */}
      {showFilters && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: `1px solid ${C.border}`,
        }}>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: '4px', padding: '3px', background: C.bg, borderRadius: '9px', border: `1px solid ${C.border}` }}>
            {(['all', 'unread'] as const).map(f => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(0); }}
                style={{
                  padding: '5px 14px', borderRadius: '7px', border: 'none',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  fontSize: '12px', fontWeight: 600, transition: 'all 0.18s',
                  background: filter === f ? C.card : 'transparent',
                  color: filter === f ? C.text : C.textMuted,
                  boxShadow: filter === f ? '0 1px 4px rgba(16,24,40,0.08)' : 'none',
                }}
              >
                {f === 'all' ? 'All' : 'Unread'}
              </button>
            ))}
          </div>

          {/* Mark all */}
          <button
            onClick={handleMarkAllRead}
            disabled={isMarkingAll || !hasUnread}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px',
              border: `1px solid ${C.border}`, background: C.card,
              cursor: hasUnread ? 'pointer' : 'default',
              fontSize: '13px', fontWeight: 600,
              color: hasUnread ? C.textSub : C.textMuted,
              fontFamily: 'Inter, sans-serif', transition: 'all 0.18s',
              opacity: hasUnread ? 1 : 0.5,
            }}
            onMouseEnter={e => {
              if (!hasUnread) return;
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = C.primary;
              el.style.color = C.primary;
              el.style.background = C.primaryBg;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = C.border;
              el.style.color = hasUnread ? C.textSub : C.textMuted;
              el.style.background = C.card;
            }}
          >
            {isMarkingAll ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCheck size={13} />}
            Mark all read
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div style={{ padding: '24px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: '16px 0', borderBottom: `1px solid ${C.border}` }}>
              <Skeleton active avatar paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '64px 24px', gap: '12px',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '20px',
            background: C.primaryBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bell size={28} color={C.primary} />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
            {filter === 'unread' ? "You're all caught up!" : 'No notifications yet'}
          </div>
          <div style={{ fontSize: '13px', color: C.textMuted, textAlign: 'center' }}>
            {filter === 'unread' ? 'No unread notifications.' : "You don't have any notifications yet."}
          </div>
        </div>
      ) : (
        <div>
          {isFetching && !isLoading && (
            <div style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: `1px solid ${C.border}` }}>
              <RefreshCw size={13} color={C.textMuted} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '12px', color: C.textMuted }}>Refreshing…</span>
            </div>
          )}
          {notifications.map((n, i) => (
            <NotifCard
              key={n.id}
              notification={n}
              onMarkRead={handleMarkRead}
              isMarking={isMarking}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderTop: `1px solid ${C.border}`,
        }}>
          <span style={{ fontSize: '13px', color: C.textMuted }}>
            Page {page + 1} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ label: '← Prev', action: () => setPage(p => Math.max(0, p - 1)), disabled: page === 0 },
              { label: 'Next →', action: () => setPage(p => p + 1), disabled: !pagination?.hasMore }].map(btn => (
              <button
                key={btn.label}
                onClick={btn.action}
                disabled={btn.disabled}
                style={{
                  padding: '6px 16px', borderRadius: '8px',
                  border: `1px solid ${C.border}`, background: C.card,
                  fontSize: '13px', fontWeight: 600, cursor: btn.disabled ? 'default' : 'pointer',
                  color: btn.disabled ? C.textMuted : C.textSub,
                  fontFamily: 'Inter, sans-serif', transition: 'all 0.18s',
                  opacity: btn.disabled ? 0.5 : 1,
                }}
                onMouseEnter={e => {
                  if (btn.disabled) return;
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = C.primary;
                  el.style.color = C.primary;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = C.border;
                  el.style.color = btn.disabled ? C.textMuted : C.textSub;
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
