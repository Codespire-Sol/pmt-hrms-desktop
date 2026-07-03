import apiClient from './axios';

export const dashboardAPI = {
  // HR Dashboard
  getHRDashboard: (params) => apiClient.get('/hr/dashboard', { params }),

  // Manager Dashboard  
  getManagerDashboard: () => apiClient.get('/manager/dashboard'),

  // Employee Dashboard
  getEmployeeDashboard: () => apiClient.get('/employee/dashboard'),

  // Admin Dashboard (if needed)
  getAdminDashboard: () => apiClient.get('/admin/dashboard')
};
