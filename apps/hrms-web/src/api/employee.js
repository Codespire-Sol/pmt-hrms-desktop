import apiClient from './axios';

const EMPLOYEE_BASE = '/employee';

export const employeeSelfAPI = {
  // Dashboard
  getDashboard: () => apiClient.get(`${EMPLOYEE_BASE}/dashboard`),

  // Profile
  getMyProfile: () => apiClient.get(`${EMPLOYEE_BASE}/me/profile`),
  updateMyProfile: (data) => apiClient.patch(`${EMPLOYEE_BASE}/me/profile`, data),

  // Attendance
  checkIn: () => apiClient.post(`${EMPLOYEE_BASE}/attendance/check-in`),
  checkOut: () => apiClient.post(`${EMPLOYEE_BASE}/attendance/check-out`),
  getMyAttendance: (params) => apiClient.get(`${EMPLOYEE_BASE}/attendance`, { params }),

  // Leave
  applyLeave: (data) => apiClient.post(`${EMPLOYEE_BASE}/leaves`, data),
  getMyLeaves: (params) => apiClient.get(`${EMPLOYEE_BASE}/leaves`, { params }),
  cancelLeave: (leaveId) => apiClient.delete(`${EMPLOYEE_BASE}/leaves/${leaveId}`),
  getMyLeaveSummary: (params) => apiClient.get(`${EMPLOYEE_BASE}/leaves/summary`, { params }),
  getMyLeaveBalance: (params) => apiClient.get(`${EMPLOYEE_BASE}/leave-balance`, { params }),

  // Payroll
  getMyPayroll: (params) => apiClient.get(`${EMPLOYEE_BASE}/payroll`, { params }),
  downloadPayslip: (month, year) =>
    apiClient.get(`${EMPLOYEE_BASE}/payslips/${month}/${year}/download`, { responseType: 'blob' }),

  // Organization
  getOrgHierarchy: () => apiClient.get(`${EMPLOYEE_BASE}/org-hierarchy`),
  getOrgChart: () => apiClient.get(`${EMPLOYEE_BASE}/org-hierarchy`)
};
