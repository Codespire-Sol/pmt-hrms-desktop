import apiClient from './axios';

const HR_BASE = '/hr';

export const hrAPI = {
  // My Profile (HR/Admin)
  getMyProfile: () => apiClient.get('/users/me'),
  updateMyProfile: (data) => apiClient.patch('/users/me', data),

  // Onboarding
  initiateOnboarding: (employeeId) => apiClient.post(`${HR_BASE}/onboarding/${employeeId}/initiate`),
  getOnboardingSummary: (employeeId) => apiClient.get(`${HR_BASE}/onboarding/${employeeId}`),
  listOnboarding: (params) => apiClient.get(`${HR_BASE}/onboarding`, { params }),
  updateOnboardingTask: (onboardingId, taskId, payload) =>
    apiClient.patch(`${HR_BASE}/onboarding/${onboardingId}/tasks/${taskId}`, payload),
  completeOnboarding: (employeeId) => apiClient.post(`${HR_BASE}/onboarding/${employeeId}/complete`),

  // Offboarding
  initiateOffboarding: (employeeId, payload) => apiClient.post(`${HR_BASE}/offboarding/${employeeId}/initiate`, payload),
  listOffboarding: (params) => apiClient.get(`${HR_BASE}/offboarding`, { params }),
  getOffboardingDetail: (employeeId) => apiClient.get(`${HR_BASE}/offboarding/${employeeId}`),
  updateOffboardingTask: (offboardingId, taskId, payload) =>
    apiClient.patch(`${HR_BASE}/offboarding/${offboardingId}/tasks/${taskId}`, payload),
  setExitDate: (employeeId, payload) => apiClient.patch(`${HR_BASE}/offboarding/${employeeId}/exit-date`, payload),
  completeOffboarding: (employeeId) => apiClient.post(`${HR_BASE}/offboarding/${employeeId}/complete`),
  exportOffboarding: (params) => apiClient.get(`${HR_BASE}/offboarding/export`, { params, responseType: 'blob' }),

  // Attendance
  getAttendanceList: (params) => apiClient.get(`${HR_BASE}/attendance`, { params }),
  getAttendanceByEmployee: (employeeId, params) => apiClient.get(`${HR_BASE}/attendance/${employeeId}`, { params }),
  correctAttendance: (attendanceId, payload) => apiClient.patch(`${HR_BASE}/attendance/${attendanceId}/correct`, payload),
  addManualAttendance: (payload) => apiClient.post(`${HR_BASE}/attendance/manual`, payload),
  exportAttendance: (params) => apiClient.get(`${HR_BASE}/attendance/export`, { params, responseType: 'blob' }),

  // Leave
  listLeaves: (params) => apiClient.get(`${HR_BASE}/leaves`, { params }),
  approveLeave: (leaveId) => apiClient.patch(`${HR_BASE}/leaves/${leaveId}/approve`),
  rejectLeave: (leaveId, payload) => apiClient.patch(`${HR_BASE}/leaves/${leaveId}/reject`, payload),
  cancelLeave: (leaveId) => apiClient.delete(`${HR_BASE}/leaves/${leaveId}`),
  editLeave: (leaveId, payload) => apiClient.patch(`${HR_BASE}/leaves/${leaveId}/edit`, payload),
  adjustLeaveBalance: (employeeId, payload) => apiClient.patch(`${HR_BASE}/leaves/${employeeId}/balance`, payload),
  getLeaveBalance: (employeeId, params) => apiClient.get(`${HR_BASE}/leaves/${employeeId}/balance`, { params }),
  getLeaveSummary: (employeeId, params) => apiClient.get(`${HR_BASE}/leaves/${employeeId}/summary`, { params }),

  // Holidays
  listHolidays: (params) => apiClient.get(`${HR_BASE}/holidays`, { params }),
  createHoliday: (payload) => apiClient.post(`${HR_BASE}/holidays`, payload),
  updateHoliday: (holidayId, payload) => apiClient.patch(`${HR_BASE}/holidays/${holidayId}`, payload),
  deleteHoliday: (holidayId) => apiClient.delete(`${HR_BASE}/holidays/${holidayId}`),
  uploadHolidays: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`${HR_BASE}/holidays/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  exportHolidays: (params) => apiClient.get(`${HR_BASE}/holidays/export`, { params, responseType: 'blob' }),

  // Payroll
  uploadPayroll: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`${HR_BASE}/payroll/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getPayroll: (params) => apiClient.get(`${HR_BASE}/payroll`, { params }),
  generatePayslips: (payload) => apiClient.post(`${HR_BASE}/payroll/generate`, payload),
  finalizePayroll: (payload) => apiClient.post(`${HR_BASE}/payroll/finalize`, payload),
  exportPayroll: (params) => apiClient.get(`${HR_BASE}/payroll/export`, { params, responseType: 'blob' }),
  getPayrollStatus: (params) => apiClient.get(`${HR_BASE}/payroll/status`, { params }),

  // Payroll history for a specific employee (HR/Admin view)
  getEmployeePayrollHistory: (employeeId) => apiClient.get(`${HR_BASE}/employees/${employeeId}/payroll`),

  // Org hierarchy
  getOrgChart: () => apiClient.get(`${HR_BASE}/org-hierarchy`),
  getTeamView: (managerEmployeeId) => apiClient.get(`${HR_BASE}/org-hierarchy/team/${managerEmployeeId}`),
  reassignManager: (payload) => apiClient.patch(`${HR_BASE}/org-hierarchy/reassign-manager`, payload),
  modifyOrgStructure: (payload) => apiClient.patch(`${HR_BASE}/org-hierarchy/structure`, payload),
  exportOrgChart: (params) => apiClient.get(`${HR_BASE}/org-hierarchy/export`, { params, responseType: 'blob' }),

  // Reports
  getAttendanceReport: (params) => apiClient.get(`${HR_BASE}/reports/attendance`, { params, responseType: 'blob' }),
  getLeaveReport: (params) => apiClient.get(`${HR_BASE}/reports/leaves`, { params, responseType: 'blob' }),
  getPayrollReport: (params) => apiClient.get(`${HR_BASE}/reports/payroll`, { params, responseType: 'blob' }),
  scheduleReport: (payload) => apiClient.post(`${HR_BASE}/reports/schedule`, payload),

  // Work email — set after employee is activated
  setWorkEmail: (employeeId, workEmail, password) =>
    apiClient.patch(`${HR_BASE}/employees/${employeeId}/work-email`, { workEmail, password }),

  // Onboarding Invite
  sendOnboardingInvite: (employeeId) => apiClient.post(`${HR_BASE}/onboarding/${employeeId}/send-invite`),
  releaseOfferLetter: (employeeId) => apiClient.post(`${HR_BASE}/onboarding/${employeeId}/release-offer-letter`),
  resetOnboardingTasks: (employeeId) => apiClient.post(`${HR_BASE}/onboarding/${employeeId}/reset-tasks`),
  getEmployeeDocuments: (employeeId) => apiClient.get(`${HR_BASE}/employees/${employeeId}/documents`),
  reviewEmployeeDocument: (employeeId, documentId, status, reviewNote) =>
    apiClient.patch(`${HR_BASE}/employees/${employeeId}/documents/${documentId}/review`, { status, reviewNote }),
  uploadEmployeeDocument: (employeeId, file, documentType) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    return apiClient.post(`${HR_BASE}/employees/${employeeId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Public self-registration (no auth needed for token validation and OTP steps)
  validateInviteToken: (token) => apiClient.get(`/public/onboarding/register/${token}`),
  sendOnboardingOtp: (token) => apiClient.post(`/public/onboarding/register/${token}/send-otp`),
  verifyOnboardingOtp: (token, otp) => apiClient.post(`/public/onboarding/register/${token}/verify-otp`, { otp }),
  // Session token required after OTP verification
  submitSelfRegistration: (token, data, sessionToken) =>
    apiClient.patch(`/public/onboarding/register/${token}`, data, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }),
  markOnboardingComplete: (token, sessionToken) =>
    apiClient.post(`/public/onboarding/register/${token}/complete`, {}, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }),
  getOnboardingDocuments: (token, sessionToken) =>
    apiClient.get(`/public/onboarding/register/${token}/documents`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }),
  uploadOnboardingDocument: (token, file, documentType, sessionToken) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    return apiClient.post(`/public/onboarding/register/${token}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${sessionToken}`,
      },
    });
  },

  // Task Templates
  listOnboardingTaskTemplates: () => apiClient.get(`${HR_BASE}/onboarding/task-templates`),
  createOnboardingTaskTemplate: (payload) => apiClient.post(`${HR_BASE}/onboarding/task-templates`, payload),
  updateOnboardingTaskTemplate: (id, payload) => apiClient.put(`${HR_BASE}/onboarding/task-templates/${id}`, payload),
  deleteOnboardingTaskTemplate: (id) => apiClient.delete(`${HR_BASE}/onboarding/task-templates/${id}`),
  listOffboardingTaskTemplates: () => apiClient.get(`${HR_BASE}/offboarding/task-templates`),
  createOffboardingTaskTemplate: (payload) => apiClient.post(`${HR_BASE}/offboarding/task-templates`, payload),
  updateOffboardingTaskTemplate: (id, payload) => apiClient.put(`${HR_BASE}/offboarding/task-templates/${id}`, payload),
  deleteOffboardingTaskTemplate: (id) => apiClient.delete(`${HR_BASE}/offboarding/task-templates/${id}`),
  seedTaskTemplates: () => apiClient.post(`${HR_BASE}/task-templates/seed`),
};
