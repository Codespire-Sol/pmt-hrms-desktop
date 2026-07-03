import { useCallback, useEffect, useMemo, useState } from 'react';
import { notificationsAPI } from '../api/notifications';

export function useNotifications(options = {}) {
  const { module = 'all', limit = 8, autoRefreshMs = 60000 } = options;

  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit, offset: 0, hasMore: false });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationsAPI.getAll({ module, limit, offset: 0 });
      const payload = response?.data || {};
      const list = payload?.notifications || [];
      setNotifications(Array.isArray(list) ? list : []);
      setPagination(payload?.pagination || { total: 0, limit, offset: 0, hasMore: false });
    } finally {
      setLoading(false);
    }
  }, [module, limit]);

  const fetchUnreadCount = useCallback(async () => {
    const response = module === 'hrms'
      ? await notificationsAPI.getHrmsUnreadCount()
      : await notificationsAPI.getUnreadCount();
    const data = response?.data || {};
    const count = data?.count ?? data?.unreadCount ?? 0;
    setUnreadCount(Number(count || 0));
  }, [module]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchNotifications(), fetchUnreadCount()]);
  }, [fetchNotifications, fetchUnreadCount]);

  const markRead = useCallback(async (notificationId) => {
    if (!notificationId) return;
    await notificationsAPI.markRead([notificationId]);
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsAPI.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      refresh().catch(() => {});
    }, autoRefreshMs);
    return () => window.clearInterval(timerId);
  }, [refresh, autoRefreshMs]);

  return useMemo(() => ({
    notifications,
    pagination,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
  }), [notifications, pagination, unreadCount, loading, refresh, markRead, markAllRead]);
}
