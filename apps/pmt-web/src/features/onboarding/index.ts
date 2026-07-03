/**
 * Onboarding Feature Module
 *
 * Exports all onboarding-related components, hooks, and state management.
 */

// Components
export { OnboardingFlow } from './components/OnboardingFlow';

// Redux slice and actions
export {
  default as onboardingReducer,
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
  // Selectors
  selectOnboardingActive,
  selectOnboardingProgress,
  selectCurrentStep,
  selectCompletedSteps,
  selectShowTutorial,
  selectOnboardingCompleted,
} from './onboardingSlice';

// Types
export type {
  OnboardingStep,
  OnboardingAction,
  OnboardingProgress,
  OnboardingState,
  OnboardingTooltip,
  FeatureHighlight,
} from './types';

export { ONBOARDING_STEPS } from './types';
