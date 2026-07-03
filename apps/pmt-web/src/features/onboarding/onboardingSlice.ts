import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OnboardingState, OnboardingProgress } from './types';

/**
 * Onboarding Redux Slice
 *
 * Manages onboarding state including progress tracking
 * and tutorial visibility.
 */

const STORAGE_KEY = 'projectflow_onboarding';

// Load initial state from localStorage
function loadInitialState(): OnboardingState {
  if (typeof window === 'undefined') {
    return getDefaultState();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        isActive: parsed.isActive ?? false,
        progress: parsed.progress ?? getDefaultProgress(),
        showTutorial: parsed.showTutorial ?? true,
      };
    }
  } catch (error) {
    console.error('Failed to load onboarding state:', error);
  }

  return getDefaultState();
}

function getDefaultState(): OnboardingState {
  return {
    isActive: true,
    progress: getDefaultProgress(),
    showTutorial: true,
  };
}

function getDefaultProgress(): OnboardingProgress {
  return {
    currentStep: 0,
    completedSteps: [],
    skipped: false,
    startedAt: new Date().toISOString(),
  };
}

// Persist state to localStorage
function persistState(state: OnboardingState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to persist onboarding state:', error);
  }
}

const initialState: OnboardingState = loadInitialState();

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    // Start onboarding for new users
    startOnboarding(state) {
      state.isActive = true;
      state.progress = getDefaultProgress();
      persistState(state);
    },

    // Complete a specific step
    completeStep(state, action: PayloadAction<string>) {
      const stepId = action.payload;
      if (!state.progress.completedSteps.includes(stepId)) {
        state.progress.completedSteps.push(stepId);
      }
      persistState(state);
    },

    // Move to next step
    nextStep(state) {
      state.progress.currentStep += 1;
      persistState(state);
    },

    // Move to previous step
    previousStep(state) {
      if (state.progress.currentStep > 0) {
        state.progress.currentStep -= 1;
      }
      persistState(state);
    },

    // Go to specific step
    goToStep(state, action: PayloadAction<number>) {
      state.progress.currentStep = action.payload;
      persistState(state);
    },

    // Skip onboarding
    skipOnboarding(state) {
      state.isActive = false;
      state.progress.skipped = true;
      persistState(state);
    },

    // Complete onboarding
    completeOnboarding(state) {
      state.isActive = false;
      state.progress.completedAt = new Date().toISOString();
      persistState(state);
    },

    // Reset onboarding (for testing or restart)
    resetOnboarding(state) {
      state.isActive = true;
      state.progress = getDefaultProgress();
      state.showTutorial = true;
      persistState(state);
    },

    // Toggle tutorial tooltips
    toggleTutorial(state) {
      state.showTutorial = !state.showTutorial;
      persistState(state);
    },

    // Hide tutorial tooltips
    hideTutorial(state) {
      state.showTutorial = false;
      persistState(state);
    },

    // Show tutorial tooltips
    showTutorial(state) {
      state.showTutorial = true;
      persistState(state);
    },
  },
});

export const {
  startOnboarding,
  completeStep,
  nextStep,
  previousStep,
  goToStep,
  skipOnboarding,
  completeOnboarding,
  resetOnboarding,
  toggleTutorial,
  hideTutorial,
  showTutorial,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;

// Selectors
export const selectOnboardingActive = (state: { onboarding: OnboardingState }) =>
  state.onboarding.isActive;

export const selectOnboardingProgress = (state: { onboarding: OnboardingState }) =>
  state.onboarding.progress;

export const selectCurrentStep = (state: { onboarding: OnboardingState }) =>
  state.onboarding.progress.currentStep;

export const selectCompletedSteps = (state: { onboarding: OnboardingState }) =>
  state.onboarding.progress.completedSteps;

export const selectShowTutorial = (state: { onboarding: OnboardingState }) =>
  state.onboarding.showTutorial;

export const selectOnboardingCompleted = (state: { onboarding: OnboardingState }) =>
  !state.onboarding.isActive && !!state.onboarding.progress.completedAt;
