import { createApi } from '@reduxjs/toolkit/query/react';
import { authBaseQuery } from '@/lib/baseQuery';
import { User, UpdateProfileRequest } from './types';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: authBaseQuery,
  tagTypes: ['User'],
  endpoints: (builder) => ({
    // Local email/password login (AUTH_MODE=jwt).
    login: builder.mutation<
      { success: boolean; data: { user: User; accessToken: string; refreshToken: string } },
      { email: string; password: string; rememberMe?: boolean }
    >({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    getCurrentUser: builder.query<{ success: boolean; data: { user: User } }, void>({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),
    updateProfile: builder.mutation<{ success: boolean; data: { user: User } }, UpdateProfileRequest>({
      query: (body) => ({
        url: '/auth/profile',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const { useLoginMutation, useGetCurrentUserQuery, useUpdateProfileMutation } = authApi;
