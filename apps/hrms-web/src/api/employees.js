import apiClient from './axios';
import { useAuthStore } from '../store/authStore';
import { managerAPI } from './manager';
import { employeeSelfAPI } from './employee';
import { toTitleCase } from '../utils/name';

const HR_BASE = '/hr';

const toApiRole = (role) => {
  if (!role) return 'employee';
  const value = String(role).toLowerCase();
  if (value.includes('manager')) return 'manager';
  if (value.includes('hr') || value.includes('admin')) return 'hr';
  return 'employee';
};

const toApiStatus = (status) => {
  if (!status) return undefined;
  const value = String(status).toLowerCase();
  if (value === 'notice period') return 'notice_period';
  return value;
};

const splitName = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: toTitleCase(parts[0] || ''),
    lastName: toTitleCase(parts.slice(1).join(' ') || ''),
  };
};

const normalizeEmployee = (record = {}) => {
  const managerName = record.manager?.name ||
    (record.manager?.firstName ? [record.manager.firstName, record.manager.lastName].filter(Boolean).join(' ') : null) ||
    (record['manager.firstName'] ? [record['manager.firstName'], record['manager.lastName']].filter(Boolean).join(' ') : null);

  const manager = managerName ? {
    ...(record.manager || {}),
    name: managerName,
    id: record['manager.id'] || record.manager?.id,
    employeeId: record['manager.employeeId'] || record.manager?.employeeId,
    designation: record['manager.designation'] || record.manager?.designation,
    avatarUrl: record['manager.avatarUrl'] || record.manager?.avatarUrl || null
  } : record.manager;

  return {
    ...record,
    name: record.name || [record.firstName, record.lastName].filter(Boolean).join(' '),
    employeeCode: record.employeeCode || record.employee_id || record.employeeId,
    avatarUrl: record.avatarUrl || record['user.avatarUrl'] || record.avatar || null,
    // workEmail = employees.email is the work email; show it directly
    workEmail: record.workEmail || record.email || null,
    workMode: record.workMode || null,
    workLocation: record.workLocation || null,
    country: record.country || null,
    manager
  };
};

export const employeeAPI = {
  getAll: async (params = {}) => {
    const role = useAuthStore.getState().user?.role;
    if (role === 'manager') {
      const response = await managerAPI.getTeamEmployees();
      const body = response?.data || {};
      const data = body?.data ?? body;
      const raw =
        data?.items ||
        data?.employees ||
        (Array.isArray(data) ? data : (Array.isArray(body) ? body : []));
      const normalized = Array.isArray(raw) ? raw.map(normalizeEmployee) : [];
      const search = String(params.search || '').trim().toLowerCase();
      const requestedStatus = params.status ? toApiStatus(params.status) : '';
      const requestedRole = (params.userRole || params.role)
        ? toApiRole(params.userRole || params.role)
        : '';
      const requestedDepartment = String(params.department || '').trim().toLowerCase();

      const filtered = normalized.filter((item) => {
        if (search) {
          const haystack = `${item.name || ''} ${item.email || ''} ${item.employeeCode || ''}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }

        if (requestedStatus) {
          const itemStatus = toApiStatus(item.status || '');
          if (itemStatus !== requestedStatus) return false;
        }

        if (requestedRole) {
          const itemRole = toApiRole(item.role || item.userRole || 'employee');
          if (itemRole !== requestedRole) return false;
        }

        if (requestedDepartment) {
          const itemDepartment = String(item.department || '').trim().toLowerCase();
          if (itemDepartment !== requestedDepartment) return false;
        }

        return true;
      });

      const page = Number(params.page || 1);
      const limit = Number(params.limit || 20);
      const start = (page - 1) * limit;
      const items = filtered.slice(start, start + limit);
      return {
        ...response,
        data: items,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit) || 1,
        }
      };
    }

    // Build query, only including non-empty values
    const query = {
      page: params.page || 1,
      limit: params.limit ? Math.min(Number(params.limit), 100) : (params.limit || 20),
    };

    // Only add role if it has a value
    if (params.userRole || params.role) {
      query.role = params.userRole ? toApiRole(params.userRole) : toApiRole(params.role);
    }

    // Only add status if it has a value
    if (params.status) {
      const normalizedStatus = toApiStatus(params.status);
      if (normalizedStatus) {
        query.status = normalizedStatus;
      }
    }

    // Only add search if it has a value
    if (params.search && String(params.search).trim()) {
      query.search = String(params.search).trim();
    }

    // Add department filter
    if (params.department) {
      query.department = params.department;
    }

    // Add branch filter (admin only — server enforces this for HR)
    if (params.branchId) {
      query.branchId = params.branchId;
    }

    const response = await apiClient.get(`${HR_BASE}/employees`, { params: query });

    // Handle response structure { success: true, data: { employees: [], pagination: {} } }
    const body = response?.data || {};
    const data = body?.data || body || {};
    const list = data?.employees || data?.items || (Array.isArray(data) ? data : []);
    const pagination = data?.pagination || body?.pagination || {};

    return {
      ...response,
      data: Array.isArray(list) ? list.map(normalizeEmployee) : [],
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 20,
        total: pagination.total || 0,
        totalPages: pagination.totalPages || 1
      },
    };
  },

  getById: async (id) => {
    const role = useAuthStore.getState().user?.role;
    let response;
    if (role === 'manager') {
      const currentUser = useAuthStore.getState().user;
      const ownCodes = [currentUser?.employeeId, currentUser?.employeeCode, currentUser?.id].filter(Boolean);
      const isOwnProfile = ownCodes.some(code => String(code) === String(id));
      if (isOwnProfile) {
        response = await apiClient.get(`/manager/me/profile`);
      } else {
        try {
          response = await apiClient.get(`/manager/team/employees/${id}`);
        } catch (err) {
          // If the ID is not a valid UUID (e.g. employee code), fall back to own profile
          const status = err?.response?.status;
          if (status === 404 || status === 400 || status === 500) {
            response = await apiClient.get(`/manager/me/profile`);
          } else {
            throw err;
          }
        }
      }
    } else {
      response = await apiClient.get(`${HR_BASE}/employees/${id}`);
    }
    const data = response?.data?.data || response?.data || {};

    // Flatten nested structure (personal, employment) for UI consumption
    const flatData = {
      ...data,
      ...(data.personal || {}),
      ...(data.employment || {}),
      // Map location to workLocation for UI compatibility
      workLocation: data.employment?.location || data.workLocation,
      // Ensure specific fields key overrides if necessary
      managerId: data.employment?.manager?.id || data.managerId || data['manager.id'] || null,
      managerName: data.employment?.manager?.name || (data['manager.firstName'] ? [data['manager.firstName'], data['manager.lastName']].filter(Boolean).join(' ') : null),
    };

    return {
      ...response,
      data: normalizeEmployee(flatData),
    };
  },

  create: async (data) => {
    const role = toApiRole(data?.userRole || data?.role);
    const { firstName, lastName } = splitName(data?.name);
    const payload = {
      firstName: toTitleCase(data?.firstName || firstName),
      lastName: toTitleCase(data?.lastName || lastName),
      email: data?.email,
      phone: data?.phone,
      dateOfBirth: data?.dateOfBirth,
      joiningDate: data?.joiningDate,
      designation: data?.designation,
      department: data?.department,
      workMode: data?.workMode || null,
      workLocation: data?.workLocation || null,
      country: data?.country || null,
      branchId: data?.branchId || null,
      managerEmployeeId: data?.managerEmployeeId || data?.managerId || undefined,
      status: toApiStatus(data?.status || 'onboarding'),
      temporaryPassword: data?.temporaryPassword || data?.password || undefined,
    };

    if (role === 'manager') {
      return apiClient.post(`${HR_BASE}/employees/managers`, payload);
    }
    return apiClient.post(`${HR_BASE}/employees`, payload);
  },

  update: (id, data) => apiClient.patch(`${HR_BASE}/employees/${id}`, data),

  delete: (id) => apiClient.delete(`${HR_BASE}/employees/${id}`),

  hardDelete: (id) => apiClient.delete(`${HR_BASE}/employees/${id}/purge`),

  getHierarchy: async (branchId = null) => {
    const role = useAuthStore.getState().user?.role;

    let response;
    if (['hr', 'admin'].includes(role)) {
      const params = branchId ? { branchId } : {};
      response = await apiClient.get(`${HR_BASE}/org-hierarchy`, { params });
    } else if (role === 'manager') {
      response = await managerAPI.getOrgHierarchy();
    } else {
      response = await employeeSelfAPI.getOrgHierarchy();
    }

    const body = response?.data || {};
    // Handle both { tree: [...] } and { data: [...] } or direct array structure
    const data = body?.data || body || {};
    const tree =
      data?.tree ||
      data?.orgHierarchy ||
      data?.items ||
      body?.tree ||
      body?.orgHierarchy ||
      body?.items ||
      (Array.isArray(data) ? data : (Array.isArray(body) ? body : []));
    return { ...response, data: Array.isArray(tree) ? tree : [] };
  },

  getDepartments: async () => {
    const response = await apiClient.get(`${HR_BASE}/employees`, { params: { page: 1, limit: 100 } });
    const body = response?.data || {};
    const data = body?.data || body || {};
    const records = data?.employees || data?.items || (Array.isArray(data) ? data : []);
    const departments = [...new Set(records.map((x) => x.department).filter(Boolean))].map((department) => ({ department }));
    return { ...response, data: departments };
  },

  getTeam: async (managerId) => {
    const response = await apiClient.get(`${HR_BASE}/org-hierarchy/team/${managerId}`);
    const team = response?.data?.directReports || response?.data?.team || [];
    return { ...response, data: Array.isArray(team) ? team.map(normalizeEmployee) : [] };
  },

  getBranches: async () => {
    const role = useAuthStore.getState().user?.role;
    // Admin users call the admin endpoint; HR users call the HR endpoint
    if (role === 'hr') {
      const response = await apiClient.get(`${HR_BASE}/branches`);
      const body = response?.data || {};
      const data = body?.data ?? body;
      return { ...response, data: Array.isArray(data) ? data : [] };
    }
    // Admin / fallback — use admin endpoint
    const response = await apiClient.get('/admin/branches');
    const body = response?.data || {};
    const data = body?.data ?? body;
    return { ...response, data: Array.isArray(data) ? data : [] };
  },

  getActiveManagers: async () => {
    const response = await apiClient.get(`${HR_BASE}/managers/active`);
    const body = response?.data || {};
    const list = body?.data || body || [];
    return { ...response, data: Array.isArray(list) ? list.map(normalizeEmployee) : [] };
  },

  assignManager: (employeeId, managerEmployeeId) =>
    apiClient.patch(`${HR_BASE}/employees/${employeeId}/manager`, { managerEmployeeId }),

  changeRole: (employeeId, role) =>
    apiClient.patch(`${HR_BASE}/employees/${employeeId}/role`, { role: toApiRole(role) }),
};
