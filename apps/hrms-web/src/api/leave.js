import apiClient from './axios';
import { useAuthStore } from '../store/authStore';
import { normalizeRoleName } from '../utils/auth';

function getRole() {
  return normalizeRoleName(useAuthStore.getState().user?.role) || 'employee';
}

function getCurrentUserId() {
  return useAuthStore.getState().user?.id;
}

function unwrapData(response) {
  const body = response?.data;
  if (body?.data !== undefined) return body.data;
  return body;
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.leaves)) return payload.leaves;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeLeave(leave = {}) {
  const employeeFirstName =
    leave.employeeFirstName ||
    leave['employee.firstName'] ||
    leave.employee?.firstName ||
    leave.firstName ||
    null;

  const employeeLastName =
    leave.employeeLastName ||
    leave['employee.lastName'] ||
    leave.employee?.lastName ||
    leave.lastName ||
    null;

  const employeeName =
    leave.employee?.name ||
    leave.employee?.fullName ||
    leave.employeeName ||
    leave.name ||
    [employeeFirstName, employeeLastName].filter(Boolean).join(' ') ||
    [leave.firstName, leave.lastName].filter(Boolean).join(' ');

  const employeeCode =
    leave.employeeCode ||
    leave['employee.employeeId'] ||
    leave.employee?.employeeCode ||
    leave.employee?.employeeId ||
    null;
  const employeeAvatarUrl =
    leave.employeeAvatarUrl ||
    leave['employee.avatarUrl'] ||
    leave.avatarUrl ||
    leave.employee?.avatarUrl ||
    null;

  return {
    ...leave,
    leaveType: String(leave.leaveType || leave.leave_type || '').toLowerCase(),
    fromDate: leave.fromDate || leave.from_date || null,
    toDate: leave.toDate || leave.to_date || null,
    status: String(leave.status || 'pending').toLowerCase(),
    appliedAt: leave.appliedAt || leave.appliedOn || leave.appliedOnDate || leave.createdAt || leave.requestedAt || null,
    employee: {
      ...(leave.employee || {}),
      id: leave.employee?.id || leave['employee.id'] || leave.employeeId || leave.employee_id || null,
      firstName: leave.employee?.firstName || employeeFirstName,
      lastName: leave.employee?.lastName || employeeLastName,
      name: leave.employee?.name || employeeName || 'Unknown',
      fullName: leave.employee?.fullName || employeeName || 'Unknown',
      designation: leave.employee?.designation || leave['employee.designation'] || leave.designation || null,
      employeeCode: employeeCode,
      avatarUrl: employeeAvatarUrl,
    },
  };
}

function normalizeResponse(response, mapper = (x) => x) {
  return {
    ...response,
    data: mapper(unwrapData(response)),
  };
}

function toLeavePayload(data = {}) {
  return {
    ...data,
    leaveType: String(data.leaveType || '').trim().toLowerCase(),
    reason: String(data.reason || '').trim(),
  };
}

export const leaveAPI = {
  apply: (data) => {
    const role = getRole();
    const payload = toLeavePayload(data);
    if (!payload.reason) {
      throw new Error('Reason is required for leave application.');
    }

    if (role === 'manager') {
      return apiClient.post('/manager/leaves', payload).then((response) => normalizeResponse(response));
    }
    if (role === 'hr' || role === 'admin') {
      return apiClient.post('/hr/my/leaves', payload).then((response) => normalizeResponse(response));
    }
    return apiClient.post('/employee/leaves', payload).then((response) => normalizeResponse(response));
  },

  getEmployeeLeaves: async (employeeId, params = {}) => {
    const role = getRole();
    const currentUserId = getCurrentUserId();

    let response;
    if (role === 'manager') {
      response = await apiClient.get('/manager/leaves', { params });
    } else if ((role === 'hr' || role === 'admin') && employeeId && employeeId !== currentUserId) {
      response = await apiClient.get('/hr/leaves', { params: { ...params, employeeId } });
    } else if (role === 'hr' || role === 'admin') {
      response = await apiClient.get('/hr/my/leaves', { params });
    } else {
      response = await apiClient.get('/employee/leaves', { params });
    }

    const payload = unwrapData(response);
    const list = extractList(payload).map(normalizeLeave);
    const pagination = payload?.pagination || null;

    return {
      ...response,
      data: list,
      pagination,
    };
  },

  getPendingApprovals: async (params = {}) => {
    const role = getRole();

    let response;
    if (role === 'manager') {
      response = await apiClient.get('/manager/team/leaves/pending');
    } else if (role === 'hr' || role === 'admin') {
      response = await apiClient.get('/hr/leaves', { params: { status: 'pending', ...params } });
    } else {
      return { data: [] };
    }

    const payload = unwrapData(response);
    const list = extractList(payload).map(normalizeLeave);
    return {
      ...response,
      data: list,
      pagination: payload?.pagination || null,
    };
  },

  getSummary: async (employeeId, params = {}) => {
    const role = getRole();
    const currentUserId = getCurrentUserId();

    let response;
    if (role === 'manager') {
      response = await apiClient.get('/manager/leaves/summary', { params });
    } else if ((role === 'hr' || role === 'admin') && employeeId && employeeId !== currentUserId) {
      response = await apiClient.get(`/hr/leaves/${employeeId}/summary`, { params });
    } else if (role === 'hr' || role === 'admin') {
      response = await apiClient.get('/hr/my/leaves/summary', { params });
    } else {
      response = await apiClient.get('/employee/leaves/summary', { params });
    }

    return normalizeResponse(response);
  },

  getBalance: async (employeeId, params = {}) => {
    const role = getRole();
    const currentUserId = getCurrentUserId();

    let response;
    if (role === 'manager') {
      response = await apiClient.get('/manager/leave-balance', { params });
    } else if ((role === 'hr' || role === 'admin') && employeeId && employeeId !== currentUserId) {
      response = await apiClient.get(`/hr/leaves/${employeeId}/balance`, { params });
    } else if (role === 'hr' || role === 'admin') {
      response = await apiClient.get('/hr/my/leave-balance', { params });
    } else {
      response = await apiClient.get('/employee/leave-balance', { params });
    }

    return normalizeResponse(response);
  },

  approve: (leaveId, reason) => {
    const role = getRole();
    if (role === 'manager') {
      return apiClient.patch(`/manager/team/leaves/${leaveId}/approve`, reason ? { note: reason } : {});
    }
    return apiClient.patch(`/hr/leaves/${leaveId}/approve`, reason ? { reason } : {});
  },

  reject: (leaveId, reason) => {
    const role = getRole();
    if (role === 'manager') {
      return apiClient.patch(`/manager/team/leaves/${leaveId}/reject`, { reason });
    }
    return apiClient.patch(`/hr/leaves/${leaveId}/reject`, { reason });
  },

  cancel: (leaveId, reason) => {
    const role = getRole();
    if (role === 'manager') {
      return apiClient.delete(`/manager/leaves/${leaveId}`);
    }
    if (role === 'hr' || role === 'admin') {
      return apiClient.delete(`/hr/my/leaves/${leaveId}`, reason ? { data: { reason } } : undefined);
    }
    return apiClient.delete(`/employee/leaves/${leaveId}`);
  },

  cancelManagedLeave: (leaveId, reason) =>
    apiClient.delete(`/hr/leaves/${leaveId}`, reason ? { data: { reason } } : undefined),

  adjustBalance: (employeeId, data) =>
    apiClient.patch(`/hr/leaves/${employeeId}/balance`, data),

  getEmployeeBalance: (employeeId, params = {}) =>
    apiClient.get(`/hr/leaves/${employeeId}/balance`, { params }).then((response) => normalizeResponse(response)),

  getEmployeeSummary: (employeeId, params = {}) =>
    apiClient.get(`/hr/leaves/${employeeId}/summary`, { params }).then((response) => normalizeResponse(response)),

  getAccrualConfig: (params = {}) =>
    apiClient.get('/hr/leaves/config', { params }).then((response) => normalizeResponse(response)),

  updateAccrualConfig: (payload) =>
    apiClient.put('/hr/leaves/config', payload).then((response) => normalizeResponse(response)),
};
