import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '@/lib/baseQuery';

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string | null;
  isActive: boolean;
  isVerified: boolean;
  designation?: string;
  department?: string;
  pmtRole?: { id: string; displayName: string } | null;
  roleName?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateUserStatusRequest {
  userId: string;
  isActive: boolean;
}

export interface UpdateUserRequest {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  isVerified?: boolean;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  timezone?: string | null;
  locale?: string | null;
  isVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: authBaseQuery,
  tagTypes: ['User'],
  endpoints: (builder) => ({
    getUsers: builder.query<UserListResponse, { page?: number; limit?: number; search?: string; scope?: 'pmt' | 'hrms' }>({
      query: (params) => ({
        url: '/users',
        params: { scope: 'pmt', ...params },
      }),
      transformResponse: (response: { success: boolean; data: UserListResponse }) => response.data,
      providesTags: ['User'],
    }),
    updateUserStatus: builder.mutation<UserListItem, UpdateUserStatusRequest>({
      query: ({ userId, isActive }) => ({
        url: `/users/${userId}/status`,
        method: 'PATCH',
        body: { isActive },
      }),
      transformResponse: (response: { success: boolean; data: UserListItem }) => response.data,
      invalidatesTags: ['User'],
    }),
    updateUser: builder.mutation<UserListItem, UpdateUserRequest>({
      query: ({ userId, ...body }) => ({
        url: `/users/${userId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: { success: boolean; data: UserListItem }) => response.data,
      invalidatesTags: ['User'],
    }),
    uploadAvatar: builder.mutation<UserProfileResponse, FormData>({
      query: (formData) => ({
        url: '/users/me/avatar/upload',
        method: 'POST',
        body: formData,
      }),
      transformResponse: (response: { success: boolean; data: UserProfileResponse }) => response.data,
    }),
  }),
});

export const {
  useGetUsersQuery,
  useUpdateUserStatusMutation,
  useUpdateUserMutation,
  useUploadAvatarMutation,
} = usersApi;
