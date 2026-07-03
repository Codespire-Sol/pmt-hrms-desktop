import apiClient from './axios';

const MANAGER_BASE = '/manager';

export const managerAPI = {
  // Dashboard
  getDashboard: () => apiClient.get('/manager/dashboard'),

  // Profile (Manager is also an employee)
  getMyProfile: () => apiClient.get(`${MANAGER_BASE}/me/profile`),
  updateMyProfile: (data) => apiClient.patch(`${MANAGER_BASE}/me/profile`, data),

  // Team Management
  getTeam: () => apiClient.get(`${MANAGER_BASE}/team`),
  getTeamEmployees: () => apiClient.get(`${MANAGER_BASE}/team/employees`),
  getTeamMemberDetail: (employeeId) => apiClient.get(`${MANAGER_BASE}/team/employees/${employeeId}`),
  getTeamMemberDocuments: (employeeId) => apiClient.get(`${MANAGER_BASE}/team/employees/${employeeId}/documents`),
  getOrgHierarchy: () => apiClient.get(`${MANAGER_BASE}/org-hierarchy`),
  getTeamAttendance: (params) => apiClient.get(`${MANAGER_BASE}/team/attendance`, { params }),

  // Attendance (own)  
  checkIn: () => apiClient.post('/employee/attendance/check-in'),
  checkOut: () => apiClient.post('/employee/attendance/check-out'),
  getMyAttendance: (params) => apiClient.get('/employee/attendance', { params }),

  // Leave Approvals
  getPendingLeaves: () => apiClient.get(`${MANAGER_BASE}/team/leaves/pending`),
  getTeamLeaves: (params) => apiClient.get(`${MANAGER_BASE}/leaves`, { params }),
  approveLeave: (leaveId, note) => apiClient.patch(`${MANAGER_BASE}/team/leaves/${leaveId}/approve`, note ? { note } : {}),
  rejectLeave: (leaveId, reason) => apiClient.patch(`${MANAGER_BASE}/team/leaves/${leaveId}/reject`, { reason }),

  // Own Leave (Manager self)
  applyLeave: (data) => apiClient.post(`${MANAGER_BASE}/leaves`, data),
  getMyLeaves: (params) => apiClient.get(`${MANAGER_BASE}/leaves`, { params }),
  cancelMyLeave: (leaveId) => apiClient.delete(`${MANAGER_BASE}/leaves/${leaveId}`),
  getMyLeaveSummary: (params) => apiClient.get(`${MANAGER_BASE}/leaves/summary`, { params }),
  getMyLeaveBalance: (params) => apiClient.get(`${MANAGER_BASE}/leave-balance`, { params })
};
