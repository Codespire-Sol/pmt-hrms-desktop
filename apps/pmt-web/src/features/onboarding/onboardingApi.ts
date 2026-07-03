import { createApi } from '@reduxjs/toolkit/query/react';
import { createAuthBaseQuery } from '@/lib/baseQuery';
import { OnboardingProgress } from './types';
import { ENV } from '@/lib/env';

const API_VERSION = ENV.API_VERSION;

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const onboardingApi = createApi({
  reducerPath: 'onboardingApi',
  baseQuery: createAuthBaseQuery(`/api/${API_VERSION}/onboarding`),
  tagTypes: ['OnboardingProgress'],
  endpoints: (builder) => ({
    // Get current onboarding progress
    getOnboardingProgress: builder.query<OnboardingProgress, void>({
      query: () => '/progress',
      transformResponse: (response: ApiResponse<{ progress: OnboardingProgress }>) =>
        response.data.progress,
      providesTags: ['OnboardingProgress'],
    }),

    // Start onboarding
    startOnboarding: builder.mutation<OnboardingProgress, void>({
      query: () => ({
        url: '/start',
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<{ progress: OnboardingProgress }>) =>
        response.data.progress,
      invalidatesTags: ['OnboardingProgress'],
    }),

    // Complete a step
    completeStep: builder.mutation<OnboardingProgress, { stepId: string }>({
      query: ({ stepId }) => ({
        url: `/steps/${stepId}/complete`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<{ progress: OnboardingProgress }>) =>
        response.data.progress,
      invalidatesTags: ['OnboardingProgress'],
    }),

    // Skip onboarding
    skipOnboarding: builder.mutation<OnboardingProgress, void>({
      query: () => ({
        url: '/skip',
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<{ progress: OnboardingProgress }>) =>
        response.data.progress,
      invalidatesTags: ['OnboardingProgress'],
    }),

    // Reset onboarding (for testing or re-starting)
    resetOnboarding: builder.mutation<OnboardingProgress, void>({
      query: () => ({
        url: '/reset',
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<{ progress: OnboardingProgress }>) =>
        response.data.progress,
      invalidatesTags: ['OnboardingProgress'],
    }),

    // Mark feature as seen (for feature highlights)
    markFeatureSeen: builder.mutation<void, { featureId: string }>({
      query: ({ featureId }) => ({
        url: `/features/${featureId}/seen`,
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useGetOnboardingProgressQuery,
  useStartOnboardingMutation,
  useCompleteStepMutation,
  useSkipOnboardingMutation,
  useResetOnboardingMutation,
  useMarkFeatureSeenMutation,
} = onboardingApi;
