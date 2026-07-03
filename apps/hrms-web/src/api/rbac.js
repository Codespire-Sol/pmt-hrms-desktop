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

export const rbacAPI = {
  getRoles: (params) => apiClient.get('/rbac/roles', { params }).then(normalizeResponse),
  createRole: (payload) => apiClient.post('/rbac/roles', { ...payload, app: 'hrms' }).then(normalizeResponse),
  getRolePermissions: (roleId, params) => apiClient.get(`/rbac/roles/${roleId}/permissions`, { params }).then(normalizeResponse),
  setRolePermissions: (roleId, permissionIds) =>
    apiClient.put(`/rbac/roles/${roleId}/permissions`, { permissionIds }).then(normalizeResponse),
  getPermissions: (params) => apiClient.get('/rbac/permissions', { params }).then(normalizeResponse),
  getUsers: (params) => apiClient.get('/rbac/users', { params }).then(normalizeResponse),
  getUserPermissions: (userId) => apiClient.get(`/rbac/users/${userId}/permissions`).then(normalizeResponse),
  assignUserRole: (userId, roleId) => apiClient.post(`/rbac/users/${userId}/role`, { roleId }).then(normalizeResponse),
  removeUserRole: (userId) => apiClient.delete(`/rbac/users/${userId}/role`).then(normalizeResponse),
};
