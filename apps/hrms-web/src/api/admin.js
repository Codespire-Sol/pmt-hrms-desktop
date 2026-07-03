import apiClient from './axios';

const unwrapPayload = (response) => {
  const body = response?.data;
  if (body?.data !== undefined) return body.data;
  return body;
};

const normalizeResponse = (response) => ({
  ...response,
  data: unwrapPayload(response),
});

export const adminAPI = {
  // Profile
  getMyProfile: () => apiClient.get('/users/me').then(normalizeResponse),
  updateMyProfile: (data) => apiClient.patch('/users/me', data).then(normalizeResponse),

  // Dashboard
  getDashboard: (params) => apiClient.get('/admin/dashboard', { params }).then(normalizeResponse),

  // HR Accounts Management
  getHrAccounts: (params) => apiClient.get('/admin/hr-accounts', { params }).then(normalizeResponse),
  createHrAccount: (payload) => apiClient.post('/admin/hr-accounts', payload).then(normalizeResponse),
  deleteHrAccount: (accountId) => apiClient.delete(`/admin/hr-accounts/${accountId}`).then(normalizeResponse),
  assignHrBranch: (userId, branchId) => apiClient.patch(`/admin/hr-accounts/${userId}/branch`, { branchId }).then(normalizeResponse),

  // System Settings
  getSettings: () => apiClient.get('/admin/settings').then(normalizeResponse),
  updateSettings: (settings) => apiClient.patch('/admin/settings', settings).then(normalizeResponse),
  updateMaxHrAccounts: (maxHrAccounts) =>
    apiClient.put('/admin/settings/hr-max-accounts', {
      maxHrAccounts,
      maxHRAccounts: maxHrAccounts,
    }).then(normalizeResponse),

  // Audit Logs
  getAuditLogs: (params) => apiClient.get('/admin/audit-logs', { params }).then(normalizeResponse),

  // Branch Management
  getBranches: () => apiClient.get('/admin/branches').then(normalizeResponse),
  createBranch: (payload) => apiClient.post('/admin/branches', payload).then(normalizeResponse),
  updateBranch: (id, payload) => apiClient.patch(`/admin/branches/${id}`, payload).then(normalizeResponse),
  deleteBranch: (id) => apiClient.delete(`/admin/branches/${id}`).then(normalizeResponse),

  // Keycloak User Directory
  getKeycloakUsers: () => apiClient.get('/admin/keycloak/users').then(normalizeResponse),
  getKeycloakUserProfile: (sub) => apiClient.get(`/admin/keycloak/users/${sub}/profile`).then(normalizeResponse),
  updateKeycloakUserProfile: (sub, payload) => apiClient.put(`/admin/keycloak/users/${sub}/profile`, payload).then(normalizeResponse),
  sendPasswordResetEmail: (sub) => apiClient.post(`/admin/keycloak/users/${sub}/send-reset-email`).then(normalizeResponse),
};
