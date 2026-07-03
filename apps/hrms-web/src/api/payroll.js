import apiClient from './axios';
import { useAuthStore } from '../store/authStore';
import { normalizeRoleName } from '../utils/auth';

const HR_BASE = '/hr/payroll';

const unwrapData = (response) => {
  const body = response?.data;
  if (body?.data !== undefined) return body.data;
  return body;
};

const normalizeResponse = (response) => ({
  ...response,
  data: unwrapData(response),
});

const toPayrollRows = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.payrolls)) return payload.payrolls;
  if (payload.id || payload.employeeId || payload.employeeCode || payload.month) return [payload];
  return [];
};

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const payrollAPI = {
  uploadRows: (payload) =>
    apiClient.post(`${HR_BASE}/upload`, payload).then(normalizeResponse),

  uploadCsv: ({ file, month, year }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (month) formData.append('month', String(month));
    if (year) formData.append('year', String(year));
    return apiClient.post(`${HR_BASE}/upload-csv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(normalizeResponse);
  },

  // Backward-compatible upload wrapper
  upload: (payload, month, year) => {
    if (payload instanceof File) {
      return payrollAPI.uploadCsv({ file: payload, month, year });
    }
    if (payload?.file instanceof File) {
      return payrollAPI.uploadCsv(payload);
    }
    return payrollAPI.uploadRows(payload);
  },

  generate: (month, year) =>
    apiClient.post(`${HR_BASE}/generate`, { month, year }).then(normalizeResponse),

  finalize: (month, year) =>
    apiClient.post(`${HR_BASE}/finalize`, { month, year }).then(normalizeResponse),

  getStatus: (params) =>
    apiClient.get(`${HR_BASE}/status`, { params }).then(normalizeResponse),

  getMonthlyPayroll: (year, month) =>
    payrollAPI.getStatus({ month, year }),

  export: async (params) => {
    const response = await apiClient.get(`${HR_BASE}/export`, { params, responseType: 'blob' });
    return response?.data;
  },

  getEmployeePayroll: async (employeeIdOrParams, maybeParams) => {
    const role = normalizeRoleName(useAuthStore.getState().user?.role);
    const params = (maybeParams || (typeof employeeIdOrParams === 'object' ? employeeIdOrParams : {})) || {};

    if (['admin', 'hr'].includes(role)) {
      const response = await apiClient.get(`${HR_BASE}`, { params });
      const payload = unwrapData(response);
      return {
        ...response,
        data: toPayrollRows(payload),
      };
    }

    const response = await apiClient.get('/employee/payroll', { params });
    const payload = unwrapData(response);
    const rows = toPayrollRows(payload);
    return {
      ...response,
      data: rows,
      row: rows[0] || null,
    };
  },

  downloadPayrollExport: async ({ month, year }) => {
    const blob = await payrollAPI.export({ month, year });
    downloadBlob(blob, `payroll-${year}-${month}.csv`);
  },
};
