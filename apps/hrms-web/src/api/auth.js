import apiClient from './axios';

export const authAPI = {
  // Login & Logout
  login: (email, password, rememberMe = false) =>
    apiClient.post('/auth/login', { email, password, rememberMe }),

  logout: () => apiClient.post('/auth/logout'),

  // Token Management
  refreshToken: (refreshToken) =>
    apiClient.post('/auth/refresh', { refreshToken }),

  // User Info
  getCurrentUser: (accessToken) =>
    apiClient.get('/auth/me', accessToken ? {
      headers: { Authorization: `Bearer ${accessToken}` }
    } : undefined),

  getMyPermissions: (accessToken) =>
    apiClient.get('/rbac/me/permissions', accessToken ? {
      headers: { Authorization: `Bearer ${accessToken}` }
    } : undefined),

  // Password Management
  changePassword: (currentPassword, newPassword, confirmPassword) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword, confirmPassword }),

  forgotPassword: (email) =>
    apiClient.post('/auth/forgot-password', { email }),

  resetPassword: (token, newPassword, confirmPassword) =>
    apiClient.post('/auth/reset-password', { token, password: newPassword, confirmPassword }),

  // Admin Reset (for HR/Admin)
  adminResetPassword: (employeeId, newPassword) =>
    apiClient.post('/auth/reset-password', { employeeId, newPassword })
};
