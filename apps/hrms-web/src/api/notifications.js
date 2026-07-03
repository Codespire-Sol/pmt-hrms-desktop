import apiClient from './axios';

const BASE = '/notifications';

export const notificationsAPI = {
  getAll: (params = {}) => apiClient.get(BASE, { params }),
  getUnreadCount: () => apiClient.get(`${BASE}/unread-count`),
  getHrmsUnreadCount: () => apiClient.get(`${BASE}/hrms/unread-count`),
  markRead: (notificationIds = []) => apiClient.post(`${BASE}/mark-read`, { notificationIds }),
  markAllRead: () => apiClient.post(`${BASE}/mark-all-read`, { module: 'hrms' }),
  getTypes: () => apiClient.get(`${BASE}/types`),
  getPreferences: () => apiClient.get(`${BASE}/preferences`),
  updatePreferences: (preferences = []) => apiClient.put(`${BASE}/preferences`, { preferences }),
  updatePreferenceByType: (type, payload = {}) => apiClient.put(`${BASE}/preferences/${type}`, payload),
  getFeed: (params = {}) => apiClient.get(BASE, { params }),
  broadcast: (payload) => apiClient.post(`${BASE}/broadcast`, payload),
};
