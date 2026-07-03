import apiClient from './axios';
import { useAuthStore } from '../store/authStore';
import { managerAPI } from './manager';
import { employeeSelfAPI } from './employee';

const HR_BASE = '/hr/attendance';
const REGULARIZATION_ENDPOINTS = {
  employeeList: '/employee/attendance/regularizations',
  employeeCreate: '/employee/attendance/regularizations',
  managerList: '/manager/team/attendance/regularizations',
  managerApprove: (requestId) => `/manager/team/attendance/regularizations/${requestId}/approve`,
  managerReject: (requestId) => `/manager/team/attendance/regularizations/${requestId}/reject`,
  hrList: '/hr/attendance/regularizations',
  hrApprove: (requestId) => `/hr/attendance/regularizations/${requestId}/approve`,
  hrReject: (requestId) => `/hr/attendance/regularizations/${requestId}/reject`,
};

function mapRegularizationRouteError(error, endpoint) {
  if (String(error?.code || '').toUpperCase() !== 'NOT_FOUND') {
    return error;
  }

  return {
    ...error,
    message: error?.message || `Regularization route not found: ${endpoint}`,
    detail: `Backend is missing regularization route ${endpoint}. Verify API registration under /api/v1.`,
  };
}

function getRoleName() {
  const rawRole = useAuthStore.getState().user?.role?.name || useAuthStore.getState().user?.role || '';
  return String(rawRole || '').toLowerCase();
}

function normalizeRegularizationItem(item = {}) {
  const nestedEmployee = item.employee || {};
  const firstName =
    item.employeeFirstName ||
    item['employee.firstName'] ||
    nestedEmployee.firstName ||
    item.firstName ||
    null;
  const lastName =
    item.employeeLastName ||
    item['employee.lastName'] ||
    nestedEmployee.lastName ||
    item.lastName ||
    null;
  const employeeName =
    item.employeeName ||
    item.name ||
    nestedEmployee.name ||
    nestedEmployee.fullName ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    'Employee';
  const employeeCode =
    item.employeeCode ||
    item['employee.employeeCode'] ||
    item['employee.employeeId'] ||
    nestedEmployee.employeeCode ||
    nestedEmployee.employeeId ||
    null;
  const employeeAvatarUrl =
    item.employeeAvatarUrl ||
    item['employee.avatarUrl'] ||
    item.avatarUrl ||
    nestedEmployee.avatarUrl ||
    null;

  return {
    ...item,
    employeeId: item.employeeId || item['employee.id'] || nestedEmployee.id || null,
    employeeCode,
    employeeFirstName: firstName,
    employeeLastName: lastName,
    employeeName,
    name: employeeName,
    appliedAt: item.appliedAt || item.requestedAt || item.createdAt || null,
    employee: {
      ...nestedEmployee,
      id: nestedEmployee.id || item.employeeId || item['employee.id'] || null,
      firstName: nestedEmployee.firstName || firstName,
      lastName: nestedEmployee.lastName || lastName,
      employeeCode: nestedEmployee.employeeCode || nestedEmployee.employeeId || employeeCode,
      name: nestedEmployee.name || employeeName,
      fullName: nestedEmployee.fullName || employeeName,
      avatarUrl: nestedEmployee.avatarUrl || employeeAvatarUrl,
    },
  };
}

export const attendanceAPI = {
  getTodayStatus: async () => {
    const role = useAuthStore.getState().user?.role;
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    let rawData;
    if (role === 'manager') {
      const response = await managerAPI.getMyAttendance({ month, year });
      rawData = response?.data;
    } else if (role === 'employee' || role === 'hr' || role === 'admin') {
      // HR and Admin use employee self-service endpoint for their own attendance
      const response = await employeeSelfAPI.getMyAttendance({ month, year });
      rawData = response?.data;
    } else {
      return apiClient.get('/attendance/today');
    }

    const data = rawData?.data || rawData || {};
    const records = data.attendance || data.items || (Array.isArray(data) ? data : []);

    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
    const todayRecord = Array.isArray(records) ? records.find((r) => String(r.date || '').startsWith(today)) : null;

    const checkInTime = todayRecord?.checkInTime || todayRecord?.checkIn || todayRecord?.check_in_time || null;
    const checkOutTime = todayRecord?.checkOutTime || todayRecord?.checkOut || todayRecord?.check_out_time || null;
    const checkInTimeDisplay = todayRecord?.checkInTimeDisplay || todayRecord?.checkInDisplay || null;
    const checkOutTimeDisplay = todayRecord?.checkOutTimeDisplay || todayRecord?.checkOutDisplay || null;

    // Determine current clocked-in state from today's logs
    // isCurrentlyIn = last log entry is a clock_in (not clock_out)
    let isCurrentlyIn = Boolean(checkInTime) && !Boolean(checkOutTime);
    try {
      const logsResponse = await attendanceAPI.getTodayClockLogs();
      const logs = logsResponse?.data?.data?.logs || logsResponse?.data?.logs || [];
      if (logs.length > 0) {
        const lastLog = logs[logs.length - 1];
        isCurrentlyIn = lastLog.type === 'clock_in';
      }
      return {
        success: true,
        data: {
          hasCheckedIn: Boolean(checkInTime) || logs.some(l => l.type === 'clock_in'),
          hasCheckedOut: !isCurrentlyIn && logs.some(l => l.type === 'clock_out'),
          isCurrentlyIn,
          checkInTime,
          checkOutTime,
          checkInTimeDisplay,
          checkOutTimeDisplay,
          status: todayRecord?.status || null,
          logs,
        }
      };
    } catch {
      // fallback when logs endpoint not available (e.g., legacy backend)
    }

    return {
      success: true,
      data: {
        hasCheckedIn: Boolean(checkInTime),
        hasCheckedOut: Boolean(checkOutTime),
        isCurrentlyIn: Boolean(checkInTime) && !Boolean(checkOutTime),
        checkInTime,
        checkOutTime,
        checkInTimeDisplay,
        checkOutTimeDisplay,
        status: todayRecord?.status || null,
        logs: [],
      }
    };
  },

  getTodayClockLogs: async () => {
    const role = useAuthStore.getState().user?.role?.name || useAuthStore.getState().user?.role;
    if (role === 'manager') {
      return apiClient.get('/manager/attendance/today-logs');
    }
    if (role === 'hr' || role === 'admin') {
      return apiClient.get('/employee/attendance/today-logs');
    }
    return apiClient.get('/employee/attendance/today-logs');
  },

  getAttendanceClockLogs: async (attendanceId) => {
    return apiClient.get(`/employee/attendance/${attendanceId}/logs`);
  },

  checkIn: (coords) => {
    const role = useAuthStore.getState().user?.role?.name || useAuthStore.getState().user?.role;
    const payload = coords ? { ...coords } : {};
    // Send browser timezone offset so backend records accurate local time
    payload.timezoneOffset = new Date().getTimezoneOffset();
    payload.clientTime = new Date().toISOString();
    // HR and Admin use employee self-service endpoint for clock in/out
    if (role === 'employee' || role === 'hr' || role === 'admin') {
      return apiClient.post('/employee/attendance/check-in', payload);
    }
    if (role === 'manager') {
      return apiClient.post('/manager/attendance/check-in', payload);
    }
    return apiClient.post('/attendance/check-in', payload);
  },

  checkOut: (coords) => {
    const role = useAuthStore.getState().user?.role?.name || useAuthStore.getState().user?.role;
    const payload = coords ? { ...coords } : {};
    // Send browser timezone offset so backend records accurate local time
    payload.timezoneOffset = new Date().getTimezoneOffset();
    payload.clientTime = new Date().toISOString();
    // HR and Admin use employee self-service endpoint for clock in/out
    if (role === 'employee' || role === 'hr' || role === 'admin') {
      return apiClient.post('/employee/attendance/check-out', payload);
    }
    if (role === 'manager') {
      return apiClient.post('/manager/attendance/check-out', payload);
    }
    return apiClient.post('/attendance/check-out', payload);
  },

  getEmployeeAttendance: async (employeeId, params) => {
    const role = useAuthStore.getState().user?.role;
    const currentUserId = useAuthStore.getState().user?.id;
    let response;

    if (role === 'manager') {
      response = await managerAPI.getMyAttendance(params);
    } else if (role === 'employee' || (role === 'hr' && employeeId === currentUserId) || (role === 'admin' && employeeId === currentUserId)) {
      // HR and Admin use employee self-service endpoint for their own attendance
      response = await employeeSelfAPI.getMyAttendance(params);
    } else {
      // HR viewing other employees' attendance or admin viewing any employee
      response = await apiClient.get(`${HR_BASE}/${employeeId}`, { params });
    }

    const body = response?.data || {};
    const data = body?.data || body || {};
    const list = data?.attendance || data?.items || data?.records || (Array.isArray(data) ? data : []);

    const normalized = Array.isArray(list) ? list.map(item => ({
      ...item,
      date: item.date ? String(item.date).split('T')[0] : null,
      checkIn: item.checkIn || item.checkInTime || item.check_in_time || null,
      checkOut: item.checkOut || item.checkOutTime || item.check_out_time || null,
      checkInDisplay: item.checkInTimeDisplay || item.checkInDisplay || null,
      checkOutDisplay: item.checkOutTimeDisplay || item.checkOutDisplay || null,
      workHours: item.workHours ?? item.work_hours ?? null,
      status: item.status
        ? (String(item.status).includes('_')
          ? String(item.status).split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
          : item.status.charAt(0).toUpperCase() + item.status.slice(1))
        : 'Absent'
    })) : [];

    // Extract cards data and map to summary format
    const cards = data?.cards || body?.cards || {};
    const summary = data?.summary || body?.summary || {};

    // Merge cards data into summary with proper mapping
    const mappedSummary = {
      total: cards.totalDays ?? summary.total ?? 0,
      present: cards.daysPresent ?? summary.present ?? 0,
      incomplete: cards.incomplete ?? summary.incomplete ?? 0,
      attendanceRate: cards.attendanceRate ?? summary.attendanceRate ?? 0,
      ...summary // Keep any other summary properties
    };

    return {
      ...response,
      data: normalized,
      summary: mappedSummary,
    };
  },

  getTeamAttendance: async (managerId, params) => {
    const role = useAuthStore.getState().user?.role;
    if (role === 'manager') {
      const response = await managerAPI.getTeamAttendance(params);
      const body = response?.data || {};
      const data = body?.data || body || {};
      const list = data?.attendance || data?.items || (Array.isArray(data) ? data : []);
      const normalized = Array.isArray(list)
        ? list.map((item) => {
          const empName = item.employee?.name ||
            (item['employee.firstName'] ? [item['employee.firstName'], item['employee.lastName']].filter(Boolean).join(' ') : null) ||
            (item.employeeFirstName ? [item.employeeFirstName, item.employeeLastName].filter(Boolean).join(' ') : null) ||
            item.employeeName || item.name || [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Unknown Employee';

          return {
            ...item,
            date: item.date ? String(item.date).split('T')[0] : item.date,
            employee: {
              ...(item.employee || {}),
              id: item['employee.id'] || item.employeeId || item.employee?.id || item.id,
              name: empName,
              employeeCode: item['employee.employeeId'] || item.employeeCode || item.employee?.employeeCode || 'N/A',
              designation: item['employee.designation'] || item.designation || item.employee?.designation || '',
              department: item['employee.department'] || item.department || item.employee?.department || '',
            },
            checkIn: item.checkIn || item.checkInTime || item.check_in_time || item.check_in || null,
            checkOut: item.checkOut || item.checkOutTime || item.check_out_time || item.check_out || null,
            checkInDisplay: item.checkInTimeDisplay || item.checkInDisplay || null,
            checkOutDisplay: item.checkOutTimeDisplay || item.checkOutDisplay || null,
            status: item.status
              ? (String(item.status).includes('_')
                ? String(item.status).split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                : item.status.charAt(0).toUpperCase() + item.status.slice(1))
              : 'Absent'
          };
        })
        : [];

      // Extract cards data for summary if needed in future
      const cards = data?.cards || body?.cards || {};
      const summary = {
        total: cards.totalDays ?? data.total ?? 0,
        present: cards.daysPresent ?? data.present ?? 0,
        incomplete: cards.incomplete ?? 0,
        absent: cards.absent ?? 0,
        attendanceRate: cards.attendanceRate ?? data.attendanceRate ?? 0
      };

      return { ...response, data: normalized, summary };
    }

    // HR viewing all employees' attendance
    if (role === 'hr' || role === 'admin') {
      // Convert date parameter to fromDate/toDate for HR endpoint
      const hrParams = { ...params };
      if (params.date && !params.fromDate && !params.toDate) {
        hrParams.fromDate = params.date;
        hrParams.toDate = params.date;
        delete hrParams.date;
      }

      const response = await apiClient.get(`${HR_BASE}`, { params: hrParams });
      const body = response?.data || {};
      const data = body?.data || body || {};
      const list = data?.items || data?.attendance || (Array.isArray(data) ? data : []);

      const normalized = Array.isArray(list)
        ? list.map((item) => {
          const empName = item.employee?.name ||
            (item['employee.firstName'] ? [item['employee.firstName'], item['employee.lastName']].filter(Boolean).join(' ') : null) ||
            (item.employeeFirstName ? [item.employeeFirstName, item.employeeLastName].filter(Boolean).join(' ') : null) ||
            item.employeeName || item.name || [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Unknown Employee';

          return {
            ...item,
            date: item.date ? String(item.date).split('T')[0] : item.date,
            employee: {
              ...(item.employee || {}),
              id: item['employee.id'] || item.employeeId || item.employee?.id || item.id,
              name: empName,
              employeeCode: item['employee.employeeId'] || item.employeeCode || item.employee?.employeeCode || 'N/A',
              designation: item['employee.designation'] || item.designation || item.employee?.designation || '',
              department: item['employee.department'] || item.department || item.employee?.department || '',
            },
            checkIn: item.checkIn || item.checkInTime || item.check_in_time || item.check_in || null,
            checkOut: item.checkOut || item.checkOutTime || item.check_out_time || item.check_out || null,
            checkInDisplay: item.checkInTimeDisplay || item.checkInDisplay || null,
            checkOutDisplay: item.checkOutTimeDisplay || item.checkOutDisplay || null,
            status: item.status
              ? (String(item.status).includes('_')
                ? String(item.status).split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                : item.status.charAt(0).toUpperCase() + item.status.slice(1))
              : 'Absent'
          };
        })
        : [];

      // Extract cards data for summary
      const cards = data?.cards || body?.cards || {};
      const summary = {
        total: cards.totalDays ?? data.total ?? normalized.length ?? 0,
        present: cards.daysPresent ?? data.present ?? normalized.filter(a => ['Present', 'Checked In'].includes(a.status)).length ?? 0,
        incomplete: cards.incomplete ?? data.incomplete ?? normalized.filter(a => a.status === 'Incomplete').length ?? 0,
        absent: cards.absent ?? data.absent ?? normalized.filter(a => a.status === 'Absent').length ?? 0,
        attendanceRate: cards.attendanceRate ?? data.attendanceRate ?? 0
      };

      return {
        ...response,
        data: normalized,
        summary
      };
    }

    // Fallback for other roles
    const response = await apiClient.get(`${HR_BASE}`, {
      params: { ...params, managerEmployeeId: managerId },
    });
    const body = response?.data || {};
    const data = body?.data || body || {};
    const list = data?.attendance || data?.items || (Array.isArray(data) ? data : []);

    return {
      ...response,
      data: list,
    };
  },

  getByDate: (date, params) =>
    apiClient.get(`/attendance/date/${date}`, { params }),

  correct: (id, data) =>
    apiClient.patch(`/attendance/${id}/correct`, data),

  addManual: (data) => apiClient.post(`${HR_BASE}/manual`, data),

  export: (params) => {
    const role = getRoleName();
    if (role === 'manager') {
      // Manager team attendance supports CSV export via format=csv on the same endpoint
      return apiClient.get('/manager/team/attendance', {
        params: { ...params, format: 'csv' },
        responseType: 'blob',
      });
    }
    return apiClient.get(`${HR_BASE}/export`, { params, responseType: 'blob' });
  },

  createRegularization: async (payload) => {
    try {
      return await apiClient.post(REGULARIZATION_ENDPOINTS.employeeCreate, payload);
    } catch (error) {
      return Promise.reject(mapRegularizationRouteError(error, REGULARIZATION_ENDPOINTS.employeeCreate));
    }
  },

  getMyRegularizations: async (params = {}) => {
    let response;
    try {
      response = await apiClient.get(REGULARIZATION_ENDPOINTS.employeeList, { params });
    } catch (error) {
      return Promise.reject(mapRegularizationRouteError(error, REGULARIZATION_ENDPOINTS.employeeList));
    }
    const body = response?.data || {};
    const data = body?.data || body || {};
    const items = Array.isArray(data?.items) ? data.items : [];

    return {
      ...response,
      data: {
        ...data,
        items,
      }
    };
  },

  getPendingRegularizations: async (params = {}) => {
    const role = getRoleName();
    const query = { page: 1, limit: 20, ...params };
    let response;

    if (role === 'manager') {
      try {
        response = await apiClient.get(REGULARIZATION_ENDPOINTS.managerList, { params: query });
      } catch (error) {
        return Promise.reject(mapRegularizationRouteError(error, REGULARIZATION_ENDPOINTS.managerList));
      }
    } else if (role === 'hr' || role === 'admin') {
      try {
        response = await apiClient.get(REGULARIZATION_ENDPOINTS.hrList, { params: query });
      } catch (error) {
        return Promise.reject(mapRegularizationRouteError(error, REGULARIZATION_ENDPOINTS.hrList));
      }
    } else {
      return { data: { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } };
    }

    const body = response?.data || {};
    const data = body?.data || body || {};
    const items = Array.isArray(data?.items) ? data.items.map((item) => normalizeRegularizationItem(item)) : [];
    const pagination = data?.pagination || { page: 1, limit: 20, total: items.length, totalPages: 1 };

    return {
      ...response,
      data: {
        ...data,
        items,
        pagination,
      }
    };
  },

  approveRegularization: (requestId, payload = {}) => {
    const role = getRoleName();
    if (role === 'manager') {
      return apiClient.patch(REGULARIZATION_ENDPOINTS.managerApprove(requestId), payload);
    }
    return apiClient.patch(REGULARIZATION_ENDPOINTS.hrApprove(requestId), payload);
  },

  rejectRegularization: (requestId, payload = {}) => {
    const role = getRoleName();
    if (role === 'manager') {
      return apiClient.patch(REGULARIZATION_ENDPOINTS.managerReject(requestId), payload);
    }
    return apiClient.patch(REGULARIZATION_ENDPOINTS.hrReject(requestId), payload);
  }
};
