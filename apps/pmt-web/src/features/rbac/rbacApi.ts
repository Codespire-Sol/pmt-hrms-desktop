import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '../../lib/baseQuery';
import { Role, Permission, UserWithRole, AuditLog, AuditLogFilters } from './types';
import { ENV } from '../../lib/env';

const API_VERSION = ENV.API_VERSION;

const mapRole = (role: any): Role => ({
  id: role.id,
  name: role.name,
  displayName: role.display_name ?? role.displayName ?? role.display_name,
  description: role.description ?? null,
  isSystem: role.is_system ?? role.isSystem ?? false,
  level: role.level ?? 0,
  app: role.app ?? null,
});

// app param for permission-scoped endpoints
type AppScope = 'pmt' | 'hrms' | 'global' | 'all';

const mapPermission = (permission: any): Permission => ({
  id: permission.id,
  name: permission.name,
  displayName: permission.display_name ?? permission.displayName ?? permission.name,
  description: permission.description ?? null,
  resource: permission.resource,
  action: permission.action,
  app: permission.app ?? 'global',
});

const mapUserWithRole = (user: any): UserWithRole => ({
  id: user.id,
  email: user.email,
  displayName: user.display_name ?? user.displayName ?? user.email,
  avatarUrl: user.avatar_url ?? user.avatarUrl ?? null,
  isActive: user.is_active ?? user.isActive ?? false,
  isVerified: user.is_verified ?? user.isVerified ?? undefined,
  createdAt: user.created_at ?? user.createdAt,
  role: user.role ? mapRole(user.role) : null,
});

const mapAuditLog = (log: any): AuditLog => ({
  id: log.id,
  userId: log.user_id ?? log.userId ?? null,
  action: log.action,
  entityType: log.entity_type ?? log.entityType,
  entityId: log.entity_id ?? log.entityId ?? null,
  oldValues: log.old_values ?? log.oldValues ?? null,
  newValues: log.new_values ?? log.newValues ?? null,
  ipAddress: log.ip_address ?? log.ipAddress ?? null,
  metadata: log.metadata ?? {},
  createdAt: log.created_at ?? log.createdAt,
  user: log.user
    ? {
      id: log.user.id,
      displayName: log.user.displayName ?? log.user.display_name ?? log.user.email,
      email: log.user.email,
    }
    : undefined,
});

export const rbacApi = createApi({
  reducerPath: 'rbacApi',
  baseQuery: createAuthBaseQuery(`/api/${API_VERSION}/rbac`),
  tagTypes: ['Role', 'Permission', 'UserRole', 'AuditLog'],
  endpoints: (builder) => ({
    // Current user permissions
    getCurrentUserPermissions: builder.query<
      { success: boolean; data: { role: Role | null; permissions: string[] } },
      { scope?: 'pmt' | 'hrms' } | void
    >({
      query: (params) => ({
        url: '/me/permissions',
        params: params || { scope: 'pmt' },
      }),
      providesTags: ['UserRole'],
      transformResponse: (response: { success: boolean; data: { role: any; permissions: string[] } }) => ({
        ...response,
        data: {
          ...response.data,
          role: response.data.role ? mapRole(response.data.role) : null,
        },
      }),
    }),

    // Current user's global role
    getCurrentUserRole: builder.query<{ success: boolean; data: Role | null }, void>({
      query: () => '/me/role',
      providesTags: ['UserRole'],
      transformResponse: (response: { success: boolean; data: any }) => ({
        ...response,
        data: response.data ? mapRole(response.data) : null,
      }),
    }),

    // Roles
    getRoles: builder.query<{ success: boolean; data: Role[] }, { scope?: 'pmt' | 'hrms' } | void>({
      query: (params) => ({
        url: '/roles',
        params: params || { scope: 'pmt' },
      }),
      providesTags: ['Role'],
      transformResponse: (response: { success: boolean; data: any[] }) => ({
        ...response,
        data: response.data.map(mapRole),
      }),
    }),

    // Global roles (visible in both apps) — used by admin UI
    getGlobalRoles: builder.query<{ success: boolean; data: Role[] }, void>({
      query: () => '/roles/global',
      providesTags: ['Role'],
      transformResponse: (response: { success: boolean; data: any[] }) => ({
        ...response,
        data: response.data.map(mapRole),
      }),
    }),

    getRole: builder.query<{ success: boolean; data: Role }, string>({
      query: (roleId) => `/roles/${roleId}`,
      providesTags: ['Role'],
      transformResponse: (response: { success: boolean; data: any }) => ({
        ...response,
        data: mapRole(response.data),
      }),
    }),

    getRolePermissions: builder.query<
      { success: boolean; data: Permission[] },
      { roleId: string; app?: AppScope }
    >({
      query: ({ roleId, app = 'pmt' }) => ({
        url: `/roles/${roleId}/permissions`,
        params: { app },
      }),
      providesTags: ['Permission'],
      transformResponse: (response: { success: boolean; data: any[] }) => ({
        ...response,
        data: response.data.map(mapPermission),
      }),
    }),

    // Custom Role Management
    createRole: builder.mutation<
      { success: boolean; data: Role; message: string },
      { name: string; displayName: string; description?: string; level?: number }
    >({
      query: (body) => ({
        url: '/roles',
        method: 'POST',
        body: { ...body, app: 'pmt' },
      }),
      invalidatesTags: ['Role', 'AuditLog'],
      transformResponse: (response: { success: boolean; data: any; message: string }) => ({
        ...response,
        data: mapRole(response.data),
      }),
    }),

    updateRole: builder.mutation<
      { success: boolean; data: Role; message: string },
      { roleId: string; displayName?: string; description?: string; level?: number }
    >({
      query: ({ roleId, ...body }) => ({
        url: `/roles/${roleId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Role', 'AuditLog'],
      transformResponse: (response: { success: boolean; data: any; message: string }) => ({
        ...response,
        data: mapRole(response.data),
      }),
    }),

    deleteRole: builder.mutation<{ success: boolean; message: string }, string>({
      query: (roleId) => ({
        url: `/roles/${roleId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Role', 'AuditLog'],
    }),

    setRolePermissions: builder.mutation<
      { success: boolean; message: string },
      { roleId: string; permissionIds: string[] }
    >({
      query: ({ roleId, permissionIds }) => ({
        url: `/roles/${roleId}/permissions`,
        method: 'PUT',
        body: { permissionIds },
      }),
      invalidatesTags: ['Role', 'Permission', 'AuditLog'],
    }),

    addPermissionToRole: builder.mutation<
      { success: boolean; message: string },
      { roleId: string; permissionId: string }
    >({
      query: ({ roleId, permissionId }) => ({
        url: `/roles/${roleId}/permissions/${permissionId}`,
        method: 'POST',
      }),
      invalidatesTags: ['Permission', 'AuditLog'],
    }),

    removePermissionFromRole: builder.mutation<
      { success: boolean; message: string },
      { roleId: string; permissionId: string }
    >({
      query: ({ roleId, permissionId }) => ({
        url: `/roles/${roleId}/permissions/${permissionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Permission', 'AuditLog'],
    }),

    // Permissions — ?app=pmt returns pmt+global permissions only
    getPermissions: builder.query<{ success: boolean; data: Permission[] }, { app?: AppScope } | void>({
      query: (params) => ({
        url: '/permissions',
        params: params || { app: 'pmt' },
      }),
      providesTags: ['Permission'],
      transformResponse: (response: { success: boolean; data: any[] }) => ({
        ...response,
        data: response.data.map(mapPermission),
      }),
    }),

    // User management
    getUsersWithRoles: builder.query<
      {
        success: boolean;
        data: {
          users: UserWithRole[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
      },
      { search?: string; roleId?: string; page?: number; limit?: number; scope?: 'pmt' | 'hrms' }
    >({
      query: (params) => ({
        url: '/users',
        params: { scope: 'pmt', ...params },
      }),
      providesTags: ['UserRole'],
      transformResponse: (response: {
        success: boolean;
        data: {
          users: any[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
      }) => ({
        ...response,
        data: {
          ...response.data,
          users: response.data.users.map(mapUserWithRole),
        },
      }),
    }),

    assignRoleToUser: builder.mutation<
      { success: boolean; message: string },
      { userId: string; roleId: string; scope?: 'pmt' | 'hrms' }
    >({
      query: ({ userId, roleId, scope = 'pmt' }) => ({
        url: `/users/${userId}/role`,
        method: 'POST',
        body: { roleId, scope },
      }),
      invalidatesTags: ['UserRole', 'AuditLog'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // Cross-invalidate financial caches — budget depends on user PMT roles
          const { financialApi } = await import('../financial/financialApi');
          dispatch(financialApi.util.invalidateTags(['Budget', 'CostBreakdown', 'BudgetVsActual', 'BurnoutChart']));
        } catch { /* mutation failed, skip */ }
      },
    }),

    removeRoleFromUser: builder.mutation<
      { success: boolean; message: string },
      { userId: string; scope?: 'pmt' | 'hrms' }
    >({
      query: ({ userId, scope = 'pmt' }) => ({
        url: `/users/${userId}/role`,
        method: 'DELETE',
        params: { scope },
      }),
      invalidatesTags: ['UserRole', 'AuditLog'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          const { financialApi } = await import('../financial/financialApi');
          dispatch(financialApi.util.invalidateTags(['Budget', 'CostBreakdown', 'BudgetVsActual', 'BurnoutChart']));
        } catch { /* mutation failed, skip */ }
      },
    }),

    getUserDirectPermissions: builder.query<{ success: boolean; data: Permission[] }, string>({
      query: (userId) => `/users/${userId}/direct-permissions`,
      providesTags: (_r, _e, userId) => [{ type: 'Permission', id: `direct-${userId}` }],
      transformResponse: (response: { success: boolean; data: any[] }) => ({
        ...response,
        data: response.data.map(mapPermission),
      }),
    }),

    setUserDirectPermissions: builder.mutation<
      { success: boolean; message: string },
      { userId: string; permissionIds: string[] }
    >({
      query: ({ userId, permissionIds }) => ({
        url: `/users/${userId}/direct-permissions`,
        method: 'PUT',
        body: { permissionIds },
      }),
      invalidatesTags: (_r, _e, { userId }) => [{ type: 'Permission', id: `direct-${userId}` }],
    }),

    // Audit logs
    getAuditLogs: builder.query<
      {
        success: boolean;
        data: {
          logs: AuditLog[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
      },
      AuditLogFilters
    >({
      query: (params) => ({
        url: '/audit-logs',
        params,
      }),
      transformResponse: (response: any) => ({
        ...response,
        data: {
          ...response.data,
          logs: response.data.logs.map(mapAuditLog),
        },
      }),
      providesTags: ['AuditLog'],
    }),

    getAuditLogFilters: builder.query<
      { success: boolean; data: { actions: string[]; entityTypes: string[] } },
      { app?: string } | void
    >({
      query: (params) => ({
        url: '/audit-logs/filters',
        params: params || {},
      }),
    }),
  }),
});

export const {
  useGetCurrentUserPermissionsQuery,
  useGetCurrentUserRoleQuery,
  useGetRolesQuery,
  useGetGlobalRolesQuery,
  useGetRoleQuery,
  useGetRolePermissionsQuery,
  useGetPermissionsQuery,
  useGetUsersWithRolesQuery,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useGetAuditLogsQuery,
  useGetAuditLogFiltersQuery,
  // Custom Role Management
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useSetRolePermissionsMutation,
  useAddPermissionToRoleMutation,
  useRemovePermissionFromRoleMutation,
  useGetUserDirectPermissionsQuery,
  useSetUserDirectPermissionsMutation,
} = rbacApi;
